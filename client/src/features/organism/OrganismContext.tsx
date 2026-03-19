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
