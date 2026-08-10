/**
 * csbl-vibes.ts — the VOCABULARY, which is the half of CSBL a human actually uses.
 *
 * CSBL has two halves for two different users. The syntax (`>> "t---t---t---t---"`)
 * is for the machine — it is what an LLM writes and what the parser reads. The
 * VIBE NAME is for the person: "2-step", "bounce", "triplet-roll", "ghost".
 *
 * Section 11 of the spec always assumed this table (`CSBLGrammar[genre][role][vibe]`)
 * and Section 13.9 defined slice 1 as `parseCSBL('trap.hats("2-step")')` — with NO
 * pattern. It was never built: the reference wrapper called it, and the test used the
 * explicit-pattern form instead, so nothing failed. This is that table.
 *
 * It is also the source of the vibe BUTTONS. One list, two interfaces — name it or
 * click it. Adding an entry here makes it playable and clickable with no UI work.
 *
 * Patterns are 1 char = one sixteenth, and must divide 16 (see csbl-time).
 */

export interface CsblVibe {
  genre: string
  role: string
  vibe: string
  pattern: string
  /** Shown on the button. Falls back to the vibe name. */
  label?: string
}

/**
 * From the spec's Section 9 training data.
 *
 * TWO ENTRIES WERE CORRECTED, and it is worth being explicit rather than quietly
 * "fixing" the author's data:
 *   - drill.snare "slide" was "--s>---" (7 chars) — 7 cannot divide 16. Padded to 8.
 *   - boom_bap.hats "loose" was "t--t--t--t--" (12 chars) — also indivisible. It reads
 *     as a triplet/swung feel, which the current grammar has no notation for, so it is
 *     written here as the nearest 16-step equivalent (hats every 3 steps). If real
 *     triplets are wanted they need their own notation, not a length that does not fit.
 */
export const CSBL_VIBES: CsblVibe[] = [
  // ── trap ────────────────────────────────────────────────────────────
  { genre: 'trap', role: 'hats',  vibe: '2-step',       pattern: 't---t---t---t---' },
  { genre: 'trap', role: 'hats',  vibe: 'triplet-roll', pattern: 't*t*t*t*t*t*t*t*' },
  { genre: 'trap', role: 'kick',  vibe: 'bounce',       pattern: 'x---x-x-' },
  { genre: 'trap', role: 'snare', vibe: 'rimshot',      pattern: '--s---s-' },
  { genre: 'trap', role: 'snare', vibe: 'ghost',        pattern: '--s-s---' },

  // ── drill ───────────────────────────────────────────────────────────
  { genre: 'drill', role: 'hats',  vibe: 'helicopter',  pattern: 't-t-t-t-t-t-t-t-' },
  { genre: 'drill', role: 'kick',  vibe: 'stutter',     pattern: 'x-x-x---' },
  { genre: 'drill', role: 'snare', vibe: 'slide',       pattern: '--s>----' },  // was 7 chars

  // ── boom bap ────────────────────────────────────────────────────────
  { genre: 'boom_bap', role: 'kick',  vibe: 'classic',  pattern: 'x-----x-' },
  { genre: 'boom_bap', role: 'snare', vibe: 'crunch',   pattern: '--s---s-' },
  { genre: 'boom_bap', role: 'hats',  vibe: 'loose',    pattern: 't--t--t--t--t---' },  // was 12 chars

  // ── chords ──────────────────────────────────────────────────────────
  // DEGREES, never literal chord names (spec 13.6). The spec's Section 9 wrote
  // these as "cmin---d#maj---gmin---"; in C minor that is i - III - v, and writing
  // it as degrees means the same progression works in whatever key the Conductor
  // has chosen instead of dragging everything to C.
  // NOTATION MATTERS HERE, and it is not obvious. Verified against the bank's own
  // parser rather than assumed:
  //   VI   -> 9 semitones = A natural.  In a minor key you want A FLAT: write bVI.
  //   VII  -> 11 = B natural.           Flat-seven is bVII.
  //   i7   -> [0,4,7,10] a DOMINANT 7 (major third!) regardless of the lowercase
  //           numeral. A minor seventh is written im7, not i7.
  //   maj7 -> [0,4,7,11] as expected.
  // Writing "dark minor" as i-VI-VII would produce Cm-A-B, which is not dark, just
  // wrong. These mirror the Conductor's own per-genre defaults.
  { genre: 'trap',     role: 'chords', vibe: 'dark minor',   pattern: 'i---bVI---bVII---i---' },
  { genre: 'lofi',     role: 'chords', vibe: 'warm keys',    pattern: 'Imaj7---iiim7---IVmaj7---V7---' },
  { genre: 'phonk',    role: 'chords', vibe: 'detuned pads', pattern: 'i---bVI---i---bVI---' },
  { genre: 'boom_bap', role: 'chords', vibe: 'jazzy',        pattern: 'im7---ivm7---V7---im7---' },
  { genre: 'drill',    role: 'chords', vibe: 'dark',         pattern: 'i---v---bVII---bVI---' },

  // ── bass ────────────────────────────────────────────────────────────
  { genre: 'trap',  role: 'bass', vibe: '808-slide',    pattern: 'b--b-b--' },
  { genre: 'trap',  role: 'bass', vibe: 'glide',        pattern: 'b>b--b--' },
  { genre: 'phonk', role: 'bass', vibe: 'distorted',    pattern: 'b--b-b--' },
  { genre: 'phonk', role: 'bass', vibe: 'wobble',       pattern: 'b~b~b~b~' },
]

/** Look up the authored pattern for a genre.role("vibe"). */
export function lookupVibePattern(genre: string, role: string, vibe: string): string | null {
  const g = genre.toLowerCase()
  const r = role.toLowerCase()
  const v = vibe.toLowerCase()
  const hit = CSBL_VIBES.find(
    (x) => x.genre.toLowerCase() === g && x.role.toLowerCase() === r && x.vibe.toLowerCase() === v,
  )
  return hit ? hit.pattern : null
}

/** Every vibe for a role, for rendering buttons. */
export function vibesForRole(role: string): CsblVibe[] {
  return CSBL_VIBES.filter((v) => v.role.toLowerCase() === role.toLowerCase())
}

/** The CSBL line a button should fire — the short form, since the pattern resolves. */
export function vibeToSource(v: CsblVibe): string {
  return `${v.genre}.${v.role}("${v.vibe}")`
}

/** Distinct roles present in the library, in a musically sensible order. */
export function vibeRoles(): string[] {
  const order = ['kick', 'snare', 'hats', 'perc', 'bass', 'chords']
  const present = new Set(CSBL_VIBES.map((v) => v.role))
  return order.filter((r) => present.has(r))
}
