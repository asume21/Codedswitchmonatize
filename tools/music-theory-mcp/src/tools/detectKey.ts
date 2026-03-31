import { z } from 'zod';
import { detectKey } from '../engine/core.js';

export const detectKeySchema = {
  notes: z.array(z.string()).describe('Array of note names observed in the piece (e.g., ["C", "D", "E", "F", "G", "A", "B"])'),
};

export async function detectKeyHandler({ notes }: { notes: string[] }) {
  try {
    const results = detectKey(notes);
    if (results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'Could not determine key from those notes. Provide more notes for better results.' }] };
    }
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          input: notes,
          candidates: results.map(r => ({
            key: `${r.key} ${r.mode}`,
            confidence: `${Math.round(r.confidence * 100)}%`,
          })),
          bestMatch: `${results[0].key} ${results[0].mode}`,
        }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}
