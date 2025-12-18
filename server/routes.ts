import type { Express, Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import type { IStorage } from "./storage";
import { requireAuth, requireSubscription } from "./middleware/auth";
import { requireFeature, checkUsageLimit } from "./middleware/featureGating";
import { requireCredits } from "./middleware/requireCredits";
import { createAuthRoutes } from "./routes/auth";
import { createKeyRoutes } from "./routes/keys";
import { createSongRoutes } from "./routes/songs";
import { createCreditRoutes } from "./routes/credits";
import { createPackRoutes } from "./routes/packs";
import { createAstutelyRoutes } from "./routes/astutely";
import { createCheckoutHandler } from "./api/create-checkout";
import { stripeWebhookHandler } from "./api/webhook";
import { checkLicenseHandler } from "./api/check-license";
import { musicGenService } from "./services/musicgen";
import { generateMelody, translateCode, getAIClient } from "./services/grok";
import { callAI } from "./services/aiGateway";
import { generateSongStructureWithAI } from "./services/ai-structure-grok";
import { generateMusicFromLyrics } from "./services/lyricsToMusic";
import { generateChatMusicianMelody } from "./services/chatMusician";
import { getCreditService, CREDIT_COSTS } from "./services/credits";
import { convertCodeToMusic, convertCodeToMusicEnhanced } from "./services/codeToMusic";
import { transcribeAudio } from "./services/transcriptionService";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sanitizePath, sanitizeObjectKey, sanitizeHtml, isValidUUID } from "./utils/security";
import { insertPlaylistSchema } from "@shared/schema";
import { z } from "zod";

// Standardized error response helper
const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, message });
};

export async function registerRoutes(app: Express, storage: IStorage) {
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

  // Mount Astutely AI routes
  app.use("/api", createAstutelyRoutes());

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
          model: 'gpt-4o-mini',
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
          model: 'grok-2-1212',
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
  app.post("/api/objects/upload", async (req, res) => {
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
  const LOCAL_ASSETS_DIR = path.resolve(process.cwd(), "server", "Assests");
  const LOOPS_DIR = path.resolve(LOCAL_ASSETS_DIR, "loops");

  // Loop Library endpoints - list and serve .wav files from Assests/loops
  app.get("/api/loops", async (_req: Request, res: Response) => {
    try {
      if (!fs.existsSync(LOOPS_DIR)) {
        return res.json({ loops: [] });
      }

      const files = await fs.promises.readdir(LOOPS_DIR);
      const wavFiles = files.filter((f) => f.toLowerCase().endsWith(".wav"));

      const loops = wavFiles.map((filename, index) => ({
        id: index.toString(),
        name: path.parse(filename).name,
        filename,
        audioUrl: `/api/loops/${encodeURIComponent(filename)}/audio`,
      }));

      res.json({ loops });
    } catch (error) {
      console.error("Failed to list loops from Assests/loops:", error);
      res.status(500).json({ success: false, message: "Failed to list loops" });
    }
  });

  app.get("/api/loops/:filename/audio", async (req: Request, res: Response) => {
    try {
      const raw = req.params.filename;
      if (!raw) {
        return sendError(res, 400, "Missing loop filename");
      }

      const safeName = sanitizePath(raw, LOOPS_DIR);
      if (!safeName) {
        return sendError(res, 400, "Invalid loop filename");
      }
      const filePath = safeName;

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
          version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
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
          version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
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
            model: "grok-beta",
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

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Code to Music endpoint
  // Code-to-Music endpoint - NEW ALGORITHM
  app.post("/api/code-to-music", async (req: Request, res: Response) => {
    try {
      const { code, language = 'javascript', variation = 0, genre = 'pop' } = req.body;

      if (!code) {
        return sendError(res, 400, "Code is required");
      }

      console.log(`🎵 Code-to-Music: Converting ${language} code (genre: ${genre}, variation: ${variation})`);

      // Use ENHANCED algorithm for richer, more musical output
      const result = await convertCodeToMusicEnhanced({
        code,
        language,
        variation,
        genre,
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
      const model = aiProvider === "openai" ? "gpt-4" : "grok-2-1212";

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
        model: aiProvider === 'grok' ? 'grok-beta' : 'gpt-4',
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

        const packs = await musicGenService.generateSamplePack(prompt, Math.max(1, Math.min(count || 4, 8)));

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
                model: "grok-beta",
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

  // Professional song generation endpoint (Suno via Replicate)
  app.post("/api/songs/generate-professional", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, mood, duration, style, vocals, bpm, key } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎵 Generating professional song with MusicGen via Replicate...');
      
      const { replicateMusic } = await import('./services/replicateMusicGenerator');
      
      const song = await replicateMusic.generateFullSong(prompt, {
        genre: genre || 'pop',
        mood: mood || 'uplifting',
        duration: duration || 30, // MusicGen max 30 seconds
        style: style || 'modern',
        vocals: vocals !== false,
        bpm: bpm || 120,
        key: key || 'C Major'
      });

      console.log('✅ Professional song generated');
      res.json({
        success: true,
        status: 'success',
        song: song
      });

    } catch (error) {
      console.error('❌ Song generation error:', error);
      sendError(res, 500, "Failed to generate professional song");
    }
  });

  // Generate beat and melody (MusicGen via Replicate)
  app.post("/api/songs/generate-beat", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, duration, style, energy } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎼 Generating beat and melody with MusicGen via Replicate...');
      
      const { replicateMusic } = await import('./services/replicateMusicGenerator');
      
      const result = await replicateMusic.generateBeatAndMelody(prompt, {
        genre: genre || 'pop',
        duration: duration || 30,
        style: style || 'modern',
        energy: energy || 'medium'
      });

      console.log('✅ Beat and melody generated');
      res.json({
        status: 'success',
        result: result
      });

    } catch (error) {
      console.error('❌ Beat generation error:', error);
      sendError(res, 500, "Failed to generate beat");
    }
  });

  // Generate instrumental (MusicGen via Replicate)
  app.post("/api/songs/generate-instrumental", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, duration, instruments, energy } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎹 Generating instrumental with MusicGen via Replicate...');
      
      const { replicateMusic } = await import('./services/replicateMusicGenerator');
      
      const result = await replicateMusic.generateInstrumental(prompt, {
        genre: genre || 'pop',
        duration: duration || 60,
        instruments: instruments || ['piano', 'guitar', 'bass', 'drums'],
        energy: energy || 'medium'
      });

      console.log('✅ Instrumental generated');
      res.json({
        status: 'success',
        result: result
      });

    } catch (error) {
      console.error('❌ Instrumental generation error:', error);
      sendError(res, 500, "Failed to generate instrumental");
    }
  });

  // Genre blending (MusicGen via Replicate)
  app.post("/api/songs/blend-genres", async (req: Request, res: Response) => {
    try {
      const { primaryGenre, secondaryGenres, prompt } = req.body;
      
      if (!primaryGenre || !secondaryGenres || !prompt) {
        return sendError(res, 400, "Missing required parameters");
      }

      console.log('🎭 Blending genres with MusicGen via Replicate...');
      
      const { replicateMusic } = await import('./services/replicateMusicGenerator');
      
      const result = await replicateMusic.blendGenres(primaryGenre, secondaryGenres, prompt);

      console.log('✅ Genres blended');
      res.json({
        status: 'success',
        result: result
      });

    } catch (error) {
      console.error('❌ Genre blending error:', error);
      sendError(res, 500, "Failed to blend genres");
    }
  });

  // Generate pattern-based music (for RealisticAudioEngine playback)
  app.post("/api/songs/generate-pattern", async (req: Request, res: Response) => {
    try {
      const { prompt, duration, bpm } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎼 Generating music pattern for realistic instruments...');
      
      const { patternGenerator } = await import('./services/patternGenerator');
      
      const pattern = patternGenerator.generatePattern(
        prompt,
        duration || 30,
        bpm
      );

      console.log('✅ Music pattern generated with', pattern.patterns.length, 'instruments');
      res.json({
        success: true,
        pattern: pattern
      });

    } catch (error) {
      console.error('❌ Pattern generation error:', error);
      sendError(res, 500, "Failed to generate music pattern");
    }
  });

  // Generate drum pattern (MusicGen via Replicate)
  app.post("/api/songs/generate-drums", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, bpm, duration } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🥁 Generating drum pattern with MusicGen via Replicate...');
      
      const { replicateMusic } = await import('./services/replicateMusicGenerator');
      
      const result = await replicateMusic.generateDrumPattern(prompt, {
        genre: genre || 'pop',
        bpm: bpm || 120,
        duration: duration || 30
      });

      console.log('✅ Drum pattern generated');
      res.json({
        status: 'success',
        result: result
      });

    } catch (error) {
      console.error('❌ Drum generation error:', error);
      sendError(res, 500, "Failed to generate drums");
    }
  });

  // Generate melody (MusicGen via Replicate)
  app.post("/api/songs/generate-melody", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, key, duration, instrument } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎵 Generating melody with MusicGen via Replicate...');
      
      const { replicateMusic } = await import('./services/replicateMusicGenerator');
      
      const result = await replicateMusic.generateMelody(prompt, {
        genre: genre || 'pop',
        key: key || 'C Major',
        duration: duration || 30,
        instrument: instrument || 'piano'
      });

      console.log('✅ Melody generated');
      res.json({
        status: 'success',
        result: result
      });

    } catch (error) {
      console.error('❌ Melody generation error:', error);
      sendError(res, 500, "Failed to generate melody");
    }
  });

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

  app.post(
    "/api/lyrics/generate-music",
    requireAuth(),
    requireCredits(CREDIT_COSTS.INSTRUMENTAL_GENERATION, storage),
    async (req: Request, res: Response) => {
      try {
        const { lyrics, style, genre } = req.body;

        if (!lyrics) {
          return sendError(res, 400, "Lyrics are required");
        }

        const generatedMusic = await generateMusicFromLyrics(lyrics, style || 'pop', genre || 'electronic');

        // Deduct credits after successful generation
        if (req.creditService && req.creditCost) {
          await req.creditService.deductCredits(
            req.userId!,
            req.creditCost,
            'Music generation from lyrics',
            { style, genre }
          );
        }

        res.json(generatedMusic);
      } catch (err: any) {
        console.error("Lyrics to music error:", err);
        sendError(res, 500, err?.message || "Failed to generate music");
      }
    }
  );

  // Generate music with MusicGen via Replicate
  app.post(
    "/api/music/generate-with-musicgen",
    requireAuth(),
    requireCredits(CREDIT_COSTS.BEAT_GENERATION, storage),
    async (req: Request, res: Response) => {
      try {
        const { prompt, duration } = req.body;

        if (!prompt) {
          return res.status(400).json({ message: "Prompt is required" });
        }

        // Call Replicate API for MusicGen
        const response = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
          },
          body: JSON.stringify({
            version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb", // MusicGen stereo-melody-large
            input: {
              prompt: prompt,
              duration: duration || 10,
            },
          }),
        });

        const prediction = await response.json();

        // Log the response for debugging
        console.log('[MusicGen] Replicate API response:', JSON.stringify(prediction, null, 2));

        // Check if Replicate returned an error
        if (prediction.error || prediction.detail) {
          console.error('[MusicGen] Replicate API error:', prediction.error || prediction.detail);
          return res.status(500).json({ 
            message: `Replicate API error: ${prediction.error || prediction.detail}`,
            details: prediction
          });
        }

        // SECURITY: Validate prediction ID format to prevent SSRF
        if (!prediction.id || typeof prediction.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(prediction.id)) {
          console.error('[MusicGen] Invalid prediction response:', prediction);
          return res.status(500).json({ 
            message: "Invalid prediction ID received from API",
            details: prediction
          });
        }

        // Poll for result
        let result;
        const REPLICATE_API_BASE = 'https://api.replicate.com';
        do {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const statusResponse = await fetch(`${REPLICATE_API_BASE}/v1/predictions/${prediction.id}`, {
            headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` },
          });
          result = await statusResponse.json();
        } while (result.status === "starting" || result.status === "processing");

        if (result.status === "succeeded") {
          // Deduct credits after successful generation
          if (req.creditService && req.creditCost) {
            await req.creditService.deductCredits(
              req.userId!,
              req.creditCost,
              'MusicGen beat generation',
              { prompt: prompt.substring(0, 100), duration }
            );
          }
          
          res.json({ audioUrl: result.output });
        } else {
          return res.status(500).json({ message: "Music generation failed" });
        }
      } catch (err: any) {
        console.error("MusicGen error:", err);
        res.status(500).json({ message: err?.message || "Failed to generate music" });
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
  // MISSING ROUTES - Added to fix frontend calls
  // ============================================

  // Generate full song (alias for /api/songs/generate-professional)
  app.post("/api/audio/generate-song", async (req: Request, res: Response) => {
    try {
      const { prompt, lyrics, options = {} } = req.body;
      
      if (!prompt && !lyrics) {
        return sendError(res, 400, "Prompt or lyrics required");
      }

      console.log('🎵 Generating full song via /api/audio/generate-song...');
      
      const { replicateMusic } = await import('./services/replicateMusicGenerator');
      
      const result = await replicateMusic.generateFullSong(
        prompt || `Song with lyrics: ${lyrics?.substring(0, 100)}...`,
        {
          genre: options.genre || 'pop',
          mood: options.mood || 'uplifting',
          duration: options.duration || 120,
          vocals: options.vocals !== false
        }
      );

      console.log('✅ Full song generated');
      res.json({
        status: 'success',
        audioUrl: result.audioUrl,
        result: result
      });

    } catch (error: any) {
      console.error('❌ Song generation error:', error);
      sendError(res, 500, error?.message || "Failed to generate song");
    }
  });

  // Generate lyrics (alias for /api/lyrics/generate)
  app.post("/api/audio/generate-lyrics", async (req: Request, res: Response) => {
    try {
      const { theme, genre, mood, style } = req.body;
      
      if (!theme) {
        return sendError(res, 400, "Theme is required");
      }

      console.log('✍️ Generating lyrics via /api/audio/generate-lyrics...');
      
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) {
        return sendError(res, 500, "REPLICATE_API_TOKEN not configured");
      }

      const prompt = `Write song lyrics about "${theme}".
Genre: ${genre || 'pop'}
Mood: ${mood || 'uplifting'}
Style: ${style || 'modern'}

Create complete lyrics with verses, chorus, and bridge.`;

      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${token}`,
        },
        body: JSON.stringify({
          version: "2d19859030ff705a87c746f7e96eea03aefb71f166725aee39692f1476566d48",
          input: { prompt, max_tokens: 800, temperature: 0.8 },
        }),
      });

      const prediction = await response.json();
      
      // Poll for result
      let result;
      let attempts = 0;
      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { "Authorization": `Token ${token}` },
        });
        result = await statusResponse.json();
        attempts++;
      } while ((result.status === "starting" || result.status === "processing") && attempts < 60);

      if (result.status === "succeeded" && result.output) {
        const lyrics = Array.isArray(result.output) ? result.output.join('') : result.output;
        res.json({ content: lyrics, lyrics });
      } else {
        throw new Error('Lyrics generation failed');
      }

    } catch (error: any) {
      console.error('❌ Lyrics generation error:', error);
      sendError(res, 500, error?.message || "Failed to generate lyrics");
    }
  });

  // Generate beat from lyrics
  app.post("/api/audio/generate-beat-from-lyrics", async (req: Request, res: Response) => {
    try {
      const { lyrics, genre, complexity, bpm } = req.body;
      
      if (!lyrics) {
        return sendError(res, 400, "Lyrics are required");
      }

      console.log('🥁 Generating beat from lyrics...');
      
      const { replicateMusic } = await import('./services/replicateMusicGenerator');
      
      // Analyze lyrics to determine beat style
      const prompt = `${genre || 'hip-hop'} beat for lyrics: "${lyrics.substring(0, 200)}..."`;
      
      const result = await replicateMusic.generateBeatAndMelody(prompt, {
        genre: genre || 'hip-hop',
        duration: 30,
        style: complexity === 'high' ? 'complex' : 'simple'
      });

      console.log('✅ Beat generated from lyrics');
      res.json({
        status: 'success',
        audioUrl: result.audioUrl,
        result: result
      });

    } catch (error: any) {
      console.error('❌ Beat from lyrics error:', error);
      sendError(res, 500, error?.message || "Failed to generate beat from lyrics");
    }
  });

  // Generate dynamic layers
  app.post("/api/layers/generate", async (req: Request, res: Response) => {
    try {
      const { baseTrack, style, complexity, instruments } = req.body;
      
      console.log('🎚️ Generating dynamic layers...');
      
      const { patternGenerator } = await import('./services/patternGenerator');
      
      // Generate layered patterns
      const layers = [];
      const instrumentList = instruments || ['piano', 'strings', 'bass', 'drums'];
      
      for (const instrument of instrumentList) {
        const pattern = patternGenerator.generatePattern(
          `${style || 'ambient'} ${instrument} layer`,
          30,
          baseTrack?.bpm || 120
        );
        layers.push({
          instrument,
          pattern: pattern.patterns[0] || pattern,
          volume: 0.7,
          pan: Math.random() * 0.4 - 0.2 // Slight stereo spread
        });
      }

      console.log('✅ Generated', layers.length, 'layers');
      res.json({
        status: 'success',
        layers: layers,
        style: style,
        complexity: complexity
      });

    } catch (error: any) {
      console.error('❌ Layer generation error:', error);
      sendError(res, 500, error?.message || "Failed to generate layers");
    }
  });

  // Generate bass line
  app.post("/api/music/generate-bass", async (req: Request, res: Response) => {
    try {
      const { 
        chordProgression, 
        style = 'fingerstyle', 
        pattern = 'root-fifth',
        octave = 2,
        groove = 0.5,
        noteLength = 0.75,
        velocity = 0.7,
        glide = 0
      } = req.body;
      
      console.log('🎸 Generating bass line with params:', { style, pattern, octave, groove, noteLength, velocity, glide });
      
      const { generateBassLine } = await import('./services/bassGenerator');
      
      // Convert chord array to ChordInfo format - handle both string arrays and object arrays
      let chords: Array<{ chord: string; duration: number }>;
      if (Array.isArray(chordProgression) && chordProgression.length > 0) {
        if (typeof chordProgression[0] === 'string') {
          chords = chordProgression.map((chord: string) => ({
            chord,
            duration: 4 // 4 beats per chord
          }));
        } else {
          // Already in object format
          chords = chordProgression.map((c: any) => ({
            chord: c.chord || c.name || 'C',
            duration: c.duration || 4
          }));
        }
      } else {
        // Default progression if none provided
        chords = ['C', 'G', 'Am', 'F'].map(chord => ({ chord, duration: 4 }));
      }
      
      const bassNotes = generateBassLine(
        chords,
        style,
        pattern,
        octave,
        groove,
        noteLength,
        velocity,
        glide
      );

      console.log('✅ Bass line generated');
      res.json({
        status: 'success',
        notes: bassNotes,
        pattern: 'root-fifth',
        style: style || 'fingerstyle'
      });

    } catch (error: any) {
      console.error('❌ Bass generation error:', error);
      sendError(res, 500, error?.message || "Failed to generate bass line");
    }
  });

  // Phase 3: AI Bassline endpoint for BeatMaker (real AI via callAI)
  app.post("/api/ai/music/bass", async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      const { key, bpm, bars, songPlanId, sectionId } = req.body || {};

      const safeKey = typeof key === "string" && key.trim().length > 0 ? key.trim() : "C minor";
      const safeBpm = Math.max(40, Math.min(240, Number(bpm) || 120));
      const safeBars = Math.max(1, Math.min(16, Number(bars) || 4));

      console.log(
        `🎸 [Phase 3] Generating AI bassline via callAI: key=${safeKey}, bpm=${safeBpm}, bars=${safeBars}`,
      );

      type AIBassTrack = {
        notes: Array<{
          pitch: string;
          start: number;
          duration: number;
          velocity?: number;
        }>;
      };

      // Fallback bass generator when AI fails
      const generateFallbackBass = (keyStr: string, numBars: number): AIBassTrack => {
        const bassNotes: Record<string, string[]> = {
          'C major': ['C2', 'E2', 'G2', 'C3'],
          'C minor': ['C2', 'Eb2', 'G2', 'C3'],
          'G major': ['G1', 'B1', 'D2', 'G2'],
          'A minor': ['A1', 'C2', 'E2', 'A2'],
          'D minor': ['D2', 'F2', 'A2', 'D3'],
          'F major': ['F1', 'A1', 'C2', 'F2'],
        };
        
        const scale = bassNotes[keyStr] || bassNotes['C minor'];
        const notes: AIBassTrack['notes'] = [];
        const beatsPerBar = 4;
        const totalBeats = numBars * beatsPerBar;
        
        let currentBeat = 0;
        while (currentBeat < totalBeats) {
          // Bass typically plays on beats 1 and 3, with occasional fills
          const beatInBar = currentBeat % 4;
          const noteIndex = beatInBar === 0 ? 0 : (beatInBar === 2 ? 2 : Math.floor(Math.random() * scale.length));
          const duration = beatInBar === 0 || beatInBar === 2 ? 1.5 : 0.5;
          
          notes.push({
            pitch: scale[noteIndex],
            start: currentBeat,
            duration: Math.min(duration, totalBeats - currentBeat),
            velocity: beatInBar === 0 ? 0.9 : 0.7,
          });
          
          currentBeat += duration;
        }
        
        return { notes };
      };

      let notes: AIBassTrack['notes'] = [];
      let provider = "Grok/OpenAI via callAI";

      try {
        const aiResult = await callAI<AIBassTrack>({
          system:
            "You are a professional bass player and MIDI arranger. " +
            "You must return a JSON object with a 'notes' array for a bassline track.",
          user:
            `Create a groove-focused bassline in ${safeKey} at ${safeBpm} BPM for ${safeBars} bars. ` +
            "Return an array 'notes', where each note has { pitch: string (e.g. 'C2'), start: number (beats from 0), duration: number (beats), velocity: 0-1 }. " +
            "Emphasize root and fifth with tasteful passing tones. Do not include any extra top-level keys beyond 'notes'.",
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
        console.warn(`⚠️ AI bassline generation failed, using fallback: ${aiError?.message}`);
        const fallback = generateFallbackBass(safeKey, safeBars);
        notes = fallback.notes;
        provider = "Algorithmic Fallback";
      }

      // If AI returned empty, use fallback
      if (!notes.length) {
        console.warn("⚠️ AI returned empty bassline, using fallback");
        const fallback = generateFallbackBass(safeKey, safeBars);
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
          songPlanId: songPlanId || null,
          sectionId: sectionId || "bass-section",
        },
      });
    } catch (error: any) {
      console.error("❌ Phase 3 AI bassline error:", error);
      sendError(res, 500, error?.message || "Failed to generate AI bassline");
    }
  });

  // Phase 3: AI Drum Grid endpoint for BeatMaker / ProBeatMaker (real AI via callAI)
  app.post("/api/ai/music/drums", async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      const { bpm, bars, style, songPlanId, sectionId, gridResolution } = req.body || {};

      const safeBpm = Math.max(40, Math.min(240, Number(bpm) || 120));
      const safeBars = Math.max(1, Math.min(16, Number(bars) || 4));
      const safeStyle = typeof style === "string" && style.length > 0 ? style : "hip-hop";
      const stepsPerBar = 16; // match BeatMaker gridResolution 1/16
      const totalSteps = safeBars * stepsPerBar;

      console.log(
        `🥁 [Phase 3] Generating AI drum grid via callAI: style=${safeStyle}, bpm=${safeBpm}, bars=${safeBars}, steps=${totalSteps}`,
      );

      type DrumGrid = {
        kick?: Array<number | boolean>;
        snare?: Array<number | boolean>;
        hihat?: Array<number | boolean>;
        percussion?: Array<number | boolean>;
      };

      // Helper to generate fallback pattern when AI fails
      const generateFallbackDrumPattern = (steps: number, styleHint: string): DrumGrid => {
        const kick: number[] = [];
        const snare: number[] = [];
        const hihat: number[] = [];
        const percussion: number[] = [];

        // Style-based pattern generation
        const isHipHop = styleHint.toLowerCase().includes('hip') || styleHint.toLowerCase().includes('trap');
        const isRock = styleHint.toLowerCase().includes('rock');
        const isElectronic = styleHint.toLowerCase().includes('electro') || styleHint.toLowerCase().includes('house') || styleHint.toLowerCase().includes('techno');

        for (let i = 0; i < steps; i++) {
          const stepInBar = i % 16;
          
          // Kick pattern - varies by style
          if (isHipHop) {
            kick.push((stepInBar === 0 || stepInBar === 6 || stepInBar === 10) ? 1 : (Math.random() < 0.1 ? 1 : 0));
          } else if (isElectronic) {
            kick.push((stepInBar % 4 === 0) ? 1 : 0);
          } else {
            kick.push((stepInBar === 0 || stepInBar === 8) ? 1 : (Math.random() < 0.15 ? 1 : 0));
          }

          // Snare pattern
          if (isHipHop) {
            snare.push((stepInBar === 4 || stepInBar === 12) ? 1 : (Math.random() < 0.08 ? 1 : 0));
          } else {
            snare.push((stepInBar === 4 || stepInBar === 12) ? 1 : 0);
          }

          // Hi-hat pattern
          if (isElectronic) {
            hihat.push((stepInBar % 2 === 0) ? 1 : (Math.random() < 0.3 ? 1 : 0));
          } else {
            hihat.push((stepInBar % 2 === 0) ? 1 : (Math.random() < 0.4 ? 1 : 0));
          }

          // Percussion/extras
          percussion.push(Math.random() < 0.12 ? 1 : 0);
        }

        return { kick, snare, hihat, percussion };
      };

      const normalizeRow = (row: Array<number | boolean> | undefined): number[] => {
        if (!row || !Array.isArray(row) || row.length === 0) {
          return Array(totalSteps).fill(0);
        }
        return row.slice(0, totalSteps).map((v) => (v ? 1 : 0));
      };

      let rawPattern: DrumGrid | undefined;
      let provider = "Grok/OpenAI via callAI";

      try {
        const aiResult = await callAI<{ pattern?: DrumGrid}>({
          system:
            "You generate drum patterns for a step sequencer. " +
            "Always return a JSON object with a 'pattern' property describing drum grids.",
          user:
            `Create a modern ${safeStyle} drum pattern at ${safeBpm} BPM for a ${safeBars}-bar loop on a 16-step-per-bar grid. ` +
            `Return JSON with 'pattern' = { kick: number[${totalSteps}], snare: number[${totalSteps}], hihat: number[${totalSteps}], percussion: number[${totalSteps}] }. ` +
            "Each array element must be 0 or 1. Do not include any extra properties.",
          responseFormat: "json",
          jsonSchema: {
            type: "object",
            properties: {
              pattern: {
                type: "object",
                properties: {
                  kick: {
                    type: "array",
                    items: { type: "number" },
                    minItems: totalSteps,
                    maxItems: totalSteps,
                  },
                  snare: {
                    type: "array",
                    items: { type: "number" },
                    minItems: totalSteps,
                    maxItems: totalSteps,
                  },
                  hihat: {
                    type: "array",
                    items: { type: "number" },
                    minItems: totalSteps,
                    maxItems: totalSteps,
                  },
                  percussion: {
                    type: "array",
                    items: { type: "number" },
                    minItems: totalSteps,
                    maxItems: totalSteps,
                  },
                },
                required: ["kick", "snare", "hihat", "percussion"],
              },
            },
            required: ["pattern"],
          },
          temperature: 0.7,
          maxTokens: 800,
        });

        rawPattern = (aiResult as any)?.content?.pattern as DrumGrid | undefined;
      } catch (aiError: any) {
        console.warn(`⚠️ AI drum generation failed, using fallback pattern: ${aiError?.message}`);
        rawPattern = generateFallbackDrumPattern(totalSteps, safeStyle);
        provider = "Algorithmic Fallback";
      }

      // If AI returned nothing, use fallback
      if (!rawPattern || (!rawPattern.kick && !rawPattern.snare && !rawPattern.hihat)) {
        console.warn("⚠️ AI returned empty pattern, using fallback");
        rawPattern = generateFallbackDrumPattern(totalSteps, safeStyle);
        provider = "Algorithmic Fallback";
      }

      const grid = {
        kick: normalizeRow(rawPattern.kick),
        snare: normalizeRow(rawPattern.snare),
        hihat: normalizeRow(rawPattern.hihat),
        percussion: normalizeRow(rawPattern.percussion),
      };

      return res.json({
        success: true,
        data: {
          grid,
          bpm: safeBpm,
          bars: safeBars,
          style: safeStyle,
          resolution: gridResolution || "1/16",
          provider,
          songPlanId: songPlanId || null,
          sectionId: sectionId || "beat-section",
        },
      });
    } catch (error: any) {
      console.error("❌ Phase 3 AI drum grid error:", error);
      sendError(res, 500, error?.message || "Failed to generate AI drum grid");
    }
  });

  return createServer(app);
}
