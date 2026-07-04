import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

// OpenAI Whisper rejects uploads over 25 MiB (26214400 bytes) with a 413.
// Uncompressed WAV is ~10 MB/min, so even short songs exceed it. We compress
// above a safety threshold — Whisper only uses 16 kHz mono internally, so a
// 16 kHz mono MP3 loses no transcription accuracy while shrinking ~10x.
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const WHISPER_SAFE_BYTES = 24 * 1024 * 1024;

/** Whether a file of this size must be compressed before hitting Whisper. */
export function needsWhisperCompression(sizeBytes: number): boolean {
  return sizeBytes > WHISPER_SAFE_BYTES;
}

/** Transcode any audio to a compact 16 kHz mono MP3 in a temp file. Caller deletes it. */
function compressForWhisper(filePath: string): Promise<string> {
  const outPath = path.join(os.tmpdir(), `whisper-${crypto.randomBytes(6).toString('hex')}.mp3`);
  return new Promise<string>((resolve, reject) => {
    ffmpeg(filePath)
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate('64k')
      .format('mp3')
      .on('end', () => resolve(outPath))
      .on('error', (err) => reject(err))
      .save(outPath);
  });
}

// Initialize OpenAI client
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();

if (!openaiApiKey) {
  console.log('🔐 OPENAI_API_KEY debug: missing or empty');
} else {
  console.log('🔐 OPENAI_API_KEY debug:', {
    length: openaiApiKey.length,
    prefix: openaiApiKey.slice(0, 8),
    suffix: openaiApiKey.slice(-4),
  });
}

let openaiClient: OpenAI | null = null;
if (openaiApiKey && openaiApiKey.startsWith('sk-')) {
  openaiClient = new OpenAI({
    apiKey: openaiApiKey,
    timeout: 60000 // Longer timeout for audio
  });
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: any[];
  words?: any[]; // Word-level timestamps
}

/**
 * Transcribe audio file using OpenAI Whisper API
 * @param filePath Path to the audio file
 * @returns Transcription text
 */
export async function transcribeAudio(filePath: string): Promise<TranscriptionResult> {
  if (!openaiClient) {
    throw new Error("OpenAI API key not configured or invalid. Cannot perform transcription.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found at path: ${filePath}`);
  }

  let uploadPath = filePath;
  let tempCompressed: string | null = null;

  try {
    console.log(`🎤 Starting transcription for file: ${path.basename(filePath)}`);

    // Whisper caps uploads at 25 MiB. Compress oversized audio (e.g. WAV) first.
    const { size } = fs.statSync(filePath);
    if (needsWhisperCompression(size)) {
      console.log(`🗜️ Audio is ${(size / 1024 / 1024).toFixed(1)}MB (> Whisper limit) — compressing to 16kHz mono MP3`);
      tempCompressed = await compressForWhisper(filePath);
      uploadPath = tempCompressed;
      const compressedSize = fs.statSync(uploadPath).size;
      console.log(`✅ Compressed to ${(compressedSize / 1024 / 1024).toFixed(1)}MB`);
      if (compressedSize > WHISPER_MAX_BYTES) {
        throw new Error(
          `Audio is too long to transcribe (still ${(compressedSize / 1024 / 1024).toFixed(1)}MB after compression). Try a shorter clip.`,
        );
      }
    }

    const response = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(uploadPath),
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"] // Request both word and segment level timestamps
    });

    console.log(`✅ Transcription successful. Length: ${response.text.length} chars`);
    
    // Log word count for debugging
    if ((response as any).words) {
      console.log(`📝 Word-level timestamps: ${(response as any).words.length} words`);
    }

    return {
      text: response.text,
      language: response.language,
      duration: response.duration,
      segments: response.segments,
      words: (response as any).words || [] // Include word-level timestamps
    };

  } catch (error) {
    console.error("❌ Transcription failed:", error);
    throw new Error(`Transcription failed: ${(error as Error).message}`);
  } finally {
    if (tempCompressed) {
      try {
        fs.unlinkSync(tempCompressed);
      } catch {
        /* temp file cleanup is best-effort */
      }
    }
  }
}
