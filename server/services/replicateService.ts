/**
 * Replicate Service — runs ACE-Step on Replicate.
 *
 * Submit → poll → download the result into the persistent store. Zero idle
 * cost, pay per inference.
 *
 * HISTORY — why ACE-Step never once ran in production:
 * This file used to require you to package ACE-Step as your own Cog build and
 * push it (`cog push r8.im/<you>/ace-step`), then paste the resulting hash into
 * REPLICATE_MODEL_VERSION. That push never happened, so the variable was empty
 * in every environment, `isWorkerReady()` reported the worker down, and every
 * `tryAceFirst()` call in the app silently fell through to MusicGen. The UI
 * still said "ACE-Step" the whole time.
 *
 * There is no need to self-host: ACE-Step is publicly hosted on Replicate and
 * callable with any API token. We point at that by default. Its input schema is
 * NOT the one the old cog used — see buildAceStepInput.
 *
 * Config:
 *   REPLICATE_API_TOKEN      — your Replicate API key (the only required one)
 *   REPLICATE_ACE_MODEL      — optional override, "owner/name"
 *   REPLICATE_MODEL_VERSION  — optional override, a version hash
 *   ACE_STEP_OUTPUT_DIR      — where to save downloaded audio
 */

import * as fs from 'fs'
import * as path from 'path'
import type { AceStepJob, AceStepRequest } from './aceStepService'
import { extractReplicateAudioUrl } from './replicateOutput'
import { GENERATED_AUDIO_DIR, generatedAudioUrl } from './generatedAudioStore'

const REPLICATE_API_BASE = 'https://api.replicate.com/v1'

/**
 * Publicly hosted ACE-Step. Overridable, but it must be a real hosted model —
 * an empty value here is what silently disabled ACE everywhere.
 */
export const ACE_STEP_MODEL = process.env.REPLICATE_ACE_MODEL || 'lucataco/ace-step'

/** Pinned version of {@link ACE_STEP_MODEL}, so a model update can't change our output overnight. */
const MODEL_VERSION =
  process.env.REPLICATE_MODEL_VERSION ||
  '280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1'

/** Model-declared bounds. Sending outside these is a 422, not a clamped value. */
const DURATION_MIN = 1
const DURATION_MAX = 240
const STEPS_MIN = 10
const STEPS_MAX = 200

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** How many times to wait out a 429 before giving up. */
const MAX_RATE_LIMIT_RETRIES = 5
const RETRY_AFTER_DEFAULT_MS = 2_000
const RETRY_AFTER_MAX_MS = 60_000

/**
 * How long Replicate wants us to wait after a 429. Prefers `retry_after`
 * (seconds) from the JSON body, then the Retry-After header, then a small
 * default. Capped so a bad value can't stall a request indefinitely.
 */
export function parseRetryAfterMs(bodyText: string, headers: Headers): number {
  const fromBody = (() => {
    try {
      const parsed = JSON.parse(bodyText) as { retry_after?: unknown }
      return typeof parsed.retry_after === 'number' ? parsed.retry_after : null
    } catch {
      return null
    }
  })()

  const fromHeader = Number.parseFloat(headers.get('retry-after') ?? '')
  const seconds = fromBody ?? (Number.isFinite(fromHeader) ? fromHeader : null)

  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return RETRY_AFTER_DEFAULT_MS
  }
  return Math.min(seconds * 1000, RETRY_AFTER_MAX_MS)
}

// Shared with every other writer and with the route that serves these files,
// so the write path and the read path can no longer drift apart.
const OUTPUT_DIR = GENERATED_AUDIO_DIR

const apiToken = process.env.REPLICATE_API_TOKEN ?? ''

// ── Types ──────────────────────────────────────────────────────────────

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'

interface ReplicatePrediction {
  id: string
  status: ReplicateStatus
  error?: string | null
  output?: unknown
  metrics?: { predict_time?: number }
}

// ── Public API (mirrors runpodServerlessService) ───────────────────────

export function isReplicateConfigured(): boolean {
  return Boolean(apiToken)
}

/**
 * Translate our internal request into the public ACE-Step input schema.
 *
 * The names differ from the old self-hosted cog, and that mismatch is why
 * setting REPLICATE_MODEL_VERSION alone would not have fixed anything:
 *
 *   ours            → model
 *   prompt          → tags            (the only REQUIRED field)
 *   audioDuration   → duration        (number, 1..240)
 *   inferStep       → number_of_steps (integer, 10..200 — the cost dial)
 *   instrumental    → lyrics: '[inst]'
 *   seed (null)     → seed: -1        (null is rejected; -1 means randomize)
 *
 * `bpm`, `taskType` and `trackName` have no equivalent and are dropped rather
 * than sent and silently ignored. Tempo still reaches the model through the
 * prompt text (see bpmResolution).
 */
export function buildAceStepInput(req: AceStepRequest): Record<string, unknown> {
  // '[inst]' is the model's documented token for instrumental-only output.
  const lyrics = req.lyrics?.trim()
    ? req.lyrics
    : req.instrumental === false
      ? ''
      : '[inst]'

  return {
    tags: req.prompt,
    lyrics,
    duration: clamp(req.audioDuration ?? 30, DURATION_MIN, DURATION_MAX),
    number_of_steps: Math.round(clamp(req.inferStep ?? 32, STEPS_MIN, STEPS_MAX)),
    guidance_scale: 15,
    seed: typeof req.seed === 'number' ? req.seed : -1,
  }
}

export async function submitReplicateGeneration(req: AceStepRequest): Promise<string> {
  assertConfigured()

  // The public model is text2music only. Fail loudly instead of submitting a
  // stem/edit job that would silently come back as a full mix.
  if (req.taskType && req.taskType !== 'text2music') {
    throw new Error(
      `ACE-Step task "${req.taskType}" is not supported by ${ACE_STEP_MODEL} (text2music only)`,
    )
  }

  const input = buildAceStepInput(req)

  const body = JSON.stringify({ version: MODEL_VERSION, input })

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const res = await fetch(`${REPLICATE_API_BASE}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(20_000),
    })

    if (res.ok) {
      const data = await res.json() as ReplicatePrediction
      return data.id
    }

    const text = await res.text()

    // 429 is a QUEUING instruction, not a failure. Low-credit accounts are
    // throttled to a burst of 1, so firing one request per pack variation gets
    // all but the first rejected. Dropping them silently is what produced packs
    // with a single sample. Waiting is free; the generation slot is not.
    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitMs = parseRetryAfterMs(text, res.headers)
      console.log(
        `[replicate] rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES}`,
      )
      await new Promise(resolve => setTimeout(resolve, waitMs))
      continue
    }

    throw new Error(`Replicate rejected request: ${res.status} ${text}`)
  }

  throw new Error(`Replicate still rate limited after ${MAX_RATE_LIMIT_RETRIES} retries`)
}

export async function pollReplicateJob(predictionId: string): Promise<AceStepJob> {
  assertConfigured()

  const res = await fetch(
    `${REPLICATE_API_BASE}/predictions/${encodeURIComponent(predictionId)}`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Replicate status failed: ${res.status} ${text}`)
  }

  const data = await res.json() as ReplicatePrediction
  const mapped = mapStatus(data.status)

  if (mapped === 'done') {
    const audioUrl = extractAudioUrl(data.output)
    if (!audioUrl) {
      return {
        jobId: predictionId,
        status: 'error',
        error: `Replicate prediction completed but returned no audio URL. Output: ${JSON.stringify(data.output).slice(0, 400)}`,
        generationS: data.metrics?.predict_time,
      }
    }

    // Download audio from Replicate's URL and save locally
    const format = audioUrl.endsWith('.mp3') ? 'mp3' : 'wav'
    const filename = `${predictionId}.${format}`
    const outputPath = path.join(OUTPUT_DIR, filename)

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
      const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) })
      if (!audioRes.ok) {
        return {
          jobId: predictionId,
          status: 'error',
          error: `Failed to download audio from Replicate: ${audioRes.status}`,
          generationS: data.metrics?.predict_time,
        }
      }
      const buffer = Buffer.from(await audioRes.arrayBuffer())
      fs.writeFileSync(outputPath, buffer)
    }

    return {
      jobId: predictionId,
      status: 'done',
      outputPath,
      outputUrl: generatedAudioUrl(filename),
      generationS: data.metrics?.predict_time,
    }
  }

  if (mapped === 'error') {
    return {
      jobId: predictionId,
      status: 'error',
      error: data.error ?? 'Replicate prediction failed',
    }
  }

  return {
    jobId: predictionId,
    status: mapped,
  }
}

export async function isReplicateHealthy(): Promise<boolean> {
  if (!isReplicateConfigured()) return false
  try {
    // Probe the MODEL path. This used to split MODEL_VERSION on ':' — with the
    // variable empty that requested /v1/models/ and reported ACE as down.
    const res = await fetch(`${REPLICATE_API_BASE}/models/${ACE_STEP_MODEL}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function mapStatus(status: ReplicateStatus): AceStepJob['status'] {
  switch (status) {
    case 'starting':   return 'queued'
    case 'processing': return 'running'
    case 'succeeded':  return 'done'
    case 'failed':
    case 'canceled':   return 'error'
    default:           return 'queued'
  }
}

// Shared normaliser: handles the plain URL strings the REST API returns here
// and the FileOutput objects the SDK returns elsewhere, so both paths agree.
function extractAudioUrl(output: unknown): string | undefined {
  return extractReplicateAudioUrl(output)
}

function assertConfigured() {
  if (!isReplicateConfigured()) {
    throw new Error('Replicate is not configured. Set REPLICATE_API_TOKEN.')
  }
  if (!MODEL_VERSION) {
    throw new Error('REPLICATE_MODEL_VERSION resolved empty — it has a built-in default, so this means it was set to an empty string.')
  }
}
