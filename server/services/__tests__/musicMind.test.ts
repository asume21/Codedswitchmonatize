import { describe, expect, it } from 'vitest'
import { getProgressionForSection } from '../musicMind'

describe('getProgressionForSection', () => {
  it('returns a non-empty array for every known genre × section combo', () => {
    const genres = [
      'boom-bap','lo-fi','trap','drill','r&b','soul','chill',
      'west-coast','dirty-south','phonk','afrobeat','jersey-club',
      'bounce','reggaeton','hip-hop',
    ]
    const sections = ['intro','verse','build','drop','breakdown','drop2','outro']
    for (const genre of genres) {
      for (const section of sections) {
        const prog = getProgressionForSection(genre, section)
        expect(prog.length, `${genre}/${section} should have chords`).toBeGreaterThan(0)
      }
    }
  })

  it('no two adjacent sections share the same progression for any genre', () => {
    const genres = [
      'boom-bap','lo-fi','trap','drill','r&b','soul','chill',
      'west-coast','dirty-south','phonk','afrobeat','jersey-club',
      'bounce','reggaeton','hip-hop',
    ]
    const sections = ['intro','verse','build','drop','breakdown','drop2']
    for (const genre of genres) {
      for (let i = 0; i < sections.length - 1; i++) {
        const a = getProgressionForSection(genre, sections[i])
        const b = getProgressionForSection(genre, sections[i + 1])
        expect(
          JSON.stringify(a),
          `${genre}: ${sections[i]} and ${sections[i+1]} must differ`
        ).not.toBe(JSON.stringify(b))
      }
    }
  })

  it('falls back to a section-appropriate progression for unknown genre', () => {
    const intro = getProgressionForSection('breakcore', 'intro')
    const drop  = getProgressionForSection('breakcore', 'drop')
    expect(intro.length).toBeGreaterThan(0)
    expect(drop.length).toBeGreaterThan(0)
    // Fallback must still differ by section
    expect(JSON.stringify(intro)).not.toBe(JSON.stringify(drop))
  })

  it('absolute last resort returns a non-empty array for a completely unknown section', () => {
    const result = getProgressionForSection('breakcore', 'unknown-section-xyz')
    expect(result.length).toBeGreaterThan(0)
  })
})
