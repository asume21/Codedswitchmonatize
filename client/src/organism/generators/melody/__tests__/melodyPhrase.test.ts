import { describe, expect, it } from 'vitest'
import {
  isStrongBeat,
  resolveDegreeForBeat,
  resolveDegreeComplementing,
  contourOffset,
  cadenceStep,
} from '../melodyPhrase'

describe('isStrongBeat', () => {
  it('is true on beat 1 and beat 3 downbeats, false elsewhere', () => {
    expect(isStrongBeat(0)).toBe(true)   // bar:0 beat:0 sub:0
    expect(isStrongBeat(8)).toBe(true)   // beat:2 sub:0
    expect(isStrongBeat(4)).toBe(false)  // beat:1 sub:0
    expect(isStrongBeat(2)).toBe(false)  // off-16th
  })
})

describe('resolveDegreeForBeat', () => {
  const chordDegs = [0, 2, 4] // root/3rd/5th scale degrees, 7-note scale
  it('snaps to the nearest chord tone on strong beats', () => {
    expect(resolveDegreeForBeat(3, chordDegs, 7, true)).toBe(2) // 3 -> nearest chord deg (2 or 4) -> 2
    expect(resolveDegreeForBeat(1, chordDegs, 7, true)).toBe(0)
  })
  it('leaves the degree untouched on weak beats (passing tones allowed)', () => {
    expect(resolveDegreeForBeat(3, chordDegs, 7, false)).toBe(3)
  })
  it('preserves octave region when snapping', () => {
    expect(resolveDegreeForBeat(10, chordDegs, 7, true)).toBe(9) // 10 = oct1+deg3 -> oct1+deg2 = 9
  })
})

describe('resolveDegreeComplementing', () => {
  // Cmaj7 over a 7-note scale: chord degrees root/3rd/5th/7th = [0, 2, 4, 6].
  // The comp's guide tones are the 3rd (deg 2) and 7th (deg 6), so the melody
  // should LEAN toward the remaining tones: root/5th = [0, 4].
  const chordDegs = [0, 2, 4, 6]
  const preferred = [0, 4]

  it('biases a strong beat toward a COMPLEMENT tone when one is no further away', () => {
    // deg 3 sits between the 3rd (guide, deg 2) and the 5th (complement, deg 4) —
    // both one step away. The complement wins the tie, so the lead doubles the 5th
    // (in the comp's quiet register) rather than the 3rd (its loud colour).
    expect(resolveDegreeComplementing(3, chordDegs, preferred, 7, true)).toBe(4)
  })

  it('STILL allows a guide tone when the line lands squarely on it (soft, not banned)', () => {
    // deg 2 IS the 3rd. The first cut yanked it to root/5th, which greyed the line.
    // Now, when the contour targets the 3rd exactly, the lead is allowed to sing it
    // — the soft penalty only redirects when a complement is as close or closer.
    expect(resolveDegreeComplementing(2, chordDegs, preferred, 7, true)).toBe(2)
  })

  it('the penalty dial controls how hard it avoids guide tones', () => {
    // penalty 0 = no preference (nearest chord tone wins outright): the 3rd stays.
    expect(resolveDegreeComplementing(2, chordDegs, preferred, 7, true, 0)).toBe(2)
    // a large penalty = the old hard exclusion: the 3rd is pushed to root/5th.
    expect(resolveDegreeComplementing(2, chordDegs, preferred, 7, true, 10)).toBe(0)
  })

  it('preserves octave region when redirecting to a complement tone', () => {
    // deg 10 = oct1 + deg3 → oct1 + the 5th (deg 4), the nearer complement.
    expect(resolveDegreeComplementing(10, chordDegs, preferred, 7, true)).toBe(11) // oct1 + 5th
  })

  it('leaves weak beats untouched so guide tones still pass through', () => {
    expect(resolveDegreeComplementing(2, chordDegs, preferred, 7, false)).toBe(2)
  })

  it('falls back to the full chord-tone set when there is no complement tone', () => {
    // A bare shape whose only chord tones ARE guide tones — never strip the melody
    // of every stable landing note.
    expect(resolveDegreeComplementing(3, [2, 6], [], 7, true)).toBe(2)
  })
})

describe('contourOffset', () => {
  it('peaks near 2/3 through the phrase and is ~0 at the ends', () => {
    expect(contourOffset(0, 3)).toBe(0)
    expect(contourOffset(1, 3)).toBe(0)
    expect(contourOffset(0.66, 3)).toBeGreaterThan(contourOffset(0.2, 3))
  })
})

describe('cadenceStep', () => {
  it('lands on the chord root (index 0, chord tone) held long', () => {
    const s = cadenceStep()
    expect(s.index).toBe(0)
    expect(s.isChordTone).toBe(true)
    expect(s.dur16ths).toBeGreaterThanOrEqual(4)
  })
})
