// Smart Bass Generator using Music Theory (no AI needed!)
// This is what REAL bass generators like Bass Dragon do
// Each generation produces unique variations via controlled randomization

interface ChordInfo {
  chord: string;
  duration: number;
}

// Utility: random float in range
function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Utility: pick random element from array
function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Utility: humanize velocity (±15%)
function humanizeVelocity(base: number, spread = 0.15): number {
  return Math.max(0.1, Math.min(1.0, base * randRange(1 - spread, 1 + spread)));
}

// Utility: humanize timing (subtle swing)
function humanizeTiming(time: number, amount = 0.02): number {
  return Math.max(0, time + randRange(-amount, amount));
}

// Pool of common chord progressions for variety when no chords provided
export const DEFAULT_PROGRESSIONS: ChordInfo[][] = [
  [{ chord: 'C', duration: 4 }, { chord: 'G', duration: 4 }, { chord: 'Am', duration: 4 }, { chord: 'F', duration: 4 }],
  [{ chord: 'Am', duration: 4 }, { chord: 'F', duration: 4 }, { chord: 'C', duration: 4 }, { chord: 'G', duration: 4 }],
  [{ chord: 'Dm', duration: 4 }, { chord: 'G', duration: 4 }, { chord: 'C', duration: 4 }, { chord: 'A', duration: 4 }],
  [{ chord: 'Em', duration: 4 }, { chord: 'C', duration: 4 }, { chord: 'G', duration: 4 }, { chord: 'D', duration: 4 }],
  [{ chord: 'F', duration: 4 }, { chord: 'Am', duration: 4 }, { chord: 'G', duration: 4 }, { chord: 'C', duration: 4 }],
  [{ chord: 'Cm', duration: 4 }, { chord: 'Ab', duration: 4 }, { chord: 'Eb', duration: 4 }, { chord: 'Bb', duration: 4 }],
  [{ chord: 'G', duration: 4 }, { chord: 'Em', duration: 4 }, { chord: 'C', duration: 4 }, { chord: 'D', duration: 4 }],
  [{ chord: 'A', duration: 4 }, { chord: 'E', duration: 4 }, { chord: 'F#m', duration: 4 }, { chord: 'D', duration: 4 }],
  [{ chord: 'Bb', duration: 4 }, { chord: 'F', duration: 4 }, { chord: 'Gm', duration: 4 }, { chord: 'Eb', duration: 4 }],
  [{ chord: 'D', duration: 4 }, { chord: 'Bm', duration: 4 }, { chord: 'G', duration: 4 }, { chord: 'A', duration: 4 }],
];

interface BassNote {
  note: string;
  octave: number;
  start: number;
  duration: number;
  velocity: number;
  glide: number;
}

// Parse chord to get root note and quality
function parseChord(chordName: string): { root: string; quality: string } {
  // Remove slash chords (C/E -> C)
  const baseChord = chordName.split('/')[0].trim();
  
  // Extract root note (C, C#, Db, etc.)
  const rootMatch = baseChord.match(/^([A-G][#b]?)/);
  if (!rootMatch) return { root: 'C', quality: 'major' };
  
  const root = rootMatch[1];
  const remainder = baseChord.slice(root.length);
  
  // Determine quality
  let quality = 'major';
  if (remainder.includes('m') && !remainder.includes('maj')) {
    quality = 'minor';
  } else if (remainder.includes('dim')) {
    quality = 'diminished';
  } else if (remainder.includes('aug')) {
    quality = 'augmented';
  }
  
  return { root, quality };
}

// Get scale intervals for chord quality
function getChordTones(quality: string): number[] {
  const intervals: Record<string, number[]> = {
    major: [0, 4, 7], // Root, 3rd, 5th
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
  };
  return intervals[quality] || intervals.major;
}

// Convert note name to MIDI number
function noteToMidi(note: string, octave: number): number {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  return (octave + 1) * 12 + (noteMap[note] || 0);
}

// Convert MIDI number back to note
function midiToNote(midi: number): { note: string; octave: number } {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = noteNames[midi % 12];
  return { note, octave };
}

// Generate root notes only pattern — with random ghost notes and octave jumps
function generateRootPattern(
  chords: ChordInfo[],
  octave: number,
  noteLength: number,
  velocity: number
): BassNote[] {
  const bassNotes: BassNote[] = [];
  let currentTime = 0;

  chords.forEach(chord => {
    const { root } = parseChord(chord.chord);
    const noteDuration = chord.duration * noteLength;
    // Randomly drop an octave for emphasis (~20% chance)
    const oct = Math.random() < 0.2 ? octave - 1 : octave;
    
    bassNotes.push({
      note: root,
      octave: oct,
      start: humanizeTiming(currentTime),
      duration: noteDuration * randRange(0.85, 1.0),
      velocity: humanizeVelocity(velocity),
      glide: 0
    });

    // ~40% chance to add a ghost note (short, quiet) at the halfway point
    if (Math.random() < 0.4) {
      bassNotes.push({
        note: root,
        octave,
        start: humanizeTiming(currentTime + chord.duration * 0.5),
        duration: noteDuration * 0.3,
        velocity: humanizeVelocity(velocity * 0.4),
        glide: 0
      });
    }
    
    currentTime += chord.duration;
  });

  return bassNotes;
}

// Generate root + fifth pattern — with random inversions and passing tones
function generateRootFifthPattern(
  chords: ChordInfo[],
  octave: number,
  noteLength: number,
  velocity: number
): BassNote[] {
  const bassNotes: BassNote[] = [];
  let currentTime = 0;

  chords.forEach(chord => {
    const { root, quality } = parseChord(chord.chord);
    const rootMidi = noteToMidi(root, octave);
    const fifthMidi = rootMidi + 7;
    
    const halfDuration = chord.duration / 2;
    const noteDuration = halfDuration * noteLength;
    
    // Randomly choose: root-fifth, fifth-root, or root-third (~15% each variation)
    const variation = Math.random();
    let firstMidi = rootMidi;
    let secondMidi = fifthMidi;
    if (variation < 0.15) {
      // Invert: fifth first, then root
      firstMidi = fifthMidi;
      secondMidi = rootMidi;
    } else if (variation < 0.30) {
      // Use third instead of fifth
      secondMidi = rootMidi + (quality === 'minor' ? 3 : 4);
    }
    
    const note1 = midiToNote(firstMidi);
    bassNotes.push({
      note: note1.note,
      octave: note1.octave,
      start: humanizeTiming(currentTime),
      duration: noteDuration * randRange(0.85, 1.0),
      velocity: humanizeVelocity(velocity),
      glide: 0
    });
    
    const note2 = midiToNote(secondMidi);
    bassNotes.push({
      note: note2.note,
      octave: note2.octave,
      start: humanizeTiming(currentTime + halfDuration),
      duration: noteDuration * randRange(0.85, 1.0),
      velocity: humanizeVelocity(velocity * 0.9),
      glide: 0
    });

    // ~25% chance to add a passing tone before the second note
    if (Math.random() < 0.25) {
      const passingMidi = firstMidi + randPick([2, 3, 5]);
      const passingNote = midiToNote(passingMidi);
      bassNotes.push({
        note: passingNote.note,
        octave: passingNote.octave,
        start: humanizeTiming(currentTime + halfDuration * 0.75),
        duration: noteDuration * 0.25,
        velocity: humanizeVelocity(velocity * 0.5),
        glide: 0
      });
    }
    
    currentTime += chord.duration;
  });

  return bassNotes;
}

// Generate walking bass pattern — with randomized step choices and approach notes
function generateWalkingBass(
  chords: ChordInfo[],
  octave: number,
  noteLength: number,
  velocity: number
): BassNote[] {
  const bassNotes: BassNote[] = [];
  let currentTime = 0;

  for (let i = 0; i < chords.length; i++) {
    const chord = chords[i];
    const { root, quality } = parseChord(chord.chord);
    const currentMidi = noteToMidi(root, octave);
    const thirdInterval = quality === 'minor' ? 3 : 4;
    
    const nextChord = chords[i + 1];
    const nextMidi = nextChord ? noteToMidi(parseChord(nextChord.chord).root, octave) : currentMidi;
    
    const stepsPerChord = 4;
    const stepDuration = chord.duration / stepsPerChord;
    const noteDuration = stepDuration * noteLength;
    
    // Step 1: Always root
    const note1 = midiToNote(currentMidi);
    bassNotes.push({
      note: note1.note,
      octave: note1.octave,
      start: humanizeTiming(currentTime),
      duration: noteDuration * randRange(0.8, 1.0),
      velocity: humanizeVelocity(velocity),
      glide: 0
    });
    
    // Step 2: Randomly choose between 3rd, 5th, or scale tone
    const step2Choices = [thirdInterval, 5, 7, 2];
    const step2Interval = randPick(step2Choices);
    const note2 = midiToNote(currentMidi + step2Interval);
    bassNotes.push({
      note: note2.note,
      octave: note2.octave,
      start: humanizeTiming(currentTime + stepDuration),
      duration: noteDuration * randRange(0.8, 1.0),
      velocity: humanizeVelocity(velocity * 0.95),
      glide: 0
    });
    
    // Step 3: Randomly choose between 5th, octave, or 6th
    const step3Choices = [7, 12, 9, 5];
    const step3Interval = randPick(step3Choices);
    const note3 = midiToNote(currentMidi + step3Interval);
    bassNotes.push({
      note: note3.note,
      octave: note3.octave,
      start: humanizeTiming(currentTime + stepDuration * 2),
      duration: noteDuration * randRange(0.8, 1.0),
      velocity: humanizeVelocity(velocity * 0.9),
      glide: 0
    });
    
    // Step 4: Chromatic or diatonic approach to next chord (randomized)
    let approachMidi: number;
    if (Math.random() < 0.5) {
      // Chromatic approach (half step)
      approachMidi = nextMidi > currentMidi ? nextMidi - 1 : nextMidi + 1;
    } else {
      // Diatonic approach (whole step)
      approachMidi = nextMidi > currentMidi ? nextMidi - 2 : nextMidi + 2;
    }
    const note4 = midiToNote(approachMidi);
    bassNotes.push({
      note: note4.note,
      octave: note4.octave,
      start: humanizeTiming(currentTime + stepDuration * 3),
      duration: noteDuration * randRange(0.8, 1.0),
      velocity: humanizeVelocity(velocity * 0.85),
      glide: 0
    });
    
    currentTime += chord.duration;
  }

  return bassNotes;
}

// Generate arpeggio pattern — with random direction, added 7ths, and octave shifts
function generateArpeggioPattern(
  chords: ChordInfo[],
  octave: number,
  noteLength: number,
  velocity: number
): BassNote[] {
  const bassNotes: BassNote[] = [];
  let currentTime = 0;

  chords.forEach(chord => {
    const { root, quality } = parseChord(chord.chord);
    const rootMidi = noteToMidi(root, octave);
    let intervals = [...getChordTones(quality)];
    
    // ~30% chance to add a 7th to the arpeggio
    if (Math.random() < 0.3) {
      intervals.push(quality === 'major' ? 11 : 10); // maj7 or b7
    }
    
    // Randomly choose arpeggio direction
    const direction = Math.random();
    if (direction < 0.33) {
      // Descending
      intervals = intervals.reverse();
    } else if (direction < 0.5) {
      // Up then down
      intervals = [...intervals, ...intervals.slice(0, -1).reverse()];
    }
    
    const notesPerChord = intervals.length;
    const stepDuration = chord.duration / notesPerChord;
    const noteDuration = stepDuration * noteLength;
    
    intervals.forEach((interval, index) => {
      const midi = rootMidi + interval;
      const note = midiToNote(midi);
      
      bassNotes.push({
        note: note.note,
        octave: note.octave,
        start: humanizeTiming(currentTime + (stepDuration * index)),
        duration: noteDuration * randRange(0.8, 1.0),
        velocity: humanizeVelocity(velocity * (1 - index * 0.05)),
        glide: 0
      });
    });
    
    currentTime += chord.duration;
  });

  return bassNotes;
}

// Rhythmic pattern templates — randomly selected each generation
const RHYTHM_PATTERNS = [
  // Classic syncopated
  [{ offset: 0, duration: 0.25, vel: 1.0 }, { offset: 0.375, duration: 0.125, vel: 0.7 }, { offset: 0.75, duration: 0.25, vel: 0.9 }, { offset: 1.125, duration: 0.125, vel: 0.6 }],
  // Driving eighths
  [{ offset: 0, duration: 0.2, vel: 1.0 }, { offset: 0.25, duration: 0.15, vel: 0.6 }, { offset: 0.5, duration: 0.2, vel: 0.85 }, { offset: 0.75, duration: 0.15, vel: 0.55 }],
  // Dotted feel
  [{ offset: 0, duration: 0.375, vel: 1.0 }, { offset: 0.5, duration: 0.125, vel: 0.5 }, { offset: 0.75, duration: 0.375, vel: 0.9 }],
  // Reggae offbeat
  [{ offset: 0.25, duration: 0.2, vel: 0.9 }, { offset: 0.75, duration: 0.2, vel: 0.85 }, { offset: 1.25, duration: 0.2, vel: 0.8 }],
  // Funk staccato
  [{ offset: 0, duration: 0.1, vel: 1.0 }, { offset: 0.25, duration: 0.1, vel: 0.5 }, { offset: 0.5, duration: 0.15, vel: 0.9 }, { offset: 0.625, duration: 0.1, vel: 0.4 }, { offset: 0.875, duration: 0.1, vel: 0.7 }],
  // Half-time
  [{ offset: 0, duration: 0.5, vel: 1.0 }, { offset: 1.0, duration: 0.25, vel: 0.7 }],
];

// Generate rhythmic/syncopated pattern — randomly picks from pattern templates
function generateRhythmicPattern(
  chords: ChordInfo[],
  octave: number,
  noteLength: number,
  velocity: number,
  groove: number
): BassNote[] {
  const bassNotes: BassNote[] = [];
  let currentTime = 0;

  chords.forEach(chord => {
    const { root } = parseChord(chord.chord);
    const rootMidi = noteToMidi(root, octave);
    
    // Pick a random rhythm pattern for each chord
    const pattern = randPick(RHYTHM_PATTERNS);
    
    pattern.forEach(({ offset, duration, vel }) => {
      const adjustedOffset = offset * (1 + (groove - 0.5) * 0.3);
      const noteDuration = duration * noteLength * chord.duration;
      
      // ~20% chance to use the fifth instead of root for variety
      const useFifth = Math.random() < 0.2;
      const midi = useFifth ? rootMidi + 7 : rootMidi;
      const noteInfo = midiToNote(midi);
      
      bassNotes.push({
        note: noteInfo.note,
        octave: noteInfo.octave,
        start: humanizeTiming(currentTime + adjustedOffset),
        duration: noteDuration * randRange(0.85, 1.0),
        velocity: humanizeVelocity(velocity * vel),
        glide: 0
      });
    });
    
    currentTime += chord.duration;
  });

  return bassNotes;
}

// Main bass generation function
export function generateBassLine(
  chordProgression: ChordInfo[],
  style: string,
  pattern: string,
  octave: number,
  groove: number,
  noteLength: number,
  velocity: number,
  glide: number
): BassNote[] {
  let bassNotes: BassNote[] = [];

  // Generate pattern based on type
  switch (pattern) {
    case 'root':
      bassNotes = generateRootPattern(chordProgression, octave, noteLength, velocity);
      break;
    case 'root-fifth':
      bassNotes = generateRootFifthPattern(chordProgression, octave, noteLength, velocity);
      break;
    case 'walking':
      bassNotes = generateWalkingBass(chordProgression, octave, noteLength, velocity);
      break;
    case 'arpeggio':
      bassNotes = generateArpeggioPattern(chordProgression, octave, noteLength, velocity);
      break;
    case 'rhythmic':
      bassNotes = generateRhythmicPattern(chordProgression, octave, noteLength, velocity, groove);
      break;
    default:
      bassNotes = generateRootPattern(chordProgression, octave, noteLength, velocity);
  }

  // Apply glide to all notes if requested
  if (glide > 0) {
    bassNotes = bassNotes.map(note => ({ ...note, glide }));
  }

  return bassNotes;
}
