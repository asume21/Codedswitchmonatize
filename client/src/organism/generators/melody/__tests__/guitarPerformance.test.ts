import { describe, expect, it } from 'vitest'
import { noteToMidi, planGuitarArticulations, developGuitarPhrase } from '../guitarPerformance'
import type { ScheduledNote } from '../../types'

describe('noteToMidi', () => {
  it('parses natural, sharp, and flat note names to MIDI', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('A4')).toBe(69)
    expect(noteToMidi('F#3')).toBe(54)
    expect(noteToMidi('Bb2')).toBe(46)
    expect(noteToMidi('C-1')).toBe(0)
  })
  it('returns null for unparseable input', () => {
    expect(noteToMidi('not-a-note')).toBeNull()
    expect(noteToMidi('')).toBeNull()
  })
})

describe('planGuitarArticulations', () => {
  const at = (pitch: string, velocity: number): ScheduledNote =>
    ({ pitch, duration: '8n', velocity, time: '0:0:0' })

  it('returns one articulation id per note', () => {
    const notes = [at('C4', 0.6), at('D4', 0.6), at('E4', 0.6)]
    expect(planGuitarArticulations(notes)).toHaveLength(3)
  })

  it('releases the last note with a fall-off', () => {
    const notes = [at('C4', 0.6), at('D4', 0.6), at('E4', 0.6)]
    const ids = planGuitarArticulations(notes)
    expect(ids[ids.length - 1]).toBe('fall-off')
  })

  it('bends (scoop-up) into an accented peak note', () => {
    const notes = [at('C4', 0.5), at('G4', 0.95), at('C4', 0.5), at('C4', 0.5)]
    const ids = planGuitarArticulations(notes, { accentThreshold: 0.8 })
    expect(ids[1]).toBe('scoop-up')
  })

  it('hammers-on (grace-flick) a stepwise ascending note', () => {
    // C4 -> D4 is a +2 semitone step up: a hammer-on.
    const notes = [at('C4', 0.5), at('D4', 0.5), at('C4', 0.5)]
    const ids = planGuitarArticulations(notes, { accentThreshold: 0.8 })
    expect(ids[1]).toBe('grace-flick')
  })

  it('leaves a plain mid-phrase note clean (none)', () => {
    // big leap down, not accented, not last → clean pluck
    const notes = [at('C5', 0.5), at('C3', 0.5), at('C4', 0.5)]
    const ids = planGuitarArticulations(notes, { accentThreshold: 0.8 })
    expect(ids[1]).toBe('none')
  })
})

describe('developGuitarPhrase', () => {
  // 8 notes on a 16th grid: positions 0..7 → downbeats at sixteenthPos 0 and 4.
  const phrase = (): ScheduledNote[] => {
    const notes: ScheduledNote[] = []
    for (let i = 0; i < 8; i++) {
      const beat = Math.floor(i / 4)
      const sub = i % 4
      notes.push({ pitch: 'C4', duration: '16n', velocity: 0.6, time: `0:${beat}:${sub}` })
    }
    return notes
  }
  const isDownbeat = (n: ScheduledNote) => {
    const p = n.time.split(':'); return (Math.floor(+p[1] * 4 + +p[2]) % 16) % 4 === 0
  }

  it('states the idea unchanged on even (statement) phrases', () => {
    const input = phrase()
    expect(developGuitarPhrase(input, 0)).toEqual(input)
    expect(developGuitarPhrase(input, 2)).toEqual(input)
  })

  it('thins weak-beat notes on odd (answer) phrases — leaves space', () => {
    const input = phrase()
    const answer = developGuitarPhrase(input, 1)
    expect(answer.length).toBeLessThan(input.length)
  })

  it('always keeps the downbeats (structure survives the thinning)', () => {
    const input = phrase()
    const downbeats = input.filter(isDownbeat)
    const answer = developGuitarPhrase(input, 1)
    const keptDownbeats = answer.filter(isDownbeat)
    expect(keptDownbeats.length).toBe(downbeats.length)
  })
})
