import { Express } from "express";
import { IStorage } from "../storage";
import { billingRoutes } from "./billing";
import { requireAuth } from "../middleware/auth";

// AI Service imports
import { generateBeatPattern } from "../services/grok";
import { generateLyrics } from "../services/grok";
import { generateMelody } from "../services/grok";
import { generateSongStructureWithAI } from "../services/ai-structure-grok";
import { getAIClient } from "../services/grok";

// In-memory Snake leaderboard (replace with DB for production)
const snakeScores: { name: string; score: number; ts: number }[] = [];

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

  // AI Assistant Chat endpoint
  app.post("/api/assistant/chat", async (req, res) => {
    try {
      const { message, context, aiProvider } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      console.log(`💬 AI Chat request (${aiProvider || 'auto'}): ${message.substring(0, 50)}...`);

      // Get AI client based on provider preference
      const client = getAIClient();
      
      if (!client) {
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

    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({
        error: "Failed to get AI response",
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
        duration: null, // Will be analyzed later
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
          estimatedBPM: analysis.estimatedBPM,
          keySignature: analysis.keySignature,
          genre: analysis.genre,
          mood: analysis.mood,
          structure: analysis.structure,
          instruments: analysis.instruments,
          analysisNotes: analysis.analysis_notes,
          analyzedAt: new Date()
        });
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing song:", error);
      res.status(500).json({ message: "Failed to analyze song" });
    }
  });

  // Beat save and list endpoints
  app.post("/api/beats", async (req, res) => {
    try {
      const { name, pattern, bpm } = req.body;

      if (!name || !pattern) {
        return res.status(400).json({ error: "Name and pattern are required" });
      }

      console.log(`💾 Saving beat: ${name}`);

      // For now, just return success - in a real app you'd save to database
      const savedBeat = {
        id: `beat_${Date.now()}`,
        name,
        pattern,
        bpm: bpm || 120,
        createdAt: new Date().toISOString()
      };

      res.json({
        success: true,
        data: savedBeat,
        message: `Beat "${name}" saved successfully`
      });

    } catch (error) {
      console.error("Beat save error:", error);
      res.status(500).json({
        error: "Failed to save beat",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Snake IO endpoints (simple, in-memory)
  app.get("/api/snake/leaderboard", async (req, res) => {
    try {
      const top = [...snakeScores]
        .sort((a, b) => (b.score - a.score) || (a.ts - b.ts))
        .slice(0, 20)
        .map(({ name, score }) => ({ name, score }));
      res.json({ top });
    } catch (err) {
      res.status(500).json({ error: "Failed to load leaderboard" });
    }
  });

  app.post("/api/snake/score", async (req, res) => {
    try {
      const { name, score } = req.body || {};
      const cleanName = String(name ?? "Guest").slice(0, 24).replace(/[^\w \-\.]/g, "").trim() || "Guest";
      const s = Number(score);
      if (!Number.isFinite(s) || s < 0 || s > 1000000) {
        return res.status(400).json({ error: "Invalid score" });
      }
      snakeScores.push({ name: cleanName, score: Math.floor(s), ts: Date.now() });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to submit score" });
    }
  });

  app.get("/api/beats", async (req, res) => {
    try {
      console.log("📋 Fetching saved beats");

      // For now, return empty array - in a real app you'd fetch from database
      const beats: any[] = [];

      res.json({
        success: true,
        data: beats,
        message: "Beats retrieved successfully"
      });

    } catch (error) {
      console.error("Beat list error:", error);
      res.status(500).json({
        error: "Failed to fetch beats",
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
