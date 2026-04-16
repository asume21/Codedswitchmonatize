import type { PhysicsState } from '../physics/types'

export enum OState {
  Dormant    = 'DORMANT',
  Awakening  = 'AWAKENING',
  Breathing  = 'BREATHING',
  Flow       = 'FLOW',
}

export enum OTransition {
  DormantToAwakening   = 'DORMANT_TO_AWAKENING',
  AwakeningToBreathing = 'AWAKENING_TO_BREATHING',
  BreathingToFlow      = 'BREATHING_TO_FLOW',

  FlowToBreathing      = 'FLOW_TO_BREATHING',
  BreathingToAwakening = 'BREATHING_TO_AWAKENING',
  BreathingToDormant   = 'BREATHING_TO_DORMANT',
  AwakeningToDormant   = 'AWAKENING_TO_DORMANT',
  FlowToDormant        = 'FLOW_TO_DORMANT',
}

export interface TransitionEvent {
  from:            OState
  to:              OState
  transition:      OTransition
  timestamp:       number
  physicsSnapshot: PhysicsState
}

export interface OrganismState {
  current:             OState
  previous:            OState | null
  framesInState:       number
  msInState:           number
  barsInState:         number

  awakeningProgress:    number
  breathingWarmth:      number
  flowDepth:           number

  syllabicDensity:     number
  cadenceLockBars:     number
  cadenceLockAchieved: boolean

  silenceDurationMs:   number

  lastTransitionPhysics: PhysicsState | null

  timestamp:  number
  frameIndex: number
}

export interface StateMachineConfig {
  voiceOnsetRmsThreshold:   number
  pulseConfidenceThreshold:  number
  syllabicDensityThreshold: number
  cadenceLockBarsRequired:  number

  awakeningToSilenceMs:     number
  breathingToAwakeningMs:   number
  breathingToDormantMs:     number
  flowToBreathingMs:        number
  flowToDormantMs:          number

  awakeningMinBars:  number
  awakeningMaxBars:  number

  syllabicDensityWindowBars: number

  /** When > 0, Breathing promotes to Flow after this many bars even without
   *  cadence lock. Used by auto-generate mode where there is no real voice. */
  autoBreathingToFlowBars: number
}

export const DEFAULT_STATE_MACHINE_CONFIG: StateMachineConfig = {
  voiceOnsetRmsThreshold:   0.015,
  pulseConfidenceThreshold:  0.35,
  syllabicDensityThreshold: 1.0,
  cadenceLockBarsRequired:  1.2,
  awakeningToSilenceMs:     12000,
  breathingToAwakeningMs:   6000,
  breathingToDormantMs:     45000,
  flowToBreathingMs:        10000,
  flowToDormantMs:          45000,
  // Startup should become musical almost immediately in auto-generate mode.
  // Keeping Awakening under half a bar avoids the long "nothing happens"
  // window before the organism reaches Breathing/Flow.
  awakeningMinBars:         0.25,
  awakeningMaxBars:         0.5,
  syllabicDensityWindowBars: 3,
  // Promote quickly when there is no real voice input to lock onto.
  autoBreathingToFlowBars: 0.5,
}

export type OrganismStateCallback    = (state: OrganismState)    => void
export type TransitionEventCallback  = (event: TransitionEvent)  => void
