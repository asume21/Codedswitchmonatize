import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { unifiedMusicService } from "../services/unifiedMusicService";
import { patternGenerator } from "../services/patternGenerator";
import { generateBassLine } from "../services/bassGenerator";
import { callAI } from "../services/aiGateway";

const router = Router();

const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, message });
};

export function createAudioRoutes() {
  // Professional song generation endpoint (Suno via Replicate)
  router.post("/songs/generate-professional", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, mood, duration, style, vocals, bpm, key } = req.body;
      
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
  router.post("/songs/generate-beat", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, duration, style, energy } = req.body;
      
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
  router.post("/songs/generate-instrumental", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, duration, instruments, energy } = req.body;
      
      if (!prompt) {
        return sendError(res, 400, "Missing prompt");
      }

      console.log('🎹 Generating instrumental with MusicGen via Replicate...');
      
      const result = await unifiedMusicService.generateTrack(prompt, {
        type: 'instrumental',
        instrument: (instruments || ['piano', 'guitar', 'bass', 'drums']).join(', '),
        genre: genre || 'pop',
        duration: duration || 60,
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
  router.post("/songs/blend-genres", async (req: Request, res: Response) => {
    try {
      const { primaryGenre, secondaryGenres, prompt } = req.body;
      
      if (!primaryGenre || !secondaryGenres || !prompt) {
        return sendError(res, 400, "Missing required parameters");
      }

      console.log('🎭 Blending genres with MusicGen via Replicate...');
      
      const result = await unifiedMusicService.blendGenres(primaryGenre, secondaryGenres, prompt);

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
  router.post("/songs/generate-drums", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, bpm, duration } = req.body;
      
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
  router.post("/songs/generate-melody", async (req: Request, res: Response) => {
    try {
      const { prompt, genre, key, duration, instrument } = req.body;
      
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
  router.post("/music/generate-bass", async (req: Request, res: Response) => {
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

  // Phase 3: AI Bassline endpoint
  router.post("/ai/music/bass", async (req: Request, res: Response) => {
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
          generationMethod: provider.includes("Fallback") ? "algorithmic" : "ai",
          songPlanId: songPlanId || null,
          sectionId: sectionId || "beat-section",
        },
      });
    } catch (error: any) {
      console.error("❌ Phase 3 AI drum grid error:", error);
      sendError(res, 500, error?.message || "Failed to generate AI drum grid");
    }
  });

  return router;
}
