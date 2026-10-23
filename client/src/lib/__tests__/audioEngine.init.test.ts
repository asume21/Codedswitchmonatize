import { describe, it, expect, vi, beforeEach } from 'vitest'

// Measured on prod 2026-10-23: several components call initialize() at once,
// every call passed the `isInitialized` guard during its await, and
// setupDrumVoices() ran three times without disposing — 9 MetalSynths holding
// ~342 always-running ConstantSourceNodes, about half the audio render thread.
const h = vi.hoisted(() => ({
  built: { MetalSynth: 0, MembraneSynth: 0, NoiseSynth: 0, PolySynth: 0 } as Record<string, number>,
  disposed: { MetalSynth: 0, MembraneSynth: 0, NoiseSynth: 0, PolySynth: 0 } as Record<string, number>,
  release: null as null | (() => void),
  fail: false,
  polyThrows: false,
  realisticReady: false,
}))

vi.mock('../realisticAudio', () => ({
  realisticAudio: {
    initialize: vi.fn(() => new Promise<void>((resolve, reject) => {
      h.release = () => (h.fail ? reject(new Error('init failed')) : resolve())
    })),
    isReady: () => h.realisticReady,
    playDrumSound: vi.fn(() => Promise.resolve()),
  },
}))
vi.mock('../audioContext', () => ({ getAudioContext: vi.fn() }))
vi.mock('../transportController', () => ({ requestTransportCancel: vi.fn() }))

vi.mock('tone', () => {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), rampTo: vi.fn() })
  class Node {
    connect() { return this }
    disconnect() {}
    toDestination() { return this }
    dispose() {}
  }
  class Volume extends Node { volume = param() }
  const voice = (name: string) => class extends Node {
    envelope: Record<string, unknown> = {}
    oscillator: Record<string, unknown> = {}
    noise: Record<string, unknown> = {}
    frequency = param()
    triggerAttackRelease = vi.fn()
    constructor() {
      super()
      if (name === 'PolySynth' && h.polyThrows) throw new Error('synth build failed')
      h.built[name]++
    }
    dispose() { h.disposed[name]++ }
  }
  return {
    Volume,
    MetalSynth: voice('MetalSynth'),
    MembraneSynth: voice('MembraneSynth'),
    NoiseSynth: voice('NoiseSynth'),
    PolySynth: voice('PolySynth'),
    Synth: class extends Node {},
    gainToDb: (x: number) => x,
    now: () => 0,
    start: vi.fn(),
    context: { state: 'running' },
    Transport: { scheduleOnce: vi.fn(), scheduleRepeat: vi.fn() },
  }
})

import { AudioEngine } from '../audioEngine'
import { realisticAudio } from '../realisticAudio'

const flush = () => new Promise(r => setTimeout(r, 0))

describe('AudioEngine.initialize', () => {
  beforeEach(() => {
    for (const k of Object.keys(h.built)) { h.built[k] = 0; h.disposed[k] = 0 }
    h.release = null
    h.fail = false
    h.polyThrows = false
    h.realisticReady = false
    vi.mocked(realisticAudio.initialize).mockClear()
  })

  it('runs ONCE when called concurrently (the triple-init that leaked 342 sources)', async () => {
    const engine = new AudioEngine()
    const calls = [engine.initialize(), engine.initialize(), engine.initialize()]
    await flush()
    h.release!()
    await Promise.all(calls)
    expect(realisticAudio.initialize).toHaveBeenCalledTimes(1)
    expect(h.built.PolySynth).toBe(3) // piano, synth, bass — once, not 9
  })

  it('builds NO drum voices at init — they are a fallback, built on first use', async () => {
    const engine = new AudioEngine()
    const p = engine.initialize(); await flush(); h.release!(); await p
    expect(h.built.MetalSynth + h.built.MembraneSynth + h.built.NoiseSynth).toBe(0)
  })

  it('builds a fallback drum voice on first hit and reuses it after', async () => {
    const engine = new AudioEngine()
    const p = engine.initialize(); await flush(); h.release!(); await p
    engine.playDrum('hihat')
    engine.playDrum('hihat')
    expect(h.built.MetalSynth).toBe(1)
    engine.playDrum('kick')
    expect(h.built.MembraneSynth).toBe(1)
  })

  it('a realistic-engine failure still initializes (synthetic fallback), once', async () => {
    const engine = new AudioEngine()
    h.fail = true
    const first = engine.initialize(); await flush(); h.release!()
    await first
    await engine.initialize()
    expect(realisticAudio.initialize).toHaveBeenCalledTimes(1)
    expect(h.built.PolySynth).toBe(3)
  })

  it('an init that THROWS clears the in-flight promise so the next call retries', async () => {
    const engine = new AudioEngine()
    h.polyThrows = true
    const first = engine.initialize(); await flush(); h.release!()
    await expect(first).rejects.toThrow('synth build failed')
    h.polyThrows = false
    const second = engine.initialize(); await flush(); h.release!()
    await second
    expect(realisticAudio.initialize).toHaveBeenCalledTimes(2)
    expect(h.built.PolySynth).toBe(3)
  })

  it('dispose() releases lazily built drum voices', async () => {
    const engine = new AudioEngine()
    const p = engine.initialize(); await flush(); h.release!(); await p
    engine.playDrum('crash')
    engine.dispose()
    expect(h.disposed.MetalSynth).toBe(1)
  })
})
