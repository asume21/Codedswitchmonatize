import { describe, expect, it, beforeEach } from 'vitest'
import { PitchEmpathy } from '../behaviors/PitchEmpathy'
import { DEFAULT_REACTIVE_CONFIG } from '../types'
import type { ReactiveContext } from '../types'
import { OrganismMode } from '../../physics/types'
import { OState } from '../../state/types'

function makeCtx(pitch: number, confidence: number = 0.9): ReactiveContext {
  return {
    frame: {
      timestamp: 0, frameIndex: 0, sampleRate: 44100, rms: 0.3, rmsRaw: 0.3,
      pitch, pitchConfidence: confidence, pitchMidi: 55, pitchCents: 0,
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

describe('PitchEmpathy', () => {
  let behavior: PitchEmpathy

  beforeEach(() => {
    behavior = new PitchEmpathy(DEFAULT_REACTIVE_CONFIG)
  })

  it('sustained rising pitch → offset > 0', () => {
    // Feed a long rising sequence so consecutiveRising exceeds pitchRiseMinSyllables
    for (let i = 0; i < 20; i++) {
      behavior.process(makeCtx(100 + i * 10))
    }
    // Continue rising to let smoothing accumulate
    for (let i = 0; i < 80; i++) {
      behavior.process(makeCtx(300 + i * 2))
    }
    const result = behavior.process(makeCtx(500))
    expect(result.melodyPitchOffsetSemitones).toBeGreaterThan(0)
  })

  it('flat pitch (all 200 Hz) → offset stays at 0', () => {
    for (let i = 0; i < 20; i++) behavior.process(makeCtx(200))
    const result = behavior.process(makeCtx(200))
    expect(result.melodyPitchOffsetSemitones).toBe(0)
  })

  it('rising then falling → offset returns toward 0', () => {
    // Rise
    for (let i = 0; i < 6; i++) behavior.process(makeCtx(100 + i * 20))
    for (let i = 0; i < 30; i++) behavior.process(makeCtx(200))
    // Fall
    for (let i = 0; i < 6; i++) behavior.process(makeCtx(200 - i * 20))
    for (let i = 0; i < 100; i++) behavior.process(makeCtx(100))
    const result = behavior.process(makeCtx(100))
    expect(result.melodyPitchOffsetSemitones).toBe(0)
  })

  it('offset never exceeds config.pitchEmpathySemitones', () => {
    // Very steep rise
    for (let i = 0; i < 20; i++) behavior.process(makeCtx(100 + i * 50))
    for (let i = 0; i < 200; i++) behavior.process(makeCtx(1100))
    const result = behavior.process(makeCtx(1100))
    expect(result.melodyPitchOffsetSemitones).toBeLessThanOrEqual(
      DEFAULT_REACTIVE_CONFIG.pitchEmpathySemitones
    )
  })

  it('low confidence pitch frames → ignored', () => {
    for (let i = 0; i < 10; i++) behavior.process(makeCtx(100 + i * 20, 0.2))
    const result = behavior.process(makeCtx(300, 0.2))
    expect(result.melodyPitchOffsetSemitones).toBe(0)
  })
})
