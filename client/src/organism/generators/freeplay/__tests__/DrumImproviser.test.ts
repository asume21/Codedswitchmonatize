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

  it('the sub-genre skeleton is IMMUTABLE — every bar contains every anchor', () => {
    const hits = buildFreeplayDrumHits(ctx())
    const { kicks, snares } = SKELETONS['boom-bap']
    for (let bar = 0; bar < 4; bar++) {
      const kickSlots = hits.filter(h => h.instrument === 'kick' && slotOf(h.time).bar === bar).map(h => slotOf(h.time).slot)
      const snareSlots = hits.filter(h => h.instrument === 'snare' && slotOf(h.time).bar === bar && h.velocity > 0.4).map(h => slotOf(h.time).slot)
      for (const k of kicks) expect(kickSlots).toContain(k)
      for (const s of snares) expect(snareSlots).toContain(s)
    }
  })

  it('trap skeleton differs from boom-bap (genre identity preserved)', () => {
    expect(SKELETONS['trap'].snares).not.toEqual(SKELETONS['boom-bap'].snares)
  })

  it('improvised extra kicks are syncopation only — never on quarter notes (the four-on-the-floor bug, 2026-07-02)', () => {
    for (let seed = 0; seed < 15; seed++) {
      clearMotifs()
      const hits = buildFreeplayDrumHits(ctx({ rng: mulberry32(seed), density: 1.0 }))
      const skeletonKicks = new Set(SKELETONS['boom-bap'].kicks)
      const extraKicks = hits.filter(h =>
        h.instrument === 'kick' && !skeletonKicks.has(slotOf(h.time).slot))
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

  it('bar 4 contains a fill (extra snares on the last beat) when energy is high', () => {
    const hits = buildFreeplayDrumHits(ctx({ energy: 0.9 }))
    const lastBeatSnares = hits.filter(h =>
      h.instrument === 'snare' && slotOf(h.time).bar === 3 && slotOf(h.time).slot >= 12)
    expect(lastBeatSnares.length).toBeGreaterThanOrEqual(3)
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
