import type { Express, Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import type { IStorage } from "./storage";
import { requireAuth, requireSubscription } from "./middleware/auth";
import {
  createCheckoutSession,
  handleStripeWebhook,
} from "./services/stripe";
import { musicGenService } from "./services/musicgen";
import fs from "fs";
import path from "path";
import { insertPlaylistSchema } from "@shared/schema";
import { z } from "zod";

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
    const bpm = selectedGenre.bpmRange[0] + Math.floor(Math.random() * (selectedGenre.bpmRange[1] - selectedGenre.bpmRange[0]));
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
        energy: Math.max(10, Math.min(100, selectedMood.energy + (Math.random() * 20 - 10))),
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
    duration: 1.5 + (Math.random() * 3)
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
  // Ensure local objects directory exists for fallback
  const LOCAL_OBJECTS_DIR = path.resolve(process.cwd(), "objects");
  try {
    fs.mkdirSync(LOCAL_OBJECTS_DIR, { recursive: true });
  } catch {}

  // Validation schemas
  const updatePlaylistSchema = insertPlaylistSchema.partial();
  const addSongSchema = z.object({ songId: z.string() });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Current user
  app.get("/api/me", requireAuth(), async (req: Request, res: Response) => {
    const user = req.userId ? await storage.getUser(req.userId) : undefined;
    if (!user) return res.status(404).json({ message: "User not found" });
    const {
      id,
      email,
      stripeCustomerId,
      stripeSubscriptionId,
      subscriptionStatus,
      subscriptionTier,
      monthlyUploads,
      monthlyGenerations,
    } = user as any;
    res.json({
      id,
      email,
      stripeCustomerId,
      stripeSubscriptionId,
      subscriptionStatus,
      subscriptionTier,
      monthlyUploads,
      monthlyGenerations,
    });
  });

  // Create Checkout Session
  app.post(
    "/api/billing/create-checkout-session",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { url } = await createCheckoutSession(storage, req.userId!);
        res.json({ url });
      } catch (err: any) {
        res.status(400).json({ message: err.message || "Failed to create session" });
      }
    },
  );

  // Playlist endpoints
  app.get("/api/playlists", requireAuth(), async (req: Request, res: Response) => {
    try {
      const playlists = await storage.getUserPlaylists(req.userId!);
      res.json(playlists);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch playlists" });
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
      res.status(500).json({ message: err?.message || "Failed to create playlist" });
    }
  });

  app.get(
    "/api/playlists/:id/songs",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params as any;
        if (!id) return res.status(400).json({ message: "Missing playlist id" });
        const playlist = await storage.getPlaylist(id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (playlist.userId !== req.userId)
          return res.status(403).json({ message: "Forbidden" });
        const items = await storage.getPlaylistSongs(id);
        res.json(items);
      } catch (err: any) {
        res.status(500).json({ message: err?.message || "Failed to fetch playlist songs" });
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
        if (!body.success)
          return res.status(400).json({ message: "Invalid payload" });
        const playlist = await storage.getPlaylist(id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (playlist.userId !== req.userId)
          return res.status(403).json({ message: "Forbidden" });
        const song = await storage.getSong(body.data.songId);
        if (!song || song.userId !== req.userId)
          return res.status(404).json({ message: "Song not found" });
        const ps = await storage.addSongToPlaylist(id, body.data.songId);
        res.status(201).json({ ...ps, song });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || "Failed to add song to playlist" });
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
          .json({ message: err?.message || "Failed to remove song from playlist" });
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
      if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
      if (Object.keys(parsed.data).length === 0)
        return res.status(400).json({ message: "No fields to update" });
      const updated = await storage.updatePlaylist(id, parsed.data as any);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to update playlist" });
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
      res.status(500).json({ message: err?.message || "Failed to delete playlist" });
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
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  // Music generation endpoint (gated)
  app.post(
    "/api/generate-music",
    requireAuth(),
    requireSubscription(storage, { allowedTiers: ["pro"], allowTrialing: true }),
    async (req: Request, res: Response) => {
      try {
        const { prompt, count } = (req.body || {}) as { prompt?: string; count?: number };
        if (!prompt || typeof prompt !== "string") {
          return res.status(400).json({ message: "Missing prompt" });
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

  // Internal binary upload endpoint (local fallback when GCS is not configured)
  app.put(
    "/api/internal/uploads/*",
    express.raw({ type: "*/*", limit: "100mb" }),
    async (req: Request, res: Response) => {
      try {
        const objectKeyEncoded = (req.params as any)[0] as string;
        const objectKey = decodeURIComponent(objectKeyEncoded || "");
        if (!objectKey || objectKey.includes("..")) {
          return res.status(400).json({ message: "Invalid object key" });
        }
        const fullPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, req.body as Buffer);
        return res.json({ ok: true, path: `/objects/${objectKey}` });
      } catch (err: any) {
        res.status(500).json({ message: err?.message || "Upload failed" });
      }
    },
  );

  // Serve locally stored objects (audio)
  app.get("/objects/*", async (req: Request, res: Response) => {
    try {
      const objectKey = (req.params as any)[0] as string;
      if (!objectKey || objectKey.includes("..")) {
        return res.status(400).send("Invalid path");
      }
      const fullPath = path.join(LOCAL_OBJECTS_DIR, objectKey);
      if (!fs.existsSync(fullPath)) return res.status(404).send("Not found");
      const ext = path.extname(fullPath).toLowerCase();
      const type = ext === ".wav" ? "audio/wav" : "application/octet-stream";
      res.setHeader("Content-Type", type);
      fs.createReadStream(fullPath).pipe(res);
    } catch (err: any) {
      res.status(500).send("Server error");
    }
  });

  // Create HTTP server
  const server = createServer(app);
  return server;
}
