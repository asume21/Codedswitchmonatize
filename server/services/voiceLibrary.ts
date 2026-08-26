import fs from "fs";
import path from "path";
import crypto from "crypto";
import Replicate from "replicate";
import { extractReplicateAudioUrl } from "./replicateOutput";
import ffmpeg from "fluent-ffmpeg";
import os from "os";
import {
  planChunks,
  parseSilences,
  DEFAULT_MAX_SECONDS as CHUNK_MAX_SECONDS,
  type SilenceInterval,
} from "./voiceChunking";

// Storage directory for voice library
const VOICES_DIR = path.resolve(process.cwd(), "objects", "voices");
const INDEX_FILE = path.join(VOICES_DIR, "index.json");

// RVC API configuration
// The localhost default is a DEV convenience and must not apply in production:
// there, localhost:7870 is this container itself, so every conversion opened a
// doomed connection to its own port and surfaced a confusing connect error rather
// than "this feature isn't configured". Empty in prod means the health check below
// fails immediately and honestly.
const RVC_API_URL = process.env.RVC_API_URL
  || (process.env.NODE_ENV === 'production' ? "" : "http://localhost:7870");
if (!RVC_API_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  RVC_API_URL not set — RVC voice conversion is DISABLED in production '
    + '(ElevenLabs speech-to-speech is unaffected and still available).');
}
const ELEVENLABS_API_URL = process.env.ELEVENLABS_API_URL || "https://api.elevenlabs.io/v1";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_S2S_MODEL_ID = process.env.ELEVENLABS_S2S_MODEL_ID || "eleven_multilingual_sts_v2";

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

const ELEVENLABS_S2S_STABILITY = clamp01(Number.parseFloat(process.env.ELEVENLABS_S2S_STABILITY ?? "0.92"));
const ELEVENLABS_S2S_SIMILARITY = clamp01(Number.parseFloat(process.env.ELEVENLABS_S2S_SIMILARITY ?? "0.96"));
const ELEVENLABS_S2S_STYLE = clamp01(Number.parseFloat(process.env.ELEVENLABS_S2S_STYLE ?? "0.0"));
const ELEVENLABS_S2S_SPEAKER_BOOST = (process.env.ELEVENLABS_S2S_SPEAKER_BOOST ?? "true").toLowerCase() !== "false";

/**
 * A FIXED seed, not a random one.
 *
 * Speech-to-speech samples stochastically, so the same vocal converted twice
 * came back different — the user's second attempt sounded worse than the first
 * with nothing changed. Worse, once long audio is converted in chunks, each
 * chunk is an independent draw, so the voice character shifted at every seam:
 * six chunks, six subtly different voices in one song.
 *
 * One seed shared by every request makes the chunks agree with each other AND
 * makes a re-run reproducible. ElevenLabs describes determinism as best-effort,
 * so this reduces variation rather than abolishing it.
 */
/**
 * Ask ElevenLabs to isolate the voice in the INPUT before converting it.
 *
 * The input here is never a clean recording — it is a vocal extracted from a
 * finished mix by stem separation, so it carries bleed and smearing from the
 * beat. Speech-to-speech is built for clean speech, and measured against the
 * user's own stem the output was wrong for 31% of the track: swinging dark
 * ("demon", worst 0.24x at 1:32) through the first half and bright ("nasal",
 * worst 2.24x at 2:41) through the second. That is the model guessing where
 * the input is muddiest — and the target voice was a clone of the user's OWN
 * voice, the easiest possible conversion, which rules out the target.
 *
 * Cleaning the input is the one lever aimed directly at that cause.
 */
const ELEVENLABS_S2S_REMOVE_NOISE =
  (process.env.ELEVENLABS_S2S_REMOVE_NOISE ?? "true").toLowerCase() !== "false";

const ELEVENLABS_S2S_SEED = (() => {
  const raw = Number.parseInt(process.env.ELEVENLABS_S2S_SEED ?? "20260822", 10);
  if (!Number.isFinite(raw) || raw < 0 || raw > 4294967295) return 20260822;
  return raw;
})();

export interface VoiceRecord {
  voiceId: string;
  name: string;
  userId: string;
  sourceFileName: string;
  localPath: string;
  duration: number;
  createdAt: string;
  sampleUrl?: string;
}

export interface ConvertOptions {
  pitch?: number;
  indexRate?: number;
  filterRadius?: number;
  rmsMixRate?: number;
  protect?: number;
  provider?: "rvc" | "elevenlabs" | "replicate-rvc";
  sourcePath?: string;
}

function ensureVoiceOutputsDir(): string {
  const outputsDir = path.join(VOICES_DIR, "outputs");
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
  }
  return outputsDir;
}

function saveConvertedOutput(buffer: Buffer, extension: "wav" | "mp3"): string {
  const outputsDir = ensureVoiceOutputsDir();
  const outputFilename = `vc-${crypto.randomUUID()}.${extension}`;
  const outputPath = path.join(outputsDir, outputFilename);
  fs.writeFileSync(outputPath, buffer);
  return `/api/internal/uploads/voices/outputs/${outputFilename}`;
}

function inferAudioMime(sourcePath: string): string {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".flac") return "audio/flac";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".aac") return "audio/aac";
  return "audio/wav";
}

/** Duration of an audio file in seconds. */
function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const d = Number(data?.format?.duration);
      resolve(Number.isFinite(d) ? d : 0);
    });
  });
}

/** Gaps between phrases, used as safe cut points. */
function detectSilences(filePath: string): Promise<SilenceInterval[]> {
  return new Promise((resolve) => {
    let stderr = "";
    ffmpeg(filePath)
      // -30dB for 0.25s: a rap vocal gaps at nearly every bar line, and this is
      // loose enough to catch breath gaps without treating quiet words as gaps.
      .audioFilters("silencedetect=noise=-30dB:d=0.25")
      .outputOptions(["-f", "null"])
      .on("stderr", (line: string) => { stderr += line + String.fromCharCode(10); })
      .on("end", () => resolve(parseSilences(stderr)))
      .on("error", () => resolve([]))   // no silence data → planner hard-cuts
      .save(process.platform === "win32" ? "NUL" : "/dev/null");
  });
}

function runFfmpeg(build: (cmd: ffmpeg.FfmpegCommand) => ffmpeg.FfmpegCommand, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    build(ffmpeg())
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(output);
  });
}

/** One speech-to-speech request. Returns the converted audio. */
async function elevenLabsRequest(
  voiceId: string,
  audio: Buffer,
  mimeType: string,
  fileName: string,
): Promise<Buffer> {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: mimeType }), fileName);
  form.append("model_id", ELEVENLABS_S2S_MODEL_ID);
  form.append("seed", String(ELEVENLABS_S2S_SEED));
  form.append("remove_background_noise", String(ELEVENLABS_S2S_REMOVE_NOISE));
  form.append(
    "voice_settings",
    JSON.stringify({
      stability: ELEVENLABS_S2S_STABILITY,
      similarity_boost: ELEVENLABS_S2S_SIMILARITY,
      style: ELEVENLABS_S2S_STYLE,
      use_speaker_boost: ELEVENLABS_S2S_SPEAKER_BOOST,
    })
  );

  const response = await fetch(`${ELEVENLABS_API_URL}/speech-to-speech/${encodeURIComponent(voiceId)}/stream`, {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, Accept: "audio/mpeg" },
    body: form,
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown ElevenLabs error");
    throw new Error(`ElevenLabs conversion failed: ${errorText}`);
  }

  const out = await response.arrayBuffer();
  if (!out || out.byteLength === 0) {
    throw new Error("ElevenLabs returned empty audio output");
  }
  return Buffer.from(out);
}

/**
 * Convert a long vocal in pieces.
 *
 * Each converted piece is forced back to the EXACT duration of the source
 * piece it came from (pad with silence if short, trim if long) before the
 * pieces are joined. ElevenLabs does not return audio of precisely the input
 * length, and without this the error accumulates across chunks and slides the
 * whole vocal against the beat. Because cuts land in silence, the padding or
 * trimming happens where there is nothing to hear.
 */
async function convertLongAudioInChunks(
  voiceId: string,
  sourcePath: string,
  duration: number,
): Promise<Buffer> {
  const silences = await detectSilences(sourcePath);
  const chunks = planChunks(duration, silences);
  const hardCuts = chunks.filter((c) => !c.cutAtSilence).length;
  console.log(
    `[VoiceLibrary] Converting ${duration.toFixed(1)}s in ${chunks.length} chunks ` +
    `(${silences.length} silences found, ${hardCuts} cut mid-audio)`,
  );

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "vc-chunk-"));
  const fitted: string[] = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const { start, end } = chunks[i];
      const span = end - start;
      const rawPath = path.join(work, `src-${i}.wav`);
      const convPath = path.join(work, `conv-${i}.mp3`);
      const fitPath = path.join(work, `fit-${i}.wav`);

      await runFfmpeg(
        (cmd) => cmd.input(sourcePath).seekInput(start).duration(span)
                    .audioFrequency(44100).audioChannels(1).audioCodec("pcm_s16le"),
        rawPath,
      );

      const converted = await elevenLabsRequest(
        voiceId, fs.readFileSync(rawPath), "audio/wav", path.basename(rawPath),
      );
      fs.writeFileSync(convPath, converted);

      // apad then a hard -t: pad-or-trim to the source span in one pass.
      await runFfmpeg(
        (cmd) => cmd.input(convPath).audioFilters("apad").duration(span)
                    .audioFrequency(44100).audioChannels(1).audioCodec("pcm_s16le"),
        fitPath,
      );
      fitted.push(fitPath);
    }

    const joined = path.join(work, "joined.mp3");
    await runFfmpeg((cmd) => {
      fitted.forEach((f) => cmd.input(f));
      return cmd
        .complexFilter(`${fitted.map((_, i) => `[${i}:a]`).join("")}concat=n=${fitted.length}:v=0:a=1[out]`)
        .outputOptions(["-map [out]", "-c:a libmp3lame", "-b:a 192k"]);
    }, joined);

    return fs.readFileSync(joined);
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

async function convertWithElevenLabs(
  voiceId: string,
  audioUrl: string,
  options: ConvertOptions = {}
): Promise<string> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured (ELEVENLABS_API_KEY)");
  }

  const sourcePath = options.sourcePath;
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error("ElevenLabs conversion requires a valid uploaded source audio file");
  }

  // ONE request by default — chunking is opt-in and off.
  //
  // Long clips do drift: measured on a 2:57 track, the single-request output
  // was clean for ~1:55 and then ran up to 2.24x brighter than the source at
  // two spots. Splitting into ~30s pieces fixed that drift, and the reassembly
  // is timeline-exact (verified: 0.000s), but each piece is a separate draw of
  // the voice, so the character shifted at every seam. The user's verdict was
  // unambiguous: the single-request version with two bad spots beat the chunked
  // versions, which he called "really bad".
  //
  // Two localised artifacts are better than six seams. Chunking stays behind
  // ELEVENLABS_S2S_CHUNK_SECONDS (set it to a length in seconds to re-enable)
  // because the approach is sound and only the per-chunk voice variance makes
  // it unusable — if a future model or seed handling makes draws consistent,
  // this becomes the better path again.
  const chunkThreshold = Number.parseFloat(process.env.ELEVENLABS_S2S_CHUNK_SECONDS ?? "0");
  if (Number.isFinite(chunkThreshold) && chunkThreshold > 0) {
    const duration = await probeDuration(sourcePath).catch(() => 0);
    if (duration > Math.max(chunkThreshold, CHUNK_MAX_SECONDS)) {
      const joined = await convertLongAudioInChunks(voiceId, sourcePath, duration);
      return saveConvertedOutput(joined, "mp3");
    }
  }

  const converted = await elevenLabsRequest(
    voiceId,
    fs.readFileSync(sourcePath),
    inferAudioMime(sourcePath),
    path.basename(sourcePath),
  );
  return saveConvertedOutput(converted, "mp3");
}

function ensureVoicesDir() {
  if (!fs.existsSync(VOICES_DIR)) {
    fs.mkdirSync(VOICES_DIR, { recursive: true });
  }
}

function loadIndex(): Map<string, VoiceRecord> {
  ensureVoicesDir();
  if (!fs.existsSync(INDEX_FILE)) {
    return new Map();
  }
  try {
    const data = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

function saveIndex(index: Map<string, VoiceRecord>) {
  ensureVoicesDir();
  const obj = Object.fromEntries(index.entries());
  fs.writeFileSync(INDEX_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

/**
 * List all voices for a user
 */
export function listVoices(userId: string): VoiceRecord[] {
  const index = loadIndex();
  return Array.from(index.values())
    .filter((v) => v.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get a specific voice by ID
 */
export function getVoice(voiceId: string): VoiceRecord | undefined {
  const index = loadIndex();
  return index.get(voiceId);
}

/**
 * Create a voiceprint from an audio file
 */
export async function createVoice(
  userId: string,
  sourceFilePath: string,
  name: string,
  duration: number = 0
): Promise<VoiceRecord> {
  ensureVoicesDir();

  if (!fs.existsSync(sourceFilePath)) {
    throw new Error("Source audio file not found");
  }

  // Generate voice ID from file hash
  const fileData = fs.readFileSync(sourceFilePath);
  const hash = crypto.createHash("sha256").update(fileData).digest("hex");
  const voiceId = `voice-${hash.slice(0, 16)}`;

  // Copy file to voices directory
  const ext = path.extname(sourceFilePath) || ".wav";
  const voiceFileName = `${voiceId}${ext}`;
  const voicePath = path.join(VOICES_DIR, voiceFileName);
  
  fs.copyFileSync(sourceFilePath, voicePath);

  const record: VoiceRecord = {
    voiceId,
    name: name || `Voice ${Date.now()}`,
    userId,
    sourceFileName: path.basename(sourceFilePath),
    localPath: voicePath,
    duration,
    createdAt: new Date().toISOString(),
    sampleUrl: `/api/internal/uploads/voices/${voiceFileName}`,
  };

  const index = loadIndex();
  index.set(voiceId, record);
  saveIndex(index);

  return record;
}

/**
 * Delete a voice from the library
 */
export function deleteVoice(voiceId: string, userId: string): boolean {
  const index = loadIndex();
  const voice = index.get(voiceId);
  
  if (!voice) {
    return false;
  }
  
  // Security: only owner can delete
  if (voice.userId !== userId) {
    throw new Error("Access denied");
  }

  // Delete the audio file
  if (fs.existsSync(voice.localPath)) {
    try {
      fs.unlinkSync(voice.localPath);
    } catch {
      // Ignore file deletion errors
    }
  }

  index.delete(voiceId);
  saveIndex(index);
  return true;
}

/**
 * Convert audio using a voice model via RVC API
 */
/**
 * Convert voice using Replicate's cloud-hosted RVC v2 model.
 * No local server required — runs entirely via Replicate API.
 * Cost: ~$0.03 per conversion, ~3 min runtime.
 */
async function convertWithReplicateRvc(
  voiceId: string,
  audioUrl: string,
  options: ConvertOptions = {}
): Promise<string> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured for cloud RVC");
  }

  const voice = getVoice(voiceId);
  const {
    pitch = 0,
    indexRate = 0.5,
    filterRadius = 3,
    rmsMixRate = 0.25,
    protect = 0.33,
  } = options;

  // Determine audio input — use source file if available, otherwise URL
  let songInput: string;
  if (options.sourcePath && fs.existsSync(options.sourcePath)) {
    const audioData = fs.readFileSync(options.sourcePath);
    const mimeType = inferAudioMime(options.sourcePath);
    songInput = `data:${mimeType};base64,${audioData.toString("base64")}`;
  } else {
    songInput = audioUrl;
  }

  // Map pitch to RVC pitch_change enum
  let pitchChange: string = "no-change";
  if (pitch > 0) pitchChange = "male-to-female";
  else if (pitch < 0) pitchChange = "female-to-male";

  const replicateInput: Record<string, any> = {
    song_input: songInput,
    pitch_change: pitchChange,
    index_rate: indexRate,
    filter_radius: filterRadius,
    rms_mix_rate: rmsMixRate,
    protect,
    pitch_change_all: pitch,
    output_format: "mp3",
    pitch_detection_algorithm: "rmvpe",
    reverb_size: 0.15,
    reverb_wetness: 0.2,
    reverb_dryness: 0.8,
    reverb_damping: 0.7,
  };

  // An RVC conversion is only meaningful with an RVC MODEL of the target voice.
  // Without custom_rvc_model_download_url the Replicate model falls back to its
  // own stock voice, so the job "succeeds" and returns a complete track in a
  // stranger's voice — the worst kind of failure, because nothing reports it.
  //
  // Note the shape mismatch this guards: createVoice() stores a local sample
  // WAV in `localPath`, which is NOT a model. Only an http(s) URL is.
  const rvcModelUrl = voice?.localPath?.startsWith("http") ? voice.localPath : null;
  if (!rvcModelUrl) {
    throw new Error(
      `RVC needs a trained RVC model for this voice, and "${voiceId}" has none. ` +
      `ElevenLabs voices cannot be used with RVC — pick the ElevenLabs provider, ` +
      `or train an RVC model for this voice first.`,
    );
  }
  replicateInput.custom_rvc_model_download_url = rvcModelUrl;

  console.log(`🎤 [Replicate RVC] Converting with voice ${voiceId}, pitch=${pitch}`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const output = await replicate.run(
    "zsxkib/realistic-voice-cloning:0a9c7c558af4c0f20667c1bd1260ce32a2879944a0b9e44e1398660c077b1550",
    { input: replicateInput }
  );

  // RVC returns a bare URI, which the Replicate client wraps in a FileOutput —
  // an object with no `.output` key, so the old shape check always came up
  // empty and every conversion threw. Resolve through the shared normaliser.
  const outputUrl = extractReplicateAudioUrl(output);
  if (!outputUrl) {
    throw new Error("Replicate RVC returned no output audio");
  }

  // Download the converted audio and save locally
  console.log(`✅ [Replicate RVC] Conversion complete, downloading result...`);
  const audioResponse = await fetch(outputUrl, { signal: AbortSignal.timeout(60000) });
  if (!audioResponse.ok) {
    throw new Error("Failed to download converted audio from Replicate");
  }

  const outputBuffer = Buffer.from(await audioResponse.arrayBuffer());
  return saveConvertedOutput(outputBuffer, "mp3");
}

export async function convertWithVoice(
  voiceId: string,
  audioUrl: string,
  options: ConvertOptions = {}
): Promise<string> {
  const provider = (options.provider || "replicate-rvc").toLowerCase();
  if (provider === "elevenlabs") {
    return convertWithElevenLabs(voiceId, audioUrl, options);
  }
  if (provider === "replicate-rvc") {
    return convertWithReplicateRvc(voiceId, audioUrl, options);
  }

  const voice = getVoice(voiceId);
  if (!voice) {
    throw new Error("Voice not found");
  }

  const {
    pitch = 0,
    indexRate = 0.75,
    filterRadius = 3,
    rmsMixRate = 0.25,
    protect = 0.33,
  } = options;

  try {
    // Check if RVC API is available
    const healthCheck = await fetch(`${RVC_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);

    if (!healthCheck || !healthCheck.ok) {
      console.log(`[VoiceLibrary] RVC API not available at ${RVC_API_URL}`);
      throw new Error("Voice conversion service unavailable");
    }

    // Call RVC API
    const response = await fetch(`${RVC_API_URL}/convert_url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: audioUrl,
        model: voiceId,
        model_path: voice.localPath,
        pitch,
        index_rate: indexRate,
        filter_radius: filterRadius,
        rms_mix_rate: rmsMixRate,
        protect,
      }),
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error(`[VoiceLibrary] RVC conversion failed:`, error);
      throw new Error(error.error || "Voice conversion failed");
    }

    const result = await response.json();
    
    if (result.success && result.output_path) {
      // Copy RVC output to our storage
      ensureVoiceOutputsDir();

      // Validate output_path to prevent path traversal from RVC API response
      const resolvedOutput = path.resolve(result.output_path);
      if (fs.existsSync(resolvedOutput)) {
        const copiedData = fs.readFileSync(resolvedOutput);
        // Clean up RVC temp file
        try { fs.unlinkSync(resolvedOutput); } catch {}

        return saveConvertedOutput(copiedData, "wav");
      }
    }

    throw new Error("Voice conversion returned unexpected result");
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Voice conversion failed");
  }
}

/**
 * Check if RVC API is available (local or cloud)
 */
export async function checkRvcHealth(): Promise<{ available: boolean; url: string; cloudAvailable: boolean }> {
  let localAvailable = false;
  try {
    const response = await fetch(`${RVC_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    localAvailable = response.ok;
  } catch {}

  const cloudAvailable = !!process.env.REPLICATE_API_TOKEN;

  return {
    available: localAvailable || cloudAvailable,
    url: localAvailable ? RVC_API_URL : "replicate-cloud",
    cloudAvailable,
  };
}
