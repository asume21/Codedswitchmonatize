// client/src/organism/generators/freeplay/__tests__/ChordImproviser.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayCompPlan, clearCompCounters } from '../ChordImproviser'
import { clearMotifs } from '../motif'
import { mulberry32, hashString } from '../utils'
import type { FreeplayContext } from '../types'

function ctx(overrides: Partial<FreeplayContext> = {}): FreeplayContext {
  return {
    rootMidi: 60, chordIntervals: [0, 3, 7], bars: 1, swing: 0.3,
    subGenre: 'boom-bap', energy: 0.6, density: 0.6,
    sectionName: 'verse', motifSeed: hashString('chord:verse'),
    kickTimes16ths: [], rng: mulberry32(21),
    ...overrides,
  }
}

const slotOf = (t: string) => {
  const [, beat, sub] = t.split(':').map(parseFloat)
  return beat * 4 + Math.floor(sub)
}

const barOf = (t: string) => parseInt(t.split(':')[0], 10)

describe('ChordImproviser', () => {
  beforeEach(() => { clearMotifs(); clearCompCounters() })

  it('low energy → one sustained pad covering the bar', () => {
    const plan = buildFreeplayCompPlan(ctx({ energy: 0.2 }))
    expect(plan).toHaveLength(1)
    expect(plan[0].time).toBe('0:0:0.00')
    expect(plan[0].dur).toBe('1m')
  })

  it('comp events avoid the backbeat slots (4 and 12) — leave room for the snare', () => {
    for (let seed = 0; seed < 10; seed++) {
      clearMotifs()
      const plan = buildFreeplayCompPlan(ctx({ energy: 0.6, rng: mulberry32(seed) }))
      for (const ev of plan) {
        expect([4, 12]).not.toContain(slotOf(ev.time))
      }
    }
  })

  it('NEVER emits next-voicing anticipations — the looping 1-bar part would fire them a bar early (the "not in key" bug, 2026-07-02)', () => {
    for (let seed = 0; seed < 10; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ energy: 0.9, rng: mulberry32(seed) }))
      expect(plan.length).toBeGreaterThanOrEqual(3)   // stabs still happen
      expect(plan.some(e => e.useNextVoicing)).toBe(false)
    }
  })

  it('same section repeats the same comp rhythm (mostly) — motif memory', () => {
    const p1 = buildFreeplayCompPlan(ctx({ rng: mulberry32(8) }))
    const p2 = buildFreeplayCompPlan(ctx({ rng: mulberry32(9) }))
    const times = (p: typeof p1) => p.filter(e => !e.useNextVoicing).map(e => e.time).sort()
    // calls 1 and 2 of a section = A and A (variation only every 3rd call)
    expect(times(p2)).toEqual(times(p1))
  })

  it('velocities stay in a comping range (never louder than the lead)', () => {
    const plan = buildFreeplayCompPlan(ctx({ energy: 1 }))
    for (const ev of plan) {
      expect(ev.vel).toBeLessThanOrEqual(0.7)
      expect(ev.vel).toBeGreaterThanOrEqual(0.3)
    }
  })

  it('2-bar plan: bar 1 states the motif, bar 2 develops it (not an identical copy)', () => {
    let developed = 0
    for (let seed = 0; seed < 12; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 2, rng: mulberry32(seed) }))
      const barSlots = (bar: number) =>
        plan.filter(e => barOf(e.time) === bar).map(e => slotOf(e.time)).sort((a, b) => a - b)
      expect(barSlots(0).length).toBeGreaterThanOrEqual(1)
      expect(barSlots(1).length).toBeGreaterThanOrEqual(1)
      if (JSON.stringify(barSlots(0)) !== JSON.stringify(barSlots(1))) developed++
    }
    // development is probabilistic per seed but must be the norm
    expect(developed).toBeGreaterThan(6)
  })

  it('2-bar plan still avoids the backbeat and never anticipates the next voicing', () => {
    for (let seed = 0; seed < 10; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.9, rng: mulberry32(seed) }))
      for (const ev of plan) {
        expect([4, 12]).not.toContain(slotOf(ev.time))
        expect(ev.useNextVoicing).toBeUndefined()
      }
    }
  })

  it('4-bar plan uses a real phrase shape, not the same bar four times', () => {
    let varied = 0
    for (let seed = 0; seed < 12; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 4, energy: 0.9, rng: mulberry32(seed) }))
      const barSlots = (bar: number) =>
        plan.filter(e => barOf(e.time) === bar).map(e => slotOf(e.time)).sort((a, b) => a - b)
      const shapes = [0, 1, 2, 3].map(bar => JSON.stringify(barSlots(bar)))
      expect(barSlots(0).length).toBeGreaterThanOrEqual(1)
      expect(barSlots(1).length).toBeGreaterThanOrEqual(1)
      expect(barSlots(2).length).toBeGreaterThanOrEqual(1)
      expect(barSlots(3).length).toBeGreaterThanOrEqual(1)
      if (new Set(shapes).size >= 3) varied++
    }
    expect(varied).toBeGreaterThan(8)
  })

  it('comps in the pockets BETWEEN the kicks — never doubles a syncopated kick slot', () => {
    // Boom-bap-ish kick pattern across 4 bars: slots 0, 6, 10 per bar
    const kicks = [0, 6, 10, 16, 22, 26, 32, 38, 42, 48, 54, 58]
    for (let seed = 0; seed < 12; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.9, kickTimes16ths: kicks, rng: mulberry32(seed) }))
      expect(plan.length).toBeGreaterThanOrEqual(1)   // never comps itself into silence
      for (const ev of plan) {
        const slot = slotOf(ev.time)
        if (slot === 0) continue  // downbeat chord+kick together is the head-nod, allowed
        expect([6, 10], `comp doubled kick slot ${slot} (seed ${seed})`).not.toContain(slot)
      }
    }
  })

  it('dodges the slots the LEAD occupies — comps around the melody, downbeat exempt', () => {
    // Melody sitting on the common comp pockets (per-bar slots)
    const leadBusy = [2, 3, 6, 7, 10, 14]
    for (let seed = 0; seed < 12; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.9, leadBusy16ths: leadBusy, rng: mulberry32(seed) }))
      expect(plan.length).toBeGreaterThanOrEqual(1)
      for (const ev of plan) {
        const slot = slotOf(ev.time)
        if (slot === 0) continue  // downbeat harmony statement is always allowed
        expect(leadBusy, `comp landed on lead slot ${slot} (seed ${seed})`).not.toContain(slot)
      }
    }
  })

  it('lead-dodging is a PREFERENCE — a wall-to-wall melody never silences the comp', () => {
    const everySlot = Array.from({ length: 16 }, (_, i) => i)
    for (let seed = 0; seed < 6; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.9, leadBusy16ths: everySlot, rng: mulberry32(seed) }))
      expect(plan.length).toBeGreaterThanOrEqual(1)   // falls back to kick-filtered slots
      // The push stab respects the lead strictly, so only motif slots remain
      for (const ev of plan) {
        expect(ev.vel).toBeLessThanOrEqual(0.7)
      }
    }
  })

  it('never returns an empty plan even when kicks cover the whole motif', () => {
    const everySlot = Array.from({ length: 16 }, (_, i) => i)
    const plan = buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.9, kickTimes16ths: everySlot }))
    expect(plan.length).toBeGreaterThanOrEqual(1)
    expect(slotOf(plan[0].time)).toBe(0)
  })

  it('low-energy 2-bar plan pads both bars (softer re-attack, no dead second bar)', () => {
    const plan = buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.2 }))
    expect(plan).toHaveLength(2)
    expect(barOf(plan[0].time)).toBe(0)
    expect(barOf(plan[1].time)).toBe(1)
    expect(plan[1].vel).toBeLessThan(plan[0].vel)
  })

  it('low-energy 4-bar plan pads every bar so the harmony breathes across the phrase', () => {
    const plan = buildFreeplayCompPlan(ctx({ bars: 4, energy: 0.2 }))
    expect(plan).toHaveLength(4)
    expect(new Set(plan.map(e => barOf(e.time)))).toEqual(new Set([0, 1, 2, 3]))
  })
})
