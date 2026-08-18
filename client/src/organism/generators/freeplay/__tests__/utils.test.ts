// client/src/organism/generators/freeplay/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest'
import { durationToSixteenths, extractBusySlots16ths, sectionMotifKey, sectionVariantKey } from '../utils'

describe('durationToSixteenths', () => {
  it('maps Tone notation to slot counts', () => {
    expect(durationToSixteenths('16n')).toBe(1)
    expect(durationToSixteenths('8n')).toBe(2)
    expect(durationToSixteenths('4n')).toBe(4)
    expect(durationToSixteenths('1m')).toBe(16)
    expect(durationToSixteenths('8n.')).toBe(3)   // dotted ×1.5
  })

  it('unknown shapes under-claim one slot instead of blocking a bar', () => {
    expect(durationToSixteenths('weird')).toBe(1)
  })
})

describe('extractBusySlots16ths', () => {
  it('marks onset plus held duration, keeping the bar (absolute slots)', () => {
    const events = [
      { time: '0:0:0', dur: '4n' },   // bar 0, slots 0-3
      { time: '1:2:0', dur: '8n' },   // bar 1, beat 2 -> absolute 24-25
    ]
    // These used to fold with % 16, so the second event came back as 8-9 and was
    // indistinguishable from a bar-0 note. That made the chord comp dodge a melody
    // note in EVERY bar because it existed in one — sparse comping against notes
    // that were not playing. The bar is information the consumer needs.
    expect(extractBusySlots16ths(events)).toEqual([0, 1, 2, 3, 24, 25])
  })

  it('skips malformed times, never throws', () => {
    expect(extractBusySlots16ths([{ time: 'bad', dur: '8n' }])).toEqual([])
  })

  it('swing fractions floor to the slot', () => {
    expect(extractBusySlots16ths([{ time: '0:1:1.35', dur: '16n' }])).toEqual([5])
  })
})

// ── Section seed vocabulary ──────────────────────────────────────────
// The whole rhythm section keys its locked loop off these two numbers, so
// they live in one place: `lock` = which occurrence of this section within a
// pass, `pass` = which time through the whole form.
describe('sectionVariantKey', () => {
  it('rotates a returning section through A / A\'', () => {
    expect(sectionVariantKey(1, 0)).not.toBe(sectionVariantKey(0, 0))
    expect(sectionVariantKey(2, 0)).toBe(sectionVariantKey(0, 0))
  })

  it('gives every pass through the form its own material', () => {
    expect(sectionVariantKey(0, 1)).not.toBe(sectionVariantKey(0, 0))
    expect(sectionVariantKey(0, 2)).not.toBe(sectionVariantKey(0, 1))
  })

  it('never produces a negative lock from a bogus occurrence', () => {
    expect(sectionVariantKey(-1, 0)).toBe(sectionVariantKey(1, 0))
  })
})

describe('sectionMotifKey', () => {
  it('separates parts, sections, variants and sub-genres', () => {
    const base = sectionMotifKey('bass', 'verse', '0:0', 'trap')
    expect(sectionMotifKey('chord', 'verse', '0:0', 'trap')).not.toBe(base)
    expect(sectionMotifKey('bass', 'drop', '0:0', 'trap')).not.toBe(base)
    expect(sectionMotifKey('bass', 'verse', '1:0', 'trap')).not.toBe(base)
    expect(sectionMotifKey('bass', 'verse', '0:0', 'drill')).not.toBe(base)
  })

  it('is stable for the same inputs — the loop must not move inside a section', () => {
    expect(sectionMotifKey('bass', 'verse', '0:0', 'trap'))
      .toBe(sectionMotifKey('bass', 'verse', '0:0', 'trap'))
  })
})
