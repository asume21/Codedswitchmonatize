import { describe, it, expect } from 'vitest'
import { applyVoiceLeading } from '../voiceLeading'
import { noteToMidi } from '../../../performers/InstrumentPerformerRouter'
import type { ScheduledNote } from '../../types'

const n = (pitch: string, time = '0:0:0'): ScheduledNote => ({
  pitch,
  duration: '8n',
  velocity: 0.8,
  time,
})

describe('applyVoiceLeading', () => {
  it('collapses an octave-oscillating line so no leap exceeds maxLeapSemitones', () => {
    const input = [n('A4', '0:0:0'), n('A5', '0:0:2'), n('A4', '0:1:0'), n('A5', '0:1:2')]
    const out = applyVoiceLeading(input, { maxLeapSemitones: 7, floorMidi: 0, ceilingMidi: 127 })
    const midis = out.map((m) => noteToMidi(m.pitch) as number)
    for (let i = 1; i < midis.length; i++) {
      expect(Math.abs(midis[i] - midis[i - 1])).toBeLessThanOrEqual(7)
    }
  })

  it('drops a note above the register ceiling down by octaves until it is under the ceiling', () => {
    const ceiling = noteToMidi('A5') as number
    const out = applyVoiceLeading([n('A6')], { maxLeapSemitones: 7, floorMidi: 0, ceilingMidi: ceiling })
    expect(noteToMidi(out[0].pitch) as number).toBeLessThanOrEqual(ceiling)
  })

  it('never changes a note pitch class (harmony stays intact — only octave moves)', () => {
    const input = [n('C4'), n('E6'), n('G3'), n('B5')]
    const out = applyVoiceLeading(input, { maxLeapSemitones: 5, floorMidi: 40, ceilingMidi: 84 })
    out.forEach((m, i) => {
      expect((noteToMidi(m.pitch) as number) % 12).toBe((noteToMidi(input[i].pitch) as number) % 12)
    })
  })

  it('leaves velocity, duration, and time untouched', () => {
    const input = [{ pitch: 'A4', duration: '4n', velocity: 0.42, time: '1:2:3' }]
    const out = applyVoiceLeading(input, { maxLeapSemitones: 7, floorMidi: 0, ceilingMidi: 127 })
    expect(out[0].velocity).toBe(0.42)
    expect(out[0].duration).toBe('4n')
    expect(out[0].time).toBe('1:2:3')
  })

  it('seedMidi threads the fold into the first note instead of leaving it free (2026-07-06)', () => {
    const seed = noteToMidi('C4') as number
    const out = applyVoiceLeading([n('A5')], { maxLeapSemitones: 7, floorMidi: 0, ceilingMidi: 127, seedMidi: seed })
    const midi = noteToMidi(out[0].pitch) as number
    expect(Math.abs(midi - seed)).toBeLessThanOrEqual(7)
  })

  it('without seedMidi, the first note is only register-capped (unchanged legacy behavior)', () => {
    const out = applyVoiceLeading([n('A5')], { maxLeapSemitones: 7, floorMidi: 0, ceilingMidi: 127 })
    expect(out[0].pitch).toBe('A5')
  })

  it('breakAt lets one note leap past maxLeapSemitones on purpose (still register-capped)', () => {
    const input = [n('C4', '0:0:0'), n('C6', '0:1:0')]
    const noBreak = applyVoiceLeading(input, { maxLeapSemitones: 7, floorMidi: 0, ceilingMidi: 127 })
    const withBreak = applyVoiceLeading(input, { maxLeapSemitones: 7, floorMidi: 0, ceilingMidi: 127, breakAt: 1 })

    const noBreakMidi = noteToMidi(noBreak[1].pitch) as number
    const withBreakMidi = noteToMidi(withBreak[1].pitch) as number

    // Without the break, the leap gets folded down within range of note 0.
    expect(Math.abs(noBreakMidi - (noteToMidi(noBreak[0].pitch) as number))).toBeLessThanOrEqual(7)
    // With the break, the leap survives untouched (same octave as the input).
    expect(withBreakMidi).toBe(noteToMidi('C6'))
  })

  it('breakAt still enforces the register ceiling even though the leap-fold is skipped', () => {
    const ceiling = noteToMidi('A5') as number
    const input = [n('C4', '0:0:0'), n('C7', '0:1:0')]
    const out = applyVoiceLeading(input, { maxLeapSemitones: 7, floorMidi: 0, ceilingMidi: ceiling, breakAt: 1 })
    expect(noteToMidi(out[1].pitch) as number).toBeLessThanOrEqual(ceiling)
  })
})
