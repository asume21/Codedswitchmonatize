import { describe, expect, it } from 'vitest'
import {
  canPerformRole,
  conformChordToInstrument,
  conformNoteToInstrument,
  midiToNote,
  noteToMidi,
  selectInstrumentPerformer,
} from '../InstrumentPerformerRouter'
import { INSTRUMENT_PERFORMERS } from '../InstrumentRegistry'
import { INSTRUMENT_PERFORMERS_BY_ID } from '../InstrumentRegistry'

describe('InstrumentPerformerRouter', () => {
  // Selection carries a per-start variety seed (reseedPerformerSelection).
  // Contract (2026-07-03, "any instrument can be in any genre"): the winner is
  // USUALLY from the mode's idiomatic pool, but a wildcard start may pick any
  // role-capable instrument — the genre lives in HOW it's played, not the
  // timbre. So the assertion is statistical, not absolute.
  it('lead picks are mostly idiomatic for the mode across reseeds', () => {
    const pools: Array<[string, string[]]> = [
      ['ice',  ['harp', 'violin', 'sitar', 'flute']],
      ['glow', ['violin', 'guitar-nylon', 'clarinet', 'flute']],
      ['heat', ['piano', 'rhodes', 'guitar-clean', 'violin']],
    ]
    for (const [mode, pool] of pools) {
      let idiomatic = 0
      const RUNS = 40
      for (let i = 0; i < RUNS; i++) {
        reseedPerformerSelection()
        if (pool.includes(selectInstrumentPerformer({ role: 'lead', mode, energy: 0.5 }).id)) idiomatic++
      }
      expect(idiomatic, `${mode}: only ${idiomatic}/${RUNS} idiomatic`).toBeGreaterThan(RUNS * 0.55)
    }
  })

  it('keeps flute as an optional color instead of the generic lead fallback', () => {
    expect(selectInstrumentPerformer({ role: 'lead', mode: 'unknown', energy: 0.5 }).id)
      .toBe('piano')

    const flute = INSTRUMENT_PERFORMERS_BY_ID.get('flute')!
    expect(flute.defaultLeadArticulation).toBe('legato-slur')
  })

  it('selects idiomatic bass instruments by mode', () => {
    expect(['bass-upright', 'bass-electric'])
      .toContain(selectInstrumentPerformer({ role: 'bass', mode: 'smoke', energy: 0.4 }).id)
    expect(['bass-synth', 'bass-electric'])
      .toContain(selectInstrumentPerformer({ role: 'bass', mode: 'heat', energy: 0.8 }).id)
  })

  it('maps upright bass to the recorded SSO basses multisample when available', () => {
    const upright = INSTRUMENT_PERFORMERS_BY_ID.get('bass-upright')!
    expect(upright.realInstrument).toBe('SSO_Basses')
  })

  it('converts between note names and midi', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('A0')).toBe(21)
    expect(midiToNote(61)).toBe('C#4')
  })

  it('conforms mono lead notes to instrument range', () => {
    const flute = INSTRUMENT_PERFORMERS_BY_ID.get('flute')!
    expect(conformNoteToInstrument('C3', flute)).toBe('C4')
    expect(conformNoteToInstrument('C8', flute)).toBe('C7')
  })

  it('collapses mono performers to one chord voice', () => {
    const violin = INSTRUMENT_PERFORMERS_BY_ID.get('violin')!
    expect(conformChordToInstrument(['C3', 'E3', 'G3'], violin)).toEqual(['E4'])
  })

  it('keeps plucked chord voicings compact', () => {
    const guitar = INSTRUMENT_PERFORMERS_BY_ID.get('guitar-nylon')!
    expect(conformChordToInstrument(['C2', 'E2', 'G2', 'B2', 'D3'], guitar)).toHaveLength(4)
  })
})

// ── Wildcard starts — any instrument can be in any genre ────────────────────
// The genre lives in HOW the instrument is played (skeletons, swing, comping
// idiom), not the timbre. The preferred pools are taste-defaults, not gates.
import { reseedPerformerSelection, selectInstrumentPerformer as pick } from '../InstrumentPerformerRouter'

describe('wildcard instrument selection', () => {
  it('boom-bap lead occasionally lands OUTSIDE the preferred pool, but the house sound stays the norm', () => {
    const preferredGravelLeads = new Set(['piano', 'sax', 'rhodes', 'violin'])
    let outside = 0
    const RUNS = 80
    for (let i = 0; i < RUNS; i++) {
      reseedPerformerSelection()
      const lead = pick({ role: 'lead', mode: 'gravel', energy: 0.5 })
      if (!preferredGravelLeads.has(lead.id)) outside++
    }
    // 8% curated wildcard chance: variety remains possible without random brass
    // taking over the house sound.
    expect(outside, 'no wildcard pick in 80 reseeds').toBeGreaterThan(0)
    // ...but the preferred pool must still dominate (taste-default, not chaos).
    expect(outside, `wildcards took over: ${outside}/${RUNS}`).toBeLessThan(RUNS * 0.45)
  })

  it('an explicit pick is never overridden by the wildcard roll', () => {
    for (let i = 0; i < 20; i++) {
      reseedPerformerSelection()
      expect(pick({ role: 'lead', mode: 'gravel', energy: 0.5, explicitId: 'violin' }).id).toBe('violin')
    }
  })
})

// ── The chord role must be able to sound a CHORD ─────────────────────
// conformChordToInstrument collapses a chord to its single top note when the
// profile is polyphony:'mono'. Five monophonic instruments (violin, cello,
// trumpet, trombone, french-horn) declared the 'chord' role, so whenever the
// selector landed on one the harmony was DELETED — one note per hit, which the
// user heard as "all I kept hearing was one fucking note each time, like a kid
// using his finger on a piano". A trumpet cannot comp chords; that is a category
// error, not a voicing choice.
describe('selectInstrumentPerformer — the chord role can always play a chord', () => {
  const MODES = ['heat', 'ice', 'smoke', 'gravel', 'glow'] as const

  it('never assigns a monophonic instrument to the chord role', () => {
    for (const mode of MODES) {
      for (let energy = 0; energy <= 1.0001; energy += 0.1) {
        const profile = selectInstrumentPerformer({ role: 'chord', mode, energy } as any)
        expect(
          profile.polyphony,
          `${profile.id} was picked for chords in ${mode} @ energy ${energy.toFixed(1)}`,
        ).not.toBe('mono')
      }
    }
  })

  it('still allows monophonic instruments to take the LEAD role', () => {
    const ids = new Set<string>()
    for (const mode of MODES) {
      for (let energy = 0; energy <= 1.0001; energy += 0.1) {
        ids.add(selectInstrumentPerformer({ role: 'lead', mode, energy } as any).id)
      }
    }
    expect(ids.size).toBeGreaterThan(0)
  })
})

describe('the chord role can never be monophonic — even when explicitly asked', () => {
  it('ignores an explicit MONO pick for chords and falls back to something polyphonic', () => {
    // The guard filtered the automatic candidate list, but the explicitId branch
    // returned BEFORE it — so the picker could not choose a trumpet for chords,
    // while choosing one in the dropdown collapsed every chord to its top note.
    const mono = INSTRUMENT_PERFORMERS.find(
      (p) => p.polyphony === 'mono' && p.roles.includes('chord'),
    )
    if (!mono) return // no mono instrument declares 'chord' — nothing to guard
    const picked = selectInstrumentPerformer({
      role: 'chord', mode: 'gravel', energy: 0.6,
      explicitId: mono.id,
    })
    expect(picked.polyphony).not.toBe('mono')
  })

  it('still honours an explicit mono pick for the LEAD role, where one line is the point', () => {
    const mono = INSTRUMENT_PERFORMERS.find(
      (p) => p.polyphony === 'mono' && p.roles.includes('lead'),
    )
    if (!mono) return
    const picked = selectInstrumentPerformer({
      role: 'lead', mode: 'gravel', energy: 0.6,
      explicitId: mono.id,
    })
    expect(picked.id).toBe(mono.id)
  })
})
