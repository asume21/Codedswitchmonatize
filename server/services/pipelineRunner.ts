import fs from "fs";
import path from "path";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";

import { stemSeparationService } from "./stemSeparation";
import { convertWithVoice } from "./voiceLibrary";
import { pitchCorrect } from "./audioAnalysis";

export type PipelineStage =
  | "queued"
  | "separating"
  | "converting"
  | "correcting"
  | "remixing"
  | "done"
  | "failed";

export interface PipelineOptions {
  inputPath: string;
  voiceId: string;
  stemMode: 2 | 4;
  provider: "elevenlabs" | "rvc";
  pitchCorrect: boolean;
  baseUrl: string;
  objectsDir: string;
  overrideKeys?: {
    elevenlabsApiKey?: string;
    replicateApiToken?: string;
  };
}

export interface PipelineResult {
  vocalStemUrl: string | null;
  instrumentalStemUrl: string | null;
  drumsStemUrl: string | null;
  bassStemUrl: string | null;
  otherStemUrl: string | null;
  convertedVocalUrl: string | null;
  correctedVocalUrl: string | null;
  remixUrl: string | null;
}

export type StageCallback = (
  stage: PipelineStage,
  partialResult: Partial<PipelineResult>,
) => void | Promise<void>;

function resolveStemPath(stemUrl: string, objectsDir: string): string {
  const encoded = stemUrl.replace("/api/stems/", "");
  const fileName = path.basename(decodeURIComponent(encoded));
  return path.resolve(objectsDir, "stems", fileName);
}

function resolveInternalUploadPath(
  url: string,
  folder: string,
  objectsDir: string,
): string {
  const prefix = `/api/internal/uploads/${folder}/`;
  const fileName = path.basename(url.replace(prefix, ""));
  return path.resolve(objectsDir, folder, fileName);
}

async function buildInstrumentalFromStems(
  stemPaths: string[],
  outputPath: string,
): Promise<void> {
  if (stemPaths.length === 0) {
    throw new Error("No non-vocal stems available to build instrumental");
  }

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg();
    stemPaths.forEach((filePath) => cmd.input(filePath));

    const inputLabels = stemPaths.map((_, i) => `[${i}:a]`).join("");
    const weights = stemPaths.map(() => "1").join(" ");
    const filter = `${inputLabels}amix=inputs=${stemPaths.length}:duration=longest:weights='${weights}':normalize=0,alimiter=limit=0.95[out]`;

    cmd
      .complexFilter(filter)
      .outputOptions(["-map [out]", "-c:a libmp3lame", "-b:a 320k"])
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputPath);
  });
}

async function remixAudio(
  instrumentalPath: string,
  vocalPath: string,
  outputPath: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(instrumentalPath)
      .input(vocalPath)
      .complexFilter(
        [
          "[0:a]volume=0.98[a0]",
          "[1:a]volume=0.90,highpass=f=85,acompressor=threshold=-20dB:ratio=1.9:attack=12:release=140,equalizer=f=6500:t=q:w=1.2:g=-1.0[a1]",
          "[a0][a1]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.93[out]",
        ].join(";"),
      )
      .outputOptions(["-map [out]", "-c:a libmp3lame", "-b:a 320k"])
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputPath);
  });
}

export async function runPipeline(
  options: PipelineOptions,
  onStage?: StageCallback,
): Promise<PipelineResult> {
  const result: PipelineResult = {
    vocalStemUrl: null,
    instrumentalStemUrl: null,
    drumsStemUrl: null,
    bassStemUrl: null,
    otherStemUrl: null,
    convertedVocalUrl: null,
    correctedVocalUrl: null,
    remixUrl: null,
  };

  const { inputPath, voiceId, stemMode, provider, baseUrl, objectsDir } =
    options;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const outputsDir = path.resolve(objectsDir, "voices", "outputs");
  fs.mkdirSync(outputsDir, { recursive: true });

  // --- Stage 1: Stem Separation ---
  await onStage?.("separating", result);

  const stemResult = await stemSeparationService.separateFromFile(inputPath, {
    twoStems: stemMode === 2,
  });

  if (!stemResult.success || !stemResult.vocals) {
    throw new Error(
      `Stem separation failed: ${stemResult.error || "unknown error"}`,
    );
  }

  result.vocalStemUrl = stemResult.vocals;
  result.instrumentalStemUrl = stemResult.instrumental || null;
  result.drumsStemUrl = stemResult.drums || null;
  result.bassStemUrl = stemResult.bass || null;
  result.otherStemUrl = stemResult.other || null;

  const vocalStemPath = resolveStemPath(stemResult.vocals, objectsDir);

  let instrumentalPath: string;

  if (stemMode === 2) {
    const instrumentalUrl = stemResult.instrumental || stemResult.other;
    if (!instrumentalUrl) {
      throw new Error("2-stem mode returned no instrumental/other output");
    }
    instrumentalPath = resolveStemPath(instrumentalUrl, objectsDir);
  } else {
    const nonVocalStems = [stemResult.drums, stemResult.bass, stemResult.other]
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .map((u) => resolveStemPath(u, objectsDir))
      .filter((p) => fs.existsSync(p));

    if (nonVocalStems.length === 0 && stemResult.instrumental) {
      instrumentalPath = resolveStemPath(stemResult.instrumental, objectsDir);
    } else {
      const instrumentalFilename = `instrumental-4stem-${crypto.randomUUID()}.mp3`;
      instrumentalPath = path.join(outputsDir, instrumentalFilename);
      await buildInstrumentalFromStems(nonVocalStems, instrumentalPath);
    }
  }

  // --- Stage 2: Voice Conversion ---
  await onStage?.("converting", result);

  const convertedUrl = await convertWithVoice(voiceId, stemResult.vocals, {
    provider,
    sourcePath: vocalStemPath,
  });

  result.convertedVocalUrl = convertedUrl;

  let finalVocalUrl = convertedUrl;
  let finalVocalPath = resolveInternalUploadPath(
    convertedUrl,
    "voices/outputs",
    objectsDir,
  );

  // --- Stage 3: Pitch Correction (optional) ---
  if (options.pitchCorrect) {
    await onStage?.("correcting", result);

    const correctedUrl = await pitchCorrect(finalVocalPath, {
      scale: "C_major",
      root: 0,
      correctionStrength: 0.7,
    });

    if (correctedUrl) {
      finalVocalUrl = correctedUrl;
      finalVocalPath = resolveInternalUploadPath(
        correctedUrl,
        "audio-analysis",
        objectsDir,
      );
      result.correctedVocalUrl = correctedUrl;
    }
  }

  // --- Stage 4: Remix ---
  await onStage?.("remixing", result);

  const remixFilename = `remix-${stemMode}stem-${crypto.randomUUID()}.mp3`;
  const remixPath = path.join(outputsDir, remixFilename);
  await remixAudio(instrumentalPath, finalVocalPath, remixPath);

  result.remixUrl = `${baseUrl}/api/internal/uploads/voices/outputs/${remixFilename}`;

  await onStage?.("done", result);

  return result;
}
