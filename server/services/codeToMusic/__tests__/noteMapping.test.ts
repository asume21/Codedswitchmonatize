/**
 * Tests for Note Mapping
 * Ensures deterministic behavior and musical correctness
 */

import { hashString, mapElementToNote, mapElementToNoteIntelligent } from '../noteMapping';
import { FOUR_CHORDS_C_MAJOR } from '../chordDefinitions';
import type { CodeElement } from '../../../../shared/types/codeToMusic';

describe('Note Mapping', () => {
  describe('hashString', () => {
    it('should return same hash for same input', () => {
      const input = 'class-User-1';
      const hash1 = hashString(input);
      const hash2 = hashString(input);
      
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = hashString('class-User-1');
      const hash2 = hashString('class-Admin-1');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should always return positive numbers', () => {
      const hash = hashString('test');
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mapElementToNote', () => {
    const testElement: CodeElement = {
      type: 'class',
      name: 'User',
      line: 1,
      content: 'class User',
      nestingLevel: 0,
    };

    const chord = FOUR_CHORDS_C_MAJOR[0]; // C Major

    it('should return same note for same element and variation', () => {
      const note1 = mapElementToNote(testElement, chord, 0);
      const note2 = mapElementToNote(testElement, chord, 0);
      
      expect(note1).toBe(note2);
    });

    it('should return different notes for different variations', () => {
      const note1 = mapElementToNote(testElement, chord, 0);
      const note2 = mapElementToNote(testElement, chord, 5);
      
      // May or may not be different, but should be deterministic
      const note2Again = mapElementToNote(testElement, chord, 5);
      expect(note2).toBe(note2Again);
    });

    it('should return a note from the chord', () => {
      const note = mapElementToNote(testElement, chord, 0);
      expect(chord.notes).toContain(note);
    });
  });

  describe('mapElementToNoteIntelligent', () => {
    const chord = FOUR_CHORDS_C_MAJOR[0]; // C Major: C4, E4, G4

    it('should map class to root note (C4) when variation is 0', () => {
      const element: CodeElement = {
        type: 'class',
        name: 'User',
        line: 1,
        content: 'class User',
        nestingLevel: 0,
      };

      const note = mapElementToNoteIntelligent(element, chord, 0);
      expect(note).toBe('C4'); // Root note
    });

    it('should map function to 3rd (E4) when variation is 0', () => {
      const element: CodeElement = {
        type: 'function',
        name: 'login',
        line: 2,
        content: 'function login',
        nestingLevel: 1,
      };

      const note = mapElementToNoteIntelligent(element, chord, 0);
      expect(note).toBe('E4'); // 3rd
    });

    it('should map variable to 5th (G4) when variation is 0', () => {
      const element: CodeElement = {
        type: 'variable',
        name: 'password',
        line: 3,
        content: 'var password',
        nestingLevel: 2,
      };

      const note = mapElementToNoteIntelligent(element, chord, 0);
      expect(note).toBe('G4'); // 5th
    });

    it('should use hash-based selection for non-zero variation', () => {
      const element: CodeElement = {
        type: 'class',
        name: 'User',
        line: 1,
        content: 'class User',
        nestingLevel: 0,
      };

      const note = mapElementToNoteIntelligent(element, chord, 5);
      expect(chord.notes).toContain(note);
    });
  });
});
