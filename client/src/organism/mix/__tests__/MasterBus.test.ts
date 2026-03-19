import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMixToneMock, mockGainRampTo, mockDispose } from './__mocks__/toneMixMock'

vi.mock('tone', () => createMixToneMock())

import { MasterBus } from '../channels/MasterBus'

describe('MasterBus', () => {
  let bus: MasterBus

  beforeEach(() => {
    vi.clearAllMocks()
    bus = new MasterBus(0, -1.0, 0.15)
  })

  it('constructs without error', () => {
    expect(bus).toBeDefined()
  })

  it('getMeter() returns -Infinity on silence', () => {
    const meter = bus.getMeter()
    expect(meter.peakDb).toBe(-Infinity)
    expect(meter.rmsDb).toBe(-Infinity)
  })

  it('setGainDb() ramps without error', () => {
    expect(() => bus.setGainDb(-6)).not.toThrow()
    expect(mockGainRampTo).toHaveBeenCalled()
  })

  it('saturation amount 0 → constructs without error', () => {
    vi.clearAllMocks()
    const bus0 = new MasterBus(0, -1.0, 0)
    expect(bus0).toBeDefined()
    // Verify getMeter still works
    const meter = bus0.getMeter()
    expect(meter.peakDb).toBe(-Infinity)
    bus0.dispose()
  })

  it('dispose() cleans up all nodes', () => {
    expect(() => bus.dispose()).not.toThrow()
    // 5 nodes: input, masterGain, saturator, limiter, analyser
    expect(mockDispose).toHaveBeenCalledTimes(5)
  })
})
