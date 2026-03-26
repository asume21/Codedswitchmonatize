/**
 * WebEar browser client — v1.1.0
 *
 * Captures live audio from the browser tab and relays it to the cloud.
 * No local server required — everything routes through codedswitch.com.
 *
 * Usage:
 *   import { WebEar } from 'webear/browser'
 *   WebEar.init({ apiKey: 'wbr_your_key_here' })
 *
 * Patches window.AudioContext to tap any audio the page produces.
 * Works with Tone.js, Howler.js, raw Web Audio API, or any audio framework.
 */

const DEFAULT_SERVER = 'https://www.codedswitch.com'

export interface WebEarOptions {
  /** Your API key from https://www.codedswitch.com/developer */
  apiKey: string
  /** Override the server URL (default: https://www.codedswitch.com) */
  serverUrl?: string
}

let _serverUrl  = DEFAULT_SERVER
let _apiKey     = ''
let _es: EventSource | null = null
let _destination: MediaStreamAudioDestinationNode | null = null
let _tapped     = false

// ── Audio tapping ─────────────────────────────────────────────────────────────

function tapContext(ctx: AudioContext) {
  if (_tapped) return
  _tapped     = true
  _destination = ctx.createMediaStreamDestination()
  // Silent parallel connection — does not affect actual audio output
  ctx.destination.connect(_destination)
  console.log('[WebEar] AudioContext tapped ✓')
}

function patchAudioContext() {
  const Native = window.AudioContext ?? (window as any).webkitAudioContext
  if (!Native) return

  ;(window as any).AudioContext = function (...args: any[]) {
    const ctx = new Native(...args) as AudioContext
    tapContext(ctx)
    return ctx
  }
  ;(window as any).AudioContext.prototype = Native.prototype
  ;(window as any).webkitAudioContext     = (window as any).AudioContext

  // Tap an already-running Tone.js context if present
  const toneCtx = (window as any).Tone?.context?.rawContext
  if (toneCtx) tapContext(toneCtx)
}

// ── Recording ─────────────────────────────────────────────────────────────────

async function record(durationMs: number): Promise<Blob> {
  if (!_destination) {
    throw new Error(
      '[WebEar] No AudioContext detected yet — make sure your app has started playing audio before running capture_audio.'
    )
  }

  return new Promise((resolve, reject) => {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(_destination!.stream, { mimeType })
    const chunks: Blob[] = []

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop  = () => resolve(new Blob(chunks, { type: 'audio/webm' }))
    recorder.onerror = (e) => reject(new Error(`MediaRecorder error: ${String(e)}`))

    recorder.start()
    setTimeout(() => recorder.stop(), durationMs)
  })
}

// ── SSE relay connection ──────────────────────────────────────────────────────

function connect() {
  if (_es) { _es.close(); _es = null }

  const url = `${_serverUrl}/api/webear/connect?key=${encodeURIComponent(_apiKey)}`
  _es = new EventSource(url)

  _es.addEventListener('connected', () => {
    console.log('[WebEar] Connected to relay ✓  (waiting for capture commands)')
  })

  _es.addEventListener('capture', async (e: MessageEvent) => {
    let captureId: string
    let durationMs: number

    try {
      const data = JSON.parse(e.data) as { captureId: string; durationMs?: number }
      captureId  = data.captureId
      durationMs = data.durationMs ?? 3000
    } catch {
      console.error('[WebEar] Malformed capture event:', e.data)
      return
    }

    console.log(`[WebEar] Capturing ${durationMs}ms...`)

    try {
      const blob   = await record(durationMs)
      const buffer = await blob.arrayBuffer()

      const res = await fetch(`${_serverUrl}/api/webear/blob/${captureId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'audio/webm' },
        body:    buffer,
      })

      if (res.ok) {
        console.log(`[WebEar] Delivered — capture_id: ${captureId}`)
      } else {
        console.error('[WebEar] Upload failed:', res.status, await res.text().catch(() => ''))
      }
    } catch (err) {
      console.error('[WebEar] Capture error:', err)
    }
  })

  _es.onerror = () => {
    console.warn('[WebEar] Connection lost — retrying in 5 s...')
    _es?.close()
    _es = null
    setTimeout(connect, 5000)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const WebEar = {
  /**
   * Initialize WebEar. Call this once when your app starts.
   * @example
   *   WebEar.init({ apiKey: 'wbr_...' })
   */
  init(options: WebEarOptions): void {
    _apiKey    = options.apiKey    ?? ''
    _serverUrl = options.serverUrl ?? DEFAULT_SERVER

    if (!_apiKey) {
      console.error('[WebEar] apiKey is required. Get one at https://www.codedswitch.com/developer')
      return
    }

    patchAudioContext()
    connect()
  },

  /** Disconnect from the relay (optional — call if you want to stop WebEar). */
  disconnect(): void {
    _es?.close()
    _es = null
    console.log('[WebEar] Disconnected.')
  },
}

export default WebEar
