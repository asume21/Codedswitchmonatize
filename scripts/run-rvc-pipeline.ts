import "dotenv/config";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";

import { stemSeparationService } from "../server/services/stemSeparation";
import { convertWithVoice } from "../server/services/voiceLibrary";
import { pitchCorrect } from "../server/services/audioAnalysis";

type StemMode = 2 | 4;

type CliOptions = {
  input: string;
  voiceId: string;
  stems: StemMode;
  provider: "elevenlabs" | "rvc";
  pitchCorrect: boolean;
  baseUrl: string;
};

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, next);
    i += 1;
  }

  const input = args.get("input") || "";
  const voiceId = args.get("voiceId") || "";
  const stemsRaw = args.get("stems") || "2";
  const stems = stemsRaw === "4" ? 4 : 2;
  const providerRaw = (args.get("provider") || "elevenlabs").toLowerCase();
  const provider = providerRaw === "rvc" ? "rvc" : "elevenlabs";

  const disablePitchCorrect = args.get("noPitchCorrect") === "true";
  const pitchCorrectEnabled = !disablePitchCorrect;

  const baseUrl = (args.get("baseUrl") || process.env.APP_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

  if (!input || !voiceId) {
    throw new Error(
      [
        "Missing required arguments.",
        "Usage:",
        "  npm run rvc:pipeline -- --input \"C:\\\\path\\\\song.m4a\" --voiceId \"YOUR_VOICE_ID\" [--stems 2|4] [--provider elevenlabs|rvc] [--noPitchCorrect] [--baseUrl http://localhost:4000]",
      ].join("\n")
    );
  }

  return {
    input,
    voiceId,
    stems,
    provider,
    pitchCorrect: pitchCorrectEnabled,
    baseUrl,
  };
}

function resolveStemPath(stemUrl: string): string {
  const encoded = stemUrl.replace("/api/stems/", "");
  const fileName = path.basename(decodeURIComponent(encoded));
  return path.resolve(process.cwd(), "objects", "stems", fileName);
}

function resolveInternalUploadPath(url: string, folder: string): string {
  const prefix = `/api/internal/uploads/${folder}/`;
  const fileName = path.basename(url.replace(prefix, ""));
  return path.resolve(process.cwd(), "objects", folder, fileName);
}

async function buildInstrumentalFromStems(stemPaths: string[], outputPath: string): Promise<void> {
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

async function remix(instrumentalPath: string, vocalPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(instrumentalPath)
      .input(vocalPath)
      .complexFilter(
        [
          "[0:a]volume=0.98[a0]",
          "[1:a]volume=0.90,highpass=f=85,acompressor=threshold=-20dB:ratio=1.9:attack=12:release=140,equalizer=f=6500:t=q:w=1.2:g=-1.0[a1]",
          "[a0][a1]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.93[out]",
        ].join(";")
      )
      .outputOptions(["-map [out]", "-c:a libmp3lame", "-b:a 320k"])
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputPath);
  });
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  console.log(`INPUT=${inputPath}`);
  console.log(`VOICE_ID=${options.voiceId}`);
  console.log(`STEM_MODE=${options.stems}`);
  console.log(`PROVIDER=${options.provider}`);
  console.log(`PITCH_CORRECT=${options.pitchCorrect}`);

  const stemResult = await stemSeparationService.separateFromFile(inputPath, { twoStems: options.stems === 2 });
  if (!stemResult.success || !stemResult.vocals) {
    throw new Error(`Stem separation failed: ${stemResult.error || "unknown error"}`);
  }

  const vocalStemPath = resolveStemPath(stemResult.vocals);
  const outputsDir = path.resolve(process.cwd(), "objects", "voices", "outputs");
  fs.mkdirSync(outputsDir, { recursive: true });

  let instrumentalPath: string;

  if (options.stems === 2) {
    const instrumentalUrl = stemResult.instrumental || stemResult.other;
    if (!instrumentalUrl) {
      throw new Error("2-stem mode returned no instrumental/other output");
    }
    instrumentalPath = resolveStemPath(instrumentalUrl);
  } else {
    const nonVocalStems = [stemResult.drums, stemResult.bass, stemResult.other]
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .map(resolveStemPath)
      .filter((p) => fs.existsSync(p));

    if (nonVocalStems.length === 0 && stemResult.instrumental) {
      instrumentalPath = resolveStemPath(stemResult.instrumental);
    } else {
      const instrumentalFilename = `instrumental-4stem-${crypto.randomUUID()}.mp3`;
      instrumentalPath = path.join(outputsDir, instrumentalFilename);
      await buildInstrumentalFromStems(nonVocalStems, instrumentalPath);
    }
  }

  const convertedUrl = await convertWithVoice(options.voiceId, stemResult.vocals, {
    provider: options.provider,
    sourcePath: vocalStemPath,
  });

  let finalVocalUrl = convertedUrl;
  let finalVocalPath = resolveInternalUploadPath(convertedUrl, "voices/outputs");

  if (options.pitchCorrect) {
    const correctedUrl = await pitchCorrect(finalVocalPath, {
      scale: "C_major",
      root: 0,
      correctionStrength: 0.7,
    });

    if (correctedUrl) {
      finalVocalUrl = correctedUrl;
      finalVocalPath = resolveInternalUploadPath(correctedUrl, "audio-analysis");
    }
  }

  const remixFilename = `remix-cli-${options.stems}stem-${crypto.randomUUID()}.mp3`;
  const remixPath = path.join(outputsDir, remixFilename);
  await remix(instrumentalPath, finalVocalPath, remixPath);

  const normalizeUrl = (u: string) => (u.startsWith("http") ? u : `${options.baseUrl}${u}`);

  console.log("\n=== PIPELINE OUTPUT ===");
  console.log(`VOCAL_STEM_URL=${normalizeUrl(stemResult.vocals)}`);
  if (stemResult.instrumental) console.log(`INSTRUMENTAL_STEM_URL=${normalizeUrl(stemResult.instrumental)}`);
  if (stemResult.drums) console.log(`DRUMS_STEM_URL=${normalizeUrl(stemResult.drums)}`);
  if (stemResult.bass) console.log(`BASS_STEM_URL=${normalizeUrl(stemResult.bass)}`);
  if (stemResult.other) console.log(`OTHER_STEM_URL=${normalizeUrl(stemResult.other)}`);
  console.log(`CONVERTED_VOCAL_URL=${normalizeUrl(convertedUrl)}`);
  if (finalVocalUrl !== convertedUrl) {
    console.log(`CORRECTED_VOCAL_URL=${normalizeUrl(finalVocalUrl)}`);
  }
  console.log(`REMIX_URL=${options.baseUrl}/api/internal/uploads/voices/outputs/${remixFilename}`);
}

run().catch((error) => {
  console.error("RVC_PIPELINE_ERROR=", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
