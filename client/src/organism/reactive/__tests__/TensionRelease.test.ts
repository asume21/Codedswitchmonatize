import { describe, expect, it, beforeEach } from 'vitest'
import { TensionRelease } from '../behaviors/TensionRelease'
import { DEFAULT_REACTIVE_CONFIG } from '../types'
import type { ReactiveContext } from '../types'
import { OrganismMode } from '../../physics/types'
import { OState } from '../../state/types'

function makeCtx(rms: number, spectralFlux: number, presence: number, frameIndex: number): ReactiveContext {
  return {
    frame: {
      timestamp: 0, frameIndex, sampleRate: 44100, rms, rmsRaw: rms,
      pitch: 200, pitchConfidence: 0.9, pitchMidi: 55, pitchCents: 0,
      spectralCentroid: 2000, hnr: 10, spectralFlux,
      onsetDetected: false, onsetStrength: 0, onsetTimestamp: 0,
      voiceActive: true, voiceConfidence: 0.9,
    },
    physics: {
      bounce: 0.5, swing: 0.5, pocket: 0, presence, density: 0.3,
      mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
      sixteenthDurationMs: 167, swungSixteenthMs: 334,
      timestamp: 1000, frameIndex, voiceActive: true,
    },
    organism: {
      current: OState.Flow, previous: OState.Breathing,
      framesInState: 100, msInState: 2300, barsInState: 2,
      awakeningProgress: 1, breathingWarmth: 1, flowDepth: 0.8,
      syllabicDensity: 2.0,
      cadenceLockBars: 0, cadenceLockAchieved: false,
      silenceDurationMs: 0, lastTransitionPhysics: null,
      timestamp: 1000, frameIndex,
    },
    now: 1000,
  }
}

describe('TensionRelease', () => {
  let behavior: TensionRelease
  // windowFrames = Math.round(6 * 4 * 43 / 10) = 103
  const windowFrames = Math.round(DEFAULT_REACTIVE_CONFIG.tensionBuildBars * 4 * 43 / 10)

  beforeEach(() => {
    behavior = new TensionRelease(DEFAULT_REACTIVE_CONFIG)
  })

  it('feed rising tension over window → releaseWindowOpen becomes true', () => {
    // First half: low tension
    for (let i = 0; i < windowFrames / 2; i++) {
      behavior.process(makeCtx(0.1, 0.1, 0.1, i))
    }
    // Second half: high tension (> 15% increase)
    for (let i = Math.floor(windowFrames / 2); i < windowFrames + 5; i++) {
      behavior.process(makeCtx(0.8, 0.8, 0.8, i))
    }
    expect(behavior.isReleaseWindowOpen()).toBe(true)
  })

  it('release window closes after tensionReleaseWindowBars', () => {
    const releaseFrames = Math.round(DEFAULT_REACTIVE_CONFIG.tensionReleaseWindowBars * 4 * 43 / 10)

    // Build tension
    for (let i = 0; i < windowFrames / 2; i++) {
      behavior.process(makeCtx(0.1, 0.1, 0.1, i))
    }
    for (let i = Math.floor(windowFrames / 2); i < windowFrames + 5; i++) {
      behavior.process(makeCtx(0.8, 0.8, 0.8, i))
    }
    expect(behavior.isReleaseWindowOpen()).toBe(true)

    // Run through release window
    const startIdx = windowFrames + 5
    for (let i = 0; i < releaseFrames + 5; i++) {
      behavior.process(makeCtx(0.3, 0.3, 0.3, startIdx + i))
    }
    expect(behavior.isReleaseWindowOpen()).toBe(false)
  })

  it('flat tension → releaseWindowOpen stays false', () => {
    for (let i = 0; i < windowFrames * 2; i++) {
      behavior.process(makeCtx(0.5, 0.5, 0.5, i))
    }
    expect(behavior.isReleaseWindowOpen()).toBe(false)
  })

  it('falling tension → releaseWindowOpen stays false', () => {
    // First half: high
    for (let i = 0; i < windowFrames / 2; i++) {
      behavior.process(makeCtx(0.8, 0.8, 0.8, i))
    }
    // Second half: low
    for (let i = Math.floor(windowFrames / 2); i < windowFrames + 5; i++) {
      behavior.process(makeCtx(0.1, 0.1, 0.1, i))
    }
    expect(behavior.isReleaseWindowOpen()).toBe(false)
  })
})
