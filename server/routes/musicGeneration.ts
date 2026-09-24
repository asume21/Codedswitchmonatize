// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireCredits } from "../middleware/requireCredits";
import { callAI } from "../services/aiGateway";
import { recordAIGenerationMetric } from "../services/aiRouteMetrics";
import { CREDIT_COSTS, getCreditService } from "../services/credits";
import { generateMelody, getAIClient } from "../services/grok";
import { unifiedMusicService } from "../services/unifiedMusicService";
import { resolveGenerationConstraints } from "@shared/aiProviderCapabilities";
import crypto from "crypto";
import { z } from "zod";
import { LOCAL_OBJECTS_DIR, aiLimiter, polishGeneratedAudio, sendError } from "./common";
import type { IStorage } from "../storage";

export function createMusicGenerationRoutes(storage: IStorage) {
  const router = Router();
  // ============================================
  // CHORD GENERATION ENDPOINT — local, deterministic, instant.
  // No GPT call. See server/services/chordEngine.ts.
  // ============================================
  router.post("/api/chords", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
    try {
      const { key = 'C', mood = 'happy', userId = 'anonymous' } = req.body;

      console.log(`🎵 Local chord generation: key=${key}, mood=${mood}`);

      const { generateChordProgression } = await import('../services/chordEngine');
      const result = generateChordProgression(key, mood);

      try {
        const sessionUserId = req.userId || userId;
        const { db } = await import('../db');
        const { sql: rawSql } = await import('drizzle-orm');
        await db.execute(rawSql`
          INSERT INTO ai_sessions (user_id, prompt, result, created_at)
          VALUES (${sessionUserId}, ${`chords key=${key} mood=${mood}`}, ${JSON.stringify(result)}::jsonb, NOW())
        `);
      } catch (dbError) {
        console.warn('AI session logging skipped:', (dbError as Error).message);
      }

      console.log(`🎵 Generated chords: ${result.chords.join(' - ')} (${result.progression})`);

      res.json({
        success: true,
        chords: result.chords,
        progression: result.progression,
        key: result.key,
        mood: result.mood,
      });
    } catch (error) {
      console.error('Chord generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Chord generation failed',
        chords: ['C', 'Am', 'F', 'G'],
        progression: 'I-vi-IV-V',
      });
    }
  });

  router.post("/api/beats/generate", requireAuth(), async (req: Request, res: Response) => {
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
        // Only deduct credits if payment method was credits (not subscription).
        //
        // Was storage.updateUserCredits(-BEAT_COST), which bypassed the credit
        // service entirely and cost two guarantees:
        //   1. NO LEDGER ROW. updateUserCredits moves users.credits and
        //      totalCreditsSpent but never calls logCreditTransaction, so the
        //      balance dropped with nothing in the user's history explaining why —
        //      transaction log and balance permanently disagree.
        //   2. NO OVERDRAFT PROTECTION. It floors with GREATEST(0, ...), so a user
        //      with fewer credits than the cost silently lands on 0 instead of
        //      being refused. deductCredits uses atomicDeductCredits, a single
        //      UPDATE ... WHERE credits >= amount, which also closes the TOCTOU
        //      race between the balance check above and this write.
        let remainingCredits = userCredits;
        if (paymentMethod === 'credits') {
          const tx = await getCreditService(storage).deductCredits(
            req.userId!, BEAT_COST, 'beat_generation', { model: 'musicgen' },
          );
          remainingCredits = tx.balanceAfter;
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
  router.post("/api/melody/generate", requireAuth(), async (req: Request, res: Response) => {
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
        // Only deduct credits if payment method was credits (not subscription).
        // Same bypass as the beat route above — no ledger row and no overdraft
        // protection. Routed through the credit service so the deduction is
        // atomic and shows up in the user's transaction history.
        let remainingCredits = userCredits;
        if (paymentMethod === 'credits') {
          const tx = await getCreditService(storage).deductCredits(
            req.userId!, MELODY_COST, 'melody_generation', { model: 'replicate' },
          );
          remainingCredits = tx.balanceAfter;
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
  router.post("/api/ai/music/melody", requireAuth(), async (req: Request, res: Response) => {
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
          generationMethod: provider.includes("Fallback") ? "algorithmic" : "ai",
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
  // ============================================
  // AI VOCAL MELODY FROM LYRICS ENDPOINT
  // Generates singable melody matching lyric rhythm
  // ============================================
  router.post("/api/ai/vocal-melody", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
    try {
      const {
        lyrics,
        key = "C",
        bpm = 120,
        mood = "uplifting",
        vocalRange = "tenor"
      } = req.body;

      if (!lyrics || typeof lyrics !== 'string' || lyrics.trim().length < 3) {
        return sendError(res, 400, "Lyrics are required (at least 3 characters)");
      }

      const prompt = `You are a professional topline writer. Generate a singable melody for these lyrics.

Lyrics: "${lyrics}"
Key: ${key}
BPM: ${bpm}
Mood: ${mood}
Vocal Range: ${vocalRange}

Analyze the syllables and create a melody that:
1. Matches the natural speech rhythm of the words
2. Has memorable hooks on key phrases
3. Stays within a comfortable vocal range
4. Uses appropriate note durations for each syllable

Return in this exact JSON format:
{
  "syllables": [
    { "text": "I'm", "syllableCount": 1 },
    { "text": "walk-ing", "syllableCount": 2 }
  ],
  "notes": [
    { "pitch": "C4", "duration": 0.5, "time": 0, "syllable": "I'm", "velocity": 0.8 },
    { "pitch": "D4", "duration": 0.25, "time": 0.5, "syllable": "walk", "velocity": 0.9 },
    { "pitch": "E4", "duration": 0.25, "time": 0.75, "syllable": "ing", "velocity": 0.7 }
  ],
  "vocalRange": { "low": "A3", "high": "E5" },
  "keySignature": "${key}",
  "contour": "ascending",
  "singabilityScore": 8,
  "tips": ["Breathe after 'walking'", "Emphasis on 'I'm'"]
}`;

      const aiClient = getAIClient();
      let melodyData: any = null;

      if (aiClient) {
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a Grammy-winning songwriter who creates memorable vocal melodies. Match melodies perfectly to lyric rhythm." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          });

          const response = completion.choices[0]?.message?.content;
          if (response) {
            const jsonMatch = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              melodyData = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiError: any) {
          console.warn("AI vocal melody failed:", aiError.message);
        }
      }

      if (!melodyData) {
        const words = lyrics.split(/\s+/).filter((w: string) => w.length > 0);
        const scale = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
        let time = 0;
        const notes = words.map((word: string, i: number) => {
          const pitch = scale[i % scale.length];
          const duration = 0.5;
          const note = { pitch, duration, time, syllable: word, velocity: 0.8 };
          time += duration;
          return note;
        });

        melodyData = {
          syllables: words.map((w: string) => ({ text: w, syllableCount: 1 })),
          notes,
          vocalRange: { low: "C4", high: "C5" },
          keySignature: key,
          contour: "varied",
          singabilityScore: 6,
          tips: ["This is a basic algorithmic melody - AI enhancement recommended"]
        };
      }

      res.json({
        success: true,
        melody: melodyData,
        lyrics,
        key,
        bpm,
        provider: aiClient ? "AI" : "Algorithmic Fallback"
      });

    } catch (error: any) {
      console.error("Vocal melody generation error:", error);
      sendError(res, 500, error.message || "Failed to generate vocal melody");
    }
  });

  // ============================================
  // AI CHORD PROGRESSION BY MOOD ENDPOINT
  // ============================================
  router.post("/api/ai/chord-progression", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
    try {
      const {
        key = "C",
        mood = "happy",
        genre = "pop",
        bars = 8
      } = req.body;

      const prompt = `Generate a ${bars}-bar chord progression in ${key} with a ${mood} feel for ${genre} music.

Return ONLY valid JSON:
{
  "chords": ["C", "Am", "F", "G"],
  "progression": "I-vi-IV-V",
  "bars": ${bars},
  "emotionalImpact": 8,
  "variations": [
    { "name": "Jazz", "chords": ["Cmaj7", "Am9", "Fmaj7", "G7"] },
    { "name": "Minimal", "chords": ["C", "F", "G", "C"] }
  ],
  "bassNotes": ["C", "A", "F", "G"],
  "tips": ["Add 7ths for sophistication", "Try inversions for smoother bass line"]
}`;

      const aiClient = getAIClient();
      let chordData: any = null;

      if (aiClient) {
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a music theory expert and composer. Create emotionally impactful chord progressions." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000,
          });

          const response = completion.choices[0]?.message?.content;
          if (response) {
            const jsonMatch = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              chordData = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiError: any) {
          console.warn("AI chord progression failed:", aiError.message);
        }
      }

      if (!chordData) {
        const moodProgressions: Record<string, string[]> = {
          happy: ["C", "G", "Am", "F"],
          sad: ["Am", "F", "C", "G"],
          energetic: ["C", "F", "Am", "G"],
          calm: ["C", "Am", "F", "G"],
          dark: ["Am", "Dm", "E", "Am"],
          uplifting: ["C", "G", "Am", "Em", "F", "C", "F", "G"]
        };
        
        const chords = moodProgressions[mood.toLowerCase()] || moodProgressions.happy;
        chordData = {
          chords: chords.slice(0, bars),
          progression: "I-V-vi-IV",
          bars,
          emotionalImpact: 7,
          variations: [],
          bassNotes: chords.slice(0, bars).map((c: string) => c.charAt(0)),
          tips: ["Experiment with inversions", "Add sus4 for tension"]
        };
      }

      res.json({
        success: true,
        chords: chordData,
        key,
        mood,
        genre,
        provider: aiClient ? "AI" : "Fallback"
      });

    } catch (error: any) {
      console.error("Chord progression error:", error);
      sendError(res, 500, error.message || "Failed to generate chord progression");
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


  // Music generation endpoint (temporarily free)
  router.post(
    "/api/generate-music",
    async (req: Request, res: Response) => {
      try {
        const { prompt, count } = (req.body || {}) as { prompt?: string; count?: number };
        if (!prompt || typeof prompt !== "string") {
                    return sendError(res, 400, "Missing prompt");
        }

        const packs = await unifiedMusicService.generateSamplePack(prompt, { packCount: Math.max(1, Math.min(count || 4, 8)) });

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

  // Melody generation endpoint for Melody Composer
  router.post(
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

  // Complete professional song generation using the ACE-Step-first cascade
  router.post(
    "/api/music/generate-complete",
    requireAuth(),
    requireCredits(CREDIT_COSTS.SONG_GENERATION, storage),
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({
          songDescription: z.string().min(1, "songDescription is required").max(2000, "Description too long (max 2000 chars)"),
          genre: z.string().optional(),
          mood: z.string().optional(),
          aiProvider: z.string().optional(),
          duration: z.number().min(5).max(300).optional(),
          bpm: z.number().min(40).max(300).optional(),
          key: z.string().optional(),
          style: z.string().optional(),
          includeVocals: z.boolean().optional(),
          instruments: z.array(z.string()).optional(),
          seed: z.number().optional(),
          variations: z.number().min(1).max(4).optional(),
          melodyUrl: z.string().url().optional().or(z.literal('')),
          structure: z.array(z.object({
            name: z.string(),
            duration: z.number(),
            energy: z.string(),
          })).optional(),
          autoSeparateStems: z.boolean().optional(),
          stemCount: z.union([z.literal(2), z.literal(4)]).optional(),
          requireStems: z.boolean().optional(),
        });

        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success) {
          const errorMsg = parsed.error.issues.map(i => i.message).join(', ');
          return res.status(400).json({ message: errorMsg || "Invalid payload" });
        }

        const {
          songDescription,
          genre,
          mood,
          aiProvider,
          duration,
          bpm,
          key: musicalKey,
          style: musicalStyle,
          includeVocals = true,
          instruments: selectedInstruments,
          seed,
          variations = 1,
          melodyUrl,
          structure,
          autoSeparateStems = false,
          stemCount = 4,
          requireStems = false,
        } = parsed.data;

        const requestId = crypto.randomUUID();
        const routeStartedAt = Date.now();
        const providerConstraints = resolveGenerationConstraints({
          provider: aiProvider || 'ace-step',
          duration,
          bpm,
          variations,
          sectionCount: structure?.length || 0,
          requireGuideMelody: Boolean(melodyUrl),
        });

        const effectiveProvider = providerConstraints.effectiveProvider;
        const effectiveDuration = providerConstraints.duration ?? duration ?? 30;
        const effectiveBpm = providerConstraints.bpm ?? bpm;
        const effectiveVariations = providerConstraints.variations;
        const constraintWarnings = providerConstraints.warnings;
        const recordCompleteSongMetric = (outcome: 'success' | 'error' | 'fallback', resolvedProvider?: string | null) => {
          recordAIGenerationMetric({
            route: '/api/music/generate-complete',
            requestedProvider: aiProvider || null,
            effectiveProvider: resolvedProvider || effectiveProvider || null,
            outcome,
            latencyMs: Date.now() - routeStartedAt,
          });
        };

        // Build instrument string from selected instruments
        const instrumentStr = selectedInstruments?.length
          ? selectedInstruments.join(', ')
          : undefined;

        // Build the prompt with all context
        const promptParts = [songDescription];
        if (genre) promptParts.push(`Genre: ${genre}`);
        if (mood) promptParts.push(`Mood: ${mood}`);
        if (instrumentStr) promptParts.push(`Instruments: ${instrumentStr}`);
        if (!includeVocals) promptParts.push("Instrumental only, no vocals");
        const prompt = promptParts.join(". ");

        console.log(
          `🎵 [${requestId}] Generating complete song: "${prompt}" ` +
          `(provider=${effectiveProvider}, seed=${seed}, variations=${effectiveVariations}, structure=${structure ? structure.length + ' sections' : 'auto'})`
        );

        try {
          let result: any;

          // If structure sections are provided, use section stitching
          if (structure && structure.length > 0) {
            console.log(`🎵 Using section-stitched generation (${structure.length} sections)`);
            result = await unifiedMusicService.generateStitchedSong(prompt, {
              genre: genre || undefined,
              bpm: effectiveBpm,
              key: musicalKey,
              mood: mood || undefined,
              vocals: includeVocals,
              seed,
              structure,
            });
          } else {
            // Use the multi-provider cascade (ACE-Step → MusicGen Large → Stable Audio → basic MusicGen)
            result = await unifiedMusicService.generateFullSong(prompt, {
              genre: genre || undefined,
              mood: mood || undefined,
              aiProvider: effectiveProvider,
              duration: effectiveDuration,
              style: musicalStyle || genre || 'modern',
              vocals: includeVocals,
              bpm: effectiveBpm,
              key: musicalKey,
              seed,
              variations: effectiveVariations,
              melodyUrl: melodyUrl || undefined,
            });
          }

          if (!result?.audio_url) {
            recordCompleteSongMetric('error', effectiveProvider);
            return res.status(500).json({ message: "Music generation failed - no audio returned" });
          }

          let stems: Record<string, string | undefined> | undefined;
          let stemChannelMapping: Record<string, string> | undefined;
          let stemWarning: string | undefined;
          let polished: { url: string; duration: number } | undefined;

          let sourceAudioUrl = result.audio_url;
          const isHttpAudioUrl =
            typeof sourceAudioUrl === 'string' &&
            (sourceAudioUrl.startsWith('http://') || sourceAudioUrl.startsWith('https://'));
          if (isHttpAudioUrl) {
            try {
              polished = await polishGeneratedAudio(sourceAudioUrl, LOCAL_OBJECTS_DIR);
              sourceAudioUrl = polished.url;
            } catch (err: any) {
              console.warn("Audio polish failed:", err?.message || err);
            }
          }

          const shouldSeparateStems = autoSeparateStems || requireStems;
          if (shouldSeparateStems) {
            try {
              const { stemSeparationService } = await import('../services/stemSeparation');
              if (stemSeparationService.isConfigured()) {
                const stemResult = await stemSeparationService.separateStems(sourceAudioUrl, stemCount as 2 | 4);
                if (stemResult.success) {
                  stems = {
                    vocals: stemResult.vocals,
                    instrumental: stemResult.instrumental,
                    drums: stemResult.drums,
                    bass: stemResult.bass,
                    other: stemResult.other,
                  };
                  stemChannelMapping = {
                    vocals: 'track-stem-vocals',
                    instrumental: 'track-stem-instrumental',
                    drums: 'track-stem-drums',
                    bass: 'track-stem-bass',
                    other: 'track-stem-other',
                  };
                } else {
                  stemWarning = stemResult.error || 'Stem separation failed';
                }
              } else {
                stemWarning = 'Stem separation not configured (missing REPLICATE_API_TOKEN)';
              }
            } catch (stemErr: any) {
              stemWarning = stemErr?.message || 'Stem separation failed unexpectedly';
            }

            if (requireStems && (!stems || Object.values(stems).every((url) => !url))) {
              recordCompleteSongMetric('error', effectiveProvider);
              return res.status(502).json({
                message: stemWarning || 'Stems were required but could not be generated',
                requestId,
                requestedProvider: aiProvider || null,
                effectiveProvider,
                providerWarnings: constraintWarnings,
                stemWarning,
              });
            }
          }

          const resolvedGenerator = String(result.metadata?.generator || effectiveProvider || 'ai');
          const actuallyUsedProvider = resolvedGenerator;
          const isFallback = actuallyUsedProvider.toLowerCase() !== String(aiProvider || 'ace-step').toLowerCase()
            && !actuallyUsedProvider.toLowerCase().includes(String(aiProvider || 'ace-step').toLowerCase());
          const generationOutcome: 'success' | 'fallback' = (isFallback || resolvedGenerator.toLowerCase().includes('fallback')) ? 'fallback' : 'success';
          recordCompleteSongMetric(generationOutcome, resolvedGenerator);

          // Deduct credits after successful generation
          if (req.creditService && req.creditCost) {
            await req.creditService.deductCredits(
              req.userId!,
              req.creditCost,
              `Song generation (${result.metadata?.generator || 'AI'})`,
              { genre, mood, songDescription: songDescription.substring(0, 100) }
            );
          }

          // Build warnings: if the actual provider differs from what was requested, tell the user
          const finalWarnings = [...constraintWarnings];
          if (isFallback) {
            finalWarnings.push(`Requested ${aiProvider || 'ace-step'} but audio was generated by ${actuallyUsedProvider}. Check your API key configuration.`);
          }

          return res.json({
            success: true,
            audioUrl: sourceAudioUrl,
            title: `${genre || 'AI'} ${includeVocals ? 'Song' : 'Instrumental'}`,
            description: songDescription,
            genre: genre || 'AI Generated',
            prompt,
            duration: polished?.duration || result.metadata?.duration || duration || 30,
            provider: actuallyUsedProvider,
            seed: result.metadata?.seed,
            variations: result.variations,
            sections: result.sections,
            stems,
            stemChannelMapping,
            stemWarning,
            requireStems,
            requestId,
            requestedProvider: aiProvider || null,
            effectiveProvider: actuallyUsedProvider,
            rerouteReason: providerConstraints.rerouteReason || (isFallback ? `Fell back from ${aiProvider || 'ace-step'} to ${actuallyUsedProvider}` : null),
            providerWarnings: finalWarnings,
            generationOutcome,
          });
        } catch (err: any) {
          recordCompleteSongMetric('error', effectiveProvider);
          console.error("Song generation error:", err);
          return res.status(500).json({ message: err?.message || "Failed to generate song", requestId });
        }
      } catch (err: any) {
        console.error("Complete song generation error:", err);
        return res.status(500).json({ message: err?.message || "Failed to generate complete song" });
      }
    }
  );

  return router;
}
