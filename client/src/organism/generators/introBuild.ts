/**
 * introBuild — the intro build-up for Beat Mode with Song Mode off.
 *
 * WHAT THE USER ASKED FOR
 *
 * "when i start the music i put it in beat mode and turn off song mode and at that
 * point is where it need to decide its intro which i want to only be one generator
 * and then within maybe 10-15 sec get all five going but its a build up and it just
 * works", then "it can start with any of them", then the line that decides the
 * shape: "as long as what it is playing is a loop".
 *
 * WHY THE UNIT IS THE ROUND (revised 2026-08-17)
 *
 * That last constraint rules out a wall-clock ramp. A part revealed 3.2 seconds in
 * starts halfway through its own figure, and the result is not a loop. The first
 * version answered that with whole BARS chosen from the tempo, aimed at a 10-15s
 * window. Both of those are now gone, because the user described what he actually
 * means: "the way i think of it in my head is how i play groove pads. i start one
 * of the pads and it starts looping, i usually let it play one or two rounds then
 * bring in something else."
 *
 * So the unit is the ROUND — the loop's own cycle. It is tempo-independent and
 * harmony-independent, which is exactly why a launcher never lands wrong, and it
 * is why this file no longer knows what BPM is. The caller counts rounds (the
 * engine's locked core is DRUM_CORE_BARS long); this only decides who has arrived.
 *
 * The seconds target is retired, in the user's words: "it doesn't matter exactly
 * when they all come in, what matters is that it comes in where it fits — if that
 * takes 100min or if that takes 10 secs, as long as it sounds good it's fine."
 * Do not reintroduce a duration here; see spec A.3.
 *
 * Entries land mid-chord routinely, and that is CORRECT, not a defect to fix by
 * waiting: a round is not a multiple of the harmonic cycle. How a part lands when
 * the harmony is mid-phrase is the landing craft's job, not this file's.
 *
 * Nothing here starts or stops a generator. Every one of them is already running
 * its loop from bar 0 and is merely inaudible; this only resolves the per-role gain
 * the orchestrator already applies once a bar at a single choke point. Parts are
 * REVEALED, not started, so the loop underneath never re-phases — the same reason
 * the rest of the engine holds a locked loop rather than rebuilding one.
 *
 * REPLACES GeneratorOrchestrator.INTRO_STACK, which opened with THREE parts
 * (chords + melody + pad, not one) and measured its build in bars with no tempo
 * term — so the same table ran ~10s at 144 BPM and ~16s at 90.
 *
 * Pure: no Tone.js, no state, no scheduling. Same shape as beatMode.ts and
 * featuredPerformance.ts beside it, and unit-testable without an AudioContext.
 */

export type IntroRole = 'drums' | 'bass' | 'chord' | 'melody' | 'texture'

/** Fixed order — this is the identity of the five, not the entry order. */
export const INTRO_ROLES: readonly IntroRole[] = ['drums', 'bass', 'chord', 'melody', 'texture']

/**
 * How the remaining four arrive once the lead has stated itself.
 *
 * Foundation before colour: whoever opens, the pocket lands next so the beat
 * becomes readable early — the MC has to know where it is going — and the pad,
 * which is atmosphere rather than information, arrives last. The lead is filtered
 * out of this list, so "melody leads" gives melody → drums → bass → chord → texture
 * rather than melody → texture → drums.
 */
const ENTRY_PRIORITY: readonly IntroRole[] = ['drums', 'bass', 'chord', 'melody', 'texture']

/** Deterministic and cheap; the seed comes from the session salt. */
export function pickIntroLead(seed: number): IntroRole {
  const h = Math.abs(Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)) >>> 0
  return INTRO_ROLES[h % INTRO_ROLES.length]
}

/**
 * Rounds each part gets to itself before the next one lands. The user's range was
 * "one or two rounds"; this starts at one and is a by-ear constant, not a tuned
 * value — raise it if the build feels rushed.
 */
export const ROUNDS_PER_ENTRY = 1

/** The order parts arrive in for a given lead. */
function entryOrder(lead: IntroRole): IntroRole[] {
  return [lead, ...ENTRY_PRIORITY.filter((r) => r !== lead)]
}

/**
 * Per-role arrangement multipliers at `roundsElapsed` since the build began.
 * A role is either silent or full — no partial fades. A part easing in over several
 * rounds reads as a mix problem rather than an arrangement one, and the loop is
 * clearest when each entry is a definite event: a pad is in, or it is not.
 */
export function introMultipliers(
  lead: IntroRole,
  roundsElapsed: number,
): Record<IntroRole, number> {
  const order = entryOrder(lead)
  const safeRounds = Number.isFinite(roundsElapsed) ? Math.max(0, roundsElapsed) : 0
  // Quantised DOWN, so nothing arrives part-way through a round.
  const arrived = Math.floor(safeRounds / ROUNDS_PER_ENTRY) + 1

  const out = {} as Record<IntroRole, number>
  for (const role of INTRO_ROLES) {
    out[role] = order.indexOf(role) < arrived ? 1 : 0
  }
  return out
}
