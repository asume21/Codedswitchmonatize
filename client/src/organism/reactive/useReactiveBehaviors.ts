// Section 05 — React hook for reactive behaviors

import { useEffect, useRef } from 'react'
import { ReactiveBehaviorEngine }     from './ReactiveBehaviorEngine'
import type { ReactiveConfig }        from './types'
import type { AnalysisFrame }         from '../analysis/types'
import type { PhysicsEngine }         from '../physics/PhysicsEngine'
import type { StateMachine }          from '../state/StateMachine'
import type { GeneratorOrchestrator } from '../generators/GeneratorOrchestrator'

export function useReactiveBehaviors(
  analysisEngine: { subscribe: (cb: (f: AnalysisFrame) => void) => () => void } | null,
  physicsEngine:  PhysicsEngine          | null,
  stateMachine:   StateMachine           | null,
  orchestrator:   GeneratorOrchestrator  | null,
  config?:        Partial<ReactiveConfig>
): void {
  const engineRef = useRef<ReactiveBehaviorEngine | null>(null)

  useEffect(() => {
    if (!analysisEngine || !physicsEngine || !stateMachine || !orchestrator) return

    engineRef.current = new ReactiveBehaviorEngine(config)
    engineRef.current.wire(orchestrator)

    let lastFrame:    AnalysisFrame | null = null
    let lastOrganism: ReturnType<typeof stateMachine.getCurrentState> | null = null

    const unsubAnalysis = analysisEngine.subscribe((frame) => {
      lastFrame = frame
    })

    const unsubPhysics = physicsEngine.subscribe((physics) => {
      lastOrganism = stateMachine.getCurrentState()
      if (lastFrame && lastOrganism) {
        engineRef.current?.processFrame(lastFrame, physics, lastOrganism)
      }
    })

    return () => {
      unsubAnalysis()
      unsubPhysics()
      engineRef.current?.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisEngine, physicsEngine, stateMachine, orchestrator])
}
