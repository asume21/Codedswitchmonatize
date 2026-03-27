/**
 * WebEar Relay + MCP SSE Server
 *
 * Replaces the local relay server entirely. Handles:
 *   GET  /api/webear/connect          — browser SSE (receives capture commands)
 *   POST /api/webear/blob/:captureId  — browser posts captured audio
 *   GET  /api/webear/mcp/sse          — Claude Code MCP SSE transport
 *   POST /api/webear/mcp/messages     — Claude Code MCP JSON-RPC messages
 */

import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import type { IStorage } from '../storage';
import { analyzePcm } from '../services/mcpAudioAnalysis';
import { getCreditService } from '../services/credits';

// ── In-memory stores ──────────────────────────────────────────────────────────

interface BlobEntry { buffer: Buffer; contentType: string; expiresAt: number; }
interface McpSession { res: Response; userId: string; rawKey: string; }
interface PendingCapture { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; }

const audioBlobs        = new Map<string, BlobEntry>();
const browserSessions   = new Map<string, Response>();      // userId → browser SSE
const mcpSessions       = new Map<string, McpSession>();    // sessionId → Claude SSE
const pendingCaptures   = new Map<string, PendingCapture>();

// Purge blobs older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, b] of audioBlobs) if (b.expiresAt < now) audioBlobs.delete(id);
}, 60_000);

// ── Helpers ───────────────────────────────────────────────────────────────────

function mcpText(id: unknown, text: string) {
  return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
}
function mcpErr(id: unknown, message: string) {
  return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${message}` }], isError: true } };
}

async function decodeWebmToPcm(buf: Buffer): Promise<{ samples: Float32Array; sampleRate: number }> {
  const SR = 44100;
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1']);
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.stderr.on('data', () => {});
    ff.stdout.on('end', () => {
      const combined = Buffer.concat(chunks);
      const aligned = combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength);
      resolve({ samples: new Float32Array(aligned), sampleRate: SR });
    });
    ff.on('error', (e) => reject(new Error(`ffmpeg: ${e.message}`)));
    ff.on('close', (code) => { if (code !== 0 && chunks.length === 0) reject(new Error(`ffmpeg exited ${code}`)); });
    ff.stdin.write(buf);
    ff.stdin.end();
  });
}

async function convertWebmToWav(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'wav', '-ac', '1', '-ar', '44100', 'pipe:1']);
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.stderr.on('data', () => {});
    ff.stdout.on('end', () => resolve(Buffer.concat(chunks)));
    ff.on('error', (e) => reject(new Error(`ffmpeg: ${e.message}`)));
    ff.on('close', (code) => { if (code !== 0 && chunks.length === 0) reject(new Error(`ffmpeg exited ${code}`)); });
    ff.stdin.write(buf);
    ff.stdin.end();
  });
}

// ── MCP Protocol ──────────────────────────────────────────────────────────────

async function handleMcpMessage(
  msg: any,
  session: McpSession,
  storage: IStorage,
  creditService: ReturnType<typeof getCreditService>,
): Promise<object | null> {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'webear', version: '1.1.0' },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'initialized') return null;
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0', id,
      result: {
        tools: [
          {
            name: 'capture_audio',
            description: 'Capture live audio from the browser tab. Free — no credits.',
            inputSchema: {
              type: 'object',
              properties: {
                duration_ms: {
                  type: 'number',
                  description: 'Milliseconds to record (default 3000, max 30000)',
                  minimum: 500,
                  maximum: 30000,
                },
              },
            },
          },
          {
            name: 'analyze_audio',
            description: 'Signal analysis — BPM, loudness, frequency bands, clipping detection. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: { capture_id: { type: 'string', description: 'ID returned by capture_audio' } },
              required: ['capture_id'],
            },
          },
          {
            name: 'describe_audio',
            description: 'AI plain-English description — instruments, genre, mood. Costs 2 credits.',
            inputSchema: {
              type: 'object',
              properties: { capture_id: { type: 'string', description: 'ID returned by capture_audio' } },
              required: ['capture_id'],
            },
          },
        ],
      },
    };
  }

  if (method === 'tools/call') {
    const toolName = params?.name as string;
    const args     = params?.arguments ?? {};

    // ── capture_audio ────────────────────────────────────────────────────────
    if (toolName === 'capture_audio') {
      const durationMs = Math.min(30000, Math.max(500, Number(args.duration_ms ?? 3000)));
      const browserRes = browserSessions.get(session.userId);

      if (!browserRes) {
        return mcpErr(id,
          'No browser tab is connected. Make sure your app is open in a browser and WebEar.init() has been called.');
      }

      const captureId = crypto.randomBytes(8).toString('hex');
      browserRes.write(`event: capture\ndata: ${JSON.stringify({ captureId, durationMs })}\n\n`);

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            pendingCaptures.delete(captureId);
            reject(new Error(`Capture timed out after ${durationMs + 8000}ms. Browser may have stopped recording.`));
          }, durationMs + 8000);
          pendingCaptures.set(captureId, { resolve, reject, timer });
        });
      } catch (err: any) {
        return mcpErr(id, err.message);
      }

      return mcpText(id,
        `Capture complete.\ncapture_id: ${captureId}\nDuration: ${durationMs}ms\n\n` +
        `Run analyze_audio with capture_id="${captureId}" for signal analysis, ` +
        `or describe_audio with capture_id="${captureId}" for an AI description.`
      );
    }

    // ── analyze_audio ────────────────────────────────────────────────────────
    if (toolName === 'analyze_audio') {
      const captureId = String(args.capture_id ?? '');
      const blob = audioBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Capture "${captureId}" not found or expired (5 min TTL). Run capture_audio again.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits (have ${balance}, need 1). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        const decoded = await decodeWebmToPcm(blob.buffer);
        const report  = analyzePcm(decoded.samples, decoded.sampleRate);
        await creditService.deductCredits(session.userId, 1, 'webear analyze_audio', { tool: 'analyze_audio' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);
        return mcpText(id, JSON.stringify(report, null, 2));
      } catch (err: any) {
        return mcpErr(id, `Analysis failed: ${err.message}`);
      }
    }

    // ── describe_audio ───────────────────────────────────────────────────────
    if (toolName === 'describe_audio') {
      const captureId = String(args.capture_id ?? '');
      const blob = audioBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Capture "${captureId}" not found or expired. Run capture_audio again.`);

      if (!process.env.OPENAI_API_KEY) return mcpErr(id, 'Server configuration error: OPENAI_API_KEY missing.');

      const balance = await creditService.getBalance(session.userId);
      if (balance < 2) return mcpErr(id, `Insufficient credits (have ${balance}, need 2). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        const wavBuf = await convertWebmToWav(blob.buffer);
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const result = await openai.chat.completions.create({
          model: 'gpt-4o-audio-preview',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this audio in detail. What instruments do you hear? What is the genre, mood, rhythm, and tone? If ambient, describe the textures and frequencies. Be concise but analytical.' },
              { type: 'input_audio', input_audio: { data: wavBuf.toString('base64'), format: 'wav' } },
            ],
          }],
        });
        await creditService.deductCredits(session.userId, 2, 'webear describe_audio', { tool: 'describe_audio' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);
        return mcpText(id, result.choices[0]?.message?.content ?? 'No description returned.');
      } catch (err: any) {
        return mcpErr(id, `Description failed: ${err.message}`);
      }
    }

    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
  }

  // Ignore notification-style messages (no id)
  if (!id) return null;
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
}

// ── Route Factory ─────────────────────────────────────────────────────────────

export function createWebearRelayRoutes(storage: IStorage): Router {
  const router = Router();
  const creditService = getCreditService(storage);

  // Shared CORS — browser snippet is cross-origin
  router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return void res.sendStatus(204);
    next();
  });

  async function resolveKey(rawKey: string) {
    if (!rawKey?.startsWith('wbr_')) return null;
    const keyRecord = await storage.getWebearKeyByValue(rawKey);
    if (!keyRecord || !keyRecord.isActive) return null;
    return keyRecord;
  }

  // ── 1. Browser SSE — receives capture commands ────────────────────────────
  router.get('/connect', async (req: Request, res: Response) => {
    const key = req.query.key as string;
    const keyRecord = await resolveKey(key);
    if (!keyRecord) return void res.status(401).json({ error: 'Invalid API key. Generate one at https://www.codedswitch.com/developer' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    browserSessions.set(keyRecord.userId, res);
    res.write('event: connected\ndata: {"status":"ready"}\n\n');

    const ping = setInterval(() => res.write(':\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      if (browserSessions.get(keyRecord.userId) === res) browserSessions.delete(keyRecord.userId);
    });
  });

  // ── 2. Browser POSTs captured blob ────────────────────────────────────────
  router.post('/blob/:captureId', express.raw({ type: '*/*', limit: '50mb' }), (req: Request, res: Response) => {
    const { captureId } = req.params;
    const buffer      = req.body as Buffer;
    const contentType = req.headers['content-type'] || 'audio/webm';

    audioBlobs.set(captureId, { buffer, contentType, expiresAt: Date.now() + 5 * 60_000 });

    const pending = pendingCaptures.get(captureId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pendingCaptures.delete(captureId);
    }

    res.json({ ok: true });
  });

  // ── 3. MCP SSE transport — Claude Code connects here ─────────────────────
  router.get('/mcp/sse', async (req: Request, res: Response) => {
    const key = req.query.key as string;
    const keyRecord = await resolveKey(key);
    if (!keyRecord) return void res.status(401).json({ error: 'Invalid API key' });

    const sessionId = crypto.randomBytes(16).toString('hex');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    mcpSessions.set(sessionId, { res, userId: keyRecord.userId, rawKey: key });

    // Build absolute URL for the messages endpoint
    const proto   = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
    const host    = req.headers['x-forwarded-host'] as string || req.headers.host || 'www.codedswitch.com';
    const msgUrl  = `${proto}://${host}/api/webear/mcp/messages?sessionId=${sessionId}`;

    res.write(`event: endpoint\ndata: ${msgUrl}\n\n`);

    const ping = setInterval(() => res.write(':\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      mcpSessions.delete(sessionId);
    });
  });

  // ── 4. MCP JSON-RPC messages ──────────────────────────────────────────────
  router.post('/mcp/messages', express.json(), async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const session   = mcpSessions.get(sessionId);
    if (!session) return void res.status(404).json({ error: 'MCP session not found or expired. Reconnect via /api/webear/mcp/sse' });

    res.status(202).send(); // Ack immediately; response travels via SSE

    const response = await handleMcpMessage(req.body, session, storage, creditService);
    if (response !== null) {
      session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    }
  });

  return router;
}
