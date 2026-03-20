import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react'
import { OrganismContext }         from './OrganismContext'
import type { OrganismContextValue, SavedSession } from './OrganismContext'

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
import * as Tone from 'tone'

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
  // Load persisted user profile (weighted average of past sessions)
  const { profile, recompute: recomputeProfile } = useProfile(userId, null)

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

    // Gap 2 — Generative patterns: when the arrangement enters a musically
    // interesting section, request a novel AI-generated drum pattern so the
    // organism's vocabulary expands beyond the hardcoded library.
    const GENERATIVE_SECTIONS = new Set(['verse', 'build', 'drop', 'verse2', 'drop2'])
    const handleSectionChange = async (e: Event) => {
      const { section, physics, bpm } = (e as CustomEvent).detail ?? {}
      if (!GENERATIVE_SECTIONS.has(section)) return
      try {
        const res = await fetch('/api/organism/generate-pattern', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, physics, bpm }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.hits?.length && orchestr) {
          orchestr.loadGeneratedDrumPattern(data.hits)
        }
      } catch { /* non-blocking — hardcoded patterns remain as fallback */ }
    }
    window.addEventListener('organism:section-change', handleSectionChange)

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
      window.removeEventListener('organism:section-change', handleSectionChange)
    }
  }, [userId, inputSource, autoEnergy, profile])

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
    if (dna && userId) {
      fetch('/api/organism/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dna, userId }),
      })
        .then(r => r.ok ? recomputeProfile() : null)
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
  }, [start, stop, captureSession, downloadMidi, startRecording, stopRecording])

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
    isRecording,
    startRecording,
    stopRecording,
    lastSavedSession,
    savedSessions,
    downloadSession,
    isRunning,
    isCapturing,
    error,
  }), [
    physicsState, organismState, meterReading, lastSessionDNA,
    start, stop, captureSession, downloadMidi,
    inputSource, handleSetInputSource, autoEnergy,
    transcription, transcriptionEnabled,
    isRecording, startRecording, stopRecording,
    lastSavedSession, savedSessions, downloadSession,
    isRunning, isCapturing, error,
  ])

  return (
    <OrganismContext.Provider value={value}>
      {children}
    </OrganismContext.Provider>
  )
}
