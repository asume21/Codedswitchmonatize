import { describe, expect, it } from 'vitest'
import { isStrongBeat, resolveDegreeForBeat, contourOffset, cadenceStep } from '../melodyPhrase'

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
