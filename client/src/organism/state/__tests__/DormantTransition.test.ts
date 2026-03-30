import { describe, expect, it } from 'vitest'
import { evaluateDormantTransition } from '../transitions/DormantTransition'
import { OState, OTransition, type OrganismState } from '../types'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'

const defaultState = (): OrganismState => ({
  current: OState.Dormant,
  previous: null,
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
})

const defaultPhysics = (overrides: Partial<PhysicsState> = {}): PhysicsState => ({
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

describe('DormantTransition', () => {
  it('returns null when voice is inactive', () => {
    const organism = defaultState()
    const physics = defaultPhysics({ voiceActive: false, presence: 0 })
    expect(evaluateDormantTransition(organism, physics, { voiceOnsetRmsThreshold: 0.02, pulseConfidenceThreshold: 0.4, syllabicDensityThreshold: 1.5, cadenceLockBarsRequired: 2, awakeningToSilenceMs: 8000, breathingToAwakeningMs: 4000, breathingToDormantMs: 30000, flowToBreathingMs: 4000, flowToDormantMs: 30000, awakeningMinBars: 2, awakeningMaxBars: 4, syllabicDensityWindowBars: 2, autoBreathingToFlowBars: 0 }))
      .toBeNull()
  })

  it('returns null when voice active but presence below threshold', () => {
    const organism = defaultState()
    const physics = defaultPhysics({ voiceActive: true, presence: 0.01 })
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
      autoBreathingToFlowBars: 0,
    }

    expect(evaluateDormantTransition(organism, physics, config)).toBeNull()
  })

  it('returns DormantToAwakening when voice is present above threshold', () => {
    const organism = defaultState()
    const physics = defaultPhysics({ voiceActive: true, presence: 0.05 })
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
      autoBreathingToFlowBars: 0,
    }

    expect(evaluateDormantTransition(organism, physics, config)).toBe(OTransition.DormantToAwakening)
  })
})
