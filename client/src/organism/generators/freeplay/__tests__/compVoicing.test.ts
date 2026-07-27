import { describe, it, expect } from 'vitest'
import { compVoicingForHit } from '../score'

describe('compVoicingForHit', () => {
  const voicing = [59, 64, 67, 72] // B3, E4, G4, C5 (a real Conductor voicing)

  it('gives the full stack on the downbeat (hit 0)', () => {
    expect(compVoicingForHit(voicing, 0)).toEqual(voicing)
  })

  it('produces movement — consecutive hits are NOT the identical block', () => {
    const h0 = compVoicingForHit(voicing, 0).join(',')
    const h1 = compVoicingForHit(voicing, 1).join(',')
    const h2 = compVoicingForHit(voicing, 2).join(',')
    const h3 = compVoicingForHit(voicing, 3).join(',')
    const distinct = new Set([h0, h1, h2, h3])
    expect(distinct.size).toBeGreaterThanOrEqual(3) // at least 3 different treatments
  })

  it('invents no new harmony — every note is a voiced tone, at most an octave shifted', () => {
    const pcs = new Set(voicing.map((n) => n % 12))
    for (let hit = 0; hit < 8; hit++) {
      for (const n of compVoicingForHit(voicing, hit)) {
        expect(pcs.has(n % 12)).toBe(true)
      }
    }
  })

  it('is deterministic in hitIndex (locked loop stays identical each cycle)', () => {
    expect(compVoicingForHit(voicing, 5)).toEqual(compVoicingForHit(voicing, 5))
    expect(compVoicingForHit(voicing, 2)).toEqual(compVoicingForHit(voicing, 6)) // 4-cycle
  })

  it('leaves tiny voicings (< 3 notes) untouched', () => {
    expect(compVoicingForHit([60, 67], 1)).toEqual([60, 67])
  })
})
