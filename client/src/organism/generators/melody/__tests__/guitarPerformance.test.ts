import { describe, expect, it } from 'vitest'
import { shapeGuitarDynamics } from '../guitarPerformance'
import type { ScheduledNote } from '../../types'

// A flat 8-note phrase on a 16th grid (every other 16th), all velocity 0.7.
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

describe('shapeGuitarDynamics', () => {
  it('is non-destructive: same count, pitches, and timing', () => {
    const input = flatPhrase()
    const out = shapeGuitarDynamics(input)
    expect(out).toHaveLength(input.length)
    expect(out.map(n => n.pitch)).toEqual(input.map(n => n.pitch))
    expect(out.map(n => n.time)).toEqual(input.map(n => n.time))
  })

  it('turns a flat phrase into a dynamic one (velocities are no longer all equal)', () => {
    const out = shapeGuitarDynamics(flatPhrase())
    const distinct = new Set(out.map(n => Math.round(n.velocity * 100)))
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('shapes an arch — the peak sits past the middle, edges are softer', () => {
    const out = shapeGuitarDynamics(flatPhrase(9, 0.7))
    const vels = out.map(n => n.velocity)
    const peakIdx = vels.indexOf(Math.max(...vels))
    // Arch peaks ~2/3 through, not at the very start or end.
    expect(peakIdx).toBeGreaterThan(2)
    expect(peakIdx).toBeLessThan(vels.length - 1)
    // Both ends are softer than the peak.
    expect(vels[0]).toBeLessThan(vels[peakIdx])
    expect(vels[vels.length - 1]).toBeLessThan(vels[peakIdx])
  })

  it('keeps velocities within [0,1] even with hot input + accents', () => {
    const out = shapeGuitarDynamics(flatPhrase(8, 0.98))
    for (const n of out) {
      expect(n.velocity).toBeGreaterThanOrEqual(0)
      expect(n.velocity).toBeLessThanOrEqual(1)
    }
  })

  it('accents downbeats louder than the adjacent off-beat at a similar phrase position', () => {
    // Build two adjacent notes: one on a downbeat (sixteenthPos 0), one off (pos 1).
    const notes: ScheduledNote[] = [
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:0' }, // downbeat
      { pitch: 'C4', duration: '16n', velocity: 0.6, time: '0:0:1' }, // off-beat
    ]
    const out = shapeGuitarDynamics(notes, { depth: 0 }) // depth 0 isolates the accent
    expect(out[0].velocity).toBeGreaterThan(out[1].velocity)
  })
})
