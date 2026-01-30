// shared/astutelyFallback.ts
// Centralized fallback generator for Astutely so both server and client can share the same
// musically-aware pattern logic when the primary AI provider is unavailable.

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
  variationSeed?: number;
  meta?: {
    usedFallback?: boolean;
    warnings?: string[];
    aiSource?: string;
  };
}

export interface AstutelyFallbackOptions {
  tempo?: number;
  timeSignature?: { numerator: number; denominator: number };
  key?: string;
  randomSeed?: number;
  fallbackReason?: string;
}

interface StyleConfig {
  bpm: number;
  key: string;
  scale: 'minor' | 'major';
  drumPattern: keyof typeof DRUM_PATTERNS;
  bassStyle: keyof typeof BASS_PATTERNS;
  chordVoicing: keyof typeof CHORD_PROGRESSIONS;
}

const STYLE_CONFIGS: Record<string, StyleConfig> = {
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

const NOTE_MAP: Record<string, number> = {
  'C': 60, 'C#': 61, 'Db': 61, 'D': 62, 'D#': 63, 'Eb': 63,
  'E': 64, 'F': 65, 'F#': 66, 'Gb': 66, 'G': 67, 'G#': 68,
  'Ab': 68, 'A': 69, 'A#': 70, 'Bb': 70, 'B': 71
};

const SCALES: Record<'minor' | 'major', number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

const DRUM_PATTERNS = {
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
    perc:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
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
    perc:  [1,0,0,0, 0,1,0,0, 1,0,0,0, 0,1,0,0],
  },
  'dembow': {
    kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,1],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    perc:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  },
};

const CHORD_PROGRESSIONS: Record<string, number[][]> = {
  'dark-pad': [[0, 3, 7], [5, 8, 0], [3, 7, 10], [7, 10, 2]],
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

const BASS_PATTERNS = {
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

const MELODY_PATTERNS = [
  [4, 3, 2, 0, -1, 2, 3, 4, 5, 4, 3, 2, 0, -1, -1, -1],
  [0, 2, 4, 5, 4, 2, 0, -1, 0, 2, 4, 5, 7, 5, 4, 2],
  [7, -1, 5, -1, 4, -1, 2, -1, 0, -1, 2, -1, 4, -1, 5, -1],
  [0, 0, 4, 4, 5, 5, 4, -1, 3, 3, 2, 2, 0, -1, -1, -1],
];

function createRng(seed: number) {
  let t = seed + 0x6D2B79F5;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function rotatePattern(pattern: number[], shift: number): number[] {
  const len = pattern.length;
  const offset = ((shift % len) + len) % len;
  return pattern.map((_, idx) => pattern[(idx + offset) % len]);
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateAstutelyFallback(style: string, overrides: AstutelyFallbackOptions = {}): AstutelyResult {
  const config = STYLE_CONFIGS[style] || STYLE_CONFIGS["Drake smooth"];
  const variationSeed = overrides.randomSeed ?? Date.now();
  const rng = createRng(variationSeed);

  const selectedKey = overrides.key ?? config.key;
  const rootNote = NOTE_MAP[selectedKey] || NOTE_MAP[config.key] || 60;
  const scale = SCALES[config.scale];

  const baseDrums = DRUM_PATTERNS[config.drumPattern];
  const drumShift = Math.floor(rng() * 16);
  const drumPattern = {
    kick: rotatePattern(baseDrums.kick, drumShift),
    snare: rotatePattern(baseDrums.snare, Math.floor(rng() * 16)),
    hihat: rotatePattern(baseDrums.hihat, Math.floor(rng() * 16)),
    perc: rotatePattern(baseDrums.perc, Math.floor(rng() * 16)),
  };

  const bassPattern = [...BASS_PATTERNS[config.bassStyle]];
  const melodyPattern = [...pick(MELODY_PATTERNS, rng)];
  const chordProg = CHORD_PROGRESSIONS[config.chordVoicing];

  const bpm = overrides.tempo ?? config.bpm + Math.floor(rng() * 4 - 2);
  const timeSignature = overrides.timeSignature ?? { numerator: 4, denominator: 4 };

  const result: AstutelyResult = {
    style,
    bpm,
    key: selectedKey,
    timeSignature,
    drums: [],
    bass: [],
    chords: [],
    melody: [],
    isFallback: true,
    fallbackReason: overrides.fallbackReason ?? 'ai_unavailable',
    variationSeed,
    meta: {
      usedFallback: true,
      warnings: ['Astutely fallback pattern generated locally'],
      aiSource: 'astutely-fallback',
    },
  };

  for (let bar = 0; bar < 4; bar++) {
    for (let step = 0; step < 16; step++) {
      const globalStep = bar * 16 + step;
      if (drumPattern.kick[step]) result.drums.push({ step: globalStep, type: 'kick' });
      if (drumPattern.snare[step]) result.drums.push({ step: globalStep, type: 'snare' });
      if (drumPattern.hihat[step]) result.drums.push({ step: globalStep, type: 'hihat' });
      if (drumPattern.perc[step]) result.drums.push({ step: globalStep, type: 'perc' });
    }
  }

  for (let bar = 0; bar < 4; bar++) {
    const chordRoot = chordProg[bar % chordProg.length][0];
    for (let step = 0; step < 16; step++) {
      const globalStep = bar * 16 + step;
      const bassDegree = bassPattern[(step + Math.floor(rng() * 2)) % bassPattern.length];
      if (bassDegree >= 0) {
        const scaleNote = scale[bassDegree % scale.length];
        const octaveShift = Math.floor(bassDegree / scale.length) * 12;
        const midiNote = rootNote - 24 + chordRoot + scaleNote + octaveShift;
        result.bass.push({ step: globalStep, note: midiNote, duration: 2 });
      }
    }
  }

  for (let bar = 0; bar < 4; bar++) {
    const chord = chordProg[bar % chordProg.length];
    const globalStep = bar * 16;
    const inversion = rng() > 0.6 ? 12 : 0;
    const chordNotes = chord.map(interval => rootNote + interval + inversion);
    result.chords.push({ step: globalStep, notes: chordNotes, duration: 16 });
  }

  for (let bar = 0; bar < 4; bar++) {
    for (let step = 0; step < 16; step++) {
      const globalStep = bar * 16 + step;
      const melodyDegree = melodyPattern[step];
      if (melodyDegree >= 0) {
        const scaleNote = scale[melodyDegree % scale.length];
        const octaveShift = Math.floor(melodyDegree / scale.length) * 12;
        const midiNote = rootNote + 12 + scaleNote + octaveShift + (rng() > 0.8 ? 12 : 0);
        result.melody.push({ step: globalStep, note: midiNote, duration: rng() > 0.5 ? 1 : 2 });
      }
    }
  }

  return result;
}
