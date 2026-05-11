import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react'
import { OrganismContext, OrganismPhysicsContext } from './OrganismContext'
import type {
  OrganismContextValue,
  OrganismInstrumentAssignments,
  OrganismInstrumentRole,
  OrganismPhysicsContextValue,
  SavedSession,
  WowMomentState,
} from './OrganismContext'

import { AudioAnalysisEngine }    from '../../organism/analysis/AudioAnalysisEngine'
import { PhysicsEngine }          from '../../organism/physics/PhysicsEngine'
import { StateMachine }           from '../../organism/state/StateMachine'
import { GeneratorOrchestrator }  from '../../organism/generators/GeneratorOrchestrator'
import { ReactiveBehaviorEngine } from '../../organism/reactive/ReactiveBehaviorEngine'
import { MixEngine }              from '../../organism/mix/MixEngine'
import { CaptureEngine }          from '../../organism/session/CaptureEngine'
import { AIDirector }             from '../../organism/AIDirector'

import { MidiInputSource }       from '../../organism/input/MidiInputSource'
import { AudioFileSource }       from '../../organism/input/AudioFileSource'
import { AutoGenerateSource }    from '../../organism/input/AutoGenerateSource'
import type { InputSource, InputSourceType } from '../../organism/input/types'

import { OrganismMode, type PhysicsState } from '../../organism/physics/types'
import type { HipHopSubGenre } from '../../organism/state/MusicalState'
import type { OrganismState }   from '../../organism/state/types'
import type { MixMeterReading } from '../../organism/mix/types'
import type { SessionDNA }      from '../../organism/session/types'
import type { TranscriptionState } from './FreestyleTranscriber'
import { LiveFreestyleTranscriber } from './LiveFreestyleTranscriber'
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
import type { AnalysisFrame }    from '../../organism/analysis/types'
import { ScaleSnapEngine }       from '../../organism/scale/ScaleSnapEngine'
import { PerformerAnalyzer }    from '../../organism/audio/PerformerAnalyzer'
import { SelfListenAnalyzer }   from '../../organism/audio/SelfListenAnalyzer'
import type { PerformerState }  from '../../organism/audio/types'
import type { SelfListenReport } from '../../organism/audio/types'
import type { InstrumentPerformerId } from '../../organism/performers'
import { DrumInstrument, type DrumHit } from '../../organism/generators/types'
import { OState }                from '../../organism/state/types'
import * as Tone from 'tone'
import { useStudioStore } from '../../stores/useStudioStore'
import type { MusicalKey, KeyMode } from '../../stores/useStudioStore'
import { bridgeOrganismToStore } from '../../stores/organismToStudioBridge'
import { orgLog, orgPhase, startOrgHeartbeat } from '../../lib/perf/organismLog'
import { interpretVibeRuleBased, type VibeParams } from './ArtistReferenceBank'
import { registerOrganismAudioDebugSource } from '../../lib/audioDebugBridge'
import { OrganismV2LoopPlayer, type OrganismV2Status } from '../../organism/v2/OrganismV2LoopPlayer'

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

function isInputSourceType(input: InputSource, type: InputSourceType): boolean {
  switch (type) {
    case 'mic': return input instanceof AudioAnalysisEngine
    case 'autoGenerate': return input instanceof AutoGenerateSource
    case 'midi': return input instanceof MidiInputSource
    case 'audioFile': return input instanceof AudioFileSource
  }
}

type WowPulseInstrument = 'kick' | 'snare' | 'hat'

interface WowOnset {
  time: number
  strength: number
  centroid: number
  instrument: WowPulseInstrument
  word: string | null
}

const WOW_INITIAL_STATE: WowMomentState = {
  logs: [],
  engines: { drums: false, bass: false, harmony: false },
  phraseActive: false,
  lastPulse: null,
  capturedOnsets: 0,
  syncBpm: null,
}

const ORGANISM_V2_INITIAL_STATUS: OrganismV2Status = {
  active:       false,
  presetId:     null,
  kitBpm:       null,
  targetBpm:    null,
  playbackRate: 1,
  section:      null,
  bar:          0,
  cycleBars:    32,
  stems:        [],
}

const WOW_WORDS: Record<string, WowPulseInstrument> = {
  boom: 'kick',
  boomp: 'kick',
  bum: 'kick',
  dum: 'kick',
  doom: 'kick',
  thump: 'kick',
  clap: 'snare',
  clack: 'snare',
  snap: 'snare',
  pak: 'snare',
  bap: 'snare',
  tss: 'hat',
  ts: 'hat',
  hat: 'hat',
  tick: 'hat',
  tik: 'hat',
  shh: 'hat',
}

function normalizeWowWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '')
}

function drumInstrumentForWow(instrument: WowPulseInstrument): DrumInstrument {
  if (instrument === 'snare') return DrumInstrument.Snare
  if (instrument === 'hat') return DrumInstrument.Hat
  return DrumInstrument.Kick
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
  const [micMonitoringEnabled, setMicMonitoringEnabled] = useState(false)
  const [inputSourceRevision, setInputSourceRevision] = useState(0)
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
  const v2PlayerRef    = useRef<OrganismV2LoopPlayer     | null>(null)
  const reactiveRef    = useRef<ReactiveBehaviorEngine   | null>(null)
  const mixRef         = useRef<MixEngine                | null>(null)
  const captureRef     = useRef<CaptureEngine            | null>(null)

  // Live state
  const [physicsState,   setPhysicsState]   = useState<PhysicsState    | null>(null)
  const [organismState,  setOrganismState]  = useState<OrganismState   | null>(null)
  const [meterReading,   setMeterReading]   = useState<MixMeterReading | null>(null)
  const [lastSessionDNA, setLastSessionDNA] = useState<SessionDNA      | null>(null)
  const [isRunning,      setIsRunning]      = useState(false)
  const [isStarting,     setIsStarting]     = useState(false)
  const [isCapturing,    setIsCapturing]    = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [wowMoment,      setWowMoment]      = useState<WowMomentState>(WOW_INITIAL_STATE)
  const wowMomentRef = useRef<WowMomentState>(WOW_INITIAL_STATE)
  const wowSnapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wowLogIdRef = useRef(0)
  const wowOnsetsRef = useRef<WowOnset[]>([])
  const wowPhraseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wowLastVoiceLogRef = useRef(0)
  const wowLastOnsetLogRef = useRef(0)
  const wowLastSyncLogRef = useRef(0)
  const wowSyncBpmRef = useRef<number | null>(null)
  const wowLatestWordRef = useRef<{ word: string; instrument: WowPulseInstrument; timestamp: number } | null>(null)
  const wowLastTranscriptTokenRef = useRef('')

  // Guest timer — 60s countdown while playing.
  // Persist seconds-used to localStorage so a page refresh can't reset the trial.
  const GUEST_STORAGE_KEY = 'organism_guest_seconds_used'
  const readGuestSecondsUsed = (): number => {
    if (typeof window === 'undefined') return 0
    try {
      const raw = window.localStorage.getItem(GUEST_STORAGE_KEY)
      const n = raw ? parseInt(raw, 10) : 0
      return Number.isFinite(n) ? Math.max(0, Math.min(60, n)) : 0
    } catch { return 0 }
  }
  const [guestSecondsRemaining, setGuestSecondsRemaining] = useState(() => 60 - readGuestSecondsUsed())
  const [isGuestNudgeVisible,   setIsGuestNudgeVisible]   = useState(() => readGuestSecondsUsed() >= 60)
  const guestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Session sharing state
  const [isSharingSession,  setIsSharingSession]  = useState(false)
  const [lastSharedPostUrl, setLastSharedPostUrl]  = useState<string | null>(null)

  // Transcription state
  const transcriberRef = useRef<LiveFreestyleTranscriber | null>(null)
  const [transcription,         setTranscription]         = useState<TranscriptionState | null>(null)
  const [transcriptionEnabled,  setTranscriptionEnabled]  = useState(true)

  // Quick Start state
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [v2Status, setV2Status] = useState<OrganismV2Status>(ORGANISM_V2_INITIAL_STATUS)
  const startTokenRef = useRef(0)
  const startInFlightRef = useRef<Promise<void> | null>(null)

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
  const [hatDensity,       setHatDensityState]  = useState(0.55)
  const [kickVelocity,     setKickVelocityState]= useState(0.82)
  const [drumsVolume,      setDrumsVolumeState] = useState(1.0)
  const [bassVolume,       setBassVolumeState]  = useState(1.25)
  const [melodyVolume,     setMelodyVolumeState]= useState(1.55)
  const [chordVolume,      setChordVolumeState] = useState(1.0)
  const [melodyFocusEnabled, setMelodyFocusEnabledState] = useState(false)
  const [textureEnabled,   setTextureEnabledState] = useState(false)  // off by default for hip-hop
  const [instrumentAssignments, setInstrumentAssignments] = useState<OrganismInstrumentAssignments>({
    lead: null,
    bass: null,
    chord: null,
  })
  const [vibeInterpretation, setVibeInterpretation] = useState<{ text: string; result: string; confidence: number } | null>(null)

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

  // Boot engines on mount — wiring order is critical.
  // Engines live for the lifetime of this provider (per userId). The input
  // source is created + subscribed in a separate effect below so switching
  // between Mic / Auto / Audio File does NOT tear down the orchestrator,
  // which is the expensive, audible-latency-causing part of the teardown.
  useEffect(() => {
    // 1. Create engine instances (input is handled by a separate effect)
    const physics     = new PhysicsEngine()
    const machine     = new StateMachine(
      inputSource === 'autoGenerate' ? { autoBreathingToFlowBars: 1 } : {}
    )
    const orchestr    = new GeneratorOrchestrator()
    const v2Player    = new OrganismV2LoopPlayer()
    const reactive    = new ReactiveBehaviorEngine()
    const mix         = new MixEngine()
    const capture     = new CaptureEngine()

    // 2. Store refs
    physicsRef.current   = physics

    // Seed physics with user's historical groove profile so the organism
    // starts in the user's natural pocket rather than from neutral defaults
    if (profile) physics.setProfile(profile)
    stateMachRef.current = machine
    orchestrRef.current  = orchestr
    v2PlayerRef.current  = v2Player
    reactiveRef.current  = reactive
    mixRef.current       = mix
    captureRef.current   = capture
    const unsubV2Status  = v2Player.onStatusChange(setV2Status)

    // 3. Wire in correct order:
    //    input → physics → state machine
    //    physics + state machine → generators
    //    generators → reactive behaviors
    //    generators → mix engine
    //    physics + state machine → capture engine

    // physics → state machine (always) + throttled UI state + broadcast.
    // The audio/physics engine receives every frame, but React does not. The
    // command center subscribes to this context, so frequent updates make hover
    // states blink and steal time from the audio thread.
    let lastPhysicsUIUpdate = 0
    const ORGANISM_UI_INTERVAL_MS = 250
    const unsubPhysicsState = physics.subscribe((state) => {
      machine.processFrame(state)

      const now = performance.now()
      if (now - lastPhysicsUIUpdate >= ORGANISM_UI_INTERVAL_MS) {
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
      // Throttle React state updates to match physics UI updates.
      const now = performance.now()
      if (now - lastOrganismUIUpdate >= ORGANISM_UI_INTERVAL_MS) {
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

    // Wire AI Director — pre-generates next section directive while current plays
    const aiDirector = new AIDirector(orchestr)
    const unregisterAudioDebugSource = registerOrganismAudioDebugSource({
      connect: (destination) => {
        mix.connectMasterOutput(destination)
      },
      disconnect: (destination) => {
        mix.disconnectMasterOutput(destination)
      },
    })

    // Bridge chord changes to external listeners (Astutely, UI)
    const unsubChord = orchestr.onChordChange((chord, rootPitchClass) => {
      window.dispatchEvent(new CustomEvent('organism:chord-change', {
        detail: {
          currentChord: chord,
          rootPitchClass,
          label: chord.label,
          intervals: chord.intervals,
          rootOffset: chord.rootOffset,
        },
      }))
    })

    // ── Ears system: performer analysis ──────────────────────────────────────
    // The input → performer subscription is wired in the input-source effect
    // below, since it depends on the current InputSource instance.
    const performer   = new PerformerAnalyzer()
    const selfListen  = new SelfListenAnalyzer()
    performerRef.current   = performer
    selfListenRef.current  = selfListen

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
    let lastMeterUIUpdate = 0
    const unsubMeter = mix.onMeter((reading) => {
      const now = performance.now()
      if (now - lastMeterUIUpdate < ORGANISM_UI_INTERVAL_MS) return
      lastMeterUIUpdate = now
      setMeterReading(reading)
    })

    // Subscribe to reactive behavior engine. Reads the live input via ref so
    // it tracks whichever input source is currently active (swapped without
    // requiring this effect to re-run).
    const unsubReactive = physics.subscribe((pState) => {
      const oState = machine.getCurrentState()
      const lastFrame = inputRef.current?.getLastFrame()
      if (lastFrame) {
        reactive.processFrame(lastFrame, pState, oState)
      }
    })

    // Create live transcriber from the Organism-owned mic stream. This avoids
    // Web Speech opening a second microphone path while Tone.js is playing.
    const transcriber = new LiveFreestyleTranscriber(() => {
      const source = inputRef.current
      if (!source || !('getStream' in source)) return null
      return (source as unknown as { getStream: () => MediaStream | null }).getStream()
    })
    transcriberRef.current = transcriber
    const unsubTranscription = transcriber.subscribe((state) => {
      setTranscription(state)
      const latestText = (state.currentInterim || state.lines[state.lines.length - 1]?.text || '').trim()
      const latestToken = latestText.split(/\s+/).filter(Boolean).pop()
      if (!latestToken || latestToken === wowLastTranscriptTokenRef.current) return
      wowLastTranscriptTokenRef.current = latestToken
      const normalized = normalizeWowWord(latestToken)
      const instrument = WOW_WORDS[normalized]
      if (instrument) {
        wowLatestWordRef.current = {
          word: normalized,
          instrument,
          timestamp: performance.now(),
        }
      }
    })

    // Gap 2 — Generative patterns: when the arrangement enters a musically
    // interesting section, request a novel AI-generated drum pattern so the
    // organism's vocabulary expands beyond the hardcoded library.
    // Cooldown: only generate a new pattern at most once every 30 seconds
    // to avoid toast/pattern spam from rapid section changes.
    // Fire on every musically interesting section — not just drops.
    // Cooldown prevents spamming; each section has its own last-gen timestamp.
    const ENABLE_GENERATIVE_DRUM_PATTERNS = false
    const GENERATIVE_SECTIONS = new Set(['intro', 'verse', 'verse2', 'build', 'drop', 'drop2', 'breakdown'])
    const PATTERN_GEN_COOLDOWN_MS = 16_000   // ~1 full 4-bar loop at 90 BPM
    const lastPatternGenBySection: Record<string, number> = {}
    let patternGenInFlight = false
    const handleSectionChange = async (e: Event) => {
      if (!ENABLE_GENERATIVE_DRUM_PATTERNS) return
      const { section, physics: sectionPhysics, bpm } = (e as CustomEvent).detail ?? {}
      if (!GENERATIVE_SECTIONS.has(section)) return

      const now = performance.now()
      const lastGen = lastPatternGenBySection[section] ?? 0
      if (now - lastGen < PATTERN_GEN_COOLDOWN_MS) return
      if (patternGenInFlight) return

      patternGenInFlight = true
      lastPatternGenBySection[section] = now
      patternGenAbort = new AbortController()

      // Snapshot the last few words of live transcription for lyrical context
      const tState = transcriberRef.current?.getState()
      const lyricsSnippet = tState?.lines
        .map(l => l.text).join(' ').slice(-120) ?? ''

      try {
        const res = await fetch('/api/organism/generate-pattern', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, physics: sectionPhysics, bpm, lyrics: lyricsSnippet }),
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
      unsubV2Status()
      v2Player.stop()
      setV2Status(ORGANISM_V2_INITIAL_STATUS)
      patternGenAbort?.abort()
      unsubPhysicsState()
      unsubOrganism()
      unsubCapturePhysics()
      unsubCaptureTransition()
      unsubCaptureEvent()
      unsubMeter()
      unsubReactive()
      unsubSelfListen()
      unsubChord()
      unregisterAudioDebugSource()

      aiDirector.dispose()
      orchestr.dispose()   // dispose() frees all generator audio nodes; reset() only stops them
      mix.dispose()
      capture.reset()
      transcriber.reset()
      unsubTranscription()
      performer.reset()
      selfListen.dispose()
      window.removeEventListener('organism:section-change', handleSectionChange)
    }
  // Input-source changes do NOT tear down engines — a separate effect below
  // swaps just the InputSource instance. Profile is applied via another
  // effect above to avoid engine teardown during async profile fetch.
   
  }, [userId])

  const pushWowLog = useCallback((text: string, tone: WowMomentState['logs'][number]['tone'] = 'info') => {
    const entry = {
      id: ++wowLogIdRef.current,
      timestamp: Date.now(),
      text,
      tone,
    }
    wowMomentRef.current = {
      ...wowMomentRef.current,
      logs: [entry, ...wowMomentRef.current.logs].slice(0, 8),
    }
  }, [])

  const setWowEngineActive = useCallback((engine: keyof WowMomentState['engines'], activeMs = 700) => {
    wowMomentRef.current = {
      ...wowMomentRef.current,
      engines: { ...wowMomentRef.current.engines, [engine]: true },
    }
    window.setTimeout(() => {
      wowMomentRef.current = {
        ...wowMomentRef.current,
        engines: { ...wowMomentRef.current.engines, [engine]: false },
      }
    }, activeMs)
  }, [])

  const mapFrameToWowInstrument = useCallback((frame: AnalysisFrame): { instrument: WowPulseInstrument; word: string | null } => {
    const latestWord = wowLatestWordRef.current
    if (latestWord && performance.now() - latestWord.timestamp < 1200) {
      wowLatestWordRef.current = null
      return { instrument: latestWord.instrument, word: latestWord.word }
    }

    if (frame.spectralCentroid < 900) return { instrument: 'kick', word: null }
    if (frame.spectralCentroid < 3200) return { instrument: 'snare', word: null }
    return { instrument: 'hat', word: null }
  }, [])

  const buildWowPattern = useCallback((onsets: WowOnset[], bpm: number): DrumHit[] => {
    if (onsets.length === 0) return []
    const start = onsets[0].time
    const end = onsets[onsets.length - 1].time
    const phraseMs = Math.max(600, end - start)
    const byStep = new Map<number, WowOnset>()

    onsets.forEach((onset) => {
      const step = Math.max(0, Math.min(15, Math.round(((onset.time - start) / phraseMs) * 15)))
      const current = byStep.get(step)
      if (!current || onset.strength > current.strength) byStep.set(step, onset)
    })

    const hits: DrumHit[] = Array.from(byStep.entries())
      .sort(([a], [b]) => a - b)
      .map(([step, onset]) => ({
        instrument: drumInstrumentForWow(onset.instrument),
        time: `0:${Math.floor(step / 4)}:${step % 4}`,
        velocity: Math.max(0.35, Math.min(1, 0.46 + onset.strength * 0.5)),
      }))

    const hasHit = (instrument: DrumInstrument, time: string) =>
      hits.some(hit => hit.instrument === instrument && hit.time === time)
    const addHit = (instrument: DrumInstrument, time: string, velocity: number) => {
      if (!hasHit(instrument, time)) hits.push({ instrument, time, velocity })
    }

    // Keep the human rhythm, but add musical anchors so the response feels like
    // a beat instead of a literal click track.
    addHit(DrumInstrument.Kick, '0:0:0', 0.82)
    if (!hits.some(hit => hit.instrument === DrumInstrument.Kick && hit.time !== '0:0:0')) {
      addHit(DrumInstrument.Kick, '0:2:2', 0.58)
    }

    addHit(DrumInstrument.Snare, '0:1:0', 0.66)
    addHit(DrumInstrument.Snare, '0:3:0', 0.62)

    if (hits.filter(hit => hit.instrument === DrumInstrument.Hat).length < 2 && bpm >= 70) {
      ;['0:0:2', '0:1:2', '0:2:2', '0:3:2'].forEach((time, index) => {
        addHit(DrumInstrument.Hat, time, index % 2 === 0 ? 0.42 : 0.36)
      })
    }

    return hits.sort((a, b) => {
      const [, beatA, subA] = a.time.split(':').map(Number)
      const [, beatB, subB] = b.time.split(':').map(Number)
      return beatA === beatB ? subA - subB : beatA - beatB
    })
  }, [])

  const finalizeWowPhrase = useCallback(() => {
    const onsets = wowOnsetsRef.current
    wowOnsetsRef.current = []
    wowMomentRef.current = { ...wowMomentRef.current, phraseActive: false, capturedOnsets: 0 }
    if (onsets.length < 2) return

    const bpm = Math.round(orchestrRef.current?.getBpm() ?? physicsRef.current?.getLastState()?.pulse ?? 90)
    const hits = buildWowPattern(onsets, bpm)
    if (hits.length === 0) return

    pushWowLog(`phrase captured: ${onsets.length} pulses`, 'info')
    pushWowLog('pattern detected: 4/4, syncopation mild', 'sync')
    pushWowLog('generating response...', 'info')
    orchestrRef.current?.loadGeneratedDrumPattern(hits, true)

    setWowEngineActive('drums', 900)
    pushWowLog('drums online', 'wake')
    window.setTimeout(() => {
      setWowEngineActive('bass', 900)
      pushWowLog('bass online', 'wake')
    }, 260)
    window.setTimeout(() => {
      setWowEngineActive('harmony', 1000)
      pushWowLog('harmony online', 'wake')
    }, 520)
  }, [buildWowPattern, pushWowLog, setWowEngineActive])

  const processWowFrame = useCallback((frame: AnalysisFrame, performer: PerformerState | null) => {
    if (inputSource !== 'mic') return
    const now = performance.now()

    if (frame.voiceActive && now - wowLastVoiceLogRef.current > 1800) {
      wowLastVoiceLogRef.current = now
      pushWowLog('voice detected', 'info')
    }

    if (
      performer &&
      performer.bpmConfidence > 0.55 &&
      Math.abs(performer.bpm - (wowSyncBpmRef.current ?? 0)) > 3 &&
      now - wowLastSyncLogRef.current > 3000
    ) {
      wowLastSyncLogRef.current = now
      wowSyncBpmRef.current = Math.round(performer.bpm)
      wowMomentRef.current = { ...wowMomentRef.current, syncBpm: Math.round(performer.bpm) }
      pushWowLog(`sync established at ${Math.round(performer.bpm)} BPM`, 'sync')
    }

    if (!frame.onsetDetected || frame.onsetStrength < 0.25) return
    if (now - wowLastOnsetLogRef.current < 85) return
    wowLastOnsetLogRef.current = now

    const mapped = mapFrameToWowInstrument(frame)
    const drumInstrument = drumInstrumentForWow(mapped.instrument)
    const pulse: WowOnset = {
      time: frame.onsetTimestamp || now,
      strength: frame.onsetStrength,
      centroid: frame.spectralCentroid,
      instrument: mapped.instrument,
      word: mapped.word,
    }

    wowOnsetsRef.current = [...wowOnsetsRef.current, pulse].slice(-16)
    wowMomentRef.current = {
      ...wowMomentRef.current,
      phraseActive: true,
      lastPulse: mapped.instrument,
      capturedOnsets: wowOnsetsRef.current.length,
    }
    setWowEngineActive('drums', 420)
    orchestrRef.current?.triggerWowDrumPulse(
      drumInstrument,
      Math.max(0.45, Math.min(1, 0.5 + frame.onsetStrength * 0.45)),
    )

    pushWowLog(`heard: ${mapped.word ?? 'transient'}`, 'pulse')
    pushWowLog(`mapped: ${mapped.instrument}`, 'pulse')

    if (wowPhraseTimerRef.current) clearTimeout(wowPhraseTimerRef.current)
    wowPhraseTimerRef.current = setTimeout(finalizeWowPhrase, 560)
  }, [
    finalizeWowPhrase,
    inputSource,
    mapFrameToWowInstrument,
    pushWowLog,
    setWowEngineActive,
  ])

  const clearWowMomentLog = useCallback(() => {
    wowMomentRef.current = { ...wowMomentRef.current, logs: [] }
    setWowMoment(wowMomentRef.current)
  }, [])

  useEffect(() => {
    if (wowSnapshotTimerRef.current) return
    wowSnapshotTimerRef.current = setInterval(() => {
      setWowMoment(prev => {
        const next = wowMomentRef.current
        if (
          prev === next ||
          (
            prev.logs === next.logs &&
            prev.phraseActive === next.phraseActive &&
            prev.lastPulse === next.lastPulse &&
            prev.capturedOnsets === next.capturedOnsets &&
            prev.syncBpm === next.syncBpm &&
            prev.engines.drums === next.engines.drums &&
            prev.engines.bass === next.engines.bass &&
            prev.engines.harmony === next.engines.harmony
          )
        ) {
          return prev
        }
        return next
      })
    }, 250)

    return () => {
      if (wowSnapshotTimerRef.current) {
        clearInterval(wowSnapshotTimerRef.current)
        wowSnapshotTimerRef.current = null
      }
    }
  }, [])

  // Input-source effect — swap the InputSource without touching the
  // orchestrator, mix, capture, or any Tone.js audio nodes. This is the
  // path that fires when the user clicks Mic / Auto / Audio File / MIDI.
  // Previously this triggered a full engine teardown (~500ms) because input
  // was created inside the engine-init effect. Now it's a sub-100ms swap.
  useEffect(() => {
    const physics   = physicsRef.current
    const performer = performerRef.current
    const orchestr  = orchestrRef.current
    if (!physics || !performer) return // engines not ready yet

    // Reuse an existing input if handleSetInputSource already created one for
    // this source type (avoids a child-effect race where start() runs before
    // this parent effect fires and would otherwise use the stale input).
    const existing = inputRef.current
    if (!existing || !isInputSourceType(existing, inputSource)) {
      existing?.stop()
      inputRef.current = createInputSource(inputSource, audioFileRef.current, autoEnergy)
    }
    const input = inputRef.current!
    setInputSourceRevision((revision) => revision + 1)

    // input → physics (every frame must reach physics for accurate transitions)
    const unsubPhysics = input.subscribe((frame) => {
      physics.processFrame(frame)
    })

    // input → performer analysis + optional Transport BPM sync. React state
    // updates stay slow; audio reactions still run from refs/engines.
    let lastPerformerUIUpdate = 0
    const unsubPerformer = input.subscribe((frame) => {
      const pState = performer.processFrame(frame)
      processWowFrame(frame, pState)
      const now = performance.now()
      if (now - lastPerformerUIUpdate < 250) return
      lastPerformerUIUpdate = now
      setPerformerState({ ...pState })

      if (
        inputSource === 'mic' &&
        pState.bpmConfidence > 0.55 &&
        pState.isInPhrase &&
        Math.abs(pState.bpm - lastSyncedBpmRef.current) > 4 &&
        orchestr
      ) {
        orchestr.setBpm(pState.bpm)
        useStudioStore.getState().setBpm(pState.bpm)
        lastSyncedBpmRef.current = pState.bpm
        window.dispatchEvent(new CustomEvent('organism:bpm-locked', {
          detail: { bpm: pState.bpm, confidence: pState.bpmConfidence },
        }))
      }

      orchestr?.applyPerformerState(pState)
    })

    setIsRunning(false)
    setError(null)

    return () => {
      unsubPhysics()
      unsubPerformer()
      input.stop()
      lastSyncedBpmRef.current = 0
    }
  }, [userId, inputSource, autoEnergy, processWowFrame])

  // Capture Monitor preflight: when the user enables monitoring before starting
  // the Organism, open the same mic input source so the monitor can prove the
  // mic is live. start() later reuses this source instead of opening another mic.
  useEffect(() => {
    if (!micMonitoringEnabled || inputSource !== 'mic' || isRunning || isStarting) return
    const input = inputRef.current
    if (!input) return

    let disposed = false
    input.start().catch((err) => {
      if (disposed) return
      setError(err instanceof Error ? err.message : 'Failed to start mic monitor')
    })

    return () => {
      disposed = true
      if (!startInFlightRef.current && !isRunningRef.current && inputRef.current === input) {
        input.stop()
      }
    }
  }, [inputSource, inputSourceRevision, isRunning, isStarting, micMonitoringEnabled])

  // Apply profile updates to the live physics engine without recreating engines.
  // This prevents the async profile fetch (~2-8s network) from tearing down
  // an already-running organism session.
  useEffect(() => {
    if (physicsRef.current && profile) {
      physicsRef.current.setProfile(profile)
    }
  }, [profile])

  // Pre-warm Tone's AudioContext on the first user gesture inside the Organism
  // page. Browsers require a user gesture to resume AudioContext, and calling
  // Tone.start() cold inside orchestr.start() can cost 50–400ms on the click
  // that actually starts the beat. By priming on any earlier click (input-
  // source tile, preset hover, toggle), the real Start click is a no-op.
  useEffect(() => {
    let warmed = false
    const prewarm = async () => {
      if (warmed) return
      warmed = true
      try {
        await Tone.start()
      } catch {
        // If this fails (e.g. no gesture yet), the real start() will retry.
      }
      window.removeEventListener('pointerdown', prewarm, true)
      window.removeEventListener('keydown', prewarm, true)
    }
    window.addEventListener('pointerdown', prewarm, true)
    window.addEventListener('keydown', prewarm, true)
    return () => {
      window.removeEventListener('pointerdown', prewarm, true)
      window.removeEventListener('keydown', prewarm, true)
    }
  }, [])

  // Re-resume AudioContext when the tab becomes visible again — browsers
  // can suspend the context when the tab is backgrounded, and without this
  // the Organism stays silent even though Tone.Transport is still running.
  useEffect(() => {
    const handleVisible = () => {
      if (!document.hidden) {
        Tone.start().catch(() => { /* ignore if already running */ })
      }
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [])

  // ── Actions ───────────────────────────────────────────────────────

  const scheduleSilentStartRecovery = useCallback((token: number) => {
    const recoverDelays = [500, 1200, 2600]
    for (const delay of recoverDelays) {
      window.setTimeout(async () => {
        if (startTokenRef.current !== token || !isRunningRef.current) return
        const transportState = Tone.getTransport().state
        const ctxState = Tone.getContext().state
        const needsClockRecovery = transportState !== 'started' || ctxState !== 'running'
        const masterMeter = mixRef.current?.getMasterMeter()
        const meterIsSilent = !masterMeter
          || !Number.isFinite(masterMeter.rmsDb)
          || masterMeter.rmsDb < -75
        if (!needsClockRecovery && !meterIsSilent) return

        orgLog('provider:silent-start-recovery', {
          delay,
          transportState,
          ctxState,
          meterRmsDb: masterMeter?.rmsDb ?? null,
        }, 'warn')

        try {
          await Tone.start()
          Tone.getDestination().volume.value = 0
          await orchestrRef.current?.start(undefined, true)
          if (meterIsSilent) {
            applyStablePlaybackDefaults()
          }
        } catch (err) {
          orgLog('provider:silent-start-recovery-error', {
            error: err instanceof Error ? err.message : String(err),
          }, 'error')
        }
      }, delay)
    }
  }, [])

  const applyStablePlaybackDefaults = useCallback(() => {
    const orchestr = orchestrRef.current
    if (!orchestr) return

    orchestr.setArrangementEnabled(true)
    orchestr.setGrooveLocked(true)
    setHatDensityState(0.75)
    setKickVelocityState(0.95)
    setBassVolumeState(1.6)
    setMelodyVolumeState(1.8)
    orchestr.setHatDensityMultiplier(0.75)
    orchestr.setKickVelocityMultiplier(0.95)
    orchestr.setBassVolumeMultiplier(1.6)
    orchestr.setMelodyVolumeMultiplier(1.8)
    orchestr.setChordVolumeMultiplier(0.75)
    orchestr.setTextureVolumeMultiplier(0)
    orchestr.setTextureEnabled(false)
  }, [])

  const seedSongRamp = useCallback((seedPhysics: PhysicsState) => {
    const stateMachine = stateMachRef.current
    const orchestr = orchestrRef.current
    if (!stateMachine || !orchestr) return

    stateMachine.forceState(OState.Awakening, seedPhysics)
    stateMachine.forceState(OState.Breathing, seedPhysics)
    stateMachine.setStateFloor(OState.Breathing)
    orchestr.primeFrame(seedPhysics, stateMachine.getCurrentState())
  }, [])

  const waitForStartupParts = useCallback(
    () => new Promise<void>(resolve => window.setTimeout(resolve, 240)),
    [],
  )

  const start = useCallback(async () => {
    if (!inputRef.current || !orchestrRef.current) return
    if (isGuest && guestSecondsRemaining <= 0) {
      setIsGuestNudgeVisible(true)
      setError('Create a free account to keep using the Organism.')
      return
    }
    const input = inputRef.current
    const orchestr = orchestrRef.current
    if (isRunningRef.current) return
    if (startInFlightRef.current) return startInFlightRef.current

    const token = ++startTokenRef.current
    const run = (async () => {
      setIsStarting(true)
      // Resume AudioContext NOW, while we are still inside the user-gesture window.
    // Browsers only allow AudioContext.resume() shortly after a click/keydown (~1s).
    // inputRef.current.start() below can consume that window, so we must call
    // Tone.start() first — before any other awaits — to guarantee audio unlocks.
    try { await Tone.start() } catch { /* already running is fine */ }
    const endPhase = orgPhase('provider:start', 400)
    try {
      setError(null)
      cadenceLastLineIndexRef.current   = -1
      reportCardLastLineIndexRef.current = -1
      await input.start()
      if (startTokenRef.current !== token) {
        input.stop()
        return
      }
      await orchestr.start(undefined, false)
      if (startTokenRef.current !== token) {
        orchestr.stop()
        input.stop()
        return
      }
      const didPrimeAutoGenerate = primeAutoGenerateStart()

      // Fast-boot: skip the Dormant wait, start playing immediately from bar 1.
      // Set a floor of Breathing so a quiet mic can't regress to Dormant mid-session.
      if (!didPrimeAutoGenerate && stateMachRef.current && physicsRef.current) {
        const stateMachine = stateMachRef.current
        const physicsEngine = physicsRef.current
        const fallbackPulse = 90
        const fallbackBeatMs = 60000 / fallbackPulse
        const fallbackSixteenthMs = fallbackBeatMs / 4
        const fallbackPhysics: PhysicsState = {
          mode: OrganismMode.Glow,
          pulse: fallbackPulse,
          bounce: 0.5,
          swing: 0.5,
          pocket: 0.5,
          presence: 0.4,
          density: 0.4,
          beatDurationMs: fallbackBeatMs,
          sixteenthDurationMs: fallbackSixteenthMs,
          swungSixteenthMs: fallbackSixteenthMs,
          timestamp: Date.now(),
          frameIndex: 0,
          voiceActive: false,
        }
        const seedPhysics = physicsEngine.getLastState() ?? fallbackPhysics
        seedSongRamp(seedPhysics)
      }

      await waitForStartupParts()

      await orchestr.start()
      if (startTokenRef.current !== token) {
        orchestr.stop()
        input.stop()
        return
      }
      setIsRunning(true)
      isRunningRef.current = true
      applyStablePlaybackDefaults()
      scheduleSilentStartRecovery(token)

      // Start self-listen after audio is running
      selfListenRef.current?.start()
      if (transcriptionEnabled && transcriberRef.current) {
        transcriberRef.current.start()
      }
      endPhase({ inputSource, bpm: orchestr.getBpm() })
      orgLog('provider:started', { inputSource, bpm: orchestr.getBpm() })
      window.dispatchEvent(new CustomEvent('organism:started'))
    } catch (err) {
      endPhase({ error: err instanceof Error ? err.message : String(err) })
      orgLog('provider:start-error', { error: err instanceof Error ? err.message : String(err) }, 'error')
      setError(err instanceof Error ? err.message : 'Failed to start organism')
    }
    })()

    startInFlightRef.current = run
    try {
      await run
    } finally {
      if (startInFlightRef.current === run) {
        startInFlightRef.current = null
        setIsStarting(false)
      }
    }
  }, [inputSource, transcriptionEnabled, scheduleSilentStartRecovery, applyStablePlaybackDefaults, seedSongRamp, waitForStartupParts, isGuest, guestSecondsRemaining])

  const stop = useCallback(() => {
    startTokenRef.current += 1
    startInFlightRef.current = null
    setIsStarting(false)
    const bpm = orchestrRef.current?.getBpm()
    inputRef.current?.stop()
    v2PlayerRef.current?.stop()
    setV2Status(ORGANISM_V2_INITIAL_STATUS)
    orchestrRef.current?.setGrooveLocked(false)
    orchestrRef.current?.stop()
    transcriberRef.current?.stop()
    if (wowPhraseTimerRef.current) {
      clearTimeout(wowPhraseTimerRef.current)
      wowPhraseTimerRef.current = null
    }
    wowOnsetsRef.current = []
    wowSyncBpmRef.current = null
    wowMomentRef.current = {
      ...wowMomentRef.current,
      engines: { drums: false, bass: false, harmony: false },
      phraseActive: false,
      lastPulse: null,
      capturedOnsets: 0,
      syncBpm: null,
    }
    setWowMoment(wowMomentRef.current)
    // Clear state floor so the machine fully resets on the next start()
    stateMachRef.current?.setStateFloor(null)
    setIsRunning(false)
    isRunningRef.current = false
    orgLog('provider:stopped', { inputSource, bpm })

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
  }, [inputSource])

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

  function primeAutoGenerateStart(): boolean {
    if (inputSource !== 'autoGenerate') return false
    if (!physicsRef.current || !stateMachRef.current || !orchestrRef.current) return false

    const now = performance.now()
    const baseRms = autoEnergy === 'chill' ? 0.30 : autoEnergy === 'intense' ? 0.56 : 0.42
    const baseCentroid = autoEnergy === 'chill' ? 900 : autoEnergy === 'intense' ? 2400 : 1500

    const startupFrame: AnalysisFrame = {
      timestamp: now,
      frameIndex: 0,
      sampleRate: 44100,
      rms: baseRms,
      rmsRaw: baseRms,
      pitch: autoEnergy === 'intense' ? 260 : 220,
      pitchConfidence: 0.85,
      pitchMidi: 57,
      pitchCents: 0,
      spectralCentroid: baseCentroid,
      hnr: autoEnergy === 'chill' ? 12 : 8,
      spectralFlux: 0.25,
      onsetDetected: true,
      onsetStrength: 0.75,
      onsetTimestamp: now,
      voiceActive: true,
      voiceConfidence: 0.85,
    }

    physicsRef.current.processFrame(startupFrame)
    const seededPhysics = physicsRef.current.getLastState()
    if (!seededPhysics) return false

    seedSongRamp(seededPhysics)
    return true
  }

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
    console.log('[quickStart] refs:', {
      input: !!inputRef.current,
      orchestr: !!orchestrRef.current,
      stateMach: !!stateMachRef.current,
      physics: !!physicsRef.current,
      isRunning: isRunningRef.current,
      startInFlight: !!startInFlightRef.current,
    })
    if (!inputRef.current || !orchestrRef.current || !stateMachRef.current || !physicsRef.current) {
      console.error('[quickStart] Engines not initialized — aborting')
      setError('Engines not initialized')
      return
    }
    const input = inputRef.current
    const orchestr = orchestrRef.current
    const stateMachine = stateMachRef.current
    const physicsEngine = physicsRef.current
    if (isRunningRef.current) {
      console.warn('[quickStart] already running — skipping')
      return
    }
    if (startInFlightRef.current) return startInFlightRef.current

    // Force-reset orchestrator running flag in case a prior session left it stuck
    // (e.g. globalAudioKillSwitch fired, page navigation, or a crashed start attempt)
    if (orchestrRef.current) {
      orchestrRef.current.stop()
    }

    const token = ++startTokenRef.current

    const run = (async () => {
      setIsStarting(true)
      const endPhase = orgPhase('quickstart', 500)
    try {
      setError(null)
      setActivePresetId(presetId)
      cadenceLastLineIndexRef.current   = -1
      reportCardLastLineIndexRef.current = -1
      try { await Tone.start() } catch { /* already running is fine */ }

      // 1. Lock physics mode to the preset's genre — prevents ModeClassifier drift
      physicsEngine.lockMode(preset.mode)

      // 2. Start the input source (mic, auto, etc.)
      await input.start()
      if (startTokenRef.current !== token) {
        input.stop()
        return
      }

      // 3. Set tempo — v1 generators are the audible engine (proper hip-hop samples + patterns).
      orchestr.setBpm(preset.bpm)
      useStudioStore.getState().setBpm(preset.bpm)
      orgLog('quickstart:audio-check', {
        ctxState:       Tone.getContext().state,
        transportState: Tone.getTransport().state,
        destVol:        Number(Tone.getDestination().volume.value.toFixed(1)),
        bpm:            Number(Tone.getTransport().bpm.value.toFixed(1)),
      })

      // 3. Stamp the synthetic physics with a fresh timestamp
      const syntheticPhysics = {
        ...preset.physics,
        timestamp:  performance.now(),
        frameIndex: 0,
      }

      // 4. Feed the physics engine one synthetic AnalysisFrame so all subscribers
      //    (state machine, generators, reactive behaviors) get seeded
      physicsEngine.processFrame({
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

      // 5. Single jump to Flow — avoids the 3-transition cascade that causes
      //    generator rebuild throttles to suppress bass/melody/chord.
      //    Floor stays at Breathing so silence gaps don't regress to Dormant.
      const stateMachine = stateMachRef.current!
      stateMachine.forceState(OState.Flow, syntheticPhysics)
      stateMachine.setStateFloor(OState.Breathing)
      orchestr.primeFrame(syntheticPhysics, stateMachine.getCurrentState())
      if (preset.subGenre) {
        orchestr.forceSubGenre(preset.subGenre)
      }
      await waitForStartupParts()

      // Start v1 generators — real hip-hop drum samples + patterns from DrumPatternLibrary
      console.log('[quickStart] calling orchestr.start', {
        bpm: preset.bpm,
        transportState: Tone.getTransport().state,
        transportPos: Tone.getTransport().position,
        ctxState: Tone.getContext().state,
      })
      await orchestr.start(preset.bpm, true)
      console.log('[quickStart] orchestr.start done — transport:', Tone.getTransport().state)
      if (startTokenRef.current !== token) {
        orchestr.stop()
        input.stop()
        return
      }
      setV2Status({
        active:       true,
        presetId:     preset.id,
        kitBpm:       preset.bpm,
        targetBpm:    preset.bpm,
        playbackRate: 1,
        section:      'intro',
        bar:          0,
        cycleBars:    32,
        stems:        [],
      })
      setIsRunning(true)
      isRunningRef.current = true
      applyStablePlaybackDefaults()

      // 6. Start transcription if enabled
      if (transcriptionEnabled && transcriberRef.current) {
        transcriberRef.current.start()
      }

      window.dispatchEvent(new CustomEvent('organism:started', {
        detail: { quickStart: true, presetId, preset: preset.label },
      }))
      endPhase({
        presetId,
        bpm: preset.bpm,
        mode: preset.mode,
        state: stateMachine.getCurrentState().current,
      })
      orgLog('quickstart:applied', { presetId, bpm: preset.bpm, mode: preset.mode })
    } catch (err) {
      v2PlayerRef.current?.stop()
      setV2Status(ORGANISM_V2_INITIAL_STATUS)
      endPhase({ presetId, error: err instanceof Error ? err.message : String(err) })
      orgLog('quickstart:error', {
        presetId,
        error: err instanceof Error ? err.message : String(err),
      }, 'error')
      setError(err instanceof Error ? err.message : 'Quick start failed')
      setActivePresetId(null)
    }
    })()

    startInFlightRef.current = run
    try {
      await run
    } finally {
      if (startInFlightRef.current === run) {
        startInFlightRef.current = null
        setIsStarting(false)
      }
    }
  }, [transcriptionEnabled, scheduleSilentStartRecovery, applyStablePlaybackDefaults, seedSongRamp, waitForStartupParts])

  /**
   * Live preset swap — change the beat's genre + BPM without restarting.
   * If the organism isn't running yet, delegates to quickStart (cold path).
   * If already running, just relocks the physics mode, ramps BPM, and
   * regenerates patterns immediately. The beat never stops.
   */
  const swapPreset = useCallback(async (presetId: string) => {
    const preset = getQuickStartPreset(presetId)
    if (!preset) {
      setError(`Unknown preset: ${presetId}`)
      return
    }

    // Cold path — not running yet, full quickStart
    if (!isRunningRef.current) {
      await quickStart(presetId)
      return
    }

    // Hot path — live swap, no teardown
    const physics = physicsRef.current
    const orchestr = orchestrRef.current
    const stateMachine = stateMachRef.current
    if (!physics || !orchestr || !stateMachine) return

    const endSwap = orgPhase('swapPreset', 100)
    try {
      await Tone.start()
      physics.lockMode(preset.mode)
      orchestr.setBpm(preset.bpm)
      useStudioStore.getState().setBpm(preset.bpm)

      const syntheticPhysics = {
        ...preset.physics,
        timestamp: performance.now(),
        frameIndex: 0,
      }

      physics.processFrame({
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

      stateMachine.forceState(OState.Flow, syntheticPhysics)
      stateMachine.setStateFloor(OState.Breathing)
      if (preset.subGenre) {
        orchestr.forceSubGenre(preset.subGenre)
      }
      orchestr.primeFrame(syntheticPhysics, stateMachine.getCurrentState())
      await waitForStartupParts()
      await orchestr.start(preset.bpm, true)
      applyStablePlaybackDefaults()
      Tone.getDestination().volume.value = 0
      setV2Status({
        active:       true,
        presetId:     preset.id,
        kitBpm:       preset.bpm,
        targetBpm:    preset.bpm,
        playbackRate: 1,
        section:      'intro',
        bar:          0,
        cycleBars:    32,
        stems:        [],
      })
      setActivePresetId(presetId)
      endSwap({ presetId, bpm: preset.bpm, mode: preset.mode, subGenre: preset.subGenre })
    } catch (err) {
      endSwap({ presetId, error: err instanceof Error ? err.message : String(err) })
      setError(err instanceof Error ? err.message : 'Preset swap failed')
    }
  }, [quickStart, applyStablePlaybackDefaults, waitForStartupParts])

  /**
   * Natural Language Vibe Interpreter
   *
   * Takes a free-text description ("dark drill beat like Kendrick, fired up")
   * and applies matching beat parameters to the live organism.
   *
   * Resolution order:
   *   1. /api/organism/interpret-vibe (Ollama → Grok AI)
   *   2. ArtistReferenceBank.interpretVibeRuleBased (rule-based fallback)
   *
   * If the organism isn't running, it cold-starts on the closest preset
   * and then overrides with the interpreted params.
   */
  const interpretVibe = useCallback(async (text: string) => {
    let params: VibeParams | null = null

    // 1. Try server AI (Ollama → Grok fallback).
    // 4s timeout via AbortController — Ollama can hang on cold model load,
    // and we'd rather drop to the instant rule-based path than freeze the UI.
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 4000)
    try {
      const res = await fetch('/api/organism/interpret-vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      if (res.ok) {
        params = await res.json() as VibeParams
        orgLog('interpretVibe:ai', { text: text.slice(0, 60), interpretation: params.interpretation })
      }
    } catch {
      // Network error, abort, or timeout — fall through to rule-based
    } finally {
      clearTimeout(timeoutId)
    }

    // 2. Rule-based fallback
    if (!params) {
      params = interpretVibeRuleBased(text)
      orgLog('interpretVibe:ruleBased', { text: text.slice(0, 60), interpretation: params.interpretation })
    }

    // Update UI state so CommandCenter can show what was understood
    setVibeInterpretation({
      text,
      result: params.interpretation,
      confidence: params.confidence,
    })

    // Hot path: apply params to the running organism
    const mode = params.mode as OrganismMode

    // Cold start if not already running — pick closest preset by mode, then override
    if (!isRunningRef.current) {
      const closestPreset = QUICK_START_PRESETS.find(p => p.mode === mode) ?? QUICK_START_PRESETS[0]
      await quickStart(closestPreset.id)
      // Small delay to ensure engines have fully initialized before applying overrides
      await new Promise<void>(resolve => setTimeout(resolve, 200))
    }

    const physics = physicsRef.current
    const orchestr = orchestrRef.current
    if (physics && orchestr) {
      physics.lockMode(mode)
      orchestr.setBpm(params.bpm)
      useStudioStore.getState().setBpm(params.bpm)
      orchestr.forceSubGenre(params.subGenre as HipHopSubGenre)
      orchestr.regenerateAll()
      
      orgLog('interpretVibe:applied', {
        bpm: params.bpm, mode, subGenre: params.subGenre,
        confidence: params.confidence,
      })
    }
  }, [quickStart])

  /**
   * Count-In Start — plays a "1, 2, 3, 4" metronome at the preset BPM,
   * then drops the beat on the downbeat of bar 2 via quickStart.
   */
  const countInStart = useCallback(async (presetId: string) => {
    if (isRunningRef.current || startInFlightRef.current) return

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
    if (isRunningRef.current || startInFlightRef.current) return

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

  // Tracks whether startRecording owns the vocal mic stream (true) or is
  // reusing the AudioAnalysisEngine's stream (false). Controls whether
  // stopRecording stops the tracks at end-of-session.
  const ownsVocalStreamRef = useRef(false)

  const startRecording = useCallback(async () => {
    if (isRecording) return
    const endPhase = orgPhase('recording:start', 500)

    // If organism isn't running yet, start it first
    if (!isRunning) {
      await start()
    }

    recordingStartRef.current = Date.now()
    vocalChunksRef.current = []
    beatChunksRef.current = []

    // 1. Vocal recording — prefer to reuse the AudioAnalysisEngine's open mic
    //    stream so we avoid opening a third competing audio session (Windows
    //    drops one of the streams under contention, which makes the beat
    //    "just stop" mid-freestyle).
    try {
      let micStream: MediaStream | null = null
      const analyzerInput = inputRef.current as unknown as { getStream?: () => MediaStream | null }
      if (inputSource === 'mic' && typeof analyzerInput?.getStream === 'function') {
        micStream = analyzerInput.getStream() ?? null
      }

      if (micStream) {
        ownsVocalStreamRef.current = false  // shared — don't stop tracks in stopRecording
      } else {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        ownsVocalStreamRef.current = true
      }

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
      orgLog('recording:vocal-error', { error: String(err) }, 'warn')
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
      orgLog('recording:beat-error', { error: String(err) }, 'warn')
    }

    setIsRecording(true)
    endPhase({ inputSource, reusedMic: !ownsVocalStreamRef.current })
    orgLog('recording:started', { inputSource, reusedMic: !ownsVocalStreamRef.current })
    window.dispatchEvent(new CustomEvent('organism:recording-started'))
  }, [isRecording, isRunning, start, inputSource])

  const stopRecording = useCallback(async (): Promise<SavedSession | null> => {
    if (!isRecording) return null
    const endPhase = orgPhase('recording:stop', 700)

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
    // Release mic stream — but ONLY if startRecording opened it. When we
    // reuse the AudioAnalysisEngine's stream, stopping tracks here would
    // kill the organism's mic input too.
    if (ownsVocalStreamRef.current) {
      vocalStreamRef.current?.getTracks().forEach(t => t.stop())
    }
    vocalStreamRef.current = null
    vocalRecorderRef.current = null
    ownsVocalStreamRef.current = false

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
    endPhase({
      durationMs,
      sessionId,
      hasBeat: !!beatBlob,
      hasVocals: !!vocalBlob,
      hasMidi: !!midiBlob,
      hasLyrics: !!session.lyrics,
    })
    orgLog('recording:stopped', {
      durationMs,
      sessionId,
      hasBeat: !!beatBlob,
      hasVocals: !!vocalBlob,
      hasMidi: !!midiBlob,
      hasLyrics: !!session.lyrics,
    })
    window.dispatchEvent(new CustomEvent('organism:recording-stopped', { detail: session }))

    return session
  }, [])

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

        // ── Extended commands for Astutely brain integration ──────────────
        case 'lock-mode': {
          const mode = (detail as Record<string, unknown>).mode as OrganismMode | undefined
          if (mode && physicsRef.current) physicsRef.current.lockMode(mode)
          break
        }
        case 'unlock-mode':
          physicsRef.current?.unlockMode()
          break
        case 'set-bpm': {
          const bpm = (detail as Record<string, unknown>).bpm as number | undefined
          if (bpm && orchestrRef.current) {
            orchestrRef.current.setBpm(bpm)
            useStudioStore.getState().setBpm(bpm)
          }
          break
        }
        case 'force-state': {
          const targetState = (detail as Record<string, unknown>).state as string | undefined
          const physics = physicsRef.current?.getLastState?.()
          if (targetState && stateMachRef.current && physics) {
            const stateMap: Record<string, OState> = {
              dormant: OState.Dormant,
              awakening: OState.Awakening,
              breathing: OState.Breathing,
              flow: OState.Flow,
            }
            const mapped = stateMap[targetState.toLowerCase()]
            if (mapped !== undefined) stateMachRef.current.forceState(mapped, physics)
          }
          break
        }
        case 'set-generator-volume': {
          const { generator, volume } = detail as Record<string, unknown>
          const orch = orchestrRef.current
          if (!orch || typeof volume !== 'number') break
          const v = Math.max(0, Math.min(2, volume))
          if (generator === 'bass') {
            setBassVolumeState(v)
            orch.setBassVolumeMultiplier(v)
          } else if (generator === 'melody') {
            setMelodyVolumeState(v)
            orch.setMelodyVolumeMultiplier(v)
          } else if (generator === 'hatDensity') {
            setHatDensityState(v)
            orch.setHatDensityMultiplier(v)
          } else if (generator === 'kickVelocity') {
            setKickVelocityState(v)
            orch.setKickVelocityMultiplier(v)
          } else if (generator === 'texture') {
            orch.setTextureVolumeMultiplier(v)
          } else if (generator === 'chord') {
            orch.setChordVolumeMultiplier(v)
          }
          break
        }
        case 'set-texture-enabled': {
          const enabled = (detail as Record<string, unknown>).enabled as boolean | undefined
          if (typeof enabled === 'boolean' && orchestrRef.current) {
            orchestrRef.current.setTextureEnabled(enabled)
          }
          break
        }
        case 'set-melody-only': {
          const enabled = (detail as Record<string, unknown>).enabled as boolean | undefined
          if (typeof enabled === 'boolean' && orchestrRef.current) {
            setMelodyFocusEnabledState(enabled)
            orchestrRef.current.setMelodyOnly(enabled)
          }
          break
        }
        case 'set-chord-technique': {
          const { techniqueId } = detail as Record<string, unknown>
          if (typeof techniqueId === 'string' && orchestrRef.current) {
            orchestrRef.current.setChordTechnique(techniqueId)
          }
          break
        }
        case 'set-melody-articulation': {
          const { articulationId } = detail as Record<string, unknown>
          if (typeof articulationId === 'string' && orchestrRef.current) {
            orchestrRef.current.setMelodyArticulation(articulationId)
          }
          break
        }
        case 'improve-melody': {
          const orch = orchestrRef.current
          if (!orch) break
          const articulationId = (detail as Record<string, unknown>).articulationId
          if (typeof articulationId === 'string') {
            orch.setMelodyArticulation(articulationId)
          }
          orch.setMelodyVolumeMultiplier(Math.max(1, melodyVolumeRef.current) * 1.08)
          orch.regenerateMelody()
          window.dispatchEvent(new CustomEvent('organism:melody-improved', {
            detail: (window as unknown as { __organismSnapshot?: unknown }).__organismSnapshot ?? null,
          }))
          break
        }
        case 'set-bass-articulation': {
          const { articulationId } = detail as Record<string, unknown>
          if (typeof articulationId === 'string' && orchestrRef.current) {
            orchestrRef.current.setBassArticulation(articulationId)
          }
          break
        }
        case 'reset-melody-articulation-override': {
          if (orchestrRef.current) {
            orchestrRef.current.resetMelodyArticulationOverride()
          }
          break
        }
        case 'reset-bass-articulation-override': {
          if (orchestrRef.current) {
            orchestrRef.current.resetBassArticulationOverride()
          }
          break
        }
        case 'reset-chord-technique-override': {
          if (orchestrRef.current) {
            orchestrRef.current.resetChordTechniqueOverride()
          }
          break
        }
        case 'set-groove-locked': {
          const { locked } = detail as Record<string, unknown>
          if (typeof locked === 'boolean' && orchestrRef.current) {
            orchestrRef.current.setGrooveLocked(locked)
          }
          break
        }
        case 'set-style-shifts-enabled': {
          const { enabled } = detail as Record<string, unknown>
          if (typeof enabled === 'boolean' && reactiveRef.current) {
            reactiveRef.current.setStyleShiftsEnabled(enabled)
          }
          break
        }
      }
    }

    window.addEventListener('organism:command', handleCommand)
    return () => window.removeEventListener('organism:command', handleCommand)
  }, [start, stop, captureSession, downloadMidi, startRecording, stopRecording, quickStart])

  useEffect(() => {
    const handleListenNow = () => {
      selfListenRef.current?.captureNow()
    }
    window.addEventListener('organism:listen-now', handleListenNow)
    return () => window.removeEventListener('organism:listen-now', handleListenNow)
  }, [])

  // ── Voice Command Engine: TriggerWordDetector + VoiceCommandRouter ──
  // Initializes on mount, processes transcription text, routes detected
  // commands to quickStart / orchestrator actions.
  useEffect(() => {
    const detector = new TriggerWordDetector()
    const router = new VoiceCommandRouter()

    router.connect(detector)
    router.setHandler((action, event) => {
      if (action.type === 'quick-start') {
        quickStart(action.presetId)
        return
      }

      // On-the-fly commands — read live values from refs so this effect
      // never needs to be recreated when isRunning/volume changes.
      const orch = orchestrRef.current
      if (!orch || !isRunningRef.current) return

      // ── Ad-lib mood signals ─────────────────────────────────────────
      // Soft nudges from detected rapper phrases. Unlike commands, these
      // influence the MusicalDirector's energy + sub-genre preferences
      // rather than directly controlling instrument parameters.
      if (action.type === 'mood-signal') {
        const { mood } = action
        // Force sub-genre if the phrase strongly implies one
        if (mood.preferredSubGenre) {
          orch.forceSubGenre(mood.preferredSubGenre as HipHopSubGenre)
        }
        // Nudge energy via volume multipliers based on intent
        switch (mood.intent) {
          case 'hype':
          case 'aggro':
            // Boost drums + bass for energy, nudge hat density up
            orch.setHatDensityMultiplier(1.2 + mood.energy * 0.3)
            orch.setKickVelocityMultiplier(0.9 + mood.energy * 0.2)
            break
          case 'chill':
            // Pull back — reduce hat density, soften kick
            orch.setHatDensityMultiplier(0.5 + mood.energy * 0.3)
            orch.setKickVelocityMultiplier(0.7 + mood.energy * 0.2)
            break
          case 'transition':
            // Signal a pattern shuffle to keep things fresh
            orch.regenerateAll()
            break
          case 'vibing':
            // Rapper likes current beat — lock the groove (no-op: don't change anything)
            break
          case 'warmup': {
            // Warmup phrases carry instrumentFocus — spotlight specific
            // instruments so the beat "grows from" the rapper's entrance style.
            const focus = mood.instrumentFocus
            if (focus) {
              if (focus.bass     != null) orch.setBassVolumeMultiplier(focus.bass)
              if (focus.melody   != null) orch.setMelodyVolumeMultiplier(focus.melody)
              if (focus.hats     != null) orch.setHatDensityMultiplier(focus.hats)
              if (focus.kick     != null) orch.setKickVelocityMultiplier(focus.kick)
              if (focus.texture  != null) orch.setTextureVolumeMultiplier(focus.texture)
              if (focus.chord    != null) orch.setChordVolumeMultiplier(focus.chord)
              // Technique hint — overrides the mode default with an
              // instrument-specific playing style (guitar strum, piano roll,
              // strings pizzicato, etc.). Lets warmup phrases carry musical
              // intent beyond just loudness.
              if (focus.chordTechnique) {
                orch.setChordTechnique(focus.chordTechnique)
                console.debug(`🎸 Technique set: ${focus.chordTechnique}`)
              }
              // Articulations — single-note transforms for melody (flute/sax/lead)
              // and bass. Distinct from chord techniques because these generators
              // play one note at a time, not a full chord.
              if (focus.melodyArticulation) {
                orch.setMelodyArticulation(focus.melodyArticulation)
                console.debug(`🎺 Melody articulation: ${focus.melodyArticulation}`)
              }
              if (focus.bassArticulation) {
                orch.setBassArticulation(focus.bassArticulation)
                console.debug(`🎸 Bass articulation: ${focus.bassArticulation}`)
              }
              console.debug('🎛️ Warmup instrument focus applied:', focus)
            }
            break
          }
          case 'adlib':
            // Slight energy nudge — rapper is engaged but not commanding
            break
        }
        console.debug(`🎤 Ad-lib: "${event.matchedPhrase}" → ${mood.intent} (energy: ${mood.energy.toFixed(2)})`)
        return
      }

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
  const isRecordingRef = useRef(isRecording)
  const dropDetectorEnabledRef = useRef(dropDetectorEnabled)
  melodyVolumeRef.current = melodyVolume
  bassVolumeRef.current = bassVolume
  callResponseEnabledRef.current = callResponseEnabled
  isRunningRef.current = isRunning
  isRecordingRef.current = isRecording
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

  // ── Freestyle Lock ──
  //
  // While the user is recording a freestyle, two things must be guaranteed:
  //   1. The beat does NOT fade during rapper pauses. Normally physics
  //      collapses when RMS drops → StateMachine regresses toward Breathing
  //      / Awakening / Dormant → DrumGenerator applies a volume multiplier
  //      of 0–0.5 → the beat gets quiet or disappears.
  //   2. The arrangement cycler does NOT dip. The built-in 28-bar
  //      breakdown + outro sections drop drums to 0.5–0.6× for several bars
  //      each minute, which during a freestyle feels like the beat stopped.
  //
  // This effect pins the StateMachine to a minimum of Flow (so regressions
  // are ignored) and disables the arrangement cycler for the duration of
  // the recording. Both constraints lift the moment recording stops.
  useEffect(() => {
    const machine = stateMachRef.current
    const orchestr = orchestrRef.current
    if (!machine || !orchestr) return

    if (isRecording) {
      orgLog('recording:lock-engaged', {
        arrangementEnabled: orchestr.isArrangementEnabled(),
        floor: OState.Flow,
      })
      // Force up to Flow immediately so drums/bass/melody are at full level.
      const physics = physicsRef.current?.getLastState()
      if (physics) {
        machine.forceState(OState.Awakening, physics)
        machine.forceState(OState.Breathing, physics)
        machine.forceState(OState.Flow, physics)
      }
      machine.setStateFloor(OState.Flow)
      applyStablePlaybackDefaults()
      orchestr.setArrangementEnabled(false)
    } else {
      machine.setStateFloor(null)
      orchestr.setGrooveLocked(false)
      orchestr.setArrangementEnabled(true)
      orgLog('recording:lock-released', {
        arrangementEnabled: orchestr.isArrangementEnabled(),
        floor: null,
      })
    }
  }, [isRecording, applyStablePlaybackDefaults])

  useEffect(() => startOrgHeartbeat(() => {
    const physics = physicsRef.current?.getLastState()
    const organism = stateMachRef.current?.getCurrentState()
    const musical = orchestrRef.current?.getMusicalState()
    const now = performance.now()

    const toneCtx   = Tone.getContext()
    const transport = Tone.getTransport()
    const dest      = Tone.getDestination()
    return {
      running: isRunningRef.current,
      recording: isRecordingRef.current,
      input: inputSource,
      preset: activePresetId,
      bpm: orchestrRef.current?.getBpm(),
      state: organism?.current,
      stateFloor: stateMachRef.current?.getStateFloor(),
      stateMs: organism ? Math.round(organism.msInState) : null,
      frameAgeMs: physics ? Math.round(now - physics.timestamp) : null,
      mode: physics?.mode,
      bounce: physics?.bounce !== undefined ? Number(physics.bounce.toFixed(2)) : undefined,
      density: physics?.density !== undefined ? Number(physics.density.toFixed(2)) : undefined,
      presence: physics?.presence !== undefined ? Number(physics.presence.toFixed(2)) : undefined,
      voiceActive: physics?.voiceActive,
      section: musical?.section,
      sectionBar: musical?.sectionBar,
      subGenre: musical?.subGenre,
      drumFill: musical?.drums.fillRequested,
      drumDropout: musical?.drums.dropout,
      melodyDropout: musical?.melody.dropout,
      // Audio system diagnostics — key for silence debugging
      ctxState: toneCtx.state,
      transportState: transport.state,
      destVol: Number(dest.volume.value.toFixed(1)),
    }
  }), [activePresetId, inputSource])

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
            const next = prev <= 1 ? 0 : prev - 1
            try { window.localStorage.setItem(GUEST_STORAGE_KEY, String(60 - next)) } catch {}
            if (next === 0) setIsGuestNudgeVisible(true)
            return next
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

  const isGuestLocked = isGuest && guestSecondsRemaining === 0

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
    if (startInFlightRef.current) return

    // Stop current session before switching
    inputRef.current?.stop()
    orchestrRef.current?.stop()
    setIsRunning(false)

    if (type === 'audioFile' && file) {
      audioFileRef.current = file
    }

    // Eagerly create the new input so start() can use it immediately.
    // Child useEffects (e.g. GuestTrialBanner's voiceTrialPending) call start()
    // before the parent's input-source effect fires. Without this eager swap,
    // start() would use the old stale input and the mic would never open.
    inputRef.current = createInputSource(type, audioFileRef.current, autoEnergy)

    setInputSourceType(type)
  }, [autoEnergy])

  // ── Context value ─────────────────────────────────────────────────

  // Physics context — separate memo so it only invalidates consumers that
  // actually need high-frequency physics data (Visualizer, ModeIndicator).
  const physicsValue = useMemo<OrganismPhysicsContextValue>(() => ({
    physicsState,
    organismState,
    meterReading,
  }), [physicsState, organismState, meterReading])

  useEffect(() => {
    const output = orchestrRef.current?.getOutput()
    const snapshot = {
      running: isRunning,
      starting: isStarting,
      inputSource,
      activePresetId,
      bpm: orchestrRef.current?.getBpm() ?? useStudioStore.getState().bpm,
      physics: physicsState ? {
        mode: physicsState.mode,
        pulse: physicsState.pulse,
        bounce: physicsState.bounce,
        swing: physicsState.swing,
        pocket: physicsState.pocket,
        presence: physicsState.presence,
        density: physicsState.density,
        voiceActive: physicsState.voiceActive,
      } : null,
      organism: organismState ? {
        state: organismState.current,
        flowDepth: organismState.flowDepth,
      } : null,
      levels: meterReading ? {
        masterRmsDb: meterReading.masterRmsDb,
        channels: Object.fromEntries(
          Object.entries(meterReading.channels).map(([name, ch]) => [name, ch.rmsDb])
        ),
      } : null,
      selfListen: selfListenReport ? {
        summary: selfListenReport.summary,
        rmsDb: selfListenReport.rmsDb,
        peakDb: selfListenReport.peakDb,
        clippingPercent: selfListenReport.clippingPercent,
        spectralCentroidHz: selfListenReport.spectralCentroidHz,
        estimatedBpm: selfListenReport.estimatedBpm,
        onsetCount: selfListenReport.onsetCount,
        onsetTimingStdDevMs: selfListenReport.onsetTimingStdDevMs,
        bandEnergy: selfListenReport.bandEnergy,
        isSilent: selfListenReport.isSilent,
      } : null,
      generators: output ? {
        drum: output.drum.activityLevel,
        bass: output.bass.activityLevel,
        melody: output.melody.activityLevel,
        chord: output.chord.activityLevel,
        texture: output.texture.activityLevel,
      } : null,
      transcription: transcription ? {
        supported: transcription.isSupported,
        enabled: transcriptionEnabled,
        lineCount: transcription.lines.length,
        latestLine: transcription.lines[transcription.lines.length - 1]?.text ?? null,
      } : null,
      updatedAt: Date.now(),
    }
    ;(window as unknown as { __organismSnapshot?: typeof snapshot }).__organismSnapshot = snapshot
    window.dispatchEvent(new CustomEvent('organism:snapshot', { detail: snapshot }))
  }, [
    isRunning,
    isStarting,
    inputSource,
    activePresetId,
    physicsState,
    organismState,
    meterReading,
    selfListenReport,
    transcription,
    transcriptionEnabled,
  ])

  const setOrganismInstrument = useCallback((
    role: OrganismInstrumentRole,
    instrumentId: InstrumentPerformerId | null,
  ) => {
    setInstrumentAssignments(prev => {
      if (prev[role] === instrumentId) return prev
      return { ...prev, [role]: instrumentId }
    })
    orchestrRef.current?.setInstrumentPerformer(role, instrumentId)
  }, [])

  const setV2MasterGain = useCallback((value: number) => {
    v2PlayerRef.current?.setMasterGain(value)
  }, [])

  const value: OrganismContextValue = useMemo(() => ({
    analysisEngine:    inputSource === 'mic' && inputRef.current && 'getStream' in inputRef.current
      ? inputRef.current as unknown as AudioAnalysisEngine
      : null,
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
    swapPreset,
    quickStartPresets: QUICK_START_PRESETS,
    activePresetId,
    v2Status,
    setV2MasterGain,

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
    micMonitoringEnabled,
    setMicMonitoringEnabled,
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
    setGrooveLocked: (locked: boolean) => {
      orchestrRef.current?.setGrooveLocked(locked)
    },
    toggleStoryMode: () => {
      // Audit 2026-04-30: consolidated from three near-identical copies
      // (OrganismCommandCenter, FloatingAudioMonitor).
      // Reads the latest isPatternLocked from the React state setter form
      // so it can't drift in stale closures held by event handlers.
      setIsPatternLocked(prev => {
        const next = !prev
        if (next) {
          orchestrRef.current?.lockDrumPattern()
          orchestrRef.current?.setGrooveLocked(true)
        } else {
          orchestrRef.current?.unlockDrumPattern()
          orchestrRef.current?.setGrooveLocked(false)
        }
        return next
      })
    },

    // Tweak controls
    hatDensity,
    kickVelocity,
    drumsVolume,
    bassVolume,
    melodyVolume,
    chordVolume,
    melodyFocusEnabled,
    setHatDensity: (v: number) => {
      setHatDensityState(v)
      orchestrRef.current?.setHatDensityMultiplier(v)
    },
    setKickVelocity: (v: number) => {
      setKickVelocityState(v)
      orchestrRef.current?.setKickVelocityMultiplier(v)
    },
    setDrumsVolume: (v: number) => {
      setDrumsVolumeState(v)
      // Convert 0-2 multiplier to dB offset from the default drum channel gain (0 dB)
      const db = v <= 0 ? -60 : 20 * Math.log10(v)
      mixRef.current?.setChannelGainDb('drum', db)
    },
    setBassVolume: (v: number) => {
      setBassVolumeState(v)
      orchestrRef.current?.setBassVolumeMultiplier(v)
    },
    setMelodyVolume: (v: number) => {
      setMelodyVolumeState(v)
      orchestrRef.current?.setMelodyVolumeMultiplier(v)
    },
    setChordVolume: (v: number) => {
      setChordVolumeState(v)
      // -5 dB is the chord channel default; this offsets from that baseline
      mixRef.current?.setChannelGainDb('chord', -5 + 20 * Math.log10(Math.max(0.001, v)))
    },
    setMelodyFocusEnabled: (enabled: boolean) => {
      setMelodyFocusEnabledState(enabled)
      orchestrRef.current?.setMelodyOnly(enabled)
    },

    // Texture toggle
    textureEnabled,
    setTextureEnabled: (enabled: boolean) => {
      setTextureEnabledState(enabled)
      orchestrRef.current?.setTextureEnabled(enabled)
    },

    // Instrument picker
    instrumentAssignments,
    setOrganismInstrument,

    // Guest experience
    guestSecondsRemaining,
    isGuestNudgeVisible,
    isGuestLocked,
    dismissGuestNudge,

    // Session sharing
    shareSession,
    isSharingSession,
    lastSharedPostUrl,

    isRunning,
    isStarting,
    isCapturing,
    error,

    // Ears system
    performerState,
    selfListenReport,

    // Natural Language Vibe Interpreter
    interpretVibe,
    vibeInterpretation,
    wowMoment,
    clearWowMomentLog,
  }), [
    lastSessionDNA,
    start, stop, captureSession, downloadMidi,
    quickStart, swapPreset, activePresetId, v2Status, setV2MasterGain,
    countInStart, countInBeat,
    soundTriggerArmed, armSoundTrigger, disarmSoundTrigger,
    cadenceLockEnabled, cadenceSnapshot,
    callResponseEnabled, callResponsePhase,
    dropDetectorEnabled, lastDropIntensity,
    vibeMatchEnabled, currentVibe,
    lastReport, generateReport,
    inputSource, inputSourceRevision, handleSetInputSource, autoEnergy, micMonitoringEnabled,
    transcription, transcriptionEnabled,
    isRecording, startRecording, stopRecording,
    lastSavedSession, savedSessions, downloadSession,
    latchMode, isPatternLocked,
    hatDensity, kickVelocity, drumsVolume, bassVolume, melodyVolume, chordVolume, melodyFocusEnabled, textureEnabled,
    instrumentAssignments, setOrganismInstrument,
    guestSecondsRemaining, isGuestNudgeVisible, isGuestLocked, dismissGuestNudge,
    shareSession, isSharingSession, lastSharedPostUrl,
    isRunning, isStarting, isCapturing, error,
    performerState, selfListenReport,
    interpretVibe, vibeInterpretation,
    wowMoment, clearWowMomentLog,
  ])

  return (
    <OrganismContext.Provider value={value}>
      <OrganismPhysicsContext.Provider value={physicsValue}>
        {children}
      </OrganismPhysicsContext.Provider>
    </OrganismContext.Provider>
  )
}
