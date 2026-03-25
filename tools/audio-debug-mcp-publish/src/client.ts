/**
 * HTTP client for communicating with the Express audio-debug bridge.
 * Handles commands, polling for captures, and retrieval.
 */

const BASE = process.env.AUDIO_DEBUG_BASE_URL ?? 'http://localhost:4000'

function log(msg: string) {
  process.stderr.write(`[audio-debug-mcp] ${msg}\n`)
}

export async function triggerCapture(durationMs: number): Promise<string> {
  const res = await fetch(`${BASE}/api/audio-debug/command`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ duration_ms: durationMs }),
  })

  if (!res.ok) throw new Error(`Command endpoint returned ${res.status}`)

  const body = await res.json() as { captureId: string; queued: boolean }
  log(`Capture command sent — id: ${body.captureId}, queued: ${body.queued}`)
  return body.captureId
}

export async function waitForCapture(
  captureId: string,
  timeoutMs = 20_000,
  pollIntervalMs = 300,
): Promise<Buffer> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/api/audio-debug/capture/${captureId}`)

    if (res.status === 404) {
      await sleep(pollIntervalMs)
      continue
    }

    if (!res.ok) throw new Error(`Capture retrieval returned ${res.status}`)

    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }

  throw new Error(`Timed out waiting for capture ${captureId} after ${timeoutMs}ms. Is the app open in a browser tab?`)
}

export async function listCaptures(): Promise<Array<{
  id: string; durationMs: number; bytes: number; createdAt: string
}>> {
  const res = await fetch(`${BASE}/api/audio-debug/captures`)
  if (!res.ok) throw new Error(`List captures returned ${res.status}`)
  return res.json()
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
