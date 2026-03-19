// Section 05 — SyllabicBreathing behavior

import type { ReactiveContext, ReactiveConfig } from '../types'

export class SyllabicBreathing {
  private readonly config: ReactiveConfig
  private smoothedMultiplier: number = 1.0

  constructor(config: ReactiveConfig) {
    this.config = config
  }

  process(ctx: ReactiveContext): Partial<{ hatDensityMultiplier: number }> {
    const density = ctx.organism.syllabicDensity

    let target: number

    if (density <= this.config.syllabicHatSparseThreshold) {
      target = 0.5
    } else if (density >= this.config.syllabicHatDenseThreshold) {
      target = 1.4
    } else {
      const t = (density - this.config.syllabicHatSparseThreshold)
              / (this.config.syllabicHatDenseThreshold - this.config.syllabicHatSparseThreshold)
      target = 0.5 + t * 0.9
    }

    this.smoothedMultiplier +=
      this.config.syllabicSmoothing * (target - this.smoothedMultiplier)

    return { hatDensityMultiplier: this.smoothedMultiplier }
  }

  reset(): void { this.smoothedMultiplier = 1.0 }
}
