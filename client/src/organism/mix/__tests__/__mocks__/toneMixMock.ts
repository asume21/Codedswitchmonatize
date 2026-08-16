// Shared Tone.js mock for mix engine tests
import { vi } from 'vitest'

export const mockGainRampTo = vi.fn()
export const mockPanRampTo = vi.fn()
export const mockDispose = vi.fn()
export const mockConnect = vi.fn().mockReturnThis()
export const mockToDestination = vi.fn().mockReturnThis()

export const mockDisconnect = vi.fn().mockReturnThis()
export const mockChain = vi.fn().mockReturnThis()

function makeDisposable() {
  return {
    dispose: mockDispose,
    connect: mockConnect,
    disconnect: mockDisconnect,
    toDestination: mockToDestination,
    chain: mockChain,
  }
}

export function createMixToneMock() {
  return {
    Gain: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        ...makeDisposable(),
        gain: { value: 1, rampTo: mockGainRampTo },
      })
    }),
    Compressor: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    Panner: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        ...makeDisposable(),
        pan: { value: 0, rampTo: mockPanRampTo },
      })
    }),
    Analyser: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        ...makeDisposable(),
        getValue: vi.fn().mockReturnValue(new Float32Array(1024)),
      })
    }),
    // Tone.Filter exposes `frequency` and `gain` as Params with a `.value`, and
    // takes both as constructor options. The mock used to hardcode them, so a
    // strip's configured EQ was invisible to tests and `gain` did not exist at
    // all — reading opts here is what makes per-band assertions mean anything.
    Filter: vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      opts?: { frequency?: number; gain?: number; Q?: number },
    ) {
      return Object.assign(this, {
        ...makeDisposable(),
        frequency: { value: opts?.frequency ?? 400, rampTo: vi.fn() },
        gain: { value: opts?.gain ?? 0, rampTo: vi.fn() },
        Q: { value: opts?.Q ?? 1, rampTo: vi.fn() },
      })
    }),
    Distortion: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    Limiter: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    WaveShaper: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    Split: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    Merge: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    Delay: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    Chorus: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, {
        ...makeDisposable(),
        start: vi.fn().mockReturnThis(),
        wet: { value: 0.25 },
      })
    }),
    dbToGain: vi.fn().mockImplementation((db: number) => Math.pow(10, db / 20)),
    // SharedMasterBus uses these to wire its chain into the hardware destination
    // and to reroute Tone.Destination through itself. Tests only need them to
    // exist and return chainable mock nodes.
    getDestination: vi.fn().mockImplementation(() => ({
      ...makeDisposable(),
      volume: { value: 0, rampTo: mockGainRampTo },
    })),
    getContext: vi.fn().mockImplementation(() => ({
      rawContext: { destination: makeDisposable() },
    })),
  }
}
