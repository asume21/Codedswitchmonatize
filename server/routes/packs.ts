import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { IStorage } from "../storage";
import { unifiedMusicService } from "../services/unifiedMusicService";
import { jascoMusicService } from "../services/jascoMusic";
import { generateSamplePacksWithGemini } from "../services/gemini";
import { generateIntelligentPacks } from "../services/packGenerator";
import { localSampleLibrary } from "../services/localSampleLibrary";

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
        const { prompt, count, provider, bpm: requestedBpm } = (req.body || {}) as {
          prompt?: string;
          count?: number;
          provider?: string;
          bpm?: number;
        };

        if (!prompt || typeof prompt !== "string") {
          return sendError(res, 400, "Prompt is required");
        }

        const packCount = Math.max(1, Math.min(typeof count === "number" ? count : parseInt(String(count || 4), 10) || 4, 8));
        const providerId = (provider || "musicgen").toLowerCase();

        let packs;

        switch (providerId) {
          case "local-samples":
            // Use local sample library - instant, free, no API required
            const { bpm: localBpm, genre: localGenre } = (req.body || {}) as { bpm?: number; genre?: string };
            const samplePack = await localSampleLibrary.generatePack({
              genre: localGenre || prompt,
              bpm: localBpm || 120,
              includeLoops: true,
              sampleCount: packCount * 2 // More samples per pack
            });
            
            // Convert to expected format
            packs = [{
              id: samplePack.id,
              title: samplePack.name,
              description: samplePack.description,
              bpm: samplePack.bpm,
              key: 'C',
              genre: samplePack.genre || 'Electronic',
              samples: samplePack.samples.map(s => ({
                id: s.id,
                name: s.filename.replace('.wav', ''),
                type: s.type === 'loop' ? 'loop' : 'oneshot',
                duration: 1.0,
                audioUrl: s.url,
                url: s.url
              })),
              metadata: {
                energy: 75,
                mood: 'energetic',
                instruments: samplePack.samples.map(s => s.type),
                tags: ['local', 'samples', samplePack.genre || 'electronic']
              }
            }];
            break;
          case "structure":
            try {
              packs = await generateSamplePacksWithGemini(prompt, packCount);
            } catch (err) {
              console.warn("Gemini pack generation unavailable, falling back to intelligent generator:", err);
              packs = generateIntelligentPacks(prompt, packCount);
            }
            break;
          case "jasco":
            packs = await jascoMusicService.generateSamplePack(prompt, packCount);
            break;
          case "intelligent":
            packs = generateIntelligentPacks(prompt, packCount);
            break;
          case "local":
            // Unified service handles fallback logic internally
            packs = await unifiedMusicService.generateSamplePack(prompt, { packCount, bpm: requestedBpm });
            break;
          case "looper":
          case "musicgen-looper":
            // Use Unified Service which supports Looper
            packs = await unifiedMusicService.generateSamplePack(prompt, {
              bpm: requestedBpm,
              packCount: Math.ceil(packCount / 4)
            });
            break;
          case "musicgen":
          default:
            // Forwarding the tempo is NOT optional. Without it the service used
            // its own bpm=120 default while the prompt said something else, and
            // musicgen-looper failed with "Failed to generate a loop in the
            // requested 120.0 bpm" — or worse, succeeded at the wrong tempo.
            packs = await unifiedMusicService.generateSamplePack(prompt, { packCount, bpm: requestedBpm });
            break;
        }

        // `provider` is what was ASKED for; the ACE-first providers fall back
        // silently to the looper and then to the local generator, so echoing
        // the request credited ACE-Step for packs it never rendered. Report the
        // engine the packs actually came from alongside it.
        const generators = Array.from(
          new Set((packs ?? []).map((p: any) => p?.generator).filter(Boolean)),
        );

        res.json({
          success: true,
          provider: providerId,
          generator: generators.length === 1 ? generators[0] : (generators[0] ?? null),
          generators,
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
