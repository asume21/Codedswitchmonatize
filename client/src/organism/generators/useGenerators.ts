// Section 04 — React hook for GeneratorOrchestrator lifecycle

import { useEffect, useRef, useState } from 'react'
import { GeneratorOrchestrator }       from './GeneratorOrchestrator'
import type { PhysicsEngine }          from '../physics/PhysicsEngine'
import type { StateMachine }           from '../state/StateMachine'
import type { GeneratorOutput }        from './types'

interface UseGeneratorsReturn {
  output:       GeneratorOutput | null
  orchestrator: GeneratorOrchestrator | null
  isRunning:    boolean
}

export function useGenerators(
  physicsEngine: PhysicsEngine | null,
  stateMachine:  StateMachine  | null,
): UseGeneratorsReturn {
  const orchRef                       = useRef<GeneratorOrchestrator | null>(null)
  const [output,    setOutput]        = useState<GeneratorOutput | null>(null)
  const [isRunning, setIsRunning]     = useState(false)

  useEffect(() => {
    if (!physicsEngine || !stateMachine) return

    orchRef.current = new GeneratorOrchestrator()
    orchRef.current.wire(physicsEngine, stateMachine)

    orchRef.current.start().then(() => setIsRunning(true))

    // Poll output at 10fps for UI — not tied to audio frame rate
    const interval = setInterval(() => {
      setOutput(orchRef.current?.getOutput() ?? null)
    }, 100)

    return () => {
      clearInterval(interval)
      orchRef.current?.reset()
      setIsRunning(false)
    }
  }, [physicsEngine, stateMachine])

  return { output, orchestrator: orchRef.current, isRunning }
}
