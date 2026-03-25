import { z } from 'zod'
import { waitForCapture } from '../client.js'

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
    'You are a professional audio engineer listening to a short audio clip from a web application.',
    'Describe what you hear in plain English, focusing on:',
    '- What instruments / sounds are present',
    '- The rhythmic feel — is the timing tight or loose?',
    '- The tonal balance — is it muddy, bright, warm, thin?',
    '- Any problems: clipping, distortion, phasing, timing issues',
    '- Overall quality assessment',
    args.question ? `\nSpecific question to answer: ${args.question}` : '',
  ].join('\n')

  try {
    if (geminiKey) {
      return await describeWithGemini(buffer, basePrompt, geminiKey)
    } else if (openaiKey) {
      return await describeWithOpenAI(buffer, basePrompt, openaiKey)
    }
  } catch (err: unknown) {
    return {
      content: [{
        type: 'text' as const,
        text: `AI description failed: ${err instanceof Error ? err.message : String(err)}`,
      }],
    }
  }

  return { content: [{ type: 'text' as const, text: 'No AI provider available.' }] }
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
  const base64 = audioBuffer.toString('base64')

  const body = {
    model: 'gpt-4o-audio-preview',
    messages: [{
      role:    'user',
      content: [
        { type: 'text', text: prompt },
        {
          type:       'input_audio',
          input_audio: { data: base64, format: 'webm' },
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
