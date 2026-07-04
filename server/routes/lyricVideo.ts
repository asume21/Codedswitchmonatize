// Lyric Video Maker — server-side WebM → MP4 transcode.
//
// The browser records the lyric video as WebM (the only format MediaRecorder
// reliably produces), but WebM won't upload to iOS/Instagram/TikTok. This route
// takes that WebM and returns a socially-compatible MP4 via the existing
// fluent-ffmpeg dependency. No storage — the mp4 streams straight back for
// download. See docs: approved in-chat design (2026-07-03).

import { Router, type Request, type Response } from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { buildTranscodeArgs } from "../lib/lyricVideoTranscode";

// 50 MB matches the repo-wide multer convention (audioDebug/voiceConvert) and
// comfortably covers a full-song 1080p WebM (~30-40 MB).
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

export function createLyricVideoRoutes() {
  const router = Router();

  router.post(
    "/transcode",
    requireAuth(),
    videoUpload.single("video"),
    async (req: Request, res: Response) => {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: "No video file uploaded" });
      }

      const id = crypto.randomBytes(8).toString("hex");
      const inputPath = path.join(os.tmpdir(), `lyric-video-${id}.webm`);
      const outputPath = path.join(os.tmpdir(), `lyric-video-${id}.mp4`);

      const cleanup = () => {
        for (const p of [inputPath, outputPath]) {
          try {
            fs.unlinkSync(p);
          } catch {
            /* best-effort temp cleanup */
          }
        }
      };

      try {
        fs.writeFileSync(inputPath, file.buffer);

        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .outputOptions(buildTranscodeArgs())
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .save(outputPath);
        });

        const stat = fs.statSync(outputPath);
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Content-Disposition", 'attachment; filename="lyric-video.mp4"');

        const stream = fs.createReadStream(outputPath);
        // Clean up temp files once the response is fully sent (or the client aborts).
        res.on("close", cleanup);
        stream.on("error", () => {
          cleanup();
          if (!res.headersSent) res.status(500).end();
        });
        stream.pipe(res);
      } catch (error: any) {
        console.error("Lyric video transcode error:", error);
        cleanup();
        res.status(500).json({ success: false, message: error?.message || "Transcode failed" });
      }
    },
  );

  return router;
}
