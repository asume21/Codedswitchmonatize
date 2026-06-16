import { describe, expect, it } from 'vitest'
import type { MelodyMotif } from '../../patterns/MelodyPatternLibrary'
import { developMotif, pickPhraseVariations } from '../melodyMotif'

const base: MelodyMotif = { name: 'test', steps: [
  { index: 0, isChordTone: true, dur16ths: 2 },
  { index: 2, isChordTone: true, dur16ths: 2 },
  { index: 1, isChordTone: true, dur16ths: 4 },
] }

describe('developMotif', () => {
  it('identity returns the same step indices and durations', () => {
    const out = developMotif(base, 'identity')
    expect(out.steps.map(s => s.index)).toEqual([0, 2, 1])
    expect(out.steps.map(s => s.dur16ths)).toEqual([2, 2, 4])
  })
  it('transpose shifts every index by amount', () => {
    expect(developMotif(base, 'transpose', 2).steps.map(s => s.index)).toEqual([2, 4, 3])
  })
  it('invert mirrors indices around the first step', () => {
    // mirror around 0: 0->0, 2->-2, 1->-1
    expect(developMotif(base, 'invert').steps.map(s => s.index)).toEqual([0, -2, -1])
  })
  it('augment doubles durations; diminish halves them', () => {
    expect(developMotif(base, 'augment').steps.map(s => s.dur16ths)).toEqual([4, 4, 8])
    expect(developMotif(base, 'diminish').steps.map(s => s.dur16ths)).toEqual([1, 1, 2])
  })
  it('does not mutate the input motif', () => {
    developMotif(base, 'transpose', 5)
    expect(base.steps[0].index).toBe(0)
  })
})

describe('pickPhraseVariations', () => {
  it('always states the theme first (identity) then develops it', () => {
    const v = pickPhraseVariations(0, 4)
    expect(v).toHaveLength(4)
    expect(v[0]).toBe('identity')
  })
  it('is deterministic for a given seed', () => {
    expect(pickPhraseVariations(7, 4)).toEqual(pickPhraseVariations(7, 4))
  })
})
