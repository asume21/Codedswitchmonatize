// Per-instrument groove humanization shared between live (Wow) patterns built
// from voice/MIDI input and stock genre presets from DrumPatternLibrary, so
// both flavors share one hip-hop pocket rather than drifting apart over time.
//
// The humanize() rules are applied at pattern-build time. Timing stays locked
// to the shared grid; human feel comes from velocity/accent only.

import { DrumInstrument, type DrumHit } from './types'

/**
 * Returns humanized velocity and optional microShift (seconds) for a single
 * drum strike. The base velocity is whatever the source produced (onset
 * strength, anchor preset, library swing/accent); humanize layers per-instrument
 * groove rules on top.
 *
 *   Snare: velocity 90–100% of base
 *   Hat:   sub 0/2 → 85–100% of base, sub 1/3 → 45–60% of base
 *   Kick:  grid-locked, velocity ±4% variance
 *   Perc / other: pass-through (no humanization)
 */
export function humanize(
  instrument: DrumInstrument,
  time: string,
  base: number,
): { velocity: number; microShift?: number } {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  switch (instrument) {
    case DrumInstrument.Snare:
      return {
        velocity: clamp(base * (0.9 + Math.random() * 0.1)),
      }
    case DrumInstrument.Hat: {
      const sub = Math.round(Number(time.split(':')[2]) || 0)
      const isStrong = sub === 0 || sub === 2
      const scale = isStrong
        ? 0.85 + Math.random() * 0.15
        : 0.45 + Math.random() * 0.15
      return {
        velocity: clamp(base * scale),
      }
    }
    case DrumInstrument.Kick:
      return { velocity: clamp(base * (0.96 + Math.random() * 0.08)) }
    default:
      return { velocity: base }
  }
}

/**
 * Apply humanize() to every hit in a pattern. Preserves instrument and time
 * (so deterministic-time test assertions still hold); overwrites velocity and
 * adds microShift per the per-instrument rules. Use at the point a stock
 * pattern is returned so consumers automatically inherit groove without each
 * callsite having to opt in.
 */
export function humanizePattern(hits: DrumHit[]): DrumHit[] {
  return hits.map(h => {
    const { velocity, microShift } = humanize(h.instrument, h.time, h.velocity)
    return { ...h, velocity, microShift }
  })
}
