/**
 * SelfListenAnalyzer — gives Astutely ears to hear its own output.
 *
 * Every CAPTURE_INTERVAL_MS milliseconds, captures CAPTURE_DURATION_MS of
 * Tone.js output, decodes it to raw PCM via AudioContext.decodeAudioData,
 * and runs WebEar-grade signal analysis via pcmAnalyzer.
 *
 * The resulting SelfListenReport tells OrganismProvider + Astutely:
 *   - Is anything clipping? → reduce kick/melody volume
 *   - Is the output silent?  → boost texture, something's wrong
 *   - Is the mix muddy?      → spectral centroid + band energy analysis
 *   - Is the groove tight?   → onset timing jitter
 *   - Are transients intact? → crest factor + dynamic range
 *   - How does the BPM compare to Transport?
 *   - Human-readable summary for AI prompts
 *
 * This creates a genuine closed feedback loop:
 *   Astutely generates → hears itself → self-corrects → generates better
 *
 * Analysis engine: pcmAnalyzer.ts (ported from WebEar MCP — zero API calls)
 */

import * as Tone          from 'tone'
import type { SelfListenReport } from './types'
import { analyzePcm }     from './pcmAnalyzer'

const CAPTURE_INTERVAL_MS  = 15_000  // run self-analysis every 15 seconds
const CAPTURE_DURATION_MS  = 2_000   // capture 2 seconds per sample
const LOUD_DB              = -2      // above this → reduce volume
const QUIET_DB             = -35     // below this → boost volume

type ReportCallback = (report: SelfListenReport) => void

export class SelfListenAnalyzer {
  private tapNode:    MediaStreamAudioDestinationNode | null = null
  private tapContext: AudioContext | null = null
  // Track the gain node we connected to so we can disconnect on context change
  private connectedGainNode: AudioNode | null = null
  private recorder:  MediaRecorder | null = null
  private interval:  ReturnType<typeof setInterval> | null = null
  private initTimer: ReturnType<typeof setTimeout> | null = null
  private captureTimer: ReturnType<typeof setTimeout> | null = null
  private callbacks: Set<ReportCallback> = new Set()
  private lastReport: SelfListenReport | null = null
  private transportBpm: number = 90
  private capturing: boolean = false

  /** Start periodic self-listen cycle. Call after Tone has started. */
  start(): void {
    if (this.interval) return
    this.ensureTap()
    // Delay first capture so the mix stabilizes before self-correction kicks in
    this.initTimer = setTimeout(() => {
      this.initTimer = null
      this.runCapture()
      this.interval = setInterval(() => this.runCapture(), CAPTURE_INTERVAL_MS)
    }, 10_000)
  }

  stop(): void {
    if (this.initTimer) {
      clearTimeout(this.initTimer)
      this.initTimer = null
    }
    if (this.captureTimer) {
      clearTimeout(this.captureTimer)
      this.captureTimer = null
    }
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    if (this.recorder?.state === 'recording') {
      try { this.recorder.stop() } catch { /* already stopped */ }
    }
    this.recorder = null
    this.capturing = false
  }

  /** Register a callback to receive SelfListenReports. */
  onReport(cb: ReportCallback): () => void {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  getLatestReport(): SelfListenReport | null {
    return this.lastReport
  }

  /** Let the analyzer know the current Transport BPM so it can measure drift. */
  setTransportBpm(bpm: number): void {
    this.transportBpm = bpm
  }

  dispose(): void {
    this.stop()
    this.callbacks.clear()
    // Disconnect the tap from the audio graph
    this.disconnectTap()
    this.tapNode = null
    this.tapContext = null
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /** Disconnect old tap node from the gain node to prevent phantom audio taps */
  private disconnectTap(): void {
    if (this.connectedGainNode && this.tapNode) {
      try { this.connectedGainNode.disconnect(this.tapNode) } catch { /* already disconnected */ }
    }
    this.connectedGainNode = null
  }

  private ensureTap(): void {
    if (this.tapNode) {
      // Invalidate if the AudioContext changed (Tone.start() may create a new one)
      const ctx = Tone.getContext().rawContext as AudioContext
      if (this.tapContext !== ctx) {
        // Properly disconnect old tap before creating new one
        this.disconnectTap()
        this.tapNode = null
        this.tapContext = null
        // Also invalidate the recorder since it's bound to the old stream
        if (this.recorder) {
          try { if (this.recorder.state === 'recording') this.recorder.stop() } catch { /* */ }
          this.recorder = null
        }
      } else {
        return
      }
    }
    try {
      const ctx  = Tone.getContext().rawContext as AudioContext
      if (ctx.state === 'suspended') return

      this.tapNode = ctx.createMediaStreamDestination()
      this.tapContext = ctx

      // Non-destructive parallel connection to Tone's master output
      const toneDest = Tone.getDestination() as any
      const gainNode: AudioNode | null =
        toneDest?.output?._gainNode      ||
        toneDest?.output?.output         ||
        toneDest?.input?.input?._gainNode ||
        null

      if (gainNode && gainNode !== ctx.destination) {
        gainNode.connect(this.tapNode)
        this.connectedGainNode = gainNode  // track for later disconnect
      } else {
        console.warn('[SelfListen] Could not locate Tone.js gain node — tap may be silent')
      }
    } catch (e) {
      console.warn('[SelfListen] Could not tap Tone output:', e)
    }
  }

  private runCapture(): void {
    if (!this.tapNode) { this.ensureTap(); return }
    // Prevent overlapping captures — if previous is still running, skip this cycle
    if (this.capturing) return

    // Reuse the same MediaRecorder if possible (same tapNode stream).
    // Only create a new one if it doesn't exist or was invalidated.
    if (!this.recorder || this.recorder.stream !== this.tapNode.stream) {
      // Dispose old recorder
      if (this.recorder) {
        try { if (this.recorder.state === 'recording') this.recorder.stop() } catch { /* */ }
      }
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      try {
        this.recorder = new MediaRecorder(this.tapNode.stream, { mimeType })
      } catch {
        return
      }
    }

    this.capturing = true
    const chunks: Blob[] = []

    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    this.recorder.onstop = async () => {
      this.capturing = false
      const blob = new Blob(chunks, { type: 'audio/webm' })
      if (blob.size < 1000) return   // too small — Tone probably wasn't playing
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const ctx = Tone.getContext().rawContext as AudioContext
        const decoded = await ctx.decodeAudioData(arrayBuffer)
        const samples = decoded.getChannelData(0)
        // Yield to the event loop before running heavy DSP
        await new Promise(resolve => setTimeout(resolve, 0))
        const report  = this.buildReport(samples, decoded.sampleRate)
        this.lastReport = report
        for (const cb of this.callbacks) {
          try { cb(report) } catch { /* swallow */ }
        }
      } catch { /* decode failed — Tone might have been silent */ }
    }

    try {
      this.recorder.start(200)  // 200ms timeslices
    } catch {
      this.capturing = false
      this.recorder = null  // invalidate — will be recreated next cycle
      return
    }

    this.captureTimer = setTimeout(() => {
      this.captureTimer = null
      if (this.recorder?.state === 'recording') {
        try { this.recorder.stop() } catch { this.capturing = false }
      }
    }, CAPTURE_DURATION_MS)
  }

  /**
   * Run WebEar-grade analysis on PCM samples and map to SelfListenReport.
   */
  private buildReport(samples: Float32Array, sampleRate: number): SelfListenReport {
    const pcm = analyzePcm(samples, sampleRate)

    const bpmDrift = pcm.estimatedBpm !== null
      ? Math.abs(pcm.estimatedBpm - this.transportBpm)
      : 0

    return {
      rmsLinear:        pcm.rmsLinear,
      rmsDb:            isFinite(pcm.rmsDb) ? pcm.rmsDb : -Infinity,
      peakLinear:       pcm.peakLinear,
      peakDb:           isFinite(pcm.peakDb) ? pcm.peakDb : -Infinity,
      clippingPercent:  pcm.clippingPercent,
      hasClipping:      pcm.hasClipping,
      isSilent:         pcm.isSilent,
      spectralCentroidHz: pcm.spectralCentroidHz,
      dcOffset:           pcm.dcOffset,
      hasDcOffset:        pcm.hasDcOffset,
      dynamicRangeDb:   pcm.dynamicRangeDb,
      crestFactor:      pcm.crestFactor,
      bandEnergy:       pcm.bandEnergy,
      estimatedBpm:       pcm.estimatedBpm,
      onsetCount:         pcm.onsetCount,
      onsetTimingStdDevMs: pcm.onsetTimingStdDevMs,
      bpmDrift,
      needsVolumeReduction: pcm.hasClipping || (!pcm.isSilent && pcm.rmsDb > LOUD_DB),
      needsVolumeBoost:     !pcm.isSilent && pcm.rmsDb < QUIET_DB,
      summary:   pcm.summary,
      timestamp: performance.now(),
    }
  }
}
