import { describe, expect, it } from 'vitest'
import { OnsetDetector } from '../algorithms/OnsetDetector'

const SAMPLE_RATE = 44100
const FRAME_SIZE = 1024
const BINS = FRAME_SIZE / 2

function createImpulseSpectrum(): Float32Array {
  const spectrum = new Float32Array(BINS)
  for (let index = 0; index < BINS; index += 1) {
    spectrum[index] = index > BINS / 2 ? 1.0 : 0.1
  }
  return spectrum
}

function createFlatSpectrum(value = 0.1): Float32Array {
  const spectrum = new Float32Array(BINS)
  spectrum.fill(value)
  return spectrum
}

describe('OnsetDetector', () => {
  it('detects onset on a sudden high-frequency impulse', () => {
    const detector = new OnsetDetector(SAMPLE_RATE, FRAME_SIZE, 0.3)
    const flat = createFlatSpectrum(0.01)
    const impulse = createImpulseSpectrum()

    detector.process(flat, 0)
    const result = detector.process(impulse, 100)

    expect(result.detected).toBe(true)
    expect(result.strength).toBeGreaterThan(0.5)
  })

  it('does NOT detect onset on flat sine spectrum', () => {
    const detector = new OnsetDetector(SAMPLE_RATE, FRAME_SIZE, 0.3)
    const flat = createFlatSpectrum(0.1)

    detector.process(flat, 0)
    const result = detector.process(flat, 100)

    expect(result.detected).toBe(false)
  })

  it('only fires once when two impulses arrive less than 50ms apart', () => {
    const detector = new OnsetDetector(SAMPLE_RATE, FRAME_SIZE, 0.3)
    const flat = createFlatSpectrum(0.01)
    const impulse = createImpulseSpectrum()

    detector.process(flat, 0)
    const first = detector.process(impulse, 10)
    detector.process(flat, 20)
    const second = detector.process(impulse, 30)

    expect(first.detected).toBe(true)
    expect(second.detected).toBe(false)
  })
})
