import { describe, expect, it, beforeEach } from 'vitest'
import { PresenceDucking } from '../behaviors/PresenceDucking'
import { DEFAULT_REACTIVE_CONFIG } from '../types'
import type { ReactiveContext } from '../types'
import { OrganismMode } from '../../physics/types'
import { OState } from '../../state/types'

function makeCtx(presence: number): ReactiveContext {
  return {
    frame: {
      timestamp: 0, frameIndex: 0, sampleRate: 44100, rms: 0.3, rmsRaw: 0.3,
      pitch: 200, pitchConfidence: 0.9, pitchMidi: 55, pitchCents: 0,
      spectralCentroid: 2000, hnr: 10, spectralFlux: 0.1,
      onsetDetected: false, onsetStrength: 0, onsetTimestamp: 0,
      voiceActive: true, voiceConfidence: 0.9,
    },
    physics: {
      bounce: 0.5, swing: 0.5, pocket: 0, presence, density: 0.3,
      mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
      sixteenthDurationMs: 167, swungSixteenthMs: 334,
      timestamp: 1000, frameIndex: 0, voiceActive: true,
    },
    organism: {
      current: OState.Flow, previous: OState.Breathing,
      framesInState: 100, msInState: 2300, barsInState: 2,
      awakeningProgress: 1, breathingWarmth: 1, flowDepth: 0.8,
      syllabicDensity: 2.0,
      cadenceLockBars: 0, cadenceLockAchieved: false,
      silenceDurationMs: 0, lastTransitionPhysics: null,
      timestamp: 1000, frameIndex: 0,
    },
    now: 1000,
  }
}

describe('PresenceDucking', () => {
  let behavior: PresenceDucking

  beforeEach(() => {
    behavior = new PresenceDucking(DEFAULT_REACTIVE_CONFIG)
  })

  it('presence=0.4 (below threshold) → masterDuckMultiplier stays at 1.0', () => {
    for (let i = 0; i < 100; i++) behavior.process(makeCtx(0.4))
    const result = behavior.process(makeCtx(0.4))
    expect(result.masterDuckMultiplier).toBeGreaterThan(0.98)
    expect(result.masterDuckMultiplier).toBeLessThanOrEqual(1.0)
  })

  it('presence=1.0 (max) → masterDuckMultiplier converges toward presenceDuckDepth (0.4)', () => {
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(1.0))
    const result = behavior.process(makeCtx(1.0))
    expect(result.masterDuckMultiplier).toBeGreaterThan(0.35)
    expect(result.masterDuckMultiplier).toBeLessThan(0.50)
  })

  it('presence=0.8 → masterDuckMultiplier converges to intermediate value', () => {
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(0.8))
    const result = behavior.process(makeCtx(0.8))
    expect(result.masterDuckMultiplier).toBeGreaterThan(0.5)
    expect(result.masterDuckMultiplier).toBeLessThan(0.85)
  })

  it('attack is faster than release', () => {
    // Count frames to reach duck from 1.0
    let attackFrames = 0
    for (let i = 0; i < 200; i++) {
      const r = behavior.process(makeCtx(1.0))
      attackFrames++
      if (r.masterDuckMultiplier! < 0.5) break
    }

    // Reset and count frames to release from ducked state
    behavior.reset()
    // Duck first
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(1.0))

    let releaseFrames = 0
    for (let i = 0; i < 500; i++) {
      const r = behavior.process(makeCtx(0))
      releaseFrames++
      if (r.masterDuckMultiplier! > 0.9) break
    }

    expect(attackFrames).toBeLessThan(releaseFrames)
  })

  it('reset() → smoothedDuck returns to 1.0', () => {
    for (let i = 0; i < 100; i++) behavior.process(makeCtx(1.0))
    behavior.reset()
    const result = behavior.process(makeCtx(0))
    // After reset, should be very close to 1.0
    expect(result.masterDuckMultiplier).toBeGreaterThan(0.95)
  })
})
