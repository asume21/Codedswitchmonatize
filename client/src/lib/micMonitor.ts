/**
 * micMonitor — "hear yourself" monitoring, without feeding the mic back into the mix.
 *
 * Extracted from FloatingAudioMonitor.tsx, where it lived as module-level globals
 * inside a UI file and could not be tested. It is audio plumbing, not UI.
 *
 * WHY THIS EXISTS IN THIS SHAPE
 *
 * The monitor connects mic -> gain -> the SHARED context destination. That is the
 * point of it. But as written it also opened its OWN getUserMedia with
 * echoCancellation, noiseSuppression and autoGainControl all FALSE, and the user
 * heard the whole mix distort the moment monitoring came on:
 *
 *   1. It opened a SECOND, COMPETING mic stream. AudioAnalysisEngine.getStream()
 *      exists specifically so callers do not do this — its docstring says as much.
 *      Two opens with OPPOSITE processing constraints make the device reconcile
 *      them, and on Windows input and output share one WASAPI session, so the
 *      renegotiation hits playback too. That is why EVERYTHING distorted rather
 *      than just the vocal.
 *   2. Echo cancellation was off on a path that ends at the speakers — disabling
 *      the one browser feature whose whole job is preventing that loop.
 *
 * So: prefer the stream the analyser already has (it is a single device open, and
 * it already has echo cancellation on). Only open our own as a fallback, and when
 * we do, turn echo cancellation ON — the rest of the codebase disables it for
 * ANALYSIS and RECORDING, where it can eat sustained notes, but this path is
 * neither. It goes to the speakers.
 */

import { getAudioContext } from './audioContext'

let monitorStream: MediaStream | null = null
let monitorSource: MediaStreamAudioSourceNode | null = null
let monitorGain: GainNode | null = null
let monitorCtx: AudioContext | null = null
/** False when we are borrowing the analyser's stream — see stopMicMonitor. */
let ownsStream = false

/** True while the monitor is riding the analyser's existing mic stream. */
export function isMonitorUsingSharedStream(): boolean {
  return monitorStream !== null && !ownsStream
}

/**
 * @param shared the Organism analyser's live stream, when there is one.
 *   Pass `organism?.analysisEngine?.getStream() ?? null`.
 */
export async function startMicMonitor(
  volume: number,
  shared: MediaStream | null = null,
): Promise<void> {
  if (monitorStream) return // already running

  monitorCtx = getAudioContext()

  if (shared) {
    monitorStream = shared
    ownsStream = false
  } else {
    monitorStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // ON, deliberately, and unlike every other mic open in this codebase.
        // Those are analysis and recording paths where the processing damages the
        // signal. This one plays into the room, so the loop is the bigger problem.
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    ownsStream = true
  }

  monitorSource = monitorCtx.createMediaStreamSource(monitorStream)
  monitorGain = monitorCtx.createGain()
  monitorGain.gain.value = volume
  monitorSource.connect(monitorGain)
  monitorGain.connect(monitorCtx.destination)
}

export function stopMicMonitor(): void {
  monitorGain?.disconnect()
  monitorSource?.disconnect()
  // Only stop tracks we opened. Stopping a borrowed stream would kill the
  // Organism's own mic input as a side effect of closing the monitor.
  if (ownsStream) monitorStream?.getTracks().forEach((t) => t.stop())
  // Never close the shared AudioContext.
  monitorStream = null
  monitorSource = null
  monitorGain = null
  monitorCtx = null
  ownsStream = false
}

export function setMonitorVolume(volume: number): void {
  if (monitorGain) monitorGain.gain.value = volume
}
