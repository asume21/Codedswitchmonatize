import { describe, it, expect, beforeEach } from 'vitest'
import { mulberry32, hashString, midiToNote, swungTime, jitterVel } from '../utils'
import { getSectionMotif, varyMotif, clearMotifs } from '../motif'

describe('freeplay utils', () => {
  it('mulberry32 is deterministic for a given seed', () => {
    const a = mulberry32(42), b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('hashString is deterministic and differs across strings', () => {
    expect(hashString('verse:boom-bap')).toBe(hashString('verse:boom-bap'))
    expect(hashString('verse:boom-bap')).not.toBe(hashString('drop:trap'))
  })

  it('midiToNote converts MIDI to note names', () => {
    expect(midiToNote(36)).toBe('C2')
    expect(midiToNote(45)).toBe('A2')
  })

  it('swungTime delays only off-beat 16ths (subs 1 and 3)', () => {
    expect(swungTime(1, 0, 0.3)).toBe('1:0:0.00')   // slot 0 → beat 0 sub 0, straight
    expect(swungTime(0, 5, 0.3)).toBe('0:1:1.30')    // slot 5 → beat 1 sub 1, swung
    expect(swungTime(0, 6, 0.3)).toBe('0:1:2.00')    // sub 2 stays straight
  })

  it('jitterVel stays in [0.1, 1]', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = jitterVel(0.9, rng)
      expect(v).toBeGreaterThanOrEqual(0.1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('motif', () => {
  beforeEach(() => clearMotifs())

  it('same key returns the SAME committed motif (repetition is the rhyme)', () => {
    const rng = mulberry32(1)
    const m1 = getSectionMotif('bass:verse:boom-bap', rng, 0.6, [0, 6])
    const m2 = getSectionMotif('bass:verse:boom-bap', rng, 0.6, [0, 6])
    expect(m2).toEqual(m1)
  })

  it('includes the anchor slots and the downbeat', () => {
    const m = getSectionMotif('k', mulberry32(2), 0.5, [6, 10])
    expect(m.slots).toContain(0)
    expect(m.slots).toContain(6)
    expect(m.slots).toContain(10)
  })

  it('slots are sorted, unique, within 0..15, and 2..8 in count', () => {
    for (let seed = 0; seed < 20; seed++) {
      clearMotifs()
      const m = getSectionMotif('k', mulberry32(seed), seed / 20, [])
      expect(m.slots.length).toBeGreaterThanOrEqual(2)
      expect(m.slots.length).toBeLessThanOrEqual(8)
      expect([...m.slots]).toEqual([...new Set(m.slots)].sort((a, b) => a - b))
      m.slots.forEach(s => { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(15) })
    }
  })

  it('varyMotif changes at most one onset and never drops the downbeat', () => {
    const m = getSectionMotif('k', mulberry32(3), 0.6, [0])
    for (let seed = 0; seed < 20; seed++) {
      const v = varyMotif(m, mulberry32(seed))
      expect(v.slots).toContain(0)
      const added = v.slots.filter(s => !m.slots.includes(s))
      const removed = m.slots.filter(s => !v.slots.includes(s))
      expect(added.length + removed.length).toBeLessThanOrEqual(2) // one shift = 1 add + 1 remove
      expect(v.slots.length).toBeGreaterThanOrEqual(2)
      expect(v.slots.length).toBeLessThanOrEqual(8)
    }
  })
})
