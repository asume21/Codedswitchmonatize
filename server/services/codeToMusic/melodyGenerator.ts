/**
 * Advanced Melody Generator
 * Creates more musical, expressive melodies from code structure
 */

import type { CodeElement, ParsedCode, MelodyNote } from '../../../shared/types/codeToMusic';
import type { ChordDefinition } from './chordDefinitions';
import { hashString } from './noteMapping';

// Musical scales for different moods
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], // C D E F G A B
  minor: [0, 2, 3, 5, 7, 8, 10], // C D Eb F G Ab Bb
  pentatonicMajor: [0, 2, 4, 7, 9], // C D E G A
  pentatonicMinor: [0, 3, 5, 7, 10], // C Eb F G Bb
  blues: [0, 3, 5, 6, 7, 10], // C Eb F F# G Bb
  dorian: [0, 2, 3, 5, 7, 9, 10], // C D Eb F G A Bb (jazzy minor)
};

// Note names for conversion
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Rhythmic patterns (in beats, where 1 = quarter note)
const RHYTHM_PATTERNS = {
  simple: [1, 1, 1, 1],
  syncopated: [0.5, 0.5, 1, 0.5, 0.5, 1],
  driving: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  relaxed: [1.5, 0.5, 1, 1],
  triplet: [0.33, 0.33, 0.34, 0.33, 0.33, 0.34, 0.33, 0.33, 0.34],
  dotted: [0.75, 0.25, 0.75, 0.25, 1, 1],
  hiphop: [0.5, 0.25, 0.25, 0.5, 0.5, 0.5, 0.5, 0.5],
  edm: [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 0.25, 0.25, 0.25, 0.25],
};

// Melodic contour patterns (intervals from previous note)
const CONTOUR_PATTERNS = {
  ascending: [2, 2, 1, 2, -1, 2, 1],
  descending: [-2, -1, -2, -2, 1, -2, -1],
  wave: [2, 2, -1, -2, -2, 1, 2, 2, -1, -2],
  arch: [2, 3, 2, 1, -1, -2, -3, -2],
  pendulum: [3, -3, 2, -2, 4, -4, 1, -1],
  stepwise: [1, 1, -1, 1, -1, -1, 1, -1],
  leaps: [4, -3, 5, -4, 3, -5, 4, -3],
};

interface MelodyConfig {
  scale: number[];
  rootNote: number; // MIDI note number for root (e.g., 60 = C4)
  rhythmPattern: number[];
  contourPattern: number[];
  velocityRange: [number, number];
  octaveRange: [number, number];
}

/**
 * Get scale based on mood and genre
 */
export function getScaleForMood(mood: string, genre: string): number[] {
  if (genre === 'blues' || genre === 'rnb') {
    return mood === 'sad' ? SCALES.blues : SCALES.dorian;
  }
  if (genre === 'hiphop') {
    return mood === 'energetic' ? SCALES.pentatonicMinor : SCALES.minor;
  }
  if (mood === 'sad') return SCALES.minor;
  if (mood === 'energetic') return SCALES.pentatonicMajor;
  return SCALES.major;
}

/**
 * Get rhythm pattern based on genre and complexity
 */
export function getRhythmPattern(genre: string, complexity: number): number[] {
  if (genre === 'hiphop') return RHYTHM_PATTERNS.hiphop;
  if (genre === 'edm') return RHYTHM_PATTERNS.edm;
  if (genre === 'rock') return complexity > 5 ? RHYTHM_PATTERNS.driving : RHYTHM_PATTERNS.simple;
  if (genre === 'rnb') return RHYTHM_PATTERNS.syncopated;
  if (complexity > 7) return RHYTHM_PATTERNS.syncopated;
  if (complexity < 3) return RHYTHM_PATTERNS.relaxed;
  return RHYTHM_PATTERNS.simple;
}

/**
 * Get contour pattern based on code structure
 */
export function getContourPattern(parsedCode: ParsedCode): number[] {
  const stats = {
    functions: parsedCode.elements.filter(e => e.type === 'function').length,
    loops: parsedCode.elements.filter(e => e.type === 'loop').length,
    conditionals: parsedCode.elements.filter(e => e.type === 'conditional').length,
  };
  
  // More functions = more melodic variety (wave pattern)
  if (stats.functions > 5) return CONTOUR_PATTERNS.wave;
  // More loops = repetitive patterns (pendulum)
  if (stats.loops > 3) return CONTOUR_PATTERNS.pendulum;
  // More conditionals = dramatic changes (arch)
  if (stats.conditionals > 4) return CONTOUR_PATTERNS.arch;
  // Complex code = leaps
  if (parsedCode.complexity > 7) return CONTOUR_PATTERNS.leaps;
  // Simple code = stepwise
  if (parsedCode.complexity < 3) return CONTOUR_PATTERNS.stepwise;
  
  return CONTOUR_PATTERNS.ascending;
}

/**
 * Convert scale degree to MIDI note
 */
function scaleDegreeToMidi(degree: number, scale: number[], rootNote: number): number {
  const octaveOffset = Math.floor(degree / scale.length);
  const scaleIndex = ((degree % scale.length) + scale.length) % scale.length;
  return rootNote + scale[scaleIndex] + (octaveOffset * 12);
}

/**
 * Convert MIDI note to note name with octave
 */
function midiToNoteName(midi: number): string {
  const noteName = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
}

/**
 * Generate a melodic phrase from a code element
 */
export function generatePhraseFromElement(
  element: CodeElement,
  config: MelodyConfig,
  startTime: number,
  phraseIndex: number
): MelodyNote[] {
  const notes: MelodyNote[] = [];
  const hash = hashString(`${element.type}-${element.name}-${element.line}`);
  
  // Determine phrase length based on element type
  const phraseLengths: Record<string, number> = {
    'class': 8,
    'function': 6,
    'variable': 2,
    'loop': 4,
    'conditional': 3,
    'import': 1,
    'return': 2,
  };
  const phraseLength = phraseLengths[element.type] || 3;
  
  // Starting scale degree based on element
  let currentDegree = (hash % 7); // Start on a scale tone
  
  // Adjust starting degree based on element type for musical meaning
  const degreeOffsets: Record<string, number> = {
    'class': 0,      // Root - foundation
    'function': 2,   // 3rd - melodic
    'variable': 4,   // 5th - harmonic
    'loop': 0,       // Root - grounding
    'conditional': 3, // 4th - tension
    'import': 6,     // 7th - leading
    'return': 0,     // Root - resolution
  };
  currentDegree += degreeOffsets[element.type] || 0;
  
  let currentTime = startTime;
  
  for (let i = 0; i < phraseLength; i++) {
    // Get rhythm duration
    const rhythmIndex = (phraseIndex + i) % config.rhythmPattern.length;
    const duration = config.rhythmPattern[rhythmIndex] * (60 / 120); // Convert to seconds at 120 BPM base
    
    // Get contour movement
    const contourIndex = (hash + i) % config.contourPattern.length;
    const movement = config.contourPattern[contourIndex];
    
    // Apply movement (with some randomness based on hash)
    if (i > 0) {
      currentDegree += movement;
      // Keep within reasonable range
      while (currentDegree < -7) currentDegree += 7;
      while (currentDegree > 14) currentDegree -= 7;
    }
    
    // Convert to MIDI note
    const midiNote = scaleDegreeToMidi(currentDegree, config.scale, config.rootNote);
    
    // Clamp to octave range
    const minMidi = config.octaveRange[0] * 12 + 12;
    const maxMidi = config.octaveRange[1] * 12 + 12;
    const clampedMidi = Math.max(minMidi, Math.min(maxMidi, midiNote));
    
    // Calculate velocity based on position in phrase and element importance
    const baseVelocity = config.velocityRange[0];
    const velocityRange = config.velocityRange[1] - config.velocityRange[0];
    
    // First and last notes of phrase are emphasized
    const positionEmphasis = (i === 0 || i === phraseLength - 1) ? 1.2 : 1.0;
    // Downbeats are emphasized
    const beatEmphasis = (i % 2 === 0) ? 1.1 : 1.0;
    
    const velocity = Math.min(127, Math.round(
      baseVelocity + (velocityRange * 0.5 * positionEmphasis * beatEmphasis)
    ));
    
    // Select instrument based on element type
    const instrumentMap: Record<string, string> = {
      'class': 'piano',
      'function': 'synth',
      'variable': 'piano',
      'loop': 'bass',
      'conditional': 'synth',
      'import': 'piano',
      'return': 'piano',
    };
    
    notes.push({
      note: midiToNoteName(clampedMidi),
      start: currentTime,
      duration: duration * 0.9, // Slight gap between notes
      velocity,
      instrument: instrumentMap[element.type] || 'piano',
      source: `${element.type}: ${element.name}`,
    });
    
    currentTime += duration;
  }
  
  return notes;
}

/**
 * Generate bass line from chord progression
 */
export function generateBassLine(
  chords: { chord: string; notes: string[]; start: number; duration: number }[],
  parsedCode: ParsedCode,
  bpm: number
): MelodyNote[] {
  const bassNotes: MelodyNote[] = [];
  const beatDuration = 60 / bpm;
  
  // Bass pattern based on genre/complexity
  const isComplex = parsedCode.complexity > 5;
  const hasLoops = parsedCode.elements.filter(e => e.type === 'loop').length > 0;
  
  chords.forEach((chord, chordIndex) => {
    const rootNote = chord.notes[0]; // First note is root
    // Convert to bass octave (2 octaves down)
    const bassNote = rootNote.replace(/\d/, (m) => String(Math.max(1, parseInt(m) - 2)));
    
    const beatsInChord = Math.floor(chord.duration / beatDuration);
    
    for (let beat = 0; beat < beatsInChord; beat++) {
      const beatTime = chord.start + (beat * beatDuration);
      
      // Basic pattern: root on 1, fifth on 3 (if complex)
      if (beat === 0) {
        bassNotes.push({
          note: bassNote,
          start: beatTime,
          duration: beatDuration * 0.8,
          velocity: 100,
          instrument: 'bass',
          source: `Bass: ${chord.chord}`,
        });
      } else if (isComplex && beat === 2 && chord.notes.length > 2) {
        // Play fifth on beat 3
        const fifthNote = chord.notes[2].replace(/\d/, (m) => String(Math.max(1, parseInt(m) - 2)));
        bassNotes.push({
          note: fifthNote,
          start: beatTime,
          duration: beatDuration * 0.8,
          velocity: 85,
          instrument: 'bass',
          source: `Bass: ${chord.chord} (5th)`,
        });
      } else if (hasLoops && beat % 2 === 0) {
        // Eighth note pattern for loopy code
        bassNotes.push({
          note: bassNote,
          start: beatTime,
          duration: beatDuration * 0.4,
          velocity: 75,
          instrument: 'bass',
          source: `Bass: ${chord.chord}`,
        });
      }
    }
  });
  
  return bassNotes;
}

/**
 * Generate pad/harmony layer from chords
 */
export function generatePadLayer(
  chords: { chord: string; notes: string[]; start: number; duration: number }[],
  mood: string
): MelodyNote[] {
  const padNotes: MelodyNote[] = [];
  
  chords.forEach((chord) => {
    // Play all chord notes as a pad
    chord.notes.forEach((note, noteIndex) => {
      padNotes.push({
        note,
        start: chord.start,
        duration: chord.duration * 0.95,
        velocity: mood === 'energetic' ? 70 : 50, // Softer for calm moods
        instrument: 'pad',
        source: `Pad: ${chord.chord}`,
      });
    });
  });
  
  return padNotes;
}

/**
 * Add musical ornaments (grace notes, trills) based on code complexity
 */
export function addOrnaments(
  melody: MelodyNote[],
  complexity: number,
  scale: number[],
  rootNote: number
): MelodyNote[] {
  if (complexity < 5) return melody; // No ornaments for simple code
  
  const ornamentedMelody: MelodyNote[] = [];
  
  melody.forEach((note, index) => {
    // Add grace note before important notes (10% chance based on complexity)
    if (complexity > 7 && index > 0 && Math.random() < 0.1) {
      const graceNoteMidi = NOTE_NAMES.indexOf(note.note.replace(/\d/, ''));
      const graceMidi = graceNoteMidi > 0 ? graceNoteMidi - 1 : graceNoteMidi + 1;
      const graceOctave = parseInt(note.note.match(/\d/)?.[0] || '4');
      
      ornamentedMelody.push({
        note: `${NOTE_NAMES[graceMidi % 12]}${graceOctave}`,
        start: note.start - 0.05,
        duration: 0.05,
        velocity: note.velocity * 0.7,
        instrument: note.instrument,
        source: `Grace: ${note.source}`,
      });
    }
    
    ornamentedMelody.push(note);
  });
  
  return ornamentedMelody;
}

/**
 * Main melody generation function
 */
export function generateAdvancedMelody(
  parsedCode: ParsedCode,
  chords: { chord: string; notes: string[]; start: number; duration: number }[],
  genre: string,
  bpm: number,
  variation: number = 0
): {
  melody: MelodyNote[];
  bass: MelodyNote[];
  pads: MelodyNote[];
} {
  const scale = getScaleForMood(parsedCode.mood || 'neutral', genre);
  const rhythmPattern = getRhythmPattern(genre, parsedCode.complexity);
  const contourPattern = getContourPattern(parsedCode);
  
  // Root note based on key (default C4 = 60)
  const rootNote = 60 + (variation % 12); // Transpose based on variation
  
  const config: MelodyConfig = {
    scale,
    rootNote,
    rhythmPattern,
    contourPattern,
    velocityRange: [70, 110],
    octaveRange: [3, 6],
  };
  
  // Generate melody from code elements
  let melody: MelodyNote[] = [];
  let currentTime = 0;
  const beatDuration = 60 / bpm;
  
  parsedCode.elements.forEach((element, index) => {
    // Align to chord boundaries for musicality
    const chordIndex = Math.floor(currentTime / (beatDuration * 4)) % chords.length;
    
    const phrase = generatePhraseFromElement(element, config, currentTime, index);
    melody = melody.concat(phrase);
    
    // Move time forward
    const phraseDuration = phrase.reduce((sum, n) => sum + n.duration, 0);
    currentTime += phraseDuration + (beatDuration * 0.5); // Small gap between phrases
  });
  
  // Add ornaments for complex code
  melody = addOrnaments(melody, parsedCode.complexity, scale, rootNote);
  
  // Generate bass line
  const bass = generateBassLine(chords, parsedCode, bpm);
  
  // Generate pad layer
  const pads = generatePadLayer(chords, parsedCode.mood || 'neutral');
  
  return { melody, bass, pads };
}
