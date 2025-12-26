/**
 * Audio Analysis Service
 * Connects to local RVC-based audio analysis API for:
 * - Pitch correction (auto-tune)
 * - Melody extraction (vocals → MIDI)
 * - Karaoke scoring
 * - Emotion detection
 * - Audio classification
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import FormData from "form-data";

const ANALYSIS_API_URL = process.env.AUDIO_ANALYSIS_API_URL || "http://localhost:7871";

// Storage for analysis results
const ANALYSIS_STORAGE_DIR = path.resolve(process.cwd(), "objects", "audio-analysis");

function ensureStorageDir() {
  if (!fs.existsSync(ANALYSIS_STORAGE_DIR)) {
    fs.mkdirSync(ANALYSIS_STORAGE_DIR, { recursive: true });
  }
}

async function isApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${ANALYSIS_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface PitchData {
  pitch_hz: number[];
  times: number[];
  hop_length: number;
  sample_rate: number;
}

export interface MelodyNote {
  midi: number;
  note: string;
  start: number;
  duration: number;
  velocity: number;
}

export interface EmotionResult {
  dominant_emotion: string;
  emotions: Record<string, number>;
  features: {
    pitch_mean_hz: number;
    pitch_std: number;
    pitch_range: number;
    energy_mean: number;
    tempo_bpm: number;
    spectral_centroid: number;
  };
}

export interface ClassificationResult {
  classification: string;
  confidence: number;
  all_classes: Record<string, number>;
  features: {
    pitch_presence: number;
    spectral_centroid: number;
    spectral_bandwidth: number;
    zero_crossing_rate: number;
    rms_energy: number;
  };
}

export interface KaraokeScore {
  overall_score: number;
  note_scores: Array<{
    note: MelodyNote;
    score: number;
    sung_midi: number | null;
    diff_semitones?: number;
  }>;
  notes_hit: number;
  total_notes: number;
}

/**
 * Extract pitch (F0) from audio file.
 */
export async function extractPitch(audioPath: string): Promise<PitchData | null> {
  if (!(await isApiAvailable())) {
    console.log("[AudioAnalysis] API not available");
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("audio", fs.createReadStream(audioPath));

    const response = await fetch(`${ANALYSIS_API_URL}/extract-pitch`, {
      method: "POST",
      body: formData as any,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[AudioAnalysis] Pitch extraction failed:", error);
      return null;
    }

    const result = await response.json();
    return result.success ? result : null;
  } catch (error) {
    console.error("[AudioAnalysis] Pitch extraction error:", error);
    return null;
  }
}

/**
 * Apply pitch correction (auto-tune) to audio.
 */
export async function pitchCorrect(
  audioPath: string,
  options?: {
    scale?: string;
    root?: number;
    correctionStrength?: number;
  }
): Promise<string | null> {
  if (!(await isApiAvailable())) {
    console.log("[AudioAnalysis] API not available");
    return null;
  }

  const { scale = "C_major", root = 0, correctionStrength = 0.8 } = options || {};

  try {
    ensureStorageDir();

    const formData = new FormData();
    formData.append("audio", fs.createReadStream(audioPath));
    formData.append("scale", scale);
    formData.append("root", root.toString());
    formData.append("correction_strength", correctionStrength.toString());

    const response = await fetch(`${ANALYSIS_API_URL}/pitch-correct`, {
      method: "POST",
      body: formData as any,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[AudioAnalysis] Pitch correction failed:", error);
      return null;
    }

    // Save the corrected audio
    const outputFilename = `autotune-${crypto.randomUUID()}.wav`;
    const outputPath = path.join(ANALYSIS_STORAGE_DIR, outputFilename);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    return `/api/internal/uploads/audio-analysis/${outputFilename}`;
  } catch (error) {
    console.error("[AudioAnalysis] Pitch correction error:", error);
    return null;
  }
}

/**
 * Extract melody from vocals as MIDI notes.
 */
export async function extractMelody(
  audioPath: string,
  minNoteDuration?: number
): Promise<{ notes: MelodyNote[]; total_duration: number; note_count: number } | null> {
  if (!(await isApiAvailable())) {
    console.log("[AudioAnalysis] API not available");
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("audio", fs.createReadStream(audioPath));
    if (minNoteDuration !== undefined) {
      formData.append("min_note_duration", minNoteDuration.toString());
    }

    const response = await fetch(`${ANALYSIS_API_URL}/extract-melody`, {
      method: "POST",
      body: formData as any,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[AudioAnalysis] Melody extraction failed:", error);
      return null;
    }

    const result = await response.json();
    return result.success ? result : null;
  } catch (error) {
    console.error("[AudioAnalysis] Melody extraction error:", error);
    return null;
  }
}

/**
 * Score karaoke performance against reference notes.
 */
export async function scoreKaraoke(
  audioPath: string,
  referenceNotes: MelodyNote[]
): Promise<KaraokeScore | null> {
  if (!(await isApiAvailable())) {
    console.log("[AudioAnalysis] API not available");
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("audio", fs.createReadStream(audioPath));
    formData.append("reference_notes", JSON.stringify(referenceNotes));

    const response = await fetch(`${ANALYSIS_API_URL}/karaoke-score`, {
      method: "POST",
      body: formData as any,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[AudioAnalysis] Karaoke scoring failed:", error);
      return null;
    }

    const result = await response.json();
    return result.success ? result : null;
  } catch (error) {
    console.error("[AudioAnalysis] Karaoke scoring error:", error);
    return null;
  }
}

/**
 * Detect emotion from vocal audio.
 */
export async function detectEmotion(audioPath: string): Promise<EmotionResult | null> {
  if (!(await isApiAvailable())) {
    console.log("[AudioAnalysis] API not available");
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("audio", fs.createReadStream(audioPath));

    const response = await fetch(`${ANALYSIS_API_URL}/detect-emotion`, {
      method: "POST",
      body: formData as any,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[AudioAnalysis] Emotion detection failed:", error);
      return null;
    }

    const result = await response.json();
    return result.success ? result : null;
  } catch (error) {
    console.error("[AudioAnalysis] Emotion detection error:", error);
    return null;
  }
}

/**
 * Classify audio type (vocals, instrumental, speech, etc.)
 */
export async function classifyAudio(audioPath: string): Promise<ClassificationResult | null> {
  if (!(await isApiAvailable())) {
    console.log("[AudioAnalysis] API not available");
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("audio", fs.createReadStream(audioPath));

    const response = await fetch(`${ANALYSIS_API_URL}/classify-audio`, {
      method: "POST",
      body: formData as any,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[AudioAnalysis] Audio classification failed:", error);
      return null;
    }

    const result = await response.json();
    return result.success ? result : null;
  } catch (error) {
    console.error("[AudioAnalysis] Audio classification error:", error);
    return null;
  }
}

/**
 * Check if the audio analysis API is available.
 */
export async function checkApiHealth(): Promise<{ available: boolean; gpu: boolean }> {
  try {
    const response = await fetch(`${ANALYSIS_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const data = await response.json();
      return { available: true, gpu: data.gpu || false };
    }
    return { available: false, gpu: false };
  } catch {
    return { available: false, gpu: false };
  }
}
