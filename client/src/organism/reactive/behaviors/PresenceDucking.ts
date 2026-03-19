// Section 05 — PresenceDucking behavior

import type { ReactiveContext, ReactiveConfig } from '../types'

export class PresenceDucking {
  private readonly config:      ReactiveConfig
  private smoothedDuck:         number = 1.0
  private readonly attackCoeff:  number
  private readonly releaseCoeff: number

  constructor(config: ReactiveConfig) {
    this.config       = config
    const fps         = 43
    this.attackCoeff  = 1 - Math.exp(-1 / (config.presenceDuckAttackMs  * fps / 1000))
    this.releaseCoeff = 1 - Math.exp(-1 / (config.presenceDuckReleaseMs * fps / 1000))
  }

  process(ctx: ReactiveContext): Partial<{ masterDuckMultiplier: number }> {
    const presence = ctx.physics.presence

    let target: number
    if (presence >= this.config.presenceDuckThreshold) {
      const t = (presence - this.config.presenceDuckThreshold)
              / (1.0 - this.config.presenceDuckThreshold)
      target = 1.0 - (t * (1.0 - this.config.presenceDuckDepth))
    } else {
      target = 1.0
    }

    const coeff = target < this.smoothedDuck ? this.attackCoeff : this.releaseCoeff
    this.smoothedDuck += coeff * (target - this.smoothedDuck)

    return { masterDuckMultiplier: this.smoothedDuck }
  }

  reset(): void { this.smoothedDuck = 1.0 }
}
