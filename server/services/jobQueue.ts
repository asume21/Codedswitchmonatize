import fs from "fs";
import path from "path";
import type { IStorage } from "../storage";
import type { VoiceConvertJob } from "@shared/schema";
import {
  runPipeline,
  type PipelineOptions,
  type PipelineStage,
  type PipelineResult,
} from "./pipelineRunner";
import { getUserApiKeyService } from "./userApiKeys";

const LOCAL_OBJECTS_DIR = fs.existsSync("/data")
  ? path.resolve("/data", "objects")
  : path.resolve(process.cwd(), "objects");

const BASE_URL = (
  process.env.APP_BASE_URL ||
  `http://localhost:${process.env.PORT || 4000}`
).replace(/\/$/, "");

type JobEventListener = (job: VoiceConvertJob) => void;

class JobQueue {
  private running = new Map<string, AbortController>();
  private listeners = new Map<string, Set<JobEventListener>>();

  async enqueue(
    storage: IStorage,
    jobId: string,
  ): Promise<void> {
    const job = await storage.getVoiceConvertJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const controller = new AbortController();
    this.running.set(jobId, controller);

    this.processJob(storage, job).catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[JobQueue] Job ${jobId} failed:`, message);
      try {
        const updated = await storage.updateVoiceConvertJob(jobId, {
          status: "failed",
          error: message,
          completedAt: new Date(),
        });
        this.emit(jobId, updated);
      } catch (updateErr) {
        console.error(`[JobQueue] Failed to update job ${jobId} status:`, updateErr);
      }
    }).finally(() => {
      this.running.delete(jobId);
    });
  }

  subscribe(jobId: string, listener: JobEventListener): () => void {
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId)!.add(listener);
    return () => {
      this.listeners.get(jobId)?.delete(listener);
      if (this.listeners.get(jobId)?.size === 0) {
        this.listeners.delete(jobId);
      }
    };
  }

  isRunning(jobId: string): boolean {
    return this.running.has(jobId);
  }

  get activeCount(): number {
    return this.running.size;
  }

  private emit(jobId: string, job: VoiceConvertJob): void {
    const set = this.listeners.get(jobId);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(job);
      } catch (e) {
        console.error("[JobQueue] Listener error:", e);
      }
    }
  }

  private async processJob(
    storage: IStorage,
    job: VoiceConvertJob,
  ): Promise<void> {
    const keyService = getUserApiKeyService(storage);
    const keys = await keyService.resolveKeys(
      job.userId,
      job.executionMode as "cloud" | "byo_keys",
    );

    const missingKeys: string[] = [];
    if (!keys.elevenlabsApiKey && job.provider === "elevenlabs") {
      missingKeys.push("elevenlabs");
    }
    if (!keys.replicateApiToken) {
      missingKeys.push("replicate");
    }

    if (missingKeys.length > 0 && job.executionMode === "byo_keys") {
      throw new Error(
        `Missing BYO API keys for: ${missingKeys.join(", ")}. Please add your keys in Settings.`,
      );
    }

    const inputPath = resolveInputPath(job);
    if (!inputPath) {
      throw new Error("Could not resolve source audio file path");
    }

    await storage.updateVoiceConvertJob(job.id, {
      status: "separating",
      startedAt: new Date(),
    });

    const pipelineOptions: PipelineOptions = {
      inputPath,
      voiceId: job.voiceId,
      stemMode: (job.stemMode === 4 ? 4 : 2) as 2 | 4,
      provider: job.provider === "rvc" ? "rvc" : "elevenlabs",
      pitchCorrect: job.pitchCorrect ?? false,
      baseUrl: BASE_URL,
      objectsDir: LOCAL_OBJECTS_DIR,
      overrideKeys: {
        elevenlabsApiKey: keys.elevenlabsApiKey ?? undefined,
        replicateApiToken: keys.replicateApiToken ?? undefined,
      },
    };

    const onStage = async (
      stage: PipelineStage,
      partial: Partial<PipelineResult>,
    ) => {
      const update: Partial<VoiceConvertJob> = { status: stage };

      if (partial.vocalStemUrl) update.vocalStemUrl = partial.vocalStemUrl;
      if (partial.instrumentalStemUrl) update.instrumentalStemUrl = partial.instrumentalStemUrl;
      if (partial.drumsStemUrl) update.drumsStemUrl = partial.drumsStemUrl;
      if (partial.bassStemUrl) update.bassStemUrl = partial.bassStemUrl;
      if (partial.otherStemUrl) update.otherStemUrl = partial.otherStemUrl;
      if (partial.convertedVocalUrl) update.convertedVocalUrl = partial.convertedVocalUrl;
      if (partial.correctedVocalUrl) update.correctedVocalUrl = partial.correctedVocalUrl;
      if (partial.remixUrl) update.remixUrl = partial.remixUrl;

      if (stage === "done") {
        update.completedAt = new Date();
      }

      const updated = await storage.updateVoiceConvertJob(job.id, update);
      this.emit(job.id, updated);
    };

    await runPipeline(pipelineOptions, onStage);
  }
}

function resolveInputPath(job: VoiceConvertJob): string | null {
  if (job.sourceUrl) {
    if (job.sourceUrl.startsWith("/api/internal/uploads/")) {
      const relative = job.sourceUrl.replace("/api/internal/uploads/", "");
      const candidate = path.resolve(LOCAL_OBJECTS_DIR, relative);
      if (fs.existsSync(candidate)) return candidate;
    }

    if (job.sourceUrl.startsWith("/api/stems/")) {
      const encoded = job.sourceUrl.replace("/api/stems/", "");
      const fileName = path.basename(decodeURIComponent(encoded));
      const candidate = path.resolve(LOCAL_OBJECTS_DIR, "stems", fileName);
      if (fs.existsSync(candidate)) return candidate;
    }

    if (path.isAbsolute(job.sourceUrl) && fs.existsSync(job.sourceUrl)) {
      return job.sourceUrl;
    }
  }

  return null;
}

export const jobQueue = new JobQueue();
