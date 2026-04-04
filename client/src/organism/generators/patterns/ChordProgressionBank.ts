// Section 04 — Chord Progression Bank
//
// Parses Roman numeral progressions into playable chord data and provides
// mood-to-mode matching so the Organism can pick harmonically appropriate
// progressions for each genre/state.

import { PROGRESSIONS, type RawProgression } from './ChordProgressionData'

// ── Types ────────────────────────────────────────────────────────────

export interface ChordEvent {
  /** Semitone intervals from root (e.g. [0, 4, 7] = major triad) */
  intervals: number[]
  /** Scale degree root offset in semitones from tonic */
  rootOffset: number
  /** Original Roman numeral label for debugging */
  label: string
}

export interface ParsedProgression {
  chords:   ChordEvent[]
  moods:    string[]
  category: 'major' | 'minor' | 'modal'
}

// ── Roman numeral → semitone mapping ──────────────────────────────────
//
// Maps Roman numerals to their root semitone offset from the tonic.
// Lowercase = minor, Uppercase = major. Flat/sharp prefixes shift by ±1.

const NUMERAL_ROOTS: Record<string, number> = {
  'I': 0, 'i': 0,
  'II': 2, 'ii': 2,
  'III': 4, 'iii': 4,
  'IV': 4, 'iv': 5,  // IV is special: always 5 semitones (perfect 4th)
  'V': 7, 'v': 7,
  'VI': 9, 'vi': 9,
  'VII': 11, 'vii': 11,
}

// Fix: IV/iv are both perfect 4th (5 semitones)
// III/iii are major/minor 3rd (4 semitones)
const DEGREE_SEMITONES: Record<string, number> = {
  'i': 0, 'I': 0,
  'ii': 2, 'II': 2,
  'iii': 4, 'III': 4,
  'iv': 5, 'IV': 5,
  'v': 7, 'V': 7,
  'vi': 9, 'VI': 9,
  'vii': 11, 'VII': 11,
}

/** Standard chord quality intervals */
const CHORD_QUALITIES: Record<string, number[]> = {
  // Triads
  'major':     [0, 4, 7],
  'minor':     [0, 3, 7],
  'dim':       [0, 3, 6],
  'aug':       [0, 4, 8],
  // Sevenths
  '7':         [0, 4, 7, 10],
  'dom7':      [0, 4, 7, 10],
  'M7':        [0, 4, 7, 11],
  'maj7':      [0, 4, 7, 11],
  'm7':        [0, 3, 7, 10],
  'mM7':       [0, 3, 7, 11],
  'dim7':      [0, 3, 6, 9],
  'm7-5':      [0, 3, 6, 10],   // half-diminished
  '7-5':       [0, 4, 6, 10],
  '7+5':       [0, 4, 8, 10],
  'M7+5':      [0, 4, 8, 11],
  // Suspended
  'sus2':      [0, 2, 7],
  'sus4':      [0, 5, 7],
  '7sus4':     [0, 5, 7, 10],
  // Sixths
  '6':         [0, 4, 7, 9],
  'm6':        [0, 3, 7, 9],
  '69':        [0, 4, 7, 9, 14],
  'm69':       [0, 3, 7, 9, 14],
  // Ninths
  '9':         [0, 4, 7, 10, 14],
  'maj9':      [0, 4, 7, 11, 14],
  'm9':        [0, 3, 7, 10, 14],
  '9sus4':     [0, 5, 7, 10, 14],
  '7-9':       [0, 4, 7, 10, 13],
  // Added tones
  'add4':      [0, 4, 5, 7],
  'add9':      [0, 4, 7, 14],
  'madd4':     [0, 3, 5, 7],
  'madd9':     [0, 3, 7, 14],
  'add11':     [0, 4, 7, 17],
  'sus4add9':  [0, 5, 7, 14],
  // Power
  '5':         [0, 7],
}

/**
 * Parse a single Roman numeral chord symbol into a ChordEvent.
 *
 * Handles: I, ii, bIIIM, #IVdim, Vsus2, i7, VI69, im7, ivm9, etc.
 */
function parseNumeral(symbol: string): ChordEvent {
  let s = symbol
  let flatShift = 0

  // Strip leading accidentals: b (flat) or # (sharp)
  while (s.startsWith('b')) { flatShift -= 1; s = s.slice(1) }
  while (s.startsWith('#')) { flatShift += 1; s = s.slice(1) }

  // Extract the Roman numeral degree (greedy match for longer numerals first)
  let degree = ''
  let isMinor = false

  // Try to match Roman numeral at the start
  const romanPatterns = ['VII', 'VII', 'VI', 'IV', 'V', 'III', 'II', 'I',
                          'vii', 'vi', 'iv', 'v', 'iii', 'ii', 'i']
  for (const pat of romanPatterns) {
    if (s.startsWith(pat)) {
      degree = pat
      isMinor = pat === pat.toLowerCase()
      s = s.slice(pat.length)
      break
    }
  }

  if (!degree) {
    // Fallback: treat as tonic
    return { intervals: [0, 4, 7], rootOffset: 0, label: symbol }
  }

  // Normalize degree to uppercase for lookup
  const degreeUpper = degree.toUpperCase()
  const baseSemitone = (DEGREE_SEMITONES[degreeUpper] ?? 0) + flatShift

  // Determine chord quality from suffix
  let intervals: number[]
  const suffix = s  // everything after the numeral

  // Handle 'm' prefix in suffix (e.g. "im7" → minor + 7th)
  // The 'm' at start of suffix combined with lowercase numeral means minor quality
  if (suffix === '' || suffix === 'M') {
    // Plain numeral or explicit M suffix
    intervals = isMinor && suffix !== 'M' ? [...CHORD_QUALITIES.minor] : [...CHORD_QUALITIES.major]
  } else if (suffix === 'dim' || suffix.startsWith('dim')) {
    intervals = [...(CHORD_QUALITIES[suffix] ?? CHORD_QUALITIES.dim)]
  } else if (suffix === 'aug') {
    intervals = [...CHORD_QUALITIES.aug]
  } else if (CHORD_QUALITIES[suffix]) {
    // Direct match (sus2, sus4, 7, add9, etc.)
    intervals = [...CHORD_QUALITIES[suffix]]
  } else if (suffix.startsWith('m') && CHORD_QUALITIES[suffix]) {
    // Minor quality variants (m7, m9, madd9, etc.)
    intervals = [...CHORD_QUALITIES[suffix]]
  } else if (suffix.startsWith('m') && CHORD_QUALITIES[suffix.slice(1)]) {
    // e.g. "m7" where 'm' is quality prefix and '7' is the extension
    // Build minor triad + extension
    const ext = CHORD_QUALITIES[suffix]
    if (ext) {
      intervals = [...ext]
    } else {
      intervals = isMinor ? [...CHORD_QUALITIES.minor] : [...CHORD_QUALITIES.major]
    }
  } else {
    // Unknown suffix — use basic triad based on case
    intervals = isMinor ? [...CHORD_QUALITIES.minor] : [...CHORD_QUALITIES.major]
    // Try to handle common suffixes we might have missed
    if (suffix === '7' || suffix === 'dom7') {
      intervals = isMinor ? [...CHORD_QUALITIES.m7] : [...CHORD_QUALITIES['7']]
    } else if (suffix === 'M' || suffix === 'maj') {
      intervals = [...CHORD_QUALITIES.major]
    }
  }

  return {
    intervals,
    rootOffset: ((baseSemitone % 12) + 12) % 12,
    label: symbol,
  }
}

// ── Mood → Mode mapping ──────────────────────────────────────────────
//
// Maps progression mood tags to Organism modes for intelligent selection.
// A progression can match multiple modes; the bank scores each by overlap.

const MOOD_TO_MODES: Record<string, string[]> = {
  // Dark / aggressive moods → Heat (trap) & Gravel (drill)
  'Dark':        ['heat', 'gravel'],
  'Mysterious':  ['heat', 'gravel', 'smoke'],
  'Fearful':     ['gravel'],
  'Dramatic':    ['heat', 'gravel'],
  'Lonely':      ['ice', 'gravel'],

  // Soulful / mellow moods → Smoke (boom-bap) & Ice (lo-fi)
  'Sad':         ['ice', 'smoke'],
  'Nostalgic':   ['smoke', 'ice'],
  'Tender':      ['ice', 'smoke'],
  'Romantic':    ['smoke', 'ice', 'glow'],
  'Peaceful':    ['ice', 'glow'],
  'Spiritual':   ['glow', 'ice'],
  'Relaxed':     ['ice', 'glow'],

  // Upbeat / energetic moods → Glow (chill) & general
  'Joyful':      ['glow'],
  'Hopeful':     ['glow', 'smoke'],
  'Triumphant':  ['glow', 'heat'],
  'Excited':     ['heat', 'glow'],
  'Playful':     ['glow', 'smoke'],
  'Empowered':   ['heat', 'glow'],

  // Tension / surprise → modal coloring
  'Rebellious':  ['heat', 'gravel'],
  'Surprised':   ['smoke', 'heat'],

  // Cadence (no specific mood)
  'Cadence':     ['heat', 'ice', 'smoke', 'gravel', 'glow'],
}

// ── Pre-parsed progression cache ─────────────────────────────────────

let parsedCache: ParsedProgression[] | null = null

function getParsed(): ParsedProgression[] {
  if (parsedCache) return parsedCache
  parsedCache = PROGRESSIONS.map(raw => ({
    chords:   raw.numerals.map(parseNumeral),
    moods:    raw.moods,
    category: raw.category,
  }))
  return parsedCache
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Pick a chord progression that matches the given Organism mode.
 * Scores each progression by how many of its mood tags map to the target mode.
 * Returns a weighted random selection favoring high-scoring matches.
 *
 * @param mode - Organism mode string (heat, ice, smoke, gravel, glow)
 * @param preferMinor - if true, prefer minor/modal progressions (default based on mode)
 */
export function pickProgression(
  mode: string,
  preferMinor?: boolean,
): ParsedProgression {
  const all = getParsed()
  const useMinor = preferMinor ?? (mode === 'heat' || mode === 'gravel' || mode === 'smoke')

  // Score each progression
  const scored = all.map(prog => {
    let score = 0

    // Mood matching
    for (const mood of prog.moods) {
      const modes = MOOD_TO_MODES[mood]
      if (modes?.includes(mode)) {
        score += 2
      }
    }

    // Category bonus: minor/modal progressions for dark modes
    if (useMinor && (prog.category === 'minor' || prog.category === 'modal')) {
      score += 1
    }
    if (!useMinor && prog.category === 'major') {
      score += 1
    }

    // Penalize cadences (too short for main progressions)
    if (prog.moods.includes('Cadence')) {
      score -= 2
    }

    // Length bonus: 4-chord progressions are most versatile
    if (prog.chords.length === 4) score += 1

    return { prog, score }
  })

  // Filter to positive scores, then weighted random selection
  const positive = scored.filter(s => s.score > 0)
  const pool = positive.length > 0 ? positive : scored.slice(0, 20)

  // Weighted random: higher scores get more weight
  const minScore = Math.min(...pool.map(s => s.score))
  const weights = pool.map(s => Math.max(1, s.score - minScore + 1))
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  let r = Math.random() * totalWeight
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i].prog
  }

  return pool[pool.length - 1].prog
}

/**
 * Given a chord event and a root pitch class (0-11), return the actual
 * MIDI note numbers for the chord voiced in a specific octave.
 *
 * @param chord - The chord event with intervals and root offset
 * @param rootPitchClass - Tonic pitch class (0=C, 1=C#, ... 11=B)
 * @param octave - Base octave for voicing (e.g. 3 or 4)
 */
export function voiceChord(
  chord: ChordEvent,
  rootPitchClass: number,
  octave: number,
): number[] {
  const chordRoot = ((rootPitchClass + chord.rootOffset) % 12 + 12) % 12
  const baseMidi = (octave + 1) * 12 + chordRoot  // +1 because MIDI octave -1 starts at 0

  return chord.intervals.map(interval => {
    let midi = baseMidi + interval
    // Keep voicing within reasonable range (don't go too high)
    if (midi > (octave + 2) * 12 + 12) midi -= 12
    return midi
  })
}

/**
 * Get the chord tones (pitch classes 0-11) for a given chord event
 * relative to a tonic. Used by Bass/Melody to know which notes are
 * "in the chord" for targeting on strong beats.
 *
 * @returns Array of pitch classes (0-11)
 */
export function getChordTones(chord: ChordEvent, rootPitchClass: number): number[] {
  const chordRoot = ((rootPitchClass + chord.rootOffset) % 12 + 12) % 12
  return chord.intervals.map(interval => (chordRoot + interval) % 12)
}

/**
 * Get the bass note (root of the chord) as a pitch class.
 */
export function getChordBassNote(chord: ChordEvent, rootPitchClass: number): number {
  return ((rootPitchClass + chord.rootOffset) % 12 + 12) % 12
}
