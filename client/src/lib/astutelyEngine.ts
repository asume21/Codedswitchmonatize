// client/src/lib/astutelyEngine.ts
// ASTUTELY - The AI that makes beats legendary

import { realisticAudio } from './realisticAudio';

// Style-specific configurations
const STYLE_CONFIGS: Record<string, {
  bpm: number;
  key: string;
  scale: string;
  drumPattern: string;
  bassStyle: string;
  chordVoicing: string;
}> = {
  "Travis Scott rage": { bpm: 150, key: 'C', scale: 'minor', drumPattern: 'trap-hard', bassStyle: '808-slide', chordVoicing: 'dark-pad' },
  "The Weeknd dark": { bpm: 108, key: 'Ab', scale: 'minor', drumPattern: 'rnb-minimal', bassStyle: 'sub-bass', chordVoicing: 'synth-wave' },
  "Drake smooth": { bpm: 130, key: 'G', scale: 'minor', drumPattern: 'trap-bounce', bassStyle: '808-melodic', chordVoicing: 'piano-chords' },
  "K-pop cute": { bpm: 128, key: 'C', scale: 'major', drumPattern: 'pop-punchy', bassStyle: 'synth-bass', chordVoicing: 'bright-synth' },
  "Phonk drift": { bpm: 140, key: 'E', scale: 'minor', drumPattern: 'phonk-cowbell', bassStyle: '808-distort', chordVoicing: 'memphis' },
  "Future bass": { bpm: 150, key: 'F', scale: 'major', drumPattern: 'edm-drop', bassStyle: 'wobble', chordVoicing: 'supersaws' },
  "Lo-fi chill": { bpm: 85, key: 'D', scale: 'minor', drumPattern: 'lofi-dusty', bassStyle: 'upright', chordVoicing: 'jazz-rhodes' },
  "Hyperpop glitch": { bpm: 160, key: 'A', scale: 'major', drumPattern: 'glitch-stutter', bassStyle: 'distort-bass', chordVoicing: 'detuned' },
  "Afrobeats bounce": { bpm: 108, key: 'G', scale: 'major', drumPattern: 'afro-log', bassStyle: 'afro-bass', chordVoicing: 'guitar-stabs' },
  "Latin trap": { bpm: 95, key: 'A', scale: 'minor', drumPattern: 'dembow', bassStyle: '808-latin', chordVoicing: 'reggaeton' },
};

// Note mappings
const NOTES: Record<string, number> = {
  'C': 60, 'C#': 61, 'Db': 61, 'D': 62, 'D#': 63, 'Eb': 63,
  'E': 64, 'F': 65, 'F#': 66, 'Gb': 66, 'G': 67, 'G#': 68,
  'Ab': 68, 'A': 69, 'A#': 70, 'Bb': 70, 'B': 71
};

// Scale intervals
const SCALES: Record<string, number[]> = {
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'major': [0, 2, 4, 5, 7, 9, 11],
};

// Drum patterns (16 steps, 1 = hit, 0 = rest)
const DRUM_PATTERNS: Record<string, { kick: number[]; snare: number[]; hihat: number[]; perc: number[] }> = {
  'trap-hard': {
    kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    perc:  [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,1,0],
  },
  'rnb-minimal': {
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    perc:  [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
  },
  'trap-bounce': {
    kick:  [1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,1,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    perc:  [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,0,0],
  },
  'pop-punchy': {
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    perc:  [0,0,0,1, 0,0,0,1, 0,0,0,1, 0,0,0,1],
  },
  'phonk-cowbell': {
    kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    perc:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], // cowbell
  },
  'edm-drop': {
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    perc:  [0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1],
  },
  'lofi-dusty': {
    kick:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
    hihat: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    perc:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0],
  },
  'glitch-stutter': {
    kick:  [1,1,0,0, 1,0,1,1, 0,0,1,0, 1,1,0,1],
    snare: [0,0,1,0, 1,0,0,1, 0,1,0,0, 1,0,1,0],
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    perc:  [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
  },
  'afro-log': {
    kick:  [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    perc:  [1,0,0,0, 0,1,0,0, 1,0,0,0, 0,1,0,0], // shaker
  },
  'dembow': {
    kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,1],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    perc:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  },
};

// Chord progressions by style
const CHORD_PROGRESSIONS: Record<string, number[][]> = {
  'dark-pad': [[0, 3, 7], [5, 8, 0], [3, 7, 10], [7, 10, 2]], // i - VI - iv - VII
  'synth-wave': [[0, 3, 7, 10], [5, 8, 0, 3], [7, 10, 2, 5], [3, 7, 10, 2]],
  'piano-chords': [[0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]],
  'bright-synth': [[0, 4, 7], [5, 9, 0], [7, 11, 2], [9, 0, 4]],
  'memphis': [[0, 3, 7], [0, 3, 7], [5, 8, 0], [5, 8, 0]],
  'supersaws': [[0, 4, 7, 11], [5, 9, 0, 4], [7, 11, 2, 5], [0, 4, 7, 11]],
  'jazz-rhodes': [[0, 3, 7, 10, 14], [5, 8, 0, 3, 7], [7, 10, 2, 5, 9], [3, 7, 10, 14, 17]],
  'detuned': [[0, 4, 7], [0, 4, 7], [5, 9, 0], [7, 11, 2]],
  'guitar-stabs': [[0, 4, 7], [5, 9, 0], [0, 4, 7], [7, 11, 2]],
  'reggaeton': [[0, 3, 7], [5, 8, 0], [3, 7, 10], [0, 3, 7]],
};

// Bass patterns (scale degrees, -1 = rest)
const BASS_PATTERNS: Record<string, number[]> = {
  '808-slide': [0, -1, -1, 0, -1, -1, 0, -1, 0, -1, -1, 0, -1, -1, 0, -1],
  'sub-bass': [0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1],
  '808-melodic': [0, -1, 0, -1, 2, -1, 0, -1, 0, -1, 0, -1, 2, -1, 3, -1],
  'synth-bass': [0, 0, -1, 0, -1, 0, 0, -1, 0, 0, -1, 0, -1, 0, 0, -1],
  '808-distort': [0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, 0, -1, 0, -1, 0],
  'wobble': [0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, -1, -1, -1, -1],
  'upright': [0, -1, -1, 2, -1, -1, 3, -1, 0, -1, -1, 2, -1, -1, 0, -1],
  'distort-bass': [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0],
  'afro-bass': [0, -1, 0, -1, -1, 0, -1, 0, 0, -1, 0, -1, -1, 0, -1, 0],
  '808-latin': [0, -1, -1, 0, -1, 0, -1, -1, 0, -1, -1, 0, -1, 0, -1, -1],
};

// Melody patterns (scale degrees)
const MELODY_PATTERNS: number[][] = [
  [4, 3, 2, 0, -1, 2, 3, 4, 5, 4, 3, 2, 0, -1, -1, -1],
  [0, 2, 4, 5, 4, 2, 0, -1, 0, 2, 4, 5, 7, 5, 4, 2],
  [7, -1, 5, -1, 4, -1, 2, -1, 0, -1, 2, -1, 4, -1, 5, -1],
  [0, 0, 4, 4, 5, 5, 4, -1, 3, 3, 2, 2, 0, -1, -1, -1],
];

export interface AstutelyResult {
  style: string;
  bpm: number;
  key: string;
  drums: { step: number; type: 'kick' | 'snare' | 'hihat' | 'perc' }[];
  bass: { step: number; note: number; duration: number }[];
  chords: { step: number; notes: number[]; duration: number }[];
  melody: { step: number; note: number; duration: number }[];
}

export const astutelyGenerate = async (style: string): Promise<AstutelyResult> => {
  console.log(`🎵 ASTUTELY: Generating "${style}" beat...`);
  
  const config = STYLE_CONFIGS[style] || STYLE_CONFIGS["Travis Scott rage"];
  const rootNote = NOTES[config.key] || 60;
  const scale = SCALES[config.scale] || SCALES['minor'];
  
  // Get patterns for this style
  const drumPattern = DRUM_PATTERNS[config.drumPattern] || DRUM_PATTERNS['trap-hard'];
  const bassPattern = BASS_PATTERNS[config.bassStyle] || BASS_PATTERNS['808-slide'];
  const chordProg = CHORD_PROGRESSIONS[config.chordVoicing] || CHORD_PROGRESSIONS['dark-pad'];
  const melodyPattern = MELODY_PATTERNS[Math.floor(Math.random() * MELODY_PATTERNS.length)];
  
  const result: AstutelyResult = {
    style,
    bpm: config.bpm,
    key: config.key,
    drums: [],
    bass: [],
    chords: [],
    melody: [],
  };
  
  // Generate 4 bars (64 steps at 16 steps per bar)
  const totalSteps = 64;
  
  // DRUMS - Generate drum hits
  for (let bar = 0; bar < 4; bar++) {
    for (let step = 0; step < 16; step++) {
      const globalStep = bar * 16 + step;
      if (drumPattern.kick[step]) result.drums.push({ step: globalStep, type: 'kick' });
      if (drumPattern.snare[step]) result.drums.push({ step: globalStep, type: 'snare' });
      if (drumPattern.hihat[step]) result.drums.push({ step: globalStep, type: 'hihat' });
      if (drumPattern.perc[step]) result.drums.push({ step: globalStep, type: 'perc' });
    }
  }
  
  // BASS - Generate bass notes
  for (let bar = 0; bar < 4; bar++) {
    const chordRoot = chordProg[bar % chordProg.length][0];
    for (let step = 0; step < 16; step++) {
      const globalStep = bar * 16 + step;
      const bassNote = bassPattern[step];
      if (bassNote >= 0) {
        const scaleNote = scale[bassNote % scale.length];
        const octaveShift = Math.floor(bassNote / scale.length) * 12;
        const midiNote = rootNote - 24 + chordRoot + scaleNote + octaveShift; // Bass is 2 octaves down
        result.bass.push({ step: globalStep, note: midiNote, duration: 2 });
      }
    }
  }
  
  // CHORDS - Generate chord hits (every 4 steps = quarter note)
  for (let bar = 0; bar < 4; bar++) {
    const chord = chordProg[bar % chordProg.length];
    const globalStep = bar * 16;
    const chordNotes = chord.map(interval => rootNote + interval);
    result.chords.push({ step: globalStep, notes: chordNotes, duration: 16 });
  }
  
  // MELODY - Generate melody line
  for (let bar = 0; bar < 4; bar++) {
    for (let step = 0; step < 16; step++) {
      const globalStep = bar * 16 + step;
      const melodyDegree = melodyPattern[step];
      if (melodyDegree >= 0) {
        const scaleNote = scale[melodyDegree % scale.length];
        const octaveShift = Math.floor(melodyDegree / scale.length) * 12;
        const midiNote = rootNote + 12 + scaleNote + octaveShift; // Melody is 1 octave up
        result.melody.push({ step: globalStep, note: midiNote, duration: 1 });
      }
    }
  }
  
  console.log(`🎵 ASTUTELY: Generated ${result.drums.length} drum hits, ${result.bass.length} bass notes, ${result.chords.length} chords, ${result.melody.length} melody notes`);
  
  // Play preview using realisticAudio
  try {
    await playAstutelyPreview(result);
  } catch (e) {
    console.warn('Preview playback failed:', e);
  }
  
  return result;
};

// Convert MIDI note number to note name and octave
function midiToNoteOctave(midi: number): { note: string; octave: number } {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return { note: noteNames[noteIndex], octave };
}

// Play a quick preview of the generated beat
async function playAstutelyPreview(result: AstutelyResult) {
  const stepDuration = 60 / result.bpm / 4; // Duration of one 16th note in seconds
  
  // Initialize audio engine
  await realisticAudio.initialize();
  
  // Play first 16 steps as preview
  for (let step = 0; step < 16; step++) {
    const currentTime = step * stepDuration;
    
    // Schedule drums
    result.drums
      .filter(d => d.step === step)
      .forEach(d => {
        setTimeout(() => {
          try {
            realisticAudio.playDrumSound(d.type, 0.8);
          } catch (e) {
            console.log(`Drum: ${d.type}`);
          }
        }, currentTime * 1000);
      });
    
    // Schedule bass
    result.bass
      .filter(b => b.step === step)
      .forEach(b => {
        setTimeout(() => {
          try {
            const { note, octave } = midiToNoteOctave(b.note);
            realisticAudio.playNote(note, octave, stepDuration * b.duration, 'bass', 0.8);
          } catch (e) {
            console.log(`Bass: ${b.note}`);
          }
        }, currentTime * 1000);
      });
    
    // Schedule melody
    result.melody
      .filter(m => m.step === step)
      .forEach(m => {
        setTimeout(() => {
          try {
            const { note, octave } = midiToNoteOctave(m.note);
            realisticAudio.playNote(note, octave, stepDuration * m.duration, 'piano', 0.6);
          } catch (e) {
            console.log(`Melody: ${m.note}`);
          }
        }, currentTime * 1000);
      });
  }
}

// Export result to track store format
export function astutelyToNotes(result: AstutelyResult) {
  const notes: Array<{
    id: string;
    pitch: number;
    startStep: number;
    duration: number;
    velocity: number;
    trackType: 'drums' | 'bass' | 'chords' | 'melody';
  }> = [];
  
  // Convert drums
  result.drums.forEach((d, i) => {
    const pitchMap = { kick: 36, snare: 38, hihat: 42, perc: 46 };
    notes.push({
      id: `astutely-drum-${i}`,
      pitch: pitchMap[d.type],
      startStep: d.step,
      duration: 1,
      velocity: 100,
      trackType: 'drums',
    });
  });
  
  // Convert bass
  result.bass.forEach((b, i) => {
    notes.push({
      id: `astutely-bass-${i}`,
      pitch: b.note,
      startStep: b.step,
      duration: b.duration,
      velocity: 90,
      trackType: 'bass',
    });
  });
  
  // Convert chords (each note in chord)
  result.chords.forEach((c, i) => {
    c.notes.forEach((note, j) => {
      notes.push({
        id: `astutely-chord-${i}-${j}`,
        pitch: note,
        startStep: c.step,
        duration: c.duration,
        velocity: 70,
        trackType: 'chords',
      });
    });
  });
  
  // Convert melody
  result.melody.forEach((m, i) => {
    notes.push({
      id: `astutely-melody-${i}`,
      pitch: m.note,
      startStep: m.step,
      duration: m.duration,
      velocity: 80,
      trackType: 'melody',
    });
  });
  
  return notes;
}
