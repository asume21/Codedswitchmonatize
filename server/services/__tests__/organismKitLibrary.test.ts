import fs from 'fs'
import { describe, it, expect } from 'vitest'
import { listOrganismKits, pickBestOrganismKit } from '../organismKitLibrary'

describe('organismKitLibrary', () => {
  it('includes the infinity-real-beat premium kit', () => {
    const kits = listOrganismKits()
    const ids = kits.map((k) => k.id)
    expect(ids).toContain('infinity-real-beat')
  })

  it('selects the infinity-real-beat kit as the best kit', () => {
    const best = pickBestOrganismKit()
    expect(best).toBeDefined()
    expect(best?.id).toBe('infinity-real-beat')
    expect(best?.priority).toBe(100)
  })

  it('premium kit covers the required drum one-shot roles', () => {
    const best = pickBestOrganismKit()
    const roles = new Set(best?.samples.map((s) => s.role))
    expect(roles).toContain('kick')
    expect(roles).toContain('snare')
    expect(roles).toContain('hat')
    expect(roles).toContain('perc')
    // bass808 is intentionally NOT required from this kit: the committed stub
    // ships only a 0-byte 808-bass.wav placeholder, which the scanner now
    // excludes. The Organism's 808 is supplied by the committed Cymatics
    // "Rumble" 808 fallback (see OrganismKitCache.findBass808Sample).
  })

  it('excludes 0-byte placeholder samples so a broken stub never masks a fallback', () => {
    const best = pickBestOrganismKit()
    const samples = best?.samples ?? []
    expect(samples.length).toBeGreaterThan(0)
    // Every advertised sample must be a real, non-empty file. A 0-byte file
    // can't be decoded and would mask a working committed fallback sample.
    for (const sample of samples) {
      expect(fs.statSync(sample.filePath).size).toBeGreaterThan(0)
    }
    // The committed stub's 0-byte 808-bass.wav must not be advertised.
    expect(samples.some((s) => s.fileName === '808-bass.wav')).toBe(false)
  })
})
