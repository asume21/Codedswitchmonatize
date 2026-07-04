import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import type { OrganismState } from '../../state/types'
import { GeneratorName, MelodyBehavior } from '../types'
import { createToneMock, mockPartStart } from './__mocks__/toneMock'
import * as Tone from 'tone'

vi.mock('tone', () => createToneMock())

vi.mock('../melody/motifSelection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../melody/motifSelection')>()
  return { ...actual, selectMotifBankKey: vi.fn(actual.selectMotifBankKey) }
})

import { MelodyGenerator, snapNoteToScale } from '../MelodyGenerator'
import { getMelodyBehavior } from '../patterns/MelodyPatternLibrary'
import { getConductor } from '../../conductor/Conductor'
import { selectMotifBankKey } from '../melody/motifSelection'

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

  describe('performer expression rollout — wind family', () => {
    it('a wind lead (flute) builds a scheduled phrase without throwing', () => {
      const physics = makePhysics({ voiceActive: false })

      gen.setInstrumentPerformer('flute')
      expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()

      const partMock = Tone.Part as unknown as {
        mock: { calls: Array<[unknown, Array<{ vel: number }>]> }
      }
      const events = partMock.mock.calls.at(-1)?.[1] ?? []
      expect(events.length).toBeGreaterThan(0)
    })

    it('a wind lead phrase has non-uniform velocities (the shared dynamics arc is applied)', () => {
      const physics = makePhysics({ voiceActive: false })

      gen.setInstrumentPerformer('flute')
      gen.onStateTransition(OState.Flow, physics)

      const partMock = Tone.Part as unknown as {
        mock: { calls: Array<[unknown, Array<{ vel: number }>]> }
      }
      const events = partMock.mock.calls.at(-1)?.[1] ?? []
      const distinctVels = new Set(events.map(e => Math.round(e.vel * 100)))
      expect(distinctVels.size).toBeGreaterThan(1)
    })
  })

  describe('motif bank routing — singing families get the lyrical bank', () => {
    it('routes a bowed-string lead (violin) to the lyrical bank, not arps/fills', () => {
      const physics = makePhysics({ voiceActive: false })

      gen.setInstrumentPerformer('violin')
      gen.onStateTransition(OState.Flow, physics)

      const spy = selectMotifBankKey as unknown as { mock: { calls: Array<[{ family: string | undefined }]> } }
      const lastCall = spy.mock.calls.at(-1)
      expect(lastCall?.[0].family).toBe('bowed')
      expect(spy.mock.results.at(-1)?.value).toBe('lyrical')
    })

    it('routes a keyboard lead (piano) to the lyrical bank too, not the tiny arps/fills loop', () => {
      const physics = makePhysics({ voiceActive: false })

      gen.setInstrumentPerformer('piano')
      gen.onStateTransition(OState.Flow, physics)

      const spy = selectMotifBankKey as unknown as { mock: { calls: Array<[{ family: string | undefined }]>, results: Array<{ value: string }> } }
      const lastCall = spy.mock.calls.at(-1)
      expect(lastCall?.[0].family).toBe('keyboard')
      expect(spy.mock.results.at(-1)?.value).toBe('lyrical')
    })
  })

  describe('performer expression rollout — guitar (plucked) family', () => {
    it('a guitar lead builds a scheduled phrase without throwing', () => {
      const physics = makePhysics({ voiceActive: false })

      gen.setInstrumentPerformer('guitar-nylon')
      expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()

      const partMock = Tone.Part as unknown as {
        mock: { calls: Array<[unknown, Array<{ vel: number }>]> }
      }
      const events = partMock.mock.calls.at(-1)?.[1] ?? []
      expect(events.length).toBeGreaterThan(0)
    })

    it('a guitar lead phrase produces a shaped (non-flat) velocity profile end-to-end', () => {
      // This is a wiring smoke test only — it confirms the shared dynamics arc
      // reaches a 'plucked'-family lead through the real pipeline. The actual
      // downbeatAccent regression guard lives in performerExpression.test.ts's
      // "accents downbeats when downbeatAccent is set" test, since the arc's
      // own position-based velocity variation would keep this test green even
      // if downbeatAccent were reverted to 0.
      const physics = makePhysics({ voiceActive: false })

      gen.setInstrumentPerformer('guitar-nylon')
      gen.onStateTransition(OState.Flow, physics)

      const partMock = Tone.Part as unknown as {
        mock: { calls: Array<[unknown, Array<{ vel: number }>]> }
      }
      const events = partMock.mock.calls.at(-1)?.[1] ?? []
      const distinctVels = new Set(events.map(e => Math.round(e.vel * 100)))
      expect(distinctVels.size).toBeGreaterThan(1)
    })
  })

  it('snaps wind ornament pitches back into the active scale', () => {
    const majorScale = [0, 2, 4, 5, 7, 9, 11]

    // Default tie-breaker behavior (unbiased)
    expect(snapNoteToScale('Bb3', 0, majorScale)).toBe('B3')
    expect(snapNoteToScale('C#4', 0, majorScale)).toBe('C4')
    expect(snapNoteToScale('D4', 0, majorScale)).toBe('D4')

    // Preferred direction override
    expect(snapNoteToScale('Bb3', 0, majorScale, 0, 'up')).toBe('B3')
    expect(snapNoteToScale('Bb3', 0, majorScale, 0, 'down')).toBe('A3')
    expect(snapNoteToScale('C#4', 0, majorScale, 0, 'ascending')).toBe('D4')
    expect(snapNoteToScale('C#4', 0, majorScale, 0, 'descending')).toBe('C4')
  })

  it('onStateTransition to DORMANT stops part and zeros activity', () => {
    const physics = makePhysics()
    gen.onStateTransition(OState.Breathing, physics)
    gen.onStateTransition(OState.Dormant, physics)

    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })

  it('onStateTransition to FLOW sets scale from mode', () => {
    const physics = makePhysics({ mode: OrganismMode.Heat })
    expect(() => gen.onStateTransition(OState.Flow, physics)).not.toThrow()
  })

  it('reset() zeros activity and sets behavior to Rest', () => {
    const physics = makePhysics({ voiceActive: false })
    const organism = makeOrganism({ current: OState.Flow, flowDepth: 0.8 })
    for (let i = 0; i < 100; i++) gen.processFrame(physics, organism)

    gen.reset()
    const report = gen.getActivityReport(Date.now())
    expect(report.activityLevel).toBe(0)
  })

  // ── Additional Workstream 4 Tests ─────────────────────────────────

  it('handles scale wrapping and octave transposing correctly in phrase generation', () => {
    const physics = makePhysics({ mode: OrganismMode.Glow })
    // Scale has length 7. Root is C (0).
    gen.setRootAndScale(0, [0, 2, 4, 5, 7, 9, 11])
    gen.onStateTransition(OState.Flow, physics)

    const partMock = Tone.Part as any
    const events = partMock.mock.calls.at(-1)?.[1] ?? []
    
    // All generated pitches should belong to the C major scale, even with transpositions
    for (const event of events) {
      const midiStr = event.note.replace('Note', '')
      const midi = parseInt(midiStr, 10)
      if (!isNaN(midi)) {
        const pc = ((midi % 12) + 12) % 12
        expect([0, 2, 4, 5, 7, 9, 11]).toContain(pc)
      }
    }
  })

  it('handles articulation overrides correctly', () => {
    // Default articulation
    expect(gen.getArticulation()).toBe('none')

    // Set override
    gen.setArticulation('staccato')
    expect(gen.getArticulation()).toBe('staccato')

    // Reset override
    gen.resetArticulationOverride()
    expect(gen.getArticulation()).toBe('staccato') // overridden flag is false now
  })

  it('shapes melody based on emotional intent', () => {
    const physics = makePhysics({ mode: OrganismMode.Glow })
    
    gen.setInstrumentPerformer('piano')
    gen.setEmotionalIntent('sad')
    expect(gen.getEmotionalIntent()).toBe('sad')
    
    // Process frame to trigger the rebuild
    gen.processFrame(physics, makeOrganism())
    
    const partMock = Tone.Part as any
    const events = partMock.mock.calls.at(-1)?.[1] ?? []
    
    // Sad intent clamps base velocities between 0.4 and 0.6; the shared
    // performer-expression velocity ARC (applied to every family, including
    // piano, since Task 5) then multiplies by an edge taper down to 0.78x at
    // the phrase's start/end, so the observed floor is a bit lower.
    for (const event of events) {
      expect(event.vel).toBeGreaterThanOrEqual(0.4 * 0.78)
      expect(event.vel).toBeLessThanOrEqual(0.6)
    }

    gen.setEmotionalIntent('beautiful')
    expect(gen.getEmotionalIntent()).toBe('beautiful')
    
    // Process frame to trigger the rebuild
    gen.processFrame(physics, makeOrganism())
    const eventsBeautiful = partMock.mock.calls.at(-1)?.[1] ?? []
    
    // Beautiful intent clamps base velocities between 0.45 and 0.7; same edge
    // taper as above lowers the observed floor.
    for (const event of eventsBeautiful) {
      expect(event.vel).toBeGreaterThanOrEqual(0.45 * 0.78)
      expect(event.vel).toBeLessThanOrEqual(0.7)
    }
  })

  it('handles section changes and resets motif', () => {
    gen.onSectionChange('chorus')
    const physics = makePhysics({ mode: OrganismMode.Glow })
    gen.onStateTransition(OState.Flow, physics)
    
    const partMock = Tone.Part as any
    const firstChorusCalls = partMock.mock.calls.length
    
    // Changing section should trigger phrase rebuild (scaleDirty = true)
    gen.onSectionChange('verse')
    gen.processFrame(physics, makeOrganism())
    
    expect(partMock.mock.calls.length).toBeGreaterThan(firstChorusCalls)
  })

  it('applies swing to the default minor contour', () => {
    gen.setSwing(0.5)
    
    // Call the method directly with a length (40) that produces off-16ths
    const notes = (gen as any).defaultMinorContour(40, 4)
    
    // Verify that off-16ths in the contour are swung (contain decimal sub-beats)
    let hasSwungTime = false
    for (const event of notes) {
      const parts = String(event.time).split(':')
      const sub = parseFloat(parts[2] ?? '0')
      if (sub !== Math.floor(sub)) {
        hasSwungTime = true
      }
    }
    expect(hasSwungTime).toBe(true)
  })

  it('triggers answer licks correctly', () => {
    const conductor = getConductor()
    const chordTonesSpy = vi.spyOn(conductor, 'chordTones').mockReturnValue([60, 64, 67])

    const triggerAttackReleaseMock = vi.fn()
    Object.defineProperty(gen, 'synth', {
      value: {
        triggerAttackRelease: triggerAttackReleaseMock,
        volume: { value: 0 },
        isLoaded: true,
      },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(gen, 'fallbackSynth', {
      value: {
        triggerAttackRelease: triggerAttackReleaseMock,
        volume: { value: 0 },
      },
      writable: true,
      configurable: true,
    })

    gen.triggerAnswerLick(10, 0.8)
    expect(triggerAttackReleaseMock).toHaveBeenCalled()
    chordTonesSpy.mockRestore()
  })

  it('caches samplers and avoids reloading same voice', () => {
    gen.setInstrumentPerformer('piano')
    const initialSynth = (gen as any).synth
    
    gen.setInstrumentPerformer('piano')
    expect((gen as any).synth).toBe(initialSynth)
  })

  it('disposes clean without errors', () => {
    expect(() => gen.dispose()).not.toThrow()
  })
})
