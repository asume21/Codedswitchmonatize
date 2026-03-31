import { z } from 'zod';
import { getScale, listScales } from '../engine/core.js';

export const getScaleSchema = {
  root: z.string().describe('Root note (e.g., "C", "F#", "Bb")'),
  type: z.string().describe(`Scale type (e.g., "major", "natural_minor", "pentatonic_minor", "blues", "dorian")`),
};

export async function getScaleHandler({ root, type }: { root: string; type: string }) {
  try {
    const info = getScale(root, type);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          root: info.root,
          type: info.type,
          notes: info.notes,
          intervals: info.intervals,
          noteCount: info.notes.length,
          modes: info.modes.length > 0 ? info.modes : undefined,
        }, null, 2),
      }],
    };
  } catch (e: any) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${e.message}\n\nAvailable scales: ${listScales().join(', ')}` }],
      isError: true,
    };
  }
}
