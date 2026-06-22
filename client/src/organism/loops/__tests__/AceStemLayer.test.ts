import { describe, it, expect, vi } from 'vitest'
import { createToneMock } from '../../generators/__tests__/__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { computeStemPlaybackRate, AceStemLayer } from '../AceStemLayer'

describe('computeStemPlaybackRate — tempo-match an ACE stem to the session', () => {
  it('returns 1 when either bpm is unknown/zero (no safe ratio to compute)', () => {
    expect(computeStemPlaybackRate(0, 90)).toBe(1)
    expect(computeStemPlaybackRate(90, 0)).toBe(1)
  })

  it('matches the session tempo by ratio', () => {
    expect(computeStemPlaybackRate(90, 90)).toBe(1)
    expect(computeStemPlaybackRate(80, 120)).toBeCloseTo(1.5)
    expect(computeStemPlaybackRate(120, 60)).toBeCloseTo(0.5)
  })

  it('clamps to +/- one octave so a far-off stem never chipmunks or slurs to garbage', () => {
    expect(computeStemPlaybackRate(60, 200)).toBe(2)    // raw 3.33 -> clamp 2
    expect(computeStemPlaybackRate(200, 60)).toBe(0.5)  // raw 0.30 -> clamp 0.5
  })
})

describe('AceStemLayer — lifecycle', () => {
  it('constructs without an output node and starts empty + not playing', () => {
    const layer = new AceStemLayer()
    expect(layer.getStemNames()).toEqual([])
    expect(layer.isPlaying()).toBe(false)
    layer.dispose()
  })

  it('mute/level are no-ops on an unknown stem (never throws)', () => {
    const layer = new AceStemLayer()
    expect(() => layer.setStemMuted('drums', true)).not.toThrow()
    expect(() => layer.setStemLevel('bass', 0.5)).not.toThrow()
    expect(layer.isStemMuted('drums')).toBe(false)
    layer.dispose()
  })
})
