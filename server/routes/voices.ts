// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireCredits } from "../middleware/requireCredits";
import { extractPitch, pitchCorrect } from "../services/audioAnalysis";
import { resolveLocalAudioPath } from "../services/audioPathResolver";
import { CREDIT_COSTS } from "../services/credits";
import { checkRvcHealth, convertWithVoice, createVoice, deleteVoice, getVoice, listVoices } from "../services/voiceLibrary";
import { resolveAudioPath, sanitizePath } from "../utils/security";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { LOCAL_OBJECTS_DIR, NOTE_NAMES, estimateDominantPitchClass, sendError } from "./common";
import type { IStorage } from "../storage";

export function createVoiceRoutes(storage: IStorage) {
  const router = Router();
  // ============================================
  // VOICE LIBRARY ENDPOINTS
  // Manage voice models for voice conversion
  // ============================================

  // Health check for RVC/voice conversion API
  router.get("/api/voices/health", async (_req: Request, res: Response) => {
    try {
      const health = await checkRvcHealth();
      res.json({ success: true, ...health });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Health check failed";
      sendError(res, 500, message);
    }
  });

  // List all voices for current user
  router.get("/api/voices", requireAuth(), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return sendError(res, 401, "Not authenticated");
      }
      const voices = listVoices(userId);
      res.json({ success: true, voices });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to list voices";
      sendError(res, 500, message);
    }
  });

  // Get a specific voice
  router.get("/api/voices/:voiceId", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { voiceId } = req.params;
      const voice = getVoice(voiceId);
      if (!voice) {
        return sendError(res, 404, "Voice not found");
      }
      res.json({ success: true, voice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to get voice";
      sendError(res, 500, message);
    }
  });

  // Create a new voice from uploaded audio
  router.post(
    "/api/voices",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).session?.userId;
        if (!userId) {
          return sendError(res, 401, "Not authenticated");
        }

        const { objectKey, fileUrl, name, duration } = req.body;
        if (!objectKey && !fileUrl) {
          return sendError(res, 400, "objectKey or fileUrl required");
        }

        const targetPath = resolveAudioPath({ objectKey, fileUrl }, LOCAL_OBJECTS_DIR);
        if (!targetPath) {
          return sendError(res, 400, "Invalid or missing objectKey/fileUrl");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const voice = await createVoice(userId, targetPath, name || "My Voice", duration || 0);
        res.json({ success: true, voice });
      } catch (error: unknown) {
        console.error("Create voice error:", error);
        const message = error instanceof Error ? error.message : "Failed to create voice";
        sendError(res, 500, message);
      }
    }
  );

  // Delete a voice
  router.delete(
    "/api/voices/:voiceId",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).session?.userId;
        if (!userId) {
          return sendError(res, 401, "Not authenticated");
        }

        const { voiceId } = req.params;
        const deleted = deleteVoice(voiceId, userId);
        if (!deleted) {
          return sendError(res, 404, "Voice not found");
        }
        res.json({ success: true });
      } catch (error: unknown) {
        console.error("Delete voice error:", error);
        const message = error instanceof Error ? error.message : "Failed to delete voice";
        if (message === "Access denied") {
          return sendError(res, 403, message);
        }
        sendError(res, 500, message);
      }
    }
  );

  // Convert audio using a voice model
  router.post(
    "/api/voices/:voiceId/convert",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        const { voiceId } = req.params;
        const {
          audioUrl,
          fileUrl,
          objectKey,
          pitch,
          indexRate,
          filterRadius,
          rmsMixRate,
          protect,
          provider,
        } = req.body;

        const selectedProvider = typeof provider === "string" ? provider.toLowerCase() : "rvc";
        const resolvedSourcePath = (() => {
          // objectKey is a storage key, not a url, so it keeps its own resolver.
          if (objectKey) {
            const byKey = sanitizePath(objectKey, LOCAL_OBJECTS_DIR);
            if (byKey && fs.existsSync(byKey)) return byKey;
          }
          // Everything url-shaped goes through the shared resolver, which knows
          // stems natively — this hand-rolled stem branch existed precisely
          // because resolveAudioPath knew only uploads, and it still left
          // /api/songs/converted/ (the form every upload has) unresolvable.
          return resolveLocalAudioPath(fileUrl || audioUrl);
        })();

        let sourceUrl = audioUrl;
        if (!sourceUrl && objectKey) {
          sourceUrl = `/api/internal/uploads/${objectKey}`;
        }
        if (!sourceUrl) {
          return sendError(res, 400, "audioUrl or objectKey required");
        }

        const resultUrl = await convertWithVoice(voiceId, sourceUrl, {
          pitch,
          indexRate,
          filterRadius,
          rmsMixRate,
          protect,
          provider: selectedProvider === "elevenlabs" ? "elevenlabs" : "rvc",
          sourcePath: resolvedSourcePath || undefined,
        });

        res.json({ success: true, url: resultUrl });
      } catch (error: unknown) {
        console.error("Voice convert error:", error);
        const message = error instanceof Error ? error.message : "Voice conversion failed";
        sendError(res, 500, message);
      }
    }
  );

  // Convert vocal stem with V2 refinement (gentle key lock + polished remix)
  router.post(
    "/api/voices/:voiceId/convert-v2",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        const { voiceId } = req.params;
        const {
          audioUrl,
          fileUrl,
          objectKey,
          instrumentalUrl,
          instrumentalFileUrl,
          instrumentalObjectKey,
          provider,
          keyMode,
          root,
          correctionStrength,
          pitch,
          indexRate,
          filterRadius,
          rmsMixRate,
          protect,
        } = req.body;

        const selectedProvider = typeof provider === "string" ? provider.toLowerCase() : "elevenlabs";
        const sanitizedMode = typeof keyMode === "string" && keyMode.toLowerCase() === "minor" ? "minor" : "major";
        const targetCorrectionStrength =
          typeof correctionStrength === "number"
            ? Math.max(0, Math.min(1, correctionStrength))
            : 0.48;

        const resolveOutputPath = (url: string): string | null => {
          if (url.startsWith("/api/internal/uploads/voices/outputs/")) {
            const name = path.basename(decodeURIComponent(url.replace("/api/internal/uploads/voices/outputs/", "")));
            const candidate = path.resolve(process.cwd(), "objects", "voices", "outputs", name);
            return fs.existsSync(candidate) ? candidate : null;
          }
          if (url.startsWith("/api/internal/uploads/audio-analysis/")) {
            const name = path.basename(decodeURIComponent(url.replace("/api/internal/uploads/audio-analysis/", "")));
            const candidate = path.resolve(process.cwd(), "objects", "audio-analysis", name);
            return fs.existsSync(candidate) ? candidate : null;
          }
          return null;
        };

        const resolvedVocalPath =
          resolveAudioPath({ objectKey, fileUrl: fileUrl || audioUrl }, LOCAL_OBJECTS_DIR);

        if (!resolvedVocalPath) {
          return sendError(res, 400, "Unable to resolve source vocal path from audioUrl/objectKey/fileUrl");
        }

        let sourceUrl = audioUrl;
        if (!sourceUrl && objectKey) {
          sourceUrl = `/api/internal/uploads/${objectKey}`;
        }
        if (!sourceUrl && fileUrl) {
          sourceUrl = fileUrl;
        }
        if (!sourceUrl) {
          return sendError(res, 400, "audioUrl or objectKey required");
        }

        const convertedUrl = await convertWithVoice(voiceId, sourceUrl, {
          pitch,
          indexRate,
          filterRadius,
          rmsMixRate,
          protect,
          provider: selectedProvider === "rvc" ? "rvc" : selectedProvider === "replicate-rvc" ? "replicate-rvc" : "elevenlabs",
          sourcePath: resolvedVocalPath,
        });

        const convertedPath = resolveOutputPath(convertedUrl);
        if (!convertedPath) {
          return sendError(res, 500, "Converted output path could not be resolved");
        }

        const resolvedInstrumentalPath =
          resolveAudioPath(
            {
              objectKey: instrumentalObjectKey,
              fileUrl: instrumentalFileUrl || instrumentalUrl,
            },
            LOCAL_OBJECTS_DIR,
          );

        let resolvedRoot: number = typeof root === "number" ? ((Math.round(root) % 12) + 12) % 12 : 0;
        if (typeof root !== "number" && resolvedInstrumentalPath) {
          const instrumentalPitch = await extractPitch(resolvedInstrumentalPath);
          const estimated = estimateDominantPitchClass(instrumentalPitch?.pitch_hz || []);
          if (estimated !== null) {
            resolvedRoot = estimated;
          }
        }

        const correctionScale = `${NOTE_NAMES[resolvedRoot]}_${sanitizedMode}`;
        const correctedUrl = await pitchCorrect(convertedPath, {
          scale: correctionScale,
          root: resolvedRoot,
          correctionStrength: targetCorrectionStrength,
        });
        const finalVocalUrl = correctedUrl || convertedUrl;
        const finalVocalPath = correctedUrl ? resolveOutputPath(correctedUrl) : convertedPath;

        if (!resolvedInstrumentalPath || !finalVocalPath) {
          return res.json({
            success: true,
            mode: "v2-vocal-only",
            convertedUrl,
            correctedVocalUrl: finalVocalUrl,
            remixUrl: null,
            tuning: {
              scale: correctionScale,
              root: resolvedRoot,
              keyMode: sanitizedMode,
              correctionStrength: targetCorrectionStrength,
              rootEstimated: typeof root !== "number",
            },
          });
        }

        const outputsDir = path.resolve(process.cwd(), "objects", "voices", "outputs");
        fs.mkdirSync(outputsDir, { recursive: true });
        const remixFilename = `remix-v2-${crypto.randomUUID()}.mp3`;
        const remixPath = path.join(outputsDir, remixFilename);

        const runMix = (useSidechain: boolean): Promise<void> =>
          new Promise((resolve, reject) => {
            const sidechainBlock = useSidechain
              ? "[a1]asplit=2[a1sc][a1mix];[a0][a1sc]sidechaincompress=threshold=0.06:ratio=3.5:attack=8:release=180[ducked];[ducked][a1mix]amix=inputs=2:duration=longest:weights='0.9 1.35':normalize=0:dropout_transition=2,alimiter=limit=0.95[out]"
              : "[a0][a1]amix=inputs=2:duration=longest:weights='0.9 1.35':normalize=0:dropout_transition=2,alimiter=limit=0.95[out]";

            const filter = [
              "[0:a]volume=0.92[a0]",
              "[1:a]volume=0.86,highpass=f=95,agate=threshold=0.03:range=0.35:ratio=2.2:attack=4:release=75,acompressor=threshold=-21dB:ratio=2.3:attack=8:release=95,equalizer=f=6800:t=q:w=1.2:g=-1.4,equalizer=f=12000:t=q:w=0.8:g=-0.4,volume=1.0[a1]",
              sidechainBlock,
            ].join(";");

            ffmpeg()
              .input(resolvedInstrumentalPath)
              .input(finalVocalPath)
              .complexFilter(filter)
              .outputOptions(["-map [out]", "-c:a libmp3lame", "-b:a 320k"])
              .on("end", () => resolve())
              .on("error", (err: Error) => reject(err))
              .save(remixPath);
          });

        try {
          await runMix(true);
        } catch {
          await runMix(false);
        }

        res.json({
          success: true,
          mode: "v2-full",
          convertedUrl,
          correctedVocalUrl: finalVocalUrl,
          remixUrl: `/api/internal/uploads/voices/outputs/${remixFilename}`,
          tuning: {
            scale: correctionScale,
            root: resolvedRoot,
            keyMode: sanitizedMode,
            correctionStrength: targetCorrectionStrength,
            rootEstimated: typeof root !== "number",
          },
        });
      } catch (error: unknown) {
        console.error("Voice convert V2 error:", error);
        const message = error instanceof Error ? error.message : "Voice conversion V2 failed";
        sendError(res, 500, message);
      }
    }
  );

  return router;
}
