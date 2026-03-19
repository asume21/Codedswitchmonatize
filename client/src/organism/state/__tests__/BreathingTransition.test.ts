import { describe, expect, it } from 'vitest'
import { evaluateBreathingTransition } from '../transitions/BreathingTransition'
import { OState, OTransition, type OrganismState } from '../types'
import type { PhysicsState } from '../../physics/types'
import { OrganismMode } from '../../physics/types'

const createState = (overrides: Partial<OrganismState>): OrganismState => ({
  current: OState.Breathing,
  previous: OState.Awakening,
  framesInState: 0,
  msInState: 0,
  barsInState: 0,
  awakeningProgress: 0,
  breathingWarmth: 0.8,
  flowDepth: 0,
  syllabicDensity: 0,
  cadenceLockBars: 0,
  cadenceLockAchieved: false,
  silenceDurationMs: 0,
  lastTransitionPhysics: null,
  timestamp: 0,
  frameIndex: 0,
  ...overrides,
})

const config = {
  voiceOnsetRmsThreshold: 0.02,
  pulseConfidenceThreshold: 0.4,
  syllabicDensityThreshold: 1.5,
  cadenceLockBarsRequired: 2,
  awakeningToSilenceMs: 8000,
  breathingToAwakeningMs: 4000,
  breathingToDormantMs: 30000,
  flowToBreathingMs: 4000,
  flowToDormantMs: 30000,
  awakeningMinBars: 2,
  awakeningMaxBars: 4,
  syllabicDensityWindowBars: 2,
}

const basePhysics = (overrides: Partial<PhysicsState> = {}): PhysicsState => ({
  bounce: 0,
  swing: 0.5,
  pocket: 0,
  presence: 0,
  density: 0,
  mode: OrganismMode.Heat,
  pulse: 120,
  beatDurationMs: 500,
  sixteenthDurationMs: 125,
  swungSixteenthMs: 250,
  timestamp: 0,
  frameIndex: 0,
  voiceActive: false,
  ...overrides,
})

describe('BreathingTransition', () => {
  it('transitions to flow when density and cadence lock are above threshold', () => {
    const state = createState({ silenceDurationMs: 0, syllabicDensity: 2.0, cadenceLockBars: 2 })
    expect(evaluateBreathingTransition(state, basePhysics(), config)).toBe(OTransition.BreathingToFlow)
  })

  it('falls back to awakening after 4 seconds of silence', () => {
    const state = createState({ silenceDurationMs: 5000, syllabicDensity: 2.0, cadenceLockBars: 2 })
    expect(evaluateBreathingTransition(state, basePhysics(), config)).toBe(OTransition.BreathingToAwakening)
  })

  it('falls back to dormant after 30 seconds of silence', () => {
    const state = createState({ silenceDurationMs: 31000, syllabicDensity: 2.0, cadenceLockBars: 2 })
    expect(evaluateBreathingTransition(state, basePhysics(), config)).toBe(OTransition.BreathingToDormant)
  })

  it('stays breathing when density insufficient', () => {
    const state = createState({ silenceDurationMs: 0, syllabicDensity: 2.0, cadenceLockBars: 1 })
    expect(evaluateBreathingTransition(state, basePhysics(), config)).toBeNull()
  })

  it('lets silence timeout win over cadence lock', () => {
    const state = createState({ silenceDurationMs: 5000, syllabicDensity: 2.0, cadenceLockBars: 3 })
    expect(evaluateBreathingTransition(state, basePhysics(), config)).toBe(OTransition.BreathingToAwakening)
  })
})
