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

  // Bass Line Generation
  app.post("/api/bass/generate", async (req, res) => {
    try {
      const { key, style, complexity, groove, bpm } = req.body;

      if (!key || !style) {
        return res.status(400).json({
          error: "Key and style parameters are required"
        });
      }

      console.log(`🎸 Generating bassline: ${style} in ${key}, groove: ${groove || 'standard'}`);

      const aiClient = getAIClient();
      
      if (!aiClient) {
        throw new Error("AI client not available");
      }

      const response = await aiClient.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a professional bass player and music producer. Create bass lines that groove, support the harmony, and fit the genre perfectly.`
          },
          {
            role: "user",
            content: `Create a ${style} bassline in ${key} with ${groove || 'standard'} groove and complexity ${complexity || 5}/10 at ${bpm || 120} BPM.

Requirements:
- Key: ${key}
- Style: ${style}
- Groove: ${groove || 'standard'} (syncopated/straight/walking/funky)
- Generate 16-32 notes for 2-4 bars
- Use proper bass range (E1-E3 typically)
- Follow chord progression if provided
- Create rhythmic interest appropriate to style

${style === 'funk' ? '- Use syncopated 16th note patterns, ghost notes' :
  style === 'jazz' ? '- Use walking bass patterns, chromatic approaches' :
  style === 'rock' ? '- Use root notes with octave jumps, driving 8th notes' :
  style === 'hip-hop' || style === 'trap' ? '- Use sparse 808-style patterns, sub-bass focus' :
  style === 'house' || style === 'edm' ? '- Use four-on-floor patterns, repetitive groove' :
  '- Create genre-appropriate bass patterns'}

Return JSON format:
{
  "notes": [
    {"note": "E", "octave": 2, "duration": 0.5, "start": 0.0, "velocity": 90}
  ],
  "pattern": "description of bass pattern",
  "groove": "description of rhythmic feel",
  "theory": "harmonic function and note choices"
}`
          }
        ],
        model: "grok-beta",
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let bassData;

      try {
        bassData = JSON.parse(content);
      } catch (parseError) {
        // Fallback bass pattern
        bassData = {
          notes: [
            { note: key.split(' ')[0], octave: 2, duration: 1, start: 0, velocity: 85 },
            { note: key.split(' ')[0], octave: 2, duration: 1, start: 1, velocity: 80 },
            { note: key.split(' ')[0], octave: 1, duration: 1, start: 2, velocity: 90 },
            { note: key.split(' ')[0], octave: 2, duration: 1, start: 3, velocity: 85 }
          ],
          pattern: `Simple ${style} bass pattern`,
          groove: groove || 'standard',
          theory: `Root note pattern in ${key}`
        };
      }

      console.log(`✅ Bassline generated: ${bassData.notes?.length || 0} notes`);

      res.json({
        success: true,
        ...bassData,
        message: `Generated ${style} bassline in ${key}`
      });

    } catch (error) {
      console.error("Bass generation error:", error);
      res.status(500).json({
        error: "Failed to generate bassline",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Code to Music AI Generation
  app.post("/api/code-to-music", async (req, res) => {
    try {
      const { code, language, complexity } = req.body;

      if (!code) {
        return res.status(400).json({
          error: "Code parameter is required"
        });
      }

      console.log(`💻🎵 Converting ${language || 'code'} to music, complexity ${complexity || 5}`);

      // Use AI to analyze code structure and generate musical representation
      const aiClient = getAIClient();
      
      if (!aiClient) {
        throw new Error("AI client not available");
      }
      
      const prompt = `Analyze this ${language || 'code'} and convert it into a musical representation. 
      
Code:
\`\`\`${language || 'javascript'}
${code}
\`\`\`

Based on the code structure, generate:
1. A melody that represents the code's flow (loops = repetition, conditionals = variations)
2. Rhythm patterns based on code complexity
3. Tempo based on execution speed
4. Key/scale based on code mood (happy=major, serious=minor)

Return a JSON object with this structure:
{
  "melody": [{"note": "C", "octave": 4, "duration": 0.5, "time": 0}],
  "tempo": 120,
  "key": "C Major",
  "scale": ["C", "D", "E", "F", "G", "A", "B"],
  "analysis": "brief description of musical choices based on code",
  "codeMetrics": {
    "complexity": 5,
    "loopCount": 2,
    "conditionalCount": 1,
    "functionCount": 3
  }
}`;

      const response = await aiClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "grok-beta",
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || "{}";
      
      // Parse AI response
      let musicData;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        musicData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse AI response, using fallback");
        // Fallback music data
        musicData = {
          melody: [
            { note: "C", octave: 4, duration: 0.5, time: 0 },
            { note: "E", octave: 4, duration: 0.5, time: 0.5 },
            { note: "G", octave: 4, duration: 0.5, time: 1 },
            { note: "C", octave: 5, duration: 1, time: 1.5 }
          ],
          tempo: 120,
          key: "C Major",
          scale: ["C", "D", "E", "F", "G", "A", "B"],
          analysis: "Generated basic melody based on code structure",
          codeMetrics: {
            complexity: complexity || 5,
            loopCount: (code.match(/for|while/g) || []).length,
            conditionalCount: (code.match(/if|switch/g) || []).length,
            functionCount: (code.match(/function|=>|def/g) || []).length
          }
        };
      }

      console.log(`✅ Code to music generated: ${musicData.melody?.length || 0} notes`);

      res.json({
        success: true,
        ...musicData,
        message: `Generated music from ${language || 'code'} successfully`
      });

    } catch (error) {
      console.error("Code to music error:", error);
      res.status(500).json({
        error: "Failed to convert code to music",
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

      console.log('🎵 AI-analyzing song:', songName || songURL);

      // Use AI to analyze the song
      const aiClient = getAIClient();
      
      if (!aiClient) {
        return res.status(503).json({ 
          message: "AI service unavailable",
          analysis: getFallbackAnalysis(songName)
        });
      }

      const response = await aiClient.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an expert music analyst with deep knowledge of music theory, production, and genre classification. Analyze songs accurately based on filename, duration, and context.`
          },
          {
            role: "user",
            content: `Analyze this song and provide detailed musical analysis:

Song: "${songName || 'Unknown Track'}"
URL: ${songURL}

Provide analysis in JSON format:
{
  "estimatedBPM": <number 60-200>,
  "keySignature": "<key> <Major/Minor>",
  "genre": "<primary genre>",
  "subgenre": "<specific subgenre if applicable>",
  "mood": "<emotional mood>",
  "energy": "<low/medium/high>",
  "structure": {
    "intro": "time range",
    "verse1": "time range",
    "chorus": "time range",
    "verse2": "time range",
    "bridge": "time range (if applicable)",
    "outro": "time range"
  },
  "instruments": ["list of instruments"],
  "production_quality": "<assessment>",
  "mixing_notes": "<technical observations>",
  "strengths": ["positive aspects"],
  "improvements": ["suggested improvements"],
  "analysis_notes": "<detailed analysis>",
  "toolRecommendations": [
    {
      "tool": "EQ|Compressor|Deesser|Reverb|Limiter|NoiseGate",
      "reason": "<specific technical reason why this tool is needed>",
      "priority": "high|medium|low",
      "settings": "<suggested settings if applicable>"
    }
  ]
}

Base your analysis on:
- Song filename/title patterns
- Common genre conventions
- Typical song structures
- Professional production standards`
          }
        ],
        model: "grok-beta",
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let analysis;

      try {
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.error("Failed to parse AI analysis, using fallback");
        analysis = getFallbackAnalysis(songName);
      }

      // Ensure all required fields exist
      analysis = {
        estimatedBPM: analysis.estimatedBPM || 120,
        keySignature: analysis.keySignature || "C Major",
        genre: analysis.genre || "Unknown",
        subgenre: analysis.subgenre || "",
        mood: analysis.mood || "Neutral",
        energy: analysis.energy || "medium",
        structure: analysis.structure || {
          intro: "0:00-0:15",
          verse1: "0:15-0:45",
          chorus: "0:45-1:15",
          verse2: "1:15-1:45",
          outro: "1:45-end"
        },
        instruments: analysis.instruments || ["Unknown"],
        production_quality: analysis.production_quality || "Good",
        mixing_notes: analysis.mixing_notes || "Balanced mix",
        strengths: analysis.strengths || ["Professional production"],
        improvements: analysis.improvements || ["Consider enhancing dynamics"],
        analysis_notes: analysis.analysis_notes || "AI-powered analysis complete",
        toolRecommendations: analysis.toolRecommendations || []
      };

      console.log(`✅ Song analyzed: ${analysis.genre} at ${analysis.estimatedBPM} BPM in ${analysis.keySignature}`);

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
      res.status(500).json({ 
        message: "Failed to analyze song",
        analysis: getFallbackAnalysis(req.body.songName)
      });
    }
  });

  // AI Auto-Master endpoint - automatically mix and master a track
  app.post("/api/songs/auto-master", requireAuth, async (req, res) => {
    const { songUrl, songName } = req.body;

    console.log(`🎛️ AI Auto-Master requested for: ${songName}`);

    try {
      // Step 1: Analyze the song first
      const analysisResponse = await aiClient.chat.completions.create({
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content: `You are an expert audio mastering engineer. Analyze what processing this track needs and provide specific settings.
            
            Return JSON with:
            {
              "needsEQ": true/false,
              "eqSettings": { "boostFreq": 3000, "boostGain": 3, "cutFreq": 200, "cutGain": -2 },
              "needsCompression": true/false,
              "compressionSettings": { "threshold": -12, "ratio": 4, "attack": 5, "release": 50 },
              "needsLimiting": true/false,
              "limiterSettings": { "ceiling": -0.3, "makeupGain": 2 },
              "needsReverb": true/false,
              "reverbSettings": { "roomType": "hall", "wetDry": 0.2, "decay": 1.5 },
              "fixesApplied": ["EQ boost at 3kHz", "Gentle compression", "Limiting to -0.3dB"],
              "explanation": "Track needs..."
            }`
          },
          {
            role: "user",
            content: `Analyze this track and determine what mastering it needs: ${songName}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000
      });

      const masteringPlan = JSON.parse(analysisResponse.choices[0]?.message?.content || "{}");
      
      console.log(`✅ AI Mastering Plan:`, masteringPlan);

      // Step 2: In a real implementation, you would:
      // - Load the audio file from songUrl
      // - Apply the processing using Web Audio API or ffmpeg
      // - Save the processed file
      // - Return the new URL
      
      // For now, return the plan (you'll need to add actual audio processing)
      res.json({
        success: true,
        fixesApplied: masteringPlan.fixesApplied?.length || 5,
        masteringPlan,
        explanation: masteringPlan.explanation,
        // In real implementation: fixedAudioUrl: "/path/to/mastered/file.wav"
        message: "Mastering plan generated. Actual audio processing requires ffmpeg/Web Audio API integration."
      });

    } catch (error) {
      console.error("❌ Auto-master error:", error);
      res.status(500).json({ 
        message: "AI auto-mastering failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // AI Chat endpoint for Floating AI Assistant
  app.post("/api/ai/chat", requireAuth, async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: "Messages array is required" });
    }

    console.log(`💬 AI Chat request with ${messages.length} messages`);

    try {
      const response = await aiClient.chat.completions.create({
        model: "grok-beta",
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
      });

      const assistantResponse = response.choices[0]?.message?.content || "I apologize, I couldn't generate a response.";

      res.json({ response: assistantResponse });
    } catch (error) {
      console.error("❌ AI chat error:", error);
      res.status(500).json({ 
        message: "AI chat failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Fallback analysis helper
  function getFallbackAnalysis(songName?: string) {
    return {
      estimatedBPM: 120,
      keySignature: "C Major",
      genre: "Unknown",
      subgenre: "",
      mood: "Neutral",
      energy: "medium",
      structure: {
        intro: "0:00-0:15",
        verse1: "0:15-0:45",
        chorus: "0:45-1:15",
        verse2: "1:15-1:45",
        outro: "1:45-end"
      },
      instruments: ["Unknown"],
      production_quality: "Unable to analyze",
      mixing_notes: "AI analysis unavailable",
      strengths: ["Uploaded successfully"],
      improvements: ["Analysis requires AI service"],
      analysis_notes: `Basic analysis for "${songName || 'uploaded track'}". For detailed AI analysis, ensure API keys are configured.`
    };
  }

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
