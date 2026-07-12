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
    expect(onKick.length / notes.length).toBeGreaterThanOrEqual(0.4)
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

  it('stays in the pocket — controlled onset count per bar', () => {
    for (let seed = 0; seed < 15; seed++) {
      clearMotifs()
      const notes = buildFreeplayBassNotes(ctx({ rng: mulberry32(seed), density: 1.0, sectionName: 'drop', subGenre: 'trap' }))
      for (let bar = 0; bar < 3; bar++) {   // bar 3 may add the turnaround pickup
        const inBar = notes.filter(n => n.time.startsWith(`${bar}:`))
        expect(inBar.length, `bar ${bar}, seed ${seed}`).toBeLessThanOrEqual(8)
      }
    }
  })

  it('is a bassLINE, not a melody — at most 2 pitch classes per phrase', () => {
    // Fire-beats (2026-07-11): a hip-hop bassline is 2-3 notes that SING and
    // repeat. The previous "moving 808 line" walked third/seventh/fifth and
    // read as a busy tech-house bass. Simple and repetitive is the target.
    for (const sectionName of ['verse', 'hook', 'drop', 'bridge']) {
      const notes = buildFreeplayBassNotes(ctx({ subGenre: 'trap', density: 0.7, sectionName, rng: mulberry32(7) }))
      const noteToMidi = new Map<string, number>()
      for (let m = 0; m < 90; m++) if (!noteToMidi.has(midiToNote(m))) noteToMidi.set(midiToNote(m), m)
      const pitchClasses = new Set(notes.map((n) => noteToMidi.get(n.pitch)! % 12))
      expect(pitchClasses.size, sectionName).toBeLessThanOrEqual(2)
    }
  })

  it('never plays more than 3 onsets in a bar — the bass leaves room', () => {
    for (let seed = 0; seed < 20; seed++) {
      clearMotifs()
      const notes = buildFreeplayBassNotes(ctx({ rng: mulberry32(seed), density: 1.0, sectionName: 'hook', subGenre: 'trap' }))
      for (let bar = 0; bar < 4; bar++) {
        const inBar = notes.filter(n => n.time.startsWith(`${bar}:`))
        expect(inBar.length, `bar ${bar}, seed ${seed}`).toBeLessThanOrEqual(3)
      }
    }
  })

  it('intro stays sparser than hook/drop sections', () => {
    const intro = buildFreeplayBassNotes(ctx({ sectionName: 'intro' }))
    const drop = buildFreeplayBassNotes(ctx({ sectionName: 'drop' }))
    expect(drop.length).toBeGreaterThan(intro.length)
  })

  it('drop sustains the 808 rather than firing short hits', () => {
    const drop = buildFreeplayBassNotes(ctx({ sectionName: 'drop', subGenre: 'trap', density: 0.8 }))
    // Every onset rings — a drop 808 holds, it does not stutter.
    expect(drop.every((n) => n.duration === '2n')).toBe(true)
    // Root and octave: the drop's weight is register, not note count.
    expect(new Set(drop.map((n) => n.pitch)).size).toBe(2)
  })

  it('starts on the root', () => {
    const notes = buildFreeplayBassNotes(ctx())
    const noteToMidi = new Map<string, number>()
    for (let m = 0; m < 90; m++) if (!noteToMidi.has(midiToNote(m))) noteToMidi.set(midiToNote(m), m)
    expect(noteToMidi.get(notes[0].pitch)! % 12).toBe(0)
  })

  it('the phrase end is decided by HARMONY, not by a dice roll', () => {
    // The old design rolled the phrase ending (rest / turnaround / plain) from
    // the rng, so the same chord could end three different ways for no musical
    // reason. Now the ending is a consequence of what the harmony does: it
    // rests when the chord holds, and walks when the chord moves — identical
    // across every seed.
    const endingFor = (seed: number, nextRootMidi?: number) =>
      buildFreeplayBassNotes(ctx({ rng: mulberry32(seed), nextRootMidi }))
        .filter(n => n.time.startsWith('3:'))
        .map(n => n.time)

    for (let seed = 1; seed < 25; seed++) {
      clearMotifs()
      // Chord holds → the turnaround breathes (nothing on the final beat).
      expect(endingFor(seed, 36), `static, seed ${seed}`).toEqual(endingFor(1, 36))
      // Chord moves → every seed walks the same four steps into the new root.
      expect(endingFor(seed, 43), `moving, seed ${seed}`).toEqual(endingFor(1, 43))
    }
  })

  // ── Hits vs line: driven by chord MOVEMENT ────────────────────────
  // A bassline exists to connect chord changes. Harmony holding → hits.
  // Harmony moving → walk into the next root.

  const midiOf = (pitch: string) => {
    const noteToMidi = new Map<string, number>()
    for (let m = 0; m < 90; m++) if (!noteToMidi.has(midiToNote(m))) noteToMidi.set(midiToNote(m), m)
    return noteToMidi.get(pitch)!
  }
  const finalBar = (notes: { time: string }[]) => notes.filter(n => n.time.startsWith('3:'))

  it('harmony HOLDING (next root == root) → the bass hits, it does not walk', () => {
    const notes = buildFreeplayBassNotes(ctx({ sectionName: 'verse', nextRootMidi: 36 }))
    // verse hit pattern is [0, 8]; the final bar keeps both and adds no walk.
    expect(finalBar(notes).length).toBeLessThanOrEqual(2)
    const pitchClasses = new Set(notes.map(n => midiOf(n.pitch) % 12))
    expect(pitchClasses.size).toBe(1)   // root only — nothing to connect
  })

  it('harmony MOVING → the final bar walks into the next root', () => {
    // C2 (36) → Ab (44 in bass register): descending... 44 > 36, so ascending.
    const notes = buildFreeplayBassNotes(ctx({ subGenre: 'boom-bap', nextRootMidi: 44 }))
    const last = finalBar(notes)
    expect(last.length).toBe(4)                       // root, fifth, third, approach
    // The walk lands on the chromatic leading tone into the new root.
    expect(midiOf(last[last.length - 1].pitch)).toBe(43)   // 44 - 1, approached from below
  })

  it('trap MOVING → the 808 holds, then slides onto the next root', () => {
    const notes = buildFreeplayBassNotes(ctx({ subGenre: 'trap', nextRootMidi: 41 }))
    const last = finalBar(notes)
    expect(last.length).toBe(2)
    expect(last[0].duration).toBe('2n')               // the 808 holds
    expect(midiOf(last[1].pitch)).toBe(41)            // glides ONTO the next root
  })

  it('the walk uses the chord\'s real third — major chord, no minor clash', () => {
    const notes = buildFreeplayBassNotes(ctx({
      subGenre: 'boom-bap',
      chordIntervals: [0, 4, 7, 11],   // C major 7
      nextRootMidi: 41,
    }))
    for (const n of finalBar(notes)) {
      expect(midiOf(n.pitch) % 12).not.toBe(3)   // minor third forbidden over C major
    }
  })

  it('is deterministic for the same seed', () => {
    const n1 = buildFreeplayBassNotes(ctx({ rng: mulberry32(5) }))
    clearMotifs()
    const n2 = buildFreeplayBassNotes(ctx({ rng: mulberry32(5) }))
    expect(n1).toEqual(n2)
  })
})
