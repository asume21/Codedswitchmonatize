/**
 * SelfListenAnalyzer — gives Astutely ears to hear its own output.
 *
 * Every CAPTURE_INTERVAL_MS milliseconds, captures CAPTURE_DURATION_MS of
 * Tone.js output, decodes it to raw PCM via AudioContext.decodeAudioData,
 * and runs a lightweight spectral + dynamics analysis.
 *
 * The resulting SelfListenReport tells OrganismProvider:
 *   • Is anything clipping? → reduce kick/melody volume
 *   • Is the output silent?  → boost texture, something's wrong
 *   • Is the mix too muddy?  → feedback to MelodyGenerator
 *   • How does the actual BPM compare to Transport?
 *
 * This creates a genuine closed feedback loop:
 *   Astutely generates → hears itself → self-corrects → generates better
 */

import * as Tone          from 'tone'
import type { SelfListenReport } from './types'

const CAPTURE_INTERVAL_MS  = 8_000   // run self-analysis every 8 seconds
const CAPTURE_DURATION_MS  = 3_000   // capture 3 seconds per sample
const SILENCE_THRESHOLD    = 0.001   // RMS below this = silent
const CLIPPING_THRESHOLD   = 0.99    // |sample| above this = clip
const CLIPPING_PERCENT_MAX = 0.05    // >0.05% clips = has clipping
const LOUD_DB              = -3      // above this → reduce volume
const QUIET_DB             = -30     // below this → boost volume

type ReportCallback = (report: SelfListenReport) => void

export class SelfListenAnalyzer {
  private tapNode:    MediaStreamAudioDestinationNode | null = null
  private recorder:  MediaRecorder | null = null
  private interval:  ReturnType<typeof setInterval> | null = null
  private callbacks: Set<ReportCallback> = new Set()
  private lastReport: SelfListenReport | null = null
  private transportBpm: number = 90

  /** Start periodic self-listen cycle. Call after Tone has started. */
  start(): void {
    if (this.interval) return
    this.ensureTap()
    // Delay first capture so Tone has time to fully start
    const timer = setTimeout(() => {
      this.runCapture()
      this.interval = setInterval(() => this.runCapture(), CAPTURE_INTERVAL_MS)
    }, 2000)
    // Store timer reference in interval slot temporarily
    ;(this as any)._initTimer = timer
  }

  stop(): void {
    if ((this as any)._initTimer) {
      clearTimeout((this as any)._initTimer)
      delete (this as any)._initTimer
    }
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.recorder?.state === 'recording' && this.recorder.stop()
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
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private ensureTap(): void {
    if (this.tapNode) return
    try {
      const ctx  = Tone.getContext().rawContext as AudioContext
      this.tapNode = ctx.createMediaStreamDestination()

      // Non-destructive parallel connection to Tone's master output
      const toneDest = Tone.getDestination() as any
      const output: AudioNode | null =
        toneDest?.output?.output ||
        toneDest?.output          ||
        toneDest?._output         ||
        null

      if (output) {
        output.connect(this.tapNode)
      } else {
        ctx.destination.connect(this.tapNode)
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
        const report  = this.analyze(samples, decoded.sampleRate)
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

  private analyze(samples: Float32Array, sampleRate: number): SelfListenReport {
    const N = samples.length

    // ── Loudness ─────────────────────────────────────────────────────────────
    let sumSq   = 0
    let peak    = 0
    let clipped = 0

    for (let i = 0; i < N; i++) {
      const abs = Math.abs(samples[i])
      sumSq += abs * abs
      if (abs > peak) peak = abs
      if (abs >= CLIPPING_THRESHOLD) clipped++
    }

    const rmsLinear      = Math.sqrt(sumSq / N)
    const rmsDb          = rmsLinear > 0 ? 20 * Math.log10(rmsLinear) : -Infinity
    const peakDb         = peak > 0 ? 20 * Math.log10(peak) : -Infinity
    const clippingPercent = (clipped / N) * 100
    const isSilent       = rmsLinear < SILENCE_THRESHOLD
    const hasClipping    = clippingPercent > CLIPPING_PERCENT_MAX

    // ── Spectral centroid (fast approximation) ───────────────────────────────
    // Use zero-crossing rate as a proxy — more ZCRs = brighter
    let zcr = 0
    for (let i = 1; i < N; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) zcr++
    }
    const zcrRate = (zcr / N) * sampleRate
    // ZCR maps roughly to spectral centroid: 500 ZCR/s ≈ 1kHz centroid
    const spectralCentroidHz = Math.min(12000, zcrRate * 2)

    // ── Band energy (simplified — 4 bands via segmented energy sums) ─────────
    // Rough frequency estimation using frame-based approach
    const FRAME = 512
    const bandSums = { sub: 0, bass: 0, lowMid: 0, highMid: 0, high: 0 }
    let totalMag = 0
    let frameCount = 0

    for (let offset = 0; offset + FRAME <= N; offset += FRAME) {
      // Simple DFT on FRAME samples — only enough bins to classify bands
      const binHz = sampleRate / FRAME
      for (let k = 1; k < FRAME / 2; k++) {
        let re = 0, im = 0
        const angle = (2 * Math.PI * k) / FRAME
        for (let n = 0; n < FRAME; n++) {
          re += samples[offset + n] * Math.cos(angle * n)
          im -= samples[offset + n] * Math.sin(angle * n)
        }
        const mag  = Math.sqrt(re * re + im * im) / FRAME
        const freq = k * binHz
        totalMag  += mag
        if      (freq < 80)   bandSums.sub     += mag
        else if (freq < 250)  bandSums.bass    += mag
        else if (freq < 2000) bandSums.lowMid  += mag
        else if (freq < 6000) bandSums.highMid += mag
        else                  bandSums.high    += mag
      }
      frameCount++
      if (frameCount >= 4) break  // 4 frames is enough for a representative estimate
    }

    const total = totalMag || 1
    const bandEnergy = {
      sub:     bandSums.sub     / total,
      bass:    bandSums.bass    / total,
      lowMid:  bandSums.lowMid  / total,
      highMid: bandSums.highMid / total,
      high:    bandSums.high    / total,
    }

    // ── BPM from onset detection (simple HFC) ────────────────────────────────
    const HOP    = 256
    const onsets: number[] = []
    let prevHfc  = 0
    let lastOnsetSample = -HOP * 4

    for (let offset = 0; offset + FRAME <= N; offset += HOP) {
      let hfc = 0
      for (let i = 0; i < FRAME; i++) {
        hfc += samples[offset + i] * samples[offset + i] * (i / FRAME)
      }
      const delta = Math.max(0, hfc - prevHfc)
      const gap   = offset - lastOnsetSample

      if (delta > 0.003 && gap > (sampleRate * 0.06) / HOP) {
        onsets.push((offset / sampleRate) * 1000)
        lastOnsetSample = offset
      }
      prevHfc = hfc
    }

    const estimatedBpm = onsets.length >= 4 ? estimateBpmFromOnsets(onsets) : null
    const bpmDrift     = estimatedBpm !== null ? Math.abs(estimatedBpm - this.transportBpm) : 0

    return {
      rmsDb:    isFinite(rmsDb) ? rmsDb : -Infinity,
      peakDb:   isFinite(peakDb) ? peakDb : -Infinity,
      hasClipping,
      isSilent,
      estimatedBpm,
      spectralCentroidHz,
      bandEnergy,
      bpmDrift,
      needsVolumeReduction: hasClipping || (!isSilent && rmsDb > LOUD_DB),
      needsVolumeBoost:     !isSilent && rmsDb < QUIET_DB,
      timestamp: performance.now(),
    }
  }
}

// ── Standalone BPM estimator ─────────────────────────────────────────────────

function estimateBpmFromOnsets(onsetTimesMs: number[]): number | null {
  if (onsetTimesMs.length < 4) return null

  const iois: number[] = []
  for (let i = 1; i < onsetTimesMs.length; i++) {
    const gap = onsetTimesMs[i] - onsetTimesMs[i - 1]
    if (gap >= 200 && gap <= 2000) iois.push(gap)
  }
  if (iois.length < 3) return null

  const candidates: number[] = []
  for (const ioi of iois) {
    for (const mult of [1, 2, 0.5]) {
      const bpm = 60000 / (ioi * mult)
      if (bpm >= 60 && bpm <= 200) candidates.push(bpm)
    }
  }

  const bins = new Map<number, number>()
  for (const bpm of candidates) {
    const r = Math.round(bpm)
    let found = false
    for (const [key] of bins) {
      if (Math.abs(key - r) <= key * 0.08) {
        bins.set(key, (bins.get(key) ?? 0) + 1)
        found = true
        break
      }
    }
    if (!found) bins.set(r, 1)
  }

  let bestBpm = 0, bestCount = 0
  for (const [bpm, count] of bins) {
    if (count > bestCount) { bestCount = count; bestBpm = bpm }
  }

  return bestBpm > 0 ? bestBpm : null
}
