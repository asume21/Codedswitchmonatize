import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import { createToneMock, mockPartStart } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { ChordGenerator } from '../ChordGenerator'
import { getConductor, resetConductor } from '../../conductor/Conductor'
import * as Tone from 'tone'

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Smoke, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 43, voiceActive: false,
    ...overrides,
  }
}

function makeOrganism(overrides: Partial<import('../../state/types').OrganismState> = {}): import('../../state/types').OrganismState {
  return {
    current: OState.Flow,
    previous: OState.Breathing,
    framesInState: 100,
    msInState: 2300,
    barsInState: 2,
    awakeningProgress: 1,
    breathingWarmth: 0.8,
    flowDepth: 0.6,
    syllabicDensity: 0,
    cadenceLockBars: 0,
    cadenceLockAchieved: true,
    silenceDurationMs: 0,
    lastTransitionPhysics: null,
    timestamp: 1000,
    frameIndex: 43,
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

  it('keeps conductor chord dirty until a throttled rebuild actually runs', () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy.mockReturnValue(1000)

    try {
      const gen = new ChordGenerator()
      const physics = makePhysics()
      const organism = makeOrganism()
      gen.onStateTransition(OState.Flow, physics)

      vi.clearAllMocks()
      getConductor().advanceChord()
      expect(mockPartStart).not.toHaveBeenCalled()
      expect((gen as any).conductorChordDirty).toBe(true)

      nowSpy.mockReturnValue(1001)
      gen.processFrame(physics, organism)
      expect(mockPartStart).not.toHaveBeenCalled()
      expect((gen as any).conductorChordDirty).toBe(true)

      nowSpy.mockReturnValue(1600)
      gen.processFrame(physics, organism)
      expect(mockPartStart).toHaveBeenCalled()
      expect((gen as any).conductorChordDirty).toBe(false)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('freeplay ignores section technique automation so the comp plan owns the rhythm', () => {
    const gen = new ChordGenerator()
    const physics = makePhysics({ mode: OrganismMode.Smoke })
    const organism = makeOrganism()

    gen.onSectionChange('verse')
    gen.onStateTransition(OState.Flow, physics)
    gen.processFrame(physics, organism)

    expect(gen.getTechnique()).toBe('piano-block-chord')
  })

  it('freeplay uses a 4-bar comp loop instead of a tiny 2-bar cell', () => {
    const gen = new ChordGenerator()
    gen.onStateTransition(OState.Flow, makePhysics({ mode: OrganismMode.Smoke }))

    const partMock = Tone.Part as unknown as {
      mock: { instances: Array<{ loopEnd: string }> }
    }
    const part = partMock.mock.instances.at(-1)
    expect(part?.loopEnd).toBe('4m')
  })

  it('authored mode still applies section technique automation', () => {
    const gen = new ChordGenerator()
    const physics = makePhysics({ mode: OrganismMode.Smoke })
    const organism = makeOrganism()

    gen.setFreeplay(false)
    gen.onSectionChange('verse')
    gen.onStateTransition(OState.Flow, physics)
    gen.processFrame(physics, organism)

    expect(gen.getTechnique()).toBe('piano-rolled-chord')
  })
})
