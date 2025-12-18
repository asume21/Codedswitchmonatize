/**
 * Genre Configurations - Enhanced
 * Defines rich musical characteristics for each genre
 * Includes multiple chord progressions, scales, and style variations
 */

import type { GenreConfig } from '../../../shared/types/codeToMusic';

export const GENRE_CONFIGS: Record<string, GenreConfig> = {
  pop: {
    id: 'pop',
    name: 'pop',
    displayName: 'Pop',
    icon: '🎤',
    description: 'Catchy, upbeat, radio-friendly',
    chords: ['C', 'G', 'Am', 'F'],
    progressions: [
      ['C', 'G', 'Am', 'F'],           // Classic I-V-vi-IV
      ['Am', 'F', 'C', 'G'],           // vi-IV-I-V (emotional)
      ['C', 'Am', 'F', 'G'],           // I-vi-IV-V
      ['C', 'F', 'Am', 'G'],           // I-IV-vi-V
      ['C', 'G', 'F', 'Am'],           // I-V-IV-vi
    ],
    scales: ['major', 'pentatonicMajor'],
    moodMap: {
      happy: ['C', 'G', 'Am', 'F'],
      sad: ['Am', 'F', 'C', 'G'],
      energetic: ['C', 'G', 'F', 'C'],
      calm: ['C', 'Am', 'Dm', 'G'],
    },
    bpm: 120,
    instruments: ['piano', 'synth', 'drums', 'bass'],
    style: 'bright',
    rhythmicFeel: 'straight',
    harmonicDensity: 'moderate',
    melodicRange: 'medium',
    tension: 3,
  },

  rock: {
    id: 'rock',
    name: 'rock',
    displayName: 'Rock',
    icon: '🎸',
    description: 'Energetic, guitar-driven power',
    chords: ['C5', 'G5', 'Am5', 'F5'],
    progressions: [
      ['C5', 'G5', 'Am5', 'F5'],       // Power chord classic
      ['E5', 'A5', 'D5', 'A5'],        // Open power
      ['G5', 'C5', 'D5', 'C5'],        // Arena rock
      ['A5', 'D5', 'E5', 'D5'],        // Hard rock
      ['E5', 'G5', 'A5', 'C5'],        // Punk progression
    ],
    scales: ['pentatonicMinor', 'blues', 'minor'],
    moodMap: {
      happy: ['G5', 'C5', 'D5', 'G5'],
      sad: ['Am5', 'F5', 'C5', 'G5'],
      energetic: ['E5', 'A5', 'D5', 'E5'],
      calm: ['Am5', 'Em5', 'G5', 'D5'],
    },
    bpm: 140,
    instruments: ['electric_guitar', 'bass', 'drums', 'synth'],
    style: 'driving',
    rhythmicFeel: 'driving',
    harmonicDensity: 'sparse',
    melodicRange: 'wide',
    tension: 7,
  },

  hiphop: {
    id: 'hiphop',
    name: 'hiphop',
    displayName: 'Hip-Hop',
    icon: '🎧',
    description: 'Laid back beats, groovy bass',
    chords: ['Cm7', 'Fm7', 'Gm7', 'Abmaj7'],
    progressions: [
      ['Cm7', 'Fm7', 'Gm7', 'Abmaj7'],     // Neo-soul hip-hop
      ['Am7', 'Em7', 'Dm7', 'Am7'],         // Lo-fi vibes
      ['Dm7', 'Gm7', 'C7', 'Fmaj7'],        // Jazz-hop
      ['Gm7', 'Cm7', 'Fm7', 'Bb7'],         // Smooth trap
      ['Em7', 'Am7', 'Dm7', 'G7'],          // Boom bap
    ],
    scales: ['minor', 'pentatonicMinor', 'dorian'],
    moodMap: {
      happy: ['Fmaj7', 'Am7', 'Dm7', 'Cmaj7'],
      sad: ['Am7', 'Dm7', 'Em7', 'Am7'],
      energetic: ['Gm7', 'Cm7', 'Fm7', 'Bb'],
      calm: ['Cmaj7', 'Am7', 'Fmaj7', 'G7'],
    },
    bpm: 90,
    instruments: ['808_bass', 'hi_hats', 'snare', 'piano', 'synth'],
    style: 'laid_back',
    drumPattern: 'trap',
    rhythmicFeel: 'syncopated',
    harmonicDensity: 'rich',
    melodicRange: 'narrow',
    tension: 4,
  },

  edm: {
    id: 'edm',
    name: 'edm',
    displayName: 'EDM',
    icon: '🎹',
    description: 'Electronic, high energy builds',
    chords: ['Am', 'F', 'C', 'G'],
    progressions: [
      ['Am', 'F', 'C', 'G'],           // Festival anthem
      ['Cm', 'Ab', 'Eb', 'Bb'],        // Big room
      ['Fm', 'Db', 'Ab', 'Eb'],        // Progressive house
      ['Am', 'Em', 'G', 'D'],          // Trance
      ['Dm', 'Bb', 'F', 'C'],          // Melodic dubstep
    ],
    scales: ['minor', 'harmonicMinor', 'phrygian'],
    moodMap: {
      happy: ['C', 'G', 'Am', 'F'],
      sad: ['Am', 'Em', 'Dm', 'Am'],
      energetic: ['Am', 'F', 'C', 'G'],
      calm: ['Fmaj7', 'Am7', 'Cmaj7', 'G'],
    },
    bpm: 128,
    instruments: ['synth_lead', 'synth_pad', 'supersaw', 'kick', 'bass'],
    style: 'building',
    special: {
      hasDrop: true,
      buildupDuration: 8,
      dropIntensity: 10,
    },
    rhythmicFeel: 'driving',
    harmonicDensity: 'moderate',
    melodicRange: 'wide',
    tension: 8,
  },

  rnb: {
    id: 'rnb',
    name: 'rnb',
    displayName: 'R&B',
    icon: '🎵',
    description: 'Smooth, soulful, sophisticated',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'],
    progressions: [
      ['Cmaj7', 'Am7', 'Dm7', 'G7'],        // Classic R&B
      ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],     // Neo-soul
      ['Am7', 'Dm7', 'Gmaj7', 'Cmaj7'],     // Jazzy R&B
      ['Ebmaj7', 'Cm7', 'Fm7', 'Bb7'],      // Motown feel
      ['Dmaj7', 'Bm7', 'Em7', 'A7'],        // Smooth groove
    ],
    scales: ['major', 'dorian', 'mixolydian'],
    moodMap: {
      happy: ['Fmaj7', 'Dm7', 'Cmaj7', 'G7'],
      sad: ['Am7', 'Dm7', 'Em7', 'Am7'],
      energetic: ['Gmaj7', 'Em7', 'Am7', 'D7'],
      calm: ['Cmaj7', 'Fmaj7', 'Em7', 'Am7'],
    },
    bpm: 85,
    instruments: ['rhodes', 'bass', 'soft_drums', 'strings', 'pad'],
    style: 'smooth',
    rhythmicFeel: 'swung',
    harmonicDensity: 'rich',
    melodicRange: 'medium',
    tension: 3,
  },

  country: {
    id: 'country',
    name: 'country',
    displayName: 'Country',
    icon: '🤠',
    description: 'Acoustic, heartfelt storytelling',
    chords: ['G', 'C', 'D', 'Em'],
    progressions: [
      ['G', 'C', 'D', 'G'],            // Classic country
      ['C', 'G', 'Am', 'F'],           // Country pop
      ['D', 'G', 'A', 'D'],            // Nashville
      ['G', 'Em', 'C', 'D'],           // Modern country
      ['A', 'D', 'E', 'A'],            // Texas country
    ],
    scales: ['major', 'pentatonicMajor', 'mixolydian'],
    moodMap: {
      happy: ['G', 'C', 'D', 'G'],
      sad: ['Am', 'F', 'C', 'G'],
      energetic: ['D', 'G', 'A', 'D'],
      calm: ['G', 'Em', 'C', 'D'],
    },
    bpm: 110,
    instruments: ['acoustic_guitar', 'banjo', 'fiddle', 'bass', 'drums'],
    style: 'twangy',
    rhythmicFeel: 'straight',
    harmonicDensity: 'sparse',
    melodicRange: 'medium',
    tension: 2,
  },

  jazz: {
    id: 'jazz',
    name: 'jazz',
    displayName: 'Jazz',
    icon: '🎺',
    description: 'Sophisticated, improvisational',
    chords: ['Dm7', 'G7', 'Cmaj7', 'A7'],
    progressions: [
      ['Dm7', 'G7', 'Cmaj7', 'A7'],         // ii-V-I-VI
      ['Cmaj7', 'Am7', 'Dm7', 'G7'],        // I-vi-ii-V
      ['Fmaj7', 'Bbmaj7', 'Em7b5', 'A7'],   // Jazz standard
      ['Dm7', 'Db7', 'Cmaj7', 'B7'],        // Tritone sub
      ['Am7', 'D7', 'Gmaj7', 'Cmaj7'],      // Circle of 5ths
    ],
    scales: ['dorian', 'mixolydian', 'bebop'],
    moodMap: {
      happy: ['Cmaj7', 'Am7', 'Dm7', 'G7'],
      sad: ['Dm7b5', 'G7b9', 'Cm7', 'Fm7'],
      energetic: ['Dm7', 'G7', 'Cmaj7', 'A7'],
      calm: ['Cmaj9', 'Fmaj9', 'Dm9', 'G13'],
    },
    bpm: 120,
    instruments: ['piano', 'upright_bass', 'drums', 'trumpet', 'sax'],
    style: 'swinging',
    rhythmicFeel: 'swung',
    harmonicDensity: 'rich',
    melodicRange: 'wide',
    tension: 6,
  },

  lofi: {
    id: 'lofi',
    name: 'lofi',
    displayName: 'Lo-Fi',
    icon: '📻',
    description: 'Chill, nostalgic, study beats',
    chords: ['Am7', 'Dm7', 'Em7', 'Fmaj7'],
    progressions: [
      ['Am7', 'Dm7', 'Em7', 'Fmaj7'],       // Classic lo-fi
      ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7'],     // Dreamy
      ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],     // Descending
      ['Am9', 'Dm9', 'Gmaj7', 'Cmaj7'],     // Extended chords
      ['Em7', 'Am7', 'Dm7', 'G7'],          // Melancholic
    ],
    scales: ['dorian', 'minor', 'pentatonicMinor'],
    moodMap: {
      happy: ['Fmaj7', 'Em7', 'Am7', 'Dm7'],
      sad: ['Am7', 'Em7', 'Dm7', 'Am7'],
      energetic: ['Dm7', 'Gm7', 'Am7', 'Em7'],
      calm: ['Cmaj9', 'Am9', 'Fmaj9', 'G7'],
    },
    bpm: 75,
    instruments: ['rhodes', 'piano', 'bass', 'vinyl_drums', 'pad'],
    style: 'nostalgic',
    rhythmicFeel: 'swung',
    harmonicDensity: 'moderate',
    melodicRange: 'narrow',
    tension: 2,
  },

  classical: {
    id: 'classical',
    name: 'classical',
    displayName: 'Classical',
    icon: '🎻',
    description: 'Orchestral, timeless elegance',
    chords: ['C', 'G', 'Am', 'F'],
    progressions: [
      ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'],   // Extended classical
      ['Am', 'Dm', 'G', 'C', 'F', 'Bdim', 'E', 'Am'],
      ['C', 'Am', 'Dm', 'G7', 'C', 'F', 'G7', 'C'],
      ['Dm', 'A', 'Dm', 'Gm', 'A7', 'Dm'],          // Baroque
      ['C', 'F', 'Dm', 'G', 'Em', 'Am', 'D', 'G'],  // Romantic
    ],
    scales: ['major', 'minor', 'harmonicMinor'],
    moodMap: {
      happy: ['C', 'G', 'F', 'C'],
      sad: ['Am', 'Dm', 'E', 'Am'],
      energetic: ['D', 'A', 'Bm', 'G'],
      calm: ['C', 'Em', 'Am', 'G'],
    },
    bpm: 90,
    instruments: ['piano', 'strings', 'woodwinds', 'brass'],
    style: 'orchestral',
    rhythmicFeel: 'straight',
    harmonicDensity: 'rich',
    melodicRange: 'wide',
    tension: 5,
  },
};

// Helper to get genre config with fallback
export function getGenreConfig(genreId: string): GenreConfig {
  return GENRE_CONFIGS[genreId] || GENRE_CONFIGS.pop;
}

// Get chord progression based on mood
export function getProgressionForMood(genreId: string, mood: string, variation: number = 0): string[] {
  const config = getGenreConfig(genreId);
  
  // Check mood-specific progression first
  if (config.moodMap && config.moodMap[mood]) {
    return config.moodMap[mood];
  }
  
  // Fall back to variation-based selection from progressions array
  if (config.progressions && config.progressions.length > 0) {
    const progIndex = variation % config.progressions.length;
    return config.progressions[progIndex];
  }
  
  // Ultimate fallback to default chords
  return config.chords;
}

// List of all available genres
export const AVAILABLE_GENRES = Object.values(GENRE_CONFIGS);

// Default genre
export const DEFAULT_GENRE = 'pop';
