import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import { createToneMock } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

const { mockGetRealInstrumentNotes, mockCreateMultisampleSampler, mockCreateNeumannBassSampler, mockSelectInstrumentPerformer } = vi.hoisted(() => {
  return {
    mockGetRealInstrumentNotes: vi.fn(),
    mockCreateMultisampleSampler: vi.fn(),
    mockCreateNeumannBassSampler: vi.fn(),
    mockSelectInstrumentPerformer: vi.fn(),
  }
})

vi.mock('../../instruments/realInstruments', () => ({
  getRealInstrumentNotes: mockGetRealInstrumentNotes,
}))

vi.mock('../../instruments/SamplerUtils', () => ({
  createMultisampleSampler: mockCreateMultisampleSampler,
}))

vi.mock('../../instruments/NeumannBassSampler', () => ({
  createNeumannBassSampler: mockCreateNeumannBassSampler,
}))

vi.mock('../../instruments/Real808BassSampler', () => {
  class Real808BassSampler {
    isLoaded(): boolean { return false }
    triggerAttackRelease(): void {}
    setPortamento(): void {}
    dispose(): void {}
  }
  return {
    Real808BassSampler,
    findBass808Sample: vi.fn(async () => null),
  }
})

vi.mock('../../performers', () => ({
  conformNoteToInstrument: (note: string) => note,
  selectInstrumentPerformer: mockSelectInstrumentPerformer,
}))

import { BassGenerator } from '../BassGenerator'
import { resetConductor } from '../../conductor/Conductor'

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5, swing: 0.5, pocket: 0, presence: 0, density: 0.3,
    mode: OrganismMode.Smoke, pulse: 90, beatDurationMs: 667,
    sixteenthDurationMs: 167, swungSixteenthMs: 334,
    timestamp: 1000, frameIndex: 43, voiceActive: false,
    ...overrides,
  }
}

function makeFakeSampler() {
  return {
    volume: { value: 0, cancelScheduledValues: vi.fn(), rampTo: vi.fn() },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    releaseAll: vi.fn(),
    triggerAttackRelease: vi.fn(),
    isLoaded: true,
  }
}

describe('BassGenerator — real instrument routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetConductor()
    mockSelectInstrumentPerformer.mockReturnValue({
      id: 'cello',
      name: 'Cello',
      family: 'bowed',
      roles: ['lead', 'chord', 'bass'],
      samplerPreset: 'cello',
      realInstrument: 'SSO_Cello',
      envelope: { attack: 0.12, release: 0.9 },
      volume: -4,
      defaultBassArticulation: 'bass-walking-step',
    })
  })

  it('prefers a performer real multisample over the generic Neumann bass fallback', () => {
    const realNotes = { C2: '/samples/SSO_Cello_C2.ogg' }
    const fakeMultisample = makeFakeSampler()
    const fakeNeumann = makeFakeSampler()

    mockGetRealInstrumentNotes.mockReturnValue(realNotes)
    mockCreateMultisampleSampler.mockReturnValue(fakeMultisample)
    mockCreateNeumannBassSampler.mockReturnValue(fakeNeumann)

    const gen = new BassGenerator()
    gen.setInstrumentPerformer('cello' as never)
    gen.onStateTransition(OState.Breathing, makePhysics({ mode: OrganismMode.Smoke }))

    expect(mockCreateMultisampleSampler).toHaveBeenCalledWith(realNotes, { attack: 0.12, release: 0.9 }, -4)
    expect(mockCreateNeumannBassSampler).not.toHaveBeenCalled()
    expect((gen as unknown as { synth: unknown }).synth).toBe(fakeMultisample)
  })

  it('reuses the same real bass voice instead of rebuilding it on repeated same-mode transitions', () => {
    const realNotes = { C1: '/samples/SSO_Basses_C1.ogg' }
    const fakeMultisample = makeFakeSampler()

    mockSelectInstrumentPerformer.mockReturnValue({
      id: 'bass-upright',
      name: 'Upright Bass',
      family: 'plucked',
      roles: ['bass'],
      samplerPreset: 'acoustic_bass',
      realInstrument: 'SSO_Basses',
      envelope: { attack: 0.05, release: 0.8 },
      volume: 1,
      defaultBassArticulation: 'bass-walking-step',
    })
    mockGetRealInstrumentNotes.mockReturnValue(realNotes)
    mockCreateMultisampleSampler.mockReturnValue(fakeMultisample)
    mockCreateNeumannBassSampler.mockReturnValue(makeFakeSampler())

    const gen = new BassGenerator()
    gen.setInstrumentPerformer('bass-upright' as never)
    gen.onStateTransition(OState.Breathing, makePhysics({ mode: OrganismMode.Smoke }))
    gen.onStateTransition(OState.Flow, makePhysics({ mode: OrganismMode.Smoke }))

    expect(mockCreateMultisampleSampler).toHaveBeenCalledTimes(1)
    expect((gen as unknown as { currentVoiceKey: string | null }).currentVoiceKey).toBe('real:SSO_Basses')
  })
})
