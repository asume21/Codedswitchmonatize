/**
 * ARTICULATION LIBRARY
 *
 * Single-note transforms for monophonic generators (Melody, Bass).
 * Unlike the chord techniques in library.ts — which split a chord across
 * time — an articulation modifies how a single pre-composed note is played:
 * legato lengthens & smooths, staccato shortens, grace-note adds a flick,
 * slide-up prepends a chromatic walk-in, ghost adds a shadow.
 *
 * The pattern is: the generator composes its phrase as usual, then each
 * event gets passed through an articulation before being triggered.
 * Articulation = 'none' is the identity — passes the note through unchanged.
 */

import * as Tone from 'tone'
import type { Articulation, ScheduledNote, ArticulationContext } from './types'

/** No articulation — identity pass-through. Default behavior. */
const NoneArticulation: Articulation = {
  id: 'none',
  name: 'None (Straight)',
  family: ['plucked', 'bowed', 'keyboard', 'wind', 'brass', 'percussion', 'synth'],
  description: 'No articulation — pass note through unchanged',
  apply: (note, duration, velocity) => [
    { timeOffset: 0, note, duration, velocity },
  ],
}

// ─────────────────────────────────────────────────────────────────────
// MELODY / WIND ARTICULATIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Legato slur — lengthens the note to bleed into the next attack, softens
 * velocity slightly. Think sax/flute sustained lines.
 */
const LegatoSlur: Articulation = {
  id: 'legato-slur',
  name: 'Legato Slur',
  family: ['wind', 'brass', 'bowed'],
  description: 'Lengthens note ~120% for smooth connection, softer attack',
  apply: (note, duration, velocity) => {
    // Extend duration by 20% to slur into next note. Wrap Tone.Time in
    // try/catch — in test/jsdom environments Tone's time parser may throw,
    // in which case we fall back to the original duration (still slurred via
    // softer velocity alone).
    let extDur: string | number = duration
    try {
      if (typeof duration === 'number') {
        extDur = duration * 1.2
      } else {
        const secs = Tone.Time(duration).toSeconds()
        if (typeof secs === 'number' && secs > 0) {
          extDur = secs * 1.2
        }
      }
    } catch { /* keep original duration */ }
    return [{
      timeOffset: 0,
      note,
      duration: extDur,
      velocity: velocity * 0.9,
    }]
  },
}

/**
 * Staccato pop — very short, detached. Feels like tongued attacks on wind,
 * or pizz on strings.
 */
const StaccatoPop: Articulation = {
  id: 'staccato-pop',
  name: 'Staccato Pop',
  family: ['wind', 'brass', 'plucked', 'bowed'],
  description: 'Very short duration, crisp attack — tongued/plucked feel',
  apply: (note, _duration, velocity) => [
    { timeOffset: 0, note, duration: '32n', velocity: Math.min(1, velocity * 1.05) },
  ],
}

/**
 * Grace-note flick — prepends a 32nd-note just below the target pitch.
 * Classic flute/sax ornamentation. Works with string-form note names (e.g. "C4").
 */
const GraceFlick: Articulation = {
  id: 'grace-flick',
  name: 'Grace-Note Flick',
  family: ['wind', 'brass', 'bowed', 'keyboard'],
  description: 'Adds a scale-step grace note just before the target — ornament flick',
  apply: (note, duration, velocity, ctx) => {
    // Compute a grace pitch 1-2 semitones below the target
    try {
      const midi = Tone.Frequency(note as any).toMidi()
      const graceMidi = midi - 2
      const graceNote = Tone.Frequency(graceMidi, 'midi').toNote()
      const graceDurSec = Math.max(0.03, 60 / ctx.tempo / 16)  // roughly a 64th
      return [
        {
          timeOffset: -graceDurSec,  // starts slightly before beat
          note: graceNote,
          duration: '64n',
          velocity: velocity * 0.6,
        },
        {
          timeOffset: 0,
          note,
          duration,
          velocity,
        },
      ]
    } catch {
      // Fallback: just play the note
      return [{ timeOffset: 0, note, duration, velocity }]
    }
  },
}

/**
 * Trill ornament — rapid alternation between main note and 2 semitones up,
 * only on downbeats. Quick flourish on flute/sax.
 */
const TrillOrnament: Articulation = {
  id: 'trill-ornament',
  name: 'Trill Ornament',
  family: ['wind', 'brass', 'bowed', 'keyboard'],
  description: 'Rapid trill on downbeats (2 semitones up/down 4x), otherwise passthrough',
  apply: (note, duration, velocity, ctx) => {
    if (!ctx.isDownbeat) {
      return [{ timeOffset: 0, note, duration, velocity }]
    }
    try {
      const midi = Tone.Frequency(note as any).toMidi()
      const upper = Tone.Frequency(midi + 2, 'midi').toNote()
      const stepSec = 60 / ctx.tempo / 16  // 32nd note
      return [
        { timeOffset: 0,           note,  duration: '32n', velocity },
        { timeOffset: stepSec,     note: upper, duration: '32n', velocity: velocity * 0.85 },
        { timeOffset: stepSec * 2, note,  duration: '32n', velocity: velocity * 0.85 },
        { timeOffset: stepSec * 3, note: upper, duration: '32n', velocity: velocity * 0.80 },
        { timeOffset: stepSec * 4, note,  duration, velocity },
      ]
    } catch {
      return [{ timeOffset: 0, note, duration, velocity }]
    }
  },
}

// ─────────────────────────────────────────────────────────────────────
// BASS ARTICULATIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Slide-up — prepends a chromatic glide from 2 semitones below. Classic
 * 808 slide / upright bass entrance.
 */
const BassSlideUp: Articulation = {
  id: 'bass-slide-up',
  name: 'Bass Slide-Up',
  family: ['plucked', 'synth'],
  description: 'Chromatic glide from 2 semitones below — 808 slide / upright fill',
  apply: (note, duration, velocity, ctx) => {
    try {
      const midi = Tone.Frequency(note as any).toMidi()
      const startMidi = midi - 2
      const startNote = Tone.Frequency(startMidi, 'midi').toNote()
      const glideSec = 60 / ctx.tempo / 8  // 32nd note lead-in
      return [
        {
          timeOffset: -glideSec,
          note: startNote,
          duration: '32n',
          velocity: velocity * 0.7,
        },
        {
          timeOffset: 0,
          note,
          duration,
          velocity,
        },
      ]
    } catch {
      return [{ timeOffset: 0, note, duration, velocity }]
    }
  },
}

/**
 * Ghost note — adds a very soft shadow note 16th before the main attack.
 * Builds groove pocket on funk/boom-bap bass lines.
 */
const BassGhostNote: Articulation = {
  id: 'bass-ghost-note',
  name: 'Bass Ghost Note',
  family: ['plucked', 'synth'],
  description: 'Soft shadow note a 16th before main attack — groove pocket',
  apply: (note, duration, velocity, ctx) => {
    // Only add ghost on off-16ths to avoid clutter on every note
    if (ctx.sixteenthPos % 4 === 0) {
      return [{ timeOffset: 0, note, duration, velocity }]
    }
    const sixteenthSec = 60 / ctx.tempo / 4
    return [
      {
        timeOffset: -sixteenthSec * 0.5,
        note,
        duration: '32n',
        velocity: velocity * 0.25,  // very soft
      },
      {
        timeOffset: 0,
        note,
        duration,
        velocity,
      },
    ]
  },
}

/**
 * Octave jump — doubles the note up an octave on downbeats. Disco/funk bass feel.
 */
const BassOctaveJump: Articulation = {
  id: 'bass-octave-jump',
  name: 'Bass Octave Jump',
  family: ['plucked', 'synth'],
  description: 'Adds an octave-up hit on downbeats — disco/funk walk-up',
  apply: (note, duration, velocity, ctx) => {
    if (!ctx.isDownbeat) {
      return [{ timeOffset: 0, note, duration, velocity }]
    }
    // Compute the octave-up pitch. If note is already a MIDI number, add 12
    // directly; if a string like "E2" try Tone.Frequency; on any failure fall
    // back to a second hit of the same note (still sounds like a double-pluck).
    let octaveUp: string | number = note
    let halfSec = 60 / ctx.tempo / 2  // default: half of a beat at this tempo
    try {
      if (typeof note === 'number') {
        octaveUp = note + 12
      } else {
        const midi = Tone.Frequency(note as any).toMidi()
        if (typeof midi === 'number' && Number.isFinite(midi)) {
          octaveUp = Tone.Frequency(midi + 12, 'midi').toNote()
        }
      }
      const t = typeof duration === 'number' ? duration : Tone.Time(duration).toSeconds()
      if (typeof t === 'number' && Number.isFinite(t) && t > 0) {
        halfSec = t / 2
      }
    } catch { /* retain fallbacks */ }
    return [
      { timeOffset: 0,        note,             duration: halfSec, velocity },
      { timeOffset: halfSec,  note: octaveUp,   duration: halfSec, velocity: velocity * 0.85 },
    ]
  },
}

/**
 * Walking-bass step — adds a passing note a beat before the main hit.
 * Jazz/boom-bap upright bass idiom.
 */
const BassWalkingStep: Articulation = {
  id: 'bass-walking-step',
  name: 'Bass Walking Step',
  family: ['plucked', 'synth'],
  description: 'Passing note an 8th before main — jazz upright walk',
  apply: (note, duration, velocity, ctx) => {
    if (ctx.sixteenthPos % 8 !== 0) {
      // Only add walk on strong beats
      return [{ timeOffset: 0, note, duration, velocity }]
    }
    try {
      const midi = Tone.Frequency(note as any).toMidi()
      // Walk from a 5th below or 2nd below randomly
      const walkMidi = midi - (Math.random() > 0.5 ? 2 : 5)
      const walkNote = Tone.Frequency(walkMidi, 'midi').toNote()
      const eighthSec = 60 / ctx.tempo / 2
      return [
        {
          timeOffset: -eighthSec,
          note: walkNote,
          duration: '8n',
          velocity: velocity * 0.75,
        },
        {
          timeOffset: 0,
          note,
          duration,
          velocity,
        },
      ]
    } catch {
      return [{ timeOffset: 0, note, duration, velocity }]
    }
  },
}

// ─────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────

export const ALL_ARTICULATIONS: Articulation[] = [
  NoneArticulation,
  // Melody / wind
  LegatoSlur,
  StaccatoPop,
  GraceFlick,
  TrillOrnament,
  // Bass
  BassSlideUp,
  BassGhostNote,
  BassOctaveJump,
  BassWalkingStep,
]

export const ARTICULATIONS_BY_ID: Map<string, Articulation> = new Map(
  ALL_ARTICULATIONS.map(a => [a.id, a])
)

export function getArticulation(id: string): Articulation | undefined {
  return ARTICULATIONS_BY_ID.get(id)
}

export const DEFAULT_ARTICULATION_ID = 'none'

/**
 * Apply an articulation to a single note. Convenience wrapper for generators.
 * Returns the array of scheduled events (the articulation may expand one note
 * into multiple for grace notes, ghost notes, etc).
 */
export function applyArticulation(
  articulationId: string,
  note: string | number,
  duration: string | number,
  velocity: number,
  ctx: ArticulationContext
): ScheduledNote[] {
  const art = ARTICULATIONS_BY_ID.get(articulationId) ?? NoneArticulation
  return art.apply(note, duration, velocity, ctx)
}

// ─────────────────────────────────────────────────────────────────────
// MODE → ARTICULATION DEFAULTS (melody + bass)
// ─────────────────────────────────────────────────────────────────────
// Matches the aesthetic of MODE_DEFAULT_TECHNIQUE in library.ts.
//
//   heat   → Trap → staccato-pop / bass-octave-jump  (punchy, rhythmic)
//   ice    → Cloud → legato-slur / bass-slide-up     (smooth, floaty)
//   smoke  → Boom-bap → grace-flick / bass-walking   (jazzy ornament)
//   gravel → Drill → staccato-pop / bass-ghost       (tight, pocket)
//   glow   → R&B → legato-slur / bass-slide-up       (smooth, soulful)

export const MODE_DEFAULT_MELODY_ARTICULATION: Record<string, string> = {
  heat:   'staccato-pop',
  ice:    'legato-slur',
  smoke:  'grace-flick',
  gravel: 'staccato-pop',
  glow:   'legato-slur',
}

export const MODE_DEFAULT_BASS_ARTICULATION: Record<string, string> = {
  heat:   'bass-octave-jump',
  ice:    'bass-slide-up',
  smoke:  'bass-walking-step',
  gravel: 'bass-ghost-note',
  glow:   'bass-slide-up',
}

export function defaultMelodyArticulation(mode: string): string {
  return MODE_DEFAULT_MELODY_ARTICULATION[mode] ?? DEFAULT_ARTICULATION_ID
}

export function defaultBassArticulation(mode: string): string {
  return MODE_DEFAULT_BASS_ARTICULATION[mode] ?? DEFAULT_ARTICULATION_ID
}
