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
