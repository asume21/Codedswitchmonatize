import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createToneMock } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import * as Tone from 'tone'
import { getLivePartStart, msUntilTransportTime, quantizeGridTime, resetLivePartStartCacheForTests } from '../CompositionClock'

describe('CompositionClock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLivePartStartCacheForTests()
    const transport = Tone.getTransport()
    transport.state = 'stopped'
    transport.bpm.value = 90
    transport.ticks = 0
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

  it('returns the rebuild target in the tick domain, immune to bpm automation', () => {
    // Regression: Part.start(<seconds>) converts seconds→ticks at the CURRENT bpm
    // only, while transport.seconds integrates the bpm automation curve. After a
    // preset swap's bpm.rampTo every seconds-scheduled part landed ~5–6s late and
    // was disposed before its first event fired. Ticks ("<n>i") are exact.
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 120
    transport.ticks = 2000             // ticksPerBar = 192*4 = 768 → mid bar 2
    // Even if the AudioContext clock has drifted far ahead, the result must be
    // tick-based — not Tone.now()- or seconds-based.
    vi.mocked(Tone.now).mockReturnValue(9999)

    // next downbeat = ceil(2000/768) * 768 = 3 * 768 = 2304
    expect(getLivePartStart(true)).toBe('2304i')
  })

  it('shares one live rebuild target across staggered generator rebuilds', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 120
    transport.ticks = 2000

    const first = getLivePartStart(true)
    expect(first).toBe('2304i')

    // A staggered rebuild milliseconds later (transport advanced) must reuse the
    // SAME target so drums/bass/melody/chord all enter on one downbeat.
    transport.ticks = 2100
    expect(getLivePartStart(true)).toBe(first)
  })

  it('pushes a too-close downbeat one bar later so the full rebuild batch lands together', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 120
    // minLead = 0.25s * (120/60) * 192 = 96 ticks. 50 ticks to the downbeat at
    // 2304 is under the lead → push one bar later: 2304 + 768 = 3072.
    transport.ticks = 2254
    expect(getLivePartStart(true)).toBe('3072i')
  })

  it('msUntilTransportTime converts a ticks target to wall-clock ms at current bpm', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 120
    transport.ticks = 2000
    // (2304 − 2000) / 192 quarter notes * 0.5 s/quarter = 0.79167 s
    expect(msUntilTransportTime('2304i')).toBeCloseTo(791.67, 1)
    // Numeric (seconds) input still supported for legacy callers.
    transport.seconds = 5
    expect(msUntilTransportTime(6.5)).toBeCloseTo(1500, 5)
    // Past boundaries clamp to 0.
    expect(msUntilTransportTime('100i')).toBe(0)
  })
})
