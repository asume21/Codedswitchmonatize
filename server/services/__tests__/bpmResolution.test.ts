import { describe, it, expect } from 'vitest'
import { resolveBpm, buildVariationPrompt } from '../bpmResolution'

/**
 * Production failure this guards (2026-08-20):
 *   prompt: "Boom bap drums ... 90 BPM, A minor, energetic and driving style, 120 bpm"
 *   bpm:    120
 *   → ValueError: Failed to generate a loop in the requested 120.0 bpm.
 *
 * The route never forwarded the user's tempo, so the service fell back to its
 * bpm=120 default and appended a SECOND, contradictory tempo to a prompt that
 * already said 90. The model generated ~90 BPM audio and then could not slice a
 * 120 BPM loop out of it.
 */
describe('resolveBpm', () => {
  it('uses the tempo written in the prompt over a caller default', () => {
    expect(resolveBpm('Boom bap drums, 90 BPM, A minor', 120)).toBe(90)
  })

  it('matches lowercase and no-space spellings', () => {
    expect(resolveBpm('lofi 75bpm chill', 120)).toBe(75)
    expect(resolveBpm('drill at 140 bpm', 120)).toBe(140)
  })

  it('falls back to the requested tempo when the prompt names none', () => {
    expect(resolveBpm('dark trap with heavy 808s', 75)).toBe(75)
  })

  it('ignores implausible tempos rather than trusting a stray number', () => {
    expect(resolveBpm('song 900 bpm', 100)).toBe(100)
    expect(resolveBpm('song 3 bpm', 100)).toBe(100)
  })

  it('ignores numbers that are not tempos', () => {
    expect(resolveBpm('808 bass and 3 chords', 90)).toBe(90)
  })

  it('falls back to 120 only when nothing else is known', () => {
    expect(resolveBpm('dark trap', undefined)).toBe(120)
  })
})

describe('buildVariationPrompt', () => {
  it('never appends a second tempo when the prompt already states one', () => {
    const p = buildVariationPrompt('Boom bap, 90 BPM, A minor', 'energetic and driving', 90, 42)
    expect(p.match(/bpm/gi)?.length).toBe(1)
    expect(p).not.toContain('120')
  })

  it('states the tempo once when the prompt omits it', () => {
    const p = buildVariationPrompt('dark trap', 'dark and moody', 75, 42)
    expect(p.match(/bpm/gi)?.length).toBe(1)
    expect(p).toContain('75 bpm')
  })

  it('keeps the variation descriptor and a seed for variety', () => {
    const p = buildVariationPrompt('dark trap', 'dark and moody', 75, 4242)
    expect(p).toContain('dark and moody')
    expect(p).toContain('4242')
  })

  it('never lets the appended tempo contradict the prompt tempo', () => {
    const p = buildVariationPrompt('boom bap 90 BPM', 'groovy', resolveBpm('boom bap 90 BPM', 120), 1)
    expect(p).not.toMatch(/120\s*bpm/i)
  })
})
