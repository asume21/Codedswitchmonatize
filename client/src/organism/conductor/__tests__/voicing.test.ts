import { describe, expect, it } from 'vitest'
import { voiceChord } from '../voicing'
import type { ParsedChord } from '../Conductor'

// Plain ParsedChord literals — avoids importing the runtime Conductor (Tone).
const chord = (symbol: string, rootMidi: number, intervals: number[]): ParsedChord => ({
  symbol, root: symbol[0], quality: '', rootMidi, intervals,
  pitches: intervals.map((i) => rootMidi + i),
})

const C  = chord('C', 60, [0, 4, 7])       // C E G
const Am = chord('Am', 69, [0, 3, 7])       // A C E
const F  = chord('F', 65, [0, 4, 7])        // F A C
const Cmaj7 = chord('Cmaj7', 60, [0, 4, 7, 11]) // C E G B

const pcOf = (m: number) => ((m % 12) + 12) % 12
// total movement: each note's distance to its nearest note in `prev`
const movement = (a: number[], prev: number[]) =>
  a.reduce((s, n) => s + Math.min(...prev.map((p) => Math.abs(n - p))), 0)

describe('voiceChord', () => {
  it('puts the root in the bass register (C2–B2)', () => {
    const v = voiceChord(C, null)
    expect(pcOf(v.bass)).toBe(0)          // C
    expect(v.bass).toBeGreaterThanOrEqual(36)
    expect(v.bass).toBeLessThanOrEqual(47)
  })

  it('inner voices cover the chord pitch classes', () => {
    const v = voiceChord(C, null)
    const innerPCs = new Set(v.inner.map(pcOf))
    expect(innerPCs).toEqual(new Set([0, 4, 7]))  // C E G
  })

  it('guide tones are the 3rd and 7th', () => {
    const v = voiceChord(Cmaj7, null)
    const guidePCs = new Set(v.guideTones.map(pcOf))
    expect(guidePCs).toEqual(new Set([4, 11]))    // E (3rd), B (7th)
  })

  it('holds common tones across a chord change (C → Am keeps C and E)', () => {
    const prev = voiceChord(C, null)
    const cur = voiceChord(Am, prev)
    // C (pc 0) and E (pc 4) are shared; their exact MIDI notes should persist.
    for (const note of prev.inner) {
      if (pcOf(note) === 0 || pcOf(note) === 4) {
        expect(cur.inner).toContain(note)
      }
    }
  })

  it('voice-leads with less movement than a root-position restack (C → F)', () => {
    const prev = voiceChord(C, null)
    const led = voiceChord(F, prev)
    const naive = F.pitches  // root-position F A C — what we do today
    expect(movement(led.inner, prev.inner)).toBeLessThan(movement(naive, prev.inner))
  })
})

// V4 — the Conductor picks a voicing STYLE per preset: lush genres comp with an
// open (drop-2) spread, the rest keep the close block. Same notes, wider register.
describe('voiceChord — spread style', () => {
  const span = (a: number[]) => Math.max(...a) - Math.min(...a)

  it('defaults to the close block voicing when no style is given', () => {
    expect(voiceChord(Cmaj7, null).inner).toEqual(voiceChord(Cmaj7, null, { style: 'close' }).inner)
  })

  it('spread is wider than the close block voicing', () => {
    const close = voiceChord(Cmaj7, null, { style: 'close' })
    const spread = voiceChord(Cmaj7, null, { style: 'spread' })
    expect(span(spread.inner)).toBeGreaterThan(span(close.inner))
  })

  it('spread keeps the same chord pitch classes (it re-registers, not re-harmonises)', () => {
    const spread = voiceChord(Cmaj7, null, { style: 'spread' })
    expect(new Set(spread.inner.map(pcOf))).toEqual(new Set([0, 4, 7, 11]))
  })

  it('spread stays in the comp register, out of the bass OCTAVE (not just the bass note)', () => {
    const spread = voiceChord(Cmaj7, null, { style: 'spread' })
    // The real anti-mud guarantee: no comp voice drops into the bass octave
    // (C2–B2, 36–47). The default comp floor is C3 (48).
    expect(Math.min(...spread.inner)).toBeGreaterThanOrEqual(48)
  })
})
