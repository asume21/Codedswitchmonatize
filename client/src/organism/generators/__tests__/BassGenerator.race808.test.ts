import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../../state/types'
import { createToneMock } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

// Deferred kit fetch so we can hold the 808 sample load "in flight" while the
// bass voice switches away from 808. Identity-tracked fake sampler so the test
// can assert whether a late-loaded 808 became the active voice.
let deferredFind: { resolve: (v: unknown) => void; promise: Promise<unknown> }
const fake808Instances: Array<{ loaded: boolean }> = []

vi.mock('../../instruments/Real808BassSampler', () => {
  class Real808BassSampler {
    loaded = false
    constructor(_output: unknown) {
      fake808Instances.push(this)
    }
    async load(_sample: unknown): Promise<void> {
      this.loaded = true
    }
    isLoaded(): boolean {
      return this.loaded
    }
    triggerAttackRelease(): boolean {
      return true
    }
    setPortamento(): void {}
    dispose(): void {
      this.loaded = false
    }
  }
  return {
    Real808BassSampler,
    findBass808Sample: vi.fn(() => deferredFind.promise),
  }
})

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

function makeDeferred() {
  let resolve!: (v: unknown) => void
  const promise = new Promise<unknown>((r) => { resolve = r })
  return { resolve, promise }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('BassGenerator — late-loading 808 race', () => {
  let gen: BassGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    resetConductor()
    deferredFind = makeDeferred()
    fake808Instances.length = 0
    gen = new BassGenerator()
  })

  it('does NOT activate a late-loading 808 sampler after switching to a non-808 voice', async () => {
    // 1. Heat mode engages the 808 voice → loadReal808Sampler() awaits the kit
    //    fetch, which we hold pending.
    gen.onStateTransition(OState.Breathing, makePhysics({ mode: OrganismMode.Heat }))

    // 2. Switch to a non-808 voice (Ice) BEFORE the kit fetch resolves.
    gen.onStateTransition(OState.Breathing, makePhysics({ mode: OrganismMode.Ice }))

    // 3. Now the in-flight kit fetch resolves and the 808 sampler finishes loading.
    deferredFind.resolve({ role: 'bass808', url: 'blob:fake', fileName: '808.wav', relativePath: '808.wav' })
    await flush()

    // The active voice is the non-808 (Ice) voice. A stale 808 sampler that
    // loaded after the switch must NOT become the active voice.
    const active = (gen as unknown as { getActiveVoice: () => unknown }).getActiveVoice()
    const stale808 = fake808Instances[0]
    expect(active).not.toBe(stale808)
  })
})
