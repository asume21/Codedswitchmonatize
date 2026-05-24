import { describe, expect, it } from 'vitest'
import { Conductor } from '../Conductor'

describe('Conductor', () => {
  it('publishes a structured score frame for the band', () => {
    const conductor = new Conductor({ key: 'C', subGenre: 'trap' })
    const frame = conductor.getScoreFrame()

    expect(frame).toMatchObject({
      bar: 0,
      bpm: 90,
      section: 'intro',
      key: 'C',
      rootPitchClass: 0,
      scale: 'minor',
      subGenre: 'trap',
      mood: 'focused',
      chordIndex: 0,
      energy: 0,
      density: 0,
      groove: 'straight',
    })
    expect(frame.currentChord.symbol).toBe('Cm')
    expect(frame.nextChord.symbol).toBe('Ab')
    expect(frame.progression.map(chord => chord.symbol)).toEqual(['Cm', 'Ab', 'Bb', 'Cm'])
    expect(frame.scaleIntervals).toEqual([0, 2, 3, 5, 7, 8, 10])
    expect(frame.aceStep.promptTags).toEqual(expect.arrayContaining([
      'trap',
      'focused',
      '90 bpm',
      'instrumental',
      'professional mix',
    ]))
  })

  it('updates score context without corrupting harmonic state', () => {
    const conductor = new Conductor({ key: 'D', subGenre: 'boom-bap' })

    conductor.updateScoreContext({
      bar: 12.8,
      bpm: 141.2,
      section: 'verse',
      energy: 1.4,
      density: -0.2,
      groove: 'boom-bap',
      mood: 'melancholic',
    })

    const frame = conductor.getScoreFrame()
    expect(frame.bar).toBe(12)
    expect(frame.bpm).toBe(141)
    expect(frame.section).toBe('verse')
    expect(frame.energy).toBe(1)
    expect(frame.density).toBe(0)
    expect(frame.groove).toBe('boom-bap')
    expect(frame.mood).toBe('melancholic')
    expect(frame.key).toBe('D')
    expect(frame.currentChord.symbol).toBe('Dm7')
    expect(frame.aceStep).toMatchObject({
      genre: 'boom-bap',
      mood: 'melancholic',
      bpm: 141,
      section: 'verse',
    })
  })

  it('moves current and next chord through the same score frame', () => {
    const conductor = new Conductor({ key: 'C', subGenre: 'trap' })

    conductor.advanceChord()
    const frame = conductor.getScoreFrame()

    expect(frame.chordIndex).toBe(1)
    expect(frame.currentChord.symbol).toBe('Ab')
    expect(frame.nextChord.symbol).toBe('Bb')
  })
})
