import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';

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

  try {
    console.log(`🎤 Starting transcription for file: ${path.basename(filePath)}`);
    
    const response = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"]
    });

    console.log(`✅ Transcription successful. Length: ${response.text.length} chars`);
    if (response.words) {
      console.log(`📝 Word-level timestamps: ${response.words.length} words`);
    }

    return {
      text: response.text,
      language: response.language,
      duration: response.duration,
      segments: response.segments,
      words: response.words // Word-level timestamps
    };

  } catch (error) {
    console.error("❌ Transcription failed:", error);
    throw new Error(`Transcription failed: ${(error as Error).message}`);
  }
}
