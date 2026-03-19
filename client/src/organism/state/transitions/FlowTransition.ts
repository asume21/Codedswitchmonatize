import { OTransition }             from '../types'
import type { OrganismState }      from '../types'
import type { PhysicsState }       from '../../physics/types'
import type { StateMachineConfig } from '../types'

export function evaluateFlowTransition(
  organism: OrganismState,
  _physics: PhysicsState,
  config: StateMachineConfig
): OTransition | null {
  if (organism.silenceDurationMs >= config.flowToDormantMs) {
    return OTransition.FlowToDormant
  }

  if (organism.silenceDurationMs >= config.flowToBreathingMs) {
    return OTransition.FlowToBreathing
  }

  return null
}
