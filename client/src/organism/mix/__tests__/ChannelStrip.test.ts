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

  it('dispose() cleans up all Tone.js nodes without error', () => {
    expect(() => strip.dispose()).not.toThrow()
    // 6 nodes: input, compressor, panner, fader, analyser, output
    expect(mockDispose).toHaveBeenCalledTimes(6)
  })
})
