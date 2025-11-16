/**
 * Chord Definitions - The Four Chords Foundation
 * Based on the I-V-vi-IV progression (C-G-Am-F in C Major)
 * This is the proven "hit song formula" used in 1000+ popular songs
 */

export interface ChordDefinition {
  name: string;
  root: string;
  notes: string[];
  type: 'major' | 'minor' | 'power' | 'seventh';
  romanNumeral: string;
}

/**
 * The Four Chords in C Major
 * I-V-vi-IV progression: C - G - Am - F
 */
export const FOUR_CHORDS_C_MAJOR: ChordDefinition[] = [
  {
    name: 'C',
    root: 'C',
    notes: ['C4', 'E4', 'G4'],
    type: 'major',
    romanNumeral: 'I',
  },
  {
    name: 'G',
    root: 'G',
    notes: ['G4', 'B4', 'D5'],
    type: 'major',
    romanNumeral: 'V',
  },
  {
    name: 'Am',
    root: 'A',
    notes: ['A4', 'C5', 'E5'],
    type: 'minor',
    romanNumeral: 'vi',
  },
  {
    name: 'F',
    root: 'F',
    notes: ['F4', 'A4', 'C5'],
    type: 'major',
    romanNumeral: 'IV',
  },
];

/**
 * Genre-specific chord variations
 */
export const CHORD_VARIATIONS: Record<string, ChordDefinition[]> = {
  // Pop: Standard four chords
  pop: FOUR_CHORDS_C_MAJOR,

  // Rock: Power chords (root + 5th only)
  rock: [
    { name: 'C5', root: 'C', notes: ['C4', 'G4'], type: 'power', romanNumeral: 'I' },
    { name: 'G5', root: 'G', notes: ['G4', 'D5'], type: 'power', romanNumeral: 'V' },
    { name: 'Am5', root: 'A', notes: ['A4', 'E5'], type: 'power', romanNumeral: 'vi' },
    { name: 'F5', root: 'F', notes: ['F4', 'C5'], type: 'power', romanNumeral: 'IV' },
  ],

  // Hip-Hop: Same as pop but lower octave
  hiphop: [
    { name: 'C', root: 'C', notes: ['C3', 'E3', 'G3'], type: 'major', romanNumeral: 'I' },
    { name: 'G', root: 'G', notes: ['G3', 'B3', 'D4'], type: 'major', romanNumeral: 'V' },
    { name: 'Am', root: 'A', notes: ['A3', 'C4', 'E4'], type: 'minor', romanNumeral: 'vi' },
    { name: 'F', root: 'F', notes: ['F3', 'A3', 'C4'], type: 'major', romanNumeral: 'IV' },
  ],

  // EDM: Same as pop
  edm: FOUR_CHORDS_C_MAJOR,

  // R&B: 7th chords for sophistication
  rnb: [
    { name: 'Cmaj7', root: 'C', notes: ['C4', 'E4', 'G4', 'B4'], type: 'seventh', romanNumeral: 'I' },
    { name: 'G7', root: 'G', notes: ['G4', 'B4', 'D5', 'F5'], type: 'seventh', romanNumeral: 'V' },
    { name: 'Am7', root: 'A', notes: ['A4', 'C5', 'E5', 'G5'], type: 'seventh', romanNumeral: 'vi' },
    { name: 'Fmaj7', root: 'F', notes: ['F4', 'A4', 'C5', 'E5'], type: 'seventh', romanNumeral: 'IV' },
  ],

  // Country: Same as pop
  country: FOUR_CHORDS_C_MAJOR,
};

/**
 * Scale notes in C Major (for melody generation)
 * All melody notes must come from this scale to ensure harmony
 */
export const C_MAJOR_SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Note to MIDI number mapping (for calculations)
 */
export const NOTE_TO_MIDI: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11,
};

/**
 * Get chord notes for a specific genre
 */
export function getChordsForGenre(genre: string): ChordDefinition[] {
  return CHORD_VARIATIONS[genre] || FOUR_CHORDS_C_MAJOR;
}

/**
 * Get a specific chord by index (0-3 for the four chords)
 */
export function getChordByIndex(genre: string, index: number): ChordDefinition {
  const chords = getChordsForGenre(genre);
  return chords[index % chords.length];
}

/**
 * Check if a note is in the C Major scale
 */
export function isInCMajorScale(noteName: string): boolean {
  return C_MAJOR_SCALE.includes(noteName);
}

/**
 * Get the closest note in C Major scale
 */
export function getClosestScaleNote(noteName: string): string {
  if (isInCMajorScale(noteName)) return noteName;
  
  // If not in scale, map to closest scale note
  const mapping: Record<string, string> = {
    'C#': 'D', 'Db': 'D',
    'D#': 'E', 'Eb': 'E',
    'F#': 'G', 'Gb': 'G',
    'G#': 'A', 'Ab': 'A',
    'A#': 'B', 'Bb': 'B',
  };
  
  return mapping[noteName] || 'C';
}
