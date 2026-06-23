import { describe, expect, it } from 'vitest'
import { interpretVibeRuleBased } from '../ArtistReferenceBank'

describe('interpretVibeRuleBased — artist references', () => {
  // Each entry is a single representative key; the bank has aliases for most.
  const ARTIST_CASES: Array<[string, string, number, number]> = [
    // [input, expected mode, expected bpm, min confidence]
    ['tupac',          'gravel', 90,  0.9],
    ['eminem',         'heat',   105, 0.9],
    ['drake',          'glow',   80,  0.9],
    ['kendrick',       'gravel', 88,  0.9],
    ['travis scott',   'ice',    140, 0.9],
    ['j cole',         'glow',   85,  0.85],
    ['future',         'ice',    130, 0.85],
    ['nas',            'gravel', 92,  0.85],
    ['21 savage',      'heat',   140, 0.85],
    ['pop smoke',      'gravel', 140, 0.85],
    ['chief keef',     'gravel', 145, 0.85],
    ['gunna',          'ice',    142, 0.85],
    ['lil baby',       'heat',   142, 0.85],
    ['polo g',         'ice',    138, 0.85],
    ['rod wave',       'glow',   80,  0.85],
    ['playboi carti',  'ice',    140, 0.85],
  ]

  it.each(ARTIST_CASES)(
    'resolves %q to mode=%s bpm=%d',
    (input, expectedMode, expectedBpm, minConfidence) => {
      const result = interpretVibeRuleBased(input)
      expect(result.mode).toBe(expectedMode)
      expect(result.bpm).toBe(expectedBpm)
      expect(result.confidence).toBeGreaterThanOrEqual(minConfidence)
      expect(result.interpretation).toBeTypeOf('string')
      expect(result.interpretation.length).toBeGreaterThan(0)
    }
  )

  it('normalizes multi-word artist keys across punctuation', () => {
    // These should all hit the Travis Scott entry even with surrounding noise.
    expect(interpretVibeRuleBased('travis scott, trap vibes').subGenre).toBe('trap')
    expect(interpretVibeRuleBased('la flame!!').mode).toBe('ice')
    expect(interpretVibeRuleBased('CACTUS JACK beat').bpm).toBe(140)
  })

  it('treats artist matches as higher priority than generic genre keywords', () => {
    // "Kendrick" says boom-bap, but the phrase also contains "trap" which would
    // otherwise match a genre entry. Artist should win (it's first in the scan order).
    const result = interpretVibeRuleBased('kendrick trap')
    expect(result.subGenre).toBe('boom-bap')
    expect(result.mode).toBe('gravel')
  })
})

describe('interpretVibeRuleBased — genre keywords', () => {
  it('matches uk drill specifically before falling through to plain drill', () => {
    const uk = interpretVibeRuleBased('uk drill')
    expect(uk.bpm).toBe(140)
    expect(uk.subGenre).toBe('drill')
  })

  it('matches chicago drill before plain drill', () => {
    const chi = interpretVibeRuleBased('chicago drill')
    expect(chi.bpm).toBe(145)
    expect(chi.energy).toBeGreaterThanOrEqual(0.9)
  })

  it('falls through to plain drill for bare keyword', () => {
    const plain = interpretVibeRuleBased('drill')
    expect(plain.subGenre).toBe('drill')
    expect(plain.bpm).toBe(145)
  })

  it('matches boom-bap with hyphen, without hyphen, and with space', () => {
    expect(interpretVibeRuleBased('boom-bap').subGenre).toBe('boom-bap')
    expect(interpretVibeRuleBased('boom bap').subGenre).toBe('boom-bap')
  })

  it('matches lo-fi under multiple spellings', () => {
    expect(interpretVibeRuleBased('lofi').subGenre).toBe('lo-fi')
    expect(interpretVibeRuleBased('lo-fi').subGenre).toBe('lo-fi')
    expect(interpretVibeRuleBased('lo fi').subGenre).toBe('lo-fi')
  })

  it('uses chill as the glow/low-energy genre', () => {
    const r = interpretVibeRuleBased('just chill')
    expect(r.subGenre).toBe('chill')
    expect(r.mode).toBe('glow')
    expect(r.energy).toBeLessThan(0.5)
  })
})

describe('interpretVibeRuleBased — mood modifiers', () => {
  it('"dark" shifts mode to gravel and lowers energy', () => {
    const base = interpretVibeRuleBased('trap')
    const dark = interpretVibeRuleBased('dark trap')
    expect(dark.mode).toBe('gravel')
    expect(dark.energy).toBeLessThan(base.energy)
  })

  it('"fired up" raises energy, density, and bounce', () => {
    const base = interpretVibeRuleBased('trap')
    const hype = interpretVibeRuleBased('fired up trap')
    expect(hype.energy).toBeGreaterThan(base.energy)
    expect(hype.density).toBeGreaterThan(base.density)
    expect(hype.bounce).toBeGreaterThan(base.bounce)
  })

  it('"story beat" slows tempo and reduces density', () => {
    const base = interpretVibeRuleBased('boom bap')
    const story = interpretVibeRuleBased('boom bap story beat')
    expect(story.bpm).toBe(base.bpm - 15)
    expect(story.density).toBeLessThan(base.density)
  })

  it('"faster" adds 20 BPM, "slower" subtracts 20', () => {
    const base = interpretVibeRuleBased('trap')
    expect(interpretVibeRuleBased('faster trap').bpm).toBe(base.bpm + 20)
    expect(interpretVibeRuleBased('slower trap').bpm).toBe(base.bpm - 20)
  })

  it('stacks multiple modifiers on one phrase', () => {
    const base = interpretVibeRuleBased('trap')
    const stacked = interpretVibeRuleBased('fired up aggressive trap')
    // Both 'fired up' (+0.15) and 'aggressive' (+0.20) raise energy.
    expect(stacked.energy).toBeGreaterThan(base.energy + 0.20)
  })

  it('"soulful" overrides mode to smoke and boosts swing', () => {
    const base = interpretVibeRuleBased('boom bap')
    const soulful = interpretVibeRuleBased('soulful boom bap')
    expect(soulful.mode).toBe('smoke')
    expect(soulful.swing).toBeGreaterThan(base.swing)
  })
})

describe('interpretVibeRuleBased — clamping and edge cases', () => {
  it('clamps BPM into [60, 200] even with extreme modifiers', () => {
    // lo-fi base 78, "slower" -20 = 58, would clamp to 60
    const slowed = interpretVibeRuleBased('slower slower lofi')
    expect(slowed.bpm).toBeGreaterThanOrEqual(60)
    expect(slowed.bpm).toBeLessThanOrEqual(200)
  })

  it('clamps energy/swing/bounce/density into [0, 1]', () => {
    // Pile on energy-raising modifiers — should cap at 1.0, not overshoot.
    const maxed = interpretVibeRuleBased('fired up aggressive hard punchy drill')
    expect(maxed.energy).toBeLessThanOrEqual(1.0)
    expect(maxed.density).toBeLessThanOrEqual(1.0)
    expect(maxed.bounce).toBeLessThanOrEqual(1.0)

    // Stack subtractive ones — should floor at 0, not negative.
    const mellowed = interpretVibeRuleBased('chill smooth story beat')
    expect(mellowed.energy).toBeGreaterThanOrEqual(0)
  })

  it('returns a valid default for completely unrecognized text', () => {
    const result = interpretVibeRuleBased('asdfghjkl qwertyuiop')
    expect(result.bpm).toBeGreaterThanOrEqual(60)
    expect(result.bpm).toBeLessThanOrEqual(200)
    expect(['heat', 'ice', 'smoke', 'gravel', 'glow']).toContain(result.mode)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('is case-insensitive', () => {
    const lower = interpretVibeRuleBased('kendrick')
    const upper = interpretVibeRuleBased('KENDRICK')
    const mixed = interpretVibeRuleBased('KenDricK')
    expect(upper).toEqual(lower)
    expect(mixed).toEqual(lower)
  })

  it('ignores non-alphanumeric punctuation in matching', () => {
    // Commas, exclamations, quotes should not block keyword detection.
    const clean   = interpretVibeRuleBased('drake')
    const punched = interpretVibeRuleBased('"drake"!!!')
    const phrased = interpretVibeRuleBased('like, drake, you know?')
    expect(punched.mode).toBe(clean.mode)
    expect(phrased.mode).toBe(clean.mode)
  })

  it('returns an interpretation string under 100 characters', () => {
    for (const phrase of ['tupac', 'drill', 'fired up aggressive trap', 'nonsense']) {
      const result = interpretVibeRuleBased(phrase)
      expect(result.interpretation.length).toBeLessThanOrEqual(100)
    }
  })
})
