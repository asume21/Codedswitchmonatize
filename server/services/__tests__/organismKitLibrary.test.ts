import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { listOrganismKits, pickBestOrganismKit } from '../organismKitLibrary'
import path from 'path'

describe('organismKitLibrary', () => {
  beforeAll(() => {
    // Isolate tests from local premium downloads in the private/ folder
    const committedPath = path.resolve(process.cwd(), "server", "Assets", "organism-kits")
    process.env.ORGANISM_KIT_ROOT = committedPath
  })

  afterAll(() => {
    delete process.env.ORGANISM_KIT_ROOT
  })
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

  it('excludes the 0-byte 808-bass.wav placeholder so it never masks the real 808 fallback', () => {
    const best = pickBestOrganismKit()
    const samples = best?.samples ?? []
    expect(samples.length).toBeGreaterThan(0)
    // The committed stub ships a 0-byte 808-bass.wav purely as a role
    // placeholder; the scanner must not advertise it as a usable sample,
    // otherwise it masks the committed Cymatics 808 fallback.
    expect(samples.some((s) => s.fileName === '808-bass.wav')).toBe(false)
    expect(samples.some((s) => s.role === 'bass808')).toBe(false)
  })
})
