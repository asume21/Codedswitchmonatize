// Shared Tone.js mock for mix engine tests
import { vi } from 'vitest'

export const mockGainRampTo = vi.fn()
export const mockPanRampTo = vi.fn()
export const mockDispose = vi.fn()
export const mockConnect = vi.fn().mockReturnThis()
export const mockToDestination = vi.fn().mockReturnThis()

function makeDisposable() {
  return {
    dispose: mockDispose,
    connect: mockConnect,
    toDestination: mockToDestination,
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
    Distortion: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    Limiter: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return Object.assign(this, makeDisposable())
    }),
    dbToGain: vi.fn().mockImplementation((db: number) => Math.pow(10, db / 20)),
  }
}
