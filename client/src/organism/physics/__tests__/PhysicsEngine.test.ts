import { describe, expect, it, vi } from 'vitest'
import { PhysicsEngine } from '../PhysicsEngine'
import type { AnalysisFrame } from '../../analysis/types'

function makeFrame(overrides: Partial<AnalysisFrame> = {}): AnalysisFrame {
  return {
    frameIndex:       0,
    timestamp:        0,
    sampleRate:       44100,
    rms:              0.5,
    rmsRaw:           0.5,
    pitch:            220,
    pitchConfidence:  0.8,
    pitchMidi:        57,
    pitchCents:       0,
    onsetDetected:    false,
    onsetStrength:    0,
    onsetTimestamp:   0,
    spectralCentroid: 1500,
    spectralFlux:     0.1,
    hnr:              5,
    voiceActive:      true,
    voiceConfidence:  0.9,
    ...overrides,
  }
}

describe('PhysicsEngine', () => {
  it('emits a PhysicsState on every processFrame call', () => {
    const engine   = new PhysicsEngine()
    const callback = vi.fn()
    engine.subscribe(callback)

    engine.processFrame(makeFrame({ frameIndex: 0 }))
    engine.processFrame(makeFrame({ frameIndex: 1 }))
    engine.processFrame(makeFrame({ frameIndex: 2 }))

    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('emits all 7 constants in valid range on first frame', () => {
    const engine = new PhysicsEngine()
    let emitted = false

    engine.subscribe((state) => {
      emitted = true
      expect(state.bounce).toBeGreaterThanOrEqual(0)
      expect(state.bounce).toBeLessThanOrEqual(1)
      expect(state.swing).toBeGreaterThanOrEqual(0.5)
      expect(state.swing).toBeLessThanOrEqual(0.75)
      expect(state.pocket).toBeGreaterThanOrEqual(0)
      expect(state.pocket).toBeLessThanOrEqual(1)
      expect(state.presence).toBeGreaterThanOrEqual(0)
      expect(state.presence).toBeLessThanOrEqual(1)
      expect(state.density).toBeGreaterThanOrEqual(0)
      expect(state.density).toBeLessThanOrEqual(1)
      expect(state.pulse).toBeGreaterThanOrEqual(60)
      expect(state.pulse).toBeLessThanOrEqual(180)
      expect(['heat', 'ice', 'smoke', 'gravel', 'glow']).toContain(state.mode)
    })

    engine.processFrame(makeFrame())
    expect(emitted).toBe(true)
  })

  it('reset() clears all state and getLastState() returns null', () => {
    const engine = new PhysicsEngine()
    engine.processFrame(makeFrame())
    expect(engine.getLastState()).not.toBeNull()

    engine.reset()
    expect(engine.getLastState()).toBeNull()
  })
})
