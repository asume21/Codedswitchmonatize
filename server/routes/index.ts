import { Express } from "express";
import { IStorage } from "../storage";
import { billingRoutes } from "./billing";

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

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app.listen(parseInt(process.env.PORT || "5000", 10));
}
