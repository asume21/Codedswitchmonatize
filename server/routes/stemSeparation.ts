// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { aiLimiter, sendError, upload } from "./common";

export function createStemSeparationRoutes() {
  const router = Router();
  // ============================================
  // AI STEM SEPARATION ENDPOINT
  // Uses Replicate's Demucs model with base64 file upload (no URL callback needed)
  // This avoids SSL/timeout issues by sending file data directly
  // ============================================
  router.post("/api/ai/stem-separation", aiLimiter, requireAuth(), async (req: Request, res: Response) => {
    try {
      const { audioUrl, stemCount, qualityMode } = req.body;

      const normalizedMode = typeof qualityMode === "string" ? qualityMode.toLowerCase() : "standard";
      const requestedStemCountRaw = typeof stemCount === "number" ? Math.trunc(stemCount) : undefined;
      const defaultStemCount = normalizedMode === "pro" ? 4 : 2;
      const requestedStemCount = requestedStemCountRaw ?? defaultStemCount;
      const coercedStemCount = requestedStemCount === 5 ? 4 : requestedStemCount;

      const validStemCounts = [2, 4];
      const stems = validStemCounts.includes(coercedStemCount) ? coercedStemCount : defaultStemCount;
      const qualityLabel = stems === 4 ? "pro" : "standard";
      const fallbackReason =
        requestedStemCount === 5
          ? "5-stem separation is not supported in current Demucs integration; using 4-stem pro mode"
          : requestedStemCount !== stems
            ? `Invalid stemCount ${requestedStemCount}; using ${stems}-stem ${qualityLabel} mode`
            : null;

      console.log('🎵 Stem separation request:', {
        audioUrl: audioUrl?.substring(0, 50),
        qualityMode: qualityLabel,
        requestedStemCount,
        actualStemCount: stems,
      });

      if (!audioUrl || typeof audioUrl !== 'string') {
        return res.status(400).json({
          success: false,
          error: "Audio URL is required",
          message: "Please provide a valid audio URL or file path"
        });
      }

      // Replicate cannot access browser-only blob URLs.
      if (audioUrl.startsWith('blob:')) {
        return res.status(400).json({
          success: false,
          error: "Invalid audio URL",
          message: "This looks like a browser blob URL. Please upload the audio using the Upload tab (Song Library), then click 'Separate Stems' from the library so the server can access it."
        });
      }

      // Convert relative URLs to absolute URLs
      let absoluteAudioUrl = audioUrl;
      if (audioUrl.startsWith('/')) {
        const forwardedProto = req.headers["x-forwarded-proto"];
        const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
        const host = req.headers.host || (process.env.APP_URL ? new URL(process.env.APP_URL).host : "localhost");
        absoluteAudioUrl = `${proto}://${host}${audioUrl}`;
        console.log(`🔄 Converting relative URL to absolute: ${audioUrl} → ${absoluteAudioUrl}`);
      }

      const { stemSeparationService } = await import('../services/stemSeparation');
      
      if (!stemSeparationService.isConfigured()) {
        console.error('❌ REPLICATE_API_TOKEN not configured');
        return res.status(503).json({
          success: false,
          error: "Stem separation service not configured",
          message: "REPLICATE_API_TOKEN is not set. Please configure it in environment variables.",
          configured: false
        });
      }

      console.log(`🎵 Starting LOCAL stem separation: ${stems} stems...`);
      console.log(`📁 Processing file locally (no URL callback needed)`);

      // Use the new local file-based separation service
      // This converts the file to base64 and sends it directly to Replicate
      // No need for public URLs or SSL callbacks!
      const result = await stemSeparationService.separateStems(absoluteAudioUrl, stems as 2 | 4);

      if (!result.success) {
        console.error('❌ Stem separation failed:', result.error);
        return res.status(500).json({
          success: false,
          error: "Stem separation failed",
          message: result.error || "Failed to separate stems"
        });
      }

      console.log('✅ Stem separation completed!');
      console.log('📁 Stems saved locally:', result);

      // Return the results directly (no polling needed!)
      res.json({
        success: true,
        status: 'completed',
        qualityMode: qualityLabel,
        requestedStemCount,
        actualStemCount: stems,
        fallbackReason,
        stems: {
          vocals: result.vocals,
          instrumental: result.instrumental,
          drums: result.drums,
          bass: result.bass,
          other: result.other,
        },
        jobId: result.jobId,
        message: `Successfully separated into ${Object.values(result).filter(v => v && typeof v === 'string' && v.startsWith('/api/')).length} stems`
      });

    } catch (error: any) {
      console.error("❌ Stem separation error:", error);
      console.error("❌ Error stack:", error.stack);
      res.status(500).json({
        success: false,
        error: "Stem separation failed",
        message: error.message || "Failed to start stem separation",
        details: error.stack || error.toString()
      });
    }
  });

  // Legacy status endpoint (kept for backward compatibility, but new flow doesn't need polling)
  router.get("/api/ai/stem-separation/status/:predictionId", async (req: Request, res: Response) => {
    try {
      const { predictionId } = req.params;

      if (!predictionId) {
        return sendError(res, 400, "Prediction ID required");
      }

      // The new flow completes synchronously, so this endpoint is mainly for legacy support
      // Check if we have a local job with this ID
      const { stemSeparationService } = await import('../services/stemSeparation');
      const job = stemSeparationService.getJob(predictionId);
      
      if (job) {
        if (job.status === 'completed' && job.result) {
          return res.json({
            success: true,
            status: 'completed',
            stems: job.result
          });
        } else if (job.status === 'failed') {
          return res.json({
            success: false,
            status: 'failed',
            error: job.error || 'Separation failed'
          });
        } else {
          return res.json({
            success: true,
            status: 'processing',
            message: 'Still processing...'
          });
        }
      }

      // Fallback: check Replicate directly for old predictions
      const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
      if (!REPLICATE_API_TOKEN) {
        return sendError(res, 503, "Stem separation service not configured");
      }

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        },
      });

      if (!statusResponse.ok) {
        return sendError(res, 500, "Failed to check status");
      }

      const status = await statusResponse.json() as any;

      if (status.status === 'succeeded') {
        console.log('✅ Stem separation completed, output:', JSON.stringify(status.output, null, 2));
        
        const output = status.output;
        if (!output || typeof output !== 'object') {
          console.error('❌ Invalid output structure from Replicate:', output);
          return res.json({
            success: false,
            status: 'failed',
            error: 'Invalid output structure from AI service'
          });
        }
        
        const stems: Record<string, string> = {};
        const validStems: string[] = [];
        
        for (const [field, value] of Object.entries(output)) {
          if (value && typeof value === 'string') {
            try {
              const url = new URL(value);
              if (['http:', 'https:', 'data:'].includes(url.protocol)) {
                stems[field] = value;
                validStems.push(field);
              }
            } catch {
              // Skip invalid URLs
            }
          }
        }
        
        if (validStems.length === 0) {
          return res.json({
            success: false,
            status: 'failed',
            error: 'No valid stems returned'
          });
        }
        
        res.json({
          success: true,
          status: 'completed',
          stems: stems
        });
      } else if (status.status === 'failed') {
        res.json({
          success: false,
          status: 'failed',
          error: status.error || 'Separation failed'
        });
      } else {
        res.json({
          success: true,
          status: 'processing',
          message: 'Still processing...'
        });
      }

    } catch (error: any) {
      console.error("Status check error:", error);
      sendError(res, 500, error.message || "Failed to check status");
    }
  });

  return router;
}
