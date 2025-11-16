/**
 * Note Mapping - Deterministic code-to-note conversion
 * Maps code elements to specific notes within the current chord
 */

import type { CodeElement } from '../../../shared/types/codeToMusic';
import type { ChordDefinition } from './chordDefinitions';
import { getClosestScaleNote } from './chordDefinitions';

/**
 * Simple hash function for deterministic randomness
 * Same input always produces same output
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Map a code element to a note within the current chord
 * Uses deterministic hashing to ensure same code = same note
 */
export function mapElementToNote(
  element: CodeElement,
  chord: ChordDefinition,
  variation: number = 0
): string {
  // Create a unique key for this element
  const key = `${element.type}-${element.name}-${element.line}`;
  
  // Hash the key + variation for deterministic selection
  const hash = hashString(key) + variation;
  
  // Select a note from the current chord
  const noteIndex = hash % chord.notes.length;
  const selectedNote = chord.notes[noteIndex];
  
  return selectedNote;
}

/**
 * Map code element type to preferred chord position
 * This creates musical "meaning" - different code elements get different roles
 */
export function getPreferredNoteIndex(elementType: CodeElement['type']): number {
  const preferences: Record<CodeElement['type'], number> = {
    'class': 0,        // Root note (foundation)
    'function': 1,     // 3rd (melody)
    'variable': 2,     // 5th (harmony)
    'loop': 0,         // Root (rhythmic foundation)
    'conditional': 1,  // 3rd (decision point)
    'import': 2,       // 5th (supporting)
    'return': 0,       // Root (resolution)
  };
  
  return preferences[elementType] || 0;
}

/**
 * Map element with musical intelligence
 * Uses both deterministic hashing AND musical rules
 */
export function mapElementToNoteIntelligent(
  element: CodeElement,
  chord: ChordDefinition,
  variation: number = 0
): string {
  // Get preferred position based on element type
  const preferredIndex = getPreferredNoteIndex(element.type);
  
  // If variation is 0, use preferred position (deterministic)
  if (variation === 0 && preferredIndex < chord.notes.length) {
    return chord.notes[preferredIndex];
  }
  
  // Otherwise, use hash-based selection with variation
  return mapElementToNote(element, chord, variation);
}

/**
 * Calculate note duration based on code element
 * More complex elements = longer notes
 */
export function calculateNoteDuration(element: CodeElement): number {
  const baseDuration = 0.5; // seconds
  
  // Adjust based on element type
  const durationMultipliers: Record<CodeElement['type'], number> = {
    'class': 2.0,      // Classes are foundational, longer
    'function': 1.5,   // Functions are important
    'variable': 1.0,   // Variables are quick
    'loop': 1.5,       // Loops have rhythm
    'conditional': 1.0,
    'import': 0.5,     // Imports are quick
    'return': 1.0,
  };
  
  const multiplier = durationMultipliers[element.type] || 1.0;
  
  // Adjust based on nesting level (deeper = shorter)
  const nestingAdjustment = Math.max(0.5, 1.0 - (element.nestingLevel * 0.1));
  
  return baseDuration * multiplier * nestingAdjustment;
}

/**
 * Calculate note velocity (volume) based on code element
 * More important elements = louder
 */
export function calculateNoteVelocity(element: CodeElement): number {
  const baseVelocity = 80; // 0-127 MIDI range
  
  // Adjust based on element type
  const velocityBoosts: Record<CodeElement['type'], number> = {
    'class': 20,       // Classes are prominent
    'function': 15,    // Functions are important
    'variable': 0,     // Variables are normal
    'loop': 10,        // Loops have emphasis
    'conditional': 5,
    'import': -10,     // Imports are quiet
    'return': 10,      // Returns are emphasized
  };
  
  const boost = velocityBoosts[element.type] || 0;
  
  // Ensure within MIDI range (0-127)
  return Math.max(0, Math.min(127, baseVelocity + boost));
}

/**
 * Determine which instrument should play this element
 */
export function selectInstrument(element: CodeElement): string {
  const instrumentMap: Record<CodeElement['type'], string> = {
    'class': 'piano',
    'function': 'synth',
    'variable': 'bass',
    'loop': 'drums',
    'conditional': 'synth',
    'import': 'piano',
    'return': 'piano',
  };
  
  return instrumentMap[element.type] || 'piano';
}
