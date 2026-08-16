/**
 * CSBL Section 8 — sound design parameters.
 *
 * The parser has always accepted `{punch: 0.8}` and parsed it into a
 * Record<string, number> that NOTHING read and NOTHING validated. So a typo, a
 * param meant for another role, and a param the engine cannot route were all
 * silently swallowed — the exact failure mode spec 13.7 #2 warns about.
 *
 * These tests define the registry that closes that hole.
 */

import { describe, it, expect } from 'vitest'
import { validateSoundParams, soundParamsForRole } from '../csbl-sound-design'
import { compileCsbl } from '../csblToOrganism'

describe('validateSoundParams', () => {
  it('accepts a routed universal param on any role', () => {
    const r = validateSoundParams('hats', { humanize: 0.5 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.params.humanize).toBe(0.5)
  })

  it('accepts no params at all', () => {
    const r = validateSoundParams('kick', {})
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.params).toEqual({})
  })

  it('rejects an unknown param and names it', () => {
    const r = validateSoundParams('kick', { thicc: 0.9 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/thicc/)
  })

  it('rejects a role-scoped param used on the wrong role', () => {
    // glide is a BASS param; a hat cannot slide to a pitch it does not have.
    const r = validateSoundParams('hats', { glide: 0.4 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/glide/)
    if (!r.ok) expect(r.error).toMatch(/bass/)
  })

  it('accepts that same param on its own role', () => {
    const r = validateSoundParams('bass', { glide: 0.4 })
    expect(r.ok).toBe(true)
  })

  it('rejects an out-of-range value and states the range', () => {
    const r = validateSoundParams('hats', { humanize: 4 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/0.*1/)
  })

  it('rejects a param the spec declares but the engine cannot route yet', () => {
    // Section 8 lists `punch`, but its only implementation is the drum bus
    // compressor, which the mix owns. Routing CSBL into it would create a
    // second mix authority, so it fails LOUDLY instead of doing nothing.
    const r = validateSoundParams('kick', { punch: 0.7 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/not routed/i)
  })

  it('reports every bad param, not just the first', () => {
    const r = validateSoundParams('kick', { thicc: 1, wobbly: 2 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/thicc/)
      expect(r.error).toMatch(/wobbly/)
    }
  })
})

describe('soundParamsForRole', () => {
  it('offers the routed universal params to a drum role', () => {
    const names = soundParamsForRole('hats').map((p) => p.name)
    expect(names).toContain('humanize')
    expect(names).not.toContain('glide')
  })

  it('offers glide to bass', () => {
    const names = soundParamsForRole('bass').map((p) => p.name)
    expect(names).toContain('glide')
  })
})

describe('compileCsbl carries sound design', () => {
  it('attaches validated params to a drum audition', () => {
    const r = compileCsbl('trap.hats("2-step") {humanize: 0.8}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.sound).toEqual({ humanize: 0.8 })
  })

  it('fails the whole compile when a param is bad', () => {
    const r = compileCsbl('trap.hats("2-step") {thicc: 0.8}')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/thicc/)
  })

  it('attaches params to a bass audition', () => {
    const r = compileCsbl('trap.bass("glide") {glide: 0.6}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.sound).toEqual({ glide: 0.6 })
  })
})
