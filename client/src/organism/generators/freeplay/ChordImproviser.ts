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
// ── Genre-specific gesture weights ───────────────────────────────────
const GENRE_GESTURE_WEIGHTS: Record<string, Partial<Record<CompGesture, number>>> = {
  classical:    { sustain: 0.35, roll: 0.35, stabs: 0.10, 'phrase-end': 0.10, 'call-response': 0.10 },
  jazz:         { roll: 0.30, sustain: 0.25, stabs: 0.15, 'call-response': 0.15, alternate: 0.15 },
  gospel:       { sustain: 0.30, roll: 0.25, stabs: 0.20, 'call-response': 0.15, 'phrase-end': 0.10 },
  funk:         { stabs: 0.40, 'call-response': 0.25, alternate: 0.20, roll: 0.10, sustain: 0.05 },
  house:        { stabs: 0.35, roll: 0.25, sustain: 0.20, alternate: 0.10, 'phrase-end': 0.10 },
  dnb:          { stabs: 0.30, roll: 0.30, sustain: 0.20, 'phrase-end': 0.10, alternate: 0.10 },
  pop:          { alternate: 0.30, sustain: 0.25, stabs: 0.20, roll: 0.15, 'call-response': 0.10 },
  electronic:   { roll: 0.30, stabs: 0.25, sustain: 0.20, alternate: 0.15, 'phrase-end': 0.10 },
}

function pickWeightedGesture(motifSeed: number, weights: Partial<Record<CompGesture, number>>): CompGesture {
  const r = mulberry32(motifSeed + getSessionSalt() * 7)()
  let cumulative = 0
  for (const [gesture, weight] of Object.entries(weights)) {
    cumulative += weight
    if (r < cumulative) return gesture as CompGesture
  }
  return 'stabs'
}

export function pickCompGesture(motifSeed: number, subGenre?: string): CompGesture {
  const weights = GENRE_GESTURE_WEIGHTS[subGenre ?? '']
  if (weights) return pickWeightedGesture(motifSeed, weights)
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

/**
 * §14 — COMP FIGURES. A comp is a positive statement, not what's left over.
 *
 * The stab path used to build its rhythm by subtraction (!BACKBEAT && !collides
 * && leadRoom, filling cell.gaps), so the part was whatever the kick, backbeat
 * and melody didn't take. Measured for a boom-bap verse: b0:[0,3,14] b1:[0,3]
 * b2:[0,3,5,14] b3:[0,3,5] — it plays the downbeat and then NEVER a beat again,
 * landing on the sixteenths flanking beat 2. The user heard exactly that:
 * "those notes almost seem to just randomly play whenever."
 *
 * Every figure here sits on the 8th-note grid (even slots) — felt positions a
 * listener can lock onto — and still leaves 4 and 12 to the snare.
 */
const COMP_FIGURES: Record<string, number[][]> = {
  'boom-bap':   [[0, 6, 14], [0, 6, 10], [0, 10, 14]],   // Rhodes on the "and"s
  'lo-fi':      [[0, 6, 14], [0, 10], [2, 6, 10, 14]],
  'r&b-soul':   [[0, 6, 10, 14], [0, 6, 14], [2, 10]],
  'west-coast': [[0, 6, 10], [0, 14], [0, 6, 10, 14]],
  'trap':       [[0, 14], [0, 6], [0, 10, 14]],           // sparse, pushes the change
  'drill':      [[0, 14], [0, 10], [0, 6, 14]],
  'phonk':      [[0, 14], [0, 6, 14], [0, 10]],
  'house':      [[2, 6, 10, 14], [0, 6, 10, 14]],         // offbeat stabs
  'funk':       [[2, 6, 10, 14], [0, 6, 14], [0, 2, 10]],
  'default':    [[0, 6, 14], [0, 10], [0, 6, 10, 14]],
}

/** The section's committed comp figure. Deterministic per style+seed, like the
 *  drum lock — it must NOT change bar to bar or the ear never locks on. */
export function pickCompFigure(subGenre: string, seed: number): number[] {
  const bank = COMP_FIGURES[subGenre] ?? COMP_FIGURES['default']
  const idx = Math.abs(Math.floor(seed)) % bank.length
  return bank[idx]
}

// The mid-bar push slot — "and of 2" (slot 6). A syncopated stab there is the
// keys-player push that makes comping feel intentional, and it is SAFE with the
// current voicing (unlike a next-chord anticipation, it never lands on a
// harmony boundary).
const PUSH_SLOT = 6

const clampVel = (v: number) => Math.min(0.7, Math.max(0.3, v))

// Hook mode (chords-as-the-hook flip, 2026-07-17): when the chord role is
// 'lead' the comp IS the hook, so velocities get presence instead of the
// support ceiling. Same shape, higher floor and ceiling.
const clampHookVel = (v: number) => Math.min(0.85, Math.max(0.4, v + 0.12))

// Bed-like gestures can't carry a hook. When the chords lead, remap them to a
// foreground gesture — deterministically from the motifSeed so the section
// keeps ONE identity (no churn).
const HOOK_GESTURES: CompGesture[] = ['stabs', 'roll', 'call-response']
function toHookGesture(gesture: CompGesture, motifSeed: number): CompGesture {
  if (gesture === 'sustain' || gesture === 'phrase-end') {
    return HOOK_GESTURES[Math.floor(mulberry32(motifSeed + 13)() * HOOK_GESTURES.length)]
  }
  return gesture
}

/**
 * Multi-bar comp plan (ctx.bars, aligned to the part loop):
 * - 1 bar: legacy A / A / A' / A across rebuilds
 * - 2 bars: statement -> development
 * - 4 bars: statement -> echo -> development -> answer
 */
export function buildFreeplayCompPlan(ctx: FreeplayContext): CompEvent[] {
  const bars = Math.max(1, Math.floor(ctx.bars) || 1)
  const hook = ctx.hookMode === true
  const vel = hook ? clampHookVel : clampVel

  // Low energy: one pad per bar. Space is comping too — the re-attack each bar
  // (slightly softer) keeps the pad breathing instead of freezing. In hook mode
  // the threshold drops: a hook has to speak even in laid-back sections.
  if (ctx.energy < (hook ? 0.25 : 0.4)) {
    return Array.from({ length: bars }, (_, bar) => ({
      time: swungTime(bar, 0, ctx.swing),
      dur: '1m',
      vel: bar === 0 ? 0.5 : 0.44,
    }))
  }

  const rawGesture = ctx.compGesture ?? pickCompGesture(ctx.motifSeed, ctx.subGenre)
  const gesture = hook ? toHookGesture(rawGesture, ctx.motifSeed) : rawGesture

  // Band awareness (shared by every gesture). Kick slots come from the drum
  // pattern (same channel the bass uses): a keys player comps in the pockets
  // BETWEEN the kicks — doubling a syncopated kick just thickens it into mud.
  // Downbeat is exempt: chord + kick on beat 1 is the head-nod, not a clash.
  const kickSet = new Set(ctx.kickTimes16ths.map(s => ((Math.floor(s) % 16) + 16) % 16))
  const collides = (slot: number) => slot !== 0 && kickSet.has(slot)

  // Lead awareness: slots the melody occupies. Dodging the kick is a RULE
  // (doubling it is mud); dodging the lead is a PREFERENCE — if the melody is
  // everywhere, comp anyway rather than vanish. Downbeat exempt as ever.
  // In hook mode the priority inverts: the comp OWNS the space and the melody
  // (disciplined to sparse answers by the orchestrator) dodges around it.
  // ABSOLUTE slots (bar*16 + slot), so the check is per-bar. Folding them into one
  // 16-slot mask meant a melody note anywhere in the phrase blocked that slot in
  // EVERY bar — the comp thinned out against notes that were not playing.
  const leadBusy = new Set((ctx.leadBusy16ths ?? []).map(s => Math.floor(s)))
  const leadRoom = (bar: number, slot: number) =>
    hook || slot === 0 || !leadBusy.has(bar * 16 + slot)

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
      events.push({ time: swungTime(bar, 0, ctx.swing), dur: '2n', vel: vel(bar === 0 ? 0.56 : 0.5) })
      events.push({ time: swungTime(bar, 8, ctx.swing), dur: '2n', vel: vel(0.46) })
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
      .filter(s => !BACKBEAT.has(s) && !collides(s) && leadRoom(finalBar, s))
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
  // Hook mode gets a denser motif ceiling — a support comp answers in gaps,
  // a hook states a real riff.
  // Kept so the section's motif memory (and its rng draws) stay stable for the
  // other gestures and for anything downstream that reads the cell — the stab
  // path no longer derives its PLACEMENT from it (§14).
  void getSectionMotif(key, ctx.rng, Math.min(ctx.density, hook ? 0.7 : 0.5), answerAnchors)

  // The section's committed comp figure. One per style+seed, identical in every
  // bar — this is the loop the listener locks onto.
  const figure = pickCompFigure(ctx.subGenre, ctx.motifSeed)

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

    // §14 — the FIGURE is the part. It is identical in every bar so the ear can
    // lock onto it; `role` below still shapes velocity and duration, so the comp
    // breathes without the placement wandering.
    //
    // Avoidance is now a TIEBREAKER on a single hit, never the generator of the
    // rhythm: a hit that lands on a kick slides to the next 8th (or the previous
    // one), and only drops if both are taken. The figure survives intact.
    const taken = new Set<number>()
    const nudged: number[] = []
    for (const slot of figure) {
      let placed = -1
      if (!collides(slot) && !taken.has(slot)) {
        placed = slot
      } else {
        // Slide to a free neighbouring 8th. `taken` matters: without it two hits
        // can nudge onto the SAME slot (house [2,6,10,14] put 6→8 and 10→8,
        // giving a duplicated 8) — two notes stacked on one beat, not a figure.
        for (const alt of [slot + 2, slot - 2]) {
          const wrapped = ((alt % 16) + 16) % 16
          if (!collides(wrapped) && !BACKBEAT.has(wrapped) && !taken.has(wrapped)) { placed = wrapped; break }
        }
      }
      if (placed >= 0) { taken.add(placed); nudged.push(placed) }
    }

    // Lead dodging stays a PREFERENCE: thin against the melody only while at
    // least one hit survives, otherwise comp anyway rather than vanish.
    const roomy = nudged.filter(s => leadRoom(bar, s))
    let pool = roomy.length > 0 ? roomy : nudged

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
        const answer = [10, 8, 14, 9, 11, 13].find(s => !collides(s) && !BACKBEAT.has(s) && leadRoom(bar, s))
        pool = [...anchor, ...(answer !== undefined ? [answer] : [])]
      }
    }
    const classicalMult = ctx.subGenre === 'classical' || ctx.subGenre === 'jazz' ? 1.5 : 1.0
    const houseMult = ctx.subGenre === 'house' || ctx.subGenre === 'dnb' || ctx.subGenre === 'electronic' ? 1.3 : 1.0
    const baseLimit = Math.round((ctx.energy > 0.7 ? 4 : 3) * Math.max(classicalMult, houseMult))
    const limit = role === 'echo' ? Math.max(1, baseLimit - 1)
      : role === 'answer' ? Math.max(2, baseLimit - 1)
      : baseLimit
    // The figure plays WHOLE. Role no longer trims or reorders the placement —
    // per-bar reordering is what stopped it being a figure at all.
    //
    // TURNAROUND: the last bar of each 4-bar phrase adds one push into the next
    // phrase. Same shape as the drum tiling — the loop is sacred, the phrase
    // still resolves, and the ear gets "same beat, going somewhere" instead of
    // either four identical bars or four different ones.
    const isTurnaround = bars >= 4 && (bar % 4) === 3
    const base = pool.slice(0, Math.max(limit, pool.length))
    let slots = base
    if (isTurnaround) {
      const push = [14, 10, 6, 2].find(s => !base.includes(s) && !collides(s) && !BACKBEAT.has(s))
      // If every push position is already taken, resolve the phrase by OPENING a
      // hole instead — drop the last hit. Silence is a turnaround too, and it
      // guarantees the phrase always resolves rather than silently restating
      // (boom-bap [0,6,14] had no free push slot and got no turnaround at all).
      slots = push !== undefined
        ? [...base, push]
        : base.length > 1 ? base.slice(0, -1) : base
    }
    slots = [...slots].sort((a, b) => a - b)

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
        vel: vel(
          (slot === 0 ? 0.6 : 0.48)
          - i * 0.02
          + (isDevBar ? 0.04 : 0)
          - (role === 'echo' ? 0.03 : 0)
          - (isAnswerBar ? 0.02 : 0),
        ),
      })
    })

    // REMOVED 2026-08-04 (§14): a per-bar COIN FLIP (rng() < 0.85 on develop,
    // < 0.65 on answer) used to add a mid-bar push here. That is randomness
    // mutating the figure bar to bar — the same class of problem as generating
    // placement by subtraction, and part of why the comp never settled into
    // something the ear could hold. The deterministic turnaround on the last bar
    // of each 4-bar phrase (above) serves the same musical purpose: it pushes
    // into the next phrase, but at a position you can predict.
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
