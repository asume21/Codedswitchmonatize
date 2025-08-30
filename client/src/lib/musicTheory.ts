// Advanced Music Theory Engine for Professional AI Composition

export interface ChordProgression {
  chords: string[];
  pattern: string;
  genre: string;
  tension: number[];
}

export interface VoiceLeading {
  smoothness: number;
  direction: "ascending" | "descending" | "static";
  intervals: number[];
}

export interface ArrangementRule {
  instrument: string;
  role: "melody" | "harmony" | "bass" | "percussion" | "texture";
  register: "high" | "mid" | "low";
  dynamics: number;
  articulation: string[];
}

// Professional Chord Progressions by Genre
export const CHORD_PROGRESSIONS = {
  jazz: [
    {
      chords: ["Cmaj7", "Am7", "Dm7", "G7"],
      pattern: "ii-V-I",
      genre: "jazz",
      tension: [0.2, 0.4, 0.8, 0.9],
    },
    {
      chords: ["Cmaj7", "C7", "Fmaj7", "F#dim7"],
      pattern: "I-V/IV-IV-#ivdim",
      genre: "jazz",
      tension: [0.1, 0.6, 0.3, 0.8],
    },
    {
      chords: ["Am7", "D7", "Gmaj7", "Cmaj7"],
      pattern: "vi-V/V-V-I",
      genre: "jazz",
      tension: [0.4, 0.8, 0.2, 0.1],
    },
  ],
  classical: [
    {
      chords: ["C", "F", "G", "C"],
      pattern: "I-IV-V-I",
      genre: "classical",
      tension: [0.1, 0.4, 0.9, 0.0],
    },
    {
      chords: ["Am", "F", "C", "G"],
      pattern: "vi-IV-I-V",
      genre: "classical",
      tension: [0.3, 0.4, 0.1, 0.8],
    },
    {
      chords: ["C", "Am", "F", "G"],
      pattern: "I-vi-IV-V",
      genre: "classical",
      tension: [0.1, 0.3, 0.4, 0.8],
    },
  ],
  pop: [
    {
      chords: ["C", "G", "Am", "F"],
      pattern: "I-V-vi-IV",
      genre: "pop",
      tension: [0.1, 0.5, 0.6, 0.4],
    },
    {
      chords: ["Am", "F", "C", "G"],
      pattern: "vi-IV-I-V",
      genre: "pop",
      tension: [0.4, 0.3, 0.1, 0.7],
    },
    {
      chords: ["F", "G", "Am", "Am"],
      pattern: "IV-V-vi-vi",
      genre: "pop",
      tension: [0.3, 0.8, 0.5, 0.4],
    },
  ],
  blues: [
    {
      chords: [
        "C7",
        "C7",
        "C7",
        "C7",
        "F7",
        "F7",
        "C7",
        "C7",
        "G7",
        "F7",
        "C7",
        "G7",
      ],
      pattern: "12-bar blues",
      genre: "blues",
      tension: [0.3, 0.3, 0.3, 0.3, 0.6, 0.6, 0.3, 0.3, 0.9, 0.6, 0.3, 0.8],
    },
    {
      chords: ["C7", "F7", "C7", "G7"],
      pattern: "blues turnaround",
      genre: "blues",
      tension: [0.3, 0.6, 0.3, 0.8],
    },
  ],
  funk: [
    {
      chords: ["Cm7", "Fm7", "Cm7", "Gm7"],
      pattern: "i-iv-i-v",
      genre: "funk",
      tension: [0.4, 0.5, 0.4, 0.7],
    },
    {
      chords: ["C7", "C7", "F7", "C7"],
      pattern: "funk vamp",
      genre: "funk",
      tension: [0.5, 0.5, 0.6, 0.5],
    },
  ],
  rock: [
    {
      chords: ["C5", "F5", "G5", "F5"],
      pattern: "I-IV-V-IV",
      genre: "rock",
      tension: [0.2, 0.4, 0.8, 0.4],
    },
    {
      chords: ["Am", "C", "F", "G"],
      pattern: "vi-I-IV-V",
      genre: "rock",
      tension: [0.5, 0.2, 0.3, 0.7],
    },
  ],
};

// Professional Voice Leading Rules
export const VOICE_LEADING_RULES = {
  smoothVoiceLeading: (chord1: string[], chord2: string[]) => {
    let smoothness = 0;
    const movements = chord1.map((note, i) => {
      const nextNote = chord2[i];
      if (!nextNote) return 12; // Large jump if voice disappears
      return Math.abs(noteToMidi(note) - noteToMidi(nextNote));
    });

    // Prefer step-wise motion (1-2 semitones)
    movements.forEach((movement) => {
      if (movement <= 2) smoothness += 0.3;
      else if (movement <= 4) smoothness += 0.1;
      else smoothness -= 0.2;
    });

    return Math.max(0, Math.min(1, smoothness));
  },

  avoidParallels: (chord1: string[], chord2: string[]) => {
    const intervals1 = getIntervals(chord1);
    const intervals2 = getIntervals(chord2);

    // Check for parallel fifths and octaves
    let violations = 0;
    intervals1.forEach((interval, i) => {
      if (intervals2[i] === interval && (interval === 7 || interval === 0)) {
        violations++;
      }
    });

    return violations === 0 ? 1 : 0.5; // Penalize but don't eliminate
  },
};

// Professional Orchestration Rules
export const ORCHESTRATION_RULES: ArrangementRule[] = [
  // Piano & Keys
  {
    instrument: "piano-grand",
    role: "harmony",
    register: "mid",
    dynamics: 0.7,
    articulation: ["legato", "staccato"],
  },
  {
    instrument: "piano-electric",
    role: "melody",
    register: "high",
    dynamics: 0.8,
    articulation: ["sustained", "percussive"],
  },

  // Strings
  {
    instrument: "strings-violin",
    role: "melody",
    register: "high",
    dynamics: 0.8,
    articulation: ["legato", "pizzicato", "tremolo"],
  },
  {
    instrument: "strings-viola",
    role: "harmony",
    register: "mid",
    dynamics: 0.6,
    articulation: ["legato", "staccato"],
  },
  {
    instrument: "strings-cello",
    role: "bass",
    register: "low",
    dynamics: 0.7,
    articulation: ["legato", "pizzicato"],
  },

  // Brass
  {
    instrument: "trumpet-bb",
    role: "melody",
    register: "high",
    dynamics: 0.9,
    articulation: ["staccato", "legato", "accent"],
  },
  {
    instrument: "horn-french",
    role: "harmony",
    register: "mid",
    dynamics: 0.6,
    articulation: ["legato", "stopped"],
  },
  {
    instrument: "trombone-tenor",
    role: "bass",
    register: "low",
    dynamics: 0.8,
    articulation: ["legato", "glissando"],
  },

  // Woodwinds
  {
    instrument: "flute-concert",
    role: "melody",
    register: "high",
    dynamics: 0.7,
    articulation: ["legato", "staccato", "flutter"],
  },
  {
    instrument: "clarinet-bb",
    role: "harmony",
    register: "mid",
    dynamics: 0.6,
    articulation: ["legato", "staccato"],
  },
  {
    instrument: "bassoon",
    role: "bass",
    register: "low",
    dynamics: 0.7,
    articulation: ["legato", "staccato"],
  },

  // Bass
  {
    instrument: "bass-electric",
    role: "bass",
    register: "low",
    dynamics: 0.8,
    articulation: ["fingered", "slap", "picked"],
  },
  {
    instrument: "bass-upright",
    role: "bass",
    register: "low",
    dynamics: 0.7,
    articulation: ["pizzicato", "arco"],
  },

  // Percussion
  {
    instrument: "timpani",
    role: "percussion",
    register: "low",
    dynamics: 0.9,
    articulation: ["roll", "accent"],
  },
  {
    instrument: "snare-drum",
    role: "percussion",
    register: "mid",
    dynamics: 0.8,
    articulation: ["roll", "flam", "accent"],
  },
];

// Advanced Song Structure Templates
export const SONG_STRUCTURES = {
  pop: {
    sections: [
      "intro",
      "verse",
      "chorus",
      "verse",
      "chorus",
      "bridge",
      "chorus",
      "outro",
    ],
    sectionLengths: [8, 16, 16, 16, 16, 8, 16, 8], // In bars
    dynamics: [0.3, 0.5, 0.8, 0.5, 0.8, 0.6, 0.9, 0.3],
    tempoChanges: [1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 1.1, 0.8], // Tempo multipliers
    keyChanges: ["I", "I", "I", "I", "I", "vi", "I", "I"], // Key centers
    instrumentation: {
      intro: ["piano", "pad", "ambient"],
      verse: ["piano", "bass", "drums-light", "acoustic-guitar"],
      chorus: ["full-band", "electric-guitar", "strings", "backing-vocals"],
      bridge: ["strings", "piano", "minimal-drums"],
      outro: ["piano", "pad", "reverb-tails"],
    },
    melodicFocus: {
      intro: "atmospheric",
      verse: "vocal-melody",
      chorus: "hook-melody",
      bridge: "instrumental-solo",
      outro: "fade-melody",
    },
  },
  jazz: {
    sections: ["head", "solo-1", "solo-2", "head"],
    dynamics: [0.6, 0.8, 0.9, 0.7],
    instrumentation: {
      head: ["piano", "bass", "drums"],
      "solo-1": ["featured-instrument", "piano", "bass", "drums"],
      "solo-2": ["piano-solo", "bass", "drums"],
    },
  },
  classical: {
    sections: ["exposition", "development", "recapitulation"],
    dynamics: [0.6, 0.9, 0.8],
    instrumentation: {
      exposition: ["strings", "woodwinds"],
      development: ["full-orchestra"],
      recapitulation: ["strings", "woodwinds", "brass"],
    },
  },
};

// Advanced Groove Patterns
export const GROOVE_PATTERNS = {
  straight: { swing: 0, humanization: 0.02 },
  swing: { swing: 0.67, humanization: 0.03 },
  shuffle: { swing: 0.75, humanization: 0.04 },
  latin: { swing: 0, humanization: 0.05, clave: true },
  funk: { swing: 0, humanization: 0.03, ghost_notes: true },
};

// Helper Functions
function noteToMidi(note: string): number {
  const noteMap: { [key: string]: number } = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11,
  };

  const noteName = note.replace(/\d+/, "");
  const octave = parseInt(note.replace(/[A-G]#?/, "")) || 4;

  return noteMap[noteName] + octave * 12;
}

function getIntervals(chord: string[]): number[] {
  if (chord.length < 2) return [];

  const intervals: number[] = [];
  for (let i = 1; i < chord.length; i++) {
    const interval = noteToMidi(chord[i]) - noteToMidi(chord[i - 1]);
    intervals.push(interval);
  }
  return intervals;
}

// AI Mood Parameters
export const MOOD_PARAMETERS = {
  happy: {
    majorMinor: "major",
    tempo: [120, 140],
    rhythm: "straight",
    dynamics: [0.6, 0.9],
    articulation: ["staccato", "accent"],
  },
  melancholy: {
    majorMinor: "minor",
    tempo: [60, 90],
    rhythm: "straight",
    dynamics: [0.3, 0.6],
    articulation: ["legato", "tenuto"],
  },
  energetic: {
    majorMinor: "major",
    tempo: [140, 180],
    rhythm: "funk",
    dynamics: [0.7, 1.0],
    articulation: ["accent", "staccato"],
  },
  chill: {
    majorMinor: "major",
    tempo: [70, 100],
    rhythm: "swing",
    dynamics: [0.4, 0.7],
    articulation: ["legato", "soft"],
  },
  dramatic: {
    majorMinor: "minor",
    tempo: [80, 120],
    rhythm: "straight",
    dynamics: [0.2, 1.0],
    articulation: ["accent", "tremolo"],
  },
};

// Professional Scale Analysis
export function analyzeScale(scaleName: string) {
  const scaleData = {
    "C Major": { modes: ["Ionian"], character: "bright, happy", tension: 0.1 },
    "A Minor": {
      modes: ["Aeolian"],
      character: "sad, contemplative",
      tension: 0.4,
    },
    "D Dorian": {
      modes: ["Dorian"],
      character: "jazzy, sophisticated",
      tension: 0.3,
    },
    "E Phrygian": {
      modes: ["Phrygian"],
      character: "dark, Spanish",
      tension: 0.7,
    },
    "F Lydian": {
      modes: ["Lydian"],
      character: "dreamy, floating",
      tension: 0.2,
    },
    "G Mixolydian": {
      modes: ["Mixolydian"],
      character: "bluesy, rockin",
      tension: 0.5,
    },
    "B Locrian": {
      modes: ["Locrian"],
      character: "unstable, mysterious",
      tension: 0.9,
    },
  };

  return (
    scaleData[scaleName as keyof typeof scaleData] || {
      modes: ["Unknown"],
      character: "neutral",
      tension: 0.5,
    }
  );
}

// Generate Professional Chord Progression
export function generateChordProgression(
  genre: string,
  complexity: number,
): ChordProgression {
  const progressions =
    CHORD_PROGRESSIONS[genre as keyof typeof CHORD_PROGRESSIONS] ||
    CHORD_PROGRESSIONS.pop;
  const baseProgression =
    progressions[Math.floor(Math.random() * progressions.length)];

  // Add sophistication based on complexity
  if (complexity > 7) {
    // Add jazz extensions and substitutions
    baseProgression.chords = baseProgression.chords.map((chord) => {
      if (Math.random() < 0.3) {
        return addJazzExtensions(chord);
      }
      return chord;
    });
  }

  return baseProgression;
}

function addJazzExtensions(chord: string): string {
  const extensions = ["maj7", "9", "11", "13", "sus2", "sus4", "add9"];
  if (Math.random() < 0.5) {
    const extension = extensions[Math.floor(Math.random() * extensions.length)];
    return chord.replace(/[0-9]/, "") + extension;
  }
  return chord;
}

export default {
  CHORD_PROGRESSIONS,
  VOICE_LEADING_RULES,
  ORCHESTRATION_RULES,
  SONG_STRUCTURES,
  GROOVE_PATTERNS,
  MOOD_PARAMETERS,
  analyzeScale,
  generateChordProgression,
};
