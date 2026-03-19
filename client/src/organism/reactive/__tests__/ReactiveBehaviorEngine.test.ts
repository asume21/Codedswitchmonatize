import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ReactiveBehaviorEngine } from '../ReactiveBehaviorEngine'
import type { AnalysisFrame } from '../../analysis/types'
import type { PhysicsState } from '../../physics/types'
import { OrganismMode } from '../../physics/types'
import type { OrganismState } from '../../state/types'
import { OState } from '../../state/types'

function makeFrame(overrides: Partial<AnalysisFrame> = {}): AnalysisFrame {
  return {
    timestamp: 0, frameIndex: 0, sampleRate: 44100, rms: 0.3, rmsRaw: 0.3,
    pitch: 200, pitchConfidence: 0.9, pitchMidi: 55, pitchCents: 0,
    spectralCentroid: 2000, hnr: 10, spectralFlux: 0.1,
    onsetDetected: false, onsetStrength: 0, onsetTimestamp: 0,
    voiceActive: true, voiceConfidence: 0.9,
    ...overrides,
  }
}

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0.3, density: 0.3,
    mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 0, voiceActive: true,
    ...overrides,
  }
}

function makeOrganism(overrides: Partial<OrganismState> = {}): OrganismState {
  return {
    current: OState.Flow, previous: OState.Breathing,
    framesInState: 100, msInState: 2300, barsInState: 2,
    awakeningProgress: 1, breathingWarmth: 1, flowDepth: 0.8,
    syllabicDensity: 2.0,
    cadenceLockBars: 0, cadenceLockAchieved: false,
    silenceDurationMs: 0, lastTransitionPhysics: null,
    timestamp: 1000, frameIndex: 0,
    ...overrides,
  }
}

function createMockOrchestrator() {
  return {
    setHatDensityMultiplier:   vi.fn(),
    setKickVelocityMultiplier: vi.fn(),
    setBassVolumeMultiplier:   vi.fn(),
    setMelodyPitchOffset:      vi.fn(),
    setMelodyVolumeMultiplier: vi.fn(),
    setTextureVolumeMultiplier: vi.fn(),
  }
}

describe('ReactiveBehaviorEngine', () => {
  let engine: ReactiveBehaviorEngine
  let mockOrch: ReturnType<typeof createMockOrchestrator>

  beforeEach(() => {
    engine = new ReactiveBehaviorEngine()
    mockOrch = createMockOrchestrator()
    engine.wire(mockOrch as unknown as import('../../generators/GeneratorOrchestrator').GeneratorOrchestrator)
  })

  it('all 6 behaviors run without error on valid context', () => {
    expect(() => {
      engine.processFrame(makeFrame(), makePhysics(), makeOrganism())
    }).not.toThrow()
  })

  it('in OState.Dormant → processFrame is no-op (active=false)', () => {
    engine.processFrame(
      makeFrame(),
      makePhysics(),
      makeOrganism({ current: OState.Dormant }),
    )
    expect(engine.isActive()).toBe(false)
    expect(mockOrch.setHatDensityMultiplier).not.toHaveBeenCalled()
  })

  it('in OState.Flow → processFrame calls all 6 mutation methods', () => {
    engine.processFrame(makeFrame(), makePhysics(), makeOrganism())
    expect(engine.isActive()).toBe(true)
    expect(mockOrch.setHatDensityMultiplier).toHaveBeenCalledOnce()
    expect(mockOrch.setKickVelocityMultiplier).toHaveBeenCalledOnce()
    expect(mockOrch.setBassVolumeMultiplier).toHaveBeenCalledOnce()
    expect(mockOrch.setMelodyPitchOffset).toHaveBeenCalledOnce()
    expect(mockOrch.setMelodyVolumeMultiplier).toHaveBeenCalledOnce()
    expect(mockOrch.setTextureVolumeMultiplier).toHaveBeenCalledOnce()
  })

  it('BehaviorOutput merging is multiplicative', () => {
    // Run with high presence (triggers ducking) — ducking affects bass, melody, texture
    engine.processFrame(
      makeFrame(),
      makePhysics({ presence: 1.0 }),
      makeOrganism(),
    )

    // masterDuckMultiplier should be < 1 and multiply into bass/melody/texture
    const bassCall = mockOrch.setBassVolumeMultiplier.mock.calls[0][0]
    expect(bassCall).toBeLessThan(1.0)

    const melodyCall = mockOrch.setMelodyVolumeMultiplier.mock.calls[0][0]
    expect(melodyCall).toBeLessThan(1.0)
  })

  it('wire(orchestrator) stores reference — applyToOrchestrator called', () => {
    engine.processFrame(makeFrame(), makePhysics(), makeOrganism())
    // All 6 methods called = orchestrator reference works
    expect(mockOrch.setHatDensityMultiplier).toHaveBeenCalled()
  })
})
