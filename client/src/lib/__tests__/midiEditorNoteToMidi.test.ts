import { describe, it, expect } from 'vitest';
import { noteToMidi } from '../midiEditor';

// "Db" used to be normalised by replacing 'b' with '#' → "D#", two semitones
// sharp. Flats must map to their enharmonic sharp (Db = C#).
describe('noteToMidi', () => {
  it('maps naturals and sharps', () => {
    expect(noteToMidi('C', 4)).toBe(60);
    expect(noteToMidi('C#', 4)).toBe(61);
    expect(noteToMidi('A', 4)).toBe(69);
  });

  it('maps flats to the enharmonic sharp', () => {
    expect(noteToMidi('Db', 4)).toBe(61);
    expect(noteToMidi('Eb', 4)).toBe(63);
    expect(noteToMidi('Bb', 3)).toBe(58);
  });
});
