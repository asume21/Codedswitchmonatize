/**
 * ACE-Step Service
 *
 * Talks to ACE-Step through one of two backends:
 *   1. RunPod Serverless when RUNPOD_SERVERLESS_ENDPOINT_ID is set.
 *   2. A persistent FastAPI worker at ACE_STEP_WORKER_URL for local/dev fallback.
 *
 * Flow:
 *   1. POST /generate → returns { job_id }
 *   2. Poll GET /job/:id until status === "done" | "error"
 *   3. Audio is saved locally; URL returned to client via /api/ai-music/audio/:file
 */

const WORKER_URL = (process.env.ACE_STEP_WORKER_URL || 'http://127.0.0.1:8008').replace(/\/$/, '')
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS  = 600_000  // 10 min max wait for longer renders

export type AceStepTaskType = 'text2music' | 'lego' | 'extract' | 'complete'

export type AceStepTrackName =
  | 'vocals' | 'backing_vocals' | 'drums' | 'bass' | 'guitar'
  | 'keyboard' | 'percussion' | 'strings' | 'synth' | 'fx' | 'brass' | 'woodwinds'

export interface AceStepRequest {
  prompt: string        // comma-separated tags: "trap, hip-hop, 808, dark, minor"
  lyrics?: string       // optional [verse]/[chorus] formatted lyrics
  audioDuration?: number // seconds (default 30)
  inferStep?: number    // 20=fast, 40=good, 60=best (default 25)
  seed?: number
  taskType?: AceStepTaskType   // default: text2music
  trackName?: AceStepTrackName // required for lego task
  bpm?: number                 // optional tempo hint
  instrumental?: boolean       // force instrumental mode
}

export interface AceStepJob {
  jobId: string
  status: 'queued' | 'running' | 'done' | 'error'
  outputPath?: string
  outputUrl?: string
  error?: string
  durationS?: number
  generationS?: number
  taskType?: AceStepTaskType
  trackName?: AceStepTrackName
  instrumental?: boolean
}

export async function isWorkerReady(): Promise<boolean> {
  const { isServerlessConfigured, isServerlessEndpointHealthy } = await import('./runpodServerlessService')
  if (isServerlessConfigured()) return isServerlessEndpointHealthy()

  try {
    const res = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return false
    const data = await res.json() as { model_loaded?: boolean }
    return data.model_loaded === true
  } catch {
    return false
  }
}

export async function submitGeneration(req: AceStepRequest): Promise<string> {
  const { isServerlessConfigured, submitServerlessGeneration } = await import('./runpodServerlessService')
  if (isServerlessConfigured()) return submitServerlessGeneration(req)

  const body = {
    prompt:           req.prompt,
    lyrics:           req.lyrics ?? '',
    audio_duration:   req.audioDuration ?? 30,
    infer_step:       req.inferStep ?? 25,
    guidance_scale:   15.0,
    scheduler_type:   'euler',
    cfg_type:         'apg',
    omega_scale:      10.0,
    guidance_interval:       0.5,
    guidance_interval_decay: 0.0,
    min_guidance_scale:      3.0,
    use_erg_tag:      true,
    use_erg_lyric:    req.lyrics ? true : false,
    use_erg_diffusion: true,
    instrumental:     req.instrumental ?? true,
    seed:             req.seed ?? null,
  }

  const res = await fetch(`${WORKER_URL}/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ACE-Step worker rejected request: ${res.status} ${text}`)
  }

  const data = await res.json() as { job_id: string }
  return data.job_id
}

export async function pollJob(jobId: string): Promise<AceStepJob> {
  const { isServerlessConfigured, pollServerlessJob } = await import('./runpodServerlessService')
  if (isServerlessConfigured()) return pollServerlessJob(jobId)

  const res = await fetch(`${WORKER_URL}/job/${jobId}`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`Job poll failed: ${res.status}`)
  const data = await res.json() as {
    job_id: string; status: string; output_path?: string
    output_url?: string; error?: string; duration_s?: number
  }
  return {
    jobId:      data.job_id,
    status:     data.status as AceStepJob['status'],
    outputPath: data.output_path,
    outputUrl:  data.output_url,
    error:      data.error,
    durationS:  data.duration_s,
    generationS: data.duration_s,
  }
}

/** Submit and wait — supports RunPod Serverless or legacy pod/local worker. */
export async function generateAndWait(req: AceStepRequest): Promise<AceStepJob> {
  const { isServerlessConfigured } = await import('./runpodServerlessService')
  const { ensureWorkerReady, jobCompleted } = await import('./runpodService')
  if (!isServerlessConfigured()) await ensureWorkerReady()

  const jobId = await submitGeneration(req)
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const job = await pollJob(jobId)
    if (job.status === 'done')  { if (!isServerlessConfigured()) jobCompleted(); return job }
    if (job.status === 'error') { if (!isServerlessConfigured()) jobCompleted(); throw new Error(`ACE-Step generation failed: ${job.error}`) }
  }

  throw new Error(`ACE-Step job ${jobId} timed out after ${POLL_TIMEOUT_MS / 1000}s`)
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
