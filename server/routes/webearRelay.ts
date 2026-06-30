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
import type { IStorage } from '../storage';
import { analyzePcm } from '../services/mcpAudioAnalysis';
import { describeAudio } from '../services/audioDescribe';
import { getCreditService } from '../services/credits';

// ── In-memory stores ──────────────────────────────────────────────────────────

interface BlobEntry { buffer: Buffer; contentType: string; expiresAt: number; }
interface McpSession { res: Response; userId: string; rawKey: string; }
interface PendingCapture { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; }

const audioBlobs        = new Map<string, BlobEntry>();
const browserSessions   = new Map<string, Response>();      // userId → browser SSE
const mcpSessions       = new Map<string, McpSession>();    // sessionId → Claude SSE
const pendingCaptures   = new Map<string, PendingCapture>();

// ── Blob store with a hard memory ceiling ──────────────────────────────────────
// The blob POST below is intentionally unauthenticated: the in-app mastering card
// and headless capture scripts mint their own captureId and can't attach a bearer
// token. To stop that open endpoint from being used to exhaust server memory, the
// store is bounded — oldest blobs are evicted once either ceiling is hit. A single
// blob is already capped at 50 MB by express.raw() on the route, so no one blob can
// exceed the total ceiling.
const MAX_TOTAL_BLOB_BYTES = 256 * 1024 * 1024; // 256 MB resident across all captures
const MAX_BLOB_COUNT       = 64;                // independent of size
let totalBlobBytes = 0;

function deleteBlob(id: string): void {
  const existing = audioBlobs.get(id);
  if (existing) {
    totalBlobBytes -= existing.buffer.byteLength;
    audioBlobs.delete(id);
  }
}

function storeBlob(id: string, entry: BlobEntry): void {
  deleteBlob(id);                       // replacing an id: drop its old bytes first
  audioBlobs.set(id, entry);
  totalBlobBytes += entry.buffer.byteLength;
  // Evict oldest (Map preserves insertion order) until back under both ceilings.
  // Never evict the blob we just stored.
  while (
    (totalBlobBytes > MAX_TOTAL_BLOB_BYTES || audioBlobs.size > MAX_BLOB_COUNT) &&
    audioBlobs.size > 1
  ) {
    const oldest = audioBlobs.keys().next().value as string | undefined;
    if (oldest === undefined || oldest === id) break;
    deleteBlob(oldest);
  }
}

// Purge blobs older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, b] of audioBlobs) if (b.expiresAt < now) deleteBlob(id);
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
          {
            name: 'diff_audio',
            description: 'Compare two audio captures. Reports differences in loudness, peak, dynamic range, clipping, spectral balance, and timing/groove. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: {
                capture_id_a: { type: 'string', description: 'First capture ID (before)' },
                capture_id_b: { type: 'string', description: 'Second capture ID (after) to compare against the first' }
              },
              required: ['capture_id_a', 'capture_id_b'],
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

      const balance = await creditService.getBalance(session.userId);
      if (balance < 2) return mcpErr(id, `Insufficient credits (have ${balance}, need 2). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        // True audio listening via the Gemini-first provider chain (free tier),
        // OpenAI fallback. See services/audioDescribe.ts.
        const description = await describeAudio(blob.buffer);
        await creditService.deductCredits(session.userId, 2, 'webear describe_audio', { tool: 'describe_audio' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);
        return mcpText(id, description);
      } catch (err: any) {
        return mcpErr(id, `Description failed: ${err.message}`);
      }
    }

    // ── diff_audio ───────────────────────────────────────────────────────────
    if (toolName === 'diff_audio') {
      const captureIdA = String(args.capture_id_a ?? '');
      const captureIdB = String(args.capture_id_b ?? '');

      const blobA = audioBlobs.get(captureIdA);
      const blobB = audioBlobs.get(captureIdB);

      if (!blobA) return mcpErr(id, `Capture A "${captureIdA}" not found or expired. Run capture_audio again.`);
      if (!blobB) return mcpErr(id, `Capture B "${captureIdB}" not found or expired. Run capture_audio again.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits (have ${balance}, need 1). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        const decodedA = await decodeWebmToPcm(blobA.buffer);
        const decodedB = await decodeWebmToPcm(blobB.buffer);

        const reportA = analyzePcm(decodedA.samples, decodedA.sampleRate);
        const reportB = analyzePcm(decodedB.samples, decodedB.sampleRate);

        await creditService.deductCredits(session.userId, 1, 'webear diff_audio', { tool: 'diff_audio' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const formatDelta = (val: number, unit = '', decimals = 1, showPlus = true) => {
          if (val === 0) return 'no change';
          const sign = showPlus && val > 0 ? '+' : '';
          return `${sign}${val.toFixed(decimals)}${unit}`;
        };

        const formatPercentChange = (oldVal: number, newVal: number, decimals = 1) => {
          if (oldVal === 0) return newVal === 0 ? 'no change' : 'new value';
          const pct = ((newVal - oldVal) / oldVal) * 100;
          return pct === 0 ? 'no change' : `${pct > 0 ? '+' : ''}${pct.toFixed(decimals)}%`;
        };

        const dbDeltaStr = (aDb: number, bDb: number) => {
          if (aDb === -Infinity || bDb === -Infinity) {
            if (aDb === bDb) return 'no change';
            return bDb === -Infinity ? '-∞ dB (silenced)' : '+∞ dB (activated)';
          }
          const diff = bDb - aDb;
          return `${diff > 0 ? '+' : ''}${diff.toFixed(1)} dB`;
        };

        const lines: string[] = [];
        lines.push(`### Audio Comparison Report`);
        lines.push(`Comparing **${captureIdA}** (A) vs **${captureIdB}** (B)`);
        lines.push(``);
        lines.push(`| Metric | Capture A | Capture B | Delta |`);
        lines.push(`| :--- | :--- | :--- | :--- |`);
        lines.push(`| **Duration** | ${reportA.durationSeconds.toFixed(2)}s | ${reportB.durationSeconds.toFixed(2)}s | ${formatDelta(reportB.durationSeconds - reportA.durationSeconds, 's', 2)} |`);
        
        const rmsAStr = reportA.rmsDb === -Infinity ? '-∞' : reportA.rmsDb.toFixed(1);
        const rmsBStr = reportB.rmsDb === -Infinity ? '-∞' : reportB.rmsDb.toFixed(1);
        lines.push(`| **RMS Loudness** | ${rmsAStr} dBFS | ${rmsBStr} dBFS | ${dbDeltaStr(reportA.rmsDb, reportB.rmsDb)} |`);

        const peakAStr = reportA.peakDb === -Infinity ? '-∞' : reportA.peakDb.toFixed(1);
        const peakBStr = reportB.peakDb === -Infinity ? '-∞' : reportB.peakDb.toFixed(1);
        lines.push(`| **Peak Level** | ${peakAStr} dBFS | ${peakBStr} dBFS | ${dbDeltaStr(reportA.peakDb, reportB.peakDb)} |`);
        lines.push(`| **Dynamic Range** | ${reportA.dynamicRangeDb.toFixed(1)} dB | ${reportB.dynamicRangeDb.toFixed(1)} dB | ${formatDelta(reportB.dynamicRangeDb - reportA.dynamicRangeDb, ' dB', 1)} |`);
        lines.push(`| **Crest Factor** | ${reportA.crestFactor.toFixed(2)} | ${reportB.crestFactor.toFixed(2)} | ${formatDelta(reportB.crestFactor - reportA.crestFactor, '', 2)} |`);
        lines.push(`| **Clipped Samples** | ${reportA.clippedSampleCount} (${reportA.clippingPercent.toFixed(2)}%) | ${reportB.clippedSampleCount} (${reportB.clippingPercent.toFixed(2)}%) | ${formatDelta(reportB.clippedSampleCount - reportA.clippedSampleCount, ' samples', 0)} (${formatDelta(reportB.clippingPercent - reportA.clippingPercent, '%', 2)}) |`);
        lines.push(`| **DC Offset** | ${reportA.dcOffset.toFixed(4)} | ${reportB.dcOffset.toFixed(4)} | ${formatDelta(reportB.dcOffset - reportA.dcOffset, '', 4)} |`);
        lines.push(`| **Spectral Centroid** | ${reportA.spectralCentroidHz.toFixed(0)} Hz | ${reportB.spectralCentroidHz.toFixed(0)} Hz | ${formatDelta(reportB.spectralCentroidHz - reportA.spectralCentroidHz, ' Hz', 0)} (${formatPercentChange(reportA.spectralCentroidHz, reportB.spectralCentroidHz, 1)}) |`);

        lines.push(``);
        lines.push(`#### Frequency Band Energy Distribution`);
        lines.push(`| Band | Capture A | Capture B | Delta (Absolute) |`);
        lines.push(`| :--- | :--- | :--- | :--- |`);
        
        const bands: Array<{ name: string, key: keyof typeof reportA.bandEnergy }> = [
          { name: 'Sub (20-80 Hz)', key: 'sub' },
          { name: 'Bass (80-250 Hz)', key: 'bass' },
          { name: 'Low-Mid (250-2000 Hz)', key: 'lowMid' },
          { name: 'High-Mid (2000-6000 Hz)', key: 'highMid' },
          { name: 'High (6000-20000 Hz)', key: 'high' }
        ];

        for (const band of bands) {
          const valA = reportA.bandEnergy[band.key] * 100;
          const valB = reportB.bandEnergy[band.key] * 100;
          lines.push(`| ${band.name} | ${valA.toFixed(1)}% | ${valB.toFixed(1)}% | ${formatDelta(valB - valA, '%', 1)} |`);
        }

        lines.push(``);
        lines.push(`#### Rhythm & Timing`);
        
        const bpmA = reportA.estimatedBpm ? `${reportA.estimatedBpm} BPM` : 'N/A';
        const bpmB = reportB.estimatedBpm ? `${reportB.estimatedBpm} BPM` : 'N/A';
        const bpmDelta = (reportA.estimatedBpm && reportB.estimatedBpm) 
          ? formatDelta(reportB.estimatedBpm - reportA.estimatedBpm, ' BPM', 0) 
          : 'N/A';
        
        lines.push(`- **Estimated Tempo:** ${bpmA} → ${bpmB} (${bpmDelta})`);
        lines.push(`- **Onset Count:** ${reportA.onsetCount} → ${reportB.onsetCount} (${formatDelta(reportB.onsetCount - reportA.onsetCount, ' onsets', 0)})`);
        
        const jitterA = reportA.onsetCount >= 2 ? `${reportA.onsetTimingStdDevMs.toFixed(1)} ms` : 'N/A';
        const jitterB = reportB.onsetCount >= 2 ? `${reportB.onsetTimingStdDevMs.toFixed(1)} ms` : 'N/A';
        const jitterDelta = (reportA.onsetCount >= 2 && reportB.onsetCount >= 2)
          ? formatDelta(reportB.onsetTimingStdDevMs - reportA.onsetTimingStdDevMs, ' ms', 1)
          : 'N/A';
        lines.push(`- **Timing Jitter:** ${jitterA} → ${jitterB} (${jitterDelta})`);

        lines.push(``);
        lines.push(`#### Diagnostic & Audio Character Changes`);
        
        if (reportA.isSilent !== reportB.isSilent) {
          lines.push(`- **Silence Status:** Changed from ${reportA.isSilent ? 'Silent' : 'Active'} to ${reportB.isSilent ? 'Silent' : 'Active'}.`);
        }
        
        if (reportA.hasClipping !== reportB.hasClipping) {
          lines.push(`- **Clipping Status:** ${reportB.hasClipping ? '⚠ Headroom exceeded — clipping has started.' : '✓ Clipping resolved.'}`);
        } else if (reportB.hasClipping && reportB.clippingPercent !== reportA.clippingPercent) {
          const clipDiff = reportB.clippingPercent - reportA.clippingPercent;
          lines.push(`- **Clipping Severity:** ${clipDiff > 0 ? `⚠ Increased clipping by ${clipDiff.toFixed(2)}%` : `✓ Reduced clipping by ${Math.abs(clipDiff).toFixed(2)}%`}`);
        }

        if (reportA.hasDcOffset !== reportB.hasDcOffset) {
          lines.push(`- **DC Offset Status:** ${reportB.hasDcOffset ? '⚠ DC Offset detected (> 0.01).' : '✓ DC Offset resolved.'}`);
        }

        const toneCategory = (centroid: number) => {
          if (centroid < 800) return 'Very Dark';
          if (centroid < 2000) return 'Warm';
          if (centroid < 4000) return 'Balanced';
          return 'Bright/Harsh';
        };
        const catA = toneCategory(reportA.spectralCentroidHz);
        const catB = toneCategory(reportB.spectralCentroidHz);
        if (catA !== catB) {
          lines.push(`- **Tonal Balance:** Shifted from **${catA}** to **${catB}**.`);
        }

        const jitterCategory = (jitter: number) => {
          if (jitter < 5) return 'Very Tight';
          if (jitter < 15) return 'Acceptable';
          return 'Loose/Erratic';
        };
        if (reportA.onsetCount >= 2 && reportB.onsetCount >= 2) {
          const jitCatA = jitterCategory(reportA.onsetTimingStdDevMs);
          const jitCatB = jitterCategory(reportB.onsetTimingStdDevMs);
          if (jitCatA !== jitCatB) {
            lines.push(`- **Timing Quality:** Shifted from **${jitCatA}** to **${jitCatB}**.`);
          }
        }

        lines.push(``);
        lines.push(`#### Plain English Summaries`);
        lines.push(`* **A:** *${reportA.summary}*`);
        lines.push(`* **B:** *${reportB.summary}*`);

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Diff failed: ${err.message}`);
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

  function extractApiKey(req: Request): string {
    const auth = req.headers['authorization'];
    if (typeof auth === 'string') {
      const match = auth.match(/^Bearer\s+(.+)$/i);
      if (match?.[1]) return match[1].trim();
    }
    const queryKey = req.query.key;
    return typeof queryKey === 'string' ? queryKey.trim() : '';
  }

  // ── 1. Browser SSE — receives capture commands ────────────────────────────
  router.get('/connect', async (req: Request, res: Response) => {
    const key = extractApiKey(req);
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

    storeBlob(captureId, { buffer, contentType, expiresAt: Date.now() + 5 * 60_000 });

    const pending = pendingCaptures.get(captureId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pendingCaptures.delete(captureId);
    }

    res.json({ ok: true });
  });

  // ── 3. In-app analyze — no auth, no credits; used by mastering card ─────
  router.get('/analyze-app/:captureId', async (req: Request, res: Response) => {
    const blob = audioBlobs.get(req.params.captureId);
    if (!blob) return void res.status(404).json({ error: 'Capture not found or expired (5 min TTL)' });
    try {
      const decoded = await decodeWebmToPcm(blob.buffer);
      const report  = analyzePcm(decoded.samples, decoded.sampleRate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── 4. MCP SSE transport — Claude Code connects here ─────────────────────
  router.get('/mcp/sse', async (req: Request, res: Response) => {
    const key = extractApiKey(req);
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

