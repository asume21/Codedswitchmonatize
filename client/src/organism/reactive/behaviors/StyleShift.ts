// Section 05 — StyleShift behavior
//
// Listens to rapper energy + syllabic rate and picks an idiomatic technique
// + articulation combo. Unlike the other behaviors (which return continuous
// multipliers), this one emits **categorical** id changes with hysteresis +
// cooldown, so the instrument "feel" only shifts when the performer clearly
// moves into a new energy zone — not on every frame.

import type { ReactiveContext, ReactiveConfig } from '../types'

/** Energy zones — each maps to a technique + articulation combo. */
export type EnergyZone = 'low' | 'mid' | 'high'

/** Per-zone style preset. */
export interface StylePreset {
  chordTechnique: string
  melodyArticulation: string
  bassArticulation: string
}

/**
 * Zone presets. Idiomatic choices:
 *   low  → storytelling / ballad feel → rolled piano + legato + slide bass
 *   mid  → pocket / boom-bap          → alberti piano + grace + walking bass
 *   high → trap / hype                → guitar muted stab + staccato + octave jump
 */
const ZONE_PRESETS: Record<EnergyZone, StylePreset> = {
  low: {
    chordTechnique: 'piano-rolled-chord',
    melodyArticulation: 'legato-slur',
    bassArticulation: 'bass-slide-up',
  },
  mid: {
    chordTechnique: 'piano-alberti',
    melodyArticulation: 'grace-flick',
    bassArticulation: 'bass-walking-step',
  },
  high: {
    chordTechnique: 'guitar-muted-stab',
    melodyArticulation: 'staccato-pop',
    bassArticulation: 'bass-octave-jump',
  },
}

/** Output when the style shifts. `null` = no change this frame. */
export interface StyleShiftOutput {
  /** The new zone if a shift was committed, else null. */
  zone: EnergyZone | null
  /** Matching preset if zone changed, else null. */
  preset: StylePreset | null
}

export class StyleShift {
  private readonly config: ReactiveConfig

  private smoothedEnergy: number = 0.5
  private currentZone: EnergyZone = 'mid'
  // Initialize well in the past so the first legitimate style shift is never
  // dropped by the cooldown check (even if the organism starts up quickly).
  private lastCommitTime: number = -StyleShift.COOLDOWN_MS

  // Hysteresis: thresholds to LEAVE current zone are wider than to enter.
  // Prevents flip-flop when energy sits right on a boundary.
  private static readonly LOW_ENTER_THRESHOLD  = 0.30
  private static readonly LOW_EXIT_THRESHOLD   = 0.40
  private static readonly HIGH_ENTER_THRESHOLD = 0.65
  private static readonly HIGH_EXIT_THRESHOLD  = 0.55

  // Minimum time between commits. Live performers don't change feel every 2s.
  private static readonly COOLDOWN_MS = 8000

  constructor(config: ReactiveConfig) {
    this.config = config
  }

  process(ctx: ReactiveContext): StyleShiftOutput {
    const rms = ctx.frame.rms
    // Smooth energy with the same coefficient as EnergyMirroring for consistency
    this.smoothedEnergy += this.config.energyMirrorSmoothing *
      (rms - this.smoothedEnergy)

    // Decide target zone with hysteresis
    let targetZone: EnergyZone = this.currentZone
    switch (this.currentZone) {
      case 'low':
        if (this.smoothedEnergy > StyleShift.LOW_EXIT_THRESHOLD) targetZone = 'mid'
        break
      case 'mid':
        if (this.smoothedEnergy < StyleShift.LOW_ENTER_THRESHOLD)  targetZone = 'low'
        else if (this.smoothedEnergy > StyleShift.HIGH_ENTER_THRESHOLD) targetZone = 'high'
        break
      case 'high':
        if (this.smoothedEnergy < StyleShift.HIGH_EXIT_THRESHOLD) targetZone = 'mid'
        break
    }

    if (targetZone === this.currentZone) {
      return { zone: null, preset: null }
    }

    // Zone change pending — enforce cooldown
    if (ctx.now - this.lastCommitTime < StyleShift.COOLDOWN_MS) {
      return { zone: null, preset: null }
    }

    // Commit the shift
    this.currentZone = targetZone
    this.lastCommitTime = ctx.now
    return { zone: targetZone, preset: ZONE_PRESETS[targetZone] }
  }

  /** Expose current state for UI / debugging. */
  getCurrentZone(): EnergyZone { return this.currentZone }
  getSmoothedEnergy(): number  { return this.smoothedEnergy }

  reset(): void {
    this.smoothedEnergy = 0.5
    this.currentZone = 'mid'
    this.lastCommitTime = -StyleShift.COOLDOWN_MS  // allow immediate first shift after reset
  }
}
