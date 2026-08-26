import { Router, type Request, type Response } from "express";
import { z } from "zod";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import type { IStorage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { requireCredits, deductCredits } from "../middleware/requireCredits";
import { CREDIT_COSTS } from "../services/credits";
import { jobQueue } from "../services/jobQueue";
import { checkRvcHealth } from "../services/voiceLibrary";
import { checkApiHealth as checkAudioAnalysisHealth } from "../services/audioAnalysis";
import {
  getUserApiKeyService,
  isValidService,
  type SupportedService,
} from "../services/userApiKeys";

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 5 },
});

const submitJobSchema = z.object({
  voiceId: z.string().min(1, "voiceId is required"),
  sourceUrl: z.string().min(1, "sourceUrl is required"),
  sourceFileName: z.string().optional(),
  stemMode: z.union([z.literal(2), z.literal(4)]).default(2),
  provider: z.enum(["elevenlabs", "rvc", "replicate-rvc"]).default("replicate-rvc"),
  pitchCorrect: z.boolean().default(false),
  executionMode: z.enum(["cloud", "byo_keys"]).default("cloud"),
});

const storeKeySchema = z.object({
  service: z.string().min(1, "service is required"),
  apiKey: z.string().min(1, "apiKey is required"),
});

/**
 * The one voice-convert path that must bypass the global requireAuthExcept
 * gate. An EventSource cannot read a JSON 401 — it aborts on the MIME type and
 * fires onerror with no status and no message — and it treats ANY non-200 as an
 * error regardless of content type. So the failure can only reach the client if
 * the request reaches the handler, which answers 200 and reports the outcome as
 * an SSE event.
 *
 * A RegExp, not a prefix: the gate matches with startsWith, but the exempt path
 * is a suffix. The prefix "/api/voice-convert/jobs" would expose every job
 * route, including other users' jobs. Anchored, and [^/]+ keeps it to exactly
 * one path segment for the id.
 *
 * Safe to exempt: the handler authenticates itself and fails CLOSED on
 * privilege — no userId is Unauthorized, another user's job is Forbidden.
 */
export const VOICE_CONVERT_STREAM_PATTERN = /^\/api\/voice-convert\/jobs\/[^/]+\/stream$/;

export function createVoiceConvertRoutes(storage: IStorage) {
  const router = Router();

  // ─── Job Submission ────────────────────────────────────────────────
  router.post(
    "/jobs",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const parsed = submitJobSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid input",
            errors: parsed.error.errors,
          });
        }

        const { voiceId, sourceUrl, sourceFileName, stemMode, provider, pitchCorrect, executionMode } = parsed.data;
        const userId = req.userId!;

        // Cost precheck: cloud mode costs credits, BYO keys mode is free
        if (executionMode === "cloud") {
          const creditCost = stemMode === 4
            ? CREDIT_COSTS.VOICE_CONVERT_4STEM
            : CREDIT_COSTS.VOICE_CONVERT_2STEM;

          const creditService = (await import("../services/credits")).getCreditService(storage);

          try {
            await creditService.deductCredits(userId, creditCost, "Voice conversion (cloud)", {
              stemMode,
              provider,
              executionMode,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (/insufficient credits/i.test(message)) {
              const balance = await creditService.getBalance(userId);
              return res.status(402).json({
                success: false,
                message: `This operation requires ${creditCost} credits. You have ${balance} credits.`,
                required: creditCost,
                current: balance,
                purchaseUrl: "/pricing",
              });
            }
            throw err;
          }
        }

        // BYO keys: verify user has the required keys stored
        if (executionMode === "byo_keys") {
          const keyService = getUserApiKeyService(storage);
          const keys = await keyService.resolveKeys(userId, "byo_keys");

          const missing: string[] = [];
          if (!keys.replicateApiToken) missing.push("replicate");
          if (!keys.elevenlabsApiKey && provider === "elevenlabs") missing.push("elevenlabs");

          if (missing.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Missing BYO API keys: ${missing.join(", ")}. Add them in Settings → API Keys.`,
              missingKeys: missing,
            });
          }
        }

        // Create the job record
        const job = await storage.createVoiceConvertJob(userId, {
          voiceId,
          sourceUrl,
          sourceFileName: sourceFileName ?? null,
          stemMode,
          provider,
          pitchCorrect,
          executionMode,
        });

        // Enqueue for async processing
        jobQueue.enqueue(storage, job.id).catch((err) => {
          console.error(`[VoiceConvert] Failed to enqueue job ${job.id}:`, err);
        });

        return res.status(201).json({
          success: true,
          jobId: job.id,
          status: job.status,
        });
      } catch (error) {
        console.error("[VoiceConvert] Job submission error:", error);
        const message = error instanceof Error ? error.message : "Job submission failed";
        return res.status(500).json({ success: false, message });
      }
    },
  );

  // ─── Job Status (polling) ──────────────────────────────────────────
  router.get(
    "/jobs/:jobId",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const job = await storage.getVoiceConvertJob(req.params.jobId);
        if (!job) {
          return res.status(404).json({ success: false, message: "Job not found" });
        }
        if (job.userId !== req.userId && req.userId !== "owner-user") {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        return res.json({
          success: true,
          job: {
            id: job.id,
            status: job.status,
            executionMode: job.executionMode,
            stemMode: job.stemMode,
            provider: job.provider,
            pitchCorrect: job.pitchCorrect,
            vocalStemUrl: job.vocalStemUrl,
            instrumentalStemUrl: job.instrumentalStemUrl,
            drumsStemUrl: job.drumsStemUrl,
            bassStemUrl: job.bassStemUrl,
            otherStemUrl: job.otherStemUrl,
            convertedVocalUrl: job.convertedVocalUrl,
            correctedVocalUrl: job.correctedVocalUrl,
            remixUrl: job.remixUrl,
            error: job.error,
            failedStage: job.failedStage,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
          },
        });
      } catch (error) {
        console.error("[VoiceConvert] Job status error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch job status" });
      }
    },
  );

  // ─── Job List (user's recent jobs) ─────────────────────────────────
  router.get(
    "/jobs",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const jobs = await storage.getUserVoiceConvertJobs(req.userId!, limit);
        return res.json({
          success: true,
          jobs: jobs.map((j) => ({
            id: j.id,
            status: j.status,
            executionMode: j.executionMode,
            stemMode: j.stemMode,
            provider: j.provider,
            remixUrl: j.remixUrl,
            error: j.error,
            createdAt: j.createdAt,
            completedAt: j.completedAt,
          })),
        });
      } catch (error) {
        console.error("[VoiceConvert] Job list error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch jobs" });
      }
    },
  );

  // ─── SSE Stream for real-time job updates ──────────────────────────
  // Every outcome on this route must be delivered inside the SSE envelope.
  // An EventSource cannot read a JSON body: the browser aborts the connection
  // ("MIME type application/json is not text/event-stream") and fires onerror
  // with no status and no message — so a JSON 404/403/500, or the shortcut for
  // an already-finished job, is invisible to the client. Open the stream first,
  // then report the outcome as an event and close.
  // Auth is checked inside the handler, not via requireAuth(): that middleware
  // answers with a JSON 401, which an EventSource cannot read either.
  router.get(
    "/jobs/:jobId/stream",
    async (req: Request, res: Response) => {
      const openStream = () => {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
      };
      const send = (payload: unknown) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      try {
        if (!req.userId) {
          openStream();
          send({ status: "failed", error: "Unauthorized" });
          return res.end();
        }

        const job = await storage.getVoiceConvertJob(req.params.jobId);
        openStream();

        if (!job) {
          send({ status: "failed", error: "Job not found" });
          return res.end();
        }
        if (job.userId !== req.userId && req.userId !== "owner-user") {
          send({ status: "failed", error: "Forbidden" });
          return res.end();
        }

        // Already terminal — send the final state as one event, then close.
        // The client closes on done/failed, so it needs no special case here.
        if (job.status === "done" || job.status === "failed") {
          send({
            status: job.status,
            remixUrl: job.remixUrl,
            error: job.error,
            completedAt: job.completedAt,
          });
          return res.end();
        }

        // Send initial state
        send({ status: job.status });

        const unsubscribe = jobQueue.subscribe(req.params.jobId, (updated) => {
          try {
            send({
              status: updated.status,
              remixUrl: updated.remixUrl,
              error: updated.error,
              completedAt: updated.completedAt,
            });

            if (updated.status === "done" || updated.status === "failed") {
              res.end();
            }
          } catch {
            // Client disconnected
          }
        });

        req.on("close", () => {
          unsubscribe();
        });
      } catch (error) {
        console.error("[VoiceConvert] SSE stream error:", error);
        if (!res.headersSent) openStream();
        try {
          send({ status: "failed", error: "Stream setup failed" });
        } catch {
          // Client already gone
        }
        res.end();
      }
    },
  );

  // ─── Cost Precheck ─────────────────────────────────────────────────
  router.post(
    "/cost-check",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { stemMode, executionMode } = req.body;
        const mode = executionMode === "byo_keys" ? "byo_keys" : "cloud";
        const stems = stemMode === 4 ? 4 : 2;

        if (mode === "byo_keys") {
          return res.json({
            success: true,
            creditsCost: 0,
            canProceed: true,
            message: "BYO keys mode — no credits required",
          });
        }

        const creditCost = stems === 4
          ? CREDIT_COSTS.VOICE_CONVERT_4STEM
          : CREDIT_COSTS.VOICE_CONVERT_2STEM;

        const creditService = (await import("../services/credits")).getCreditService(storage);
        const balance = await creditService.getBalance(req.userId!);

        return res.json({
          success: true,
          creditsCost: creditCost,
          currentBalance: balance,
          canProceed: balance >= creditCost,
          deficit: Math.max(0, creditCost - balance),
        });
      } catch (error) {
        console.error("[VoiceConvert] Cost check error:", error);
        return res.status(500).json({ success: false, message: "Cost check failed" });
      }
    },
  );

  // ─── User API Keys (BYO Key Vault) ────────────────────────────────
  router.get(
    "/api-keys",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const keyService = getUserApiKeyService(storage);
        const keys = await keyService.listKeys(req.userId!);
        return res.json({ success: true, keys });
      } catch (error) {
        console.error("[VoiceConvert] List API keys error:", error);
        return res.status(500).json({ success: false, message: "Failed to list API keys" });
      }
    },
  );

  router.post(
    "/api-keys",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const parsed = storeKeySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid input",
            errors: parsed.error.errors,
          });
        }

        const { service, apiKey } = parsed.data;

        if (!isValidService(service)) {
          return res.status(400).json({
            success: false,
            message: `Unsupported service: ${service}. Supported: elevenlabs, replicate`,
          });
        }

        const keyService = getUserApiKeyService(storage);
        const result = await keyService.storeKey(req.userId!, service as SupportedService, apiKey);

        return res.json({
          success: true,
          message: `API key for ${service} saved`,
          keyHint: result.keyHint,
        });
      } catch (error) {
        console.error("[VoiceConvert] Store API key error:", error);
        return res.status(500).json({ success: false, message: "Failed to store API key" });
      }
    },
  );

  router.delete(
    "/api-keys/:service",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        const { service } = req.params;
        if (!isValidService(service)) {
          return res.status(400).json({
            success: false,
            message: `Unsupported service: ${service}`,
          });
        }

        const keyService = getUserApiKeyService(storage);
        await keyService.deleteKey(req.userId!, service as SupportedService);

        return res.json({ success: true, message: `API key for ${service} deleted` });
      } catch (error) {
        console.error("[VoiceConvert] Delete API key error:", error);
        return res.status(500).json({ success: false, message: "Failed to delete API key" });
      }
    },
  );

  // ─── Queue Stats (owner only) ─────────────────────────────────────
  router.get(
    "/queue-stats",
    requireAuth(),
    async (req: Request, res: Response) => {
      if (req.userId !== "owner-user") {
        return res.status(403).json({ success: false, message: "Owner only" });
      }
      return res.json({
        success: true,
        activeJobs: jobQueue.activeCount,
      });
    },
  );

  // ─── Service Health Check ──────────────────────────────────────────
  router.get(
    "/services-health",
    async (_req: Request, res: Response) => {
      try {
        const [rvc, audioAnalysis] = await Promise.all([
          checkRvcHealth(),
          checkAudioAnalysisHealth(),
        ]);

        const replicateConfigured = !!(process.env.REPLICATE_API_TOKEN);
        const elevenlabsConfigured = !!(process.env.ELEVENLABS_API_KEY);

        const services = {
          replicate: { available: replicateConfigured, type: "cloud" as const, label: "Stem Separation (Replicate)" },
          replicateRvc: { available: replicateConfigured, type: "cloud" as const, label: "Voice Conversion (RVC Cloud)" },
          elevenlabs: { available: elevenlabsConfigured, type: "cloud" as const, label: "Voice Conversion (ElevenLabs)" },
          rvc: { available: rvc.available, type: "local" as const, label: "Voice Conversion (RVC Local)", url: rvc.url },
          audioAnalysis: { available: audioAnalysis.available, type: "local" as const, label: "Pitch Correction", gpu: audioAnalysis.gpu },
        };

        const canRunCloud = replicateConfigured && (elevenlabsConfigured || replicateConfigured);
        const canRunLocal = replicateConfigured && rvc.available;

        return res.json({
          success: true,
          services,
          capabilities: {
            cloudPipeline: canRunCloud,
            localRvcPipeline: canRunLocal,
            pitchCorrection: audioAnalysis.available,
          },
        });
      } catch (error) {
        console.error("[VoiceConvert] Health check error:", error);
        return res.status(500).json({ success: false, message: "Health check failed" });
      }
    },
  );

  // ─── Clone Voice via ElevenLabs IVC ──────────────────────────────────
  router.post(
    "/clone-voice",
    requireAuth(),
    voiceUpload.array("files", 5),
    async (req: Request, res: Response) => {
      try {
        const { name, description } = req.body;
        const files = req.files as Express.Multer.File[] | undefined;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
          return res.status(400).json({ success: false, message: "Voice name is required" });
        }

        if (!files || files.length === 0) {
          return res.status(400).json({ success: false, message: "At least one audio recording is required" });
        }

        // Resolve ElevenLabs API key — prefer user's BYO key, fall back to platform key
        let apiKey = process.env.ELEVENLABS_API_KEY || "";
        if (req.userId) {
          const keyService = getUserApiKeyService(storage);
          const userKey = await keyService.getDecryptedKey(req.userId, "elevenlabs");
          if (userKey) apiKey = userKey;
        }

        if (!apiKey) {
          return res.status(503).json({
            success: false,
            message: "ElevenLabs API key not configured. Add your key in the API Keys section or contact the admin.",
          });
        }

        // Build multipart form for ElevenLabs
        const form = new FormData();
        form.append("name", name.trim());
        if (description) form.append("description", description);

        for (const file of files) {
          const ext = file.originalname?.split(".").pop()?.toLowerCase() || "wav";
          const mimeMap: Record<string, string> = {
            mp3: "audio/mpeg",
            wav: "audio/wav",
            m4a: "audio/mp4",
            ogg: "audio/ogg",
            webm: "audio/webm",
            flac: "audio/flac",
          };
          form.append("files", file.buffer, {
            filename: file.originalname || `recording.${ext}`,
            contentType: mimeMap[ext] || "audio/wav",
          });
        }

        console.log(`[VoiceClone] Sending ${files.length} file(s) to ElevenLabs IVC for user ${req.userId}`);

        const elResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
          },
          body: form,
        });

        if (!elResponse.ok) {
          const errText = await elResponse.text();
          console.error(`[VoiceClone] ElevenLabs error ${elResponse.status}:`, errText);
          return res.status(elResponse.status).json({
            success: false,
            message: `ElevenLabs error: ${errText}`,
          });
        }

        const result = await elResponse.json() as { voice_id: string; requires_verification?: boolean };
        console.log(`[VoiceClone] Voice created: ${result.voice_id}`);

        return res.json({
          success: true,
          voiceId: result.voice_id,
          requiresVerification: result.requires_verification || false,
          message: `Voice "${name.trim()}" cloned successfully!`,
        });
      } catch (error: any) {
        console.error("[VoiceClone] Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Voice cloning failed" });
      }
    },
  );

  // ─── List User's ElevenLabs Voices ──────────────────────────────────
  router.get(
    "/my-voices",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        let apiKey = process.env.ELEVENLABS_API_KEY || "";
        if (req.userId) {
          const keyService = getUserApiKeyService(storage);
          const userKey = await keyService.getDecryptedKey(req.userId, "elevenlabs");
          if (userKey) apiKey = userKey;
        }

        // An empty list is still a 200 — a settings problem is not a failed
        // query — but the REASON has to ride along. Without it every failure
        // (no key, rejected key, network) looked identical to "you own no
        // voices", and the page hides the picker entirely on an empty list, so
        // an invalid key silently deleted the control with nothing on screen.
        const noVoices = (keyError: string) =>
          res.json({ success: true, voices: [], keyError });

        if (!apiKey) {
          return noVoices(
            "No ElevenLabs API key configured. Add one in Settings to list your voices.",
          );
        }

        const elResponse = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": apiKey },
        });

        if (!elResponse.ok) {
          // ElevenLabs puts the useful sentence in detail.message — e.g. the
          // key ID vs key mix-up, which is otherwise indistinguishable from a
          // revoked key.
          let reason = `ElevenLabs returned ${elResponse.status} ${elResponse.statusText}`;
          try {
            const body = (await elResponse.json()) as any;
            const detail = body?.detail;
            const message = typeof detail === "string" ? detail : detail?.message;
            if (typeof message === "string" && message.trim()) reason = message;
          } catch {
            // Non-JSON body — the status line above is all we have.
          }
          return noVoices(reason);
        }

        const data = await elResponse.json() as { voices: Array<{ voice_id: string; name: string; category: string; labels?: Record<string, string> }> };
        const voices = (data.voices || []).map((v) => ({
          voiceId: v.voice_id,
          name: v.name,
          category: v.category,
          labels: v.labels || {},
        }));

        return res.json({ success: true, voices });
      } catch (error: any) {
        console.error("[VoiceClone] List voices error:", error);
        return res.json({
          success: true,
          voices: [],
          keyError: error?.message || "Could not reach ElevenLabs.",
        });
      }
    },
  );

  return router;
}
