import * as fs from 'fs'
import * as path from 'path'
import type { AceStepJob, AceStepRequest, AceStepTaskType, AceStepTrackName } from './aceStepService'

const RUNPOD_API_BASE = 'https://api.runpod.ai/v2'
const OUTPUT_DIR = path.resolve(process.cwd(), 'private', 'ace-step', 'output')

const apiKey = process.env.RUNPOD_API_KEY ?? ''
const endpointId = process.env.RUNPOD_SERVERLESS_ENDPOINT_ID ?? ''

// Worker process sometimes dies mid-generation (OOM kill on cold cold-starts),
// leaving us with status=COMPLETED and output=null. We can't fix the worker
// from here, but we can transparently re-submit once before the user sees
// failure. Map keyed by the jobId we originally returned to the caller.
const MAX_SILENT_FAILURE_RETRIES = 1
interface JobMeta {
  req: AceStepRequest
  currentRunpodJobId: string
  retriesUsed: number
}
const jobMeta = new Map<string, JobMeta>()

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
  const jobId = await submitRunpodJob(req)
  jobMeta.set(jobId, { req, currentRunpodJobId: jobId, retriesUsed: 0 })
  return jobId
}

// Pure HTTP submit — no cache side effect. Used both for initial submission
// and for silent-failure retries from pollServerlessJob.
async function submitRunpodJob(req: AceStepRequest): Promise<string> {
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

  // If we've silently re-submitted this job (worker died on the first run),
  // poll the new RunPod jobId. The caller still sees the original jobId.
  const meta = jobMeta.get(jobId)
  const runpodJobId = meta?.currentRunpodJobId ?? jobId

  const res = await fetch(`${RUNPOD_API_BASE}/${endpointId}/status/${encodeURIComponent(runpodJobId)}`, {
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

  // Read as text first so empty/no-audio errors can surface the raw body —
  // makes "Response keys: [(none)]" failures self-diagnosing.
  const rawText = await res.text()
  let data: RunPodStatusResponse
  try {
    data = JSON.parse(rawText) as RunPodStatusResponse
  } catch {
    throw new Error(`RunPod serverless returned non-JSON for job ${runpodJobId} (first 400 chars): ${rawText.slice(0, 400)}`)
  }
  const mapped = mapStatus(data.status)

  if (mapped === 'done') {
    const format = (data.output as any)?.format === 'mp3' ? 'mp3' : 'wav'
    const filename = `${jobId}.${format}`
    const outputPath = path.join(OUTPUT_DIR, filename)

    // RunPod-template authors use a zoo of field names. Cast a wide net so
    // we don't need a new code change per worker template. resolveAudio()
    // returns either inline base64 or a remote URL — whichever the worker
    // chose to use.
    const { audioBase64, remoteAudioUrl } = resolveAudio(data.output)

    if (audioBase64 && !fs.existsSync(outputPath)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
      fs.writeFileSync(outputPath, Buffer.from(audioBase64, 'base64'))
    }

    if (!audioBase64 && !remoteAudioUrl) {
      // Silent worker death: status=COMPLETED but no audio. Most often this
      // is a SIGKILL during cold-start model load. Re-submit once before
      // surfacing failure — usually a warm worker handles the second attempt.
      if (meta && meta.retriesUsed < MAX_SILENT_FAILURE_RETRIES) {
        const newRunpodJobId = await submitRunpodJob(meta.req)
        meta.currentRunpodJobId = newRunpodJobId
        meta.retriesUsed += 1
        console.warn(
          `[runpod-serverless] silent failure on ${runpodJobId} ` +
          `(execTime: ${data.executionTime ?? '?'}ms); resubmitted as ${newRunpodJobId} ` +
          `(retry ${meta.retriesUsed}/${MAX_SILENT_FAILURE_RETRIES})`
        )
        return {
          jobId,
          status: 'running',
          generationS: msToSeconds(data.executionTime),
        }
      }

      // No more retries — surface the failure with the raw body for forensics.
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
      console.error('[runpod-serverless] silent failure persisted after retries', {
        jobId, runpodJobId, retriesUsed: meta?.retriesUsed ?? 0,
        outputPreview, rawResponse: rawText.slice(0, 2000),
      })
      jobMeta.delete(jobId)
      return {
        jobId,
        status: 'error',
        error: `Worker completed but returned no audio after ${(meta?.retriesUsed ?? 0) + 1} attempt(s). Response keys: [${outputKeys.join(', ') || '(none)'}]. Preview: ${JSON.stringify(outputPreview).slice(0, 200)}. Raw body (first 400 chars): ${rawText.slice(0, 400)}`,
        generationS: msToSeconds(data.executionTime),
      }
    }

    jobMeta.delete(jobId)
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

  if (mapped === 'error') {
    jobMeta.delete(jobId)
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

// Common field names worker templates use for audio. Order doesn't matter
// for correctness — a URL-looking value goes to remoteAudioUrl, otherwise
// it's treated as base64.
const AUDIO_FIELD_CANDIDATES = [
  'audio_base64', 'audio', 'audio_data', 'audioData', 'audioBase64',
  'b64', 'b64_audio', 'wav_base64', 'mp3_base64', 'data',
  'audio_url', 'audioUrl', 'output_url', 'outputUrl',
  'file_url', 'fileUrl', 'download_url', 'downloadUrl',
  'url', 'audio_file', 'audioFile', 'result',
] as const

function pickAudio(obj: unknown): { audioBase64?: string; remoteAudioUrl?: string } {
  if (!obj || typeof obj !== 'object') return {}
  const record = obj as Record<string, unknown>

  for (const key of AUDIO_FIELD_CANDIDATES) {
    const value = record[key]
    if (typeof value !== 'string' || value.length === 0) continue

    if (/^https?:\/\//i.test(value)) {
      return { remoteAudioUrl: value }
    }
    // Skip values that are too short to be audio (likely status flags)
    if (value.length < 32) continue
    const normalized = normalizeBase64(value)
    if (normalized) return { audioBase64: normalized }
  }
  return {}
}

// Resolve audio from common worker response shapes, including a few nested
// containers we've seen (output.result, output.data, output.output).
function resolveAudio(output: unknown): { audioBase64?: string; remoteAudioUrl?: string } {
  const top = pickAudio(output)
  if (top.audioBase64 || top.remoteAudioUrl) return top

  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>
    for (const container of ['result', 'data', 'output', 'payload']) {
      const nested = pickAudio(record[container])
      if (nested.audioBase64 || nested.remoteAudioUrl) return nested
    }
  }

  return {}
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
