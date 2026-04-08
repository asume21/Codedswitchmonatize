/**
 * InstrumentalAnalyzer — the "ears" for GhostWriter.
 *
 * Accumulates AnalysisFrame data from any audio source (uploaded file,
 * live mic, or WebEar self-listen) and distills it into a MusicalFingerprint
 * that the AI prompt uses to generate fitting lyrics.
 *
 * Key extractions:
 *   • BPM + confidence (onset-based, same algorithm as RhythmTracker)
 *   • Key / Scale detection (pitch-class histogram → root + mode)
 *   • Energy curve (sectioned smoothed RMS)
 *   • Mood classification (spectral centroid + HNR + energy → mood label)
 *   • Rhythmic density (onset rate → sparse/moderate/dense)
 */

import type { AnalysisFrame } from './types'
import type { SelfListenReport } from '../audio/types'

// ── Public types ────────────────────────────────────────────────────────────────

export type MoodLabel = 'dark' | 'bright' | 'aggressive' | 'chill' | 'melancholy' | 'hype'
export type DensityLabel = 'sparse' | 'moderate' | 'dense'

export interface MusicalFingerprint {
  bpm: number
  bpmConfidence: number
  key: string                    // e.g. "Am", "C", "F#m"
  keyConfidence: number
  mode: 'major' | 'minor' | 'blues' | 'unknown'
  energy: number                 // 0–1 average
  energyCurve: number[]          // per-section energy snapshots
  mood: MoodLabel
  rhythmicDensity: DensityLabel
  spectralBrightness: number     // 0–1
  dominantPitchClasses: number[] // top 3 most frequent pitch classes (0-11)
  durationSeconds: number
  onsetRate: number              // onsets per second
}

// ── Constants ────────────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Major and minor scale intervals for key detection
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

// BPM estimation constants (same as RhythmTracker)
const BPM_MIN = 60
const BPM_MAX = 200
const BPM_TOLERANCE = 0.08
const MIN_ONSETS_FOR_BPM = 6
const MAX_ONSET_BUFFER = 64
// Rolling window for spectral/energy accumulators — 2048 frames ≈ 47s at 43fps.
// Keeps memory bounded while retaining enough history for accurate analysis.
const MAX_ACCUMULATOR_SIZE = 2048

// ── Class ────────────────────────────────────────────────────────────────────────

export class InstrumentalAnalyzer {
  // Accumulators
  private onsetTimes: number[] = []
  private pitchClassHistogram = new Float32Array(12)
  private rmsAccumulator: number[] = []
  private centroidAccumulator: number[] = []
  private hnrAccumulator: number[] = []
  private energyAccumulator: number[] = []
  private pitchConfidenceAccumulator: number[] = []
  private frameCount = 0
  private startTime = 0
  private latestTimestamp = 0

  // Smoothed state
  private smoothedBpm = 0
  private bpmConfidence = 0

  /**
   * Feed one AnalysisFrame (from AudioAnalysisEngine, AudioFileSource, etc.).
   * Call this for every frame — the analyzer accumulates over time.
   */
  processFrame(frame: AnalysisFrame): void {
    if (this.frameCount === 0) {
      this.startTime = frame.timestamp
    }
    this.latestTimestamp = frame.timestamp
    this.frameCount++

    // ── Onsets → BPM ──────────────────────────────────────────────────────
    if (frame.onsetDetected) {
      this.onsetTimes.push(frame.onsetTimestamp)
      if (this.onsetTimes.length > MAX_ONSET_BUFFER) this.onsetTimes.shift()
    }

    // ── Pitch → key detection (only use confident pitch readings) ─────────
    if (frame.pitchConfidence > 0.5 && frame.pitch > 0) {
      const midiNote = frame.pitchMidi
      const pitchClass = Math.round(midiNote) % 12
      if (pitchClass >= 0 && pitchClass < 12) {
        this.pitchClassHistogram[pitchClass] += frame.pitchConfidence
      }
    }

    // ── Accumulate spectral / energy features (rolling window) ────────────
    this.rmsAccumulator.push(frame.rms)
    this.centroidAccumulator.push(frame.spectralCentroid)
    this.hnrAccumulator.push(frame.hnr)
    this.energyAccumulator.push(Math.min(1, frame.rms * 5)) // normalized energy
    this.pitchConfidenceAccumulator.push(frame.pitchConfidence)

    // Trim accumulators to rolling window — prevents unbounded memory growth
    if (this.rmsAccumulator.length > MAX_ACCUMULATOR_SIZE) {
      const excess = this.rmsAccumulator.length - MAX_ACCUMULATOR_SIZE
      this.rmsAccumulator.splice(0, excess)
      this.centroidAccumulator.splice(0, excess)
      this.hnrAccumulator.splice(0, excess)
      this.energyAccumulator.splice(0, excess)
      this.pitchConfidenceAccumulator.splice(0, excess)
    }
  }

  /**
   * Feed a SelfListenReport from WebEar (for Organism tapping).
   * Maps the report's fields into the same accumulator state.
   */
  processSelfListenReport(report: SelfListenReport): void {
    // Energy
    this.rmsAccumulator.push(report.rmsLinear)
    this.energyAccumulator.push(Math.min(1, report.rmsLinear * 5))

    // Spectral
    this.centroidAccumulator.push(report.spectralCentroidHz)

    // Onsets — add approximate onset times from the report
    if (report.onsetCount > 0 && report.estimatedBpm) {
      // Derive beat interval and synthesize onset positions
      const beatMs = 60000 / report.estimatedBpm
      const now = report.timestamp
      for (let i = 0; i < Math.min(report.onsetCount, 8); i++) {
        this.onsetTimes.push(now - (report.onsetCount - i) * beatMs)
      }
      if (this.onsetTimes.length > MAX_ONSET_BUFFER) {
        this.onsetTimes = this.onsetTimes.slice(-MAX_ONSET_BUFFER)
      }
    }

    // BPM shortcut — if selfListen already estimated BPM, blend it
    if (report.estimatedBpm && report.estimatedBpm >= BPM_MIN && report.estimatedBpm <= BPM_MAX) {
      if (this.smoothedBpm === 0) {
        this.smoothedBpm = report.estimatedBpm
      } else {
        this.smoothedBpm += 0.15 * (report.estimatedBpm - this.smoothedBpm)
      }
    }

    this.latestTimestamp = report.timestamp
    this.frameCount++
  }

  /**
   * Compute the fingerprint from all accumulated data.
   * Should be called after sufficient frames (8+ seconds of audio).
   */
  getFingerprint(): MusicalFingerprint {
    const durationSeconds = (this.latestTimestamp - this.startTime) / 1000

    // ── BPM ───────────────────────────────────────────────────────────────
    const bpmResult = this.estimateBpm()
    const bpm = bpmResult.bpm > 0 ? bpmResult.bpm : 90
    const bpmConfidence = bpmResult.confidence

    // ── Key detection ─────────────────────────────────────────────────────
    const keyResult = this.detectKey()

    // ── Energy ────────────────────────────────────────────────────────────
    const avgEnergy = this.mean(this.energyAccumulator)
    const energyCurve = this.computeEnergyCurve(8) // 8 sections

    // ── Mood ──────────────────────────────────────────────────────────────
    const avgCentroid = this.mean(this.centroidAccumulator)
    const avgHnr = this.mean(this.hnrAccumulator)
    const mood = this.classifyMood(avgCentroid, avgHnr, avgEnergy)

    // ── Spectral brightness ───────────────────────────────────────────────
    const brightnessNorm = Math.max(0, Math.min(1,
      (avgCentroid - 200) / (8000 - 200)
    ))

    // ── Rhythmic density ──────────────────────────────────────────────────
    const onsetRate = durationSeconds > 0 ? this.onsetTimes.length / durationSeconds : 0
    const density = this.classifyDensity(onsetRate)

    // ── Dominant pitch classes ────────────────────────────────────────────
    const sortedPC = Array.from(this.pitchClassHistogram)
      .map((weight, pc) => ({ pc, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(x => x.pc)

    return {
      bpm: Math.round(bpm),
      bpmConfidence,
      key: keyResult.key,
      keyConfidence: keyResult.confidence,
      mode: keyResult.mode,
      energy: avgEnergy,
      energyCurve,
      mood,
      rhythmicDensity: density,
      spectralBrightness: brightnessNorm,
      dominantPitchClasses: sortedPC,
      durationSeconds,
      onsetRate,
    }
  }

  /** True if enough data has been accumulated for a meaningful fingerprint. */
  isReady(): boolean {
    return this.frameCount >= 40 && (this.latestTimestamp - this.startTime) > 4000
  }

  /** Reset all accumulators for a fresh analysis. */
  reset(): void {
    this.onsetTimes = []
    this.pitchClassHistogram = new Float32Array(12)
    this.rmsAccumulator = []
    this.centroidAccumulator = []
    this.hnrAccumulator = []
    this.energyAccumulator = []
    this.pitchConfidenceAccumulator = []
    this.frameCount = 0
    this.startTime = 0
    this.latestTimestamp = 0
    this.smoothedBpm = 0
    this.bpmConfidence = 0
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private estimateBpm(): { bpm: number; confidence: number } {
    if (this.smoothedBpm > 0 && this.onsetTimes.length < MIN_ONSETS_FOR_BPM) {
      return { bpm: this.smoothedBpm, confidence: 0.3 }
    }
    if (this.onsetTimes.length < MIN_ONSETS_FOR_BPM) {
      return { bpm: 0, confidence: 0 }
    }

    // Build IOI list
    const iois: number[] = []
    for (let i = 1; i < this.onsetTimes.length; i++) {
      const d = this.onsetTimes[i] - this.onsetTimes[i - 1]
      if (d > 50 && d < 4000) iois.push(d)
    }
    if (iois.length < 3) return { bpm: this.smoothedBpm || 0, confidence: 0 }

    // Generate BPM candidates at multiple subdivisions
    const candidates: number[] = []
    for (const ioi of iois) {
      for (const mult of [1, 2, 0.5, 3, 1 / 3]) {
        const bpm = 60000 / (ioi * mult)
        if (bpm >= BPM_MIN && bpm <= BPM_MAX) candidates.push(bpm)
      }
    }

    // Bin-count with tolerance
    const bins = new Map<number, number>()
    for (const bpm of candidates) {
      const rounded = Math.round(bpm)
      let placed = false
      for (const [key] of bins) {
        if (Math.abs(key - rounded) <= key * BPM_TOLERANCE) {
          bins.set(key, (bins.get(key) ?? 0) + 1)
          placed = true
          break
        }
      }
      if (!placed) bins.set(rounded, 1)
    }

    // Winner
    let bestBpm = this.smoothedBpm || 90
    let bestVotes = 0
    for (const [bpm, votes] of bins) {
      if (votes > bestVotes) { bestVotes = votes; bestBpm = bpm }
    }

    const confidence = Math.min(1, bestVotes / candidates.length * 3)

    // Smooth
    if (this.smoothedBpm === 0) {
      this.smoothedBpm = bestBpm
    } else {
      const alpha = 0.08 * Math.min(1, confidence / 0.5)
      this.smoothedBpm += alpha * (bestBpm - this.smoothedBpm)
    }

    return { bpm: Math.round(this.smoothedBpm), confidence }
  }

  /**
   * Krumhansl-Schmuckler key detection algorithm.
   * Correlates the pitch-class histogram against major/minor key profiles
   * rotated to all 12 root notes and picks the best match.
   */
  private detectKey(): { key: string; confidence: number; mode: 'major' | 'minor' | 'blues' | 'unknown' } {
    const totalWeight = this.pitchClassHistogram.reduce((a, b) => a + b, 0)
    if (totalWeight < 5) {
      return { key: 'C', confidence: 0, mode: 'unknown' }
    }

    // Normalize histogram
    const hist = Array.from(this.pitchClassHistogram).map(v => v / totalWeight)

    let bestCorr = -Infinity
    let bestRoot = 0
    let bestMode: 'major' | 'minor' = 'major'

    for (let root = 0; root < 12; root++) {
      // Rotate histogram so `root` is at index 0
      const rotated = hist.map((_, i) => hist[(i + root) % 12])

      const majorCorr = this.pearsonCorrelation(rotated, MAJOR_PROFILE)
      const minorCorr = this.pearsonCorrelation(rotated, MINOR_PROFILE)

      if (majorCorr > bestCorr) {
        bestCorr = majorCorr
        bestRoot = root
        bestMode = 'major'
      }
      if (minorCorr > bestCorr) {
        bestCorr = minorCorr
        bestRoot = root
        bestMode = 'minor'
      }
    }

    const noteName = NOTE_NAMES[bestRoot]
    const keyLabel = bestMode === 'minor' ? `${noteName}m` : noteName
    const confidence = Math.max(0, Math.min(1, (bestCorr + 1) / 2))

    return { key: keyLabel, confidence, mode: bestMode }
  }

  private pearsonCorrelation(a: number[], b: number[]): number {
    const n = a.length
    const meanA = a.reduce((s, v) => s + v, 0) / n
    const meanB = b.reduce((s, v) => s + v, 0) / n

    let num = 0, denA = 0, denB = 0
    for (let i = 0; i < n; i++) {
      const dA = a[i] - meanA
      const dB = b[i] - meanB
      num += dA * dB
      denA += dA * dA
      denB += dB * dB
    }

    const den = Math.sqrt(denA * denB)
    return den > 0 ? num / den : 0
  }

  private classifyMood(centroid: number, hnr: number, energy: number): MoodLabel {
    // Dark: low centroid + low energy
    if (centroid < 1500 && energy < 0.4) return 'dark'
    // Melancholy: lowish centroid + moderate energy + clean tone (high HNR)
    if (centroid < 2500 && energy < 0.5 && hnr > 10) return 'melancholy'
    // Aggressive: high energy + noisy (low HNR)
    if (energy > 0.6 && hnr < 5) return 'aggressive'
    // Hype: high energy + bright
    if (energy > 0.6 && centroid > 3000) return 'hype'
    // Bright: high centroid + moderate energy
    if (centroid > 3000) return 'bright'
    // Default: chill
    return 'chill'
  }

  private classifyDensity(onsetRate: number): DensityLabel {
    if (onsetRate < 2) return 'sparse'
    if (onsetRate < 6) return 'moderate'
    return 'dense'
  }

  private computeEnergyCurve(sections: number): number[] {
    if (this.energyAccumulator.length === 0) return new Array(sections).fill(0)
    const chunkSize = Math.max(1, Math.floor(this.energyAccumulator.length / sections))
    const curve: number[] = []
    for (let i = 0; i < sections; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, this.energyAccumulator.length)
      const chunk = this.energyAccumulator.slice(start, end)
      curve.push(this.mean(chunk))
    }
    return curve
  }

  private mean(arr: number[]): number {
    if (arr.length === 0) return 0
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }
}
