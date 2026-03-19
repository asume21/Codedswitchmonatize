import { OTransition }             from '../types'
import type { OrganismState }      from '../types'
import type { PhysicsState }       from '../../physics/types'
import type { StateMachineConfig } from '../types'

export function evaluateAwakeningTransition(
  organism: OrganismState,
  physics: PhysicsState,
  config: StateMachineConfig
): OTransition | null {
  if (organism.silenceDurationMs >= config.awakeningToSilenceMs) {
    return OTransition.AwakeningToDormant
  }

  const minBarsElapsed = organism.barsInState >= config.awakeningMinBars
  const maxBarsElapsed = organism.barsInState >= config.awakeningMaxBars

  if ((minBarsElapsed || maxBarsElapsed) && physics.pulse >= 60) {
    return OTransition.AwakeningToBreathing
  }

  return null
}
