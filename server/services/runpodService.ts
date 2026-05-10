/**
 * RunPod pod lifecycle manager
 *
 * Starts the ACE-Step pod on first generation request.
 * Stops it 3 minutes after the last job completes (idle timeout).
 *
 * Required env vars:
 *   RUNPOD_API_KEY  — RunPod API key
 *   RUNPOD_POD_ID   — pod ID (e.g. "twsb0x0ifp7u5r")
 *   ACE_STEP_WORKER_URL — proxy URL for the pod's port 8008
 */

const RUNPOD_API = 'https://api.runpod.io/graphql'
const IDLE_STOP_MS = 3 * 60 * 1000  // 3 minutes
const STARTUP_POLL_MS = 5_000
const STARTUP_TIMEOUT_MS = 120_000  // 2 min max wait for model load

const apiKey  = process.env.RUNPOD_API_KEY  ?? ''
const podId   = process.env.RUNPOD_POD_ID   ?? ''
const workerUrl = (process.env.ACE_STEP_WORKER_URL ?? 'http://127.0.0.1:8008').replace(/\/$/, '')

let idleTimer: ReturnType<typeof setTimeout> | null = null

// ── GraphQL helpers ───────────────────────────────────────────────────────────
async function gql(query: string, variables: Record<string, unknown> = {}) {
  if (!apiKey || !podId) return null
  const res = await fetch(RUNPOD_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`RunPod API ${res.status}`)
  const json = await res.json() as any
  if (json.errors) throw new Error(json.errors[0]?.message ?? 'RunPod GraphQL error')
  return json.data
}

async function getPodStatus(): Promise<string | null> {
  const data = await gql(`
    query Pod($podId: String!) {
      pod(input: { podId: $podId }) { id desiredStatus }
    }
  `, { podId })
  return data?.pod?.desiredStatus ?? null
}

async function startPod(): Promise<void> {
  await gql(`
    mutation ResumePod($podId: String!) {
      podResume(input: { podId: $podId, gpuCount: 1 }) { id desiredStatus }
    }
  `, { podId })
  console.log('[runpod] Pod start requested')
}

async function stopPod(): Promise<void> {
  await gql(`
    mutation StopPod($podId: String!) {
      podStop(input: { podId: $podId }) { id desiredStatus }
    }
  `, { podId })
  console.log('[runpod] Pod stopped (idle timeout)')
}

// ── Worker health check ───────────────────────────────────────────────────────
async function workerReady(): Promise<boolean> {
  try {
    const res = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return false
    const data = await res.json() as { model_loaded?: boolean }
    return data.model_loaded === true
  } catch {
    return false
  }
}

// ── Idle timer ────────────────────────────────────────────────────────────────
function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  if (!apiKey || !podId) return
  idleTimer = setTimeout(async () => {
    idleTimer = null
    try { await stopPod() } catch (e) { console.error('[runpod] idle stop failed:', e) }
  }, IDLE_STOP_MS)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call before submitting a generation job.
 * Starts the pod if stopped, waits until the model is loaded.
 * Resets the idle timer so the pod stays up while in use.
 */
export async function ensureWorkerReady(): Promise<void> {
  // No RunPod config → assume local worker, skip lifecycle
  if (!apiKey || !podId) return

  // Already healthy
  if (await workerReady()) {
    resetIdleTimer()
    return
  }

  const status = await getPodStatus()
  if (status !== 'RUNNING') {
    console.log(`[runpod] Pod is ${status}, starting...`)
    await startPod()
  }

  // Poll until model is loaded
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(STARTUP_POLL_MS)
    if (await workerReady()) {
      console.log('[runpod] Worker ready')
      resetIdleTimer()
      return
    }
  }
  throw new Error('RunPod worker did not become ready within 2 minutes')
}

/**
 * Call after a generation job completes to reset the idle timer.
 */
export function jobCompleted() {
  resetIdleTimer()
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
