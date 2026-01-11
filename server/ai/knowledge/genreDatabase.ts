// server/ai/knowledge/genreDatabase.ts
// Comprehensive genre knowledge base for AI music generation
// This module provides detailed specifications for 30+ music genres

export interface GenreSpec {
  name: string;
  bpmRange: [number, number];
  preferredKeys: string[];
  bassStyle: string;
  drumPattern: string;
  chordStyle: string;
  mood: string;
  instruments: string[];
  avoidInstruments: string[];
  productionTips: string[];
  referenceArtists: string[];
}

export const genreDatabase: Record<string, GenreSpec> = {
  // HIP-HOP & TRAP
  "trap": {
    name: "Trap",
    bpmRange: [130, 150],
    preferredKeys: ["Cm", "Am", "Dm", "Em", "Gm"],
    bassStyle: "808 bass with slides and long decay, sub-bass heavy",
    drumPattern: "Snare on beat 3, hi-hat rolls (1/32 notes), kick on 1 and 3",
    chordStyle: "Minor triads, dark pads, minimal chords, atmospheric",
    mood: "Dark, aggressive, energetic",
    instruments: ["808 bass", "synth pads", "hi-hats", "snare", "kick"],
    avoidInstruments: ["acoustic guitar", "piano", "strings"],
    productionTips: [
      "Layer multiple 808s for thickness",
      "Use sidechain compression on pads",
      "Hi-hat rolls on every other bar",
      "Keep mix sparse and spacious"
    ],
    referenceArtists: ["Metro Boomin", "Travis Scott", "Future", "21 Savage"]
  },

  "drill": {
    name: "Drill",
    bpmRange: [140, 150],
    preferredKeys: ["Cm", "Dm", "Am"],
    bassStyle: "Sliding 808s, aggressive sub-bass",
    drumPattern: "Snare on 3, double-time hi-hats, kick patterns with triplets",
    chordStyle: "Dark minor chords, dissonant intervals",
    mood: "Aggressive, menacing, dark",
    instruments: ["808 bass", "dark synths", "hi-hats", "snare"],
    avoidInstruments: ["melodic instruments", "bright sounds"],
    productionTips: [
      "Use sliding 808 patterns",
      "Double-time hi-hat patterns",
      "Keep melodies minimal and dark",
      "Heavy sidechain on everything"
    ],
    referenceArtists: ["Pop Smoke", "Chief Keef", "Fivio Foreign"]
  },

  "boom-bap": {
    name: "Boom Bap",
    bpmRange: [85, 95],
    preferredKeys: ["Am", "Em", "Dm", "Gm"],
    bassStyle: "Deep sub-bass, simple root notes",
    drumPattern: "Kick on 1 and 3, snare on 2 and 4, classic hip-hop swing",
    chordStyle: "Jazz samples, minor 7th chords, soul samples",
    mood: "Classic, nostalgic, gritty",
    instruments: ["sampled drums", "bass", "vinyl crackle", "jazz samples"],
    avoidInstruments: ["synths", "electronic sounds"],
    productionTips: [
      "Use vinyl crackle and warmth",
      "Sample jazz and soul records",
      "Swing quantization on drums",
      "Keep it raw and unpolished"
    ],
    referenceArtists: ["J Dilla", "DJ Premier", "Pete Rock", "MF DOOM"]
  },

  // ELECTRONIC
  "house": {
    name: "House",
    bpmRange: [120, 130],
    preferredKeys: ["Cmaj", "Gmaj", "Dmaj", "Amaj"],
    bassStyle: "Four-on-the-floor bass, pumping with sidechain",
    drumPattern: "Kick on every beat, hi-hats on offbeats, claps on 2 and 4",
    chordStyle: "Major 7th chords, disco-influenced, uplifting progressions",
    mood: "Uplifting, energetic, danceable",
    instruments: ["kick", "bass", "piano", "synth pads", "vocal chops"],
    avoidInstruments: ["heavy guitars", "aggressive synths"],
    productionTips: [
      "Heavy sidechain compression",
      "Four-on-the-floor kick pattern",
      "Filter sweeps on builds",
      "Vocal chops and samples"
    ],
    referenceArtists: ["Disclosure", "Duke Dumont", "Calvin Harris"]
  },

  "techno": {
    name: "Techno",
    bpmRange: [125, 135],
    preferredKeys: ["Am", "Em", "Dm"],
    bassStyle: "Driving bass line, repetitive, hypnotic",
    drumPattern: "Four-on-the-floor kick, minimal percussion, industrial hi-hats",
    chordStyle: "Minimal chords, dark pads, atmospheric",
    mood: "Dark, hypnotic, industrial",
    instruments: ["kick", "bass", "synths", "industrial sounds"],
    avoidInstruments: ["acoustic instruments", "melodic elements"],
    productionTips: [
      "Repetitive patterns",
      "Industrial sound design",
      "Minimal arrangement",
      "Heavy compression"
    ],
    referenceArtists: ["Amelie Lens", "Charlotte de Witte", "Adam Beyer"]
  },

  "dubstep": {
    name: "Dubstep",
    bpmRange: [140, 150],
    preferredKeys: ["Dm", "Am", "Em"],
    bassStyle: "Wobble bass, FM synthesis, aggressive modulation",
    drumPattern: "Half-time feel, snare on 3, syncopated hi-hats",
    chordStyle: "Dark minor chords, dissonant",
    mood: "Aggressive, heavy, dark",
    instruments: ["wobble bass", "synths", "drums", "sound effects"],
    avoidInstruments: ["acoustic instruments", "soft sounds"],
    productionTips: [
      "LFO modulation on bass",
      "Half-time drum pattern",
      "Build-ups with risers",
      "Heavy distortion and compression"
    ],
    referenceArtists: ["Skrillex", "Excision", "Virtual Riot"]
  },

  "future-bass": {
    name: "Future Bass",
    bpmRange: [140, 170],
    preferredKeys: ["Cmaj", "Gmaj", "Dmaj"],
    bassStyle: "Supersaw bass, bright and wide",
    drumPattern: "Trap-influenced, snare on 3, rolling hi-hats",
    chordStyle: "Major 7th chords, bright and uplifting",
    mood: "Uplifting, emotional, bright",
    instruments: ["supersaw synths", "vocal chops", "bright pads"],
    avoidInstruments: ["dark sounds", "aggressive elements"],
    productionTips: [
      "Wide stereo supersaws",
      "Vocal chop melodies",
      "Bright, uplifting chords",
      "Heavy sidechain on chords"
    ],
    referenceArtists: ["Flume", "Illenium", "San Holo"]
  },

  // CHILL & AMBIENT
  "lo-fi": {
    name: "Lo-Fi Hip-Hop",
    bpmRange: [70, 90],
    preferredKeys: ["Cmaj", "Gmaj", "Fmaj", "Dmaj"],
    bassStyle: "Jazz walking bass, warm and mellow",
    drumPattern: "Soft kick, gentle snare, vinyl crackle texture",
    chordStyle: "Jazz 7th chords (maj7, min7, dom7), warm and nostalgic",
    mood: "Relaxed, nostalgic, cozy",
    instruments: ["piano", "bass", "soft drums", "vinyl crackle", "ambient sounds"],
    avoidInstruments: ["aggressive synths", "loud drums"],
    productionTips: [
      "Add vinyl crackle and warmth",
      "Use jazz chord progressions",
      "Keep drums soft and behind the mix",
      "Tape saturation and bit crushing"
    ],
    referenceArtists: ["Nujabes", "J Dilla", "Jinsang", "Idealism"]
  },

  "ambient": {
    name: "Ambient",
    bpmRange: [60, 90],
    preferredKeys: ["Cmaj", "Gmaj", "Dmaj", "Amaj"],
    bassStyle: "Subtle bass drones, long sustained notes",
    drumPattern: "Minimal or no drums, focus on atmosphere",
    chordStyle: "Suspended chords, open voicings, ethereal pads",
    mood: "Peaceful, atmospheric, meditative",
    instruments: ["pads", "drones", "field recordings", "reverb"],
    avoidInstruments: ["drums", "bass", "percussive elements"],
    productionTips: [
      "Long reverb tails",
      "Layered pad textures",
      "Field recordings for atmosphere",
      "Slow chord changes"
    ],
    referenceArtists: ["Brian Eno", "Aphex Twin", "Boards of Canada"]
  },

  // LATIN & WORLD
  "reggaeton": {
    name: "Reggaeton",
    bpmRange: [90, 100],
    preferredKeys: ["Am", "Dm", "Em"],
    bassStyle: "Dembow rhythm bass, syncopated",
    drumPattern: "Dembow rhythm (boom-ch-boom-chick), signature reggaeton pattern",
    chordStyle: "Minor chords, Latin-influenced progressions",
    mood: "Danceable, sensual, energetic",
    instruments: ["dembow drums", "bass", "synths", "latin percussion"],
    avoidInstruments: ["rock instruments", "heavy guitars"],
    productionTips: [
      "Dembow rhythm is essential",
      "Syncopated bass patterns",
      "Latin percussion layers",
      "Vocal-focused mix"
    ],
    referenceArtists: ["Bad Bunny", "J Balvin", "Daddy Yankee"]
  },

  "afrobeats": {
    name: "Afrobeats",
    bpmRange: [100, 120],
    preferredKeys: ["Cmaj", "Gmaj", "Dmaj"],
    bassStyle: "Bouncy bass, syncopated patterns",
    drumPattern: "Log drums, shakers, complex polyrhythms",
    chordStyle: "Major chords, highlife-influenced guitar patterns",
    mood: "Uplifting, danceable, rhythmic",
    instruments: ["log drums", "shakers", "guitar", "synths", "bass"],
    avoidInstruments: ["heavy rock elements"],
    productionTips: [
      "Complex polyrhythmic patterns",
      "Bouncy, syncopated bass",
      "Highlife guitar patterns",
      "Layered percussion"
    ],
    referenceArtists: ["Burna Boy", "Wizkid", "Davido"]
  },

  // ROCK & ALTERNATIVE
  "rock": {
    name: "Rock",
    bpmRange: [110, 140],
    preferredKeys: ["E", "A", "D", "G"],
    bassStyle: "Root notes following guitar, punchy and present",
    drumPattern: "Standard rock beat, kick-snare-kick-snare, crash on 1",
    chordStyle: "Power chords, major and minor triads",
    mood: "Energetic, powerful, rebellious",
    instruments: ["electric guitar", "bass", "drums", "vocals"],
    avoidInstruments: ["electronic synths", "programmed drums"],
    productionTips: [
      "Distorted guitars",
      "Live drum feel",
      "Power chord progressions",
      "Dynamic arrangement"
    ],
    referenceArtists: ["Foo Fighters", "Arctic Monkeys", "The Strokes"]
  },

  "indie": {
    name: "Indie Rock",
    bpmRange: [100, 130],
    preferredKeys: ["C", "G", "D", "A"],
    bassStyle: "Melodic bass lines, following chord progressions",
    drumPattern: "Varied patterns, creative fills, dynamic",
    chordStyle: "Major and minor chords, jangly guitar tones",
    mood: "Introspective, creative, authentic",
    instruments: ["guitar", "bass", "drums", "synths", "vocals"],
    avoidInstruments: ["overly polished sounds"],
    productionTips: [
      "Jangly guitar tones",
      "Creative drum patterns",
      "Layered vocals",
      "Raw, authentic sound"
    ],
    referenceArtists: ["Tame Impala", "Mac DeMarco", "The Strokes"]
  },

  // POP & R&B
  "pop": {
    name: "Pop",
    bpmRange: [100, 130],
    preferredKeys: ["C", "G", "D", "A", "F"],
    bassStyle: "Simple, supportive bass following root notes",
    drumPattern: "Four-on-the-floor or standard pop beat, consistent",
    chordStyle: "I-V-vi-IV progression, major chords, uplifting",
    mood: "Uplifting, catchy, accessible",
    instruments: ["synths", "drums", "bass", "piano", "vocals"],
    avoidInstruments: ["overly experimental sounds"],
    productionTips: [
      "Catchy melodies and hooks",
      "Clear vocal production",
      "Polished, radio-ready sound",
      "Strong chorus sections"
    ],
    referenceArtists: ["Taylor Swift", "Dua Lipa", "The Weeknd"]
  },

  "r&b": {
    name: "R&B",
    bpmRange: [60, 90],
    preferredKeys: ["Cmaj", "Gmaj", "Dmaj", "Fmaj"],
    bassStyle: "Smooth, groovy bass lines, syncopated",
    drumPattern: "Laid-back groove, snare on 2 and 4, ghost notes",
    chordStyle: "7th chords, 9th chords, jazzy progressions",
    mood: "Smooth, sensual, emotional",
    instruments: ["bass", "drums", "keys", "synths", "vocals"],
    avoidInstruments: ["aggressive sounds", "heavy guitars"],
    productionTips: [
      "Smooth vocal production",
      "Jazzy chord progressions",
      "Laid-back groove",
      "Subtle harmonies"
    ],
    referenceArtists: ["The Weeknd", "SZA", "Frank Ocean", "Bryson Tiller"]
  },

  // EXPERIMENTAL
  "phonk": {
    name: "Phonk",
    bpmRange: [130, 160],
    preferredKeys: ["Cm", "Dm", "Am"],
    bassStyle: "Heavy 808 bass, Memphis-style",
    drumPattern: "Cowbell patterns, Memphis drum samples, lo-fi",
    chordStyle: "Dark minor chords, Memphis samples",
    mood: "Dark, gritty, nostalgic",
    instruments: ["808 bass", "cowbell", "Memphis samples", "vinyl crackle"],
    avoidInstruments: ["clean modern sounds"],
    productionTips: [
      "Use Memphis rap samples",
      "Cowbell is essential",
      "Lo-fi, gritty aesthetic",
      "Slowed and reverbed vocals"
    ],
    referenceArtists: ["DJ Smokey", "Soudiere", "KSLV Noh"]
  },

  "hyperpop": {
    name: "Hyperpop",
    bpmRange: [140, 180],
    preferredKeys: ["C", "G", "D", "A"],
    bassStyle: "Distorted, aggressive bass, heavily processed",
    drumPattern: "Glitchy, chopped drums, fast hi-hats",
    chordStyle: "Bright, distorted chords, heavily sidechained",
    mood: "Chaotic, energetic, experimental",
    instruments: ["distorted synths", "chopped vocals", "glitchy drums"],
    avoidInstruments: ["acoustic instruments", "natural sounds"],
    productionTips: [
      "Heavy vocal processing",
      "Extreme sidechain compression",
      "Glitchy, chopped elements",
      "Distortion on everything"
    ],
    referenceArtists: ["100 gecs", "Charli XCX", "Sophie"]
  },

  "vaporwave": {
    name: "Vaporwave",
    bpmRange: [60, 90],
    preferredKeys: ["Cmaj", "Fmaj", "Gmaj"],
    bassStyle: "Slowed, reverbed bass from 80s samples",
    drumPattern: "Slowed 80s drum machines, reverb-heavy",
    chordStyle: "80s synth chords, slowed and pitched down",
    mood: "Nostalgic, dreamy, surreal",
    instruments: ["80s synths", "slowed samples", "reverb", "pitch-shifted vocals"],
    avoidInstruments: ["modern sounds", "clean production"],
    productionTips: [
      "Sample 80s music and slow it down",
      "Heavy reverb and delay",
      "Pitch shift vocals down",
      "VHS aesthetic"
    ],
    referenceArtists: ["Macintosh Plus", "Saint Pepsi", "Blank Banshee"]
  },

  // K-POP & J-POP
  "k-pop": {
    name: "K-Pop",
    bpmRange: [110, 140],
    preferredKeys: ["C", "G", "D", "A"],
    bassStyle: "Punchy, modern bass, EDM-influenced",
    drumPattern: "EDM-influenced, trap hi-hats, dynamic changes",
    chordStyle: "Bright major chords, complex progressions",
    mood: "Energetic, catchy, polished",
    instruments: ["synths", "bass", "drums", "vocals", "bright pads"],
    avoidInstruments: ["dark or heavy sounds"],
    productionTips: [
      "Multiple genre influences in one song",
      "Catchy vocal hooks",
      "Polished, pristine production",
      "Dynamic arrangement changes"
    ],
    referenceArtists: ["BTS", "BLACKPINK", "NewJeans", "Stray Kids"]
  },

  "j-pop": {
    name: "J-Pop",
    bpmRange: [120, 150],
    preferredKeys: ["C", "G", "D", "F"],
    bassStyle: "Bright, melodic bass lines",
    drumPattern: "Energetic, varied patterns, anime-influenced",
    chordStyle: "Complex progressions, bright major chords",
    mood: "Upbeat, cute, energetic",
    instruments: ["synths", "guitars", "drums", "bright pads"],
    avoidInstruments: ["dark or aggressive sounds"],
    productionTips: [
      "Bright, colorful production",
      "Complex chord progressions",
      "Energetic vocal delivery",
      "Anime-influenced aesthetics"
    ],
    referenceArtists: ["Yoasobi", "Kenshi Yonezu", "Ado"]
  },

  // ADDITIONAL GENRES FOR MAXIMUM INTELLIGENCE

  "gospel": {
    name: "Gospel",
    bpmRange: [70, 120],
    preferredKeys: ["C", "G", "Bb", "Eb", "Ab"],
    bassStyle: "Walking bass, gospel runs, Hammond organ bass",
    drumPattern: "Shuffle feel, gospel groove, tambourine accents",
    chordStyle: "Extended chords (9ths, 11ths, 13ths), gospel voicings, passing chords",
    mood: "Uplifting, spiritual, powerful",
    instruments: ["piano", "organ", "bass", "drums", "choir"],
    avoidInstruments: ["heavy synths", "electronic sounds"],
    productionTips: [
      "Use gospel chord voicings with extensions",
      "Hammond organ is essential",
      "Call and response vocal patterns",
      "Build to powerful climaxes"
    ],
    referenceArtists: ["Kirk Franklin", "Tye Tribbett", "Fred Hammond"]
  },

  "country": {
    name: "Country",
    bpmRange: [90, 130],
    preferredKeys: ["G", "C", "D", "A", "E"],
    bassStyle: "Root-fifth patterns, walking bass, country shuffle",
    drumPattern: "Train beat, two-step, country shuffle",
    chordStyle: "Major triads, I-IV-V progressions, pedal steel bends",
    mood: "Heartfelt, storytelling, nostalgic",
    instruments: ["acoustic guitar", "electric guitar", "fiddle", "pedal steel", "bass"],
    avoidInstruments: ["heavy synths", "electronic drums"],
    productionTips: [
      "Acoustic guitar is foundational",
      "Pedal steel for authentic sound",
      "Storytelling lyrics",
      "Nashville number system"
    ],
    referenceArtists: ["Luke Combs", "Morgan Wallen", "Chris Stapleton"]
  },

  "metal": {
    name: "Metal",
    bpmRange: [100, 200],
    preferredKeys: ["E", "D", "C", "B", "A"],
    bassStyle: "Following guitar riffs, palm-muted, aggressive",
    drumPattern: "Double bass drums, blast beats, heavy snare",
    chordStyle: "Power chords, diminished, chromatic riffs",
    mood: "Aggressive, powerful, intense",
    instruments: ["distorted guitars", "bass", "drums", "growl vocals"],
    avoidInstruments: ["soft synths", "acoustic instruments"],
    productionTips: [
      "Heavy distortion on guitars",
      "Double bass drum patterns",
      "Drop tuning (Drop D, Drop C)",
      "Tight, precise playing"
    ],
    referenceArtists: ["Metallica", "Slipknot", "Avenged Sevenfold"]
  },

  "jazz": {
    name: "Jazz",
    bpmRange: [80, 180],
    preferredKeys: ["Bb", "Eb", "F", "C", "G"],
    bassStyle: "Walking bass, jazz lines, chromatic approach notes",
    drumPattern: "Swing ride pattern, brushes, jazz comping",
    chordStyle: "7th, 9th, 11th, 13th chords, ii-V-I progressions, tritone substitutions",
    mood: "Sophisticated, improvisational, smooth",
    instruments: ["piano", "upright bass", "drums", "saxophone", "trumpet"],
    avoidInstruments: ["heavy distortion", "electronic sounds"],
    productionTips: [
      "Swing feel is essential",
      "Use jazz voicings (rootless, shell)",
      "Leave space for improvisation",
      "ii-V-I is the foundation"
    ],
    referenceArtists: ["Miles Davis", "John Coltrane", "Herbie Hancock"]
  },

  "funk": {
    name: "Funk",
    bpmRange: [95, 115],
    preferredKeys: ["E", "A", "D", "G"],
    bassStyle: "Slap bass, syncopated, groove-focused, octave jumps",
    drumPattern: "Syncopated, ghost notes, tight hi-hat, one-drop",
    chordStyle: "7th and 9th chords, minimal changes, groove-focused",
    mood: "Groovy, danceable, rhythmic",
    instruments: ["bass", "drums", "guitar", "horns", "clavinet"],
    avoidInstruments: ["heavy distortion", "slow pads"],
    productionTips: [
      "The ONE is everything",
      "Syncopation creates the groove",
      "Slap bass is iconic",
      "Tight, locked rhythm section"
    ],
    referenceArtists: ["James Brown", "Parliament-Funkadelic", "Vulfpeck"]
  },

  "soul": {
    name: "Soul",
    bpmRange: [60, 100],
    preferredKeys: ["C", "F", "Bb", "Eb", "G"],
    bassStyle: "Motown bass lines, melodic, supportive",
    drumPattern: "Motown beat, tambourine, handclaps",
    chordStyle: "Major and minor 7ths, gospel influences, smooth progressions",
    mood: "Emotional, warm, heartfelt",
    instruments: ["piano", "bass", "drums", "horns", "strings"],
    avoidInstruments: ["heavy synths", "aggressive sounds"],
    productionTips: [
      "Warm, analog sound",
      "Horns for punctuation",
      "Emotional vocal delivery",
      "Motown-style arrangements"
    ],
    referenceArtists: ["Marvin Gaye", "Aretha Franklin", "Stevie Wonder"]
  },

  "edm": {
    name: "EDM",
    bpmRange: [125, 150],
    preferredKeys: ["Am", "Cm", "Dm", "Em"],
    bassStyle: "Sidechain bass, sub-bass drops, pluck bass",
    drumPattern: "Four-on-the-floor, build-ups, drops",
    chordStyle: "Supersaw chords, big room stabs, progressive builds",
    mood: "Energetic, euphoric, festival",
    instruments: ["synths", "drums", "bass", "risers", "impacts"],
    avoidInstruments: ["acoustic instruments", "soft sounds"],
    productionTips: [
      "Build-up and drop structure",
      "Heavy sidechain compression",
      "Supersaw leads",
      "White noise risers"
    ],
    referenceArtists: ["Martin Garrix", "Tiësto", "David Guetta"]
  },

  "dnb": {
    name: "Drum and Bass",
    bpmRange: [160, 180],
    preferredKeys: ["Am", "Dm", "Em", "Cm"],
    bassStyle: "Reese bass, sub-bass, wobble, neuro bass",
    drumPattern: "Breakbeat, amen break, fast hi-hats, syncopated snare",
    chordStyle: "Minor chords, atmospheric pads, dark progressions",
    mood: "Intense, energetic, dark",
    instruments: ["bass", "drums", "synths", "pads", "vocal chops"],
    avoidInstruments: ["acoustic instruments", "slow elements"],
    productionTips: [
      "Fast breakbeat patterns",
      "Heavy sub-bass",
      "Amen break variations",
      "Atmospheric pads for contrast"
    ],
    referenceArtists: ["Pendulum", "Chase & Status", "Sub Focus"]
  }
};

/**
 * Get genre specifications by name
 */
export function getGenreSpec(genreName: string): GenreSpec | null {
  const normalized = genreName.toLowerCase().replace(/\s+/g, "-");
  return genreDatabase[normalized] || null;
}

/**
 * Get all available genres
 */
export function getAllGenres(): string[] {
  return Object.keys(genreDatabase);
}

/**
 * Search genres by mood
 */
export function getGenresByMood(mood: string): GenreSpec[] {
  const moodLower = mood.toLowerCase();
  return Object.values(genreDatabase).filter(genre =>
    genre.mood.toLowerCase().includes(moodLower)
  );
}

/**
 * Search genres by BPM range
 */
export function getGenresByBPM(bpm: number): GenreSpec[] {
  return Object.values(genreDatabase).filter(genre =>
    bpm >= genre.bpmRange[0] && bpm <= genre.bpmRange[1]
  );
}

/**
 * Generate AI prompt enhancement from genre knowledge
 */
export function enhancePromptWithGenre(userPrompt: string, genre: string): string {
  const spec = getGenreSpec(genre);
  if (!spec) return userPrompt;

  const enhancement = `
Genre: ${spec.name}
BPM: ${spec.bpmRange[0]}-${spec.bpmRange[1]}
Key: Use ${spec.preferredKeys.join(", ")}
Bass: ${spec.bassStyle}
Drums: ${spec.drumPattern}
Chords: ${spec.chordStyle}
Mood: ${spec.mood}
Instruments: ${spec.instruments.join(", ")}
Avoid: ${spec.avoidInstruments.join(", ")}
Production Tips: ${spec.productionTips.join(". ")}

User Request: ${userPrompt}

Generate music that strictly follows these genre specifications.
`;

  return enhancement;
}

/**
 * Get genre recommendations based on user input
 */
export function recommendGenres(keywords: string[]): GenreSpec[] {
  const keywordsLower = keywords.map(k => k.toLowerCase());
  const scores = new Map<string, number>();

  Object.entries(genreDatabase).forEach(([key, spec]) => {
    let score = 0;
    const searchText = `${spec.name} ${spec.mood} ${spec.instruments.join(" ")} ${spec.bassStyle} ${spec.drumPattern}`.toLowerCase();

    keywordsLower.forEach(keyword => {
      if (searchText.includes(keyword)) {
        score += 1;
      }
    });

    if (score > 0) {
      scores.set(key, score);
    }
  });

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => genreDatabase[key]);
}
