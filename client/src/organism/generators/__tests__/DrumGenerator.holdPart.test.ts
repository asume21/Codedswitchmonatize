import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createToneMock, mockPartDispose, mockPartClear, mockPartStart } from './__mocks__/toneMock'
vi.mock('tone', () => createToneMock())
import { DrumGenerator } from '../DrumGenerator'
import { DrumInstrument } from '../types'

// A minimal two-bar pattern. Drums loop at a fixed 4m, so a rebuild can ALWAYS
// mutate in place — there is no variable loop length to invalidate the Part.
const pattern = (vel: number) => [
  { instrument: DrumInstrument.Kick,  time: '0:0:0', velocity: vel },
  { instrument: DrumInstrument.Snare, time: '0:1:0', velocity: vel },
  { instrument: DrumInstrument.Kick,  time: '0:2:0', velocity: vel },
  { instrument: DrumInstrument.Snare, time: '0:3:0', velocity: vel },
]

describe('DrumGenerator holds its Part across rebuilds', () => {
  beforeEach(() => {
    mockPartDispose.mockClear(); mockPartClear.mockClear(); mockPartStart.mockClear()
  })

  it('first build creates+starts a Part; a second rebuild mutates in place (no dispose)', () => {
    const drum = new DrumGenerator()
    drum.setEnabled(true)

    // First build — the one grid-aligned start. Bypass the 900ms rebuild
    // throttle explicitly: it compares against performance.now(), so whether a
    // fresh generator's first load passes depends on how long the test process
    // has been alive. Pinning it keeps this deterministic.
    ;(drum as any).lastRebuildTime = -Infinity
    drum.loadGeneratedPattern(pattern(0.9))
    expect(mockPartStart).toHaveBeenCalledTimes(1)
    const disposesAfterFirst = mockPartDispose.mock.calls.length

    // Bypass the 900ms rebuild throttle and load a different pattern.
    ;(drum as any).lastRebuildTime = -Infinity
    drum.loadGeneratedPattern(pattern(0.6))

    // The second rebuild must MUTATE, not dispose+recreate.
    expect(mockPartClear).toHaveBeenCalled()
    expect(mockPartDispose.mock.calls.length).toBe(disposesAfterFirst) // no new dispose
    expect(mockPartStart).toHaveBeenCalledTimes(1)                     // no re-start
  })
})
