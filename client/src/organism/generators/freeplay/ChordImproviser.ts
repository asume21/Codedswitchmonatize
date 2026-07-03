// client/src/organism/generators/freeplay/ChordImproviser.ts
// Freeplay comping: WHEN and HOW to hit — never WHAT pitches (the Conductor's
// voicing owns the notes; ChordGenerator maps this plan onto it).

import type { FreeplayContext } from './types'
import { getSectionMotif, varyMotif, type RhythmMotif } from './motif'
import { swungTime } from './utils'

export interface CompEvent {
  time: string
  dur: string
  vel: number
  /** Anticipation: render with the NEXT chord's voicing (pickup into the change).
   *  CURRENTLY NEVER SET: the comp Part loops shorter than the harmonic rhythm
   *  can guarantee, so a baked-in anticipation fires early with the wrong
   *  chord's notes — measured as the user's "not in key" (2026-07-02).
   *  Re-enable only from a scheduler that knows the real chord boundary. */
  useNextVoicing?: boolean
}

// Per-section call counter → A-A-A'-A across successive rebuilds.
const compCounters = new Map<string, number>()

const BACKBEAT = new Set([4, 12])

// The mid-bar push slot — "and of 2" (slot 6). A syncopated stab there is the
// keys-player push that makes comping feel intentional, and it is SAFE with the
// current voicing (unlike a next-chord anticipation, it never lands on a
// harmony boundary).
const PUSH_SLOT = 6

const clampVel = (v: number) => Math.min(0.7, Math.max(0.3, v))

/**
 * Multi-bar comp plan (ctx.bars, aligned to the part loop):
 * bar 0 states the section's comp motif; the LAST bar develops it — one bounded
 * variation plus (usually) a mid-bar push. A 1-bar request keeps the legacy
 * behaviour: statement bars with a variation every 3rd rebuild.
 */
export function buildFreeplayCompPlan(ctx: FreeplayContext): CompEvent[] {
  const bars = Math.max(1, Math.floor(ctx.bars) || 1)

  // Low energy: one pad per bar. Space is comping too — the re-attack each bar
  // (slightly softer) keeps the pad breathing instead of freezing.
  if (ctx.energy < 0.4) {
    return Array.from({ length: bars }, (_, bar) => ({
      time: swungTime(bar, 0, ctx.swing),
      dur: '1m',
      vel: bar === 0 ? 0.5 : 0.44,
    }))
  }

  const key = `chord:${ctx.sectionName}:${ctx.subGenre}`
  const count = (compCounters.get(key) ?? 0) + 1
  compCounters.set(key, count)

  const motif = getSectionMotif(key, ctx.rng, Math.min(ctx.density, 0.5), [0])

  // Band awareness: the drum pattern's kick slots (pushed by the orchestrator,
  // same channel the bass uses). A keys player comps in the pockets BETWEEN
  // the kicks — doubling a syncopated kick just thickens it into mud. The
  // downbeat is exempt: chord + kick arriving together on beat 1 is the
  // head-nod, not a collision.
  const kickSet = new Set(ctx.kickTimes16ths.map(s => ((Math.floor(s) % 16) + 16) % 16))
  const collides = (slot: number) => slot !== 0 && kickSet.has(slot)

  const events: CompEvent[] = []
  for (let bar = 0; bar < bars; bar++) {
    const isDevBar = bars > 1 ? bar === bars - 1 : count % 3 === 0
    const mask: RhythmMotif = isDevBar ? varyMotif(motif, ctx.rng) : motif
    const slots = mask.slots
      .filter(s => !BACKBEAT.has(s) && !collides(s))
      .slice(0, ctx.energy > 0.7 ? 4 : 3)

    slots.forEach((slot, i) => {
      events.push({
        time: swungTime(bar, slot, ctx.swing),
        dur: ctx.energy > 0.7 ? '8n' : slot === 0 ? '2n' : '4n',
        vel: clampVel((slot === 0 ? 0.6 : 0.48) - i * 0.02 + (isDevBar ? 0.04 : 0)),
      })
    })

    // Development bar usually adds the mid-bar push (same voicing — safe).
    // The push also dodges the kick: try the and-of-2 first, then neighbours.
    if (isDevBar && bars > 1 && ctx.rng() < 0.8) {
      const pushSlot = [PUSH_SLOT, PUSH_SLOT + 1, PUSH_SLOT - 1]
        .find(s => !collides(s) && !BACKBEAT.has(s) && !slots.includes(s))
      if (pushSlot !== undefined) {
        events.push({ time: swungTime(bar, pushSlot, ctx.swing), dur: '8n', vel: 0.52 })
      }
    }
  }

  // Kick-heavy patterns can filter a sparse motif to nothing — always leave at
  // least the downbeat anchor so the harmony never vanishes for a whole cycle.
  if (events.length === 0) {
    events.push({ time: swungTime(0, 0, ctx.swing), dur: '2n', vel: 0.55 })
  }

  return events
}

/** Reset the A-A-A' counters (orchestrator cold start). */
export function clearCompCounters(): void {
  compCounters.clear()
}
