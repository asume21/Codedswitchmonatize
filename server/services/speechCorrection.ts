import fs from "fs";
import path from "path";
import crypto from "crypto";
import Replicate from "replicate";
import { logPromptStart, logPromptResult } from "../ai/utils/promptLogger";

// Replicate client for voice cloning
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Persistent storage directory for speech correction previews/finals
const SPEECH_STORAGE_DIR = process.env.LOCAL_OBJECTS_DIR 
  ? path.join(process.env.LOCAL_OBJECTS_DIR, "speech-correction")
  : path.resolve(process.cwd(), "objects", "speech-correction");

// Voice samples storage for cloning
const VOICE_SAMPLES_DIR = path.join(SPEECH_STORAGE_DIR, "voice-samples");

// Ensure storage directory exists
function ensureStorageDir() {
  if (!fs.existsSync(SPEECH_STORAGE_DIR)) {
    fs.mkdirSync(SPEECH_STORAGE_DIR, { recursive: true });
  }
}

type PreviewInput = {
  transcript: string;
  duration?: number;
  stylePrompt?: string;
};

export interface SpeechPreviewRecord {
  previewId: string;
  url: string;
  localPath?: string;
  transcript: string;
  duration: number;
  createdAt: string;
  voiceId?: string;
}

// In-memory index backed by JSON file
const INDEX_FILE = path.join(SPEECH_STORAGE_DIR, "index.json");

function loadIndex(): Map<string, SpeechPreviewRecord> {
  ensureStorageDir();
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

function saveIndex(index: Map<string, SpeechPreviewRecord>) {
  ensureStorageDir();
  const obj = Object.fromEntries(index.entries());
  fs.writeFileSync(INDEX_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

export function getPreview(previewId: string): SpeechPreviewRecord | undefined {
  const index = loadIndex();
  return index.get(previewId);
}

export function storePreview(record: SpeechPreviewRecord) {
  const index = loadIndex();
  index.set(record.previewId, record);
  saveIndex(index);
}

/**
 * Generate speech/vocal preview using Replicate's XTTS voice cloning
 * If a voice sample is provided, it clones that voice. Otherwise uses default TTS.
 */
export async function generateSpeechPreview({
  transcript,
  duration = 15,
  stylePrompt,
  voiceSamplePath,
}: PreviewInput & { voiceSamplePath?: string }): Promise<string> {
  const promptHash = logPromptStart(transcript, { feature: "speech-preview" });
  const start = Date.now();

  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured for voice synthesis");
  }

  try {
    // Use XTTS for voice cloning if we have a voice sample
    if (voiceSamplePath && fs.existsSync(voiceSamplePath)) {
      console.log(`🎤 Using XTTS voice cloning with sample: ${voiceSamplePath}`);
      
      // Read voice sample and convert to base64 data URI
      const voiceData = fs.readFileSync(voiceSamplePath);
      const ext = path.extname(voiceSamplePath).toLowerCase();
      const mimeType = ext === '.wav' ? 'audio/wav' : ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
      const voiceDataUri = `data:${mimeType};base64,${voiceData.toString('base64')}`;
      
      // Use coqui XTTS model for voice cloning
      const output = await replicate.run(
        "lucataco/xtts-v2:684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e",
        {
          input: {
            text: transcript.trim(),
            speaker: voiceDataUri,
            language: "en",
          }
        }
      );

      const audioUrl = typeof output === 'string' ? output : (output as any)?.audio_url || (output as any)?.[0];
      
      if (!audioUrl) {
        throw new Error("XTTS returned no audio URL");
      }

      logPromptResult(promptHash, {
        feature: "speech-preview",
        provider: "replicate-xtts",
        durationMs: Date.now() - start,
      });
      
      return audioUrl;
    }

    // Fallback: Use Bark for text-to-speech without voice cloning
    console.log(`🎤 Using Bark TTS (no voice sample provided)`);
    
    const barkPrompt = stylePrompt 
      ? `[${stylePrompt}] ${transcript.trim()}`
      : transcript.trim();
    
    const output = await replicate.run(
      "suno-ai/bark:b76242b40d67c76ab6742e987628a2a9ac019e11d56ab96c4e91ce03b79b2787",
      {
        input: {
          prompt: barkPrompt,
          text_temp: 0.7,
          waveform_temp: 0.7,
        }
      }
    );

    const audioUrl = typeof output === 'string' ? output : (output as any)?.audio_out;
    
    if (!audioUrl) {
      throw new Error("Bark TTS returned no audio URL");
    }

    logPromptResult(promptHash, {
      feature: "speech-preview",
      provider: "replicate-bark",
      durationMs: Date.now() - start,
    });
    
    return audioUrl;

  } catch (error) {
    console.error("Speech preview generation failed:", error);
    throw new Error(`Speech preview generation failed: ${(error as Error).message}`);
  }
}

/**
 * Create a voice ID from an audio file and save the sample for cloning
 */
export function createVoiceIdForFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Voiceprint source file not found");
  }
  
  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  const voiceId = `voice-${hash.slice(0, 16)}`;
  
  // Save the voice sample for later use in cloning
  ensureStorageDir();
  if (!fs.existsSync(VOICE_SAMPLES_DIR)) {
    fs.mkdirSync(VOICE_SAMPLES_DIR, { recursive: true });
  }
  
  const ext = path.extname(filePath) || '.wav';
  const samplePath = path.join(VOICE_SAMPLES_DIR, `${voiceId}${ext}`);
  
  // Copy the voice sample if it doesn't already exist
  if (!fs.existsSync(samplePath)) {
    fs.copyFileSync(filePath, samplePath);
    console.log(`🎤 Voice sample saved: ${samplePath}`);
  }
  
  return {
    voiceId,
    bytes: data.length,
    samplePath,
  };
}

/**
 * Get the file path for a saved voice sample
 */
export function getVoiceSamplePath(voiceId: string): string | null {
  if (!fs.existsSync(VOICE_SAMPLES_DIR)) return null;
  
  // Check for common audio extensions
  const extensions = ['.wav', '.mp3', '.m4a', '.ogg', '.flac'];
  for (const ext of extensions) {
    const samplePath = path.join(VOICE_SAMPLES_DIR, `${voiceId}${ext}`);
    if (fs.existsSync(samplePath)) {
      return samplePath;
    }
  }
  return null;
}

/**
 * Apply voice conversion using Replicate's XTTS model
 * This clones the voice from a saved sample and applies it to new text
 */
export async function applyVoiceConversion(
  text: string,
  voiceId: string,
  options?: {
    language?: string;
  }
): Promise<string> {
  const { language = "en" } = options || {};

  if (!process.env.REPLICATE_API_TOKEN) {
    console.warn("[VC] REPLICATE_API_TOKEN not set, voice conversion unavailable");
    throw new Error("Voice conversion requires REPLICATE_API_TOKEN");
  }

  // Find the voice sample
  const voiceSamplePath = getVoiceSamplePath(voiceId);
  if (!voiceSamplePath) {
    throw new Error(`Voice sample not found for ID: ${voiceId}`);
  }

  console.log(`🎤 Applying voice conversion with XTTS: ${voiceId}`);
  
  try {
    // Read voice sample and convert to base64 data URI
    const voiceData = fs.readFileSync(voiceSamplePath);
    const ext = path.extname(voiceSamplePath).toLowerCase();
    const mimeType = ext === '.wav' ? 'audio/wav' : ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
    const voiceDataUri = `data:${mimeType};base64,${voiceData.toString('base64')}`;
    
    // Use XTTS model for voice cloning
    const output = await replicate.run(
      "lucataco/xtts-v2:684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e",
      {
        input: {
          text: text.trim(),
          speaker: voiceDataUri,
          language,
        }
      }
    );

    const audioUrl = typeof output === 'string' ? output : (output as any)?.audio_url || (output as any)?.[0];
    
    if (!audioUrl) {
      throw new Error("XTTS voice conversion returned no audio URL");
    }

    console.log(`✅ Voice conversion complete: ${audioUrl}`);
    return audioUrl;

  } catch (error) {
    console.error(`[VC] Voice conversion error:`, error);
    throw new Error(`Voice conversion failed: ${(error as Error).message}`);
  }
}
