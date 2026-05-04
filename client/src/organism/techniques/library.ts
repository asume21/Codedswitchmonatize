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

import type { PlayingTechnique, ScheduledNote } from './types'

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
  schedule: (notes, ctx) => {
    const spread = 0.025  // 25ms total spread
    const sorted = [...notes]  // assume already low-to-high
    const energyMult = 0.8 + ctx.energy * 0.4
    return sorted.map((note, i) => ({
      timeOffset: (i / Math.max(1, sorted.length - 1)) * spread,
      note,
      duration: '4n',
      velocity: (0.68 - i * 0.025) * energyMult,  // low notes louder
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
  schedule: (notes, ctx) => {
    const spread = 0.020
    const reversed = [...notes].reverse()
    const energyMult = 0.7 + ctx.energy * 0.5
    return reversed.map((note, i) => ({
      timeOffset: (i / Math.max(1, reversed.length - 1)) * spread,
      note,
      duration: '8n',
      velocity: (0.45 + i * 0.02) * energyMult,
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
    const energyMult = 0.8 + ctx.energy * 0.4
    return notes.map((note, i) => ({
      timeOffset: i * sixteenthSec,
      note,
      duration: '8n.',  // dotted 8th = slight overlap for smooth roll
      velocity: (0.58 + (i === 0 ? 0.1 : 0)) * energyMult,  // accent the first note
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
  schedule: (notes, ctx) => {
    const microSpread = 0.008  // 8ms spread
    const energyMult = 0.75 + ctx.energy * 0.5
    return notes.map((note, i) => ({
      timeOffset: i * microSpread,
      note,
      duration: '32n',  // very short = muted feel
      velocity: 0.55 * energyMult,
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
  schedule: (notes, ctx) => {
    const baseVel = 0.45 + ctx.energy * 0.4
    return notes.map(note => ({
      timeOffset: 0,
      note,
      duration: '4n',
      velocity: baseVel,
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
  schedule: (notes, ctx) => {
    const spread = 0.060
    const energyMult = 0.8 + ctx.energy * 0.4
    return notes.map((note, i) => ({
      timeOffset: (i / Math.max(1, notes.length - 1)) * spread,
      note,
      duration: '2n',  // sustained — this is a feature, not a stab
      velocity: (0.55 + i * 0.02) * energyMult,
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
      const baseVel = 0.4 + ctx.energy * 0.3
      return notes.map(note => ({ timeOffset: 0, note, duration: '4n', velocity: baseVel }))
    }
    const [root, third, fifth] = notes
    const pattern = [root, fifth, third, fifth]
    const eighthSec = 60 / ctx.tempo / 2
    const energyMult = 0.8 + ctx.energy * 0.4
    return pattern.map((note, i) => ({
      timeOffset: i * eighthSec,
      note,
      duration: '8n',
      velocity: (i === 0 ? 0.62 : 0.52) * energyMult,
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
    const baseVel = 0.35 + ctx.energy * 0.3
    return notes.map(note => ({
      timeOffset: 0,
      note,
      duration: ctx.chordDurationSec,  // holds the full chord duration
      velocity: baseVel,  // soft — it's a bed, not a hit
    }))
  },
}

// ─────────────────────────────────────────────────────────────────────
// STRING TECHNIQUES (violin, cello, upright bass)
// ─────────────────────────────────────────────────────────────────────

/**
 * Pizzicato — plucked strings, rhythmic and percussive.
 * Each note gets a short, sharp attack. Used in storytelling for pulse.
 */
const StringsPizzicato: PlayingTechnique = {
  id: 'strings-pizzicato',
  name: 'Strings Pizzicato',
  family: ['bowed'],
  category: 'stab',
  description: 'Plucked strings, short percussive hits — storytelling pulse',
  schedule: (notes, ctx) => {
    // Stagger minimally — ensemble plucks aren't perfectly synced
    const energyMult = 0.8 + ctx.energy * 0.4
    return notes.map((note, i) => ({
      timeOffset: i * 0.004,
      note,
      duration: '16n',
      velocity: 0.55 * energyMult,
    }))
  },
}

/**
 * Legato bowing — long sustained, smooth notes. Classic cinematic strings.
 */
const StringsLegato: PlayingTechnique = {
  id: 'strings-legato',
  name: 'Strings Legato',
  family: ['bowed'],
  category: 'pad',
  description: 'Sustained bowing — cinematic, emotional sustain',
  schedule: (notes, ctx) => {
    const baseVel = 0.4 + ctx.energy * 0.4
    return notes.map(note => ({
      timeOffset: 0,
      note,
      duration: ctx.chordDurationSec,
      velocity: baseVel,
    }))
  },
}

/**
 * Tremolo — rapid bow repetition for intensity/tension.
 * Schedules 16th-note repeats across the chord duration.
 */
const StringsTremolo: PlayingTechnique = {
  id: 'strings-tremolo',
  name: 'Strings Tremolo',
  family: ['bowed'],
  category: 'pad',
  description: 'Rapid bow repetition — tension, cinematic crescendo',
  schedule: (notes, ctx) => {
    const sixteenthSec = 60 / ctx.tempo / 4
    const repeats = Math.max(1, Math.floor(ctx.chordDurationSec / sixteenthSec))
    const events: ScheduledNote[] = []
    const energyMult = 0.8 + ctx.energy * 0.4
    for (let r = 0; r < repeats; r++) {
      for (const note of notes) {
        events.push({
          timeOffset: r * sixteenthSec,
          note,
          duration: '32n',
          velocity: (0.38 + (r / repeats) * 0.15) * energyMult,  // swells as it goes
        })
      }
    }
    return events
  },
}

/**
 * Staccato — very short bow strokes, detached and crisp.
 */
const StringsStaccato: PlayingTechnique = {
  id: 'strings-staccato',
  name: 'Strings Staccato',
  family: ['bowed'],
  category: 'stab',
  description: 'Short detached bow strokes — crisp rhythmic punctuation',
  schedule: (notes, ctx) => {
    const baseVel = 0.45 + ctx.energy * 0.4
    return notes.map(note => ({
      timeOffset: 0,
      note,
      duration: '16n',
      velocity: baseVel,
    }))
  },
}

// ─────────────────────────────────────────────────────────────────────
// BRASS TECHNIQUES (trumpet, trombone, french horn)
// ─────────────────────────────────────────────────────────────────────

/**
 * Brass stab — short punchy hit, classic soul/funk horn line.
 * Think Stax/Motown sample, Kendrick "King Kunta" horns.
 */
const BrassStab: PlayingTechnique = {
  id: 'brass-stab',
  name: 'Brass Stab',
  family: ['brass'],
  category: 'stab',
  description: 'Short punchy horn hit — soul/funk sample aesthetic',
  schedule: (notes, ctx) => {
    const energyMult = 0.8 + ctx.energy * 0.4
    return notes.map((note, i) => ({
      timeOffset: i * 0.006,  // tight but not perfectly simultaneous (real section)
      note,
      duration: '8n',
      velocity: 0.68 * energyMult,
    }))
  },
}

/**
 * Brass swell — slow crescendo into full chord. Cinematic entrance.
 */
const BrassSwell: PlayingTechnique = {
  id: 'brass-swell',
  name: 'Brass Swell',
  family: ['brass'],
  category: 'pad',
  description: 'Crescendo entry — cinematic build into chord peak',
  schedule: (notes, ctx) => {
    // Split chord duration into 4 segments with increasing velocity
    const segDur = ctx.chordDurationSec / 4
    const events: ScheduledNote[] = []
    const energyMult = 0.8 + ctx.energy * 0.4
    for (let seg = 0; seg < 4; seg++) {
      for (const note of notes) {
        events.push({
          timeOffset: seg * segDur,
          note,
          duration: segDur,
          velocity: (0.28 + seg * 0.12) * energyMult,
        })
      }
    }
    return events
  },
}

/**
 * Brass fanfare — rhythmic staccato motif on downbeats.
 */
const BrassFanfare: PlayingTechnique = {
  id: 'brass-fanfare',
  name: 'Brass Fanfare',
  family: ['brass'],
  category: 'riff',
  description: 'Rhythmic staccato motif — hype / buildup energy',
  schedule: (notes, ctx) => {
    const eighthSec = 60 / ctx.tempo / 2
    // Fanfare pattern: hit-hit-rest-hit-hit across the chord
    const pattern = [0, 1, 3, 4]  // 8th-note positions
    const events: ScheduledNote[] = []
    const energyMult = 0.8 + ctx.energy * 0.4
    for (const pos of pattern) {
      for (const note of notes) {
        events.push({
          timeOffset: pos * eighthSec,
          note,
          duration: '16n',
          velocity: 0.65 * energyMult,
        })
      }
    }
    return events
  },
}

/**
 * Section pad — sustained horn section, long note holds like in R&B.
 */
const BrassSectionPad: PlayingTechnique = {
  id: 'brass-section-pad',
  name: 'Brass Section Pad',
  family: ['brass'],
  category: 'pad',
  description: 'Sustained horn section — warm R&B backing',
  schedule: (notes, ctx) => {
    const baseVel = 0.35 + ctx.energy * 0.3
    return notes.map(note => ({
      timeOffset: 0,
      note,
      duration: ctx.chordDurationSec,
      velocity: baseVel,
    }))
  },
}

// ─────────────────────────────────────────────────────────────────────
// WIND TECHNIQUES (flute, sax, clarinet — monophonic lead styles)
// ─────────────────────────────────────────────────────────────────────

/**
 * Wind legato — monophonic line played over the chord (top note only).
 * Flute/sax idiom: single-note sustained melody.
 */
const WindLegato: PlayingTechnique = {
  id: 'wind-legato',
  name: 'Wind Legato Line',
  family: ['wind'],
  category: 'riff',
  description: 'Monophonic sustained melody on top chord note — flute/sax lead',
  schedule: (notes, ctx) => {
    // Use just the top note of the chord for a monophonic line
    const topNote = notes[notes.length - 1]
    const baseVel = 0.4 + ctx.energy * 0.4
    return [{
      timeOffset: 0,
      note: topNote,
      duration: ctx.chordDurationSec,
      velocity: baseVel,
    }]
  },
}

/**
 * Wind run — fast scale passage, cascading through chord tones on 16ths.
 */
const WindRun: PlayingTechnique = {
  id: 'wind-run',
  name: 'Wind Run (Scalar)',
  family: ['wind'],
  category: 'riff',
  description: 'Fast 16th-note run through chord tones — jazzy flute/sax fill',
  schedule: (notes, ctx) => {
    const sixteenthSec = 60 / ctx.tempo / 4
    // Ascending then descending: 1-3-5-7-5-3 pattern
    const pattern = [...notes, ...[...notes].reverse().slice(1, -1)]
    const energyMult = 0.8 + ctx.energy * 0.4
    return pattern.map((note, i) => ({
      timeOffset: i * sixteenthSec,
      note,
      duration: '16n',
      velocity: (0.48 + (i === 0 ? 0.1 : 0)) * energyMult,
    }))
  },
}

/**
 * Wind staccato — detached short notes, playful / bouncy.
 */
const WindStaccato: PlayingTechnique = {
  id: 'wind-staccato',
  name: 'Wind Staccato',
  family: ['wind'],
  category: 'stab',
  description: 'Short detached notes on top chord tone — bouncy, playful',
  schedule: (notes, ctx) => {
    const eighthSec = 60 / ctx.tempo / 2
    const topNote = notes[notes.length - 1]
    const energyMult = 0.8 + ctx.energy * 0.4
    // Three short hits across the chord
    return [0, 2, 3].map(pos => ({
      timeOffset: pos * eighthSec,
      note: topNote,
      duration: '16n',
      velocity: 0.55 * energyMult,
    }))
  },
}

/**
 * Wind trill — rapid alternation between two adjacent chord tones.
 */
const WindTrill: PlayingTechnique = {
  id: 'wind-trill',
  name: 'Wind Trill',
  family: ['wind'],
  category: 'riff',
  description: 'Rapid alternation between two notes — ornamental flourish',
  schedule: (notes, ctx) => {
    if (notes.length < 2) return [{ timeOffset: 0, note: notes[0], duration: '4n', velocity: 0.5 }]
    const thirtySecondSec = 60 / ctx.tempo / 8
    const top = notes[notes.length - 1]
    const second = notes[notes.length - 2]
    const trillCount = Math.max(4, Math.floor(ctx.chordDurationSec / thirtySecondSec))
    const events: ScheduledNote[] = []
    const energyMult = 0.8 + ctx.energy * 0.4
    for (let i = 0; i < trillCount; i++) {
      events.push({
        timeOffset: i * thirtySecondSec,
        note: i % 2 === 0 ? top : second,
        duration: '32n',
        velocity: 0.45 * energyMult,
      })
    }
    return events
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

  // Strings
  StringsPizzicato,
  StringsLegato,
  StringsTremolo,
  StringsStaccato,

  // Brass
  BrassStab,
  BrassSwell,
  BrassFanfare,
  BrassSectionPad,

  // Wind
  WindLegato,
  WindRun,
  WindStaccato,
  WindTrill,
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

// ─────────────────────────────────────────────────────────────────────
// MODE → TECHNIQUE DEFAULTS
// ─────────────────────────────────────────────────────────────────────
// Each organism mode maps to an idiomatic default technique. These apply
// when no warmup phrase has explicitly overridden the technique.
//
//   heat   → Trap / aggressive → guitar-muted-stab (percussive, funk-adjacent)
//   ice    → Cloud rap / cold → piano-alberti (rolling, crystalline)
//   smoke  → Boom-bap / jazz → piano-rolled-chord (warm, emotional)
//   gravel → Drill / dark → guitar-muted-stab (tight, menacing)
//   glow   → R&B / melodic → piano-rolled-chord (soulful, sustained)

export const MODE_DEFAULT_TECHNIQUE: Record<string, string> = {
  heat:   'guitar-muted-stab',
  ice:    'piano-alberti',
  smoke:  'piano-rolled-chord',
  gravel: 'guitar-muted-stab',
  glow:   'piano-rolled-chord',
}

/** Get the default technique id for an organism mode. */
export function defaultTechniqueForMode(mode: string): string {
  return MODE_DEFAULT_TECHNIQUE[mode] ?? DEFAULT_TECHNIQUE_ID
}
