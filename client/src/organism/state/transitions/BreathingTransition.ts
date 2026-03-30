import { OTransition }             from '../types'
import type { OrganismState }      from '../types'
import type { PhysicsState }       from '../../physics/types'
import type { StateMachineConfig } from '../types'

export function evaluateBreathingTransition(
  organism: OrganismState,
  _physics: PhysicsState,
  config: StateMachineConfig
): OTransition | null {
  if (organism.silenceDurationMs >= config.breathingToDormantMs) {
    return OTransition.BreathingToDormant
  }

  if (organism.silenceDurationMs >= config.breathingToAwakeningMs) {
    return OTransition.BreathingToAwakening
  }

  if (
    organism.syllabicDensity >= config.syllabicDensityThreshold &&
    organism.cadenceLockBars >= config.cadenceLockBarsRequired
  ) {
    return OTransition.BreathingToFlow
  }

  // Auto-generate fallback: promote to Flow after N bars in Breathing
  // even without cadence lock, since there is no real voice to lock onto.
  if (
    config.autoBreathingToFlowBars > 0 &&
    organism.barsInState >= config.autoBreathingToFlowBars
  ) {
    return OTransition.BreathingToFlow
  }

  return null
}
