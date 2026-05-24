// Conductor — the musical brain of the live Organism.
//
// Owns the harmonic state (key, chord progression, current chord) that every
// generator must agree on. Before Conductor, each generator made independent
// musical choices — BassGenerator picked random root notes, MelodyGenerator
// picked scale-derived notes without knowing what chord was playing,
// ChordGenerator chose voicings from its own internal state. The result was
// five musicians who happened to be in the same room, not a band.
//
// Generators now READ from the Conductor instead of inventing their own state:
//   - BassGenerator.rootMidi     = conductor.currentChord().rootMidi
//   - MelodyGenerator.scaleNotes = conductor.scaleNotes()
//   - MelodyGenerator.chordTones = conductor.chordTones()
//   - ChordGenerator.voicing     = conductor.currentChord().pitches
//
// In Phase 1 (this commit), progressions come from a hardcoded library per
// sub-genre. In Phase 5, Conductor will call a musicMind service (WebLLM
// in-browser, Groq/Ollama as fallback) to generate progressions dynamically
// — but the public API surface stays identical.

// ── Music-theory primitives ──────────────────────────────────────────

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

// Intervals relative to the chord root, in semitones.
const CHORD_INTERVALS: Record<string, number[]> = {
  '':      [0, 4, 7],          // major triad
  'maj':   [0, 4, 7],
  'M':     [0, 4, 7],
  'm':     [0, 3, 7],          // minor triad
  'min':   [0, 3, 7],
  'dim':   [0, 3, 6],
  'aug':   [0, 4, 8],
  'sus2':  [0, 2, 7],
  'sus4':  [0, 5, 7],
  '7':     [0, 4, 7, 10],      // dominant 7
  'maj7':  [0, 4, 7, 11],
  'M7':    [0, 4, 7, 11],
  'm7':    [0, 3, 7, 10],
  'mMaj7': [0, 3, 7, 11],
  'dim7':  [0, 3, 6, 9],
  'm7b5':  [0, 3, 6, 10],
  '9':     [0, 4, 7, 10, 14],
  'maj9':  [0, 4, 7, 11, 14],
  'm9':    [0, 3, 7, 10, 14],
  'add9':  [0, 4, 7, 14],
  '6':     [0, 4, 7, 9],
  'm6':    [0, 3, 7, 9],
}

export interface ParsedChord {
  symbol:    string   // 'Cm7'
  root:      string   // 'C'
  quality:   string   // 'm7'
  rootMidi:  number   // MIDI note number of the root (e.g. 60 = C4)
  intervals: number[] // relative semitones [0, 3, 7, 10]
  pitches:   number[] // absolute MIDI notes [60, 63, 67, 70]
}

const CHORD_RE = /^([A-G][#b]?)(.*)$/

export function parseChord(symbol: string, rootOctave = 4): ParsedChord {
  const match = symbol.match(CHORD_RE)
  if (!match) throw new Error(`Cannot parse chord symbol: ${symbol}`)
  const [, root, qualityRaw] = match
  const quality = qualityRaw.trim()
  const semitone = NOTE_TO_SEMITONE[root]
  if (semitone === undefined) throw new Error(`Unknown root note: ${root}`)
  const rootMidi = 12 * (rootOctave + 1) + semitone
  const intervals = CHORD_INTERVALS[quality] ?? CHORD_INTERVALS['']
  const pitches = intervals.map((i) => rootMidi + i)
  return { symbol, root, quality, rootMidi, intervals, pitches }
}

// ── Scales ──────────────────────────────────────────────────────────

// Hip-hop and rap lean heavily on natural minor and Dorian. Major exists
// for chill / lo-fi sub-genres but isn't the default.
const SCALE_INTERVALS = {
  minor:  [0, 2, 3, 5, 7, 8, 10],   // natural minor (Aeolian)
  dorian: [0, 2, 3, 5, 7, 9, 10],   // boom-bap / jazz-rap default
  major:  [0, 2, 4, 5, 7, 9, 11],   // lo-fi / chill
  phrygian: [0, 1, 3, 5, 7, 8, 10], // darker — phonk / drill
} as const

export type ScaleType = keyof typeof SCALE_INTERVALS

export function scaleNotesForKey(
  keyRoot: string,
  scale: ScaleType = 'minor',
  octave = 4,
): number[] {
  const semi = NOTE_TO_SEMITONE[keyRoot]
  if (semi === undefined) throw new Error(`Unknown key root: ${keyRoot}`)
  const rootMidi = 12 * (octave + 1) + semi
  return SCALE_INTERVALS[scale].map((i) => rootMidi + i)
}

// ── Default progressions per sub-genre ──────────────────────────────
//
// All written in C (transposed at runtime to the active key). The
// progressions reflect what producers in each sub-genre actually reach for:
//   boom-bap   — i-iv-V-i, dorian flavor (Premier, Pete Rock)
//   lo-fi      — Imaj7-iii7-IVmaj7-V7 (Nujabes, jazz-rap)
//   trap       — i-VI-VII-i (modern Atlanta)
//   drill      — i-v-VII-VI (UK drill, dark)
//   r&b        — I-vi-ii-V (Stevie, Drake)
//   soul       — vi-ii-V-I (jazz-leaning rap)

const DEFAULT_PROGRESSIONS: Record<string, string[]> = {
  'boom-bap':    ['Cm7', 'Fm7', 'G7', 'Cm7'],
  'boom bap':    ['Cm7', 'Fm7', 'G7', 'Cm7'],
  'lo-fi':       ['Cmaj7', 'Em7', 'Fmaj7', 'G7'],
  'trap':        ['Cm', 'Ab', 'Bb', 'Cm'],
  'drill':       ['Cm', 'Gm', 'Bb', 'Ab'],
  'r&b':         ['Cmaj7', 'Am7', 'Dm7', 'G7'],
  'r&b-soul':    ['Cmaj7', 'Am7', 'Dm7', 'G7'],
  'soul':        ['Am7', 'Dm7', 'G7', 'Cmaj7'],
  'chill':       ['Cmaj7', 'Em7', 'Am7', 'Fmaj7'],
  'west-coast':  ['Cm7', 'Bbmaj7', 'Abmaj7', 'G7'],
  'dirty-south': ['Cm', 'Fm', 'G', 'Cm'],
  'phonk':       ['Cm', 'Bb', 'Ab', 'G7'],
  'afrobeat':    ['Cm', 'Bb', 'Ab', 'Bb'],
  'afrobeats':   ['Cm', 'Bb', 'Ab', 'Bb'],
  'jersey-club': ['Cm', 'Fm', 'Cm', 'G'],
  'bounce':      ['Cm', 'Eb', 'Bb', 'Cm'],
  'reggaeton':   ['Cm', 'G', 'Ab', 'G'],
  'hip-hop':     ['Cm7', 'Fm7', 'G7', 'Cm7'],
}

// Scales each sub-genre prefers. Generators read this so passing notes feel
// idiomatic — boom-bap wants dorian sevenths, drill wants phrygian flats.
const SUB_GENRE_SCALES: Record<string, ScaleType> = {
  'boom-bap':    'dorian',
  'boom bap':    'dorian',
  'lo-fi':       'major',
  'trap':        'minor',
  'drill':       'phrygian',
  'r&b':         'major',
  'r&b-soul':    'major',
  'soul':        'dorian',
  'chill':       'major',
  'west-coast':  'dorian',
  'dirty-south': 'minor',
  'phonk':       'phrygian',
  'afrobeat':    'minor',
  'afrobeats':   'minor',
  'jersey-club': 'minor',
  'bounce':      'minor',
  'reggaeton':   'minor',
  'hip-hop':     'dorian',
}

// ── The Conductor ────────────────────────────────────────────────────

export interface ConductorOptions {
  key?:      string       // tonal center, e.g. 'C', 'F#', 'Bb'
  subGenre?: string       // pattern-library key
  scale?:    ScaleType    // optional override; defaults to sub-genre's preferred
}

export interface ConductorScoreContext {
  bar?: number
  bpm?: number
  section?: string
  energy?: number
  density?: number
  groove?: string
  mood?: string
}

export interface ConductorScoreFrame {
  bar: number
  bpm: number
  section: string
  key: string
  rootPitchClass: number
  scale: ScaleType
  scaleIntervals: number[]
  subGenre: string
  mood: string
  chordIndex: number
  currentChord: ParsedChord
  nextChord: ParsedChord
  progression: ParsedChord[]
  energy: number
  density: number
  groove: string
  aceStep: {
    genre: string
    mood: string
    bpm: number
    section: string
    promptTags: string[]
  }
}

export class Conductor {
  private key: string
  private subGenre: string
  private scale: ScaleType
  private progression: ParsedChord[]
  private chordIndex = 0
  private chordChangeListeners: Array<(chord: ParsedChord) => void> = []
  private scoreContext: Required<ConductorScoreContext> = {
    bar: 0,
    bpm: 90,
    section: 'intro',
    energy: 0,
    density: 0,
    groove: 'straight',
    mood: 'focused',
  }

  constructor(options: ConductorOptions = {}) {
    this.key = options.key ?? 'C'
    this.subGenre = options.subGenre ?? 'hip-hop'
    this.scale = options.scale ?? SUB_GENRE_SCALES[this.subGenre] ?? 'minor'
    this.progression = this.buildProgression()
  }

  // ── Building progressions ────────────────────────────────────────

  private buildProgression(): ParsedChord[] {
    const symbols = DEFAULT_PROGRESSIONS[this.subGenre]
                 ?? DEFAULT_PROGRESSIONS['hip-hop']
    return symbols
      .map((symbol) => this.transposeToKey(symbol))
      .map((symbol) => parseChord(symbol))
  }

  private transposeToKey(chordSymbol: string): string {
    if (this.key === 'C') return chordSymbol
    const targetSemi = NOTE_TO_SEMITONE[this.key]
    if (targetSemi === undefined) return chordSymbol
    const match = chordSymbol.match(CHORD_RE)
    if (!match) return chordSymbol
    const [, root, quality] = match
    const sourceSemi = NOTE_TO_SEMITONE[root]
    if (sourceSemi === undefined) return chordSymbol
    const newSemi = (sourceSemi + targetSemi + 12) % 12
    return NOTE_NAMES[newSemi] + quality
  }

  // ── Public read API — generators consume these ───────────────────

  /** The chord currently sounding. Generators check this every bar. */
  currentChord(): ParsedChord {
    return this.progression[this.chordIndex]
  }

  /** The chord that comes next — for anticipatory fills and voiceleading. */
  nextChord(): ParsedChord {
    const nextIdx = (this.chordIndex + 1) % this.progression.length
    return this.progression[nextIdx]
  }

  /** All scale notes — melody picks passing notes from these. */
  scaleNotes(octave = 4): number[] {
    return scaleNotesForKey(this.key, this.scale, octave)
  }

  /** Chord tones of the current chord — melody emphasizes these on strong beats. */
  chordTones(): number[] {
    return this.currentChord().pitches
  }

  /** The whole progression — useful for UI display and lookahead planning. */
  getProgression(): ParsedChord[] {
    return [...this.progression]
  }

  /** The tonal center. */
  getKey(): string {
    return this.key
  }

  /** The active sub-genre. */
  getSubGenre(): string {
    return this.subGenre
  }

  /** The active scale type. */
  getScale(): ScaleType {
    return this.scale
  }

  /**
   * Pitch class (0-11) of the tonal center. Generators that work in pitch
   * classes (melody, chord-tone matching) read this instead of parsing
   * `getKey()` themselves.
   */
  getKeyPitchClass(): number {
    return NOTE_TO_SEMITONE[this.key] ?? 0
  }

  /**
   * Relative semitone intervals of the active scale, e.g. natural minor
   * returns [0, 2, 3, 5, 7, 8, 10]. Melody uses this as `currentScale`.
   */
  scaleIntervals(): number[] {
    return [...SCALE_INTERVALS[this.scale]]
  }

  /** Current index within the progression (0..progression.length - 1). */
  getChordIndex(): number {
    return this.chordIndex
  }

  /** The current real-time score snapshot every band member should read. */
  getScoreFrame(): ConductorScoreFrame {
    return {
      bar: this.scoreContext.bar,
      bpm: this.scoreContext.bpm,
      section: this.scoreContext.section,
      key: this.key,
      rootPitchClass: this.getKeyPitchClass(),
      scale: this.scale,
      scaleIntervals: this.scaleIntervals(),
      subGenre: this.subGenre,
      mood: this.scoreContext.mood,
      chordIndex: this.chordIndex,
      currentChord: this.currentChord(),
      nextChord: this.nextChord(),
      progression: this.getProgression(),
      energy: this.scoreContext.energy,
      density: this.scoreContext.density,
      groove: this.scoreContext.groove,
      aceStep: this.buildAceStepFrame(),
    }
  }

  private buildAceStepFrame(): ConductorScoreFrame['aceStep'] {
    const mood = this.scoreContext.mood
    const tags = [
      this.subGenre,
      'hip-hop',
      mood,
      `${this.scoreContext.bpm} bpm`,
      this.scoreContext.section,
      this.scale,
      this.scoreContext.groove,
      'instrumental',
      'studio quality',
      'professional mix',
      'no vocals',
    ].filter(Boolean)

    return {
      genre: this.subGenre,
      mood,
      bpm: this.scoreContext.bpm,
      section: this.scoreContext.section,
      promptTags: Array.from(new Set(tags)),
    }
  }

  // ── Public write API — orchestrator drives these ─────────────────

  /** Update non-harmonic score context from the arranger/orchestrator. */
  updateScoreContext(context: ConductorScoreContext): void {
    this.scoreContext = {
      ...this.scoreContext,
      ...context,
      bar: context.bar == null ? this.scoreContext.bar : Math.max(0, Math.floor(context.bar)),
      bpm: context.bpm == null ? this.scoreContext.bpm : Math.max(40, Math.min(220, Math.round(context.bpm))),
      energy: context.energy == null ? this.scoreContext.energy : Math.max(0, Math.min(1, context.energy)),
      density: context.density == null ? this.scoreContext.density : Math.max(0, Math.min(1, context.density)),
    }
  }

  /**
   * Move to the next chord in the progression. Typically called every
   * 2 bars by the GeneratorOrchestrator on its bar-change tick.
   */
  advanceChord(): void {
    this.chordIndex = (this.chordIndex + 1) % this.progression.length
    const chord = this.currentChord()
    for (const cb of this.chordChangeListeners) cb(chord)
  }

  /**
   * Switch sub-genre mid-session. Rebuilds the progression library.
   * Used when MusicalDirector detects a sub-genre shift or the user
   * presses a genre button.
   */
  setSubGenre(subGenre: string): void {
    if (subGenre === this.subGenre) return
    this.subGenre = subGenre
    this.scale = SUB_GENRE_SCALES[subGenre] ?? this.scale
    this.progression = this.buildProgression()
    this.chordIndex = 0
    const chord = this.currentChord()
    for (const cb of this.chordChangeListeners) cb(chord)
  }

  /**
   * Switch key mid-session. Rare in live use — usually only happens once
   * at session start based on detected vocal pitch or a key picker.
   */
  setKey(key: string): void {
    if (key === this.key) return
    if (NOTE_TO_SEMITONE[key] === undefined) {
      throw new Error(`Cannot set key to unknown root: ${key}`)
    }
    this.key = key
    this.progression = this.buildProgression()
    this.chordIndex = 0
    const chord = this.currentChord()
    for (const cb of this.chordChangeListeners) cb(chord)
  }

  /**
   * Override the entire progression directly. Used in Phase 5 when the
   * musicMind LLM service returns a generated progression and we want
   * the Conductor to play it instead of the hardcoded library.
   */
  setProgression(chordSymbols: string[]): void {
    if (chordSymbols.length === 0) return
    this.progression = chordSymbols.map((s) => parseChord(this.transposeToKey(s)))
    this.chordIndex = 0
    const chord = this.currentChord()
    for (const cb of this.chordChangeListeners) cb(chord)
  }

  /**
   * Reset to the start of the current progression. Useful when a new
   * arrangement section begins (verse → drop, etc.).
   */
  resetChordIndex(): void {
    this.chordIndex = 0
  }

  /** Subscribe to chord-change events. Returns an unsubscribe function. */
  onChordChange(cb: (chord: ParsedChord) => void): () => void {
    this.chordChangeListeners.push(cb)
    return () => {
      this.chordChangeListeners = this.chordChangeListeners.filter((c) => c !== cb)
    }
  }
}

// ── Singleton accessor ───────────────────────────────────────────────
//
// Generators import the singleton via getConductor() rather than receive
// the Conductor via constructor injection. Matches the existing pattern
// used by useStudioStore and the audioContext singleton — keeps the
// refactor footprint small in Phases 2-4 since generators don't need
// new constructor parameters.

let instance: Conductor | null = null

export function getConductor(): Conductor {
  if (!instance) instance = new Conductor()
  return instance
}

/** Replace the singleton — used in tests and when re-initializing a session. */
export function setConductor(conductor: Conductor): void {
  instance = conductor
}

/** Drop the singleton entirely — next getConductor() builds a fresh one. */
export function resetConductor(): void {
  instance = null
}
