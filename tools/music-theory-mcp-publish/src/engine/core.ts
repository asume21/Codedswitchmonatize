import {
  NOTE_NAMES, ENHARMONIC, SCALES, CHORD_TYPES, INTERVALS,
  MAJOR_DIATONIC_NUMERALS, MINOR_DIATONIC_NUMERALS,
  type NoteName,
} from './constants.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalize any note name (flats, sharps, mixed case) to canonical sharp form */
export function normalize(note: string): NoteName {
  const trimmed = note.trim();
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  const mapped = ENHARMONIC[capitalized];
  if (mapped) return mapped;
  // Try stripping trailing chars
  const base = ENHARMONIC[capitalized.slice(0, 2)] ?? ENHARMONIC[capitalized.slice(0, 1)];
  if (base) return base;
  throw new Error(`Unknown note: ${note}`);
}

/** Get the MIDI-style pitch class index (0-11) for a note name */
export function pitchClass(note: string): number {
  return NOTE_NAMES.indexOf(normalize(note));
}

/** Transpose a note by N semitones */
export function transpose(note: string, semitones: number): NoteName {
  const idx = pitchClass(note);
  return NOTE_NAMES[((idx + semitones) % 12 + 12) % 12];
}

/** Get interval name between two notes (ascending, within one octave) */
export function intervalBetween(noteA: string, noteB: string): string {
  const diff = ((pitchClass(noteB) - pitchClass(noteA)) % 12 + 12) % 12;
  const names = Object.entries(INTERVALS).filter(([, v]) => v === diff).map(([k]) => k);
  return names[0] ?? `${diff} semitones`;
}

// ─── Scale Operations ───────────────────────────────────────────────────────

export interface ScaleInfo {
  root: string;
  type: string;
  notes: string[];
  intervals: number[];
  modes: string[];
}

export function getScale(root: string, type: string): ScaleInfo {
  const intervals = SCALES[type];
  if (!intervals) throw new Error(`Unknown scale: ${type}. Available: ${Object.keys(SCALES).join(', ')}`);
  const rootNote = normalize(root);
  const notes = intervals.map(i => transpose(rootNote, i));
  const modeNames = type === 'major'
    ? ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']
    : [];
  return { root: rootNote, type, notes, intervals, modes: modeNames };
}

export function listScales(): string[] {
  return Object.keys(SCALES);
}

// ─── Chord Operations ───────────────────────────────────────────────────────

export interface ChordInfo {
  root: string;
  type: string;
  notes: string[];
  intervals: number[];
  symbol: string;
}

const CHORD_SYMBOLS: Record<string, string> = {
  major: '', minor: 'm', diminished: 'dim', augmented: 'aug',
  sus2: 'sus2', sus4: 'sus4', dom7: '7', maj7: 'maj7', min7: 'm7',
  min_maj7: 'mMaj7', dim7: 'dim7', half_dim7: 'ø7', aug7: 'aug7',
  dom9: '9', maj9: 'maj9', min9: 'm9', dom11: '11', min11: 'm11',
  dom13: '13', add9: 'add9', '6': '6', min6: 'm6', power: '5',
};

export function getChord(root: string, type: string): ChordInfo {
  const intervals = CHORD_TYPES[type];
  if (!intervals) throw new Error(`Unknown chord type: ${type}. Available: ${Object.keys(CHORD_TYPES).join(', ')}`);
  const rootNote = normalize(root);
  const notes = intervals.map(i => transpose(rootNote, i));
  const symbol = `${rootNote}${CHORD_SYMBOLS[type] ?? type}`;
  return { root: rootNote, type, notes, intervals, symbol };
}

export function listChordTypes(): string[] {
  return Object.keys(CHORD_TYPES);
}

/** Identify a chord from a set of note names */
export function identifyChord(noteNames: string[]): Array<{ root: string; type: string; symbol: string; inversion: number }> {
  const pcs = noteNames.map(n => pitchClass(n));
  const unique = [...new Set(pcs)];
  const results: Array<{ root: string; type: string; symbol: string; inversion: number }> = [];

  for (let inv = 0; inv < unique.length; inv++) {
    const root = unique[inv];
    const intervals = unique.map(pc => ((pc - root) % 12 + 12) % 12).sort((a, b) => a - b);
    const intStr = intervals.join(',');

    for (const [typeName, typeIntervals] of Object.entries(CHORD_TYPES)) {
      if (typeIntervals.map(i => i % 12).sort((a, b) => a - b).join(',') === intStr) {
        const rootNote = NOTE_NAMES[root];
        results.push({
          root: rootNote,
          type: typeName,
          symbol: `${rootNote}${CHORD_SYMBOLS[typeName] ?? typeName}`,
          inversion: inv,
        });
      }
    }
  }
  return results;
}

// ─── Diatonic / Key Analysis ────────────────────────────────────────────────

export interface DiatonicChord {
  degree: number;
  numeral: string;
  root: string;
  type: string;
  symbol: string;
  notes: string[];
}

export function getDiatonicChords(root: string, mode: 'major' | 'minor' = 'major'): DiatonicChord[] {
  const scaleType = mode === 'major' ? 'major' : 'natural_minor';
  const scale = getScale(root, scaleType);
  const numerals = mode === 'major' ? MAJOR_DIATONIC_NUMERALS : MINOR_DIATONIC_NUMERALS;

  // Quality pattern for building triads from scale degrees
  const majorQualities = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
  const minorQualities = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];
  const qualities = mode === 'major' ? majorQualities : minorQualities;

  return scale.notes.map((note, i) => {
    const chord = getChord(note, qualities[i]);
    return {
      degree: i + 1,
      numeral: numerals[i],
      root: note,
      type: qualities[i],
      symbol: chord.symbol,
      notes: chord.notes,
    };
  });
}

/** Detect the most likely key from a set of notes */
export function detectKey(noteNames: string[]): Array<{ key: string; mode: string; confidence: number }> {
  const pcs = new Set(noteNames.map(n => pitchClass(n)));
  const candidates: Array<{ key: string; mode: string; confidence: number }> = [];

  for (const root of NOTE_NAMES) {
    for (const mode of ['major', 'natural_minor', 'dorian', 'mixolydian', 'phrygian', 'lydian']) {
      const scale = SCALES[mode];
      if (!scale) continue;
      const rootIdx = NOTE_NAMES.indexOf(root);
      const scalePCs = new Set(scale.map(i => (rootIdx + i) % 12));

      let matched = 0;
      let outOfKey = 0;
      for (const pc of pcs) {
        if (scalePCs.has(pc)) matched++;
        else outOfKey++;
      }
      const confidence = pcs.size > 0 ? (matched / pcs.size) - (outOfKey * 0.15) : 0;
      if (confidence > 0.5) {
        candidates.push({ key: root, mode, confidence: Math.round(confidence * 100) / 100 });
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

// ─── Progressions ───────────────────────────────────────────────────────────

export interface ProgressionChord {
  numeral: string;
  root: string;
  type: string;
  symbol: string;
  notes: string[];
}

/** Resolve a Roman numeral progression (e.g., ["I", "V", "vi", "IV"]) in a key */
export function resolveProgression(root: string, numerals: string[], mode: 'major' | 'minor' = 'major'): ProgressionChord[] {
  const diatonic = getDiatonicChords(root, mode);
  return numerals.map(num => {
    const clean = num.replace(/[°ø]/g, '').toLowerCase();
    // Map numeral to degree
    const romanMap: Record<string, number> = {
      'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7,
    };
    const degree = romanMap[clean] ?? parseInt(clean);
    if (!degree || degree < 1 || degree > 7) {
      throw new Error(`Unknown numeral: ${num}`);
    }
    const d = diatonic[degree - 1];
    return {
      numeral: num,
      root: d.root,
      type: d.type,
      symbol: d.symbol,
      notes: d.notes,
    };
  });
}

/** Suggest the next chord based on common voice leading tendencies */
export function suggestNextChord(
  currentNumeral: string,
  key: string,
  mode: 'major' | 'minor' = 'major',
): ProgressionChord[] {
  // Common tendency map (which chords typically follow which)
  const majorTendencies: Record<string, string[]> = {
    'I':    ['IV', 'V', 'vi', 'ii', 'iii'],
    'ii':   ['V', 'vii°', 'IV'],
    'iii':  ['vi', 'IV', 'ii'],
    'IV':   ['V', 'I', 'ii', 'vii°'],
    'V':    ['I', 'vi', 'IV'],
    'vi':   ['ii', 'IV', 'V', 'iii'],
    'vii°': ['I', 'iii'],
  };
  const minorTendencies: Record<string, string[]> = {
    'i':    ['iv', 'v', 'VI', 'III', 'ii°'],
    'ii°':  ['v', 'VII', 'iv'],
    'III':  ['VI', 'iv', 'ii°'],
    'iv':   ['v', 'i', 'ii°', 'VII'],
    'v':    ['i', 'VI', 'iv'],
    'VI':   ['ii°', 'iv', 'v', 'III'],
    'VII':  ['i', 'III'],
  };

  const tendencies = mode === 'major' ? majorTendencies : minorTendencies;
  const suggestions = tendencies[currentNumeral] ?? ['I', 'IV', 'V'];
  return resolveProgression(key, suggestions, mode);
}
