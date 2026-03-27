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
    }
  }
}

const API_KEY  = 'wbr_d461677168c417c329e0ea2e8342a44f8bb1169d506d99078ab53643d1065267'
const CONNECT  = `/api/webear/connect?key=${API_KEY}`
const BLOB_URL = (id: string) => `/api/webear/blob/${id}`

let tapNode:     MediaStreamAudioDestinationNode | null = null
let tapContext:  AudioContext | null = null  // track which context the tap belongs to
let recorder:    MediaRecorder | null = null
let sseSource:   EventSource   | null = null
let isCapturing  = false
let isConnected  = false
let lastCaptureId: string | null = null

function log(msg: string) {
  console.debug(`[webear-bridge] ${msg}`)
}

async function ensureTap(): Promise<MediaStreamAudioDestinationNode | null> {
  try {
    const ctx  = Tone.getContext().rawContext as AudioContext
    const dest = Tone.getDestination() as any

    // If context changed (Tone.start() creates a new one), invalidate cached tap
    if (tapNode && tapContext !== ctx) {
      log('AudioContext changed — rebuilding tap')
      tapNode = null
      tapContext = null
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
    gainNode.connect(tapNode)
    log(`Tapped Tone.js master gain ✓ (ctx.state=${ctx.state}, sampleRate=${ctx.sampleRate})`)
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

function connectSSE() {
  if (sseSource) return

  sseSource = new EventSource(CONNECT)

  sseSource.addEventListener('connected', () => {
    isConnected = true
    log('Connected to webear relay ✓')
  })

  sseSource.addEventListener('capture', (e: MessageEvent) => {
    const { captureId, durationMs } = JSON.parse(e.data)
    doCapture(captureId, durationMs ?? 3000)
  })

  sseSource.onerror = () => {
    isConnected = false
    sseSource?.close()
    sseSource = null
    setTimeout(connectSSE, 3000)
  }
}

export function initAudioDebugBridge(): void {
  connectSSE()

  window.__audioDebug = {
    startCapture: async (durationMs = 3000) => {
      const captureId = crypto.randomUUID()
      await doCapture(captureId, durationMs)
      return captureId
    },
    getLastCaptureId: () => lastCaptureId,
    status: () => isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected',
  }

  log('Bridge ready. window.__audioDebug available.')
}
