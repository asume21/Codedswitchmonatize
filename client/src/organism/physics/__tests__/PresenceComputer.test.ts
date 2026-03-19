import { describe, expect, it } from 'vitest'
import { PresenceComputer } from '../computers/PresenceComputer'

const SAMPLE_RATE = 44100
const FRAME_SIZE  = 1024
const ATTACK_MS   = 10
const RELEASE_MS  = 300

describe('PresenceComputer', () => {
  it('converges above 0.7 for rms=0.8 and centroid=3000 Hz', () => {
    const computer = new PresenceComputer(SAMPLE_RATE, FRAME_SIZE, ATTACK_MS, RELEASE_MS)
    let result = 0
    for (let i = 0; i < 500; i += 1) {
      result = computer.process(0.8, 3000)
    }
    expect(result).toBeGreaterThan(0.7)
  })

  it('stays below 0.2 for rms=0.05 and centroid=500 Hz', () => {
    const computer = new PresenceComputer(SAMPLE_RATE, FRAME_SIZE, ATTACK_MS, RELEASE_MS)
    let result = 0
    for (let i = 0; i < 500; i += 1) {
      result = computer.process(0.05, 500)
    }
    expect(result).toBeLessThan(0.2)
  })

  it('stays moderate when rms=0.8 but centroid=500 Hz (brightness reduces presence)', () => {
    const computer = new PresenceComputer(SAMPLE_RATE, FRAME_SIZE, ATTACK_MS, RELEASE_MS)
    let result = 0
    for (let i = 0; i < 500; i += 1) {
      result = computer.process(0.8, 500)
    }
    expect(result).toBeGreaterThan(0.1)
    expect(result).toBeLessThan(0.7)
  })
})
