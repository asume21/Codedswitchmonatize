import { v4 as uuidv4 } from 'uuid';

// Types for Note, Track, and related interfaces
export interface Note {
  id: string;
  note: string;
  octave: number;
  step: number;
  velocity: number;
  length: number;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  notes: Note[];
  muted: boolean;
  volume: number;
  instrument: string;
}

export interface ChordProgression {
  id: string;
  name: string;
  chords: string[];
  key: string;
}

export interface PianoKey {
  note: string;
  octave: number;
  isBlack: boolean;
  key: string;
}

export interface KeyData {
  name: string;
  notes: string[];
  chords: {
    [key: string]: string[];
  };
}

// All available musical keys with their respective chords
export const DEFAULT_customKeys: Record<string, KeyData> = {
  'C': {
    name: 'C Major',
    notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    chords: {
      'I': ['C', 'E', 'G'],
      'ii': ['D', 'F', 'A'],
      'iii': ['E', 'G', 'B'],
      'IV': ['F', 'A', 'C'],
      'V': ['G', 'B', 'D'],
      'vi': ['A', 'C', 'E'],
      'vii°': ['B', 'D', 'F']
    }
  },
  'G': {
    name: 'G Major',
    notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    chords: {
      'I': ['G', 'B', 'D'],
      'ii': ['A', 'C', 'E'],
      'iii': ['B', 'D', 'F#'],
      'IV': ['C', 'E', 'G'],
      'V': ['D', 'F#', 'A'],
      'vi': ['E', 'G', 'B'],
      'vii°': ['F#', 'A', 'C']
    }
  },
  'D': {
    name: 'D Major',
    notes: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
    chords: {
      'I': ['D', 'F#', 'A'],
      'ii': ['E', 'G', 'B'],
      'iii': ['F#', 'A', 'C#'],
      'IV': ['G', 'B', 'D'],
      'V': ['A', 'C#', 'E'],
      'vi': ['B', 'D', 'F#'],
      'vii°': ['C#', 'E', 'G']
    }
  },
  'A': {
    name: 'A Major',
    notes: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
    chords: {
      'I': ['A', 'C#', 'E'],
      'ii': ['B', 'D', 'F#'],
      'iii': ['C#', 'E', 'G#'],
      'IV': ['D', 'F#', 'A'],
      'V': ['E', 'G#', 'B'],
      'vi': ['F#', 'A', 'C#'],
      'vii°': ['G#', 'B', 'D']
    }
  },
  'E': {
    name: 'E Major',
    notes: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
    chords: {
      'I': ['E', 'G#', 'B'],
      'ii': ['F#', 'A', 'C#'],
      'iii': ['G#', 'B', 'D#'],
      'IV': ['A', 'C#', 'E'],
      'V': ['B', 'D#', 'F#'],
      'vi': ['C#', 'E', 'G#'],
      'vii°': ['D#', 'F#', 'A']
    }
  },
  'B': {
    name: 'B Major',
    notes: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
    chords: {
      'I': ['B', 'D#', 'F#'],
      'ii': ['C#', 'E', 'G#'],
      'iii': ['D#', 'F#', 'A#'],
      'IV': ['E', 'G#', 'B'],
      'V': ['F#', 'A#', 'C#'],
      'vi': ['G#', 'B', 'D#'],
      'vii°': ['A#', 'C#', 'E']
    }
  },
  'F#': {
    name: 'F# Major',
    notes: ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
    chords: {
      'I': ['F#', 'A#', 'C#'],
      'ii': ['G#', 'B', 'D#'],
      'iii': ['A#', 'C#', 'E#'],
      'IV': ['B', 'D#', 'F#'],
      'V': ['C#', 'E#', 'G#'],
      'vi': ['D#', 'F#', 'A#'],
      'vii°': ['E#', 'G#', 'B']
    }
  },
  'C#': {
    name: 'C# Major',
    notes: ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
    chords: {
      'I': ['C#', 'E#', 'G#'],
      'ii': ['D#', 'F#', 'A#'],
      'iii': ['E#', 'G#', 'B#'],
      'IV': ['F#', 'A#', 'C#'],
      'V': ['G#', 'B#', 'D#'],
      'vi': ['A#', 'C#', 'E#'],
      'vii°': ['B#', 'D#', 'F#']
    }
  },
  'F': {
    name: 'F Major',
    notes: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    chords: {
      'I': ['F', 'A', 'C'],
      'ii': ['G', 'Bb', 'D'],
      'iii': ['A', 'C', 'E'],
      'IV': ['Bb', 'D', 'F'],
      'V': ['C', 'E', 'G'],
      'vi': ['D', 'F', 'A'],
      'vii°': ['E', 'G', 'Bb']
    }
  },
  'Bb': {
    name: 'Bb Major',
    notes: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
    chords: {
      'I': ['Bb', 'D', 'F'],
      'ii': ['C', 'Eb', 'G'],
      'iii': ['D', 'F', 'A'],
      'IV': ['Eb', 'G', 'Bb'],
      'V': ['F', 'A', 'C'],
      'vi': ['G', 'Bb', 'D'],
      'vii°': ['A', 'C', 'Eb']
    }
  },
  'Eb': {
    name: 'Eb Major',
    notes: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
    chords: {
      'I': ['Eb', 'G', 'Bb'],
      'ii': ['F', 'Ab', 'C'],
      'iii': ['G', 'Bb', 'D'],
      'IV': ['Ab', 'C', 'Eb'],
      'V': ['Bb', 'D', 'F'],
      'vi': ['C', 'Eb', 'G'],
      'vii°': ['D', 'F', 'Ab']
    }
  },
  'Ab': {
    name: 'Ab Major',
    notes: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
    chords: {
      'I': ['Ab', 'C', 'Eb'],
      'ii': ['Bb', 'Db', 'F'],
      'iii': ['C', 'Eb', 'G'],
      'IV': ['Db', 'F', 'Ab'],
      'V': ['Eb', 'G', 'Bb'],
      'vi': ['F', 'Ab', 'C'],
      'vii°': ['G', 'Bb', 'Db']
    }
  },
  'Db': {
    name: 'Db Major',
    notes: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
    chords: {
      'I': ['Db', 'F', 'Ab'],
      'ii': ['Eb', 'Gb', 'Bb'],
      'iii': ['F', 'Ab', 'C'],
      'IV': ['Gb', 'Bb', 'Db'],
      'V': ['Ab', 'C', 'Eb'],
      'vi': ['Bb', 'Db', 'F'],
      'vii°': ['C', 'Eb', 'Gb']
    }
  },
  'Gb': {
    name: 'Gb Major',
    notes: ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
    chords: {
      'I': ['Gb', 'Bb', 'Db'],
      'ii': ['Ab', 'Cb', 'Eb'],
      'iii': ['Bb', 'Db', 'F'],
      'IV': ['Cb', 'Eb', 'Gb'],
      'V': ['Db', 'F', 'Ab'],
      'vi': ['Eb', 'Gb', 'Bb'],
      'vii°': ['F', 'Ab', 'Cb']
    }
  },
  'Cb': {
    name: 'Cb Major',
    notes: ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
    chords: {
      'I': ['Cb', 'Eb', 'Gb'],
      'ii': ['Db', 'Fb', 'Ab'],
      'iii': ['Eb', 'Gb', 'Bb'],
      'IV': ['Fb', 'Ab', 'Cb'],
      'V': ['Gb', 'Bb', 'Db'],
      'vi': ['Ab', 'Cb', 'Eb'],
      'vii°': ['Bb', 'Db', 'Fb']
    }
  },
  'G#': {
    name: 'G# Minor',
    notes: ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
    chords: {
      'i': ['G#', 'B', 'D#'],
      'iio': ['A#', 'C#', 'E'],
      'III': ['B', 'D#', 'F#'],
      'iv': ['C#', 'E', 'G#'],
      'v': ['D#', 'F#', 'A#'],
      'VI': ['E', 'G#', 'B'],
      'VII': ['F#', 'A#', 'C#']
    }
  },
  'D#': {
    name: 'D# Minor',
    notes: ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#'],
    chords: {
      'i': ['D#', 'F#', 'A#'],
      'iio': ['E#', 'G#', 'B'],
      'III': ['F#', 'A#', 'C#'],
      'iv': ['G#', 'B', 'D#'],
      'v': ['A#', 'C#', 'E#'],
      'VI': ['B', 'D#', 'F#'],
      'VII': ['C#', 'E#', 'G#']
    }
  },
  'A#': {
    name: 'A# Minor',
    notes: ['A#', 'B#', 'C#', 'D#', 'E#', 'F#', 'G#'],
    chords: {
      'i': ['A#', 'C#', 'E#'],
      'iio': ['B#', 'D#', 'F#'],
      'III': ['C#', 'E#', 'G#'],
      'iv': ['D#', 'F#', 'A#'],
      'v': ['E#', 'G#', 'B#'],
      'VI': ['F#', 'A#', 'C#'],
      'VII': ['G#', 'B#', 'D#']
    }
  }
} as const;

export type KeyType = keyof typeof DEFAULT_customKeys;

// Constants
export const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'] as const;
export const STEPS = 32;
export const KEY_HEIGHT = 20;
export const STEP_WIDTH = 25;

// ALL AVAILABLE INSTRUMENTS
export const AVAILABLE_INSTRUMENTS = [
  // Pianos & Keys
  { value: 'piano', label: '🎹 Grand Piano', category: 'Piano' },
  { value: 'electric_piano_1', label: '🎹 Electric Piano 1', category: 'Piano' },
  { value: 'electric_piano_2', label: '🎹 Electric Piano 2', category: 'Piano' },
  { value: 'harpsichord', label: '🎹 Harpsichord', category: 'Piano' },
  { value: 'organ', label: '🎹 Organ', category: 'Piano' },
  
  // Bass
  { value: 'bass-electric', label: '🎸 Electric Bass (Finger)', category: 'Bass' },
  { value: 'electric_bass_pick', label: '🎸 Electric Bass (Pick)', category: 'Bass' },
  { value: 'bass-upright', label: '🎻 Acoustic Bass', category: 'Bass' },
  { value: 'bass-synth', label: '🎛️ Synth Bass 1', category: 'Bass' },
  { value: 'synth_bass_2', label: '🎛️ Synth Bass 2', category: 'Bass' },
  { value: 'fretless_bass', label: '🎸 Fretless Bass', category: 'Bass' },
  { value: 'slap_bass_1', label: '🎸 Slap Bass', category: 'Bass' },
  
  // Guitars
  { value: 'guitar-acoustic', label: '🎸 Acoustic Guitar (Steel)', category: 'Guitar' },
  { value: 'guitar-nylon', label: '🎸 Acoustic Guitar (Nylon)', category: 'Guitar' },
  { value: 'guitar-electric', label: '🎸 Electric Guitar (Clean)', category: 'Guitar' },
  { value: 'guitar-distorted', label: '🎸 Distortion Guitar', category: 'Guitar' },
  
  // Strings
  { value: 'strings-violin', label: '🎻 Violin', category: 'Strings' },
  { value: 'viola', label: '🎻 Viola', category: 'Strings' },
  { value: 'cello', label: '🎻 Cello', category: 'Strings' },
  { value: 'contrabass', label: '🎻 Contrabass', category: 'Strings' },
  { value: 'strings', label: '🎻 String Ensemble', category: 'Strings' },
  { value: 'orchestral_harp', label: '🎵 Orchestral Harp', category: 'Strings' },
  
  // Brass
  { value: 'trumpet', label: '🎺 Trumpet', category: 'Brass' },
  { value: 'trombone', label: '🎺 Trombone', category: 'Brass' },
  { value: 'french_horn', label: '🎺 French Horn', category: 'Brass' },
  
  // Woodwinds
  { value: 'flute', label: '🎵 Flute', category: 'Woodwinds' },
  { value: 'clarinet', label: '🎵 Clarinet', category: 'Woodwinds' },
  { value: 'tenor_sax', label: '🎷 Tenor Sax', category: 'Woodwinds' },
  
  // Synths
  { value: 'synth-analog', label: '🎛️ Analog Synth', category: 'Synth' },
  { value: 'leads-square', label: '🎛️ Square Lead', category: 'Synth' },
  { value: 'leads-saw', label: '🎛️ Sawtooth Lead', category: 'Synth' },
  { value: 'pads-warm', label: '🎛️ Warm Pad', category: 'Synth' },
  { value: 'pads-strings', label: '🎛️ String Pad', category: 'Synth' },
  { value: 'pads-choir', label: '🎛️ Choir Pad', category: 'Synth' },
  
  // Percussion
  { value: 'timpani', label: '🥁 Timpani', category: 'Percussion' },
  { value: 'taiko_drum', label: '🥁 Taiko Drum', category: 'Percussion' },
  { value: 'steel_drums', label: '🥁 Steel Drums', category: 'Percussion' },
  { value: 'woodblock', label: '🥁 Woodblock', category: 'Percussion' },
  
  // Special
  { value: 'choir_aahs', label: '👥 Choir Aahs', category: 'Vocal' },
  { value: 'synth_voice', label: '👥 Synth Voice', category: 'Vocal' },
];

// ----------------------------
// Helpers
// ----------------------------

/**
 * Convert note + octave to pitch string (e.g., "C#4")
 */
export function toPitch(note: string, octave: number): string {
  return `${note}${octave}`;
}

/**
 * Convert pitch string to { note, octave } object
 */
export function fromPitch(pitch: string): { note: string; octave: number } {
  const match = pitch.match(/^([A-G][b#]?)(\d+)$/);
  if (!match) throw new Error(`Invalid pitch: ${pitch}`);
  return { note: match[1], octave: parseInt(match[2], 10) };
}

/**
 * Convert beats to steps (16th notes)
 */
export function beatsToSteps(beats: number): number {
  return Math.round(beats * 4); // 4 steps per beat (16th notes)
}

/**
 * Convert steps to beats
 */
export function stepsToBeats(steps: number): number {
  return steps / 4;
}

/**
 * Convert bars to steps
 */
export function barsToSteps(bars: number): number {
  return bars * STEPS; // STEPS = 32 per 2 bars
}

/**
 * Create a new Note object
 */
export function makeNote(
  pitch: string,
  startBeats: number,
  durationBeats: number,
  velocity: number = 100
): Note {
  const { note, octave } = fromPitch(pitch);
  return {
    id: uuidv4(),
    note,
    octave,
    step: beatsToSteps(startBeats),
    velocity,
    length: beatsToSteps(durationBeats),
  };
}

/**
 * Generate AI clip/region name
 */
export function makeClipName(type: "Melody" | "Beat" | "Bass" | "Lyrics", seed: number): string {
  return `AI ${type} v1 (seed ${seed})`;
}
