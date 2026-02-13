import { Router, Request, Response } from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { mixPreviewService, MixPreviewRequest } from "../services/mixPreview";
import { jobManager } from "../services/jobManager";
import { sanitizePath } from "../utils/security";

const router = Router();

const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, message });
};

export function createMixRoutes() {
  // ============================================
  // MIX PREVIEW ENDPOINTS - Timeline + Mixer DAW Core
  // ============================================

  /**
   * POST /mix/preview
   * Start a mix preview render job
   * Accepts full track graph with regions, inserts, sends, and master bus
   * Returns jobId for polling status
   */
  router.post("/mix/preview", requireAuth, async (req: Request, res: Response) => {
    try {
      const { session, renderQuality = 'fast', startTime, endTime, format = 'wav' } = req.body;

      if (!session) {
        return sendError(res, 400, "Session data is required");
      }

      if (!session.tracks || !Array.isArray(session.tracks)) {
        return sendError(res, 400, "Session must contain tracks array");
      }

      const request: MixPreviewRequest = {
        session,
        renderQuality: renderQuality === 'high' ? 'high' : 'fast',
        startTime,
        endTime,
        format: format === 'mp3' ? 'mp3' : 'wav',
      };

      const { jobId, estimatedTime } = await mixPreviewService.startPreview(request);

      // Emit event for real-time clients
      jobManager.emit('session:updated', { 
        type: 'mix-preview-started', 
        sessionId: session.id, 
        jobId 
      });

      return res.json({
        success: true,
        jobId,
        estimatedTime,
        message: `Mix preview job started. Poll /api/jobs/${jobId} for status.`,
      });
    } catch (error: any) {
      console.error("❌ Mix preview error:", error);
      sendError(res, 500, error?.message || "Failed to start mix preview");
    }
  });

  /**
   * GET /jobs/:id
   * Poll job status for async operations (mix preview, renders, etc.)
   */
  router.get("/jobs/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return sendError(res, 400, "Job ID is required");
      }

      const job = jobManager.getJob(id);

      if (!job) {
        return sendError(res, 404, "Job not found");
      }

      return res.json({
        success: true,
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.progress,
          result: job.result,
          error: job.error,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Job status error:", error);
      sendError(res, 500, error?.message || "Failed to get job status");
    }
  });

  /**
   * GET /mix/preview/:jobId/audio.:format
   * Serve the rendered audio file (placeholder - would serve actual file in production)
   */
  router.get("/mix/preview/:jobId/audio.:format", async (req: Request, res: Response) => {
    try {
      const { jobId, format } = req.params;

      const job = jobManager.getJob(jobId);

      if (!job) {
        return sendError(res, 404, "Preview job not found");
      }

      if (job.status !== 'completed') {
        return sendError(res, 400, `Preview not ready. Status: ${job.status}, Progress: ${job.progress}%`);
      }

      const resultData = job.result as any;
      const audioFilePath = resultData?.filePath || resultData?.audioPath || resultData?.outputPath;

      if (audioFilePath && fs.existsSync(audioFilePath)) {
        const resolvedPath = path.resolve(audioFilePath);
        // Ensure the file is within the project directory (prevent path traversal)
        const projectRoot = path.resolve(process.cwd());
        if (!resolvedPath.startsWith(projectRoot + path.sep) && !resolvedPath.startsWith('/tmp') && !resolvedPath.startsWith('/data')) {
          return sendError(res, 403, "Access denied");
        }
        const stat = fs.statSync(resolvedPath);
        const mimeType = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `attachment; filename="mix-preview-${jobId}.${format}"`);

        const stream = fs.createReadStream(resolvedPath);
        return stream.pipe(res);
      }

      const audioUrl = resultData?.audioUrl || resultData?.url;
      if (audioUrl) {
        return res.json({
          success: true,
          jobId,
          format,
          audioUrl,
          result: job.result,
        });
      }

      return sendError(res, 404, "Rendered audio file not found for this job. The mix preview may still be processing or the output was not saved.");
    } catch (error: any) {
      console.error("❌ Preview audio error:", error);
      sendError(res, 500, error?.message || "Failed to serve preview audio");
    }
  });

  /**
   * DELETE /jobs/:id
   * Cancel/delete a job
   */
  router.delete("/jobs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return sendError(res, 400, "Job ID is required");
      }

      const deleted = jobManager.deleteJob(id);

      if (!deleted) {
        return sendError(res, 404, "Job not found");
      }

      return res.json({
        success: true,
        message: "Job deleted",
      });
    } catch (error: any) {
      console.error("❌ Job delete error:", error);
      sendError(res, 500, error?.message || "Failed to delete job");
    }
  });

  return router;
}
