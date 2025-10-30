import type { Express, Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import type { IStorage } from "./storage";
import { requireAuth, requireSubscription } from "./middleware/auth";
import { requireFeature, checkUsageLimit } from "./middleware/featureGating";
import { createAuthRoutes } from "./routes/auth";
import { createKeyRoutes } from "./routes/keys";
import { createSongRoutes } from "./routes/songs";
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
  
  // Mount song routes
  app.use("/api/songs", createSongRoutes(storage));

  // Upload parameter generation endpoint
  app.post("/api/objects/upload", async (req, res) => {
    try {
      console.log('🎵 Upload parameters requested');

      // Generate a unique object key for the upload using crypto for security
      const objectKey = `songs/${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      // Determine protocol - check X-Forwarded-Proto header for proxied requests (Railway, etc.)
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      
      // For local storage (when GCS is not configured), return local upload URL
      const uploadURL = `${protocol}://${req.get('host')}/api/internal/uploads/${encodeURIComponent(objectKey)}`;

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
  // Use /data if available (Railway persistent volume), otherwise use local objects
  const LOCAL_OBJECTS_DIR = fs.existsSync('/data') 
    ? path.resolve('/data', 'objects')
    : path.resolve(process.cwd(), "objects");
  
  try {
    fs.mkdirSync(LOCAL_OBJECTS_DIR, { recursive: true });
    console.log('📁 Using storage directory:', LOCAL_OBJECTS_DIR);
  } catch {}

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

      const packageInfo = creditPackages[amount];
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
        
        res.json({
          success: true,
          beat: {
            id: `beat-${Date.now()}`,
            audioUrl: result.output,
            bpm: Number(bpm),
            genre: String(genre),
            duration: Number(duration),
            provider: 'MusicGen AI',
            timestamp: new Date().toISOString()
          },
          paymentMethod,
          creditsRemaining: remainingCredits,
          subscriptionStatus: user.subscriptionStatus
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

      const { genre, mood, key } = req.body;

      // Use MusicGen AI for REAL melody generation
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) {
        return sendError(res, 500, "REPLICATE_API_TOKEN not configured");
      }

      const prompt = `${mood || 'melodic'} ${genre || 'pop'} melody in ${key || 'C major'}, beautiful and catchy`;
      console.log(`🎹 Generating AI melody with MusicGen: "${prompt}"`);

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

      if (!prediction.id) {
        return sendError(res, 500, "Failed to start melody generation");
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
        res.json({
          success: true,
          data: {
            audioUrl: result.output,
            key: key || 'C major',
            genre: genre || 'pop',
            mood: mood || 'melodic',
            provider: 'MusicGen AI'
          },
          message: "Melody generated successfully"
        });
      } else {
        return sendError(res, 500, "Melody generation failed");
      }
    } catch (error: any) {
      console.error("Melody generation error:", error);
      sendError(res, 500, error.message || "Failed to generate melody");
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

  // Serve files from internal uploads path (for song playback)
  app.get("/api/internal/uploads/*", async (req: Request, res: Response) => {
    try {
      const objectKey = (req.params as any)[0] as string;
      console.log('🎵 Internal upload GET request:', objectKey);
      console.log('📁 LOCAL_OBJECTS_DIR:', LOCAL_OBJECTS_DIR);
      console.log('📁 CWD:', process.cwd());
      
      const sanitizedObjectKey = path.normalize(objectKey).replace(/^(\.\.[\\/])+/,'');
      if (!sanitizedObjectKey || sanitizedObjectKey.includes("..")) {
        console.error('❌ Invalid path detected');
        return res.status(400).send("Invalid path");
      }
      const fullPath = path.resolve(path.join(LOCAL_OBJECTS_DIR, sanitizedObjectKey));
      console.log('📂 Full path:', fullPath);
      
      // SECURITY: Ensure the resolved path is still within LOCAL_OBJECTS_DIR
      if (!fullPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
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
      res.setHeader("Content-Type", type);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      fs.createReadStream(fullPath).pipe(res);
    } catch (err: any) {
      console.error('❌ Internal upload error:', err);
      res.status(500).send("Server error");
    }
  });

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
    async (req: Request, res: Response) => {
      try {
        // Check authentication
        if (!req.userId) {
          return sendError(res, 401, "Authentication required - please log in");
        }
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

  // Generate lyrics endpoint with AI model selection
  app.post(
    "/api/lyrics/generate",
    async (req: Request, res: Response) => {
      try {
        // Check authentication
        if (!req.userId) {
          return sendError(res, 401, "Authentication required - please log in");
        }

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
    async (req: Request, res: Response) => {
      try {
        // Check authentication
        if (!req.userId) {
          return sendError(res, 401, "Authentication required - please log in");
        }

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
    async (req: Request, res: Response) => {
      try {
        // Check authentication
        if (!req.userId) {
          return sendError(res, 401, "Authentication required - please log in");
        }

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
    async (req: Request, res: Response) => {
      try {
        // Check authentication
        if (!req.userId) {
          return sendError(res, 401, "Authentication required - please log in");
        }

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

  return createServer(app);
}
