import { describe, it, expect, vi } from 'vitest'
import { createToneMock } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { GeneratorOrchestrator } from '../GeneratorOrchestrator'

// Spy: replace applyVolumeMultiplier on every generator so we can assert the
// reactive per-frame paths never touch the mix (MixEngine owns the mix now).
function spyVolume(orch: any) {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const gen of ['drum', 'bass', 'melody', 'texture', 'chord']) {
    const s = vi.fn()
    orch[gen].applyVolumeMultiplier = s
    spies[gen] = s
  }
  return spies
}

describe('GeneratorOrchestrator — no per-frame volume writes (Part 2)', () => {
  it('applyReactiveMultipliers does not move any generator volume', () => {
    const orch = new GeneratorOrchestrator()
    const spies = spyVolume(orch)
    orch.applyReactiveMultipliers({ bassVolumeMultiplier: 0.5, melodyVolumeMultiplier: 1.4, textureVolumeMultiplier: 0.3 })
    expect(spies.bass).not.toHaveBeenCalled()
    expect(spies.melody).not.toHaveBeenCalled()
    expect(spies.texture).not.toHaveBeenCalled()
  })

  it('applyPerformerState does not move melody/texture volume', () => {
    const orch = new GeneratorOrchestrator()
    const spies = spyVolume(orch)
    orch.applyPerformerState({
      energy: 0.9, breathingNow: true, syllabicRate: 6,
      phraseBar: 0, phrasePosition: 0.05, spectralBrightness: 0.5,
    } as any)
    expect(spies.melody).not.toHaveBeenCalled()
    expect(spies.texture).not.toHaveBeenCalled()
  })

  it('applySelfListenReport does not move any generator volume', () => {
    const orch = new GeneratorOrchestrator()
    const spies = spyVolume(orch)
    orch.applySelfListenReport({
      isSilent: false, needsVolumeReduction: true, needsVolumeBoost: false,
      clippingPercent: 1, rmsDb: -10, peakDb: -3, spectralCentroidHz: 800,
      hasDcOffset: false, dcOffset: 0, summary: '', estimatedBpm: 0, onsetCount: 0,
      onsetTimingStdDevMs: 0,
      bandEnergy: { sub: 0.4, bass: 0.4, lowMid: 0.3, highMid: 0.2, high: 0.1 },
    } as any)
    expect(spies.bass).not.toHaveBeenCalled()
    expect(spies.melody).not.toHaveBeenCalled()
    expect(spies.texture).not.toHaveBeenCalled()
  })
})
