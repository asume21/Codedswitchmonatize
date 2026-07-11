// Per-instrument groove humanization shared between live (Wow) patterns built
// from voice/MIDI input and stock genre presets from DrumPatternLibrary, so
// both flavors share one hip-hop pocket rather than drifting apart over time.
//
// The humanize() rules are applied at pattern-build time. Timing offsets are
// small and deterministic so the pocket sounds human without making tests flaky.

import { DrumInstrument, type DrumHit } from './types'

export const GROOVE_SLOT_COUNT = 16

export function applyGroovePocket(baseTimeSec: number, sixteenthPos: number, pocket: readonly number[]): number {
  const slot = ((Math.floor(sixteenthPos) % GROOVE_SLOT_COUNT) + GROOVE_SLOT_COUNT) % GROOVE_SLOT_COUNT
  const offset = Number.isFinite(pocket[slot]) ? pocket[slot] : 0
  return baseTimeSec + offset
}

function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function stableRandom(key: string): number {
  let a = hashString(key)
  a |= 0; a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function signedMs(key: string, minMs: number, maxMs: number): number {
  return (minMs + stableRandom(key) * (maxMs - minMs)) / 1000
}

/**
 * Returns humanized velocity and optional microShift (seconds) for a single
 * drum strike. The base velocity is whatever the source produced (onset
 * strength, anchor preset, library swing/accent); humanize layers per-instrument
 * groove rules on top.
 *
 *   Snare: velocity 90-100% of base, laid back 4-9ms
 *   Hat:   sub 0/2 -> 85-100% of base, sub 1/3 -> 45-60% of base, +/-2ms
 *   Kick:  mostly anchored, velocity +/-4% variance, tiny -1..2ms drift
 *   Perc:  small push/pull for pocket movement
 */
export function humanize(
  instrument: DrumInstrument,
  time: string,
  base: number,
): { velocity: number; microShift?: number } {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const r = (suffix: string) => stableRandom(`${instrument}:${time}:${base.toFixed(3)}:${suffix}`)
  switch (instrument) {
    case DrumInstrument.Snare:
      return {
        velocity: clamp(base * (0.9 + r('vel') * 0.1)),
        microShift: signedMs(`${instrument}:${time}:snare-lag`, 0.004, 0.009),
      }
    case DrumInstrument.Hat: {
      const sub = Math.round(Number(time.split(':')[2]) || 0)
      const isStrong = sub === 0 || sub === 2
      const scale = isStrong
        ? 0.85 + r('vel') * 0.15
        : 0.45 + r('vel') * 0.15
      return {
        velocity: clamp(base * scale),
        microShift: signedMs(`${instrument}:${time}:hat-shift`, -0.002, 0.003),
      }
    }
    case DrumInstrument.Kick:
      return {
        velocity: clamp(base * (0.96 + r('vel') * 0.08)),
        microShift: signedMs(`${instrument}:${time}:kick-shift`, -0.001, 0.002),
      }
    case DrumInstrument.Perc:
      return {
        velocity: clamp(base * (0.92 + r('vel') * 0.16)),
        microShift: signedMs(`${instrument}:${time}:perc-shift`, -0.003, 0.004),
      }
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
