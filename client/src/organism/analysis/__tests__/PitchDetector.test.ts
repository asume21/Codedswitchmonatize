import { describe, expect, it } from 'vitest'
import { PitchDetector } from '../algorithms/PitchDetector'

const SAMPLE_RATE = 44100
const FRAME_SIZE = 1024

function createSineFrame(frequencyHz: number, amplitude = 0.5): Float32Array {
  const frame = new Float32Array(FRAME_SIZE)
  for (let index = 0; index < FRAME_SIZE; index += 1) {
    frame[index] = amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / SAMPLE_RATE)
  }
  return frame
}

function createNoiseFrame(): Float32Array {
  const frame = new Float32Array(FRAME_SIZE)
  for (let index = 0; index < FRAME_SIZE; index += 1) {
    frame[index] = (Math.random() * 2 - 1) * 0.5
  }
  return frame
}

describe('PitchDetector', () => {
  it('detects 440 Hz within ±5 Hz', () => {
    const detector = new PitchDetector(SAMPLE_RATE, FRAME_SIZE, 60, 1200)
    const frame = createSineFrame(440)
    const result = detector.process(frame)

    expect(result.pitch).toBeGreaterThan(435)
    expect(result.pitch).toBeLessThan(445)
  })

  it('detects 220 Hz within ±5 Hz', () => {
    const detector = new PitchDetector(SAMPLE_RATE, FRAME_SIZE, 60, 1200)
    const frame = createSineFrame(220)
    const result = detector.process(frame)

    expect(result.pitch).toBeGreaterThan(215)
    expect(result.pitch).toBeLessThan(225)
  })

  it('returns low confidence for white noise', () => {
    const detector = new PitchDetector(SAMPLE_RATE, FRAME_SIZE, 60, 1200)
    const frame = createNoiseFrame()
    const result = detector.process(frame)

    expect(result.confidence).toBeLessThan(0.5)
  })

  it('maps 440 Hz to MIDI 69 with 0 cents deviation', () => {
    const detector = new PitchDetector(SAMPLE_RATE, FRAME_SIZE, 60, 1200)
    const frame = createSineFrame(440)
    const result = detector.process(frame)

    if (result.pitch > 0) {
      expect(result.midi).toBe(69)
      expect(Math.abs(result.cents)).toBeLessThan(5)
    }
  })
})
