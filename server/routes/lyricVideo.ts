// Lyric Video Maker — server-side WebM → MP4 transcode + share to Social Hub.
//
// The browser records the lyric video as WebM (the only format MediaRecorder
// reliably produces), but WebM won't upload to iOS/Instagram/TikTok. These
// routes transcode it to a socially-compatible MP4 via the existing
// fluent-ffmpeg dependency:
//   POST /transcode  → returns the MP4 for direct download.
//   POST /share      → stores the MP4 and creates a Social Hub video post.

import { Router, type Request, type Response } from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { buildTranscodeArgs } from "../lib/lyricVideoTranscode";
import type { IStorage } from "../storage";

// 50 MB matches the repo-wide multer convention (audioDebug/voiceConvert) and
// comfortably covers a full-song 1080p WebM (~30-40 MB).
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

/** Transcode a WebM buffer to a temp MP4 file. Caller deletes both temp files. */
async function transcodeToMp4(buffer: Buffer): Promise<{ mp4Path: string; webmPath: string }> {
  const id = crypto.randomBytes(8).toString("hex");
  const webmPath = path.join(os.tmpdir(), `lyric-video-${id}.webm`);
  const mp4Path = path.join(os.tmpdir(), `lyric-video-${id}.mp4`);
  fs.writeFileSync(webmPath, buffer);
  await new Promise<void>((resolve, reject) => {
    ffmpeg(webmPath)
      .outputOptions(buildTranscodeArgs())
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(mp4Path);
  });
  return { mp4Path, webmPath };
}

export function createLyricVideoRoutes(storage: IStorage) {
  const router = Router();

  // Transcode + return the MP4 for direct download.
  router.post(
    "/transcode",
    requireAuth(),
    videoUpload.single("video"),
    async (req: Request, res: Response) => {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, message: "No video file uploaded" });

      let paths: { mp4Path: string; webmPath: string } | null = null;
      const cleanup = () => {
        for (const p of [paths?.mp4Path, paths?.webmPath]) {
          if (p) try { fs.unlinkSync(p); } catch { /* best-effort */ }
        }
      };

      try {
        paths = await transcodeToMp4(file.buffer);
        const stat = fs.statSync(paths.mp4Path);
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Content-Disposition", 'attachment; filename="lyric-video.mp4"');
        const stream = fs.createReadStream(paths.mp4Path);
        res.on("close", cleanup);
        stream.on("error", () => { cleanup(); if (!res.headersSent) res.status(500).end(); });
        stream.pipe(res);
      } catch (error: any) {
        console.error("Lyric video transcode error:", error);
        cleanup();
        res.status(500).json({ success: false, message: error?.message || "Transcode failed" });
      }
    },
  );

  // Transcode, store the MP4, and create a Social Hub video post.
  router.post(
    "/share",
    requireAuth(),
    videoUpload.single("video"),
    async (req: Request, res: Response) => {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, message: "No video file uploaded" });
      if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });

      const caption = (req.body.caption as string | undefined)?.slice(0, 500) || "";
      let paths: { mp4Path: string; webmPath: string } | null = null;
      const cleanupTemp = () => {
        for (const p of [paths?.mp4Path, paths?.webmPath]) {
          if (p) try { fs.unlinkSync(p); } catch { /* best-effort */ }
        }
      };

      try {
        paths = await transcodeToMp4(file.buffer);

        // Persist the MP4 into the objects dir served by GET /objects/* (same
        // pattern as share-organism-session).
        const objDir = process.env.LOCAL_OBJECTS_DIR || path.join(process.cwd(), "objects");
        const vidDir = path.join(objDir, "lyric-videos");
        if (!fs.existsSync(vidDir)) fs.mkdirSync(vidDir, { recursive: true });
        const filename = `${crypto.randomBytes(12).toString("hex")}.mp4`;
        fs.copyFileSync(paths.mp4Path, path.join(vidDir, filename));
        const mediaUrl = `/objects/lyric-videos/${filename}`;

        const post = await storage.createSocialPost(req.userId, {
          platform: "codedswitch",
          type: "lyric-video",
          title: "Lyric Video",
          content: JSON.stringify({ caption }),
          url: `${process.env.PUBLIC_URL || ""}/social-hub`,
          mediaUrl,
          likes: 0, comments: 0, shares: 0, views: 0,
        });

        res.json({ success: true, post, mediaUrl });
      } catch (error: any) {
        console.error("Lyric video share error:", error);
        res.status(500).json({ success: false, message: error?.message || "Share failed" });
      } finally {
        cleanupTemp();
      }
    },
  );

  return router;
}
