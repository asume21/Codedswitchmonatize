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
//
// Powered by pcmAnalyzer.ts — the same WebEar-grade DSP engine that Claude Code
// uses, but running entirely client-side with zero API calls.

export interface SelfListenReport {
  // ── Loudness ─────────────────────────────────────────────────────────────
  /** Linear RMS (0–1 range, for math). */
  rmsLinear: number
  /** RMS loudness of Astutely's own output in dBFS. */
  rmsDb: number
  /** Linear peak (0–1 range). */
  peakLinear: number
  /** Peak loudness in dBFS. */
  peakDb: number
  /** Exact percentage of samples that are clipping. */
  clippingPercent: number
  /** True if clippingPercent > 0.01%. */
  hasClipping: boolean
  /** True if the output is essentially silent. */
  isSilent: boolean

  // ── Tonality ─────────────────────────────────────────────────────────────
  /** FFT-based spectral centroid in Hz — < 1500 = muddy, 3–5kHz = balanced, > 6kHz = harsh. */
  spectralCentroidHz: number
  /** DC offset — should be ~0; > 0.01 indicates a filter or gain bug. */
  dcOffset: number
  /** True if |dcOffset| > 0.01. */
  hasDcOffset: boolean

  // ── Dynamics ─────────────────────────────────────────────────────────────
  /** Peak dB minus RMS dB — low = crushed, high = very dynamic. */
  dynamicRangeDb: number
  /** Peak / RMS ratio — < 2 = over-compressed, no transients surviving. */
  crestFactor: number

  // ── Frequency bands ──────────────────────────────────────────────────────
  /** Fraction of energy per frequency band (sums ~ 1). */
  bandEnergy: {
    sub:     number   // 20–80 Hz
    bass:    number   // 80–250 Hz
    lowMid:  number   // 250–2000 Hz
    highMid: number   // 2000–6000 Hz
    high:    number   // 6000–20 kHz
  }

  // ── Rhythm ───────────────────────────────────────────────────────────────
  /** BPM estimated from the output audio. Null if too short or rhythmless. */
  estimatedBpm: number | null
  /** Number of detected onsets — rhythmic density metric. */
  onsetCount: number
  /** Standard deviation of inter-onset intervals in ms — low = tight groove, high = sloppy. */
  onsetTimingStdDevMs: number
  /** Difference between actual output BPM and the Transport BPM. */
  bpmDrift: number

  // ── Action signals ───────────────────────────────────────────────────────
  /** Auto-correction signals Astutely can act on immediately. */
  needsVolumeReduction: boolean
  needsVolumeBoost:     boolean

  // ── Meta ─────────────────────────────────────────────────────────────────
  /** Human-readable summary — can be fed to Astutely AI prompts. */
  summary: string
  /** Timestamp (performance.now()) when this report was generated. */
  timestamp: number
}
