// client/src/organism/generators/freeplay/__tests__/ChordImproviser.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildFreeplayCompPlan, clearCompCounters, pickCompGesture, pickCompFigure } from '../ChordImproviser'
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
      const plan = buildFreeplayCompPlan(ctx({ energy: 0.9, compGesture: 'stabs', rng: mulberry32(seed) }))
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

  // CHANGED 2026-08-04 (spec §14). This used to require bar 2 to DEVELOP away
  // from bar 1 in most seeds. Two bars is one loop — restating it is the point,
  // and per-bar development is what made the placement wander. The phrase shape
  // now lives in the 4-bar turnaround, not in every second bar.
  it('2-bar plan restates the figure — two bars is one loop', () => {
    for (let seed = 0; seed < 12; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 2, compGesture: 'stabs', rng: mulberry32(seed) }))
      const barSlots = (bar: number) =>
        plan.filter(e => barOf(e.time) === bar).map(e => slotOf(e.time)).sort((a, b) => a - b)
      expect(barSlots(0).length).toBeGreaterThanOrEqual(1)
      expect(JSON.stringify(barSlots(1))).toBe(JSON.stringify(barSlots(0)))
    }
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

  // CHANGED 2026-08-04 (spec §14). This used to require >=3 DISTINCT bar shapes
  // out of 4 — "not the same bar four times". That intent produced placement that
  // wandered every bar, which the user heard as "those notes almost seem to just
  // randomly play whenever". A comp is a figure you commit to; the phrase shape
  // now lives in the TURNAROUND, exactly like the drum tiling: bars 1-3 restate
  // the figure, bar 4 pushes into the next phrase.
  it('4-bar plan repeats the figure and turns around on the last bar', () => {
    for (let seed = 0; seed < 12; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 4, energy: 0.9, compGesture: 'stabs', rng: mulberry32(seed) }))
      const barSlots = (bar: number) =>
        plan.filter(e => barOf(e.time) === bar).map(e => slotOf(e.time)).sort((a, b) => a - b)
      for (const bar of [0, 1, 2, 3]) expect(barSlots(bar).length).toBeGreaterThanOrEqual(1)

      // The figure is the same in every non-turnaround bar...
      expect(JSON.stringify(barSlots(1))).toBe(JSON.stringify(barSlots(0)))
      expect(JSON.stringify(barSlots(2))).toBe(JSON.stringify(barSlots(0)))
      // ...and the turnaround bar resolves the phrase rather than restating it.
      expect(barSlots(3).length).toBeGreaterThanOrEqual(barSlots(0).length)
    }
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

  it('dodges the slots the LEAD occupies — in THAT bar only, downbeat exempt', () => {
    // leadBusy16ths is ABSOLUTE (bar * 16 + slot). Here the melody plays those
    // pockets in BAR 0 and is silent in bar 1.
    const busySlots = [2, 3, 6, 7, 10, 14]
    const inBar0 = busySlots.map(s => 0 * 16 + s)
    const inBar1 = busySlots.map(s => 1 * 16 + s)

    // Pin the gesture to a motif/stab path — lead-dodging (leadRoom) only applies
    // there. Without this the gesture is picked via the session-salt-seeded
    // pickCompGesture, and a bed gesture (sustain/roll) ignores leadBusy16ths
    // entirely, so moving the lead's bar changes nothing → flaky `differed === 0`.
    const planFor = (leadBusy16ths: number[], seed: number) => {
      clearMotifs(); clearCompCounters()
      return buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.9, compGesture: 'stabs', leadBusy16ths, rng: mulberry32(seed) }))
    }

    let differed = 0
    for (let seed = 0; seed < 12; seed++) {
      const planA = planFor(inBar0, seed)
      expect(planA.length).toBeGreaterThanOrEqual(1)

      // The comp must not land on a lead slot in the bar the melody is actually in.
      for (const ev of planA) {
        const slot = slotOf(ev.time)
        if (slot === 0) continue           // downbeat statement is always allowed
        if (barOf(ev.time) !== 0) continue // bar 1 is silent here — free to use
        expect(busySlots, `comp landed on a lead slot in bar 0 (slot ${slot}, seed ${seed})`)
          .not.toContain(slot)
      }

      // Moving the SAME slots to the other bar must be able to change the plan.
      // These used to fold with % 16, so bar-0-busy and bar-1-busy were literally
      // indistinguishable and produced identical output every time — the comp
      // thinned out against a melody that wasn't playing in that bar.
      const planB = planFor(inBar1, seed)
      if (JSON.stringify(planA) !== JSON.stringify(planB)) differed++
    }
    expect(differed, 'which bar the lead occupies never changed the comp — still folded?')
      .toBeGreaterThan(0)
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

  // ── Animator gestures (2026-07-09 reference study) ──────────────────

  it('sustain gesture is a legato bed: one whole-bar hold per bar', () => {
    const plan = buildFreeplayCompPlan(ctx({ bars: 4, energy: 0.9, compGesture: 'sustain' }))
    expect(plan).toHaveLength(4)
    for (const ev of plan) {
      expect(ev.dur).toBe('1m')
      expect(slotOf(ev.time)).toBe(0)   // downbeat only — no stabs
    }
  })

  it('roll gesture re-attacks mid-bar so chords flow (downbeat + half-bar)', () => {
    const plan = buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.9, compGesture: 'roll' }))
    const slots = plan.map(e => slotOf(e.time)).sort((a, b) => a - b)
    expect(slots).toContain(0)   // downbeat
    expect(slots).toContain(8)   // half-bar re-attack
  })

  it('phrase-end gesture holds a quiet bed then bursts into the turnaround', () => {
    const plan = buildFreeplayCompPlan(ctx({ bars: 4, energy: 0.9, compGesture: 'phrase-end' }))
    const finalBarBurst = plan.filter(e => barOf(e.time) === 3 && slotOf(e.time) >= 9)
    expect(finalBarBurst.length).toBeGreaterThanOrEqual(2)   // the burst exists
    // earlier bars are single whole-bar holds
    for (const bar of [0, 1, 2]) {
      const inBar = plan.filter(e => barOf(e.time) === bar)
      expect(inBar).toHaveLength(1)
      expect(inBar[0].dur).toBe('1m')
    }
  })

  it('alternate gesture leaves odd bars as a single pad hold between stab bars', () => {
    const plan = buildFreeplayCompPlan(ctx({ bars: 4, energy: 0.9, compGesture: 'alternate', motifSeed: hashString('chord:verse') }))
    for (const oddBar of [1, 3]) {
      const inBar = plan.filter(e => barOf(e.time) === oddBar)
      expect(inBar, `bar ${oddBar} should be one pad hold`).toHaveLength(1)
      expect(inBar[0].dur).toBe('1m')
    }
  })

  it('call-response gesture keeps its non-downbeat comps in the back half of the bar', () => {
    for (let seed = 0; seed < 8; seed++) {
      clearMotifs(); clearCompCounters()
      const plan = buildFreeplayCompPlan(ctx({ bars: 2, energy: 0.9, compGesture: 'call-response', rng: mulberry32(seed) }))
      for (const ev of plan) {
        const slot = slotOf(ev.time)
        if (slot === 0) continue   // downbeat anchor allowed
        expect(slot, `call-response comp in front half (slot ${slot}, seed ${seed})`).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it('gesture is stable per motifSeed but varies across seeds (identity, not churn)', () => {
    // Same seed → same gesture every time (a section keeps its comping
    // identity; churn was the conductor-part2 lesson).
    const seed = hashString('chord:verse')
    expect(pickCompGesture(seed)).toBe(pickCompGesture(seed))
    // Different sections must not all collapse to one gesture.
    const gestures = new Set(
      ['chord:intro', 'chord:verse', 'chord:hook', 'chord:drop', 'chord:bridge', 'chord:break']
        .map(s => pickCompGesture(hashString(s))),
    )
    expect(gestures.size).toBeGreaterThanOrEqual(2)
  })
})

// ── §14: the comp plays a FIGURE it commits to ───────────────────────
// The stab path built its rhythm by SUBTRACTION — !BACKBEAT && !collides &&
// leadRoom, filling cell.gaps — so the part was whatever the kick, backbeat and
// melody didn't take. Measured for a boom-bap verse: b0:[0,3,14] b1:[0,3]
// b2:[0,3,5,14] b3:[0,3,5]. It plays the downbeat and then NEVER a beat again,
// landing on the sixteenths flanking beat 2 (slots 3 and 5). The user: "those
// notes almost seem to just randomly play whenever".
//
// A comp is a positive statement: a figure on FELT positions (8th-note slots)
// that repeats every bar so the ear can lock onto it. Avoidance becomes a
// tiebreaker on a single hit, never the thing that generates the part.
describe('ChordImproviser — comp figure (§14)', () => {
  beforeEach(() => { clearMotifs(); clearCompCounters() })

  it('the figure sits on FELT 8th-note positions, never the weak 16ths', () => {
    for (let seed = 0; seed < 8; seed++) {
      const figure = pickCompFigure('boom-bap', seed)
      expect(figure.length).toBeGreaterThan(0)
      for (const slot of figure) {
        expect(slot % 2).toBe(0)            // 8th-note grid — no 3s and 5s
        expect([4, 12]).not.toContain(slot) // still leaves the snare its room
      }
    }
  })

  it('plays the SAME figure in every bar — the ear can lock onto it', () => {
    const plan = buildFreeplayCompPlan(ctx({ bars: 4, energy: 0.6, compGesture: 'stabs' }))
    const byBar = new Map<number, number[]>()
    for (const ev of plan) {
      const bar = barOf(ev.time)
      byBar.set(bar, [...(byBar.get(bar) ?? []), slotOf(ev.time)].sort((a, b) => a - b))
    }
    // Bar 3 is the turnaround (see the phrase-shape test); bars 0-2 restate.
    const bars = [...byBar.keys()].sort((a, b) => a - b).filter(b => (b % 4) !== 3)
    expect(bars.length).toBeGreaterThan(1)
    const first = JSON.stringify(byBar.get(bars[0]))
    for (const bar of bars.slice(1)) {
      expect(JSON.stringify(byBar.get(bar))).toBe(first)
    }
  })

  it('a kick collision moves ONE hit, it does not regenerate the bar', () => {
    const base = buildFreeplayCompPlan(ctx({ bars: 1, energy: 0.6, compGesture: 'stabs' }))
    const baseSlots = base.map(e => slotOf(e.time)).sort((a, b) => a - b)
    const clash = baseSlots.find(s => s !== 0)
    expect(clash).toBeDefined()

    clearMotifs(); clearCompCounters()
    const dodged = buildFreeplayCompPlan(
      ctx({ bars: 1, energy: 0.6, compGesture: 'stabs', kickTimes16ths: [clash!] }),
    )
    const dodgedSlots = dodged.map(e => slotOf(e.time)).sort((a, b) => a - b)

    // Every other hit of the figure survives untouched.
    const survivors = baseSlots.filter(s => s !== clash)
    for (const s of survivors) expect(dodgedSlots).toContain(s)
    expect(dodgedSlots).not.toContain(clash)
  })
})
