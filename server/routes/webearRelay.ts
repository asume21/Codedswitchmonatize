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
import { db } from '../db';
import { sql } from 'drizzle-orm';
import type { IStorage } from '../storage';
import { analyzePcm } from '../services/mcpAudioAnalysis';
import { describeAudio } from '../services/audioDescribe';
import { describeVideo, compareVideos, createPostFromVideo } from '../services/videoDescribe';
import { getCreditService } from '../services/credits';

// ── In-memory stores ──────────────────────────────────────────────────────────

interface BlobEntry { buffer: Buffer; contentType: string; expiresAt: number; }
interface McpSession { res: Response; userId: string; rawKey: string; }
interface PendingCapture { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; }

interface WebNerveReport {
  captureId: string;
  timestamp: number;
  windowMs: number;
  actualWindowMs: number;
  metrics: {
    totalResources: number;
    apiRequestsCount: number;
    apiRequests: Array<{
      name: string;
      durationMs: number;
      transferSize: number;
      decodedBodySize: number;
      initiatorType: string;
    }>;
    storage: {
      localStorageBytes: number;
      sessionStorageBytes: number;
    };
    connection: {
      effectiveType: string;
      rttMs: number;
      downlinkMb: number;
      saveData: boolean;
    } | null;
  };
}

interface WebShieldReport {
  captureId: string;
  timestamp: number;
  protocol: string;
  origin: string;
  isHttps: boolean;
  security: {
    isFramed: boolean;
    metaCsps: string[];
    readableCookies: string[];
    storageRisks: string[];
  };
}

interface WebLogReport {
  captureId: string;
  timestamp: number;
  durationMs: number;
  logs: Array<{
    type: 'log' | 'warn' | 'error' | 'exception';
    message: string;
    timestamp: number;
  }>;
  stateSnapshot: {
    audioState: string;
    isPlaying: boolean;
    activeBpm: number;
  };
}

interface TelemetryData {
  fps: {
    average: number;
    min: number;
    max: number;
    jitterMs: number;
  };
  memory: {
    supported: boolean;
    usedHeapMb: number;
    totalHeapMb: number;
    limitMb: number;
    heapUsagePercent: number;
  };
  vitals: {
    cumulativeLayoutShift: number;
    firstInputDelayMs: number | null;
  };
  interaction: {
    clicks: number;
    keypresses: number;
    scrolls: number;
  };
  audioState: {
    state: string;
    sampleRate: number;
    latencySeconds: number;
  };
}

const audioBlobs              = new Map<string, BlobEntry>();
const videoBlobs              = new Map<string, BlobEntry>();
const telemetryBlobs          = new Map<string, BlobEntry>();
const nerveBlobs              = new Map<string, BlobEntry>();
const shieldBlobs             = new Map<string, BlobEntry>();
const logBlobs                = new Map<string, BlobEntry>();

const browserSessions         = new Map<string, Response>();      // userId → webear browser SSE
const webeyeBrowserSessions   = new Map<string, Response>();      // userId → webeye browser SSE
const websenseBrowserSessions = new Map<string, Response>();      // userId → websense browser SSE
const webnerveBrowserSessions = new Map<string, Response>();      // userId → webnerve browser SSE
const webshieldBrowserSessions = new Map<string, Response>();     // userId → webshield browser SSE
const weblogBrowserSessions   = new Map<string, Response>();      // userId → weblog browser SSE

const mcpSessions             = new Map<string, McpSession>();    // sessionId → Claude SSE

const pendingCaptures         = new Map<string, PendingCapture>(); // WebEar captures
const pendingWebeyeCaptures   = new Map<string, PendingCapture>(); // WebEye captures
const pendingWebsenseCaptures = new Map<string, PendingCapture>(); // WebSense captures
const pendingWebnerveCaptures = new Map<string, PendingCapture>(); // WebNerve captures
const pendingWebshieldCaptures = new Map<string, PendingCapture>(); // WebShield captures
const pendingWeblogCaptures   = new Map<string, PendingCapture>(); // WebLog captures

// ── Audio Blob store with a hard memory ceiling ──────────────────────────────────────
const MAX_TOTAL_AUDIO_BYTES = 256 * 1024 * 1024;
const MAX_AUDIO_COUNT       = 64;
let totalAudioBytes = 0;

function deleteAudioBlob(id: string): void {
  const existing = audioBlobs.get(id);
  if (existing) {
    totalAudioBytes -= existing.buffer.byteLength;
    audioBlobs.delete(id);
  }
}

function storeAudioBlob(id: string, entry: BlobEntry): void {
  deleteAudioBlob(id);
  audioBlobs.set(id, entry);
  totalAudioBytes += entry.buffer.byteLength;
  while ((totalAudioBytes > MAX_TOTAL_AUDIO_BYTES || audioBlobs.size > MAX_AUDIO_COUNT) && audioBlobs.size > 1) {
    const oldest = audioBlobs.keys().next().value as string | undefined;
    if (oldest === undefined || oldest === id) break;
    deleteAudioBlob(oldest);
  }
}

async function persistAudioBlob(id: string, entry: BlobEntry): Promise<void> {
  const expiresAt = new Date(entry.expiresAt);
  await db.execute(sql`
    INSERT INTO webear_captures (
      capture_id,
      content_type,
      audio_data,
      expires_at
    ) VALUES (
      ${id},
      ${entry.contentType},
      ${entry.buffer},
      ${expiresAt}
    )
    ON CONFLICT (capture_id) DO UPDATE SET
      content_type = EXCLUDED.content_type,
      audio_data = EXCLUDED.audio_data,
      expires_at = EXCLUDED.expires_at
  `);
}

async function loadPersistedAudioBlob(id: string): Promise<BlobEntry | null> {
  const rows = await db.execute(sql`
    SELECT
      content_type as "contentType",
      audio_data as "audioData",
      expires_at as "expiresAt"
    FROM webear_captures
    WHERE capture_id = ${id}
      AND expires_at > NOW()
    LIMIT 1
  `);

  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  const audioData = row.audioData as Buffer | Uint8Array | null;
  const expiresAt = row.expiresAt instanceof Date
    ? row.expiresAt.getTime()
    : Date.parse(String(row.expiresAt));

  if (!audioData || !Number.isFinite(expiresAt)) return null;

  return {
    buffer: Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData),
    contentType: String(row.contentType || 'audio/webm'),
    expiresAt,
  };
}

async function getAudioBlob(captureId: string): Promise<BlobEntry | null> {
  const inMemory = audioBlobs.get(captureId);
  if (inMemory && inMemory.expiresAt > Date.now()) return inMemory;
  const persisted = await loadPersistedAudioBlob(captureId);
  if (!persisted) return null;
  storeAudioBlob(captureId, persisted);
  return persisted;
}

// ── Video Blob store with a hard memory ceiling ──────────────────────────────────────
const MAX_TOTAL_VIDEO_BYTES = 256 * 1024 * 1024;
const MAX_VIDEO_COUNT       = 64;
let totalVideoBytes = 0;

function deleteVideoBlob(id: string): void {
  const existing = videoBlobs.get(id);
  if (existing) {
    totalVideoBytes -= existing.buffer.byteLength;
    videoBlobs.delete(id);
  }
}

function storeVideoBlob(id: string, entry: BlobEntry): void {
  deleteVideoBlob(id);
  videoBlobs.set(id, entry);
  totalVideoBytes += entry.buffer.byteLength;
  while ((totalVideoBytes > MAX_TOTAL_VIDEO_BYTES || videoBlobs.size > MAX_VIDEO_COUNT) && videoBlobs.size > 1) {
    const oldest = videoBlobs.keys().next().value as string | undefined;
    if (oldest === undefined || oldest === id) break;
    deleteVideoBlob(oldest);
  }
}

// ── Telemetry Blob store with a hard memory ceiling ──────────────────────────────────
const MAX_TOTAL_TELEMETRY_BYTES = 32 * 1024 * 1024;
const MAX_TELEMETRY_COUNT       = 128;
let totalTelemetryBytes = 0;

function deleteTelemetryBlob(id: string): void {
  const existing = telemetryBlobs.get(id);
  if (existing) {
    totalTelemetryBytes -= existing.buffer.byteLength;
    telemetryBlobs.delete(id);
  }
}

function storeTelemetryBlob(id: string, entry: BlobEntry): void {
  deleteTelemetryBlob(id);
  telemetryBlobs.set(id, entry);
  totalTelemetryBytes += entry.buffer.byteLength;
  while ((totalTelemetryBytes > MAX_TOTAL_TELEMETRY_BYTES || telemetryBlobs.size > MAX_TELEMETRY_COUNT) && telemetryBlobs.size > 1) {
    const oldest = telemetryBlobs.keys().next().value as string | undefined;
    if (oldest === undefined || oldest === id) break;
    deleteTelemetryBlob(oldest);
  }
}

// ── WebNerve Blob store with a hard memory ceiling ──────────────────────────────────
const MAX_TOTAL_NERVE_BYTES = 32 * 1024 * 1024;
const MAX_NERVE_COUNT       = 64;
let totalNerveBytes = 0;

function deleteNerveBlob(id: string): void {
  const existing = nerveBlobs.get(id);
  if (existing) {
    totalNerveBytes -= existing.buffer.byteLength;
    nerveBlobs.delete(id);
  }
}

function storeNerveBlob(id: string, entry: BlobEntry): void {
  deleteNerveBlob(id);
  nerveBlobs.set(id, entry);
  totalNerveBytes += entry.buffer.byteLength;
  while ((totalNerveBytes > MAX_TOTAL_NERVE_BYTES || nerveBlobs.size > MAX_NERVE_COUNT) && nerveBlobs.size > 1) {
    const oldest = nerveBlobs.keys().next().value as string | undefined;
    if (oldest === undefined || oldest === id) break;
    deleteNerveBlob(oldest);
  }
}

// ── WebShield Blob store with a hard memory ceiling ──────────────────────────────────
const MAX_TOTAL_SHIELD_BYTES = 32 * 1024 * 1024;
const MAX_SHIELD_COUNT       = 64;
let totalShieldBytes = 0;

function deleteShieldBlob(id: string): void {
  const existing = shieldBlobs.get(id);
  if (existing) {
    totalShieldBytes -= existing.buffer.byteLength;
    shieldBlobs.delete(id);
  }
}

function storeShieldBlob(id: string, entry: BlobEntry): void {
  deleteShieldBlob(id);
  shieldBlobs.set(id, entry);
  totalShieldBytes += entry.buffer.byteLength;
  while ((totalShieldBytes > MAX_TOTAL_SHIELD_BYTES || shieldBlobs.size > MAX_SHIELD_COUNT) && shieldBlobs.size > 1) {
    const oldest = shieldBlobs.keys().next().value as string | undefined;
    if (oldest === undefined || oldest === id) break;
    deleteShieldBlob(oldest);
  }
}

// ── WebLog Blob store with a hard memory ceiling ───────────────────────────────────
const MAX_TOTAL_LOG_BYTES = 64 * 1024 * 1024;
const MAX_LOG_COUNT       = 64;
let totalLogBytes = 0;

function deleteLogBlob(id: string): void {
  const existing = logBlobs.get(id);
  if (existing) {
    totalLogBytes -= existing.buffer.byteLength;
    logBlobs.delete(id);
  }
}

function storeLogBlob(id: string, entry: BlobEntry): void {
  deleteLogBlob(id);
  logBlobs.set(id, entry);
  totalLogBytes += entry.buffer.byteLength;
  while ((totalLogBytes > MAX_TOTAL_LOG_BYTES || logBlobs.size > MAX_LOG_COUNT) && logBlobs.size > 1) {
    const oldest = logBlobs.keys().next().value as string | undefined;
    if (oldest === undefined || oldest === id) break;
    deleteLogBlob(oldest);
  }
}

// Purge all expired blobs older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, b] of audioBlobs) if (b.expiresAt < now) deleteAudioBlob(id);
  for (const [id, b] of videoBlobs) if (b.expiresAt < now) deleteVideoBlob(id);
  for (const [id, b] of telemetryBlobs) if (b.expiresAt < now) deleteTelemetryBlob(id);
  for (const [id, b] of nerveBlobs) if (b.expiresAt < now) deleteNerveBlob(id);
  for (const [id, b] of shieldBlobs) if (b.expiresAt < now) deleteShieldBlob(id);
  for (const [id, b] of logBlobs) if (b.expiresAt < now) deleteLogBlob(id);
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
          {
            name: 'groove_score',
            description: 'Analyze rhythmic accuracy and groove of an 8-16 bar capture. Measures kick timing accuracy vs grid, reporting average deviation, swing factor, and consistency score. Costs 2 credits.',
            inputSchema: {
              type: 'object',
              properties: {
                capture_id: { type: 'string', description: 'ID returned by capture_audio' },
                bpm: { type: 'number', description: 'Optional BPM of the track. If not specified, it will be automatically estimated.' }
              },
              required: ['capture_id'],
            },
          },
          {
            name: 'capture_and_analyze',
            description: 'Capture live audio from the browser tab and immediately run signal analysis on it. Costs 1 credit.',
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
            name: 'mix_coach',
            description: 'Capture live audio from the browser tab and receive structured mixing coaching feedback (loudness, dynamic punch, low-end mud, clipping, DC offset). Costs 3 credits.',
            inputSchema: {
              type: 'object',
              properties: {
                duration_ms: {
                  type: 'number',
                  description: 'Milliseconds to record (default 5000, max 30000)',
                  minimum: 1000,
                  maximum: 30000,
                },
              },
            },
          },
          {
            name: 'capture_video',
            description: 'Capture live canvas or video stream from the browser tab. Free — no credits.',
            inputSchema: {
              type: 'object',
              properties: {
                duration_ms: {
                  type: 'number',
                  description: 'Milliseconds to record (default 3000, max 30000)',
                  minimum: 500,
                  maximum: 30000,
                },
                selector: {
                  type: 'string',
                  description: 'Optional DOM selector for the canvas or video element. If omitted, captures first canvas/video or screen.',
                },
              },
            },
          },
          {
            name: 'describe_video',
            description: 'AI plain-English visual description — layout, animations, contrast, and visual bugs. Costs 2 credits.',
            inputSchema: {
              type: 'object',
              properties: { capture_id: { type: 'string', description: 'ID returned by capture_video' } },
              required: ['capture_id'],
            },
          },
          {
            name: 'diff_visuals',
            description: 'Compare two visual captures. Reports visual changes, layout modifications, element movements, or design shifts. Costs 2 credits.',
            inputSchema: {
              type: 'object',
              properties: {
                capture_id_a: { type: 'string', description: 'First capture ID (before)' },
                capture_id_b: { type: 'string', description: 'Second capture ID (after) to compare' },
              },
              required: ['capture_id_a', 'capture_id_b'],
            },
          },
          {
            name: 'create_post_from_video',
            description: 'Generate a structured markdown post (devlog, social, bug_report, or marketing) from a captured video. Costs 2 credits.',
            inputSchema: {
              type: 'object',
              properties: {
                capture_id: { type: 'string', description: 'ID returned by capture_video' },
                post_type: {
                  type: 'string',
                  description: 'The target style/destination of the generated post (default: devlog)',
                  enum: ['devlog', 'social', 'bug_report', 'marketing'],
                },
                context: {
                  type: 'string',
                  description: 'Optional additional context or instructions to influence the post contents',
                },
              },
              required: ['capture_id'],
            },
          },
          {
            name: 'capture_telemetry',
            description: 'Capture live performance telemetry and vital stats from the browser. Free — no credits.',
            inputSchema: {
              type: 'object',
              properties: {
                duration_ms: {
                  type: 'number',
                  description: 'Milliseconds to track (default 3000, max 30000)',
                  minimum: 500,
                  maximum: 30000,
                },
              },
            },
          },
          {
            name: 'analyze_telemetry',
            description: 'Analyze telemetry stats — frame rate, JS heap memory usage, layout shifts, audio latency. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: { capture_id: { type: 'string', description: 'ID returned by capture_telemetry' } },
              required: ['capture_id'],
            },
          },
          {
            name: 'capture_nerve',
            description: 'Capture live performance timings of API requests, connection quality indicators, and storage utilization. Free — no credits.',
            inputSchema: {
              type: 'object',
              properties: {
                duration_ms: {
                  type: 'number',
                  description: 'Milliseconds to track (default 3000, max 30000)',
                  minimum: 500,
                  maximum: 30000,
                },
              },
            },
          },
          {
            name: 'analyze_nerve',
            description: 'Analyze API timings, latency problems, network indicators, and local storage consumption. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: { capture_id: { type: 'string', description: 'ID returned by capture_nerve' } },
              required: ['capture_id'],
            },
          },
          {
            name: 'diff_nerve',
            description: 'Compare API timings and latencies between two nerve captures. Reports changes in query speeds and load. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: {
                capture_id_a: { type: 'string', description: 'First capture ID' },
                capture_id_b: { type: 'string', description: 'Second capture ID' },
              },
              required: ['capture_id_a', 'capture_id_b'],
            },
          },
          {
            name: 'capture_shield',
            description: 'Capture browser-side security attributes: cookie scopes, framings, storage exposure, and CSP policies. Free — no credits.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'analyze_shield',
            description: 'Analyze captured security profile for CORS wildcarding, unsecure cookies, token leaks, and CSP misses. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: { capture_id: { type: 'string', description: 'ID returned by capture_shield' } },
              required: ['capture_id'],
            },
          },
          {
            name: 'diff_shield',
            description: 'Compare two security captures to trace policy changes or patch validations. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: {
                capture_id_a: { type: 'string', description: 'First capture ID' },
                capture_id_b: { type: 'string', description: 'Second capture ID' },
              },
              required: ['capture_id_a', 'capture_id_b'],
            },
          },
          {
            name: 'capture_logs',
            description: 'Record browser console outputs (logs/warns/errors), exception triggers, and editor status snapshot. Free — no credits.',
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
            name: 'analyze_logs',
            description: 'Review uncaught exceptions, promise rejections, warning patterns, and active editor state snapshot. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: { capture_id: { type: 'string', description: 'ID returned by capture_logs' } },
              required: ['capture_id'],
            },
          },
          {
            name: 'diff_logs',
            description: 'Compare console output logs and editor state mutations between two log captures. Costs 1 credit.',
            inputSchema: {
              type: 'object',
              properties: {
                capture_id_a: { type: 'string', description: 'First capture ID' },
                capture_id_b: { type: 'string', description: 'Second capture ID' },
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

    // ── groove_score ─────────────────────────────────────────────────────────
    if (toolName === 'groove_score') {
      const captureId = String(args.capture_id ?? '');
      let targetBpm = args.bpm ? Number(args.bpm) : 0;

      const blob = audioBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Capture "${captureId}" not found or expired. Run capture_audio again.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 2) return mcpErr(id, `Insufficient credits (have ${balance}, need 2). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        const decoded = await decodeWebmToPcm(blob.buffer);
        const { samples, sampleRate } = decoded;

        // If BPM is not provided, estimate it or fallback to 120
        if (targetBpm <= 0) {
          const mainReport = analyzePcm(samples, sampleRate);
          targetBpm = mainReport.estimatedBpm || 120;
        }

        // 1. First-order low-pass filter (cutoff ~140Hz at 44.1kHz sample rate)
        // alpha = 0.02
        const lowPassed = new Float32Array(samples.length);
        let y = 0;
        const alpha = 0.02;
        for (let i = 0; i < samples.length; i++) {
          y = y + alpha * (samples[i] - y);
          lowPassed[i] = y;
        }

        // 2. energy envelope tracking + onset detection for kick
        const kickOnsets: number[] = [];
        let prevEnergy = 0;
        let lastKickMs = -Infinity;
        const FRAME_SIZE = 512;
        const HOP_SIZE = 256;
        const MIN_GAP_MS = 150; // Kicks don't usually repeat faster than every 150ms

        for (let offset = 0; offset + FRAME_SIZE <= lowPassed.length; offset += HOP_SIZE) {
          let energy = 0;
          for (let i = offset; i < offset + FRAME_SIZE; i++) {
            const s = lowPassed[i];
            energy += s * s;
          }
          energy = Math.sqrt(energy / FRAME_SIZE);

          const delta = energy - prevEnergy;
          const nowMs = (offset / sampleRate) * 1000;

          // Thresholds for low-frequency transient onset detection
          if (delta > 0.012 && nowMs - lastKickMs > MIN_GAP_MS && energy > 0.006) {
            kickOnsets.push(nowMs);
            lastKickMs = nowMs;
          }
          prevEnergy = energy;
        }

        await creditService.deductCredits(session.userId, 2, 'webear groove_score', { tool: 'groove_score' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        if (kickOnsets.length < 3) {
          return mcpText(id, 
            `### Groove Score Report\n\n` +
            `* **Capture ID:** ${captureId}\n` +
            `* **Estimated/Target BPM:** ${targetBpm.toFixed(1)} BPM\n\n` +
            `⚠ **Analysis Alert:** Too few low-frequency transients detected (${kickOnsets.length} kick-like events found).\n` +
            `Rhythmic/groove analysis requires at least 3 kick beats to analyze grid timing. Ensure the loop contains kick drum hits.`
          );
        }

        const beatIntervalMs = 60000 / targetBpm;
        const gridIntervalMs = beatIntervalMs / 4; // 16th note grid

        // 3. Phase Alignment Optimizer
        // Find best grid phase offset (bestPhi) in ms from 0 to gridIntervalMs
        let bestPhi = 0;
        let minError = Infinity;
        const searchStep = 1; // 1 ms resolution
        for (let phi = 0; phi < gridIntervalMs; phi += searchStep) {
          let sumError = 0;
          for (const t of kickOnsets) {
            const relative = t - phi;
            const dist = Math.abs(((relative + gridIntervalMs / 2) % gridIntervalMs) - gridIntervalMs / 2);
            sumError += dist * dist;
          }
          if (sumError < minError) {
            minError = sumError;
            bestPhi = phi;
          }
        }

        // 4. Calculate deviations and metrics
        let totalAbsDev = 0;
        const deviations: number[] = [];
        const offBeatPhases: number[] = []; // phase relative to beat [0, 1)

        for (const t of kickOnsets) {
          const relative = t - bestPhi;
          // Distance to closest 16th note grid line
          const closestGrid = Math.round(relative / gridIntervalMs) * gridIntervalMs + bestPhi;
          const dev = t - closestGrid; // between -gridIntervalMs/2 and +gridIntervalMs/2
          deviations.push(dev);
          totalAbsDev += Math.abs(dev);

          // Phase relative to the full beat [0, 1)
          const beatPhase = ((t - bestPhi) % beatIntervalMs + beatIntervalMs) % beatIntervalMs / beatIntervalMs;
          
          // Offbeats (16th notes 1 & 3 are at 0.25 and 0.75 in a straight grid)
          // Look for hits near 0.25 and 0.75 to calculate swing factor
          const distTo16thOff1 = Math.abs(beatPhase - 0.25);
          const distTo16thOff3 = Math.abs(beatPhase - 0.75);
          if (distTo16thOff1 < 0.125 || distTo16thOff3 < 0.125) {
            offBeatPhases.push(beatPhase);
          }
        }

        const meanAbsDeviationMs = totalAbsDev / kickOnsets.length;

        // Calculate standard deviation of the deviations (jitter)
        const meanDev = deviations.reduce((a, b) => a + b, 0) / deviations.length;
        const variance = deviations.reduce((s, v) => s + (v - meanDev) ** 2, 0) / deviations.length;
        const stdDevMs = Math.sqrt(variance);

        // Tightness Consistency Score (0 - 100%)
        // Excellent: < 5ms mean dev => 90-100%
        // Tight: < 10ms mean dev => 75-90%
        // Loose: > 15ms mean dev => < 60%
        const consistencyScore = Math.max(0, Math.min(100, Math.round(100 * (1 - stdDevMs / 25))));

        // 5. Swing Factor Estimation
        // Straight = 50%, Triplet = 66.7%, Dotted Eighth = 75%
        let swingFactorPercent = 50.0;
        if (offBeatPhases.length >= 2) {
          let sumShift = 0;
          let countedOffbeats = 0;
          for (const ph of offBeatPhases) {
            if (ph < 0.5) {
              // Target is 0.25
              sumShift += ph - 0.25;
              countedOffbeats++;
            } else {
              // Target is 0.75
              sumShift += ph - 0.75;
              countedOffbeats++;
            }
          }
          const avgShift = sumShift / countedOffbeats;
          // Swing factor ratio = (0.25 + avgShift) / 0.5
          swingFactorPercent = Math.max(50.0, Math.min(80.0, ((0.25 + avgShift) / 0.5) * 100));
        }

        // Rhythmic timing evaluation
        let timingRating = 'Loose / Unsteady';
        if (meanAbsDeviationMs < 6) timingRating = 'In the Pocket (Super Tight)';
        else if (meanAbsDeviationMs < 12) timingRating = 'Acceptable (Human Groove)';
        else if (meanAbsDeviationMs < 20) timingRating = 'Loose / Laidback';

        const lines: string[] = [];
        lines.push(`### Groove Score & Timing Report`);
        lines.push(`Analyzed capture **${captureId}** using kick drum transient detection.`);
        lines.push(``);
        lines.push(`- **Tempo Reference:** ${targetBpm.toFixed(1)} BPM`);
        lines.push(`- **Kick Drum Hits Detected:** ${kickOnsets.length}`);
        lines.push(`- **Rhythmic Grid Resolution:** 1/16 Note (${gridIntervalMs.toFixed(1)} ms intervals)`);
        lines.push(``);
        lines.push(`#### Groove Metrics`);
        lines.push(`- **Groove Rating:** **${timingRating}**`);
        lines.push(`- **Average Deviation:** ${meanAbsDeviationMs.toFixed(1)} ms`);
        lines.push(`- **Timing Jitter (StdDev):** ${stdDevMs.toFixed(1)} ms`);
        lines.push(`- **Tightness Consistency Score:** **${consistencyScore}%**`);
        lines.push(`- **Estimated Swing Factor:** **${swingFactorPercent.toFixed(1)}%** ${swingFactorPercent > 52 ? '(Swung)' : '(Straight/Even)'}`);
        lines.push(``);
        
        // Show hit-by-hit details (first 10 hits)
        lines.push(`#### Hit-by-Hit Alignment (First 10 hits)`);
        lines.push(`| Hit # | Onset Time | Closest Grid Line | Deviation | Alignment |`);
        lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
        
        const maxHitsToShow = Math.min(10, kickOnsets.length);
        for (let i = 0; i < maxHitsToShow; i++) {
          const t = kickOnsets[i];
          const relative = t - bestPhi;
          const gridIdx = Math.round(relative / gridIntervalMs);
          const closestGrid = gridIdx * gridIntervalMs + bestPhi;
          const dev = t - closestGrid;

          // Convert gridIdx to bar/beat/sixteenth format (e.g. 1.1.1)
          const total16ths = gridIdx;
          const bar = Math.floor(total16ths / 16) + 1;
          const beat = Math.floor((total16ths % 16) / 4) + 1;
          const sixteenth = (total16ths % 4) + 1;
          const positionStr = `${bar}.${beat}.${sixteenth}`;

          const alignmentIndicator = dev < -3 ? '◄ early (rushed)' : dev > 3 ? 'late (laidback) ►' : '✓ ON TIME';
          
          lines.push(`| Hit ${i + 1} | ${t.toFixed(0)} ms | ${closestGrid.toFixed(0)} ms (Grid: ${positionStr}) | ${dev > 0 ? '+' : ''}${dev.toFixed(1)} ms | ${alignmentIndicator} |`);
        }

        if (kickOnsets.length > 10) {
          lines.push(`*...and ${kickOnsets.length - 10} more kick hits analyzed.*`);
        }

        lines.push(``);
        lines.push(`#### Production Insight`);
        if (consistencyScore > 85) {
          lines.push(`✓ **Excellent timing consistency.** The beat is locked down and steady. Perfect for driving a high-energy section.`);
        } else if (consistencyScore > 70) {
          lines.push(`✓ **Solid human groove.** The timing exhibits a natural, acceptable variance. It feels alive without sounding sloppy.`);
        } else {
          lines.push(`⚠ **Timing jitter is high.** The deviation between hits is inconsistent. This can cause the groove to feel unsteady or muddy, especially in the low-end. Consider quantizing key elements or adjusting the trigger envelopes.`);
        }

        if (swingFactorPercent > 53 && swingFactorPercent < 64) {
          lines.push(`- **Groove Note:** Light swing detected (${swingFactorPercent.toFixed(1)}%). Adds subtle shuffle/bounce.`);
        } else if (swingFactorPercent >= 64 && swingFactorPercent < 70) {
          lines.push(`- **Groove Note:** Medium/heavy swing detected (${swingFactorPercent.toFixed(1)}%). Classic hip-hop / MPC triplet style shuffle.`);
        } else if (swingFactorPercent >= 70) {
          lines.push(`- **Groove Note:** Extreme swing detected (${swingFactorPercent.toFixed(1)}%). Dotted feel.`);
        }

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Groove analysis failed: ${err.message}`);
      }
    }

    // ── capture_and_analyze ──────────────────────────────────────────────────
    if (toolName === 'capture_and_analyze') {
      const durationMs = Math.min(30000, Math.max(500, Number(args.duration_ms ?? 3000)));
      const browserRes = browserSessions.get(session.userId);

      if (!browserRes) {
        return mcpErr(id,
          'No browser tab is connected. Make sure your app is open in a browser and WebEar.init() has been called.');
      }

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits (have ${balance}, need 1). Buy more at https://www.codedswitch.com/buy-credits`);

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

      const blob = audioBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Captured audio blob lost or failed to write to server cache.`);

      try {
        const decoded = await decodeWebmToPcm(blob.buffer);
        const report  = analyzePcm(decoded.samples, decoded.sampleRate);
        await creditService.deductCredits(session.userId, 1, 'webear capture_and_analyze', { tool: 'capture_and_analyze' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);
        return mcpText(id, JSON.stringify(report, null, 2));
      } catch (err: any) {
        return mcpErr(id, `Analysis failed: ${err.message}`);
      }
    }

    // ── mix_coach ────────────────────────────────────────────────────────────
    if (toolName === 'mix_coach') {
      const durationMs = Math.min(30000, Math.max(1000, Number(args.duration_ms ?? 5000)));
      const browserRes = browserSessions.get(session.userId);

      if (!browserRes) {
        return mcpErr(id,
          'No browser tab is connected. Make sure your app is open in a browser and WebEar.init() has been called.');
      }

      const balance = await creditService.getBalance(session.userId);
      if (balance < 3) return mcpErr(id, `Insufficient credits (have ${balance}, need 3). Buy more at https://www.codedswitch.com/buy-credits`);

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

      const blob = audioBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Captured audio blob lost or failed to write to server cache.`);

      try {
        const decoded = await decodeWebmToPcm(blob.buffer);
        const report  = analyzePcm(decoded.samples, decoded.sampleRate);
        await creditService.deductCredits(session.userId, 3, 'webear mix_coach', { tool: 'mix_coach' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const lines: string[] = [];
        lines.push(`### Virtual Mix Coach Report`);
        lines.push(`Analyzed capture **${captureId}** (${(durationMs / 1000).toFixed(1)}s)`);
        lines.push(``);

        lines.push(`#### 1. Loudness & Headroom`);
        const rms = report.rmsDb;
        const peak = report.peakDb;
        lines.push(`- **RMS Loudness:** ${rms.toFixed(1)} dBFS`);
        lines.push(`- **Peak Level:** ${peak.toFixed(1)} dBFS`);
        
        if (rms > -9) {
          lines.push(`- **Coach Advice:** ⚠ **Mix is extremely loud/brickwalled.** The RMS is sitting at ${rms.toFixed(1)} dBFS. You have very little dynamic range left, which can make the track feel fatiguing and flat. Consider bringing down individual channel faders and reducing any heavy master bus compression/limiting.`);
        } else if (rms < -18) {
          lines.push(`- **Coach Advice:** **Mix is very quiet.** The RMS is sitting at ${rms.toFixed(1)} dBFS. While this preserves great transient dynamics, it is too quiet for modern listening standards. You can safely boost the master gain or add light compression/limiting to bring the average level up to around -14 to -12 dBFS.`);
        } else {
          lines.push(`- **Coach Advice:** ✓ **Healthy average loudness.** Sitting at ${rms.toFixed(1)} dBFS RMS is a great sweet spot. It preserves dynamic punch while remaining competitively loud.`);
        }

        lines.push(``);
        lines.push(`#### 2. Digital Clipping`);
        if (report.hasClipping) {
          lines.push(`- **Status:** ⚠ **CLIPPING DETECTED** (${report.clippingPercent.toFixed(2)}% of samples clipped)`);
          lines.push(`- **Coach Advice:** **CRITICAL:** You are exceeding digital maximum headroom (0 dBFS). This causes harsh digital distortion/square-wave clipping. Immediately lower the master output fader or reduce the output gain of your master bus limiter by at least ${Math.max(1, Math.abs(peak) + 0.5).toFixed(1)} dB. Make sure none of your individual instrument channels are clipping their inputs/outputs (gain staging).`);
        } else {
          lines.push(`- **Status:** ✓ **Safe headroom.** No digital clipping detected.`);
          lines.push(`- **Coach Advice:** Your peak is at ${peak.toFixed(1)} dBFS, leaving a safe headroom of ${(0 - peak).toFixed(1)} dB. Excellent gain staging.`);
        }

        lines.push(``);
        lines.push(`#### 3. Dynamics & Punch`);
        const crest = report.crestFactor;
        lines.push(`- **Crest Factor:** ${crest.toFixed(2)} (Peak-to-RMS ratio: ${report.dynamicRangeDb.toFixed(1)} dB)`);
        if (crest > 3.6) {
          lines.push(`- **Coach Advice:** **Highly dynamic mix.** The peaks are very high relative to the average body of the sound. This is very punchy, but it might sound disconnected or "loose." Consider using a master compressor with a slow attack (30ms) and fast release to "glue" the elements together and make the mix feel cohesive.`);
        } else if (crest < 2.0) {
          lines.push(`- **Coach Advice:** ⚠ **Over-compressed / Lifeless.** A crest factor of ${crest.toFixed(2)} indicates that the transients (drum hits, vocal plosives) have been squashed flat. The mix will sound dense but lack punch. Turn down the threshold or ratio on your compressors, or reduce the drive on your master limiter.`);
        } else {
          lines.push(`- **Coach Advice:** ✓ **Excellent dynamic balance.** A crest factor of ${crest.toFixed(2)} represents the ideal commercial balance of transient punch and compressed density.`);
        }

        lines.push(``);
        lines.push(`#### 4. Spectral Balance & Tonal Coaching`);
        lines.push(`- **Spectral Centroid:** ${report.spectralCentroidHz.toFixed(0)} Hz`);
        
        const subPct = report.bandEnergy.sub * 100;
        const bassPct = report.bandEnergy.bass * 100;
        const lowMidPct = report.bandEnergy.lowMid * 100;
        const highMidPct = report.bandEnergy.highMid * 100;
        const highPct = report.bandEnergy.high * 100;

        lines.push(`- **Energy Distribution:** Sub: ${subPct.toFixed(0)}% | Bass: ${bassPct.toFixed(0)}% | Mid: ${lowMidPct.toFixed(0)}% | Hi-Mid: ${highMidPct.toFixed(0)}% | Hi: ${highPct.toFixed(0)}%`);

        if (subPct + bassPct > 45) {
          lines.push(`- **Coach Advice (Low End):** ⚠ **Heavy/Muddy low-end.** Over 45% of your spectral energy is in the sub and bass region. This will eat up all your master headroom and make the track sound muddy. Ensure you apply a high-pass filter (HPF) on all non-bass elements (vocals, guitars, keys, hi-hats) around 80-120 Hz to clear space for the kick and bass line.`);
        } else if (subPct + bassPct < 15) {
          lines.push(`- **Coach Advice (Low End):** **Thin low-end.** Only ${(subPct + bassPct).toFixed(0)}% energy is in the bass register. The track lacks weight and warmth. Check your bass channel volume, or add a sub-oscillator / gentle low shelf boost around 60-80 Hz.`);
        } else {
          lines.push(`- **Coach Advice (Low End):** ✓ **Balanced low-end.** The kick and bass are sitting nicely in the mix without overwhelming other elements.`);
        }

        if (highMidPct + highPct > 40) {
          lines.push(`- **Coach Advice (High End):** ⚠ **Harshness detected in highs.** High-mid and high energy is elevated. This can make hats, vocals, or synth leads sound piercing. Consider a subtle high-shelf cut starting at 8 kHz, or use a de-esser / dynamic EQ to tame transients in the 3 kHz to 6 kHz range.`);
        } else if (highMidPct + highPct < 12) {
          lines.push(`- **Coach Advice (High End):** **Dull / Dark mix.** The high end lacks air and brightness. Consider a gentle high-shelf boost (+1 to +2 dB) at 10 kHz or higher to add modern commercial "sheen."`);
        } else {
          lines.push(`- **Coach Advice (High End):** ✓ **Clean high-end.** Brightness is present and crisp without being harsh.`);
        }

        if (report.hasDcOffset) {
          lines.push(``);
          lines.push(`#### 5. DC Bias / Offset Alert`);
          lines.push(`- **DC Offset Value:** ${report.dcOffset.toFixed(4)}`);
          lines.push(`- **Coach Advice:** ⚠ **DC Offset is present.** This is a sub-audible constant voltage bias. It reduces headroom and can cause pops during playback/edits. Apply a high-pass filter (HPF) at 10-20 Hz on the master bus or on the offending hardware/synth track to resolve it.`);
        }

        lines.push(``);
        lines.push(`#### Summary Evaluation`);
        lines.push(`*${report.summary}*`);

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Mix coaching failed: ${err.message}`);
      }
    }

    // ── capture_video ────────────────────────────────────────────────────────
    if (toolName === 'capture_video') {
      const durationMs = Math.min(30000, Math.max(500, Number(args.duration_ms ?? 3000)));
      const selector   = args.selector ? String(args.selector) : undefined;
      const browserRes = webeyeBrowserSessions.get(session.userId);

      if (!browserRes) {
        return mcpErr(id,
          'No WebEye browser connection found. Make sure your app is open in a browser and WebEye has connected.');
      }

      const captureId = crypto.randomBytes(8).toString('hex');
      browserRes.write(`event: capture\ndata: ${JSON.stringify({ captureId, durationMs, selector })}\n\n`);

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            pendingWebeyeCaptures.delete(captureId);
            reject(new Error(`Video capture timed out after ${durationMs + 8000}ms.`));
          }, durationMs + 8000);
          pendingWebeyeCaptures.set(captureId, { resolve, reject, timer });
        });
      } catch (err: any) {
        return mcpErr(id, err.message);
      }

      return mcpText(id,
        `Video capture complete.\ncapture_id: ${captureId}\nDuration: ${durationMs}ms\n\n` +
        `Run describe_video with capture_id="${captureId}" for visual AI review, ` +
        `or diff_visuals with capture_id_a/b to compare visual states.`
      );
    }

    // ── describe_video ───────────────────────────────────────────────────────
    if (toolName === 'describe_video') {
      const captureId = String(args.capture_id ?? '');
      const blob = videoBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Video capture "${captureId}" not found or expired. Run capture_video again.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 2) return mcpErr(id, `Insufficient credits (have ${balance}, need 2). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        const description = await describeVideo(blob.buffer, blob.contentType);
        await creditService.deductCredits(session.userId, 2, 'webeye describe_video', { tool: 'describe_video' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);
        return mcpText(id, description);
      } catch (err: any) {
        return mcpErr(id, `Video description failed: ${err.message}`);
      }
    }

    // ── diff_visuals ─────────────────────────────────────────────────────────
    if (toolName === 'diff_visuals') {
      const captureIdA = String(args.capture_id_a ?? '');
      const captureIdB = String(args.capture_id_b ?? '');

      const blobA = videoBlobs.get(captureIdA);
      const blobB = videoBlobs.get(captureIdB);

      if (!blobA) return mcpErr(id, `Capture A "${captureIdA}" not found or expired. Run capture_video again.`);
      if (!blobB) return mcpErr(id, `Capture B "${captureIdB}" not found or expired. Run capture_video again.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 2) return mcpErr(id, `Insufficient credits (have ${balance}, need 2). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        const description = await compareVideos(blobA.buffer, blobA.contentType, blobB.buffer, blobB.contentType);
        await creditService.deductCredits(session.userId, 2, 'webeye diff_visuals', { tool: 'diff_visuals' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);
        return mcpText(id, `### Visual Comparison Report\n\n${description}`);
      } catch (err: any) {
        return mcpErr(id, `Visual comparison failed: ${err.message}`);
      }
    }

    // ── create_post_from_video ───────────────────────────────────────────────
    if (toolName === 'create_post_from_video') {
      const captureId = String(args.capture_id ?? '');
      const postType = (args.post_type as 'devlog' | 'social' | 'bug_report' | 'marketing') ?? 'devlog';
      const context = args.context ? String(args.context) : undefined;

      const blob = videoBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Video capture "${captureId}" not found or expired. Run capture_video again.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 2) return mcpErr(id, `Insufficient credits (have ${balance}, need 2). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        const post = await createPostFromVideo(blob.buffer, blob.contentType, postType, context);
        await creditService.deductCredits(session.userId, 2, 'webeye create_post_from_video', { tool: 'create_post_from_video' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);
        return mcpText(id, post);
      } catch (err: any) {
        return mcpErr(id, `Post generation failed: ${err.message}`);
      }
    }


    // ── capture_telemetry ────────────────────────────────────────────────────
    if (toolName === 'capture_telemetry') {
      const durationMs = Math.min(30000, Math.max(500, Number(args.duration_ms ?? 3000)));
      const browserRes = websenseBrowserSessions.get(session.userId);

      if (!browserRes) {
        return mcpErr(id,
          'No WebSense browser connection found. Make sure your app is open in a browser and WebSense has connected.');
      }

      const captureId = crypto.randomBytes(8).toString('hex');
      browserRes.write(`event: capture\ndata: ${JSON.stringify({ captureId, durationMs })}\n\n`);

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            pendingWebsenseCaptures.delete(captureId);
            reject(new Error(`Telemetry capture timed out after ${durationMs + 8000}ms.`));
          }, durationMs + 8000);
          pendingWebsenseCaptures.set(captureId, { resolve, reject, timer });
        });
      } catch (err: any) {
        return mcpErr(id, err.message);
      }

      return mcpText(id,
        `Telemetry capture complete.\ncapture_id: ${captureId}\nDuration: ${durationMs}ms\n\n` +
        `Run analyze_telemetry with capture_id="${captureId}" to view system performance metrics.`
      );
    }

    // ── analyze_telemetry ────────────────────────────────────────────────────
    if (toolName === 'analyze_telemetry') {
      const captureId = String(args.capture_id ?? '');
      const blob = telemetryBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Telemetry capture "${captureId}" not found or expired. Run capture_telemetry again.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits (have ${balance}, need 1). Buy more at https://www.codedswitch.com/buy-credits`);

      try {
        const data = JSON.parse(blob.buffer.toString('utf-8')) as TelemetryData;
        await creditService.deductCredits(session.userId, 1, 'websense analyze_telemetry', { tool: 'analyze_telemetry' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const lines: string[] = [];
        lines.push(`### Performance & Telemetry Report`);
        lines.push(`Capture ID: **${captureId}**`);
        lines.push(``);

        lines.push(`#### 1. Frame Rate (FPS)`);
        lines.push(`- **Average FPS:** ${data.fps.average.toFixed(1)} FPS`);
        lines.push(`- **Minimum FPS:** ${data.fps.min.toFixed(1)} FPS`);
        lines.push(`- **Maximum FPS:** ${data.fps.max.toFixed(1)} FPS`);
        lines.push(`- **Frame Jitter:** ${data.fps.jitterMs.toFixed(2)} ms`);

        if (data.fps.average < 50) {
          lines.push(`- **Status:** ⚠ **Lagging UI.** Average FPS is below 50. The interface may feel sluggish or choppy to the user. Inspect heavy React re-renders or audio visualization logic.`);
        } else if (data.fps.jitterMs > 5.0) {
          lines.push(`- **Status:** ⚠ **Stuttering / Micro-stutters.** Frame jitter is high (${data.fps.jitterMs.toFixed(1)} ms), indicating stuttering animations. Heavy synchronous tasks are blocking the main thread.`);
        } else {
          lines.push(`- **Status:** ✓ **Silky smooth.** Interface rendering is stable at 60 FPS.`);
        }

        lines.push(``);
        lines.push(`#### 2. JS Heap Memory`);
        if (data.memory.supported) {
          lines.push(`- **Used Heap:** ${data.memory.usedHeapMb.toFixed(1)} MB`);
          lines.push(`- **Total Allocated:** ${data.memory.totalHeapMb.toFixed(1)} MB`);
          lines.push(`- **Limit:** ${data.memory.limitMb.toFixed(0)} MB`);
          lines.push(`- **Heap Utilization:** ${data.memory.heapUsagePercent.toFixed(1)}%`);
          
          if (data.memory.heapUsagePercent > 80) {
            lines.push(`- **Status:** ⚠ **High Memory Load.** Heap utilization is above 80%. Risk of out-of-memory crash or garbage collection freezes.`);
          } else {
            lines.push(`- **Status:** ✓ **Healthy memory footprint.**`);
          }
        } else {
          lines.push(`- *Memory tracking not supported by this browser.*`);
        }

        lines.push(``);
        lines.push(`#### 3. UX Web Vitals`);
        lines.push(`- **Cumulative Layout Shift (CLS):** ${data.vitals.cumulativeLayoutShift.toFixed(4)}`);
        const fidStr = data.vitals.firstInputDelayMs !== null ? `${data.vitals.firstInputDelayMs.toFixed(1)} ms` : 'N/A';
        lines.push(`- **First Input Delay (FID):** ${fidStr}`);
        
        if (data.vitals.cumulativeLayoutShift > 0.1) {
          lines.push(`- **Status:** ⚠ **Unstable layout.** CLS is above 0.1. Elements are shifting unexpectedly during rendering. Set explicit dimensions on dynamic panels.`);
        }

        lines.push(``);
        lines.push(`#### 4. Web Audio Engine`);
        lines.push(`- **Context State:** ${data.audioState.state}`);
        lines.push(`- **Sample Rate:** ${data.audioState.sampleRate} Hz`);
        lines.push(`- **Base Latency:** ${(data.audioState.latencySeconds * 1000).toFixed(1)} ms`);

        if (data.audioState.state === 'suspended') {
          lines.push(`- **Status:** ⚠ **Audio Context Suspended.** The audio engine is blocked. Make sure the user interacted with the page (click/gesture) to unlock context.`);
        } else if (data.audioState.state === 'running') {
          lines.push(`- **Status:** ✓ **Audio engine running.**`);
        }

        lines.push(``);
        lines.push(`#### 5. Interaction Load (during window)`);
        lines.push(`- **Clicks:** ${data.interaction.clicks}`);
        lines.push(`- **Keypresses:** ${data.interaction.keypresses}`);
        lines.push(`- **Scroll Events:** ${data.interaction.scrolls}`);

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Telemetry analysis failed: ${err.message}`);
      }
    }

    // ── diff_telemetry ───────────────────────────────────────────────────────
    if (toolName === 'diff_telemetry') {
      const captureIdA = String(args.capture_id_a ?? '');
      const captureIdB = String(args.capture_id_b ?? '');

      const blobA = telemetryBlobs.get(captureIdA);
      const blobB = telemetryBlobs.get(captureIdB);

      if (!blobA) return mcpErr(id, `Capture A "${captureIdA}" not found or expired.`);
      if (!blobB) return mcpErr(id, `Capture B "${captureIdB}" not found or expired.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits (have ${balance}, need 1).`);

      try {
        const dataA = JSON.parse(blobA.buffer.toString('utf-8')) as TelemetryData;
        const dataB = JSON.parse(blobB.buffer.toString('utf-8')) as TelemetryData;

        await creditService.deductCredits(session.userId, 1, 'websense diff_telemetry', { tool: 'diff_telemetry' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const formatDelta = (val: number, unit = '', decimals = 1, showPlus = true) => {
          if (val === 0) return 'no change';
          const sign = showPlus && val > 0 ? '+' : '';
          return `${sign}${val.toFixed(decimals)}${unit}`;
        };

        const lines: string[] = [];
        lines.push(`### Telemetry Comparison Report`);
        lines.push(`Comparing **${captureIdA}** (A) vs **${captureIdB}** (B)`);
        lines.push(``);
        lines.push(`| Metric | Capture A | Capture B | Delta |`);
        lines.push(`| :--- | :--- | :--- | :--- |`);
        lines.push(`| **Avg FPS** | ${dataA.fps.average.toFixed(1)} FPS | ${dataB.fps.average.toFixed(1)} FPS | ${formatDelta(dataB.fps.average - dataA.fps.average, ' FPS')} |`);
        lines.push(`| **Min FPS** | ${dataA.fps.min.toFixed(1)} FPS | ${dataB.fps.min.toFixed(1)} FPS | ${formatDelta(dataB.fps.min - dataA.fps.min, ' FPS')} |`);
        lines.push(`| **Frame Jitter** | ${dataA.fps.jitterMs.toFixed(2)} ms | ${dataB.fps.jitterMs.toFixed(2)} ms | ${formatDelta(dataB.fps.jitterMs - dataA.fps.jitterMs, ' ms', 2)} |`);
        
        if (dataA.memory.supported && dataB.memory.supported) {
          lines.push(`| **Used JS Heap** | ${dataA.memory.usedHeapMb.toFixed(1)} MB | ${dataB.memory.usedHeapMb.toFixed(1)} MB | ${formatDelta(dataB.memory.usedHeapMb - dataA.memory.usedHeapMb, ' MB')} |`);
          lines.push(`| **Heap Allocation** | ${dataA.memory.totalHeapMb.toFixed(1)} MB | ${dataB.memory.totalHeapMb.toFixed(1)} MB | ${formatDelta(dataB.memory.totalHeapMb - dataA.memory.totalHeapMb, ' MB')} |`);
        }

        lines.push(`| **Layout Shift (CLS)** | ${dataA.vitals.cumulativeLayoutShift.toFixed(4)} | ${dataB.vitals.cumulativeLayoutShift.toFixed(4)} | ${formatDelta(dataB.vitals.cumulativeLayoutShift - dataA.vitals.cumulativeLayoutShift, '', 4)} |`);
        
        lines.push(``);
        lines.push(`#### Diagnostic Changes`);
        const fpsChange = dataB.fps.average - dataA.fps.average;
        if (fpsChange > 3) {
          lines.push(`- **Performance:** ✓ **Significant frame-rate improvement (+${fpsChange.toFixed(1)} FPS).** The optimization has successfully freed up render resources.`);
        } else if (fpsChange < -3) {
          lines.push(`- **Performance:** ⚠ **Performance regression (-${Math.abs(fpsChange).toFixed(1)} FPS).** The recent changes are causing render blocking.`);
        }

        if (dataA.memory.supported && dataB.memory.supported) {
          const memChange = dataB.memory.usedHeapMb - dataA.memory.usedHeapMb;
          if (memChange > 15) {
            lines.push(`- **Memory:** ⚠ **High heap growth (+${memChange.toFixed(1)} MB).** Potential memory leak or excessive cache retention. Review heap allocation patterns.`);
          } else if (memChange < -15) {
            lines.push(`- **Memory:** ✓ **Memory footprint reduced (-${Math.abs(memChange).toFixed(1)} MB).**`);
          }
        }

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Telemetry diff failed: ${err.message}`);
      }
    }

    // ── capture_nerve ────────────────────────────────────────────────────────
    if (toolName === 'capture_nerve') {
      const durationMs = Math.min(30000, Math.max(500, Number(args.duration_ms ?? 3000)));
      const browserRes = webnerveBrowserSessions.get(session.userId);

      if (!browserRes) {
        return mcpErr(id,
          'No WebNerve browser connection found. Make sure your app is open in a browser and WebNerve has connected.');
      }

      const captureId = crypto.randomBytes(8).toString('hex');
      browserRes.write(`event: capture\ndata: ${JSON.stringify({ captureId, durationMs })}\n\n`);

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            pendingWebnerveCaptures.delete(captureId);
            reject(new Error(`Nerve capture timed out after ${durationMs + 8000}ms.`));
          }, durationMs + 8000);
          pendingWebnerveCaptures.set(captureId, { resolve, reject, timer });
        });
      } catch (err: any) {
        return mcpErr(id, err.message);
      }

      return mcpText(id,
        `Nerve capture complete.\ncapture_id: ${captureId}\nDuration: ${durationMs}ms\n\n` +
        `Run analyze_nerve with capture_id="${captureId}" to analyze query and latency stats.`
      );
    }

    // ── analyze_nerve ────────────────────────────────────────────────────────
    if (toolName === 'analyze_nerve') {
      const captureId = String(args.capture_id ?? '');
      const blob = nerveBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Nerve capture "${captureId}" not found or expired.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits (have ${balance}, need 1).`);

      try {
        const data = JSON.parse(blob.buffer.toString('utf-8')) as WebNerveReport;
        await creditService.deductCredits(session.userId, 1, 'webnerve analyze_nerve', { tool: 'analyze_nerve' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const lines: string[] = [];
        lines.push(`### WebNerve Timing & Performance Report`);
        lines.push(`Capture ID: **${captureId}**`);
        lines.push(``);

        lines.push(`#### 1. API Request Latency`);
        lines.push(`- **Total API Requests (in window):** ${data.metrics.apiRequestsCount}`);
        
        let totalMs = 0;
        let slowestRequest = { name: '', durationMs: 0 };
        for (const req of data.metrics.apiRequests) {
          totalMs += req.durationMs;
          if (req.durationMs > slowestRequest.durationMs) {
            slowestRequest = req;
          }
        }
        
        const avgMs = data.metrics.apiRequestsCount > 0 ? (totalMs / data.metrics.apiRequestsCount) : 0;
        lines.push(`- **Average API Latency:** ${avgMs.toFixed(1)} ms`);
        if (data.metrics.apiRequestsCount > 0) {
          lines.push(`- **Slowest Request:** \`${slowestRequest.name.split('?')[0]}\` (${slowestRequest.durationMs.toFixed(1)} ms)`);
        }

        if (avgMs > 250) {
          lines.push(`- **Status:** ⚠ **Slow API queries.** Average API latency is above 250ms. Inspect database query indices or slow Grok API response bounds.`);
        } else {
          lines.push(`- **Status:** ✓ **Fast APIs.** API response timings are within healthy constraints (<250ms).`);
        }

        lines.push(``);
        lines.push(`#### 2. Local Storage Assets`);
        const kbUsed = (data.metrics.storage.localStorageBytes / 1024).toFixed(1);
        const sessionKbUsed = (data.metrics.storage.sessionStorageBytes / 1024).toFixed(1);
        lines.push(`- **LocalStorage Bytes:** ${kbUsed} KB`);
        lines.push(`- **SessionStorage Bytes:** ${sessionKbUsed} KB`);

        if (data.metrics.storage.localStorageBytes > 4 * 1024 * 1024) {
          lines.push(`- **Status:** ⚠ **High LocalStorage Usage.** You are approaching the 5MB browser localStorage maximum. Consider caching waveforms in IndexedDB instead.`);
        } else {
          lines.push(`- **Status:** ✓ **Storage footprint healthy.**`);
        }

        lines.push(``);
        lines.push(`#### 3. Client Network Indicator`);
        if (data.metrics.connection) {
          lines.push(`- **Effective Connection Type:** ${data.metrics.connection.effectiveType}`);
          lines.push(`- **Round-Trip Time (RTT):** ${data.metrics.connection.rttMs} ms`);
          lines.push(`- **Downlink Speed:** ${data.metrics.connection.downlinkMb} Mbps`);
          
          if (data.metrics.connection.effectiveType !== '4g') {
            lines.push(`- **Status:** ⚠ **Slow Connection detected.** User has a ${data.metrics.connection.effectiveType} speed. Reduce large sample file preloads.`);
          } else {
            lines.push(`- **Status:** ✓ **High-bandwidth client connection.**`);
          }
        } else {
          lines.push(`- *Detailed network indicator not supported in this browser.*`);
        }

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Nerve analysis failed: ${err.message}`);
      }
    }

    // ── diff_nerve ───────────────────────────────────────────────────────────
    if (toolName === 'diff_nerve') {
      const captureIdA = String(args.capture_id_a ?? '');
      const captureIdB = String(args.capture_id_b ?? '');

      const blobA = nerveBlobs.get(captureIdA);
      const blobB = nerveBlobs.get(captureIdB);

      if (!blobA) return mcpErr(id, `Capture A "${captureIdA}" not found or expired.`);
      if (!blobB) return mcpErr(id, `Capture B "${captureIdB}" not found or expired.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits (have ${balance}, need 1).`);

      try {
        const dataA = JSON.parse(blobA.buffer.toString('utf-8')) as WebNerveReport;
        const dataB = JSON.parse(blobB.buffer.toString('utf-8')) as WebNerveReport;

        await creditService.deductCredits(session.userId, 1, 'webnerve diff_nerve', { tool: 'diff_nerve' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        let totalMsA = 0;
        for (const req of dataA.metrics.apiRequests) totalMsA += req.durationMs;
        const avgMsA = dataA.metrics.apiRequestsCount > 0 ? (totalMsA / dataA.metrics.apiRequestsCount) : 0;

        let totalMsB = 0;
        for (const req of dataB.metrics.apiRequests) totalMsB += req.durationMs;
        const avgMsB = dataB.metrics.apiRequestsCount > 0 ? (totalMsB / dataB.metrics.apiRequestsCount) : 0;

        const delta = avgMsB - avgMsA;

        const lines: string[] = [];
        lines.push(`### WebNerve Comparison Report`);
        lines.push(`Comparing **${captureIdA}** vs **${captureIdB}**`);
        lines.push(``);
        lines.push(`- **Capture A Avg API Latency:** ${avgMsA.toFixed(1)} ms`);
        lines.push(`- **Capture B Avg API Latency:** ${avgMsB.toFixed(1)} ms`);
        
        const deltaSign = delta > 0 ? '+' : '';
        lines.push(`- **Latency Delta:** ${deltaSign}${delta.toFixed(1)} ms`);

        if (delta < -30) {
          lines.push(`- **Diagnostic:** ✓ **Query times decreased significantly.** WebNerve indicates query optimization success.`);
        } else if (delta > 30) {
          lines.push(`- **Diagnostic:** ⚠ **Latency regression detected.** Average API timings increased by ${delta.toFixed(1)}ms. Verify database locks or Grok concurrency limits.`);
        } else {
          lines.push(`- **Diagnostic:** API latency remained relatively stable.`);
        }

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Nerve diff failed: ${err.message}`);
      }
    }

    // ── capture_shield ───────────────────────────────────────────────────────
    if (toolName === 'capture_shield') {
      const browserRes = webshieldBrowserSessions.get(session.userId);

      if (!browserRes) {
        return mcpErr(id,
          'No WebShield browser connection found. Make sure your app is open in a browser and WebShield has connected.');
      }

      const captureId = crypto.randomBytes(8).toString('hex');
      browserRes.write(`event: capture\ndata: ${JSON.stringify({ captureId })}\n\n`);

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            pendingWebshieldCaptures.delete(captureId);
            reject(new Error(`Security scan timed out.`));
          }, 8000);
          pendingWebshieldCaptures.set(captureId, { resolve, reject, timer });
        });
      } catch (err: any) {
        return mcpErr(id, err.message);
      }

      return mcpText(id,
        `Security capture complete.\ncapture_id: ${captureId}\n\n` +
        `Run analyze_shield with capture_id="${captureId}" to evaluate app security configurations.`
      );
    }

    // ── analyze_shield ───────────────────────────────────────────────────────
    if (toolName === 'analyze_shield') {
      const captureId = String(args.capture_id ?? '');
      const blob = shieldBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Security capture "${captureId}" not found or expired.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits.`);

      try {
        const data = JSON.parse(blob.buffer.toString('utf-8')) as WebShieldReport;
        await creditService.deductCredits(session.userId, 1, 'webshield analyze_shield', { tool: 'analyze_shield' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const lines: string[] = [];
        lines.push(`### WebShield Security Analysis Report`);
        lines.push(`Capture ID: **${captureId}**`);
        lines.push(``);

        // HTTPS Checks
        lines.push(`#### 1. Transport Security (TLS)`);
        lines.push(`- **Protocol:** ${data.protocol}`);
        if (data.isHttps) {
          lines.push(`- **Status:** ✓ **Secure transport.** API and client channels are using SSL/TLS.`);
        } else {
          lines.push(`- **Status:** ⚠ **INSECURE PROTOCOL.** HTTP is active. Tokens and session metadata are susceptible to intercept. Immediately enforce HSTS redirects.`);
        }

        // Cookie HttpOnly visibility
        lines.push(``);
        lines.push(`#### 2. Cookie Protections`);
        lines.push(`- **JS-Readable Cookies:** ${data.security.readableCookies.join(', ') || '*none*'}`);
        const sessionCookie = data.security.readableCookies.find(c => /session|sid|token|jwt/i.test(c));
        if (sessionCookie) {
          lines.push(`- **Status:** ⚠ **EXPOSED SESSION COOKIE.** The cookie \`${sessionCookie}\` is readable via JavaScript. It lacks the \`HttpOnly\` flag. This makes it vulnerable to Cross-Site Scripting (XSS) session theft. Configure session cookies with \`httpOnly: true\`.`);
        } else {
          lines.push(`- **Status:** ✓ **Session cookies hidden.** No readable session tokens found in document.cookie.`);
        }

        // Token Leaks in WebStorage
        lines.push(``);
        lines.push(`#### 3. WebStorage Token Audit`);
        if (data.security.storageRisks.length > 0) {
          lines.push(`- **Risks found:**`);
          for (const risk of data.security.storageRisks) {
            lines.push(`  - ⚠ Sensitive key exposed in client-accessible storage: \`${risk}\``);
          }
          lines.push(`- **Status:** ⚠ **Token Exposure.** Keeping auth tokens in localStorage makes them readable by any script on the origin. If you have an XSS vulnerability, these can be stolen. Consider migrating to secure, HttpOnly cookies for session state.`);
        } else {
          lines.push(`- **Status:** ✓ **No raw auth tokens exposed in localStorage.**`);
        }

        // Clickjacking Frame Checks
        lines.push(``);
        lines.push(`#### 4. Framability & Clickjacking Protection`);
        lines.push(`- **Is Framed currently:** ${data.security.isFramed ? 'Yes' : 'No'}`);
        if (data.security.isFramed) {
          lines.push(`- **Status:** ⚠ **Framed execution.** The site is running within an iframe. Check if Frame Ancestors policy is missing.`);
        } else {
          lines.push(`- **Status:** ✓ **Standard viewport execution.**`);
        }

        // CSP policy Checks
        lines.push(``);
        lines.push(`#### 5. Content Security Policy (CSP)`);
        if (data.security.metaCsps.length > 0) {
          for (const policy of data.security.metaCsps) {
            lines.push(`- **Meta CSP:** \`${policy}\``);
          }
        } else {
          lines.push(`- **Status:** ⚠ **Missing Content Security Policy.** No CSP meta tags were found on the client side. This leaves the app vulnerable to XSS injection attacks. Define a CSP policy header.`);
        }

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Security analysis failed: ${err.message}`);
      }
    }

    // ── diff_shield ──────────────────────────────────────────────────────────
    if (toolName === 'diff_shield') {
      const captureIdA = String(args.capture_id_a ?? '');
      const captureIdB = String(args.capture_id_b ?? '');

      const blobA = shieldBlobs.get(captureIdA);
      const blobB = shieldBlobs.get(captureIdB);

      if (!blobA) return mcpErr(id, `Capture A not found.`);
      if (!blobB) return mcpErr(id, `Capture B not found.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits.`);

      try {
        const dataA = JSON.parse(blobA.buffer.toString('utf-8')) as WebShieldReport;
        const dataB = JSON.parse(blobB.buffer.toString('utf-8')) as WebShieldReport;

        await creditService.deductCredits(session.userId, 1, 'webshield diff_shield', { tool: 'diff_shield' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const lines: string[] = [];
        lines.push(`### WebShield Security Comparison`);
        lines.push(`Comparing **${captureIdA}** vs **${captureIdB}**`);
        lines.push(``);
        
        const risksA = dataA.security.storageRisks.length;
        const risksB = dataB.security.storageRisks.length;
        lines.push(`- **Storage risk keys count:** ${risksA} -> ${risksB}`);
        
        if (risksB < risksA) {
          lines.push(`- **Diagnostic:** ✓ **Storage token exposure cleared.** Sensitive values were scrubbed or migrated out of storage.`);
        }

        const cspA = dataA.security.metaCsps.length > 0;
        const cspB = dataB.security.metaCsps.length > 0;
        if (!cspA && cspB) {
          lines.push(`- **Diagnostic:** ✓ **CSP protection active.** Content Security Policy has been successfully deployed.`);
        }

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Security diff failed: ${err.message}`);
      }
    }

    // ── capture_logs ─────────────────────────────────────────────────────────
    if (toolName === 'capture_logs') {
      const durationMs = Math.min(30000, Math.max(500, Number(args.duration_ms ?? 3000)));
      const browserRes = weblogBrowserSessions.get(session.userId);

      if (!browserRes) {
        return mcpErr(id,
          'No WebLog browser connection found. Make sure your app is open in a browser and WebLog has connected.');
      }

      const captureId = crypto.randomBytes(8).toString('hex');
      browserRes.write(`event: capture\ndata: ${JSON.stringify({ captureId, durationMs })}\n\n`);

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            pendingWeblogCaptures.delete(captureId);
            reject(new Error(`Log capture timed out after ${durationMs + 8000}ms.`));
          }, durationMs + 8000);
          pendingWeblogCaptures.set(captureId, { resolve, reject, timer });
        });
      } catch (err: any) {
        return mcpErr(id, err.message);
      }

      return mcpText(id,
        `Log capture complete.\ncapture_id: ${captureId}\nDuration: ${durationMs}ms\n\n` +
        `Run analyze_logs with capture_id="${captureId}" to trace exceptions and view state snapshots.`
      );
    }

    // ── analyze_logs ─────────────────────────────────────────────────────────
    if (toolName === 'analyze_logs') {
      const captureId = String(args.capture_id ?? '');
      const blob = logBlobs.get(captureId);
      if (!blob) return mcpErr(id, `Log capture "${captureId}" not found or expired.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits.`);

      try {
        const data = JSON.parse(blob.buffer.toString('utf-8')) as WebLogReport;
        await creditService.deductCredits(session.userId, 1, 'weblog analyze_logs', { tool: 'analyze_logs' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const lines: string[] = [];
        lines.push(`### WebLog Diagnostic & State Report`);
        lines.push(`Capture ID: **${captureId}**`);
        lines.push(``);

        // Captured Logs counts
        const logs = data.logs || [];
        const errors = logs.filter(l => l.type === 'error' || l.type === 'exception');
        const warns = logs.filter(l => l.type === 'warn');

        lines.push(`#### 1. Console Log Overview`);
        lines.push(`- **Total logs captured:** ${logs.length}`);
        lines.push(`- **Uncaught exceptions & errors:** ${errors.length}`);
        lines.push(`- **Warnings:** ${warns.length}`);

        if (errors.length > 0) {
          lines.push(``);
          lines.push(`#### 2. Exception/Error Traces`);
          for (const errLog of errors) {
            lines.push(`- **[${errLog.type.toUpperCase()}]** \`${errLog.message}\``);
          }
          lines.push(``);
          lines.push(`- **Diagnostic:** ⚠ **Active UI/State Exceptions.** The browser main thread triggered critical errors. Inspect stack trace values above.`);
        } else {
          lines.push(`- **Diagnostic:** ✓ **Zero console errors.** No exceptions were thrown during the capture window.`);
        }

        if (warns.length > 0) {
          lines.push(``);
          lines.push(`#### 3. Tonal/Console Warnings`);
          for (const warnLog of warns.slice(0, 5)) {
            lines.push(`- **[WARN]** ${warnLog.message}`);
          }
          if (warns.length > 5) lines.push(`- *...and ${warns.length - 5} more warnings.*`);
        }

        // Active State Dump
        lines.push(``);
        lines.push(`#### 4. Active Editor State Snapshot`);
        lines.push(`- **Audio Engine State:** \`${data.stateSnapshot.audioState}\``);
        lines.push(`- **Transport Playing:** ${data.stateSnapshot.isPlaying ? 'Yes' : 'No'}`);
        lines.push(`- **Active BPM:** ${data.stateSnapshot.activeBpm} BPM`);

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Log analysis failed: ${err.message}`);
      }
    }

    // ── diff_logs ────────────────────────────────────────────────────────────
    if (toolName === 'diff_logs') {
      const captureIdA = String(args.capture_id_a ?? '');
      const captureIdB = String(args.capture_id_b ?? '');

      const blobA = logBlobs.get(captureIdA);
      const blobB = logBlobs.get(captureIdB);

      if (!blobA) return mcpErr(id, `Capture A not found.`);
      if (!blobB) return mcpErr(id, `Capture B not found.`);

      const balance = await creditService.getBalance(session.userId);
      if (balance < 1) return mcpErr(id, `Insufficient credits.`);

      try {
        const dataA = JSON.parse(blobA.buffer.toString('utf-8')) as WebLogReport;
        const dataB = JSON.parse(blobB.buffer.toString('utf-8')) as WebLogReport;

        await creditService.deductCredits(session.userId, 1, 'weblog diff_logs', { tool: 'diff_logs' });
        const keyRecord = await storage.getWebearKeyByValue(session.rawKey);
        if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

        const errorsA = (dataA.logs || []).filter(l => l.type === 'error' || l.type === 'exception').length;
        const errorsB = (dataB.logs || []).filter(l => l.type === 'error' || l.type === 'exception').length;

        const lines: string[] = [];
        lines.push(`### WebLog Console Difference Report`);
        lines.push(`Comparing **${captureIdA}** vs **${captureIdB}**`);
        lines.push(``);
        lines.push(`- **Console Errors in A:** ${errorsA}`);
        lines.push(`- **Console Errors in B:** ${errorsB}`);

        if (errorsB === 0 && errorsA > 0) {
          lines.push(`- **Diagnostic:** ✓ **Exceptions cleared.** Errors present in Capture A have been resolved in Capture B.`);
        } else if (errorsB > errorsA) {
          lines.push(`- **Diagnostic:** ⚠ **New exceptions thrown.** Capture B introduced ${errorsB - errorsA} new error trace(s). Inspect code logic changes.`);
        } else {
          lines.push(`- **Diagnostic:** Console error load remains consistent.`);
        }

        return mcpText(id, lines.join('\n'));
      } catch (err: any) {
        return mcpErr(id, `Log comparison failed: ${err.message}`);
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
  router.post('/blob/:captureId', express.raw({ type: '*/*', limit: '50mb' }), async (req: Request, res: Response) => {
    const { captureId } = req.params;
    const buffer      = req.body as Buffer;
    const contentType = req.headers['content-type'] || 'audio/webm';

    const entry: BlobEntry = { buffer, contentType, expiresAt: Date.now() + 5 * 60_000 };
    storeAudioBlob(captureId, entry);
    try {
      await persistAudioBlob(captureId, entry);
    } catch (err: any) {
      return void res.status(500).json({ error: `Could not persist capture: ${err.message}` });
    }

    const pending = pendingCaptures.get(captureId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pendingCaptures.delete(captureId);
    }

    res.json({ ok: true });
  });

  // ── 2b. GET raw captured blob (Dev only / Capture script helper) ───────────
  // Hard-gated out of production: captures are user audio and blobs carry no
  // owner id, so there is no way to authorize per-user access here.
  router.get('/blob-raw/:captureId', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).send('Not found');
    const blob = audioBlobs.get(req.params.captureId);
    if (!blob) return res.status(404).send('Not found');
    res.setHeader('Content-Type', blob.contentType || 'audio/webm');
    // Download-only: never let a captured blob render in-origin (stored XSS).
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(req.params.captureId)}.webm"`);
    res.send(blob.buffer);
  });

  // ── 3. In-app analyze — no auth, no credits; used by mastering card ─────
  router.get('/analyze-app/:captureId', async (req: Request, res: Response) => {
    const blob = await getAudioBlob(req.params.captureId);
    if (!blob) return void res.status(404).json({ error: 'Capture not found or expired (5 min TTL)' });
    try {
      const decoded = await decodeWebmToPcm(blob.buffer);
      const report  = analyzePcm(decoded.samples, decoded.sampleRate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dev-only diagnostics — leaks session/user ids, must never ship enabled.
  router.get('/debug-sessions', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') return void res.status(404).send('Not found');
    res.json({
      browserSessions: Array.from(browserSessions.keys()),
      mcpSessions: Array.from(mcpSessions.keys()).map(id => ({ id, userId: mcpSessions.get(id)?.userId })),
    });
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

// ── WebEye Relay Routes ───────────────────────────────────────────────────────
export function createWebeyeRelayRoutes(storage: IStorage): Router {
  const router = Router();

  // Shared CORS
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

  // 1. Browser SSE — receives capture commands for WebEye
  router.get('/connect', async (req: Request, res: Response) => {
    const key = extractApiKey(req);
    const keyRecord = await resolveKey(key);
    if (!keyRecord) return void res.status(401).json({ error: 'Invalid API key' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    webeyeBrowserSessions.set(keyRecord.userId, res);
    res.write('event: connected\ndata: {"status":"ready"}\n\n');

    const ping = setInterval(() => res.write(':\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      if (webeyeBrowserSessions.get(keyRecord.userId) === res) {
        webeyeBrowserSessions.delete(keyRecord.userId);
      }
    });
  });

  // 2. Browser POSTs captured video blob
  router.post('/blob/:captureId', express.raw({ type: '*/*', limit: '50mb' }), (req: Request, res: Response) => {
    const { captureId } = req.params;
    const buffer      = req.body as Buffer;
    const contentType = req.headers['content-type'] || 'video/webm';

    storeVideoBlob(captureId, { buffer, contentType, expiresAt: Date.now() + 5 * 60_000 });

    const pending = pendingWebeyeCaptures.get(captureId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pendingWebeyeCaptures.delete(captureId);
    }

    res.json({ ok: true });
  });

  return router;
}

// ── WebSense Relay Routes ─────────────────────────────────────────────────────
export function createWebsenseRelayRoutes(storage: IStorage): Router {
  const router = Router();

  // Shared CORS
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

  // 1. Browser SSE — receives capture commands for WebSense
  router.get('/connect', async (req: Request, res: Response) => {
    const key = extractApiKey(req);
    const keyRecord = await resolveKey(key);
    if (!keyRecord) return void res.status(401).json({ error: 'Invalid API key' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    websenseBrowserSessions.set(keyRecord.userId, res);
    res.write('event: connected\ndata: {"status":"ready"}\n\n');

    const ping = setInterval(() => res.write(':\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      if (websenseBrowserSessions.get(keyRecord.userId) === res) {
        websenseBrowserSessions.delete(keyRecord.userId);
      }
    });
  });

  // 2. Browser POSTs captured telemetry JSON blob
  router.post('/blob/:captureId', express.raw({ type: '*/*', limit: '10mb' }), (req: Request, res: Response) => {
    const { captureId } = req.params;
    const buffer      = req.body as Buffer;
    const contentType = req.headers['content-type'] || 'application/json';

    storeTelemetryBlob(captureId, { buffer, contentType, expiresAt: Date.now() + 5 * 60_000 });

    const pending = pendingWebsenseCaptures.get(captureId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pendingWebsenseCaptures.delete(captureId);
    }

    res.json({ ok: true });
  });

  return router;
}

// ── WebNerve Relay Routes ─────────────────────────────────────────────────────
export function createWebnerveRelayRoutes(storage: IStorage): Router {
  const router = Router();

  // Shared CORS
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

  // 1. Browser SSE — receives capture commands for WebNerve
  router.get('/connect', async (req: Request, res: Response) => {
    const key = extractApiKey(req);
    const keyRecord = await resolveKey(key);
    if (!keyRecord) return void res.status(401).json({ error: 'Invalid API key' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    webnerveBrowserSessions.set(keyRecord.userId, res);
    res.write('event: connected\ndata: {"status":"ready"}\n\n');

    const ping = setInterval(() => res.write(':\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      if (webnerveBrowserSessions.get(keyRecord.userId) === res) {
        webnerveBrowserSessions.delete(keyRecord.userId);
      }
    });
  });

  // 2. Browser POSTs captured nerve report
  router.post('/blob/:captureId', express.raw({ type: '*/*', limit: '10mb' }), (req: Request, res: Response) => {
    const { captureId } = req.params;
    const buffer      = req.body as Buffer;
    const contentType = req.headers['content-type'] || 'application/json';

    storeNerveBlob(captureId, { buffer, contentType, expiresAt: Date.now() + 5 * 60_000 });

    const pending = pendingWebnerveCaptures.get(captureId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pendingWebnerveCaptures.delete(captureId);
    }

    res.json({ ok: true });
  });

  return router;
}

// ── WebShield Relay Routes ────────────────────────────────────────────────────
export function createWebshieldRelayRoutes(storage: IStorage): Router {
  const router = Router();

  // Shared CORS
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

  // 1. Browser SSE — receives capture commands for WebShield
  router.get('/connect', async (req: Request, res: Response) => {
    const key = extractApiKey(req);
    const keyRecord = await resolveKey(key);
    if (!keyRecord) return void res.status(401).json({ error: 'Invalid API key' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    webshieldBrowserSessions.set(keyRecord.userId, res);
    res.write('event: connected\ndata: {"status":"ready"}\n\n');

    const ping = setInterval(() => res.write(':\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      if (webshieldBrowserSessions.get(keyRecord.userId) === res) {
        webshieldBrowserSessions.delete(keyRecord.userId);
      }
    });
  });

  // 2. Browser POSTs captured security scan report
  router.post('/blob/:captureId', express.raw({ type: '*/*', limit: '10mb' }), (req: Request, res: Response) => {
    const { captureId } = req.params;
    const buffer      = req.body as Buffer;
    const contentType = req.headers['content-type'] || 'application/json';

    storeShieldBlob(captureId, { buffer, contentType, expiresAt: Date.now() + 5 * 60_000 });

    const pending = pendingWebshieldCaptures.get(captureId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pendingWebshieldCaptures.delete(captureId);
    }

    res.json({ ok: true });
  });

  return router;
}

// ── WebLog Relay Routes ───────────────────────────────────────────────────────
export function createWeblogRelayRoutes(storage: IStorage): Router {
  const router = Router();

  // Shared CORS
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

  // 1. Browser SSE — receives capture commands for WebLog
  router.get('/connect', async (req: Request, res: Response) => {
    const key = extractApiKey(req);
    const keyRecord = await resolveKey(key);
    if (!keyRecord) return void res.status(401).json({ error: 'Invalid API key' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    weblogBrowserSessions.set(keyRecord.userId, res);
    res.write('event: connected\ndata: {"status":"ready"}\n\n');

    const ping = setInterval(() => res.write(':\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      if (weblogBrowserSessions.get(keyRecord.userId) === res) {
        weblogBrowserSessions.delete(keyRecord.userId);
      }
    });
  });

  // 2. Browser POSTs captured log buffer report
  router.post('/blob/:captureId', express.raw({ type: '*/*', limit: '10mb' }), (req: Request, res: Response) => {
    const { captureId } = req.params;
    const buffer      = req.body as Buffer;
    const contentType = req.headers['content-type'] || 'application/json';

    storeLogBlob(captureId, { buffer, contentType, expiresAt: Date.now() + 5 * 60_000 });

    const pending = pendingWeblogCaptures.get(captureId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pendingWeblogCaptures.delete(captureId);
    }

    res.json({ ok: true });
  });

  return router;
}

