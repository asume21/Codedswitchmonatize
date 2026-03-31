import { z } from 'zod';
import { getChord, identifyChord, listChordTypes } from '../engine/core.js';

export const getChordSchema = {
  root: z.string().describe('Root note (e.g., "C", "F#", "Bb")'),
  type: z.string().describe('Chord type (e.g., "major", "minor", "dom7", "maj7", "sus2")'),
};

export async function getChordHandler({ root, type }: { root: string; type: string }) {
  try {
    const info = getChord(root, type);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          symbol: info.symbol,
          root: info.root,
          type: info.type,
          notes: info.notes,
          intervals: info.intervals,
        }, null, 2),
      }],
    };
  } catch (e: any) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${e.message}\n\nAvailable types: ${listChordTypes().join(', ')}` }],
      isError: true,
    };
  }
}

export const identifyChordSchema = {
  notes: z.array(z.string()).describe('Array of note names (e.g., ["C", "E", "G"])'),
};

export async function identifyChordHandler({ notes }: { notes: string[] }) {
  try {
    const results = identifyChord(notes);
    if (results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No matching chord found for those notes.' }] };
    }
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ input: notes, matches: results }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}
