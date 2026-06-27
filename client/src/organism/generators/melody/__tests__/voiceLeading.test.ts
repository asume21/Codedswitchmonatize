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
})
