import { useEffect, useRef, useState } from 'react'
import { PhysicsEngine }               from './PhysicsEngine'
import type { PhysicsConfig, PhysicsState } from './types'
import type { AudioAnalysisEngine }    from '../analysis/AudioAnalysisEngine'

interface UsePhysicsReturn {
  lastState: PhysicsState | null
  engine:    PhysicsEngine | null
}

export function usePhysics(
  analysisEngine: AudioAnalysisEngine | null,
  config?: Partial<PhysicsConfig>
): UsePhysicsReturn {
  const physicsRef                = useRef<PhysicsEngine | null>(null)
  const [lastState, setLastState] = useState<PhysicsState | null>(null)

  useEffect(() => {
    if (!analysisEngine) return

    physicsRef.current = new PhysicsEngine(config)

    const unsubscribe = analysisEngine.subscribe((frame) => {
      physicsRef.current?.processFrame(frame)
    })

    const unsubscribePhysics = physicsRef.current.subscribe((state) => {
      setLastState(state)
    })

    return () => {
      unsubscribe()
      unsubscribePhysics()
      physicsRef.current?.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisEngine])

  return { lastState, engine: physicsRef.current }
}
