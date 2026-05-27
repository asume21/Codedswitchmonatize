import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import { createToneMock, mockPartStart } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { ChordGenerator } from '../ChordGenerator'
import { getConductor, resetConductor } from '../../conductor/Conductor'

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Smoke, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 43, voiceActive: false,
    ...overrides,
  }
}

describe('ChordGenerator (Phase 4 — passive Conductor reader)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetConductor()
  })

  it('builds a Part on first Flow transition (read from Conductor)', () => {
    const gen = new ChordGenerator()
    gen.onStateTransition(OState.Flow, makePhysics())
    expect(mockPartStart).toHaveBeenCalledTimes(1)
  })

  it('onSectionChange does NOT rotate progression — Orchestrator owns that now', () => {
    const gen = new ChordGenerator()
    gen.onStateTransition(OState.Flow, makePhysics())
    expect(mockPartStart).toHaveBeenCalledTimes(1)
    gen.onSectionChange('verse')
    // Section change only swaps technique — no Part rebuild without a
    // conductor.pickNewProgression() driven by the Orchestrator.
    expect(mockPartStart).toHaveBeenCalledTimes(1)
  })

  it('delegates pickNewProgression to the Conductor', () => {
    const gen = new ChordGenerator()
    const conductor = getConductor()
    const spy = vi.spyOn(conductor, 'pickNewProgression')
    gen.pickNewProgression()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('delegates lock/unlock to the Conductor', () => {
    const gen = new ChordGenerator()
    const conductor = getConductor()
    gen.lockProgression()
    expect(conductor.isProgressionLocked()).toBe(true)
    gen.unlockProgression()
    expect(conductor.isProgressionLocked()).toBe(false)
  })
})
