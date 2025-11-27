import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { IStorage } from "../storage";
import { musicGenService } from "../services/musicgen";
import { localMusicGenService } from "../services/local-musicgen";
import { jascoMusicService } from "../services/jascoMusic";
import { generateSamplePacksWithGemini } from "../services/gemini";
import { generateIntelligentPacks, generateSunoPacks } from "../services/packGenerator";
import { replicateMusic } from "../services/replicateMusicGenerator";

const router = Router();

const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, message });
};

export function createPackRoutes(_storage: IStorage) {
  // Unified Pack Generator endpoint
  router.post(
    "/generate",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { prompt, count, provider } = (req.body || {}) as {
          prompt?: string;
          count?: number;
          provider?: string;
        };

        if (!prompt || typeof prompt !== "string") {
          return sendError(res, 400, "Prompt is required");
        }

        const packCount = Math.max(1, Math.min(typeof count === "number" ? count : parseInt(String(count || 4), 10) || 4, 8));
        const providerId = (provider || "musicgen").toLowerCase();

        let packs;

        switch (providerId) {
          case "structure":
            try {
              packs = await generateSamplePacksWithGemini(prompt, packCount);
            } catch (err) {
              console.warn("Gemini pack generation unavailable, falling back to intelligent generator:", err);
              packs = generateIntelligentPacks(prompt, packCount);
            }
            break;
          case "suno":
            packs = await generateSunoPacks(prompt, packCount);
            break;
          case "jasco":
            packs = await jascoMusicService.generateSamplePack(prompt, packCount);
            break;
          case "intelligent":
            packs = generateIntelligentPacks(prompt, packCount);
            break;
          case "local":
            packs = await localMusicGenService.generateSamplePack(prompt, packCount);
            break;
          case "looper":
          case "musicgen-looper":
            // Use MusicGen-Looper via Replicate for fixed-BPM loops
            const { bpm, genre } = (req.body || {}) as { bpm?: number; genre?: string };
            const looperResult = await replicateMusic.generateSamplePack(prompt, {
              bpm: bpm || 120,
              loopsPerType: Math.ceil(packCount / 4),
              genre: genre || "electronic",
              types: ["drums", "melody", "bass", "percussion"]
            });
            packs = [{
              id: `looper-pack-${Date.now()}`,
              title: `${genre || 'Electronic'} Loop Pack`,
              description: `AI-generated loops at ${bpm || 120} BPM`,
              samples: looperResult.samples,
              metadata: looperResult.metadata
            }];
            break;
          case "musicgen":
          default:
            packs = await musicGenService.generateSamplePack(prompt, packCount);
            break;
        }

        res.json({
          success: true,
          provider: providerId,
          packs
        });
      } catch (err: any) {
        console.error("Pack generation error:", err);
        res.status(500).json({ 
          success: false, 
          message: err?.message || "Failed to generate packs" 
        });
      }
    }
  );

  return router;
}
