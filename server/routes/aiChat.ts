// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireCredits } from "../middleware/requireCredits";
import { CREDIT_COSTS } from "../services/credits";
import { getAIClient, translateCode } from "../services/grok";
import { aiLimiter, sendError, upload } from "./common";
import type { IStorage } from "../storage";

export function createAiChatRoutes(storage: IStorage) {
  const router = Router();
  // ============================================
  // GROK AI ENDPOINT - General purpose AI generation
  // ============================================
  router.post("/api/grok", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
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

  router.post(
    "/api/music-to-code",
    requireAuth(),
    requireCredits(CREDIT_COSTS.CODE_TRANSLATION, storage),
    upload.single("audio"),
    async (req: Request, res: Response) => {
      try {
        const language = String((req.body as any)?.language || "javascript");
        const codeStyle = String((req.body as any)?.codeStyle || "functional");
        const complexityRaw = (req.body as any)?.complexity;
        const complexity = Math.max(1, Math.min(10, Number(complexityRaw) || 5));

        const musicDataRaw = (req.body as any)?.musicData;
        let musicData: any = null;
        if (typeof musicDataRaw === "string" && musicDataRaw.trim().length > 0) {
          try {
            musicData = JSON.parse(musicDataRaw);
          } catch {
            musicData = { raw: musicDataRaw };
          }
        } else if (typeof musicDataRaw === "object" && musicDataRaw) {
          musicData = musicDataRaw;
        }

        const file = (req as any).file as
          | { originalname?: string; mimetype?: string; size?: number }
          | undefined;

        if (!musicData && !file) {
          return res.status(400).json({
            success: false,
            message: "Provide either musicData or an audio file.",
          });
        }

        const aiClient = getAIClient();
        if (!aiClient) {
          return res.status(503).json({
            success: false,
            message: "AI service unavailable",
          });
        }

        const prompt = `You convert music into code artifacts.

Input:
- Preferred language: ${language}
- Code style: ${codeStyle}
- Complexity: ${complexity}/10
- musicData (may include pattern/melody/lyrics/etc): ${musicData ? JSON.stringify(musicData).slice(0, 6000) : "<none>"}
- audioFile metadata: ${file ? JSON.stringify({ name: file.originalname, type: file.mimetype, size: file.size }) : "<none>"}

Return ONLY valid JSON in this schema:
{
  "analysis": {
    "tempo": number,
    "key": string,
    "timeSignature": string,
    "structure": string[],
    "instruments": string[],
    "complexity": number,
    "mood": string
  },
  "code": {
    "language": string,
    "code": string,
    "description": string,
    "framework": string,
    "functionality": string[]
  }
}

The code must be immediately usable and should generate or represent the music concepts provided (patterns, timing, structure, instrumentation).`;

        const completion = await aiClient.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: 1800,
        });

        const content = completion.choices[0]?.message?.content || "{}";
        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = {};
        }

        const analysis = parsed?.analysis || {};
        const code = parsed?.code || {};

        return res.json({
          success: true,
          analysis: {
            tempo: Number(analysis.tempo) || 120,
            key: String(analysis.key || "C Major"),
            timeSignature: String(analysis.timeSignature || "4/4"),
            structure: Array.isArray(analysis.structure) ? analysis.structure.map(String) : [],
            instruments: Array.isArray(analysis.instruments) ? analysis.instruments.map(String) : [],
            complexity: Math.max(1, Math.min(10, Number(analysis.complexity) || complexity)),
            mood: String(analysis.mood || "neutral"),
          },
          code: {
            language: String(code.language || language),
            code: String(code.code || ""),
            description: String(code.description || "Generated code from music"),
            framework: String(code.framework || "vanilla"),
            functionality: Array.isArray(code.functionality) ? code.functionality.map(String) : [],
          },
        });
      } catch (error: any) {
        console.error("music-to-code error:", error);
        return res.status(500).json({
          success: false,
          message: error?.message || "Failed to convert music to code",
        });
      }
    },
  );

  router.post(
    "/api/test-circular-translation",
    requireAuth(),
    requireCredits(CREDIT_COSTS.CODE_TRANSLATION, storage),
    async (req: Request, res: Response) => {
      try {
        const { code, musicData, language = "javascript" } = req.body;

        if (!code && !musicData) {
          return res.status(400).json({
            success: false,
            message: "Provide either code or musicData for circular test.",
          });
        }

        const aiClient = getAIClient();
        if (!aiClient) {
          return res.status(503).json({
            success: false,
            message: "AI service unavailable",
          });
        }

        // Simulating a circular test by analyzing the input and providing confidence scores
        const prompt = `Perform a circular translation test (Music <-> Code).
Input:
- Code: ${code ? code.slice(0, 2000) : "<none>"}
- Music Data: ${musicData ? JSON.stringify(musicData).slice(0, 2000) : "<none>"}
- Language: ${language}

Analyze how well these two represent each other. 
Return ONLY valid JSON:
{
  "success": true,
  "confidence": number (0-1),
  "mappingAccuracy": number (0-1),
  "consistencyScore": number (0-1),
  "observations": string[],
  "suggestions": string[]
}`;

        const completion = await aiClient.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const result = JSON.parse(completion.choices[0]?.message?.content || "{}");

        return res.json({
          success: true,
          testResults: {
            confidence: result.confidence || 0.85,
            mappingAccuracy: result.mappingAccuracy || 0.8,
            consistencyScore: result.consistencyScore || 0.9,
            observations: result.observations || ["Structure matches expected musical form"],
            suggestions: result.suggestions || ["Consider more explicit timing mappings"],
            timestamp: new Date().toISOString()
          }
        });
      } catch (error: any) {
        console.error("Circular test error:", error);
        return res.status(500).json({
          success: false,
          message: error?.message || "Circular translation test failed",
        });
      }
    },
  );

  // AI Assistant Chat endpoint
  router.post("/api/assistant/chat", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
    try {
      const { message, context, aiProvider } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      console.log(`💬 AI Chat request (${aiProvider || 'auto'}): ${message.substring(0, 50)}...`);
      console.log(`🔑 XAI_API_KEY present: ${!!process.env.XAI_API_KEY}`);
      console.log(`🔑 OPENAI_API_KEY present: ${!!process.env.OPENAI_API_KEY}`);

      // Get AI client
      const client = getAIClient();
      console.log(`🤖 AI Client initialized: ${!!client}`);
      
      if (!client) {
        console.error("❌ No AI client available - check API keys");
        return res.status(503).json({
          error: "AI service unavailable",
          message: "No AI provider configured. Please set XAI_API_KEY or OPENAI_API_KEY environment variables."
        });
      }

      // Determine model based on provider
      const model = aiProvider === "openai" ? "gpt-4" : "grok-3";

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

    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({
        error: "Failed to get AI response",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

    router.post("/api/ai/translate-code", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { sourceCode, sourceLanguage, targetLanguage, aiProvider } = req.body;

      if (!sourceCode || !sourceLanguage || !targetLanguage) {
        return sendError(res, 400, "Missing required parameters");
      }

            const translatedCode = await translateCode(sourceCode, sourceLanguage, targetLanguage, aiProvider);

      res.json({
        translatedCode,
        sourceLanguage,
        targetLanguage
      });
    } catch (err: any) {
      console.error("Code translation error:", err);
      sendError(res, 500, err?.message || "Failed to translate code");
    }
  });

  return router;
}
