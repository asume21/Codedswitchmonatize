// server/ai/knowledge/musicTheory.ts
// Comprehensive music theory knowledge base for AI composition

export interface ChordProgression {
  name: string;
  pattern: string[];
  description: string;
  mood: string;
  genres: string[];
  examples: string[];
}

export interface Scale {
  name: string;
  intervals: number[];
  mood: string;
  description: string;
  commonIn: string[];
}

export interface VoiceLeadingRule {
  rule: string;
  description: string;
  example: string;
}

// Popular chord progressions
export const chordProgressions: Record<string, ChordProgression> = {
  "I-V-vi-IV": {
    name: "I-V-vi-IV (Pop Progression)",
    pattern: ["I", "V", "vi", "IV"],
    description: "The most popular progression in modern pop music. Uplifting and memorable.",
    mood: "Uplifting, catchy, emotional",
    genres: ["pop", "rock", "indie", "country"],
    examples: ["Let It Be - Beatles", "Don't Stop Believin' - Journey", "Someone Like You - Adele"]
  },
  
  "I-vi-IV-V": {
    name: "I-vi-IV-V (50s Progression)",
    pattern: ["I", "vi", "IV", "V"],
    description: "Classic doo-wop progression. Nostalgic and timeless.",
    mood: "Nostalgic, romantic, classic",
    genres: ["doo-wop", "oldies", "pop"],
    examples: ["Stand By Me - Ben E. King", "Every Breath You Take - The Police"]
  },
  
  "ii-V-I": {
    name: "ii-V-I (Jazz Progression)",
    pattern: ["ii", "V", "I"],
    description: "The foundation of jazz harmony. Creates strong resolution.",
    mood: "Sophisticated, resolved, jazzy",
    genres: ["jazz", "r&b", "soul", "lo-fi"],
    examples: ["Autumn Leaves", "All The Things You Are", "Fly Me To The Moon"]
  },
  
  "I-IV-V": {
    name: "I-IV-V (Blues Progression)",
    pattern: ["I", "IV", "V"],
    description: "The backbone of blues and rock. Simple and powerful.",
    mood: "Raw, powerful, bluesy",
    genres: ["blues", "rock", "country"],
    examples: ["Johnny B. Goode - Chuck Berry", "La Bamba - Ritchie Valens"]
  },
  
  "vi-IV-I-V": {
    name: "vi-IV-I-V (Sensitive Progression)",
    pattern: ["vi", "IV", "I", "V"],
    description: "Emotional and introspective. Popular in ballads.",
    mood: "Emotional, introspective, melancholic",
    genres: ["pop", "ballad", "indie"],
    examples: ["Grenade - Bruno Mars", "Apologize - OneRepublic"]
  },
  
  "I-bVII-IV": {
    name: "I-bVII-IV (Modal Progression)",
    pattern: ["I", "bVII", "IV"],
    description: "Mixolydian mode. Creates a floating, unresolved feeling.",
    mood: "Floating, unresolved, modern",
    genres: ["rock", "indie", "alternative"],
    examples: ["Sweet Child O' Mine - Guns N' Roses", "Clocks - Coldplay"]
  },
  
  "i-bVII-bVI-V": {
    name: "i-bVII-bVI-V (Andalusian Cadence)",
    pattern: ["i", "bVII", "bVI", "V"],
    description: "Spanish/flamenco progression. Dramatic and descending.",
    mood: "Dramatic, Spanish, descending",
    genres: ["flamenco", "metal", "progressive"],
    examples: ["Hit The Road Jack", "Smooth - Santana"]
  },
  
  "I-iii-IV-iv": {
    name: "I-iii-IV-iv (Chromatic Progression)",
    pattern: ["I", "iii", "IV", "iv"],
    description: "Uses chromatic mediant. Creates unexpected emotional shift.",
    mood: "Bittersweet, unexpected, emotional",
    genres: ["indie", "alternative", "pop"],
    examples: ["Creep - Radiohead", "Space Oddity - David Bowie"]
  },
  
  "i-iv-VII-III": {
    name: "i-iv-VII-III (Minor Progression)",
    pattern: ["i", "iv", "VII", "III"],
    description: "Natural minor progression. Dark and powerful.",
    mood: "Dark, powerful, minor",
    genres: ["metal", "rock", "electronic"],
    examples: ["Stairway to Heaven - Led Zeppelin"]
  },
  
  "I-V-vi-iii-IV-I-IV-V": {
    name: "Canon Progression",
    pattern: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"],
    description: "Pachelbel's Canon. Timeless and elegant.",
    mood: "Elegant, timeless, classical",
    genres: ["classical", "pop", "wedding"],
    examples: ["Canon in D - Pachelbel", "Basket Case - Green Day"]
  }
};

// Musical scales and modes
export const scales: Record<string, Scale> = {
  "major": {
    name: "Major (Ionian)",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    mood: "Happy, bright, uplifting",
    description: "The most common scale. Creates a happy, resolved feeling.",
    commonIn: ["pop", "country", "folk", "classical"]
  },
  
  "natural-minor": {
    name: "Natural Minor (Aeolian)",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    mood: "Sad, melancholic, introspective",
    description: "The relative minor. Creates a sad, introspective mood.",
    commonIn: ["rock", "metal", "classical", "folk"]
  },
  
  "harmonic-minor": {
    name: "Harmonic Minor",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    mood: "Exotic, dramatic, Middle Eastern",
    description: "Minor scale with raised 7th. Creates exotic, dramatic tension.",
    commonIn: ["classical", "metal", "flamenco", "middle-eastern"]
  },
  
  "melodic-minor": {
    name: "Melodic Minor",
    intervals: [0, 2, 3, 5, 7, 9, 11],
    mood: "Jazzy, sophisticated, ascending",
    description: "Minor scale with raised 6th and 7th. Jazz favorite.",
    commonIn: ["jazz", "fusion", "progressive"]
  },
  
  "dorian": {
    name: "Dorian",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    mood: "Jazzy, funky, sophisticated",
    description: "Minor mode with raised 6th. Jazzy and funky.",
    commonIn: ["jazz", "funk", "r&b", "lo-fi"]
  },
  
  "phrygian": {
    name: "Phrygian",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    mood: "Spanish, dark, exotic",
    description: "Minor mode with lowered 2nd. Spanish/flamenco sound.",
    commonIn: ["flamenco", "metal", "spanish", "middle-eastern"]
  },
  
  "lydian": {
    name: "Lydian",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    mood: "Dreamy, floating, ethereal",
    description: "Major mode with raised 4th. Dreamy and floating.",
    commonIn: ["film-scores", "ambient", "progressive"]
  },
  
  "mixolydian": {
    name: "Mixolydian",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    mood: "Bluesy, rock, unresolved",
    description: "Major mode with lowered 7th. Bluesy and rock-oriented.",
    commonIn: ["rock", "blues", "folk", "country"]
  },
  
  "locrian": {
    name: "Locrian",
    intervals: [0, 1, 3, 5, 6, 8, 10],
    mood: "Unstable, dissonant, tense",
    description: "The darkest mode. Unstable and rarely used.",
    commonIn: ["metal", "experimental", "avant-garde"]
  },
  
  "pentatonic-major": {
    name: "Major Pentatonic",
    intervals: [0, 2, 4, 7, 9],
    mood: "Simple, folk, universal",
    description: "5-note scale. Simple and universally pleasing.",
    commonIn: ["folk", "country", "pop", "rock"]
  },
  
  "pentatonic-minor": {
    name: "Minor Pentatonic",
    intervals: [0, 3, 5, 7, 10],
    mood: "Bluesy, rock, simple",
    description: "5-note minor scale. Foundation of blues and rock.",
    commonIn: ["blues", "rock", "metal", "funk"]
  },
  
  "blues": {
    name: "Blues Scale",
    intervals: [0, 3, 5, 6, 7, 10],
    mood: "Bluesy, soulful, expressive",
    description: "Minor pentatonic with added blue note. Soulful and expressive.",
    commonIn: ["blues", "jazz", "rock", "r&b"]
  }
};

// Voice leading rules
export const voiceLeadingRules: VoiceLeadingRule[] = [
  {
    rule: "Move by smallest interval",
    description: "When moving between chords, each voice should move by the smallest possible interval.",
    example: "C major (C-E-G) to F major (C-F-A): Keep C, move E→F (step), move G→A (step)"
  },
  {
    rule: "Avoid parallel fifths and octaves",
    description: "Two voices should not move in parallel perfect fifths or octaves.",
    example: "Avoid: C-G moving to D-A (parallel fifths)"
  },
  {
    rule: "Resolve leading tones",
    description: "The 7th scale degree (leading tone) should resolve up to the tonic.",
    example: "In C major: B should resolve to C"
  },
  {
    rule: "Common tone retention",
    description: "If two chords share a common note, keep it in the same voice.",
    example: "C major (C-E-G) to A minor (A-C-E): Keep C and E in same voices"
  },
  {
    rule: "Contrary motion preferred",
    description: "When outer voices move in opposite directions, it creates independence.",
    example: "Bass moves down while soprano moves up"
  },
  {
    rule: "Avoid voice crossing",
    description: "Higher voices should stay above lower voices.",
    example: "Don't let alto go below tenor"
  },
  {
    rule: "Resolve dissonance",
    description: "Dissonant intervals (7ths, 2nds) should resolve to consonant intervals.",
    example: "Dominant 7th chord resolves to tonic"
  }
];

// Circle of Fifths
export const circleOfFifths = {
  major: ["C", "G", "D", "A", "E", "B", "F#/Gb", "Db", "Ab", "Eb", "Bb", "F"],
  minor: ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m/Ebm", "Bbm", "Fm", "Cm", "Gm", "Dm"]
};

// Key signatures (number of sharps/flats)
export const keySignatures: Record<string, { sharps?: number; flats?: number }> = {
  "C": {},
  "G": { sharps: 1 },
  "D": { sharps: 2 },
  "A": { sharps: 3 },
  "E": { sharps: 4 },
  "B": { sharps: 5 },
  "F#": { sharps: 6 },
  "F": { flats: 1 },
  "Bb": { flats: 2 },
  "Eb": { flats: 3 },
  "Ab": { flats: 4 },
  "Db": { flats: 5 },
  "Gb": { flats: 6 }
};

/**
 * Get chord progressions suitable for a genre
 */
export function getProgressionsForGenre(genre: string): ChordProgression[] {
  const genreLower = genre.toLowerCase();
  return Object.values(chordProgressions).filter(prog =>
    prog.genres.some(g => g.includes(genreLower) || genreLower.includes(g))
  );
}

/**
 * Get scales suitable for a mood
 */
export function getScalesForMood(mood: string): Scale[] {
  const moodLower = mood.toLowerCase();
  return Object.values(scales).filter(scale =>
    scale.mood.toLowerCase().includes(moodLower)
  );
}

/**
 * Get relative minor/major key
 */
export function getRelativeKey(key: string): string {
  const majorToMinor: Record<string, string> = {
    "C": "Am", "G": "Em", "D": "Bm", "A": "F#m", "E": "C#m", "B": "G#m",
    "F#": "D#m", "Db": "Bbm", "Ab": "Fm", "Eb": "Cm", "Bb": "Gm", "F": "Dm"
  };
  
  const minorToMajor: Record<string, string> = {
    "Am": "C", "Em": "G", "Bm": "D", "F#m": "A", "C#m": "E", "G#m": "B",
    "D#m": "F#", "Bbm": "Db", "Fm": "Ab", "Cm": "Eb", "Gm": "Bb", "Dm": "F"
  };
  
  return majorToMinor[key] || minorToMajor[key] || key;
}

/**
 * Get parallel minor/major key
 */
export function getParallelKey(key: string): string {
  if (key.includes("m")) {
    return key.replace("m", "");
  } else {
    return key + "m";
  }
}

/**
 * Transpose chord progression to different key
 */
export function transposeProgression(progression: string[], fromKey: string, toKey: string): string[] {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const fromIndex = notes.indexOf(fromKey.replace("m", ""));
  const toIndex = notes.indexOf(toKey.replace("m", ""));
  const interval = (toIndex - fromIndex + 12) % 12;
  
  // This is a simplified version - real implementation would need more complex logic
  return progression;
}

/**
 * Generate AI prompt enhancement with music theory knowledge
 */
export function enhancePromptWithMusicTheory(
  userPrompt: string,
  genre: string,
  key?: string,
  mood?: string
): string {
  const progressions = getProgressionsForGenre(genre);
  const moodScales = mood ? getScalesForMood(mood) : [];
  
  let enhancement = `\n\n🎼 MUSIC THEORY KNOWLEDGE:\n`;
  
  if (progressions.length > 0) {
    enhancement += `\nRECOMMENDED CHORD PROGRESSIONS for ${genre}:\n`;
    progressions.slice(0, 3).forEach(prog => {
      enhancement += `- ${prog.name}: ${prog.pattern.join(" → ")} (${prog.mood})\n`;
      enhancement += `  Example: ${prog.examples[0]}\n`;
    });
  }
  
  if (moodScales.length > 0) {
    enhancement += `\nRECOMMENDED SCALES for "${mood}" mood:\n`;
    moodScales.slice(0, 3).forEach(scale => {
      enhancement += `- ${scale.name}: ${scale.description}\n`;
    });
  }
  
  if (key) {
    const relativeKey = getRelativeKey(key);
    const parallelKey = getParallelKey(key);
    enhancement += `\nKEY RELATIONSHIPS:\n`;
    enhancement += `- Current Key: ${key}\n`;
    enhancement += `- Relative Key: ${relativeKey} (shares same notes, different tonal center)\n`;
    enhancement += `- Parallel Key: ${parallelKey} (same tonic, different mode)\n`;
  }
  
  enhancement += `\nVOICE LEADING RULES:\n`;
  voiceLeadingRules.slice(0, 3).forEach(rule => {
    enhancement += `- ${rule.rule}: ${rule.description}\n`;
  });
  
  enhancement += `\nApply these music theory principles to create professional, musically correct arrangements.\n`;
  
  return userPrompt + enhancement;
}

/**
 * Validate chord progression makes musical sense
 */
export function validateChordProgression(chords: string[]): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check if progression is too repetitive
  const uniqueChords = new Set(chords);
  if (uniqueChords.size === 1) {
    issues.push("Progression uses only one chord - needs more variety");
  }
  
  // Check if progression is too long without resolution
  if (chords.length > 16) {
    issues.push("Progression is very long - consider adding resolution points");
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Suggest next chord based on current chord and key
 */
export function suggestNextChord(currentChord: string, key: string): string[] {
  // Simplified version - real implementation would use more complex logic
  const commonProgressions = [
    ["I", "IV"], ["I", "V"], ["I", "vi"],
    ["IV", "I"], ["IV", "V"], ["IV", "ii"],
    ["V", "I"], ["V", "vi"],
    ["vi", "IV"], ["vi", "V"], ["vi", "ii"]
  ];
  
  return ["I", "IV", "V", "vi"]; // Placeholder
}
