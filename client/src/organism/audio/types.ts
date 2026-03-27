/**
 * Performer + Self-Listen types for Astutely's ears system.
 *
 * PerformerState — what Astutely hears from the human performing
 * SelfListenReport — what Astutely hears from its own output
 */

// ── Performer (mic → Astutely) ────────────────────────────────────────────────

export interface PerformerState {
  /** Estimated BPM from the performer's rhythmic onsets (60–200). */
  bpm: number
  /** 0–1. How stable and repeatable the BPM estimate is. < 0.4 = unreliable. */
  bpmConfidence: number
  /** 0–1. How tightly the performer lands on the rhythmic grid. 1 = metronomic. */
  rhythmTightness: number

  /** 0–3. Which bar of the current 4-bar phrase we're in. */
  phraseBar: number
  /** 0–1. Fractional position inside the current 4-bar phrase. */
  phrasePosition: number
  /** True while the performer is actively rapping/singing. */
  isInPhrase: boolean
  /** True during a detected breath / rest (silence > 400 ms). */
  breathingNow: boolean

  /** 0–1. Smoothed energy envelope (normalised RMS). */
  energy: number
  /** 0–1. Rolling peak energy — used to normalise energy. */
  energyPeak: number
  /** 0–1. Ratio of soft→loud variation. High = expressive, low = flat delivery. */
  dynamicRange: number

  /** Onsets per second — proxy for syllabic rate. */
  syllabicRate: number

  /** 0–1. Spectral brightness of the voice (mapped from spectral centroid). */
  spectralBrightness: number

  /** Timestamp (ms) of the most recent detected onset. */
  lastOnsetMs: number
  /** Frame timestamp when this state was computed. */
  timestamp: number
}

// ── Self-listen (Astutely → Astutely) ────────────────────────────────────────

export interface SelfListenReport {
  /** RMS loudness of Astutely's own output in dBFS. */
  rmsDb: number
  /** Peak loudness in dBFS. */
  peakDb: number
  /** True if any samples are clipping (|x| ≥ 0.99). */
  hasClipping: boolean
  /** True if the output is essentially silent. */
  isSilent: boolean
  /** BPM estimated from the output audio. Null if too short or rhythmless. */
  estimatedBpm: number | null
  /** Spectral centroid in Hz — < 1500 = muddy, 3000–5000 = balanced, > 6000 = harsh. */
  spectralCentroidHz: number
  /** Fraction of energy per frequency band (sums ≈ 1). */
  bandEnergy: {
    sub:     number   // 20–80 Hz
    bass:    number   // 80–250 Hz
    lowMid:  number   // 250–2000 Hz
    highMid: number   // 2000–6000 Hz
    high:    number   // 6000–20 kHz
  }
  /** Difference between Astutely's actual output BPM and the Transport BPM. */
  bpmDrift: number
  /** Auto-correction signals Astutely can act on immediately. */
  needsVolumeReduction: boolean
  needsVolumeBoost:     boolean
  /** Unix-ish timestamp (performance.now()) when this report was generated. */
  timestamp: number
}
