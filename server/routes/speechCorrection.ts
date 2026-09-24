// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireCredits } from "../middleware/requireCredits";
import { classifyLocalAudioPath } from "../services/audioPathResolver";
import { CREDIT_COSTS } from "../services/credits";
import { applyVoiceConversion, createVoiceIdForFile, generateSpeechPreview, getPreview, storePreview } from "../services/speechCorrection";
import { transcribeAudio } from "../services/transcriptionService";
import { sanitizePath } from "../utils/security";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { LOCAL_OBJECTS_DIR, sendError } from "./common";
import type { IStorage } from "../storage";

export function createSpeechCorrectionRoutes(storage: IStorage) {
  const router = Router();
  // Speech correction: transcribe with timestamps (reuse existing transcribe)
  router.post(
    "/api/speech-correction/transcribe",
    requireAuth(),
    requireCredits(CREDIT_COSTS.TRANSCRIPTION, storage),
    async (req: Request, res: Response) => {
      // Delegate to existing /api/transcribe logic but return direct result
      try {
        const { objectKey, fileUrl, songId } = req.body;
        if (!objectKey && !fileUrl && !songId) return sendError(res, 400, "Missing objectKey, fileUrl, or songId");

        let targetPath: string | null = null;
        
        // Try to get file from database if songId provided
        if (songId) {
          try {
            const song = await storage.getSong(songId);
            const songAudioUrl = (song as any)?.audioUrl || song?.accessibleUrl || song?.originalUrl;
            if (songAudioUrl) {
              console.log(`🎵 Found song for transcription: ${song?.name || songId}, audioUrl: ${songAudioUrl}`);
              const found = classifyLocalAudioPath(songAudioUrl);
              if ('path' in found) {
                targetPath = found.path;
              } else {
                console.warn(`❌ Song ${songId} audio url did not resolve (${found.error}): ${songAudioUrl}`);
              }
            } else {
              console.warn(`❌ Song ${songId} has no audioUrl, accessibleUrl or originalUrl`);
            }
          } catch (dbError) {
            console.warn("Could not fetch song from database for transcription:", dbError);
          }
        }

        // Fallback to objectKey or fileUrl
        if (!targetPath) {
          if (objectKey) {
            // objectKey is a storage key, not a URL — sanitizePath is its resolver.
            targetPath = sanitizePath(objectKey, LOCAL_OBJECTS_DIR) || '';
          } else if (fileUrl) {
            const found = classifyLocalAudioPath(fileUrl);
            if ('path' in found) {
              targetPath = found.path;
            } else if (found.error === 'missing') {
              return sendError(res, 404, "Audio file not found on server");
            } else {
              return sendError(res, 400, "External URLs not supported for speech-correction transcription");
            }
          }
        }
        
        if (!targetPath) {
          return sendError(res, 404, "Could not locate audio file for transcription");
        }

        if (!fs.existsSync(targetPath)) {
          console.error(`❌ Transcription file not found: ${targetPath}`);
          return sendError(res, 404, "Audio file not found on server");
        }

        const result = await transcribeAudio(targetPath);
        const transcriptText = typeof result === "string" ? result : result?.text || "";
        
        // Extract word-level timestamps (not segments)
        const wordSegments =
          Array.isArray((result as any)?.words) && (result as any).words.length
            ? (result as any).words.map((w: any) => ({
                start: w.start,
                end: w.end,
                text: w.word || w.text,
              }))
            : [];
        
        console.log(`📝 Extracted ${wordSegments.length} word-level timestamps`);
        if (songId && req.userId) {
          try {
            await storage.updateSongTranscription(songId, req.userId, {
              transcription: transcriptText,
              transcriptionStatus: "completed",
              transcribedAt: new Date(),
            });
          } catch (dbError) {
            console.warn("⚠️ Could not save transcription to database:", dbError);
          }
        }
        res.json({
          success: true,
          transcript: transcriptText,
          words: wordSegments,
          raw: result,
        });
      } catch (error: any) {
        console.error("Speech-correction transcription error:", error);
        sendError(res, 500, error.message || "Transcription failed");
      }
    }
  );

  // Persistent preview storage (JSON-backed via speechCorrection service)

  router.post(
    "/api/speech-correction/preview",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        const transcript = (req.body.transcriptEdits || req.body.transcript || "").trim();
        const { duration, stylePrompt, wordTiming, voiceId } = req.body;
        if (!transcript) return sendError(res, 400, "Missing transcript");

        // Log text stats for debugging
        const wordCount = transcript.split(/\s+/).length;
        const charCount = transcript.length;
        console.log(`📊 Preview text stats: ${wordCount} words, ${charCount} characters`);

        let url: string;

        // If voiceId provided, use XTTS voice cloning directly
        if (voiceId) {
          console.log(`🎤 Using voice cloning with voiceId: ${voiceId}`);
          url = await applyVoiceConversion(transcript, voiceId, { language: "en" });
        } else {
          // No voice sample - use Bark TTS
          url = await generateSpeechPreview({
            transcript,
            duration: duration ?? 15,
            stylePrompt,
          });
        }

        const previewId = crypto.randomUUID();
        storePreview({
          previewId,
          url,
          transcript,
          duration: duration ?? 15,
          createdAt: new Date().toISOString(),
          voiceId,
        });

        res.json({
          success: true,
          previewId,
          previewUrl: url,
          alignedWords: Array.isArray(wordTiming) ? wordTiming : [],
        });
      } catch (error: any) {
        console.error("Speech-correction preview error:", error);
        sendError(res, 500, error.message || "Preview generation failed");
      }
    }
  );

  router.post(
    "/api/speech-correction/commit",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        const { previewId } = req.body;
        if (!previewId) return sendError(res, 400, "Missing previewId");
        const preview = getPreview(previewId);
        if (!preview) return sendError(res, 404, "Preview not found");

        const versionId = crypto.randomUUID();
        res.json({
          success: true,
          versionId,
          finalStemUrl: preview.url,
          transcript: preview.transcript,
        });
      } catch (error: any) {
        console.error("Speech-correction commit error:", error);
        sendError(res, 500, error.message || "Commit failed");
      }
    }
  );

  router.post(
    "/api/speech-correction/voiceprint",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl, songId } = req.body;
        if (!objectKey && !fileUrl && !songId) return sendError(res, 400, "Missing objectKey, fileUrl, or songId");

        let targetPath: string | null = null;
        
        // Try to get file from database if songId provided
        if (songId) {
          try {
            const song = await storage.getSong(songId);
            const songAudioUrl2 = (song as any)?.audioUrl || song?.accessibleUrl || song?.originalUrl;
            if (songAudioUrl2) {
              console.log(`🎵 Found song in DB: ${song?.name || songId}, audioUrl: ${songAudioUrl2}`);
              const found = classifyLocalAudioPath(songAudioUrl2);
              if ('path' in found) {
                targetPath = found.path;
                console.log(`📁 Extracted target path: ${targetPath}`);
              } else {
                console.warn(`❌ Song ${songId} audio url did not resolve (${found.error}): ${songAudioUrl2}`);
              }
            } else {
              console.warn(`❌ Song ${songId} has no audioUrl, accessibleUrl or originalUrl`);
            }
          } catch (dbError) {
            console.warn("Could not fetch song from database:", dbError);
          }
        }

        // Fallback to objectKey or fileUrl
        if (!targetPath) {
          if (objectKey) {
            // objectKey is a storage key, not a URL — sanitizePath is its resolver.
            targetPath = sanitizePath(objectKey, LOCAL_OBJECTS_DIR) || '';
          } else {
            // Converted URLs resolve here like everywhere else. This branch used
            // to hard-fail with "use original audio" on the grounds that
            // converted files "may not exist yet" — but a song uploaded through
            // the Song Uploader HAS a converted URL and no other, so voiceprint
            // could never run on the very files it exists for. 'missing' is the
            // correct answer to "may not exist yet": a 404 when it is genuinely
            // absent, rather than a blanket refusal of the normal case.
            const found = classifyLocalAudioPath(fileUrl);
            if ('path' in found) {
              targetPath = found.path;
            } else if (found.error === 'missing') {
              return sendError(res, 404, "Audio file not found on server");
            } else {
              return sendError(res, 400, "Unsupported fileUrl for voiceprint");
            }
          }
        }

        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(LOCAL_OBJECTS_DIR))) {
          return sendError(res, 403, "Access denied");
        }
        if (!fs.existsSync(targetPath)) {
          console.error(`❌ Voiceprint file not found: ${targetPath}`);
          return sendError(res, 404, "Audio file not found on server");
        }

        const voice = createVoiceIdForFile(targetPath);
        res.json({ success: true, ...voice });
      } catch (error: any) {
        console.error("Speech-correction voiceprint error:", error);
        sendError(res, 500, error.message || "Voiceprint failed");
      }
    }
  );

  return router;
}
