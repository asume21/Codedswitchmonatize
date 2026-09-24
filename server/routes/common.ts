// Shared helpers for the route modules split out of server/routes.ts.
import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";
import { masterAudioFile } from "../services/mastering";

// Standardized error response helper
export const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, message });
};


// Helper to safely get client identifier for rate limiting (handles IPv6)
export function getClientKey(req: Request): string {
  const userId = (req as any).userId;
  if (userId) return `user:${userId}`;

  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.ip || req.socket?.remoteAddress || 'unknown';

  const normalized = ipKeyGenerator(ip, 64);
  return `ip:${normalized}`;
}

/**
 * Custom handler that guarantees JSON response on 429.
 * Without this, express-rate-limit sends text/html which crashes the frontend.
 */
export function jsonHandler(msg: string) {
  return (req: Request, res: Response) => {
    const retryAfter = res.getHeader('Retry-After');
    res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: msg,
      retryAfter: retryAfter ? Number(retryAfter) : undefined,
    });
  };
}

// Rate limiter for public endpoints
export const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
  skipFailedRequests: true,
  handler: jsonHandler('Too many requests, please try again later.'),
});

// Rate limiter for AI endpoints (expensive API calls)
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
  skipFailedRequests: true,
  handler: jsonHandler('AI generation limit reached. Please try again in a few minutes.'),
});

// Rate limiter for upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
  skipFailedRequests: true,
  handler: jsonHandler('Upload limit exceeded. Please try again later.'),
});

export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) return reject(err);
      const dur = metadata?.format?.duration ?? 0;
      resolve(Number(dur) || 0);
    });
  });
}

export async function polishGeneratedAudio(sourceUrl: string, objectsDir: string): Promise<{ url: string; duration: number }> {
  const tmpIn = path.join(os.tmpdir(), `ai-polish-in-${crypto.randomUUID()}`);
  const tmpOut = path.join(os.tmpdir(), `ai-polish-out-${crypto.randomUUID()}.mp3`);
  try {
    const resp = await fetch(sourceUrl);
    if (!resp.ok) throw new Error(`Download failed ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    await fs.promises.writeFile(tmpIn, buf);

    const duration = await getAudioDuration(tmpIn);
    // Shared chain — see server/services/mastering.ts.
    await masterAudioFile(tmpIn, tmpOut, { durationSeconds: duration });

    const relativeKey = `generated/${crypto.randomUUID()}.mp3`;
    const destPath = path.join(objectsDir, relativeKey);
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(tmpOut, destPath);

    return { url: `/api/internal/uploads/${relativeKey}`, duration };
  } finally {
    [tmpIn, tmpOut].forEach((p) => {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    });
  }
}

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function estimateDominantPitchClass(pitchHzValues: number[]): number | null {
  const pitchClassCounts = new Array(12).fill(0) as number[];

  for (const hz of pitchHzValues) {
    if (!Number.isFinite(hz) || hz <= 0) continue;
    const midi = 69 + 12 * Math.log2(hz / 440);
    const rounded = Math.round(midi);
    const pitchClass = ((rounded % 12) + 12) % 12;
    pitchClassCounts[pitchClass] += 1;
  }

  let bestClass = -1;
  let bestCount = 0;
  for (let i = 0; i < pitchClassCounts.length; i += 1) {
    if (pitchClassCounts[i] > bestCount) {
      bestCount = pitchClassCounts[i];
      bestClass = i;
    }
  }

  return bestClass >= 0 && bestCount > 0 ? bestClass : null;
}

// Secure file upload configuration
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // Reduced to 25MB
    files: 1, // Only allow 1 file per request
  },
  fileFilter: (req, file, cb) => {
    // Whitelist of allowed audio MIME types
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/ogg',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/flac',
      'audio/webm',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only audio files are allowed.`));
    }
  },
});

// Ensure local objects directory exists for fallback
// Use /data if available (Railway persistent volume), otherwise use local objects
export const LOCAL_OBJECTS_DIR = fs.existsSync('/data') 
  ? path.resolve('/data', 'objects')
  : path.resolve(process.cwd(), "objects");

try {
  fs.mkdirSync(LOCAL_OBJECTS_DIR, { recursive: true });
  console.log('📁 Using storage directory:', LOCAL_OBJECTS_DIR);
} catch (err) {
  console.warn('⚠️ Could not create objects directory:', err);
}
