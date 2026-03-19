import { useEffect, useRef, useState, useCallback } from 'react'
import { CaptureEngine }       from './CaptureEngine'
import type { SessionDNA, CaptureConfig } from './types'
import type { PhysicsEngine }  from '../physics/PhysicsEngine'
import type { StateMachine }   from '../state/StateMachine'

interface UseCaptureReturn {
  capture:      () => Promise<SessionDNA | null>
  downloadMidi: () => void
  lastDNA:      SessionDNA | null
  isCapturing:  boolean
}

export function useCapture(
  physicsEngine: PhysicsEngine | null,
  stateMachine:  StateMachine  | null,
  userId:        string,
  config?:       Partial<CaptureConfig>
): UseCaptureReturn {
  const engineRef                     = useRef<CaptureEngine | null>(null)
  const [lastDNA,     setLastDNA]     = useState<SessionDNA | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    if (!physicsEngine || !stateMachine) return

    engineRef.current = new CaptureEngine(config)
    engineRef.current.setUserId(userId)
    engineRef.current.startSession()

    const unsubPhysics = physicsEngine.subscribe((physics) => {
      const organism = stateMachine.getCurrentState()
      engineRef.current?.recordFrame(physics, organism)
    })

    const unsubTransition = stateMachine.onTransition((event) => {
      engineRef.current?.recordTransition(event)
    })

    const unsubCapture = engineRef.current.onCapture((dna) => {
      setLastDNA(dna)
      setIsCapturing(false)
    })

    return () => {
      unsubPhysics()
      unsubTransition()
      unsubCapture()
      engineRef.current?.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicsEngine, stateMachine, userId])

  const capture = useCallback(async (): Promise<SessionDNA | null> => {
    if (!engineRef.current) return null
    setIsCapturing(true)
    return engineRef.current.capture()
  }, [])

  const downloadMidi = useCallback(() => {
    engineRef.current?.downloadMidi()
  }, [])

  return { capture, downloadMidi, lastDNA, isCapturing }
}
