import { describe, expect, it } from 'vitest'
import { SpectralAnalyzer } from '../algorithms/SpectralAnalyzer'

const SAMPLE_RATE = 44100
const FRAME_SIZE = 1024
const BINS = FRAME_SIZE / 2

function createHighFrequencySpectrum(): Float32Array {
  const spectrum = new Float32Array(BINS)
  for (let index = Math.floor(BINS * 0.75); index < BINS; index += 1) {
    spectrum[index] = 1.0
  }
  return spectrum
}

function createLowFrequencySpectrum(): Float32Array {
  const spectrum = new Float32Array(BINS)
  for (let index = 0; index <= 5; index += 1) {
    spectrum[index] = 1.0
  }
  return spectrum
}

describe('SpectralAnalyzer', () => {
  it('reports centroid > 2000 Hz for high-frequency spectrum', () => {
    const analyzer = new SpectralAnalyzer(SAMPLE_RATE, FRAME_SIZE)
    const spectrum = createHighFrequencySpectrum()
    const result = analyzer.process(spectrum)

    expect(result.centroid).toBeGreaterThan(2000)
  })

  it('reports centroid < 500 Hz for low-frequency spectrum', () => {
    const analyzer = new SpectralAnalyzer(SAMPLE_RATE, FRAME_SIZE)
    const spectrum = createLowFrequencySpectrum()
    const result = analyzer.process(spectrum)

    expect(result.centroid).toBeLessThan(500)
  })

  it('reports near-zero flux for identical consecutive frames', () => {
    const analyzer = new SpectralAnalyzer(SAMPLE_RATE, FRAME_SIZE)
    const spectrum = createHighFrequencySpectrum()

    analyzer.process(spectrum)
    const result = analyzer.process(spectrum)

    expect(result.flux).toBeCloseTo(0, 3)
  })

  it('reports high flux for radically different frames', () => {
    const analyzer = new SpectralAnalyzer(SAMPLE_RATE, FRAME_SIZE)
    const low = createLowFrequencySpectrum()
    const high = createHighFrequencySpectrum()

    analyzer.process(low)
    const result = analyzer.process(high)

    expect(result.flux).toBeGreaterThan(0.5)
  })
})
