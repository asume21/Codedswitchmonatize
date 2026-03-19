// Section 05 — EnergyMirroring behavior

import type { ReactiveContext, ReactiveConfig } from '../types'

export class EnergyMirroring {
  private readonly config:    ReactiveConfig
  private smoothedMultiplier: number = 1.0

  constructor(config: ReactiveConfig) {
    this.config = config
  }

  process(ctx: ReactiveContext): Partial<{ kickVelocityMultiplier: number }> {
    const rms = ctx.frame.rms

    // Map RMS 0→1 to kick multiplier 0.5→1.3
    const target = 0.5 + (rms * 1.14)

    this.smoothedMultiplier +=
      this.config.energyMirrorSmoothing * (
        Math.min(1.3, target) - this.smoothedMultiplier
      )

    return { kickVelocityMultiplier: this.smoothedMultiplier }
  }

  reset(): void { this.smoothedMultiplier = 1.0 }
}
