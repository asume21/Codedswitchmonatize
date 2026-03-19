import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState } from '../../state/types'
import { GeneratorName, MelodyBehavior } from '../types'
import { createToneMock, mockPartStart } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { MelodyGenerator } from '../MelodyGenerator'
import { getMelodyBehavior } from '../patterns/MelodyPatternLibrary'

// ── Helpers ─────────────────────────────────────────────────────────

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
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

describe('MelodyGenerator', () => {
  let gen: MelodyGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    gen = new MelodyGenerator()
  })

  it('starts with MelodyBehavior.Rest → no part created', () => {
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
    expect(report.name).toBe(GeneratorName.Melody)
    // No part should be started on construction
    expect(mockPartStart).not.toHaveBeenCalled()
  })

  it('voiceActive=false, flowDepth=0.6 → behavior = Respond', () => {
    const behavior = getMelodyBehavior(OrganismMode.Glow, false, 0.6)
    expect(behavior).toBe(MelodyBehavior.Respond)
  })

  it('voiceActive=true, flowDepth=0.1 → behavior = Rest', () => {
    const behavior = getMelodyBehavior(OrganismMode.Glow, true, 0.1)
    expect(behavior).toBe(MelodyBehavior.Rest)
  })

  it('voiceActive=false, flowDepth=0.8 → behavior = Lead', () => {
    const behavior = getMelodyBehavior(OrganismMode.Glow, false, 0.8)
    expect(behavior).toBe(MelodyBehavior.Lead)
  })

  it('behavior change triggers part rebuild', () => {
    const physics = makePhysics({ voiceActive: false })
    const organism = makeOrganism({ current: OState.Flow, flowDepth: 0.8 })

    // First frame with Lead behavior should rebuild
    gen.processFrame(physics, organism)
    expect(mockPartStart).toHaveBeenCalled()
  })

  it('onStateTransition to DORMANT stops part and zeros activity', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Breathing, physics)
    gen.onStateTransition(OState.Dormant, physics)

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })

  it('onStateTransition to FLOW sets scale from mode', () => {
    const physics = makePhysics({ mode: OrganismMode.Heat })
    expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()
  })

  it('reset() zeros activity and sets behavior to Rest', () => {
    const physics = makePhysics({ voiceActive: false })
    const organism = makeOrganism({ current: OState.Flow, flowDepth: 0.8 })
    for (let i = 0; i < 100; i++) gen.processFrame(physics, organism)

    gen.reset()
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })
})
