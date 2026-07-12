// client/src/organism/generators/melody/chordFiguration.ts
//
// FIGURATION — how a single chord hit is voiced across the instrument.
//
// The Organism has 20 idiomatic techniques (guitar-strum, piano-alberti,
// rolled-chord, brass-swell...) that never fire, because they were gated behind
// `!freeplayEnabled` — freeplay owns the comp rhythm, and running the technique
// scheduler underneath it gave the chord layer "two competing rhythmic brains"
// (ChordGenerator.ts). Correct diagnosis, wrong remedy: it switched the idiom
// off, so every instrument fell back to one identical bottom-to-top micro-strum.
// A guitar, a grand piano, and a string section all played the same gesture.
//
// The two brains were never actually in conflict — they answer different
// questions. Freeplay decides WHEN the chord hits (rhythm, pocket, phrasing).
// Figuration decides HOW that ONE hit is voiced (spread, order, which notes
// sound, relative attack). Everything here happens strictly INSIDE a single
// hit's window, so no second rhythm engine exists and freeplay's anti-loop
// machinery — 4-bar phrases, lead-dodging, pocket — is untouched.
//
// Anti-loop: every gesture varies per hit. A guitarist alternates down- and
// up-strokes; a pianist rolls some chords and blocks others. `hitIndex` drives
// the alternation and `rng` jitters the spread, so consecutive hits differ.

/** One note of a voiced chord hit, positioned relative to the hit's own time. */
export interface FiguredNote {
  note: string
  /** Seconds AFTER the hit's scheduled time. Always >= 0 — never moves the hit. */
  timeOffset: number
  /** Multiplier on the hit's base velocity (roughly 0.5..1.15). */
  velocityScale: number
}

export interface FigurationOptions {
  /** Performer family — 'plucked' | 'keyboard' | 'bowed' | 'brass' | 'wind' | 'synth'. */
  family: string | undefined
  /** Monotonic per-hit counter. Drives down/up alternation — the anti-loop axis. */
  hitIndex: number
  /** Injected PRNG so this module stays pure and testable. */
  rng: () => number
  /** Chord tones, in any order. Sorted low→high internally by the caller's midi fn. */
  midiOf: (note: string) => number
}

/** Longest a human gesture may smear a chord. Beyond this it stops being one hit. */
const MAX_SPREAD_SEC = 0.09

/**
 * Voice ONE chord hit for the instrument actually playing it.
 *
 * - plucked (guitar/harp) — a STRUM. Down-strokes rake low→high and hit every
 *   string; up-strokes rake high→low, are quieter, and only catch the top
 *   strings (a real player's up-stroke rarely reaches the bass strings). The
 *   direction alternates per hit, which is what makes a strummed part groove
 *   instead of chug.
 * - keyboard (piano/rhodes) — mostly BLOCK (both hands land together, a few ms
 *   apart), occasionally ROLLED low→high across ~60ms for colour. The bass note
 *   lands a touch early and louder: that's the left hand.
 * - bowed (strings) — a BLOOM. No strum: bows land together and the section
 *   swells in, with small per-desk attack scatter.
 * - brass — a STAB. Tight and together; a section hits as one.
 * - wind / synth / unknown — BLOCK with light scatter.
 */
export function voiceChordHit(notes: string[], opts: FigurationOptions): FiguredNote[] {
  const { family, hitIndex, rng, midiOf } = opts
  if (notes.length === 0) return []

  const low = [...notes].sort((a, b) => safeMidi(midiOf, a) - safeMidi(midiOf, b))

  switch (family) {
    case 'plucked': return strum(low, hitIndex, rng)
    case 'keyboard': return keyboard(low, hitIndex, rng)
    case 'bowed': return bloom(low, rng)
    case 'brass': return stab(low, rng)
    default: return block(low, rng)
  }
}

function safeMidi(midiOf: (n: string) => number, note: string): number {
  const m = midiOf(note)
  return Number.isFinite(m) ? m : 0
}

/** GUITAR — alternating down/up rake. The up-stroke is the anti-loop half. */
function strum(low: string[], hitIndex: number, rng: () => number): FiguredNote[] {
  const isDownStroke = hitIndex % 2 === 0

  // A down-stroke rakes every string; an up-stroke catches only the top strings.
  const order = isDownStroke ? low : [...low].reverse()
  const sounded = isDownStroke ? order : order.slice(0, Math.max(2, order.length - 1))

  // Rake speed: down-strokes dig in a little slower, up-strokes flick.
  const perNote = (isDownStroke ? 0.014 : 0.009) + rng() * 0.006

  return sounded.map((note, i) => ({
    note,
    timeOffset: Math.min(MAX_SPREAD_SEC, i * perNote),
    // Down-strokes accent the bass string; up-strokes are lighter overall.
    velocityScale: isDownStroke
      ? (i === 0 ? 1.08 : 0.94) + (rng() - 0.5) * 0.1
      : 0.72 + (rng() - 0.5) * 0.1,
  }))
}

/** PIANO — two hands landing together; an occasional rolled chord for colour. */
function keyboard(low: string[], hitIndex: number, rng: () => number): FiguredNote[] {
  // Roll roughly one hit in four, and never twice in a row (hitIndex gates it),
  // so the roll reads as an expressive choice rather than a tic.
  const rolled = hitIndex % 4 === 3 && rng() < 0.75
  const perNote = rolled ? 0.018 + rng() * 0.012 : 0.002 + rng() * 0.004

  return low.map((note, i) => ({
    note,
    timeOffset: Math.min(MAX_SPREAD_SEC, i * perNote),
    // The left hand (lowest note) lands fractionally early and heavier.
    velocityScale: (i === 0 ? 1.06 : 0.9) + (rng() - 0.5) * 0.12,
  }))
}

/** STRINGS — bows land together and bloom. No rake: a section is not a guitar. */
function bloom(low: string[], rng: () => number): FiguredNote[] {
  return low.map((note) => ({
    note,
    // Per-desk scatter, not a strum — players don't attack in pitch order.
    timeOffset: rng() * 0.015,
    velocityScale: 0.88 + (rng() - 0.5) * 0.14,
  }))
}

/** BRASS — a section stab. Tightest gesture of all; they hit as one. */
function stab(low: string[], rng: () => number): FiguredNote[] {
  return low.map((note, i) => ({
    note,
    timeOffset: rng() * 0.006,
    velocityScale: (i === 0 ? 1.0 : 0.93) + (rng() - 0.5) * 0.08,
  }))
}

/** Everything else — near-simultaneous with a little human scatter. */
function block(low: string[], rng: () => number): FiguredNote[] {
  return low.map((note, i) => ({
    note,
    timeOffset: i * (0.003 + rng() * 0.004),
    velocityScale: (i === 0 ? 1.04 : 0.92) + (rng() - 0.5) * 0.12,
  }))
}
