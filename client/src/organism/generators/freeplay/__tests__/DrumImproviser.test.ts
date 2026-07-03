// client/src/organism/generators/freeplay/__tests__/DrumImproviser.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayDrumHits, SKELETONS } from '../DrumImproviser'
import { clearMotifs } from '../motif'
import { mulberry32, hashString } from '../utils'
import type { FreeplayContext } from '../types'

function ctx(overrides: Partial<FreeplayContext> = {}): FreeplayContext {
  return {
    rootMidi: 36, chordIntervals: [0, 3, 7], bars: 4, swing: 0.3,
    subGenre: 'boom-bap', energy: 0.6, density: 0.7,
    sectionName: 'verse', motifSeed: hashString('verse:boom-bap'),
    kickTimes16ths: [], rng: mulberry32(11),
    ...overrides,
  }
}

const slotOf = (t: string) => {
  const [bar, beat, sub] = t.split(':').map(parseFloat)
  return { bar, slot: beat * 4 + Math.floor(sub) }
}

describe('DrumImproviser', () => {
  beforeEach(() => clearMotifs())

  it('the sub-genre skeleton is IMMUTABLE — bar A/B anchors present on their bars', () => {
    const hits = buildFreeplayDrumHits(ctx())
    const { kicks, kicksB, snares } = SKELETONS['boom-bap']
    for (let bar = 0; bar < 4; bar++) {
      const kickSlots = hits.filter(h => h.instrument === 'kick' && slotOf(h.time).bar === bar).map(h => slotOf(h.time).slot)
      const snareSlots = hits.filter(h => h.instrument === 'snare' && slotOf(h.time).bar === bar && h.velocity > 0.4).map(h => slotOf(h.time).slot)
      const barKicks = bar % 2 === 0 ? kicks : kicksB
      for (const k of barKicks) expect(kickSlots).toContain(k)
      for (const s of snares) expect(snareSlots).toContain(s)
    }
  })

  it('kick programming is a 2-bar cycle — bar B answers bar A for most genres', () => {
    // Genres whose kick IS the genre identity keep A === B; the rest must differ.
    const identical = ['jersey-club', 'reggaeton', 'chill']
    for (const [genre, sk] of Object.entries(SKELETONS)) {
      if (identical.includes(genre)) {
        expect(sk.kicksB, genre).toEqual(sk.kicks)
      } else {
        expect(sk.kicksB, genre).not.toEqual(sk.kicks)
      }
      // Both bars keep the downbeat anchor
      expect(sk.kicks).toContain(0)
      expect(sk.kicksB).toContain(0)
    }
  })

  it('trap skeleton differs from boom-bap (genre identity preserved)', () => {
    expect(SKELETONS['trap'].snares).not.toEqual(SKELETONS['boom-bap'].snares)
  })

  it('improvised extra kicks are syncopation only — never on quarter notes (the four-on-the-floor bug, 2026-07-02)', () => {
    for (let seed = 0; seed < 15; seed++) {
      clearMotifs()
      const hits = buildFreeplayDrumHits(ctx({ rng: mulberry32(seed), density: 1.0 }))
      const sk = SKELETONS['boom-bap']
      const skeletonKicks = new Set([...sk.kicks, ...sk.kicksB])
      const extraKicks = hits.filter(h =>
        h.instrument === 'kick' && !skeletonKicks.has(slotOf(h.time).slot)
        // fill-bar kick stutters (slots 12/14 on bar 3) are a fill, not floor kicks
        && !(slotOf(h.time).bar === 3 && slotOf(h.time).slot >= 12))
      for (const k of extraKicks) {
        expect(slotOf(k.time).slot % 4, `extra kick on quarter-note slot ${slotOf(k.time).slot} (seed ${seed})`).not.toBe(0)
      }
      // and no more than 2 extra kicks per bar
      for (let bar = 0; bar < 4; bar++) {
        expect(extraKicks.filter(k => slotOf(k.time).bar === bar).length).toBeLessThanOrEqual(2)
      }
    }
  })

  it('density controls hat count', () => {
    const sparse = buildFreeplayDrumHits(ctx({ density: 0.2, sectionName: 'intro' }))
    clearMotifs()
    const busy = buildFreeplayDrumHits(ctx({ density: 1.0, sectionName: 'drop' }))
    const hats = (hs: typeof sparse) => hs.filter(h => h.instrument === 'hat').length
    expect(hats(busy)).toBeGreaterThan(hats(sparse))
  })

  it('16th hat infill repeats as a motif — same off-16th slots recur across bars', () => {
    const hits = buildFreeplayDrumHits(ctx({ density: 1.0 }))
    const offSixteenthSlots = (bar: number) => new Set(
      hits.filter(h => h.instrument === 'hat' && slotOf(h.time).bar === bar && slotOf(h.time).slot % 2 === 1)
        .map(h => slotOf(h.time).slot))
    // Union of infill slots across bars 0-2 should be small (a committed idea),
    // not spread across all 8 off-16th positions like a coin flip would.
    const union = new Set([...offSixteenthSlots(0), ...offSixteenthSlots(1), ...offSixteenthSlots(2)])
    expect(union.size).toBeLessThanOrEqual(6)
  })

  it('open-hat accents fire above the kit open/closed velocity split (>0.55)', () => {
    // Across seeds, at least some phrases must contain open-hat-capable velocities
    // on the off-beat 8ths — before this, freeplay could never trigger an open hat.
    let found = 0
    for (let seed = 0; seed < 10; seed++) {
      clearMotifs()
      const hits = buildFreeplayDrumHits(ctx({ rng: mulberry32(seed), density: 0.8 }))
      if (hits.some(h => h.instrument === 'hat' && h.velocity > 0.55 && slotOf(h.time).slot % 2 === 0)) found++
    }
    expect(found).toBeGreaterThan(3)
  })

  it('bar 4 contains a fill when energy is high, and fill flavours rotate across seeds', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 24; seed++) {
      clearMotifs()
      const hits = buildFreeplayDrumHits(ctx({ rng: mulberry32(seed), energy: 0.9 }))
      const lastBeat = hits.filter(h => slotOf(h.time).bar === 3 && slotOf(h.time).slot >= 12)
      const snares = lastBeat.filter(h => h.instrument === 'snare' && !SKELETONS['boom-bap'].snares.includes(slotOf(h.time).slot))
      const kicks = lastBeat.filter(h => h.instrument === 'kick' && slotOf(h.time).slot >= 12)
      const percs = lastBeat.filter(h => h.instrument === 'perc')
      const hats = lastBeat.filter(h => h.instrument === 'hat')
      if (snares.length >= 3) seen.add('snare-run')
      else if (kicks.length >= 2) seen.add('kick-stutter')
      else if (percs.length >= 3) seen.add('perc-run')
      else if (hats.length === 0 && snares.length >= 1) seen.add('cut')
      // Every phrase must end with SOME fill statement
      expect(snares.length + kicks.length + percs.length, `no fill at seed ${seed}`).toBeGreaterThanOrEqual(1)
    }
    expect(seen.size, `only saw fill types: ${[...seen].join(', ')}`).toBeGreaterThanOrEqual(3)
  })

  it('no fill when energy is low (intro stays clean)', () => {
    const hits = buildFreeplayDrumHits(ctx({ energy: 0.2, sectionName: 'intro' }))
    const { snares } = SKELETONS['boom-bap']
    const extraLastBeat = hits.filter(h =>
      h.instrument === 'snare' && slotOf(h.time).bar === 3 &&
      slotOf(h.time).slot >= 12 && !snares.includes(slotOf(h.time).slot))
    expect(extraLastBeat.length).toBe(0)
  })

  it('is deterministic for the same seed', () => {
    const h1 = buildFreeplayDrumHits(ctx({ rng: mulberry32(4) }))
    clearMotifs()
    const h2 = buildFreeplayDrumHits(ctx({ rng: mulberry32(4) }))
    expect(h1).toEqual(h2)
  })

  it('every sub-genre in the SWING table has a skeleton', () => {
    for (const g of ['boom-bap','trap','drill','lo-fi','west-coast','dirty-south','phonk','jersey-club','bounce','reggaeton','afrobeat','chill']) {
      expect(SKELETONS[g], `missing skeleton: ${g}`).toBeDefined()
    }
  })
})
