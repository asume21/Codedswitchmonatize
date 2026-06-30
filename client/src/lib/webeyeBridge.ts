/**
 * WebEye browser bridge — captures canvas/video streams and relays to the cloud relay.
 *
 * Listens for capture commands from the webeye relay via SSE,
 * records video using MediaRecorder, and posts the blob back.
 */

declare global {
  interface Window {
    __webeyeStatus?: WebEyeBridgeStatus
    __webEye?: {
      startCapture: (durationMs?: number, selector?: string) => Promise<string>
      getLastCaptureId: () => string | null
      status: () => 'connected' | 'disconnected' | 'capturing'
    }
  }
}

const BLOB_URL = (id: string) => `/api/webeye/blob/${id}`

type WebEyeBridgeState = 'initializing' | 'connected' | 'disconnected' | 'no-auth' | 'error'

interface WebEyeBridgeStatus {
  state: WebEyeBridgeState
  message: string
  updatedAt: number
}

let recorder:       MediaRecorder | null = null
let sseSource:      EventSource   | null = null
let isCapturing   = false
let isConnected   = false
let lastCaptureId: string | null = null
let resolvedApiKey: string | null = null
let reconnectTimer: number | null = null
let reconnectDelayMs = 3000
let isResolvingKey = false
let status: WebEyeBridgeStatus = {
  state: 'initializing',
  message: 'WebEye bridge starting',
  updatedAt: Date.now(),
}

function log(msg: string) {
  console.debug(`[webeye-bridge] ${msg}`)
}

function setWebEyeStatus(state: WebEyeBridgeState, message: string) {
  status = { state, message, updatedAt: Date.now() }
  window.__webeyeStatus = status
  window.dispatchEvent(new CustomEvent('webeye:status', { detail: status }))
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

async function resolveWebEyeApiKey(): Promise<string | null> {
  if (resolvedApiKey?.startsWith('wbr_')) return resolvedApiKey
  if (isResolvingKey) return null

  isResolvingKey = true
  try {
    const envKey = import.meta.env.VITE_WEBEAR_API_KEY as string | undefined
    if (envKey?.startsWith('wbr_')) {
      resolvedApiKey = envKey
      return resolvedApiKey
    }

    // Reuse the same webear-keys API since both sensors share the developer platform key
    const revealed = await fetchJson<{ key?: string }>('/api/webear-keys/reveal')
    if (revealed.ok && revealed.body?.key?.startsWith('wbr_')) {
      resolvedApiKey = revealed.body.key
      return resolvedApiKey
    }

    if (revealed.status === 401) {
      setWebEyeStatus('no-auth', 'Log in before WebEye can connect')
      return null
    }

    setWebEyeStatus('error', `Could not reveal WebEye key (${revealed.status})`)
    return null
  } catch (err: any) {
    setWebEyeStatus('error', `Key resolve failed: ${err.message}`)
    return null
  } finally {
    isResolvingKey = false
  }
}

function getVideoStream(selector?: string): MediaStream | null {
  const el = selector 
    ? document.querySelector(selector) 
    : document.querySelector('canvas') || document.querySelector('video')

  if (!el) return null

  if (el instanceof HTMLCanvasElement) {
    return el.captureStream(24) // 24 fps
  } else if (el instanceof HTMLVideoElement) {
    if ((el as any).captureStream) {
      return (el as any).captureStream()
    }
    return (el.srcObject as MediaStream) || null
  }
  return null
}

async function ensureVideoStream(selector?: string): Promise<MediaStream | null> {
  const stream = getVideoStream(selector)
  if (stream) return stream

  // Fallback to tab/screen capture if no elements are directly targetable
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    })
  } catch (e) {
    log(`Screen capture fallback failed: ${e}`)
    return null
  }
}

async function doCapture(captureId: string, durationMs: number, selector?: string): Promise<void> {
  if (isCapturing) { log(`Skipping ${captureId} — already capturing`); return }

  isCapturing   = true
  lastCaptureId = captureId

  const stream = await ensureVideoStream(selector)
  if (!stream) {
    log(`Aborting capture ${captureId} — no video source found`)
    isCapturing = false
    return
  }

  // Find supported MIME type
  const mimeOptions = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ]
  const mimeType = mimeOptions.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm'

  const chunks: Blob[] = []
  recorder = new MediaRecorder(stream, { mimeType })

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  log(`Capturing WebEye video ${durationMs}ms (id: ${captureId})`)

  await new Promise<void>((resolve) => {
    recorder!.onstop = () => resolve()
    recorder!.start(200)
    setTimeout(() => { if (recorder?.state === 'recording') recorder.stop() }, durationMs)
  })

  // Clean up screen sharing tracks if we used getDisplayMedia
  if (!getVideoStream(selector)) {
    stream.getTracks().forEach(track => track.stop())
  }

  const blob   = new Blob(chunks, { type: mimeType })
  const buffer = await blob.arrayBuffer()

  log(`Uploading WebEye video ${blob.size} bytes (${chunks.length} chunks)...`)

  await fetch(BLOB_URL(captureId), {
    method:  'POST',
    headers: { 'Content-Type': mimeType },
    body:    buffer,
  })

  log(`Delivered WebEye capture — id: ${captureId}`)
  isCapturing = false
}

async function connectSSE() {
  if (sseSource) return

  const apiKey = await resolveWebEyeApiKey()
  if (!apiKey) {
    if (status.state !== 'no-auth') scheduleReconnect()
    return
  }

  setWebEyeStatus('initializing', 'Connecting WebEye video relay')
  sseSource = new EventSource(`/api/webeye/connect?key=${encodeURIComponent(apiKey)}`)

  sseSource.addEventListener('connected', () => {
    isConnected = true
    reconnectDelayMs = 3000
    setWebEyeStatus('connected', 'WebEye is connected and watching the active view')
    log('Connected to WebEye relay ✓')
  })

  sseSource.addEventListener('capture', (e: MessageEvent) => {
    const { captureId, durationMs, selector } = JSON.parse(e.data)
    doCapture(captureId, durationMs ?? 3000, selector)
  })

  sseSource.onerror = () => {
    isConnected = false
    setWebEyeStatus('disconnected', 'WebEye relay disconnected; reconnecting')
    sseSource?.close()
    sseSource = null
    resolvedApiKey = null
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connectSSE()
  }, reconnectDelayMs)
  reconnectDelayMs = Math.min(30000, reconnectDelayMs * 1.5)
}

// Auto-initialize when loaded in browser
if (typeof window !== 'undefined') {
  // Wait for page load so elements can render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => connectSSE())
  } else {
    connectSSE()
  }

  window.__webEye = {
    startCapture: async (durationMs, selector) => {
      const id = Math.random().toString(36).substring(2, 10)
      await doCapture(id, durationMs ?? 3000, selector)
      return id
    },
    getLastCaptureId: () => lastCaptureId,
    status: () => isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected',
  }
}
