import fs from 'fs'
import path from 'path'
import type { AceStepJob, AceStepRequest } from './aceStepService'

const RUNPOD_API_BASE = 'https://api.runpod.ai/v2'
const OUTPUT_DIR = path.resolve(process.cwd(), 'private', 'ace-step', 'output')

const apiKey = process.env.RUNPOD_API_KEY ?? ''
const endpointId = process.env.RUNPOD_SERVERLESS_ENDPOINT_ID ?? ''

type RunPodStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'

interface RunPodRunResponse {
  id: string
  status: RunPodStatus
  error?: string
}

interface RunPodStatusResponse extends RunPodRunResponse {
  output?: {
    audio_base64?: string
    format?: string
    duration_s?: number
    seed?: number
    error?: string
  }
  executionTime?: number
  delayTime?: number
}

export function isServerlessConfigured(): boolean {
  return Boolean(apiKey && endpointId)
}

export function getServerlessEndpointId(): string | null {
  return endpointId || null
}

export async function submitServerlessGeneration(req: AceStepRequest): Promise<string> {
  assertConfigured()

  const body = {
    input: {
      prompt: req.prompt,
      lyrics: req.lyrics ?? '',
      audio_duration: req.audioDuration ?? 30,
      infer_step: req.inferStep ?? 25,
      guidance_scale: 15.0,
      scheduler_type: 'euler',
      cfg_type: 'apg',
      omega_scale: 10.0,
      guidance_interval: 0.5,
      guidance_interval_decay: 0.0,
      min_guidance_scale: 3.0,
      use_erg_tag: true,
      use_erg_lyric: req.lyrics ? true : false,
      use_erg_diffusion: true,
      seed: req.seed ?? null,
    },
  }

  const res = await fetch(`${RUNPOD_API_BASE}/${endpointId}/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RunPod serverless rejected request: ${res.status} ${text}`)
  }

  const data = await res.json() as RunPodRunResponse
  return data.id
}

export async function pollServerlessJob(jobId: string): Promise<AceStepJob> {
  assertConfigured()

  const res = await fetch(`${RUNPOD_API_BASE}/${endpointId}/status/${encodeURIComponent(jobId)}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RunPod serverless status failed: ${res.status} ${text}`)
  }

  const data = await res.json() as RunPodStatusResponse
  const mapped = mapStatus(data.status)

  if (mapped === 'done') {
    const format = data.output?.format === 'mp3' ? 'mp3' : 'wav'
    const filename = `${jobId}.${format}`
    const outputPath = path.join(OUTPUT_DIR, filename)

    if (data.output?.audio_base64 && !fs.existsSync(outputPath)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
      fs.writeFileSync(outputPath, Buffer.from(data.output.audio_base64, 'base64'))
    }

    return {
      jobId,
      status: 'done',
      outputPath,
      outputUrl: `/api/ai-music/audio/${filename}`,
      durationS: data.output?.duration_s ?? msToSeconds(data.executionTime),
    }
  }

  return {
    jobId,
    status: mapped,
    error: data.output?.error ?? data.error,
    durationS: msToSeconds(data.executionTime),
  }
}

export async function isServerlessEndpointHealthy(): Promise<boolean> {
  if (!isServerlessConfigured()) return false
  try {
    const res = await fetch(`${RUNPOD_API_BASE}/${endpointId}/health`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

function mapStatus(status: RunPodStatus): AceStepJob['status'] {
  if (status === 'COMPLETED') return 'done'
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT') return 'error'
  if (status === 'IN_PROGRESS') return 'running'
  return 'queued'
}

function msToSeconds(ms: number | undefined): number | undefined {
  return typeof ms === 'number' ? Math.round(ms / 10) / 100 : undefined
}

function assertConfigured() {
  if (!isServerlessConfigured()) {
    throw new Error('RunPod serverless is not configured. Set RUNPOD_API_KEY and RUNPOD_SERVERLESS_ENDPOINT_ID.')
  }
}
