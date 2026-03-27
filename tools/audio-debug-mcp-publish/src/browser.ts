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
 * Intercepts AudioContext.prototype.connect to tap any audio sent to
 * the hardware destination. Works with Tone.js, Howler.js, raw Web
 * Audio API, or any audio framework.
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

/**
 * Intercept connect() calls that target ctx.destination so we can
 * fork the signal into a MediaStreamDestination for recording.
 *
 * AudioDestinationNode is a sink — you cannot call .connect() on it.
 * Instead we monkey-patch AudioNode.prototype.connect to detect when
 * any node connects to ctx.destination, and add a parallel connection
 * to our MediaStreamDestination.
 */
function patchAudioContext() {
  const NativeAudioContext = window.AudioContext ?? (window as any).webkitAudioContext
  if (!NativeAudioContext) return

  const origConnect = AudioNode.prototype.connect as unknown as Function

  ;(AudioNode.prototype as any).connect = function (
    this: AudioNode,
    destinationParam: AudioNode | AudioParam,
    output?: number,
    input?: number,
  ): any {
    // Call the original connect first
    const result = origConnect.call(this, destinationParam, output, input)

    // If the target is an AudioDestinationNode, also connect to our tap
    if (destinationParam instanceof AudioDestinationNode) {
      try {
        const ctx = this.context as AudioContext
        if (!_destination || _destination.context !== ctx) {
          _destination = ctx.createMediaStreamDestination()
          console.log('[WebEar] Created tap on AudioDestinationNode connection')
        }
        origConnect.call(this, _destination)
      } catch {
        // Silently ignore — node may already be connected
      }
    }

    return result
  }

  // Also patch any existing Tone.js context
  const toneCtx = (window as any).Tone?.getContext?.()?.rawContext as AudioContext | undefined
  if (toneCtx) tapToneDestination(toneCtx)
}

/**
 * Direct tap for Tone.js — connects to the Gain node before the hardware destination.
 */
function tapToneDestination(ctx: AudioContext) {
  if (_tapped) return
  try {
    const toneDest = (window as any).Tone?.getDestination?.() as any
    const gainNode: AudioNode | null =
      toneDest?.output?._gainNode      ||  // Tone 15: Destination.output is Gain; _gainNode is native
      toneDest?.output?.output         ||  // Gain.output = _gainNode (fallback)
      toneDest?.input?.input?._gainNode ||  // Volume.input.Gain._gainNode
      null

    if (gainNode && gainNode !== ctx.destination) {
      if (!_destination || _destination.context !== ctx) {
        _destination = ctx.createMediaStreamDestination()
      }
      gainNode.connect(_destination)
      _tapped = true
      console.log('[WebEar] Tapped Tone.js master gain ✓')
    }
  } catch (e) {
    console.warn('[WebEar] Could not tap Tone.js:', e)
  }
}

// ── Recording ─────────────────────────────────────────────────────────────────

async function record(durationMs: number): Promise<Blob> {
  // Try Tone.js tap if not already tapped
  if (!_tapped) {
    const toneCtx = (window as any).Tone?.getContext?.()?.rawContext as AudioContext | undefined
    if (toneCtx) tapToneDestination(toneCtx)
  }

  if (!_destination) {
    throw new Error(
      '[WebEar] No audio tap available — make sure your app has started playing audio. ' +
      'If using Tone.js, ensure Tone.start() has been called.'
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

    recorder.start(200)
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, durationMs)
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
        console.log(`[WebEar] Delivered — capture_id: ${captureId} (${buffer.byteLength} bytes)`)
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
