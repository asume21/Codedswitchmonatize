import { describe, expect, it } from 'vitest'
import { BassBehavior } from '../types'
import { buildBassNotes } from '../patterns/BassPatternLibrary'

describe('BassPatternLibrary', () => {
  it('keeps trap bass present across the full four-bar loop', () => {
    const notes = buildBassNotes(BassBehavior.Trap, 36, 0.5)

    expect(notes.length).toBeGreaterThanOrEqual(12)
    for (let bar = 0; bar < 4; bar++) {
      expect(notes.some(note => note.time.startsWith(`${bar}:0:`))).toBe(true)
      expect(notes.some(note => note.time.startsWith(`${bar}:2:`))).toBe(true)
    }
  })

  it('keeps slide 808 bass moving every bar instead of dropping out', () => {
    const notes = buildBassNotes(BassBehavior.Slide808, 36, 0.5)

    expect(notes.length).toBeGreaterThanOrEqual(12)
    for (let bar = 0; bar < 4; bar++) {
      expect(notes.filter(note => note.time.startsWith(`${bar}:`)).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps breathe bass anchored in every bar for sampled instruments', () => {
    const notes = buildBassNotes(BassBehavior.Breathe, 36, 0.5)

    for (let bar = 0; bar < 4; bar++) {
      expect(notes.some(note => note.time.startsWith(`${bar}:0:`))).toBe(true)
      expect(notes.some(note => note.time.startsWith(`${bar}:2:`))).toBe(true)
    }
  })
})
