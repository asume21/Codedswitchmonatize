import * as fs from 'fs'
import * as path from 'path'
import type { AceStepJob, AceStepRequest, AceStepTaskType, AceStepTrackName } from './aceStepService'

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
    audio?: string
    audio_url?: string
    output_url?: string
    file_url?: string
    url?: string
    format?: string
    duration_s?: number
    generation_s?: number
    seed?: number
    task_type?: AceStepTaskType
    track_name?: AceStepTrackName
    instrumental?: boolean
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
      instrumental: true,
      seed: req.seed ?? null,
      task_type: req.taskType ?? 'text2music',
      ...(req.trackName && { track_name: req.trackName }),
      ...(req.bpm && { bpm: req.bpm }),
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

    // The worker's "audio" field can be EITHER inline base64 OR a URL. The
    // original code blindly base64-decoded whichever was set — when the
    // worker returns a URL, Buffer.from(url, 'base64') produces garbage bytes
    // that get saved as .wav, and the user plays "completely scrambled" noise.
    // Detect the shape before decoding.
    const audioField = data.output?.audio
    const audioFieldIsUrl = typeof audioField === 'string' && /^https?:\/\//i.test(audioField)
    const audioBase64 = normalizeBase64(
      data.output?.audio_base64 ?? (audioFieldIsUrl ? undefined : audioField)
    )
    const remoteAudioUrl = audioFieldIsUrl ? audioField : getRemoteAudioUrl(data.output)

    if (audioBase64 && !fs.existsSync(outputPath)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
      fs.writeFileSync(outputPath, Buffer.from(audioBase64, 'base64'))
    }

    if (!audioBase64 && !remoteAudioUrl) {
      // Log + surface what the worker actually returned so we can find which
      // field name it's using. Without this, "no audio payload" is a dead end.
      const outputKeys = data.output ? Object.keys(data.output) : []
      const outputPreview: Record<string, string> = {}
      if (data.output) {
        for (const key of outputKeys) {
          const value = (data.output as Record<string, unknown>)[key]
          if (typeof value === 'string') {
            outputPreview[key] = value.length > 80 ? `${value.slice(0, 80)}... (${value.length} chars)` : value
          } else if (value == null) {
            outputPreview[key] = `${value}`
          } else if (typeof value === 'object') {
            outputPreview[key] = `${Array.isArray(value) ? 'array' : 'object'}(${Object.keys(value as object).length})`
          } else {
            outputPreview[key] = String(value)
          }
        }
      }
      console.error('[runpod-serverless] completed job has no recognized audio field. Output keys:', outputPreview)
      return {
        jobId,
        status: 'error',
        error: `Worker completed but returned no audio. Response keys: [${outputKeys.join(', ') || '(none)'}]. Preview: ${JSON.stringify(outputPreview).slice(0, 300)}`,
        generationS: msToSeconds(data.executionTime),
      }
    }

    return {
      jobId,
      status: 'done',
      outputPath: audioBase64 ? outputPath : undefined,
      outputUrl: audioBase64 ? `/api/ai-music/audio/${filename}` : remoteAudioUrl,
      durationS: data.output?.duration_s ?? msToSeconds(data.executionTime),
      generationS: data.output?.generation_s ?? msToSeconds(data.executionTime),
      taskType: data.output?.task_type,
      trackName: data.output?.track_name,
      instrumental: data.output?.instrumental,
    }
  }

  return {
    jobId,
    status: mapped,
    error: data.output?.error ?? data.error,
    generationS: msToSeconds(data.executionTime),
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

function getRemoteAudioUrl(output: RunPodStatusResponse['output']): string | undefined {
  if (!output) return undefined
  const url = output.audio_url ?? output.output_url ?? output.file_url ?? output.url
  if (!url || !/^https?:\/\//i.test(url)) return undefined
  return url
}

function normalizeBase64(value: string | undefined): string | undefined {
  if (!value) return undefined
  const match = value.match(/^data:audio\/[^;]+;base64,(.+)$/)
  return match ? match[1] : value
}

function assertConfigured() {
  if (!isServerlessConfigured()) {
    throw new Error('RunPod serverless is not configured. Set RUNPOD_API_KEY and RUNPOD_SERVERLESS_ENDPOINT_ID.')
  }
}
