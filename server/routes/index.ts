import { Express } from "express";
import { IStorage } from "../storage";
import { billingRoutes } from "./billing";
import { requireAuth } from "../middleware/auth";

// AI Service imports
import { generateBeatPattern } from "../services/grok";
import { generateLyrics } from "../services/grok";
import { generateMelody } from "../services/grok";
import { generateSongStructureWithAI } from "../services/ai-structure-grok";

export async function registerRoutes(app: Express, storage: IStorage) {
  // Register existing billing routes
  app.use("/api/billing", billingRoutes(storage));

  // Upload parameter generation endpoint
  app.post("/api/objects/upload", async (req, res) => {
    try {
      console.log('🎵 Upload parameters requested');

      // Generate a unique object key for the upload
      const objectKey = `songs/${Date.now()}-${Math.random().toString(36).substring(7)}`;

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

  // AI Generation Routes
  app.post("/api/beat/generate", async (req, res) => {
    try {
      const { style, bpm, complexity, aiProvider } = req.body;

      if (!style) {
        return res.status(400).json({ error: "Style parameter is required" });
      }

      console.log(`🎵 Generating beat: ${style} at ${bpm} BPM, complexity ${complexity}`);

      const beatData = await generateBeatPattern(style, bpm || 120, complexity || 5, aiProvider);

      res.json({
        success: true,
        data: beatData,
        message: `Generated ${style} beat successfully`
      });

    } catch (error) {
      console.error("Beat generation error:", error);
      res.status(500).json({
        error: "Failed to generate beat",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/lyrics/generate", async (req, res) => {
    try {
      const { theme, genre, mood, complexity, aiProvider } = req.body;

      if (!theme || !genre || !mood) {
        return res.status(400).json({
          error: "Theme, genre, and mood parameters are required"
        });
      }

      console.log(`📝 Generating lyrics: ${theme} in ${genre} style with ${mood} mood`);

      const lyrics = await generateLyrics(theme, genre, mood, complexity || 5, aiProvider);

      res.json({
        success: true,
        content: lyrics,
        message: `Generated lyrics for ${theme} successfully`
      });

    } catch (error) {
      console.error("Lyrics generation error:", error);
      res.status(500).json({
        error: "Failed to generate lyrics",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/melody/generate", async (req, res) => {
    try {
      const { scale, style, complexity, availableTracks, musicalParams } = req.body;

      if (!scale || !style) {
        return res.status(400).json({
          error: "Scale and style parameters are required"
        });
      }

      console.log(`🎼 Generating melody: ${style} in ${scale} scale, complexity ${complexity}`);

      const melodyData = await generateMelody(scale, style, complexity || 5, availableTracks, musicalParams);

      res.json({
        success: true,
        data: melodyData,
        message: `Generated ${style} melody in ${scale} successfully`
      });

    } catch (error) {
      console.error("Melody generation error:", error);
      res.status(500).json({
        error: "Failed to generate melody",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/music/generate-complete", async (req, res) => {
    try {
      const { prompt, genre, bpm, provider, key } = req.body;

      if (!prompt || !genre) {
        return res.status(400).json({
          error: "Prompt and genre parameters are required"
        });
      }

      console.log(`🎵 Generating complete song: "${prompt}" in ${genre} style`);

      const songData = await generateSongStructureWithAI(
        prompt,
        genre,
        bpm || 120,
        provider,
        key || "C Major"
      );

      res.json({
        success: true,
        data: songData,
        message: `Generated complete song structure successfully`
      });

    } catch (error) {
      console.error("Song generation error:", error);
      res.status(500).json({
        error: "Failed to generate song structure",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Song management endpoints
  app.get("/api/songs", requireAuth(), async (req, res) => {
    try {
      const songs = await storage.getUserSongs(req.userId!);
      res.json(songs);
    } catch (error) {
      console.error("Error fetching songs:", error);
      res.status(500).json({ message: "Failed to fetch songs" });
    }
  });

  app.post("/api/songs/upload", requireAuth(), async (req, res) => {
    try {
      const { songURL, name, fileSize, format, mimeType } = req.body;

      if (!songURL || !name) {
        return res.status(400).json({ message: "Song URL and name are required" });
      }

      console.log('🎵 Saving song:', { name, fileSize, format, mimeType });

      const song = await storage.createSong(req.userId!, {
        name,
        originalUrl: songURL,
        accessibleUrl: songURL, // For now, same as original
        fileSize: fileSize || 0,
        format: format || 'unknown',
        mimeType: mimeType || '',
        duration: null, // Will be analyzed later
        metadata: {}
      });

      res.status(201).json(song);
    } catch (error) {
      console.error("Error saving song:", error);
      res.status(500).json({ message: "Failed to save song" });
    }
  });

  app.post("/api/songs/analyze", requireAuth(), async (req, res) => {
    try {
      const { songId, songURL, songName } = req.body;

      if (!songURL) {
        return res.status(400).json({ message: "Song URL is required" });
      }

      console.log('🎵 Analyzing song:', songName || songURL);

      // For now, return basic analysis - in a real app you'd call an AI service
      const analysis = {
        estimatedBPM: 120,
        keySignature: "C Major",
        genre: "Unknown",
        mood: "Neutral",
        structure: {
          intro: "0:00-0:15",
          verse1: "0:15-0:45",
          chorus: "0:45-1:15",
          verse2: "1:15-1:45",
          outro: "1:45-end"
        },
        instruments: ["Unknown"],
        analysis_notes: "Basic analysis - full AI analysis would require audio processing service"
      };

      // Update song metadata if songId provided
      if (songId) {
        await storage.updateSong(songId, {
          metadata: analysis,
          analyzedAt: new Date()
        });
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing song:", error);
      res.status(500).json({ message: "Failed to analyze song" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app.listen(parseInt(process.env.PORT || "5000", 10));
}
