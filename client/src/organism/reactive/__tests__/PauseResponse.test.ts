import { describe, expect, it, beforeEach } from 'vitest'
import { PauseResponse, PausePhase } from '../behaviors/PauseResponse'
import { DEFAULT_REACTIVE_CONFIG } from '../types'
import type { ReactiveContext } from '../types'
import { OrganismMode } from '../../physics/types'
import { OState } from '../../state/types'

function makeCtx(voiceActive: boolean, now: number): ReactiveContext {
  return {
    frame: {
      timestamp: now, frameIndex: 0, sampleRate: 44100, rms: 0.3, rmsRaw: 0.3,
      pitch: 200, pitchConfidence: 0.9, pitchMidi: 55, pitchCents: 0,
      spectralCentroid: 2000, hnr: 10, spectralFlux: 0.1,
      onsetDetected: false, onsetStrength: 0, onsetTimestamp: 0,
      voiceActive, voiceConfidence: voiceActive ? 0.9 : 0.1,
    },
    physics: {
      bounce: 0.5, swing: 0.5, pocket: 0, presence: 0.3, density: 0.3,
      mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
      sixteenthDurationMs: 167, swungSixteenthMs: 334,
      timestamp: now, frameIndex: 0, voiceActive,
    },
    organism: {
      current: OState.Flow, previous: OState.Breathing,
      framesInState: 100, msInState: 2300, barsInState: 2,
      awakeningProgress: 1, breathingWarmth: 1, flowDepth: 0.8,
      syllabicDensity: 2.0,
      cadenceLockBars: 0, cadenceLockAchieved: false,
      silenceDurationMs: 0, lastTransitionPhysics: null,
      timestamp: now, frameIndex: 0,
    },
    now,
  }
}

describe('PauseResponse', () => {
  let behavior: PauseResponse
  const beatMs = 667  // 90 BPM

  beforeEach(() => {
    behavior = new PauseResponse(DEFAULT_REACTIVE_CONFIG)
  })

  it('voiceActive=true → phase=Listening, no boost', () => {
    const result = behavior.process(makeCtx(true, 0))
    expect(behavior.getPhase()).toBe(PausePhase.Listening)
    expect(result.melodyVolumeMultiplier).toBe(1.0)
    expect(result.textureVolumeMultiplier).toBe(1.0)
  })

  it('voiceActive→false for exactly 1 beat → phase transitions to Filling', () => {
    // Voice active
    behavior.process(makeCtx(true, 0))
    // Voice stops
    behavior.process(makeCtx(false, 100))
    expect(behavior.getPhase()).toBe(PausePhase.Measuring)
    // Wait exactly 1 beat (667ms)
    behavior.process(makeCtx(false, 100 + beatMs))
    expect(behavior.getPhase()).toBe(PausePhase.Filling)
  })

  it('voiceActive→false > maxBars → phase stays Listening (too long)', () => {
    behavior.process(makeCtx(true, 0))
    behavior.process(makeCtx(false, 100))
    // Wait beyond maxBars (4 bars × 4 beats × 667ms = 10672ms)
    behavior.process(makeCtx(false, 100 + 11000))
    expect(behavior.getPhase()).toBe(PausePhase.Listening)
  })

  it('voiceActive returns during Filling → boost immediately resets to 1.0', () => {
    behavior.process(makeCtx(true, 0))
    behavior.process(makeCtx(false, 100))
    behavior.process(makeCtx(false, 100 + beatMs))
    expect(behavior.getPhase()).toBe(PausePhase.Filling)

    // Voice comes back
    const result = behavior.process(makeCtx(true, 100 + beatMs + 100))
    expect(behavior.getPhase()).toBe(PausePhase.Listening)
    expect(result.melodyVolumeMultiplier).toBe(1.0)
    expect(result.textureVolumeMultiplier).toBe(1.0)
  })

  it('fill duration matches measured pause duration (within 1 frame)', () => {
    const pauseStart = 100
    const pauseEnd   = pauseStart + beatMs * 2  // 2 beats of pause

    behavior.process(makeCtx(true, 0))
    behavior.process(makeCtx(false, pauseStart))
    behavior.process(makeCtx(false, pauseEnd))
    expect(behavior.getPhase()).toBe(PausePhase.Filling)

    // Fill should last ~2 beats
    behavior.process(makeCtx(false, pauseEnd + beatMs * 2 - 10))
    expect(behavior.getPhase()).toBe(PausePhase.Filling)

    behavior.process(makeCtx(false, pauseEnd + beatMs * 2 + 10))
    expect(behavior.getPhase()).toBe(PausePhase.Resolved)
  })
})
