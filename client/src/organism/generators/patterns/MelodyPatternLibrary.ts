// Section 04 — Melody Pattern Library

import { MelodyBehavior } from '../types'
import type { OrganismMode } from '../../physics/types'

// Scale intervals by mode (semitones from root)
// Tuned for hip-hop: dark minor scales for trap/drill, soulful for boom-bap, jazzy for lo-fi
export const MODE_SCALES: Record<string, number[]> = {
  heat:   [0, 3, 5, 7, 10],               // minor pentatonic — dark trap melodies
  ice:    [0, 2, 3, 5, 7, 10, 11],        // natural minor + maj7 — jazzy lo-fi
  smoke:  [0, 3, 5, 6, 7, 10],            // blues scale — soulful boom-bap
  gravel: [0, 3, 5, 7, 10],               // minor pentatonic — drill, same as heat but lower octave
  glow:   [0, 2, 4, 7, 9],                // major pentatonic — chill, warm
}

// Phrase lengths in 16th notes, indexed by behavior
// Trap/drill: shorter, punchier phrases. Boom-bap: medium. Lo-fi/chill: longer, spacious.
export const PHRASE_LENGTHS: Record<string, number[]> = {
  [MelodyBehavior.Hint]:    [4, 6, 8],
  [MelodyBehavior.Respond]: [8, 12, 16],
  [MelodyBehavior.Lead]:    [16, 24, 32],
}

// Octave range per mode [low, high]
// Trap: mid-high for piercing leads. Boom-bap: mid for soulful. Lo-fi: higher, airy.
export const MODE_OCTAVES: Record<string, [number, number]> = {
  heat:   [3, 4],     // trap — mid register, leaves space for 808 below and vocals above
  ice:    [3, 4],     // lo-fi — warm mid, not piercing
  smoke:  [3, 3],     // boom-bap — soulful low-mid, below the voice
  gravel: [2, 3],     // drill — dark, low menacing
  glow:   [3, 4],     // chill — warm mid
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
