/**
 * Genre-aware music intelligence — progressions, rhythms, and instrument
 * recommendations per genre. This is the "secret sauce" for the paid tier.
 */

export interface GenreProfile {
  name: string;
  /** Common chord progressions as Roman numerals */
  progressions: string[][];
  /** Typical scales used */
  scales: string[];
  /** BPM range */
  bpmRange: [number, number];
  /** Common time signatures */
  timeSignatures: string[];
  /** Recommended instruments */
  instruments: string[];
  /** Typical rhythmic feel */
  feel: string;
  /** Swing amount 0-1 (0 = straight, 1 = full triplet swing) */
  swing: number;
  /** Common keys */
  commonKeys: string[];
  /** Mood/energy descriptors */
  mood: string[];
}

export const GENRES: Record<string, GenreProfile> = {
  trap: {
    name: 'Trap',
    progressions: [
      ['i', 'iv', 'VI', 'v'],
      ['i', 'VI', 'III', 'VII'],
      ['i', 'iv', 'v', 'iv'],
      ['i', 'III', 'VII', 'VI'],
      ['i', 'VI', 'iv', 'v'],
    ],
    scales: ['natural_minor', 'phrygian', 'pentatonic_minor', 'blues'],
    bpmRange: [130, 170],
    timeSignatures: ['4/4'],
    instruments: ['808', 'hi_hat', 'snare', 'fm_synth', 'pad', 'pluck', 'bell', 'strings'],
    feel: 'triplet hi-hats over half-time kick/snare',
    swing: 0,
    commonKeys: ['C', 'D', 'F', 'G', 'A'],
    mood: ['dark', 'aggressive', 'hard', 'menacing'],
  },
  boom_bap: {
    name: 'Boom Bap',
    progressions: [
      ['ii', 'V', 'I', 'vi'],
      ['I', 'vi', 'ii', 'V'],
      ['i', 'iv', 'i', 'v'],
      ['i', 'VII', 'VI', 'v'],
    ],
    scales: ['natural_minor', 'dorian', 'pentatonic_minor', 'blues'],
    bpmRange: [85, 100],
    timeSignatures: ['4/4'],
    instruments: ['acoustic_grand_piano', 'rhodes', 'upright_bass', 'trumpet', 'alto_sax', 'strings', 'vinyl_crackle'],
    feel: 'head-nod groove, slightly behind the beat',
    swing: 0.3,
    commonKeys: ['C', 'D', 'F', 'G', 'Bb'],
    mood: ['chill', 'nostalgic', 'soulful', 'gritty'],
  },
  drill: {
    name: 'Drill',
    progressions: [
      ['i', 'VI', 'VII', 'v'],
      ['i', 'iv', 'VII', 'III'],
      ['i', 'v', 'iv', 'III'],
    ],
    scales: ['natural_minor', 'harmonic_minor', 'phrygian'],
    bpmRange: [138, 148],
    timeSignatures: ['4/4'],
    instruments: ['808', 'hi_hat', 'snare', 'bell', 'pluck', 'strings', 'choir_aahs'],
    feel: 'sliding 808s, bouncy triplet patterns',
    swing: 0,
    commonKeys: ['C', 'D', 'F', 'G'],
    mood: ['dark', 'menacing', 'aggressive', 'cold'],
  },
  lofi_hiphop: {
    name: 'Lo-Fi Hip Hop',
    progressions: [
      ['ii', 'V', 'I', 'vi'],
      ['I', 'iii', 'vi', 'IV'],
      ['ii', 'V', 'iii', 'vi'],
      ['I', 'vi', 'IV', 'V'],
    ],
    scales: ['major', 'dorian', 'mixolydian', 'pentatonic_major'],
    bpmRange: [70, 90],
    timeSignatures: ['4/4'],
    instruments: ['acoustic_grand_piano', 'rhodes', 'acoustic_guitar_nylon', 'upright_bass', 'pad', 'vinyl_crackle'],
    feel: 'lazy swing, detuned warmth, tape hiss',
    swing: 0.4,
    commonKeys: ['C', 'D', 'F', 'G', 'Bb', 'Eb'],
    mood: ['chill', 'nostalgic', 'dreamy', 'warm'],
  },
  rnb: {
    name: 'R&B',
    progressions: [
      ['I', 'iii', 'vi', 'IV'],
      ['ii', 'V', 'I', 'vi'],
      ['I', 'vi', 'IV', 'V'],
      ['vi', 'IV', 'I', 'V'],
      ['ii', 'V', 'iii', 'vi'],
    ],
    scales: ['major', 'dorian', 'mixolydian', 'pentatonic_major'],
    bpmRange: [65, 110],
    timeSignatures: ['4/4', '6/8'],
    instruments: ['rhodes', 'acoustic_grand_piano', 'pad', 'strings', 'electric_bass_finger', 'alto_sax', 'flute'],
    feel: 'smooth, syncopated, behind-the-beat vocals',
    swing: 0.2,
    commonKeys: ['C', 'Db', 'Eb', 'F', 'Ab', 'Bb'],
    mood: ['smooth', 'sensual', 'warm', 'emotional'],
  },
  pop: {
    name: 'Pop',
    progressions: [
      ['I', 'V', 'vi', 'IV'],
      ['vi', 'IV', 'I', 'V'],
      ['I', 'IV', 'vi', 'V'],
      ['I', 'vi', 'IV', 'V'],
    ],
    scales: ['major', 'pentatonic_major', 'mixolydian'],
    bpmRange: [100, 130],
    timeSignatures: ['4/4'],
    instruments: ['acoustic_grand_piano', 'acoustic_guitar_nylon', 'electric_guitar_clean', 'pad', 'strings', 'pluck'],
    feel: 'driving, four-on-the-floor or syncopated',
    swing: 0,
    commonKeys: ['C', 'D', 'G', 'A', 'E'],
    mood: ['uplifting', 'catchy', 'bright', 'energetic'],
  },
  afrobeats: {
    name: 'Afrobeats',
    progressions: [
      ['I', 'vi', 'IV', 'V'],
      ['I', 'IV', 'vi', 'V'],
      ['i', 'iv', 'VII', 'III'],
      ['I', 'V', 'vi', 'IV'],
    ],
    scales: ['major', 'pentatonic_major', 'dorian'],
    bpmRange: [100, 120],
    timeSignatures: ['4/4'],
    instruments: ['acoustic_grand_piano', 'electric_guitar_clean', 'pad', 'log_drum', 'shaker', 'trumpet', 'flute'],
    feel: 'syncopated, polyrhythmic, bouncy',
    swing: 0.15,
    commonKeys: ['C', 'D', 'G', 'Bb', 'F'],
    mood: ['joyful', 'groovy', 'danceable', 'warm'],
  },
  reggaeton: {
    name: 'Reggaeton',
    progressions: [
      ['i', 'iv', 'VII', 'III'],
      ['i', 'VI', 'III', 'VII'],
      ['i', 'iv', 'v', 'iv'],
    ],
    scales: ['natural_minor', 'phrygian_dominant', 'harmonic_minor'],
    bpmRange: [85, 100],
    timeSignatures: ['4/4'],
    instruments: ['808', 'pluck', 'bell', 'pad', 'brass', 'strings'],
    feel: 'dembow riddim, steady pulse',
    swing: 0,
    commonKeys: ['C', 'D', 'F', 'G', 'A'],
    mood: ['party', 'sensual', 'danceable', 'latin'],
  },
  jazz: {
    name: 'Jazz',
    progressions: [
      ['ii', 'V', 'I'],
      ['I', 'vi', 'ii', 'V'],
      ['iii', 'vi', 'ii', 'V'],
      ['I', 'IV', 'iii', 'vi', 'ii', 'V', 'I'],
    ],
    scales: ['major', 'dorian', 'mixolydian', 'lydian', 'melodic_minor', 'whole_tone', 'diminished'],
    bpmRange: [60, 200],
    timeSignatures: ['4/4', '3/4', '5/4', '7/4'],
    instruments: ['acoustic_grand_piano', 'upright_bass', 'alto_sax', 'trumpet', 'flute', 'acoustic_guitar_nylon'],
    feel: 'swung, conversational, improvisatory',
    swing: 0.55,
    commonKeys: ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db'],
    mood: ['sophisticated', 'smooth', 'complex', 'expressive'],
  },
  edm: {
    name: 'EDM',
    progressions: [
      ['vi', 'IV', 'I', 'V'],
      ['I', 'V', 'vi', 'IV'],
      ['i', 'VI', 'III', 'VII'],
      ['i', 'iv', 'VI', 'V'],
    ],
    scales: ['natural_minor', 'major', 'pentatonic_minor'],
    bpmRange: [120, 150],
    timeSignatures: ['4/4'],
    instruments: ['superSaw', 'pad', 'pluck', 'bell', '808', 'fm_synth'],
    feel: 'four-on-the-floor, build-and-drop',
    swing: 0,
    commonKeys: ['A', 'C', 'D', 'F', 'G'],
    mood: ['euphoric', 'energetic', 'anthemic', 'driving'],
  },
  gospel: {
    name: 'Gospel',
    progressions: [
      ['I', 'IV', 'I', 'V'],
      ['I', 'vi', 'ii', 'V'],
      ['IV', 'V', 'iii', 'vi'],
      ['I', 'iii', 'IV', 'V'],
    ],
    scales: ['major', 'pentatonic_major', 'dorian', 'mixolydian'],
    bpmRange: [70, 130],
    timeSignatures: ['4/4', '3/4', '6/8'],
    instruments: ['acoustic_grand_piano', 'organ', 'choir_aahs', 'electric_bass_finger', 'strings', 'trumpet'],
    feel: 'call and response, extended chords, runs',
    swing: 0.25,
    commonKeys: ['C', 'Db', 'Eb', 'F', 'Ab', 'Bb'],
    mood: ['uplifting', 'powerful', 'joyful', 'soulful'],
  },
};

export function getGenre(genre: string): GenreProfile {
  const key = genre.toLowerCase().replace(/[\s-]/g, '_');
  const profile = GENRES[key];
  if (!profile) throw new Error(`Unknown genre: ${genre}. Available: ${Object.keys(GENRES).join(', ')}`);
  return profile;
}

export function listGenres(): string[] {
  return Object.keys(GENRES);
}

/** Suggest a genre based on BPM, key, mood keywords, or detected scale */
export function suggestGenre(opts: {
  bpm?: number;
  key?: string;
  mood?: string;
  scale?: string;
}): Array<{ genre: string; score: number; reason: string }> {
  const results: Array<{ genre: string; score: number; reason: string }> = [];

  for (const [id, profile] of Object.entries(GENRES)) {
    let score = 0;
    const reasons: string[] = [];

    if (opts.bpm) {
      if (opts.bpm >= profile.bpmRange[0] && opts.bpm <= profile.bpmRange[1]) {
        score += 3;
        reasons.push(`BPM ${opts.bpm} fits range ${profile.bpmRange[0]}-${profile.bpmRange[1]}`);
      }
    }

    if (opts.key && profile.commonKeys.includes(normalize(opts.key))) {
      score += 1;
      reasons.push(`Key ${opts.key} is common`);
    }

    if (opts.scale && profile.scales.includes(opts.scale)) {
      score += 2;
      reasons.push(`Scale ${opts.scale} is typical`);
    }

    if (opts.mood) {
      const moodLower = opts.mood.toLowerCase();
      for (const m of profile.mood) {
        if (moodLower.includes(m) || m.includes(moodLower)) {
          score += 2;
          reasons.push(`Mood "${opts.mood}" matches "${m}"`);
          break;
        }
      }
    }

    if (score > 0) {
      results.push({ genre: id, score, reason: reasons.join('; ') });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

function normalize(note: string): string {
  const trimmed = note.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// ─── Rhythm Patterns ────────────────────────────────────────────────────────

export interface RhythmPattern {
  name: string;
  /** Hits as beat positions within a bar (0-indexed, e.g., 0 = beat 1) */
  kicks: number[];
  snares: number[];
  hiHats: number[];
  /** Subdivisions per beat (4 = 16ths, 3 = triplets) */
  subdivision: number;
  /** Steps per bar */
  stepsPerBar: number;
}

export function getGenreRhythms(genre: string): RhythmPattern[] {
  const key = genre.toLowerCase().replace(/[\s-]/g, '_');
  const patterns: Record<string, RhythmPattern[]> = {
    trap: [
      { name: 'Classic Trap', kicks: [0, 7, 10], snares: [4, 12], hiHats: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], subdivision: 4, stepsPerBar: 16 },
      { name: 'Trap Bounce', kicks: [0, 3, 7, 10], snares: [4, 12], hiHats: [0,2,4,6,8,10,12,14], subdivision: 4, stepsPerBar: 16 },
    ],
    boom_bap: [
      { name: 'Classic Boom Bap', kicks: [0, 5, 8], snares: [4, 12], hiHats: [0,2,4,6,8,10,12,14], subdivision: 4, stepsPerBar: 16 },
      { name: 'Lazy Boom Bap', kicks: [0, 7], snares: [4, 12], hiHats: [0,4,8,12], subdivision: 4, stepsPerBar: 16 },
    ],
    drill: [
      { name: 'UK Drill', kicks: [0, 4, 7, 10], snares: [4, 12], hiHats: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], subdivision: 4, stepsPerBar: 16 },
    ],
    lofi_hiphop: [
      { name: 'Lo-Fi Chill', kicks: [0, 6, 10], snares: [4, 12], hiHats: [0,2,4,6,8,10,12,14], subdivision: 4, stepsPerBar: 16 },
    ],
    rnb: [
      { name: 'R&B Groove', kicks: [0, 5, 8, 13], snares: [4, 12], hiHats: [0,2,4,6,8,10,12,14], subdivision: 4, stepsPerBar: 16 },
    ],
    reggaeton: [
      { name: 'Dembow', kicks: [0, 3, 4, 7, 8, 11, 12, 15], snares: [3, 7, 11, 15], hiHats: [0,2,4,6,8,10,12,14], subdivision: 4, stepsPerBar: 16 },
    ],
    afrobeats: [
      { name: 'Afro Bounce', kicks: [0, 5, 10], snares: [4, 12], hiHats: [0,2,3,4,6,7,8,10,11,12,14,15], subdivision: 4, stepsPerBar: 16 },
    ],
    pop: [
      { name: 'Four on Floor', kicks: [0, 4, 8, 12], snares: [4, 12], hiHats: [0,2,4,6,8,10,12,14], subdivision: 4, stepsPerBar: 16 },
    ],
    edm: [
      { name: 'EDM Drive', kicks: [0, 4, 8, 12], snares: [4, 12], hiHats: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], subdivision: 4, stepsPerBar: 16 },
    ],
  };

  return patterns[key] ?? patterns['trap']!;
}
