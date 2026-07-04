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

import { shapePerformanceDynamics } from '../performerExpression'
import type { ScheduledNote } from '../../types'

function flatPhrase(n = 8, vel = 0.7): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  for (let i = 0; i < n; i++) {
    const sixteenth = i * 2
    const beat = Math.floor(sixteenth / 4)
    const sub = sixteenth % 4
    notes.push({ pitch: 'C4', duration: '8n', velocity: vel, time: `0:${beat}:${sub}` })
  }
  return notes
}

describe('shapePerformanceDynamics', () => {
  it('is non-destructive: same count, pitches, and timing', () => {
    const input = flatPhrase()
    const out = shapePerformanceDynamics(input, { peakPosition: 0.66 })
    expect(out).toHaveLength(input.length)
    expect(out.map(n => n.pitch)).toEqual(input.map(n => n.pitch))
    expect(out.map(n => n.time)).toEqual(input.map(n => n.time))
  })

  it('shapes an arch — the peak sits past the middle, edges are softer', () => {
    const out = shapePerformanceDynamics(flatPhrase(9, 0.7), { peakPosition: 0.66 })
    const vels = out.map(n => n.velocity)
    const peakIdx = vels.indexOf(Math.max(...vels))
    expect(peakIdx).toBeGreaterThan(2)
    expect(peakIdx).toBeLessThan(vels.length - 1)
    expect(vels[0]).toBeLessThan(vels[peakIdx])
    expect(vels[vels.length - 1]).toBeLessThan(vels[peakIdx])
  })

  it('keeps velocities within [0,1] even with hot input + accents', () => {
    const out = shapePerformanceDynamics(flatPhrase(8, 0.98), { peakPosition: 0.66, downbeatAccent: 0.3 })
    for (const n of out) {
      expect(n.velocity).toBeGreaterThanOrEqual(0)
      expect(n.velocity).toBeLessThanOrEqual(1)
    }
  })

  it('accents downbeats when downbeatAccent is set', () => {
    const notes: ScheduledNote[] = [
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:0' }, // downbeat
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:1' }, // off-beat
    ]
    const out = shapePerformanceDynamics(notes, { peakPosition: 0.66, downbeatAccent: 0.12 })
    expect(out[0].velocity).toBeGreaterThan(out[1].velocity)
  })

  it('does not accent when downbeatAccent is omitted (default 0)', () => {
    const notes: ScheduledNote[] = [
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:0' },
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:1' },
    ]
    const out = shapePerformanceDynamics(notes, { peakPosition: 0.66 })
    expect(out[0].velocity).toBe(out[1].velocity)
  })
})
