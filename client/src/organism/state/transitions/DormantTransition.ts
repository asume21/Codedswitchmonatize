import { OTransition }             from '../types'
import type { OrganismState }      from '../types'
import type { PhysicsState }       from '../../physics/types'
import type { StateMachineConfig } from '../types'

export function evaluateDormantTransition(
  organism: OrganismState,
  physics: PhysicsState,
  config: StateMachineConfig
): OTransition | null {
  if (physics.voiceActive && physics.presence >= config.voiceOnsetRmsThreshold) {
    return OTransition.DormantToAwakening
  }

  return null
}
