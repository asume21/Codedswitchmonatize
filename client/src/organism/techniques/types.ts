/**
 * PLAYING TECHNIQUE SYSTEM
 *
 * Converts (chord notes, musical context) → per-note scheduled events.
 *
 * The existing ChordGenerator fires all chord notes simultaneously — that's
 * only how a piano actually plays. Real instruments have idiomatic techniques:
 *
 *   - Guitar:  strum (staggered by 15-30ms), arpeggio (sequential 8ths/16ths),
 *              muted stab (palm-muted, very short), single-note lick
 *   - Piano:   block chord, alberti pattern, rolled chord, stride bass
 *   - Strings: legato (sustained), pizzicato (plucked), tremolo (rapid bow)
 *   - Brass:   stab, swell (crescendo), fanfare, sustained section
 *   - Wind:    legato line, staccato, trill, breath attack
 *
 * A `PlayingTechnique` is a pure function: given a chord and context, it
 * returns a list of `ScheduledNote` events with their own time offsets,
 * durations, and velocities. The generator iterates these and fires each
 * note separately through `triggerAttackRelease`.
 */

import type { OrganismMode } from '../physics/types'

/** Instrument family classification — techniques advertise compatibility. */
export type InstrumentFamily =
  | 'plucked'     // guitar, harp, marimba
  | 'bowed'       // violin, cello, contrabass
  | 'keyboard'    // piano, rhodes, organ
  | 'wind'        // flute, sax, clarinet
  | 'brass'       // trumpet, trombone, french horn
  | 'percussion'  // marimba, xylophone (when used melodically)
  | 'synth'       // FM / subtractive / pad
  | 'voice'       // choir, vocal pads

/** Musical context passed to technique schedulers. */
export interface TechniqueContext {
  /** Bar index within the current progression (0-indexed). */
  barIndex: number
  /** Beat position within the bar (0.0 = downbeat, 0.5 = 2-and, etc). */
  beatPosition: number
  /** Swing amount 0-1 (affects offbeat timing of spread techniques). */
  swing: number
  /** Performer energy 0-1 — can drive velocity / spread intensity. */
  energy: number
  /** Current organism mode — some techniques vary by mode. */
  mode: OrganismMode
  /** Tempo in BPM — used to derive note durations and spreads in seconds. */
  tempo: number
  /** Duration this chord occupies, in seconds (e.g. 1 bar = 4 * 60/tempo). */
  chordDurationSec: number
}

/** One note scheduled by a technique. */
export interface ScheduledNote {
  /** Offset from chord start in seconds. */
  timeOffset: number
  /** Note as Tone-compatible string (e.g. "C4") or MIDI number. */
  note: string | number
  /** Duration in Tone.js notation ("8n", "4n") or seconds. */
  duration: string | number
  /** Velocity 0-1. */
  velocity: number
}

export type TechniqueCategory = 'chord' | 'pad' | 'stab' | 'arp' | 'riff' | 'fill'

/** A playing technique — one instrument idiom. */
export interface PlayingTechnique {
  /** Stable identifier (e.g. "guitar-strum-down"). */
  id: string
  /** Human-readable name. */
  name: string
  /** Instrument families this technique is idiomatic for. */
  family: InstrumentFamily[]
  /** Broad category — helps pick by purpose. */
  category: TechniqueCategory
  /** Short description of the sound/feel. */
  description: string
  /** The scheduling function — converts chord+context to note events. */
  schedule: (chordNotes: string[], ctx: TechniqueContext) => ScheduledNote[]
}

/** Registry of all techniques, keyed by id. */
export type TechniqueRegistry = Map<string, PlayingTechnique>

// ─────────────────────────────────────────────────────────────────────
// ARTICULATION (monophonic — for MelodyGenerator / BassGenerator)
// ─────────────────────────────────────────────────────────────────────

/** Context for a single-note articulation. */
export interface ArticulationContext {
  /** Tempo in BPM. */
  tempo: number
  /** Performer energy 0-1. */
  energy: number
  /** Whether this is a phrase downbeat (enables accent techniques). */
  isDownbeat: boolean
  /** Position in 16ths within the bar (0-15). */
  sixteenthPos: number
}

/**
 * An articulation is a transform on a single scheduled note — unlike a
 * chord technique, it does NOT redistribute multiple notes across time.
 * It can:
 *   - adjust duration (legato: lengthen; staccato: shorten)
 *   - add grace notes / slides before the attack
 *   - add ghost notes / decorations after
 *   - modulate velocity (accent / shadow)
 */
export interface Articulation {
  id: string
  name: string
  family: InstrumentFamily[]
  description: string
  /**
   * Transform a single note. Returns an array because some articulations
   * (grace notes, ghost notes, trills) expand one note into multiple.
   * The first event should be the main note at or near timeOffset=0.
   */
  apply: (
    note: string | number,
    originalDuration: string | number,
    originalVelocity: number,
    ctx: ArticulationContext
  ) => ScheduledNote[]
}
