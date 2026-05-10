/**
 * WebEar browser bridge — taps Tone.js audio and relays to the cloud relay.
 *
 * Listens for capture commands from the webear relay via SSE,
 * records audio using MediaRecorder, and posts the blob back.
 *
 * Works in dev and production.
 */

import * as Tone from 'tone'

declare global {
  interface Window {
    __audioDebug?: {
      startCapture: (durationMs?: number) => Promise<string>
      getLastCaptureId: () => string | null
      status: () => 'connected' | 'disconnected' | 'capturing'
      webearStatus: () => WebEarBridgeStatus
    }
    __webearStatus?: WebEarBridgeStatus
  }
}

const BLOB_URL = (id: string) => `/api/webear/blob/${id}`

type WebEarBridgeState = 'initializing' | 'connected' | 'disconnected' | 'no-auth' | 'no-key' | 'error'

interface WebEarBridgeStatus {
  state: WebEarBridgeState
  message: string
  updatedAt: number
}

let tapNode:        MediaStreamAudioDestinationNode | null = null
let tapContext:     AudioContext | null = null  // track which context the tap belongs to
let tapSource:      { disconnect: (node?: AudioNode) => unknown } | null = null
let organismSource: {
  connect: (destination: Tone.InputNode) => void
  disconnect: (destination: Tone.InputNode) => void
} | null = null
let recorder:       MediaRecorder | null = null
let sseSource:      EventSource   | null = null
let localSseSource: EventSource   | null = null
let isCapturing   = false
let isConnected   = false
let lastCaptureId: string | null = null
let resolvedApiKey: string | null = null
let reconnectTimer: number | null = null
let reconnectDelayMs = 3000
let isResolvingKey = false
let status: WebEarBridgeStatus = {
  state: 'initializing',
  message: 'WebEar bridge starting',
  updatedAt: Date.now(),
}

function log(msg: string) {
  console.debug(`[webear-bridge] ${msg}`)
}

function setWebEarStatus(state: WebEarBridgeState, message: string) {
  status = { state, message, updatedAt: Date.now() }
  window.__webearStatus = status
  window.dispatchEvent(new CustomEvent('webear:status', { detail: status }))
}

export function registerOrganismAudioDebugSource(source: {
  connect: (destination: Tone.InputNode) => void
  disconnect: (destination: Tone.InputNode) => void
}): () => void {
  organismSource = source
  if (tapNode) {
    try {
      source.connect(tapNode as unknown as Tone.InputNode)
      tapSource = {
        disconnect: () => source.disconnect(tapNode as unknown as Tone.InputNode),
      }
      log('Registered live Organism generator tap ✓')
    } catch (e) {
      log(`Could not attach live Organism generator tap: ${e}`)
    }
  }

  return () => {
    if (organismSource !== source) return
    if (tapNode) {
      try { source.disconnect(tapNode as unknown as Tone.InputNode) } catch { /* ignore */ }
    }
    organismSource = null
    tapSource = null
    // Null tapNode so the next Organism session builds a fresh tap rather than
    // reusing a stale node that has nothing connected to it.
    tapNode = null
    tapContext = null
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken')
  if (!token) return {}
  return { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` }
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: T | null }> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...getAuthHeaders(),
      ...(init.headers ?? {}),
    },
  })

  const body = await res.json().catch(() => null) as T | null
  return { ok: res.ok, status: res.status, body }
}

async function resolveWebEarApiKey(): Promise<string | null> {
  if (resolvedApiKey?.startsWith('wbr_')) return resolvedApiKey
  if (isResolvingKey) return null

  isResolvingKey = true
  try {
    const envKey = import.meta.env.VITE_WEBEAR_API_KEY as string | undefined
    if (envKey?.startsWith('wbr_')) {
      resolvedApiKey = envKey
      return resolvedApiKey
    }

    const revealed = await fetchJson<{ key?: string }>('/api/webear-keys/reveal')
    if (revealed.ok && revealed.body?.key?.startsWith('wbr_')) {
      resolvedApiKey = revealed.body.key
      return resolvedApiKey
    }

    if (revealed.status === 401) {
      setWebEarStatus('no-auth', 'Log in before WebEar can connect')
      return null
    }

    if (revealed.status !== 404) {
      setWebEarStatus('error', `Could not reveal WebEar key (${revealed.status})`)
      return null
    }

    const generated = await fetchJson<{ key?: string }>('/api/webear-keys/generate', { method: 'POST' })
    if (generated.ok && generated.body?.key?.startsWith('wbr_')) {
      resolvedApiKey = generated.body.key
      log('Generated WebEar key for browser relay')
      return resolvedApiKey
    }

    setWebEarStatus(generated.status === 401 ? 'no-auth' : 'no-key', `Could not generate WebEar key (${generated.status})`)
    return null
  } catch (e) {
    setWebEarStatus('error', `WebEar key lookup failed: ${e instanceof Error ? e.message : String(e)}`)
    return null
  } finally {
    isResolvingKey = false
  }
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connectSSE()
  }, reconnectDelayMs)
  reconnectDelayMs = Math.min(reconnectDelayMs * 1.5, 30000)
}

async function ensureTap(): Promise<MediaStreamAudioDestinationNode | null> {
  try {
    const ctx  = Tone.getContext().rawContext as AudioContext
    const dest = Tone.getDestination() as any

    // If context changed (Tone.start() creates a new one), invalidate cached tap
    if (tapNode && tapContext !== ctx) {
      log('AudioContext changed — rebuilding tap')
      try { tapSource?.disconnect(tapNode) } catch { /* ignore */ }
      tapNode = null
      tapContext = null
      tapSource = null
    }

    if (tapNode) return tapNode

    // Resume suspended context (requires prior user gesture)
    if (ctx.state === 'suspended') {
      log(`AudioContext is suspended — attempting resume...`)
      await ctx.resume()
      // Re-read state after async resume (TS narrows to 'suspended' in this branch)
      const stateAfter = ctx.state as AudioContextState
      if (stateAfter !== 'running') {
        log(`AudioContext still ${stateAfter} after resume — needs user gesture first`)
        return null
      }
      log('AudioContext resumed ✓')
    }

    const gainNode: AudioNode | null =
      dest?.output?._gainNode      ||  // Destination.output is Gain; _gainNode is native (Tone 15)
      dest?.input?.input?._gainNode ||  // Destination.input is Volume; .input is Gain; _gainNode is native
      dest?.input?._gainNode        ||  // fallback
      null

    if (!gainNode || gainNode === ctx.destination) {
      log(`Could not locate Tone.js gain node — dest.output: ${dest?.output?.constructor?.name}, dest.input: ${dest?.input?.constructor?.name}`)
      return null
    }

    tapNode = ctx.createMediaStreamDestination()
    tapContext = ctx

    if (organismSource) {
      organismSource.connect(tapNode as unknown as Tone.InputNode)
      tapSource = {
        disconnect: () => organismSource?.disconnect(tapNode as unknown as Tone.InputNode),
      }
      log(`Tapped live Organism generator buses ✓ (ctx.state=${ctx.state}, sampleRate=${ctx.sampleRate})`)
      return tapNode
    }

    try {
      dest.connect(tapNode)
      tapSource = dest
      log(`Tapped Tone.js destination ✓ (ctx.state=${ctx.state}, sampleRate=${ctx.sampleRate})`)
      return tapNode
    } catch (e) {
      log(`Tone destination tap failed, trying internal gain node: ${e}`)
    }

    gainNode.connect(tapNode)
    tapSource = gainNode
    log(`Tapped Tone.js master gain fallback ✓ (ctx.state=${ctx.state}, sampleRate=${ctx.sampleRate})`)
  } catch (e) {
    log(`ensureTap error: ${e}`)
    return null
  }

  return tapNode
}

async function doCapture(captureId: string, durationMs: number): Promise<void> {
  if (isCapturing) { log(`Skipping ${captureId} — already capturing`); return }

  isCapturing   = true
  lastCaptureId = captureId

  const tap = await ensureTap()
  if (!tap) {
    log(`Aborting capture ${captureId} — Tone.js not yet initialized or context suspended`)
    isCapturing = false
    return
  }
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'

  const chunks: Blob[] = []
  recorder = new MediaRecorder(tap.stream, { mimeType })

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  log(`Capturing ${durationMs}ms (id: ${captureId})`)

  await new Promise<void>((resolve) => {
    recorder!.onstop = () => resolve()
    recorder!.start(200)
    setTimeout(() => { if (recorder?.state === 'recording') recorder.stop() }, durationMs)
  })

  const blob   = new Blob(chunks, { type: mimeType })
  const buffer = await blob.arrayBuffer()

  if (blob.size === 0) {
    log(`WARNING: Captured 0 bytes — tap stream may be silent (ctx.state=${(Tone.getContext().rawContext as AudioContext).state})`)
  }

  log(`Uploading ${blob.size} bytes (${chunks.length} chunks)...`)

  await fetch(BLOB_URL(captureId), {
    method:  'POST',
    headers: { 'Content-Type': 'audio/webm' },
    body:    buffer,
  })

  log(`Delivered — capture_id: ${captureId}`)
  isCapturing = false
}

async function connectSSE() {
  if (sseSource) return

  const apiKey = await resolveWebEarApiKey()
  if (!apiKey) {
    if (status.state !== 'no-auth') scheduleReconnect()
    return
  }

  setWebEarStatus('initializing', 'Connecting WebEar audio relay')
  sseSource = new EventSource(`/api/webear/connect?key=${encodeURIComponent(apiKey)}`)

  sseSource.addEventListener('connected', () => {
    isConnected = true
    reconnectDelayMs = 3000
    setWebEarStatus('connected', 'WebEar is connected to this browser audio output')
    log('Connected to webear relay ✓')
  })

  sseSource.addEventListener('capture', (e: MessageEvent) => {
    const { captureId, durationMs } = JSON.parse(e.data)
    doCapture(captureId, durationMs ?? 3000)
  })

  sseSource.onerror = () => {
    isConnected = false
    setWebEarStatus('disconnected', 'WebEar relay disconnected; reconnecting')
    sseSource?.close()
    sseSource = null
    scheduleReconnect()
  }
}

// Local audio-debug SSE — used by the local audio-debug-mcp (dev only)
function connectLocalSSE() {
  if (localSseSource) return

  localSseSource = new EventSource('/api/audio-debug/events')

  localSseSource.onopen = () => {
    void drainPendingLocalCommands()
  }

  localSseSource.addEventListener('capture', (e: MessageEvent) => {
    const { captureId, durationMs } = JSON.parse(e.data)
    // Upload to local endpoint instead of WebEar blob endpoint
    doLocalCapture(captureId, durationMs ?? 3000)
  })

  localSseSource.onerror = () => {
    localSseSource?.close()
    localSseSource = null
    setTimeout(connectLocalSSE, 3000)
  }
}

async function drainPendingLocalCommands(): Promise<void> {
  try {
    const res = await fetch('/api/audio-debug/pending-commands')
    if (!res.ok) {
      log(`Could not drain local audio-debug commands (${res.status})`)
      return
    }

    const commands = await res.json() as Array<{
      type: string
      captureId: string
      durationMs: number
      queuedAt?: string
    }>

    const cutoff = Date.now() - 10_000
    for (const command of commands) {
      if (command.queuedAt && Date.parse(command.queuedAt) < cutoff) {
        log(`Skipping stale local audio-debug capture ${command.captureId}`)
        continue
      }
      if (command.type === 'capture') {
        await doLocalCapture(command.captureId, command.durationMs ?? 3000)
      }
    }
  } catch (e) {
    log(`Could not drain local audio-debug commands: ${e}`)
  }
}

async function doLocalCapture(captureId: string, durationMs: number): Promise<void> {
  if (isCapturing) { log(`Skipping local ${captureId} — already capturing`); return }

  isCapturing   = true
  lastCaptureId = captureId

  const tap = await ensureTap()
  if (!tap) {
    log(`Aborting local capture ${captureId} — Tone.js not yet initialized`)
    isCapturing = false
    return
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'

  const chunks: Blob[] = []
  const localRecorder = new MediaRecorder(tap.stream, { mimeType })

  localRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  await new Promise<void>((resolve) => {
    localRecorder.onstop = () => resolve()
    localRecorder.start(200)
    setTimeout(() => { if (localRecorder.state === 'recording') localRecorder.stop() }, durationMs)
  })

  const blob = new Blob(chunks, { type: mimeType })

  const form = new FormData()
  form.append('audio', blob, 'capture.webm')
  form.append('captureId', captureId)
  form.append('durationMs', String(durationMs))

  await fetch('/api/audio-debug/capture', { method: 'POST', body: form })
  log(`Local capture delivered — id: ${captureId}, bytes: ${blob.size}`)
  isCapturing = false
}

export function disposeAudioDebugBridge(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  sseSource?.close()
  sseSource = null
  localSseSource?.close()
  localSseSource = null
  isConnected = false
  if (recorder?.state === 'recording') recorder.stop()
}

export function initAudioDebugBridge(): void {
  connectSSE()
  connectLocalSSE()

  window.addEventListener('beforeunload', disposeAudioDebugBridge, { once: true })

  if (import.meta.hot) {
    import.meta.hot.dispose(disposeAudioDebugBridge)
  }

  window.__audioDebug = {
    startCapture: async (durationMs = 3000) => {
      const captureId = crypto.randomUUID()
      await doCapture(captureId, durationMs)
      return captureId
    },
    getLastCaptureId: () => lastCaptureId,
    status: () => isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected',
    webearStatus: () => status,
  }

  log('Bridge ready. window.__audioDebug available.')
}
