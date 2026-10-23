import { describe, it, expect, vi } from 'vitest'
import { retirePart } from '../partLifecycle'

const fakePart = (stop: () => void, dispose: () => void = () => {}) =>
  ({ stop: vi.fn(stop), dispose: vi.fn(dispose) }) as any

describe('retirePart', () => {
  it('stops then disposes a healthy part and returns null', () => {
    const p = fakePart(() => {})
    expect(retirePart(p)).toBeNull()
    expect(p.stop).toHaveBeenCalledTimes(1)
    expect(p.dispose).toHaveBeenCalledTimes(1)
  })

  it('STILL DISPOSES when stop() throws Tone\'s negative-time RangeError (the orphan-Part bug)', () => {
    const p = fakePart(() => { throw new RangeError('Value must be within [0, Infinity], got: -1.9326762412674725e-12') })
    expect(() => retirePart(p)).not.toThrow()
    expect(p.dispose).toHaveBeenCalledTimes(1)
    expect(retirePart(p)).toBeNull()
  })

  it('still disposes when stop() throws something unexpected, and traces it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = fakePart(() => { throw new Error('boom') })
    expect(() => retirePart(p)).not.toThrow()
    expect(p.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not throw when dispose() itself throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = fakePart(() => {}, () => { throw new Error('dispose boom') })
    expect(() => retirePart(p)).not.toThrow()
    warn.mockRestore()
  })

  it('accepts null and undefined', () => {
    expect(retirePart(null)).toBeNull()
    expect(retirePart(undefined)).toBeNull()
  })
})
