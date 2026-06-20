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

  it('premium kit covers the required drum roles', () => {
    const best = pickBestOrganismKit()
    const roles = new Set(best?.samples.map((s) => s.role))
    expect(roles).toContain('kick')
    expect(roles).toContain('snare')
    expect(roles).toContain('hat')
    expect(roles).toContain('bass808')
  })

  it('bass808 sample carries the configured root note', () => {
    const best = pickBestOrganismKit()
    const bass808 = best?.samples.find((s) => s.role === 'bass808')
    expect(bass808).toBeDefined()
    expect(bass808?.rootNote).toBe('C1')
  })
})
