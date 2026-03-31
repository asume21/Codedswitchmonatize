/** All 12 chromatic note names (sharps only for canonical representation) */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = typeof NOTE_NAMES[number];

/** Flat → sharp alias map */
export const ENHARMONIC: Record<string, NoteName> = {
  'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B',
  'C': 'C', 'C#': 'C#', 'D': 'D', 'D#': 'D#', 'E': 'E', 'F': 'F', 'F#': 'F#',
  'G': 'G', 'G#': 'G#', 'A': 'A', 'A#': 'A#', 'B': 'B',
};

/** Interval semitone distances from root */
export const INTERVALS: Record<string, number> = {
  'P1': 0, 'unison': 0,
  'm2': 1, 'M2': 2, 'm3': 3, 'M3': 4,
  'P4': 5, 'aug4': 6, 'tritone': 6, 'dim5': 6,
  'P5': 7, 'aug5': 8, 'm6': 8, 'M6': 9,
  'm7': 10, 'M7': 11, 'P8': 12, 'octave': 12,
  'm9': 13, 'M9': 14, 'm10': 15, 'M10': 16,
  'P11': 17, 'aug11': 18, 'P12': 19,
  'm13': 20, 'M13': 21,
};

/** Scale definitions as semitone intervals from root */
export const SCALES: Record<string, number[]> = {
  'major':            [0, 2, 4, 5, 7, 9, 11],
  'natural_minor':    [0, 2, 3, 5, 7, 8, 10],
  'harmonic_minor':   [0, 2, 3, 5, 7, 8, 11],
  'melodic_minor':    [0, 2, 3, 5, 7, 9, 11],
  'dorian':           [0, 2, 3, 5, 7, 9, 10],
  'phrygian':         [0, 1, 3, 5, 7, 8, 10],
  'lydian':           [0, 2, 4, 6, 7, 9, 11],
  'mixolydian':       [0, 2, 4, 5, 7, 9, 10],
  'locrian':          [0, 1, 3, 5, 6, 8, 10],
  'pentatonic_major': [0, 2, 4, 7, 9],
  'pentatonic_minor': [0, 3, 5, 7, 10],
  'blues':            [0, 3, 5, 6, 7, 10],
  'whole_tone':       [0, 2, 4, 6, 8, 10],
  'chromatic':        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'diminished':       [0, 2, 3, 5, 6, 8, 9, 11],
  'augmented':        [0, 3, 4, 7, 8, 11],
  'phrygian_dominant':[0, 1, 4, 5, 7, 8, 10],
  'hungarian_minor':  [0, 2, 3, 6, 7, 8, 11],
  'japanese':         [0, 1, 5, 7, 8],
  'arabic':           [0, 1, 4, 5, 7, 8, 11],
};

/** Chord quality definitions as semitone intervals */
export const CHORD_TYPES: Record<string, number[]> = {
  'major':       [0, 4, 7],
  'minor':       [0, 3, 7],
  'diminished':  [0, 3, 6],
  'augmented':   [0, 4, 8],
  'sus2':        [0, 2, 7],
  'sus4':        [0, 5, 7],
  'dom7':        [0, 4, 7, 10],
  'maj7':        [0, 4, 7, 11],
  'min7':        [0, 3, 7, 10],
  'min_maj7':    [0, 3, 7, 11],
  'dim7':        [0, 3, 6, 9],
  'half_dim7':   [0, 3, 6, 10],
  'aug7':        [0, 4, 8, 10],
  'dom9':        [0, 4, 7, 10, 14],
  'maj9':        [0, 4, 7, 11, 14],
  'min9':        [0, 3, 7, 10, 14],
  'dom11':       [0, 4, 7, 10, 14, 17],
  'min11':       [0, 3, 7, 10, 14, 17],
  'dom13':       [0, 4, 7, 10, 14, 17, 21],
  'add9':        [0, 4, 7, 14],
  '6':           [0, 4, 7, 9],
  'min6':        [0, 3, 7, 9],
  'power':       [0, 7],
};

/** Roman numeral chord labels for diatonic triads */
export const MAJOR_DIATONIC_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const;
export const MINOR_DIATONIC_NUMERALS = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] as const;
