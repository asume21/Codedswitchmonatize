import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createToneMock, mockPartDispose, mockPartClear, mockPartStart } from './__mocks__/toneMock'
vi.mock('tone', () => createToneMock())
import { BassGenerator } from '../BassGenerator'
import { OState } from '../../state/types'

// A physics snapshot dense enough that generateNotes returns notes.
// OState.Flow is a real enum member; OState.Playing does NOT exist. Flow falls
// through onStateTransition's Dormant/Awakening guards to the generic rebuild
// branch and yields a valid computeTargetLevel.
const physics = () => ({ mode: 'flow', pocket: 0.3, density: 0.6, flowDepth: 0.4 } as any)
const organism = () => ({ current: OState.Flow, flowDepth: 0.4 } as any)

describe('BassGenerator holds its Part across rebuilds', () => {
  beforeEach(() => {
    mockPartDispose.mockClear(); mockPartClear.mockClear(); mockPartStart.mockClear()
  })

  it('first build creates+starts a Part; a second rebuild mutates in place (no dispose)', () => {
    const bass = new BassGenerator()
    bass.setEnabled(true)

    // First build — a real start.
    bass.onStateTransition(OState.Flow, physics())
    expect(mockPartStart).toHaveBeenCalledTimes(1)
    const disposesAfterFirst = mockPartDispose.mock.calls.length

    // Force a second rebuild by changing behavior (bypass the throttle).
    ;(bass as any).lastRebuildTime = -Infinity
    ;(bass as any).currentBehavior = 'FORCE_DIFFERENT'
    bass.processFrame(physics(), organism())

    // The second rebuild must MUTATE, not dispose+recreate.
    expect(mockPartClear).toHaveBeenCalled()
    expect(mockPartDispose.mock.calls.length).toBe(disposesAfterFirst) // no new dispose
    expect(mockPartStart).toHaveBeenCalledTimes(1)                     // no re-start
  })
})
