// Section 04 — Melody Pattern Library

import { MelodyBehavior } from '../types'
import type { OrganismMode } from '../../physics/types'

// Scale intervals by mode (semitones from root)
export const MODE_SCALES: Record<string, number[]> = {
  heat:   [0, 2, 3, 5, 7, 10, 12],       // minor pentatonic + extensions
  ice:    [0, 2, 4, 7, 9],                 // major pentatonic
  smoke:  [0, 3, 5, 6, 7, 10],             // blues scale
  gravel: [0, 2, 3, 5, 7, 8, 10],          // dorian
  glow:   [0, 2, 4, 5, 7, 9, 11],          // major (ionian)
}

// Phrase lengths in 16th notes, indexed by behavior
export const PHRASE_LENGTHS: Record<string, number[]> = {
  [MelodyBehavior.Hint]:    [4, 8],
  [MelodyBehavior.Respond]: [8, 12, 16],
  [MelodyBehavior.Lead]:    [16, 24, 32],
}

// Octave range per mode [low, high]
export const MODE_OCTAVES: Record<string, [number, number]> = {
  heat:   [4, 5],
  ice:    [5, 6],
  smoke:  [3, 5],
  gravel: [3, 4],
  glow:   [4, 6],
}

/**
 * Determine melody behavior from mode, voice activity, and flow depth.
 */
export function getMelodyBehavior(
  mode: OrganismMode | string,
  voiceActive: boolean,
  flowDepth: number,
): MelodyBehavior {
  // While voice is active with very low flow depth, melody rests
  if (voiceActive && flowDepth < 0.15) return MelodyBehavior.Rest

  // Voice active → hint (gentle accompaniment)
  if (voiceActive) return MelodyBehavior.Hint

  // No voice, moderate flow → respond
  if (flowDepth >= 0.2 && flowDepth < 0.5) return MelodyBehavior.Respond

  // No voice, deep flow → lead
  if (flowDepth >= 0.5) return MelodyBehavior.Lead

  // Default: rest
  return MelodyBehavior.Rest
}
