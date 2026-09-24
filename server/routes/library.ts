// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { sendError } from "./common";
import type { IStorage } from "../storage";

export function createLibraryRoutes(storage: IStorage) {
  const router = Router();
  // Get user melodies
  router.get("/api/melodies", requireAuth(), async (req: Request, res: Response) => {
    try {
      const melodies = await storage.getUserMelodies(req.userId!);
      res.json(melodies);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to fetch melodies");
    }
  });

  // Save melody
  router.post("/api/melodies", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { title, notes, scale } = req.body;
      
      if (!title || !notes) {
                return sendError(res, 400, "Title and notes are required");
      }

      const melody = await storage.createMelody(req.userId!, {
        name: title,
        notes: JSON.stringify(notes),
        scale: scale || "C Major"
      });

      res.status(201).json(melody);
    } catch (err: any) {
            sendError(res, 500, err?.message || "Failed to save melody");
    }
  });

  // NOTE: /api/packs/generate is handled by createPackRoutes() mounted at /api/packs (line 204)
  // It supports multiple providers: local-samples, structure, suno, jasco, intelligent, musicgen

  // Save pack to library
  router.post(
    "/api/packs/save",
    async (req: Request, res: Response) => {
      try {
        const { pack } = req.body;
        
        if (!pack) {
          return sendError(res, 400, "Pack data is required");
        }

        // Create pack in database
        const savedPack = await storage.createSamplePack({
          name: pack.title,
          genre: pack.genre,
          mood: pack.metadata?.mood || "Dynamic",
          description: pack.description,
          generatedSamples: pack.samples, // Store all sample data as JSON
        });

        console.log('✅ Pack saved to database:', savedPack.id);

        res.json({ 
          success: true,
          packId: savedPack.id,
          message: "Pack saved to library successfully"
        });
      } catch (err: any) {
        console.error("Save pack error:", err);
        res.status(500).json({ message: err?.message || "Failed to save pack" });
      }
    }
  );

  return router;
}
