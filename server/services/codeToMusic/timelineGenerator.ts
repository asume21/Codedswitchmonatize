/**
 * Timeline Generator - Convert code elements to musical timeline
 * Assigns timestamps and durations to create a playable sequence
 */

import type { ParsedCode, CodeElement, TimelineEvent, ChordProgression, MelodyNote } from '../../../shared/types/codeToMusic';
import { getChordsForGenre, getChordByIndex } from './chordDefinitions';
import { mapElementToNoteIntelligent, calculateNoteDuration, calculateNoteVelocity, selectInstrument } from './noteMapping';

/**
 * Generate timeline from parsed code
 * Divides code into 4 sections (one per chord)
 */
export function generateTimeline(
  parsedCode: ParsedCode,
  genre: string,
  bpm: number,
  variation: number = 0
): {
  timeline: TimelineEvent[];
  chords: ChordProgression[];
  melody: MelodyNote[];
} {
  const elements = parsedCode.elements;
  
  if (elements.length === 0) {
    return { timeline: [], chords: [], melody: [] };
  }
  
  // Calculate total duration (aim for 16-32 seconds)
  const secondsPerElement = 0.5;
  const totalDuration = Math.max(16, Math.min(32, elements.length * secondsPerElement));
  
  // Divide into 4 sections (one per chord)
  const elementsPerSection = Math.ceil(elements.length / 4);
  const secondsPerChord = totalDuration / 4;
  
  const timeline: TimelineEvent[] = [];
  const chords: ChordProgression[] = [];
  const melody: MelodyNote[] = [];
  
  let currentTime = 0;
  
  // Generate chord progression (4 chords, repeating if needed)
  for (let chordIndex = 0; chordIndex < 4; chordIndex++) {
    const chord = getChordByIndex(genre, chordIndex);
    
    chords.push({
      chord: chord.name,
      notes: chord.notes,
      start: chordIndex * secondsPerChord,
      duration: secondsPerChord,
    });
  }
  
  // Generate melody from code elements
  elements.forEach((element, index) => {
    // Determine which chord we're in
    const chordIndex = Math.floor(index / elementsPerSection) % 4;
    const chord = getChordByIndex(genre, chordIndex);
    
    // Map element to note
    const note = mapElementToNoteIntelligent(element, chord, variation);
    const duration = calculateNoteDuration(element);
    const velocity = calculateNoteVelocity(element);
    const instrument = selectInstrument(element);
    
    // Add to melody
    melody.push({
      note,
      start: currentTime,
      duration,
      velocity,
      instrument,
      source: `${element.type}: ${element.name}`,
    });
    
    // Add to timeline
    timeline.push({
      time: currentTime,
      type: 'note',
      data: {
        note,
        duration,
        velocity,
        instrument,
        chord: chord.name,
        element: element.type,
      },
      source: `Line ${element.line}: ${element.name}`,
    });
    
    currentTime += duration;
  });
  
  // Add chord events to timeline
  chords.forEach((chord, index) => {
    timeline.push({
      time: chord.start,
      type: 'chord',
      data: chord,
      source: `Chord ${index + 1}`,
    });
  });
  
  // Sort timeline by time
  timeline.sort((a, b) => a.time - b.time);
  
  return { timeline, chords, melody };
}

/**
 * Generate drum pattern based on code structure
 * Loops and rhythmic elements create drum hits
 */
export function generateDrumPattern(
  parsedCode: ParsedCode,
  bpm: number
): {
  kick: boolean[];
  snare: boolean[];
  hihat: boolean[];
} {
  // 16-step pattern (one bar)
  const pattern = {
    kick: Array(16).fill(false),
    snare: Array(16).fill(false),
    hihat: Array(16).fill(false),
  };
  
  // Count loops and conditionals for rhythm intensity
  const loops = parsedCode.elements.filter(e => e.type === 'loop').length;
  const conditionals = parsedCode.elements.filter(e => e.type === 'conditional').length;
  
  // Basic pattern: kick on 1 and 3, snare on 2 and 4
  pattern.kick[0] = true;
  pattern.kick[8] = true;
  pattern.snare[4] = true;
  pattern.snare[12] = true;
  
  // Add complexity based on loops
  if (loops > 0) {
    pattern.kick[2] = true;
    pattern.kick[10] = true;
  }
  
  if (loops > 2) {
    pattern.kick[6] = true;
    pattern.kick[14] = true;
  }
  
  // Hi-hats based on energy
  const hihatDensity = Math.min(16, 4 + loops * 2);
  for (let i = 0; i < hihatDensity; i++) {
    pattern.hihat[i] = true;
  }
  
  // Add variation based on conditionals
  if (conditionals > 0) {
    pattern.snare[2] = true;
    pattern.snare[10] = true;
  }
  
  return pattern;
}

/**
 * Calculate optimal BPM based on code characteristics
 */
export function calculateOptimalBPM(parsedCode: ParsedCode, genreBPM: number): number {
  const { complexity, mood } = parsedCode;
  
  let bpm = genreBPM;
  
  // Adjust based on mood
  if (mood === 'energetic') {
    bpm = Math.min(genreBPM + 20, 180);
  } else if (mood === 'sad') {
    bpm = Math.max(genreBPM - 20, 60);
  }
  
  // Adjust based on complexity
  if (complexity > 7) {
    bpm = Math.min(bpm + 10, 180);
  } else if (complexity < 3) {
    bpm = Math.max(bpm - 10, 60);
  }
  
  return Math.round(bpm);
}
