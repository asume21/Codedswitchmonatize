import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getAIClient, getAIProviderStatus } from "../services/grok";
import { aiProviderManager } from "../services/aiProviderManager";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

export function createAIRoutes() {
  // ============================================
  // GROK AI ENDPOINT - General purpose AI generation
  // ============================================
  router.post("/grok", async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const XAI_API_KEY = process.env.XAI_API_KEY;
      
      if (!XAI_API_KEY) {
        // Fallback to OpenAI if no Grok key
        const aiClient = getAIClient();
        if (!aiClient) {
          return res.status(503).json({ error: 'No AI provider configured' });
        }
        
        const completion = await aiClient.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });
        
        return res.json({ response: completion.choices[0].message.content });
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
  // CHAT ENDPOINT - Generic AI chat
  // ============================================
  router.post("/chat", async (req: Request, res: Response) => {
    try {
      const { messages = [], prompt } = req.body || {};

      console.log('💬 AI Chat request received');

      const aiClient = getAIClient();
      if (!aiClient) {
        console.error('❌ No AI client available - check XAI_API_KEY or OPENAI_API_KEY');
        return res.status(503).json({ 
          error: "No AI provider configured",
          response: "AI is not configured. Please check your API keys."
        });
      }

      console.log('✅ AI client available, sending request...');

      const chatMessages =
        Array.isArray(messages) && messages.length > 0
          ? messages
          : [{ role: "user", content: prompt || "Hello" }];

      const completion = await aiClient.chat.completions.create({
        model: "grok-3",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 800,
      });

      const content = completion.choices?.[0]?.message?.content || "";
      console.log(`✅ AI response received: ${content.substring(0, 50)}...`);
      return res.json({ response: content });
    } catch (error) {
      console.error("❌ AI chat error:", error);
      // Return actual error info for debugging
      return res.status(500).json({ 
        error: "AI chat failed",
        message: error instanceof Error ? error.message : "Unknown error",
        response: "Sorry, I couldn't process that request. Please try again."
      });
    }
  });

  // ============================================
  // AI CHORD GENERATION ENDPOINT
  // Secure server-side OpenAI integration
  // ============================================
  router.post("/chords", async (req: Request, res: Response) => {
    try {
      const { key = 'C', mood = 'happy', userId = 'anonymous' } = req.body;
      
      console.log(`🎵 AI Chord Generation: key=${key}, mood=${mood}`);

      const prompt = `Generate a 4-chord progression in ${key} with a ${mood} vibe. 
      Return ONLY valid JSON like this:
      {"chords": ["C", "Am", "F", "G"], "progression": "I-vi-IV-V"}`;

      // Use the existing AI client
      const aiClient = getAIClient();
      if (!aiClient) {
        return res.status(500).json({ error: 'AI client not configured' });
      }

      const completion = await aiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 100,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      
      // Parse the JSON response
      let result;
      try {
        // Extract JSON from potential markdown code blocks
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        result = { chords: ['C', 'Am', 'F', 'G'], progression: 'I-vi-IV-V' };
      }

      // Log to database
      try {
        const sessionUserId = req.userId || userId;
        await db.execute(sql`
          INSERT INTO ai_sessions (user_id, prompt, result, created_at) 
          VALUES (${sessionUserId}, ${prompt}, ${JSON.stringify(result)}::jsonb, NOW())
        `);
      } catch (dbError) {
        // Don't fail the request if logging fails (table might not exist yet)
        console.warn('AI session logging skipped:', (dbError as Error).message);
      }

      console.log(`🎵 Generated chords: ${result.chords?.join(' - ')}`);
      
      res.json({ 
        success: true, 
        chords: result.chords || ['C', 'Am', 'F', 'G'],
        progression: result.progression || 'I-vi-IV-V',
        key,
        mood
      });
      
    } catch (error) {
      console.error('AI chord generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'AI chord generation failed — try again',
        // Fallback chords so UI doesn't break
        chords: ['C', 'Am', 'F', 'G'],
        progression: 'I-vi-IV-V'
      });
    }
  });

  // Get available AI providers
  router.get("/ai-providers", async (req: Request, res: Response) => {
    try {
      const providers = aiProviderManager.getAvailableProviders();
      const authenticated = aiProviderManager.getAuthenticatedProviders();
      
      res.json({
        status: 'success',
        providers: providers,
        authenticated: authenticated.map(p => p.name),
        message: 'Available AI providers'
      });
    } catch (error) {
      console.error('❌ Error fetching providers:', error);
      res.status(500).json({ success: false, message: "Failed to fetch AI providers" });
    }
  });

  // Set user's AI provider preference
  router.post("/ai-provider/set", async (req: Request, res: Response) => {
    try {
      const { feature, provider } = req.body;
      
      if (!feature || !provider) {
        return res.status(400).json({ success: false, message: "Missing feature or provider" });
      }

      // Validate provider exists
      if (!aiProviderManager.getAvailableProviders().find(p => p.name === provider)) {
        return res.status(400).json({ success: false, message: "Invalid provider" });
      }

      // Check if provider is authenticated
      if (!aiProviderManager.isAuthenticated(provider)) {
        return res.status(401).json({ success: false, message: `Provider ${provider} is not authenticated` });
      }

      aiProviderManager.setProvider(feature, provider);
      
      res.json({
        status: 'success',
        message: `AI provider set to ${provider} for ${feature}`,
        feature: feature,
        provider: provider
      });
    } catch (error) {
      console.error('❌ Error setting provider:', error);
      res.status(500).json({ success: false, message: "Failed to set AI provider" });
    }
  });

  // Comprehensive AI status — tells the frontend exactly what's working
  router.get("/status", async (_req: Request, res: Response) => {
    try {
      const providerStatus = getAIProviderStatus();
      const replicateConfigured = Boolean(process.env.REPLICATE_API_TOKEN?.trim());
      const sunoConfigured = Boolean(process.env.SUNO_API_KEY?.trim() && process.env.SUNO_API_KEY !== 'YOUR_API_KEY');

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

  // Get user's AI provider preference
  router.get("/ai-provider/:feature", async (req: Request, res: Response) => {
    try {
      const { feature } = req.params;
      const provider = aiProviderManager.getProvider(feature);
      
      res.json({
        status: 'success',
        feature: feature,
        provider: provider
      });
    } catch (error) {
      console.error('❌ Error getting provider:', error);
      res.status(500).json({ success: false, message: "Failed to get AI provider" });
    }
  });

  return router;
}
