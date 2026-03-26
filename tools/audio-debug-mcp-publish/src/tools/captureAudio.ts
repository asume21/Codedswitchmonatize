import { z } from 'zod'
import { triggerCapture, waitForCapture } from '../client.js'

export const captureAudioSchema = {
  duration_ms: z.number().min(500).max(30_000).optional()
    .describe('How many milliseconds to record (default 3000, max 30000)'),
}

export async function captureAudioHandler(args: { duration_ms?: number }) {
  const durationMs = args.duration_ms ?? 3000

  let captureId: string
  try {
    captureId = await triggerCapture(durationMs)
  } catch (err: unknown) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to send capture command: ${err instanceof Error ? err.message : String(err)}\n\nMake sure the dev server is running and the app is open in a browser tab.\nSee https://github.com/asume21/webear#setup for setup instructions.`,
      }],
    }
  }

  try {
    await waitForCapture(captureId, durationMs + 8000)
  } catch (err: unknown) {
    return {
      content: [{
        type: 'text' as const,
        text: `Capture timed out: ${err instanceof Error ? err.message : String(err)}`,
      }],
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: `Capture complete.\nCapture ID: ${captureId}\nDuration: ${durationMs}ms\n\nUse analyze_audio("${captureId}") to get signal analysis, or describe_audio("${captureId}") for a plain-English description.`,
    }],
  }
}
