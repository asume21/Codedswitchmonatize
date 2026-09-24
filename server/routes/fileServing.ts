// Extracted from server/routes.ts — order and behavior preserved.
import express, { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { sanitizeObjectKey, sanitizePath } from "../utils/security";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { LOCAL_OBJECTS_DIR, publicApiLimiter, sendError, upload, uploadLimiter } from "./common";

export function createFileServingRoutes() {
  const router = Router();
  // Use process.cwd() for __dirname equivalent in bundled CJS
  const __dirname = process.cwd();

  // Sample profiles — DSP fingerprints for every WAV the AI can reason over.
  // Keyed by filename (basename) so clients match by URL tail, not full path.
  // Public: no user data, read-only, consumed by SampledDrumKit at startup.
  router.get("/api/sample-profiles", (_req: Request, res: Response) => {
    const dbPath = path.resolve(process.cwd(), 'server', 'data', 'sample-profiles.json')
    if (!fs.existsSync(dbPath)) {
      return res.json({ byFilename: {}, count: 0, profiledAt: null })
    }
    try {
      const raw = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
      // Re-key by basename so the client can match "/api/samples/kick_808.wav" → "kick_808.wav"
      const byFilename: Record<string, unknown> = {}
      for (const [absPath, profile] of Object.entries(raw.samples ?? {})) {
        const filename = path.basename(absPath)
        // On collisions keep the first (usually the project's own copy wins)
        if (!byFilename[filename]) byFilename[filename] = profile
      }
      res.set('Cache-Control', 'public, max-age=3600')
      res.json({ byFilename, count: Object.keys(byFilename).length, profiledAt: raw.profiledAt ?? null })
    } catch (err) {
      res.status(500).json({ error: 'Failed to load sample profiles' })
    }
  });

  // Serve Neumann bass samples — 159 chromatic WAV files (0000.wav–0158.wav)
  // File N maps to MIDI note N. Bass range 24–72 (C1–C4) is what the Organism uses.
  const NEUMANN_DIR = path.resolve(process.cwd(), 'server', 'Assets', 'neumann-bass')
  router.get('/api/neumann-bass/:id', (req: Request, res: Response) => {
    const raw = req.params.id
    if (!/^\d{4}\.wav$/.test(raw)) return res.status(400).end()
    const filePath = path.join(NEUMANN_DIR, raw)
    if (!fs.existsSync(filePath)) return res.status(404).end()
    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    fs.createReadStream(filePath).pipe(res)
  })

  // Upload parameter generation endpoint
  router.post("/api/objects/upload", requireAuth(), uploadLimiter, async (req, res) => {
    try {
      console.log('🎵 Upload parameters requested');

      // Get file extension from request body (if provided)
      const { format, fileName } = req.body || {};
      let extension = '';
      
      const ALLOWED_AUDIO_EXTENSIONS = new Set(['mp3','wav','ogg','m4a','aac','flac','webm','opus']);
      if (format) {
        const sanitizedFormat = String(format).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (ALLOWED_AUDIO_EXTENSIONS.has(sanitizedFormat)) extension = `.${sanitizedFormat}`;
      } else if (fileName) {
        const ext = String(fileName).split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        if (ext && ext !== fileName && ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
          extension = `.${ext}`;
        }
      }

      // Generate a unique object key for the upload using crypto for security
      const objectKey = `songs/${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`;

      // Use relative URL to avoid CORS/SSL issues with localhost
      // Vite's proxy will forward this to the backend correctly
      const uploadURL = `/api/internal/uploads/${encodeURIComponent(objectKey)}`;

      console.log('🎵 Generated upload URL with extension:', uploadURL);

      res.json({
        uploadURL,
        objectKey
      });

    } catch (error) {
      console.error('Upload parameter generation error:', error);
      res.status(500).json({
        error: "Failed to generate upload parameters",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Local loop/asset directories (for Neumann Pack & Loop Library)
  const LOCAL_ASSETS_DIR = path.resolve(process.cwd(), "server", "Assets");

  // Robust loop path resolution: try common install/build locations, prefer packaged assets
  const loopCandidates = [
    path.resolve(__dirname, "../Assets/loops"),                // compiled build (dist/server -> dist/Assets)
    path.join(LOCAL_ASSETS_DIR, "loops"),                        // ts-node from repo root
    path.resolve(process.cwd(), "Assets", "loops"),             // fallback if cwd is project root
    path.resolve(LOCAL_OBJECTS_DIR, "loops"),                    // legacy objects/loops fallback
  ];

  const LOOPS_DIR = loopCandidates.find((p) => fs.existsSync(p)) || loopCandidates[loopCandidates.length - 1];
  
  // Ensure loops directory exists
  try {
    fs.mkdirSync(LOOPS_DIR, { recursive: true });
  } catch (err) {
    console.warn('⚠️ Could not create loops directory:', err);
  }

  // findWavFiles() lived here to build the GET /api/loops catalog. That handler was
  // unreachable (shadowed by app.use("/api/loops", createLoopRoutes()) registered
  // earlier) and has been removed, leaving this helper with no caller but its own
  // recursion. The live loop catalog is server/routes/loops.ts; the /audio route
  // below is still reachable because the mounted router does not claim that path.

  router.get("/api/loops/:filename(*)/audio", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const raw = decodeURIComponent(req.params.filename);
      if (!raw) {
        return sendError(res, 400, "Missing loop filename");
      }

      // Construct the full path and validate it's within LOOPS_DIR
      const filePath = path.resolve(LOOPS_DIR, raw);
      
      // Security check: ensure the resolved path is within LOOPS_DIR
      const relCheck = path.relative(LOOPS_DIR, filePath);
      if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
        return sendError(res, 400, "Invalid loop path");
      }

      if (!fs.existsSync(filePath)) {
        return sendError(res, 404, "Loop not found");
      }

      res.setHeader("Content-Type", "audio/wav");
      const stream = fs.createReadStream(filePath);
      stream.on("error", (err) => {
        console.error("Loop stream error", err);
        if (!res.headersSent) {
          sendError(res, 500, "Failed to stream loop");
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Failed to serve loop audio:", error);
      if (!res.headersSent) {
        sendError(res, 500, "Failed to serve loop audio");
      }
    }
  });

  // Internal binary upload endpoint (local fallback when GCS is not configured)
  router.put(
    "/api/internal/uploads/*",
    express.raw({ type: "*/*", limit: "100mb" }),
    async (req: Request, res: Response) => {
      try {
        const objectKeyEncoded = (req.params as any)[0] as string;
        
        // Use security utility for path sanitization
        const sanitizedKey = sanitizeObjectKey(objectKeyEncoded);
        if (!sanitizedKey) {
          return sendError(res, 400, "Invalid object key");
        }
        
        // Use secure path resolution
        const fullPath = sanitizePath(sanitizedKey, LOCAL_OBJECTS_DIR);
        if (!fullPath) {
          return sendError(res, 400, "Invalid path");
        }
        
        const dir = path.dirname(fullPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(fullPath, req.body as Buffer);
        return res.json({ ok: true, path: `/objects/${sanitizedKey}` });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Upload failed");
      }
    },
  );

  // Serve files from internal uploads path (for song playback)
  router.get("/api/internal/uploads/*", async (req: Request, res: Response) => {
    try {
      const objectKey = (req.params as any)[0] as string;
      
      // Use security utility for path sanitization
      const sanitizedKey = sanitizeObjectKey(objectKey);
      if (!sanitizedKey) {
        console.error('❌ Invalid path detected');
        return res.status(400).send("Invalid path");
      }
      
      const fullPath = sanitizePath(sanitizedKey, LOCAL_OBJECTS_DIR);
      if (!fullPath) {
        console.error('❌ Path traversal attempt detected');
        return res.status(403).send("Access denied");
      }
      
      // Check if file exists
      const fileExists = fs.existsSync(fullPath);
      console.log('📂 File exists?', fileExists);
      
      if (!fileExists) {
        // Disk file gone (Railway ephemeral storage wiped) — try serving from DB
        console.log('📂 Disk file missing, checking DB for audio_data...');
        try {
          const requestUrl = `/api/internal/uploads/${objectKey}`;
          // Find the song whose accessibleUrl or originalUrl matches this request
          const { songs: songsTable } = await import("@shared/schema");
          const { db } = await import("../db");
          const { or, eq, like } = await import("drizzle-orm");
          const matchingSongs = await db.select({
            audioData: songsTable.audioData,
            mimeType: songsTable.mimeType,
            format: songsTable.format,
            accessibleUrl: songsTable.accessibleUrl,
            originalUrl: songsTable.originalUrl,
          }).from(songsTable).where(
            or(
              like(songsTable.accessibleUrl, `%${sanitizedKey}%`),
              like(songsTable.originalUrl, `%${sanitizedKey}%`)
            )
          ).limit(1);

          const match = matchingSongs[0];
          if (match?.audioData) {
            console.log('💾 Serving audio from DB (disk file was missing)');
            const audioBuffer = Buffer.from(match.audioData, 'base64');
            const mime = match.mimeType || 'audio/mpeg';
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Length', audioBuffer.length);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Access-Control-Allow-Origin', '*');

            // Restore to disk for faster subsequent requests
            try {
              const dir = path.dirname(fullPath);
              await fs.promises.mkdir(dir, { recursive: true });
              await fs.promises.writeFile(fullPath, audioBuffer);
              console.log(`♻️ Restored audio to disk from DB: ${fullPath}`);
            } catch (restoreErr) {
              console.warn('⚠️ Could not restore to disk:', restoreErr);
            }

            return res.end(audioBuffer);
          }
        } catch (dbErr) {
          console.warn('⚠️ DB fallback lookup failed:', dbErr);
        }

        console.error('❌ File not found on disk or in DB:', fullPath);
        return res.status(404).send("Not found");
      }
      
      console.log('✅ File found, serving:', fullPath);
      const ext = path.extname(fullPath).toLowerCase();

      // Only serve known audio extensions — reject anything else
      const SERVED_AUDIO_TYPES: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
        '.webm': 'audio/webm',
        '.opus': 'audio/ogg; codecs=opus',
      };
      const type = SERVED_AUDIO_TYPES[ext];
      if (!type) {
        console.error('❌ Blocked serve of non-audio file extension:', ext);
        return res.status(400).send("Invalid file type");
      }
      
      console.log('🎵 Serving with MIME type:', type);
      
      const stat = fs.statSync(fullPath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      // iOS Safari requires proper range request handling for audio
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        console.log(`📱 Range request: ${start}-${end}/${fileSize}`);
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': type,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Range',
        });
        
        fs.createReadStream(fullPath, { start, end }).pipe(res);
      } else {
        res.setHeader("Content-Type", type);
        res.setHeader("Content-Length", fileSize);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET");
        res.setHeader("Access-Control-Allow-Headers", "Range");
        fs.createReadStream(fullPath).pipe(res);
      }
    } catch (err: any) {
      console.error('❌ Internal upload error:', err);
      res.status(500).send("Server error");
    }
  });

  // Serve locally stored objects (audio)
  router.get("/objects/*", async (req: Request, res: Response) => {
    try {
      const objectKey = (req.params as any)[0] as string;
      
      // Use security utility for path sanitization
      const sanitizedKey = sanitizeObjectKey(objectKey);
      if (!sanitizedKey) {
        return res.status(400).send("Invalid path");
      }
      
      const fullPath = sanitizePath(sanitizedKey, LOCAL_OBJECTS_DIR);
      if (!fullPath) {
        return res.status(403).send("Access denied");
      }
      
      if (!fs.existsSync(fullPath)) return res.status(404).send("Not found");
      const ext = path.extname(fullPath).toLowerCase();
      
      // Set proper Content-Type for audio files
      let type = "application/octet-stream";
      if (ext === ".mp3") type = "audio/mpeg";
      else if (ext === ".wav") type = "audio/wav";
      else if (ext === ".m4a") type = "audio/mp4";
      else if (ext === ".ogg") type = "audio/ogg";
      else if (ext === ".flac") type = "audio/flac";
      else if (ext === ".mp4") type = "video/mp4";
      else if (ext === ".webm") type = "video/webm";
      
      res.setHeader("Content-Type", type);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=86400");
      fs.createReadStream(fullPath).pipe(res);
    } catch (err: any) {
      res.status(500).send("Server error");
    }
  });

  return router;
}
