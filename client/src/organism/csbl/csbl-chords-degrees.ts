/**
 * csbl-chords-degrees.ts
 *
 * Chord tokens are SCALE DEGREES — Roman numerals — never literal chord names
 * (spec 13.6). The Conductor owns the session key and transposes every player
 * together; a literal "cmin" would make CSBL a second source of harmonic truth and
 * the band would end up split across two keys.
 *
 * The token grammar has to carry three things, and the first draft handled only one:
 *
 *   ACCIDENTAL   bVI, bVII, bIII   — in a minor key the sixth and seventh are FLAT.
 *                                    Plain VI resolves to 9 semitones (A natural in
 *                                    C), so "dark minor" written as i-VI-VII gives
 *                                    Cm-A-B: not dark, just out of key.
 *   NUMERAL      i, iv, V, VII
 *   QUALITY      m7, maj7, 7, dim, aug — and the order matters when matching, since
 *                                    "maj7" must win over "maj" and "7". Note a bare
 *                                    "7" is a DOMINANT seventh whatever the numeral's
 *                                    case, so a minor seventh is im7, never i7.
 *
 * The parsed token keeps its RAW text so the caller can hand it to the progression
 * bank's own parseRomanNumeral rather than reassembling it — one parser, one meaning.
 */

export type ChordDegree = {
  /** The numeral alone, e.g. "VI" — for display and tests. */
  degree: string
  /** Accidental prefix if present: 'b' or '#'. */
  accidental?: string
  /** Quality suffix if present: 'm7', 'maj7', '7', 'dim', 'aug', … */
  quality?: string
  /** The full token exactly as written, e.g. "bVI" or "im7". */
  raw: string
  index: number
}

// Longest-first alternation: maj7 before maj, m7 before m, so "Imaj7" does not match
// as "Imaj" + a stray 7.
const QUALITY = '(?:maj7|min7|m7|maj|min|dim|aug|sus2|sus4|7|9|6)'
const TOKEN_RE = new RegExp(`[b#]?[ivIV]+${QUALITY}?`, 'g')
const ONE_RE = new RegExp(`^([b#]?)([ivIV]+)(${QUALITY})?$`)

export function parseChordToken(token: string, index = 0): ChordDegree {
  if (typeof token !== 'string' || token.length === 0) throw new Error('Empty chord token')
  const m = token.match(ONE_RE)
  if (!m) throw new Error(`Invalid chord degree token '${token}' at index ${index}`)
  return {
    accidental: m[1] || undefined,
    degree: m[2],
    quality: m[3] || undefined,
    raw: token,
    index,
  }
}

export function parseChordPattern(pattern: string): ChordDegree[] {
  if (!pattern) throw new Error('Empty chord pattern')
  const tokens: ChordDegree[] = []
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(pattern)) !== null) {
    tokens.push(parseChordToken(m[0], m.index))
  }
  if (tokens.length === 0) throw new Error(`No chord degree tokens found in '${pattern}'`)
  return tokens
}
