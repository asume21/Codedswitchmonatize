/**
 * The intro build-up, in beat mode with song mode off.
 *
 * User: "when i start the music i put it in beat mode and turn off song mode and
 * at that point is where it need to decide its intro which i want to only be one
 * generator and then within maybe 10-15 sec get all five going but its a build up
 * and it just works" — then "it can start with any of them", then the constraint
 * that decides the shape: "as long as what it is playing is a loop".
 *
 * That last one is why entries are quantised to BAR BOUNDARIES rather than to a
 * wall-clock interval. A part revealed 3.2s in would start halfway through its own
 * figure, and the thing stops being a loop. Every generator is already running from
 * bar 0 and merely inaudible, so parts are REVEALED, not started, and the loop
 * underneath never re-phases.
 *
 * Replaces GeneratorOrchestrator.INTRO_STACK, which was a hardcoded 4-row table
 * that opened with THREE parts (chords + melody + pad) and measured its build in
 * bars — so it ran 10s at 144 BPM and 16s at 90.
 */

import { describe, it, expect } from 'vitest'
import {
  pickIntroLead,
  introSpacingBars,
  introMultipliers,
  INTRO_ROLES,
  type IntroRole,
} from '../introBuild'

const barSeconds = (bpm: number) => (60 / bpm) * 4

/** The bar at which every role has arrived, for a given spacing. */
const finalEntryBar = (spacing: number) => spacing * (INTRO_ROLES.length - 1)

describe('pickIntroLead', () => {
  it('can pick any of the five', () => {
    const seen = new Set<IntroRole>()
    for (let seed = 0; seed < 400; seed++) seen.add(pickIntroLead(seed))
    expect(seen.size).toBe(INTRO_ROLES.length)
  })

  it('is stable for a given seed — the same take opens the same way', () => {
    expect(pickIntroLead(12345)).toBe(pickIntroLead(12345))
  })
})

describe('introSpacingBars', () => {
  it('is always a whole number of bars, so entries land on the downbeat', () => {
    for (let bpm = 70; bpm <= 180; bpm += 1) {
      const s = introSpacingBars(bpm)
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(1)
    }
  })

  it('lands the full band in roughly 8-17s across every usable tempo', () => {
    // The user asked for 10-15s. Entries must sit on bar lines, so the spacing is
    // an integer and the achievable total moves in steps of a bar — at some tempos
    // the nearest choice falls just outside the window. This asserts the real
    // guarantee rather than pretending the window is exact.
    for (let bpm = 70; bpm <= 180; bpm += 1) {
      const total = finalEntryBar(introSpacingBars(bpm)) * barSeconds(bpm)
      expect(total).toBeGreaterThanOrEqual(8)
      expect(total).toBeLessThanOrEqual(17)
    }
  })
})

describe('introMultipliers', () => {
  const bpm = 144
  const spacing = introSpacingBars(bpm)

  it.each(INTRO_ROLES)('opens with %s ALONE when it leads', (lead) => {
    const m = introMultipliers(lead, 0, bpm)
    expect(m[lead]).toBeGreaterThan(0)
    for (const r of INTRO_ROLES) {
      if (r !== lead) expect(m[r]).toBe(0)
    }
  })

  it.each(INTRO_ROLES)('has every role at full by the final entry — lead %s', (lead) => {
    const m = introMultipliers(lead, finalEntryBar(spacing), bpm)
    for (const r of INTRO_ROLES) expect(m[r]).toBe(1)
  })

  it('stays at full after the build finishes', () => {
    const m = introMultipliers('drums', finalEntryBar(spacing) + 40, bpm)
    for (const r of INTRO_ROLES) expect(m[r]).toBe(1)
  })

  it('never removes a part once it has entered', () => {
    for (const lead of INTRO_ROLES) {
      const arrived = new Set<IntroRole>()
      for (let bar = 0; bar <= finalEntryBar(spacing) + 4; bar++) {
        const m = introMultipliers(lead, bar, bpm)
        for (const r of INTRO_ROLES) {
          if (m[r] > 0) arrived.add(r)
          else expect(arrived.has(r)).toBe(false)  // came in, then vanished
        }
      }
    }
  })

  it('only changes on a spacing boundary — no part appears mid-phrase', () => {
    const lead: IntroRole = 'melody'
    for (let bar = 0; bar < finalEntryBar(spacing); bar++) {
      if (bar % spacing === 0) continue
      const prev = introMultipliers(lead, bar - 1, bpm)
      const here = introMultipliers(lead, bar, bpm)
      expect(here).toEqual(prev)
    }
  })

  it('brings the pocket in before the decoration when melody leads', () => {
    const order: IntroRole[] = []
    for (let bar = 0; bar <= finalEntryBar(spacing); bar += spacing) {
      const m = introMultipliers('melody', bar, bpm)
      for (const r of INTRO_ROLES) if (m[r] > 0 && !order.includes(r)) order.push(r)
    }
    expect(order[0]).toBe('melody')
    // Foundation before colour: drums and bass both land before texture.
    expect(order.indexOf('drums')).toBeLessThan(order.indexOf('texture'))
    expect(order.indexOf('bass')).toBeLessThan(order.indexOf('texture'))
    expect(order).toHaveLength(INTRO_ROLES.length)
  })
})
