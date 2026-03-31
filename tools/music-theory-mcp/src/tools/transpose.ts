import { z } from 'zod';
import { transpose, intervalBetween, getScale, getChord } from '../engine/core.js';

export const transposeNoteSchema = {
  note: z.string().describe('Note to transpose (e.g., "C", "F#")'),
  semitones: z.number().describe('Number of semitones to shift (positive = up, negative = down)'),
};

export async function transposeNoteHandler({ note, semitones }: { note: string; semitones: number }) {
  try {
    const result = transpose(note, semitones);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ original: note, semitones, result }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}

export const transposeProgressionSchema = {
  chords: z.array(z.object({
    root: z.string(),
    type: z.string(),
  })).describe('Array of chords to transpose'),
  semitones: z.number().describe('Semitones to shift'),
};

export async function transposeProgressionHandler({ chords, semitones }: { chords: Array<{ root: string; type: string }>; semitones: number }) {
  try {
    const results = chords.map(c => {
      const newRoot = transpose(c.root, semitones);
      const chord = getChord(newRoot, c.type);
      return { original: `${c.root} ${c.type}`, transposed: chord.symbol, notes: chord.notes };
    });
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ semitones, results }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}

export const intervalSchema = {
  note_a: z.string().describe('First note'),
  note_b: z.string().describe('Second note'),
};

export async function intervalHandler({ note_a, note_b }: { note_a: string; note_b: string }) {
  try {
    const name = intervalBetween(note_a, note_b);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ from: note_a, to: note_b, interval: name }, null, 2),
      }],
    };
  } catch (e: any) {
    return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }], isError: true };
  }
}
