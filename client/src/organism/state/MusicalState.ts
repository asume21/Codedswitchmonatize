// Section 04 — MusicalState
//
// The single source of truth for the Organism's musical intelligence.
// All generators read from this state; the MusicalDirector writes to it.
// Astutely observes it via the bridge. No generator maintains private
// global musical state — everything flows through here.

import type { OrganismMode } from '../physics/types'
import type { BassBehavior, MelodyBehavior } from '../generators/types'

// ── Groove Parameters ─────────────────────────────────────────────────
// These coordinate timing feel across ALL generators simultaneously.
// A real producer sets one "feel" for the whole beat — not per-instrument.

export interface GrooveParams {
  /** Master swing amount 0–1 (0 = straight, 0.65 = heavy Dilla pocket) */
  swing: number
  /** Per-instrument swing offsets — lets kick lag while hats push */
  instrumentSwing: {
    kick:   number   // offset from master swing (-0.1 to +0.1)
    snare:  number
    hat:    number
    bass:   number
    melody: number
  }
  /** Humanization spread — how much random timing jitter (ms) */
  humanize: number
  /** Velocity accent weight — how much stronger downbeats are vs upbeats */
  accentWeight: number
  /** Ghost note probability 0–1 — how many ghost notes get added */
  ghostDensity: number
}

// ── Sub-genre Classification ──────────────────────────────────────────
// More specific than OrganismMode — this tells pattern libraries exactly
// which rhythmic vocabulary to use.

export type HipHopSubGenre =
  | 'boom-bap'      // Classic 90s MPC, heavy swing
  | 'trap'          // Atlanta 808s, hi-hat rolls
  | 'drill'         // UK/Chicago drill, sliding 808s
  | 'lo-fi'         // Dusty, detuned, tape feel
  | 'west-coast'    // G-funk, Parliament bounce
  | 'dirty-south'   // Crunk, heavy bass, call-response
  | 'phonk'         // Memphis, cowbell, dark reverb
  | 'jersey-club'   // Bed-squeak, 130+ BPM, chopped vocals
  | 'bounce'        // New Orleans, Triggerman pattern
  | 'reggaeton'     // Dembow riddim, reggaeton beat
  | 'afrobeat'      // Afrobeats/amapiano influenced
  | 'chill'         // Atmospheric, sparse, dreamy

// ── Per-Engine Directives ─────────────────────────────────────────────
// The MusicalDirector fills these each frame. Generators read them
// instead of making their own musical decisions.

export interface DrumDirective {
  /** Which sub-genre pattern to use */
  subGenre: HipHopSubGenre
  /** Current pattern variant index (for switching between patterns within a sub-genre) */
  variantIndex: number
  /** Hat density multiplier from voice reactivity */
  hatDensityMult: number
  /** Kick velocity multiplier from energy mirroring */
  kickVelocityMult: number
  /** Should drums be muted this section (instrument dropout) */
  dropout: boolean
  /** Fill requested (end of section) */
  fillRequested: boolean
  /** Groove params override (if different from global) */
  grooveOverride: Partial<GrooveParams> | null
}

export interface BassDirective {
  /** Which bass behavior to use */
  behavior: BassBehavior
  /** Root MIDI note (set by chord-awareness, not random) */
  rootMidi: number
  /** Whether 808 slide/portamento is active */
  slideEnabled: boolean
  /** Portamento time in seconds (0 = no slide) */
  portamentoTime: number
  /** Filter cutoff target (Hz) */
  filterCutoff: number
  /** Volume multiplier from reactivity */
  volumeMult: number
  /** Should bass be muted this section (instrument dropout) */
  dropout: boolean
}

export interface MelodyDirective {
  /** Current melody behavior */
  behavior: MelodyBehavior
  /** Pitch offset in semitones from reactivity */
  pitchOffsetSemitones: number
  /** Volume multiplier from reactivity */
  volumeMult: number
  /** Current chord tones to target on strong beats */
  chordTones: number[]
  /** Should melody be muted this section (instrument dropout) */
  dropout: boolean
}

export interface ChordDirective {
  /** Volume multiplier */
  volumeMult: number
  /** Should chords be muted this section */
  dropout: boolean
}

export interface TextureDirective {
  /** Whether texture is enabled */
  enabled: boolean
  /** Volume multiplier */
  volumeMult: number
}

// ── Arrangement Section ───────────────────────────────────────────────

export type ArrangementSection =
  | 'intro' | 'verse' | 'pre-chorus' | 'build'
  | 'drop' | 'breakdown' | 'verse2' | 'drop2' | 'bridge' | 'outro'

// ── The Unified Musical State ─────────────────────────────────────────
//
// This is the ONE object that represents everything the Organism knows
// about the current musical context. The MusicalDirector updates it
// every frame. Generators read from it. Astutely observes it.

export interface MusicalState {
  // ── Global musical context ──────────────────────────────────────
  /** Current key root as pitch class 0–11 (C=0, C#=1, ..., B=11) */
  rootPitchClass: number
  /** Current scale intervals from root */
  scaleIntervals: number[]
  /** Current tempo (BPM) */
  tempo: number
  /** Current OrganismMode (coarse genre) */
  mode: OrganismMode
  /** Current sub-genre (fine-grained pattern selection) */
  subGenre: HipHopSubGenre
  /** Current arrangement section */
  section: ArrangementSection
  /** Current bar within the arrangement cycle */
  sectionBar: number
  /** Total bars in current arrangement cycle */
  arrangementTotalBars: number

  // ── Energy / dynamics ───────────────────────────────────────────
  /** Overall energy level 0–1 (from physics presence + density) */
  energy: number
  /** Note density 0–1 (how many notes per beat across all generators) */
  density: number
  /** Voice active flag */
  voiceActive: boolean
  /** Flow depth 0–1 */
  flowDepth: number

  // ── Groove (shared timing feel) ─────────────────────────────────
  groove: GrooveParams

  // ── Per-engine directives ───────────────────────────────────────
  drums:   DrumDirective
  bass:    BassDirective
  melody:  MelodyDirective
  chords:  ChordDirective
  texture: TextureDirective

  // ── Chord awareness ─────────────────────────────────────────────
  /** Current chord intervals (from ChordGenerator) */
  currentChordIntervals: number[]
  /** Current chord root offset from tonic */
  currentChordRootOffset: number
  /** Current chord label (e.g. "im7") */
  currentChordLabel: string

  // ── Self-listen corrections ─────────────────────────────────────
  /** Master gain correction factor from self-listen (0.6–1.15) */
  selfListenGainCorrection: number

  // ── Mutation state ──────────────────────────────────────────────
  /** How many bars since last pattern mutation */
  barsSinceLastMutation: number
  /** Pattern mutation probability 0–1 (increases over time) */
  mutationProbability: number

  // ── Timestamps ──────────────────────────────────────────────────
  frameIndex: number
  timestamp: number
}

// ── Mode → Sub-genre mapping ──────────────────────────────────────────
// Maps coarse OrganismMode to available sub-genres. The MusicalDirector
// picks from these based on physics signals.

export const MODE_SUBGENRES: Record<string, HipHopSubGenre[]> = {
  heat:   ['trap', 'dirty-south', 'phonk', 'jersey-club'],
  ice:    ['lo-fi', 'chill', 'west-coast'],
  smoke:  ['boom-bap', 'west-coast', 'afrobeat', 'dirty-south'],
  gravel: ['drill', 'phonk', 'trap'],
  glow:   ['chill', 'lo-fi', 'reggaeton', 'bounce'],
}

// ── Sub-genre → Groove defaults ───────────────────────────────────────
// Each sub-genre has a characteristic groove feel. These are starting
// points — the MusicalDirector adjusts them based on physics.

export const SUBGENRE_GROOVES: Record<HipHopSubGenre, GrooveParams> = {
  'boom-bap': {
    swing: 0.60, humanize: 22, accentWeight: 0.8, ghostDensity: 0.6,
    instrumentSwing: { kick: -0.03, snare: 0.0, hat: 0.02, bass: -0.02, melody: 0.01 },
  },
  'trap': {
    swing: 0.20, humanize: 12, accentWeight: 0.7, ghostDensity: 0.4,
    instrumentSwing: { kick: 0.0, snare: 0.0, hat: 0.0, bass: 0.0, melody: 0.02 },
  },
  'drill': {
    swing: 0.22, humanize: 10, accentWeight: 0.75, ghostDensity: 0.35,
    instrumentSwing: { kick: 0.02, snare: 0.0, hat: -0.01, bass: 0.03, melody: 0.0 },
  },
  'lo-fi': {
    swing: 0.48, humanize: 28, accentWeight: 0.65, ghostDensity: 0.5,
    instrumentSwing: { kick: -0.04, snare: 0.0, hat: 0.03, bass: -0.03, melody: 0.02 },
  },
  'west-coast': {
    swing: 0.52, humanize: 18, accentWeight: 0.72, ghostDensity: 0.55,
    instrumentSwing: { kick: -0.02, snare: 0.01, hat: 0.03, bass: -0.01, melody: 0.02 },
  },
  'dirty-south': {
    swing: 0.35, humanize: 15, accentWeight: 0.85, ghostDensity: 0.45,
    instrumentSwing: { kick: 0.0, snare: -0.01, hat: 0.02, bass: 0.0, melody: 0.01 },
  },
  'phonk': {
    swing: 0.28, humanize: 14, accentWeight: 0.9, ghostDensity: 0.3,
    instrumentSwing: { kick: 0.0, snare: 0.0, hat: 0.01, bass: 0.0, melody: 0.0 },
  },
  'jersey-club': {
    swing: 0.15, humanize: 8, accentWeight: 0.82, ghostDensity: 0.25,
    instrumentSwing: { kick: 0.0, snare: 0.0, hat: -0.02, bass: 0.0, melody: 0.0 },
  },
  'bounce': {
    swing: 0.42, humanize: 20, accentWeight: 0.78, ghostDensity: 0.5,
    instrumentSwing: { kick: -0.02, snare: 0.01, hat: 0.02, bass: -0.01, melody: 0.01 },
  },
  'reggaeton': {
    swing: 0.10, humanize: 10, accentWeight: 0.88, ghostDensity: 0.2,
    instrumentSwing: { kick: 0.0, snare: 0.0, hat: 0.0, bass: 0.0, melody: 0.02 },
  },
  'afrobeat': {
    swing: 0.35, humanize: 16, accentWeight: 0.7, ghostDensity: 0.55,
    instrumentSwing: { kick: 0.02, snare: -0.01, hat: 0.03, bass: 0.01, melody: 0.02 },
  },
  'chill': {
    swing: 0.38, humanize: 25, accentWeight: 0.55, ghostDensity: 0.4,
    instrumentSwing: { kick: -0.03, snare: 0.0, hat: 0.02, bass: -0.02, melody: 0.03 },
  },
}

// ── Sub-genre → BPM ranges ────────────────────────────────────────────

export const SUBGENRE_BPM: Record<HipHopSubGenre, [number, number]> = {
  'boom-bap':    [85, 100],
  'trap':        [130, 160],
  'drill':       [140, 150],
  'lo-fi':       [70, 90],
  'west-coast':  [90, 108],
  'dirty-south': [70, 85],
  'phonk':       [130, 145],
  'jersey-club': [130, 145],
  'bounce':      [95, 110],
  'reggaeton':   [88, 100],
  'afrobeat':    [100, 115],
  'chill':       [75, 95],
}

// ── Factory: create a default MusicalState ────────────────────────────

export function createDefaultMusicalState(): MusicalState {
  return {
    rootPitchClass: 0,
    scaleIntervals: [0, 3, 5, 7, 10],  // minor pentatonic default
    tempo: 90,
    mode: 'glow' as OrganismMode,
    subGenre: 'chill',
    section: 'intro',
    sectionBar: 0,
    arrangementTotalBars: 28,
    energy: 0,
    density: 0,
    voiceActive: false,
    flowDepth: 0,
    groove: { ...SUBGENRE_GROOVES['chill'] },
    drums: {
      subGenre: 'chill',
      variantIndex: 0,
      hatDensityMult: 1.0,
      kickVelocityMult: 1.0,
      dropout: false,
      fillRequested: false,
      grooveOverride: null,
    },
    bass: {
      behavior: 'breathe' as BassBehavior,
      rootMidi: 36,
      slideEnabled: false,
      portamentoTime: 0,
      filterCutoff: 350,
      volumeMult: 1.0,
      dropout: false,
    },
    melody: {
      behavior: 'rest' as MelodyBehavior,
      pitchOffsetSemitones: 0,
      volumeMult: 1.0,
      chordTones: [0, 4, 7],
      dropout: false,
    },
    chords: {
      volumeMult: 1.0,
      dropout: false,
    },
    texture: {
      enabled: false,
      volumeMult: 1.0,
    },
    currentChordIntervals: [0, 4, 7],
    currentChordRootOffset: 0,
    currentChordLabel: 'I',
    selfListenGainCorrection: 1.0,
    barsSinceLastMutation: 0,
    mutationProbability: 0,
    frameIndex: 0,
    timestamp: 0,
  }
}
