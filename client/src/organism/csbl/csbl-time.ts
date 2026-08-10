/**
 * csbl-time.ts — the step/time model, in ONE place.
 *
 * CSBL step model: 1 character = one sixteenth, a bar = 16 steps. Patterns shorter
 * than a bar TILE to fill it; lengths that do not divide 16 are a parse error rather
 * than a silent truncation (spec Section 13.2).
 *
 * Shared by the drum and bass compilers so the two cannot drift — the first draft
 * had each writing its own `${bar}:0:${step}`, which is the shape every duplicate in
 * this repo starts as.
 */

export const BAR_STEPS = 16

/**
 * Step index (0-15) -> Tone transport time "bar:beat:sixteenth".
 *
 * Note the sixteenth field is WITHIN the beat (0-3), not the bar. Emitting
 * `${bar}:0:${step}` leaves every hit on beat 0 with the sixteenth counting to 15;
 * Tone tolerates that overflow, but nothing else in this repo writes times that way.
 */
export function stepToTime(barIndex: number, step: number): string {
  return `${barIndex}:${Math.floor(step / 4)}:${step % 4}`
}

/** Tile a pattern to a full bar, or throw if its length cannot divide one. */
export function normalizeToBar(pattern: string): string {
  if (!pattern || pattern.length === 0) throw new Error('Empty pattern')
  const len = pattern.length
  if (len !== BAR_STEPS && BAR_STEPS % len !== 0) {
    throw new Error(`Pattern length ${len} does not divide ${BAR_STEPS}`)
  }
  return len < BAR_STEPS ? pattern.repeat(BAR_STEPS / len) : pattern
}
