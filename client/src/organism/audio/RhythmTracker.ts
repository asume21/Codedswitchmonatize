/**
 * RhythmTracker — extracts a stable BPM and phrase position from a stream
 * of onset events produced by the AudioAnalysisEngine mic tap.
 *
 * HOW IT WORKS
 * ────────────
 * The AudioAnalysisEngine fires an onset on every syllable (~3-8 per beat for
 * a rapper). We don't want the syllabic rate — we want the underlying beat BPM.
 *
 * Algorithm:
 *  1. Keep a ring buffer of the last MAX_ONSETS onset timestamps.
 *  2. Compute all inter-onset intervals (IOIs).
 *  3. For each IOI, generate BPM candidates at 1x, 2x, 0.5x, 3x, 0.33x multiples
 *     (accounts for the fact that any IOI might be a beat, half-beat, or bar).
 *  4. Bin-count candidates with ±8% tolerance into a histogram.
 *  5. The most-voted bin in the 60-200 BPM range wins.
 *  6. Apply exponential smoothing with ~4-bar inertia so BPM doesn't flicker.
 *  7. Confidence = ratio of winning bin votes to total candidates.
 *
 * Phrase tracking:
 *  Once BPM is stable, we track elapsed bars since the last phrase start
 *  (a phrase starts after a rest > REST_THRESHOLD_MS). phraseBar cycles 0→3.
 */

const MAX_ONSETS         = 32    // ring buffer size
const MIN_ONSETS_FOR_BPM = 8     // need at least this many onsets
const BPM_MIN            = 60
const BPM_MAX            = 200
const BPM_TOLERANCE      = 0.08  // ±8% bin grouping
const SMOOTHING_COEFF    = 0.04  // ~4-bar inertia at 43fps
const REST_THRESHOLD_MS  = 600   // silence longer than this = new phrase
const BARS_PER_PHRASE    = 4

export interface RhythmSnapshot {
  bpm:            number
  bpmConfidence:  number
  rhythmTightness: number
  phraseBar:      number
  phrasePosition: number
  isInPhrase:     boolean
  breathingNow:   boolean
}

export class RhythmTracker {
  private onsetTimes:   number[] = []   // ring buffer of onset timestamps (ms)
  private smoothedBpm:  number   = 90
  private confidence:   number   = 0
  private phraseStart:  number   = 0    // timestamp when phrase began
  private lastOnset:    number   = 0
  private inPhrase:     boolean  = false

  processOnset(timestampMs: number): void {
    this.onsetTimes.push(timestampMs)
    if (this.onsetTimes.length > MAX_ONSETS) this.onsetTimes.shift()
    this.lastOnset = timestampMs

    if (!this.inPhrase) {
      this.inPhrase    = true
      this.phraseStart = timestampMs
    }
  }

  /** Call every analysis frame, even when no onset fires. */
  tick(nowMs: number): RhythmSnapshot {
    const msSinceOnset = nowMs - this.lastOnset
    const breathingNow = this.lastOnset > 0 && msSinceOnset > REST_THRESHOLD_MS

    if (breathingNow && this.inPhrase) {
      this.inPhrase = false
    }

    // Estimate BPM from onset ring buffer
    if (this.onsetTimes.length >= MIN_ONSETS_FOR_BPM) {
      const { bpm, confidence, tightness } = this.estimateBpm()
      this.confidence  = confidence

      if (confidence > 0.15) {
        // Exponential smoothing — less aggressive when confidence is low
        const alpha     = SMOOTHING_COEFF * Math.min(1, confidence / 0.5)
        this.smoothedBpm = this.smoothedBpm + alpha * (bpm - this.smoothedBpm)
      }
    }

    // Phrase position
    const beatDurationMs = 60000 / this.smoothedBpm
    const barDurationMs  = beatDurationMs * 4
    const phraseDurationMs = barDurationMs * BARS_PER_PHRASE

    const msInPhrase     = this.inPhrase ? Math.max(0, nowMs - this.phraseStart) : 0
    const phrasePosition = this.inPhrase ? (msInPhrase % phraseDurationMs) / phraseDurationMs : 0
    const phraseBar      = this.inPhrase ? Math.floor((msInPhrase % phraseDurationMs) / barDurationMs) % BARS_PER_PHRASE : 0

    return {
      bpm:             Math.round(this.smoothedBpm * 10) / 10,
      bpmConfidence:   Math.max(0, Math.min(1, this.confidence)),
      rhythmTightness: this.computeTightness(),
      phraseBar,
      phrasePosition,
      isInPhrase:      this.inPhrase,
      breathingNow,
    }
  }

  reset(): void {
    this.onsetTimes  = []
    this.smoothedBpm = 90
    this.confidence  = 0
    this.phraseStart = 0
    this.lastOnset   = 0
    this.inPhrase    = false
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private estimateBpm(): { bpm: number; confidence: number; tightness: number } {
    const times = this.onsetTimes
    if (times.length < 2) return { bpm: this.smoothedBpm, confidence: 0, tightness: 0 }

    // Build IOI list
    const iois: number[] = []
    for (let i = 1; i < times.length; i++) {
      const ioi = times[i] - times[i - 1]
      if (ioi > 50 && ioi < 4000) iois.push(ioi)  // 15 BPM – 1200 BPM range
    }
    if (iois.length < 3) return { bpm: this.smoothedBpm, confidence: 0, tightness: 0 }

    // Generate BPM candidates from each IOI at multiple subdivisions
    const candidates: number[] = []
    for (const ioi of iois) {
      for (const mult of [1, 2, 0.5, 3, 1/3]) {
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

    // Find winner
    let bestBpm = this.smoothedBpm
    let bestVotes = 0
    for (const [bpm, votes] of bins) {
      if (votes > bestVotes) {
        bestVotes = votes
        bestBpm   = bpm
      }
    }

    const confidence = bestVotes / candidates.length

    // Tightness — how consistent are IOIs around the dominant beat period
    const beatMs = 60000 / bestBpm
    const deviations = iois.map(ioi => {
      // Closest multiple of beatMs
      const ratio = ioi / beatMs
      const nearestMult = Math.round(ratio)
      if (nearestMult === 0) return 1
      const expected = nearestMult * beatMs
      return Math.abs(ioi - expected) / expected
    })
    const avgDev = deviations.reduce((a, b) => a + b, 0) / deviations.length
    const tightness = Math.max(0, 1 - avgDev * 2)

    return { bpm: bestBpm, confidence, tightness }
  }

  private computeTightness(): number {
    if (this.onsetTimes.length < 4) return 0
    const iois: number[] = []
    const times = this.onsetTimes
    for (let i = 1; i < times.length; i++) {
      const d = times[i] - times[i - 1]
      if (d > 50 && d < 4000) iois.push(d)
    }
    if (iois.length < 2) return 0
    const mean = iois.reduce((a, b) => a + b, 0) / iois.length
    const stdDev = Math.sqrt(iois.reduce((s, v) => s + (v - mean) ** 2, 0) / iois.length)
    const cv = stdDev / mean   // coefficient of variation
    return Math.max(0, Math.min(1, 1 - cv * 2))
  }
}
