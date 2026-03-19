import { describe, expect, it } from 'vitest'
import { BounceComputer } from '../computers/BounceComputer'

const WINDOW  = 86
const SMOOTH  = 0.05

function feedDeviations(computer: BounceComputer, deviationMs: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    computer.process(true, deviationMs)
  }
}

describe('BounceComputer', () => {
  it('converges above 0.7 when all onsets arrive 20ms early', () => {
    const computer = new BounceComputer(WINDOW, SMOOTH)
    feedDeviations(computer, -20, 300)
    expect(computer.process(true, -20)).toBeGreaterThan(0.7)
  })

  it('converges near 0.5 when all onsets land exactly on-grid', () => {
    const computer = new BounceComputer(WINDOW, SMOOTH)
    feedDeviations(computer, 0, 300)
    const result = computer.process(true, 0)
    expect(result).toBeGreaterThan(0.4)
    expect(result).toBeLessThan(0.6)
  })

  it('converges below 0.3 when all onsets arrive 20ms late', () => {
    const computer = new BounceComputer(WINDOW, SMOOTH)
    feedDeviations(computer, 20, 300)
    expect(computer.process(true, 20)).toBeLessThan(0.3)
  })

  it('stays at 0 (initial) when no onsets are fed', () => {
    const computer = new BounceComputer(WINDOW, SMOOTH)
    for (let i = 0; i < 100; i += 1) {
      computer.process(false, 0)
    }
    expect(computer.process(false, 0)).toBe(0)
  })
})
