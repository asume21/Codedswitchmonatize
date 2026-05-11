import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createToneMock } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import * as Tone from 'tone'
import { getLivePartStart, quantizeGridTime } from '../CompositionClock'

describe('CompositionClock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('quantizes sloppy transport positions to the nearest 16th slot', () => {
    expect(quantizeGridTime('0:1:1.48')).toBe('0:1:1')
    expect(quantizeGridTime('0:1:1.51')).toBe('0:1:2')
    expect(quantizeGridTime('0:1:3.8')).toBe('0:2:0')
    expect(quantizeGridTime('5:0:0', 4)).toBe('3:3:3')
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
})
