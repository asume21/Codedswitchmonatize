import { describe, expect, it } from 'vitest'
import { PocketComputer } from '../computers/PocketComputer'

const SAMPLE_RATE = 44100
const FRAME_SIZE  = 1024
const ATTACK_MS   = 20
const RELEASE_MS  = 400

describe('PocketComputer', () => {
  it('opens toward presence when voiceActive=true', () => {
    const computer = new PocketComputer(SAMPLE_RATE, FRAME_SIZE, ATTACK_MS, RELEASE_MS)
    let result = 0
    for (let i = 0; i < 500; i += 1) {
      result = computer.process(0.9, true)
    }
    expect(result).toBeGreaterThan(0.85)
  })

  it('closes toward 0 when voiceActive=false', () => {
    const computer = new PocketComputer(SAMPLE_RATE, FRAME_SIZE, ATTACK_MS, RELEASE_MS)
    for (let i = 0; i < 500; i += 1) {
      computer.process(0.9, true)
    }
    for (let i = 0; i < 600; i += 1) {
      computer.process(0.9, false)
    }
    const result = computer.process(0.9, false)
    expect(result).toBeLessThan(0.1)
  })

  it('follows attack/release timing — attack is faster than release', () => {
    const computer = new PocketComputer(SAMPLE_RATE, FRAME_SIZE, ATTACK_MS, RELEASE_MS)

    let afterAttack = 0
    for (let i = 0; i < 10; i += 1) {
      afterAttack = computer.process(1.0, true)
    }

    computer.reset()

    let afterRelease = 1.0
    for (let i = 0; i < 10; i += 1) {
      afterRelease = computer.process(0, false)
    }

    expect(afterAttack).toBeGreaterThan(afterRelease)
  })
})
