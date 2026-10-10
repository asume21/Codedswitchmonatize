import { z } from 'zod'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { audioSourceFields, loadAudio, AudioSourceError, type AudioSourceArgs, type LoadedAudio } from '../audioSource.js'

const execFileAsync = promisify(execFile)

/** Transcode via ffmpeg (system PATH) using temp files — a WAV written to a
 *  pipe has no length in its header, which strict decoders reject. */
async function transcode(input: Buffer, outExt: 'wav' | 'mp3'): Promise<Buffer> {
  const stem = join(tmpdir(), `audio-debug-${randomUUID()}`)
  const inPath = `${stem}.in`
  const outPath = `${stem}.${outExt}`
  try {
    await writeFile(inPath, input)
    // 44.1kHz mono — this is music, not speech; keep full bandwidth so the
    // model can judge hats, air, and artifacts like crackle.
    const codec = outExt === 'mp3' ? ['-b:a', '192k'] : []
    await execFileAsync('ffmpeg', ['-y', '-i', inPath, '-ar', '44100', '-ac', '1', ...codec, outPath])
    return await readFile(outPath)
  } finally {
    await rm(inPath, { force: true }).catch(() => {})
    await rm(outPath, { force: true }).catch(() => {})
  }
}

/** Inline audio is capped (~20 MB) by both providers: captures (small webm)
 *  and mp3 files go as-is, anything else — a 4-minute WAV is ~40 MB — as mp3. */
const INLINE_AS_IS_BYTES = 12 * 1024 * 1024
async function compact(audio: LoadedAudio): Promise<{ bytes: Buffer; mime: string }> {
  if (audio.mime === 'audio/mpeg' && audio.bytes.length <= INLINE_AS_IS_BYTES) return audio
  if (audio.mime === 'audio/webm' && audio.bytes.length <= INLINE_AS_IS_BYTES) return audio
  return { bytes: await transcode(audio.bytes, 'mp3'), mime: 'audio/mpeg' }
}

export const describeAudioSchema = {
  ...audioSourceFields,
  question:   z.string().optional()
    .describe('Optional specific question about the audio, e.g. "does the bass feel muddy?"'),
}

export async function describeAudioHandler(args: AudioSourceArgs & { question?: string }) {
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

  let audio: { bytes: Buffer; mime: string }
  try {
    audio = await compact(await loadAudio(args))
  } catch (err: unknown) {
    const msg = err instanceof AudioSourceError ? err.message : `Could not load audio: ${err instanceof Error ? err.message : String(err)}`
    return { content: [{ type: 'text' as const, text: msg }] }
  }

  const basePrompt = [
    args.file
      ? 'You are a professional music producer and audio engineer listening to an audio file (a rendered or reference beat).'
      : 'You are a professional music producer and audio engineer listening to a short audio clip from a procedural hip-hop music generator.',
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
      return await describeWithGemini(audio, basePrompt, geminiKey)
    } catch (err: unknown) {
      errors.push(`Gemini: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (openaiKey) {
    try {
      return await describeWithOpenAI(audio, basePrompt, openaiKey)
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

async function describeWithGemini(audio: { bytes: Buffer; mime: string }, prompt: string, apiKey: string) {
  const base64 = audio.bytes.toString('base64')

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: audio.mime,
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

async function describeWithOpenAI(audio: { bytes: Buffer; mime: string }, prompt: string, apiKey: string) {
  // GPT audio input only accepts wav/mp3 — mp3 goes as-is, webm captures become wav.
  const isMp3 = audio.mime === 'audio/mpeg'
  const base64 = (isMp3 ? audio.bytes : await transcode(audio.bytes, 'wav')).toString('base64')

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
          input_audio: { data: base64, format: isMp3 ? 'mp3' : 'wav' },
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
