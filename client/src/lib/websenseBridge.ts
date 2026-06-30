/**
 * WebSense browser bridge — captures performance telemetry, web vitals, memory usage,
 * and user interaction metrics, and relays them to the cloud relay.
 *
 * Listens for capture commands from the websense relay via SSE,
 * records telemetry over a duration window, and posts the JSON blob back.
 */

declare global {
  interface Window {
    __websenseStatus?: WebSenseBridgeStatus
    __webSense?: {
      startCapture: (durationMs?: number) => Promise<string>
      getLastCaptureId: () => string | null
      status: () => 'connected' | 'disconnected' | 'capturing'
    }
  }
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number
      totalJSHeapSize: number
      usedJSHeapSize: number
    }
  }
}

const BLOB_URL = (id: string) => `/api/websense/blob/${id}`

type WebSenseBridgeState = 'initializing' | 'connected' | 'disconnected' | 'no-auth' | 'error'

interface WebSenseBridgeStatus {
  state: WebSenseBridgeState
  message: string
  updatedAt: number
}

let sseSource:      EventSource   | null = null
let isCapturing   = false
let isConnected   = false
let lastCaptureId: string | null = null
let resolvedApiKey: string | null = null
let reconnectTimer: number | null = null
let reconnectDelayMs = 3000
let isResolvingKey = false
let status: WebSenseBridgeStatus = {
  state: 'initializing',
  message: 'WebSense bridge starting',
  updatedAt: Date.now(),
}

function log(msg: string) {
  console.debug(`[websense-bridge] ${msg}`)
}

function setWebSenseStatus(state: WebSenseBridgeState, message: string) {
  status = { state, message, updatedAt: Date.now() }
  window.__websenseStatus = status
  window.dispatchEvent(new CustomEvent('websense:status', { detail: status }))
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

async function resolveWebSenseApiKey(): Promise<string | null> {
  if (resolvedApiKey?.startsWith('wbr_')) return resolvedApiKey
  if (isResolvingKey) return null

  isResolvingKey = true
  try {
    const envKey = import.meta.env.VITE_WEBEAR_API_KEY as string | undefined
    if (envKey?.startsWith('wbr_')) {
      resolvedApiKey = envKey
      return resolvedApiKey
    }

    // Share the same developer platform key
    const revealed = await fetchJson<{ key?: string }>('/api/webear-keys/reveal')
    if (revealed.ok && revealed.body?.key?.startsWith('wbr_')) {
      resolvedApiKey = revealed.body.key
      return resolvedApiKey
    }

    if (revealed.status === 401) {
      setWebSenseStatus('no-auth', 'Log in before WebSense can connect')
      return null
    }

    setWebSenseStatus('error', `Could not reveal WebSense key (${revealed.status})`)
    return null
  } catch (err: any) {
    setWebSenseStatus('error', `Key resolve failed: ${err.message}`)
    return null
  } finally {
    isResolvingKey = false
  }
}

interface TelemetryData {
  fps: {
    average: number
    min: number
    max: number
    jitterMs: number
  }
  memory: {
    supported: boolean
    usedHeapMb: number
    totalHeapMb: number
    limitMb: number
    heapUsagePercent: number
  }
  vitals: {
    cumulativeLayoutShift: number
    firstInputDelayMs: number | null
  }
  interaction: {
    clicks: number
    keypresses: number
    scrolls: number
  }
  audioState: {
    state: string
    sampleRate: number
    latencySeconds: number
  }
}

async function collectTelemetry(durationMs: number): Promise<TelemetryData> {
  return new Promise((resolve) => {
    // 1. Frame Rate & Jitter tracking
    let frameTimes: number[] = []
    let lastFrameTime = performance.now()
    let frameId = 0

    function trackFrame() {
      const now = performance.now()
      frameTimes.push(now - lastFrameTime)
      lastFrameTime = now
      if (isCapturing) {
        frameId = requestAnimationFrame(trackFrame)
      }
    }
    frameId = requestAnimationFrame(trackFrame)

    // 2. User Interactions tracking during window
    let clicks = 0
    let keypresses = 0
    let scrolls = 0

    const clickHandler = () => clicks++
    const keyHandler = () => keypresses++
    const scrollHandler = () => scrolls++

    window.addEventListener('click', clickHandler)
    window.addEventListener('keydown', keyHandler)
    window.addEventListener('scroll', scrollHandler)

    // 3. Web Vitals (Cumulative Layout Shift)
    let cls = 0
    let fid: number | null = null

    let observer: PerformanceObserver | null = null
    try {
      observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            cls += (entry as any).value
          }
          if (entry.entryType === 'first-input') {
            fid = entry.duration
          }
        }
      })
      observer.observe({ entryTypes: ['layout-shift', 'first-input'] })
    } catch (e) {
      log(`PerformanceObserver not fully supported: ${e}`)
    }

    setTimeout(() => {
      // Stop tracking
      cancelAnimationFrame(frameId)
      window.removeEventListener('click', clickHandler)
      window.removeEventListener('keydown', keyHandler)
      window.removeEventListener('scroll', scrollHandler)
      if (observer) observer.disconnect()

      // Calculate FPS statistics
      let avgFps = 60
      let minFps = 60
      let maxFps = 60
      let jitter = 0

      if (frameTimes.length > 1) {
        // First frame delta might contain startup overhead, drop it
        const deltas = frameTimes.slice(1)
        const avgDelta = deltas.reduce((s, v) => s + v, 0) / deltas.length
        avgFps = 1000 / avgDelta
        
        const fpsVals = deltas.map(d => 1000 / d)
        minFps = Math.min(...fpsVals)
        maxFps = Math.max(...fpsVals)

        // Calculate frame time jitter (standard deviation of frame intervals)
        const meanDelta = avgDelta
        const variance = deltas.reduce((s, v) => s + (v - meanDelta) ** 2, 0) / deltas.length
        jitter = Math.sqrt(variance)
      }

      // Memory stats (Chrome only)
      const memorySupported = typeof performance.memory !== 'undefined'
      const usedHeap = memorySupported ? (performance.memory!.usedJSHeapSize / (1024 * 1024)) : 0
      const totalHeap = memorySupported ? (performance.memory!.totalJSHeapSize / (1024 * 1024)) : 0
      const limitHeap = memorySupported ? (performance.memory!.jsHeapSizeLimit / (1024 * 1024)) : 0
      const heapPercent = limitHeap > 0 ? (usedHeap / limitHeap) * 100 : 0

      // Audio state tracking
      let audioCtxState = 'no-context'
      let audioSR = 0
      let audioLatency = 0

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          // Look for any existing audio contexts
          const dummy = new AudioContextClass()
          audioCtxState = dummy.state
          audioSR = dummy.sampleRate
          audioLatency = dummy.baseLatency || 0
          void dummy.close()
        }
      } catch (e) {
        log(`Web Audio state query failed: ${e}`)
      }

      resolve({
        fps: {
          average: avgFps,
          min: minFps,
          max: maxFps,
          jitterMs: jitter
        },
        memory: {
          supported: memorySupported,
          usedHeapMb: usedHeap,
          totalHeapMb: totalHeap,
          limitMb: limitHeap,
          heapUsagePercent: heapPercent
        },
        vitals: {
          cumulativeLayoutShift: cls,
          firstInputDelayMs: fid
        },
        interaction: {
          clicks,
          keypresses,
          scrolls
        },
        audioState: {
          state: audioCtxState,
          sampleRate: audioSR,
          latencySeconds: audioLatency
        }
      })
    }, durationMs)
  })
}

async function doCapture(captureId: string, durationMs: number): Promise<void> {
  if (isCapturing) { log(`Skipping ${captureId} — already capturing`); return }

  isCapturing   = true
  lastCaptureId = captureId

  log(`Capturing WebSense telemetry for ${durationMs}ms (id: ${captureId})`)
  
  const report = await collectTelemetry(durationMs)
  
  const payload = JSON.stringify(report, null, 2)
  log(`Uploading WebSense telemetry data ${payload.length} bytes...`)

  await fetch(BLOB_URL(captureId), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    payload,
  })

  log(`Delivered WebSense telemetry capture — id: ${captureId}`)
  isCapturing = false
}

async function connectSSE() {
  if (sseSource) return

  const apiKey = await resolveWebSenseApiKey()
  if (!apiKey) {
    if (status.state !== 'no-auth') scheduleReconnect()
    return
  }

  setWebSenseStatus('initializing', 'Connecting WebSense telemetry relay')
  sseSource = new EventSource(`/api/websense/connect?key=${encodeURIComponent(apiKey)}`)

  sseSource.addEventListener('connected', () => {
    isConnected = true
    reconnectDelayMs = 3000
    setWebSenseStatus('connected', 'WebSense is connected and streaming performance data')
    log('Connected to WebSense relay ✓')
  })

  sseSource.addEventListener('capture', (e: MessageEvent) => {
    const { captureId, durationMs } = JSON.parse(e.data)
    doCapture(captureId, durationMs ?? 3000)
  })

  sseSource.onerror = () => {
    isConnected = false
    setWebSenseStatus('disconnected', 'WebSense relay disconnected; reconnecting')
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => connectSSE())
  } else {
    connectSSE()
  }

  window.__webSense = {
    startCapture: async (durationMs) => {
      const id = Math.random().toString(36).substring(2, 10)
      await doCapture(id, durationMs ?? 3000)
      return id
    },
    getLastCaptureId: () => lastCaptureId,
    status: () => isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected',
  }
}
