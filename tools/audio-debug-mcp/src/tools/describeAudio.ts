import { z } from 'zod'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { waitForCapture } from '../client.js'

const execFileAsync = promisify(execFile)

/** OpenAI's audio input only accepts wav/mp3; captures arrive as webm/opus.
 *  Transcode via ffmpeg (system PATH) using temp files. */
async function transcodeWebmToWav(webm: Buffer): Promise<Buffer> {
  const stem = join(tmpdir(), `audio-debug-${randomUUID()}`)
  const inPath = `${stem}.webm`
  const outPath = `${stem}.wav`
  try {
    await writeFile(inPath, webm)
    // 44.1kHz mono — this is music, not speech; keep full bandwidth so the
    // model can judge hats, air, and artifacts like crackle.
    await execFileAsync('ffmpeg', ['-y', '-i', inPath, '-ar', '44100', '-ac', '1', outPath])
    return await readFile(outPath)
  } finally {
    await rm(inPath, { force: true }).catch(() => {})
    await rm(outPath, { force: true }).catch(() => {})
  }
}

export const describeAudioSchema = {
  capture_id: z.string().describe('The capture ID returned by capture_audio'),
  question:   z.string().optional()
    .describe('Optional specific question about the audio, e.g. "does the bass feel muddy?"'),
}

export async function describeAudioHandler(args: { capture_id: string; question?: string }) {
  // Try Gemini first (supports audio natively), fall back to OpenAI
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!geminiKey && !openaiKey) {
    return {
      content: [{
        type: 'text' as const,
        text: 'No AI API key found. Set GEMINI_API_KEY or OPENAI_API_KEY in your environment to enable audio description.\n\nYou can still use analyze_audio for signal data without an AI key.',
      }],
    }
  }

  let buffer: Buffer
  try {
    buffer = await waitForCapture(args.capture_id, 2000)
  } catch {
    return {
      content: [{
        type: 'text' as const,
        text: `Capture "${args.capture_id}" not found. Run capture_audio first.`,
      }],
    }
  }

  const basePrompt = [
    'You are a professional music producer and audio engineer listening to a short audio clip from a procedural hip-hop music generator.',
    'Describe what you hear in plain English, focusing on:',
    '- What instruments / sounds are present',
    '- The rhythmic feel — is the timing tight or loose?',
    '- The tonal balance — is it muddy, bright, warm, thin?',
    '- Any problems: clipping, distortion, phasing, timing issues',
    '- How it would feel to a rapper trying to flow over it',
    args.question ? `\nSpecific question to answer: ${args.question}` : '',
  ].join('\n')

  // Try Gemini first, but a dead/rotated Gemini key must not take the whole
  // feature down when a working OpenAI key is available — fall through.
  const errors: string[] = []
  if (geminiKey) {
    try {
      return await describeWithGemini(buffer, basePrompt, geminiKey)
    } catch (err: unknown) {
      errors.push(`Gemini: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (openaiKey) {
    try {
      return await describeWithOpenAI(buffer, basePrompt, openaiKey)
    } catch (err: unknown) {
      errors.push(`OpenAI: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: `AI description failed for all providers:\n${errors.join('\n')}`,
    }],
  }
}

async function describeWithGemini(audioBuffer: Buffer, prompt: string, apiKey: string) {
  const base64 = audioBuffer.toString('base64')

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: 'audio/webm',
            data:       base64,
          },
        },
      ],
    }],
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${text}`)
  }

  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no response)'

  return { content: [{ type: 'text' as const, text: `── AI Description (Gemini) ──\n\n${text}` }] }
}

async function describeWithOpenAI(audioBuffer: Buffer, prompt: string, apiKey: string) {
  // GPT audio input only accepts wav/mp3 — transcode the webm capture first.
  const wav = await transcodeWebmToWav(audioBuffer)
  const base64 = wav.toString('base64')

  const body = {
    model: 'gpt-audio',
    modalities: ['text'],
    messages: [{
      role:    'user',
      content: [
        // The newer audio models are agent-tuned and sometimes answer with a
        // fake tool-call JSON — demand plain prose explicitly.
        { type: 'text', text: `${prompt}\n\nRespond in plain English prose only. Do not output JSON or tool calls.` },
        {
          type:       'input_audio',
          input_audio: { data: base64, format: 'wav' },
        },
      ],
    }],
    max_tokens: 500,
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${text}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const text = data.choices?.[0]?.message?.content ?? '(no response)'

  return { content: [{ type: 'text' as const, text: `── AI Description (GPT-4o) ──\n\n${text}` }] }
}
