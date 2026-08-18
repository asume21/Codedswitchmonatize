/**
 * The intro build-up — Beat Mode's build phase.
 *
 * The model is a loop launcher, in the user's words: "the way i think of it in my
 * head is how i play groove pads. i start one of the pads and it starts looping,
 * i usually let it play one or two rounds then bring in something else."
 *
 * So the unit is the ROUND — the loop's own cycle — not a wall-clock interval and
 * not the chord. A round is tempo-independent and harmony-independent, which is
 * why a launcher never lands wrong, and it is why this module no longer knows
 * what BPM is. The caller counts rounds; this decides who has arrived.
 *
 * The earlier 10-15 second target is retired, by the user: "it doesn't matter
 * exactly when they all come in, what matters is that it comes in where it fits."
 * Do not restore a seconds-based assertion here — see spec A.3.
 *
 * Every generator is already running from bar 0 and merely inaudible, so parts are
 * REVEALED, not started, and the loop underneath never re-phases.
 */

import { describe, it, expect } from 'vitest'
import {
  pickIntroLead,
  introMultipliers,
  ROUNDS_PER_ENTRY,
  INTRO_ROLES,
  type IntroRole,
} from '../introBuild'

/** The round by which every role has arrived. */
const finalEntryRound = (INTRO_ROLES.length - 1) * ROUNDS_PER_ENTRY

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

describe('introMultipliers', () => {
  it.each(INTRO_ROLES)('opens with %s ALONE when it leads', (lead) => {
    const m = introMultipliers(lead, 0)
    expect(m[lead]).toBeGreaterThan(0)
    for (const r of INTRO_ROLES) {
      if (r !== lead) expect(m[r]).toBe(0)
    }
  })

  it.each(INTRO_ROLES)('has every role at full by the final round — lead %s', (lead) => {
    const m = introMultipliers(lead, finalEntryRound)
    for (const r of INTRO_ROLES) expect(m[r]).toBe(1)
  })

  it('stays at full after the build finishes', () => {
    const m = introMultipliers('drums', finalEntryRound + 40)
    for (const r of INTRO_ROLES) expect(m[r]).toBe(1)
  })

  it('never removes a part once it has entered', () => {
    for (const lead of INTRO_ROLES) {
      const arrived = new Set<IntroRole>()
      for (let round = 0; round <= finalEntryRound + 4; round++) {
        const m = introMultipliers(lead, round)
        for (const r of INTRO_ROLES) {
          if (m[r] > 0) arrived.add(r)
          else expect(arrived.has(r)).toBe(false)  // came in, then vanished
        }
      }
    }
  })

  it('adds exactly one part per entry — a launcher brings in one pad at a time', () => {
    const lead: IntroRole = 'drums'
    let previous = 0
    for (let round = 0; round <= finalEntryRound; round += ROUNDS_PER_ENTRY) {
      const m = introMultipliers(lead, round)
      const playing = INTRO_ROLES.filter(r => m[r] > 0).length
      expect(playing).toBe(previous + 1)
      previous = playing
    }
  })

  it('holds the line between entries — nothing changes mid-round', () => {
    if (ROUNDS_PER_ENTRY === 1) return  // no gap to hold when every round admits one
    const lead: IntroRole = 'melody'
    for (let round = 0; round < finalEntryRound; round++) {
      if (round % ROUNDS_PER_ENTRY === 0) continue
      expect(introMultipliers(lead, round)).toEqual(introMultipliers(lead, round - 1))
    }
  })

  it('brings the pocket in before the decoration when melody leads', () => {
    const order: IntroRole[] = []
    for (let round = 0; round <= finalEntryRound; round += ROUNDS_PER_ENTRY) {
      const m = introMultipliers('melody', round)
      for (const r of INTRO_ROLES) if (m[r] > 0 && !order.includes(r)) order.push(r)
    }
    expect(order[0]).toBe('melody')
    // Foundation before colour: drums and bass both land before texture.
    expect(order.indexOf('drums')).toBeLessThan(order.indexOf('texture'))
    expect(order.indexOf('bass')).toBeLessThan(order.indexOf('texture'))
    expect(order).toHaveLength(INTRO_ROLES.length)
  })

  it('opens with drums alone when Beat Mode names the lead', () => {
    // Beat Mode does not roll for a lead — the user asked for drums first, so the
    // caller passes it. This is the whole of the "drums first" requirement.
    const m = introMultipliers('drums', 0)
    expect(m.drums).toBe(1)
    expect(m.bass).toBe(0)
    expect(m.chord).toBe(0)
    expect(m.melody).toBe(0)
    expect(m.texture).toBe(0)
  })

  it('treats a negative or bogus round as the opening', () => {
    const m = introMultipliers('drums', -3)
    expect(m.drums).toBe(1)
    expect(m.texture).toBe(0)
    expect(introMultipliers('drums', NaN)).toEqual(m)
  })
})
