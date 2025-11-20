import { Note, NoteEvent, DrumPattern } from '../../../shared/studioTypes';

/**
 * Convert server NoteEvent to client Note
 */
export function noteEventToNote(event: NoteEvent, stepSize: number = 0.25): Note {
  // Extract note and octave from pitch (e.g., "C4" -> {note: "C", octave: 4})
  const match = event.pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid pitch format: ${event.pitch}`);
  }
  
  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  
  return {
    id: event.id,
    note,
    octave,
    step: Math.round(event.start / stepSize),
    length: Math.max(1, Math.round(event.duration / stepSize)),
    velocity: Math.round((event.velocity / 127) * 100), // Convert 0-127 to 0-100
    trackId: event.trackId
  };
}

/**
 * Convert client Note to server NoteEvent
 */
export function noteToNoteEvent(note: Note, stepSize: number = 0.25): NoteEvent {
  return {
    id: note.id,
    pitch: `${note.note}${note.octave}`,
    start: note.step * stepSize,
    duration: note.length * stepSize,
    velocity: Math.round((note.velocity / 100) * 127), // Convert 0-100 to 0-127
    trackId: note.trackId || ''
  };
}

/**
 * Convert drum pattern to step grid format
 */
export function drumPatternToStepGrid(pattern: DrumPattern, steps: number = 16): number[][] {
  const lanes = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'tom', 'perc', 'crash'] as const;
  return lanes.map(lane => {
    const lanePattern = pattern[lane] || [];
    // Ensure the pattern has the correct number of steps
    return Array.from({ length: steps }, (_, i) => lanePattern[i] || 0);
  });
}

/**
 * Convert step grid to drum pattern
 */
export function stepGridToDrumPattern(
  grid: number[][], 
  steps: number = 16
): DrumPattern {
  const lanes = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'tom', 'perc', 'crash'] as const;
  const pattern: Partial<DrumPattern> = {};
  
  lanes.forEach((lane, i) => {
    if (grid[i]) {
      pattern[lane] = grid[i].slice(0, steps).map(step => step > 0 ? 1 : 0);
    } else {
      pattern[lane] = Array(steps).fill(0);
    }
  });
  
  return pattern as DrumPattern;
}

/**
 * Generate a human-readable label for AI-generated content
 */
export function generateAILabel(type: string, seed?: string, prompt?: string): string {
  const typeMap: Record<string, string> = {
    'melody': 'Melody',
    'drum': 'Drum Beat',
    'bass': 'Bassline',
    'chord': 'Chord Progression',
    'lyric': 'Lyrics',
    'arrangement': 'Arrangement',
    'mastering': 'Mastering',
  };
  
  const typeName = typeMap[type.toLowerCase()] || type;
  const seedSuffix = seed ? ` (seed: ${seed.slice(0, 6)})` : '';
  const promptSuffix = prompt ? ` - ${prompt.slice(0, 20)}${prompt.length > 20 ? '...' : ''}` : '';
  
  return `${typeName}${seedSuffix}${promptSuffix}`;
}

/**
 * Calculate the duration in seconds based on BPM and number of steps
 */
export function calculateDuration(bpm: number, steps: number, stepsPerBeat: number = 4): number {
  const beats = steps / stepsPerBeat;
  return (beats * 60) / bpm;
}

/**
 * Generate a unique ID for tracks, clips, notes, etc.
 */
export function generateId(prefix: string = 'item'): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}
