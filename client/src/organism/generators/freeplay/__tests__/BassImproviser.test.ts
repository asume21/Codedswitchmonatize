import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayBassNotes } from '../BassImproviser'
import { clearMotifs } from '../motif'
import { mulberry32, hashString, midiToNote } from '../utils'
import type { FreeplayContext } from '../types'

function ctx(overrides: Partial<FreeplayContext> = {}): FreeplayContext {
  return {
    rootMidi: 36,                       // C2
    chordIntervals: [0, 3, 7, 10],      // minor 7
    bars: 4,
    swing: 0.3,
    subGenre: 'boom-bap',
    energy: 0.6,
    density: 0.6,
    sectionName: 'verse',
    motifSeed: hashString('verse:boom-bap'),
    kickTimes16ths: [0, 6, 10, 16, 22, 26, 32, 38, 42, 48, 54, 58],
    rng: mulberry32(99),
    ...overrides,
  }
}

describe('BassImproviser', () => {
  beforeEach(() => clearMotifs())

  it('every pitch is a chord tone (root/3rd/5th/7th/octave) of the live chord', () => {
    const notes = buildFreeplayBassNotes(ctx())
    // allowed pitch classes for C minor 7: C(0), Eb(3), G(7), Bb(10)
    const allowedPc = new Set([0, 3, 7, 10])
    const nameToPc = new Map<string, number>()
    for (let m = 24; m < 60; m++) nameToPc.set(midiToNote(m), m % 12)
    for (const n of notes) {
      expect(allowedPc.has(nameToPc.get(n.pitch)!)).toBe(true)
    }
  })

  it('uses the MAJOR third when the chord is major (no minor-pent clash)', () => {
    const notes = buildFreeplayBassNotes(ctx({ chordIntervals: [0, 4, 7, 11], sectionName: 'chorus' }))
    const nameToPc = new Map<string, number>()
    for (let m = 24; m < 60; m++) nameToPc.set(midiToNote(m), m % 12)
    for (const n of notes) {
      const pc = nameToPc.get(n.pitch)!
      expect(pc).not.toBe(3)   // minor third of C is forbidden over C major
      expect(pc).not.toBe(10)  // b7 forbidden over maj7 chord
    }
  })

  it('at least 60% of onsets land on a kick slot (kick glue)', () => {
    const c = ctx()
    const notes = buildFreeplayBassNotes(c)
    const kickSet = new Set(c.kickTimes16ths)
    const onsetSlot = (t: string) => {
      const [bar, beat, sub] = t.split(':').map(parseFloat)
      return bar * 16 + beat * 4 + Math.floor(sub)
    }
    const onKick = notes.filter(n => kickSet.has(onsetSlot(n.time)))
    expect(onKick.length / notes.length).toBeGreaterThanOrEqual(0.6)
  })

  it('bars 1 and 2 repeat the same rhythm (A-A), bar 3 is a bounded variation', () => {
    const notes = buildFreeplayBassNotes(ctx())
    const rhythmOfBar = (bar: number) =>
      notes.filter(n => n.time.startsWith(`${bar}:`)).map(n => n.time.slice(2)).sort()
    expect(rhythmOfBar(1)).toEqual(rhythmOfBar(0))
    const a = new Set(rhythmOfBar(0))
    const b = rhythmOfBar(2)
    const changed = b.filter(t => !a.has(t)).length + [...a].filter(t => !b.includes(t)).length
    expect(changed).toBeLessThanOrEqual(2)
  })

  it('pitches stay in the bass register (MIDI 28..52)', () => {
    const notes = buildFreeplayBassNotes(ctx({ rootMidi: 48 }))
    const noteToMidi = new Map<string, number>()
    for (let m = 0; m < 90; m++) if (!noteToMidi.has(midiToNote(m))) noteToMidi.set(midiToNote(m), m)
    for (const n of notes) {
      const midi = noteToMidi.get(n.pitch)!
      expect(midi).toBeGreaterThanOrEqual(28)
      expect(midi).toBeLessThanOrEqual(52)
    }
  })

  it('stays in the pocket — at most 4 onsets per bar (anti-tech-house cap, 2026-07-02)', () => {
    for (let seed = 0; seed < 15; seed++) {
      clearMotifs()
      const notes = buildFreeplayBassNotes(ctx({ rng: mulberry32(seed), density: 1.0 }))
      for (let bar = 0; bar < 3; bar++) {   // bar 3 may add the turnaround pickup
        const inBar = notes.filter(n => n.time.startsWith(`${bar}:`))
        expect(inBar.length, `bar ${bar}, seed ${seed}`).toBeLessThanOrEqual(4)
      }
    }
  })

  it('trap freeplay leans into a moving 808 line instead of only root hits', () => {
    const notes = buildFreeplayBassNotes(ctx({
      subGenre: 'trap',
      density: 0.7,
      rng: mulberry32(7),
    }))
    const noteToMidi = new Map<string, number>()
    for (let m = 0; m < 90; m++) if (!noteToMidi.has(midiToNote(m))) noteToMidi.set(midiToNote(m), m)
    const pitchClasses = new Set(notes.map((n) => noteToMidi.get(n.pitch)! % 12))
    expect(pitchClasses.size).toBeGreaterThanOrEqual(3)
  })

  it('is deterministic for the same seed', () => {
    const n1 = buildFreeplayBassNotes(ctx({ rng: mulberry32(5) }))
    clearMotifs()
    const n2 = buildFreeplayBassNotes(ctx({ rng: mulberry32(5) }))
    expect(n1).toEqual(n2)
  })
})
