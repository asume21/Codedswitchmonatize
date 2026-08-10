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

  it('REJECTS a pattern length that fits no grid', () => {
    // 7 is neither a divisor of 16 nor a triplet count. Silently truncating or
    // padding it would be a rhythm bug that looks like a taste problem.
    expect(() => drumPatternToDrumHits('--s>---')).toThrow(/fits no grid/)
    expect(() => drumPatternToDrumHits('ttttt')).toThrow(/fits no grid/)
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

    const badLen = compileCsblToDrumHits('trap.hats("loose") >> "ttttt"')
    expect(badLen.ok).toBe(false)
    expect(badLen.error).toMatch(/fits no grid/)

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

describe('CSBL chords — degrees that actually sound like their name', () => {
  const MINOR = [0, 3, 7]
  const MAJOR = [0, 4, 7]
  const MIN7  = [0, 3, 7, 10]
  const MAJ7  = [0, 4, 7, 11]

  it('"dark minor" is i - bVI - bVII, not i - VI - VII', () => {
    // VI resolves to 9 semitones (A natural) and VII to 11 (B natural). In a minor
    // key those are wrong — you want the FLAT six and seven. Writing it the obvious
    // way produces Cm-A-B, which is not dark, just out of key.
    const r = compileCsbl('trap.chords("dark minor")')
    expect(r.ok).toBe(true)
    if (!r.ok || r.kind !== 'chords') { expect.fail('expected chords'); return }
    expect(r.degrees.map(d => d.rootOffset)).toEqual([0, 8, 10, 0])
    expect(r.degrees[0].intervals).toEqual(MINOR)
    expect(r.degrees[1].intervals).toEqual(MAJOR)
  })

  it('"jazzy" uses MINOR sevenths — i7 would be a dominant chord', () => {
    // The suffix 7 yields [0,4,7,10] whatever the numeral's case, so a lowercase i7
    // is still a major third. im7 is the minor seventh.
    const r = compileCsbl('boom_bap.chords("jazzy")')
    if (!r.ok || r.kind !== 'chords') { expect.fail('expected chords'); return }
    expect(r.degrees[0].intervals).toEqual(MIN7)
    expect(r.degrees[1].intervals).toEqual(MIN7)
    expect(r.degrees[2].intervals).toEqual([0, 4, 7, 10])  // V7 stays dominant
  })

  it('"warm keys" uses major sevenths', () => {
    const r = compileCsbl('lofi.chords("warm keys")')
    if (!r.ok || r.kind !== 'chords') { expect.fail('expected chords'); return }
    expect(r.degrees[0].intervals).toEqual(MAJ7)
    expect(r.degrees[2].intervals).toEqual(MAJ7)
  })

  it('carries NO absolute pitch — the Conductor transposes these', () => {
    // rootOffset is an interval from the tonic, not a note. That is what lets the
    // same progression work in whatever key the session is in.
    const r = compileCsbl('drill.chords("dark")')
    if (!r.ok || r.kind !== 'chords') { expect.fail('expected chords'); return }
    for (const d of r.degrees) {
      expect(d.rootOffset).toBeGreaterThanOrEqual(0)
      expect(d.rootOffset).toBeLessThan(12)
      expect(d).not.toHaveProperty('note')
    }
  })
})

describe('CSBL triplets — the grid comes from the pattern LENGTH', () => {
  it('places 12 steps as three per beat, not sixteen', () => {
    // Trap hat triplets. This could not be written at all while the grammar was
    // sixteenths-only — a 12-char pattern was rejected as "does not divide 16".
    const hits = drumPatternToDrumHits('tttttttttttt')
    expect(hits).toHaveLength(12)
    // Three even steps inside beat 0: 0, 1.333, 2.667 sixteenths.
    expect(hits[0].time).toBe('0:0:0')
    expect(hits[1].time).toBe('0:0:1.333')
    expect(hits[2].time).toBe('0:0:2.667')
    expect(hits[3].time).toBe('0:1:0')
    // ...and the last one still lands inside the bar.
    expect(hits[11].time).toBe('0:3:2.667')
  })

  it('boom_bap "loose" was a TRIPLET pattern all along', () => {
    // Originally "t--t--t--t--" (12 chars) and briefly rewritten to 16 to make it
    // fit. The data was right; the grammar was missing triplets.
    const r = compileCsbl('boom_bap.hats("loose")')
    expect(r.ok).toBe(true)
    if (!r.ok || r.kind !== 'drums') return
    expect(r.hits).toHaveLength(4)
    expect(r.hits.map(h => h.time)).toEqual(['0:0:0', '0:1:0', '0:2:0', '0:3:0'])
  })

  it('still reads straight patterns as sixteenths', () => {
    const hits = drumPatternToDrumHits('t---t---t---t---')
    expect(hits.map(h => h.time)).toEqual(['0:0:0', '0:1:0', '0:2:0', '0:3:0'])
  })

  it('tiles a short triplet pattern across the bar', () => {
    // 3 steps -> one beat of triplets, repeated to fill four beats.
    const hits = drumPatternToDrumHits('ttt')
    expect(hits).toHaveLength(12)
    expect(hits[3].time).toBe('0:1:0')
  })
})
