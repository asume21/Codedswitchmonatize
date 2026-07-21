/**
 * Replicate Service — drop-in replacement for RunPod Serverless.
 *
 * Runs YOUR ACE-Step model deployed to Replicate via Cog. Same submit →
 * poll → download flow, zero idle cost, pay-per-inference pricing.
 *
 * Prerequisites:
 *   1. Package ACE-Step as a Cog model (see /cog/ directory)
 *   2. Push to Replicate: cog push r8.im/your-username/ace-step
 *   3. Set REPLICATE_MODEL_VERSION to the resulting version hash
 *
 * Config:
 *   REPLICATE_API_TOKEN      — your Replicate API key
 *   REPLICATE_MODEL_VERSION  — your ACE-Step Cog model (username/model:hash)
 *   ACE_STEP_OUTPUT_DIR      — where to save downloaded audio (same as RunPod)
 */

import * as fs from 'fs'
import * as path from 'path'
import type { AceStepJob, AceStepRequest } from './aceStepService'

const REPLICATE_API_BASE = 'https://api.replicate.com/v1'

const MODEL_VERSION = process.env.REPLICATE_MODEL_VERSION || ''

const OUTPUT_DIR = process.env.ACE_STEP_OUTPUT_DIR
  ? path.resolve(process.env.ACE_STEP_OUTPUT_DIR)
  : path.resolve(process.cwd(), 'private', 'ace-step', 'output')

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

export async function submitReplicateGeneration(req: AceStepRequest): Promise<string> {
  assertConfigured()

  // Pass ACE-Step parameters — matches Cog predictor's Input definitions
  const input: Record<string, unknown> = {
    prompt: req.prompt,
    lyrics: req.lyrics ?? '',
    audio_duration: req.audioDuration ?? 30,
    infer_step: req.inferStep ?? 32,
    guidance_scale: 7.0,
    seed: req.seed ?? null,
    task_type: req.taskType ?? 'text2music',
    ...(req.trackName && { track_name: req.trackName }),
    ...(req.bpm && { bpm: req.bpm }),
  }

  const res = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: MODEL_VERSION,
      input,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Replicate rejected request: ${res.status} ${text}`)
  }

  const data = await res.json() as ReplicatePrediction
  return data.id
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
      outputUrl: `/api/ai-music/audio/${filename}`,
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
    const res = await fetch(`${REPLICATE_API_BASE}/models/${MODEL_VERSION.split(':')[0]}`, {
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

function extractAudioUrl(output: unknown): string | undefined {
  if (!output) return undefined

  // MusicGen returns a string URL directly
  if (typeof output === 'string' && /^https?:\/\//i.test(output)) {
    return output
  }

  // Some models return { audio: "url" } or { audio: ["url"] }
  if (Array.isArray(output)) {
    const first = output[0]
    if (typeof first === 'string' && /^https?:\/\//i.test(first)) return first
  }

  if (typeof output === 'object') {
    const record = output as Record<string, unknown>
    for (const key of ['audio', 'audio_url', 'url', 'output', 'file']) {
      const val = record[key]
      if (typeof val === 'string' && /^https?:\/\//i.test(val)) return val
      if (Array.isArray(val)) {
        const first = val[0]
        if (typeof first === 'string' && /^https?:\/\//i.test(first)) return first
      }
    }
  }

  return undefined
}

function assertConfigured() {
  if (!isReplicateConfigured()) {
    throw new Error('Replicate is not configured. Set REPLICATE_API_TOKEN and REPLICATE_MODEL_VERSION.')
  }
  if (!MODEL_VERSION) {
    throw new Error('REPLICATE_MODEL_VERSION is required. Deploy ACE-Step to Replicate via Cog, then set the model version hash.')
  }
}
