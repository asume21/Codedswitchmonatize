import { createContext, useContext, type RefObject } from 'react'
import type { AudioAnalysisEngine }    from '../../organism/analysis/AudioAnalysisEngine'
import type { PhysicsEngine }          from '../../organism/physics/PhysicsEngine'
import type { StateMachine }           from '../../organism/state/StateMachine'
import type { GeneratorOrchestrator }  from '../../organism/generators/GeneratorOrchestrator'
import type { ReactiveBehaviorEngine } from '../../organism/reactive/ReactiveBehaviorEngine'
import type { MixEngine }              from '../../organism/mix/MixEngine'
import type { CaptureEngine }          from '../../organism/session/CaptureEngine'
import type { PhysicsState }           from '../../organism/physics/types'
import type { OrganismState }          from '../../organism/state/types'
import type { MixMeterReading }        from '../../organism/mix/types'
import type { SessionDNA }             from '../../organism/session/types'
import type { InputSourceType }        from '../../organism/input/types'
import type { TranscriptionState }     from './FreestyleTranscriber'
import type { QuickStartPreset }       from './QuickStartPresets'
import type { CadenceSnapshot }        from './CadenceLock'
import type { CallResponsePhase }      from './CallResponseEngine'
import type { VibeClassification }     from './VibeMatcher'
import type { FreestyleReport }        from './FreestyleReportCard'
import type { PerformerState }        from '../../organism/audio/types'
import type { SelfListenReport }      from '../../organism/audio/types'
import type { InstrumentPerformerId } from '../../organism/performers'
import type { TriggerWordDetector } from './TriggerWordDetector'

// Live "Generator" status shown in the Organism panel. (Formerly defined in the
// removed OrganismV2LoopPlayer fossil — kept here as the status display still
// renders preset/section/bpm even though that player no longer exists.)
export interface OrganismV2Stem {
  id: string
  label: string
  url: string
  gain: number
}
export interface OrganismV2Status {
  active: boolean
  presetId: string | null
  kitBpm: number | null
  targetBpm: number | null
  playbackRate: number
  section: string | null
  bar: number
  cycleBars: number
  stems: OrganismV2Stem[]
}

/**
 * High-frequency physics context — updates at ~15fps as the organism runs.
 * Kept separate so components that only need controls/callbacks are not
 * re-rendered on every physics tick.
 */
export interface OrganismPhysicsContextValue {
  physicsState:  PhysicsState  | null
  organismState: OrganismState | null
  meterReading:  MixMeterReading | null
}

/** Saved session bundle — everything captured from a freestyle */
export interface SavedSession {
  sessionId:    string
  createdAt:    number
  durationMs:   number
  dna:          SessionDNA | null
  midiBlob:     Blob | null
  beatBlob:     Blob | null      // master bus audio (webm)
  vocalBlob:    Blob | null      // raw mic recording (webm)
  lyrics:       string | null
}

export type OrganismInstrumentRole = 'lead' | 'bass' | 'chord'

export interface OrganismInstrumentAssignments {
  lead:  InstrumentPerformerId | null
  bass:  InstrumentPerformerId | null
  chord: InstrumentPerformerId | null
}

export interface WowMomentLogEntry {
  id: number
  timestamp: number
  text: string
  tone: 'info' | 'pulse' | 'sync' | 'wake'
}

export interface WowMomentState {
  logs: WowMomentLogEntry[]
  engines: {
    drums: boolean
    bass: boolean
    harmony: boolean
  }
  phraseActive: boolean
  lastPulse: 'kick' | 'snare' | 'hat' | null
  capturedOnsets: number
  syncBpm: number | null
}

export interface OrganismContextValue {
  // Engines (null until initialized)
  analysisEngine:    AudioAnalysisEngine    | null
  physicsEngine:     PhysicsEngine          | null
  stateMachine:      StateMachine           | null
  orchestrator:      GeneratorOrchestrator  | null
  reactiveBehaviors: ReactiveBehaviorEngine | null
  mixEngine:         MixEngine              | null
  captureEngine:     CaptureEngine          | null

  // Session DNA (updated when a session is captured)
  lastSessionDNA: SessionDNA | null

  // Actions
  start:       () => Promise<void>
  stop:        () => void
  capture:     () => Promise<SessionDNA | null>
  downloadMidi: () => void

  // Quick Start — skip cold start, instant beat
  quickStart:         (presetId: string) => Promise<void>
  /** Live-swap the active preset without tearing down engines (starts cold if not running). */
  swapPreset:         (presetId: string) => Promise<void>
  /** Start a curated "Real Beat" preset tuned for the given sub-genre. */
  startRealBeat:      (subGenre: 'trap' | 'boom-bap' | 'drill') => Promise<void>
  quickStartPresets:  QuickStartPreset[]
  activePresetId:     string | null
  v2Status:           OrganismV2Status
  setV2MasterGain:    (value: number) => void
  /** -1 (dark/warm) .. 0 (neutral) .. 1 (bright) master tone tilt. */
  setMasterBrightness: (value: number) => void

  // Count-In Start — "1, 2, 3, 4" then beat drops
  countInStart:       (presetId: string) => Promise<void>
  countInBeat:        number | null    // current beat during count-in (1-4), null when inactive

  // Sound Trigger Start — any loud sound triggers the beat
  soundTriggerArmed:      boolean
  armSoundTrigger:        (presetId: string) => void
  disarmSoundTrigger:     () => void

  // Cadence Lock — beat syncs to your flow
  cadenceLockEnabled:    boolean
  setCadenceLockEnabled: (enabled: boolean) => void
  cadenceSnapshot:       CadenceSnapshot | null

  // Call & Response — melody answers your bars
  callResponseEnabled:    boolean
  setCallResponseEnabled: (enabled: boolean) => void
  callResponsePhase:      CallResponsePhase

  // Drop Detector — audio-based beat drops
  dropDetectorEnabled:    boolean
  setDropDetectorEnabled: (enabled: boolean) => void
  lastDropIntensity:      number | null

  // Vibe Match — genre labels + mode announcements
  vibeMatchEnabled:       boolean
  setVibeMatchEnabled:    (enabled: boolean) => void
  currentVibe:            VibeClassification | null

  // Freestyle Report Card — session stats
  lastReport:             FreestyleReport | null
  generateReport:         () => FreestyleReport | null

  // Input source
  inputSource:       InputSourceType
  setInputSource:    (type: InputSourceType, file?: File) => void
  autoEnergy:        'chill' | 'medium' | 'intense'
  setAutoEnergy:     (energy: 'chill' | 'medium' | 'intense') => void
  micMonitoringEnabled: boolean
  setMicMonitoringEnabled: (enabled: boolean) => void

  // Transcription
  transcription:         TranscriptionState | null
  transcriptionEnabled:  boolean
  setTranscriptionEnabled: (enabled: boolean) => void
  copyLyrics:            () => Promise<boolean>
  exportLyrics:          () => void

  // Recording — captures everything for permanent save
  isRecording:       boolean
  startRecording:    (externalMicStream?: MediaStream) => Promise<void>
  stopRecording:     () => Promise<SavedSession | null>
  lastSavedSession:  SavedSession | null
  savedSessions:     SavedSession[]
  downloadSession:   (session: SavedSession) => void

  // Multi-take producer workflow
  currentBpm:            number
  isProgressionLocked:   boolean
  lockChordProgression:  () => void
  unlockChordProgression: () => void
  /** Record for exactly N bars then auto-stop. Resolves with the session when done. */
  recordForBars:         (bars: number, label?: string) => Promise<SavedSession | null>
  /** Cancel an in-progress recordForBars take early, finalises and emits the session. */
  cancelTakeRecording:   () => void
  recordingBarsTotal:    number | null   // null when not in timed-record mode
  recordingBarsElapsed:  number          // counts up while recording

  // Latch mode — keeps organism alive when MIDI keys are released
  latchMode:    boolean
  setLatchMode: (enabled: boolean) => void

  // Pattern lock / Story Mode — freeze the current drum groove so it loops unchanged
  isPatternLocked:  boolean
  lockPattern:      () => void
  unlockPattern:    () => void
  setGrooveLocked:  (locked: boolean) => void
  // Story Mode toggle: combined unlock+groove-unlock or lock+groove-lock.
  // Use this from UI rather than calling lock/unlock + setGrooveLocked
  // separately (the audit flagged three near-identical copies of this logic).
  toggleStoryMode:  () => void

  // Tweak controls (active even when locked)
  hatDensity:         number   // 0–2, default 1
  kickVelocity:       number   // 0–2, default 1
  drumsVolume:        number   // 0–2, default 1
  bassVolume:         number   // 0–2, default 1
  melodyVolume:       number   // 0–2, default 1
  chordVolume:        number   // 0–2, default 1
  textureVolume:      number   // 0–2, default 1
  melodyFocusEnabled: boolean
  setHatDensity:      (v: number) => void
  setKickVelocity:    (v: number) => void
  setDrumsVolume:     (v: number) => void
  setBassVolume:      (v: number) => void
  setMelodyVolume:    (v: number) => void
  setChordVolume:     (v: number) => void
  setTextureVolume:   (v: number) => void
  setMelodyFocusEnabled: (enabled: boolean) => void

  // Texture toggle — off by default for hip-hop; enable for ambient/lo-fi genres
  textureEnabled:     boolean
  setTextureEnabled:  (enabled: boolean) => void

  // Switches-not-modes: the Organism is a steady beat machine by default;
  // everything "smart" is an explicit opt-in toggle (all OFF by default).
  // React to Voice gates the WHOLE reactive stack (ducking, pause-fills,
  // energy mirroring, style shifts); Song Mode gates arrangement sections
  // (intro/build/drop) + composer plans.
  reactToVoiceEnabled:    boolean
  setReactToVoiceEnabled: (enabled: boolean) => void
  songModeEnabled:        boolean
  setSongModeEnabled:     (enabled: boolean) => void
  loopsModeEnabled:       boolean
  setLoopsModeEnabled:    (enabled: boolean) => void
  isLoopsLoading:         boolean

  // Instrument picker — null means Auto, otherwise locks that generator role.
  instrumentAssignments: OrganismInstrumentAssignments
  setOrganismInstrument: (role: OrganismInstrumentRole, instrumentId: InstrumentPerformerId | null) => void

  // Guest experience
  guestSecondsRemaining: number      // 60→0 countdown while guest is playing
  isGuestNudgeVisible:   boolean     // true once countdown hits 0
  isGuestLocked:         boolean     // guest && countdown expired — gate all controls
  dismissGuestNudge:     () => void

  // Session sharing
  shareSession:       (caption: string) => Promise<{ postUrl: string } | null>
  isSharingSession:   boolean
  lastSharedPostUrl:  string | null

  // ACE Hybrid Stems Mode
  aceHybridMode:      import('./AceHybridController').AceHybridMode
  setAceHybridMode:   (mode: import('./AceHybridController').AceHybridMode) => void
  aceStemsLoading:    boolean

  // Status
  isRunning:    boolean
  isStarting:   boolean
  isCapturing:  boolean
  error:        string | null

  // Ears system — Astutely hears the performer + itself
  /** Real-time analysis of the human performer's mic input. Null when not on mic. */
  performerState:   PerformerState   | null
  /** Periodic self-analysis of Astutely's own audio output. */
  selfListenReport: SelfListenReport | null

  // Natural Language Vibe Interpreter
  /** Interpret a free-text vibe description and apply it to the organism. */
  interpretVibe:      (text: string) => Promise<void>
  /** Last interpretation result — null until first voice command. */
  vibeInterpretation: { text: string; result: string; confidence: number } | null

  /**
   * Direct ref to the running TriggerWordDetector. UI input handlers can call
   * `triggerDetectorRef.current?.processText(text)` to feed typed prompts
   * through the same trigger pipeline that voice transcription uses, so
   * emotional-intent / mood-signal phrases land on the orchestrator before
   * any downstream vibe-interpret or network call.
   */
  triggerDetectorRef: RefObject<TriggerWordDetector | null>

  // WOW moment — theatrical layer over existing mic/onset/generator plumbing.
  wowMoment: WowMomentState
  clearWowMomentLog: () => void
}

const OrganismContext = createContext<OrganismContextValue | null>(null)

const OrganismPhysicsContext = createContext<OrganismPhysicsContextValue>({
  physicsState:  null,
  organismState: null,
  meterReading:  null,
})

export function useOrganism(): OrganismContextValue {
  const ctx = useContext(OrganismContext)
  if (!ctx) throw new Error('useOrganism must be used inside OrganismProvider')
  return ctx
}

/** Subscribe only to high-frequency physics/meter/state updates (~15fps). */
export function useOrganismPhysics(): OrganismPhysicsContextValue {
  return useContext(OrganismPhysicsContext)
}

export { OrganismContext, OrganismPhysicsContext }
