/**
 * WebEar audio description — the "AI listens to your track" half of WebEar.
 *
 * This is what makes WebEar a product: a text-only AI (Claude, Cursor, etc.)
 * can't hear audio, so this turns a captured clip into a plain-English read on
 * what's actually playing — instruments, genre, mood, mix problems.
 *
 * Provider chain (first one configured wins, falls back on failure):
 *   1. Gemini  — free key + free tier (Google AI Studio). Primary: $0 to test.
 *   2. OpenAI  — gpt-4o-audio-preview. Optional paid fallback so the product
 *                never goes dark if Gemini is unavailable.
 *
 * Both genuinely LISTEN to the waveform (multimodal audio), unlike the DSP
 * `analyze` path which only measures signal metrics. Ollama is intentionally
 * NOT here — it cannot accept audio input.
 */

import { spawn } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const DESCRIBE_PROMPT =
  'Describe this audio in detail. What instruments do you hear? What is the ' +
  'genre, mood, rhythm, and tone? If it is ambient or structural, describe the ' +
  'textures and frequencies. Note any obvious mix problems (clipping, muddiness, ' +
  'harshness, weak low end). Keep it concise but highly analytical.';

// Google retires Gemini model names FAST (1.5-flash and 2.0-flash both 404'd
// within a day). So instead of one name, try a list newest→older and use the
// first that answers. An env override jumps the queue. This stops us chasing
// model names every time Google rotates them.
const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_AUDIO_MODEL?.trim(),
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-001',
].filter((m): m is string => Boolean(m));
const OPENAI_AUDIO_MODEL = process.env.OPENAI_AUDIO_MODEL?.trim() || 'gpt-4o-audio-preview';

/** Transcode any captured audio (webm/opus, etc.) to mono 44.1kHz WAV — the
 *  format both Gemini and OpenAI accept as inline audio. */
function toWav(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'wav', '-ac', '1', '-ar', '44100', 'pipe:1']);
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.stderr.on('data', () => {});
    ff.stdout.on('end', () => resolve(Buffer.concat(chunks)));
    ff.on('error', (e) => reject(new Error(`ffmpeg: ${e.message}`)));
    ff.on('close', (code) => { if (code !== 0 && chunks.length === 0) reject(new Error(`ffmpeg exited ${code}`)); });
    ff.stdin.write(buf);
    ff.stdin.end();
  });
}

async function describeWithGemini(wavBase64: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const errors: string[] = [];
  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { text: DESCRIBE_PROMPT },
        { inlineData: { mimeType: 'audio/wav', data: wavBase64 } },
      ]);
      return result.response.text();
    } catch (err: any) {
      // 404 = retired/unknown model name → try the next candidate. Anything
      // else (auth, quota) won't be fixed by another name, so stop.
      const msg = String(err?.message ?? err);
      errors.push(`${modelName}: ${msg}`);
      if (!/404|not found|no longer available|not supported/i.test(msg)) throw err;
    }
  }
  throw new Error(`No Gemini model accepted the request — ${errors.join(' | ')}`);
}

async function describeWithOpenAI(wavBase64: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const result = await openai.chat.completions.create({
    model: OPENAI_AUDIO_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: DESCRIBE_PROMPT },
        { type: 'input_audio', input_audio: { data: wavBase64, format: 'wav' } },
      ],
    }],
  });
  return result.choices[0]?.message?.content ?? 'No description returned.';
}

/** Whether at least one audio-describe provider is configured. */
export function isAudioDescribeConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

/**
 * Describe a captured audio clip via the provider chain. Accepts the raw
 * captured buffer (any ffmpeg-decodable format) and returns a plain-English
 * description. Throws only if every configured provider fails.
 */
export async function describeAudio(inputBuffer: Buffer): Promise<string> {
  if (!isAudioDescribeConfigured()) {
    throw new Error(
      'No audio-describe provider configured. Set GEMINI_API_KEY (free at ' +
      'https://aistudio.google.com/apikey) or OPENAI_API_KEY.',
    );
  }

  const wavBase64 = (await toWav(inputBuffer)).toString('base64');

  // Ordered chain: Gemini (free) first, then OpenAI. Try each configured
  // provider; only surface an error if they all fail.
  const errors: string[] = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      return await describeWithGemini(wavBase64);
    } catch (err: any) {
      errors.push(`Gemini: ${err?.message ?? err}`);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await describeWithOpenAI(wavBase64);
    } catch (err: any) {
      errors.push(`OpenAI: ${err?.message ?? err}`);
    }
  }

  throw new Error(`All audio-describe providers failed — ${errors.join('; ')}`);
}
