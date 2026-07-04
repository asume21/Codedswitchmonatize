import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState } from '../../state/types'
import { GeneratorName, MelodyBehavior } from '../types'
import { createToneMock, mockPartStart } from './__mocks__/toneMock'
import * as Tone from 'tone'

vi.mock('tone', () => createToneMock())

import { MelodyGenerator, snapNoteToScale } from '../MelodyGenerator'
import { getMelodyBehavior } from '../patterns/MelodyPatternLibrary'
import { getConductor, resetConductor } from '../../conductor/Conductor'

// ── Helpers ─────────────────────────────────────────────────────────

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Glow, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 43, voiceActive: false,
    ...overrides,
  }
}

function makeOrganism(overrides: Partial<OrganismState> = {}): OrganismState {
  return {
    current: OState.Breathing, previous: OState.Awakening,
    framesInState: 100, msInState: 2300, barsInState: 2,
    awakeningProgress: 1, breathingWarmth: 0.6, flowDepth: 0,
    syllabicDensity: 1.5, cadenceLockBars: 0, cadenceLockAchieved: false,
    silenceDurationMs: 0, lastTransitionPhysics: null,
    timestamp: 1000, frameIndex: 43,
    ...overrides,
  }
}

describe('MelodyGenerator', () => {
  let gen: MelodyGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    resetConductor()
    gen = new MelodyGenerator()
  })

  it('starts with MelodyBehavior.Rest → no part created', () => {
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
    expect(report.name).toBe(GeneratorName.Melody)
    // No part should be started on construction
    expect(mockPartStart).not.toHaveBeenCalled()
  })

  it('voiceActive=false, flowDepth=0.35 → behavior = Respond', () => {
    const behavior = getMelodyBehavior(OrganismMode.Glow, false, 0.35)
    expect(behavior).toBe(MelodyBehavior.Respond)
  })

  it('voiceActive=true, flowDepth=0.1 → behavior = Hint', () => {
    const behavior = getMelodyBehavior(OrganismMode.Glow, true, 0.1)
    expect(behavior).toBe(MelodyBehavior.Hint)
  })

  it('voiceActive=false, flowDepth=0.8 → behavior = Lead', () => {
    const behavior = getMelodyBehavior(OrganismMode.Glow, false, 0.8)
    expect(behavior).toBe(MelodyBehavior.Lead)
  })

  it('behavior change triggers part rebuild', () => {
    const physics = makePhysics({ voiceActive: false })
    const organism = makeOrganism({ current: OState.Flow, flowDepth: 0.8 })

    // Need 2 frames to satisfy debounce (BEHAVIOR_DEBOUNCE_FRAMES = 2)
    gen.processFrame(physics, organism) // Frame 1: pending
    gen.processFrame(physics, organism) // Frame 2: committed + rebuild
    expect(mockPartStart).toHaveBeenCalled()
  })

  it('uses musical bar loop lengths instead of Tone tick loops', () => {
    const physics = makePhysics({ voiceActive: false })

    gen.onStateTransition(OState.Flow, physics)

    const partMock = Tone.Part as unknown as {
      mock: { instances: Array<{ loopEnd: string }> }
    }
    const part = partMock.mock.instances.at(-1)
    expect(part?.loopEnd).toMatch(/m$/)
    expect(part?.loopEnd).not.toMatch(/i$/)
  })

  it('fills lead phrases with repeated motifs instead of one short lick', () => {
    const physics = makePhysics({ voiceActive: false })

    gen.setInstrumentPerformer('piano')
    gen.onStateTransition(OState.Flow, physics)

    const partMock = Tone.Part as unknown as {
      mock: { calls: Array<[unknown, Array<unknown>]> }
    }
    const events = partMock.mock.calls.at(-1)?.[1] ?? []
    expect(events.length).toBeGreaterThan(3)
  })

  it('boosts selected lead sampler gain so melody stays audible in the full mix', () => {
    gen.setInstrumentPerformer('piano')

    const samplerMock = Tone.Sampler as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> }
    }
    const options = samplerMock.mock.calls.at(-1)?.[0]
    expect(options?.volume).toBe(-2)
  })

  it('keeps no-vocal lead phrase velocities above background level', () => {
    const physics = makePhysics({ voiceActive: false })

    gen.setInstrumentPerformer('piano')
    gen.onStateTransition(OState.Flow, physics)

    const partMock = Tone.Part as unknown as {
      mock: { calls: Array<[unknown, Array<{ vel: number }>]> }
    }
    const events = partMock.mock.calls.at(-1)?.[1] ?? []
    expect(Math.max(...events.map(event => event.vel))).toBeGreaterThan(0.5)
  })

  it('snaps wind ornament pitches back into the active scale', () => {
    const majorScale = [0, 2, 4, 5, 7, 9, 11]

    expect(snapNoteToScale('Bb3', 0, majorScale)).toBe('A3')
    expect(snapNoteToScale('C#4', 0, majorScale)).toBe('C4')
    expect(snapNoteToScale('D4', 0, majorScale)).toBe('D4')
  })

  it('onStateTransition to DORMANT stops part and zeros activity', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Breathing, physics)
    gen.onStateTransition(OState.Dormant, physics)

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })

  it('onStateTransition to FLOW rebuilds without throwing', () => {
    const physics = makePhysics({ mode: OrganismMode.Heat })
    expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()
  })

  it('keeps state-transition scale locked to the Conductor harmony', () => {
    const physics = makePhysics({ mode: OrganismMode.Smoke })

    gen.onStateTransition(OState.Flow, physics)

    expect((gen as any).currentScale).toEqual(getConductor().scaleIntervals())
    expect((gen as any).currentScale).not.toEqual([0, 3, 5, 6, 7, 10])
  })

  it('refreshes the next phrase on a Conductor chord advance', () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy.mockReturnValue(1000)

    try {
      const physics = makePhysics({ voiceActive: false })
      const organism = makeOrganism({ current: OState.Flow, flowDepth: 0.8 })

      gen.setInstrumentPerformer('piano')
      gen.onStateTransition(OState.Flow, physics)
      vi.clearAllMocks()

      getConductor().advanceChord()
      expect(mockPartStart).not.toHaveBeenCalled()
      expect((gen as any).phraseDirty).toBe(true)

      nowSpy.mockReturnValue(1700)
      gen.processFrame(physics, organism)

      expect(mockPartStart).toHaveBeenCalled()
      expect((gen as any).phraseDirty).toBe(false)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('fallback contour stays inside the active major scale', () => {
    ;(gen as any).rootPitchClass = 0
    ;(gen as any).currentScale = [0, 2, 4, 5, 7, 9, 11]

    const notes = (gen as any).defaultScaleContour(64, 4) as Array<{ pitch: string }>
    const pitchClasses = notes.map(note =>
      Number(String(note.pitch).replace('Note', '')) % 12
    )

    expect(pitchClasses.every(pc => [0, 2, 4, 5, 7, 9, 11].includes(pc))).toBe(true)
    expect(pitchClasses).not.toContain(3)
  })

  it('reset() zeros activity and sets behavior to Rest', () => {
    const physics = makePhysics({ voiceActive: false })
    const organism = makeOrganism({ current: OState.Flow, flowDepth: 0.8 })
    for (let i = 0; i < 100; i++) gen.processFrame(physics, organism)

    gen.reset()
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })
})
