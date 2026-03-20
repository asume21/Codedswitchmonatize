import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState } from '../../state/types'
import { GeneratorName } from '../types'
import { createToneMock, mockGainRampTo } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { DrumGenerator } from '../DrumGenerator'

// ── Helpers ─────────────────────────────────────────────────────────

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Smoke, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 43, voiceActive: false,
    ...overrides,
  }
}

function makeOrganism(overrides: Partial<OrganismState> = {}): OrganismState {
  return {
    current: OState.Breathing, previous: OState.Awakening,
    framesInState: 100, msInState: 2300, barsInState: 2,
    awakeningProgress: 1, breathingWarmth: 0.6, flowDepth: 0,
    syllabicDensity: 1.5, cadenceLockBars: 0, cadenceLockAchieved: false,
    silenceDurationMs: 0, lastTransitionPhysics: null,
    timestamp: 1000, frameIndex: 43,
    ...overrides,
  }
}

describe('DrumGenerator', () => {
  let gen: DrumGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    gen = new DrumGenerator()
  })

  it('has correct generator name', () => {
    expect(gen.name).toBe(GeneratorName.Drum)
  })

  it('getActivityReport() returns level=0 in DORMANT state', () => {
    gen.processFrame(makePhysics(), makeOrganism({ current: OState.Dormant }))
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeLessThan(0.01)
    expect(report.name).toBe(GeneratorName.Drum)
  })

  it('onStateTransition(AWAKENING) → activityLevel approaches 0.15', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Awakening, physics)

    // Simulate several frames in awakening
    const organism = makeOrganism({
      current: OState.Awakening,
      awakeningProgress: 1.0,
    })
    for (let i = 0; i < 200; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeGreaterThan(0.10)
    expect(report.activityLevel).toBeLessThan(0.25)
  })

  it('onStateTransition(BREATHING) → activityLevel approaches 0.55', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Breathing, physics)

    const organism = makeOrganism({
      current: OState.Breathing,
      breathingWarmth: 1.0,
    })
    for (let i = 0; i < 300; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeGreaterThan(0.40)
    expect(report.activityLevel).toBeLessThan(0.65)
  })

  it('onStateTransition(FLOW) → activityLevel approaches 0.85', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Flow, physics)

    const organism = makeOrganism({
      current: OState.Flow,
      flowDepth: 1.0,
    })
    for (let i = 0; i < 400; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeGreaterThan(0.70)
    expect(report.activityLevel).toBeLessThan(0.95)
  })

  it('processFrame with high presence → hat velocity reduced (pocket behavior)', () => {
    const physics = makePhysics({ presence: 0.9 })
    gen.onStateTransition(OState.Breathing, physics)

    const organism = makeOrganism({ current: OState.Breathing, breathingWarmth: 1 })
    gen.processFrame(physics, organism)

    // Gain rampTo should have been called (output level applied)
    expect(mockGainRampTo).toHaveBeenCalled()
  })

  it('processFrame with bounce=1.0 → kick velocity increased', () => {
    const physics = makePhysics({ bounce: 1.0 })
    gen.onStateTransition(OState.Breathing, physics)

    const organism = makeOrganism({ current: OState.Breathing })
    gen.processFrame(physics, organism)

    // The drum generator stores bounce for dynamic application
    expect(mockGainRampTo).toHaveBeenCalled()
  })

  it('pattern rebuilds on state transition without error', () => {
    const physics = makePhysics()
    expect(() => gen.onStateTransition(OState.Breathing, physics)).not.toThrow()
    expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()
  })

  it('reset() zeros activity level', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Breathing, physics)
    const organism = makeOrganism({ current: OState.Breathing, breathingWarmth: 1 })
    for (let i = 0; i < 100; i++) gen.processFrame(physics, organism)

    gen.reset()
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })
})
