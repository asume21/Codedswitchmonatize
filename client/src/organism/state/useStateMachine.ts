import { useEffect, useRef, useState } from 'react'
import { StateMachine } from './StateMachine'
import {
  StateMachineConfig,
  OrganismState,
  TransitionEvent,
} from './types'
import type { PhysicsEngine } from '../physics/PhysicsEngine'

interface UseStateMachineReturn {
  organismState: OrganismState | null
  lastTransition: TransitionEvent | null
  machine: StateMachine | null
}

export function useStateMachine(
  physicsEngine: PhysicsEngine | null,
  config?: Partial<StateMachineConfig>
): UseStateMachineReturn {
  const machineRef = useRef<StateMachine | null>(null)
  const [organismState, setOrganismState] = useState<OrganismState | null>(null)
  const [lastTransition, setLastTransition] = useState<TransitionEvent | null>(null)

  useEffect(() => {
    if (!physicsEngine) return

    machineRef.current = new StateMachine(config)

    const unsubscribePhysics = physicsEngine.subscribe((physicsState) => {
      machineRef.current?.processFrame(physicsState)
    })

    const unsubscribeState = machineRef.current.subscribe((state) => {
      setOrganismState(state)
    })

    const unsubscribeTransition = machineRef.current.onTransition((event) => {
      setLastTransition(event)
    })

    return () => {
      unsubscribePhysics()
      unsubscribeState()
      unsubscribeTransition()
      machineRef.current?.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicsEngine])

  return {
    organismState,
    lastTransition,
    machine: machineRef.current,
  }
}
