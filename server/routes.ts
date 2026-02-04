import type { Express, Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import type { IStorage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { requireAuth, requireSubscription } from "./middleware/auth";
import { requireFeature, checkUsageLimit } from "./middleware/featureGating";
import { requireCredits } from "./middleware/requireCredits";
import { createAuthRoutes } from "./routes/auth";
import { createKeyRoutes } from "./routes/keys";
import { createSongRoutes } from "./routes/songs";
import { createCreditRoutes } from "./routes/credits";
import { createPackRoutes } from "./routes/packs";
import { createAIRoutes } from "./routes/ai";
import { createAudioRoutes } from "./routes/audio";
import { createMixRoutes } from "./routes/mix";
import { createLyricsRoutes } from "./routes/lyrics";
import { createAstutelyRoutes } from "./routes/astutely";
import { createSampleRoutes } from "./routes/samples";
import { createUserRoutes } from "./routes/user";
import { createSocialRoutes } from "./routes/social";
import { createVulnerabilityRoutes } from "./routes/vulnerability";
import { createCheckoutHandler } from "./api/create-checkout";
import { stripeWebhookHandler } from "./api/webhook";
import { checkLicenseHandler } from "./api/check-license";
import { unifiedMusicService } from "./services/unifiedMusicService";
import { generateMelody, translateCode, getAIClient } from "./services/grok";
import { callAI } from "./services/aiGateway";
import { generateSongStructureWithAI } from "./services/ai-structure-grok";
import { generateChatMusicianMelody } from "./services/chatMusician";
import { getCreditService, CREDIT_COSTS } from "./services/credits";
import { convertCodeToMusic, convertCodeToMusicEnhanced } from "./services/codeToMusic";
import { transcribeAudio } from "./services/transcriptionService";
import { aiCache, withCache } from "./services/aiCache";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sanitizePath, sanitizeObjectKey, sanitizeHtml, isValidUUID } from "./utils/security";
import { insertPlaylistSchema } from "@shared/schema";
import { z } from "zod";
import { generateSpeechPreview, createVoiceIdForFile, storePreview, getPreview, applyVoiceConversion } from "./services/speechCorrection";
import { listVoices, getVoice, createVoice, deleteVoice, convertWithVoice, checkRvcHealth } from "./services/voiceLibrary";
import { extractPitch, pitchCorrect, extractMelody, scoreKaraoke, detectEmotion, classifyAudio, checkApiHealth } from "./services/audioAnalysis";
import { mixPreviewService, MixPreviewRequest } from "./services/mixPreview";
import { jobManager } from "./services/jobManager";
import multer from "multer";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Standardized error response helper
const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, message });
};

// Use process.cwd() for __dirname equivalent in bundled CJS
const __dirname = process.cwd();

// Helper to safely get client identifier for rate limiting (handles IPv6)
function getClientKey(req: Request): string {
  const userId = (req as any).userId;
  if (userId) return `user:${userId}`;
  
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.ip || req.socket?.remoteAddress || 'unknown';

  // express-rate-limit requires IPv6 normalization via helper
  const normalized = ipKeyGenerator(ip, 64);
  return `ip:${normalized}`;
}

// Rate limiter for public endpoints
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
  skipFailedRequests: true,
});

// Rate limiter for upload endpoints
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: { success: false, message: 'Upload limit exceeded. Please try again later.' },
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
  skipFailedRequests: true,
});

// Secure file upload configuration
const upload = multer({
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

export async function registerRoutes(app: Express, storage: IStorage) {
  app.get("/sitemap.xml", (req: Request, res: Response) => {
    const escapeXml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const forwardedProto = req.headers["x-forwarded-proto"];
    const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
    const host = req.headers.host || "localhost";
    const baseUrl = `${proto}://${host}`;
    const now = new Date().toISOString();

    const urls: Array<{ loc: string; changefreq?: string; priority?: string }> = [
      { loc: "\/", changefreq: "daily", priority: "1.0" },
      { loc: "\/home", changefreq: "weekly", priority: "0.8" },
      { loc: "\/login", changefreq: "monthly", priority: "0.3" },
      { loc: "\/signup", changefreq: "monthly", priority: "0.3" },
      { loc: "\/activate", changefreq: "monthly", priority: "0.2" },
      { loc: "\/dashboard", changefreq: "weekly", priority: "0.6" },
      { loc: "\/studio", changefreq: "weekly", priority: "0.7" },
      { loc: "\/lyric-lab", changefreq: "weekly", priority: "0.6" },
      { loc: "\/ai-assistant", changefreq: "weekly", priority: "0.5" },
      { loc: "\/vulnerability-scanner", changefreq: "weekly", priority: "0.4" },
      { loc: "\/settings", changefreq: "monthly", priority: "0.2" },
      { loc: "\/social-hub", changefreq: "weekly", priority: "0.4" },
      { loc: "\/profile", changefreq: "weekly", priority: "0.4" },
      { loc: "\/subscribe", changefreq: "monthly", priority: "0.3" },
      { loc: "\/buy-credits", changefreq: "monthly", priority: "0.3" },
      { loc: "\/credits", changefreq: "monthly", priority: "0.3" },
      { loc: "\/billing", changefreq: "monthly", priority: "0.3" },
      { loc: "\/sitemap", changefreq: "weekly", priority: "0.4" },
    ];

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(({ loc, changefreq, priority }) => {
    const fullLoc = escapeXml(`${baseUrl}${loc}`);
    const cf = changefreq ? `<changefreq>${escapeXml(changefreq)}</changefreq>` : "";
    const pr = priority ? `<priority>${escapeXml(priority)}</priority>` : "";
    return `  <url><loc>${fullLoc}</loc><lastmod>${now}</lastmod>${cf}${pr}</url>`;
  })
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(body);
  });

  // Mount auth routes
  app.use("/api/auth", createAuthRoutes(storage));
  
  // Mount key activation routes
  app.use("/api/keys", createKeyRoutes(storage));
  
  // Mount song routes
  app.use("/api/songs", createSongRoutes(storage));
  
  // Mount credit routes
  app.use("/api/credits", createCreditRoutes(storage));

  // Mount pack routes
  app.use("/api/packs", createPackRoutes(storage));

  // Mount audio generation/rendering routes.
  // Backwards-compatible mount at /api so existing UI calls like /api/songs/generate-professional work.
  // Also mounted under /api/audio as the preferred, explicit namespace.
  const audioRouter = createAudioRoutes();
  app.use("/api", audioRouter);
  app.use("/api/audio", audioRouter);

  // Mount Mix Preview & Jobs routes
  app.use("/api", createMixRoutes());

  // Mount general AI routes (chat, provider selection)
  app.use("/api/ai", createAIRoutes());

  // Mount Lyric Lab routes
  app.use("/api/lyrics", createLyricsRoutes());

  // Mount Astutely AI routes
  app.use("/api", createAstutelyRoutes());

  // Mount Sample Library routes
  app.use("/api/samples", createSampleRoutes());

  // Mount User profile routes
  app.use("/api/user", createUserRoutes(storage));

  // Mount Social Hub routes
  app.use("/api/social", createSocialRoutes(storage));

  // Mount Vulnerability Scanner routes
  app.use("/api/vulnerability", createVulnerabilityRoutes(storage));

  // ============================================
  // GROK AI ENDPOINT - General purpose AI generation
  // ============================================
  app.post("/api/grok", async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const XAI_API_KEY = process.env.XAI_API_KEY;
      
      if (!XAI_API_KEY) {
        // Fallback to OpenAI if no Grok key
        const aiClient = getAIClient();
        if (!aiClient) {
          return res.status(503).json({ error: 'No AI provider configured' });
        }
        
        const completion = await aiClient.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });
        
        return res.json({ response: completion.choices[0].message.content });
      }

      // Use Grok (xAI)
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${XAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'grok-3',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        })
      });

      const data = await response.json();
      return res.json({ response: data.choices?.[0]?.message?.content || '' });
      
    } catch (error) {
      console.error('Grok API error:', error);
      res.status(500).json({ error: 'AI generation failed' });
    }
  });

  app.post(
    "/api/music-to-code",
    requireAuth(),
    requireCredits(CREDIT_COSTS.CODE_TRANSLATION, storage),
    upload.single("audio"),
    async (req: Request, res: Response) => {
      try {
        const language = String((req.body as any)?.language || "javascript");
        const codeStyle = String((req.body as any)?.codeStyle || "functional");
        const complexityRaw = (req.body as any)?.complexity;
        const complexity = Math.max(1, Math.min(10, Number(complexityRaw) || 5));

        const musicDataRaw = (req.body as any)?.musicData;
        let musicData: any = null;
        if (typeof musicDataRaw === "string" && musicDataRaw.trim().length > 0) {
          try {
            musicData = JSON.parse(musicDataRaw);
          } catch {
            musicData = { raw: musicDataRaw };
          }
        } else if (typeof musicDataRaw === "object" && musicDataRaw) {
          musicData = musicDataRaw;
        }

        const file = (req as any).file as
          | { originalname?: string; mimetype?: string; size?: number }
          | undefined;

        if (!musicData && !file) {
          return res.status(400).json({
            success: false,
            message: "Provide either musicData or an audio file.",
          });
        }

        const aiClient = getAIClient();
        if (!aiClient) {
          return res.status(503).json({
            success: false,
            message: "AI service unavailable",
          });
        }

        const prompt = `You convert music into code artifacts.

Input:
- Preferred language: ${language}
- Code style: ${codeStyle}
- Complexity: ${complexity}/10
- musicData (may include pattern/melody/lyrics/etc): ${musicData ? JSON.stringify(musicData).slice(0, 6000) : "<none>"}
- audioFile metadata: ${file ? JSON.stringify({ name: file.originalname, type: file.mimetype, size: file.size }) : "<none>"}

Return ONLY valid JSON in this schema:
{
  "analysis": {
    "tempo": number,
    "key": string,
    "timeSignature": string,
    "structure": string[],
    "instruments": string[],
    "complexity": number,
    "mood": string
  },
  "code": {
    "language": string,
    "code": string,
    "description": string,
    "framework": string,
    "functionality": string[]
  }
}

The code must be immediately usable and should generate or represent the music concepts provided (patterns, timing, structure, instrumentation).`;

        const completion = await aiClient.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: 1800,
        });

        const content = completion.choices[0]?.message?.content || "{}";
        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = {};
        }

        const analysis = parsed?.analysis || {};
        const code = parsed?.code || {};

        return res.json({
          success: true,
          analysis: {
            tempo: Number(analysis.tempo) || 120,
            key: String(analysis.key || "C Major"),
            timeSignature: String(analysis.timeSignature || "4/4"),
            structure: Array.isArray(analysis.structure) ? analysis.structure.map(String) : [],
            instruments: Array.isArray(analysis.instruments) ? analysis.instruments.map(String) : [],
            complexity: Math.max(1, Math.min(10, Number(analysis.complexity) || complexity)),
            mood: String(analysis.mood || "neutral"),
          },
          code: {
            language: String(code.language || language),
            code: String(code.code || ""),
            description: String(code.description || "Generated code from music"),
            framework: String(code.framework || "vanilla"),
            functionality: Array.isArray(code.functionality) ? code.functionality.map(String) : [],
          },
        });
      } catch (error: any) {
        console.error("music-to-code error:", error);
        return res.status(500).json({
          success: false,
          message: error?.message || "Failed to convert music to code",
        });
      }
    },
  );

  app.post(
    "/api/test-circular-translation",
    requireAuth(),
    requireCredits(CREDIT_COSTS.CODE_TRANSLATION, storage),
    async (req: Request, res: Response) => {
      try {
        const { code, musicData, language = "javascript" } = req.body;

        if (!code && !musicData) {
          return res.status(400).json({
            success: false,
            message: "Provide either code or musicData for circular test.",
          });
        }

        const aiClient = getAIClient();
        if (!aiClient) {
          return res.status(503).json({
            success: false,
            message: "AI service unavailable",
          });
        }

        // Simulating a circular test by analyzing the input and providing confidence scores
        const prompt = `Perform a circular translation test (Music <-> Code).
Input:
- Code: ${code ? code.slice(0, 2000) : "<none>"}
- Music Data: ${musicData ? JSON.stringify(musicData).slice(0, 2000) : "<none>"}
- Language: ${language}

Analyze how well these two represent each other. 
Return ONLY valid JSON:
{
  "success": true,
  "confidence": number (0-1),
  "mappingAccuracy": number (0-1),
  "consistencyScore": number (0-1),
  "observations": string[],
  "suggestions": string[]
}`;

        const completion = await aiClient.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const result = JSON.parse(completion.choices[0]?.message?.content || "{}");

        return res.json({
          success: true,
          testResults: {
            confidence: result.confidence || 0.85,
            mappingAccuracy: result.mappingAccuracy || 0.8,
            consistencyScore: result.consistencyScore || 0.9,
            observations: result.observations || ["Structure matches expected musical form"],
            suggestions: result.suggestions || ["Consider more explicit timing mappings"],
            timestamp: new Date().toISOString()
          }
        });
      } catch (error: any) {
        console.error("Circular test error:", error);
        return res.status(500).json({
          success: false,
          message: error?.message || "Circular translation test failed",
        });
      }
    },
  );

  // ============================================
  // AI CHORD GENERATION ENDPOINT
  // Secure server-side OpenAI integration
  // ============================================
  app.post("/api/chords", async (req: Request, res: Response) => {
    try {
      const { key = 'C', mood = 'happy', userId = 'anonymous' } = req.body;
      
      console.log(`🎵 AI Chord Generation: key=${key}, mood=${mood}`);

      const prompt = `Generate a 4-chord progression in ${key} with a ${mood} vibe. 
      Return ONLY valid JSON like this:
      {"chords": ["C", "Am", "F", "G"], "progression": "I-vi-IV-V"}`;

      // Use the existing AI client
      const aiClient = getAIClient();
      if (!aiClient) {
        return res.status(500).json({ error: 'AI client not configured' });
      }

      const completion = await aiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 100,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      
      // Parse the JSON response
      let result;
      try {
        // Extract JSON from potential markdown code blocks
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        result = { chords: ['C', 'Am', 'F', 'G'], progression: 'I-vi-IV-V' };
      }

      // Log to database (optional - will work once ai_sessions table is created)
      // Run the migration SQL in Railway Postgres console first:
      // CREATE TABLE IF NOT EXISTS ai_sessions (id SERIAL PRIMARY KEY, user_id TEXT, prompt TEXT, result JSONB, created_at TIMESTAMP DEFAULT NOW());
      try {
        const sessionUserId = req.userId || userId;
        // Using raw SQL through drizzle's sql helper
        const { db } = await import('./db');
        const { sql: rawSql } = await import('drizzle-orm');
        await db.execute(rawSql`
          INSERT INTO ai_sessions (user_id, prompt, result, created_at) 
          VALUES (${sessionUserId}, ${prompt}, ${JSON.stringify(result)}::jsonb, NOW())
        `);
      } catch (dbError) {
        // Don't fail the request if logging fails (table might not exist yet)
        console.warn('AI session logging skipped:', (dbError as Error).message);
      }

      console.log(`🎵 Generated chords: ${result.chords?.join(' - ')}`);
      
      res.json({ 
        success: true, 
        chords: result.chords || ['C', 'Am', 'F', 'G'],
        progression: result.progression || 'I-vi-IV-V',
        key,
        mood
      });
      
    } catch (error) {
      console.error('AI chord generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'AI chord generation failed — try again',
        // Fallback chords so UI doesn't break
        chords: ['C', 'Am', 'F', 'G'],
        progression: 'I-vi-IV-V'
      });
    }
  });

  // Upload parameter generation endpoint
  app.post("/api/objects/upload", uploadLimiter, async (req, res) => {
    try {
      console.log('🎵 Upload parameters requested');

      // Get file extension from request body (if provided)
      const { format, fileName } = req.body || {};
      let extension = '';
      
      if (format) {
        extension = `.${format}`;
      } else if (fileName) {
        const ext = fileName.split('.').pop();
        if (ext && ext !== fileName) {
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

  // Ensure local objects directory exists for fallback
  // Use /data if available (Railway persistent volume), otherwise use local objects
  const LOCAL_OBJECTS_DIR = fs.existsSync('/data') 
    ? path.resolve('/data', 'objects')
    : path.resolve(process.cwd(), "objects");
  
  try {
    fs.mkdirSync(LOCAL_OBJECTS_DIR, { recursive: true });
    console.log('📁 Using storage directory:', LOCAL_OBJECTS_DIR);
  } catch {}

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
  } catch {}

  // Helper to recursively find wav files
  async function findWavFiles(dir: string, baseDir: string): Promise<{relativePath: string, name: string, category: string}[]> {
    const results: {relativePath: string, name: string, category: string}[] = [];
    if (!fs.existsSync(dir)) return results;
    
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subResults = await findWavFiles(fullPath, baseDir);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.wav') && !entry.name.startsWith('silence')) {
        const relativePath = path.relative(baseDir, fullPath);
        const category = path.dirname(relativePath) === '.' ? 'general' : path.dirname(relativePath);
        results.push({
          relativePath,
          name: path.parse(entry.name).name,
          category
        });
      }
    }
    return results;
  }

  // Loop Library endpoints - list and serve .wav files from loops folder (including subfolders)
  app.get("/api/loops", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const wavFiles = await findWavFiles(LOOPS_DIR, LOOPS_DIR);
      console.log(`🎵 Loops scan: base=${LOOPS_DIR} found=${wavFiles.length}`);
      
      const loops = wavFiles.map((file, index) => ({
        id: index.toString(),
        name: file.name,
        filename: file.relativePath,
        category: file.category,
        audioUrl: `/api/loops/${encodeURIComponent(file.relativePath)}/audio`,
      }));

      res.json({ loops });
    } catch (error) {
      console.error(`Failed to list loops from ${LOOPS_DIR}:`, error);
      res.status(500).json({ success: false, message: "Failed to list loops" });
    }
  });

  app.get("/api/loops/:filename(*)/audio", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const raw = decodeURIComponent(req.params.filename);
      if (!raw) {
        return sendError(res, 400, "Missing loop filename");
      }

      // Construct the full path and validate it's within LOOPS_DIR
      const filePath = path.resolve(LOOPS_DIR, raw);
      
      // Security check: ensure the resolved path is within LOOPS_DIR
      if (!filePath.startsWith(LOOPS_DIR)) {
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

  // Validation schemas
  const updatePlaylistSchema = insertPlaylistSchema.partial();
  const addSongSchema = z.object({ songId: z.string() });
  const waitlistSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
  });

  // Beat generation endpoint using MusicGen AI with model selection
  // Credit purchase endpoint
  app.post("/api/credits/purchase", async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return sendError(res, 401, "Authentication required");
      }

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return sendError(res, 400, "Invalid credit amount");
      }

      // Get user to check subscription status
      const user = await storage.getUser(req.userId);
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      // Credit packages with subscriber bonuses
      let creditPackages = {
        10: { price: 4.99, credits: 10 },
        25: { price: 9.99, credits: 25 },
        50: { price: 17.99, credits: 50 },
        100: { price: 29.99, credits: 100 },
      };

      // Add bonus credits for active subscribers
      if (user.subscriptionStatus === 'active' && user.subscriptionTier !== 'free') {
        creditPackages = {
          10: { price: 4.99, credits: 12 },  // +2 bonus
          25: { price: 9.99, credits: 30 },  // +5 bonus
          50: { price: 17.99, credits: 65 }, // +15 bonus
          100: { price: 29.99, credits: 140 }, // +40 bonus
        };
      }

      const packageInfo = creditPackages[amount as keyof typeof creditPackages];
      if (!packageInfo) {
        return sendError(res, 400, "Invalid credit package");
      }

      // Add credits to user account
      const updatedUser = await storage.updateUserCredits(req.userId, packageInfo.credits);

      const bonusText = user.subscriptionStatus === 'active' ? ' (includes subscriber bonus!)' : '';

      res.json({
        success: true,
        creditsAdded: packageInfo.credits,
        newBalance: updatedUser.credits,
        price: packageInfo.price,
        isSubscriber: user.subscriptionStatus === 'active',
        message: `Successfully purchased ${packageInfo.credits} credits for $${packageInfo.price}${bonusText}`
      });
    } catch (error: any) {
      console.error("Credit purchase error:", error);
      sendError(res, 500, error.message || "Failed to purchase credits");
    }
  });

  // Get user credits
  app.get("/api/credits", async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return sendError(res, 401, "Authentication required");
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      res.json({
        credits: user.credits || 10,
        totalCreditsSpent: user.totalCreditsSpent || 0
      });
    } catch (error: any) {
      console.error("Get credits error:", error);
      sendError(res, 500, error.message || "Failed to get credits");
    }
  });

  app.post("/api/beats/generate", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      const beatSchema = z.object({
        genre: z.string().min(1),
        bpm: z.number().min(40).max(240),
        duration: z.number().min(1).max(60),
        aiProvider: z.string().optional(),
      });

      const parsed = beatSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Invalid input: " + parsed.error.message);
      }

      const { genre, bpm, duration, aiProvider = 'musicgen' } = parsed.data;

      // Check user credits (Beat Generator costs 1 credit)
      const BEAT_COST = 1;
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return sendError(res, 401, "User not found");
      }

      // Check if user has enough credits OR active subscription
      const userCredits = user.credits || 10; // Default to 10 for existing users
      const hasSubscription = user.subscriptionStatus === 'active' && user.subscriptionTier !== 'free';
      
      let canGenerate = false;
      let paymentMethod = '';
      
      if (userCredits >= BEAT_COST) {
        canGenerate = true;
        paymentMethod = 'credits';
      } else if (hasSubscription) {
        canGenerate = true;
        paymentMethod = 'subscription';
      }
      
      if (!canGenerate) {
        const message = hasSubscription 
          ? `Subscription active, but monthly credit limit reached. Purchase more credits to continue.`
          : `Insufficient credits. Need ${BEAT_COST} credits, have ${userCredits}. Purchase credits or subscribe to continue.`;
        return sendError(res, 402, message);
      }

      console.log(`🎵 User ${req.userId} generating beat - Credits: ${userCredits} - Subscription: ${user.subscriptionTier} - Payment: ${paymentMethod}`);

      // Use MusicGen AI for REAL beat generation
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) {
        return sendError(res, 500, "REPLICATE_API_TOKEN not configured");
      }

      const prompt = `${genre} drum beat, ${bpm} BPM, energetic drums and percussion`;
      console.log(`🥁 Generating AI beat with MusicGen: "${prompt}"`);

      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${token}`,
        },
        body: JSON.stringify({
          version: "2b5dc5f29cee83fd5cdf8f9c92e555aae7ca2a69b73c5182f3065362b2fa0a45",
          input: {
            prompt: prompt,
            duration: Math.min(duration, 30),
            model_version: "stereo-melody-large",
          },
        }),
      });

      const prediction = await response.json();

      if (!prediction.id) {
        return sendError(res, 500, "Failed to start beat generation");
      }

      // Poll for result
      let result = prediction;
      let attempts = 0;
      while ((result.status === "starting" || result.status === "processing") && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { "Authorization": `Token ${token}` },
        });
        result = await statusResponse.json();
        attempts++;
      }

      if (result.status === "succeeded" && result.output) {
        // Only deduct credits if payment method was credits (not subscription)
        let remainingCredits = userCredits;
        if (paymentMethod === 'credits') {
          await storage.updateUserCredits(req.userId!, -BEAT_COST);
          remainingCredits = Math.max(0, userCredits - BEAT_COST);
        }

        // Use Grok/OpenAI via callAI to generate the visible drum grid pattern.
        type DrumGrid = {
          kick?: Array<number | boolean>;
          snare?: Array<number | boolean>;
          hihat?: Array<number | boolean>;
          percussion?: Array<number | boolean>;
        };

        const steps = 16;

        // Fallback drum pattern generator with more variety
        const generateFallbackPattern = (styleHint: string): DrumGrid => {
          const kick: number[] = [];
          const snare: number[] = [];
          const hihat: number[] = [];
          const percussion: number[] = [];

          const style = styleHint.toLowerCase();
          const isHipHop = style.includes('hip') || style.includes('trap');
          const isHouse = style.includes('house') || style.includes('techno');
          const isDnB = style.includes('dnb') || style.includes('drum');
          const isAmbient = style.includes('ambient') || style.includes('chill');
          
          // Use random seed for variety
          const seed = Math.random();
          const variation = Math.floor(seed * 4); // 4 variations per genre

          for (let i = 0; i < steps; i++) {
            if (isHipHop) {
              // Hip-hop/Trap patterns - 4 variations
              const hipHopKicks = [
                [0, 3, 6, 10],      // Variation 0: Boom bap
                [0, 5, 8, 13],      // Variation 1: Trap bounce
                [0, 2, 7, 10, 14],  // Variation 2: Heavy trap
                [0, 4, 8, 11]       // Variation 3: Classic
              ];
              kick.push(hipHopKicks[variation].includes(i) ? 1 : (Math.random() < 0.08 ? 1 : 0));
              snare.push((i === 4 || i === 12) ? 1 : (i === 8 && Math.random() < 0.3 ? 1 : 0));
              hihat.push(Math.random() < 0.7 ? 1 : 0); // Busy hi-hats for trap
              percussion.push((i % 4 === 2 && Math.random() < 0.4) ? 1 : 0);
            } else if (isHouse) {
              // House/Techno - 4-on-the-floor with variations
              kick.push((i % 4 === 0) ? 1 : (variation > 1 && i % 4 === 2 && Math.random() < 0.3 ? 1 : 0));
              snare.push((i === 4 || i === 12) ? 1 : 0);
              // Offbeat hi-hats for house
              hihat.push((i % 2 === 1) ? 1 : (Math.random() < 0.3 ? 1 : 0));
              percussion.push((i === 2 || i === 10) && Math.random() < 0.5 ? 1 : 0);
            } else if (isDnB) {
              // Drum & Bass - fast breakbeats
              const dnbKicks = [
                [0, 10],
                [0, 6, 10],
                [0, 3, 10, 13],
                [0, 7, 10]
              ];
              kick.push(dnbKicks[variation].includes(i) ? 1 : 0);
              snare.push((i === 4 || i === 12) ? 1 : (i === 8 || i === 14) && Math.random() < 0.4 ? 1 : 0);
              hihat.push(Math.random() < 0.8 ? 1 : 0); // Very busy hi-hats
              percussion.push(Math.random() < 0.2 ? 1 : 0);
            } else if (isAmbient) {
              // Ambient - sparse
              kick.push((i === 0 || i === 8) && Math.random() < 0.7 ? 1 : 0);
              snare.push(i === 8 && Math.random() < 0.5 ? 1 : 0);
              hihat.push(Math.random() < 0.2 ? 1 : 0);
              percussion.push(Math.random() < 0.1 ? 1 : 0);
            } else {
              // Generic rock/pop patterns
              const rockKicks = [
                [0, 8],
                [0, 6, 8],
                [0, 3, 8, 11],
                [0, 4, 8, 12]
              ];
              kick.push(rockKicks[variation].includes(i) ? 1 : (Math.random() < 0.1 ? 1 : 0));
              snare.push((i === 4 || i === 12) ? 1 : (Math.random() < 0.05 ? 1 : 0));
              hihat.push((i % 2 === 0) ? 1 : (Math.random() < 0.5 ? 1 : 0));
              percussion.push(Math.random() < 0.15 ? 1 : 0);
            }
          }
          return { kick, snare, hihat, percussion };
        };

        const normalizeRow = (row: Array<number | boolean> | undefined): number[] => {
          if (!row || !Array.isArray(row) || row.length === 0) return Array(steps).fill(0);
          return row.slice(0, steps).map((v) => (v ? 1 : 0));
        };

        let rawPattern: DrumGrid | undefined;
        let gridProvider = 'Grok/OpenAI grid';

        try {
          const aiResult = await callAI<{ pattern?: DrumGrid }>({
            system:
              "You are a drum pattern generator for a step sequencer. " +
              "Always return a JSON object with a 'pattern' property describing 16-step drum grids.",
            user: `Create a tight ${genre} drum beat at ${bpm} BPM for a 16-step grid. ` +
              "Return JSON with 'pattern' = { kick: number[16], snare: number[16], hihat: number[16], percussion: number[16] }. " +
              "Each array element must be 0 or 1. Do not include any extra properties.",
            responseFormat: "json",
            jsonSchema: {
              type: "object",
              properties: {
                pattern: {
                  type: "object",
                  properties: {
                    kick: { type: "array", items: { type: "number" }, minItems: steps, maxItems: steps },
                    snare: { type: "array", items: { type: "number" }, minItems: steps, maxItems: steps },
                    hihat: { type: "array", items: { type: "number" }, minItems: steps, maxItems: steps },
                    percussion: { type: "array", items: { type: "number" }, minItems: steps, maxItems: steps },
                  },
                  required: ["kick", "snare", "hihat", "percussion"],
                },
              },
              required: ["pattern"],
            },
            temperature: 0.7,
            maxTokens: 800,
          });
          rawPattern = aiResult.content?.pattern as DrumGrid | undefined;
        } catch (aiError: any) {
          console.warn(`⚠️ AI grid generation failed, using fallback: ${aiError?.message}`);
          rawPattern = generateFallbackPattern(String(genre));
          gridProvider = 'Algorithmic Fallback';
        }

        if (!rawPattern || (!rawPattern.kick && !rawPattern.snare)) {
          rawPattern = generateFallbackPattern(String(genre));
          gridProvider = 'Algorithmic Fallback';
        }

        const pattern = {
          kick: normalizeRow(rawPattern.kick),
          snare: normalizeRow(rawPattern.snare),
          hihat: normalizeRow(rawPattern.hihat),
          percussion: normalizeRow(rawPattern.percussion),
        };

        res.json({
          success: true,
          beat: {
            id: `beat-${Date.now()}`,
            audioUrl: result.output,
            pattern,
            bpm: Number(bpm),
            genre: String(genre),
            duration: Number(duration),
            provider: `MusicGen AI + ${gridProvider}`,
            timestamp: new Date().toISOString(),
          },
          paymentMethod,
          creditsRemaining: remainingCredits,
          subscriptionStatus: user.subscriptionStatus,
        });
      } else {
        return sendError(res, 500, "Beat generation failed");
      }
    } catch (error: any) {
      console.error("Beat generation error:", error);
      sendError(res, 500, error.message || "Failed to generate beat");
    }
  });

  // Melody generation endpoint using MusicGen AI
  app.post("/api/melody/generate", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      // Handle both old and new parameter formats
      const { genre, mood, key, scale, style, complexity, musicalParams } = req.body;
      
      // Extract parameters with fallbacks
      const finalKey = key || musicalParams?.key || 'C';
      const finalScale = scale || 'C Major';
      const finalStyle = style || mood || 'melodic';
      const finalGenre = genre || 'pop';
      const finalComplexity = complexity || 'medium';

      // Check user credits (Melody Generator costs 2 credits)
      const MELODY_COST = 2;
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return sendError(res, 401, "User not found");
      }

      // Check if user has enough credits OR active subscription
      const userCredits = user.credits || 10;
      const hasSubscription = user.subscriptionStatus === 'active' && user.subscriptionTier !== 'free';

      let canGenerate = false;
      let paymentMethod = '';

      if (userCredits >= MELODY_COST) {
        canGenerate = true;
        paymentMethod = 'credits';
      } else if (hasSubscription) {
        canGenerate = true;
        paymentMethod = 'subscription';
      }

      if (!canGenerate) {
        const message = hasSubscription 
          ? `Subscription active, but monthly credit limit reached. Purchase more credits to continue.` 
          : `Insufficient credits. Need ${MELODY_COST} credits, have ${userCredits}. Purchase credits or subscribe to continue.`;
        return sendError(res, 402, message);
      }

      console.log(`🎹 User ${req.userId} generating melody - Credits: ${userCredits} - Subscription: ${user.subscriptionTier} - Payment: ${paymentMethod}`);

      // Use MusicGen via Replicate for melody generation
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) {
        return sendError(res, 500, "REPLICATE_API_TOKEN not configured");
      }

      const prompt = `${finalStyle} ${finalGenre} melody in ${finalScale}, beautiful and catchy, ${finalComplexity} complexity`;
      console.log(`🎹 Generating AI melody with MusicGen: "${prompt}"`);

      // Start prediction
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${token}`,
        },
        body: JSON.stringify({
          version: "2b5dc5f29cee83fd5cdf8f9c92e555aae7ca2a69b73c5182f3065362b2fa0a45",
          input: {
            prompt: prompt,
            duration: 15,
            model_version: "stereo-melody-large",
          },
        }),
      });

      const prediction = await response.json();
      console.log(`📊 Prediction started: ${prediction.id}`);

      if (!prediction.id) {
        console.error("❌ Failed to start prediction:", prediction);
        return sendError(res, 500, "Failed to start melody generation");
      }

      // Poll for result with timeout
      let result = prediction;
      let attempts = 0;
      const maxAttempts = 120;

      while ((result.status === "starting" || result.status === "processing") && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { "Authorization": `Token ${token}` },
        });
        result = await statusResponse.json();
        attempts++;

        if (attempts % 10 === 0) {
          console.log(`⏳ Still generating... (${attempts}s) - Status: ${result.status}`);
        }
      }

      console.log(`✅ Generation complete - Status: ${result.status}`);

      if (result.status === "succeeded" && result.output) {
        // Only deduct credits if payment method was credits (not subscription)
        let remainingCredits = userCredits;
        if (paymentMethod === 'credits') {
          await storage.updateUserCredits(req.userId!, -MELODY_COST);
          remainingCredits = Math.max(0, userCredits - MELODY_COST);
        }

        // Generate MIDI notes for the piano roll
        const generatedNotes = generateMelodyNotes(key || 'C major', mood || 'melodic', genre || 'pop');

        res.json({
          success: true,
          data: {
            audioUrl: result.output,
            notes: generatedNotes,
            bpm: 120,
            timeSignature: "4/4",
            key: finalKey,
            scale: finalScale,
            genre: finalGenre,
            style: finalStyle,
            complexity: finalComplexity,
            provider: 'MusicGen (Replicate)'
          },
          message: "Melody generated successfully",
          paymentMethod,
          creditsRemaining: remainingCredits,
          subscriptionStatus: user.subscriptionStatus
        });
      } else if (result.status === "failed") {
        console.error("❌ Generation failed:", result.error);
        return sendError(res, 500, result.error || "Melody generation failed");
      } else {
        console.error("❌ Generation timeout or unknown status:", result.status);
        return sendError(res, 500, `Generation timeout - Status: ${result.status}`);
      }
    } catch (error: any) {
      console.error("❌ Melody generation error:", error);
      sendError(res, 500, error.message || "Failed to generate melody");
    }
  });

  // Phase 3: AI Melody endpoint for BeatMaker (MIDI-only via callAI)
  app.post("/api/ai/music/melody", async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      const { key, bpm, lengthBars, songPlanId, sectionId } = req.body || {};

      const safeKey = typeof key === "string" && key.trim().length > 0 ? key.trim() : "C minor";
      const safeBpm = Math.max(40, Math.min(240, Number(bpm) || 120));
      const safeBars = Math.max(1, Math.min(16, Number(lengthBars) || 4));

      console.log(
        `🎹 [Phase 3] Generating AI melody via callAI: key=${safeKey}, bpm=${safeBpm}, bars=${safeBars}`,
      );

      type AIMelodyTrack = {
        notes: Array<{
          pitch: string;
          start: number;
          duration: number;
          velocity?: number;
        }>;
      };

      // Fallback melody generator when AI fails
      const generateFallbackMelody = (keyStr: string, bars: number): AIMelodyTrack => {
        const scaleNotes: Record<string, string[]> = {
          'C major': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
          'C minor': ['C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
          'G major': ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'],
          'A minor': ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
          'D minor': ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5'],
          'F major': ['F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4'],
        };
        
        const scale = scaleNotes[keyStr] || scaleNotes['C minor'];
        const notes: AIMelodyTrack['notes'] = [];
        const beatsPerBar = 4;
        const totalBeats = bars * beatsPerBar;
        
        let currentBeat = 0;
        while (currentBeat < totalBeats) {
          const noteIndex = Math.floor(Math.random() * scale.length);
          const duration = [0.5, 1, 1.5, 2][Math.floor(Math.random() * 4)];
          
          notes.push({
            pitch: scale[noteIndex],
            start: currentBeat,
            duration: Math.min(duration, totalBeats - currentBeat),
            velocity: 0.6 + Math.random() * 0.3,
          });
          
          currentBeat += duration;
        }
        
        return { notes };
      };

      let notes: AIMelodyTrack['notes'] = [];
      let provider = "Grok/OpenAI via callAI";

      try {
        const aiResult = await callAI<AIMelodyTrack>({
          system:
            "You are a professional melody writer and MIDI arranger. " +
            "You must return a JSON object with a 'notes' array for a melody track.",
          user:
            `Create an expressive melody in ${safeKey} at ${safeBpm} BPM for ${safeBars} bars. ` +
            "Return an array 'notes', where each note has { pitch: string (e.g. 'C4'), start: number (beats from 0), duration: number (beats), velocity: 0-1 }. " +
            "Focus on a hooky, singable line that works over a modern beat. Do not include any extra top-level keys beyond 'notes'.",
          responseFormat: "json",
          jsonSchema: {
            type: "object",
            properties: {
              notes: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  properties: {
                    pitch: { type: "string" },
                    start: { type: "number" },
                    duration: { type: "number" },
                    velocity: { type: "number" },
                  },
                  required: ["pitch", "start", "duration"],
                },
              },
            },
            required: ["notes"],
          },
          temperature: 0.7,
          maxTokens: 800,
        });

        notes = Array.isArray((aiResult as any)?.content?.notes)
          ? (aiResult as any).content.notes
          : [];
      } catch (aiError: any) {
        console.warn(`⚠️ AI melody generation failed, using fallback: ${aiError?.message}`);
        const fallback = generateFallbackMelody(safeKey, safeBars);
        notes = fallback.notes;
        provider = "Algorithmic Fallback";
      }

      // If AI returned empty, use fallback
      if (!notes.length) {
        console.warn("⚠️ AI returned empty melody, using fallback");
        const fallback = generateFallbackMelody(safeKey, safeBars);
        notes = fallback.notes;
        provider = "Algorithmic Fallback";
      }

      return res.json({
        success: true,
        data: {
          notes,
          key: safeKey,
          bpm: safeBpm,
          bars: safeBars,
          provider,
          generationMethod: provider.includes("Fallback") ? "algorithmic" : "ai",
          songPlanId: songPlanId || null,
          sectionId: sectionId || "melody-section",
        },
      });
    } catch (error: any) {
      console.error("❌ Phase 3 AI melody error:", error);
      sendError(res, 500, error?.message || "Failed to generate AI melody");
    }
  });

  // AI Mix & Master endpoint - analyzes tracks and suggests optimal mixing parameters
  app.post("/api/mix/generate", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      // Proper validation with structured layer schema
      const layerSchema = z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['beat', 'melody', 'bass', 'harmony', 'fx']),
        volume: z.number().min(0).max(100).optional(),
        pan: z.number().min(-50).max(50).optional(),
        effects: z.object({
          reverb: z.number().min(0).max(100).optional(),
          delay: z.number().min(0).max(100).optional(),
          distortion: z.number().min(0).max(100).optional(),
        }).optional(),
        data: z.any().optional(),
        muted: z.boolean().optional(),
        solo: z.boolean().optional(),
      });

      const mixSchema = z.object({
        prompt: z.string().min(1, "Prompt is required"),
        layers: z.array(layerSchema).min(1, "At least one layer is required"),
        bpm: z.number().min(40).max(240).optional(),
        style: z.string().optional(),
      });

      const parsed = mixSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Invalid input: " + parsed.error.message);
      }

      const { prompt, layers, bpm, style } = parsed.data;

      console.log(`🎛️ User ${req.userId} requesting AI mix - Layers: ${layers.length}, Prompt: "${prompt}"`);

      // Build AI mixing prompt
      const layerDescription = layers.map((layer: any, i: number) => 
        `Layer ${i + 1} (${layer.type}): ${layer.name}`
      ).join(', ');

      const mixingPrompt = `You are a professional audio mixing engineer. Analyze these tracks and provide optimal mixing parameters:

Tracks: ${layerDescription}
BPM: ${bpm || 120}
Style: ${style || 'professional'}
User Request: ${prompt}

Provide mixing settings for each layer in this exact JSON format:
{
  "layers": [
    {
      "id": "layer_id",
      "volume": 75,
      "pan": 0,
      "effects": {
        "reverb": 30,
        "delay": 0,
        "distortion": 0
      },
      "reasoning": "brief explanation"
    }
  ],
  "masterVolume": 80,
  "recommendations": "overall mixing advice"
}

Volume: 0-100, Pan: -50 (left) to +50 (right), Effects: 0-100`;

      // Try to get AI client
      const aiClient = getAIClient();
      
      if (aiClient) {
        // Use xAI Grok for intelligent mixing suggestions
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              {
                role: "system",
                content: "You are an expert audio mixing engineer with deep knowledge of music production, EQ, dynamics, and spatial positioning. Provide professional mixing advice in JSON format."
              },
              {
                role: "user",
                content: mixingPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          });

          const aiResponse = completion.choices[0]?.message?.content;
          
          if (aiResponse) {
            try {
              // Extract JSON from response, handling code fences and extra text
              let jsonString = aiResponse;
              
              // Remove markdown code fences if present
              jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
              
              // Extract JSON object
              const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
              
              if (jsonMatch) {
                const mixingData = JSON.parse(jsonMatch[0]);
                
                // Validate AI response has required structure
                if (mixingData.layers && Array.isArray(mixingData.layers)) {
                  // Create a dictionary of AI suggestions keyed by layer ID
                  const aiSuggestionsByID = new Map();
                  mixingData.layers.forEach((aiLayer: any) => {
                    if (aiLayer.id) {
                      aiSuggestionsByID.set(aiLayer.id, aiLayer);
                    }
                  });

                  // Map AI suggestions to actual layers by matching IDs
                  const updatedLayers = layers.map((layer) => {
                    const aiSuggestion = aiSuggestionsByID.get(layer.id) || {};
                    
                    // Validate and clamp AI-provided values to allowed ranges
                    const volume = typeof aiSuggestion.volume === 'number' 
                      ? Math.max(0, Math.min(100, aiSuggestion.volume)) 
                      : (layer.volume || 75);
                    const pan = typeof aiSuggestion.pan === 'number' 
                      ? Math.max(-50, Math.min(50, aiSuggestion.pan)) 
                      : (layer.pan || 0);
                    const reverb = typeof aiSuggestion.effects?.reverb === 'number'
                      ? Math.max(0, Math.min(100, aiSuggestion.effects.reverb))
                      : (layer.effects?.reverb ?? 0);
                    const delay = typeof aiSuggestion.effects?.delay === 'number'
                      ? Math.max(0, Math.min(100, aiSuggestion.effects.delay))
                      : (layer.effects?.delay ?? 0);
                    const distortion = typeof aiSuggestion.effects?.distortion === 'number'
                      ? Math.max(0, Math.min(100, aiSuggestion.effects.distortion))
                      : (layer.effects?.distortion ?? 0);
                    
                    return {
                      ...layer,
                      volume,
                      pan,
                      effects: {
                        reverb,
                        delay,
                        distortion,
                      }
                    };
                  });

                  console.log("✅ AI mixing suggestions applied successfully");
                  return res.json({
                    success: true,
                    layers: updatedLayers,
                    masterVolume: typeof mixingData.masterVolume === 'number' ? mixingData.masterVolume : 80,
                    recommendations: mixingData.recommendations || "AI mix applied successfully",
                    provider: "xAI Grok"
                  });
                }
              }
            } catch (parseError: any) {
              console.warn("⚠️ Failed to parse AI response, using fallback:", parseError.message);
              // Fall through to intelligent fallback
            }
          }
        } catch (aiError: any) {
          console.warn("⚠️ AI mixing failed, using intelligent fallback:", aiError.message);
        }
      }

      // Intelligent fallback mixing based on track types
      console.log("🎛️ Using intelligent fallback mixing");
      
      const updatedLayers = layers.map((layer: any) => {
        const mixingRules: Record<string, any> = {
          beat: { volume: 85, pan: 0, reverb: 5, delay: 0, distortion: 0 },
          bass: { volume: 80, pan: 0, reverb: 0, delay: 0, distortion: 10 },
          melody: { volume: 75, pan: 10, reverb: 35, delay: 15, distortion: 0 },
          harmony: { volume: 65, pan: -10, reverb: 40, delay: 10, distortion: 0 },
          fx: { volume: 60, pan: 15, reverb: 60, delay: 30, distortion: 0 },
        };

        const defaultMix = mixingRules[layer.type] || { volume: 75, pan: 0, reverb: 20, delay: 10, distortion: 0 };

        // Apply user prompt adjustments
        let volumeAdjust = 0;
        let reverbAdjust = 0;
        
        if (prompt.toLowerCase().includes('loud') || prompt.toLowerCase().includes('punchy')) {
          volumeAdjust = 10;
        }
        if (prompt.toLowerCase().includes('quiet') || prompt.toLowerCase().includes('subtle')) {
          volumeAdjust = -15;
        }
        if (prompt.toLowerCase().includes('reverb') || prompt.toLowerCase().includes('spacious')) {
          reverbAdjust = 20;
        }
        if (prompt.toLowerCase().includes('dry') || prompt.toLowerCase().includes('tight')) {
          reverbAdjust = -20;
        }

        return {
          ...layer,
          volume: Math.max(0, Math.min(100, defaultMix.volume + volumeAdjust)),
          pan: defaultMix.pan,
          effects: {
            reverb: Math.max(0, Math.min(100, defaultMix.reverb + reverbAdjust)),
            delay: defaultMix.delay,
            distortion: defaultMix.distortion,
          }
        };
      });

      res.json({
        success: true,
        layers: updatedLayers,
        masterVolume: 80,
        recommendations: "Intelligent mixing applied based on track types and your prompt",
        provider: "Intelligent Fallback"
      });

    } catch (error: any) {
      console.error("❌ Mix generation error:", error);
      sendError(res, 500, error.message || "Failed to generate mix");
    }
  });

  // ============================================
  // AI MASTERING SUGGESTIONS ENDPOINT
  // Analyzes mix and provides professional mastering guidance
  // ============================================
  app.post("/api/ai/mastering", async (req: Request, res: Response) => {
    try {
      const { 
        frequencyData, 
        peakLevel, 
        rmsLevel, 
        genre = "pop",
        targetLoudness = -14 
      } = req.body;

      const prompt = `You are a professional mastering engineer. Analyze this mix data and provide specific mastering recommendations.

Mix Analysis:
- Peak Level: ${peakLevel || -3}dB
- RMS Level: ${rmsLevel || -12}dB  
- Genre: ${genre}
- Target Loudness: ${targetLoudness} LUFS (streaming standard)
${frequencyData ? `- Frequency Balance: Bass ${frequencyData.bass}dB, Mids ${frequencyData.mids}dB, Highs ${frequencyData.highs}dB` : ''}

Provide mastering recommendations in this exact JSON format:
{
  "loudnessAnalysis": {
    "currentLUFS": -8,
    "targetLUFS": -14,
    "recommendation": "Reduce overall level by 6dB to prevent clipping on streaming platforms"
  },
  "eq": {
    "lowCut": 30,
    "bassBoost": { "freq": 80, "gain": 1.5 },
    "midPresence": { "freq": 2500, "gain": 2 },
    "airBoost": { "freq": 12000, "gain": 1 },
    "recommendations": ["Apply gentle high-pass at 30Hz", "Boost 2.5kHz for vocal presence"]
  },
  "compression": {
    "ratio": "4:1",
    "attack": "10ms",
    "release": "100ms",
    "threshold": -12,
    "recommendation": "Use gentle multiband compression for glue"
  },
  "limiter": {
    "ceiling": -1,
    "release": "50ms",
    "recommendation": "Set ceiling at -1dB for headroom"
  },
  "stereoWidth": {
    "current": "narrow",
    "recommendation": "Add subtle stereo widening above 2kHz"
  },
  "overallScore": 7,
  "topIssues": ["Levels too hot", "Bass muddy below 60Hz", "Lacking air frequencies"],
  "quickFixes": ["Reduce master by 3dB", "High-pass at 40Hz", "Add 1dB shelf at 10kHz"]
}`;

      const aiClient = getAIClient();
      let masteringData: any = null;

      if (aiClient) {
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a Grammy-winning mastering engineer. Provide professional, specific mastering advice in JSON format." },
              { role: "user", content: prompt }
            ],
            temperature: 0.6,
            max_tokens: 1500,
          });

          const response = completion.choices[0]?.message?.content;
          if (response) {
            const jsonMatch = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              masteringData = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiError: any) {
          console.warn("AI mastering analysis failed, using fallback:", aiError.message);
        }
      }

      if (!masteringData) {
        masteringData = {
          loudnessAnalysis: {
            currentLUFS: peakLevel || -8,
            targetLUFS: targetLoudness,
            recommendation: "Aim for -14 LUFS for streaming platforms"
          },
          eq: {
            lowCut: 35,
            bassBoost: { freq: 80, gain: 1 },
            midPresence: { freq: 2500, gain: 1.5 },
            airBoost: { freq: 12000, gain: 1 },
            recommendations: ["Apply high-pass filter at 35Hz", "Add subtle presence boost at 2-3kHz"]
          },
          compression: {
            ratio: "3:1",
            attack: "15ms",
            release: "150ms",
            threshold: -10,
            recommendation: "Use gentle bus compression for cohesion"
          },
          limiter: {
            ceiling: -1,
            release: "50ms",
            recommendation: "Limit peaks to -1dB for streaming headroom"
          },
          stereoWidth: {
            current: "normal",
            recommendation: "Check mono compatibility before widening"
          },
          overallScore: 6,
          topIssues: ["Check loudness levels", "Verify frequency balance", "Test on multiple speakers"],
          quickFixes: ["Compare with reference track", "Check in mono", "A/B test your changes"]
        };
      }

      res.json({
        success: true,
        analysis: masteringData,
        provider: aiClient ? "AI" : "Fallback",
        generatedAt: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("Mastering analysis error:", error);
      sendError(res, 500, error.message || "Failed to analyze mix for mastering");
    }
  });

  // ============================================
  // AI CACHE STATS ENDPOINT
  // Returns cache performance metrics
  // ============================================
  app.get("/api/ai/cache-stats", async (_req: Request, res: Response) => {
    try {
      const stats = aiCache.getStats();
      res.json({
        success: true,
        cache: stats
      });
    } catch (error: any) {
      sendError(res, 500, "Failed to get cache stats");
    }
  });

  // ============================================
  // AI ARRANGEMENT BUILDER ENDPOINT  
  // Generates full song structure from existing elements
  // ============================================
  app.post("/api/ai/arrangement", async (req: Request, res: Response) => {
    try {
      const { 
        bpm = 120,
        key = "C",
        genre = "pop",
        mood = "uplifting",
        durationMinutes = 3,
        existingSections = []
      } = req.body;

      const prompt = `You are a professional music producer and songwriter. Create a complete song arrangement.

Song Parameters:
- BPM: ${bpm}
- Key: ${key}
- Genre: ${genre}
- Mood: ${mood}
- Target Duration: ${durationMinutes} minutes
${existingSections.length ? `- Existing sections to incorporate: ${existingSections.join(', ')}` : ''}

Generate a professional song arrangement in this exact JSON format:
{
  "totalBars": 128,
  "totalDuration": "${durationMinutes}:00",
  "sections": [
    {
      "name": "Intro",
      "startBar": 1,
      "endBar": 8,
      "bars": 8,
      "duration": "16s",
      "description": "Atmospheric synth pad with filtered drums",
      "instruments": ["pad", "filtered-drums"],
      "energy": 3,
      "tips": "Keep it minimal, build anticipation"
    },
    {
      "name": "Verse 1",
      "startBar": 9,
      "endBar": 24,
      "bars": 16,
      "duration": "32s",
      "description": "Full drums enter, bass establishes groove",
      "instruments": ["drums", "bass", "pad", "lead"],
      "energy": 5,
      "tips": "Introduce main melody, establish rhythm"
    }
  ],
  "transitions": [
    { "from": "Intro", "to": "Verse 1", "type": "build", "tip": "Add drum fill in last 2 bars" }
  ],
  "recommendations": [
    "Add a pre-chorus before the first chorus for maximum impact",
    "Consider a breakdown after the second chorus",
    "End with a variation of the intro for cohesion"
  ]
}`;

      const aiClient = getAIClient();
      let arrangementData: any = null;

      if (aiClient) {
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a hit songwriter and producer with expertise in song structure. Create radio-ready arrangements." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          });

          const response = completion.choices[0]?.message?.content;
          if (response) {
            const jsonMatch = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              arrangementData = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiError: any) {
          console.warn("AI arrangement generation failed:", aiError.message);
        }
      }

      if (!arrangementData) {
        const barsPerMinute = bpm / 4;
        const totalBars = Math.round(durationMinutes * barsPerMinute);
        
        arrangementData = {
          totalBars,
          totalDuration: `${durationMinutes}:00`,
          sections: [
            { name: "Intro", startBar: 1, endBar: 8, bars: 8, energy: 3, instruments: ["pad", "drums-filtered"], description: "Build anticipation" },
            { name: "Verse 1", startBar: 9, endBar: 24, bars: 16, energy: 5, instruments: ["drums", "bass", "melody"], description: "Establish groove and melody" },
            { name: "Pre-Chorus", startBar: 25, endBar: 32, bars: 8, energy: 6, instruments: ["drums", "bass", "melody", "pad"], description: "Build tension" },
            { name: "Chorus", startBar: 33, endBar: 48, bars: 16, energy: 8, instruments: ["drums", "bass", "melody", "harmony", "pad"], description: "Maximum energy, hook" },
            { name: "Verse 2", startBar: 49, endBar: 64, bars: 16, energy: 5, instruments: ["drums", "bass", "melody"], description: "Variation of verse 1" },
            { name: "Pre-Chorus", startBar: 65, endBar: 72, bars: 8, energy: 6, instruments: ["drums", "bass", "melody", "pad"], description: "Build to final chorus" },
            { name: "Chorus", startBar: 73, endBar: 88, bars: 16, energy: 9, instruments: ["drums", "bass", "melody", "harmony", "pad", "fx"], description: "Biggest section" },
            { name: "Bridge", startBar: 89, endBar: 96, bars: 8, energy: 4, instruments: ["pad", "melody-variation"], description: "Contrast and reflection" },
            { name: "Final Chorus", startBar: 97, endBar: 112, bars: 16, energy: 10, instruments: ["drums", "bass", "melody", "harmony", "pad", "fx"], description: "Peak energy" },
            { name: "Outro", startBar: 113, endBar: totalBars, bars: totalBars - 112, energy: 3, instruments: ["pad", "drums-filtered"], description: "Wind down" }
          ],
          transitions: [
            { from: "Intro", to: "Verse 1", type: "drum-fill" },
            { from: "Pre-Chorus", to: "Chorus", type: "build-drop" },
            { from: "Bridge", to: "Final Chorus", type: "big-build" }
          ],
          recommendations: [
            "Use automation to build energy into choruses",
            "Add variations to keep verses interesting",
            "Consider a breakdown for contrast"
          ]
        };
      }

      res.json({
        success: true,
        arrangement: arrangementData,
        bpm,
        key,
        genre,
        provider: aiClient ? "AI" : "Fallback"
      });

    } catch (error: any) {
      console.error("Arrangement generation error:", error);
      sendError(res, 500, error.message || "Failed to generate arrangement");
    }
  });

  // ============================================
  // AI VOCAL MELODY FROM LYRICS ENDPOINT
  // Generates singable melody matching lyric rhythm
  // ============================================
  app.post("/api/ai/vocal-melody", async (req: Request, res: Response) => {
    try {
      const {
        lyrics,
        key = "C",
        bpm = 120,
        mood = "uplifting",
        vocalRange = "tenor"
      } = req.body;

      if (!lyrics || typeof lyrics !== 'string' || lyrics.trim().length < 3) {
        return sendError(res, 400, "Lyrics are required (at least 3 characters)");
      }

      const prompt = `You are a professional topline writer. Generate a singable melody for these lyrics.

Lyrics: "${lyrics}"
Key: ${key}
BPM: ${bpm}
Mood: ${mood}
Vocal Range: ${vocalRange}

Analyze the syllables and create a melody that:
1. Matches the natural speech rhythm of the words
2. Has memorable hooks on key phrases
3. Stays within a comfortable vocal range
4. Uses appropriate note durations for each syllable

Return in this exact JSON format:
{
  "syllables": [
    { "text": "I'm", "syllableCount": 1 },
    { "text": "walk-ing", "syllableCount": 2 }
  ],
  "notes": [
    { "pitch": "C4", "duration": 0.5, "time": 0, "syllable": "I'm", "velocity": 0.8 },
    { "pitch": "D4", "duration": 0.25, "time": 0.5, "syllable": "walk", "velocity": 0.9 },
    { "pitch": "E4", "duration": 0.25, "time": 0.75, "syllable": "ing", "velocity": 0.7 }
  ],
  "vocalRange": { "low": "A3", "high": "E5" },
  "keySignature": "${key}",
  "contour": "ascending",
  "singabilityScore": 8,
  "tips": ["Breathe after 'walking'", "Emphasis on 'I'm'"]
}`;

      const aiClient = getAIClient();
      let melodyData: any = null;

      if (aiClient) {
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a Grammy-winning songwriter who creates memorable vocal melodies. Match melodies perfectly to lyric rhythm." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          });

          const response = completion.choices[0]?.message?.content;
          if (response) {
            const jsonMatch = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              melodyData = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiError: any) {
          console.warn("AI vocal melody failed:", aiError.message);
        }
      }

      if (!melodyData) {
        const words = lyrics.split(/\s+/).filter((w: string) => w.length > 0);
        const scale = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
        let time = 0;
        const notes = words.map((word: string, i: number) => {
          const pitch = scale[i % scale.length];
          const duration = 0.5;
          const note = { pitch, duration, time, syllable: word, velocity: 0.8 };
          time += duration;
          return note;
        });

        melodyData = {
          syllables: words.map((w: string) => ({ text: w, syllableCount: 1 })),
          notes,
          vocalRange: { low: "C4", high: "C5" },
          keySignature: key,
          contour: "varied",
          singabilityScore: 6,
          tips: ["This is a basic algorithmic melody - AI enhancement recommended"]
        };
      }

      res.json({
        success: true,
        melody: melodyData,
        lyrics,
        key,
        bpm,
        provider: aiClient ? "AI" : "Algorithmic Fallback"
      });

    } catch (error: any) {
      console.error("Vocal melody generation error:", error);
      sendError(res, 500, error.message || "Failed to generate vocal melody");
    }
  });

  // ============================================
  // AI STEM SEPARATION ENDPOINT
  // Uses Replicate's Demucs model with base64 file upload (no URL callback needed)
  // This avoids SSL/timeout issues by sending file data directly
  // ============================================
  app.post("/api/ai/stem-separation", async (req: Request, res: Response) => {
    try {
      const { audioUrl, stemCount = 2 } = req.body;

      console.log('🎵 Stem separation request:', { audioUrl: audioUrl?.substring(0, 50), stemCount });

      if (!audioUrl || typeof audioUrl !== 'string') {
        return res.status(400).json({
          success: false,
          error: "Audio URL is required",
          message: "Please provide a valid audio URL or file path"
        });
      }

      // Replicate cannot access browser-only blob URLs.
      if (audioUrl.startsWith('blob:')) {
        return res.status(400).json({
          success: false,
          error: "Invalid audio URL",
          message: "This looks like a browser blob URL. Please upload the audio using the Upload tab (Song Library), then click 'Separate Stems' from the library so the server can access it."
        });
      }

      // Convert relative URLs to absolute URLs
      let absoluteAudioUrl = audioUrl;
      if (audioUrl.startsWith('/')) {
        const forwardedProto = req.headers["x-forwarded-proto"];
        const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
        const host = req.headers.host || "localhost";
        absoluteAudioUrl = `${proto}://${host}${audioUrl}`;
        console.log(`🔄 Converting relative URL to absolute: ${audioUrl} → ${absoluteAudioUrl}`);
      }

      const { stemSeparationService } = await import('./services/stemSeparation');
      
      if (!stemSeparationService.isConfigured()) {
        console.error('❌ REPLICATE_API_TOKEN not configured');
        return res.status(503).json({
          success: false,
          error: "Stem separation service not configured",
          message: "REPLICATE_API_TOKEN is not set. Please configure it in environment variables.",
          configured: false
        });
      }

      const validStemCounts = [2, 4];
      const stems = validStemCounts.includes(stemCount) ? stemCount : 2;

      console.log(`🎵 Starting LOCAL stem separation: ${stems} stems...`);
      console.log(`📁 Processing file locally (no URL callback needed)`);

      // Use the new local file-based separation service
      // This converts the file to base64 and sends it directly to Replicate
      // No need for public URLs or SSL callbacks!
      const result = await stemSeparationService.separateStems(absoluteAudioUrl, stems as 2 | 4);

      if (!result.success) {
        console.error('❌ Stem separation failed:', result.error);
        return res.status(500).json({
          success: false,
          error: "Stem separation failed",
          message: result.error || "Failed to separate stems"
        });
      }

      console.log('✅ Stem separation completed!');
      console.log('📁 Stems saved locally:', result);

      // Return the results directly (no polling needed!)
      res.json({
        success: true,
        status: 'completed',
        stems: {
          vocals: result.vocals,
          instrumental: result.instrumental,
          drums: result.drums,
          bass: result.bass,
          other: result.other,
        },
        jobId: result.jobId,
        message: `Successfully separated into ${Object.values(result).filter(v => v && typeof v === 'string' && v.startsWith('/api/')).length} stems`
      });

    } catch (error: any) {
      console.error("❌ Stem separation error:", error);
      console.error("❌ Error stack:", error.stack);
      res.status(500).json({
        success: false,
        error: "Stem separation failed",
        message: error.message || "Failed to start stem separation",
        details: error.stack || error.toString()
      });
    }
  });

  // Legacy status endpoint (kept for backward compatibility, but new flow doesn't need polling)
  app.get("/api/ai/stem-separation/status/:predictionId", async (req: Request, res: Response) => {
    try {
      const { predictionId } = req.params;

      if (!predictionId) {
        return sendError(res, 400, "Prediction ID required");
      }

      // The new flow completes synchronously, so this endpoint is mainly for legacy support
      // Check if we have a local job with this ID
      const { stemSeparationService } = await import('./services/stemSeparation');
      const job = stemSeparationService.getJob(predictionId);
      
      if (job) {
        if (job.status === 'completed' && job.result) {
          return res.json({
            success: true,
            status: 'completed',
            stems: job.result
          });
        } else if (job.status === 'failed') {
          return res.json({
            success: false,
            status: 'failed',
            error: job.error || 'Separation failed'
          });
        } else {
          return res.json({
            success: true,
            status: 'processing',
            message: 'Still processing...'
          });
        }
      }

      // Fallback: check Replicate directly for old predictions
      const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
      if (!REPLICATE_API_TOKEN) {
        return sendError(res, 503, "Stem separation service not configured");
      }

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        },
      });

      if (!statusResponse.ok) {
        return sendError(res, 500, "Failed to check status");
      }

      const status = await statusResponse.json() as any;

      if (status.status === 'succeeded') {
        console.log('✅ Stem separation completed, output:', JSON.stringify(status.output, null, 2));
        
        const output = status.output;
        if (!output || typeof output !== 'object') {
          console.error('❌ Invalid output structure from Replicate:', output);
          return res.json({
            success: false,
            status: 'failed',
            error: 'Invalid output structure from AI service'
          });
        }
        
        const stems: Record<string, string> = {};
        const validStems: string[] = [];
        
        for (const [field, value] of Object.entries(output)) {
          if (value && typeof value === 'string') {
            try {
              const url = new URL(value);
              if (['http:', 'https:', 'data:'].includes(url.protocol)) {
                stems[field] = value;
                validStems.push(field);
              }
            } catch {
              // Skip invalid URLs
            }
          }
        }
        
        if (validStems.length === 0) {
          return res.json({
            success: false,
            status: 'failed',
            error: 'No valid stems returned'
          });
        }
        
        res.json({
          success: true,
          status: 'completed',
          stems: stems
        });
      } else if (status.status === 'failed') {
        res.json({
          success: false,
          status: 'failed',
          error: status.error || 'Separation failed'
        });
      } else {
        res.json({
          success: true,
          status: 'processing',
          message: 'Still processing...'
        });
      }

    } catch (error: any) {
      console.error("Status check error:", error);
      sendError(res, 500, error.message || "Failed to check status");
    }
  });

  // ============================================
  // AI CHORD PROGRESSION BY MOOD ENDPOINT
  // ============================================
  app.post("/api/ai/chord-progression", async (req: Request, res: Response) => {
    try {
      const {
        key = "C",
        mood = "happy",
        genre = "pop",
        bars = 8
      } = req.body;

      const prompt = `Generate a ${bars}-bar chord progression in ${key} with a ${mood} feel for ${genre} music.

Return ONLY valid JSON:
{
  "chords": ["C", "Am", "F", "G"],
  "progression": "I-vi-IV-V",
  "bars": ${bars},
  "emotionalImpact": 8,
  "variations": [
    { "name": "Jazz", "chords": ["Cmaj7", "Am9", "Fmaj7", "G7"] },
    { "name": "Minimal", "chords": ["C", "F", "G", "C"] }
  ],
  "bassNotes": ["C", "A", "F", "G"],
  "tips": ["Add 7ths for sophistication", "Try inversions for smoother bass line"]
}`;

      const aiClient = getAIClient();
      let chordData: any = null;

      if (aiClient) {
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a music theory expert and composer. Create emotionally impactful chord progressions." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000,
          });

          const response = completion.choices[0]?.message?.content;
          if (response) {
            const jsonMatch = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              chordData = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiError: any) {
          console.warn("AI chord progression failed:", aiError.message);
        }
      }

      if (!chordData) {
        const moodProgressions: Record<string, string[]> = {
          happy: ["C", "G", "Am", "F"],
          sad: ["Am", "F", "C", "G"],
          energetic: ["C", "F", "Am", "G"],
          calm: ["C", "Am", "F", "G"],
          dark: ["Am", "Dm", "E", "Am"],
          uplifting: ["C", "G", "Am", "Em", "F", "C", "F", "G"]
        };
        
        const chords = moodProgressions[mood.toLowerCase()] || moodProgressions.happy;
        chordData = {
          chords: chords.slice(0, bars),
          progression: "I-V-vi-IV",
          bars,
          emotionalImpact: 7,
          variations: [],
          bassNotes: chords.slice(0, bars).map((c: string) => c.charAt(0)),
          tips: ["Experiment with inversions", "Add sus4 for tension"]
        };
      }

      res.json({
        success: true,
        chords: chordData,
        key,
        mood,
        genre,
        provider: aiClient ? "AI" : "Fallback"
      });

    } catch (error: any) {
      console.error("Chord progression error:", error);
      sendError(res, 500, error.message || "Failed to generate chord progression");
    }
  });

  // Helper function to generate drum patterns
  function generatePattern(instrument: string, genre: string, bpm: number) {
    // Base patterns per genre (8 steps) – used as a starting groove
    const patterns: Record<string, Record<string, number[]>> = {
      "hip-hop": {
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1],
        percussion: [0, 0, 0, 0, 0, 0, 0, 0],
      },
      "house": {
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [0, 1, 0, 1, 0, 1, 0, 1],
        percussion: [0, 0, 0, 0, 0, 0, 0, 0],
      },
      "trap": {
        kick: [1, 0, 0, 1, 0, 1, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1],
        percussion: [0, 0, 1, 0, 0, 1, 0, 0],
      },
      "dnb": {
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1],
        percussion: [0, 1, 0, 1, 0, 1, 0, 1],
      },
      "techno": {
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [0, 1, 0, 1, 0, 1, 0, 1],
        percussion: [0, 0, 0, 0, 0, 0, 0, 0],
      },
      "ambient": {
        kick: [1, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [0, 0, 1, 0, 0, 0, 1, 0],
        percussion: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    };

    const normalizedGenre = genre.toLowerCase();
    const genrePatterns = patterns[normalizedGenre] || patterns["house"];
    const base = genrePatterns[instrument] || [];

    if (!base.length) {
      return [];
    }

    // Expand to 16 steps by repeating the base groove
    const steps = 16;
    const repeated = Array.from({ length: steps }, (_, i) => base[i % base.length]);

    // Variation intensity: higher for faster tempos and busier genres
    const tempoFactor = Math.max(0, Math.min(1, (bpm - 70) / 70)); // 0 around 70 BPM, ~1 at 140+

    const isBusyGenre = normalizedGenre === "trap" || normalizedGenre === "dnb" || normalizedGenre === "techno";

    const instrumentAddProb: Record<string, number> = {
      kick: 0.12 + 0.12 * tempoFactor + (isBusyGenre ? 0.06 : 0),
      snare: 0.10 + 0.10 * tempoFactor + (isBusyGenre ? 0.05 : 0),
      hihat: 0.28 + 0.18 * tempoFactor + (isBusyGenre ? 0.08 : 0),
      percussion: 0.20 + 0.14 * tempoFactor + (isBusyGenre ? 0.08 : 0),
    };

    const instrumentDropProb: Record<string, number> = {
      kick: 0.06 + 0.04 * tempoFactor,
      snare: 0.07 + 0.05 * tempoFactor,
      hihat: 0.18 + 0.07 * tempoFactor,
      percussion: 0.10 + 0.06 * tempoFactor,
    };

    const addProb = instrumentAddProb[instrument] ?? 0.05;
    const dropProb = instrumentDropProb[instrument] ?? 0.03;

    const result: number[] = [];

    for (let i = 0; i < steps; i++) {
      let v = repeated[i] ? 1 : 0;
      const r = Math.random();

      if (v === 1) {
        // Occasionally drop hits (especially for hats) to avoid machine-gun feel
        if (r < dropProb) {
          v = 0;
        }
      } else {
        // Occasionally add ghost hits, more likely on off-beats
        const isOffbeat = i % 4 === 2;
        const effectiveAddProb = addProb * (isOffbeat ? 1.4 : 1);
        if (r < effectiveAddProb) {
          v = 1;
        }
      }

      result.push(v ? 1 : 0);
    }

    return result;
  }

  // Helper function to generate melody notes for piano roll
  function generateMelodyNotes(key: string, mood: string, genre: string) {
    // Define scale notes for different keys
    const scales: Record<string, string[]> = {
      'C major': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      'G major': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
      'D major': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
      'A major': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
      'E major': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
      'F major': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
      'A minor': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      'E minor': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
    };

    const scaleNotes = scales[key] || scales['C major'];
    const octaveRange = mood === 'dark' ? [3, 4] : mood === 'bright' ? [4, 5] : [3, 5];
    
    // Generate melody pattern based on genre and mood
    const noteCount = genre === 'ambient' ? 8 : mood === 'energetic' ? 24 : 16;
    const notes = [];
    
    let currentTime = 0;
    for (let i = 0; i < noteCount; i++) {
      const noteIndex = i % scaleNotes.length;
      const octave = octaveRange[0] + Math.floor(Math.random() * (octaveRange[1] - octaveRange[0] + 1));
      const duration = mood === 'ambient' ? 1.0 : 0.5;
      
      notes.push({
        note: scaleNotes[noteIndex],
        pitch: scaleNotes[noteIndex],
        octave: octave,
        time: currentTime,
        start: currentTime,
        duration: duration,
        velocity: 0.7 + Math.random() * 0.3
      });
      
      currentTime += duration;
    }
    return notes;
  }

  // ============================================
  // CODE TO MUSIC ENDPOINT
  // ============================================
  app.post("/api/code-to-music", async (req: Request, res: Response) => {
    try {
      const { code, language = 'javascript', variation = 0, genre = 'pop', useAI = false } = req.body;
      
      console.log(`🎵 Code-to-Music: Converting ${language} code (genre: ${genre}, variation: ${variation}, AI: ${useAI})`);

      // Use ENHANCED algorithm for richer, more musical output
      const result = await convertCodeToMusicEnhanced({
        code,
        language,
        variation,
        genre,
        useAI,
      });

      if (!result.success) {
        return sendError(res, 400, result.error || "Conversion failed");
      }

      res.json(result);
    } catch (error: any) {
      console.error("❌ Code-to-Music error:", error);
      sendError(res, 500, error?.message || "Failed to convert code to music");
    }
  });

  // AI Assistant Chat endpoint
  app.post("/api/assistant/chat", async (req: Request, res: Response) => {
    try {
      const { message, context, aiProvider } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      console.log(`💬 AI Chat request (${aiProvider || 'auto'}): ${message.substring(0, 50)}...`);
      console.log(`🔑 XAI_API_KEY present: ${!!process.env.XAI_API_KEY}`);
      console.log(`🔑 OPENAI_API_KEY present: ${!!process.env.OPENAI_API_KEY}`);

      // Get AI client
      const client = getAIClient();
      console.log(`🤖 AI Client initialized: ${!!client}`);
      
      if (!client) {
        console.error("❌ No AI client available - check API keys");
        return res.status(503).json({
          error: "AI service unavailable",
          message: "No AI provider configured. Please set XAI_API_KEY or OPENAI_API_KEY environment variables."
        });
      }

      // Determine model based on provider
      const model = aiProvider === "openai" ? "gpt-4" : "grok-3";

      // Create chat completion
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are an AI assistant for CodedSwitch, a platform that bridges coding and music creation. You help users with:
- Code translation and optimization
- Music composition and theory
- Beat pattern suggestions
- Lyric writing assistance
- Song analysis and structure
- General music production questions

${context ? `Current context: ${context}` : ''}

Be helpful, creative, and provide actionable advice. When discussing music, use proper terminology. When discussing code, provide clear examples.`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const aiResponse = response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";

      res.json({
        success: true,
        response: aiResponse,
        provider: aiProvider || 'auto'
      });

    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({
        error: "Failed to get AI response",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Vulnerability Scanner endpoint
  app.post('/api/security/scan', async (req, res) => {
    try {
      const { code, language, aiProvider } = req.body;

      if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required' });
      }

      // Get AI client for analysis
      const aiClient = getAIClient();
      
      if (!aiClient) {
        return res.status(503).json({ error: 'AI service unavailable' });
      }
      
      const prompt = `Analyze the following ${language} code for security vulnerabilities. Please identify:
1. Common security vulnerabilities (SQL injection, XSS, CSRF, etc.)
2. Code quality issues that could lead to security problems
3. Best practices violations
4. Potential security improvements

Provide your analysis in JSON format with the following structure:
{
  "vulnerabilities": [
    {
      "type": "vulnerability_type",
      "severity": "low|medium|high|critical",
      "line": line_number,
      "description": "description of the issue",
      "recommendation": "how to fix it"
    }
  ],
  "securityScore": 0-100,
  "summary": "overall security assessment"
}

Code to analyze:
\`\`\`${language}
${code}
\`\`\``;

      const response = await aiClient.chat.completions.create({
        model: aiProvider === 'grok' ? 'grok-3' : 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response from AI');
      }

      // Try to parse JSON response
      let scanResult;
      try {
        // Extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          scanResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback if JSON parsing fails
        scanResult = {
          vulnerabilities: [
            {
              type: 'parse_error',
              severity: 'low',
              line: 0,
              description: 'Could not parse AI response properly',
              recommendation: 'Manual review recommended'
            }
          ],
          securityScore: 75,
          summary: content.substring(0, 500) + '...'
        };
      }

      res.json(scanResult);
    } catch (error) {
      console.error('Security scan error:', error);
      
      // Fallback response if AI analysis fails
      const fallbackResult = {
        vulnerabilities: [
          {
            type: 'analysis_error',
            severity: 'medium',
            line: 0,
            description: 'AI analysis failed',
            recommendation: 'Try again or use manual security review'
          }
        ],
        securityScore: 50,
        summary: 'Security scan could not be completed due to an error. Please try again.'
      };

      res.json(fallbackResult);
    }
  });

  // Waitlist endpoint
  app.post("/api/waitlist", express.json(), (req: Request, res: Response) => {
    try {
      const parsed = waitlistSchema.safeParse(req.body || {});
      if (!parsed.success) {
                return sendError(res, 400, "Invalid email.");
      }
      const { email, name } = parsed.data;
      const file = path.join(LOCAL_OBJECTS_DIR, "waitlist.json");
      let list: Array<{ email: string; name?: string; ts: string }> = [];
      try {
        const raw = fs.readFileSync(file, "utf8");
        list = JSON.parse(raw);
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }

      const exists = list.some((e) => (e.email || "").toLowerCase() === email.toLowerCase());
      if (!exists) {
        list.push({ email: email.toLowerCase(), name, ts: new Date().toISOString() });
        fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf8");
      }
      return res.json({ ok: true, already: exists });
    } catch (err: any) {
            return sendError(res, 500, err?.message || "Failed to join waitlist");
    }
  });

  // Subscription status endpoint (public - returns free tier for guests)
  app.get("/api/subscription-status", async (req: Request, res: Response) => {
    try {
      // If no userId, return free tier status for guests
      if (!req.userId) {
        return res.json({
          hasActiveSubscription: false,
          tier: 'free',
          monthlyUploads: 0,
          monthlyGenerations: 0,
          lastUsageReset: null,
          isAuthenticated: false,
        });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        // User ID in session but user doesn't exist - treat as guest
        return res.json({
          hasActiveSubscription: false,
          tier: 'free',
          monthlyUploads: 0,
          monthlyGenerations: 0,
          lastUsageReset: null,
          isAuthenticated: false,
        });
      }

      const subscriptionStatus = {
        hasActiveSubscription: user.subscriptionTier === 'pro' || user.subscriptionStatus === 'active',
        tier: user.subscriptionTier || 'free',
        monthlyUploads: user.monthlyUploads || 0,
        monthlyGenerations: user.monthlyGenerations || 0,
        lastUsageReset: user.lastUsageReset,
        isAuthenticated: true,
      };

      res.json(subscriptionStatus);
    } catch (err: any) {
      sendError(res, 500, err?.message || "Failed to fetch subscription status");
    }
  });

  // License + Stripe checkout endpoints
  const checkoutHandler = createCheckoutHandler(storage);
  app.get("/api/check-license", checkLicenseHandler(storage));
  app.post("/api/create-checkout", requireAuth(), checkoutHandler);
  app.post("/api/create-checkout-session", requireAuth(), checkoutHandler);
  app.post("/api/billing/create-checkout-session", requireAuth(), checkoutHandler);

  // Playlist endpoints
  app.get("/api/playlists", requireAuth(), async (req: Request, res: Response) => {
    try {
      const playlists = await storage.getUserPlaylists(req.userId!);
      res.json(playlists);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to fetch playlists");
    }
  });

  app.post("/api/playlists", requireAuth(), async (req: Request, res: Response) => {
    try {
      const parsed = insertPlaylistSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload" });
      }
      const playlist = await storage.createPlaylist(req.userId!, parsed.data);
      res.status(201).json(playlist);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to create playlist");
    }
  });

  app.get(
    "/api/playlists/:id/songs",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params as any;
                if (!id) return sendError(res, 400, "Missing playlist id");
        const playlist = await storage.getPlaylist(id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (playlist.userId !== req.userId)
          return res.status(403).json({ message: "Forbidden" });
        const items = await storage.getPlaylistSongs(id);
        res.json(items);
      } catch (err: any) {
                sendError(res, 500, err?.message || "Failed to fetch playlist songs");
      }
    },
  );

  app.post(
    "/api/playlists/:id/songs",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params as any;
        const body = addSongSchema.safeParse(req.body || {});
                if (!body.success) return sendError(res, 400, "Invalid payload");
        const playlist = await storage.getPlaylist(id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (playlist.userId !== req.userId)
          return res.status(403).json({ message: "Forbidden" });
        const song = await storage.getSong(body.data.songId);
                if (!song || song.userId !== req.userId) return sendError(res, 404, "Song not found");
        const ps = await storage.addSongToPlaylist(id, body.data.songId);
        res.status(201).json({ ...ps, song });
      } catch (err: any) {
                sendError(res, 500, err?.message || "Failed to add song to playlist");
      }
    },
  );

  app.delete(
    "/api/playlists/:id/songs/:songId",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { id, songId } = req.params as any;
        const playlist = await storage.getPlaylist(id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (playlist.userId !== req.userId)
          return res.status(403).json({ message: "Forbidden" });
        await storage.removeSongFromPlaylist(id, songId);
        res.status(204).end();
      } catch (err: any) {
        res
          .status(500)
          .json({ success: false, message: err?.message || "Failed to remove song from playlist" });
      }
    },
  );

  app.put("/api/playlists/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const playlist = await storage.getPlaylist(id);
      if (!playlist) return res.status(404).json({ message: "Playlist not found" });
      if (playlist.userId !== req.userId)
        return res.status(403).json({ message: "Forbidden" });
      const parsed = updatePlaylistSchema.safeParse(req.body || {});
            if (!parsed.success) return sendError(res, 400, "Invalid payload");
            if (Object.keys(parsed.data).length === 0) return sendError(res, 400, "No fields to update");
      const updated = await storage.updatePlaylist(id, parsed.data as any);
      res.json(updated);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to update playlist");
    }
  });

  app.delete("/api/playlists/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const playlist = await storage.getPlaylist(id);
      if (!playlist) return res.status(404).json({ message: "Playlist not found" });
      if (playlist.userId !== req.userId)
        return res.status(403).json({ message: "Forbidden" });
      await storage.deletePlaylist(id);
      res.status(204).end();
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to delete playlist");
    }
  });

  // Stripe Webhook - raw body is provided by express.raw mounted in index.ts
  app.post("/api/webhooks/stripe", stripeWebhookHandler(storage));

  // Music generation endpoint (temporarily free)
  app.post(
    "/api/generate-music",
    async (req: Request, res: Response) => {
      try {
        const { prompt, count } = (req.body || {}) as { prompt?: string; count?: number };
        if (!prompt || typeof prompt !== "string") {
                    return sendError(res, 400, "Missing prompt");
        }

        const packs = await unifiedMusicService.generateSamplePack(prompt, { packCount: Math.max(1, Math.min(count || 4, 8)) });

        // Persist pack metadata in storage
        const saved = [] as any[];
        for (const pack of packs) {
          const record = await storage.createSamplePack({
            name: pack.title,
            genre: pack.genre,
            mood: pack.metadata.mood,
            description: pack.description,
            generatedSamples: pack.samples, // stored as JSON
          });
          saved.push({
            ...record,
            bpm: pack.bpm,
            key: pack.key,
            metadata: pack.metadata,
          });
        }

        res.json({ packs: saved });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || "Failed to generate music" });
      }
    },
  );

    app.post("/api/ai/translate-code", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { sourceCode, sourceLanguage, targetLanguage, aiProvider } = req.body;

      if (!sourceCode || !sourceLanguage || !targetLanguage) {
        return sendError(res, 400, "Missing required parameters");
      }

            const translatedCode = await translateCode(sourceCode, sourceLanguage, targetLanguage, aiProvider);

      res.json({
        translatedCode,
        sourceLanguage,
        targetLanguage
      });
    } catch (err: any) {
      console.error("Code translation error:", err);
      sendError(res, 500, err?.message || "Failed to translate code");
    }
  });

  // Melody generation endpoint for Melody Composer
  app.post(
    "/api/melodies/generate",
    async (req: Request, res: Response) => {
      try {
        const {
          scale,
          style,
          mood,
          complexity,
          songStructure,
          density,
          voiceLeading,
          availableTracks,
          musicalParams
        } = req.body;

        // Use defaults if not provided
        const finalScale = scale || 'C Major';
        const finalStyle = style || 'melodic';

        console.log(`🎵 Generating melody: ${style} in ${scale}, complexity: ${complexity}`);

        const result = await generateMelody(
          scale,
          style,
          complexity || 5,
          availableTracks,
          musicalParams
        );

        res.json(result);
      } catch (err: any) {
        console.error("Melody generation error:", err);
        res.status(500).json({ message: err?.message || "Failed to generate melody" });
      }
    }
  );

  // Speech correction: transcribe with timestamps (reuse existing transcribe)
  app.post(
    "/api/speech-correction/transcribe",
    requireAuth(),
    requireCredits(CREDIT_COSTS.TRANSCRIPTION, storage),
    async (req: Request, res: Response) => {
      // Delegate to existing /api/transcribe logic but return direct result
      try {
        const { objectKey, fileUrl, songId } = req.body;
        if (!objectKey && !fileUrl) return sendError(res, 400, "Missing objectKey or fileUrl");

        let targetPath: string;
        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else if (fileUrl && fileUrl.includes("/api/songs/converted/")) {
          const fileId = fileUrl.split("/api/songs/converted/")[1];
          const safeFileId = decodeURIComponent(fileId).replace(/[^a-zA-Z0-9-_.]/g, "_");
          targetPath = path.join(LOCAL_OBJECTS_DIR, "converted", `${safeFileId}.mp3`);
        } else if (fileUrl) {
          // Download external URL to temp file for transcription
          // Convert relative URLs to absolute
          const fullUrl = fileUrl.startsWith('http') 
            ? fileUrl 
            : `http://localhost:4000${fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl}`;
          console.log(`📥 Downloading URL for transcription: ${fullUrl}`);
          const axios = (await import('axios')).default;
          const response = await axios.get(fullUrl, { responseType: 'arraybuffer' });
          
          const tempFileName = `transcribe-${crypto.randomUUID()}.mp3`;
          targetPath = path.join(LOCAL_OBJECTS_DIR, tempFileName);
          fs.writeFileSync(targetPath, Buffer.from(response.data));
          console.log(`✅ Downloaded to: ${targetPath}`);
        } else {
          return sendError(res, 400, "Missing valid audio file URL");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found on server");
        }

        const result = await transcribeAudio(targetPath);
        const transcriptText = typeof result === "string" ? result : result?.text || "";
        
        // Word-level timestamps (individual words with start/end times)
        const wordLevelTimestamps =
          Array.isArray((result as any)?.words) && (result as any).words.length
            ? (result as any).words.map((w: any) => ({
                start: w.start,
                end: w.end,
                word: w.word,
              }))
            : [];
        
        // Segment-level timestamps (phrase-level for fallback)
        const segmentTimestamps =
          Array.isArray((result as any)?.segments) && (result as any).segments.length
            ? (result as any).segments.map((s: any) => ({
                start: s.start,
                end: s.end,
                text: s.text,
              }))
            : [];
        
        if (songId && req.userId) {
          try {
            await storage.updateSongTranscription(songId, req.userId, {
              transcription: transcriptText,
              transcriptionStatus: "completed",
              transcribedAt: new Date(),
            });
          } catch (dbError) {
            console.warn("⚠️ Could not save transcription to database:", dbError);
          }
        }
        res.json({
          success: true,
          transcript: transcriptText,
          words: wordLevelTimestamps, // Word-level (individual words)
          segments: segmentTimestamps, // Segment-level (phrases)
          raw: result,
        });
      } catch (error: any) {
        console.error("Speech-correction transcription error:", error);
        sendError(res, 500, error.message || "Transcription failed");
      }
    }
  );

  // Persistent preview storage (JSON-backed via speechCorrection service)

  app.post(
    "/api/speech-correction/preview",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        let transcript = (req.body.transcriptEdits || req.body.transcript || "").trim();
        const { duration, stylePrompt, wordTiming, voiceId } = req.body;
        if (!transcript) return sendError(res, 400, "Missing transcript");

        // XTTS has a 400 token limit - truncate if needed
        const words = transcript.split(/\s+/);
        const maxWords = 350; // Conservative limit to stay under 400 tokens
        if (words.length > maxWords) {
          console.warn(`⚠️ Transcript too long (${words.length} words), truncating to ${maxWords} words`);
          transcript = words.slice(0, maxWords).join(' ') + '...';
        }

        let url: string;

        // If voiceId provided, use XTTS voice cloning directly
        if (voiceId) {
          console.log(`🎤 Using voice cloning with voiceId: ${voiceId}`);
          url = await applyVoiceConversion(transcript, voiceId, { language: "en" });
        } else {
          // No voice sample - use Bark TTS
          url = await generateSpeechPreview({
            transcript,
            duration: duration ?? 15,
            stylePrompt,
          });
        }

        const previewId = crypto.randomUUID();
        storePreview({
          previewId,
          url,
          transcript,
          duration: duration ?? 15,
          createdAt: new Date().toISOString(),
          voiceId,
        });

        res.json({
          success: true,
          previewId,
          previewUrl: url,
          alignedWords: Array.isArray(wordTiming) ? wordTiming : [],
        });
      } catch (error: any) {
        console.error("Speech-correction preview error:", error);
        sendError(res, 500, error.message || "Preview generation failed");
      }
    }
  );

  app.post(
    "/api/speech-correction/commit",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        const { previewId } = req.body;
        if (!previewId) return sendError(res, 400, "Missing previewId");
        const preview = getPreview(previewId);
        if (!preview) return sendError(res, 404, "Preview not found");

        const versionId = crypto.randomUUID();
        res.json({
          success: true,
          versionId,
          finalStemUrl: preview.url,
          transcript: preview.transcript,
        });
      } catch (error: any) {
        console.error("Speech-correction commit error:", error);
        sendError(res, 500, error.message || "Commit failed");
      }
    }
  );

  app.post(
    "/api/speech-correction/voiceprint",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;
        if (!objectKey && !fileUrl) return sendError(res, 400, "Missing objectKey or fileUrl");

        let targetPath: string;
        let tempFile = false;

        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else if (fileUrl) {
          // Handle external URLs by downloading to temp file
          // Convert relative URLs to absolute
          const fullUrl = fileUrl.startsWith('http') 
            ? fileUrl 
            : `http://localhost:4000${fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl}`;
          console.log(`📥 Checking URL for voiceprint: ${fullUrl}`);
          const axios = (await import('axios')).default;
          
          // Check if URL exists first with HEAD request
          try {
            await axios.head(fullUrl);
          } catch (headError: any) {
            if (headError.response?.status === 404) {
              return sendError(res, 404, "Audio file not found - converted file missing. Upload original audio file.");
            }
            throw headError;
          }
          
          const response = await axios.get(fullUrl, { responseType: 'arraybuffer' });
          
          // Create temp file
          const tempFileName = `voiceprint-${crypto.randomUUID()}.wav`;
          targetPath = path.join(LOCAL_OBJECTS_DIR, tempFileName);
          fs.writeFileSync(targetPath, Buffer.from(response.data));
          tempFile = true;
          console.log(`✅ Downloaded to temp file: ${targetPath}`);
        } else {
          return sendError(res, 400, "Unsupported fileUrl for voiceprint");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found on server");
        }

        const voice = createVoiceIdForFile(targetPath);
        
        // Clean up temp file if we created one
        if (tempFile && fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        
        res.json({ success: true, ...voice });
      } catch (error: any) {
        console.error("Speech-correction voiceprint error:", error);
        sendError(res, 500, error.message || "Voiceprint failed");
      }
    }
  );

  // ============================================
  // VOICE LIBRARY ENDPOINTS
  // Manage voice models for voice conversion
  // ============================================

  // Health check for RVC/voice conversion API
  app.get("/api/voices/health", async (_req: Request, res: Response) => {
    try {
      const health = await checkRvcHealth();
      res.json({ success: true, ...health });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Health check failed";
      sendError(res, 500, message);
    }
  });

  // List all voices for current user
  app.get("/api/voices", requireAuth(), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return sendError(res, 401, "Not authenticated");
      }
      const voices = listVoices(userId);
      res.json({ success: true, voices });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to list voices";
      sendError(res, 500, message);
    }
  });

  // Get a specific voice
  app.get("/api/voices/:voiceId", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { voiceId } = req.params;
      const voice = getVoice(voiceId);
      if (!voice) {
        return sendError(res, 404, "Voice not found");
      }
      res.json({ success: true, voice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to get voice";
      sendError(res, 500, message);
    }
  });

  // Create a new voice from uploaded audio
  app.post(
    "/api/voices",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).session?.userId;
        if (!userId) {
          return sendError(res, 401, "Not authenticated");
        }

        const { objectKey, fileUrl, name, duration } = req.body;
        if (!objectKey && !fileUrl) {
          return sendError(res, 400, "objectKey or fileUrl required");
        }

        let targetPath: string;
        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else {
          return sendError(res, 400, "Unsupported fileUrl format");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const voice = await createVoice(userId, targetPath, name || "My Voice", duration || 0);
        res.json({ success: true, voice });
      } catch (error: unknown) {
        console.error("Create voice error:", error);
        const message = error instanceof Error ? error.message : "Failed to create voice";
        sendError(res, 500, message);
      }
    }
  );

  // Delete a voice
  app.delete(
    "/api/voices/:voiceId",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).session?.userId;
        if (!userId) {
          return sendError(res, 401, "Not authenticated");
        }

        const { voiceId } = req.params;
        const deleted = deleteVoice(voiceId, userId);
        if (!deleted) {
          return sendError(res, 404, "Voice not found");
        }
        res.json({ success: true });
      } catch (error: unknown) {
        console.error("Delete voice error:", error);
        const message = error instanceof Error ? error.message : "Failed to delete voice";
        if (message === "Access denied") {
          return sendError(res, 403, message);
        }
        sendError(res, 500, message);
      }
    }
  );

  // Convert audio using a voice model
  app.post(
    "/api/voices/:voiceId/convert",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        const { voiceId } = req.params;
        const { audioUrl, objectKey, pitch, indexRate, filterRadius, rmsMixRate, protect } = req.body;

        let sourceUrl = audioUrl;
        if (!sourceUrl && objectKey) {
          sourceUrl = `/api/internal/uploads/${objectKey}`;
        }
        if (!sourceUrl) {
          return sendError(res, 400, "audioUrl or objectKey required");
        }

        const resultUrl = await convertWithVoice(voiceId, sourceUrl, {
          pitch,
          indexRate,
          filterRadius,
          rmsMixRate,
          protect,
        });

        res.json({ success: true, url: resultUrl });
      } catch (error: unknown) {
        console.error("Voice convert error:", error);
        const message = error instanceof Error ? error.message : "Voice conversion failed";
        sendError(res, 500, message);
      }
    }
  );

  // ============================================
  // AUDIO ANALYSIS ENDPOINTS
  // Uses local RVC-based API for pitch/melody/emotion analysis
  // ============================================

  // Health check for audio analysis API
  app.get("/api/audio-analysis/health", async (_req: Request, res: Response) => {
    try {
      const health = await checkApiHealth();
      res.json({ success: true, ...health });
    } catch (error: any) {
      sendError(res, 500, error.message || "Health check failed");
    }
  });

  // Extract pitch (F0) from audio
  app.post(
    "/api/audio-analysis/extract-pitch",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;

        let targetPath: string;
        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else {
          return sendError(res, 400, "objectKey or fileUrl required");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await extractPitch(targetPath);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Extract pitch error:", error);
        sendError(res, 500, error.message || "Pitch extraction failed");
      }
    }
  );

  // Apply pitch correction (auto-tune)
  app.post(
    "/api/audio-analysis/pitch-correct",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl, scale, root, correctionStrength } = req.body;

        let targetPath: string;
        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else {
          return sendError(res, 400, "objectKey or fileUrl required");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const resultUrl = await pitchCorrect(targetPath, { scale, root, correctionStrength });
        if (!resultUrl) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, url: resultUrl });
      } catch (error: any) {
        console.error("Pitch correct error:", error);
        sendError(res, 500, error.message || "Pitch correction failed");
      }
    }
  );

  // Extract melody as MIDI notes
  app.post(
    "/api/audio-analysis/extract-melody",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl, minNoteDuration } = req.body;

        let targetPath: string;
        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else {
          return sendError(res, 400, "objectKey or fileUrl required");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await extractMelody(targetPath, minNoteDuration);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Extract melody error:", error);
        sendError(res, 500, error.message || "Melody extraction failed");
      }
    }
  );

  // Score karaoke performance
  app.post(
    "/api/audio-analysis/karaoke-score",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl, referenceNotes } = req.body;

        if (!referenceNotes || !Array.isArray(referenceNotes)) {
          return sendError(res, 400, "referenceNotes array required");
        }

        let targetPath: string;
        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else {
          return sendError(res, 400, "objectKey or fileUrl required");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await scoreKaraoke(targetPath, referenceNotes);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Karaoke score error:", error);
        sendError(res, 500, error.message || "Karaoke scoring failed");
      }
    }
  );

  // Detect emotion from vocals
  app.post(
    "/api/audio-analysis/detect-emotion",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;

        let targetPath: string;
        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else {
          return sendError(res, 400, "objectKey or fileUrl required");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await detectEmotion(targetPath);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Detect emotion error:", error);
        sendError(res, 500, error.message || "Emotion detection failed");
      }
    }
  );

  // Classify audio type
  app.post(
    "/api/audio-analysis/classify",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;

        let targetPath: string;
        if (objectKey) {
          targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl && fileUrl.includes("/api/internal/uploads/")) {
          const extractedKey = fileUrl.split("/api/internal/uploads/")[1];
          targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
        } else {
          return sendError(res, 400, "objectKey or fileUrl required");
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await classifyAudio(targetPath);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Classify audio error:", error);
        sendError(res, 500, error.message || "Audio classification failed");
      }
    }
  );

  // Get user melodies
  app.get("/api/melodies", requireAuth(), async (req: Request, res: Response) => {
    try {
      const melodies = await storage.getUserMelodies(req.userId!);
      res.json(melodies);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to fetch melodies");
    }
  });

  // Save melody
  app.post("/api/melodies", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { title, notes, scale } = req.body;
      
      if (!title || !notes) {
                return sendError(res, 400, "Title and notes are required");
      }

      const melody = await storage.createMelody(req.userId!, {
        name: title,
        notes: JSON.stringify(notes),
        scale: scale || "C Major"
      });

      res.status(201).json(melody);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to save melody");
    }
  });

  // Internal binary upload endpoint (local fallback when GCS is not configured)
  app.put(
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
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, req.body as Buffer);
        return res.json({ ok: true, path: `/objects/${sanitizedKey}` });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Upload failed");
      }
    },
  );

  // Serve files from internal uploads path (for song playback)
  app.get("/api/internal/uploads/*", async (req: Request, res: Response) => {
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
        // List files in the directory for debugging
        try {
          const files = fs.readdirSync(LOCAL_OBJECTS_DIR);
          console.log('📂 Files in LOCAL_OBJECTS_DIR:', files.slice(0, 10));
        } catch (e) {
          console.error('❌ Could not list directory:', e);
        }
        console.error('❌ File not found:', fullPath);
        return res.status(404).send("Not found");
      }
      
      console.log('✅ File found, serving:', fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      
      // Set proper Content-Type for audio files
      let type = "application/octet-stream";
      if (ext === ".mp3") type = "audio/mpeg";
      else if (ext === ".wav") type = "audio/wav";
      else if (ext === ".m4a") type = "audio/mp4";
      else if (ext === ".ogg") type = "audio/ogg";
      else if (ext === ".flac") type = "audio/flac";
      
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
  app.get("/objects/*", async (req: Request, res: Response) => {
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
      
      res.setHeader("Content-Type", type);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=86400");
      fs.createReadStream(fullPath).pipe(res);
    } catch (err: any) {
      res.status(500).send("Server error");
    }
  });

  // Complete professional song generation using Suno AI via Replicate
  app.post(
    "/api/music/generate-complete",
    requireAuth(),
    requireCredits(CREDIT_COSTS.SONG_GENERATION, storage),
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({
          songDescription: z.string().min(1, "songDescription is required"),
          genre: z.string().optional(),
          mood: z.string().optional(),
          duration: z.number().optional(),
          includeVocals: z.boolean().optional(),
        });

        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid payload" });
        }

        const {
          songDescription,
          genre,
          mood,
          duration,
          includeVocals = true,
        } = parsed.data;

        // Build prompt for Suno AI
        const promptParts = [songDescription];
        if (genre) promptParts.push(`Genre: ${genre}`);
        if (mood) promptParts.push(`Mood: ${mood}`);
        if (!includeVocals) promptParts.push("Instrumental only");
        const prompt = promptParts.join(", ");

        console.log(`🎵 Generating complete song with Suno AI: "${prompt}"`);

        // Call Replicate Suno AI
        const replicateToken = process.env.REPLICATE_API_TOKEN;
        if (!replicateToken) {
          return res.status(500).json({ message: "REPLICATE_API_TOKEN not configured" });
        }

        try {
          // Use Suno AI model on Replicate (bark or similar)
          const response = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Token ${replicateToken}`,
            },
            body: JSON.stringify({
              version: "b76242b40d67c76ab6742e987628a2a9ac019e11d56ab96c4e91ce03b79b2787", // Bark text-to-audio
              input: {
                prompt: prompt,
                text_temp: 0.7,
                waveform_temp: 0.7,
              },
            }),
          });

          const prediction = await response.json();

          // Validate prediction ID
          if (!prediction.id || typeof prediction.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(prediction.id)) {
            console.error('[Suno] Invalid prediction response:', prediction);
            return res.status(500).json({ message: "Invalid prediction ID from Replicate" });
          }

          // Poll for result (Suno takes longer, so we need more time)
          let result;
          const REPLICATE_API_BASE = 'https://api.replicate.com';
          let attempts = 0;
          const maxAttempts = 240; // 8 minutes max for Suno

          do {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const statusResponse = await fetch(`${REPLICATE_API_BASE}/v1/predictions/${prediction.id}`, {
              headers: { "Authorization": `Token ${replicateToken}` },
            });
            result = await statusResponse.json();
            attempts++;

            if (attempts >= maxAttempts) {
              return res.status(500).json({ message: "Song generation timeout - Suno took too long" });
            }
          } while (result.status === "starting" || result.status === "processing");

          if (result.status === "succeeded" && result.output) {
            // Deduct credits after successful generation
            if (req.creditService && req.creditCost) {
              await req.creditService.deductCredits(
                req.userId!,
                req.creditCost,
                'Complete song generation',
                { genre, mood, songDescription: songDescription.substring(0, 100) }
              );
            }

            const data = {
              success: true,
              audioUrl: result.output.audio_out || result.output,
              title: `${genre || 'AI'} Song`,
              description: songDescription,
              genre: genre || 'AI Generated',
              prompt,
              provider: 'Suno AI (Replicate)'
            };

            console.log(`✅ Suno AI generated complete song`);
            return res.json(data);
          } else {
            console.error('[Suno] Generation failed:', result);
            return res.status(500).json({ message: `Song generation failed: ${result.error || 'Unknown error'}` });
          }
        } catch (err: any) {
          console.error("Suno AI generation error:", err);
          return res.status(500).json({ message: err?.message || "Failed to generate song with Suno AI" });
        }
      } catch (err: any) {
        console.error("Complete song generation error:", err);
        return res.status(500).json({ message: err?.message || "Failed to generate complete song" });
      }
    }
  );

  // Save lyrics endpoint
  app.post("/api/lyrics", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { title, content, genre, rhymeScheme } = req.body;
      
      if (!title || !content) {
        return sendError(res, 400, "Missing required fields: title and content");
      }

      const newLyric = await storage.createLyrics(req.userId!, {
        title,
        content,
        genre: genre || 'Unknown',
        rhymeScheme: rhymeScheme || 'AABB'
      });

      console.log('✅ Lyrics saved:', title);
      res.json(newLyric);
    } catch (error) {
      console.error('❌ Save lyrics error:', error);
      sendError(res, 500, "Failed to save lyrics");
    }
  });

  // Get saved lyrics endpoint
  app.get("/api/lyrics", requireAuth(), async (req: Request, res: Response) => {
    try {
      const lyrics = await storage.getUserLyrics(req.userId!);
      res.json(lyrics);
    } catch (error) {
      console.error('❌ Get lyrics error:', error);
      sendError(res, 500, "Failed to fetch lyrics");
    }
  });

  // Get rhyming words endpoint
  app.post(
    "/api/lyrics/rhymes",
    requireAuth(),
    requireCredits(CREDIT_COSTS.RHYME_SUGGESTIONS, storage),
    async (req: Request, res: Response) => {
      const fetchDatamuseRhymes = async (target: string) => {
        const endpoints = [
          `https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(target)}&max=20`,
          `https://api.datamuse.com/words?rel_nry=${encodeURIComponent(target)}&max=20`,
        ];
        const results: string[] = [];

        for (const url of endpoints) {
          const response = await fetch(url, { headers: { "User-Agent": "Codedswitch/1.0" } });
          if (!response.ok) continue;
          const data = (await response.json()) as { word: string }[];
          data.forEach((entry) => {
            if (entry.word) {
              results.push(entry.word);
            }
          });
        }

        return Array.from(new Set(results)).slice(0, 20);
      };

      try {
        const { word } = req.body;

        if (!word) {
          return sendError(res, 400, "Missing required field: word");
        }

        // Prefer AI for creative variety
        const XAI_API_KEY = process.env.XAI_API_KEY;
        let rhymes: string[] | null = null;

        if (XAI_API_KEY) {
          try {
            const response = await fetch("https://api.x.ai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${XAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: "grok-3",
                messages: [
                  {
                    role: "system",
                    content: "You are a rap/songwriting assistant. Generate rhyming words for songwriting.",
                  },
                  {
                    role: "user",
                    content: `Give me 12 words that rhyme with "${word}". Include perfect rhymes, near rhymes, and slant rhymes. Respond ONLY with a JSON array of words, no explanation: ["word1", "word2", ...]`,
                  },
                ],
                temperature: 0.7,
              }),
            });

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content ?? "";
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            rhymes = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          } catch (error) {
            console.warn("⚠️ Grok rhyme lookup failed, falling back to Datamuse:", (error as Error).message);
            rhymes = null;
          }
        }

        if (!rhymes || rhymes.length === 0) {
          try {
            rhymes = await fetchDatamuseRhymes(word);
          } catch (datamuseError) {
            console.warn("⚠️ Datamuse fallback failed:", (datamuseError as Error).message);
          }
        }

        if (!rhymes || rhymes.length === 0) {
          rhymes = ["way", "day", "say", "play", "stay", "lay", "pay", "may"];
        }

        // Deduct credits after successful generation
        if (req.creditService && req.creditCost) {
          await req.creditService.deductCredits(req.userId!, req.creditCost, "Rhyme suggestions", { word });
        }

        console.log("✅ Rhymes generated for:", word);
        res.json({ rhymes });
      } catch (error) {
        console.error("❌ Rhyme generation error:", error);
        res.json({
          rhymes: ["way", "day", "say", "play", "stay", "lay", "pay", "may"],
        });
      }
    },
  );


  // Get available AI providers
  app.get("/api/ai-providers", async (req: Request, res: Response) => {
    try {
      const { aiProviderManager } = await import('./services/aiProviderManager');
      
      const providers = aiProviderManager.getAvailableProviders();
      const authenticated = aiProviderManager.getAuthenticatedProviders();
      
      res.json({
        status: 'success',
        providers: providers,
        authenticated: authenticated.map(p => p.name),
        message: 'Available AI providers'
      });
    } catch (error) {
      console.error('❌ Error fetching providers:', error);
      sendError(res, 500, "Failed to fetch AI providers");
    }
  });

  // Set user's AI provider preference
  app.post("/api/ai-provider/set", async (req: Request, res: Response) => {
    try {
      const { feature, provider } = req.body;
      
      if (!feature || !provider) {
        return sendError(res, 400, "Missing feature or provider");
      }

      const { aiProviderManager } = await import('./services/aiProviderManager');
      
      // Validate provider exists
      if (!aiProviderManager.getAvailableProviders().find(p => p.name === provider)) {
        return sendError(res, 400, "Invalid provider");
      }

      // Check if provider is authenticated
      if (!aiProviderManager.isAuthenticated(provider)) {
        return sendError(res, 401, `Provider ${provider} is not authenticated`);
      }

      aiProviderManager.setProvider(feature, provider);
      
      res.json({
        status: 'success',
        message: `AI provider set to ${provider} for ${feature}`,
        feature: feature,
        provider: provider
      });
    } catch (error) {
      console.error('❌ Error setting provider:', error);
      sendError(res, 500, "Failed to set AI provider");
    }
  });

  // Get user's AI provider preference
  app.get("/api/ai-provider/:feature", async (req: Request, res: Response) => {
    try {
      const { feature } = req.params;
      const { aiProviderManager } = await import('./services/aiProviderManager');
      
      const provider = aiProviderManager.getProvider(feature);
      
      res.json({
        status: 'success',
        feature: feature,
        provider: provider
      });
    } catch (error) {
      console.error('❌ Error getting provider:', error);
      sendError(res, 500, "Failed to get AI provider");
    }
  });

  // Transcription endpoint
  app.post(
    "/api/transcribe",
    requireAuth(),
    requireCredits(CREDIT_COSTS.TRANSCRIPTION, storage),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;
        
        if (!objectKey && !fileUrl) {
          return sendError(res, 400, "Missing objectKey or fileUrl");
        }

        let targetPath: string;

        if (objectKey) {
           targetPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        } else if (fileUrl) {
           // Try to extract path from fileUrl if it's a local URL
           if (fileUrl.includes('/api/internal/uploads/')) {
              const extractedKey = fileUrl.split('/api/internal/uploads/')[1];
              targetPath = path.join(LOCAL_OBJECTS_DIR, decodeURIComponent(extractedKey));
           } else if (fileUrl.includes('/api/songs/converted/')) {
              // Handle converted MP3 files
              const fileId = fileUrl.split('/api/songs/converted/')[1];
              const safeFileId = decodeURIComponent(fileId).replace(/[^a-zA-Z0-9-_\.]/g, '_');
              targetPath = path.join(LOCAL_OBJECTS_DIR, 'converted', `${safeFileId}.mp3`);
              console.log('🎤 Using converted file for transcription:', targetPath);
           } else {
              return sendError(res, 400, "External URLs not yet supported for transcription");
           }
        } else {
           return sendError(res, 400, "Missing objectKey or fileUrl");
        }

        // Security check to prevent directory traversal
        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
            return sendError(res, 403, "Access denied");
        }

        if (!fs.existsSync(targetPath)) {
           return sendError(res, 404, "Audio file not found on server");
        }

        console.log('🎤 Transcribing file:', targetPath);
        const result = await transcribeAudio(targetPath);
        
        // Extract text from result (could be string or object with text property)
        const transcriptionText = typeof result === 'string' 
          ? result 
          : (result?.text || JSON.stringify(result));
        
        // Save transcription to database if songId is provided
        const { songId } = req.body;
        if (songId && req.userId) {
          try {
            await storage.updateSongTranscription(songId, req.userId, {
              transcription: transcriptionText,
              transcriptionStatus: 'completed',
              transcribedAt: new Date()
            });
            console.log('✅ Transcription saved to database for song:', songId);
          } catch (dbError) {
            console.warn('⚠️ Could not save transcription to database:', dbError);
            // Continue anyway - transcription was successful
          }
        }
        
        res.json({ success: true, transcription: result });

        // Deduct credits after successful transcription
        if (req.creditService && req.creditCost) {
          try {
            await req.creditService.deductCredits(
              req.userId!,
              req.creditCost,
              'Transcription',
              { hasSongId: Boolean(songId) }
            );
          } catch (deductError) {
            console.warn('⚠️ Failed to deduct transcription credits:', deductError);
          }
        }

      } catch (error: any) {
        console.error("Transcription error:", error);
        
        // Update status to failed if songId provided
        const { songId } = req.body;
        if (songId && req.userId) {
          try {
            await storage.updateSongTranscription(songId, req.userId, {
              transcriptionStatus: 'failed'
            });
          } catch (e) { /* ignore */ }
        }
        
        sendError(res, 500, error.message || "Transcription failed");
      }
    }
  );

  // Advanced lyrics analysis endpoint
  app.post(
    "/api/lyrics/analyze",
    requireAuth(),
    requireCredits(CREDIT_COSTS.LYRICS_ANALYSIS, storage),
    async (req: Request, res: Response) => {
      try {
        const { lyrics, genre, enhanceWithAI = true, songId } = req.body;
        
        if (!lyrics || !lyrics.trim()) {
          return sendError(res, 400, "Missing lyrics text");
        }

        console.log('🎵 Analyzing lyrics with advanced system...');
      
      // Import the advanced analyzer
      const { advancedLyricAnalyzer } = await import('./services/advancedLyricAnalyzer');
      
      // Perform basic analysis
      const basicAnalysis = advancedLyricAnalyzer.analyzeLyrics(lyrics);
      console.log('✅ Basic analysis complete');
      
      // Enhance with AI if requested
      let enhancedAnalysis;
      if (enhanceWithAI) {
        console.log('🤖 Enhancing with AI insights...');
        enhancedAnalysis = await advancedLyricAnalyzer.enhanceWithAI(
          basicAnalysis, 
          lyrics, 
          genre || 'unknown'
        );
        console.log('✅ AI enhancement complete');
      } else {
        enhancedAnalysis = {
          ...basicAnalysis,
          ai_insights: {
            vocal_delivery: "AI enhancement disabled",
            musical_suggestions: ["Enable AI enhancement for suggestions"],
            production_notes: ["Enable AI enhancement for production tips"],
            genre_recommendations: [genre || 'unknown'],
            improvement_areas: []
          },
          overall_rating: {
            score: basicAnalysis.quality_score,
            strengths: [],
            weaknesses: [],
            commercial_potential: basicAnalysis.quality_score / 10
          }
        };
      }

      if (songId && req.userId) {
        try {
          await storage.saveLyricsAnalysis(req.userId, {
            songId,
            content: lyrics,
            analysis: enhancedAnalysis,
          });
        } catch (persistErr) {
          console.warn('⚠️ Could not persist lyrics analysis:', persistErr);
        }
      }

      console.log('✅ Advanced lyrics analysis complete');
      
      // Deduct credits after successful analysis
      if (req.creditService && req.creditCost) {
        await req.creditService.deductCredits(
          req.userId!,
          req.creditCost,
          'Lyrics analysis',
          { genre, enhanceWithAI }
        );
      }
      
      res.json({
        status: 'success',
        analysis: enhancedAnalysis
      });

    } catch (error) {
      console.error('❌ Lyrics analysis error:', error);
      sendError(res, 500, "Failed to analyze lyrics");
    }
  });

  // Generate lyrics endpoint with AI model selection
  app.post(
    "/api/lyrics/generate",
    requireAuth(),
    requireCredits(CREDIT_COSTS.LYRICS_GENERATION, storage),
    async (req: Request, res: Response) => {
      try {
        const { theme, genre, mood, style, aiProvider = 'gpt-4' } = req.body;

        if (!theme) {
          return sendError(res, 400, "Theme is required");
        }

        const prompt = `Write song lyrics about "${theme}".
Genre: ${genre || 'pop'}
Mood: ${mood || 'uplifting'}
Style: ${style || 'modern'}

Create complete lyrics with:
- 2 verses
- 1 chorus (repeat after each verse)
- 1 bridge
- Final chorus

Make it creative, emotional, and fitting for the genre and mood.`;

        let lyrics = '';
        let providerUsed = '';

        // Use Replicate's Llama model for reliable lyrics generation
        const token = process.env.REPLICATE_API_TOKEN;
        if (!token) {
          return sendError(res, 500, "REPLICATE_API_TOKEN not configured");
        }

        console.log(`🎵 Generating lyrics with Replicate Llama: "${theme}"`);

        const response = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Token ${token}`,
          },
          body: JSON.stringify({
            version: "2d19859030ff705a87c746f7e96eea03aefb71f166725aee39692f1476566d48", // Llama 3.2 3B
            input: {
              prompt: prompt,
              max_tokens: 800,
              temperature: 0.8
            },
          }),
        });

        const prediction = await response.json();
        
        // Poll for result
        let result;
        let attempts = 0;
        const maxAttempts = 60;

        do {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
            headers: { "Authorization": `Token ${token}` },
          });
          result = await statusResponse.json();
          attempts++;

          if (attempts >= maxAttempts) {
            return sendError(res, 500, "Lyrics generation timeout");
          }
        } while (result.status === "starting" || result.status === "processing");

        if (result.status === "succeeded" && result.output) {
          lyrics = Array.isArray(result.output) ? result.output.join('') : result.output;
          providerUsed = 'Replicate Llama';
          
          // Deduct credits after successful generation
          if (req.creditService && req.creditCost) {
            await req.creditService.deductCredits(
              req.userId!,
              req.creditCost,
              'Lyrics generation',
              { theme, genre, mood }
            );
          }
        } else {
          throw new Error('Lyrics generation failed');
        }

        console.log(`✅ Generated lyrics with ${providerUsed}`);

        res.json({ 
          content: lyrics,
          lyrics,
          metadata: {
            theme,
            genre: genre || 'pop',
            mood: mood || 'uplifting',
            style: style || 'modern',
            provider: providerUsed
          }
        });
      } catch (err: any) {
        console.error("Lyrics generation error:", err);
        sendError(res, 500, err?.message || "Failed to generate lyrics");
      }
    }
  );

  // Generate beat from lyrics endpoint using Replicate Llama
  app.post(
    "/api/lyrics/generate-beat",
    requireAuth(),
    requireCredits(CREDIT_COSTS.BEAT_GENERATION, storage),
    async (req: Request, res: Response) => {
      try {
        const { lyrics, genre, complexity } = req.body;

        if (!lyrics) {
          return sendError(res, 400, "Lyrics are required");
        }

        // Use Replicate Llama to analyze lyrics and generate beat pattern
        const token = process.env.REPLICATE_API_TOKEN;
        if (!token) {
          return sendError(res, 500, "REPLICATE_API_TOKEN not configured");
        }

        const prompt = `Analyze these lyrics and create a drum beat pattern. Return ONLY valid JSON with no other text.

Lyrics: ${lyrics.substring(0, 300)}

Genre: ${genre || 'hip-hop'}

Return this exact JSON format:
{
  "kick": [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
  "snare": [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
  "hihat": [1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1],
  "bpm": 120
}`;

        console.log(`🥁 Generating beat from lyrics with Replicate Llama`);

        const response = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Token ${token}`,
          },
          body: JSON.stringify({
            version: "2d19859030ff705a87c746f7e96eea03aefb71f166725aee39692f1476566d48", // Llama 3.2 3B
            input: {
              prompt: prompt,
              max_tokens: 500,
              temperature: 0.7
            },
          }),
        });

        const prediction = await response.json();
        
        // Poll for result
        let result;
        let attempts = 0;
        const maxAttempts = 60;

        do {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
            headers: { "Authorization": `Token ${token}` },
          });
          result = await statusResponse.json();
          attempts++;

          if (attempts >= maxAttempts) {
            return sendError(res, 500, "Beat generation timeout");
          }
        } while (result.status === "starting" || result.status === "processing");

        let beatPattern;
        if (result.status === "succeeded" && result.output) {
          const content = Array.isArray(result.output) ? result.output.join('') : result.output;
          try {
            beatPattern = JSON.parse(content);
          } catch {
            beatPattern = {
              kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
              snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
              hihat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
              bpm: 120
            };
          }
        } else {
          throw new Error('Beat generation failed');
        }

        console.log(`✅ Generated beat pattern with Replicate Llama`);

        // Deduct credits after successful generation
        if (req.creditService && req.creditCost) {
          await req.creditService.deductCredits(
            req.userId!,
            req.creditCost,
            'Beat generation from lyrics',
            { genre, complexity }
          );
        }

        res.json({ 
          pattern: beatPattern,
          bpm: beatPattern.bpm || 120,
          genre: genre || 'hip-hop',
          complexity: complexity || 5,
          provider: 'Replicate Llama'
        });
      } catch (err: any) {
        console.error("Beat generation from lyrics error:", err);
        sendError(res, 500, err?.message || "Failed to generate beat from lyrics");
      }
    }
  );



  // Save pack to library
  app.post(
    "/api/packs/save",
    async (req: Request, res: Response) => {
      try {
        const { pack } = req.body;
        
        if (!pack) {
          return sendError(res, 400, "Pack data is required");
        }

        // Create pack in database
        const savedPack = await storage.createSamplePack({
          name: pack.title,
          genre: pack.genre,
          mood: pack.metadata?.mood || "Dynamic",
          description: pack.description,
          generatedSamples: pack.samples, // Store all sample data as JSON
        });

        console.log('✅ Pack saved to database:', savedPack.id);

        res.json({ 
          success: true,
          packId: savedPack.id,
          message: "Pack saved to library successfully"
        });
      } catch (err: any) {
        console.error("Save pack error:", err);
        res.status(500).json({ message: err?.message || "Failed to save pack" });
      }
    }
  );

    app.post(
    "/api/chatmusician/generate",
    async (req: Request, res: Response) => {
      try {
        // Check authentication
        if (!req.userId) {
          return sendError(res, 401, "Authentication required - please log in");
        }

        const { prompt, style } = req.body;

        if (!prompt) {
          return sendError(res, 400, "Prompt is required");
        }

        const generatedMelody = await generateChatMusicianMelody(prompt, style || 'classical');

        res.json(generatedMelody);
      } catch (err: any) {
        console.error("ChatMusician error:", err);
        sendError(res, 500, err?.message || "Failed to generate melody");
      }
    }
  );

  // ============================================
  // ASTUTELY AI BEAT GENERATOR
  // ============================================
  // NOTE: Astutely endpoint is now handled by createAstutelyRoutes() at line 132
  // which uses AI (Grok) for intelligent beat generation
  // The duplicate hardcoded endpoint has been removed to enable AI functionality

  // ============================================
  // TRACKS API - Single source of truth for all audio
  // ============================================

  // Get all tracks for a project
  app.get("/api/tracks/project/:projectId", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const tracks = await storage.getProjectTracks(projectId);
      res.json({ success: true, tracks });
    } catch (err: any) {
      console.error("Get project tracks error:", err);
      sendError(res, 500, err?.message || "Failed to get tracks");
    }
  });

  // Get all tracks for current user
  app.get("/api/tracks", requireAuth(), async (req: Request, res: Response) => {
    try {
      const tracks = await storage.getUserTracks(req.userId!);
      res.json({ success: true, tracks });
    } catch (err: any) {
      console.error("Get user tracks error:", err);
      sendError(res, 500, err?.message || "Failed to get tracks");
    }
  });

  // Get single track
  app.get("/api/tracks/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const track = await storage.getTrack(req.params.id);
      if (!track) {
        return sendError(res, 404, "Track not found");
      }
      res.json({ success: true, track });
    } catch (err: any) {
      console.error("Get track error:", err);
      sendError(res, 500, err?.message || "Failed to get track");
    }
  });

  // Create a new track
  app.post("/api/tracks", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { projectId, name, type, audioUrl, position, duration, volume, pan, color, effects, metadata } = req.body;
      
      if (!name || !type) {
        return sendError(res, 400, "name and type are required");
      }
      
      // audioUrl is only required for audio/vocal/recording tracks
      if ((type === 'audio' || type === 'vocal' || type === 'recording') && !audioUrl) {
        return sendError(res, 400, "audioUrl is required for audio tracks");
      }

      const track = await storage.createTrack(req.userId!, projectId || null, {
        name,
        type,
        audioUrl,
        position: position || 0,
        duration,
        volume: volume ?? 100,
        pan: pan ?? 0,
        muted: false,
        solo: false,
        color,
        effects,
        metadata,
      });

      res.json({ success: true, track });
    } catch (err: any) {
      console.error("Create track error:", err);
      sendError(res, 500, err?.message || "Failed to create track");
    }
  });

  // Update a track
  app.patch("/api/tracks/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Verify track exists and belongs to user
      const existing = await storage.getTrack(id);
      if (!existing) {
        return sendError(res, 404, "Track not found");
      }
      if (existing.userId !== req.userId) {
        return sendError(res, 403, "Not authorized to update this track");
      }

      const track = await storage.updateTrack(id, updates);
      res.json({ success: true, track });
    } catch (err: any) {
      console.error("Update track error:", err);
      sendError(res, 500, err?.message || "Failed to update track");
    }
  });

  // Delete a track
  app.delete("/api/tracks/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify track exists and belongs to user
      const existing = await storage.getTrack(id);
      if (!existing) {
        return sendError(res, 404, "Track not found");
      }
      if (existing.userId !== req.userId) {
        return sendError(res, 403, "Not authorized to delete this track");
      }

      await storage.deleteTrack(id);
      res.json({ success: true, message: "Track deleted" });
    } catch (err: any) {
      console.error("Delete track error:", err);
      sendError(res, 500, err?.message || "Failed to delete track");
    }
  });

  // ============================================
  // MIX/EXPORT - Combine all tracks into one file
  // ============================================

  app.post("/api/tracks/mix", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { projectId, trackIds } = req.body;
      
      // Get tracks to mix
      let tracksToMix: any[] = [];
      if (projectId) {
        tracksToMix = await storage.getProjectTracks(projectId);
      } else if (trackIds && Array.isArray(trackIds)) {
        for (const id of trackIds) {
          const track = await storage.getTrack(id);
          if (track) tracksToMix.push(track);
        }
      }

      if (tracksToMix.length === 0) {
        return sendError(res, 400, "No tracks to mix");
      }

      // Filter out muted tracks
      const activeTracks = tracksToMix.filter(t => !t.muted);
      if (activeTracks.length === 0) {
        return sendError(res, 400, "All tracks are muted");
      }

      // Build ffmpeg command to mix all tracks
      const ffmpeg = require("fluent-ffmpeg");
      const outputFilename = `mix_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.mp3`;
      const outputPath = path.join(LOCAL_OBJECTS_DIR, outputFilename);

      // Create complex filter for mixing with volume control
      let inputs: string[] = [];
      let filterParts: string[] = [];
      
      for (let i = 0; i < activeTracks.length; i++) {
        const track = activeTracks[i];
        let audioPath = track.audioUrl;
        
        // Convert URL to local path
        if (audioPath.startsWith('/api/internal/uploads/')) {
          audioPath = path.join(LOCAL_OBJECTS_DIR, audioPath.split('/api/internal/uploads/')[1]);
        } else if (audioPath.startsWith('/objects/')) {
          audioPath = path.join(LOCAL_OBJECTS_DIR, audioPath.split('/objects/')[1]);
        }
        
        if (!fs.existsSync(audioPath)) {
          console.warn(`Track file not found: ${audioPath}`);
          continue;
        }
        
        inputs.push(audioPath);
        const vol = (track.volume || 100) / 100;
        filterParts.push(`[${i}:a]volume=${vol}[a${i}]`);
      }

      if (inputs.length === 0) {
        return sendError(res, 400, "No valid audio files found");
      }

      // Mix all tracks
      const mixFilter = inputs.length > 1 
        ? filterParts.join(';') + ';' + filterParts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${inputs.length}:duration=longest[out]`
        : `[0:a]volume=1[out]`;

      await new Promise<void>((resolve, reject) => {
        let cmd = ffmpeg();
        inputs.forEach(input => cmd = cmd.input(input));
        
        cmd
          .complexFilter(mixFilter, 'out')
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err))
          .run();
      });

      const mixUrl = `/api/internal/uploads/${outputFilename}`;
      
      res.json({ 
        success: true, 
        url: mixUrl,
        message: `Mixed ${inputs.length} tracks successfully`
      });
    } catch (err: any) {
      console.error("Mix tracks error:", err);
      sendError(res, 500, err?.message || "Failed to mix tracks");
    }
  });

  // ============================================
  // JAM SESSIONS API (feature-gated)
  // ============================================
  const enableJams = process.env.ENABLE_JAMS === "true";
  if (enableJams) {
    // Get active jam sessions
    app.get("/api/jam-sessions", requireAuth(), async (req: Request, res: Response) => {
      try {
        const sessions = await storage.getActiveJamSessions();
        res.json({ success: true, sessions });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to get jam sessions");
      }
    });

    // Get user's jam sessions
    app.get("/api/jam-sessions/mine", requireAuth(), async (req: Request, res: Response) => {
      try {
        const sessions = await storage.getUserJamSessions(req.userId!);
        res.json({ success: true, sessions });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to get your jam sessions");
      }
    });

    // Get single jam session
    app.get("/api/jam-sessions/:id", requireAuth(), async (req: Request, res: Response) => {
      try {
        const session = await storage.getJamSession(req.params.id);
        if (!session) {
          return sendError(res, 404, "Jam session not found");
        }
        const contributions = await storage.getJamContributions(session.id);
        res.json({ success: true, session, contributions });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to get jam session");
      }
    });

    // Create jam session
    app.post("/api/jam-sessions", requireAuth(), async (req: Request, res: Response) => {
      try {
        const { name, description, genre, bpm, keySignature, isPublic, maxParticipants } = req.body;
        if (!name) {
          return sendError(res, 400, "Session name is required");
        }
        const session = await storage.createJamSession(req.userId!, {
          name,
          description,
          genre,
          bpm: bpm || 120,
          keySignature,
          isPublic: isPublic !== false,
          maxParticipants: maxParticipants || 10,
        });
        res.json({ success: true, session });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to create jam session");
      }
    });

    // End jam session
    app.post("/api/jam-sessions/:id/end", requireAuth(), async (req: Request, res: Response) => {
      try {
        const session = await storage.getJamSession(req.params.id);
        if (!session) {
          return sendError(res, 404, "Jam session not found");
        }
        if (session.hostId !== req.userId) {
          return sendError(res, 403, "Only the host can end this session");
        }
        const ended = await storage.endJamSession(req.params.id);
        res.json({ success: true, session: ended });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to end jam session");
      }
    });

    // Add contribution to jam session
    app.post("/api/jam-sessions/:id/contribute", requireAuth(), async (req: Request, res: Response) => {
      try {
        const { type, audioUrl, position, duration } = req.body;
        if (!type || !audioUrl) {
          return sendError(res, 400, "type and audioUrl are required");
        }
        const contribution = await storage.createJamContribution(req.params.id, req.userId!, {
          type,
          audioUrl,
          position: position || 0,
          duration,
        });
        res.json({ success: true, contribution });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to add contribution");
      }
    });
  }

  return createServer(app);
}
