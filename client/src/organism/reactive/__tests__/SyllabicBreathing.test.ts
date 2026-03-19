import { describe, expect, it, beforeEach } from 'vitest'
import { SyllabicBreathing } from '../behaviors/SyllabicBreathing'
import { DEFAULT_REACTIVE_CONFIG } from '../types'
import type { ReactiveContext } from '../types'
import { OrganismMode } from '../../physics/types'
import { OState } from '../../state/types'

function makeCtx(syllabicDensity: number): ReactiveContext {
  return {
    frame: {
      timestamp: 0, frameIndex: 0, sampleRate: 44100, rms: 0.3, rmsRaw: 0.3,
      pitch: 200, pitchConfidence: 0.9, pitchMidi: 55, pitchCents: 0,
      spectralCentroid: 2000, hnr: 10, spectralFlux: 0.1,
      onsetDetected: false, onsetStrength: 0, onsetTimestamp: 0,
      voiceActive: true, voiceConfidence: 0.9,
    },
    physics: {
      bounce: 0.5, swing: 0.5, pocket: 0, presence: 0.3, density: 0.3,
      mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
      sixteenthDurationMs: 167, swungSixteenthMs: 334,
      timestamp: 1000, frameIndex: 0, voiceActive: true,
    },
    organism: {
      current: OState.Flow, previous: OState.Breathing,
      framesInState: 100, msInState: 2300, barsInState: 2,
      awakeningProgress: 1, breathingWarmth: 1, flowDepth: 0.8,
      syllabicDensity,
      cadenceLockBars: 0, cadenceLockAchieved: false,
      silenceDurationMs: 0, lastTransitionPhysics: null,
      timestamp: 1000, frameIndex: 0,
    },
    now: 1000,
  }
}

describe('SyllabicBreathing', () => {
  let behavior: SyllabicBreathing

  beforeEach(() => {
    behavior = new SyllabicBreathing(DEFAULT_REACTIVE_CONFIG)
  })

  it('syllabicDensity=0.5 (below sparse) → multiplier converges toward 0.5', () => {
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(0.5))
    const result = behavior.process(makeCtx(0.5))
    expect(result.hatDensityMultiplier).toBeGreaterThan(0.45)
    expect(result.hatDensityMultiplier).toBeLessThan(0.55)
  })

  it('syllabicDensity=4.0 (above dense) → multiplier converges toward 1.4', () => {
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(4.0))
    const result = behavior.process(makeCtx(4.0))
    expect(result.hatDensityMultiplier).toBeGreaterThan(1.35)
    expect(result.hatDensityMultiplier).toBeLessThan(1.45)
  })

  it('syllabicDensity=2.0 (midpoint) → multiplier converges near 0.95', () => {
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(2.0))
    const result = behavior.process(makeCtx(2.0))
    expect(result.hatDensityMultiplier).toBeGreaterThan(0.85)
    expect(result.hatDensityMultiplier).toBeLessThan(1.05)
  })

  it('multiplier changes smoothly (no instant jumps)', () => {
    const first = behavior.process(makeCtx(0.5))
    const second = behavior.process(makeCtx(4.0))
    // Should not jump instantly from ~1.0 to ~1.4
    expect(Math.abs(second.hatDensityMultiplier! - first.hatDensityMultiplier!)).toBeLessThan(0.2)
  })
})
