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
let recorder:    MediaRecorder | null = null
let sseSource:   EventSource   | null = null
let isCapturing  = false
let isConnected  = false
let lastCaptureId: string | null = null

function log(msg: string) {
  console.debug(`[webear-bridge] ${msg}`)
}

function ensureTap(): MediaStreamAudioDestinationNode {
  if (tapNode) return tapNode

  try {
    const ctx  = Tone.getContext().rawContext as AudioContext
    tapNode    = ctx.createMediaStreamDestination()

    const dest = Tone.getDestination() as any
    // In Tone.js v14, Destination.input is a Volume ToneAudioNode whose
    // internal _gainNode (a native GainNode) routes into ctx.destination.
    // We tap that GainNode — connecting it to tapNode too branches the signal.
    // We must NOT connect from ctx.destination, which is a terminal sink.
    const gainNode: AudioNode | null =
      dest?._volume?._gainNode ||   // Volume's native GainNode (most direct)
      dest?._volume?.input     ||   // Volume.input also equals _gainNode
      dest?.input?._gainNode   ||   // fallback path
      null

    if (gainNode && gainNode !== ctx.destination) {
      gainNode.connect(tapNode)
      log('Tapped Tone.js master gain ✓')
    } else {
      log('Could not locate Tone.js gain node — capture will be silent')
    }
  } catch (e) {
    log(`ensureTap error: ${e}`)
  }

  return tapNode!
}

async function doCapture(captureId: string, durationMs: number): Promise<void> {
  if (isCapturing) { log(`Skipping ${captureId} — already capturing`); return }

  isCapturing   = true
  lastCaptureId = captureId

  const tap      = ensureTap()
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

  log(`Uploading ${blob.size} bytes...`)

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
  ensureTap()

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
