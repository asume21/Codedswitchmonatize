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
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware/auth";
import { isWorkerReady, submitGeneration, pollJob, type AceStepTrackName } from "../services/aceStepService";

const router = Router();

const MUSICGEN_URL = (
  process.env.MUSICGEN_SIDECAR_URL?.trim() ||
  process.env.MUSICGEN_URL?.trim() ||
  "http://localhost:8001"
).replace(/\/generate\/?$/, "").replace(/\/$/, "");

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

// ── ACE-Step lego stems ──────────────────────────────────────────────────────
// ACE's `lego` task renders one isolated track per job, so a stem request
// fans out into three ACE jobs (drums/bass/other→synth) tracked under one
// local jobId with an `ace:` prefix. In-memory like runpodServerlessService's
// jobMeta — a server restart mid-job orphans it (client just regenerates).
const STEM_TRACKS: Record<string, AceStepTrackName> = {
  drums: "drums",
  bass: "bass",
  other: "synth",
};
const aceStemJobs = new Map<string, Record<string, string>>();

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

    // ═══ ACE-Step first (lego per-track) — silent fallback to the sidecar ═══
    try {
      if (await isWorkerReady()) {
        const seed = Math.floor(Math.random() * 2147483647);
        const aceIds: Record<string, string> = {};
        for (const [stem, trackName] of Object.entries(STEM_TRACKS)) {
          aceIds[stem] = await submitGeneration({
            prompt: `${prompt.trim()}, ${key} key, ${bpm} bpm`,
            audioDuration: duration,
            bpm,
            seed, // shared seed keeps the three tracks musically related
            taskType: "lego",
            trackName,
            instrumental: true,
          });
        }
        const jobId = `ace:${randomUUID()}`;
        aceStemJobs.set(jobId, aceIds);
        return res.json({ success: true, jobId, status: "pending" });
      }
      console.log("[aceFirst] stem-generation fell back: worker not ready");
    } catch (aceErr: any) {
      console.warn("[aceFirst] stem-generation fell back:", aceErr?.message || aceErr);
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

  // ═══ ACE-Step lego jobs ═══
  if (jobId.startsWith("ace:")) {
    const aceIds = aceStemJobs.get(jobId);
    if (!aceIds) return sendError(res, 404, "Job not found (server may have restarted — please regenerate)");

    try {
      const jobs = await Promise.all(
        Object.entries(aceIds).map(async ([stem, aceId]) => ({ stem, job: await pollJob(aceId) })),
      );

      const failed = jobs.find(({ job }) => job.status === "error");
      if (failed) {
        aceStemJobs.delete(jobId);
        return sendError(res, 500, `Stem "${failed.stem}" failed: ${failed.job.error ?? "unknown error"}`);
      }
      if (jobs.some(({ job }) => job.status !== "done")) {
        return res.json({ success: true, jobId, status: "running" });
      }

      // All done — reuse the same normalize/store pipeline as the sidecar path.
      const stemUrls: Record<string, string> = {};
      const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
      for (const { stem, job } of jobs) {
        const rawPath = job.outputPath;
        if (!rawPath || !fs.existsSync(rawPath)) {
          console.warn(`stem-generation(ace): missing ${stem} at ${rawPath}`);
          continue;
        }
        const normPath = rawPath.replace(/\.(wav|mp3)$/, "_norm.wav");
        try {
          await normalizeLoudness(rawPath, normPath);
          stemUrls[stem] = await storeAndServe(normPath, safeId, stem);
          fs.unlink(normPath, () => {});
        } catch {
          console.warn(`stem-generation(ace): ffmpeg failed for ${stem}, serving raw`);
          stemUrls[stem] = await storeAndServe(rawPath, safeId, stem);
        }
      }
      aceStemJobs.delete(jobId);
      return res.json({ success: true, jobId, status: "complete", stems: stemUrls });
    } catch (err: any) {
      console.error("❌ stem-generation(ace) status error:", err?.message);
      return sendError(res, 500, err?.message || "Failed to get job status");
    }
  }

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
