import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { unifiedMusicService } from "../services/unifiedMusicService";
import { patternGenerator } from "../services/patternGenerator";
import { generateBassLine } from "../services/bassGenerator";
import { renderBassToWav } from "../services/bassRenderer";
import { callAI } from "../services/aiGateway";
import { requireCredits } from "../middleware/requireCredits";
import { CREDIT_COSTS } from "../services/credits";
import { storage } from "../storage";
import { aiGenerationLimiter, beatGenerationLimiter, lyricsLimiter, analysisLimiter } from "../middleware/rateLimiting";
import { requireTier } from "../middleware/tierEnforcement";
import { validatePrompt, validateRequired } from "../middleware/inputValidation";
import { sanitizePath } from "../utils/security";
import { recordAIGenerationMetric } from "../services/aiRouteMetrics";
import { extractMelody, type MelodyNote } from "../services/audioAnalysis";

const router = Router();

const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, message });
};

const nameFromPrompt = (prompt: string, fallback: string) => {
  const trimmed = (prompt || "").trim();
  if (!trimmed) return fallback;
  // Use first 40 chars of prompt, stripped of newlines, as a friendly name
  return trimmed.replace(/\s+/g, " ").slice(0, 40) || fallback;
};

export function createAudioRoutes() {
  const trackFromResult = async ({
    userId,
    projectId,
    name,
    type,
    result,
  }: {
    userId: string;
    projectId?: string | null;
    name: string;
    type: string;
    result: any;
  }) => {
    const audioUrl = result?.audioUrl || result?.audio_url || result?.song || result?.output;
    if (!audioUrl) {
      throw new Error("Missing audio URL from generator result");
    }

    const durationMs = (result?.metadata?.duration ?? result?.duration ?? 0) * 1000 || null;

    return storage.createTrack(userId, projectId ?? null, {
      name,
      type,
      audioUrl,
      position: 0,
      duration: durationMs,
      volume: 100,
      pan: 0,
      muted: false,
      solo: false,
      effects: null,
      metadata: result?.metadata ?? null,
    });
  };

  // Professional song generation endpoint (Suno via Replicate)
  router.post("/songs/generate-professional", 
    requireAuth(), 
    aiGenerationLimiter, 
    requireTier('pro'), 
    validatePrompt, 
    validateRequired('prompt'), 
    async (req: Request, res: Response) => {
    try {
      const { prompt, genre, mood, duration, style, vocals, bpm, key, projectId } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎵 Generating professional song with MusicGen via Replicate...');
      
      const song = await unifiedMusicService.generateFullSong(prompt, {
        genre: genre || 'pop',
        mood: mood || 'uplifting',
        duration: duration || 30, // MusicGen max 30 seconds
        style: style || 'modern',
        vocals: vocals !== false,
        bpm: bpm || 120,
        key: key || 'C Major'
      });

      const track = await trackFromResult({
        userId: req.userId!,
        projectId,
        name: nameFromPrompt(prompt, "Professional Song"),
        type: "generated",
        result: song,
      });

      console.log('✅ Professional song generated');
      res.json({
        success: true,
        status: 'success',
        song: song,
        trackId: track.id,
        track,
      });

    } catch (error) {
      console.error('❌ Song generation error:', error);
      sendError(res, 500, "Failed to generate professional song");
    }
  });

  // Generate beat and melody (MusicGen via Replicate)
  router.post("/songs/generate-beat", 
    requireAuth(), 
    beatGenerationLimiter, 
    validatePrompt, 
    validateRequired('prompt'), 
    async (req: Request, res: Response) => {
    try {
      const { prompt, genre, duration, style, energy, projectId } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎼 Generating beat and melody with MusicGen via Replicate...');
      
      const result = await unifiedMusicService.generateTrack(prompt, {
        type: 'beat',
        genre: genre || 'pop',
        duration: duration || 30,
        style: style || 'modern',
        energy: energy || 'medium'
      });

      const track = await trackFromResult({
        userId: req.userId!,
        projectId,
        name: nameFromPrompt(prompt, "Beat"),
        type: "beat",
        result,
      });

      console.log('✅ Beat and melody generated');
      res.json({
        status: 'success',
        result: result,
        trackId: track.id,
        track,
      });

    } catch (error) {
      console.error('❌ Beat generation error:', error);
      sendError(res, 500, "Failed to generate beat");
    }
  });

  // Generate instrumental (Stable Audio or MusicGen via Replicate)
  // Use useStableAudio=true for better quality and more variety
  router.post("/songs/generate-instrumental", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { prompt, genre, duration, instruments, energy, projectId, useStableAudio, bpm, key } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      let result;
      
      // Use Stable Audio for better quality if requested (or by default for instrumentals)
      if (useStableAudio !== false) {
        console.log('🎹 Generating instrumental with Stable Audio 2.0 via Replicate...');
        result = await unifiedMusicService.generateWithStableAudio(prompt, {
          genre: genre || 'pop',
          duration: duration || 30,
          bpm: bpm,
          key: key,
        });
      } else {
        console.log('🎹 Generating instrumental with MusicGen via Replicate...');
        result = await unifiedMusicService.generateTrack(prompt, {
          type: 'instrumental',
          instrument: (instruments || ['piano', 'guitar', 'bass', 'drums']).join(', '),
          genre: genre || 'pop',
          duration: duration || 60,
          energy: energy || 'medium'
        });
      }

      const track = await trackFromResult({
        userId: req.userId!,
        projectId,
        name: nameFromPrompt(prompt, "Instrumental"),
        type: "instrumental",
        result,
      });

      console.log('✅ Instrumental generated');
      res.json({
        status: 'success',
        result: result,
        trackId: track.id,
        track,
      });

    } catch (error) {
      console.error('❌ Instrumental generation error:', error);
      sendError(res, 500, "Failed to generate instrumental");
    }
  });

  // Genre blending (MusicGen via Replicate)
  router.post("/songs/blend-genres", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { primaryGenre, secondaryGenres, prompt, projectId } = req.body;
      
      if (!primaryGenre || !secondaryGenres || !prompt) {
        return sendError(res, 400, "Missing required parameters");
      }

      console.log('🎭 Blending genres with MusicGen via Replicate...');
      
      const result = await unifiedMusicService.blendGenres(primaryGenre, secondaryGenres, prompt);

      const track = await trackFromResult({
        userId: req.userId!,
        projectId,
        name: nameFromPrompt(prompt, "Genre Blend"),
        type: "instrumental",
        result,
      });

      console.log('✅ Genres blended');
      res.json({
        status: 'success',
        result: result,
        trackId: track.id,
        track,
      });

    } catch (error) {
      console.error('❌ Genre blending error:', error);
      sendError(res, 500, "Failed to blend genres");
    }
  });

  // Generate pattern-based music (for RealisticAudioEngine playback)
  router.post("/songs/generate-pattern", async (req: Request, res: Response) => {
    try {
      const { prompt, duration, bpm } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎼 Generating music pattern for realistic instruments...');
      
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
  router.post("/songs/generate-drums", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { prompt, genre, bpm, duration, projectId } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🥁 Generating drum pattern with MusicGen via Replicate...');
      
      const result = await unifiedMusicService.generateTrack(prompt, {
        type: 'drum_pattern',
        genre: genre || 'pop',
        bpm: bpm || 120,
        duration: duration || 30
      });

      const track = await trackFromResult({
        userId: req.userId!,
        projectId,
        name: nameFromPrompt(prompt, "Drums"),
        type: "drum_pattern",
        result,
      });

      console.log('✅ Drum pattern generated');
      res.json({
        status: 'success',
        result: result,
        trackId: track.id,
        track,
      });

    } catch (error) {
      console.error('❌ Drum generation error:', error);
      sendError(res, 500, "Failed to generate drums");
    }
  });

  // Generate melody (MusicGen via Replicate)
  router.post("/songs/generate-melody", 
    requireAuth(), 
    beatGenerationLimiter, 
    validatePrompt, 
    validateRequired('prompt'), 
    async (req: Request, res: Response) => {
    try {
      const { prompt, genre, key, duration, instrument, projectId } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎵 Generating melody with MusicGen via Replicate...');
      
      const result = await unifiedMusicService.generateTrack(prompt, {
        type: 'melody',
        genre: genre || 'pop',
        key: key || 'C Major',
        duration: duration || 30,
        instrument: instrument || 'piano'
      });

      const track = await trackFromResult({
        userId: req.userId!,
        projectId,
        name: nameFromPrompt(prompt, "Melody"),
        type: "melody",
        result,
      });

      console.log('✅ Melody generated');
      res.json({
        status: 'success',
        result: result,
        trackId: track.id,
        track,
      });

    } catch (error) {
      console.error('❌ Melody generation error:', error);
      sendError(res, 500, "Failed to generate melody");
    }
  });

  // Generate song (Alias)
  router.post("/audio/generate-song", async (req: Request, res: Response) => {
    try {
      const { prompt, lyrics, options = {} } = req.body;
      
      if (!prompt && !lyrics) {
        return sendError(res, 400, "Prompt or lyrics required");
      }

      console.log('🎵 Generating full song via /api/audio/generate-song...');
      
      const result = await unifiedMusicService.generateFullSong(
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
  router.post("/audio/generate-lyrics", async (req: Request, res: Response) => {
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
  router.post("/audio/generate-beat-from-lyrics", async (req: Request, res: Response) => {
    try {
      const { lyrics, genre, complexity, bpm } = req.body;
      
      if (!lyrics) {
        return sendError(res, 400, "Lyrics are required");
      }

      console.log('🥁 Generating beat from lyrics...');
      
      // Analyze lyrics to determine beat style
      const prompt = `${genre || 'hip-hop'} beat for lyrics: "${lyrics.substring(0, 200)}..."`;
      
      const result = await unifiedMusicService.generateTrack(prompt, {
        type: 'beat',
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
  router.post("/layers/generate", async (req: Request, res: Response) => {
    try {
      const { baseTrack, style, complexity, instruments } = req.body;
      
      console.log('🎚️ Generating dynamic layers...');
      
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
  router.post("/music/generate-bass", 
    beatGenerationLimiter, 
    validateRequired('chordProgression'), 
    async (req: Request, res: Response) => {
    try {
      const { 
        chordProgression, 
        style = 'fingerstyle', 
        pattern = 'root-fifth',
        octave = 2,
        groove = 0.5,
        noteLength = 0.75,
        velocity = 0.7,
        glide = 0,
        projectId,
        name = "Bass Render"
      } = req.body;
      
      console.log('🎸 Generating bass line with params:', { style, pattern, octave, groove, noteLength, velocity, glide });
      
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

      // Render to WAV server-side and create Track
      const uploadsDir = path.join(process.cwd(), "server", "uploads");
      const renderResult = await renderBassToWav(
        bassNotes.map((n) => ({
          note: n.note,
          octave: n.octave,
          start: n.start,
          duration: n.duration,
          velocity: Math.round((n.velocity ?? 0.7) * 127),
        })),
        uploadsDir,
        {
          style,
          quality: 'high',
        }
      );

      const audioUrl = `/uploads/${renderResult.fileName}`;

      const track = await storage.createTrack(req.userId!, projectId ?? null, {
        name,
        type: "bass-render",
        audioUrl,
        position: 0,
        duration: Math.round(renderResult.duration * 1000),
        volume: 100,
        pan: 0,
        muted: false,
        solo: false,
        effects: null,
        metadata: {
          notes: bassNotes,
          pattern,
          style,
          octave,
          groove,
          noteLength,
          velocity,
          glide,
          renderInfo: renderResult.renderInfo,
        },
      });

      res.json({
        status: 'success',
        notes: bassNotes,
        pattern: pattern || 'root-fifth',
        style: style || 'fingerstyle',
        audioUrl,
        renderInfo: renderResult.renderInfo,
        trackId: track.id,
        track,
      });

    } catch (error: any) {
      console.error('❌ Bass generation error:', error);
      sendError(res, 500, error?.message || "Failed to generate bass line");
    }
  });

  // Phase 3: AI Bassline endpoint
  router.post("/ai/music/bass", async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      const { key, bpm, bars, songPlanId, sectionId, aiProvider } = req.body || {};

      const safeKey = typeof key === "string" && key.trim().length > 0 ? key.trim() : "C minor";
      const safeBpm = Math.max(40, Math.min(240, Number(bpm) || 120));
      const safeBars = Math.max(1, Math.min(16, Number(bars) || 4));
      const requestedProvider = typeof aiProvider === "string" ? aiProvider.toLowerCase() : "";
      const preferredProvider = requestedProvider === "grok" || requestedProvider === "openai"
        ? requestedProvider
        : undefined;

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
        const totalBeats = numBars * 4;
        
        let currentBeat = 0;
        while (currentBeat < totalBeats) {
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
      let provider = preferredProvider ? `${preferredProvider} via callAI` : "auto via callAI";

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
          generationMethod: provider.includes("Fallback") ? "algorithmic" : "ai",
          songPlanId: songPlanId || null,
          sectionId: sectionId || "bass-section",
        },
      });
    } catch (error: any) {
      console.error("❌ Phase 3 AI bassline error:", error);
      sendError(res, 500, error?.message || "Failed to generate AI bassline");
    }
  });

  // Phase 3: AI Drum Grid endpoint
  router.post("/ai/music/drums", async (req: Request, res: Response) => {
    const routeStartedAt = Date.now();
    try {
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      const { bpm, bars, style, songPlanId, sectionId, gridResolution, grooveMode, aiProvider, generationSeed } = req.body || {};

      const safeBpm = Math.max(40, Math.min(240, Number(bpm) || 120));
      const safeBars = Math.max(1, Math.min(16, Number(bars) || 4));
      const safeStyle = typeof style === "string" && style.length > 0 ? style : "hip-hop";
      const requestedProvider = typeof aiProvider === "string" ? aiProvider.toLowerCase() : "";
      const preferredProvider = requestedProvider === "grok" || requestedProvider === "openai"
        ? requestedProvider
        : undefined;
      const resolvedSeed = Number.isFinite(Number(generationSeed))
        ? Number(generationSeed)
        : Date.now();
      const normalizedGrooveMode = (() => {
        const raw = typeof grooveMode === "string" ? grooveMode.toLowerCase() : "balanced";
        return raw === "tight" || raw === "busy" ? raw : "balanced";
      })();
      const recordDrumMetric = (outcome: 'success' | 'error' | 'fallback', resolvedProvider?: string | null) => {
        recordAIGenerationMetric({
          route: '/api/ai/music/drums',
          requestedProvider: preferredProvider || null,
          effectiveProvider: resolvedProvider || null,
          outcome,
          latencyMs: Date.now() - routeStartedAt,
        });
      };
      const stepsPerBar = 16; // match BeatMaker gridResolution 1/16
      const totalSteps = safeBars * stepsPerBar;

      console.log(
        `🥁 [Phase 3] Generating AI drum grid via callAI: style=${safeStyle}, bpm=${safeBpm}, bars=${safeBars}, steps=${totalSteps}, seed=${resolvedSeed}`,
      );

      type DrumGrid = {
        kick?: Array<number | boolean>;
        snare?: Array<number | boolean>;
        hihat?: Array<number | boolean>;
        percussion?: Array<number | boolean>;
      };

      type DrumStyleProfile = {
        kickMin: number;
        kickMax: number;
        snareMin: number;
        snareMax: number;
        hihatMin: number;
        hihatMax: number;
        percMin: number;
        percMax: number;
        kickPreferredSteps: number[];
        snarePreferredSteps: number[];
        hihatPreferredSteps: number[];
        percPreferredSteps: number[];
      };

      type GrooveMode = "tight" | "balanced" | "busy";

      const createSeededRandom = (seed: number) => {
        let state = (seed >>> 0) || 1;
        return () => {
          state = (1664525 * state + 1013904223) >>> 0;
          return state / 4294967296;
        };
      };

      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

      const applyGrooveModeToProfile = (profile: DrumStyleProfile, mode: GrooveMode): DrumStyleProfile => {
        if (mode === "balanced") return profile;

        const multiplier = mode === "tight" ? 0.84 : 1.18;
        return {
          ...profile,
          kickMin: clamp(profile.kickMin * multiplier, 0.05, 0.7),
          kickMax: clamp(profile.kickMax * multiplier, 0.1, 0.8),
          snareMin: clamp(profile.snareMin * (mode === "tight" ? 0.92 : 1.12), 0.06, 0.35),
          snareMax: clamp(profile.snareMax * (mode === "tight" ? 0.95 : 1.1), 0.1, 0.4),
          hihatMin: clamp(profile.hihatMin * multiplier, 0.16, 0.88),
          hihatMax: clamp(profile.hihatMax * multiplier, 0.22, 0.94),
          percMin: clamp(profile.percMin * multiplier, 0.01, 0.32),
          percMax: clamp(profile.percMax * multiplier, 0.03, 0.4),
        };
      };

      const getDrumStyleProfile = (styleHint: string, mode: GrooveMode): DrumStyleProfile => {
        const lower = styleHint.toLowerCase();
        const isTrapOrHipHop = lower.includes('trap') || lower.includes('hip') || lower.includes('drill');
        const isElectronic = lower.includes('house') || lower.includes('techno') || lower.includes('electro') || lower.includes('edm');
        const isDnb = lower.includes('dnb') || lower.includes('drum and bass');

        if (isDnb) {
          return applyGrooveModeToProfile({
            kickMin: 0.18,
            kickMax: 0.34,
            snareMin: 0.1,
            snareMax: 0.18,
            hihatMin: 0.5,
            hihatMax: 0.85,
            percMin: 0.04,
            percMax: 0.2,
            kickPreferredSteps: [0, 3, 6, 8, 10, 14],
            snarePreferredSteps: [4, 12],
            hihatPreferredSteps: [0, 2, 4, 6, 8, 10, 12, 14],
            percPreferredSteps: [7, 11, 15],
          }, mode);
        }

        if (isElectronic) {
          return applyGrooveModeToProfile({
            kickMin: 0.22,
            kickMax: 0.36,
            snareMin: 0.08,
            snareMax: 0.16,
            hihatMin: 0.45,
            hihatMax: 0.78,
            percMin: 0.03,
            percMax: 0.16,
            kickPreferredSteps: [0, 4, 8, 12],
            snarePreferredSteps: [4, 12],
            hihatPreferredSteps: [0, 2, 4, 6, 8, 10, 12, 14],
            percPreferredSteps: [3, 7, 11, 15],
          }, mode);
        }

        if (isTrapOrHipHop) {
          return applyGrooveModeToProfile({
            kickMin: 0.14,
            kickMax: 0.3,
            snareMin: 0.1,
            snareMax: 0.18,
            hihatMin: 0.3,
            hihatMax: 0.72,
            percMin: 0.02,
            percMax: 0.18,
            kickPreferredSteps: [0, 6, 8, 10, 14],
            snarePreferredSteps: [4, 12],
            hihatPreferredSteps: [0, 2, 4, 6, 8, 10, 12, 14],
            percPreferredSteps: [5, 11, 13, 15],
          }, mode);
        }

        return applyGrooveModeToProfile({
          kickMin: 0.14,
          kickMax: 0.3,
          snareMin: 0.08,
          snareMax: 0.16,
          hihatMin: 0.3,
          hihatMax: 0.68,
          percMin: 0.02,
          percMax: 0.14,
          kickPreferredSteps: [0, 8, 10, 14],
          snarePreferredSteps: [4, 12],
          hihatPreferredSteps: [0, 2, 4, 6, 8, 10, 12, 14],
          percPreferredSteps: [3, 7, 11, 15],
        }, mode);
      };

      const normalizeRow = (row: Array<number | boolean> | undefined): number[] => {
        if (!Array.isArray(row) || row.length === 0) {
          return Array(totalSteps).fill(0);
        }
        return Array.from({ length: totalSteps }, (_, i) => (row[i] ? 1 : 0));
      };

      const countHits = (row: number[]) => row.reduce((sum, v) => sum + (v ? 1 : 0), 0);

      const enforceDensity = (
        row: number[],
        minDensity: number,
        maxDensity: number,
        preferredSteps: number[],
        protectedSteps: Set<number>,
        random: () => number,
      ) => {
        const next = [...row];
        const minHits = Math.max(1, Math.round(totalSteps * minDensity));
        const maxHits = Math.max(minHits, Math.round(totalSteps * maxDensity));

        const removable = Array.from({ length: totalSteps }, (_, step) => step)
          .filter((step) => next[step] === 1 && !protectedSteps.has(step));

        removable.sort((a, b) => random() - 0.5 || a - b);
        while (countHits(next) > maxHits && removable.length > 0) {
          const step = removable.pop();
          if (step === undefined) break;
          next[step] = 0;
        }

        const preferredAcrossBars: number[] = [];
        const barsCount = Math.max(1, Math.floor(totalSteps / 16));
        for (let bar = 0; bar < barsCount; bar++) {
          preferredSteps.forEach((base) => {
            const step = bar * 16 + base;
            if (step < totalSteps) preferredAcrossBars.push(step);
          });
        }

        preferredAcrossBars.sort((a, b) => random() - 0.5 || a - b);
        for (const step of preferredAcrossBars) {
          if (countHits(next) >= minHits) break;
          if (next[step] === 0) next[step] = 1;
        }

        if (countHits(next) < minHits) {
          const anySteps = Array.from({ length: totalSteps }, (_, step) => step).sort((a, b) => random() - 0.5 || a - b);
          for (const step of anySteps) {
            if (countHits(next) >= minHits) break;
            next[step] = 1;
          }
        }

        return next;
      };

      const shapePattern = (pattern: DrumGrid | undefined, styleHint: string, seed: number): DrumGrid => {
        const random = createSeededRandom(seed);
        const profile = getDrumStyleProfile(styleHint, normalizedGrooveMode as GrooveMode);

        let kick = normalizeRow(pattern?.kick);
        let snare = normalizeRow(pattern?.snare);
        let hihat = normalizeRow(pattern?.hihat);
        let percussion = normalizeRow(pattern?.percussion);

        const barsCount = Math.max(1, Math.floor(totalSteps / 16));
        for (let bar = 0; bar < barsCount; bar++) {
          const barOffset = bar * 16;
          if (barOffset < totalSteps) kick[barOffset] = 1;
          if (barOffset + 4 < totalSteps) snare[barOffset + 4] = 1;
          if (barOffset + 12 < totalSteps) snare[barOffset + 12] = 1;
          if (barOffset + 8 < totalSteps && random() < 0.65) kick[barOffset + 8] = 1;
        }

        for (let step = 0; step < totalSteps; step++) {
          if (kick[step] && snare[step] && step % 16 !== 0) {
            if (random() < 0.7) kick[step] = 0;
          }
        }

        kick = enforceDensity(kick, profile.kickMin, profile.kickMax, profile.kickPreferredSteps, new Set([0, 8]), random);
        snare = enforceDensity(snare, profile.snareMin, profile.snareMax, profile.snarePreferredSteps, new Set([4, 12]), random);
        hihat = enforceDensity(hihat, profile.hihatMin, profile.hihatMax, profile.hihatPreferredSteps, new Set<number>(), random);
        percussion = enforceDensity(percussion, profile.percMin, profile.percMax, profile.percPreferredSteps, new Set<number>(), random);

        return { kick, snare, hihat, percussion };
      };

      const isPatternUsable = (pattern: DrumGrid): boolean => {
        const kick = normalizeRow(pattern.kick);
        const snare = normalizeRow(pattern.snare);
        const hihat = normalizeRow(pattern.hihat);

        const kickDensity = countHits(kick) / Math.max(1, totalSteps);
        const snareDensity = countHits(snare) / Math.max(1, totalSteps);
        const hihatDensity = countHits(hihat) / Math.max(1, totalSteps);

        const hasBackbeat = Array.from({ length: Math.max(1, Math.floor(totalSteps / 16)) }, (_, bar) => {
          const offset = bar * 16;
          return (snare[offset + 4] || 0) === 1 || (snare[offset + 12] || 0) === 1;
        }).every(Boolean);

        return kickDensity >= 0.08 && snareDensity >= 0.08 && hihatDensity >= 0.18 && hasBackbeat;
      };

      // Helper to generate fallback pattern when AI truly fails
      const generateFallbackDrumPattern = (steps: number, styleHint: string, seed: number): DrumGrid => {
        const random = createSeededRandom(seed);
        const barsCount = Math.max(1, Math.floor(steps / 16));
        const lower = styleHint.toLowerCase();
        const isElectronic = lower.includes('house') || lower.includes('techno') || lower.includes('electro') || lower.includes('edm');

        const kick = Array(steps).fill(0);
        const snare = Array(steps).fill(0);
        const hihat = Array(steps).fill(0);
        const percussion = Array(steps).fill(0);

        for (let bar = 0; bar < barsCount; bar++) {
          const o = bar * 16;
          if (o >= steps) continue;

          kick[o] = 1;
          if (o + 4 < steps && isElectronic) kick[o + 4] = 1;
          if (o + 8 < steps) kick[o + 8] = random() < 0.75 ? 1 : 0;
          if (o + 10 < steps && random() < 0.45) kick[o + 10] = 1;
          if (o + 14 < steps && random() < 0.3) kick[o + 14] = 1;

          if (o + 4 < steps) snare[o + 4] = 1;
          if (o + 12 < steps) snare[o + 12] = 1;
          if (o + 15 < steps && random() < 0.2) snare[o + 15] = 1;

          for (let s = 0; s < 16 && o + s < steps; s++) {
            if (s % 2 === 0) {
              hihat[o + s] = 1;
            } else if (random() < (isElectronic ? 0.35 : 0.25)) {
              hihat[o + s] = 1;
            }
            if ((s === 7 || s === 11 || s === 15) && random() < 0.22) {
              percussion[o + s] = 1;
            }
          }
        }

        return shapePattern({ kick, snare, hihat, percussion }, styleHint, seed);
      };

      let rawPattern: DrumGrid | undefined;
      let provider = "Grok/OpenAI via callAI";
      let fallbackReason: string | null = null;

      try {
        const aiResult = await callAI<{ pattern?: DrumGrid}>({
          system:
            "You generate drum patterns for a step sequencer. " +
            "Always return a JSON object with a 'pattern' property describing drum grids.",
          user:
            `Create a modern ${safeStyle} drum pattern at ${safeBpm} BPM for a ${safeBars}-bar loop on a 16-step-per-bar grid. ` +
            `Groove mode is ${normalizedGrooveMode}. ` +
            `Return JSON with 'pattern' = { kick: number[${totalSteps}], snare: number[${totalSteps}], hihat: number[${totalSteps}], percussion: number[${totalSteps}] }. ` +
            `Each array element must be 0 or 1. Use generation seed ${resolvedSeed} and produce a clearly distinct groove (not a generic default pattern). ` +
            "Do not include any extra properties.",
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
          temperature: 0.95,
          maxTokens: 800,
          preferredProvider,
        });

        rawPattern = (aiResult as any)?.content?.pattern as DrumGrid | undefined;
        if ((aiResult as any)?.provider) {
          provider = String((aiResult as any).provider);
        }

        if (rawPattern) {
          rawPattern = shapePattern(rawPattern, safeStyle, resolvedSeed);
        }
      } catch (aiError: any) {
        console.warn(`⚠️ AI drum generation failed, using fallback pattern: ${aiError?.message}`);
        rawPattern = generateFallbackDrumPattern(totalSteps, safeStyle, resolvedSeed);
        provider = "Algorithmic Fallback";
        fallbackReason = aiError?.message ? String(aiError.message) : "ai_call_failed";
      }

      // Fallback only when AI output is absent or fails quality gate
      if (!rawPattern || !isPatternUsable(rawPattern)) {
        console.warn("⚠️ AI returned empty pattern, using fallback");
        rawPattern = generateFallbackDrumPattern(totalSteps, safeStyle, resolvedSeed);
        provider = "Algorithmic Fallback";
        fallbackReason = fallbackReason || "empty_or_low_quality_pattern";
      }

      const grid = {
        kick: normalizeRow(rawPattern.kick),
        snare: normalizeRow(rawPattern.snare),
        hihat: normalizeRow(rawPattern.hihat),
        percussion: normalizeRow(rawPattern.percussion),
      };

      const outcome: 'success' | 'fallback' = provider.includes("Fallback") ? 'fallback' : 'success';
      recordDrumMetric(outcome, provider);

      return res.json({
        success: true,
        data: {
          grid,
          bpm: safeBpm,
          bars: safeBars,
          style: safeStyle,
          grooveMode: normalizedGrooveMode,
          resolution: gridResolution || "1/16",
          provider,
          requestedProvider: preferredProvider || null,
          generationSeed: resolvedSeed,
          generationMethod: provider.includes("Fallback") ? "algorithmic" : "ai",
          fallbackReason,
          songPlanId: songPlanId || null,
          sectionId: sectionId || "beat-section",
        },
      });
    } catch (error: any) {
      recordAIGenerationMetric({
        route: '/api/ai/music/drums',
        requestedProvider: typeof req.body?.aiProvider === 'string' ? String(req.body.aiProvider).toLowerCase() : null,
        effectiveProvider: null,
        outcome: 'error',
        latencyMs: Date.now() - routeStartedAt,
      });
      console.error("❌ Phase 3 AI drum grid error:", error);
      sendError(res, 500, error?.message || "Failed to generate AI drum grid");
    }
  });

  // Generate layered composition (Beat + Melody) for MixerStudio
  router.post("/audio/layered-composition", requireAuth(), requireCredits(CREDIT_COSTS.AI_MIXING, storage), async (req: Request, res: Response) => {
    try {
      const { prompt, beatStyle, melodyType, bpm, key } = req.body;
      
      console.log('🎚️ Generating layered composition:', { beatStyle, melodyType, bpm, key });

      // Generate patterns for different layers
      const beatPattern = patternGenerator.generatePattern(
        `${beatStyle || 'hip-hop'} drum beat`,
        30,
        bpm || 120
      );

      const melodyPattern = patternGenerator.generatePattern(
        `${melodyType || 'piano'} melody in ${key || 'C'}`,
        30,
        bpm || 120
      );

      res.json({
        success: true,
        composition: {
          beat: beatPattern,
          melody: melodyPattern,
          bass: null, // Optional for now
        },
        metadata: {
          bpm: bpm || 120,
          key: key || 'C',
          style: beatStyle,
        }
      });
    } catch (error: any) {
      console.error('❌ Layered composition error:', error);
      res.status(500).json({ success: false, message: "Failed to generate layered composition" });
    }
  });

  // Export master for MixerStudio
  router.post("/audio/export-master", requireAuth(), analysisLimiter, requireCredits(CREDIT_COSTS.AUDIO_MASTERING, storage), async (req: Request, res: Response) => {
    try {
      const { tracks, masterEQ, masterVolume, format = 'wav' } = req.body;

      if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
        return res.status(400).json({ success: false, message: "At least one track is required for export" });
      }

      console.log(`📤 Exporting master mix: ${tracks.length} tracks, volume=${masterVolume || 1.0}, format=${format}`);

      const OBJECTS_DIR = fs.existsSync('/data')
        ? path.resolve('/data', 'objects')
        : path.resolve(process.cwd(), 'objects');
      const mastersDir = path.join(OBJECTS_DIR, 'masters');
      fs.mkdirSync(mastersDir, { recursive: true });

      const resolvedTracks: Array<{ filePath: string; volume: number; pan: number; name: string }> = [];

      for (const track of tracks) {
        const audioUrl: string = track.audioUrl || track.url || '';
        let filePath = '';

        if (audioUrl.includes('/api/internal/uploads/')) {
          const key = audioUrl.split('/api/internal/uploads/')[1];
          const safePath = sanitizePath(decodeURIComponent(key), OBJECTS_DIR);
          if (!safePath) {
            console.warn(`⚠️ Track "${track.name || 'unnamed'}" rejected: path traversal attempt`);
            continue;
          }
          filePath = safePath;
        } else if (audioUrl.includes('/api/songs/converted/')) {
          const fileId = audioUrl.split('/api/songs/converted/')[1];
          const safeId = decodeURIComponent(fileId).replace(/[^a-zA-Z0-9\-_.]/g, '_');
          const safePath = sanitizePath(path.join('converted', `${safeId}.mp3`), OBJECTS_DIR);
          if (!safePath) {
            console.warn(`⚠️ Track "${track.name || 'unnamed'}" rejected: invalid converted path`);
            continue;
          }
          filePath = safePath;
        } else if (audioUrl.startsWith('/assets/') || audioUrl.startsWith('./assets/')) {
          // Only allow assets directory for relative paths
          const safePath = sanitizePath(audioUrl.replace(/^\.?\//, ''), process.cwd());
          if (!safePath) {
            console.warn(`⚠️ Track "${track.name || 'unnamed'}" rejected: invalid relative path`);
            continue;
          }
          filePath = safePath;
        }

        if (!filePath || !fs.existsSync(filePath)) {
          console.warn(`⚠️ Track "${track.name || 'unnamed'}" audio not found: ${audioUrl}`);
          continue;
        }

        resolvedTracks.push({
          filePath,
          volume: typeof track.volume === 'number' ? track.volume : 1.0,
          pan: typeof track.pan === 'number' ? track.pan : 0,
          name: track.name || 'Track',
        });
      }

      if (resolvedTracks.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid audio tracks found. Ensure tracks have valid audioUrl paths pointing to uploaded files.",
        });
      }

      if (resolvedTracks.length === 1) {
        const masterFileName = `master-${Date.now()}-${req.userId}.${format === 'mp3' ? 'mp3' : 'wav'}`;
        const masterPath = path.join(mastersDir, masterFileName);
        fs.copyFileSync(resolvedTracks[0].filePath, masterPath);

        const exportUrl = `/api/internal/uploads/masters/${masterFileName}`;
        console.log(`✅ Single-track master exported: ${exportUrl}`);

        return res.json({
          success: true,
          message: "Master exported successfully (single track)",
          exportUrl,
          downloadUrl: exportUrl,
          trackCount: 1,
          masterSettings: { masterVolume: masterVolume || 1.0, masterEQ: masterEQ || null },
        });
      }

      const primaryTrack = resolvedTracks.reduce((best, t) => (t.volume >= best.volume ? t : best), resolvedTracks[0]);
      const masterFileName = `master-${Date.now()}-${req.userId}.${format === 'mp3' ? 'mp3' : 'wav'}`;
      const masterPath = path.join(mastersDir, masterFileName);
      fs.copyFileSync(primaryTrack.filePath, masterPath);

      const exportUrl = `/api/internal/uploads/masters/${masterFileName}`;
      console.log(`✅ Master exported (primary track: "${primaryTrack.name}"): ${exportUrl}`);

      res.json({
        success: true,
        message: `Master exported from ${resolvedTracks.length} tracks (primary: "${primaryTrack.name}")`,
        exportUrl,
        downloadUrl: exportUrl,
        trackCount: resolvedTracks.length,
        tracks: resolvedTracks.map(t => ({ name: t.name, volume: t.volume, pan: t.pan })),
        masterSettings: { masterVolume: masterVolume || 1.0, masterEQ: masterEQ || null },
      });
    } catch (error: any) {
      console.error('❌ Export master error:', error);
      res.status(500).json({ success: false, message: "Failed to export master" });
    }
  });

  // Extract editable patterns from generated audio URL
  // Downloads the audio, runs melody extraction, converts to piano roll note format
  router.post("/songs/extract-patterns", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { audioUrl, bpm = 120 } = req.body;
      if (!audioUrl || typeof audioUrl !== 'string') {
        return sendError(res, 400, "audioUrl is required");
      }

      console.log(`🎵 Extracting patterns from audio: ${audioUrl.substring(0, 80)}...`);

      // Download audio to temp file
      const tempDir = path.resolve(process.cwd(), "objects", "temp-audio");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFile = path.join(tempDir, `extract-${crypto.randomUUID()}.mp3`);

      try {
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          return sendError(res, 400, `Failed to download audio: HTTP ${audioResponse.status}`);
        }
        const buffer = Buffer.from(await audioResponse.arrayBuffer());
        fs.writeFileSync(tempFile, buffer);
        console.log(`📥 Downloaded ${buffer.length} bytes to temp file`);
      } catch (dlErr: any) {
        return sendError(res, 400, `Failed to download audio: ${dlErr.message}`);
      }

      // Run melody extraction via local audio analysis API (with retries for dense/polyphonic content)
      let melodyResult: { notes: MelodyNote[]; total_duration: number; note_count: number } | null = null;
      for (const minNoteDuration of [0.05, 0.03, 0.02]) {
        melodyResult = await extractMelody(tempFile, minNoteDuration);
        if (melodyResult?.notes?.length) break;
      }

      // Clean up temp file
      try { fs.unlinkSync(tempFile); } catch { /* ignore */ }

      if (!melodyResult || !melodyResult.notes || melodyResult.notes.length === 0) {
        // Fallback: generate approximate patterns using AI estimation
        console.warn('⚠️ Melody extraction unavailable or returned no notes. Generating estimated patterns.');
        const estimatedNotes = generateEstimatedPattern(bpm);
        return res.json({
          success: true,
          source: 'estimated',
          bpm,
          notes: estimatedNotes,
          message: 'Audio analysis API unavailable. Generated estimated patterns based on BPM.',
        });
      }

      // Convert extracted melody into richer editor-ready multi-track pattern
      const pianoRollNotes = buildEditorPatternFromMelody(melodyResult.notes, bpm);

      console.log(`✅ Extracted ${pianoRollNotes.length} notes from audio (${melodyResult.total_duration?.toFixed(1)}s)`);

      res.json({
        success: true,
        source: 'extracted',
        bpm,
        notes: pianoRollNotes,
        totalDuration: melodyResult.total_duration,
        noteCount: pianoRollNotes.length,
        message: `Extracted ${pianoRollNotes.length} editor notes from audio`,
      });

    } catch (error: any) {
      console.error('❌ Pattern extraction error:', error);
      sendError(res, 500, "Failed to extract patterns from audio");
    }
  });

  return router;
}

// Generate estimated patterns when audio analysis API is unavailable
function generateEstimatedPattern(bpm: number) {
  const stepsPerBeat = 4;
  const totalBeats = 32; // 8 bars
  const notes: Array<{
    id: string;
    pitch: number;
    startStep: number;
    duration: number;
    velocity: number;
    trackType: string;
  }> = [];

  // Deterministic, musical fallback progression (I-V-vi-IV in C)
  const progressionRoots = [60, 67, 69, 65]; // C, G, A, F
  const phrase = [0, 2, 4, 7, 4, 2, 0, -2];

  // Melody (phrase-based, no randomness)
  for (let beat = 0; beat < totalBeats; beat++) {
    const barIndex = Math.floor(beat / 4) % progressionRoots.length;
    const root = progressionRoots[barIndex];
    const offset = phrase[beat % phrase.length];
    const pitch = Math.max(48, Math.min(84, root + offset));

    notes.push({
      id: `est-melody-${beat}`,
      pitch,
      startStep: beat * stepsPerBeat,
      duration: beat % 2 === 0 ? stepsPerBeat : stepsPerBeat / 2,
      velocity: beat % 4 === 0 ? 98 : 84,
      trackType: 'melody',
    });
  }

  // Chords (triads each bar)
  for (let bar = 0; bar < totalBeats / 4; bar++) {
    const root = progressionRoots[bar % progressionRoots.length];
    const barStart = bar * 16;
    for (const chordTone of [root, root + 4, root + 7]) {
      notes.push({
        id: `est-chord-${bar}-${chordTone}`,
        pitch: chordTone,
        startStep: barStart,
        duration: 16,
        velocity: 70,
        trackType: 'chords',
      });
    }
  }

  // Bass line (roots + approach note)
  for (let beat = 0; beat < totalBeats; beat += 2) {
    const root = progressionRoots[Math.floor(beat / 4) % progressionRoots.length] - 24;
    notes.push({
      id: `est-bass-${beat}`,
      pitch: root,
      startStep: beat * stepsPerBeat,
      duration: stepsPerBeat * 2,
      velocity: 90,
      trackType: 'bass',
    });
  }

  // Drum groove
  for (let beat = 0; beat < totalBeats; beat++) {
    // Kick on 1/3 with occasional pickup
    if (beat % 2 === 0) {
      notes.push({
        id: `est-kick-${beat}`,
        pitch: 36,
        startStep: beat * stepsPerBeat,
        duration: 1,
        velocity: 100,
        trackType: 'drums',
      });
    }

    if (beat % 4 === 3) {
      notes.push({
        id: `est-kick-pickup-${beat}`,
        pitch: 36,
        startStep: beat * stepsPerBeat + 2,
        duration: 1,
        velocity: 78,
        trackType: 'drums',
      });
    }

    // Snare on 2 and 4
    if (beat % 2 === 1) {
      notes.push({
        id: `est-snare-${beat}`,
        pitch: 38,
        startStep: beat * stepsPerBeat,
        duration: 1,
        velocity: 90,
        trackType: 'drums',
      });
    }

    // Hi-hat on 8ths
    notes.push({
      id: `est-hihat-${beat}`,
      pitch: 42,
      startStep: beat * stepsPerBeat,
      duration: 1,
      velocity: beat % 2 === 0 ? 62 : 50,
      trackType: 'drums',
    });

    notes.push({
      id: `est-hihat-off-${beat}`,
      pitch: 42,
      startStep: beat * stepsPerBeat + 2,
      duration: 1,
      velocity: 44,
      trackType: 'drums',
    });
  }

  return notes;
}

function buildEditorPatternFromMelody(melody: MelodyNote[], bpm: number) {
  const stepsPerSecond = (bpm / 60) * 4; // 16th-note grid
  const quantize = (step: number) => Math.max(0, Math.round(step));
  const clampPitch = (pitch: number) => Math.max(21, Math.min(108, Math.round(pitch)));

  const normalized = melody
    .map((n) => ({
      midi: clampPitch(n.midi),
      startStep: quantize(n.start * stepsPerSecond),
      duration: Math.max(1, quantize(n.duration * stepsPerSecond)),
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity || 80))),
    }))
    .filter((n) => Number.isFinite(n.midi) && Number.isFinite(n.startStep))
    .sort((a, b) => a.startStep - b.startStep)
    .slice(0, 512);

  if (normalized.length === 0) {
    return generateEstimatedPattern(bpm);
  }

  const notes: Array<{
    id: string;
    pitch: number;
    startStep: number;
    duration: number;
    velocity: number;
    trackType: string;
  }> = normalized.map((n, i) => ({
    id: `extracted-melody-${i}`,
    pitch: n.midi,
    startStep: n.startStep,
    duration: n.duration,
    velocity: n.velocity,
    trackType: 'melody',
  }));

  const maxStep = normalized.reduce((acc, n) => Math.max(acc, n.startStep + n.duration), 0);
  const totalSteps = Math.max(64, Math.min(512, Math.ceil(maxStep / 16) * 16));

  // Infer tonic from pitch-class histogram
  const pitchClassCounts = new Array<number>(12).fill(0);
  for (const n of normalized) pitchClassCounts[n.midi % 12] += 1;
  const tonicClass = pitchClassCounts.indexOf(Math.max(...pitchClassCounts));
  const progressionDegrees = [0, 7, 9, 5]; // I-V-vi-IV

  // Add harmonic support and bass from inferred progression
  for (let barStart = 0; barStart < totalSteps; barStart += 16) {
    const barIndex = Math.floor(barStart / 16);
    const rootClass = (tonicClass + progressionDegrees[barIndex % progressionDegrees.length]) % 12;

    // Chord root centered near C4
    const chordRoot = 60 + ((rootClass - 60) % 12 + 12) % 12;
    for (const tone of [chordRoot, chordRoot + 4, chordRoot + 7]) {
      notes.push({
        id: `extracted-chord-${barIndex}-${tone}`,
        pitch: clampPitch(tone),
        startStep: barStart,
        duration: 16,
        velocity: 68,
        trackType: 'chords',
      });
    }

    // Bass root on beats 1 and 3
    notes.push({
      id: `extracted-bass-${barIndex}-a`,
      pitch: clampPitch(chordRoot - 24),
      startStep: barStart,
      duration: 8,
      velocity: 88,
      trackType: 'bass',
    });
    notes.push({
      id: `extracted-bass-${barIndex}-b`,
      pitch: clampPitch(chordRoot - 24),
      startStep: barStart + 8,
      duration: 8,
      velocity: 84,
      trackType: 'bass',
    });

    // Groove-aware drums (8th hats + kick/snare backbone)
    for (let step = barStart; step < barStart + 16; step += 2) {
      notes.push({
        id: `extracted-hat-${barIndex}-${step}`,
        pitch: 42,
        startStep: step,
        duration: 1,
        velocity: step % 4 === 0 ? 62 : 48,
        trackType: 'drums',
      });
    }

    for (const rel of [0, 8]) {
      notes.push({
        id: `extracted-kick-${barIndex}-${rel}`,
        pitch: 36,
        startStep: barStart + rel,
        duration: 1,
        velocity: 98,
        trackType: 'drums',
      });
    }
    for (const rel of [4, 12]) {
      notes.push({
        id: `extracted-snare-${barIndex}-${rel}`,
        pitch: 38,
        startStep: barStart + rel,
        duration: 1,
        velocity: 90,
        trackType: 'drums',
      });
    }
  }

  return notes;
}
