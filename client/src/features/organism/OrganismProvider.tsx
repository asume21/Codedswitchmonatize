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
import { FreestyleTranscriber }  from './FreestyleTranscriber'
import type { TranscriptionState } from './FreestyleTranscriber'

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

  // Transcription state
  const transcriberRef = useRef<FreestyleTranscriber | null>(null)
  const [transcription,         setTranscription]         = useState<TranscriptionState | null>(null)
  const [transcriptionEnabled,  setTranscriptionEnabled]  = useState(true)

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

    // physics → state machine + UI state + broadcast
    const unsubPhysicsState = physics.subscribe((state) => {
      machine.processFrame(state)
      setPhysicsState(state)

      // Broadcast physics to external listeners (OrganismBridge, Astutely, etc.)
      window.dispatchEvent(new CustomEvent('organism:physics-update', {
        detail: {
          bounce:   state.bounce,
          swing:    state.swing,
          presence: state.presence,
          pocket:   state.pocket,
          density:  state.density,
          mode:     state.mode,
        },
      }))
    })

    // state machine → UI state + broadcast
    let prevOrganismState: OrganismState | null = null
    const unsubOrganism = machine.subscribe((state) => {
      setOrganismState(state)

      // Broadcast state changes to external listeners
      if (!prevOrganismState || state.current !== prevOrganismState.current) {
        window.dispatchEvent(new CustomEvent('organism:state-change', {
          detail: {
            current:  state.current,
            previous: prevOrganismState?.current ?? null,
            flowDepth:        state.flowDepth,
            breathingWarmth:  state.breathingWarmth,
            cadenceLockBars:  state.cadenceLockBars,
          },
        }))
      }
      prevOrganismState = state
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

    // Create transcriber
    const transcriber = new FreestyleTranscriber()
    transcriberRef.current = transcriber
    const unsubTranscription = transcriber.subscribe((state) => {
      setTranscription(state)
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
      transcriber.reset()
      unsubTranscription()
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
      if (transcriptionEnabled && transcriberRef.current) {
        transcriberRef.current.start()
      }
      window.dispatchEvent(new CustomEvent('organism:started'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start organism')
    }
  }, [transcriptionEnabled])

  const stop = useCallback(() => {
    inputRef.current?.stop()
    orchestrRef.current?.stop()
    transcriberRef.current?.stop()
    setIsRunning(false)
    window.dispatchEvent(new CustomEvent('organism:stopped'))
  }, [])

  const captureSession = useCallback(async (): Promise<SessionDNA | null> => {
    if (!captureRef.current) return null
    setIsCapturing(true)
    const dna = await captureRef.current.capture()
    if (dna) {
      window.dispatchEvent(new CustomEvent('organism:session-captured', { detail: dna }))
    }
    return dna
  }, [])

  const downloadMidi = useCallback(() => {
    captureRef.current?.downloadMidi()
  }, [])

  // ── Inbound command listener ────────────────────────────────────────
  // Allows Astutely (or any external system) to control the organism
  // by dispatching: window.dispatchEvent(new CustomEvent('organism:command', { detail: { action: 'start' } }))

  useEffect(() => {
    const handleCommand = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { action: string; inputSource?: InputSourceType } | undefined
      if (!detail) return

      switch (detail.action) {
        case 'start':
          if (detail.inputSource) {
            setInputSourceType(detail.inputSource)
          }
          // Small delay to let inputSource state propagate if changed
          setTimeout(() => start(), detail.inputSource ? 100 : 0)
          break
        case 'stop':
          stop()
          break
        case 'capture':
          captureSession()
          break
        case 'download-midi':
          downloadMidi()
          break
      }
    }

    window.addEventListener('organism:command', handleCommand)
    return () => window.removeEventListener('organism:command', handleCommand)
  }, [start, stop, captureSession, downloadMidi])

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
    transcription,
    transcriptionEnabled,
    setTranscriptionEnabled: (enabled: boolean) => {
      setTranscriptionEnabled(enabled)
      if (!enabled) transcriberRef.current?.stop()
      else if (isRunning) transcriberRef.current?.start()
    },
    copyLyrics: async () => {
      if (!transcriberRef.current) return false
      return transcriberRef.current.copyLyrics()
    },
    exportLyrics: () => {
      transcriberRef.current?.exportLyrics()
    },
    isRunning,
    isCapturing,
    error,
  }), [
    physicsState, organismState, meterReading, lastSessionDNA,
    start, stop, captureSession, downloadMidi,
    inputSource, handleSetInputSource, autoEnergy,
    transcription, transcriptionEnabled,
    isRunning, isCapturing, error,
  ])

  return (
    <OrganismContext.Provider value={value}>
      {children}
    </OrganismContext.Provider>
  )
}
