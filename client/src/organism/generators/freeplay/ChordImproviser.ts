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
   *  CURRENTLY NEVER SET: the comp Part loops 1 bar while the harmonic rhythm is
   *  2 bars, so a baked-in anticipation fires a full bar early half the time —
   *  the wrong chord's notes, measured as the user's "not in key" (2026-07-02).
   *  Re-enable only from a scheduler that knows the real chord boundary. */
  useNextVoicing?: boolean
}

// Per-section call counter → A-A-A'-A across successive 1-bar rebuilds.
const compCounters = new Map<string, number>()

const BACKBEAT = new Set([4, 12])

export function buildFreeplayCompPlan(ctx: FreeplayContext): CompEvent[] {
  // Low energy: one pad, whole bar. Space is comping too.
  if (ctx.energy < 0.4) {
    return [{ time: swungTime(0, 0, ctx.swing), dur: '1m', vel: 0.5 }]
  }

  const key = `chord:${ctx.sectionName}:${ctx.subGenre}`
  const count = (compCounters.get(key) ?? 0) + 1
  compCounters.set(key, count)

  const motif = getSectionMotif(key, ctx.rng, Math.min(ctx.density, 0.5), [0])

  // Every 3rd bar gets the single bounded variation (A-A-A'), else the motif.
  const mask: RhythmMotif = count % 3 === 0 ? varyMotif(motif, ctx.rng) : motif
  const slots = mask.slots.filter(s => !BACKBEAT.has(s)).slice(0, ctx.energy > 0.7 ? 4 : 3)

  const events: CompEvent[] = slots.map((slot, i) => ({
    time: swungTime(0, slot, ctx.swing),
    dur: ctx.energy > 0.7 ? '8n' : slot === 0 ? '2n' : '4n',
    vel: Math.min(0.7, Math.max(0.3, (slot === 0 ? 0.6 : 0.48) - i * 0.02)),
  }))

  return events
}

/** Reset the A-A-A' counters (orchestrator cold start). */
export function clearCompCounters(): void {
  compCounters.clear()
}
