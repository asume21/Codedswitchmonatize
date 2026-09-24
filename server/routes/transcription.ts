// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireCredits } from "../middleware/requireCredits";
import { classifyLocalAudioPath } from "../services/audioPathResolver";
import { CREDIT_COSTS } from "../services/credits";
import { transcribeAudio } from "../services/transcriptionService";
import { sanitizePath } from "../utils/security";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { LOCAL_OBJECTS_DIR, sendError, upload } from "./common";
import type { IStorage } from "../storage";

export function createTranscriptionRoutes(storage: IStorage) {
  const router = Router();
  // Transcription endpoint
  router.post(
    "/api/organism/live-transcribe",
    requireAuth(),
    upload.single("audio"),
    async (req: Request, res: Response) => {
      const uploaded = req.file;
      if (!uploaded?.buffer?.length) {
        return sendError(res, 400, "Missing audio chunk");
      }

      const liveDir = path.join(os.tmpdir(), "codedswitch-live-transcribe");
      fs.mkdirSync(liveDir, { recursive: true });

      const safeExt = uploaded.mimetype.includes("ogg") ? "ogg" : "webm";
      const tempPath = path.join(liveDir, `${crypto.randomUUID()}.${safeExt}`);

      try {
        fs.writeFileSync(tempPath, uploaded.buffer);
        const result = await transcribeAudio(tempPath);
        const text = typeof result === "string" ? result : result.text || "";
        res.json({ success: true, text, transcription: result });
      } catch (error) {
        console.error("❌ Live organism transcription failed:", error);
        return sendError(
          res,
          500,
          error instanceof Error ? error.message : "Live transcription failed"
        );
      } finally {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {
          // Best effort cleanup.
        }
      }
    }
  );

  router.post(
    "/api/transcribe",
    requireAuth(),
    requireCredits(CREDIT_COSTS.TRANSCRIPTION, storage),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;
        
        if (!objectKey && !fileUrl) {
          return sendError(res, 400, "Missing objectKey or fileUrl");
        }

        let targetPath: string;

        if (objectKey) {
           // objectKey is a storage key, not a url — sanitizePath is its resolver.
           targetPath = sanitizePath(objectKey, LOCAL_OBJECTS_DIR) || '';
        } else if (fileUrl) {
           // The shared resolver, so this route knows stems and /objects/ too —
           // not just the two forms it happened to have learned.
           const found = classifyLocalAudioPath(fileUrl);
           if ('path' in found) {
              targetPath = found.path;
              console.log('🎤 Resolved file for transcription:', targetPath);
           } else if (found.error === 'missing') {
              return sendError(res, 404, "Audio file not found on server");
           } else {
              return sendError(res, 400, "External URLs not yet supported for transcription");
           }
        } else {
           return sendError(res, 400, "Missing objectKey or fileUrl");
        }

        // Security check to prevent directory traversal
        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
            return sendError(res, 403, "Access denied");
        }

        if (!fs.existsSync(targetPath)) {
           return sendError(res, 404, "Audio file not found on server");
        }

        console.log('🎤 Transcribing file:', targetPath);
        const result = await transcribeAudio(targetPath);
        
        // Extract text from result (could be string or object with text property)
        const transcriptionText = typeof result === 'string' 
          ? result 
          : (result?.text || JSON.stringify(result));
        
        // Save transcription to database if songId is provided
        const { songId } = req.body;
        if (songId && req.userId) {
          try {
            await storage.updateSongTranscription(songId, req.userId, {
              transcription: transcriptionText,
              transcriptionStatus: 'completed',
              transcribedAt: new Date()
            });
            console.log('✅ Transcription saved to database for song:', songId);
          } catch (dbError) {
            console.warn('⚠️ Could not save transcription to database:', dbError);
            // Continue anyway - transcription was successful
          }
        }
        
        res.json({ success: true, transcription: result });

        // Deduct credits after successful transcription
        if (req.creditService && req.creditCost) {
          try {
            await req.creditService.deductCredits(
              req.userId!,
              req.creditCost,
              'Transcription',
              { hasSongId: Boolean(songId) }
            );
          } catch (deductError) {
            console.warn('⚠️ Failed to deduct transcription credits:', deductError);
          }
        }

      } catch (error: any) {
        console.error("Transcription error:", error);
        
        // Update status to failed if songId provided
        const { songId } = req.body;
        if (songId && req.userId) {
          try {
            await storage.updateSongTranscription(songId, req.userId, {
              transcriptionStatus: 'failed'
            });
          } catch (e) { /* ignore */ }
        }
        
        sendError(res, 500, error.message || "Transcription failed");
      }
    }
  );

  return router;
}
