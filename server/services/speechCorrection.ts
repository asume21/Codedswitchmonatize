import fs from "fs";
import path from "path";
import crypto from "crypto";
import { unifiedMusicService } from "./unifiedMusicService";

// Persistent storage directory for speech correction previews/finals
const SPEECH_STORAGE_DIR = path.resolve(process.cwd(), "objects", "speech-correction");

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
  voiceId?: string;
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

export async function generateSpeechPreview({
  transcript,
  duration = 15,
  stylePrompt,
  voiceId: selectedVoiceId,
  sourceAudioPath,
}: PreviewInput & { sourceAudioPath?: string }): Promise<string> {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  
  console.log("[SpeechPreview] Starting preview generation");
  console.log("[SpeechPreview] Voice ID:", selectedVoiceId);
  console.log("[SpeechPreview] Source audio:", sourceAudioPath);
  
  if (!elevenLabsApiKey) {
    throw new Error("ElevenLabs API key not configured");
  }

  const objectsDir = fs.existsSync('/data') 
    ? path.resolve('/data', 'objects')
    : path.resolve(process.cwd(), 'objects');
  
  if (!fs.existsSync(objectsDir)) {
    fs.mkdirSync(objectsDir, { recursive: true });
  }

  // If we have source audio, use Speech-to-Speech to convert the vocals
  if (sourceAudioPath && selectedVoiceId) {
    console.log("[SpeechPreview] Using Speech-to-Speech conversion on source audio");
    
    // Step 1: Isolate vocals from the source audio
    const sourceBuffer = fs.readFileSync(sourceAudioPath);
    
    console.log("[SpeechPreview] Step 1: Isolating vocals...");
    const isolateResponse = await fetch('https://api.elevenlabs.io/v1/audio-isolation', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
      },
      body: (() => {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('audio', sourceBuffer, { filename: 'input.mp3', contentType: 'audio/mpeg' });
        return form;
      })(),
    });

    if (!isolateResponse.ok) {
      const err = await isolateResponse.text();
      console.error("[SpeechPreview] Isolation failed:", err);
      throw new Error("Failed to isolate vocals");
    }

    const vocalsBuffer = Buffer.from(await isolateResponse.arrayBuffer());
    console.log("[SpeechPreview] Vocals isolated, size:", vocalsBuffer.length);

    // Step 2: Convert vocals to selected voice using Speech-to-Speech
    console.log("[SpeechPreview] Step 2: Converting to selected voice...");
    const FormData = require('form-data');
    const stsForm = new FormData();
    stsForm.append('audio', vocalsBuffer, { filename: 'vocals.mp3', contentType: 'audio/mpeg' });
    stsForm.append('model_id', 'eleven_english_sts_v2');
    stsForm.append('voice_settings', JSON.stringify({ stability: 0.5, similarity_boost: 0.75 }));

    const stsResponse = await fetch(`https://api.elevenlabs.io/v1/speech-to-speech/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        ...stsForm.getHeaders(),
      },
      body: stsForm,
    });

    if (!stsResponse.ok) {
      const err = await stsResponse.text();
      console.error("[SpeechPreview] STS failed:", err);
      throw new Error("Failed to convert voice");
    }

    const convertedBuffer = Buffer.from(await stsResponse.arrayBuffer());
    console.log("[SpeechPreview] Voice converted, size:", convertedBuffer.length);

    // Save the converted vocals
    const filename = `sts_preview_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`;
    const outputPath = path.join(objectsDir, filename);
    fs.writeFileSync(outputPath, convertedBuffer);
    
    console.log("[SpeechPreview] Saved converted vocals to:", outputPath);
    return `/api/internal/uploads/${filename}`;
  }

  // Fallback: Use TTS if no source audio (just read the transcript)
  console.log("[SpeechPreview] No source audio, using TTS fallback");
  const voiceId = selectedVoiceId || "21m00Tcm4TlvDq8ikWAM";
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: transcript.trim().substring(0, 5000),
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS failed: ${errorText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const filename = `tts_preview_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`;
  const outputPath = path.join(objectsDir, filename);
  fs.writeFileSync(outputPath, audioBuffer);
  
  return `/api/internal/uploads/${filename}`;
}

export function createVoiceIdForFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Voiceprint source file not found");
  }
  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  return {
    voiceId: `voice-${hash.slice(0, 16)}`,
    bytes: data.length,
  };
}

// RVC API configuration (local server on port 7870)
const RVC_API_URL = process.env.RVC_API_URL || "http://localhost:7870";

/**
 * Apply voice conversion using local RVC API.
 * Falls back to returning original URL if RVC is unavailable.
 */
export async function applyVoiceConversion(
  audioUrl: string,
  voiceId: string,
  options?: {
    pitch?: number;
    indexRate?: number;
    filterRadius?: number;
    rmsMixRate?: number;
    protect?: number;
  }
): Promise<string> {
  const {
    pitch = 0,
    indexRate = 0.75,
    filterRadius = 3,
    rmsMixRate = 0.25,
    protect = 0.33,
  } = options || {};

  try {
    // Check if RVC API is available
    const healthCheck = await fetch(`${RVC_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);

    if (!healthCheck || !healthCheck.ok) {
      console.log(`[VC] RVC API not available at ${RVC_API_URL}, returning original audio`);
      return audioUrl;
    }

    // Call RVC API to convert voice
    const response = await fetch(`${RVC_API_URL}/convert_url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: audioUrl,
        model: voiceId,
        pitch,
        index_rate: indexRate,
        filter_radius: filterRadius,
        rms_mix_rate: rmsMixRate,
        protect,
      }),
      signal: AbortSignal.timeout(60000), // 60s timeout for conversion
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error(`[VC] RVC conversion failed:`, error);
      return audioUrl;
    }

    const result = await response.json();
    if (result.success && result.output_path) {
      // RVC returns a local file path; we need to serve it or copy it
      // For now, copy to our objects folder and return a URL
      ensureStorageDir();
      const outputFilename = `vc-${crypto.randomUUID()}.wav`;
      const outputPath = path.join(SPEECH_STORAGE_DIR, outputFilename);
      
      // Copy the RVC output to our storage
      if (fs.existsSync(result.output_path)) {
        fs.copyFileSync(result.output_path, outputPath);
        // Clean up RVC temp file
        try { fs.unlinkSync(result.output_path); } catch {}
        
        // Return URL to our served file
        return `/api/internal/uploads/speech-correction/${outputFilename}`;
      }
    }

    console.log(`[VC] RVC returned unexpected result, using original audio`);
    return audioUrl;
  } catch (error) {
    console.error(`[VC] Voice conversion error:`, error);
    return audioUrl;
  }
}
