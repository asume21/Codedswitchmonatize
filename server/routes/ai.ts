import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getAIProviderStatus, makeAICall } from "../services/grok";
import { aceEngine } from "../services/aceEngine";
import { generateChordProgression } from "../services/chordEngine";
import { aiProviderManager } from "../services/aiProviderManager";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

export function createAIRoutes() {
  // ============================================
  // GROK AI ENDPOINT - General purpose AI generation
  // ============================================
  router.post("/grok", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const XAI_API_KEY = process.env.XAI_API_KEY;

      if (!XAI_API_KEY) {
        return res.status(503).json({ error: 'Grok (XAI_API_KEY) not configured' });
      }

      // Use Grok (xAI)
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${XAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'grok-3',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        })
      });

      const data = await response.json();
      return res.json({ response: data.choices?.[0]?.message?.content || '' });
      
    } catch (error) {
      console.error('Grok API error:', error);
      res.status(500).json({ error: 'AI generation failed' });
    }
  });

  // ============================================
  // AI PRODUCER — real-time beat section director
  // Called by the client AIDirector pipeline when a section starts.
  // No auth required — runs for guest users too (organism demo).
  // ============================================
  router.post("/next-section", async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        section?: string
        currentSection?: string
        nextSection?: string
        energy?: number
        subGenre?: string
        context?: {
          subGenre?: string
          bpm?: number
          energy?: number
          barInCycle?: number
          totalBars?: number
          cycleCount?: number
        }
      }
      const section = body.section ?? body.nextSection

      if (!section) {
        return res.status(400).json({ error: 'section or nextSection is required' })
      }

      const aceResult = await aceEngine.generateNextSection({
        currentSection: section,
        energy: body.energy ?? body.context?.energy,
        subGenre: body.subGenre ?? body.context?.subGenre,
        bpm: body.context?.bpm,
        barInCycle: body.context?.barInCycle,
        totalBars: body.context?.totalBars,
        cycleCount: body.context?.cycleCount,
      });
      return res.json(aceResult);
    } catch (error) {
      console.error("❌ [ACE COMPOSITION FAILURE] Local engine error:", error);
      return res.status(500).json({ error: "Local composition engine failed" });
    }
  })

  // ============================================
  // CHAT ENDPOINT - Generic AI chat
  // ============================================
  router.post("/chat", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { messages = [], prompt } = req.body || {};

      console.log('💬 AI Chat request received');

      const FALLBACK_SYSTEM = {
        role: 'system' as const,
        content: 'You are Astutely — the creative director AI inside CodedSwitch Studio. ' +
          'You are a seasoned hip-hop and R&B producer with deep music theory knowledge. ' +
          'Be specific, direct, and concise. No filler phrases.',
      }

      let msgList = Array.isArray(messages) && messages.length > 0
        ? messages
        : [{ role: 'user', content: prompt || 'Hello' }]

      // Inject fallback system prompt only when the caller didn't provide one
      if (!msgList.some((m: { role: string }) => m.role === 'system')) {
        msgList = [FALLBACK_SYSTEM, ...msgList]
      }

      const response = await makeAICall(msgList, { temperature: 0.7, max_tokens: 800 });

      const content = response.choices?.[0]?.message?.content || "";
      console.log(`✅ AI response received: ${content.substring(0, 50)}...`);
      return res.json({ response: content });
    } catch (error) {
      console.error("❌ AI chat error:", error);
      return res.status(500).json({ 
        error: "AI chat failed",
        message: error instanceof Error ? error.message : "Unknown error",
        response: "Sorry, I couldn't process that request. Please try again."
      });
    }
  });

  // ============================================
  // CHORD GENERATION ENDPOINT — local, deterministic, instant.
  // No GPT call. Uses mood-mapped Roman numeral progressions realized in `key`.
  // ============================================
  router.post("/chords", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { key = 'C', mood = 'happy', userId = 'anonymous' } = req.body;

      console.log(`🎵 Local chord generation: key=${key}, mood=${mood}`);

      const result = generateChordProgression(key, mood);

      try {
        const sessionUserId = req.userId || userId;
        await db.execute(sql`
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

  // Comprehensive AI status — tells the frontend exactly what's working
  router.get("/status", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const providerStatus = getAIProviderStatus();
      const replicateConfigured = Boolean(process.env.REPLICATE_API_TOKEN?.trim());
      const sunoKey = (process.env.SUNO_API_KEY || process.env.SUNO_API_TOKEN || '').trim();
      const sunoConfigured = Boolean(sunoKey && sunoKey !== 'YOUR_API_KEY');

      const anyCloudAI = providerStatus.grok.clientReady || providerStatus.openai.clientReady;

      const services = {
        patternGeneration: {
          status: anyCloudAI ? 'ai' : 'fallback',
          provider: providerStatus.grok.clientReady ? 'Grok (XAI)' : providerStatus.openai.clientReady ? 'OpenAI' : 'Algorithmic Fallback',
          description: anyCloudAI
            ? 'AI generates unique beats, bass, drums, and melodies per request'
            : 'Using pre-built genre templates — set XAI_API_KEY or OPENAI_API_KEY for real AI',
        },
        lyricsGeneration: {
          status: anyCloudAI ? 'ai' : 'unavailable',
          provider: providerStatus.grok.clientReady ? 'Grok (XAI)' : providerStatus.openai.clientReady ? 'OpenAI' : 'None',
          description: anyCloudAI
            ? 'AI writes original lyrics with genre awareness and music theory'
            : 'Lyrics generation requires XAI_API_KEY or OPENAI_API_KEY',
        },
        sunoMusicGeneration: {
          status: sunoConfigured ? 'ai' : 'unavailable',
          provider: sunoConfigured ? 'Suno API (V4/V4.5/V5)' : 'None',
          description: sunoConfigured
            ? 'Full song generation, covers, extensions, vocal separation, and add vocals/instrumentals via Suno'
            : 'Suno features require SUNO_API_KEY — get one at sunoapi.org',
          endpoints: [
            'POST /api/songs/suno/generate — Generate music from scratch',
            'POST /api/songs/suno/cover — Restyle existing audio',
            'POST /api/songs/suno/extend — Extend a track',
            'POST /api/songs/suno/separate-vocals — Vocal/instrumental separation',
            'POST /api/songs/suno/add-vocals — Add vocals to instrumental',
            'POST /api/songs/suno/add-instrumental — Add instrumental to vocals',
            'POST /api/songs/suno/status — Check task progress',
            'GET /api/songs/suno/credits — Check remaining credits',
          ],
        },
        audioGeneration: {
          status: replicateConfigured ? 'ai' : 'unavailable',
          provider: replicateConfigured ? 'Replicate (MusicGen)' : 'None',
          description: replicateConfigured
            ? 'Beat and melody generation via MusicGen models on Replicate'
            : 'MusicGen audio generation requires REPLICATE_API_TOKEN',
        },
        lyricsAnalysis: {
          status: 'ai',
          provider: anyCloudAI ? 'Local NLP + Grok AI insights' : 'Local NLP only',
          description: 'Rhyme detection, sentiment, themes, and quality scoring always work locally',
        },
        voiceConversion: {
          status: replicateConfigured ? 'ai' : 'unavailable',
          provider: replicateConfigured ? 'Replicate (XTTS-v2)' : 'None',
          description: replicateConfigured
            ? 'AI voice cloning and text-to-speech'
            : 'Voice conversion requires REPLICATE_API_TOKEN',
        },
      };

      const aiActiveCount = Object.values(services).filter(s => s.status === 'ai').length;
      const totalServices = Object.keys(services).length;

      res.json({
        success: true,
        summary: {
          aiActive: aiActiveCount,
          total: totalServices,
          percentage: Math.round((aiActiveCount / totalServices) * 100),
          overallStatus: aiActiveCount === totalServices ? 'fully-ai' : aiActiveCount > 0 ? 'partial-ai' : 'no-ai',
        },
        providers: providerStatus,
        replicateConfigured,
        sunoConfigured,
        services,
      });
    } catch (error: any) {
      console.error('AI status check error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
