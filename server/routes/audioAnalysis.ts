// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requireCredits } from "../middleware/requireCredits";
import { checkApiHealth, classifyAudio, detectEmotion, extractMelody, extractPitch, pitchCorrect, scoreKaraoke } from "../services/audioAnalysis";
import { CREDIT_COSTS } from "../services/credits";
import { resolveAudioPath } from "../utils/security";
import fs from "fs";
import path from "path";
import { LOCAL_OBJECTS_DIR, sendError } from "./common";
import type { IStorage } from "../storage";

export function createAudioAnalysisRoutes(storage: IStorage) {
  const router = Router();
  // ============================================
  // AUDIO ANALYSIS ENDPOINTS
  // Uses local RVC-based API for pitch/melody/emotion analysis
  // ============================================

  // Health check for audio analysis API
  router.get("/api/audio-analysis/health", async (_req: Request, res: Response) => {
    try {
      const health = await checkApiHealth();
      res.json({ success: true, ...health });
    } catch (error: any) {
      sendError(res, 500, error.message || "Health check failed");
    }
  });

  // Extract pitch (F0) from audio
  router.post(
    "/api/audio-analysis/extract-pitch",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;

        const targetPath = resolveAudioPath({ objectKey, fileUrl }, LOCAL_OBJECTS_DIR);
        if (!targetPath) {
          return sendError(res, 400, "Invalid or missing objectKey/fileUrl");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await extractPitch(targetPath);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Extract pitch error:", error);
        sendError(res, 500, error.message || "Pitch extraction failed");
      }
    }
  );

  // Apply pitch correction (auto-tune)
  router.post(
    "/api/audio-analysis/pitch-correct",
    requireAuth(),
    requireCredits(CREDIT_COSTS.AI_ENHANCEMENT, storage),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl, scale, root, correctionStrength } = req.body;

        const targetPath = resolveAudioPath({ objectKey, fileUrl }, LOCAL_OBJECTS_DIR);
        if (!targetPath) {
          return sendError(res, 400, "Invalid or missing objectKey/fileUrl");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const resultUrl = await pitchCorrect(targetPath, { scale, root, correctionStrength });
        if (!resultUrl) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, url: resultUrl });
      } catch (error: any) {
        console.error("Pitch correct error:", error);
        sendError(res, 500, error.message || "Pitch correction failed");
      }
    }
  );

  // Extract melody as MIDI notes
  router.post(
    "/api/audio-analysis/extract-melody",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl, minNoteDuration } = req.body;

        const targetPath = resolveAudioPath({ objectKey, fileUrl }, LOCAL_OBJECTS_DIR);
        if (!targetPath) {
          return sendError(res, 400, "Invalid or missing objectKey/fileUrl");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await extractMelody(targetPath, minNoteDuration);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Extract melody error:", error);
        sendError(res, 500, error.message || "Melody extraction failed");
      }
    }
  );

  // Extract MIDI notes from an audio URL (for ACE-Step/MusicGen → Piano Roll)
  router.post(
    "/api/audio-analysis/audio-to-midi",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { audioUrl, bpm, key } = req.body;
        if (!audioUrl || typeof audioUrl !== 'string') {
          return sendError(res, 400, "audioUrl is required");
        }

        // Download audio to temp file
        const tempDir = path.resolve(process.cwd(), "objects", "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const tempFile = path.join(tempDir, `audio-to-midi-${Date.now()}.wav`);

        try {
          const audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(60000) });
          if (!audioResponse.ok) throw new Error(`Failed to download audio: ${audioResponse.status}`);
          const arrayBuffer = await audioResponse.arrayBuffer();
          await fs.promises.writeFile(tempFile, Buffer.from(arrayBuffer));
        } catch (dlErr: any) {
          return sendError(res, 502, `Failed to download audio: ${dlErr.message}`);
        }

        // Extract melody notes
        const melodyResult = await extractMelody(tempFile, 0.05);

        // Clean up temp file
        try { fs.unlinkSync(tempFile); } catch { /* ignore */ }

        if (!melodyResult || !melodyResult.notes?.length) {
          // Fallback: return empty but successful response so client can handle
          return res.json({
            success: true,
            notes: [],
            totalDuration: 0,
            noteCount: 0,
            message: "Could not extract notes from audio (analysis API may be unavailable)",
          });
        }

        // Convert MelodyNote[] to Piano Roll format
        const stepsPerBeat = 4; // 16th note resolution
        const beatsPerSecond = (bpm || 120) / 60;
        const pianoRollNotes = melodyResult.notes.map((note: any, i: number) => ({
          id: `extracted-${i}-${Date.now()}`,
          pitch: note.midi,
          note: note.note?.replace(/[0-9]/g, '') || 'C',
          octave: parseInt(note.note?.match(/[0-9]+/)?.[0] || '4'),
          step: Math.round(note.start * beatsPerSecond * stepsPerBeat),
          startStep: Math.round(note.start * beatsPerSecond * stepsPerBeat),
          duration: Math.max(1, Math.round(note.duration * beatsPerSecond * stepsPerBeat)),
          length: Math.max(1, Math.round(note.duration * beatsPerSecond * stepsPerBeat)),
          velocity: note.velocity || 100,
          trackType: note.midi < 48 ? 'bass' : note.midi < 72 ? 'chords' : 'melody',
        }));

        res.json({
          success: true,
          notes: pianoRollNotes,
          totalDuration: melodyResult.total_duration,
          noteCount: pianoRollNotes.length,
          bpm: bpm || 120,
          key: key || 'C',
        });
      } catch (error: any) {
        console.error("Audio-to-MIDI error:", error);
        sendError(res, 500, error.message || "Audio-to-MIDI extraction failed");
      }
    }
  );

  // Score karaoke performance
  router.post(
    "/api/audio-analysis/karaoke-score",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl, referenceNotes } = req.body;

        if (!referenceNotes || !Array.isArray(referenceNotes)) {
          return sendError(res, 400, "referenceNotes array required");
        }

        const targetPath = resolveAudioPath({ objectKey, fileUrl }, LOCAL_OBJECTS_DIR);
        if (!targetPath) {
          return sendError(res, 400, "Invalid or missing objectKey/fileUrl");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await scoreKaraoke(targetPath, referenceNotes);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Karaoke score error:", error);
        sendError(res, 500, error.message || "Karaoke scoring failed");
      }
    }
  );

  // Detect emotion from vocals
  router.post(
    "/api/audio-analysis/detect-emotion",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;

        const targetPath = resolveAudioPath({ objectKey, fileUrl }, LOCAL_OBJECTS_DIR);
        if (!targetPath) {
          return sendError(res, 400, "Invalid or missing objectKey/fileUrl");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await detectEmotion(targetPath);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Detect emotion error:", error);
        sendError(res, 500, error.message || "Emotion detection failed");
      }
    }
  );

  // Classify audio type
  router.post(
    "/api/audio-analysis/classify",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { objectKey, fileUrl } = req.body;

        const targetPath = resolveAudioPath({ objectKey, fileUrl }, LOCAL_OBJECTS_DIR);
        if (!targetPath) {
          return sendError(res, 400, "Invalid or missing objectKey/fileUrl");
        }
        if (!fs.existsSync(targetPath)) {
          return sendError(res, 404, "Audio file not found");
        }

        const result = await classifyAudio(targetPath);
        if (!result) {
          return sendError(res, 503, "Audio analysis API not available");
        }

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error("Classify audio error:", error);
        sendError(res, 500, error.message || "Audio classification failed");
      }
    }
  );

  return router;
}
