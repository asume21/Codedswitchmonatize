/**
 * Advanced Code-to-Music Mapping Service
 * Translates programming structures into musical theory, arrangement, and timing.
 */

import { ParsedCode } from '../../../shared/types/codeToMusic';

export interface MusicalSection {
  name: string;           // Intro, Verse, Chorus, Bridge, Outro
  startTime: number;      // Seconds
  duration: number;       // Seconds
  intensity: number;      // 0 to 1
  layers: string[];       // drums, bass, leads, pads
  scaleMode: string;
}

export interface RhythmicProfile {
  baseNoteLength: number; // e.g., 0.25 (quarter), 0.5 (half)
  swing: number;          // 0 to 1 (humanization/groove)
  quantization: number;   // 1/4, 1/8, 1/16
  legato: number;         // 0 to 1 (how long notes held vs. space between them)
  syncopation: number;    // Likelihood of playing off-beat
}

export interface MusicalMapping {
  scaleMode: string;
  dissonanceLevel: number;
  rhythmicDensity: number;
  dynamicRange: number;
  energy: number;
  arrangement: MusicalSection[];
  rhythm: RhythmicProfile;
}

export interface TimingEvent {
  time: number;        // When to trigger (seconds)
  note: string;        // C4, D#5, etc.
  duration: number;    // How long to hold
  velocity: number;    // 0-1 volume
  instrument: string;  // Which synth/sample
  section: string;     // Which section this belongs to
}

/**
 * Maps code semantics to a structured musical piece with timing logic
 */
export function getMusicalMapping(parsedCode: ParsedCode): MusicalMapping {
  const complexity = parsedCode.complexity || 1;
  const mood = parsedCode.mood || 'neutral';
  
  // 1. Determine Scale Mode based on complexity
  let scaleMode = 'Ionian';
  if (complexity > 10) scaleMode = 'Locrian';
  else if (complexity > 7) scaleMode = 'Phrygian';
  else if (complexity > 5) scaleMode = 'Aeolian';
  else if (complexity > 3) scaleMode = 'Dorian';

  // 2. Map Timing & Length Logic
  const rhythm = generateRhythmicProfile(parsedCode);

  // 3. Generate Arrangement
  const arrangement = generateArrangement(parsedCode, scaleMode);

  return {
    scaleMode,
    dissonanceLevel: Math.min(1, complexity / 20),
    rhythmicDensity: Math.min(1, (parsedCode.elements.length / 50)),
    dynamicRange: mood === 'energetic' ? 0.9 : 0.4,
    energy: calculateEnergy(parsedCode),
    arrangement,
    rhythm
  };
}

/**
 * Timing Engine: Determines how long notes last and when they trigger.
 * Logic:
 * - High Indentation -> More syncopation (complex "nested" rhythms)
 * - Dense Code Lines -> Faster quantization (1/16 notes)
 * - Clean/Spaced Code -> Legato (long, flowing notes)
 */
function generateRhythmicProfile(parsedCode: ParsedCode): RhythmicProfile {
  const complexity = parsedCode.complexity || 1;
  
  // Calculate average indentation from actual code elements
  const avgIndentation = parsedCode.elements.length > 0
    ? parsedCode.elements.reduce((sum, e) => sum + (e.nestingLevel || 0), 0) / parsedCode.elements.length
    : 0;
  
  return {
    // Legato: Short "staccato" for high complexity logic, long for simple variables
    legato: Math.max(0.1, 1 - (complexity / 15)),
    
    // Quantization: Use 1/16 notes if code is dense, 1/8 if it's sparse
    quantization: parsedCode.elements.length > 20 ? 16 : 8,
    
    // Swing: Add a bit of "groove" if there are many functions (human logic)
    swing: Math.min(0.3, complexity / 50),
    
    // Base length influenced by mood
    baseNoteLength: parsedCode.mood === 'chill' ? 0.5 : 0.25,
    
    // Syncopation: Nested code (if/for) shifts notes off the main beat
    syncopation: Math.min(0.8, avgIndentation / 10)
  };
}

/**
 * Arrangement Engine:
 * Converts code blocks into a structured song timeline.
 */
function generateArrangement(parsedCode: ParsedCode, baseScale: string): MusicalSection[] {
  const sections: MusicalSection[] = [];
  let currentTime = 0;
  
  // Scale durations based on code size
  const scaleFactor = Math.max(0.5, Math.min(2, parsedCode.elements.length / 30));
  
  // Rule 1: Imports = Intro
  const setupElements = parsedCode.elements.filter(e => e.type === 'import' || e.type === 'variable');
  if (setupElements.length > 0) {
    const introDuration = Math.max(4, Math.min(12, setupElements.length * 0.5));
    sections.push({
      name: 'Intro',
      startTime: currentTime,
      duration: introDuration,
      intensity: 0.3,
      layers: ['pads', 'sub-bass'],
      scaleMode: baseScale
    });
    currentTime += introDuration;
  }

  // Rule 2: Logic = Verse
  const verseDuration = 16 * scaleFactor;
  sections.push({
    name: 'Verse',
    startTime: currentTime,
    duration: verseDuration,
    intensity: 0.5,
    layers: ['drums-minimal', 'bass', 'pluck-synth'],
    scaleMode: baseScale
  });
  currentTime += verseDuration;

  // Rule 3: High Complexity = Chorus
  const hasHighComplexity = parsedCode.complexity > 5;
  const chorusDuration = 16 * scaleFactor;
  sections.push({
    name: 'Chorus',
    startTime: currentTime,
    duration: chorusDuration,
    intensity: 0.9,
    layers: ['drums-full', 'bass-heavy', 'lead-synth', 'pads'],
    scaleMode: hasHighComplexity ? 'Lydian' : baseScale
  });
  currentTime += chorusDuration;

  // Rule 4: Logic Gates = Bridge
  if (parsedCode.elements.some(e => e.type === 'conditional')) {
    const bridgeDuration = 8 * scaleFactor;
    sections.push({
      name: 'Bridge',
      startTime: currentTime,
      duration: bridgeDuration,
      intensity: 0.7,
      layers: ['glitch-fx', 'bass-syncopated'],
      scaleMode: 'Phrygian'
    });
    currentTime += bridgeDuration;
  }

  // Rule 5: Final = Outro
  const outroDuration = Math.max(4, 8 * scaleFactor);
  sections.push({
    name: 'Outro',
    startTime: currentTime,
    duration: outroDuration,
    intensity: 0.2,
    layers: ['pads', 'piano-reverb'],
    scaleMode: baseScale
  });

  return sections;
}

/**
 * Convert arrangement + rhythm into actual playable timeline events
 */
export function generateTimeline(mapping: MusicalMapping, parsedCode: ParsedCode): TimingEvent[] {
  const events: TimingEvent[] = [];
  const scaleNotes = getScaleNotes(mapping.scaleMode);
  
  mapping.arrangement.forEach(section => {
    // Generate notes for this section based on rhythm profile
    const notesPerSection = Math.floor(section.duration / mapping.rhythm.baseNoteLength);
    
    for (let i = 0; i < notesPerSection; i++) {
      let time = section.startTime + (i * mapping.rhythm.baseNoteLength);
      
      // Apply syncopation (shift some notes off-beat)
      if (Math.random() < mapping.rhythm.syncopation) {
        time += mapping.rhythm.baseNoteLength * 0.25;
      }
      
      // Apply swing
      if (i % 2 === 1 && mapping.rhythm.swing > 0) {
        time += mapping.rhythm.baseNoteLength * mapping.rhythm.swing * 0.5;
      }
      
      // Pick note from scale based on section intensity
      const noteIndex = Math.floor((i + section.intensity * 7) % scaleNotes.length);
      const octave = section.intensity > 0.7 ? 5 : 4;
      
      // Generate event for each layer in the section
      section.layers.forEach((layer, layerIndex) => {
        events.push({
          time,
          note: `${scaleNotes[noteIndex]}${octave}`,
          duration: mapping.rhythm.baseNoteLength * mapping.rhythm.legato,
          velocity: section.intensity * (0.7 + Math.random() * 0.3),
          instrument: layer,
          section: section.name
        });
      });
    }
  });
  
  return events;
}

/**
 * Get notes for a given scale mode
 */
function getScaleNotes(mode: string): string[] {
  const scales: Record<string, string[]> = {
    'Ionian': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'Dorian': ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'],
    'Phrygian': ['C', 'Db', 'Eb', 'F', 'G', 'Ab', 'Bb'],
    'Lydian': ['C', 'D', 'E', 'F#', 'G', 'A', 'B'],
    'Aeolian': ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
    'Locrian': ['C', 'Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb']
  };
  return scales[mode] || scales['Ionian'];
}

/**
 * Map code element types to instrument names
 */
export function getInstrumentMapping(elementType: string): string {
  const mapping: Record<string, string> = {
    'function': 'analog-lead',   
    'variable': 'sine-pluck',  
    'loop': 'sequenced-arpeggio',      
    'conditional': 'fm-brass', 
    'comment': 'shimmer-pad',   
    'error': 'bitcrush-glitch',
    'class': 'warm-pad',
    'import': 'soft-piano'
  };
  return mapping[elementType] || 'clean-piano';
}

/**
 * Calculate energy level from code keywords
 */
function calculateEnergy(parsedCode: ParsedCode): number {
  const keywords = ['async', 'await', 'fetch', 'process', 'stream', 'socket', 'emit', 'event'];
  const count = parsedCode.elements.filter(e => 
    keywords.some(k => e.content.toLowerCase().includes(k))
  ).length;
  return Math.min(1, count / 8);
}
