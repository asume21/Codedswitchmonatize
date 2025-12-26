import fs from "fs";
import path from "path";
import crypto from "crypto";

// Storage directory for voice library
const VOICES_DIR = path.resolve(process.cwd(), "objects", "voices");
const INDEX_FILE = path.join(VOICES_DIR, "index.json");

// RVC API configuration
const RVC_API_URL = process.env.RVC_API_URL || "http://localhost:7870";

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
export async function convertWithVoice(
  voiceId: string,
  audioUrl: string,
  options: ConvertOptions = {}
): Promise<string> {
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
      const outputFilename = `vc-${crypto.randomUUID()}.wav`;
      const outputPath = path.join(VOICES_DIR, "outputs", outputFilename);
      
      // Ensure outputs directory exists
      const outputsDir = path.join(VOICES_DIR, "outputs");
      if (!fs.existsSync(outputsDir)) {
        fs.mkdirSync(outputsDir, { recursive: true });
      }

      if (fs.existsSync(result.output_path)) {
        fs.copyFileSync(result.output_path, outputPath);
        // Clean up RVC temp file
        try { fs.unlinkSync(result.output_path); } catch {}
        
        return `/api/internal/uploads/voices/outputs/${outputFilename}`;
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
 * Check if RVC API is available
 */
export async function checkRvcHealth(): Promise<{ available: boolean; url: string }> {
  try {
    const response = await fetch(`${RVC_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return { available: response.ok, url: RVC_API_URL };
  } catch {
    return { available: false, url: RVC_API_URL };
  }
}
