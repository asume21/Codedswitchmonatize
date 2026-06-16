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
// In Phase 4, Conductor picks progressions from the 176-progression bank
// (ChordProgressionBank) via mood×mode scoring. The bank's Roman-numeral
// data is converted directly to ParsedChord using the active key's pitch
// class — no symbol-string round-trip. In Phase 5, Conductor will call a
// musicMind service (WebLLM in-browser, Groq/Ollama as fallback) to
// generate progressions dynamically — the public API surface stays identical.

import {
  pickProgression as pickProgressionFromBank,
  type ChordEvent,
  type ParsedProgression,
} from '../generators/patterns/ChordProgressionBank'
import {
  chordFromRoman,
  keyToPitchClass,
  type ArrangementPlan,
} from '@shared/arrangement'
import { setActiveArrangementTemplate, setArrangementFromPlan } from '../state/ProducerArrangement'

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

// Direct ChordEvent → ParsedChord conversion. The bank's ChordEvent is
// already pitch-class based (rootOffset + intervals + label), so we skip
// the symbol-string round-trip parseChord() does. Always voiced at
// octave 4 so existing voicing code (which drops by octaves to fit) keeps
// the same baseline pitch.
function chordEventToParsed(event: ChordEvent, keyPitchClass: number, octave = 4): ParsedChord {
  const rootPC = (((keyPitchClass + event.rootOffset) % 12) + 12) % 12
  const rootMidi = 12 * (octave + 1) + rootPC
  return {
    symbol:    event.label,
    root:      NOTE_NAMES[rootPC],
    quality:   '',  // not used by consumers — they read intervals/pitches
    rootMidi,
    intervals: event.intervals,
    pitches:   event.intervals.map((i) => rootMidi + i),
  }
}

// Stable signature for de-duping bank picks across attempts.
function progressionSignature(prog: ParsedProgression): string {
  return prog.chords
    .map((c) => `${c.rootOffset}:${c.intervals.join('.')}`)
    .join('|')
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
  /**
   * OrganismMode string ('heat', 'gravel', 'smoke', 'ice', 'glow'). Drives
   * the bank picker's mood→mode scoring. Distinct from `mood` — mood is a
   * free-form descriptor; mode is the physics-engine category.
   */
  mode?: string
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
    mode: 'smoke',
  }
  // Recent bank progressions picked — so a re-pick avoids repeating ANY of
  // them, not just the immediately-previous one. Without this buffer the
  // mood×mode scoring tends to land on the same 2-3 high-scoring entries
  // over and over, which feels like "the engine only knows one progression."
  // Buffer size 8 = roughly two cycles of an 18-bar arrangement before a
  // progression can recur.
  private static readonly RECENT_PROGRESSION_HISTORY = 8
  private recentBankSignatures: string[] = []
  // The last bank progression picked (still tracked for progressionVersion
  // comparison and for skipping recent picks on re-roll). Null = the active
  // progression came from DEFAULT_PROGRESSIONS, not the bank.
  private lastBankSignature: string | null = null
  // Monotonic counter — bumped every time the progression array is REPLACED
  // (setProgression / setSubGenre / setKey / setKeyByPitchClass / pickNewProgression).
  // advanceChord() does NOT bump it. Consumers (e.g. ChordGenerator) compare
  // the cached value to know when to rebuild their Tone.Part.
  private progressionVersion: number = 0
  // When true, pickNewProgression() is a no-op. Used by the user-facing
  // "lock progression" toggle so an Astutely / arrangement section change
  // can't pull the harmonic rug while a verse is being captured.
  private progressionLocked: boolean = false
  // Phase 5: the active ArrangementPlan, if any. When set, the Conductor
  // reads section progressions from `activePlan.sections[activeSectionIndex]`
  // instead of the bank picker. Orchestrator's section-change handler calls
  // `loadSection(nextIndex)` on each boundary; bank picker stays as the
  // jam-mode fallback when `activePlan === null`.
  private activePlan: ArrangementPlan | null = null
  private activeSectionIndex: number = 0
  // Active StylePreset id from the loaded section. The generators subscribe
  // via onStyleChange() and apply their respective slot (chord technique,
  // bass articulation, melody articulation) when this changes. null when
  // no plan is loaded or the section has no style (jam mode).
  private activeStyleId: string | null = null
  private styleChangeListeners: Array<(styleId: string | null) => void> = []

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
    // The default-library path always clears the bank signature so a
    // subsequent setKeyByPitchClass() rebuilds via the same library, not
    // by re-voicing a stale bank progression.
    this.lastBankSignature = null
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

  /**
   * Monotonic version of the active progression. Bumps whenever the
   * underlying progression array is replaced (pickNewProgression,
   * setProgression, setKey, setSubGenre). Does NOT bump on advanceChord.
   * Generators cache it to know when they need to rebuild scheduled parts.
   */
  getProgressionVersion(): number {
    return this.progressionVersion
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
    this.progressionVersion++
    const chord = this.currentChord()
    for (const cb of this.chordChangeListeners) cb(chord)
  }

  /**
   * Switch key to the given pitch class (0=C, 1=C#, … 11=B). Called by
   * the Orchestrator's `setDetectedScale()` so the Conductor's harmony
   * tracks the ScaleSnapEngine. Re-transposes the current progression
   * (or, if it came from the bank, re-voices it for the new key) without
   * picking a different one — pitch shifts in real time, no surprise
   * progression change.
   */
  setKeyByPitchClass(pitchClass: number): void {
    const newPC = ((pitchClass % 12) + 12) % 12
    const newKey = NOTE_NAMES[newPC]
    if (newKey === this.key) return
    const oldKeyPC = this.getKeyPitchClass()
    this.key = newKey
    if (this.lastBankSignature !== null) {
      // Re-voice the bank progression for the new key. ParsedChord was
      // built at octave 4 (rootMidi = 60 + (oldKeyPC + rootOffset) % 12),
      // so rootOffset = ((rootMidi - 60) - oldKeyPC) mod 12.
      this.progression = this.progression.map((parsed) => {
        const rootOffset = (((parsed.rootMidi - 60) - oldKeyPC) % 12 + 12) % 12
        return chordEventToParsed(
          { intervals: parsed.intervals, rootOffset, label: parsed.symbol },
          newPC,
        )
      })
    } else {
      this.progression = this.buildProgression()
    }
    this.chordIndex = 0
    this.progressionVersion++
    const chord = this.currentChord()
    for (const cb of this.chordChangeListeners) cb(chord)
  }

  /**
   * Switch active OrganismMode ('heat', 'gravel', 'smoke', 'ice', 'glow').
   * Mode drives the picker's mood-matching when `pickNewProgression()`
   * runs — separate from sub-genre, which selects the default fallback
   * progression library.
   */
  setMode(mode: string): void {
    if (this.scoreContext.mode === mode) return
    this.scoreContext.mode = mode
  }

  /**
   * Pick a fresh progression from the 176-entry bank, scored by current
   * mode. Called by the Orchestrator on section change so harmony has
   * variety across an arrangement. Falls back to the active progression
   * if the bank returns nothing useful.
   */
  pickNewProgression(): void {
    if (this.progressionLocked) return
    const mode = this.scoreContext.mode || 'smoke'
    const keyPC = this.getKeyPitchClass()
    let chosen: ParsedProgression | null = null
    // Re-roll up to 12 times to find a progression NOT in the recent buffer.
    // 12 attempts × ~30 high-scoring candidates per mode is enough to almost
    // always land on a fresh pick without falling back to the same handful.
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = pickProgressionFromBank(mode)
      const sig = progressionSignature(candidate)
      if (!this.recentBankSignatures.includes(sig)) {
        chosen = candidate
        this.lastBankSignature = sig
        this.recentBankSignatures.push(sig)
        if (this.recentBankSignatures.length > Conductor.RECENT_PROGRESSION_HISTORY) {
          this.recentBankSignatures.shift()
        }
        break
      }
    }
    // Fallback — couldn't avoid history, take whatever the picker returns.
    // Don't update the recent buffer here so the next pick has full freedom.
    if (!chosen) {
      chosen = pickProgressionFromBank(mode)
      this.lastBankSignature = progressionSignature(chosen)
    }
    this.progression = chosen.chords.map((ev) => chordEventToParsed(ev, keyPC))
    this.chordIndex = 0
    this.progressionVersion++
    const chord = this.currentChord()
    for (const cb of this.chordChangeListeners) cb(chord)
  }

  // ── Phase 5: ArrangementPlan consumer ────────────────────────────

  /**
   * Load an ArrangementPlan. The Composer (Ollama / WebLLM / hand-written)
   * is the only writer; Conductor and ACE-Step both read. Switches the
   * Conductor out of jam mode — `pickNewProgression()` is no longer called
   * on section change; the Orchestrator calls `loadSection(nextIndex)`
   * instead. Bank picker remains for sessions that don't load a plan.
   */
  loadPlan(plan: ArrangementPlan): void {
    this.activePlan = plan
    this.activeSectionIndex = 0
    this.key = plan.key
    this.subGenre = plan.subGenre
    this.scale = SUB_GENRE_SCALES[plan.subGenre] ?? this.scale
    this.scoreContext.bpm = plan.bpm
    this.scoreContext.mood = plan.mood
    // The plan's OWN sections become the live arrangement — their bar counts
    // drive section durations and their energy/density drive channel levels,
    // so the live band's structure matches what ACE-Step renders from the
    // same plan. (Supersedes picking a named template by plan.templateId; the
    // template now only informs the composer's structural character upstream.)
    // If the plan somehow has no sections, fall back to the named template so
    // the engine still has an arrangement to read.
    if (!setArrangementFromPlan(plan.sections) && plan.templateId) {
      setActiveArrangementTemplate(plan.templateId)
    }
    this.loadSection(0)
  }

  /**
   * Load section `index` from the active plan — replaces the running
   * progression with the section's Roman-numeral progression voiced
   * against `plan.key`. Bumps progressionVersion so ChordGenerator
   * rebuilds its Part on the next frame. No-op if no plan is loaded
   * or the index is out of range.
   */
  loadSection(index: number): void {
    if (!this.activePlan) return
    if (index < 0 || index >= this.activePlan.sections.length) return
    const section = this.activePlan.sections[index]
    this.activeSectionIndex = index
    const keyPC = keyToPitchClass(this.key)
    // chordFromRoman returns the shared ParsedChord shape; the structural
    // contract matches Conductor's internal ParsedChord (same fields), so
    // the cast is safe — kept narrow to avoid leaking the shared type
    // into the rest of Conductor's API surface.
    this.progression = section.progression.map(
      (numeral) => chordFromRoman(numeral, keyPC) as unknown as ParsedChord,
    )
    this.chordIndex = 0
    this.progressionVersion++
    // The bank picker should not run after a plan-driven load — if a
    // future jam-mode switch occurs, clearPlan() resets this.
    this.lastBankSignature = null
    this.scoreContext.section = section.name
    this.scoreContext.energy = section.energy
    this.scoreContext.density = section.density
    // Broadcast style change BEFORE chord change so generators have their
    // techniques/articulations applied before their chord-driven rebuilds
    // pick them up. Sending the same id again is a no-op for subscribers
    // that idempotency-guard, but we still fire so newly-connected
    // listeners receive the current state.
    const nextStyleId = section.style ?? null
    if (nextStyleId !== this.activeStyleId) {
      this.activeStyleId = nextStyleId
      for (const cb of this.styleChangeListeners) cb(nextStyleId)
    }
    const chord = this.currentChord()
    for (const cb of this.chordChangeListeners) cb(chord)
  }

  /** Currently-active StylePreset id, or null if the section has no style
   *  set or the Conductor is in jam mode (no plan loaded). */
  getActiveStyleId(): string | null {
    return this.activeStyleId
  }

  /**
   * Subscribe to style changes. Fires every time a new section loads with a
   * different style id than the previous one. Returns an unsubscribe fn.
   */
  onStyleChange(listener: (styleId: string | null) => void): () => void {
    this.styleChangeListeners.push(listener)
    return () => {
      const i = this.styleChangeListeners.indexOf(listener)
      if (i >= 0) this.styleChangeListeners.splice(i, 1)
    }
  }

  /** Currently-loaded plan, or null if Conductor is in jam mode. */
  getActivePlan(): ArrangementPlan | null {
    return this.activePlan
  }

  /** Index of the section currently being played within `activePlan.sections`. */
  getActiveSectionIndex(): number {
    return this.activeSectionIndex
  }

  /**
   * Drop the active plan and return to jam mode. Bank picker is in charge
   * again the next time the Orchestrator's section-change handler fires.
   * Keeps the currently-sounding progression playing until the next
   * pickNewProgression() so audio doesn't glitch on the toggle.
   */
  clearPlan(): void {
    this.activePlan = null
    this.activeSectionIndex = 0
    if (this.activeStyleId !== null) {
      this.activeStyleId = null
      for (const cb of this.styleChangeListeners) cb(null)
    }
  }

  /**
   * Switch key by symbol name (legacy). Prefer setKeyByPitchClass — that
   * matches how ScaleSnapEngine reports detected pitch.
   */
  setKey(key: string): void {
    if (key === this.key) return
    if (NOTE_TO_SEMITONE[key] === undefined) {
      throw new Error(`Cannot set key to unknown root: ${key}`)
    }
    this.key = key
    this.progression = this.buildProgression()
    this.chordIndex = 0
    this.progressionVersion++
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
    this.lastBankSignature = null
    this.progression = chordSymbols.map((s) => parseChord(this.transposeToKey(s)))
    this.chordIndex = 0
    this.progressionVersion++
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

  /**
   * Lock the active progression so pickNewProgression() can't replace it.
   * advanceChord() still rotates within the locked progression. Section
   * changes that would otherwise pick fresh harmony will keep the same loop.
   */
  lockProgression(): void {
    this.progressionLocked = true
  }

  /** Unlock — pickNewProgression() will work again on the next section change. */
  unlockProgression(): void {
    this.progressionLocked = false
  }

  isProgressionLocked(): boolean {
    return this.progressionLocked
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
