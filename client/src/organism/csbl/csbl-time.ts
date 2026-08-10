/**
 * csbl-time.ts — the step/time model, in ONE place.
 *
 * Shared by the drum and bass compilers so the two cannot drift — the first draft
 * had each writing its own `${bar}:0:${step}`, which is the shape every duplicate in
 * this repo starts as.
 *
 * ── THE GRID IS INFERRED FROM PATTERN LENGTH ──────────────────────────────
 *
 * A straight bar is 16 sixteenths. A triplet bar is 12 eighth-triplets or 24
 * sixteenth-triplets. Those numbers do not overlap with the straight divisors
 * (1,2,4,8,16), so the length alone says which grid a pattern is on — no extra
 * syntax, no flag to forget.
 *
 * That also resolves something in the spec's own training data. boom_bap.hats
 * "loose" was written "t--t--t--t--" — twelve characters, which the straight-only
 * grammar had to reject as "does not divide 16". It was never a broken pattern: it
 * was a TRIPLET pattern in a grammar that had no triplets. The data was right and
 * the model was wrong.
 *
 * Triplet hats are core to trap, so this is missing vocabulary, not a nicety.
 */

export const BAR_STEPS = 16

export type GridKind = 'straight' | 'triplet'

export interface Grid {
  kind: GridKind
  /** Steps in one bar on this grid. */
  steps: number
  /** Steps per quarter-note beat: 4 straight, 3 or 6 triplet. */
  perBeat: number
}

const STRAIGHT: Grid = { kind: 'straight', steps: 16, perBeat: 4 }
const TRIPLET_8: Grid = { kind: 'triplet', steps: 12, perBeat: 3 }
const TRIPLET_16: Grid = { kind: 'triplet', steps: 24, perBeat: 6 }

/**
 * Which grid is this pattern on? Length decides:
 *   divides 16      -> straight sixteenths (tiles to fill the bar)
 *   12              -> eighth-note triplets
 *   24              -> sixteenth-note triplets
 *   6 or 3          -> eighth-note triplets, tiled
 * Anything else is a parse ERROR rather than a silent truncation.
 */
export function resolveGrid(pattern: string): Grid {
  const len = pattern.length
  if (len === 0) throw new Error('Empty pattern')
  if (len === 24) return TRIPLET_16
  if (len === 12 || len === 6 || len === 3) return TRIPLET_8
  if (BAR_STEPS % len === 0) return STRAIGHT
  throw new Error(
    `Pattern length ${len} fits no grid — expected a divisor of 16 (straight) ` +
    `or 3/6/12/24 (triplet)`,
  )
}

/**
 * Step index -> Tone transport time "bar:beat:sixteenth".
 *
 * The sixteenth field is WITHIN the beat and may be FRACTIONAL, which is how a
 * triplet is expressed on a 4/4 grid: three even steps per beat land on 0, 1.333
 * and 2.667 sixteenths. DrumGenerator already writes fractional subs for its 32nd
 * rolls, so this needs no new machinery downstream.
 *
 * (Emitting `${bar}:0:${step}` — every hit on beat 0 with the sixteenth counting up
 * past 15 — is what the first draft did. Tone tolerates the overflow, but nothing
 * else in this repo writes times that way and it cannot express a triplet at all.)
 */
export function stepToTime(barIndex: number, step: number, grid: Grid = STRAIGHT): string {
  const beat = Math.floor(step / grid.perBeat)
  const within = step % grid.perBeat
  const sub = within * (4 / grid.perBeat)
  return `${barIndex}:${beat}:${Number.isInteger(sub) ? sub : sub.toFixed(3)}`
}

/** Tile a pattern to a full bar on its own grid, or throw if its length fits none. */
export function normalizeToBar(pattern: string): { full: string; grid: Grid } {
  const grid = resolveGrid(pattern)
  const len = pattern.length
  const full = len < grid.steps ? pattern.repeat(grid.steps / len) : pattern
  return { full, grid }
}
