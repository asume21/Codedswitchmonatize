// Section 04 — Abstract base class for all generators

import type { GeneratorName, GeneratorActivityReport } from './types'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import type { OState }        from '../state/types'

export abstract class GeneratorBase {
  readonly name: GeneratorName
  protected activityLevel: number = 0

  constructor(name: GeneratorName) {
    this.name = name
  }

  abstract processFrame(physics: PhysicsState, organism: OrganismState): void
  abstract onStateTransition(to: OState, physics: PhysicsState): void
  abstract reset(): void

  getActivityReport(timestamp: number): GeneratorActivityReport {
    return {
      name:          this.name,
      activityLevel: this.activityLevel,
      timestamp,
    }
  }

  /**
   * Compute an exponential smoothing coefficient from a target half-life in ms.
   * Assumes ~23ms frame interval (~43fps).
   */
  protected smoothingCoeff(halfLifeMs: number): number {
    const frameDt = 1000 / 43
    return 1 - Math.exp(-frameDt / Math.max(1, halfLifeMs))
  }
}
