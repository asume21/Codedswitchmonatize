import { describe, expect, it } from 'vitest'
import { getPerformerExpressionConfig, isSustainedPitch, sixteenthPosOf } from '../performerExpression'

describe('getPerformerExpressionConfig', () => {
  it('returns the tuned config for each known family', () => {
    expect(getPerformerExpressionConfig('bowed')).toEqual({
      peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true, vibratoDepthCap: 0.35,
    })
    expect(getPerformerExpressionConfig('wind')).toEqual({
      peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true, vibratoDepthCap: 0.35,
    })
    expect(getPerformerExpressionConfig('brass')).toEqual({
      peakPosition: 0.72, restDensityMultiplier: 0.6, octaveRecastEnabled: true, vibratoDepthCap: 0.22,
    })
    expect(getPerformerExpressionConfig('keyboard')).toEqual({
      peakPosition: 0.60, restDensityMultiplier: 1.4, octaveRecastEnabled: false, vibratoDepthCap: null,
    })
    expect(getPerformerExpressionConfig('plucked')).toEqual({
      peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true, vibratoDepthCap: null,
    })
    expect(getPerformerExpressionConfig('synth')).toEqual({
      peakPosition: 0.66, restDensityMultiplier: 1.0, octaveRecastEnabled: true, vibratoDepthCap: null,
    })
  })

  it('falls back to the synth (neutral) config for an unknown or undefined family', () => {
    const synthConfig = getPerformerExpressionConfig('synth')
    expect(getPerformerExpressionConfig('made-up-family')).toEqual(synthConfig)
    expect(getPerformerExpressionConfig(undefined)).toEqual(synthConfig)
  })
})

describe('isSustainedPitch', () => {
  it('is true for bowed, wind, and brass', () => {
    expect(isSustainedPitch('bowed')).toBe(true)
    expect(isSustainedPitch('wind')).toBe(true)
    expect(isSustainedPitch('brass')).toBe(true)
  })

  it('is false for keyboard, plucked, synth, unknown, and undefined', () => {
    expect(isSustainedPitch('keyboard')).toBe(false)
    expect(isSustainedPitch('plucked')).toBe(false)
    expect(isSustainedPitch('synth')).toBe(false)
    expect(isSustainedPitch('made-up-family')).toBe(false)
    expect(isSustainedPitch(undefined)).toBe(false)
  })
})

describe('sixteenthPosOf', () => {
  it('resolves a bar:beat:sub time string to a 0..15 sixteenth-grid position', () => {
    expect(sixteenthPosOf('0:0:0')).toBe(0)
    expect(sixteenthPosOf('0:1:0')).toBe(4)
    expect(sixteenthPosOf('0:3:3')).toBe(15)
    expect(sixteenthPosOf('2:2:1')).toBe(9) // bars ignored — position is within-bar
  })
})
