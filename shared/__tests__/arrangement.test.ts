import { describe, expect, it } from 'vitest'
import {
  chordFromRoman,
  keyToPitchClass,
  validateArrangementPlan,
  type ArrangementPlan,
} from '../arrangement'

describe('chordFromRoman', () => {
  it('parses a major-tonic I in C → C major triad', () => {
    const c = chordFromRoman('I', 0)
    expect(c.intervals).toEqual([0, 4, 7])
    expect(c.rootMidi).toBe(60)     // C4
    expect(c.pitches).toEqual([60, 64, 67])
    expect(c.root).toBe('C')
  })

  it('parses lowercase i as minor triad', () => {
    const c = chordFromRoman('i', 0)
    expect(c.intervals).toEqual([0, 3, 7])
    expect(c.pitches).toEqual([60, 63, 67])
  })

  it('respects the keyPitchClass when transposing', () => {
    const aIonE = chordFromRoman('IV', keyToPitchClass('A'))
    expect(aIonE.rootMidi).toBe(60 + ((9 + 5) % 12))  // A + perfect 4th = D
    expect(aIonE.root).toBe('D')
  })

  it('honors quality suffix (m7, maj7, dim, sus2)', () => {
    expect(chordFromRoman('Im7', 0).intervals).toEqual([0, 3, 7, 10])
    expect(chordFromRoman('Imaj7', 0).intervals).toEqual([0, 4, 7, 11])
    expect(chordFromRoman('IVdim', 0).intervals).toEqual([0, 3, 6])
    expect(chordFromRoman('Vsus2', 0).intervals).toEqual([0, 2, 7])
  })

  it('honors flat accidental prefixes', () => {
    // bIII in C = Eb major triad
    const eFlat = chordFromRoman('bIII', 0)
    expect(eFlat.rootMidi).toBe(60 + 3)
  })

  it('falls back gracefully on unparseable input', () => {
    const fallback = chordFromRoman('garbage', 0)
    expect(fallback.intervals).toEqual([0, 4, 7])
    expect(fallback.rootMidi).toBe(60)
  })
})

function validPlan(overrides: Partial<ArrangementPlan> = {}): ArrangementPlan {
  return {
    id: 'plan-1',
    key: 'C',
    bpm: 90,
    subGenre: 'boom-bap',
    mood: 'nostalgic',
    acePrompt: 'boom bap, dusty drums, jazz piano, 90 bpm',
    sections: [
      { name: 'intro', bars: 4, progression: ['i', 'VI', 'III', 'VII'], energy: 0.3, density: 0.2 },
      { name: 'verse', bars: 8, progression: ['i', 'iv', 'V', 'i'], energy: 0.6, density: 0.5 },
    ],
    ...overrides,
  }
}

describe('validateArrangementPlan', () => {
  it('accepts a valid plan', () => {
    expect(validateArrangementPlan(validPlan())).toBeNull()
  })

  it('rejects missing required fields', () => {
    expect(validateArrangementPlan({ ...validPlan(), id: '' })).toMatch(/id/)
    expect(validateArrangementPlan({ ...validPlan(), key: 'H' })).toMatch(/key/)
    expect(validateArrangementPlan({ ...validPlan(), bpm: 10 })).toMatch(/bpm/)
    expect(validateArrangementPlan({ ...validPlan(), subGenre: '' })).toMatch(/subGenre/)
    expect(validateArrangementPlan({ ...validPlan(), sections: [] })).toMatch(/sections/)
  })

  it('rejects sections with invalid names or out-of-range numbers', () => {
    const bad = validPlan()
    bad.sections[0].name = 'bridge' as any
    expect(validateArrangementPlan(bad)).toMatch(/name/)

    const bad2 = validPlan()
    bad2.sections[0].energy = 2
    expect(validateArrangementPlan(bad2)).toMatch(/energy/)

    const bad3 = validPlan()
    bad3.sections[0].progression = []
    expect(validateArrangementPlan(bad3)).toMatch(/progression/)
  })

  it('rejects non-object inputs', () => {
    expect(validateArrangementPlan(null)).toMatch(/object/)
    expect(validateArrangementPlan('plan')).toMatch(/object/)
  })
})

describe('section orchestration', () => {
  const planNoOrch: ArrangementPlan = {
    id: 't', key: 'C', bpm: 90, subGenre: 'boom-bap', mood: 'dark', acePrompt: '',
    sections: [{ name: 'verse', bars: 4, progression: ['i', 'VI'], energy: 0.6, density: 0.5 }],
  }

  it('plans WITHOUT orchestration still validate (back-compat)', () => {
    expect(validateArrangementPlan(planNoOrch)).toBeNull()
  })

  it('plans WITH a full orchestration validate', () => {
    const p = structuredClone(planNoOrch)
    p.sections[0].orchestration = {
      drums: 'out', bass: 'support', chord: 'support', melody: 'lead', texture: 'support',
    }
    expect(validateArrangementPlan(p)).toBeNull()
  })
})
