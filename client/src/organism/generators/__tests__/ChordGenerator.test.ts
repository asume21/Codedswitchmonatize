import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import { createToneMock, mockPartStart } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { ChordGenerator } from '../ChordGenerator'

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Smoke, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 43, voiceActive: false,
    ...overrides,
  }
}

describe('ChordGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rotates and rebuilds the progression on section changes', () => {
    const gen = new ChordGenerator()

    gen.onStateTransition(OState.Flow, makePhysics())
    expect(mockPartStart).toHaveBeenCalledTimes(1)

    gen.onSectionChange('verse')

    expect(mockPartStart).toHaveBeenCalledTimes(2)
  })
})
