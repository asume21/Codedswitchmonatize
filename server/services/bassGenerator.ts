// Smart Bass Generator using Music Theory (no AI needed!)
// This is what REAL bass generators like Bass Dragon do

interface ChordInfo {
  chord: string;
  duration: number;
}

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

// Generate root notes only pattern
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
    
    bassNotes.push({
      note: root,
      octave,
      start: currentTime,
      duration: noteDuration,
      velocity,
      glide: 0
    });
    
    currentTime += chord.duration;
  });

  return bassNotes;
}

// Generate root + fifth pattern
function generateRootFifthPattern(
  chords: ChordInfo[],
  octave: number,
  noteLength: number,
  velocity: number
): BassNote[] {
  const bassNotes: BassNote[] = [];
  let currentTime = 0;

  chords.forEach(chord => {
    const { root } = parseChord(chord.chord);
    const rootMidi = noteToMidi(root, octave);
    const fifthMidi = rootMidi + 7; // Perfect fifth
    
    const halfDuration = chord.duration / 2;
    const noteDuration = halfDuration * noteLength;
    
    // Root note
    const rootNote = midiToNote(rootMidi);
    bassNotes.push({
      note: rootNote.note,
      octave: rootNote.octave,
      start: currentTime,
      duration: noteDuration,
      velocity,
      glide: 0
    });
    
    // Fifth
    const fifthNote = midiToNote(fifthMidi);
    bassNotes.push({
      note: fifthNote.note,
      octave: fifthNote.octave,
      start: currentTime + halfDuration,
      duration: noteDuration,
      velocity: velocity * 0.9, // Slightly quieter
      glide: 0
    });
    
    currentTime += chord.duration;
  });

  return bassNotes;
}

// Generate walking bass pattern
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
    const { root } = parseChord(chord.chord);
    const currentMidi = noteToMidi(root, octave);
    
    // Get next chord root for chromatic approach
    const nextChord = chords[i + 1];
    const nextMidi = nextChord ? noteToMidi(parseChord(nextChord.chord).root, octave) : currentMidi;
    
    const stepsPerChord = 4; // 4 quarter notes per chord
    const stepDuration = chord.duration / stepsPerChord;
    const noteDuration = stepDuration * noteLength;
    
    // Step 1: Root
    const note1 = midiToNote(currentMidi);
    bassNotes.push({
      note: note1.note,
      octave: note1.octave,
      start: currentTime,
      duration: noteDuration,
      velocity,
      glide: 0
    });
    
    // Step 2: Third
    const note2 = midiToNote(currentMidi + 4);
    bassNotes.push({
      note: note2.note,
      octave: note2.octave,
      start: currentTime + stepDuration,
      duration: noteDuration,
      velocity: velocity * 0.95,
      glide: 0
    });
    
    // Step 3: Fifth
    const note3 = midiToNote(currentMidi + 7);
    bassNotes.push({
      note: note3.note,
      octave: note3.octave,
      start: currentTime + stepDuration * 2,
      duration: noteDuration,
      velocity: velocity * 0.9,
      glide: 0
    });
    
    // Step 4: Chromatic approach to next chord
    const approachMidi = nextMidi > currentMidi ? nextMidi - 1 : nextMidi + 1;
    const note4 = midiToNote(approachMidi);
    bassNotes.push({
      note: note4.note,
      octave: note4.octave,
      start: currentTime + stepDuration * 3,
      duration: noteDuration,
      velocity: velocity * 0.85,
      glide: 0
    });
    
    currentTime += chord.duration;
  }

  return bassNotes;
}

// Generate arpeggio pattern
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
    const intervals = getChordTones(quality);
    
    const notesPerChord = intervals.length;
    const stepDuration = chord.duration / notesPerChord;
    const noteDuration = stepDuration * noteLength;
    
    intervals.forEach((interval, index) => {
      const midi = rootMidi + interval;
      const note = midiToNote(midi);
      
      bassNotes.push({
        note: note.note,
        octave: note.octave,
        start: currentTime + (stepDuration * index),
        duration: noteDuration,
        velocity: velocity * (1 - index * 0.1), // Slight dynamics
        glide: 0
      });
    });
    
    currentTime += chord.duration;
  });

  return bassNotes;
}

// Generate rhythmic/syncopated pattern
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
    
    // Syncopated rhythm: 1 & 2 & 3 & 4 &
    const pattern = [
      { offset: 0, duration: 0.25, vel: 1.0 },        // 1
      { offset: 0.375, duration: 0.125, vel: 0.7 },   // &
      { offset: 0.75, duration: 0.25, vel: 0.9 },     // 3
      { offset: 1.125, duration: 0.125, vel: 0.6 },   // &
    ];
    
    pattern.forEach(({ offset, duration, vel }) => {
      const adjustedOffset = offset * (1 + (groove - 0.5) * 0.3); // Apply groove
      const noteDuration = duration * noteLength * chord.duration;
      
      bassNotes.push({
        note: root,
        octave,
        start: currentTime + adjustedOffset,
        duration: noteDuration,
        velocity: velocity * vel,
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
