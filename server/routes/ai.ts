import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getAIClient } from "../services/grok";
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
          model: 'gpt-4o',
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
          model: 'grok-2-1212',
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

      const aiClient = getAIClient();
      if (!aiClient) {
        return res.status(503).json({ error: "No AI provider configured" });
      }

      const chatMessages =
        Array.isArray(messages) && messages.length > 0
          ? messages
          : [{ role: "user", content: prompt || "Hello" }];

      const completion = await aiClient.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        temperature: 0.7,
      });

      const content = completion.choices?.[0]?.message?.content || "";
      return res.json({ response: content });
    } catch (error) {
      console.error("AI chat error:", error);
      // Return helpful fallback instead of error
      return res.json({ 
        response: "I'm having trouble connecting to my AI brain right now. Try commands like 'play', 'stop', 'status', or 'make a beat'!",
        isFallback: true 
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
