import { describe, expect, it } from 'vitest'
import { RmsAnalyzer } from '../algorithms/RmsAnalyzer'

const SAMPLE_RATE = 44100
const FRAME_SIZE = 1024

function createSineFrame(frequencyHz: number, amplitude: number, phase = 0): Float32Array {
  const frame = new Float32Array(FRAME_SIZE)
  for (let index = 0; index < FRAME_SIZE; index += 1) {
    frame[index] = amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / SAMPLE_RATE + phase)
  }
  return frame
}

describe('RmsAnalyzer', () => {
  it('converges near 0.354 RMS for 0.5 amplitude sine wave', () => {
    const analyzer = new RmsAnalyzer(SAMPLE_RATE, FRAME_SIZE, 30, 200)
    const frame = createSineFrame(220, 0.5)

    let result = { rms: 0, rmsRaw: 0 }
    for (let index = 0; index < 10; index += 1) {
      result = analyzer.process(frame)
    }

    expect(result.rmsRaw).toBeGreaterThan(0.34)
    expect(result.rmsRaw).toBeLessThan(0.37)
    expect(result.rms).toBeGreaterThan(0)
  })

  it('returns zero RMS and raw RMS for silence', () => {
    const analyzer = new RmsAnalyzer(SAMPLE_RATE, FRAME_SIZE, 30, 200)
    const frame = new Float32Array(FRAME_SIZE)

    const result = analyzer.process(frame)

    expect(result.rmsRaw).toBe(0)
    expect(result.rms).toBe(0)
  })

  it('decays with release smoothing slower than immediate drop', () => {
    const analyzer = new RmsAnalyzer(SAMPLE_RATE, FRAME_SIZE, 30, 200)
    const loud = createSineFrame(220, 0.8)
    const silent = new Float32Array(FRAME_SIZE)

    for (let index = 0; index < 8; index += 1) {
      analyzer.process(loud)
    }

    const beforeDrop = analyzer.process(loud).rms
    const afterDrop = analyzer.process(silent).rms

    expect(beforeDrop).toBeGreaterThan(afterDrop)
    expect(afterDrop).toBeGreaterThan(0)
  })
})
