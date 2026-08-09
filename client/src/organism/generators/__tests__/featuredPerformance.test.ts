import { describe, expect, it } from 'vitest'
import {
  featuredArrangementMultiplier,
  isFeaturedRole,
  resolveFeaturedRole,
} from '../featuredPerformance'

describe('featuredPerformance', () => {
  it('does not alter planned roles when no performance is featured', () => {
    expect(resolveFeaturedRole('none', 'melody', 'out')).toBe('out')
    expect(resolveFeaturedRole('none', 'drums', 'lead')).toBe('lead')
  })

  it('makes one requested player lead and the band support it', () => {
    expect(resolveFeaturedRole('melody', 'melody', 'out')).toBe('lead')
    expect(resolveFeaturedRole('melody', 'chord', 'lead')).toBe('support')
    expect(resolveFeaturedRole('melody', 'drums', 'lead')).toBe('support')
    expect(resolveFeaturedRole('melody', 'bass', 'lead')).toBe('support')
  })

  it('treats melody + chords as co-featured duet players', () => {
    expect(isFeaturedRole('melody-chords', 'melody')).toBe(true)
    expect(isFeaturedRole('melody-chords', 'chord')).toBe(true)
    expect(resolveFeaturedRole('melody-chords', 'texture', 'lead')).toBe('support')
  })

  it('keeps a featured player audible without flattening louder section arcs', () => {
    expect(featuredArrangementMultiplier('chord', 'chord', 0.35)).toBe(0.72)
    expect(featuredArrangementMultiplier('chord', 'chord', 0.95)).toBe(0.95)
    expect(featuredArrangementMultiplier('chord', 'melody', 0.35)).toBe(0.35)
  })
})
