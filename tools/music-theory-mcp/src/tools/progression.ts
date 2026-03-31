import { z } from 'zod';
import { resolveProgression, suggestNextChord, getDiatonicChords } from '../engine/core.js';

export const resolveProgressionSchema = {
  key: z.string().describe('Key root note (e.g., "C", "F#")'),
  numerals: z.array(z.string()).describe('Chord progression as Roman numerals (e.g., ["I", "V", "vi", "IV"])'),
  mode: z.enum(['major', 'minor']).default('major').describe('Major or minor key'),
};

export async function resolveProgressionHandler({ key, numerals, mode }: { key: string; numerals: string[]; mode: 'major' | 'minor' }) {
  try {
    const chords = resolveProgression(key, numerals, mode);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          key: `${key} ${mode}`,
          progression: chords.map(c => ({
            numeral: c.numeral,
            chord: c.symbol,
            notes: c.notes,
          })),
        }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}

export const suggestNextChordSchema = {
  current_numeral: z.string().describe('Current chord as Roman numeral (e.g., "V", "vi")'),
  key: z.string().describe('Key root note'),
  mode: z.enum(['major', 'minor']).default('major'),
};

export async function suggestNextChordHandler({ current_numeral, key, mode }: { current_numeral: string; key: string; mode: 'major' | 'minor' }) {
  try {
    const suggestions = suggestNextChord(current_numeral, key, mode);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          currentChord: current_numeral,
          key: `${key} ${mode}`,
          suggestions: suggestions.map(s => ({
            numeral: s.numeral,
            chord: s.symbol,
            notes: s.notes,
          })),
        }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}

export const getDiatonicChordsSchema = {
  key: z.string().describe('Key root note (e.g., "C", "Ab")'),
  mode: z.enum(['major', 'minor']).default('major'),
};

export async function getDiatonicChordsHandler({ key, mode }: { key: string; mode: 'major' | 'minor' }) {
  try {
    const chords = getDiatonicChords(key, mode);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          key: `${key} ${mode}`,
          chords: chords.map(c => ({
            degree: c.degree,
            numeral: c.numeral,
            chord: c.symbol,
            type: c.type,
            notes: c.notes,
          })),
        }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}
