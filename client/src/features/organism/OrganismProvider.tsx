import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react'
import { OrganismContext }         from './OrganismContext'
import type { OrganismContextValue } from './OrganismContext'

import { AudioAnalysisEngine }    from '../../organism/analysis/AudioAnalysisEngine'
import { PhysicsEngine }          from '../../organism/physics/PhysicsEngine'
import { StateMachine }           from '../../organism/state/StateMachine'
import { GeneratorOrchestrator }  from '../../organism/generators/GeneratorOrchestrator'
import { ReactiveBehaviorEngine } from '../../organism/reactive/ReactiveBehaviorEngine'
import { MixEngine }              from '../../organism/mix/MixEngine'
import { CaptureEngine }          from '../../organism/session/CaptureEngine'

import { MidiInputSource }       from '../../organism/input/MidiInputSource'
import { AudioFileSource }       from '../../organism/input/AudioFileSource'
import { AutoGenerateSource }    from '../../organism/input/AutoGenerateSource'
import type { InputSource, InputSourceType } from '../../organism/input/types'

import type { PhysicsState }    from '../../organism/physics/types'
import type { OrganismState }   from '../../organism/state/types'
import type { MixMeterReading } from '../../organism/mix/types'
import type { SessionDNA }      from '../../organism/session/types'

interface Props {
  children:  React.ReactNode
  userId:    string
}

/**
 * Creates the appropriate InputSource based on the selected type.
 * AudioAnalysisEngine (mic) also implements the same subscribe/start/stop/getLastFrame contract.
 */
function createInputSource(
  type: InputSourceType,
  audioFile: File | null,
  autoEnergy: 'chill' | 'medium' | 'intense',
): InputSource {
  switch (type) {
    case 'midi':
      return new MidiInputSource()
    case 'audioFile':
      return new AudioFileSource(audioFile ?? '')
    case 'autoGenerate':
      return new AutoGenerateSource({ energy: autoEnergy })
    case 'mic':
    default:
      return new AudioAnalysisEngine() as unknown as InputSource
  }
}

export function OrganismProvider({ children, userId }: Props) {
  // Input source state
  const [inputSource,  setInputSourceType] = useState<InputSourceType>('mic')
  const [autoEnergy,   setAutoEnergy]      = useState<'chill' | 'medium' | 'intense'>('medium')
  const audioFileRef = useRef<File | null>(null)

  // Engine refs — created once, never recreated
  const inputRef       = useRef<InputSource              | null>(null)
  const physicsRef     = useRef<PhysicsEngine            | null>(null)
  const stateMachRef   = useRef<StateMachine             | null>(null)
  const orchestrRef    = useRef<GeneratorOrchestrator    | null>(null)
  const reactiveRef    = useRef<ReactiveBehaviorEngine   | null>(null)
  const mixRef         = useRef<MixEngine                | null>(null)
  const captureRef     = useRef<CaptureEngine            | null>(null)

  // Live state
  const [physicsState,   setPhysicsState]   = useState<PhysicsState    | null>(null)
  const [organismState,  setOrganismState]  = useState<OrganismState   | null>(null)
  const [meterReading,   setMeterReading]   = useState<MixMeterReading | null>(null)
  const [lastSessionDNA, setLastSessionDNA] = useState<SessionDNA      | null>(null)
  const [isRunning,      setIsRunning]      = useState(false)
  const [isCapturing,    setIsCapturing]    = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  // Boot engines on mount — wiring order is critical
  // Re-runs when userId, inputSource, or autoEnergy changes
  useEffect(() => {
    // 1. Create all engines
    const input       = createInputSource(inputSource, audioFileRef.current, autoEnergy)
    const physics     = new PhysicsEngine()
    const machine     = new StateMachine()
    const orchestr    = new GeneratorOrchestrator()
    const reactive    = new ReactiveBehaviorEngine()
    const mix         = new MixEngine()
    const capture     = new CaptureEngine()

    // 2. Store refs
    inputRef.current     = input
    physicsRef.current   = physics
    stateMachRef.current = machine
    orchestrRef.current  = orchestr
    reactiveRef.current  = reactive
    mixRef.current       = mix
    captureRef.current   = capture

    // 3. Wire in correct order:
    //    input → physics → state machine
    //    physics + state machine → generators
    //    generators → reactive behaviors
    //    generators → mix engine
    //    physics + state machine → capture engine

    // input → physics
    const unsubPhysics = input.subscribe((frame) => {
      physics.processFrame(frame)
    })

    // physics → state machine + UI state
    const unsubPhysicsState = physics.subscribe((state) => {
      machine.processFrame(state)
      setPhysicsState(state)
    })

    // state machine → UI state
    const unsubOrganism = machine.subscribe((state) => {
      setOrganismState(state)
    })

    // Wire generators, reactive, mix
    orchestr.wire(physics, machine)
    reactive.wire(orchestr)
    mix.wire(orchestr)

    // Wire capture
    capture.setUserId(userId)
    capture.startSession()

    const unsubCapturePhysics = physics.subscribe((state) => {
      capture.recordFrame(state, machine.getCurrentState())
    })
    const unsubCaptureTransition = machine.onTransition((event) => {
      capture.recordTransition(event)
    })
    const unsubCaptureEvent = capture.onCapture((dna) => {
      setLastSessionDNA(dna)
      setIsCapturing(false)
    })

    // Wire metering
    mix.startMetering()
    const unsubMeter = mix.onMeter((reading) => {
      setMeterReading(reading)
    })

    // Subscribe to reactive behavior engine
    const unsubReactive = physics.subscribe((pState) => {
      const oState = machine.getCurrentState()
      const lastFrame = input.getLastFrame()
      if (lastFrame) {
        reactive.processFrame(lastFrame, pState, oState)
      }
    })

    // Reset running state when input source changes
    setIsRunning(false)
    setError(null)

    return () => {
      unsubPhysics()
      unsubPhysicsState()
      unsubOrganism()
      unsubCapturePhysics()
      unsubCaptureTransition()
      unsubCaptureEvent()
      unsubMeter()
      unsubReactive()

      input.stop()
      orchestr.reset()
      mix.dispose()
      capture.reset()
    }
  }, [userId, inputSource, autoEnergy])

  // ── Actions ───────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!inputRef.current || !orchestrRef.current) return
    try {
      setError(null)
      await inputRef.current.start()
      await orchestrRef.current.start()
      setIsRunning(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start organism')
    }
  }, [])

  const stop = useCallback(() => {
    inputRef.current?.stop()
    orchestrRef.current?.stop()
    setIsRunning(false)
  }, [])

  const captureSession = useCallback(async (): Promise<SessionDNA | null> => {
    if (!captureRef.current) return null
    setIsCapturing(true)
    return captureRef.current.capture()
  }, [])

  const downloadMidi = useCallback(() => {
    captureRef.current?.downloadMidi()
  }, [])

  const handleSetInputSource = useCallback((type: InputSourceType, file?: File) => {
    // Stop current session before switching
    inputRef.current?.stop()
    orchestrRef.current?.stop()
    setIsRunning(false)

    if (type === 'audioFile' && file) {
      audioFileRef.current = file
    }
    setInputSourceType(type)
  }, [])

  // ── Context value ─────────────────────────────────────────────────

  const value: OrganismContextValue = useMemo(() => ({
    analysisEngine:    inputSource === 'mic' ? inputRef.current as unknown as AudioAnalysisEngine : null,
    physicsEngine:     physicsRef.current,
    stateMachine:      stateMachRef.current,
    orchestrator:      orchestrRef.current,
    reactiveBehaviors: reactiveRef.current,
    mixEngine:         mixRef.current,
    captureEngine:     captureRef.current,
    physicsState,
    organismState,
    meterReading,
    lastSessionDNA,
    start,
    stop,
    capture: captureSession,
    downloadMidi,
    inputSource,
    setInputSource: handleSetInputSource,
    autoEnergy,
    setAutoEnergy,
    isRunning,
    isCapturing,
    error,
  }), [
    physicsState, organismState, meterReading, lastSessionDNA,
    start, stop, captureSession, downloadMidi,
    inputSource, handleSetInputSource, autoEnergy,
    isRunning, isCapturing, error,
  ])

  return (
    <OrganismContext.Provider value={value}>
      {children}
    </OrganismContext.Provider>
  )
}
