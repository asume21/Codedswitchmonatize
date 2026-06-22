/**
 * requestAceStems — headless client service that asks the server to render ACE-Step
 * stems for the live Organism (rung 2 of the real-time plan: "ACE makes the stems
 * ahead"). Kicks off the existing POST /api/stem-generation/generate (which renders
 * ACE `lego` per-track stems, MusicGen sidecar fallback), then polls GET
 * /api/stem-generation/:jobId until the stem URLs land, and returns them in the
 * AceStemLayer shape.
 *
 * Why this is NOT StemGenerationContext (deliberately separate, not a double):
 *   - That context parses `data.stems` as an ARRAY (the MusicGen sidecar shape);
 *     the ACE lego path returns an OBJECT { drums, bass, other } — handled here.
 *   - That context is React/TrackStore-coupled and adds stems as *studio DAW clips*;
 *     this is headless and feeds the *live loop* layer.
 *   - That context doesn't poll. This does (ACE renders take minutes).
 * If those two ever need to share parsing, lift `parseAceStems` — don't merge the
 * surfaces.
 */
import { apiRequest } from '@/lib/queryClient'
import type { AceStem } from '@/organism/loops/AceStemLayer'

export interface AceStemRequest {
  /** Prose/tag prompt for ACE (e.g. plan.acePrompt or a section description). */
  prompt: string
  /** Session tempo — rendered into the stems and used later to tempo-match. */
  bpm: number
  /** Musical key, default 'C'. */
  key?: string
  /** Loop length in seconds (default 10 — one short phrase to loop). */
  durationSec?: number
}

export interface RequestAceStemsOptions {
  signal?: AbortSignal
  pollIntervalMs?: number
  maxWaitMs?: number
  /** Called with each poll's status string ('pending' | 'running' | ...). */
  onProgress?: (status: string) => void
}

const DEFAULT_POLL_MS = 4000
// ACE cold-start + three lego renders can take minutes; the render happens ahead
// of when the stems are needed, so a long ceiling is fine.
const DEFAULT_MAX_WAIT_MS = 5 * 60_000

/**
 * Map the server's ACE lego response — stems as an OBJECT { drums, bass, other }
 * of /api/stems URLs — into AceStem[], tagging each with the render BPM so the
 * AceStemLayer can tempo-match. Skips empty URLs. Returns [] for anything that
 * isn't a plain object of string URLs (e.g. the sidecar array shape, or null).
 */
export function parseAceStems(stems: unknown, bpm: number): AceStem[] {
  if (!stems || typeof stems !== 'object' || Array.isArray(stems)) return []
  return Object.entries(stems as Record<string, unknown>)
    .filter(([, url]) => typeof url === 'string' && (url as string).length > 0)
    .map(([name, url]) => ({ name, url: url as string, bpm }))
}

/**
 * Render ACE stems for a request and resolve with them once ready. Returns null on
 * any failure (auth, network, render error, timeout) — the caller should treat null
 * as "stay on the live band without ACE stems" and never surface an error, mirroring
 * composeForPreset's fire-and-forget contract.
 */
export async function requestAceStems(
  req: AceStemRequest,
  opts: RequestAceStemsOptions = {},
): Promise<AceStem[] | null> {
  const jobId = await startStemJob(req)
  if (!jobId) return null
  return pollStemJob(jobId, req.bpm, opts)
}

async function startStemJob(req: AceStemRequest): Promise<string | null> {
  try {
    const res = await apiRequest('POST', '/api/stem-generation/generate', {
      prompt:   req.prompt,
      bpm:      req.bpm,
      key:      req.key ?? 'C',
      duration: req.durationSec ?? 10,
    })
    if (!res.ok) {
      console.warn('[aceStems] generate returned', res.status)
      return null
    }
    const json = await res.json()
    if (!json?.jobId || typeof json.jobId !== 'string') {
      console.warn('[aceStems] no jobId in generate response', json)
      return null
    }
    return json.jobId
  } catch (err) {
    console.warn('[aceStems] generate failed', err)
    return null
  }
}

async function pollStemJob(
  jobId: string,
  bpm: number,
  opts: RequestAceStemsOptions,
): Promise<AceStem[] | null> {
  const interval = opts.pollIntervalMs ?? DEFAULT_POLL_MS
  const deadline = Date.now() + (opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS)

  while (Date.now() < deadline) {
    if (opts.signal?.aborted) return null
    await delay(interval, opts.signal)
    if (opts.signal?.aborted) return null

    try {
      const res = await apiRequest('GET', `/api/stem-generation/${encodeURIComponent(jobId)}`)
      if (!res.ok) {
        console.warn('[aceStems] status returned', res.status)
        continue // transient — keep polling until the deadline
      }
      const json = await res.json()
      opts.onProgress?.(typeof json?.status === 'string' ? json.status : 'unknown')

      if (json?.status === 'complete' || json?.status === 'completed') {
        const stems = parseAceStems(json.stems, bpm)
        return stems.length > 0 ? stems : null
      }
      if (json?.status === 'error' || json?.status === 'failed') {
        console.warn('[aceStems] job failed', json?.error)
        return null
      }
      // pending | running | processing → keep polling
    } catch (err) {
      console.warn('[aceStems] poll error (will retry)', err)
    }
  }

  console.warn('[aceStems] timed out waiting for stems', jobId)
  return null
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
}
