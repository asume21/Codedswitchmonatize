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

export interface OrganismContextValue {
  // Engines (null until initialized)
  analysisEngine:    AudioAnalysisEngine    | null
  physicsEngine:     PhysicsEngine          | null
  stateMachine:      StateMachine           | null
  orchestrator:      GeneratorOrchestrator  | null
  reactiveBehaviors: ReactiveBehaviorEngine | null
  mixEngine:         MixEngine              | null
  captureEngine:     CaptureEngine          | null

  // Live state (updated via subscriptions)
  physicsState:   PhysicsState    | null
  organismState:  OrganismState   | null
  meterReading:   MixMeterReading | null
  lastSessionDNA: SessionDNA      | null

  // Actions
  start:       () => Promise<void>
  stop:        () => void
  capture:     () => Promise<SessionDNA | null>
  downloadMidi: () => void

  // Input source
  inputSource:       InputSourceType
  setInputSource:    (type: InputSourceType, file?: File) => void
  autoEnergy:        'chill' | 'medium' | 'intense'
  setAutoEnergy:     (energy: 'chill' | 'medium' | 'intense') => void

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

  // Pattern lock — freeze the current drum groove so it loops unchanged
  isPatternLocked:  boolean
  lockPattern:      () => void
  unlockPattern:    () => void

  // Tweak controls (active even when locked)
  hatDensity:         number   // 0–2, default 1
  kickVelocity:       number   // 0–2, default 1
  bassVolume:         number   // 0–2, default 1
  melodyVolume:       number   // 0–2, default 1
  setHatDensity:      (v: number) => void
  setKickVelocity:    (v: number) => void
  setBassVolume:      (v: number) => void
  setMelodyVolume:    (v: number) => void

  // Status
  isRunning:    boolean
  isCapturing:  boolean
  error:        string | null
}

const OrganismContext = createContext<OrganismContextValue | null>(null)

export function useOrganism(): OrganismContextValue {
  const ctx = useContext(OrganismContext)
  if (!ctx) throw new Error('useOrganism must be used inside OrganismProvider')
  return ctx
}

export { OrganismContext }
