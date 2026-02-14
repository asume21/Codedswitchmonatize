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
  timeSignature?: { numerator: number; denominator: number };
  drums: { step: number; type: 'kick' | 'snare' | 'hihat' | 'perc' }[];
  bass: { step: number; note: number; duration: number }[];
  chords: { step: number; notes: number[]; duration: number }[];
  melody: { step: number; note: number; duration: number }[];
  isFallback?: boolean;
  fallbackReason?: string;
  meta?: {
    usedFallback?: boolean;
    warnings?: string[];
    aiSource?: string;
    attempts?: number;
  };
}

export interface AstutelyTrackSummary {
  id?: string;
  name?: string;
  instrument?: string;
  type?: string;
  notes?: number;
  muted?: boolean;
  volume?: number;
}

export interface AstutelyGenerateOptions {
  style: string;
  prompt?: string;
  tempo?: number;
  timeSignature?: { numerator: number; denominator: number };
  key?: string;
  trackSummaries?: AstutelyTrackSummary[];
}

export const astutelyGenerate = async (styleOrOptions: string | AstutelyGenerateOptions): Promise<AstutelyResult> => {
  const options: AstutelyGenerateOptions = typeof styleOrOptions === 'string'
    ? { style: styleOrOptions }
    : styleOrOptions;

  console.log(`🎵 ASTUTELY: Generating "${options.style}" beat via Backend API...`);
  
  try {
    const response = await fetch('/api/astutely', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        style: options.style,
        prompt: options.prompt,
        tempo: options.tempo,
        timeSignature: options.timeSignature,
        key: options.key,
        trackSummaries: options.trackSummaries,
      })
    });

    if (!response.ok) {
      throw new Error('Astutely API failed');
    }

    const result = await response.json();
    console.log(`✅ ASTUTELY: Received AI generated pattern`);
    if (result?.meta?.warnings?.length) {
      console.warn('[Astutely] Warnings from backend:', result.meta.warnings);
    }
    if (result?.meta?.usedFallback || result?.isFallback) {
      console.warn('[Astutely] Using fallback pattern — check AI configuration.', {
        fallbackReason: result?.fallbackReason,
        aiSource: result?.meta?.aiSource,
      });
    }
    
    // Play preview using realisticAudio
    try {
      await playAstutelyPreview(result);
    } catch (e) {
      console.warn('Preview playback failed:', e);
    }
    
    return result;
  } catch (error) {
    console.error("Astutely API error, falling back to local:", error);
    // Fallback to local logic if API fails (copied from previous local implementation for robustness)
    return generateLocalFallback(options.style, {
      tempo: options.tempo,
      timeSignature: options.timeSignature,
      key: options.key,
    });
  }
};

// Fallback local generator with heavy randomization so it never sounds the same twice
const generateLocalFallback = (style: string, overrides?: { tempo?: number; timeSignature?: { numerator: number; denominator: number }; key?: string }): AstutelyResult => {
  const rng = Math.random; // use native random for client-side
  const config = STYLE_CONFIGS[style] || STYLE_CONFIGS["Travis Scott rage"];
  const selectedKey = overrides?.key ?? config.key;
  const rootNote = NOTES[selectedKey] || NOTES[config.key] || 60;
  const scale = SCALES[config.scale] || SCALES['minor'];
  
  // Get base patterns for this style
  const baseDrumPattern = DRUM_PATTERNS[config.drumPattern] || DRUM_PATTERNS['trap-hard'];
  const bassPattern = BASS_PATTERNS[config.bassStyle] || BASS_PATTERNS['808-slide'];
  const chordProg = CHORD_PROGRESSIONS[config.chordVoicing] || CHORD_PROGRESSIONS['dark-pad'];

  // Rotate drum patterns randomly for rhythmic variation
  const rotate = (arr: number[], shift: number) => arr.map((_, i) => arr[(i + shift) % arr.length]);
  const drumPattern = {
    kick: rotate(baseDrumPattern.kick, Math.floor(rng() * 16)),
    snare: rotate(baseDrumPattern.snare, Math.floor(rng() * 16)),
    hihat: rotate(baseDrumPattern.hihat, Math.floor(rng() * 16)),
    perc: rotate(baseDrumPattern.perc, Math.floor(rng() * 16)),
  };
  
  const result: AstutelyResult = {
    style,
    bpm: overrides?.tempo ?? config.bpm + Math.floor(rng() * 6 - 3),
    key: selectedKey,
    timeSignature: overrides?.timeSignature ?? { numerator: 4, denominator: 4 },
    drums: [],
    bass: [],
    chords: [],
    melody: [],
    isFallback: true,
    fallbackReason: 'api_unavailable',
    meta: { usedFallback: true, warnings: ['Client-side fallback pattern'], aiSource: 'client-fallback' },
  };
  
  // DRUMS — with ghost notes and random skips
  for (let bar = 0; bar < 4; bar++) {
    for (let step = 0; step < 16; step++) {
      const globalStep = bar * 16 + step;
      const ghostChance = 0.12 + rng() * 0.08;
      const skipChance = 0.15;
      if (drumPattern.kick[step] && rng() > skipChance) result.drums.push({ step: globalStep, type: 'kick' });
      else if (!drumPattern.kick[step] && rng() < ghostChance * 0.5) result.drums.push({ step: globalStep, type: 'kick' });
      if (drumPattern.snare[step] && rng() > skipChance) result.drums.push({ step: globalStep, type: 'snare' });
      if (drumPattern.hihat[step] && rng() > skipChance * 0.5) result.drums.push({ step: globalStep, type: 'hihat' });
      else if (!drumPattern.hihat[step] && rng() < ghostChance) result.drums.push({ step: globalStep, type: 'hihat' });
      if (drumPattern.perc[step] && rng() > skipChance) result.drums.push({ step: globalStep, type: 'perc' });
      else if (!drumPattern.perc[step] && rng() < ghostChance * 0.7) result.drums.push({ step: globalStep, type: 'perc' });
    }
  }

  // Randomly reorder chord progression
  const chordOrder = [0, 1, 2, 3];
  if (rng() > 0.4) {
    for (let i = chordOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [chordOrder[i], chordOrder[j]] = [chordOrder[j], chordOrder[i]];
    }
  }
  
  // BASS — with random rhythm shifts and octave variation
  for (let bar = 0; bar < 4; bar++) {
    const chordIdx = chordOrder[bar % chordOrder.length];
    const chordRoot = chordProg[chordIdx % chordProg.length][0];
    const bassOctShift = rng() > 0.7 ? -12 : 0;
    for (let step = 0; step < 16; step++) {
      const globalStep = bar * 16 + step;
      const bassIdx = (step + Math.floor(rng() * 3)) % bassPattern.length;
      const bassDegree = bassPattern[bassIdx];
      if (bassDegree >= 0 && rng() > 0.1) {
        const scaleNote = scale[bassDegree % scale.length];
        const octaveShift = Math.floor(bassDegree / scale.length) * 12;
        const midiNote = rootNote - 24 + chordRoot + scaleNote + octaveShift + bassOctShift;
        const dur = rng() > 0.6 ? 1 : (rng() > 0.3 ? 2 : 4);
        result.bass.push({ step: globalStep, note: midiNote, duration: dur });
      }
    }
  }
  
  // CHORDS — with random inversions and varied durations
  for (let bar = 0; bar < 4; bar++) {
    const chordIdx = chordOrder[bar % chordOrder.length];
    const chord = chordProg[chordIdx % chordProg.length];
    const globalStep = bar * 16;
    const invRoll = rng();
    const inversion = invRoll > 0.7 ? 12 : (invRoll > 0.4 ? -12 : 0);
    const chordNotes = chord.map((interval, i) => {
      const octShift = (i === 0 && rng() > 0.6) ? -12 : 0;
      return rootNote + interval + inversion + octShift;
    });
    const durRoll = rng();
    const chordDur = durRoll > 0.6 ? 16 : (durRoll > 0.3 ? 8 : 4);
    result.chords.push({ step: globalStep, notes: chordNotes, duration: chordDur });
    if (chordDur <= 8 && rng() > 0.4) {
      const midStep = globalStep + (chordDur <= 4 ? 8 : chordDur);
      const midChord = chord.map(interval => rootNote + interval + (rng() > 0.5 ? 12 : 0));
      result.chords.push({ step: midStep, notes: midChord, duration: 16 - chordDur });
    }
  }
  
  // MELODY — truly random walk using scale degrees (not hardcoded patterns)
  for (let bar = 0; bar < 4; bar++) {
    const densityRoll = rng();
    const notesInBar = densityRoll > 0.6 ? Math.floor(4 + rng() * 3) : (densityRoll > 0.25 ? Math.floor(7 + rng() * 4) : Math.floor(11 + rng() * 4));
    const availableSteps = Array.from({ length: 16 }, (_, i) => i);
    const chosenSteps: number[] = [];
    for (let n = 0; n < Math.min(notesInBar, 16); n++) {
      if (availableSteps.length === 0) break;
      const idx = Math.floor(rng() * availableSteps.length);
      chosenSteps.push(availableSteps[idx]);
      availableSteps.splice(idx, 1);
    }
    chosenSteps.sort((a, b) => a - b);

    let currentDegree = Math.floor(rng() * scale.length);
    for (const step of chosenSteps) {
      const globalStep = bar * 16 + step;
      const moveRoll = rng();
      if (moveRoll > 0.7) currentDegree = Math.min(currentDegree + 2, scale.length - 1);
      else if (moveRoll > 0.45) currentDegree = Math.min(currentDegree + 1, scale.length - 1);
      else if (moveRoll > 0.2) currentDegree = Math.max(currentDegree - 1, 0);
      else if (moveRoll > 0.05) currentDegree = Math.max(currentDegree - 2, 0);

      const scaleNote = scale[currentDegree % scale.length];
      const octaveShift = Math.floor(currentDegree / scale.length) * 12;
      const octaveBoost = rng() > 0.8 ? 12 : 0;
      const midiNote = rootNote + 12 + scaleNote + octaveShift + octaveBoost;
      const dur = rng() > 0.6 ? 1 : (rng() > 0.3 ? 2 : 4);
      result.melody.push({ step: globalStep, note: midiNote, duration: dur });
    }
  }
  
  return result;
};

/**
 * Generate actual audio using Suno API or MusicGen fallback
 * This produces real audio files that can be played, not just MIDI patterns
 */
export async function astutelyGenerateAudio(style: string, options?: {
  prompt?: string;
  bpm?: number;
  key?: string;
}): Promise<{ audioUrl: string; duration: number; provider: string }> {
  console.log(`🎵 ASTUTELY: Generating REAL AUDIO for "${style}"...`);
  
  try {
    const response = await fetch('/api/astutely/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        style,
        prompt: options?.prompt,
        bpm: options?.bpm,
        key: options?.key,
        instrumental: true,
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.audioUrl) {
      throw new Error('No audio URL returned from generation');
    }

    console.log(`✅ ASTUTELY: Audio generated via ${result.provider}!`);
    console.log(`🔊 Audio URL: ${result.audioUrl}`);
    
    return {
      audioUrl: result.audioUrl,
      duration: result.duration || 30,
      provider: result.provider,
    };
  } catch (error) {
    console.error('❌ ASTUTELY: Audio generation failed:', error);
    throw error;
  }
}

/**
 * Play generated audio directly
 */
export async function astutelyPlayAudio(audioUrl: string): Promise<HTMLAudioElement> {
  console.log(`🔊 ASTUTELY: Playing audio: ${audioUrl}`);
  
  const audio = new Audio(audioUrl);
  audio.crossOrigin = 'anonymous';
  
  return new Promise((resolve, reject) => {
    audio.oncanplaythrough = () => {
      audio.play()
        .then(() => resolve(audio))
        .catch(reject);
    };
    audio.onerror = () => reject(new Error('Failed to load audio'));
    audio.load();
  });
}

// Convert MIDI note number to note name and octave
export function midiToNoteOctave(midi: number): { note: string; octave: number } {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return { note: noteNames[noteIndex], octave };
}

// Active preview timeout IDs so we can cancel playback
let activePreviewTimeouts: ReturnType<typeof setTimeout>[] = [];

/** Stop any currently playing Astutely preview */
export function stopAstutelyPreview() {
  activePreviewTimeouts.forEach(id => clearTimeout(id));
  activePreviewTimeouts = [];
}

// Play the full generated beat (all bars, not just 1)
async function playAstutelyPreview(result: AstutelyResult) {
  stopAstutelyPreview();

  const stepDuration = 60 / result.bpm / 4; // Duration of one 16th note in seconds
  
  // Initialize audio engine
  await realisticAudio.initialize();

  // Find the maximum step across all parts to play everything
  const maxStep = Math.max(
    ...result.drums.map(d => d.step),
    ...result.bass.map(b => b.step),
    ...result.chords.map(c => c.step),
    ...result.melody.map(m => m.step),
    0
  ) + 1;
  
  // Play ALL steps (typically 64 = 4 bars)
  for (let step = 0; step < maxStep; step++) {
    const currentTime = step * stepDuration;
    
    // Schedule drums
    result.drums
      .filter(d => d.step === step)
      .forEach(d => {
        const tid = setTimeout(() => {
          try {
            realisticAudio.playDrumSound(d.type, 0.8);
          } catch (e) {
            console.log(`Drum: ${d.type}`);
          }
        }, currentTime * 1000);
        activePreviewTimeouts.push(tid);
      });
    
    // Schedule bass
    result.bass
      .filter(b => b.step === step)
      .forEach(b => {
        const tid = setTimeout(() => {
          try {
            const { note, octave } = midiToNoteOctave(b.note);
            realisticAudio.playNote(note, octave, stepDuration * b.duration, 'synth_bass_1', 0.8);
          } catch (e) {
            console.log(`Bass: ${b.note}`);
          }
        }, currentTime * 1000);
        activePreviewTimeouts.push(tid);
      });

    // Schedule chords
    result.chords
      .filter(c => c.step === step)
      .forEach(c => {
        c.notes.forEach(chordNote => {
          const tid = setTimeout(() => {
            try {
              const { note, octave } = midiToNoteOctave(chordNote);
              realisticAudio.playNote(note, octave, stepDuration * c.duration, 'acoustic_grand_piano', 0.45);
            } catch (e) {
              console.log(`Chord: ${chordNote}`);
            }
          }, currentTime * 1000);
          activePreviewTimeouts.push(tid);
        });
      });
    
    // Schedule melody
    result.melody
      .filter(m => m.step === step)
      .forEach(m => {
        const tid = setTimeout(() => {
          try {
            const { note, octave } = midiToNoteOctave(m.note);
            realisticAudio.playNote(note, octave, stepDuration * m.duration, 'acoustic_grand_piano', 0.6);
          } catch (e) {
            console.log(`Melody: ${m.note}`);
          }
        }, currentTime * 1000);
        activePreviewTimeouts.push(tid);
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

  const safeDrums = Array.isArray(result.drums) ? result.drums : [];
  const safeBass = Array.isArray(result.bass) ? result.bass : [];
  const safeChords = Array.isArray(result.chords) ? result.chords : [];
  const safeMelody = Array.isArray(result.melody) ? result.melody : [];

  if (!Array.isArray(result.drums) || !Array.isArray(result.bass) || !Array.isArray(result.chords) || !Array.isArray(result.melody)) {
    console.warn('[Astutely] Received malformed pattern payload. Some tracks missing or mis-typed.', {
      hasDrums: Array.isArray(result.drums),
      hasBass: Array.isArray(result.bass),
      hasChords: Array.isArray(result.chords),
      hasMelody: Array.isArray(result.melody),
      style: result.style,
    });
  }
  
  // Convert drums
  safeDrums.forEach((d, i) => {
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
  safeBass.forEach((b, i) => {
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
  safeChords.forEach((c, i) => {
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
  safeMelody.forEach((m, i) => {
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
