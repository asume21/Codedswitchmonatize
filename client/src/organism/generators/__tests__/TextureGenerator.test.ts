import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState } from '../../state/types'
import { GeneratorName } from '../types'
import { createToneMock, mockGainRampTo, mockFilterFreqRampTo } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { TextureGenerator } from '../TextureGenerator'

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

describe('TextureGenerator', () => {
  let gen: TextureGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    gen = new TextureGenerator()
  })

  it('has correct generator name', () => {
    expect(gen.name).toBe(GeneratorName.Texture)
  })

  it('DORMANT → gain ramps to 0', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Dormant, physics)
    expect(mockGainRampTo).toHaveBeenCalledWith(0, 1.0)
  })

  it('AWAKENING → very low activity (< 0.1)', () => {
    const physics = makePhysics()
    const organism = makeOrganism({
      current: OState.Awakening,
      awakeningProgress: 0.5,
    })

    for (let i = 0; i < 200; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    // 0.05 * 0.5 = 0.025 target, should converge near that
    expect(report.activityLevel).toBeLessThan(0.1)
  })

  it('FLOW with flowDepth=1.0 → activity converges toward 0.28', () => {
    const physics = makePhysics()
    const organism = makeOrganism({
      current: OState.Flow,
      flowDepth: 1.0,
    })

    for (let i = 0; i < 400; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    // Target: 0.20 + 0.08 * 1.0 = 0.28
    expect(report.activityLevel).toBeGreaterThan(0.20)
    expect(report.activityLevel).toBeLessThan(0.35)
  })

  it('setThinning(true) → target level reduced to 40%', () => {
    const physics = makePhysics()
    const organism = makeOrganism({
      current: OState.Flow,
      flowDepth: 1.0,
    })

    gen.setThinning(true)

    for (let i = 0; i < 400; i++) {
      gen.processFrame(physics, organism)
    }

    const report = gen.getActivityReport(Date.now())
    // Target: 0.28 * 0.4 = 0.112
    expect(report.activityLevel).toBeLessThan(0.15)
    expect(report.activityLevel).toBeGreaterThan(0.05)
  })

  it('mode change → filter frequency morphs toward new mode target', () => {
    const physicsHeat = makePhysics({ mode: OrganismMode.Heat })
    const organism = makeOrganism({ current: OState.Breathing })

    gen.processFrame(physicsHeat, organism)

    // Heat mode filter target = 300 Hz
    expect(mockFilterFreqRampTo).toHaveBeenCalledWith(300, 1.0)

    mockFilterFreqRampTo.mockClear()

    const physicsIce = makePhysics({ mode: OrganismMode.Ice })
    gen.processFrame(physicsIce, organism)

    // Ice mode filter target = 250 Hz
    expect(mockFilterFreqRampTo).toHaveBeenCalledWith(250, 1.0)
  })

  it('reset() zeros activity and disables thinning', () => {
    const physics = makePhysics()
    const organism = makeOrganism({ current: OState.Flow, flowDepth: 1 })
    for (let i = 0; i < 100; i++) gen.processFrame(physics, organism)

    gen.reset()
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
    expect(mockGainRampTo).toHaveBeenCalledWith(0, 0.5)
  })
})
