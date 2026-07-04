/**
 * Pro-instruments spec Slice 4 — shared "real soloist" performance layer.
 *
 * Consolidates what used to be two separate implementations (bowed strings'
 * applyStringPerformance() in MelodyGenerator.ts, and guitar's dynamics/
 * development functions in guitarPerformance.ts) into one family-configurable
 * module. Every lead family gets the same three layers — velocity arc, breath/
 * rests, phrase-character development — tuned per family instead of per
 * hardcoded instrument. Guitar's per-note ornament picker (bends/hammer-ons in
 * guitarPerformance.ts) stays separate — that's guitar-specific idiom, not
 * shared expression. See docs/superpowers/specs/2026-06-06-pro-instruments-design.md.
 */

export type PerformerFamily = 'bowed' | 'wind' | 'brass' | 'keyboard' | 'plucked' | 'synth'

export interface PerformerExpressionConfig {
  /** 0..1 — phrase position of the dynamic/energy peak. */
  peakPosition: number
  /** Multiplies the base rest-drop probability; >1 = more rests, <1 = fewer. */
  restDensityMultiplier: number
  /** Whether phrase-character development recasts the register by an octave. */
  octaveRecastEnabled: boolean
  /** Max vibrato depth (0..1), or null if this family doesn't vibrato. */
  vibratoDepthCap: number | null
}

const PERFORMER_EXPRESSION_CONFIG: Record<PerformerFamily, PerformerExpressionConfig> = {
  bowed:    { peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true,  vibratoDepthCap: 0.35 },
  wind:     { peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true,  vibratoDepthCap: 0.35 },
  brass:    { peakPosition: 0.72, restDensityMultiplier: 0.6, octaveRecastEnabled: true,  vibratoDepthCap: 0.22 },
  keyboard: { peakPosition: 0.60, restDensityMultiplier: 1.4, octaveRecastEnabled: false, vibratoDepthCap: null },
  plucked:  { peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true,  vibratoDepthCap: null },
  synth:    { peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true,  vibratoDepthCap: null },
}

const SUSTAINED_FAMILIES = new Set<PerformerFamily>(['bowed', 'wind', 'brass'])

/** Neutral fallback for an unknown/undefined family — same shape as `synth`. */
const DEFAULT_CONFIG = PERFORMER_EXPRESSION_CONFIG.synth

export function getPerformerExpressionConfig(family: PerformerFamily | string | undefined): PerformerExpressionConfig {
  if (family && family in PERFORMER_EXPRESSION_CONFIG) {
    return PERFORMER_EXPRESSION_CONFIG[family as PerformerFamily]
  }
  return DEFAULT_CONFIG
}

/** True for families whose real instrument sustains/bows/blows a held pitch (can realistically vibrato). */
export function isSustainedPitch(family: PerformerFamily | string | undefined): boolean {
  return family !== undefined && SUSTAINED_FAMILIES.has(family as PerformerFamily)
}

/** sixteenth-grid position (0..15) from a "bar:beat:sub" Tone time string. */
export function sixteenthPosOf(time: string): number {
  const parts = String(time).split(':')
  const beat = parseFloat(parts[1] ?? '0')
  const sub = parseFloat(parts[2] ?? '0')
  return Math.floor(beat * 4 + sub) % 16
}

import type { ScheduledNote } from '../types'

export interface DynamicsOptions {
  /** 0..1 — phrase position of the dynamic peak. */
  peakPosition: number
  /** 0..1 — velocity multiplier floor at the phrase edges, relative to the peak. Default 0.78. */
  edgeFloor?: number
  /** Velocity boost added to notes landing on a 16th-grid downbeat. Default 0 (no accent). */
  downbeatAccent?: number
}

/**
 * Shapes a flat phrase into an arc: rises toward `peakPosition`, eases back
 * toward the cadence. Non-destructive — same notes, pitches, timing, only
 * velocity changes. Optional `downbeatAccent` adds a picking-style accent on
 * 16th-grid downbeats (used by plucked families; 0 for bowed/wind/brass/keys).
 */
export function shapePerformanceDynamics(notes: ScheduledNote[], options: DynamicsOptions): ScheduledNote[] {
  const { peakPosition: peak, edgeFloor = 0.78, downbeatAccent = 0 } = options
  const n = notes.length
  if (n === 0) return notes

  return notes.map((note, i) => {
    const pos = n <= 1 ? peak : i / (n - 1)
    const g = pos <= peak
      ? edgeFloor + (1 - edgeFloor) * (pos / Math.max(1e-6, peak))
      : 1.0 - (1 - edgeFloor) * ((pos - peak) / Math.max(1e-6, 1 - peak))
    const isDownbeat = sixteenthPosOf(note.time) % 4 === 0
    const accent = downbeatAccent > 0 && isDownbeat ? downbeatAccent : 0
    return { ...note, velocity: Math.max(0, Math.min(1, note.velocity * g + accent)) }
  })
}

export interface BreathOptions {
  /** Smaller = more rests. Typically 3 (airy), 4 (default), or 6 (driving/dense). */
  dropMod: number
  /** Injected PRNG (0..1) so this stays pure/deterministic under test. */
  rng: () => number
}

/**
 * BREATH — rests weak interior notes (never the first/last) so a phrase opens
 * space and rings instead of filling every slot. Drop probability rises toward
 * the phrase end (a real player breathes more as a phrase resolves).
 */
export function applyBreathAndRests(notes: ScheduledNote[], options: BreathOptions): ScheduledNote[] {
  const { dropMod, rng } = options
  const n = notes.length
  if (n < 3) return notes

  const kept: ScheduledNote[] = []
  for (let i = 0; i < n; i++) {
    const interior = i > 0 && i < n - 1
    const weak = notes[i].velocity < 0.55
    const pos = i / (n - 1)
    const baseProb = 1 / dropMod
    const scaledProb = baseProb * (0.2 + 1.6 * pos)
    const restHere = interior && weak && (rng() < scaledProb)
    if (!restHere) kept.push(notes[i])
  }
  return (kept.length >= 2 && kept.length < n) ? kept : notes
}
