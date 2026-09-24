// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getAIClient } from "../services/grok";
import { z } from "zod";
import { aiLimiter, sendError } from "./common";

export function createMixingRoutes() {
  const router = Router();
  router.post("/api/mix/generate", requireAuth(), async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.userId) {
        return sendError(res, 401, "Authentication required - please log in");
      }

      // Proper validation with structured layer schema
      const layerSchema = z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['beat', 'melody', 'bass', 'harmony', 'fx']),
        volume: z.number().min(0).max(100).optional(),
        pan: z.number().min(-50).max(50).optional(),
        effects: z.object({
          reverb: z.number().min(0).max(100).optional(),
          delay: z.number().min(0).max(100).optional(),
          distortion: z.number().min(0).max(100).optional(),
        }).optional(),
        data: z.any().optional(),
        muted: z.boolean().optional(),
        solo: z.boolean().optional(),
      });

      const mixSchema = z.object({
        prompt: z.string().min(1, "Prompt is required"),
        layers: z.array(layerSchema).min(1, "At least one layer is required"),
        bpm: z.number().min(40).max(240).optional(),
        style: z.string().optional(),
      });

      const parsed = mixSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Invalid input: " + parsed.error.message);
      }

      const { prompt, layers, bpm, style } = parsed.data;

      console.log(`🎛️ User ${req.userId} requesting AI mix - Layers: ${layers.length}, Prompt: "${prompt}"`);

      // Build AI mixing prompt
      const layerDescription = layers.map((layer: any, i: number) => 
        `Layer ${i + 1} (${layer.type}): ${layer.name}`
      ).join(', ');

      const mixingPrompt = `You are a professional audio mixing engineer. Analyze these tracks and provide optimal mixing parameters:

Tracks: ${layerDescription}
BPM: ${bpm || 120}
Style: ${style || 'professional'}
User Request: ${prompt}

Provide mixing settings for each layer in this exact JSON format:
{
  "layers": [
    {
      "id": "layer_id",
      "volume": 75,
      "pan": 0,
      "effects": {
        "reverb": 30,
        "delay": 0,
        "distortion": 0
      },
      "reasoning": "brief explanation"
    }
  ],
  "masterVolume": 80,
  "recommendations": "overall mixing advice"
}

Volume: 0-100, Pan: -50 (left) to +50 (right), Effects: 0-100`;

      // Try to get AI client
      const aiClient = getAIClient();
      
      if (aiClient) {
        // Use xAI Grok for intelligent mixing suggestions
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              {
                role: "system",
                content: "You are an expert audio mixing engineer with deep knowledge of music production, EQ, dynamics, and spatial positioning. Provide professional mixing advice in JSON format."
              },
              {
                role: "user",
                content: mixingPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          });

          const aiResponse = completion.choices[0]?.message?.content;
          
          if (aiResponse) {
            try {
              // Extract JSON from response, handling code fences and extra text
              let jsonString = aiResponse;
              
              // Remove markdown code fences if present
              jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*/g, '');
              
              // Extract JSON object
              const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
              
              if (jsonMatch) {
                const mixingData = JSON.parse(jsonMatch[0]);
                
                // Validate AI response has required structure
                if (mixingData.layers && Array.isArray(mixingData.layers)) {
                  // Create a dictionary of AI suggestions keyed by layer ID
                  const aiSuggestionsByID = new Map();
                  mixingData.layers.forEach((aiLayer: any) => {
                    if (aiLayer.id) {
                      aiSuggestionsByID.set(aiLayer.id, aiLayer);
                    }
                  });

                  // Map AI suggestions to actual layers by matching IDs
                  const updatedLayers = layers.map((layer) => {
                    const aiSuggestion = aiSuggestionsByID.get(layer.id) || {};
                    
                    // Validate and clamp AI-provided values to allowed ranges
                    const volume = typeof aiSuggestion.volume === 'number' 
                      ? Math.max(0, Math.min(100, aiSuggestion.volume)) 
                      : (layer.volume || 75);
                    const pan = typeof aiSuggestion.pan === 'number' 
                      ? Math.max(-50, Math.min(50, aiSuggestion.pan)) 
                      : (layer.pan || 0);
                    const reverb = typeof aiSuggestion.effects?.reverb === 'number'
                      ? Math.max(0, Math.min(100, aiSuggestion.effects.reverb))
                      : (layer.effects?.reverb ?? 0);
                    const delay = typeof aiSuggestion.effects?.delay === 'number'
                      ? Math.max(0, Math.min(100, aiSuggestion.effects.delay))
                      : (layer.effects?.delay ?? 0);
                    const distortion = typeof aiSuggestion.effects?.distortion === 'number'
                      ? Math.max(0, Math.min(100, aiSuggestion.effects.distortion))
                      : (layer.effects?.distortion ?? 0);
                    
                    return {
                      ...layer,
                      volume,
                      pan,
                      effects: {
                        reverb,
                        delay,
                        distortion,
                      }
                    };
                  });

                  console.log("✅ AI mixing suggestions applied successfully");
                  return res.json({
                    success: true,
                    layers: updatedLayers,
                    masterVolume: typeof mixingData.masterVolume === 'number' ? mixingData.masterVolume : 80,
                    recommendations: mixingData.recommendations || "AI mix applied successfully",
                    provider: "xAI Grok"
                  });
                }
              }
            } catch (parseError: any) {
              console.warn("⚠️ Failed to parse AI response, using fallback:", parseError.message);
              // Fall through to intelligent fallback
            }
          }
        } catch (aiError: any) {
          console.warn("⚠️ AI mixing failed, using intelligent fallback:", aiError.message);
        }
      }

      // Intelligent fallback mixing based on track types
      console.log("🎛️ Using intelligent fallback mixing");
      
      const updatedLayers = layers.map((layer: any) => {
        const mixingRules: Record<string, any> = {
          beat: { volume: 85, pan: 0, reverb: 5, delay: 0, distortion: 0 },
          bass: { volume: 80, pan: 0, reverb: 0, delay: 0, distortion: 10 },
          melody: { volume: 75, pan: 10, reverb: 35, delay: 15, distortion: 0 },
          harmony: { volume: 65, pan: -10, reverb: 40, delay: 10, distortion: 0 },
          fx: { volume: 60, pan: 15, reverb: 60, delay: 30, distortion: 0 },
        };

        const defaultMix = mixingRules[layer.type] || { volume: 75, pan: 0, reverb: 20, delay: 10, distortion: 0 };

        // Apply user prompt adjustments
        let volumeAdjust = 0;
        let reverbAdjust = 0;
        
        if (prompt.toLowerCase().includes('loud') || prompt.toLowerCase().includes('punchy')) {
          volumeAdjust = 10;
        }
        if (prompt.toLowerCase().includes('quiet') || prompt.toLowerCase().includes('subtle')) {
          volumeAdjust = -15;
        }
        if (prompt.toLowerCase().includes('reverb') || prompt.toLowerCase().includes('spacious')) {
          reverbAdjust = 20;
        }
        if (prompt.toLowerCase().includes('dry') || prompt.toLowerCase().includes('tight')) {
          reverbAdjust = -20;
        }

        return {
          ...layer,
          volume: Math.max(0, Math.min(100, defaultMix.volume + volumeAdjust)),
          pan: defaultMix.pan,
          effects: {
            reverb: Math.max(0, Math.min(100, defaultMix.reverb + reverbAdjust)),
            delay: defaultMix.delay,
            distortion: defaultMix.distortion,
          }
        };
      });

      res.json({
        success: true,
        layers: updatedLayers,
        masterVolume: 80,
        recommendations: "Intelligent mixing applied based on track types and your prompt",
        provider: "Intelligent Fallback"
      });

    } catch (error: any) {
      console.error("❌ Mix generation error:", error);
      sendError(res, 500, error.message || "Failed to generate mix");
    }
  });

  // ============================================
  // AI MASTERING SUGGESTIONS ENDPOINT
  // Analyzes mix and provides professional mastering guidance
  // ============================================
  router.post("/api/ai/mastering", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
    try {
      const { 
        frequencyData, 
        peakLevel, 
        rmsLevel, 
        genre = "pop",
        targetLoudness = -14 
      } = req.body;

      const prompt = `You are a professional mastering engineer. Analyze this mix data and provide specific mastering recommendations.

Mix Analysis:
- Peak Level: ${peakLevel || -3}dB
- RMS Level: ${rmsLevel || -12}dB  
- Genre: ${genre}
- Target Loudness: ${targetLoudness} LUFS (streaming standard)
${frequencyData ? `- Frequency Balance: Bass ${frequencyData.bass}dB, Mids ${frequencyData.mids}dB, Highs ${frequencyData.highs}dB` : ''}

Provide mastering recommendations in this exact JSON format:
{
  "loudnessAnalysis": {
    "currentLUFS": -8,
    "targetLUFS": -14,
    "recommendation": "Reduce overall level by 6dB to prevent clipping on streaming platforms"
  },
  "eq": {
    "lowCut": 30,
    "bassBoost": { "freq": 80, "gain": 1.5 },
    "midPresence": { "freq": 2500, "gain": 2 },
    "airBoost": { "freq": 12000, "gain": 1 },
    "recommendations": ["Apply gentle high-pass at 30Hz", "Boost 2.5kHz for vocal presence"]
  },
  "compression": {
    "ratio": "4:1",
    "attack": "10ms",
    "release": "100ms",
    "threshold": -12,
    "recommendation": "Use gentle multiband compression for glue"
  },
  "limiter": {
    "ceiling": -1,
    "release": "50ms",
    "recommendation": "Set ceiling at -1dB for headroom"
  },
  "stereoWidth": {
    "current": "narrow",
    "recommendation": "Add subtle stereo widening above 2kHz"
  },
  "overallScore": 7,
  "topIssues": ["Levels too hot", "Bass muddy below 60Hz", "Lacking air frequencies"],
  "quickFixes": ["Reduce master by 3dB", "High-pass at 40Hz", "Add 1dB shelf at 10kHz"]
}`;

      const aiClient = getAIClient();
      let masteringData: any = null;

      if (aiClient) {
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a Grammy-winning mastering engineer. Provide professional, specific mastering advice in JSON format." },
              { role: "user", content: prompt }
            ],
            temperature: 0.6,
            max_tokens: 1500,
          });

          const response = completion.choices[0]?.message?.content;
          if (response) {
            const jsonMatch = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              masteringData = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiError: any) {
          console.warn("AI mastering analysis failed, using fallback:", aiError.message);
        }
      }

      if (!masteringData) {
        masteringData = {
          loudnessAnalysis: {
            currentLUFS: peakLevel || -8,
            targetLUFS: targetLoudness,
            recommendation: "Aim for -14 LUFS for streaming platforms"
          },
          eq: {
            lowCut: 35,
            bassBoost: { freq: 80, gain: 1 },
            midPresence: { freq: 2500, gain: 1.5 },
            airBoost: { freq: 12000, gain: 1 },
            recommendations: ["Apply high-pass filter at 35Hz", "Add subtle presence boost at 2-3kHz"]
          },
          compression: {
            ratio: "3:1",
            attack: "15ms",
            release: "150ms",
            threshold: -10,
            recommendation: "Use gentle bus compression for cohesion"
          },
          limiter: {
            ceiling: -1,
            release: "50ms",
            recommendation: "Limit peaks to -1dB for streaming headroom"
          },
          stereoWidth: {
            current: "normal",
            recommendation: "Check mono compatibility before widening"
          },
          overallScore: 6,
          topIssues: ["Check loudness levels", "Verify frequency balance", "Test on multiple speakers"],
          quickFixes: ["Compare with reference track", "Check in mono", "A/B test your changes"]
        };
      }

      res.json({
        success: true,
        analysis: masteringData,
        provider: aiClient ? "AI" : "Fallback",
        generatedAt: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("Mastering analysis error:", error);
      sendError(res, 500, error.message || "Failed to analyze mix for mastering");
    }
  });

  // ============================================
  // AI ARRANGEMENT BUILDER ENDPOINT  
  // Takes REAL tracks from the project and arranges them into a full song
  // Returns per-track per-section volume/mute/pan data
  // ============================================
  router.post("/api/ai/arrangement", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
    try {
      const { 
        bpm = 120,
        key = "C",
        genre = "pop",
        mood = "uplifting",
        durationMinutes = 3,
        tracks = [],
      } = req.body;

      // Build a track summary for the AI
      const trackSummary = (tracks as any[]).map((t: any, i: number) => 
        `Track ${i + 1}: "${t.name}" (${t.instrument || t.type || 'unknown'}) - ${t.noteCount || 0} notes`
      ).join('\n');

      const trackIds = (tracks as any[]).map((t: any) => t.id || `track-${t.name}`);
      const trackNames = (tracks as any[]).map((t: any) => t.name || `Track`);

      const prompt = `You are a professional music producer. You have ${tracks.length} tracks to arrange into a full song.

TRACKS IN THE PROJECT:
${trackSummary || 'No tracks provided — generate a generic arrangement plan.'}

Song Parameters: ${bpm} BPM, Key of ${key}, Genre: ${genre}, Mood: ${mood}, Duration: ~${durationMinutes} minutes

YOUR JOB: Decide which tracks should play in each section, at what volume (0-100), and whether they should be muted. This creates a professional arrangement where instruments enter and exit naturally.

Return ONLY this JSON (no commentary):
{
  "totalBars": <number>,
  "sections": [
    {
      "name": "Intro",
      "startBar": 1,
      "endBar": 8,
      "energy": <1-10>,
      "description": "<what happens musically>",
      "trackStates": {
        ${trackNames.map((name: string, i: number) => `"${name}": { "active": true/false, "volume": 0-100 }`).join(',\n        ')}
      }
    }
  ],
  "transitions": [
    { "from": "Intro", "to": "Verse 1", "type": "build/drop/cut/fade", "description": "<how to transition>" }
  ],
  "recommendations": ["<production tip 1>", "<production tip 2>", "<production tip 3>"]
}

RULES:
- Intro: Start sparse (1-2 tracks), build anticipation
- Verses: Add rhythm section, keep melody present but not dominant
- Chorus: ALL tracks active, maximum energy, highest volumes
- Bridge: Strip back, create contrast — maybe just 2-3 tracks
- Outro: Gradually remove tracks, mirror the intro
- Drums should be muted or very quiet in intros/outros
- Bass and drums should enter together
- Melody/lead should be louder in choruses
- Create dynamic contrast between sections
- Each section's trackStates MUST include ALL ${tracks.length} tracks`;

      const aiClient = getAIClient();
      let arrangementData: any = null;

      if (aiClient) {
        try {
          const completion = await aiClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a Grammy-winning music producer. Create arrangements that sound professional by controlling which instruments play in each section. Return valid JSON only." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 3000,
          });

          const response = completion.choices[0]?.message?.content;
          if (response) {
            const jsonMatch = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              arrangementData = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (aiError: any) {
          console.warn("AI arrangement generation failed:", aiError.message);
        }
      }

      // Fallback: generate a smart arrangement based on track types
      if (!arrangementData) {
        const barsPerMinute = bpm / 4;
        const totalBars = Math.round(durationMinutes * barsPerMinute);

        // Classify tracks by role
        const classify = (t: any) => {
          const name = (t.name || '').toLowerCase();
          const inst = (t.instrument || t.type || '').toLowerCase();
          if (name.includes('drum') || name.includes('beat') || inst.includes('drum')) return 'drums';
          if (name.includes('bass') || inst.includes('bass')) return 'bass';
          if (name.includes('melod') || name.includes('lead') || inst.includes('flute') || inst.includes('violin') || inst.includes('trumpet')) return 'melody';
          if (name.includes('chord') || name.includes('pad') || inst.includes('pad') || inst.includes('piano') || inst.includes('guitar')) return 'chords';
          return 'other';
        };

        const trackRoles = (tracks as any[]).map((t: any) => ({ ...t, role: classify(t) }));

        const makeStates = (activeRoles: string[], defaultVol: number) => {
          const states: Record<string, { active: boolean; volume: number }> = {};
          trackRoles.forEach((t: any) => {
            const isActive = activeRoles.includes(t.role) || activeRoles.includes('all');
            states[t.name || 'Track'] = { active: isActive, volume: isActive ? defaultVol : 0 };
          });
          return states;
        };

        arrangementData = {
          totalBars,
          sections: [
            { name: "Intro", startBar: 1, endBar: 8, energy: 3, description: "Atmospheric opening — sparse instruments", trackStates: makeStates(['chords', 'melody'], 60) },
            { name: "Verse 1", startBar: 9, endBar: 24, energy: 5, description: "Rhythm enters, groove established", trackStates: makeStates(['drums', 'bass', 'melody', 'chords'], 75) },
            { name: "Pre-Chorus", startBar: 25, endBar: 32, energy: 7, description: "Building tension toward chorus", trackStates: makeStates(['drums', 'bass', 'melody', 'chords', 'other'], 80) },
            { name: "Chorus", startBar: 33, endBar: 48, energy: 9, description: "Full energy — all tracks active", trackStates: makeStates(['all'], 90) },
            { name: "Verse 2", startBar: 49, endBar: 64, energy: 5, description: "Variation of verse 1", trackStates: makeStates(['drums', 'bass', 'melody'], 70) },
            { name: "Pre-Chorus 2", startBar: 65, endBar: 72, energy: 7, description: "Build to final chorus", trackStates: makeStates(['drums', 'bass', 'melody', 'chords', 'other'], 80) },
            { name: "Chorus 2", startBar: 73, endBar: 88, energy: 10, description: "Peak energy — biggest section", trackStates: makeStates(['all'], 95) },
            { name: "Bridge", startBar: 89, endBar: 96, energy: 4, description: "Strip back for contrast", trackStates: makeStates(['chords', 'melody'], 65) },
            { name: "Final Chorus", startBar: 97, endBar: Math.min(112, totalBars - 4), energy: 10, description: "Maximum impact", trackStates: makeStates(['all'], 100) },
            { name: "Outro", startBar: Math.min(113, totalBars - 3), endBar: totalBars, energy: 2, description: "Fade out — mirror intro", trackStates: makeStates(['chords'], 50) },
          ],
          transitions: [
            { from: "Intro", to: "Verse 1", type: "build", description: "Drums enter with a fill" },
            { from: "Pre-Chorus", to: "Chorus", type: "drop", description: "Big impact — everything hits at once" },
            { from: "Chorus", to: "Verse 2", type: "cut", description: "Strip back suddenly for contrast" },
            { from: "Bridge", to: "Final Chorus", type: "build", description: "Gradual build over 4 bars" },
          ],
          recommendations: [
            "Add volume automation to build energy into choruses",
            "Use filter sweeps on drums during transitions",
            "Consider adding a riser FX before each chorus drop",
          ],
        };
      }

      res.json({
        success: true,
        arrangement: arrangementData,
        bpm,
        key,
        genre,
        trackCount: tracks.length,
        provider: aiClient ? "AI" : "Fallback"
      });

    } catch (error: any) {
      console.error("Arrangement generation error:", error);
      sendError(res, 500, error.message || "Failed to generate arrangement");
    }
  });

  return router;
}
