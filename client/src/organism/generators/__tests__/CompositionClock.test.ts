import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createToneMock } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import * as Tone from 'tone'
import { getLivePartStart, quantizeGridTime, resetLivePartStartCacheForTests } from '../CompositionClock'

describe('CompositionClock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLivePartStartCacheForTests()
    const transport = Tone.getTransport()
    transport.state = 'stopped'
    transport.bpm.value = 90
    vi.mocked(transport.nextSubdivision).mockReset()
    vi.mocked(transport.nextSubdivision).mockReturnValue(0 as any)
    vi.mocked(Tone.now).mockReturnValue(0)
  })

  it('quantizes sloppy transport positions to the nearest 16th slot', () => {
    expect(quantizeGridTime('0:1:1.48')).toBe('0:1:1')
    expect(quantizeGridTime('0:1:1.51')).toBe('0:1:2')
    expect(quantizeGridTime('0:1:3.8')).toBe('0:2:0')
    expect(quantizeGridTime('5:0:0', 4)).toBe('1:0:0')
  })

  it('pre-rolls stopped parts from zero', () => {
    expect(getLivePartStart(false)).toBe(0)
  })

  it('starts first playback immediately even if shared transport is already running', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'

    expect(getLivePartStart(false)).toBe(0)
    expect(transport.nextSubdivision).not.toHaveBeenCalled()
  })

  it('starts live rebuilds on the next measure boundary', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'
    vi.mocked(transport.nextSubdivision).mockReturnValue('next-bar' as any)

    expect(getLivePartStart(true)).toBe('next-bar')
    expect(transport.nextSubdivision).toHaveBeenCalledWith('1m')
  })

  it('shares one live rebuild target across staggered generator rebuilds', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'
    vi.mocked(transport.nextSubdivision)
      .mockReturnValueOnce(12 as any)
      .mockReturnValueOnce(16 as any)

    expect(getLivePartStart(true)).toBe(12)
    expect(getLivePartStart(true)).toBe(12)
    expect(transport.nextSubdivision).toHaveBeenCalledTimes(1)
  })

  it('skips a too-close measure boundary so the full rebuild batch lands together', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 120
    vi.mocked(Tone.now).mockReturnValue(10)
    vi.mocked(transport.nextSubdivision).mockReturnValue(10.1 as any)

    expect(getLivePartStart(true)).toBeCloseTo(12.1)
  })
})
