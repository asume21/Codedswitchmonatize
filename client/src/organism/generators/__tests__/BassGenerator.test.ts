import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState } from '../../state/types'
import { GeneratorName } from '../types'
import { createToneMock, mockPartStart, mockFilterFreqRampTo } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { BassGenerator } from '../BassGenerator'

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

describe('BassGenerator', () => {
  let gen: BassGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    gen = new BassGenerator()
  })

  it('starts silent (output level 0)', () => {
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
    expect(report.name).toBe(GeneratorName.Bass)
  })

  it('onStateTransition(BREATHING) → generates notes without error', () => {
    const physics = makePhysics()
    expect(() => gen.onStateTransition(OState.Breathing, physics)).not.toThrow()
  })

  it('BassBehavior.Lock → rebuilds part without error (smoke mode)', () => {
    // Smoke mode maps BREATHING → Lock behavior
    const physics = makePhysics({ mode: OrganismMode.Smoke })
    gen.onStateTransition(OState.Breathing, physics)

    // Part start should have been called after rebuild
    expect(mockPartStart).toHaveBeenCalled()
  })

  it('onStateTransition(FLOW) → updates behavior without error', () => {
    const physics = makePhysics({ mode: OrganismMode.Smoke })
    expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()
  })

  it('high pocket physics → filter cutoff drops', () => {
    const physics = makePhysics({ pocket: 0.9, mode: OrganismMode.Smoke })
    const organism = makeOrganism({ current: OState.Breathing })
    gen.processFrame(physics, organism)

    // Filter frequency rampTo should be called with a low value
    expect(mockFilterFreqRampTo).toHaveBeenCalled()
    const lastCallArgs = mockFilterFreqRampTo.mock.calls[mockFilterFreqRampTo.mock.calls.length - 1]
    // With pocket=0.9 and smoke base=600: 600 * max(0.25, 1 - 0.9*0.75) = 600 * 0.325 ≈ 195
    expect(lastCallArgs[0]).toBeLessThan(250)
  })

  it('processFrame smooths activity level toward target', () => {
    const physics = makePhysics()
    const organism = makeOrganism({ current: OState.Breathing, breathingWarmth: 1.0 })
    gen.onStateTransition(OState.Breathing, physics)

    for (let i = 0; i < 300; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBeGreaterThan(0.35)
    expect(report.activityLevel).toBeLessThan(0.65)
  })

  it('reset() zeros activity level and stops part', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Breathing, physics)
    const organism = makeOrganism({ current: OState.Breathing, breathingWarmth: 1 })
    for (let i = 0; i < 100; i++) gen.processFrame(physics, organism)

    gen.reset()
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })
})
