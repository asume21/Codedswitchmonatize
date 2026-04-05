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

const CAPTURE_INTERVAL_MS  = 15_000  // run self-analysis every 15 seconds (was 8s — less frequent = less feedback oscillation)
const CAPTURE_DURATION_MS  = 2_000   // capture 2 seconds per sample (was 3s — less main-thread blocking)
const LOUD_DB              = -2      // above this → reduce volume (was -3 — less trigger-happy)
const QUIET_DB             = -35     // below this → boost volume (was -30 — wider dead zone)

type ReportCallback = (report: SelfListenReport) => void

export class SelfListenAnalyzer {
  private tapNode:    MediaStreamAudioDestinationNode | null = null
  private tapContext: AudioContext | null = null
  private recorder:  MediaRecorder | null = null
  private interval:  ReturnType<typeof setInterval> | null = null
  private initTimer: ReturnType<typeof setTimeout> | null = null
  private callbacks: Set<ReportCallback> = new Set()
  private lastReport: SelfListenReport | null = null
  private transportBpm: number = 90

  /** Start periodic self-listen cycle. Call after Tone has started. */
  start(): void {
    if (this.interval) return
    this.ensureTap()
    // Delay first capture so the mix stabilizes before self-correction kicks in
    this.initTimer = setTimeout(() => {
      this.initTimer = null
      this.runCapture()
      this.interval = setInterval(() => this.runCapture(), CAPTURE_INTERVAL_MS)
    }, 10_000)  // 10 seconds — let arrangement get past intro before analyzing
  }

  stop(): void {
    if (this.initTimer) {
      clearTimeout(this.initTimer)
      this.initTimer = null
    }
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    if (this.recorder?.state === 'recording') this.recorder.stop()
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
    this.tapNode = null
    this.tapContext = null
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private ensureTap(): void {
    if (this.tapNode) {
      // Invalidate if the AudioContext changed (Tone.start() may create a new one)
      const ctx = Tone.getContext().rawContext as AudioContext
      if (this.tapContext !== ctx) {
        this.tapNode = null
        this.tapContext = null
      } else {
        return
      }
    }
    try {
      const ctx  = Tone.getContext().rawContext as AudioContext
      if (ctx.state === 'suspended') return  // wait until user gesture resumes it

      this.tapNode = ctx.createMediaStreamDestination()
      this.tapContext = ctx

      // Non-destructive parallel connection to Tone's master output
      const toneDest = Tone.getDestination() as any
      // Tone 15: Destination.output is a Gain wrapper; ._gainNode is the native GainNode
      const gainNode: AudioNode | null =
        toneDest?.output?._gainNode      ||  // Destination.output.Gain._gainNode (native)
        toneDest?.output?.output         ||  // Gain.output = _gainNode (fallback)
        toneDest?.input?.input?._gainNode ||  // Volume.input.Gain._gainNode
        null

      if (gainNode && gainNode !== ctx.destination) {
        gainNode.connect(this.tapNode)
      } else {
        console.warn('[SelfListen] Could not locate Tone.js gain node — tap may be silent')
      }
    } catch (e) {
      console.warn('[SelfListen] Could not tap Tone output:', e)
    }
  }

  private runCapture(): void {
    if (!this.tapNode) { this.ensureTap(); return }
    if (this.recorder?.state === 'recording') return  // previous capture still running

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const chunks: Blob[] = []
    try {
      this.recorder = new MediaRecorder(this.tapNode.stream, { mimeType })
    } catch {
      return
    }

    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    this.recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      if (blob.size < 1000) return   // too small — Tone probably wasn't playing
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const ctx = Tone.getContext().rawContext as AudioContext
        const decoded = await ctx.decodeAudioData(arrayBuffer)
        const samples = decoded.getChannelData(0)  // Float32Array, mono
        // Yield to the event loop before running heavy DSP (~5-10ms of synchronous
        // FFT + onset detection). This prevents the analysis from blocking an
        // in-progress audio callback and causing a brief dropout/crackle.
        await new Promise(resolve => setTimeout(resolve, 0))
        const report  = this.buildReport(samples, decoded.sampleRate)
        this.lastReport = report
        for (const cb of this.callbacks) {
          try { cb(report) } catch { /* swallow */ }
        }
      } catch { /* decode failed — Tone might have been silent */ }
    }

    this.recorder.start(200)  // 200ms timeslices
    setTimeout(() => {
      if (this.recorder?.state === 'recording') this.recorder.stop()
    }, CAPTURE_DURATION_MS)
  }

  /**
   * Run WebEar-grade analysis on PCM samples and map to SelfListenReport.
   * All the heavy DSP lives in pcmAnalyzer.ts — this just adds the
   * Organism-specific action signals and BPM drift computation.
   */
  private buildReport(samples: Float32Array, sampleRate: number): SelfListenReport {
    const pcm = analyzePcm(samples, sampleRate)

    const bpmDrift = pcm.estimatedBpm !== null
      ? Math.abs(pcm.estimatedBpm - this.transportBpm)
      : 0

    return {
      // Loudness
      rmsLinear:        pcm.rmsLinear,
      rmsDb:            isFinite(pcm.rmsDb) ? pcm.rmsDb : -Infinity,
      peakLinear:       pcm.peakLinear,
      peakDb:           isFinite(pcm.peakDb) ? pcm.peakDb : -Infinity,
      clippingPercent:  pcm.clippingPercent,
      hasClipping:      pcm.hasClipping,
      isSilent:         pcm.isSilent,

      // Tonality
      spectralCentroidHz: pcm.spectralCentroidHz,
      dcOffset:           pcm.dcOffset,
      hasDcOffset:        pcm.hasDcOffset,

      // Dynamics
      dynamicRangeDb:   pcm.dynamicRangeDb,
      crestFactor:      pcm.crestFactor,

      // Frequency bands
      bandEnergy:       pcm.bandEnergy,

      // Rhythm
      estimatedBpm:       pcm.estimatedBpm,
      onsetCount:         pcm.onsetCount,
      onsetTimingStdDevMs: pcm.onsetTimingStdDevMs,
      bpmDrift,

      // Action signals
      needsVolumeReduction: pcm.hasClipping || (!pcm.isSilent && pcm.rmsDb > LOUD_DB),
      needsVolumeBoost:     !pcm.isSilent && pcm.rmsDb < QUIET_DB,

      // Meta
      summary:   pcm.summary,
      timestamp: performance.now(),
    }
  }
}
