// client/src/organism/generators/freeplay/ChordImproviser.ts
// Freeplay comping: WHEN and HOW to hit — never WHAT pitches (the Conductor's
// voicing owns the notes; ChordGenerator maps this plan onto it).

import type { FreeplayContext, CompGesture } from './types'
import { getSectionMotif, varyMotif, type RhythmMotif } from './motif'
import { swungTime, mulberry32, getSessionSalt } from './utils'
import { getSongCell } from './songCell'

// ── Animator gestures (2026-07-09 reference study) ──────────────────
// Six reference beats shared one architecture — a pad BED plus a keys
// ANIMATOR — and differed almost only in the animator's gesture. This is
// that vocabulary. Gesture reference map:
//   stabs         ref #2: short rhythmic stabs ARE the rhythm (motif path)
//   sustain       ref #1: legato bed holding under a separate hook
//   roll          ref #3: chords flowing/re-attacking mid-bar, voice-led
//   phrase-end    ref #4: quiet bed + stab burst only at the 4-bar turnaround
//   alternate     ref #5: stabs every OTHER bar, pad between
//   call-response ref #6: keys answer in the back half of each bar
//
// Picked from the stable motifSeed (hash of section+subGenre), NOT the
// per-rebuild rng, so a section keeps its comping identity (churn was the
// conductor-part2 lesson); rotation comes from section changes and new
// sessions. Callers may override via ctx.compGesture for explicit control.
export function pickCompGesture(motifSeed: number): CompGesture {
  const r = mulberry32(motifSeed + getSessionSalt() * 7)()
  if (r < 0.30) return 'stabs'
  if (r < 0.45) return 'sustain'
  if (r < 0.60) return 'roll'
  if (r < 0.75) return 'phrase-end'
  if (r < 0.875) return 'alternate'
  return 'call-response'
}

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

  const gesture = ctx.compGesture ?? pickCompGesture(ctx.motifSeed)

  // Band awareness (shared by every gesture). Kick slots come from the drum
  // pattern (same channel the bass uses): a keys player comps in the pockets
  // BETWEEN the kicks — doubling a syncopated kick just thickens it into mud.
  // Downbeat is exempt: chord + kick on beat 1 is the head-nod, not a clash.
  const kickSet = new Set(ctx.kickTimes16ths.map(s => ((Math.floor(s) % 16) + 16) % 16))
  const collides = (slot: number) => slot !== 0 && kickSet.has(slot)

  // Lead awareness: slots the melody occupies. Dodging the kick is a RULE
  // (doubling it is mud); dodging the lead is a PREFERENCE — if the melody is
  // everywhere, comp anyway rather than vanish. Downbeat exempt as ever.
  const leadBusy = new Set((ctx.leadBusy16ths ?? []).map(s => ((Math.floor(s) % 16) + 16) % 16))
  const leadRoom = (slot: number) => slot === 0 || !leadBusy.has(slot)

  // Bed-like gestures don't need the motif machinery at all.
  if (gesture === 'sustain') {
    // Legato bed: whole-bar holds, breathing velocity. The hook lives
    // elsewhere (melody motif / texture pluck), so the keys stay smooth.
    return Array.from({ length: bars }, (_, bar) => ({
      time: swungTime(bar, 0, ctx.swing),
      dur: '1m',
      vel: bar % 2 === 0 ? 0.55 : 0.48,
    }))
  }

  if (gesture === 'roll') {
    // Rolling movement: re-attack at the half-bar so chords flow into each
    // other instead of freezing (voice-leading between chords comes free
    // from the Conductor's voicing engine at the next harmony change).
    const events: CompEvent[] = []
    for (let bar = 0; bar < bars; bar++) {
      events.push({ time: swungTime(bar, 0, ctx.swing), dur: '2n', vel: bar === 0 ? 0.56 : 0.5 })
      events.push({ time: swungTime(bar, 8, ctx.swing), dur: '2n', vel: 0.46 })
    }
    return events
  }

  if (gesture === 'phrase-end') {
    // Quiet whole-bar bed all phrase, then a small stab burst into the
    // turnaround — ref-#4's bell-motif placement, voiced as the chord. The
    // burst still obeys the shared rules: back-half slots that dodge the
    // backbeat (snare), the kick, and the lead.
    const events: CompEvent[] = Array.from({ length: bars }, (_, bar) => ({
      time: swungTime(bar, 0, ctx.swing),
      dur: '1m',
      vel: 0.45,
    }))
    const finalBar = bars - 1
    const burstSlots = [9, 10, 11, 13, 14, 15]
      .filter(s => !BACKBEAT.has(s) && !collides(s) && leadRoom(s))
      .slice(0, 3)
    let burstVel = 0.48
    for (const s of burstSlots) {
      events.push({ time: swungTime(finalBar, s, ctx.swing), dur: '8n', vel: clampVel(burstVel) })
      burstVel += 0.04
    }
    return events
  }

  const key = `chord:${ctx.sectionName}:${ctx.subGenre}`
  const count = (compCounters.get(key) ?? 0) + 1
  compCounters.set(key, count)

  // COHESION — the chords ANSWER the song cell. The comp speaks in the idea's
  // GAPS (call and response): the band states the cell, the keys reply in the
  // holes it leaves. Doubling the cell would be a unison and read as robotic;
  // ignoring it — which is what a private `chord:<section>` motif did — is why
  // nobody sounded like they were playing together.
  //
  // The comp keeps its own motif machinery (the gesture/mask logic downstream
  // depends on its density contract) and is ANCHORED to the cell's gaps rather
  // than replaced by them.
  const cell = getSongCell(ctx.sectionName, ctx.subGenre, ctx.rng, ctx.density)
  const answerAnchors = [0, ...cell.gaps.filter(s => s !== 0 && s % 2 === 0).slice(0, 2)]
  const motif = getSectionMotif(key, ctx.rng, Math.min(ctx.density, 0.5), answerAnchors)

  const events: CompEvent[] = []
  for (let bar = 0; bar < bars; bar++) {
    // 'alternate' (ref #5): odd bars are a whole-bar pad hold instead of
    // stabs, so the keys speak every OTHER bar with air between. The stab
    // bars still run the motif path below.
    if (gesture === 'alternate' && bar % 2 === 1) {
      events.push({ time: swungTime(bar, 0, ctx.swing), dur: '1m', vel: 0.46 })
      continue
    }

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
    let pool = roomy.length > 0 ? roomy : kickFree

    // 'call-response' (ref #6): the keys "answer" in the back half of the bar.
    // Keep the downbeat anchor, then restrict the rest to slots >= 8 so the
    // comp reads as a response to the front-of-bar drums rather than doubling
    // them. If the motif landed nothing in the back half, synthesize one
    // answer there (dodging kick/backbeat/lead) — falling back to the motif's
    // front-half slots would defeat the whole gesture.
    if (gesture === 'call-response') {
      const anchor = pool.includes(0) ? [0] : []
      const backHalf = pool.filter(s => s >= 8)
      if (backHalf.length > 0) {
        pool = [...anchor, ...backHalf]
      } else {
        const answer = [10, 8, 14, 9, 11, 13].find(s => !collides(s) && !BACKBEAT.has(s) && leadRoom(s))
        pool = [...anchor, ...(answer !== undefined ? [answer] : [])]
      }
    }
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
    // Skipped for 'call-response', whose whole character is answering in the
    // BACK half — a front-of-bar push (slot 6) would break that.
    if (gesture !== 'call-response' && (role === 'develop' || role === 'answer') && bars > 1 && ctx.rng() < (role === 'develop' ? 0.85 : 0.65)) {
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
