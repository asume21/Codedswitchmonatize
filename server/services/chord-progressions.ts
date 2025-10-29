// Chord progression generator for different keys and scales
export interface ChordProgression {
  chords: string[];
  romanNumerals: string[];
  description: string;
}

// Common chord progressions by type
const PROGRESSIONS = {
  // Pop progressions
  pop: [
    { chords: ['I', 'V', 'vi', 'IV'], description: 'Classic Pop (I-V-vi-IV)' },
    { chords: ['vi', 'IV', 'I', 'V'], description: 'Pop Ballad (vi-IV-I-V)' },
    { chords: ['I', 'vi', 'IV', 'V'], description: '50s Progression (I-vi-IV-V)' },
    { chords: ['I', 'IV', 'vi', 'V'], description: 'Pop Rock (I-IV-vi-V)' }
  ],
  // Jazz progressions
  jazz: [
    { chords: ['ii7', 'V7', 'I', 'vi7'], description: 'Jazz Standard (ii-V-I-vi)' },
    { chords: ['I', 'vi7', 'ii7', 'V7'], description: 'Circle of Fifths (I-vi-ii-V)' },
    { chords: ['IM7', 'IV7', 'vii7b5', 'iii7'], description: 'Jazz Ballad' },
    { chords: ['I7', 'IV7', 'I7', 'V7'], description: 'Blues Jazz (I-IV-I-V)' }
  ],
  // Electronic progressions
  electronic: [
    { chords: ['i', 'VII', 'VI', 'VII'], description: 'Dark Electronic (i-VII-VI-VII)' },
    { chords: ['i', 'v', 'VI', 'III'], description: 'Minor Electronic (i-v-VI-III)' },
    { chords: ['I', 'bVII', 'IV', 'I'], description: 'Mixolydian Electronic' },
    { chords: ['vi', 'I', 'V', 'vi'], description: 'Ambient Electronic' }
  ],
  // Rock progressions
  rock: [
    { chords: ['I', 'bVII', 'IV', 'I'], description: 'Classic Rock (I-bVII-IV-I)' },
    { chords: ['i', 'bVI', 'bVII', 'i'], description: 'Minor Rock (i-bVI-bVII-i)' },
    { chords: ['I', 'V', 'I', 'V'], description: 'Power Rock (I-V-I-V)' },
    { chords: ['vi', 'I', 'V', 'I'], description: 'Alternative Rock' }
  ],
  // Hip-hop progressions
  hiphop: [
    { chords: ['i', 'bVI', 'bIII', 'bVII'], description: 'Dark Hip-Hop (i-bVI-bIII-bVII)' },
    { chords: ['i', 'iv', 'V', 'i'], description: 'Minor Hip-Hop (i-iv-V-i)' },
    { chords: ['I', 'vi', 'ii', 'V'], description: 'Smooth Hip-Hop' },
    { chords: ['i', 'bVII', 'i', 'bVII'], description: 'Trap Style (i-bVII-i-bVII)' }
  ]
};

// Note mappings for different keys
const MAJOR_KEYS = {
  'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  'E': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
  'B': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
  'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
  'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
  'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
  'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
  'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
  'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C']
};

const MINOR_KEYS = {
  'A': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  'E': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
  'B': ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
  'F#': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
  'C#': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'],
  'G#': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
  'D#': ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#'],
  'D': ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'],
  'G': ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'],
  'C': ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
  'F': ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'],
  'Bb': ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab']
};

// Chord quality mappings for major keys
const MAJOR_CHORD_QUALITIES = {
  'I': 'maj', 'ii': 'min', 'iii': 'min', 'IV': 'maj', 'V': 'maj', 'vi': 'min', 'vii': 'dim',
  'IM7': 'maj7', 'ii7': 'min7', 'iii7': 'min7', 'IVM7': 'maj7', 'V7': '7', 'vi7': 'min7', 'vii7b5': 'm7b5'
};

// Chord quality mappings for minor keys
const MINOR_CHORD_QUALITIES = {
  'i': 'min', 'ii': 'dim', 'III': 'maj', 'iv': 'min', 'v': 'min', 'VI': 'maj', 'VII': 'maj',
  'bII': 'maj', 'bIII': 'maj', 'bVI': 'maj', 'bVII': 'maj'
};

function parseKey(keyString: string): { root: string, mode: 'major' | 'minor' } {
  const parts = keyString.trim().split(' ');
  const root = parts[0];
  const mode = parts[1]?.toLowerCase() === 'minor' ? 'minor' : 'major';
  return { root, mode };
}

function getRomanNumeralNote(romanNumeral: string, keyNotes: string[]): string {
  const romanToIndex: { [key: string]: number } = {
    'I': 0, 'i': 0, 'II': 1, 'ii': 1, 'III': 2, 'iii': 2, 'IV': 3, 'iv': 3,
    'V': 4, 'v': 4, 'VI': 5, 'vi': 5, 'VII': 6, 'vii': 6,
    'bII': 1, 'bIII': 2, 'bVI': 5, 'bVII': 6
  };

  // Handle complex roman numerals (like IM7, ii7, etc.)
  let baseRoman = romanNumeral.replace(/7|M7|m7|b5|maj|min|dim/g, '');
  
  // Handle flat modifications
  let noteIndex = romanToIndex[baseRoman];
  if (baseRoman.startsWith('b')) {
    baseRoman = baseRoman.substring(1);
    noteIndex = romanToIndex[baseRoman];
    if (noteIndex !== undefined) {
      noteIndex = (noteIndex - 1 + 7) % 7; // Flatten the note
    }
  }

  if (noteIndex !== undefined) {
    return keyNotes[noteIndex];
  }
  
  return keyNotes[0]; // Fallback to root
}

function getChordSuffix(romanNumeral: string, mode: 'major' | 'minor'): string {
  const qualities = mode === 'major' ? MAJOR_CHORD_QUALITIES : MINOR_CHORD_QUALITIES;
  
  // Check for exact match first
  if (romanNumeral in qualities) {
    return qualities[romanNumeral as keyof typeof qualities];
  }
  
  // Handle complex roman numerals
  if (romanNumeral.includes('7')) {
    if (romanNumeral.includes('M7')) return 'maj7';
    if (romanNumeral.includes('m7')) return 'min7';
    if (romanNumeral.includes('7b5')) return 'm7b5';
    return '7';
  }
  
  // Default based on case
  if (romanNumeral === romanNumeral.toLowerCase()) {
    return 'min';
  } else {
    return 'maj';
  }
}

export function generateChordProgression(keyString: string, genre: string = 'pop'): ChordProgression {
  const { root, mode } = parseKey(keyString);
  
  // Get appropriate key notes
  const keyNotes = mode === 'major' ? MAJOR_KEYS[root as keyof typeof MAJOR_KEYS] : MINOR_KEYS[root as keyof typeof MINOR_KEYS];
  if (!keyNotes) {
    throw new Error(`Unsupported key: ${keyString}`);
  }
  
  // Get progressions for genre
  const genreLower = genre.toLowerCase() as keyof typeof PROGRESSIONS;
  const genreProgressions = PROGRESSIONS[genreLower] || PROGRESSIONS.pop;
  
  // Select a random progression
  const randomIndex = Math.floor(Math.random() * genreProgressions.length);
  const selectedProgression = genreProgressions[randomIndex];
  
  // Convert roman numerals to actual chords
  const actualChords = selectedProgression.chords.map((romanNumeral: string) => {
    const note = getRomanNumeralNote(romanNumeral, keyNotes);
    const suffix = getChordSuffix(romanNumeral, mode);
    
    // Format chord name
    if (suffix === 'maj') return note;
    if (suffix === 'min') return note + 'm';
    if (suffix === 'dim') return note + 'dim';
    if (suffix === 'maj7') return note + 'maj7';
    if (suffix === 'min7') return note + 'm7';
    if (suffix === '7') return note + '7';
    if (suffix === 'm7b5') return note + 'm7b5';
    
    return note + suffix;
  });
  
  return {
    chords: actualChords,
    romanNumerals: selectedProgression.chords,
    description: `${selectedProgression.description} in ${keyString}`
  };
}

export function getRandomProgression(keyString: string, genre: string = 'pop'): string[] {
  const progression = generateChordProgression(keyString, genre);
  return progression.chords;
}

// Export for use in AI generation
export function getKeySpecificChordProgression(keyString: string, genre: string): string {
  const progression = generateChordProgression(keyString, genre);
  return progression.chords.join(' - ');
}
