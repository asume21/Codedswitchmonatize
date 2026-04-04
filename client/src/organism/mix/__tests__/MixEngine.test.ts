import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createMixToneMock, mockGainRampTo, mockPanRampTo, mockDispose } from './__mocks__/toneMixMock'

vi.mock('tone', () => createMixToneMock())

import { MixEngine } from '../MixEngine'
import type { MixMeterReading } from '../types'

function createMockOrchestrator() {
  return {
    connectDrumOutput:         vi.fn(),
    connectBassOutput:         vi.fn(),
    connectMelodyOutput:       vi.fn(),
    connectTextureOutput:      vi.fn(),
    connectChordOutput:        vi.fn(),
    setKickSidechainCallback:  vi.fn(),
  }
}

describe('MixEngine', () => {
  let engine: MixEngine

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    engine = new MixEngine({ meterIntervalMs: 100 })
  })

  afterEach(() => {
    engine.dispose()
    vi.useRealTimers()
  })

  it('constructs with all 5 channel strips + master bus', () => {
    expect(engine.drumChannel).toBeDefined()
    expect(engine.bassChannel).toBeDefined()
    expect(engine.melodyChannel).toBeDefined()
    expect(engine.textureChannel).toBeDefined()
    expect(engine.chordChannel).toBeDefined()
    expect(engine.master).toBeDefined()
  })

  it('wire(orchestrator) connects all 5 channels without error', () => {
    const mockOrch = createMockOrchestrator()
    expect(() => {
      engine.wire(mockOrch as unknown as import('../../generators/GeneratorOrchestrator').GeneratorOrchestrator)
    }).not.toThrow()

    expect(mockOrch.connectDrumOutput).toHaveBeenCalledOnce()
    expect(mockOrch.connectBassOutput).toHaveBeenCalledOnce()
    expect(mockOrch.connectMelodyOutput).toHaveBeenCalledOnce()
    expect(mockOrch.connectTextureOutput).toHaveBeenCalledOnce()
    expect(mockOrch.connectChordOutput).toHaveBeenCalledOnce()
  })

  it('startMetering() begins emitting MixMeterReading at meterIntervalMs', () => {
    const cb = vi.fn()
    engine.onMeter(cb)
    engine.startMetering()

    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('onMeter(cb) fires callback with correct structure', () => {
    let reading: MixMeterReading | null = null
    engine.onMeter((r) => { reading = r })
    engine.startMetering()

    vi.advanceTimersByTime(100)

    expect(reading).not.toBeNull()
    expect(reading!.channels.drum).toBeDefined()
    expect(reading!.channels.bass).toBeDefined()
    expect(reading!.channels.melody).toBeDefined()
    expect(reading!.channels.texture).toBeDefined()
    expect(reading!.channels.drum.name).toBe('drum')
    expect(typeof reading!.masterPeakDb).toBe('number')
    expect(typeof reading!.masterRmsDb).toBe('number')
    expect(typeof reading!.timestamp).toBe('number')
  })

  it('setChannelGainDb applies to bass channel only', () => {
    vi.clearAllMocks()
    engine.setChannelGainDb('bass', -12)
    expect(mockGainRampTo).toHaveBeenCalled()
  })

  it('setChannelPan applies to melody channel only', () => {
    vi.clearAllMocks()
    engine.setChannelPan('melody', 0.3)
    expect(mockPanRampTo).toHaveBeenCalledWith(0.3, 0.1)
  })

  it('dispose() stops metering and disposes all nodes', () => {
    engine.startMetering()
    const cb = vi.fn()
    engine.onMeter(cb)

    engine.dispose()

    vi.advanceTimersByTime(500)
    // No more meter callbacks after dispose
    expect(cb).not.toHaveBeenCalled()
    // Dispose called for all nodes
    expect(mockDispose).toHaveBeenCalled()
  })

  it('stopMetering() stops callbacks', () => {
    const cb = vi.fn()
    engine.onMeter(cb)
    engine.startMetering()

    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledTimes(1)

    engine.stopMetering()
    vi.advanceTimersByTime(500)
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
