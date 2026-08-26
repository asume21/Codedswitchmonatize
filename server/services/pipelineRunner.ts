import fs from "fs";
import path from "path";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";

import { stemSeparationService } from "./stemSeparation";
import { convertWithVoice } from "./voiceLibrary";
import { pitchCorrect } from "./audioAnalysis";
import { masterAudioFile } from "./mastering";

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
  provider: "elevenlabs" | "rvc" | "replicate-rvc";
  pitchCorrect: boolean;
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

/**
 * amix DIVIDES by the number of inputs unless told otherwise. The obvious way
 * to stop that is `normalize=0` (with `weights`), and that is what these
 * filters used — but both options are recent additions to amix, and the
 * production image is node:20-bullseye, whose Debian ffmpeg is 4.3. There they
 * do not exist, and ffmpeg aborts the whole graph with
 * "Error initializing complex filters. Option not found".
 *
 * That killed four production jobs (2026-08-21/22) at the very last step, after
 * stem separation and the paid voice conversion had already succeeded.
 *
 * So: let amix divide as it always has, then multiply the level back with
 * `volume`. Identical math, and every option used here has been in ffmpeg since
 * the 2.x era, so the graph builds on the old image and the new one alike.
 */
export function buildInstrumentalFilter(inputCount: number): string {
  const inputLabels = Array.from({ length: inputCount }, (_, i) => `[${i}:a]`).join("");
  // amix scales by 1/inputCount; volume=inputCount undoes it, giving the plain
  // sum that weights='1 1…':normalize=0 produced.
  return (
    `${inputLabels}amix=inputs=${inputCount}:duration=longest,` +
    `volume=${inputCount},alimiter=limit=0.95[out]`
  );
}

/** Same substitution for the instrumental + vocal mix. Two inputs, so volume=2. */
export function buildRemixFilter(): string[] {
  return [
    "[0:a]volume=0.98[a0]",
    "[1:a]volume=0.90,highpass=f=85,acompressor=threshold=-20dB:ratio=1.9:attack=12:release=140,equalizer=f=6500:t=q:w=1.2:g=-1.0[a1]",
    "[a0][a1]amix=inputs=2:duration=longest,volume=2,alimiter=limit=0.93[out]",
  ];
}

/**
 * A vocal stem this quiet has no vocal in it. Separation on an instrumental
 * (or a separation that dumps everything into `other`) yields a vocals stem
 * whose LOUDEST peak sits below the noise floor — the real case that prompted
 * this was max -50.8 dBFS, mean -75.7.
 *
 * Handing that to ElevenLabs does not fail. The model generates a full-level
 * voice out of near-silence — a hallucination with nothing driving it, which
 * lands in the remix as passages that jump high-pitched and drop unpredictably
 * in level. The job then reports "done" and bills for the conversion.
 *
 * A real vocal stem peaks near 0 dBFS; -40 sits far below anything audible and
 * far above the observed silent case, so it separates the two cleanly.
 */
export const SILENT_STEM_PEAK_DB = -40;

export function isEffectivelySilent(peakDb: number): boolean {
  return !Number.isFinite(peakDb) || peakDb < SILENT_STEM_PEAK_DB;
}

/** Peak level of a file in dBFS via ffmpeg's volumedetect. -Infinity if digital silence. */
export function measurePeakDb(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    ffmpeg(filePath)
      .audioFilters("volumedetect")
      .outputOptions(["-f", "null"])
      .on("stderr", (line: string) => { stderr += line + String.fromCharCode(10); })
      .on("end", () => {
        const m = stderr.match(/max_volume:\s*(-?[\d.]+) dB/);
        resolve(m ? parseFloat(m[1]) : -Infinity);
      })
      .on("error", (err: Error) => reject(err))
      .save(process.platform === "win32" ? "NUL" : "/dev/null");
  });
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

    const filter = buildInstrumentalFilter(stemPaths.length);

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
      .complexFilter(buildRemixFilter())
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

  const { inputPath, voiceId, stemMode, provider, objectsDir } =
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
  // Refuse to convert a silent vocal stem. ElevenLabs will happily invent a
  // full-level voice from near-silence, so without this the job "succeeds",
  // bills for the conversion, and produces a remix with a hallucinated vocal
  // over the beat. Fail here instead, with a message that says what to do.
  const vocalPeakDb = await measurePeakDb(vocalStemPath);
  if (isEffectivelySilent(vocalPeakDb)) {
    throw new Error(
      `No vocals found to convert — the separated vocal track is silent ` +
      `(peak ${Number.isFinite(vocalPeakDb) ? vocalPeakDb.toFixed(1) : "-inf"} dBFS). ` +
      `Voice conversion needs a song with a vocal in it; an instrumental or ` +
      `beat has nothing to convert.`,
    );
  }

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

  // Master the remix through the SAME chain generated audio already used
  // (server/services/mastering.ts). Before this, a converted track came out at
  // whatever level the mix landed on while generated audio was normalised —
  // one product, two loudnesses. Failure here is not fatal: an unmastered
  // remix is still the track the user paid for, so keep it rather than losing
  // the whole job to a post-processing step.
  if (process.env.VOICE_CONVERT_MASTER !== "false") {
    const masteredPath = path.join(outputsDir, `mastered-${remixFilename}`);
    try {
      await masterAudioFile(remixPath, masteredPath);
      fs.renameSync(masteredPath, remixPath);
      console.log(`[Pipeline] Mastered remix ${remixFilename}`);
    } catch (err) {
      console.error("[Pipeline] Mastering failed, keeping the unmastered remix:", err);
      try { fs.rmSync(masteredPath, { force: true }); } catch { /* best-effort */ }
    }
  }

  // RELATIVE, like every other url this pipeline returns (vocalStemUrl,
  // convertedVocalUrl, …). This was the one field stamped with an absolute
  // baseUrl built from APP_URL, which in dev still said localhost:5000 — a port
  // nothing listens on. The job reported "done", the remix was rendered
  // correctly, and clicking play went to ERR_CONNECTION_REFUSED.
  //
  // A relative url resolves against whatever origin the browser is already on,
  // so it is right in dev (5001), right in prod, and cannot rot when a host or
  // port changes.
  result.remixUrl = `/api/internal/uploads/voices/outputs/${remixFilename}`;

  await onStage?.("done", result);

  return result;
}
