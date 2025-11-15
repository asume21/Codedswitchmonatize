/**
 * Genre Configurations
 * Defines musical characteristics for each genre
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
    bpm: 120,
    instruments: ['piano', 'synth', 'drums'],
    style: 'bright',
  },

  rock: {
    id: 'rock',
    name: 'rock',
    displayName: 'Rock',
    icon: '🎸',
    description: 'Energetic, guitar-driven',
    chords: ['C5', 'G5', 'Am5', 'F5'], // Power chords
    bpm: 150,
    instruments: ['electric_guitar', 'bass', 'drums'],
    style: 'driving',
  },

  hiphop: {
    id: 'hiphop',
    name: 'hiphop',
    displayName: 'Hip-Hop',
    icon: '🎧',
    description: 'Laid back beats, groovy',
    chords: ['C', 'G', 'Am', 'F'],
    bpm: 90,
    instruments: ['808_bass', 'hi_hats', 'snare'],
    style: 'laid_back',
    drumPattern: 'trap',
  },

  edm: {
    id: 'edm',
    name: 'edm',
    displayName: 'EDM',
    icon: '🎹',
    description: 'Electronic, high energy',
    chords: ['C', 'G', 'Am', 'F'],
    bpm: 128,
    instruments: ['synth_lead', 'synth_pad', 'kick'],
    style: 'building',
    special: {
      hasDrop: true,
      buildupDuration: 8,
    },
  },

  rnb: {
    id: 'rnb',
    name: 'rnb',
    displayName: 'R&B',
    icon: '🎵',
    description: 'Smooth, soulful',
    chords: ['Cmaj7', 'G7', 'Am7', 'Fmaj7'], // 7th chords for sophistication
    bpm: 80,
    instruments: ['rhodes', 'bass', 'soft_drums'],
    style: 'smooth',
  },

  country: {
    id: 'country',
    name: 'country',
    displayName: 'Country',
    icon: '🤠',
    description: 'Acoustic, storytelling',
    chords: ['C', 'G', 'Am', 'F'],
    bpm: 110,
    instruments: ['acoustic_guitar', 'banjo', 'drums'],
    style: 'twangy',
  },
};

// Helper to get genre config with fallback
export function getGenreConfig(genreId: string): GenreConfig {
  return GENRE_CONFIGS[genreId] || GENRE_CONFIGS.pop;
}

// List of all available genres
export const AVAILABLE_GENRES = Object.values(GENRE_CONFIGS);

// Default genre
export const DEFAULT_GENRE = 'pop';
