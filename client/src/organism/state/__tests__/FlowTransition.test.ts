import { describe, expect, it } from 'vitest'
import { evaluateFlowTransition } from '../transitions/FlowTransition'
import { OState, OTransition, type OrganismState } from '../types'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'

const createState = (silenceDurationMs: number): OrganismState => ({
  current: OState.Flow,
  previous: OState.Breathing,
  framesInState: 0,
  msInState: 0,
  barsInState: 0,
  awakeningProgress: 0,
  breathingWarmth: 1,
  flowDepth: 1,
  syllabicDensity: 2,
  cadenceLockBars: 2,
  cadenceLockAchieved: true,
  silenceDurationMs,
  lastTransitionPhysics: null,
  timestamp: 0,
  frameIndex: 0,
})

const physics: PhysicsState = {
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
  voiceActive: true,
}

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

describe('FlowTransition', () => {
  it('does not exit on non-silence', () => {
    const state = createState(0)
    expect(evaluateFlowTransition(state, physics, config)).toBeNull()
  })

  it('falls back to breathing after 4 seconds silence', () => {
    const state = createState(5000)
    expect(evaluateFlowTransition(state, physics, config)).toBe(OTransition.FlowToBreathing)
  })

  it('falls back to dormant after 30 seconds silence', () => {
    const state = createState(31000)
    expect(evaluateFlowTransition(state, physics, config)).toBe(OTransition.FlowToDormant)
  })

  it('ignores density and mode changes while in flow', () => {
    const state = createState(0)
    expect(evaluateFlowTransition(state, { ...physics, presence: 0.01 }, config)).toBeNull()
  })
})
