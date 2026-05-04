import { INSTRUMENT_PERFORMERS, INSTRUMENT_PERFORMERS_BY_ID } from './InstrumentRegistry'
import type {
  InstrumentPerformerId,
  InstrumentPerformerProfile,
  PerformerRole,
  PerformerSelectionContext,
} from './types'

const NOTE_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
}

const PC_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const DEFAULT_BY_ROLE: Record<PerformerRole, InstrumentPerformerId> = {
  lead: 'flute',
  bass: 'bass-electric',
  chord: 'piano',
  texture: 'strings',
}

const MODE_ROLE_DEFAULTS: Partial<Record<string, Partial<Record<PerformerRole, InstrumentPerformerId[]>>>> = {
  heat: {
    lead: ['guitar-distorted', 'trumpet', 'guitar-clean'],
    bass: ['bass-synth', 'bass-electric'],
    chord: ['guitar-clean', 'guitar-distorted', 'piano'],
  },
  gravel: {
    lead: ['guitar-clean', 'sax', 'trumpet'],
    bass: ['bass-synth', 'bass-electric'],
    chord: ['guitar-clean', 'piano'],
  },
  smoke: {
    lead: ['sax', 'clarinet', 'violin', 'guitar-nylon'],
    bass: ['bass-upright', 'bass-electric'],
    chord: ['rhodes', 'piano', 'guitar-nylon'],
  },
  ice: {
    lead: ['flute', 'harp', 'violin', 'sitar'],
    bass: ['bass-synth', 'bass-electric'],
    chord: ['harp', 'strings', 'guitar-nylon'],
  },
  glow: {
    lead: ['violin', 'flute', 'guitar-nylon', 'clarinet'],
    bass: ['bass-electric', 'bass-upright'],
    chord: ['rhodes', 'strings', 'guitar-nylon'],
  },
}

export function selectInstrumentPerformer(ctx: PerformerSelectionContext): InstrumentPerformerProfile {
  if (ctx.explicitId) {
    const explicit = INSTRUMENT_PERFORMERS_BY_ID.get(ctx.explicitId)
    if (explicit && explicit.roles.includes(ctx.role)) return explicit
  }

  const candidates = INSTRUMENT_PERFORMERS.filter(profile => profile.roles.includes(ctx.role))
  const preferred = MODE_ROLE_DEFAULTS[ctx.mode]?.[ctx.role] ?? [DEFAULT_BY_ROLE[ctx.role]]
  let best = candidates[0] ?? INSTRUMENT_PERFORMERS_BY_ID.get(DEFAULT_BY_ROLE[ctx.role])!
  let bestScore = -Infinity

  for (const profile of candidates) {
    let score = 0
    const preferredIdx = preferred.indexOf(profile.id)
    if (preferredIdx >= 0) score += 12 - preferredIdx
    if (profile.modeBias.includes(ctx.mode)) score += 4
    if (ctx.energy > 0.7 && profile.tags.includes('aggressive')) score += 3
    if (ctx.energy < 0.35 && (profile.tags.includes('warm') || profile.tags.includes('air'))) score += 2
    if ((ctx.brightness ?? 0.5) > 0.65 && (profile.family === 'wind' || profile.family === 'brass')) score += 1
    if (profile.id === DEFAULT_BY_ROLE[ctx.role]) score += 0.5

    if (score > bestScore) {
      bestScore = score
      best = profile
    }
  }

  return best
}

export function noteToMidi(note: string | number): number | null {
  if (typeof note === 'number') return Number.isFinite(note) ? note : null
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note)
  if (!match) return null
  const pc = NOTE_TO_PC[match[1]]
  const octave = Number.parseInt(match[2], 10)
  if (pc == null || !Number.isFinite(octave)) return null
  return (octave + 1) * 12 + pc
}

export function midiToNote(midi: number): string {
  const rounded = Math.round(midi)
  const pc = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return `${PC_TO_NOTE[pc]}${octave}`
}

export function conformMidiToRange(midi: number, profile: InstrumentPerformerProfile): number {
  const [min, max] = profile.range
  let shifted = midi
  while (shifted < min) shifted += 12
  while (shifted > max) shifted -= 12
  return Math.max(min, Math.min(max, shifted))
}

export function conformNoteToInstrument(
  note: string | number,
  profile: InstrumentPerformerProfile,
): string | number {
  const midi = noteToMidi(note)
  if (midi == null) return note
  const conformed = conformMidiToRange(midi, profile)
  return typeof note === 'number' ? conformed : midiToNote(conformed)
}

export function conformChordToInstrument(
  notes: string[],
  profile: InstrumentPerformerProfile,
): string[] {
  const conformed = notes
    .map(note => conformNoteToInstrument(note, profile))
    .filter((note): note is string => typeof note === 'string')

  if (profile.polyphony === 'mono') {
    const top = conformed
      .map(note => ({ note, midi: noteToMidi(note) ?? -Infinity }))
      .sort((a, b) => b.midi - a.midi)[0]
    return top ? [top.note] : conformed.slice(0, 1)
  }

  const deduped: string[] = []
  for (const note of conformed) {
    if (!deduped.includes(note)) deduped.push(note)
  }
  return deduped.slice(0, profile.family === 'plucked' ? 4 : 6)
}
