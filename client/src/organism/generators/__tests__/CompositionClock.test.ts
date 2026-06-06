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

  it('returns the rebuild target in the Transport seconds domain, not AudioContext time', () => {
    // Regression: Part.start()/stop() expect a TransportTime (transport.seconds),
    // NOT an AudioContext time. The old code returned transport.nextSubdivision(),
    // which is AudioContext-absolute, so once the two clocks diverged every rebuilt
    // part was scheduled tens of seconds into the transport future and never fired.
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 120          // secondsPerBar = 2.0
    transport.seconds = 5.0            // transport timeline position (seconds)
    transport.position = '2:2:0'       // halfway through the bar → fraction 0.5
    // Even if the AudioContext clock has drifted far ahead, the result must track
    // transport.seconds — not Tone.now().
    vi.mocked(Tone.now).mockReturnValue(9999)

    // secondsToNextBar = (1 − 0.5) * 2.0 = 1.0 → startAt = 5.0 + 1.0 = 6.0
    expect(getLivePartStart(true)).toBeCloseTo(6.0)
  })

  it('derives time-to-next-bar from musical position, immune to seconds/position drift', () => {
    // After a mid-session tempo change, transport.seconds and the bar grid diverge.
    // Quantizing raw seconds would land off-grid; using the position fraction does not.
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 90           // secondsPerBar = (60/90)*4 = 2.6667
    transport.seconds = 534.2          // wildly out of step with a fresh bar grid
    transport.position = '218:2:0'     // fraction 0.5 into the current bar
    // secondsToNextBar = (1 − 0.5) * 2.6667 = 1.3333 → startAt = 534.2 + 1.3333
    expect(getLivePartStart(true)).toBeCloseTo(535.5333, 3)
  })

  it('shares one live rebuild target across staggered generator rebuilds', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 120          // secondsPerBar = 2.0
    transport.seconds = 5.0
    transport.position = '2:2:0'

    const first = getLivePartStart(true)
    expect(first).toBeCloseTo(6.0)

    // A staggered rebuild milliseconds later (transport advanced) must reuse the
    // SAME target so drums/bass/melody/chord all enter on one downbeat.
    transport.seconds = 5.3
    transport.position = '2:2:2'
    expect(getLivePartStart(true)).toBe(first)
  })

  it('pushes a too-close downbeat one bar later so the full rebuild batch lands together', () => {
    const transport = Tone.getTransport()
    transport.state = 'started'
    transport.bpm.value = 120          // secondsPerBar = 2.0
    transport.seconds = 11.9
    // 3:3.9 → fraction ≈ 0.994 into the bar → ~0.0125s to the next downbeat, under
    // the 0.25 lead, so we push one bar: secondsToNextBar ≈ 0.0125 + 2.0 = 2.0125.
    transport.position = '5:3:3.9'
    expect(getLivePartStart(true)).toBeCloseTo(13.9125, 3)
  })
})
