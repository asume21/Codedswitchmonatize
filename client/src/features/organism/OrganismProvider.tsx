import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react'
import { OrganismContext, OrganismPhysicsContext } from './OrganismContext'
import type { OrganismContextValue, OrganismPhysicsContextValue, SavedSession } from './OrganismContext'

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
import { useProfile }             from '../../organism/evolution/useProfile'
import { QUICK_START_PRESETS, getQuickStartPreset } from './QuickStartPresets'
import { CountInEngine }         from './CountInEngine'
import { TriggerWordDetector }   from './TriggerWordDetector'
import { VoiceCommandRouter }    from './VoiceCommandRouter'
import { CadenceLock }           from './CadenceLock'
import type { CadenceSnapshot }  from './CadenceLock'
import { CallResponseEngine }    from './CallResponseEngine'
import type { CallResponsePhase } from './CallResponseEngine'
import { DropDetector }          from './DropDetector'
import { VibeMatcher }           from './VibeMatcher'
import type { VibeClassification } from './VibeMatcher'
import { FreestyleReportCard }   from './FreestyleReportCard'
import type { FreestyleReport }  from './FreestyleReportCard'
import { ScaleSnapEngine }       from '../../organism/scale/ScaleSnapEngine'
import { PerformerAnalyzer }    from '../../organism/audio/PerformerAnalyzer'
import { SelfListenAnalyzer }   from '../../organism/audio/SelfListenAnalyzer'
import type { PerformerState }  from '../../organism/audio/types'
import type { SelfListenReport } from '../../organism/audio/types'
import { OState }                from '../../organism/state/types'
import * as Tone from 'tone'
import { useStudioStore } from '../../stores/useStudioStore'
import type { MusicalKey, KeyMode } from '../../stores/useStudioStore'
import { bridgeOrganismToStore } from '../../stores/organismToStudioBridge'

interface Props {
  children:  React.ReactNode
  userId:    string
  isGuest?:  boolean
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

export function OrganismProvider({ children, userId, isGuest = false }: Props) {
  // Load persisted user profile (weighted average of past sessions)
  const { profile, recompute: recomputeProfile } = useProfile(userId, null)

  // Input source state — default to autoGenerate so mic is never opened automatically.
  // Opening the mic on iOS causes a second AudioContext + audio session conflict that
  // produces wind/distortion artifacts in Tone.js output. Users can switch to 'mic'
  // explicitly if they want reactive-to-voice mode.
  const [inputSource,  setInputSourceType] = useState<InputSourceType>('autoGenerate')
  const [autoEnergy,   setAutoEnergy]      = useState<'chill' | 'medium' | 'intense'>('medium')
  const audioFileRef = useRef<File | null>(null)

  // Stable refs for values used in callbacks but not needed as deps
  const userIdRef = useRef(userId)
  const recomputeProfileRef = useRef(recomputeProfile)
  userIdRef.current = userId
  recomputeProfileRef.current = recomputeProfile

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

  // Guest timer — 60s countdown while playing
  const [guestSecondsRemaining, setGuestSecondsRemaining] = useState(60)
  const [isGuestNudgeVisible,   setIsGuestNudgeVisible]   = useState(false)
  const guestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Session sharing state
  const [isSharingSession,  setIsSharingSession]  = useState(false)
  const [lastSharedPostUrl, setLastSharedPostUrl]  = useState<string | null>(null)

  // Transcription state
  const transcriberRef = useRef<FreestyleTranscriber | null>(null)
  const [transcription,         setTranscription]         = useState<TranscriptionState | null>(null)
  const [transcriptionEnabled,  setTranscriptionEnabled]  = useState(true)

  // Quick Start state
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  // Count-In state
  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const countInRef = useRef<CountInEngine | null>(null)

  // Sound Trigger state — when armed, any loud mic sound triggers the beat
  const [soundTriggerArmed, setSoundTriggerArmed] = useState(false)
  const soundTriggerPresetRef = useRef<string | null>(null)
  const soundTriggerCleanupRef = useRef<(() => void) | null>(null)

  // Voice command engine refs
  const triggerDetectorRef = useRef<TriggerWordDetector | null>(null)
  const voiceRouterRef = useRef<VoiceCommandRouter | null>(null)

  // Cadence Lock state
  const [cadenceLockEnabled, setCadenceLockEnabled] = useState(false)
  const [cadenceSnapshot, setCadenceSnapshot] = useState<CadenceSnapshot | null>(null)
  const cadenceLockRef = useRef<CadenceLock | null>(null)

  // Call & Response state
  const [callResponseEnabled, setCallResponseEnabled] = useState(false)
  const [callResponsePhase, setCallResponsePhase] = useState<CallResponsePhase>('idle')
  const callResponseRef = useRef<CallResponseEngine | null>(null)

  // Drop Detector state
  const [dropDetectorEnabled, setDropDetectorEnabled] = useState(true)
  const [lastDropIntensity, setLastDropIntensity] = useState<number | null>(null)
  const dropDetectorRef = useRef<DropDetector | null>(null)

  // Vibe Matcher state
  const [vibeMatchEnabled, setVibeMatchEnabled] = useState(true)
  const [currentVibe, setCurrentVibe] = useState<VibeClassification | null>(null)
  const vibeMatcherRef = useRef<VibeMatcher | null>(null)

  // Freestyle Report Card state
  const [lastReport, setLastReport] = useState<FreestyleReport | null>(null)
  const reportCardRef = useRef<FreestyleReportCard | null>(null)

  // Scale Snap Engine — detects musical key from pitch and locks melody to it
  const scaleSnapRef = useRef<ScaleSnapEngine | null>(null)

  // Ears system — performer analysis + self-listen
  const performerRef      = useRef<PerformerAnalyzer | null>(null)
  const selfListenRef     = useRef<SelfListenAnalyzer | null>(null)
  const [performerState,   setPerformerState]   = useState<PerformerState   | null>(null)
  const [selfListenReport, setSelfListenReport]  = useState<SelfListenReport | null>(null)

  // BPM sync: track last synced performer BPM to avoid rapid Transport changes
  const lastSyncedBpmRef = useRef<number>(0)

  // Latch + pattern lock state
  const [latchMode,        setLatchModeState]   = useState(false)
  const [isPatternLocked,  setIsPatternLocked]  = useState(false)
  const [hatDensity,       setHatDensityState]  = useState(1)
  const [kickVelocity,     setKickVelocityState]= useState(1)
  const [bassVolume,       setBassVolumeState]  = useState(1)
  const [melodyVolume,     setMelodyVolumeState]= useState(1)
  const [textureEnabled,   setTextureEnabledState] = useState(false)  // off by default for hip-hop

  // Recording state — captures beat audio + vocal audio + MIDI + lyrics
  const [isRecording,      setIsRecording]      = useState(false)
  const [lastSavedSession, setLastSavedSession] = useState<SavedSession | null>(null)
  const [savedSessions,    setSavedSessions]    = useState<SavedSession[]>(() => {
    try {
      const stored = localStorage.getItem('organism:savedSessions:meta')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const recordingStartRef  = useRef<number>(0)
  const vocalRecorderRef   = useRef<MediaRecorder | null>(null)
  const vocalChunksRef     = useRef<Blob[]>([])
  const vocalStreamRef     = useRef<MediaStream | null>(null)
  const beatRecorderRef    = useRef<MediaRecorder | null>(null)
  const beatChunksRef      = useRef<Blob[]>([])
  const beatDestRef        = useRef<MediaStreamAudioDestinationNode | null>(null)

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

    // Seed physics with user's historical groove profile so the organism
    // starts in the user's natural pocket rather than from neutral defaults
    if (profile) physics.setProfile(profile)
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

    // physics → state machine (always) + throttled UI state + broadcast
    // The state machine must receive every frame for accurate transitions,
    // but React re-renders + CustomEvent dispatches are throttled to ~15fps
    // to prevent main-thread overload that causes audio crackling.
    let lastPhysicsUIUpdate = 0
    const PHYSICS_UI_INTERVAL_MS = 66 // ~15fps — visually smooth, CPU friendly
    const unsubPhysicsState = physics.subscribe((state) => {
      machine.processFrame(state)

      const now = performance.now()
      if (now - lastPhysicsUIUpdate >= PHYSICS_UI_INTERVAL_MS) {
        lastPhysicsUIUpdate = now
        setPhysicsState(state)

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
      }
    })

    // state machine → UI state + broadcast
    let prevOrganismState: OrganismState | null = null
    let lastOrganismUIUpdate = 0
    const unsubOrganism = machine.subscribe((state) => {
      // Throttle React state updates to match physics (15fps)
      const now = performance.now()
      if (now - lastOrganismUIUpdate >= PHYSICS_UI_INTERVAL_MS) {
        lastOrganismUIUpdate = now
        setOrganismState(state)
      }

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

    // ── Ears system: performer analysis ──────────────────────────────────────
    // Subscribe directly to input frames so we get raw mic data before
    // the physics engine smooths everything away.
    const performer   = new PerformerAnalyzer()
    const selfListen  = new SelfListenAnalyzer()
    performerRef.current   = performer
    selfListenRef.current  = selfListen

    let lastPerformerUIUpdate = 0
    const unsubPerformer = input.subscribe((frame) => {
      const pState = performer.processFrame(frame)

      // Throttle React state updates to 15fps
      const now = performance.now()
      if (now - lastPerformerUIUpdate >= 66) {
        lastPerformerUIUpdate = now
        setPerformerState({ ...pState })

        // Sync Transport BPM to performer when confidence is high enough
        // and the drift is significant (> 4 BPM). Only during mic input.
        if (
          inputSource === 'mic' &&
          pState.bpmConfidence > 0.55 &&
          pState.isInPhrase &&
          Math.abs(pState.bpm - lastSyncedBpmRef.current) > 4
        ) {
          orchestr.setBpm(pState.bpm)
          lastSyncedBpmRef.current = pState.bpm
          window.dispatchEvent(new CustomEvent('organism:bpm-locked', {
            detail: { bpm: pState.bpm, confidence: pState.bpmConfidence },
          }))
        }

        // Let orchestrator react to the performer in real time
        orchestr.applyPerformerState(pState)
      }
    })

    // ── Ears system: self-listen ─────────────────────────────────────────────
    const unsubSelfListen = selfListen.onReport((report) => {
      setSelfListenReport({ ...report })
      orchestr.applySelfListenReport(report)
      selfListen.setTransportBpm(orchestr.getBpm())

      // Broadcast to Astutely — gives the AI brain ears
      window.dispatchEvent(new CustomEvent('organism:self-listen-report', {
        detail: report,
      }))
    })

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

    // Gap 2 — Generative patterns: when the arrangement enters a musically
    // interesting section, request a novel AI-generated drum pattern so the
    // organism's vocabulary expands beyond the hardcoded library.
    // Cooldown: only generate a new pattern at most once every 30 seconds
    // to avoid toast/pattern spam from rapid section changes.
    const GENERATIVE_SECTIONS = new Set(['drop', 'drop2'])
    const PATTERN_GEN_COOLDOWN_MS = 30_000
    let lastPatternGenTime = 0
    let patternGenInFlight = false
    const handleSectionChange = async (e: Event) => {
      const { section, physics: sectionPhysics, bpm } = (e as CustomEvent).detail ?? {}
      if (!GENERATIVE_SECTIONS.has(section)) return

      const now = performance.now()
      if (now - lastPatternGenTime < PATTERN_GEN_COOLDOWN_MS) return
      if (patternGenInFlight) return

      patternGenInFlight = true
      lastPatternGenTime = now
      patternGenAbort = new AbortController()
      try {
        const res = await fetch('/api/organism/generate-pattern', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, physics: sectionPhysics, bpm }),
          signal: patternGenAbort.signal,
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.hits?.length && orchestr) {
          orchestr.loadGeneratedDrumPattern(data.hits)
        }
      } catch { /* non-blocking — hardcoded patterns remain as fallback */ }
      finally { patternGenInFlight = false }
    }
    window.addEventListener('organism:section-change', handleSectionChange)

    // Reset running state when input source changes
    setIsRunning(false)
    setError(null)

    let patternGenAbort: AbortController | null = null

    return () => {
      patternGenAbort?.abort()
      unsubPhysics()
      unsubPhysicsState()
      unsubOrganism()
      unsubCapturePhysics()
      unsubCaptureTransition()
      unsubCaptureEvent()
      unsubMeter()
      unsubReactive()
      unsubPerformer()
      unsubSelfListen()

      input.stop()
      orchestr.dispose()   // dispose() frees all generator audio nodes; reset() only stops them
      mix.dispose()
      capture.reset()
      transcriber.reset()
      unsubTranscription()
      performer.reset()
      selfListen.dispose()
      lastSyncedBpmRef.current = 0
      window.removeEventListener('organism:section-change', handleSectionChange)
    }
  // profile is intentionally excluded: it loads async and must NOT trigger
  // a full engine teardown. Profile updates are applied via the effect below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, inputSource, autoEnergy])

  // Apply profile updates to the live physics engine without recreating engines.
  // This prevents the async profile fetch (~2-8s network) from tearing down
  // an already-running organism session.
  useEffect(() => {
    if (physicsRef.current && profile) {
      physicsRef.current.setProfile(profile)
    }
  }, [profile])

  // ── Actions ───────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!inputRef.current || !orchestrRef.current) return
    try {
      setError(null)
      cadenceLastLineIndexRef.current   = -1
      reportCardLastLineIndexRef.current = -1
      await inputRef.current.start()
      await orchestrRef.current.start()
      setIsRunning(true)
      // Start self-listen after audio is running
      selfListenRef.current?.start()
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

    // Auto-bridge any accumulated generator events into the studio store
    // so they appear in Beat Lab / Piano Roll even when the user just hits Stop
    // without explicitly capturing a session.
    if (captureRef.current) {
      captureRef.current.capture().then((dna) => {
        if (dna && dna.generatorEvents && dna.generatorEvents.length > 0) {
          const orch = orchestrRef.current
          const bpm = orch ? orch.getBpm() : useStudioStore.getState().bpm
          bridgeOrganismToStore(dna.generatorEvents, bpm, 'organism')
        }
      }).catch(() => { /* capture failed — no-op */ })
    }

    window.dispatchEvent(new CustomEvent('organism:stopped'))
  }, [])

  const captureSession = useCallback(async (): Promise<SessionDNA | null> => {
    if (!captureRef.current) return null
    setIsCapturing(true)
    const dna = await captureRef.current.capture()
    if (dna) {
      window.dispatchEvent(new CustomEvent('organism:session-captured', { detail: dna }))

      // Bridge captured generator events into the store
      if (dna.generatorEvents && dna.generatorEvents.length > 0) {
        const orch = orchestrRef.current
        const sessionBpm = orch ? orch.getBpm() : useStudioStore.getState().bpm
        bridgeOrganismToStore(dna.generatorEvents, sessionBpm, 'organism')
      }
    }
    return dna
  }, [])

  const downloadMidi = useCallback(() => {
    captureRef.current?.downloadMidi()
  }, [])

  /**
   * Quick Start — skip the cold start entirely.
   *
   * 1. Start the input source + Transport at the preset BPM
   * 2. Force the state machine straight to Breathing (skipping Dormant → Awakening)
   * 3. Feed the synthetic physics snapshot so generators build patterns immediately
   * 4. Beat is playing in <500ms. Reactive behaviors still work from bar 1.
   */
  const quickStart = useCallback(async (presetId: string) => {
    const preset = getQuickStartPreset(presetId)
    if (!preset) {
      setError(`Unknown quick start preset: ${presetId}`)
      return
    }
    if (!inputRef.current || !orchestrRef.current || !stateMachRef.current || !physicsRef.current) {
      setError('Engines not initialized')
      return
    }

    try {
      setError(null)
      setActivePresetId(presetId)
      cadenceLastLineIndexRef.current   = -1
      reportCardLastLineIndexRef.current = -1

      // 1. Lock physics mode to the preset's genre — prevents ModeClassifier drift
      physicsRef.current.lockMode(preset.mode)

      // 2. Start the input source (mic, auto, etc.)
      await inputRef.current.start()

      // 3. Start the Transport at the preset's BPM
      await orchestrRef.current.start(preset.bpm)

      // 3. Stamp the synthetic physics with a fresh timestamp
      const syntheticPhysics = {
        ...preset.physics,
        timestamp:  performance.now(),
        frameIndex: 0,
      }

      // 4. Feed the physics engine one synthetic AnalysisFrame so all subscribers
      //    (state machine, generators, reactive behaviors) get seeded
      physicsRef.current.processFrame({
        rms:              syntheticPhysics.presence * 0.5,
        rmsRaw:           syntheticPhysics.presence * 0.5,
        pitch:            220,
        pitchConfidence:  0.8,
        pitchMidi:        57,
        pitchCents:       0,
        spectralCentroid: preset.mode === 'heat' || preset.mode === 'gravel' ? 3500 : 1800,
        spectralFlux:     syntheticPhysics.bounce * 0.3,
        hnr:              preset.mode === 'glow' || preset.mode === 'ice' ? 12 : 5,
        onsetDetected:    true,
        onsetStrength:    0.7,
        onsetTimestamp:   performance.now(),
        voiceActive:      false,
        voiceConfidence:  0,
        sampleRate:       44100,
        timestamp:        performance.now(),
        frameIndex:       0,
      })

      // 5. Force state machine straight to Breathing — skip Dormant + Awakening
      //    forceState() chains through transitions so generators get their
      //    onStateTransition callbacks with the synthetic physics
      stateMachRef.current.forceState(OState.Awakening, syntheticPhysics)
      stateMachRef.current.forceState(OState.Breathing, syntheticPhysics)

      setIsRunning(true)

      // 6. Start transcription if enabled
      if (transcriptionEnabled && transcriberRef.current) {
        transcriberRef.current.start()
      }

      window.dispatchEvent(new CustomEvent('organism:started', {
        detail: { quickStart: true, presetId, preset: preset.label },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick start failed')
      setActivePresetId(null)
    }
  }, [transcriptionEnabled])

  /**
   * Count-In Start — plays a "1, 2, 3, 4" metronome at the preset BPM,
   * then drops the beat on the downbeat of bar 2 via quickStart.
   */
  const countInStart = useCallback(async (presetId: string) => {
    const preset = getQuickStartPreset(presetId)
    if (!preset) {
      setError(`Unknown preset: ${presetId}`)
      return
    }

    // Dispose any existing count-in
    countInRef.current?.dispose()

    setCountInBeat(0)
    setActivePresetId(presetId)

    const engine = new CountInEngine()
    countInRef.current = engine

    await engine.start({
      bpm: preset.bpm,
      beats: 4,
      onBeat: (beat) => {
        setCountInBeat(beat)
      },
      onComplete: () => {
        setCountInBeat(null)
        countInRef.current = null
        // Now drop the beat via quickStart
        quickStart(presetId)
      },
    })
  }, [quickStart])

  /**
   * Sound Trigger — arm the mic so any loud sound triggers the beat.
   *
   * Opens the mic via the AudioAnalysisEngine, subscribes to its frames,
   * and watches for any frame with RMS above a threshold. When triggered,
   * the initial RMS determines the energy level:
   *   - RMS > 0.3 → high energy (loud clap)
   *   - RMS > 0.1 → medium energy
   *   - RMS < 0.1 → low energy (soft "hey")
   *
   * Uses the specified preset but may override the energy based on trigger volume.
   */
  const armSoundTrigger = useCallback((presetId: string) => {
    // Disarm any previous trigger
    soundTriggerCleanupRef.current?.()

    soundTriggerPresetRef.current = presetId
    setSoundTriggerArmed(true)

    // We need to listen to the input source's frames for a loud sound
    const input = inputRef.current
    if (!input) {
      setError('Input source not initialized — cannot arm sound trigger')
      setSoundTriggerArmed(false)
      return
    }

    let triggered = false
    const TRIGGER_THRESHOLD = 0.025  // Intentional sound above noise floor

    const unsubscribe = input.subscribe((frame) => {
      if (triggered) return
      const rms = frame.rms ?? 0
      if (rms < TRIGGER_THRESHOLD) return

      // Triggered!
      triggered = true
      setSoundTriggerArmed(false)
      soundTriggerCleanupRef.current = null

      // Use the preset, and launch quickStart
      const pid = soundTriggerPresetRef.current ?? presetId
      quickStart(pid)
    })

    // Start the input source so mic is active
    input.start().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to start mic for sound trigger')
      setSoundTriggerArmed(false)
    })

    soundTriggerCleanupRef.current = () => {
      unsubscribe()
      triggered = true  // prevent late triggers
    }
  }, [quickStart])

  const disarmSoundTrigger = useCallback(() => {
    soundTriggerCleanupRef.current?.()
    soundTriggerCleanupRef.current = null
    soundTriggerPresetRef.current = null
    setSoundTriggerArmed(false)
  }, [])

  // ── Recording: captures beat audio (master bus) + vocal audio (mic) ──

  const startRecording = useCallback(async () => {
    if (isRecording) return

    // If organism isn't running yet, start it first
    if (!isRunning) {
      await start()
    }

    recordingStartRef.current = Date.now()
    vocalChunksRef.current = []
    beatChunksRef.current = []

    // 1. Vocal recording — get a fresh mic stream for MediaRecorder
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      vocalStreamRef.current = micStream
      const vocalRecorder = new MediaRecorder(micStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm',
      })
      vocalRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) vocalChunksRef.current.push(e.data)
      }
      vocalRecorderRef.current = vocalRecorder
      vocalRecorder.start(200)
    } catch (err) {
      console.warn('[OrganismProvider] Vocal recording failed (mic access):', err)
    }

    // 2. Beat recording — tap into Tone.js audio context master output
    try {
      const toneCtx = Tone.getContext()
      const rawCtx = toneCtx.rawContext as AudioContext
      const dest = rawCtx.createMediaStreamDestination()
      beatDestRef.current = dest

      // Connect Tone.js master output to the recording destination
      Tone.getDestination().connect(dest)

      const beatRecorder = new MediaRecorder(dest.stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm',
      })
      beatRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) beatChunksRef.current.push(e.data)
      }
      beatRecorderRef.current = beatRecorder
      beatRecorder.start(200)
    } catch (err) {
      console.warn('[OrganismProvider] Beat recording failed:', err)
    }

    setIsRecording(true)
    window.dispatchEvent(new CustomEvent('organism:recording-started'))
  }, [isRecording, isRunning, start])

  const stopRecording = useCallback(async (): Promise<SavedSession | null> => {
    if (!isRecording) return null

    const durationMs = Date.now() - recordingStartRef.current
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Stop vocal recorder
    let vocalBlob: Blob | null = null
    if (vocalRecorderRef.current && vocalRecorderRef.current.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        vocalRecorderRef.current!.onstop = () => resolve()
        vocalRecorderRef.current!.stop()
      })
      if (vocalChunksRef.current.length > 0) {
        vocalBlob = new Blob(vocalChunksRef.current, { type: 'audio/webm' })
      }
    }
    // Release mic stream
    vocalStreamRef.current?.getTracks().forEach(t => t.stop())
    vocalStreamRef.current = null
    vocalRecorderRef.current = null

    // Stop beat recorder
    let beatBlob: Blob | null = null
    if (beatRecorderRef.current && beatRecorderRef.current.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        beatRecorderRef.current!.onstop = () => resolve()
        beatRecorderRef.current!.stop()
      })
      if (beatChunksRef.current.length > 0) {
        beatBlob = new Blob(beatChunksRef.current, { type: 'audio/webm' })
      }
    }
    // Disconnect recording destination from Tone master
    if (beatDestRef.current) {
      try { Tone.getDestination().disconnect(beatDestRef.current) } catch { /* ok */ }
      beatDestRef.current = null
    }
    beatRecorderRef.current = null

    // Capture session DNA + MIDI
    const dna = captureRef.current ? await captureRef.current.capture() : null
    const midiResult = captureRef.current?.exportMidi()
    const midiBlob = midiResult?.blob ?? null

    // Get lyrics from transcriber
    const lyrics = transcriberRef.current?.getLyricsText() || null

    const session: SavedSession = {
      sessionId,
      createdAt: recordingStartRef.current,
      durationMs,
      dna,
      midiBlob,
      beatBlob,
      vocalBlob,
      lyrics: lyrics && lyrics.length > 0 ? lyrics : null,
    }

    // Persist DNA to server so profile can learn from this session
    if (dna && userIdRef.current) {
      fetch('/api/organism/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dna, userId: userIdRef.current }),
      })
        .then(r => r.ok ? recomputeProfileRef.current() : null)
        .catch(() => {}) // Non-blocking — local session still saved
    }

    // Persist session metadata to localStorage (blobs stay in memory)
    setLastSavedSession(session)
    setSavedSessions(prev => {
      const next = [session, ...prev].slice(0, 50)
      try {
        const meta = next.map(s => ({
          sessionId: s.sessionId,
          createdAt: s.createdAt,
          durationMs: s.durationMs,
          hasVocals: !!s.vocalBlob,
          hasBeat: !!s.beatBlob,
          hasMidi: !!s.midiBlob,
          hasLyrics: !!s.lyrics,
        }))
        localStorage.setItem('organism:savedSessions:meta', JSON.stringify(meta))
      } catch { /* storage full — ok */ }
      return next
    })

    // Bridge generator events into the global store so Piano Roll / Beat Maker
    // can display the notes the user just freestyled over.
    if (dna && dna.generatorEvents && dna.generatorEvents.length > 0) {
      const orch = orchestrRef.current
      const sessionBpm = orch ? orch.getBpm() : useStudioStore.getState().bpm
      bridgeOrganismToStore(dna.generatorEvents, sessionBpm, 'organism')
    }

    setIsRecording(false)
    setLastSessionDNA(dna)
    window.dispatchEvent(new CustomEvent('organism:recording-stopped', { detail: session }))

    return session
  }, [isRecording])

  const downloadSession = useCallback((session: SavedSession) => {
    const timestamp = new Date(session.createdAt).toISOString().replace(/[:.]/g, '-')
    const prefix = `organism-${timestamp}`

    // Download beat audio
    if (session.beatBlob) {
      const url = URL.createObjectURL(session.beatBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefix}-beat.webm`
      a.click()
      URL.revokeObjectURL(url)
    }

    // Download vocal audio
    if (session.vocalBlob) {
      const url = URL.createObjectURL(session.vocalBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefix}-vocals.webm`
      a.click()
      URL.revokeObjectURL(url)
    }

    // Download MIDI
    if (session.midiBlob) {
      const url = URL.createObjectURL(session.midiBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefix}-session.mid`
      a.click()
      URL.revokeObjectURL(url)
    }

    // Download lyrics
    if (session.lyrics) {
      const blob = new Blob([session.lyrics], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefix}-lyrics.txt`
      a.click()
      URL.revokeObjectURL(url)
    }
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
        case 'quick-start': {
          const presetId = (detail as Record<string, unknown>).presetId as string | undefined
          if (presetId) quickStart(presetId)
          break
        }
        case 'stop':
          stop()
          break
        case 'capture':
          captureSession()
          break
        case 'download-midi':
          downloadMidi()
          break
        case 'start-recording':
          startRecording()
          break
        case 'stop-recording':
          stopRecording()
          break
      }
    }

    window.addEventListener('organism:command', handleCommand)
    return () => window.removeEventListener('organism:command', handleCommand)
  }, [start, stop, captureSession, downloadMidi, startRecording, stopRecording, quickStart])

  // ── Voice Command Engine: TriggerWordDetector + VoiceCommandRouter ──
  // Initializes on mount, processes transcription text, routes detected
  // commands to quickStart / orchestrator actions.
  useEffect(() => {
    const detector = new TriggerWordDetector()
    const router = new VoiceCommandRouter()

    router.connect(detector)
    router.setHandler((action, _event) => {
      if (action.type === 'quick-start') {
        quickStart(action.presetId)
        return
      }

      // On-the-fly commands — read live values from refs so this effect
      // never needs to be recreated when isRunning/volume changes.
      const orch = orchestrRef.current
      if (!orch || !isRunningRef.current) return

      switch (action.command) {
        case 'shuffle':
          orch.regenerateAll()
          break
        case 'bpm-up': {
          const delta = typeof action.value === 'number' ? action.value : 10
          const newBpm = orch.getBpm() + delta
          orch.setBpm(newBpm)
          useStudioStore.getState().setBpm(newBpm)
          break
        }
        case 'bpm-down': {
          const delta = typeof action.value === 'number' ? action.value : 10
          const newBpm = orch.getBpm() - delta
          orch.setBpm(newBpm)
          useStudioStore.getState().setBpm(newBpm)
          break
        }
        case 'drop':
          // Force to Flow state with high energy
          if (stateMachRef.current && physicsRef.current) {
            const currentPhysics = physicsRef.current.getLastState()
            if (currentPhysics) {
              const dropPhysics = {
                ...currentPhysics,
                bounce: 0.85,
                density: 0.9,
                presence: 0.95,
              }
              stateMachRef.current.forceState(OState.Flow, dropPhysics)
            }
          }
          break
        case 'strip':
          orch.setBassVolumeMultiplier(0)
          orch.setMelodyVolumeMultiplier(0)
          break
        case 'restore':
          orch.setBassVolumeMultiplier(bassVolumeRef.current)
          orch.setMelodyVolumeMultiplier(melodyVolumeRef.current)
          break
      }
    })

    triggerDetectorRef.current = detector
    voiceRouterRef.current = router

    return () => {
      detector.dispose()
      router.dispose()
      triggerDetectorRef.current = null
      voiceRouterRef.current = null
    }
  }, [quickStart])  // stable — isRunning/volume read from refs

  // Feed transcription text to the TriggerWordDetector on every update
  useEffect(() => {
    if (!transcription || !triggerDetectorRef.current) return

    // Process both interim and final text
    const textToScan = transcription.currentInterim
      || (transcription.lines.length > 0
        ? transcription.lines[transcription.lines.length - 1].text
        : '')

    if (textToScan) {
      triggerDetectorRef.current.processText(textToScan)
    }
  }, [transcription])

  // ── Cadence Lock Engine ──
  // Created once on mount so accumulated samples survive start/stop cycles.
  // cadenceLockEnabled and isRunning are read from refs inside the callback.
  const cadenceLockEnabledRef = useRef(cadenceLockEnabled)
  cadenceLockEnabledRef.current = cadenceLockEnabled

  useEffect(() => {
    const lock = new CadenceLock({ sensitivity: 0.3 })

    lock.onUpdate((snapshot) => {
      setCadenceSnapshot(snapshot)

      // Read live values from refs so this closure never goes stale
      if (cadenceLockEnabledRef.current && snapshot.confidence >= 0.5 && !snapshot.isLocked) {
        const orch = orchestrRef.current
        if (orch && isRunningRef.current) {
          orch.setBpm(snapshot.smoothedBpm)
          useStudioStore.getState().setBpm(snapshot.smoothedBpm)
        }
      }
    })

    cadenceLockRef.current = lock

    return () => {
      lock.dispose()
      cadenceLockRef.current = null
    }
  }, [])  // stable — cadenceLockEnabled/isRunning read from refs

  // Sync enabled state without recreating the engine
  useEffect(() => {
    cadenceLockRef.current?.setEnabled(cadenceLockEnabled)
  }, [cadenceLockEnabled])

  // Feed finalized transcription lines to CadenceLock — only new lines
  useEffect(() => {
    const lock = cadenceLockRef.current
    if (!lock || !transcription) return

    // Update the lock with current BPM
    const orch = orchestrRef.current
    if (orch) lock.setCurrentBpm(orch.getBpm())

    // Only feed lines we haven't seen yet
    const lines = transcription.lines
    const nextIndex = cadenceLastLineIndexRef.current + 1
    if (lines.length > nextIndex) {
      const newLine = lines[nextIndex]
      lock.processLine(newLine.text, newLine.startTime, newLine.endTime)
      cadenceLastLineIndexRef.current = nextIndex
    }
  }, [transcription])

  // ── Call & Response Engine ──
  // Detects rapper pauses and boosts melody during gaps for natural call & response.
  // Use refs for volume values so the callback closure doesn't force engine recreation.
  const melodyVolumeRef = useRef(melodyVolume)
  const bassVolumeRef = useRef(bassVolume)
  const callResponseEnabledRef = useRef(callResponseEnabled)
  const isRunningRef = useRef(isRunning)
  const dropDetectorEnabledRef = useRef(dropDetectorEnabled)
  melodyVolumeRef.current = melodyVolume
  bassVolumeRef.current = bassVolume
  callResponseEnabledRef.current = callResponseEnabled
  isRunningRef.current = isRunning
  dropDetectorEnabledRef.current = dropDetectorEnabled

  // Track how many transcription lines we've already processed, so we never
  // feed the same finalized line to CadenceLock or FreestyleReportCard twice.
  const cadenceLastLineIndexRef   = useRef(-1)
  const reportCardLastLineIndexRef = useRef(-1)

  useEffect(() => {
    const engine = new CallResponseEngine()

    engine.onPhaseChange((state) => {
      setCallResponsePhase(state.phase)

      const orch = orchestrRef.current
      if (!orch || !callResponseEnabledRef.current) return

      if (state.phase === 'responding') {
        const cfg = engine.getConfig()
        orch.setMelodyVolumeMultiplier(melodyVolumeRef.current * cfg.melodyBoost)
        orch.setBassVolumeMultiplier(bassVolumeRef.current * cfg.bassReduction)
      } else if (state.phase === 'cooldown' || state.phase === 'idle') {
        orch.setMelodyVolumeMultiplier(melodyVolumeRef.current)
        orch.setBassVolumeMultiplier(bassVolumeRef.current)
      }
    })

    callResponseRef.current = engine

    return () => {
      engine.dispose()
      callResponseRef.current = null
    }
  }, [])  // stable — callResponseEnabled/volume read from refs

  // Sync enabled state so the gap timer stops when the feature is toggled off
  useEffect(() => {
    callResponseRef.current?.setEnabled(callResponseEnabled)
  }, [callResponseEnabled])

  // Feed transcription text to CallResponseEngine
  useEffect(() => {
    const engine = callResponseRef.current
    if (!engine || !transcription) return

    const hasInterim = !!transcription.currentInterim
    const lastLine = transcription.lines.length > 0
      ? transcription.lines[transcription.lines.length - 1].text
      : ''

    const text = transcription.currentInterim || lastLine
    engine.processText(text, hasInterim)
  }, [transcription])

  // ── Drop Detector Engine ──
  // Created once on mount so rolling window survives toggle cycles.
  // dropDetectorEnabled is read from a ref inside the callback.
  useEffect(() => {
    const detector = new DropDetector()

    detector.onDrop((event) => {
      setLastDropIntensity(event.intensity)

      // Feed to report card
      reportCardRef.current?.addDrop(event.intensity)

      // Force state machine to Flow with boosted physics on drop
      // Guard: skip if already in Flow to avoid pattern regeneration spam
      if (dropDetectorEnabledRef.current && stateMachRef.current && physicsRef.current) {
        const sm = stateMachRef.current
        const currentState = sm.getCurrentState()
        if (currentState.current !== OState.Flow) {
          const current = physicsRef.current.getLastState()
          if (current) {
            sm.forceState(OState.Flow, {
              ...current,
              bounce:   Math.min(1, current.bounce + event.intensity * 0.3),
              density:  Math.min(1, current.density + event.intensity * 0.2),
              presence: Math.min(1, current.presence + event.intensity * 0.25),
            })
          }
        }
      }
    })

    dropDetectorRef.current = detector

    return () => {
      detector.dispose()
      dropDetectorRef.current = null
    }
  }, [])  // stable — dropDetectorEnabled read from ref

  // Sync enabled state without resetting the rolling window
  useEffect(() => {
    dropDetectorRef.current?.setEnabled(dropDetectorEnabled)
  }, [dropDetectorEnabled])

  // ── Vibe Matcher Engine ──
  // Classifies the current beat into a genre label from physics + BPM.
  useEffect(() => {
    const matcher = new VibeMatcher()

    matcher.onVibeChange((event) => {
      setCurrentVibe(event.current)

      // Feed to report card
      if (event.previous) {
        reportCardRef.current?.addVibeChange(event.previous.genre, event.current.genre)
      }
    })

    vibeMatcherRef.current = matcher

    return () => {
      matcher.dispose()
      vibeMatcherRef.current = null
    }
  }, [])

  // ── Throttled physics feeding for DropDetector + VibeMatcher ──
  // Instead of feeding every frame (~43fps), throttle to ~6fps (every 150ms).
  // This dramatically reduces React state updates and re-renders.
  const lastPhysicsFeedRef = useRef<number>(0)
  const PHYSICS_FEED_INTERVAL_MS = 150

  useEffect(() => {
    if (!physicsState) return

    const now = performance.now()
    if (now - lastPhysicsFeedRef.current < PHYSICS_FEED_INTERVAL_MS) return
    lastPhysicsFeedRef.current = now

    // Feed DropDetector
    dropDetectorRef.current?.processFrame(
      physicsState.bounce,
      physicsState.density,
      physicsState.presence,
    )

    // Feed VibeMatcher
    if (vibeMatchEnabled && vibeMatcherRef.current) {
      const orch = orchestrRef.current
      const bpm = orch ? orch.getBpm() : 120
      vibeMatcherRef.current.processFrame(
        bpm,
        physicsState.bounce,
        physicsState.density,
        physicsState.swing,
        physicsState.pocket,
      )
    }
  }, [physicsState, vibeMatchEnabled])

  // ── Scale Snap Engine ──
  // Detects the musical key from pitch input and locks the melody to it.
  // Created once on mount and fed pitch frames from the physics subscription.
  useEffect(() => {
    const snap = new ScaleSnapEngine()

    snap.onScaleChange((detection) => {
      // Push detected scale straight to the melody generator
      const orch = orchestrRef.current
      if (orch && isRunningRef.current) {
        orch.setDetectedScale(detection.rootPitchClass, detection.intervals)
      }

      // Sync detected key to the global store so Piano Roll / Beat Maker see it
      if (detection.locked && detection.confidence >= 0.6) {
        const keyName = detection.rootName as MusicalKey
        const mode: KeyMode = detection.scaleType.includes('major') ? 'major' : 'minor'
        useStudioStore.getState().setDetectedKey(keyName, mode, detection.confidence)

        // Auto-promote to active key when confidence is very high (≥ 0.82).
        // Below that threshold the key is stored as "detected" only — the user
        // can manually accept it via the Key Signature dialog.
        if (detection.confidence >= 0.82) {
          useStudioStore.getState().acceptDetectedKey()
        }
      }
    })

    scaleSnapRef.current = snap

    return () => {
      snap.dispose()
      scaleSnapRef.current = null
    }
  }, [])

  // Feed pitch frames to ScaleSnapEngine — piggyback on the existing
  // 150ms throttle so it runs at the same ~6fps as DropDetector/VibeMatcher.
  // physicsState gives us the mode; we get the raw pitch from input.getLastFrame().
  useEffect(() => {
    if (!physicsState) return
    const snap  = scaleSnapRef.current
    const input = inputRef.current
    if (!snap || !input) return

    const frame = input.getLastFrame()
    if (!frame || frame.pitchConfidence < 0.3) return  // skip low-confidence frames early

    snap.processPitchFrame({
      pitchHz:    frame.pitch,
      pitchMidi:  frame.pitchMidi,
      confidence: frame.pitchConfidence,
      mode:       physicsState.mode,
      voiceActive: physicsState.voiceActive,
    })
  }, [physicsState])  // runs at same rate as physics UI updates (~15fps, ~150ms effective via existing throttle)

  // ── Freestyle Report Card ──
  // Initialize on session start, feed data throughout, generate on stop.
  useEffect(() => {
    const card = new FreestyleReportCard()
    reportCardRef.current = card

    return () => {
      card.dispose()
      reportCardRef.current = null
    }
  }, [])

  // Start/stop report card with the organism
  useEffect(() => {
    const card = reportCardRef.current
    if (!card) return

    if (isRunning) {
      const orch = orchestrRef.current
      card.startSession(orch ? orch.getBpm() : 120)
    }
  }, [isRunning])

  // Feed finalized transcription lines to report card — only new lines
  useEffect(() => {
    const card = reportCardRef.current
    if (!card || !transcription) return

    const lines = transcription.lines
    const nextIndex = reportCardLastLineIndexRef.current + 1
    if (lines.length > nextIndex) {
      const newLine = lines[nextIndex]
      card.addLine(newLine.text, newLine.startTime, newLine.endTime)
      reportCardLastLineIndexRef.current = nextIndex
    }
  }, [transcription])

  // generateReport callback
  const generateReport = useCallback((): FreestyleReport | null => {
    const card = reportCardRef.current
    if (!card || !card.getIsActive()) return null

    const report = card.endSession()
    setLastReport(report)
    return report
  }, [])

  // Guest timer — tick down while guest is playing
  useEffect(() => {
    if (!isGuest) return
    if (isRunning) {
      if (!guestTimerRef.current) {
        guestTimerRef.current = setInterval(() => {
          setGuestSecondsRemaining(prev => {
            if (prev <= 1) {
              setIsGuestNudgeVisible(true)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } else {
      if (guestTimerRef.current) {
        clearInterval(guestTimerRef.current)
        guestTimerRef.current = null
      }
    }
    return () => {
      if (guestTimerRef.current) {
        clearInterval(guestTimerRef.current)
        guestTimerRef.current = null
      }
    }
  }, [isGuest, isRunning])

  const dismissGuestNudge = useCallback(() => setIsGuestNudgeVisible(false), [])

  const shareSession = useCallback(async (caption: string): Promise<{ postUrl: string } | null> => {
    if (isSharingSession) return null
    setIsSharingSession(true)
    try {
      const dna = captureRef.current ? await captureRef.current.capture() : null

      // Get beat blob if available — reuse lastSavedSession if exists, else try live capture
      let beatBlob: Blob | null = null
      if (lastSavedSession?.beatBlob) {
        beatBlob = lastSavedSession.beatBlob
      }

      const orch = orchestrRef.current
      const bpm  = orch ? orch.getBpm() : useStudioStore.getState().bpm
      const key  = useStudioStore.getState().key

      const form = new FormData()
      form.append('caption', caption)
      form.append('bpm', String(bpm))
      form.append('key', key)
      if (dna) form.append('dna', JSON.stringify(dna))
      if (beatBlob) form.append('audio', beatBlob, 'session.webm')

      const res = await fetch('/api/social/share-organism-session', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Share failed')

      const data = await res.json()
      const url: string = data.postUrl || '/social-hub'
      setLastSharedPostUrl(url)
      return { postUrl: url }
    } catch {
      return null
    } finally {
      setIsSharingSession(false)
    }
  }, [isSharingSession, lastSavedSession])

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

  // Physics context — separate memo so it only invalidates consumers that
  // actually need high-frequency physics data (Visualizer, ModeIndicator).
  const physicsValue = useMemo<OrganismPhysicsContextValue>(() => ({
    physicsState,
    organismState,
    meterReading,
  }), [physicsState, organismState, meterReading])

  const value: OrganismContextValue = useMemo(() => ({
    analysisEngine:    inputSource === 'mic' ? inputRef.current as unknown as AudioAnalysisEngine : null,
    physicsEngine:     physicsRef.current,
    stateMachine:      stateMachRef.current,
    orchestrator:      orchestrRef.current,
    reactiveBehaviors: reactiveRef.current,
    mixEngine:         mixRef.current,
    captureEngine:     captureRef.current,
    lastSessionDNA,
    start,
    stop,
    capture: captureSession,
    downloadMidi,

    // Quick Start
    quickStart,
    quickStartPresets: QUICK_START_PRESETS,
    activePresetId,

    // Count-In Start
    countInStart,
    countInBeat,

    // Sound Trigger Start
    soundTriggerArmed,
    armSoundTrigger,
    disarmSoundTrigger,

    // Cadence Lock
    cadenceLockEnabled,
    setCadenceLockEnabled,
    cadenceSnapshot,

    // Call & Response
    callResponseEnabled,
    setCallResponseEnabled,
    callResponsePhase,

    // Drop Detector
    dropDetectorEnabled,
    setDropDetectorEnabled,
    lastDropIntensity,

    // Vibe Match
    vibeMatchEnabled,
    setVibeMatchEnabled,
    currentVibe,

    // Freestyle Report Card
    lastReport,
    generateReport,

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
    isRecording,
    startRecording,
    stopRecording,
    lastSavedSession,
    savedSessions,
    downloadSession,

    // Latch mode
    latchMode,
    setLatchMode: (enabled: boolean) => {
      setLatchModeState(enabled)
      const src = inputRef.current
      if (src && 'setLatch' in src) (src as unknown as { setLatch: (v: boolean) => void }).setLatch(enabled)
    },

    // Pattern lock
    isPatternLocked,
    lockPattern: () => {
      orchestrRef.current?.lockDrumPattern()
      setIsPatternLocked(true)
    },
    unlockPattern: () => {
      orchestrRef.current?.unlockDrumPattern()
      setIsPatternLocked(false)
    },

    // Tweak controls
    hatDensity,
    kickVelocity,
    bassVolume,
    melodyVolume,
    setHatDensity: (v: number) => {
      setHatDensityState(v)
      orchestrRef.current?.setHatDensityMultiplier(v)
    },
    setKickVelocity: (v: number) => {
      setKickVelocityState(v)
      orchestrRef.current?.setKickVelocityMultiplier(v)
    },
    setBassVolume: (v: number) => {
      setBassVolumeState(v)
      orchestrRef.current?.setBassVolumeMultiplier(v)
    },
    setMelodyVolume: (v: number) => {
      setMelodyVolumeState(v)
      orchestrRef.current?.setMelodyVolumeMultiplier(v)
    },

    // Texture toggle
    textureEnabled,
    setTextureEnabled: (enabled: boolean) => {
      setTextureEnabledState(enabled)
      orchestrRef.current?.setTextureEnabled(enabled)
    },

    // Guest experience
    guestSecondsRemaining,
    isGuestNudgeVisible,
    dismissGuestNudge,

    // Session sharing
    shareSession,
    isSharingSession,
    lastSharedPostUrl,

    isRunning,
    isCapturing,
    error,

    // Ears system
    performerState,
    selfListenReport,
  }), [
    lastSessionDNA,
    start, stop, captureSession, downloadMidi,
    quickStart, activePresetId,
    countInStart, countInBeat,
    soundTriggerArmed, armSoundTrigger, disarmSoundTrigger,
    cadenceLockEnabled, cadenceSnapshot,
    callResponseEnabled, callResponsePhase,
    dropDetectorEnabled, lastDropIntensity,
    vibeMatchEnabled, currentVibe,
    lastReport, generateReport,
    inputSource, handleSetInputSource, autoEnergy,
    transcription, transcriptionEnabled,
    isRecording, startRecording, stopRecording,
    lastSavedSession, savedSessions, downloadSession,
    latchMode, isPatternLocked,
    hatDensity, kickVelocity, bassVolume, melodyVolume, textureEnabled,
    guestSecondsRemaining, isGuestNudgeVisible, dismissGuestNudge,
    shareSession, isSharingSession, lastSharedPostUrl,
    isRunning, isCapturing, error,
    performerState, selfListenReport,
  ])

  return (
    <OrganismContext.Provider value={value}>
      <OrganismPhysicsContext.Provider value={physicsValue}>
        {children}
      </OrganismPhysicsContext.Provider>
    </OrganismContext.Provider>
  )
}
