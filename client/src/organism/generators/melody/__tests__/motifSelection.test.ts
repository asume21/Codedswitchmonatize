import { describe, it, expect } from 'vitest'
import { selectMotifBankKey } from '../motifSelection'
import { HIP_HOP_MOTIFS } from '../../patterns/MelodyPatternLibrary'

describe('selectMotifBankKey', () => {
  it('routes a bowed lead to the lyrical bank in AUTO mode (no vocals)', () => {
    const key = selectMotifBankKey({ family: 'bowed', voiceActive: false, preferredBankKey: null, chordSeed: 7 })
    expect(key).toBe('lyrical')
  })

  it('routes a bowed lead to the lyrical bank with a live vocalist too', () => {
    const key = selectMotifBankKey({ family: 'bowed', voiceActive: true, preferredBankKey: null, chordSeed: 2 })
    expect(key).toBe('lyrical')
  })

  it('a chorus/hook preferred bank overrides everything', () => {
    const key = selectMotifBankKey({ family: 'bowed', voiceActive: false, preferredBankKey: 'arps', chordSeed: 7 })
    expect(key).toBe('arps')
  })

  it('preserves the existing arps/fills split for non-lyrical leads in auto mode', () => {
    expect(selectMotifBankKey({ family: 'plucked', voiceActive: false, preferredBankKey: null, chordSeed: 7 })).toBe('arps')
    expect(selectMotifBankKey({ family: 'plucked', voiceActive: false, preferredBankKey: null, chordSeed: 3 })).toBe('fills')
  })

  it('defaults to ostinatos for a non-lyrical lead with a live vocalist', () => {
    expect(selectMotifBankKey({ family: 'plucked', voiceActive: true, preferredBankKey: null, chordSeed: 4 })).toBe('ostinatos')
  })

  it('routes a keyboard lead to the lyrical bank too (2026-07-04: piano was stuck on the tiny arps/fills loop)', () => {
    expect(selectMotifBankKey({ family: 'keyboard', voiceActive: false, preferredBankKey: null, chordSeed: 7 })).toBe('lyrical')
    expect(selectMotifBankKey({ family: 'keyboard', voiceActive: true, preferredBankKey: null, chordSeed: 3 })).toBe('lyrical')
  })

  it('every key it can return resolves to a non-empty motif bank', () => {
    const keys = ['lyrical', 'arps', 'fills', 'ostinatos']
    for (const k of keys) {
      expect(HIP_HOP_MOTIFS[k]?.length ?? 0).toBeGreaterThan(0)
    }
  })
})
