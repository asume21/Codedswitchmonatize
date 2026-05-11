import { createContext, useContext } from 'react'
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
import type { OrganismV2Status } from '../../organism/v2/OrganismV2LoopPlayer'

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
  quickStartPresets:  QuickStartPreset[]
  activePresetId:     string | null
  v2Status:           OrganismV2Status
  setV2MasterGain:    (value: number) => void

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
  startRecording:    () => Promise<void>
  stopRecording:     () => Promise<SavedSession | null>
  lastSavedSession:  SavedSession | null
  savedSessions:     SavedSession[]
  downloadSession:   (session: SavedSession) => void

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
  melodyFocusEnabled: boolean
  setHatDensity:      (v: number) => void
  setKickVelocity:    (v: number) => void
  setDrumsVolume:     (v: number) => void
  setBassVolume:      (v: number) => void
  setMelodyVolume:    (v: number) => void
  setChordVolume:     (v: number) => void
  setMelodyFocusEnabled: (enabled: boolean) => void

  // Texture toggle — off by default for hip-hop; enable for ambient/lo-fi genres
  textureEnabled:     boolean
  setTextureEnabled:  (enabled: boolean) => void

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
