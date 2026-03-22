import { countSyllables } from './utils/countSyllables'

/**
 * CADENCE LOCK ENGINE
 *
 * Analyzes the rapper's syllable timing from the FreestyleTranscriber
 * and continuously nudges the beat BPM to match the natural cadence.
 *
 * How it works:
 *  1. Receives timestamped transcription lines from the FreestyleTranscriber
 *  2. Estimates syllable rate by counting syllables per line and dividing
 *     by line duration
 *  3. Converts syllable rate to an implied BPM (syllables typically land
 *     on 16th-note subdivisions, so syllRate * 15 ≈ BPM)
 *  4. Applies exponential smoothing to avoid BPM jitter
 *  5. Emits a target BPM that the OrganismProvider can feed to the orchestrator
 *
 * The lock has configurable:
 *  - sensitivity: how quickly it adapts (0-1)
 *  - bpmRange: min/max allowable BPM
 *  - lockThreshold: how close estimated vs current BPM must be to "lock"
 *  - enabled: on/off toggle
 */

export interface CadenceLockConfig {
  sensitivity:     number   // 0-1, how fast BPM adapts (default 0.3)
  bpmMin:          number   // floor BPM (default 60)
  bpmMax:          number   // ceiling BPM (default 200)
  lockThreshold:   number   // BPM must be within this to count as "locked" (default 5)
  syllableMultiplier: number // syllables/sec → BPM conversion factor (default 15)
}

export interface CadenceSnapshot {
  estimatedBpm:    number
  smoothedBpm:     number
  syllableRate:    number   // syllables per second
  isLocked:        boolean  // true if smoothedBpm is within lockThreshold of current BPM
  confidence:      number   // 0-1 based on sample count
  sampleCount:     number
}

export type CadenceCallback = (snapshot: CadenceSnapshot) => void

const DEFAULT_CONFIG: CadenceLockConfig = {
  sensitivity:         0.3,
  bpmMin:              60,
  bpmMax:              200,
  lockThreshold:       5,
  syllableMultiplier:  15,
}

interface TimedLine {
  text:      string
  startTime: number
  endTime:   number
  syllables: number
}

export class CadenceLock {
  private config:      CadenceLockConfig
  private callbacks:   CadenceCallback[] = []
  private enabled:     boolean = true
  private smoothedBpm: number = 0
  private samples:     TimedLine[] = []
  private maxSamples:  number = 20
  private currentBpm:  number = 0

  constructor(config?: Partial<CadenceLockConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Register a callback for cadence snapshots. Returns unsubscribe function. */
  onUpdate(cb: CadenceCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb)
    }
  }

  /** Set the current beat BPM so we can determine if locked. */
  setCurrentBpm(bpm: number): void {
    this.currentBpm = bpm
  }

  /** Toggle cadence locking on/off. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /** Update config at runtime. */
  updateConfig(partial: Partial<CadenceLockConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  /**
   * Feed a completed transcription line with timing info.
   * Call this when a line is finalized by the FreestyleTranscriber.
   */
  processLine(text: string, startTime: number, endTime: number): CadenceSnapshot | null {
    if (!this.enabled) return null

    const duration = (endTime - startTime) / 1000 // seconds
    if (duration <= 0.2) return null // too short to be meaningful

    const syllables = countSyllables(text)
    if (syllables < 2) return null // need at least 2 syllables for a rate

    const timedLine: TimedLine = { text, startTime, endTime, syllables }
    this.samples.push(timedLine)
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples)
    }

    return this.computeSnapshot()
  }

  /** Get the current cadence snapshot without feeding new data. */
  getSnapshot(): CadenceSnapshot | null {
    if (this.samples.length === 0) return null
    return this.computeSnapshot()
  }

  /** Reset all accumulated data. */
  reset(): void {
    this.samples = []
    this.smoothedBpm = 0
  }

  /** Clean up. */
  dispose(): void {
    this.callbacks = []
    this.samples = []
    this.enabled = false
  }

  private computeSnapshot(): CadenceSnapshot {
    // Compute weighted average syllable rate from recent lines
    // More recent lines get higher weight
    let totalRate = 0
    let totalWeight = 0

    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i]
      const duration = (s.endTime - s.startTime) / 1000
      const rate = s.syllables / duration
      const weight = (i + 1) / this.samples.length // recency weight
      totalRate += rate * weight
      totalWeight += weight
    }

    const syllableRate = totalWeight > 0 ? totalRate / totalWeight : 0

    // Convert syllable rate to implied BPM
    // Assumption: syllables land roughly on 16th notes
    // 4 sixteenths per beat → syllRate / 4 * 60 = BPM
    // But this is genre-dependent, so we use a configurable multiplier
    const rawBpm = syllableRate * this.config.syllableMultiplier
    const clampedBpm = Math.max(this.config.bpmMin, Math.min(this.config.bpmMax, rawBpm))

    // Exponential smoothing
    if (this.smoothedBpm === 0) {
      this.smoothedBpm = clampedBpm
    } else {
      const alpha = this.config.sensitivity
      this.smoothedBpm = alpha * clampedBpm + (1 - alpha) * this.smoothedBpm
    }

    // Round to nearest integer BPM
    const smoothedBpmRounded = Math.round(this.smoothedBpm)

    // Confidence based on sample count (caps at 1.0 around 10 samples)
    const confidence = Math.min(1, this.samples.length / 10)

    // Check if locked
    const isLocked = Math.abs(smoothedBpmRounded - this.currentBpm) <= this.config.lockThreshold

    const snapshot: CadenceSnapshot = {
      estimatedBpm:  Math.round(clampedBpm),
      smoothedBpm:   smoothedBpmRounded,
      syllableRate:  Math.round(syllableRate * 100) / 100,
      isLocked,
      confidence,
      sampleCount:   this.samples.length,
    }

    for (const cb of this.callbacks) {
      try { cb(snapshot) } catch { /* swallow */ }
    }

    return snapshot
  }
}
