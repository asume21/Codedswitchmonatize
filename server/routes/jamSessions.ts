// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { sendError } from "./common";
import type { IStorage } from "../storage";

export function createJamSessionRoutes(storage: IStorage) {
  const router = Router();
  // ============================================
  // JAM SESSIONS API (feature-gated)
  // ============================================
  const enableJams = process.env.ENABLE_JAMS === "true";
  if (enableJams) {
    // Get active jam sessions
    router.get("/api/jam-sessions", requireAuth(), async (req: Request, res: Response) => {
      try {
        const sessions = await storage.getActiveJamSessions();
        res.json({ success: true, sessions });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to get jam sessions");
      }
    });

    // Get user's jam sessions
    router.get("/api/jam-sessions/mine", requireAuth(), async (req: Request, res: Response) => {
      try {
        const sessions = await storage.getUserJamSessions(req.userId!);
        res.json({ success: true, sessions });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to get your jam sessions");
      }
    });

    // Get single jam session
    router.get("/api/jam-sessions/:id", requireAuth(), async (req: Request, res: Response) => {
      try {
        const session = await storage.getJamSession(req.params.id);
        if (!session) {
          return sendError(res, 404, "Jam session not found");
        }
        const contributions = await storage.getJamContributions(session.id);
        res.json({ success: true, session, contributions });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to get jam session");
      }
    });

    // Create jam session
    router.post("/api/jam-sessions", requireAuth(), async (req: Request, res: Response) => {
      try {
        const { name, description, genre, bpm, keySignature, isPublic, maxParticipants } = req.body;
        if (!name) {
          return sendError(res, 400, "Session name is required");
        }
        const session = await storage.createJamSession(req.userId!, {
          name,
          description,
          genre,
          bpm: bpm || 120,
          keySignature,
          isPublic: isPublic !== false,
          maxParticipants: maxParticipants || 10,
        });
        res.json({ success: true, session });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to create jam session");
      }
    });

    // End jam session
    router.post("/api/jam-sessions/:id/end", requireAuth(), async (req: Request, res: Response) => {
      try {
        const session = await storage.getJamSession(req.params.id);
        if (!session) {
          return sendError(res, 404, "Jam session not found");
        }
        if (session.hostId !== req.userId) {
          return sendError(res, 403, "Only the host can end this session");
        }
        const ended = await storage.endJamSession(req.params.id);
        res.json({ success: true, session: ended });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to end jam session");
      }
    });

    // Add contribution to jam session
    router.post("/api/jam-sessions/:id/contribute", requireAuth(), async (req: Request, res: Response) => {
      try {
        const { type, audioUrl, position, duration } = req.body;
        if (!type || !audioUrl) {
          return sendError(res, 400, "type and audioUrl are required");
        }
        const contribution = await storage.createJamContribution(req.params.id, req.userId!, {
          type,
          audioUrl,
          position: position || 0,
          duration,
        });
        res.json({ success: true, contribution });
      } catch (err: any) {
        sendError(res, 500, err?.message || "Failed to add contribution");
      }
    });
  }

  return router;
}
