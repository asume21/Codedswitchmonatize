import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMixToneMock, mockGainRampTo, mockPanRampTo, mockDispose } from './__mocks__/toneMixMock'

vi.mock('tone', () => createMixToneMock())

import { ChannelStrip } from '../channels/ChannelStrip'
import { DEFAULT_MIX_CONFIG } from '../types'

describe('ChannelStrip', () => {
  let strip: ChannelStrip

  beforeEach(() => {
    vi.clearAllMocks()
    strip = new ChannelStrip(DEFAULT_MIX_CONFIG.channels.drum)
  })

  it('constructs without error with DEFAULT_MIX_CONFIG channel settings', () => {
    expect(strip).toBeDefined()
    expect(strip.name).toBe('drum')
  })

  it('getMeter() returns peakDb=-Infinity, rmsDb=-Infinity on silence', () => {
    const meter = strip.getMeter()
    expect(meter.peakDb).toBe(-Infinity)
    expect(meter.rmsDb).toBe(-Infinity)
  })

  it('setGainDb(-6) changes fader gain without error', () => {
    expect(() => strip.setGainDb(-6)).not.toThrow()
    expect(mockGainRampTo).toHaveBeenCalled()
  })

  it('setPan(0.5) clamps to valid range, no error', () => {
    expect(() => strip.setPan(0.5)).not.toThrow()
    expect(mockPanRampTo).toHaveBeenCalledWith(0.5, 0.1)
  })

  it('setPan(2.0) clamps to 1.0', () => {
    strip.setPan(2.0)
    expect(mockPanRampTo).toHaveBeenCalledWith(1, 0.1)
  })

  // The four measured gaps against audio/reference-beats are SPECTRAL (sub 5% vs
  // 8.7%, lowMid 51% vs 32%, high 13% vs 22%), but the only runtime knobs were
  // gain, brightness and parallel compression — so the sub and low-mid gaps could
  // not be blind-A/B'd at all. These setters exist to make them testable by ear.
  describe('setEqGainDb — runtime EQ for blind A/B', () => {
    it('sets the low shelf gain', () => {
      strip.setEqGainDb('low', 6)
      expect(strip.getEqGainDb('low')).toBe(6)
    })

    it('sets the mid peak gain independently of the low shelf', () => {
      strip.setEqGainDb('low', 6)
      strip.setEqGainDb('mid', -8)
      expect(strip.getEqGainDb('mid')).toBe(-8)
      expect(strip.getEqGainDb('low')).toBe(6)
    })

    it('sets the high shelf gain', () => {
      strip.setEqGainDb('high', 4)
      expect(strip.getEqGainDb('high')).toBe(4)
    })

    it('clamps to +/-24 dB so a typo cannot destroy the mix', () => {
      strip.setEqGainDb('low', 900)
      expect(strip.getEqGainDb('low')).toBe(24)
      strip.setEqGainDb('low', -900)
      expect(strip.getEqGainDb('low')).toBe(-24)
    })

    it('ignores a non-finite value rather than writing NaN into the graph', () => {
      strip.setEqGainDb('low', 5)
      strip.setEqGainDb('low', Number.NaN)
      expect(strip.getEqGainDb('low')).toBe(5)
    })
  })

  it('dispose() cleans up all Tone.js nodes without error', () => {
    expect(() => strip.dispose()).not.toThrow()
    // 10 nodes: input, highpass, lowShelf, midPeak, highShelf, compressor, panner, fader, analyser, output
    expect(mockDispose).toHaveBeenCalledTimes(10)
  })
})
