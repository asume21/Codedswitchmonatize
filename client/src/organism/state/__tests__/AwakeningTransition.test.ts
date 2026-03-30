import { describe, expect, it } from 'vitest'
import { evaluateAwakeningTransition } from '../transitions/AwakeningTransition'
import { OState, OTransition, type OrganismState } from '../types'
import type { PhysicsState } from '../../physics/types'
import { OrganismMode } from '../../physics/types'

const createState = (overrides: Partial<OrganismState>): OrganismState => ({
  current: OState.Awakening,
  previous: OState.Dormant,
  framesInState: 0,
  msInState: 0,
  barsInState: 0,
  awakeningProgress: 0,
  breathingWarmth: 0,
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

const baseConfig = {
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
  autoBreathingToFlowBars: 0,
}

const basePhysics = (overrides: Partial<PhysicsState> = {}): PhysicsState => ({
  bounce: 0,
  swing: 0.5,
  pocket: 0,
  presence: 0,
  density: 0,
  mode: OrganismMode.Heat,
  pulse: 90,
  beatDurationMs: 500,
  sixteenthDurationMs: 125,
  swungSixteenthMs: 250,
  timestamp: 0,
  frameIndex: 0,
  voiceActive: true,
  ...overrides,
})

describe('AwakeningTransition', () => {
  it('keeps dormant when min bars not met', () => {
    const organism = createState({ barsInState: 1, silenceDurationMs: 0 })
    const physics = basePhysics({ presence: 0.5 })
    expect(evaluateAwakeningTransition(organism, physics, baseConfig)).toBeNull()
  })

  it('enters breathing at min bars with adequate pulse', () => {
    const organism = createState({ barsInState: 2, silenceDurationMs: 0 })
    const physics = basePhysics({ presence: 0.5 })
    expect(evaluateAwakeningTransition(organism, physics, baseConfig))
      .toBe(OTransition.AwakeningToBreathing)
  })

  it('enters breathing even past max bars (force forward)', () => {
    const organism = createState({ barsInState: 5, silenceDurationMs: 0 })
    const physics = basePhysics({ presence: 0.5 })
    expect(evaluateAwakeningTransition(organism, physics, baseConfig))
      .toBe(OTransition.AwakeningToBreathing)
  })

  it('falls back to dormant after silence timeout', () => {
    const organism = createState({ barsInState: 2, silenceDurationMs: 9000 })
    const physics = basePhysics({ presence: 0.5 })
    expect(evaluateAwakeningTransition(organism, physics, baseConfig))
      .toBe(OTransition.AwakeningToDormant)
  })

  it('silence fallback wins over forward transition', () => {
    const organism = createState({ barsInState: 3, silenceDurationMs: 9000 })
    const physics = basePhysics({ presence: 0.5 })
    expect(evaluateAwakeningTransition(organism, physics, baseConfig))
      .toBe(OTransition.AwakeningToDormant)
  })
})
