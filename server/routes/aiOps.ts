// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { validateArrangementPlan } from "../../shared/arrangement";
import { requireAuth } from "../middleware/auth";
import { aiCache } from "../services/aiCache";
import { getAIGenerationMetricsSnapshot } from "../services/aiRouteMetrics";
import { analyzeCodeStructure } from "../services/codebeat/analyzeCodeStructure";
import { composeArrangementFromCode } from "../services/codebeat/composeArrangementFromCode";
import { aiLimiter, sendError } from "./common";

export function createAiOpsRoutes() {
  const router = Router();
  // ============================================
  // AI CACHE STATS ENDPOINT
  // Returns cache performance metrics
  // ============================================
  router.get("/api/ai/cache-stats", async (_req: Request, res: Response) => {
    try {
      const stats = aiCache.getStats();
      res.json({
        success: true,
        cache: stats
      });
    } catch (error: any) {
      sendError(res, 500, "Failed to get cache stats");
    }
  });

  router.get("/api/ai/generation-metrics", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const metrics = getAIGenerationMetricsSnapshot();
      return res.json({
        success: true,
        metrics,
      });
    } catch (error: any) {
      return sendError(res, 500, error?.message || "Failed to get AI generation metrics");
    }
  });

  // ============================================
  // CODE TO MUSIC ENDPOINT
  // ============================================
  // PUBLIC (no auth): Codebeat is the top-of-funnel hook — anyone can paste code
  // and get a beat plan without signing up. Safe to open: it's fully deterministic
  // (analyzeCodeStructure + composeArrangementFromCode, pure functions), calls no
  // external AI, touches no user data. aiLimiter (30/15min/IP) guards against abuse.
  router.post("/api/code-to-music", aiLimiter, async (req: Request, res: Response) => {
    try {
      const { code = '', language = 'javascript', genre = 'pop' } = req.body;
      console.log(`🎵 Codebeat: ${language} code → ArrangementPlan (genre: ${genre})`);

      const fingerprint = analyzeCodeStructure(String(code), String(language));
      const plan = composeArrangementFromCode(fingerprint, { genre: String(genre) });

      const problem = validateArrangementPlan(plan);
      if (problem) {
        return sendError(res, 422, `Generated plan invalid: ${problem}`);
      }

      res.json({ success: true, plan, fingerprint });
    } catch (error: any) {
      console.error("❌ Codebeat error:", error);
      sendError(res, 500, error?.message || "Failed to convert code to music");
    }
  });

  // Get available AI providers
  router.get("/api/ai-providers", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { aiProviderManager } = await import('../services/aiProviderManager');
      
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
      sendError(res, 500, "Failed to fetch AI providers");
    }
  });


  // Get user's AI provider preference
  router.get("/api/ai-provider/:feature", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { feature } = req.params;
      const { aiProviderManager } = await import('../services/aiProviderManager');
      
      const provider = aiProviderManager.getProvider(feature);
      
      res.json({
        status: 'success',
        feature: feature,
        provider: provider
      });
    } catch (error) {
      console.error('❌ Error getting provider:', error);
      sendError(res, 500, "Failed to get AI provider");
    }
  });

  return router;
}
