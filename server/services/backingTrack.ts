import axios from "axios";
import { readFile } from "fs/promises";
import path from "path";
import { LocalStorageService } from "./localStorageService";

const DEFAULT_MUSICGEN_GENERATE_URL = "http://localhost:5005/generate";

function resolveMusicGenGenerateUrl() {
  const configuredUrl = process.env.MUSICGEN_URL?.trim();
  const sidecarUrl = process.env.MUSICGEN_SIDECAR_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  if (sidecarUrl) {
    return `${sidecarUrl.replace(/\/$/, "")}/generate`;
  }

  return DEFAULT_MUSICGEN_GENERATE_URL;
}

export interface BackingTrackRequest {
  prompt: string;
  durationSeconds: number;
  seed?: number;
}

export interface BackingTrackResult {
  audioUrl: string;
  audioPath: string;
  sourcePath: string;
}

export class BackingTrackService {
  private storage = new LocalStorageService();

  async generateBackingTrack(request: BackingTrackRequest): Promise<BackingTrackResult> {
    const musicgenUrl = resolveMusicGenGenerateUrl();

    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error("Prompt is required for backing track generation");
    }

    const payload = {
      prompt: request.prompt,
      durationSeconds: request.durationSeconds,
      seed: request.seed,
    };

    const response = await axios.post(musicgenUrl, payload, { timeout: 120_000 });

    if (!response.data?.success) {
      throw new Error(`MusicGen service responded with error: ${response.data?.error || "unknown error"}`);
    }

    const returnedPath: string | undefined =
      response.data.filePath || response.data.path || response.data.audioPath;

    if (!returnedPath) {
      throw new Error("MusicGen service did not return a filePath");
    }

    const absoluteSourcePath = path.isAbsolute(returnedPath)
      ? returnedPath
      : path.resolve(returnedPath);

    const ext = path.extname(absoluteSourcePath) || ".wav";
    const buffer = await readFile(absoluteSourcePath);
    const saved = await this.storage.saveAudio(buffer, ext.replace(".", ""));

    return {
      audioUrl: saved.url,
      audioPath: saved.path,
      sourcePath: absoluteSourcePath,
    };
  }
}

export const backingTrackService = new BackingTrackService();
