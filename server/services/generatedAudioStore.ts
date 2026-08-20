/**
 * Generated-audio store — the one place that knows where rendered audio lives
 * on disk and what URL serves it back.
 *
 * In production ACE_STEP_OUTPUT_DIR points at the Railway Volume mount, so
 * files survive redeploys. In dev it falls back to a local directory. The
 * matching read side is GET /api/ai-music/audio/:filename (server/routes/aceStep.ts).
 *
 * WHY REMOTE URLS MUST NOT BE STORED
 * Replicate deletes a prediction's output files about an hour after the run.
 * Any feature that hands a raw replicate.delivery URL to the client produces
 * audio that plays during testing and is gone by the next day — and anything
 * persisted (a saved pack, a library entry) is dead on arrival. The ACE-Step
 * path has always downloaded its renders for exactly this reason; everything
 * else that renders through Replicate needs to do the same.
 */

import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

/** Where rendered audio is written. Railway Volume in prod, local dir in dev. */
export const GENERATED_AUDIO_DIR = process.env.ACE_STEP_OUTPUT_DIR
  ? path.resolve(process.env.ACE_STEP_OUTPUT_DIR)
  : path.resolve(process.cwd(), 'private', 'ace-step', 'output')

/** The route that serves {@link GENERATED_AUDIO_DIR} back to the client. */
export const GENERATED_AUDIO_URL_PREFIX = '/api/ai-music/audio'

const DOWNLOAD_TIMEOUT_MS = 60_000

/** Public URL for a file already sitting in {@link GENERATED_AUDIO_DIR}. */
export function generatedAudioUrl(filename: string): string {
  return `${GENERATED_AUDIO_URL_PREFIX}/${filename}`
}

function extensionFor(remoteUrl: string): 'wav' | 'mp3' {
  // Query strings are normal on signed delivery URLs — match on the path only.
  const withoutQuery = remoteUrl.split('?')[0].toLowerCase()
  return withoutQuery.endsWith('.mp3') ? 'mp3' : 'wav'
}

/**
 * Download a remote render into the persistent store and return the URL that
 * serves it. Returns null if the download fails, so callers can decide whether
 * to fall back to the (short-lived) remote URL or drop the item entirely.
 */
export async function persistRemoteAudio(
  remoteUrl: string,
  idHint?: string,
): Promise<string | null> {
  try {
    const filename = `${idHint ? `${idHint}-` : ''}${randomUUID()}.${extensionFor(remoteUrl)}`
    const destination = path.join(GENERATED_AUDIO_DIR, filename)

    const response = await fetch(remoteUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    if (!response.ok) {
      console.warn(`[generatedAudioStore] download failed (${response.status}) for ${remoteUrl}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength === 0) {
      console.warn(`[generatedAudioStore] download was empty for ${remoteUrl}`)
      return null
    }

    fs.mkdirSync(GENERATED_AUDIO_DIR, { recursive: true })
    fs.writeFileSync(destination, buffer)

    return generatedAudioUrl(filename)
  } catch (err) {
    console.warn(
      `[generatedAudioStore] could not persist ${remoteUrl}:`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}
