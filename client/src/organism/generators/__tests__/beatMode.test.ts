import { describe, expect, it } from 'vitest'
import { beatModeDrumDensity, beatModeMultiplier, holdsPocket } from '../beatMode'

describe('beatMode', () => {
  it('treats drums and bass as the foundation', () => {
    expect(holdsPocket('drums')).toBe(true)
    expect(holdsPocket('bass')).toBe(true)
    expect(holdsPocket('melody')).toBe(false)
    expect(holdsPocket('chord')).toBe(false)
    expect(holdsPocket('texture')).toBe(false)
  })

  it('leaves every multiplier untouched when Beat Mode is off', () => {
    expect(beatModeMultiplier(false, 'drums', 0.3)).toBe(0.3)
    expect(beatModeMultiplier(false, 'bass', 0)).toBe(0)
    expect(beatModeMultiplier(false, 'chord', 0.8)).toBe(0.8)
  })

  it('pins drums and bass to full through a ducking section', () => {
    // A breakdown slot ducks drums hard and can request a full dropout.
    expect(beatModeMultiplier(true, 'drums', 0.28)).toBe(1)
    expect(beatModeMultiplier(true, 'bass', 0.4)).toBe(1)
    // A dropout slot asks for silence; the floor must survive it.
    expect(beatModeMultiplier(true, 'drums', 0)).toBe(1)
  })

  it('still lets the section move the melodic parts — a drop must feel like a drop', () => {
    expect(beatModeMultiplier(true, 'melody', 0.35)).toBe(0.35)
    expect(beatModeMultiplier(true, 'chord', 0.5)).toBe(0.5)
    expect(beatModeMultiplier(true, 'texture', 0.4)).toBe(0.4)
  })

  it('pins drum pattern density so the thinning filter never strips the hats', () => {
    // Below 0.45 the rebuild filter keeps only kick+snare.
    expect(beatModeDrumDensity(true, 0.3)).toBe(1)
    expect(beatModeDrumDensity(true, 0)).toBe(1)
    expect(beatModeDrumDensity(false, 0.3)).toBe(0.3)
  })
})
