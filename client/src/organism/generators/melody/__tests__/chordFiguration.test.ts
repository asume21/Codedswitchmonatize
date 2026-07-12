import { describe, it, expect } from 'vitest'
import { voiceChordHit } from '../chordFiguration'

// C major triad + 7th, deliberately unsorted so we prove the module sorts.
const CHORD = ['G4', 'C4', 'E4', 'B4']
const MIDI: Record<string, number> = { C4: 60, E4: 64, G4: 67, B4: 71 }
const midiOf = (n: string) => MIDI[n] ?? 0

/** Deterministic mid-range rng so gestures are reproducible under test. */
const steady = () => 0.5

function voice(family: string | undefined, hitIndex = 0, rng: () => number = steady) {
  return voiceChordHit(CHORD, { family, hitIndex, rng, midiOf })
}

describe('voiceChordHit — the shared contract', () => {
  it('never moves the hit: every offset is at or after the scheduled time', () => {
    for (const family of ['plucked', 'keyboard', 'bowed', 'brass', 'synth', undefined]) {
      for (const note of voice(family)) {
        expect(note.timeOffset, String(family)).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('never smears a chord beyond a human gesture (90ms)', () => {
    for (const family of ['plucked', 'keyboard', 'bowed', 'brass', 'synth']) {
      for (let hit = 0; hit < 8; hit++) {
        for (const note of voice(family, hit, () => 0.999)) {
          expect(note.timeOffset, `${family} hit ${hit}`).toBeLessThanOrEqual(0.09)
        }
      }
    }
  })

  it('only ever sounds notes from the chord it was given', () => {
    for (const family of ['plucked', 'keyboard', 'bowed', 'brass', 'synth']) {
      for (let hit = 0; hit < 4; hit++) {
        for (const note of voice(family, hit)) {
          expect(CHORD, family).toContain(note.note)
        }
      }
    }
  })

  it('returns nothing for an empty chord', () => {
    expect(voiceChordHit([], { family: 'plucked', hitIndex: 0, rng: steady, midiOf })).toEqual([])
  })
})

describe('guitar — alternating strum', () => {
  it('down-strokes rake low to high and sound every string', () => {
    const down = voice('plucked', 0)
    expect(down).toHaveLength(4)
    expect(down.map(n => n.note)).toEqual(['C4', 'E4', 'G4', 'B4'])
    // Rake: each successive string arrives later.
    for (let i = 1; i < down.length; i++) {
      expect(down[i].timeOffset).toBeGreaterThan(down[i - 1].timeOffset)
    }
  })

  it('up-strokes rake high to low, are quieter, and skip the bass string', () => {
    const up = voice('plucked', 1)
    // A real up-stroke catches the top strings, not the whole chord.
    expect(up.length).toBeLessThan(4)
    expect(up[0].note).toBe('B4')                       // starts at the top
    const down = voice('plucked', 0)
    const avg = (ns: { velocityScale: number }[]) =>
      ns.reduce((s, n) => s + n.velocityScale, 0) / ns.length
    expect(avg(up)).toBeLessThan(avg(down))             // up-strokes are lighter
  })

  it('alternates direction every hit — this is what stops it chugging', () => {
    // Consecutive hits must not produce the same gesture, or the strum loops.
    expect(voice('plucked', 0).map(n => n.note)).not.toEqual(voice('plucked', 1).map(n => n.note))
    expect(voice('plucked', 0).map(n => n.note)).toEqual(voice('plucked', 2).map(n => n.note))
  })
})

describe('piano — two hands, occasional roll', () => {
  it('blocks by default: both hands land within a few milliseconds', () => {
    const spread = Math.max(...voice('keyboard', 0).map(n => n.timeOffset))
    expect(spread).toBeLessThan(0.02)
  })

  it('rolls roughly every fourth hit, spreading much wider', () => {
    const blocked = Math.max(...voice('keyboard', 0).map(n => n.timeOffset))
    const rolled = Math.max(...voice('keyboard', 3).map(n => n.timeOffset))
    expect(rolled).toBeGreaterThan(blocked * 3)
  })

  it('the left hand lands heaviest — the bass note is the anchor', () => {
    const hit = voice('keyboard', 0)
    expect(hit[0].note).toBe('C4')
    expect(hit[0].velocityScale).toBeGreaterThan(hit[1].velocityScale)
  })
})

describe('strings — a section blooms, it does not strum', () => {
  it('bows land together: no rake, no pitch-ordered stagger', () => {
    const hit = voice('bowed', 0, steady)
    const offsets = hit.map(n => n.timeOffset)
    // Every desk attacks at the same scatter value under a steady rng — the
    // point is that offset does NOT climb with pitch the way a strum does.
    expect(new Set(offsets).size).toBe(1)
  })
})

describe('brass — a stab is the tightest gesture', () => {
  it('brass lands tighter than a guitar strum', () => {
    const brass = Math.max(...voice('brass', 0, () => 0.9).map(n => n.timeOffset))
    const guitar = Math.max(...voice('plucked', 0, () => 0.9).map(n => n.timeOffset))
    expect(brass).toBeLessThan(guitar)
  })
})
