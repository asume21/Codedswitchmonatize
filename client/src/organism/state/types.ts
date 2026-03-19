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
}

export const DEFAULT_STATE_MACHINE_CONFIG: StateMachineConfig = {
  voiceOnsetRmsThreshold:   0.02,
  pulseConfidenceThreshold:  0.4,
  syllabicDensityThreshold: 1.5,
  cadenceLockBarsRequired:  2,
  awakeningToSilenceMs:     8000,
  breathingToAwakeningMs:   4000,
  breathingToDormantMs:     30000,
  flowToBreathingMs:        4000,
  flowToDormantMs:          30000,
  awakeningMinBars:         2,
  awakeningMaxBars:         4,
  syllabicDensityWindowBars: 2,
}

export type OrganismStateCallback    = (state: OrganismState)    => void
export type TransitionEventCallback  = (event: TransitionEvent)  => void
