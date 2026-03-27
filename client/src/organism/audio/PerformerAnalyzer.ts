/**
 * PerformerAnalyzer — gives Astutely ears to hear the human performer.
 *
 * Processes every AnalysisFrame from the AudioAnalysisEngine and computes:
 *   • BPM & rhythm tightness (via RhythmTracker)
 *   • Phrase position (which bar of a 4-bar phrase)
 *   • Energy envelope (smoothed RMS, normalised to rolling peak)
 *   • Syllabic rate (onsets per second)
 *   • Spectral brightness (normalised spectral centroid)
 *   • Breath / rest detection
 *
 * The resulting PerformerState is read by OrganismProvider to:
 *   1. Sync Tone Transport BPM to the performer's detected BPM
 *   2. Scale generator volumes to performer energy
 *   3. Shift arrangement section boundaries to performer phrase edges
 *   4. React to breaths / pauses with call-and-response fills
 */

import type { AnalysisFrame }  from '../analysis/types'
import { RhythmTracker }       from './RhythmTracker'
import type { PerformerState } from './types'

// Smoothing half-lives
const ENERGY_ATTACK_MS   = 20    // fast attack
const ENERGY_RELEASE_MS  = 300   // slow release
const ENERGY_PEAK_DECAY  = 0.998 // per frame peak decay (very slow)
const SYLLABLE_WIN_MS    = 1000  // window for syllabic rate count

const SPECTRAL_MIN_HZ    = 200   // min expected vocal centroid
const SPECTRAL_MAX_HZ    = 8000  // max expected vocal centroid

// ~43fps frame interval
const FRAME_MS = 1000 / 43

function smoothCoeff(halfLifeMs: number): number {
  return 1 - Math.exp(-FRAME_MS / Math.max(1, halfLifeMs))
}

export class PerformerAnalyzer {
  private rhythm        = new RhythmTracker()

  // Energy state
  private smoothedRms:  number = 0
  private peakRms:      number = 0.01  // prevents division by zero

  // Syllabic rate tracking
  private recentOnsets: number[] = []  // onset timestamps within SYLLABLE_WIN_MS

  // Spectral brightness
  private smoothedCentroid: number = 2000

  private lastState: PerformerState = this.blank()

  private attackCoeff  = smoothCoeff(ENERGY_ATTACK_MS)
  private releaseCoeff = smoothCoeff(ENERGY_RELEASE_MS)

  /** Feed one analysis frame. Returns updated PerformerState. */
  processFrame(frame: AnalysisFrame): PerformerState {
    const nowMs = frame.timestamp

    // ── Onsets → rhythm tracker ─────────────────────────────────────────────
    if (frame.onsetDetected) {
      this.rhythm.processOnset(frame.onsetTimestamp)
      this.recentOnsets.push(frame.onsetTimestamp)
    }

    // Prune onset window
    const windowStart = nowMs - SYLLABLE_WIN_MS
    this.recentOnsets = this.recentOnsets.filter(t => t >= windowStart)

    // ── RMS → energy ────────────────────────────────────────────────────────
    const rms    = Math.max(0, frame.rms)
    const rising = rms > this.smoothedRms
    const coeff  = rising ? this.attackCoeff : this.releaseCoeff
    this.smoothedRms = this.smoothedRms + coeff * (rms - this.smoothedRms)

    // Rolling peak with very slow decay
    if (this.smoothedRms > this.peakRms) {
      this.peakRms = this.smoothedRms
    } else {
      this.peakRms = Math.max(0.01, this.peakRms * ENERGY_PEAK_DECAY)
    }

    const energy        = Math.min(1, this.smoothedRms / this.peakRms)
    const dynamicRange  = Math.min(1, this.peakRms * 4)  // rough proxy

    // ── Spectral brightness ──────────────────────────────────────────────────
    const centroidHz = frame.spectralCentroid ?? 2000
    this.smoothedCentroid += 0.08 * (centroidHz - this.smoothedCentroid)
    const spectralBrightness = Math.max(0, Math.min(1,
      (this.smoothedCentroid - SPECTRAL_MIN_HZ) / (SPECTRAL_MAX_HZ - SPECTRAL_MIN_HZ)
    ))

    // ── Rhythm snapshot ──────────────────────────────────────────────────────
    const rhythm = this.rhythm.tick(nowMs)

    // ── Syllabic rate ────────────────────────────────────────────────────────
    const syllabicRate = this.recentOnsets.length  // onsets in last second

    this.lastState = {
      bpm:               rhythm.bpm,
      bpmConfidence:     rhythm.bpmConfidence,
      rhythmTightness:   rhythm.rhythmTightness,
      phraseBar:         rhythm.phraseBar,
      phrasePosition:    rhythm.phrasePosition,
      isInPhrase:        rhythm.isInPhrase,
      breathingNow:      rhythm.breathingNow,
      energy,
      energyPeak:        this.peakRms,
      dynamicRange,
      syllabicRate,
      spectralBrightness,
      lastOnsetMs:       frame.onsetDetected ? frame.onsetTimestamp : this.lastState.lastOnsetMs,
      timestamp:         nowMs,
    }

    return this.lastState
  }

  getState(): PerformerState {
    return this.lastState
  }

  reset(): void {
    this.rhythm.reset()
    this.smoothedRms      = 0
    this.peakRms          = 0.01
    this.smoothedCentroid = 2000
    this.recentOnsets     = []
    this.lastState        = this.blank()
  }

  private blank(): PerformerState {
    return {
      bpm: 90, bpmConfidence: 0, rhythmTightness: 0,
      phraseBar: 0, phrasePosition: 0, isInPhrase: false, breathingNow: false,
      energy: 0, energyPeak: 0.01, dynamicRange: 0,
      syllabicRate: 0, spectralBrightness: 0.4,
      lastOnsetMs: 0, timestamp: 0,
    }
  }
}
