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
 * WHY ENTRIES SIT ON BAR LINES
 *
 * That last constraint rules out a wall-clock ramp. A part revealed 3.2 seconds in
 * starts halfway through its own figure, and the result is not a loop. So the
 * spacing is a whole number of BARS, chosen from the tempo, and every entry lands
 * on a downbeat.
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

/** Aim for the middle of the user's 10-15s window. */
const TARGET_BUILD_SECONDS = 12

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
 * Bars between entries. Integer by design: entries must land on a downbeat, so the
 * achievable total moves in one-bar steps and at some tempos the nearest choice
 * falls a little outside 10-15s. Landing on the beat matters more than hitting the
 * window exactly — an off-grid entry is audible, a 16s build is not.
 */
export function introSpacingBars(bpm: number): number {
  const barSeconds = (60 / Math.max(1, bpm)) * 4
  const gaps = INTRO_ROLES.length - 1
  return Math.max(1, Math.round(TARGET_BUILD_SECONDS / (gaps * barSeconds)))
}

/** The order parts arrive in for a given lead. */
function entryOrder(lead: IntroRole): IntroRole[] {
  return [lead, ...ENTRY_PRIORITY.filter((r) => r !== lead)]
}

/**
 * Per-role arrangement multipliers at `barsElapsed` since the build began.
 * A role is either silent or full — no partial fades. A part easing in over several
 * bars reads as a mix problem rather than an arrangement one, and the loop is
 * clearest when each entry is a definite event.
 */
export function introMultipliers(
  lead: IntroRole,
  barsElapsed: number,
  bpm: number,
): Record<IntroRole, number> {
  const spacing = introSpacingBars(bpm)
  const order = entryOrder(lead)
  // Entries are quantised DOWN to the spacing, so nothing changes mid-phrase.
  const arrived = Math.floor(Math.max(0, barsElapsed) / spacing) + 1

  const out = {} as Record<IntroRole, number>
  for (const role of INTRO_ROLES) {
    out[role] = order.indexOf(role) < arrived ? 1 : 0
  }
  return out
}
