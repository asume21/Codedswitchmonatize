// Shared Tone.js mock for generator tests
import { vi } from 'vitest'

export const mockRampTo = vi.fn()
export const mockTriggerAttackRelease = vi.fn()
export const mockTriggerAttack = vi.fn()
export const mockTriggerRelease = vi.fn()
export const mockPartStart = vi.fn()
export const mockPartStop = vi.fn()
export const mockPartDispose = vi.fn()
export const mockPlayerStart = vi.fn()
export const mockNoiseStart = vi.fn()
export const mockFilterFreqRampTo = vi.fn()
export const mockReverbWetRampTo = vi.fn()
export const mockGainRampTo = vi.fn()
export const mockTransportStart = vi.fn()
export const mockTransportStop = vi.fn()
export const mockToneStart = vi.fn().mockResolvedValue(undefined)

// Tone.js audio-param shape. Production code calls cancelScheduledValues +
// rampTo back-to-back (cancel pending automation, then schedule new ramp).
// Real Tone params expose the full Web Audio AudioParam surface plus rampTo;
// we stub all of it so any caller works without per-test boilerplate.
function audioParam(value = 0, rampToFn: ReturnType<typeof vi.fn> = vi.fn()) {
  const param = {
    value,
    rampTo: rampToFn,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampTo: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampTo: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  }
  // Fluent interface — many Tone methods return `this`
  param.cancelScheduledValues.mockReturnValue(param)
  param.rampTo.mockReturnValue(param)
  return param
}

function makeSynth() {
  return {
    toDestination: vi.fn().mockReturnThis(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    triggerAttackRelease: mockTriggerAttackRelease,
    triggerAttack: mockTriggerAttack,
    triggerRelease: mockTriggerRelease,
    releaseAll: vi.fn(),
    dispose: vi.fn(),
    volume: audioParam(0, mockRampTo),
    detune: audioParam(0),
  }
}

function makeMonoSynth() {
  return {
    ...makeSynth(),
    filter: { Q: { value: 1 }, frequency: audioParam(400) },
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

function makePlayer() {
  return {
    ...makeSynth(),
    loaded: true,
    start: mockPlayerStart,
    stop: vi.fn(),
    restart: vi.fn(),
    fadeOut: 0,
    playbackRate: 1,
  }
}

export function createToneMock() {
  return {
    start: mockToneStart,
    getTransport: vi.fn().mockReturnValue({
      bpm: { value: 90 },
      start: mockTransportStart,
      stop: mockTransportStop,
      pause: vi.fn(),
      cancel: vi.fn(),
      position: '0:0:0',
      state: 'stopped',
      nextSubdivision: vi.fn().mockReturnValue(0),
      schedule: vi.fn().mockReturnValue(0),
      scheduleOnce: vi.fn().mockReturnValue(0),
      scheduleRepeat: vi.fn().mockReturnValue(0),
      clear: vi.fn(),
    }),
    getContext: vi.fn().mockReturnValue({ lookAhead: 0 }),
    getDestination: vi.fn().mockReturnValue({
      mute: false,
      volume: audioParam(0),
      chain: vi.fn().mockReturnThis(),
    }),
    // Expression & Modulation
    LFO: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        connect: vi.fn().mockReturnThis(),
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        dispose: vi.fn(),
        frequency: audioParam(5),
        amplitude: audioParam(1),
      })
    }),
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
    Player: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makePlayer())
    }),
    Synth: vi.fn(),
    FMSynth: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeSynth())
    }),
    Sampler: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
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
        wet: audioParam(0),
      })
    }),
    FeedbackDelay: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        wet: audioParam(0),
        feedback: audioParam(0),
      })
    }),
    Chorus: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        wet: audioParam(0),
      })
    }),
    Vibrato: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        dispose: vi.fn(),
        frequency: audioParam(5),
        depth: audioParam(0),
        wet: audioParam(1),
      })
    }),
    Filter: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        frequency: audioParam(400, mockFilterFreqRampTo),
      })
    }),
    Reverb: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        wet: audioParam(0.5, mockReverbWetRampTo),
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
        dispose: vi.fn(),
        gain: audioParam(0, mockGainRampTo),
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
