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
const AUTH_CHANGE_EVENT = 'codedswitch:auth-changed'

type WebEarBridgeState = 'initializing' | 'connected' | 'disconnected' | 'no-auth' | 'no-key' | 'error'

interface WebEarBridgeStatus {
  state: WebEarBridgeState
  message: string
  updatedAt: number
}

let tapNode:        MediaStreamAudioDestinationNode | null = null
let tapContext:     AudioContext | null = null  // track which context the tap belongs to
let tapSource:      { disconnect: (node?: AudioNode) => unknown } | null = null
interface AudioDebugTapSource {
  connect: (destination: Tone.InputNode) => void
  disconnect: (destination: Tone.InputNode) => void
}
// Any number of playback sources (Organism, Recording Booth beats, etc.) can
// feed the tap at once — a Set so registering one never evicts another.
const registeredSources = new Set<AudioDebugTapSource>()
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

/**
 * Register a playback source (Organism master, Recording Booth beat, etc.)
 * so WebEar's capture tap actually hears it. Measured live 2026-06-12 (Tone
 * 15.1.22): the Tone.getDestination() internal gain nodes that ensureTap()
 * guesses at carry NO signal even while audio is audible, so anything that
 * only routes to Tone's destination or a raw AudioContext.destination
 * records as pure silence — explicit registration is the only live path.
 * Returns an unregister function; call it when the source stops/unmounts.
 */
export function registerAudioDebugSource(source: AudioDebugTapSource): () => void {
  registeredSources.add(source)
  if (tapNode) {
    try {
      source.connect(tapNode)
      log('Audio-debug source connected to capture tap ✓')
    } catch (e) {
      log(`Could not connect audio-debug source to tap: ${e}`)
    }
  }

  return () => {
    registeredSources.delete(source)
    if (tapNode) {
      try { source.disconnect(tapNode) } catch { /* not connected */ }
    }
  }
}

/**
 * Connect every currently-registered source to a freshly (re)built tap node.
 * Only called right after a new tapNode is created, so none of these sources
 * can already be connected to it — safe against the "false +6 dB double-tap"
 * bug a double-registration caused previously.
 */
function connectAllRegisteredSources(): void {
  if (!tapNode) return
  for (const source of registeredSources) {
    try {
      source.connect(tapNode)
    } catch (e) {
      log(`Could not connect audio-debug source to tap: ${e}`)
    }
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

// Give up after this many consecutive failures. A 401 means the key is INVALID —
// retrying it can never succeed, and the old loop retried forever. Each cycle
// also cleared resolvedApiKey, so every attempt fired a SECOND request to
// re-resolve the key. The result was a request storm against /api/webear/connect
// that hammered the main thread and starved the audio scheduler — heard as
// crackling and dropouts. A dead relay must fail quietly; it is a debug tool and
// must never cost the user their audio.
const MAX_RECONNECT_ATTEMPTS = 5
let consecutiveFailures = 0

function scheduleReconnect() {
  if (reconnectTimer !== null) return

  if (consecutiveFailures >= MAX_RECONNECT_ATTEMPTS) {
    if (status.state !== 'no-auth') {
      setWebEarStatus('no-auth', 'WebEar relay unavailable (bad or missing API key) — bridge stopped')
      log(`Giving up after ${consecutiveFailures} failed attempts. Call window.__audioDebug.reconnect() to retry.`)
    }
    return
  }
  consecutiveFailures++

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    void connectSSE()
  }, reconnectDelayMs)
  reconnectDelayMs = Math.min(reconnectDelayMs * 1.5, 30000)
}

function requestReconnect(reason: string): void {
  log(`Reconnect requested: ${reason}`)
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (sseSource) {
    sseSource.close()
    sseSource = null
  }
  isConnected = false
  resolvedApiKey = null
  reconnectDelayMs = 1000
  consecutiveFailures = 0   // an EXPLICIT reconnect is the user asking again — grant a fresh budget
  void connectSSE()
}

async function ensureTap(): Promise<MediaStreamAudioDestinationNode | null> {
  try {
    const ctx  = Tone.getContext().rawContext as AudioContext
    const dest = Tone.getDestination() as any

    // If context changed (Tone.start() creates a new one), invalidate cached tap.
    // Registered sources stay registered — they'll be reconnected to the fresh
    // tapNode below once it's rebuilt.
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

    // Always tap via the native gain node — this is the most reliable global path
    // because it uses raw Web Audio connect() rather than Tone.js wrapping.
    gainNode.connect(tapNode)
    tapSource = gainNode
    log(`Tapped Tone.js master gain ✓ (ctx.state=${ctx.state}, sampleRate=${ctx.sampleRate})`)

    // The destination gain above carries no signal in Tone 15.1.22 (verified
    // live) — explicitly-registered sources are the real capture source.
    connectAllRegisteredSources()
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

  const uploadRes = await fetch(BLOB_URL(captureId), {
    method:  'POST',
    headers: { 'Content-Type': 'audio/webm' },
    body:    buffer,
  })
  if (!uploadRes.ok) {
    isCapturing = false
    throw new Error(`WebEar blob upload failed (${uploadRes.status})`)
  }

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
    consecutiveFailures = 0   // a real connection clears the give-up budget
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
    resolvedApiKey = null
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

  const uploadRes = await fetch('/api/audio-debug/capture', { method: 'POST', body: form })
  if (!uploadRes.ok) {
    isCapturing = false
    throw new Error(`Local audio-debug upload failed (${uploadRes.status})`)
  }
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
  window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener)
  window.removeEventListener('focus', handleVisibilityReconnect)
  window.removeEventListener('visibilitychange', handleVisibilityReconnect)
  window.removeEventListener('storage', handleStorageAuthChange)
}

function handleAuthChange(): void {
  requestReconnect('auth changed')
}

function handleVisibilityReconnect(): void {
  if (document.visibilityState !== 'hidden' && (status.state === 'no-auth' || status.state === 'disconnected' || status.state === 'error')) {
    requestReconnect('page focus/visibility')
  }
}

function handleStorageAuthChange(e: StorageEvent): void {
  if (e.key === 'authToken' || e.key === 'authUserId' || e.key === null) {
    requestReconnect(`storage changed: ${e.key ?? 'all'}`)
  }
}

export function initAudioDebugBridge(): void {
  connectSSE()
  // The local audio-debug SSE talks to /api/audio-debug/events, which the
  // server only mounts when NODE_ENV !== 'production'. In prod the path
  // falls through to the SPA index.html → EventSource sees text/html and
  // auto-reconnects every 3s, hammering the rate limiter. Gate strictly to
  // dev so prod never opens the connection.
  if (import.meta.env.DEV) connectLocalSSE()

  window.addEventListener('beforeunload', disposeAudioDebugBridge, { once: true })

  if (import.meta.hot) {
    import.meta.hot.dispose(disposeAudioDebugBridge)
  }

  window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener)
  window.addEventListener('focus', handleVisibilityReconnect)
  window.addEventListener('visibilitychange', handleVisibilityReconnect)
  window.addEventListener('storage', handleStorageAuthChange)

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
