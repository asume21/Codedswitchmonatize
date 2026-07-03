// client/src/organism/instruments/__tests__/pitchDetect.test.ts
import { describe, it, expect } from 'vitest'
import { detectFundamentalHz, hzToMidi, tuneShiftSemitones } from '../pitchDetect'

const SR = 44100

/** Synthesized decaying sine — a stand-in for an 808/kick body. */
function sine(hz: number, seconds: number, decay = 2): Float32Array {
  const out = new Float32Array(Math.floor(SR * seconds))
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    out[i] = Math.sin(2 * Math.PI * hz * t) * Math.exp(-decay * t)
  }
  return out
}

/** Kick-style downward pitch sweep settling on `settleHz`. */
function sweepKick(settleHz: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.floor(SR * seconds))
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const hz = settleHz * (1 + 3 * Math.exp(-t / 0.02)) // 4× start, settles fast
    phase += (2 * Math.PI * hz) / SR
    out[i] = Math.sin(phase) * Math.exp(-3 * t)
  }
  return out
}

describe('detectFundamentalHz', () => {
  it('finds a clean sub sine within 1 Hz', () => {
    for (const hz of [40, 55, 80, 110]) {
      const f0 = detectFundamentalHz(sine(hz, 0.8), SR)
      expect(f0, `${hz} Hz`).not.toBeNull()
      expect(Math.abs(f0! - hz), `${hz} Hz → ${f0}`).toBeLessThan(1)
    }
  })

  it('measures the settled tail of a pitch-sweeping kick, not the transient', () => {
    const f0 = detectFundamentalHz(sweepKick(50, 0.8), SR)
    expect(f0).not.toBeNull()
    expect(Math.abs(f0! - 50)).toBeLessThan(3)
  })

  it('returns null for noise (snares/claps must not get a bogus pitch)', () => {
    const noise = new Float32Array(SR)
    let seed = 1
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 16807) % 2147483647
      noise[i] = seed / 2147483647 - 0.5
    }
    expect(detectFundamentalHz(noise, SR)).toBeNull()
  })

  it('returns null for too-short input', () => {
    expect(detectFundamentalHz(sine(55, 0.05), SR)).toBeNull()
  })
})

describe('hzToMidi', () => {
  it('maps A4/A1 correctly', () => {
    expect(hzToMidi(440)).toBeCloseTo(69, 5)
    expect(hzToMidi(55)).toBeCloseTo(33, 5)
  })
})

describe('tuneShiftSemitones', () => {
  it('is 0 when already on the key root', () => {
    // 55 Hz = A1 (pc 9); key of A
    expect(Math.abs(tuneShiftSemitones(55, 9))).toBeLessThan(0.01)
  })

  it('retunes to the nearest octave of the root when close', () => {
    // 58 Hz ≈ A#1 minus a bit; key of A → small downward shift
    const shift = tuneShiftSemitones(58, 9)
    expect(shift).toBeLessThan(0)
    expect(shift).toBeGreaterThan(-1.5)
  })

  it('leaves the sample alone when the shift would exceed the clamp', () => {
    // 50 Hz sits ~4.6 st below C; pulling that far changes the drum's character
    expect(tuneShiftSemitones(50, 0)).toBe(0)
  })
})
