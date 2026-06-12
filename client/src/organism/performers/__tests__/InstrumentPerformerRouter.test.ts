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
  // Selection carries a per-start variety seed (reseedPerformerSelection) so
  // cold starts don't all pick the same instrument — the contract is that the
  // winner stays WITHIN the mode's idiomatic preferred list (the jitter is too
  // small to lift a non-preferred candidate over the preference gap).
  it('selects idiomatic lead instruments by mode', () => {
    expect(['flute', 'harp', 'violin', 'sitar'])
      .toContain(selectInstrumentPerformer({ role: 'lead', mode: 'ice', energy: 0.4 }).id)
    expect(['violin', 'flute', 'guitar-nylon', 'clarinet'])
      .toContain(selectInstrumentPerformer({ role: 'lead', mode: 'glow', energy: 0.5 }).id)
    expect(['piano', 'trumpet', 'rhodes'])
      .toContain(selectInstrumentPerformer({ role: 'lead', mode: 'heat', energy: 0.9 }).id)
  })

  it('selects idiomatic bass instruments by mode', () => {
    expect(['bass-upright', 'bass-electric'])
      .toContain(selectInstrumentPerformer({ role: 'bass', mode: 'smoke', energy: 0.4 }).id)
    expect(['bass-synth', 'bass-electric'])
      .toContain(selectInstrumentPerformer({ role: 'bass', mode: 'heat', energy: 0.8 }).id)
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
