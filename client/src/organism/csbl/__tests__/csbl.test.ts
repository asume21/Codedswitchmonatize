import { describe, expect, it } from 'vitest'
import { parseCSBL } from '../csbl-parser'
import { compileDrumBlockToHits, drumPatternToDrumHits } from '../csbl-compiler-drums'
import { bassPatternToHits } from '../csbl-compiler-bass'
import { parseChordPattern } from '../csbl-chords-degrees'
import { tokenizePattern } from '../csbl-lexer'
import { compileCsblToDrumHits, compileCsbl } from '../csblToOrganism'
import { CSBL_VIBES, vibeToSource, vibeRoles, vibesForRole } from '../csbl-vibes'
import { DrumInstrument } from '../../generators/types'

// CSBL slice 1 — spec Section 13.9. The language compiles DOWN to the structures the
// Organism already plays; it never schedules anything itself.

describe('CSBL drums — trap.hats("2-step")', () => {
  it('compiles to four closed hats on the quarters', () => {
    const block = parseCSBL('trap.hats("2-step") >> "t---t---t---t---" {swing: 0.12}')
    const hits = compileDrumBlockToHits({ role: block.role, pattern: block.pattern })

    expect(hits).toHaveLength(4)
    // bar:beat:sixteenth — the sixteenth field is WITHIN the beat, not the bar.
    expect(hits.map(h => h.time)).toEqual(['0:0:0', '0:1:0', '0:2:0', '0:3:0'])
    // The REAL enum, whose values are lowercase. A local "Hat" union compiles and
    // then silently matches nothing in DrumGenerator.
    expect(hits.every(h => h.instrument === DrumInstrument.Hat)).toBe(true)
  })

  it('keeps hat velocity under the open/closed split', () => {
    // Above 0.55 the kit voices the OPEN sample — open vs closed is chosen by
    // velocity, not by a separate symbol.
    const hits = drumPatternToDrumHits('t---t---t---t---')
    expect(hits.every(h => h.velocity <= 0.55)).toBe(true)
  })

  it('tiles a short pattern to fill the bar', () => {
    // "x---x-x-" is 8 steps; one bar is 16.
    const hits = drumPatternToDrumHits('x---x-x-')
    expect(hits).toHaveLength(6)
    expect(hits.every(h => h.instrument === DrumInstrument.Kick)).toBe(true)
  })

  it('REJECTS a pattern length that cannot divide the bar', () => {
    // boom_bap.hats "loose" is 12 chars. Silently truncating or padding it would be
    // a rhythm bug that looks like a taste problem.
    expect(() => drumPatternToDrumHits('t--t--t--t--')).toThrow(/does not divide/)
  })

  it('subdivides the PREVIOUS hit, not a hardcoded hat', () => {
    // Regression: '*' used to emit two Hat hits regardless of role, so a KICK
    // pattern produced hi-hats.
    const hits = drumPatternToDrumHits('x*--x*--x*--x*--')
    expect(hits.every(h => h.instrument === DrumInstrument.Kick)).toBe(true)
    expect(hits.length).toBeGreaterThan(4)
  })

  it('fails loudly on an unknown symbol', () => {
    expect(() => drumPatternToDrumHits('t---z---t---t---')).toThrow(/Unknown drum char/)
  })
})

describe('CSBL bass', () => {
  it('tokenises a bass pattern — "b" is a HIT here, not a flat', () => {
    // Regression: the lexer had no role, so 'b' matched nothing and every bass
    // pattern in the spec's own training data threw at index 0.
    expect(() => tokenizePattern('b--b-b--', 'bass')).not.toThrow()
  })

  it('compiles 808 hits with the shared time model', () => {
    const hits = bassPatternToHits('b--b-b--')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].time).toBe('0:0:0')
  })

  it('marks slide and sustain on the previous hit', () => {
    const glide = bassPatternToHits('b>--b---b---b---')
    expect(glide[0].glide).toBe(true)
    const sus = bassPatternToHits('b~--b---b---b---')
    expect(sus[0].sustain).toBe(true)
  })

  it('fails loudly when an operator has nothing to attach to', () => {
    expect(() => bassPatternToHits('>b--b-b-')).toThrow(/no previous hit/)
  })
})

describe('CSBL chords — scale degrees, never literal names', () => {
  it('parses Roman degrees so the Conductor keeps owning the key', () => {
    const tokens = parseChordPattern('i---VI---iv---')
    expect(tokens).toHaveLength(3)
    expect(tokens[0].degree.toLowerCase()).toBe('i')
    expect(tokens[1].degree.toUpperCase()).toBe('VI')
    expect(tokens[2].degree.toLowerCase()).toBe('iv')
  })
})

describe('CSBL -> Organism bridge', () => {
  it('compiles a playable line to hits the DrumGenerator can load', () => {
    const r = compileCsblToDrumHits('trap.hats("2-step") >> "t---t---t---t---"')
    expect(r.ok).toBe(true)
    expect(r.hits).toHaveLength(4)
    expect(r.hits.every(h => h.instrument === DrumInstrument.Hat)).toBe(true)
  })

  it('reports WHY instead of silently playing nothing', () => {
    // Spec 13.7 #2 — no silent failure. Every rejection carries a reason.
    const badRole = compileCsblToDrumHits('trap.melody("dark arp") >> "c4---e4---"')
    expect(badRole.ok).toBe(false)
    expect(badRole.error).toMatch(/not playable/)

    const badLen = compileCsblToDrumHits('trap.hats("loose") >> "t--t--t--t--"')
    expect(badLen.ok).toBe(false)
    expect(badLen.error).toMatch(/does not divide/)

    const badHeader = compileCsblToDrumHits('nonsense')
    expect(badHeader.ok).toBe(false)
    expect(badHeader.error).toMatch(/Invalid header/)
  })

  it('never throws — the caller is an audition, not a build step', () => {
    expect(() => compileCsblToDrumHits('!!!')).not.toThrow()
    expect(() => compileCsblToDrumHits('')).not.toThrow()
  })
})

// ── The vocabulary: name a feel, no pattern ─────────────────────────────
// This is spec 13.9's definition of done, written the way it was actually
// specified. The original slice used the explicit-pattern form instead, so the
// missing lookup never failed a test.
describe('CSBL vibes — the half a human uses', () => {
  it('resolves trap.hats("2-step") with NO pattern supplied', () => {
    const block = parseCSBL('trap.hats("2-step")')
    expect(block.pattern).toBe('t---t---t---t---')

    const hits = compileDrumBlockToHits({ role: block.role, pattern: block.pattern })
    expect(hits).toHaveLength(4)
    expect(hits.every(h => h.instrument === DrumInstrument.Hat)).toBe(true)
    expect(hits.every(h => h.velocity <= 0.55)).toBe(true)
  })

  it('plays through the audition bridge from the short form', () => {
    const r = compileCsblToDrumHits('boom_bap.kick("classic")')
    expect(r.ok).toBe(true)
    expect(r.hits.every(h => h.instrument === DrumInstrument.Kick)).toBe(true)
  })

  it('an explicit pattern still overrides the vibe', () => {
    const block = parseCSBL('trap.hats("2-step") >> "t-t-t-t-t-t-t-t-"')
    expect(block.pattern).toBe('t-t-t-t-t-t-t-t-')
  })

  it('says WHICH vibe is unknown rather than playing nothing', () => {
    const r = compileCsblToDrumHits('trap.hats("does-not-exist")')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/not in the library/)
  })

  it('every authored vibe actually compiles', () => {
    // The spec's own training data contained two patterns whose length cannot
    // divide a 16-step bar (7 and 12 chars). This locks the whole library so a
    // future addition cannot reintroduce one.
    for (const v of CSBL_VIBES) {
      const src = vibeToSource(v)
      expect(() => parseCSBL(src), `${src} failed to parse`).not.toThrow()
    }
  })

  it('exposes roles and vibes for rendering buttons', () => {
    expect(vibeRoles()).toContain('hats')
    expect(vibesForRole('hats').length).toBeGreaterThan(2)
    expect(vibeToSource(CSBL_VIBES[0])).toMatch(/^\w+\.\w+\("[^"]+"\)$/)
  })
})

describe('CSBL routes by role — drums and bass from one entry point', () => {
  it('routes a drum vibe to hits', () => {
    const r = compileCsbl('trap.hats("2-step")')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.kind).toBe('drums')
    if (r.kind !== 'drums') return
    expect(r.hits.every(h => h.instrument === DrumInstrument.Hat)).toBe(true)
  })

  it('routes a bass vibe to RHYTHM steps that carry no pitch', () => {
    // The whole point of 13.6: a CSBL bass pattern says WHEN. The Conductor
    // supplies the note, so an auditioning bass still follows the chord changes
    // instead of hammering one pitch.
    const r = compileCsbl('trap.bass("808-slide")')
    expect(r.ok).toBe(true)
    if (!r.ok || r.kind !== 'bass') { expect.fail('expected a bass audition'); return }
    expect(r.steps.length).toBeGreaterThan(0)
    for (const s of r.steps) {
      expect(s.time).toMatch(/^\d+:\d+:\d+$/)
      expect(s).not.toHaveProperty('pitch')
    }
  })

  it('carries slide and sustain through to the generator', () => {
    const glide = compileCsbl('trap.bass("glide")')
    expect(glide.ok).toBe(true)
    if (!glide.ok || glide.kind !== 'bass') return
    expect(glide.steps.some(s => s.glide)).toBe(true)

    const wob = compileCsbl('phonk.bass("wobble")')
    if (!wob.ok || wob.kind !== 'bass') return
    expect(wob.steps.some(s => s.sustain)).toBe(true)
  })

  it('still names an unplayable role instead of going quiet', () => {
    // With an explicit pattern so it gets PAST the vibe lookup and reaches the
    // role check — melody has no entries in the library yet, and that lookup
    // failure has its own (also loud) message.
    const r = compileCsbl('trap.melody("dark arp") >> "c4---e4---g4---c4---"')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/not playable yet/)
  })

  it('names an unknown VIBE distinctly from an unplayable role', () => {
    const r = compileCsbl('trap.melody("dark arp")')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/not in the library/)
  })
})
