import { describe, expect, it } from 'vitest'
import { DensityComputer } from '../computers/DensityComputer'

const WINDOW = 172
const SMOOTH = 0.02

describe('DensityComputer', () => {
  it('produces low density (~0.15) with no generators and presence=0.5', () => {
    const computer = new DensityComputer(WINDOW, SMOOTH)
    let result = { density: 0, thinningRequested: false }
    for (let i = 0; i < 400; i += 1) {
      result = computer.process(0.5)
    }
    expect(result.density).toBeGreaterThan(0.05)
    expect(result.density).toBeLessThan(0.25)
  })

  it('approaches 1.0 with 4 generators registered at 1.0', () => {
    const computer = new DensityComputer(WINDOW, SMOOTH)
    computer.registerGeneratorLevel('gen1', 1.0)
    computer.registerGeneratorLevel('gen2', 1.0)
    computer.registerGeneratorLevel('gen3', 1.0)
    computer.registerGeneratorLevel('gen4', 1.0)
    let result = { density: 0, thinningRequested: false }
    for (let i = 0; i < 500; i += 1) {
      result = computer.process(1.0)
    }
    expect(result.density).toBeGreaterThan(0.8)
  })

  it('sets thinningRequested=true after density stays above 0.85 for 172+ frames', () => {
    const computer = new DensityComputer(WINDOW, SMOOTH)
    computer.registerGeneratorLevel('gen1', 1.0)
    computer.registerGeneratorLevel('gen2', 1.0)
    computer.registerGeneratorLevel('gen3', 1.0)
    computer.registerGeneratorLevel('gen4', 1.0)

    let result = { density: 0, thinningRequested: false }
    for (let i = 0; i < 1000; i += 1) {
      result = computer.process(1.0)
    }
    expect(result.thinningRequested).toBe(true)
  })

  it('resets thinningRequested to false when density drops below 0.85', () => {
    const computer = new DensityComputer(WINDOW, SMOOTH)
    computer.registerGeneratorLevel('gen1', 1.0)
    computer.registerGeneratorLevel('gen2', 1.0)
    computer.registerGeneratorLevel('gen3', 1.0)
    computer.registerGeneratorLevel('gen4', 1.0)

    for (let i = 0; i < 1000; i += 1) {
      computer.process(1.0)
    }

    computer.registerGeneratorLevel('gen1', 0)
    computer.registerGeneratorLevel('gen2', 0)
    computer.registerGeneratorLevel('gen3', 0)
    computer.registerGeneratorLevel('gen4', 0)

    let result = { density: 0, thinningRequested: false }
    for (let i = 0; i < 500; i += 1) {
      result = computer.process(0)
    }
    expect(result.thinningRequested).toBe(false)
  })
})
