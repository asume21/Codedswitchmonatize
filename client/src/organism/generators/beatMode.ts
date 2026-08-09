import type { FeaturedGeneratorRole } from './featuredPerformance'

/**
 * Beat Mode — "announce and hold" instead of "duck and thin".
 *
 * Song Mode's producer arc expresses a section change by moving the ground:
 * per-section gain multipliers duck the rhythm section, the density ladder
 * thins the drum pattern (below 0.45 it keeps kick+snare and drops EVERY hat),
 * and a breakdown "genuinely kills the drums" by design. That is defensible on
 * a produced record and hostile to a freestyle take — the MC needs to know
 * where the beat is going, and a beat that pulls the drums out from under him
 * mid-verse is the opposite of readable.
 *
 * Beat Mode keeps the whole arrangement running — sections, per-section
 * harmony (musicMind's matrix in plan mode), turnarounds, and the pre-drop
 * break all still happen. It only pins the FOUNDATION. The section change is
 * still audible; it just speaks through harmony, texture, and the turnaround
 * rather than by removing the floor.
 *
 * This is intent only. It resolves values the orchestrator already applies at
 * one choke point (applyArrangement); it schedules nothing and owns no state.
 */

/** The rhythm section. These two are the floor an MC rides and must not move. */
export function holdsPocket(role: FeaturedGeneratorRole): boolean {
  return role === 'drums' || role === 'bass'
}

/**
 * Arrangement gain for a role. In Beat Mode drums and bass ignore the
 * section's multiplier (including a dropout slot's 0) and stay at full level.
 * Melody, chords, and texture keep following the section — that is what still
 * makes a drop feel like a drop.
 */
export function beatModeMultiplier(
  beatModeEnabled: boolean,
  role: FeaturedGeneratorRole,
  plannedMultiplier: number,
): number {
  if (!beatModeEnabled || !holdsPocket(role)) return plannedMultiplier
  return 1
}

/**
 * Drum PATTERN density, which is a separate control from gain. Pinned to 1 in
 * Beat Mode so the thinning filter never strips the hats — the hats are the
 * motion, and a hip-hop loop without them reads as broken rather than sparse.
 */
export function beatModeDrumDensity(
  beatModeEnabled: boolean,
  plannedDensity: number,
): number {
  return beatModeEnabled ? 1 : plannedDensity
}
