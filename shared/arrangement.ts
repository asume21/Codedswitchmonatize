// ArrangementPlan — the single source of truth for "what song is this".
//
// One artifact, two readers:
//   - ACE-Step (audio renderer) consumes `acePrompt` to render the song.
//   - Conductor (live engine) consumes `sections` + `key` + `subGenre` to
//     perform the song in real time.
//
// Neither owns the plan — they both read it. A Composer (Ollama via
// localAI.chat with a JSON system prompt, or Grok / deterministic as
// fallback) is the only writer. Coherence is structural: live performance
// and rendered preview can't drift because they share the source.
//
// Conductor without a plan stays in jam mode — picks from the 176-progression
// bank on section change. Loading a plan switches Conductor into reader mode.

export type ArrangementSectionName =
  | 'intro'
  | 'verse'
  | 'build'
  | 'drop'
  | 'breakdown'
  | 'drop2'
  | 'outro'

export interface ArrangementSection {
  name: ArrangementSectionName
  /** Length of the section in bars. */
  bars: number
  /**
   * Roman-numeral progression against `plan.key`. e.g. ['i', 'VI', 'III', 'VII']
   * for a natural-minor i-VI-III-VII. Conductor parses these via
   * `chordFromRoman` at consume time, so the plan stays key-agnostic.
   */
  progression: string[]
  /** 0..1 — drives orchestrator arrangement multipliers and chord technique. */
  energy: number
  /** 0..1 — drives orchestrator arrangement multipliers (drum/hat density). */
  density: number
  /** Optional sub-genre override for this section only (e.g. a chill verse
   *  inside a drill track). Falls back to `plan.subGenre` when absent. */
  groove?: string
  /** Optional StylePreset id — the curated combination of chord technique,
   *  bass articulation, melody articulation, and drum pattern that the
   *  band uses for this section. When absent, generators fall back to
   *  their mode-default articulations. See client/src/organism/styles/
   *  StylePresets.ts for the bank. */
  style?: string
}

export interface ArrangementPlan {
  /** Stable identifier — render endpoint + live session can reference the
   *  same plan without re-deriving it. Compose-once, render-many. */
  id: string
  /** Tonal center: 'C', 'F#', 'Bb', etc. */
  key: string
  bpm: number
  /** Pattern-library key — 'boom-bap' | 'lo-fi' | 'trap' | 'drill' | ... */
  subGenre: string
  /** Free-form mood descriptor — 'melancholic', 'triumphant', 'dark', etc. */
  mood: string
  /** ArrangementTemplate id (e.g. 'classic', 'dropfirst', 'lofi-loop') —
   *  the STRUCTURAL form of the song. Composer picks this within the
   *  preset's defaults; client calls setActiveArrangementTemplate on load.
   *  Optional for backward compat with old plans; absent = 'classic'. */
  templateId?: string
  /** Ordered list of sections that make up the song. */
  sections: ArrangementSection[]
  /**
   * The ACE-Step prompt the composer emitted alongside the structural plan.
   * Travels with the plan so the render endpoint and the live engine stay
   * attached to the same creative intent. Conductor ignores this field.
   */
  acePrompt: string
}

// ── Composer slot ────────────────────────────────────────────────────

export interface ComposerInput {
  /** User-supplied free-form prompt — "trap banger, dark, 140 BPM, sad" */
  prompt?: string
  /** Optional seed values — if absent, the composer infers them. */
  key?: string
  bpm?: number
  subGenre?: string
  mood?: string
  /** Hard target — exactly this many sections. Composer may add/drop to fit. */
  sectionCount?: number
  /** Templates the composer is allowed to pick from. When absent, all
   *  templates are fair game. When the UI locks a template, send a one-
   *  item array. */
  allowedTemplateIds?: string[]
  /** StylePresets the composer is allowed to pick from per section. Same
   *  semantics as allowedTemplateIds — empty = all allowed, one-item =
   *  locked, multi = pick within range. */
  allowedStyleIds?: string[]
}

export interface Composer {
  compose(input: ComposerInput): Promise<ArrangementPlan>
}

// ── Roman numeral → ParsedChord conversion ───────────────────────────
//
// Lifted from the inline parser inside `ChordProgressionBank.parseNumeral`.
// Conductor.loadSection() calls this for every chord in the active section's
// progression, voiced against `plan.key`.

export interface ParsedChord {
  symbol:    string   // 'i' / 'VImaj7' — the Roman literal, useful for debug
  root:      string   // 'A' (concrete note after key application)
  quality:   string   // '' for triads, 'maj7' / 'm7' / etc.
  rootMidi:  number   // MIDI note number of the root at the chosen octave
  intervals: number[] // semitone intervals from root, e.g. [0, 4, 7]
  pitches:   number[] // absolute MIDI notes
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,  'C#': 1,  Db: 1,
  D: 2,  'D#': 3,  Eb: 3,
  E: 4,
  F: 5,  'F#': 6,  Gb: 6,
  G: 7,  'G#': 8,  Ab: 8,
  A: 9,  'A#': 10, Bb: 10,
  B: 11,
}

// Roman numeral → semitone offset from tonic. Lowercase = minor quality,
// Uppercase = major quality. IV/iv are perfect 4th (5 semitones); III/iii
// are major/minor 3rd (4 semitones).
const DEGREE_SEMITONES: Record<string, number> = {
  'i': 0, 'I': 0,
  'ii': 2, 'II': 2,
  'iii': 4, 'III': 4,
  'iv': 5, 'IV': 5,
  'v': 7, 'V': 7,
  'vi': 9, 'VI': 9,
  'vii': 11, 'VII': 11,
}

const CHORD_QUALITIES: Record<string, number[]> = {
  major:  [0, 4, 7],
  minor:  [0, 3, 7],
  dim:    [0, 3, 6],
  aug:    [0, 4, 8],
  '7':    [0, 4, 7, 10],
  dom7:   [0, 4, 7, 10],
  M7:     [0, 4, 7, 11],
  maj7:   [0, 4, 7, 11],
  m7:     [0, 3, 7, 10],
  mM7:    [0, 3, 7, 11],
  dim7:   [0, 3, 6, 9],
  'm7-5': [0, 3, 6, 10],
  sus2:   [0, 2, 7],
  sus4:   [0, 5, 7],
  '7sus4':[0, 5, 7, 10],
  '6':    [0, 4, 7, 9],
  m6:     [0, 3, 7, 9],
  '9':    [0, 4, 7, 10, 14],
  maj9:   [0, 4, 7, 11, 14],
  m9:     [0, 3, 7, 10, 14],
  add9:   [0, 4, 7, 14],
  madd9:  [0, 3, 7, 14],
  '5':    [0, 7],
}

const ROMAN_PATTERNS = [
  'VII', 'vii', 'VI', 'vi', 'IV', 'iv',
  'V', 'v', 'III', 'iii', 'II', 'ii', 'I', 'i',
]

/**
 * Parse a Roman-numeral chord symbol against a key pitch class into a
 * ParsedChord. Accepts: 'I', 'ii', 'bIII', '#IVdim7', 'Vsus2', 'i7', 'VI69',
 * 'im7', 'ivm9', etc.
 *
 * @param numeral     — Roman numeral with optional accidental + quality suffix
 * @param keyPitchClass — tonal center as PC 0..11 (0=C, 1=C#, … 11=B)
 * @param octave      — base octave for voicing (default 4 = middle C area)
 */
export function chordFromRoman(
  numeral: string,
  keyPitchClass: number,
  octave: number = 4,
): ParsedChord {
  let s = numeral
  let accidentalShift = 0
  while (s.startsWith('b')) { accidentalShift -= 1; s = s.slice(1) }
  while (s.startsWith('#')) { accidentalShift += 1; s = s.slice(1) }

  let degree = ''
  let romanIsMinor = false
  for (const pat of ROMAN_PATTERNS) {
    if (s.startsWith(pat)) {
      degree = pat
      romanIsMinor = pat === pat.toLowerCase()
      s = s.slice(pat.length)
      break
    }
  }
  if (!degree) {
    // Unparseable — fall back to a major tonic so the engine doesn't crash.
    return chordFromIntervals(numeral, 0, keyPitchClass, [0, 4, 7], octave)
  }

  const baseSemi = (DEGREE_SEMITONES[degree.toUpperCase()] ?? 0) + accidentalShift
  const suffix = s

  let intervals: number[]
  if (suffix === '' || suffix === 'M') {
    intervals = romanIsMinor && suffix !== 'M'
      ? [...CHORD_QUALITIES.minor]
      : [...CHORD_QUALITIES.major]
  } else if (suffix === 'dim' || suffix.startsWith('dim')) {
    intervals = [...(CHORD_QUALITIES[suffix] ?? CHORD_QUALITIES.dim)]
  } else if (suffix === 'aug') {
    intervals = [...CHORD_QUALITIES.aug]
  } else if (CHORD_QUALITIES[suffix]) {
    intervals = [...CHORD_QUALITIES[suffix]]
  } else {
    intervals = romanIsMinor ? [...CHORD_QUALITIES.minor] : [...CHORD_QUALITIES.major]
  }

  const rootOffset = ((baseSemi % 12) + 12) % 12
  return chordFromIntervals(numeral, rootOffset, keyPitchClass, intervals, octave)
}

function chordFromIntervals(
  symbol: string,
  rootOffset: number,
  keyPitchClass: number,
  intervals: number[],
  octave: number,
): ParsedChord {
  const keyPC = ((keyPitchClass % 12) + 12) % 12
  const rootPC = (((keyPC + rootOffset) % 12) + 12) % 12
  const rootMidi = 12 * (octave + 1) + rootPC
  return {
    symbol,
    root:    NOTE_NAMES[rootPC],
    quality: '',
    rootMidi,
    intervals,
    pitches: intervals.map((i) => rootMidi + i),
  }
}

/** Convert a note-name string ('C', 'F#', 'Bb') to a pitch class 0..11. */
export function keyToPitchClass(key: string): number {
  return NOTE_TO_SEMITONE[key] ?? 0
}

// ── Plan validation ──────────────────────────────────────────────────
//
// Used by the composer to reject malformed LLM output before it reaches
// Conductor. Returns null when valid, or a message describing the first
// problem found. Cheap enough to run on every compose() result.

const SECTION_NAMES: ArrangementSectionName[] = [
  'intro', 'verse', 'build', 'drop', 'breakdown', 'drop2', 'outro',
]

export function validateArrangementPlan(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'plan is not an object'
  const p = value as Partial<ArrangementPlan>
  if (typeof p.id !== 'string' || p.id.length === 0)        return 'id missing'
  if (typeof p.key !== 'string' || !(p.key in NOTE_TO_SEMITONE)) return `invalid key: ${p.key}`
  if (typeof p.bpm !== 'number' || p.bpm < 40 || p.bpm > 220)    return `invalid bpm: ${p.bpm}`
  if (typeof p.subGenre !== 'string' || p.subGenre.length === 0) return 'subGenre missing'
  if (typeof p.mood !== 'string')                                return 'mood missing'
  if (typeof p.acePrompt !== 'string')                           return 'acePrompt missing'
  if (!Array.isArray(p.sections) || p.sections.length === 0)     return 'sections empty'
  for (let i = 0; i < p.sections.length; i++) {
    const s = p.sections[i]
    if (!s || typeof s !== 'object')                              return `section[${i}] invalid`
    if (!SECTION_NAMES.includes(s.name))                          return `section[${i}].name invalid: ${s.name}`
    if (typeof s.bars !== 'number' || s.bars < 1 || s.bars > 64)  return `section[${i}].bars out of range`
    if (!Array.isArray(s.progression) || s.progression.length === 0) return `section[${i}].progression empty`
    if (typeof s.energy !== 'number'  || s.energy < 0  || s.energy > 1)  return `section[${i}].energy out of range`
    if (typeof s.density !== 'number' || s.density < 0 || s.density > 1) return `section[${i}].density out of range`
  }
  return null
}
