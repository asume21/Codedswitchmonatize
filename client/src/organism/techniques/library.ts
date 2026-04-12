/**
 * TECHNIQUE LIBRARY
 *
 * Starter pack of playing techniques, organized by instrument family.
 * Each technique is a pure scheduler — it takes chord notes + context
 * and returns per-note events with time offsets, durations, velocities.
 *
 * Hip-hop-centric design: all techniques aim for the sparse, loop-driven
 * aesthetic of boom-bap/storytelling/cypher production. No stadium-rock
 * strumming patterns.
 */

import type { PlayingTechnique } from './types'

// ─────────────────────────────────────────────────────────────────────
// GUITAR TECHNIQUES
// ─────────────────────────────────────────────────────────────────────

/**
 * Classic strum-down. Notes spread low-to-high over ~25ms, with low strings
 * slightly louder (thumb/pick hits them harder on a down-stroke).
 */
const GuitarStrumDown: PlayingTechnique = {
  id: 'guitar-strum-down',
  name: 'Guitar Strum (Down)',
  family: ['plucked'],
  category: 'chord',
  description: 'Classic down-strum: low-to-high, 25ms spread, bass-heavy velocity curve',
  schedule: (notes) => {
    const spread = 0.025  // 25ms total spread
    const sorted = [...notes]  // assume already low-to-high
    return sorted.map((note, i) => ({
      timeOffset: (i / Math.max(1, sorted.length - 1)) * spread,
      note,
      duration: '4n',
      velocity: 0.68 - i * 0.025,  // low notes louder
    }))
  },
}

/**
 * Strum-up (reverse direction). Lighter velocity, high-to-low spread.
 * Typically used on offbeats to create a down-up strum pattern.
 */
const GuitarStrumUp: PlayingTechnique = {
  id: 'guitar-strum-up',
  name: 'Guitar Strum (Up)',
  family: ['plucked'],
  category: 'chord',
  description: 'Up-strum: high-to-low, lighter velocity, offbeat feel',
  schedule: (notes) => {
    const spread = 0.020
    const reversed = [...notes].reverse()
    return reversed.map((note, i) => ({
      timeOffset: (i / Math.max(1, reversed.length - 1)) * spread,
      note,
      duration: '8n',
      velocity: 0.45 + i * 0.02,
    }))
  },
}

/**
 * Hip-hop melodic arpeggio — Travis Scott / Bryson Tiller style.
 * Notes spread across 16ths, high register, space between each.
 */
const GuitarArpRolled: PlayingTechnique = {
  id: 'guitar-arp-rolled',
  name: 'Guitar Arpeggio (Rolled)',
  family: ['plucked'],
  category: 'arp',
  description: 'Hip-hop arpeggio: notes on 16ths, spacey, high register',
  schedule: (notes, ctx) => {
    const sixteenthSec = 60 / ctx.tempo / 4
    return notes.map((note, i) => ({
      timeOffset: i * sixteenthSec,
      note,
      duration: '8n.',  // dotted 8th = slight overlap for smooth roll
      velocity: 0.58 + (i === 0 ? 0.1 : 0),  // accent the first note
    }))
  },
}

/**
 * Palm-muted stab — boom-bap / funk guitar chunk. Very short decay.
 * Think Nas "N.Y. State of Mind" or Dr. Dre "Nuthin' But A G Thang".
 */
const GuitarMutedStab: PlayingTechnique = {
  id: 'guitar-muted-stab',
  name: 'Guitar Muted Stab',
  family: ['plucked'],
  category: 'stab',
  description: 'Palm-muted chord chunk: very short, percussive, sits in pocket',
  schedule: (notes) => {
    const microSpread = 0.008  // 8ms spread — feels like one hit but with body
    return notes.map((note, i) => ({
      timeOffset: i * microSpread,
      note,
      duration: '32n',  // very short = muted feel
      velocity: 0.55,
    }))
  },
}

// ─────────────────────────────────────────────────────────────────────
// PIANO / KEYBOARD TECHNIQUES
// ─────────────────────────────────────────────────────────────────────

/**
 * Block chord — traditional piano hit, all notes simultaneous.
 * This is what the ChordGenerator currently does by default.
 */
const PianoBlockChord: PlayingTechnique = {
  id: 'piano-block-chord',
  name: 'Piano Block Chord',
  family: ['keyboard'],
  category: 'chord',
  description: 'All notes simultaneous — standard piano chord hit',
  schedule: (notes) => {
    return notes.map(note => ({
      timeOffset: 0,
      note,
      duration: '4n',
      velocity: 0.6,
    }))
  },
}

/**
 * Rolled chord — pianist "rolls" the chord bottom-to-top over ~60ms.
 * Very common in ballads, storytelling beats, Alicia Keys / J. Cole style.
 */
const PianoRolledChord: PlayingTechnique = {
  id: 'piano-rolled-chord',
  name: 'Piano Rolled Chord',
  family: ['keyboard'],
  category: 'chord',
  description: 'Bottom-to-top roll, 60ms spread — emotional / storytelling feel',
  schedule: (notes) => {
    const spread = 0.060
    return notes.map((note, i) => ({
      timeOffset: (i / Math.max(1, notes.length - 1)) * spread,
      note,
      duration: '2n',  // sustained — this is a feature, not a stab
      velocity: 0.55 + i * 0.02,
    }))
  },
}

/**
 * Alberti bass pattern — left-hand classical pattern: 1-5-3-5 repeated.
 * Gives a rolling, continuous feel. Works great for lo-fi hip-hop.
 */
const PianoAlberti: PlayingTechnique = {
  id: 'piano-alberti',
  name: 'Piano Alberti Pattern',
  family: ['keyboard'],
  category: 'arp',
  description: 'Classical 1-5-3-5 rolling pattern — lo-fi / ballad feel',
  schedule: (notes, ctx) => {
    if (notes.length < 3) {
      // Fallback to block chord for chords with too few notes
      return notes.map(note => ({ timeOffset: 0, note, duration: '4n', velocity: 0.55 }))
    }
    const [root, third, fifth] = notes
    const pattern = [root, fifth, third, fifth]
    const eighthSec = 60 / ctx.tempo / 2
    return pattern.map((note, i) => ({
      timeOffset: i * eighthSec,
      note,
      duration: '8n',
      velocity: i === 0 ? 0.62 : 0.52,
    }))
  },
}

/**
 * Sustained pad — long held chord, ideal for storytelling.
 * All notes at once but with slow attack via long duration.
 */
const PianoSustainedPad: PlayingTechnique = {
  id: 'piano-sustained-pad',
  name: 'Piano Sustained Pad',
  family: ['keyboard'],
  category: 'pad',
  description: 'Long sustained chord — storytelling / cinematic foundation',
  schedule: (notes, ctx) => {
    return notes.map(note => ({
      timeOffset: 0,
      note,
      duration: ctx.chordDurationSec,  // holds the full chord duration
      velocity: 0.42,  // soft — it's a bed, not a hit
    }))
  },
}

// ─────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────

export const ALL_TECHNIQUES: PlayingTechnique[] = [
  // Guitar
  GuitarStrumDown,
  GuitarStrumUp,
  GuitarArpRolled,
  GuitarMutedStab,

  // Piano / Keyboard
  PianoBlockChord,
  PianoRolledChord,
  PianoAlberti,
  PianoSustainedPad,
]

export const TECHNIQUES_BY_ID: Map<string, PlayingTechnique> = new Map(
  ALL_TECHNIQUES.map(t => [t.id, t])
)

/** Get a technique by id, or undefined if not found. */
export function getTechnique(id: string): PlayingTechnique | undefined {
  return TECHNIQUES_BY_ID.get(id)
}

/** Default technique — block chord, matches legacy behavior. */
export const DEFAULT_TECHNIQUE_ID = 'piano-block-chord'

/** Get all techniques compatible with a given instrument family. */
export function techniquesForFamily(family: string): PlayingTechnique[] {
  return ALL_TECHNIQUES.filter(t => t.family.includes(family as any))
}
