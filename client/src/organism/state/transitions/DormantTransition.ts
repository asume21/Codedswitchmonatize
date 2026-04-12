import { OTransition }             from '../types'
import type { OrganismState }      from '../types'
import type { PhysicsState }       from '../../physics/types'
import type { StateMachineConfig } from '../types'

export function evaluateDormantTransition(
  organism: OrganismState,
  physics: PhysicsState,
  config: StateMachineConfig
): OTransition | null {
  // Voice-driven: presence above threshold with active voice
  if (physics.voiceActive && physics.presence >= config.voiceOnsetRmsThreshold) {
    return OTransition.DormantToAwakening
  }

  // Auto-generate / non-voice: any meaningful presence or bounce escapes Dormant.
  // Without this, auto-generate stays stuck in Dormant because voiceActive
  // can flicker even though the synthetic input is clearly "playing".
  if (!physics.voiceActive && (physics.presence >= 0.05 || physics.bounce >= 0.3)) {
    return OTransition.DormantToAwakening
  }

  return null
}
