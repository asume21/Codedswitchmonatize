/**
 * MusicGen-Stem route — native multi-stem AI generation.
 * Proxies to the Python MusicGen sidecar (musicgen_server.py).
 *
 * Endpoints:
 *   POST /api/stem-generation/generate   → kick off generation, returns jobId
 *   GET  /api/stem-generation/:jobId     → poll status / get URLs when done
 */

import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { requireAuth } from "../middleware/auth";

const router = Router();

const MUSICGEN_URL =
  process.env.MUSICGEN_SIDECAR_URL || "http://localhost:8001";

// Where to store normalized stem WAVs before uploading / serving them.
const STEMS_OUT_DIR = fs.existsSync("/data")
  ? path.resolve("/data", "objects", "musicgen-stems")
  : path.resolve(process.cwd(), "objects", "musicgen-stems");

try {
  fs.mkdirSync(STEMS_OUT_DIR, { recursive: true });
} catch {}

const sendError = (res: Response, statusCode: number, message: string) =>
  res.status(statusCode).json({ success: false, message });

// ── helpers ──────────────────────────────────────────────────────────────────

async function fetchSidecar(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${MUSICGEN_URL}${endpoint}`, options as any);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Sidecar ${endpoint} → ${response.status}: ${text}`);
  }
  return response.json();
}

/** Run loudnorm on a WAV file and write the result next to it. */
function normalizeLoudness(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters("loudnorm")
      .save(outputPath)
      .on("end", () => resolve())
      .on("error", reject);
  });
}

/** Copy a local file into STEMS_OUT_DIR and return the /api/stems URL. */
async function storeAndServe(
  localPath: string,
  jobId: string,
  stemName: string
): Promise<string> {
  const dest = path.join(STEMS_OUT_DIR, `${jobId}_${stemName}.wav`);
  await fs.promises.copyFile(localPath, dest);
  // /api/stems is already served as static by index.ts
  return `/api/stems/musicgen-stems/${jobId}_${stemName}.wav`;
}

// ── routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/stem-generation/generate
 * Body: { prompt, duration?, bpm?, key? }
 */
router.post(
  "/generate",
  requireAuth(),
  async (req: Request, res: Response) => {
    const { prompt, duration = 10, bpm = 120, key = "C" } = req.body ?? {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return sendError(res, 400, "prompt is required");
    }

    try {
      const data = await fetchSidecar("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), duration, bpm, key }),
      });

      return res.json({
        success: true,
        jobId: data.job_id,
        status: "pending",
      });
    } catch (err: any) {
      console.error("❌ stem-generation /generate error:", err?.message);

      // Give a helpful error if the sidecar isn't running yet
      if (err?.message?.includes("ECONNREFUSED") || err?.message?.includes("fetch")) {
        return sendError(
          res,
          503,
          "MusicGen sidecar is not running. Start it with: uvicorn musicgen_server:app --port 8001"
        );
      }
      return sendError(res, 500, err?.message || "Failed to start stem generation");
    }
  }
);

/**
 * GET /api/stem-generation/:jobId
 * Returns { status, stems? } where stems = { drums, bass, other } as /api/stems URLs.
 */
router.get("/:jobId", requireAuth(), async (req: Request, res: Response) => {
  const { jobId } = req.params;

  if (!jobId) return sendError(res, 400, "jobId is required");

  try {
    const data = await fetchSidecar(`/status/${jobId}`);

    if (data.status === "not_found") {
      return sendError(res, 404, "Job not found");
    }

    if (data.status !== "complete") {
      return res.json({ success: true, jobId, status: data.status });
    }

    // Complete — normalize each stem WAV and serve it
    const stemUrls: Record<string, string> = {};
    const stemNames = ["drums", "bass", "other"] as const;

    for (const name of stemNames) {
      const rawPath: string = data.stems?.[name];
      if (!rawPath || !fs.existsSync(rawPath)) {
        console.warn(`stem-generation: missing ${name} at ${rawPath}`);
        continue;
      }

      const normPath = rawPath.replace(".wav", "_norm.wav");

      try {
        await normalizeLoudness(rawPath, normPath);
        stemUrls[name] = await storeAndServe(normPath, jobId, name);
        // Clean up temp files
        fs.unlink(rawPath, () => {});
        fs.unlink(normPath, () => {});
      } catch (ffmpegErr) {
        console.warn(`stem-generation: ffmpeg failed for ${name}, serving raw`);
        stemUrls[name] = await storeAndServe(rawPath, jobId, name);
        fs.unlink(rawPath, () => {});
      }
    }

    return res.json({
      success: true,
      jobId,
      status: "complete",
      stems: stemUrls, // { drums: "/api/stems/...", bass: "...", other: "..." }
    });
  } catch (err: any) {
    console.error("❌ stem-generation status error:", err?.message);
    return sendError(res, 500, err?.message || "Failed to get job status");
  }
});

export function createStemGenerationRoutes() {
  return router;
}
