import { describe, expect, it } from 'vitest'
import { SwingComputer } from '../computers/SwingComputer'

const WINDOW = 16
const SMOOTH = 0.03

function feedAlternatingOnsets(
  computer: SwingComputer,
  longMs: number,
  shortMs: number,
  pairs: number
): void {
  let time = 0
  for (let i = 0; i < pairs; i += 1) {
    time += longMs
    computer.process(true, time)
    time += shortMs
    computer.process(true, time)
  }
}

describe('SwingComputer', () => {
  it('converges near 0.667 for alternating 200ms / 100ms IOIs', () => {
    const computer = new SwingComputer(WINDOW, SMOOTH)
    feedAlternatingOnsets(computer, 200, 100, 60)
    const result = computer.process(false, 0)
    expect(result).toBeGreaterThan(0.62)
    expect(result).toBeLessThan(0.72)
  })

  it('converges near 0.5 for equal IOIs (straight 16ths)', () => {
    const computer = new SwingComputer(WINDOW, SMOOTH)
    let time = 0
    for (let i = 0; i < 100; i += 1) {
      time += 150
      computer.process(true, time)
    }
    const result = computer.process(false, 0)
    expect(result).toBeGreaterThan(0.48)
    expect(result).toBeLessThan(0.52)
  })

  it('converges near 0.75 for alternating 225ms / 75ms IOIs', () => {
    const computer = new SwingComputer(WINDOW, SMOOTH)
    feedAlternatingOnsets(computer, 225, 75, 60)
    const result = computer.process(false, 0)
    expect(result).toBeGreaterThan(0.70)
    expect(result).toBeLessThanOrEqual(0.75)
  })
})
