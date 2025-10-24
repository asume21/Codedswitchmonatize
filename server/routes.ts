import type { Express, Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import type { IStorage } from "./storage";
import { requireAuth, requireSubscription } from "./middleware/auth";
import { createAuthRoutes } from "./routes/auth";
import { createKeyRoutes } from "./routes/keys";
import {
  createCheckoutSession,
  handleStripeWebhook,
} from "./services/stripe";
import { musicGenService } from "./services/musicgen";
import { generateMelody, translateCode, getAIClient } from "./services/grok";
import { generateSongStructureWithAI } from "./services/ai-structure-grok";
import { generateMusicFromLyrics } from "./services/lyricsToMusic";
import { generateChatMusicianMelody } from "./services/chatMusician";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { insertPlaylistSchema } from "@shared/schema";
import { z } from "zod";

// Standardized error response helper
const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, message });
};

// SECURITY: Cryptographically secure random number generator
// Returns a random float between 0 and 1 using crypto.randomBytes
function secureRandom(): number {
  const buffer = crypto.randomBytes(4);
  const randomValue = buffer.readUInt32BE(0);
  return randomValue / 0xFFFFFFFF;
}

// Intelligent pack generation function that creates themed packs based on prompts
function generateIntelligentPacks(prompt: string, count: number) {
  const promptLower = prompt.toLowerCase();
  
  // Analyze prompt for musical characteristics
  const genreMap = {
    'hip hop': { genre: 'Hip Hop', bpmRange: [70, 90], keys: ['C', 'F', 'G', 'Bb'] },
    'trap': { genre: 'Trap', bpmRange: [140, 170], keys: ['C', 'F#', 'A', 'D'] },
    'house': { genre: 'House', bpmRange: [120, 130], keys: ['Am', 'Dm', 'Em', 'Gm'] },
    'techno': { genre: 'Techno', bpmRange: [120, 140], keys: ['Am', 'Fm', 'Cm', 'Gm'] },
    'lo-fi': { genre: 'Lo-Fi', bpmRange: [70, 90], keys: ['C', 'Am', 'F', 'G'] },
    'jazz': { genre: 'Jazz', bpmRange: [80, 120], keys: ['Dm7', 'G7', 'Cmaj7', 'Am7'] },
    'electronic': { genre: 'Electronic', bpmRange: [100, 140], keys: ['C', 'D', 'F', 'G'] },
    'ambient': { genre: 'Ambient', bpmRange: [60, 90], keys: ['C', 'Am', 'Em', 'Dm'] },
    'rock': { genre: 'Rock', bpmRange: [100, 140], keys: ['E', 'A', 'D', 'G'] },
    'pop': { genre: 'Pop', bpmRange: [100, 130], keys: ['C', 'G', 'Am', 'F'] }
  };

  // Detect genre from prompt
  let selectedGenre = { genre: 'Electronic', bpmRange: [100, 130], keys: ['C', 'G', 'Am', 'F'] };
  for (const [key, value] of Object.entries(genreMap)) {
    if (promptLower.includes(key)) {
      selectedGenre = value;
      break;
    }
  }

  // Detect mood and energy
  const moodMap = {
    'dark': { energy: 70, mood: 'Dark', instruments: ['Bass', 'Synth Pad', 'Deep Drums'] },
    'chill': { energy: 30, mood: 'Chill', instruments: ['Piano', 'Soft Synth', 'Light Drums'] },
    'energetic': { energy: 90, mood: 'Energetic', instruments: ['Lead Synth', 'Heavy Drums', 'Bass'] },
    'dreamy': { energy: 40, mood: 'Dreamy', instruments: ['Pad', 'Reverb Guitar', 'Soft Drums'] },
    'intense': { energy: 95, mood: 'Intense', instruments: ['Heavy Bass', 'Percussion', 'Distorted Synth'] },
    'warm': { energy: 50, mood: 'Warm', instruments: ['Rhodes', 'Vinyl', 'Jazz Drums'] },
    'cinematic': { energy: 80, mood: 'Cinematic', instruments: ['Strings', 'Brass', 'Orchestra Drums'] }
  };

  let selectedMood = { energy: 60, mood: 'Balanced', instruments: ['Synth', 'Drums', 'Bass'] };
  for (const [key, value] of Object.entries(moodMap)) {
    if (promptLower.includes(key)) {
      selectedMood = value;
      break;
    }
  }

  return Array.from({ length: count }, (_, i) => {
    const bpm = selectedGenre.bpmRange[0] + Math.floor(secureRandom() * (selectedGenre.bpmRange[1] - selectedGenre.bpmRange[0]));
    const key = selectedGenre.keys[i % selectedGenre.keys.length];
    
    return {
      id: `pack-${Date.now()}-${i}`,
      title: generatePackTitle(prompt, selectedGenre.genre, i + 1),
      description: generatePackDescription(prompt, selectedGenre.genre, selectedMood.mood),
      bpm,
      key,
      genre: selectedGenre.genre,
      samples: generateSamples(selectedGenre.genre, selectedMood.instruments, i),
      metadata: {
        energy: Math.max(10, Math.min(100, selectedMood.energy + (secureRandom() * 20 - 10))),
        mood: selectedMood.mood,
        instruments: selectedMood.instruments,
        tags: generateTags(prompt, selectedGenre.genre, selectedMood.mood)
      }
    };
  });
}

function generatePackTitle(prompt: string, genre: string, packNumber: number) {
  const keywords = prompt.split(' ').slice(0, 3);
  const titleTemplates = [
    `${keywords.join(' ')} Pack ${packNumber}`,
    `${genre} ${keywords[0]} Collection`,
    `${keywords[0]} ${keywords[1]} Suite`,
    `Premium ${keywords[0]} Kit ${packNumber}`,
    `${genre} ${keywords[0]} Bundle`
  ];
  return titleTemplates[packNumber % titleTemplates.length];
}

function generatePackDescription(prompt: string, genre: string, mood: string) {
  return `Professional ${genre.toLowerCase()} sample pack with ${mood.toLowerCase()} vibes, inspired by: ${prompt}. Perfect for modern music production.`;
}

function generateSamples(genre: string, instruments: string[], packIndex: number) {
  const sampleTypes = ['loop', 'oneshot', 'midi'];
  const sampleNames: Record<string, string[]> = {
    'Hip Hop': ['Kick', 'Snare', 'Hi-Hat', 'Melody Loop', 'Bass Loop', 'Vocal Chop', 'Transition', 'Percussion'],
    'Trap': ['808 Hit', 'Snare Roll', 'Hi-Hat Roll', 'Melody', 'Vocal Sample', 'Riser', 'Impact', 'Perc Loop'],
    'House': ['Kick Loop', 'Bassline', 'Lead Synth', 'Vocal Hook', 'Percussion', 'FX Sweep', 'Chord Stab', 'Build Up'],
    'Electronic': ['Synth Lead', 'Bass Hit', 'Drum Loop', 'Arp Sequence', 'Vocal Texture', 'Riser', 'Impact', 'Breakdown'],
    'Lo-Fi': ['Vinyl Kick', 'Warm Bass', 'Jazz Chord', 'Tape Hiss', 'Vinyl Crackle', 'Melody', 'Soft Perc', 'Atmosphere']
  };
  
  const names = sampleNames[genre] || sampleNames['Electronic'];
  
  return Array.from({ length: 8 + packIndex }, (_, i) => ({
    id: `sample-${packIndex}-${i}`,
    name: names[i % names.length] + ` ${Math.floor(i / names.length) + 1}`,
    type: sampleTypes[i % sampleTypes.length],
    duration: 1.5 + (secureRandom() * 3)
  }));
}

function generateTags(prompt: string, genre: string, mood: string) {
  const baseTagsMap: Record<string, string[]> = {
    'Hip Hop': ['Boom Bap', 'Trap', 'Old School', 'Modern'],
    'Electronic': ['EDM', 'Synth', 'Digital', 'Modern'],
    'Lo-Fi': ['Chill', 'Vintage', 'Vinyl', 'Relaxed'],
    'House': ['Dance', 'Club', 'Groove', 'Electronic'],
    'Jazz': ['Smooth', 'Classic', 'Improvised', 'Sophisticated']
  };
  
  const baseTags = baseTagsMap[genre] || ['Creative', 'Original', 'Professional'];
  const promptWords = prompt.split(' ').slice(0, 2).map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  );
  
  return [...baseTags, mood, ...promptWords, 'High Quality'].slice(0, 6);
}

export async function registerRoutes(app: Express, storage: IStorage) {
  // Mount auth routes
  app.use("/api/auth", createAuthRoutes(storage));
  
  // Mount key activation routes
  app.use("/api/keys", createKeyRoutes(storage));

  // Upload parameter generation endpoint
  app.post("/api/objects/upload", async (req, res) => {
    try {
      console.log('🎵 Upload parameters requested');

      // Generate a unique object key for the upload using crypto for security
      const objectKey = `songs/${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      // For local storage (when GCS is not configured), return local upload URL
      const uploadURL = `${req.protocol}://${req.get('host')}/api/internal/uploads/${encodeURIComponent(objectKey)}`;

      console.log('🎵 Generated upload URL:', uploadURL);

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
  const LOCAL_OBJECTS_DIR = path.resolve(process.cwd(), "objects");
  try {
    fs.mkdirSync(LOCAL_OBJECTS_DIR, { recursive: true });
  } catch {}

  // Validation schemas
  const updatePlaylistSchema = insertPlaylistSchema.partial();
  const addSongSchema = z.object({ songId: z.string() });
  const waitlistSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
  });

  // Beat generation endpoint
  app.post("/api/beats/generate", requireAuth(), async (req: Request, res: Response) => {
    try {
      const beatSchema = z.object({
        genre: z.string().min(1),
        bpm: z.number().min(40).max(240),
        duration: z.number().min(1).max(60),
      });

      const parsed = beatSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Invalid input: " + parsed.error.message);
      }

      const { genre, bpm, duration } = parsed.data;

      // Generate a simple beat pattern based on genre and BPM
      const beatPattern = {
        kick: generatePattern("kick", genre, bpm),
        snare: generatePattern("snare", genre, bpm),
        hihat: generatePattern("hihat", genre, bpm),
        percussion: generatePattern("percussion", genre, bpm)
      };

      // Return the beat pattern without audio for now
      res.json({
        success: true,
        beat: {
          id: `beat-${Date.now()}`,
          pattern: beatPattern,
          bpm: Number(bpm),
          genre: String(genre),
          duration: Number(duration),
          audioUrl: null, // Audio generation will be added in a future update
          timestamp: new Date().toISOString()
        }
      });
    }     catch (error: any) {
      console.error("Beat generation error:", error);
      sendError(res, 500, error.message || "Failed to generate beat pattern");
    }
  });

  // Helper function to generate drum patterns
  function generatePattern(instrument: string, genre: string, bpm: number) {
    // Simple pattern generation based on genre and BPM
    const patterns: Record<string, Record<string, number[]>> = {
      "hip-hop": {
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1],
        percussion: [0, 0, 0, 0, 0, 0, 0, 0]
      },
      "house": {
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [0, 1, 0, 1, 0, 1, 0, 1],
        percussion: [0, 0, 0, 0, 0, 0, 0, 0]
      },
      "trap": {
        kick: [1, 0, 0, 1, 0, 1, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1],
        percussion: [0, 0, 1, 0, 0, 1, 0, 0]
      },
      "dnb": {
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1],
        percussion: [0, 1, 0, 1, 0, 1, 0, 1]
      },
      "techno": {
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [0, 1, 0, 1, 0, 1, 0, 1],
        percussion: [0, 0, 0, 0, 0, 0, 0, 0]
      },
      "ambient": {
        kick: [1, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [0, 0, 1, 0, 0, 0, 1, 0],
        percussion: [0, 0, 0, 0, 0, 0, 0, 0]
      }
    };

    // Default to house pattern if genre not found
    const genrePatterns = patterns[genre.toLowerCase()] || patterns["house"];
    return genrePatterns[instrument] || [];
  }

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Code to Music endpoint
  app.post("/api/code-to-music", async (req: Request, res: Response) => {
    try {
      const { code, language, complexity = 5 } = req.body;

      if (!code) {
        return sendError(res, 400, "Code is required");
      }

      console.log(`🎵 Converting ${language} code to music (complexity: ${complexity})`);

      // Analyze code to generate music
      const codeLines = code.split('\n').filter((line: string) => line.trim());
      const codeLength = code.length;
      const lineCount = codeLines.length;

      // Generate melody based on code characteristics
      const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
      const melody = [];

      for (let i = 0; i < Math.min(lineCount, 16); i++) {
        const line = codeLines[i];
        const noteIndex = (line.length * i) % notes.length;
        
        melody.push({
          note: notes[noteIndex],
          duration: 0.25,
          time: i * 0.25,
          velocity: Math.min(1, line.length / 50)
        });
      }

      // Generate rhythm pattern based on code structure
      const pattern = {
        kick: Array(16).fill(false).map((_, i) => i % 4 === 0),
        snare: Array(16).fill(false).map((_, i) => i % 4 === 2),
        hihat: Array(16).fill(false).map((_, i) => i % 2 === 1),
        bass: Array(16).fill(false).map((_, i) => i % 3 === 0),
      };

      res.json({
        melody,
        pattern,
        bpm: 120,
        key: 'C Major',
        metadata: {
          codeLength,
          lineCount,
          language,
          complexity
        }
      });

    } catch (error: any) {
      console.error("Code to music error:", error);
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
      // If no userId, return free tier status
      if (!req.userId) {
        return res.json({
          hasActiveSubscription: false,
          tier: 'free',
          monthlyUploads: 0,
          monthlyGenerations: 0,
          lastUsageReset: null,
        });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        // User ID in session but user doesn't exist - return free tier
        return res.json({
          hasActiveSubscription: false,
          tier: 'free',
          monthlyUploads: 0,
          monthlyGenerations: 0,
          lastUsageReset: null,
        });
      }
      
      const subscriptionStatus = {
        hasActiveSubscription: user.subscriptionTier === 'pro' || user.subscriptionStatus === 'active',
        tier: user.subscriptionTier || 'free',
        monthlyUploads: user.monthlyUploads || 0,
        monthlyGenerations: user.monthlyGenerations || 0,
        lastUsageReset: user.lastUsageReset,
      };
      
      res.json(subscriptionStatus);
    } catch (err: any) {
      sendError(res, 500, err?.message || "Failed to fetch subscription status");
    }
  });

  // Create Checkout Session
  app.post(
    "/api/create-checkout-session",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { url } = await createCheckoutSession(storage, req.userId!);
        res.json({ url });
      } catch (err: any) {
                sendError(res, 400, err.message || "Failed to create session");
      }
    },
  );

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
  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    try {
      const signature = req.headers["stripe-signature"];
      const payload = req.body as Buffer; // raw body
      const result = await handleStripeWebhook(storage, payload, signature);
      res.json(result);
    } catch (err: any) {
            sendError(res, 400, `Webhook Error: ${err.message}`);
    }
  });

  // Music generation endpoint (temporarily free)
  app.post(
    "/api/generate-music",
    requireAuth(),
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

        if (!scale || !style) {
                    return sendError(res, 400, "Scale and style are required");
        }

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
        const objectKey = decodeURIComponent(objectKeyEncoded || "");
        const sanitizedObjectKey = path.normalize(objectKey).replace(/^(\.\.[\\/])+/,'');
        if (!sanitizedObjectKey || sanitizedObjectKey.includes("..")) {
                    return sendError(res, 400, "Invalid object key");
        }
        const fullPath = path.join(LOCAL_OBJECTS_DIR, sanitizedObjectKey);
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, req.body as Buffer);
                return res.json({ ok: true, path: `/objects/${sanitizedObjectKey}` });
      } catch (err: any) {
                sendError(res, 500, err?.message || "Upload failed");
      }
    },
  );

  // Serve locally stored objects (audio)
  app.get("/objects/*", async (req: Request, res: Response) => {
    try {
      const objectKey = (req.params as any)[0] as string;
      const sanitizedObjectKey = path.normalize(objectKey).replace(/^(\.\.[\\/])+/,'');
      if (!sanitizedObjectKey || sanitizedObjectKey.includes("..")) {
        return res.status(400).send("Invalid path");
      }
      const fullPath = path.resolve(path.join(LOCAL_OBJECTS_DIR, sanitizedObjectKey));
      
      // SECURITY: Ensure the resolved path is still within LOCAL_OBJECTS_DIR
      if (!fullPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
        return res.status(403).send("Access denied");
      }
      
      if (!fs.existsSync(fullPath)) return res.status(404).send("Not found");
      const ext = path.extname(fullPath).toLowerCase();
      const type = ext === ".wav" ? "audio/wav" : "application/octet-stream";
      res.setHeader("Content-Type", type);
      fs.createReadStream(fullPath).pipe(res);
    } catch (err: any) {
      res.status(500).send("Server error");
    }
  });

  // Complete professional song generation (temporarily free)
  app.post(
    "/api/music/generate-complete",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({
          songDescription: z.string().min(1, "songDescription is required"),
          genre: z.string().optional(),
          mood: z.string().optional(),
          aiProvider: z.string().optional(),
          duration: z.number().optional(), // seconds
          bpm: z.number().optional(),
          key: z.string().optional(),
          style: z.string().optional(),
          includeVocals: z.boolean().optional(),
          instruments: z.array(z.string()).optional(),
        });

        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid payload" });
        }

        const {
          songDescription,
          genre,
          mood,
          aiProvider,
          duration,
          bpm,
          key,
          style,
          includeVocals,
          instruments = [],
        } = parsed.data;

        // Build a richer prompt for structure generation
        const details: string[] = [];
        if (mood) details.push(`Mood: ${mood}`);
        if (key) details.push(`Key: ${key}`);
        if (style) details.push(`Style: ${style}`);
        details.push(`Vocals: ${includeVocals ? "include" : "no"} vocals`);
        if (instruments.length) details.push(`Instruments: ${instruments.join(", ")}`);
        const combinedPrompt = [songDescription, details.join(". ")].filter(Boolean).join(". ");

        // Helper to parse mm:ss to seconds
        const parseDurationToSeconds = (val?: string): number | undefined => {
          if (!val) return undefined;
          const m = val.match(/^(\d+):(\d{1,2})$/);
          if (!m) return undefined;
          const min = parseInt(m[1], 10);
          const sec = parseInt(m[2], 10);
          return min * 60 + sec;
        };

        try {
          const data = await generateSongStructureWithAI(
            combinedPrompt,
            genre || "Electronic",
            bpm || 120,
            aiProvider
          );

          const chordsArray = Array.isArray((data as any).chordProgression)
            ? (data as any).chordProgression
            : typeof (data as any).chordProgression === "string"
            ? (data as any).chordProgression
                .split(/[-,>]+/)
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [];

          const computedDuration =
            typeof duration === "number"
              ? duration
              : parseDurationToSeconds((data as any)?.metadata?.duration) || 200;

          const responseBody = {
            id: `song-${Date.now()}`,
            title: (data as any)?.metadata?.title || "AI Generated Song",
            description: songDescription,
            structure: (data as any).structure,
            metadata: {
              duration: computedDuration,
              key: key || (data as any)?.metadata?.key || "C Major",
              bpm: bpm || (data as any)?.metadata?.bpm || 120,
              format: (data as any)?.metadata?.format || "WAV",
            },
            chordProgression: chordsArray,
            productionNotes: (data as any).productionNotes,
            audioFeatures: (data as any).audioFeatures,
          };

          return res.json(responseBody);
        } catch (err: any) {
          console.error("Song structure generation failed:", err);
                    return sendError(res, 502, err?.message || "AI generation failed");
        }
      } catch (err: any) {
                return sendError(res, 500, err?.message || "Failed to generate song");
      }
    }
  );

  // Generate lyrics endpoint
  app.post(
    "/api/lyrics/generate",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { theme, genre, mood, style } = req.body;

        if (!theme) {
          return sendError(res, 400, "Theme is required");
        }

        // For now, return mock lyrics since we don't have a lyrics generation service
        const mockLyrics = [
          `[Verse 1]`,
          `In the ${mood || 'vibrant'} ${genre || 'electronic'} night`,
          `Where ${theme} comes alive`,
          `We dance until the morning light`,
          `This is how we thrive`,
          ``,
          `[Chorus]`,
          `${theme}, ${theme}, in my heart`,
          `Never gonna fall apart`,
          `Feel the ${genre || 'electronic'} beat`,
          `Moving to the heat`,
          ``,
          `[Verse 2]`,
          `Every moment feels so right`,
          `In this ${mood || 'energetic'} space`,
          `${theme} shining bright`,
          `Love in every place`
        ].join('\n');

        res.json({ 
          lyrics: mockLyrics,
          metadata: {
            theme,
            genre: genre || 'electronic',
            mood: mood || 'energetic',
            style: style || 'modern'
          }
        });
      } catch (err: any) {
        console.error("Lyrics generation error:", err);
        sendError(res, 500, err?.message || "Failed to generate lyrics");
      }
    }
  );

  // Generate beat from lyrics endpoint
  app.post(
    "/api/lyrics/generate-beat",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { lyrics, genre, complexity } = req.body;

        if (!lyrics) {
          return sendError(res, 400, "Lyrics are required");
        }

        // Generate a beat pattern based on lyrics rhythm
        const beatPattern = {
          kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
          snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
          hihat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
          openhat: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]
        };

        res.json({ 
          pattern: beatPattern,
          bpm: 120,
          genre: genre || 'hip-hop',
          complexity: complexity || 5
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
    async (req: Request, res: Response) => {
      try {
        const { lyrics, style, genre } = req.body;

        if (!lyrics) {
          return sendError(res, 400, "Lyrics are required");
        }

        const generatedMusic = await generateMusicFromLyrics(lyrics, style || 'pop', genre || 'electronic');

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
            version: "7a76a8258b23fae65c5a22debb8841d1d7e816b75c2f24218cd2bd85737879072", // MusicGen melody version
            input: {
              model_version: "melody",
              prompt: prompt,
              duration: duration || 10,
            },
          }),
        });

        const prediction = await response.json();

        // SECURITY: Validate prediction ID format to prevent SSRF
        if (!prediction.id || typeof prediction.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(prediction.id)) {
          return res.status(500).json({ message: "Invalid prediction ID received from API" });
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

    app.post(
    "/api/chatmusician/generate",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
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

  return createServer(app);
}
