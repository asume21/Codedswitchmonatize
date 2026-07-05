import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayMelodyNotes, clearMelodyMotifs, type MelodyFreeplayContext } from '../MelodyImproviser'
import { clearMotifs } from '../motif'
import { hashString, mulberry32 } from '../utils'

function ctx(overrides: Partial<MelodyFreeplayContext> = {}): MelodyFreeplayContext {
  return {
    rootMidi: 60,
    chordIntervals: [0, 3, 7, 10],
    bars: 4,
    swing: 0.3,
    subGenre: 'boom-bap',
    energy: 0.75,
    density: 0.72,
    sectionName: 'verse',
    motifSeed: hashString('melody:verse:boom-bap'),
    kickTimes16ths: [],
    rng: mulberry32(77),
    scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
    keyPitchClass: 0,
    chordDegrees: [0, 2, 4, 6],
    preferredDegrees: [0, 4],
    octave: 4,
    length16ths: 64,
    behavior: 'lead',
    performerFamily: 'keyboard',
    emotionalIntent: null,
    ...overrides,
  }
}

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function pcOf(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note)
  if (!match) throw new Error(`Bad test note: ${note}`)
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
  return ((NOTE_PC[match[1]] + accidental) % 12 + 12) % 12
}

function absSlotOf(time: string): number {
  const [bar, beat, sub] = time.split(':').map(parseFloat)
  return bar * 16 + beat * 4 + Math.floor(sub)
}

function barSlots(notes: Array<{ time: string }>, bar: number): number[] {
  return notes
    .filter(note => Math.floor(absSlotOf(note.time) / 16) === bar)
    .map(note => absSlotOf(note.time) % 16)
    .sort((a, b) => a - b)
}

describe('MelodyImproviser', () => {
  beforeEach(() => {
    clearMotifs()
    clearMelodyMotifs()
  })

  it('keeps every pitch inside the active scale', () => {
    const notes = buildFreeplayMelodyNotes(ctx())
    const allowed = new Set([0, 2, 3, 5, 7, 8, 10])

    expect(notes.length).toBeGreaterThan(8)
    for (const note of notes) {
      expect(allowed.has(pcOf(note.pitch))).toBe(true)
    }
  })

  it('lands strong structural beats on live chord tones', () => {
    const notes = buildFreeplayMelodyNotes(ctx())
    const chordPcs = new Set([0, 3, 7, 10])

    for (const note of notes) {
      const slot = absSlotOf(note.time) % 16
      if (slot === 0 || slot === 8 || slot === 12) {
        expect(chordPcs.has(pcOf(note.pitch))).toBe(true)
      }
    }
  })

  it('states a rhythm idea, answers it, then develops it', () => {
    const notes = buildFreeplayMelodyNotes(ctx())

    expect(barSlots(notes, 1)).toEqual(barSlots(notes, 0))
    expect(barSlots(notes, 2).length).toBeGreaterThanOrEqual(2)
    expect(barSlots(notes, 3)).toContain(12)
  })

  it('creates a real contour instead of one repeated note', () => {
    for (let seed = 1; seed <= 12; seed++) {
      clearMotifs()
      clearMelodyMotifs()
      const notes = buildFreeplayMelodyNotes(ctx({ rng: mulberry32(seed) }))
      const unique = new Set(notes.map(note => note.pitch))
      expect(unique.size, `seed ${seed}`).toBeGreaterThan(2)
    }
  })

  it('is replayable when the same seed is pinned', () => {
    const first = buildFreeplayMelodyNotes(ctx({ rng: mulberry32(105) }))
    clearMotifs()
    clearMelodyMotifs()
    const second = buildFreeplayMelodyNotes(ctx({ rng: mulberry32(105) }))

    expect(second).toEqual(first)
  })
})
