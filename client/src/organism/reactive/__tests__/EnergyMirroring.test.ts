import { describe, expect, it, beforeEach } from 'vitest'
import { EnergyMirroring } from '../behaviors/EnergyMirroring'
import { DEFAULT_REACTIVE_CONFIG } from '../types'
import type { ReactiveContext } from '../types'
import { OrganismMode } from '../../physics/types'
import { OState } from '../../state/types'

function makeCtx(rms: number): ReactiveContext {
  return {
    frame: {
      timestamp: 0, frameIndex: 0, sampleRate: 44100, rms, rmsRaw: rms,
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
      syllabicDensity: 2.0,
      cadenceLockBars: 0, cadenceLockAchieved: false,
      silenceDurationMs: 0, lastTransitionPhysics: null,
      timestamp: 1000, frameIndex: 0,
    },
    now: 1000,
  }
}

describe('EnergyMirroring', () => {
  let behavior: EnergyMirroring

  beforeEach(() => {
    behavior = new EnergyMirroring(DEFAULT_REACTIVE_CONFIG)
  })

  it('rms=0 → kickVelocityMultiplier converges toward 0.5', () => {
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(0))
    const result = behavior.process(makeCtx(0))
    expect(result.kickVelocityMultiplier).toBeGreaterThan(0.45)
    expect(result.kickVelocityMultiplier).toBeLessThan(0.55)
  })

  it('rms=1.0 → kickVelocityMultiplier converges toward 1.3', () => {
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(1.0))
    const result = behavior.process(makeCtx(1.0))
    expect(result.kickVelocityMultiplier).toBeGreaterThan(1.25)
    expect(result.kickVelocityMultiplier).toBeLessThan(1.35)
  })

  it('rms=0.5 → kickVelocityMultiplier converges near 1.07', () => {
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(0.5))
    const result = behavior.process(makeCtx(0.5))
    expect(result.kickVelocityMultiplier).toBeGreaterThan(1.0)
    expect(result.kickVelocityMultiplier).toBeLessThan(1.15)
  })

  it('multiplier changes at energyMirrorSmoothing rate (not instant)', () => {
    const first = behavior.process(makeCtx(0))
    const second = behavior.process(makeCtx(1.0))
    // Should not jump from 1.0 to 1.3 instantly
    expect(Math.abs(second.kickVelocityMultiplier! - first.kickVelocityMultiplier!))
      .toBeLessThan(0.15)
  })
})
