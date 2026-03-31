import { z } from 'zod';
import { getGenre, listGenres, suggestGenre, getGenreRhythms } from '../engine/genres.js';

export const getGenreProfileSchema = {
  genre: z.string().describe('Genre name (e.g., "trap", "boom_bap", "lofi_hiphop", "rnb", "drill", "afrobeats", "jazz", "edm", "pop", "reggaeton", "gospel")'),
};

export async function getGenreProfileHandler({ genre }: { genre: string }) {
  try {
    const profile = getGenre(genre);
    const rhythms = getGenreRhythms(genre);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ...profile,
          rhythmPatterns: rhythms,
        }, null, 2),
      }],
    };
  } catch (e: any) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${e.message}\n\nAvailable genres: ${listGenres().join(', ')}` }],
      isError: true,
    };
  }
}

export const suggestGenreSchema = {
  bpm: z.number().optional().describe('Beats per minute'),
  key: z.string().optional().describe('Musical key (e.g., "C", "F#")'),
  mood: z.string().optional().describe('Mood keyword (e.g., "dark", "chill", "energetic")'),
  scale: z.string().optional().describe('Scale type (e.g., "natural_minor", "dorian")'),
};

export async function suggestGenreHandler(opts: { bpm?: number; key?: string; mood?: string; scale?: string }) {
  try {
    const results = suggestGenre(opts);
    if (results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No strong genre match. Try providing more parameters (bpm, key, mood, scale).' }] };
    }
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          query: opts,
          matches: results.map(r => ({
            genre: r.genre,
            score: r.score,
            reason: r.reason,
          })),
          bestMatch: results[0].genre,
        }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}

export const getGenreRhythmsSchema = {
  genre: z.string().describe('Genre name'),
};

export async function getGenreRhythmsHandler({ genre }: { genre: string }) {
  try {
    const rhythms = getGenreRhythms(genre);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ genre, patterns: rhythms }, null, 2),
      }],
    };
  } catch (e: any) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${e.message}\n\nAvailable genres: ${listGenres().join(', ')}` }],
      isError: true,
    };
  }
}
