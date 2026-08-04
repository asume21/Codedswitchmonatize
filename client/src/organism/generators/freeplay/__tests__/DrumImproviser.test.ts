// client/src/organism/generators/freeplay/__tests__/DrumImproviser.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayDrumHits, buildFreeplaySectionDrumHits, drumSectionSeedKey, SKELETONS } from '../DrumImproviser'
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
    // 'house' belongs in this list and was missing: four-on-the-floor means a kick
    // on every beat of every bar, so bars A and B are IDENTICAL by definition.
    // Making bar B "answer" bar A would stop it being house. The skeleton was
    // right; this list had the gap.
    const identical = ['jersey-club', 'reggaeton', 'chill', 'house']
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

  it('hats hold a stable locked pocket — density does NOT balloon them', () => {
    // 2026-07-11 fire-beats cohesion: the hat pocket is a COMMITTED repeating
    // figure (8th-note backbone + at most 2 deterministic 16th infills),
    // deliberately NOT scaled by density — a busier section no longer turns the
    // hats into a wandering rattle. This intentionally supersedes the old
    // "density controls hat count" contract.
    const sparse = buildFreeplayDrumHits(ctx({ density: 0.2, sectionName: 'intro' }))
    clearMotifs()
    const busy = buildFreeplayDrumHits(ctx({ density: 1.0, sectionName: 'drop' }))
    const hats = (hs: typeof sparse) => hs.filter(h => h.instrument === 'hat').length

    // Both sections keep a solid, steady hat backbone...
    expect(hats(sparse)).toBeGreaterThan(24)
    expect(hats(busy)).toBeGreaterThan(24)
    // ...and neither balloons: the count stays in a tight band regardless of density.
    expect(Math.abs(hats(busy) - hats(sparse))).toBeLessThanOrEqual(6)

    // OPEN QUESTION — judge by ear via `npm run capture:fire-beats`: should a
    // `drop` feel busier than an `intro`? If yes, scale the infill cap with
    // density in DrumImproviser and assert hats(busy) > hats(sparse) here.
  })

  it('16th hat infill repeats as a committed motif — it never flickers bar to bar', () => {
    const hits = buildFreeplayDrumHits(ctx({ density: 1.0 }))
    const offSixteenthSlots = (bar: number) => new Set(
      hits.filter(h => h.instrument === 'hat' && slotOf(h.time).bar === bar && slotOf(h.time).slot % 2 === 1)
        .map(h => slotOf(h.time).slot))
    // Union of infill slots across bars 0-2 should be small (a committed idea),
    // not spread across all 8 off-16th positions like a coin flip would.
    const union = new Set([...offSixteenthSlots(0), ...offSixteenthSlots(1), ...offSixteenthSlots(2)])
    expect(union.size).toBeGreaterThan(0)
    expect(union.size).toBeLessThanOrEqual(6)
    for (const slot of union) {
      expect(offSixteenthSlots(0)).toContain(slot)
      expect(offSixteenthSlots(1)).toContain(slot)
      expect(offSixteenthSlots(2)).toContain(slot)
    }
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

// ── Section tiling ───────────────────────────────────────────────────
// Song Mode scales template sections x4 (ProducerArrangement SECTION_LENGTH_SCALE),
// so a 4-bar template verse is 16 LIVE bars — but buildDrumHits only ever built 4
// and DrumGenerator looped it at '4m'. The listener got the identical 4-bar
// kick/hat/FILL phrase four times per verse, with no sense the section ever ended.
//
// The fix must not break the locked loop (a beat is ~6 sections, each a locked
// perfect loop — repetition IS the point). So: tile the SAME core across the
// section and escalate only its final bar, the turnaround into the next section.
describe('DrumImproviser — section tiling', () => {
  const sig = (hits: ReturnType<typeof buildFreeplaySectionDrumHits>, n: number) =>
    hits
      .filter(h => slotOf(h.time).bar === n)
      .map(h => `${h.instrument}@${slotOf(h.time).slot}`)
      .sort()
      .join(',')

  it('keeps kick/snare anchors locked while later cycles add a small lift', () => {
    const hits = buildFreeplaySectionDrumHits(ctx(), 16)
    const rhythm = (bar: number) => hits
      .filter(h => slotOf(h.time).bar === bar && (h.instrument === 'kick' || h.instrument === 'snare'))
      .map(h => `${h.instrument}@${slotOf(h.time).slot}`)
      .sort()
      .join(',')

    // The groove's identity never changes mid-section.
    for (const offset of [4, 8]) {
      for (let bar = 0; bar < 4; bar++) expect(rhythm(offset + bar)).toBe(rhythm(bar))
    }

    // But it is not a byte-identical 4-bar clone: cycle lifts create movement.
    expect(sig(hits, 6)).not.toBe(sig(hits, 2))
    expect(sig(hits, 10)).not.toBe(sig(hits, 2))
  })

  it('escalates only the final bar of the section as a turnaround', () => {
    const hits = buildFreeplaySectionDrumHits(ctx(), 16)
    const rhythm = (bar: number) => hits
      .filter(h => slotOf(h.time).bar === bar && (h.instrument === 'kick' || h.instrument === 'snare'))
      .map(h => `${h.instrument}@${slotOf(h.time).slot}`)
      .sort()
      .join(',')
    // The last cycle is the core right up to its final bar...
    // (a subtle hat lift is allowed; the kick/snare identity remains locked).
    expect(rhythm(12)).toBe(rhythm(0))
    expect(rhythm(13)).toBe(rhythm(1))
    expect(rhythm(14)).toBe(rhythm(2))
    // ...whose final bar resolves the section instead of restating bar 4 again.
    expect(sig(hits, 15)).not.toBe(sig(hits, 3))
  })

  it('a section no longer than the core is left as the plain locked loop', () => {
    const hits = buildFreeplaySectionDrumHits(ctx(), 4)
    const lastBar = Math.max(...hits.map(h => slotOf(h.time).bar))
    expect(lastBar).toBe(3)
  })
})

// ── Section-occurrence seed ──────────────────────────────────────────
// The drum seed was hash(`drums:${section}:${subGenre}`) — no occurrence term —
// so re-entering a named section resolved the SAME seed and replayed the exact
// same phrase. But making every verse unique is the opposite overreach: verse 2's
// drums usually ARE verse 1's, and that sameness is what makes it one beat.
// Classic form is A / A': alternate between two locks.
describe('drumSectionSeedKey', () => {
  it('gives a returning section a different lock the second time through', () => {
    expect(drumSectionSeedKey('verse', 'trap', 1)).not.toBe(drumSectionSeedKey('verse', 'trap', 0))
  })

  it('returns to the first lock on the third visit (A / A′ alternation)', () => {
    expect(drumSectionSeedKey('verse', 'trap', 2)).toBe(drumSectionSeedKey('verse', 'trap', 0))
  })

  it('keeps different sections and sub-genres on different locks', () => {
    expect(drumSectionSeedKey('hook', 'trap', 0)).not.toBe(drumSectionSeedKey('verse', 'trap', 0))
    expect(drumSectionSeedKey('verse', 'drill', 0)).not.toBe(drumSectionSeedKey('verse', 'trap', 0))
  })
})
