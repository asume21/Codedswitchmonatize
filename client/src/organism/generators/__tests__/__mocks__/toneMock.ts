// Shared Tone.js mock for generator tests
import { vi } from 'vitest'

export const mockRampTo = vi.fn()
export const mockTriggerAttackRelease = vi.fn()
export const mockTriggerAttack = vi.fn()
export const mockTriggerRelease = vi.fn()
export const mockPartStart = vi.fn()
export const mockPartStop = vi.fn()
export const mockPartDispose = vi.fn()
export const mockNoiseStart = vi.fn()
export const mockFilterFreqRampTo = vi.fn()
export const mockReverbWetRampTo = vi.fn()
export const mockGainRampTo = vi.fn()
export const mockTransportStart = vi.fn()
export const mockTransportStop = vi.fn()
export const mockToneStart = vi.fn().mockResolvedValue(undefined)

function makeSynth() {
  return {
    toDestination: vi.fn().mockReturnThis(),
    connect: vi.fn().mockReturnThis(),
    triggerAttackRelease: mockTriggerAttackRelease,
    triggerAttack: mockTriggerAttack,
    triggerRelease: mockTriggerRelease,
    volume: { value: 0, rampTo: mockRampTo },
  }
}

function makeMonoSynth() {
  return {
    ...makeSynth(),
    filter: { Q: { value: 1 }, frequency: { value: 400, rampTo: vi.fn() } },
    filterEnvelope: { octaves: 2, decay: 0.5, attack: 0.01, release: 2, baseFrequency: 200 },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 1 },
  }
}

function makeMembraneSynth() {
  return {
    ...makeSynth(),
    pitchDecay: 0.05,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
  }
}

function makeNoiseSynth() {
  return {
    ...makeSynth(),
    envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
  }
}

function makeMetalSynth() {
  return {
    ...makeSynth(),
    envelope: { attack: 0.001, decay: 0.1, release: 0.2 },
    resonance: 3200,
  }
}

export function createToneMock() {
  return {
    start: mockToneStart,
    getTransport: vi.fn().mockReturnValue({
      bpm: { value: 90 },
      start: mockTransportStart,
      stop: mockTransportStop,
    }),
    getContext: vi.fn().mockReturnValue({ lookAhead: 0 }),
    // Use function() constructors so `new` works
    MembraneSynth: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeMembraneSynth())
    }),
    NoiseSynth: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeNoiseSynth())
    }),
    MetalSynth: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeMetalSynth())
    }),
    MonoSynth: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeMonoSynth())
    }),
    PolySynth: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeSynth())
    }),
    Synth: vi.fn(),
    FMSynth: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeSynth())
    }),
    Compressor: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
      })
    }),
    Distortion: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        wet: { value: 0, rampTo: vi.fn() },
      })
    }),
    FeedbackDelay: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        wet: { value: 0, rampTo: vi.fn() },
      })
    }),
    Chorus: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        wet: { value: 0, rampTo: vi.fn() },
      })
    }),
    Filter: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        frequency: { value: 400, rampTo: mockFilterFreqRampTo },
      })
    }),
    Reverb: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        wet: { value: 0.5, rampTo: mockReverbWetRampTo },
      })
    }),
    Noise: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        connect: vi.fn().mockReturnThis(),
        start: mockNoiseStart,
      })
    }),
    Gain: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        gain: { value: 0, rampTo: mockGainRampTo },
      })
    }),
    Part: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        loop: false,
        loopEnd: '2m',
        start: mockPartStart,
        stop: mockPartStop,
        dispose: mockPartDispose,
      })
    }),
    Frequency: vi.fn().mockImplementation(function (this: Record<string, unknown>, midi: number) {
      return Object.assign(this, {
        toNote: vi.fn().mockReturnValue(`Note${midi}`),
      })
    }),
    now: vi.fn().mockReturnValue(0),
  }
}
