import { describe, expect, it } from 'vitest'
import { keepAtDensity, OPEN_HAT_VELOCITY_SPLIT } from '../DrumGenerator'
import { DrumInstrument, type DrumHit } from '../types'

const hit = (instrument: DrumInstrument, velocity = 0.4): DrumHit =>
  ({ instrument, time: '0:0:0', velocity })

describe('drum section density ladder', () => {
  it('keeps the whole pattern at drop/build density', () => {
    for (const inst of [DrumInstrument.Kick, DrumInstrument.Snare, DrumInstrument.Hat, DrumInstrument.Perc]) {
      expect(keepAtDensity(hit(inst), 0.9)).toBe(true)
    }
  })

  it('drops only perc at verse density', () => {
    expect(keepAtDensity(hit(DrumInstrument.Perc), 0.6)).toBe(false)
    expect(keepAtDensity(hit(DrumInstrument.Kick), 0.6)).toBe(true)
    expect(keepAtDensity(hit(DrumInstrument.Snare), 0.6)).toBe(true)
    expect(keepAtDensity(hit(DrumInstrument.Hat, 0.24), 0.6)).toBe(true)
  })

  describe('sparse sections (intro / breakdown)', () => {
    it('keeps the backbeat', () => {
      expect(keepAtDensity(hit(DrumInstrument.Kick), 0.3)).toBe(true)
      expect(keepAtDensity(hit(DrumInstrument.Snare), 0.3)).toBe(true)
    })

    it('KEEPS the closed-hat pulse — the hats are the motion', () => {
      // The regression this guards: the sparse tier used to strip every hat,
      // leaving a kick+snare skeleton that reads as broken, not sparse.
      expect(keepAtDensity(hit(DrumInstrument.Hat, 0.24), 0.3)).toBe(true)
      expect(keepAtDensity(hit(DrumInstrument.Hat, 0.48), 0.3)).toBe(true)
      expect(keepAtDensity(hit(DrumInstrument.Hat, OPEN_HAT_VELOCITY_SPLIT), 0.3)).toBe(true)
    })

    it('drops the decoration — perc and open-hat accents', () => {
      expect(keepAtDensity(hit(DrumInstrument.Perc), 0.3)).toBe(false)
      // Open hats are pushed at 0.68 by the improviser.
      expect(keepAtDensity(hit(DrumInstrument.Hat, 0.68), 0.3)).toBe(false)
    })
  })
})
