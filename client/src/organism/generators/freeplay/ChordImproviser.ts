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

// Per-section call counter → legacy 1-bar mode repeats A-A-A'-A across
// successive rebuilds. Multi-bar plans now develop INSIDE the phrase.
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
 * - 1 bar: legacy A / A / A' / A across rebuilds
 * - 2 bars: statement -> development
 * - 4 bars: statement -> echo -> development -> answer
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

  // Lead awareness: slots the melody occupies. Dodging the kick is a RULE
  // (doubling it is mud); dodging the lead is a PREFERENCE — if the melody is
  // everywhere, comp anyway rather than vanish. Downbeat exempt as ever.
  const leadBusy = new Set((ctx.leadBusy16ths ?? []).map(s => ((Math.floor(s) % 16) + 16) % 16))
  const leadRoom = (slot: number) => slot === 0 || !leadBusy.has(slot)

  const events: CompEvent[] = []
  for (let bar = 0; bar < bars; bar++) {
    const role = bars <= 1
      ? (count % 3 === 0 ? 'develop' : 'statement')
      : bars === 2
        ? (bar === 0 ? 'statement' : 'develop')
        : ((bar % 4) === 0 ? 'statement'
          : (bar % 4) === 1 ? 'echo'
          : (bar % 4) === 2 ? 'develop'
          : 'answer')

    const mask: RhythmMotif = role === 'statement' || role === 'echo'
      ? motif
      : varyMotif(motif, ctx.rng)
    const kickFree = mask.slots.filter(s => !BACKBEAT.has(s) && !collides(s))
    const roomy = kickFree.filter(leadRoom)
    const pool = roomy.length > 0 ? roomy : kickFree
    const baseLimit = ctx.energy > 0.7 ? 4 : 3
    const limit = role === 'echo' ? Math.max(1, baseLimit - 1)
      : role === 'answer' ? Math.max(2, baseLimit - 1)
      : baseLimit
    let slots = pool.slice(0, limit)

    if (role === 'answer') {
      const keepDownbeat = slots.includes(0) ? [0] : []
      const later = pool.filter(s => s >= PUSH_SLOT && s !== 0)
      const early = pool.filter(s => s < PUSH_SLOT && s !== 0)
      slots = [...new Set([...keepDownbeat, ...later, ...early])].slice(0, limit).sort((a, b) => a - b)
    }

    slots.forEach((slot, i) => {
      const isStatementBar = role === 'statement'
      const isDevBar = role === 'develop'
      const isAnswerBar = role === 'answer'
      events.push({
        time: swungTime(bar, slot, ctx.swing),
        dur: ctx.energy > 0.7
          ? '8n'
          : slot === 0
            ? (isStatementBar ? '2n' : '4n')
            : (isAnswerBar ? '8n' : '4n'),
        vel: clampVel(
          (slot === 0 ? 0.6 : 0.48)
          - i * 0.02
          + (isDevBar ? 0.04 : 0)
          - (role === 'echo' ? 0.03 : 0)
          - (isAnswerBar ? 0.02 : 0),
        ),
      })
    })

    // Development/answer bars usually add the mid-bar push (same voicing — safe).
    // The push also dodges the kick: try the and-of-2 first, then neighbours.
    if ((role === 'develop' || role === 'answer') && bars > 1 && ctx.rng() < (role === 'develop' ? 0.85 : 0.65)) {
      const pushSlot = [PUSH_SLOT, PUSH_SLOT + 1, PUSH_SLOT - 1]
        .find(s => !collides(s) && !BACKBEAT.has(s) && !slots.includes(s) && leadRoom(s))
      if (pushSlot !== undefined) {
        events.push({ time: swungTime(bar, pushSlot, ctx.swing), dur: '8n', vel: role === 'develop' ? 0.52 : 0.48 })
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
