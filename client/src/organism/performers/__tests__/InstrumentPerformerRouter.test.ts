import { describe, expect, it } from 'vitest'
import {
  conformChordToInstrument,
  conformNoteToInstrument,
  midiToNote,
  noteToMidi,
  selectInstrumentPerformer,
} from '../InstrumentPerformerRouter'
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
      ['heat', ['piano', 'trumpet', 'rhodes']],
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
    const preferredGravelLeads = new Set(['piano', 'sax', 'trumpet', 'violin'])
    let outside = 0
    const RUNS = 80
    for (let i = 0; i < RUNS; i++) {
      reseedPerformerSelection()
      const lead = pick({ role: 'lead', mode: 'gravel', energy: 0.5 })
      if (!preferredGravelLeads.has(lead.id)) outside++
    }
    // ~18% wildcard chance: P(zero in 80) ≈ 0.82^80 ≈ 1e-7 — must appear...
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
