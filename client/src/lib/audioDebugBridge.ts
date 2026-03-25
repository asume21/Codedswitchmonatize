/**
 * Audio Debug Bridge — browser side (dev mode only)
 *
 * Taps the Tone.js master output via a side-channel MediaStreamDestination,
 * listens for capture commands from the dev server via SSE, records audio
 * using MediaRecorder, and posts the captured blob back to the server.
 *
 * Enabled only when import.meta.env.DEV is true.
 * Exposed on window.__audioDebug for manual console testing.
 */

import * as Tone from 'tone'

const BRIDGE_BASE = '/api/audio-debug'

interface CaptureCommand {
  type: 'capture'
  captureId: string
  durationMs: number
}

interface AudioDebugBridgeAPI {
  startCapture: (durationMs?: number) => Promise<string>
  getLastCaptureId: () => string | null
  status: () => 'connected' | 'disconnected' | 'capturing'
}

declare global {
  interface Window {
    __audioDebug?: AudioDebugBridgeAPI
  }
}

let tapNode: MediaStreamAudioDestinationNode | null = null
let recorder: MediaRecorder | null = null
let sseSource: EventSource | null = null
let lastCaptureId: string | null = null
let isCapturing = false
let isConnected = false

function log(msg: string) {
  console.debug(`[audio-debug-bridge] ${msg}`)
}

function ensureTap(): MediaStreamAudioDestinationNode {
  if (tapNode) return tapNode

  // Strategy: passively connect Tone's output to a MediaStreamDestination
  // WITHOUT breaking Tone's existing connection to ctx.destination.
  // Web Audio allows multiple .connect() calls — they fan out, not replace.
  // This way Tone keeps playing to speakers AND we get a copy for recording.
  try {
    const ctx = Tone.getContext().rawContext as AudioContext
    tapNode = ctx.createMediaStreamDestination()

    // Tone.getDestination() is the master volume ToneAudioNode.
    // Find its underlying Web Audio output node.
    const toneDest = Tone.getDestination() as any
    const toneOutputNode: AudioNode | null =
      toneDest?.output?.output ||  // Tone v14+
      toneDest?.output ||          // Tone v13
      toneDest?._output ||         // internal
      null

    if (toneOutputNode) {
      // Just add a parallel connection — don't disconnect anything
      toneOutputNode.connect(tapNode)
      log('Tap connected in parallel to Tone.js master output (non-destructive)')
    } else {
      log('Warning: could not find Tone output node — tap may not capture audio')
    }
  } catch (e) {
    log(`ensureTap error: ${e}`)
  }

  if (!tapNode) {
    const ctx = Tone.getContext().rawContext as AudioContext
    tapNode = ctx.createMediaStreamDestination()
  }

  return tapNode
}

async function doCapture(captureId: string, durationMs: number): Promise<void> {
  if (isCapturing) {
    log(`Capture ${captureId} skipped — already capturing`)
    return
  }

  isCapturing = true
  lastCaptureId = captureId

  const tap = ensureTap()

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'

  const chunks: Blob[] = []
  recorder = new MediaRecorder(tap.stream, { mimeType })

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  log(`Starting capture ${captureId} for ${durationMs}ms`)

  await new Promise<void>((resolve) => {
    recorder!.onstop = () => resolve()
    recorder!.start(200) // 200ms timeslice so we get data even for short captures
    setTimeout(() => {
      if (recorder?.state === 'recording') recorder.stop()
    }, durationMs)
  })

  const blob = new Blob(chunks, { type: mimeType })
  log(`Capture ${captureId} complete — ${blob.size} bytes, posting to server`)

  const form = new FormData()
  form.append('audio', blob, 'capture.webm')
  form.append('captureId', captureId)
  form.append('durationMs', String(durationMs))

  await fetch(`${BRIDGE_BASE}/capture`, { method: 'POST', body: form })
  log(`Capture ${captureId} uploaded`)
  isCapturing = false
}

function connectSSE() {
  if (sseSource) return

  sseSource = new EventSource(`${BRIDGE_BASE}/events`)

  sseSource.onopen = () => {
    isConnected = true
    log('SSE connected')
    // Drain any commands that arrived while we were disconnected
    fetch(`${BRIDGE_BASE}/pending-commands`)
      .then(r => r.json())
      .then((cmds: CaptureCommand[]) => {
        for (const cmd of cmds) {
          if (cmd.type === 'capture') doCapture(cmd.captureId, cmd.durationMs)
        }
      })
      .catch(() => {})
  }

  sseSource.addEventListener('capture', (e: MessageEvent) => {
    const cmd = JSON.parse(e.data) as CaptureCommand
    doCapture(cmd.captureId, cmd.durationMs)
  })

  sseSource.onerror = () => {
    isConnected = false
    sseSource?.close()
    sseSource = null
    // EventSource auto-reconnects, but we clear the ref and re-call after delay
    setTimeout(connectSSE, 3000)
  }
}

export function initAudioDebugBridge(): void {
  if (!import.meta.env.DEV) return

  connectSSE()
  ensureTap()

  // Also expose a manual API on window for console testing
  window.__audioDebug = {
    startCapture: async (durationMs = 3000) => {
      const captureId = crypto.randomUUID()
      await doCapture(captureId, durationMs)
      return captureId
    },
    getLastCaptureId: () => lastCaptureId,
    status: () => isCapturing ? 'capturing' : isConnected ? 'connected' : 'disconnected',
  }

  log('Audio Debug Bridge initialised. window.__audioDebug is available.')
}
