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
  glow:      [0, 2, 4, 7, 9],                // major pentatonic — chill, warm
  classical: [0, 2, 4, 5, 7, 9, 11],        // major scale (Ionian) — Bach, Mozart, full classical range
}

// Phrase lengths in 16th notes, indexed by behavior
// Trap/drill: shorter, punchier phrases. Boom-bap: medium. Lo-fi/chill: longer, spacious.
export const PHRASE_LENGTHS: Record<string, number[]> = {
  [MelodyBehavior.Hint]:    [4, 6, 8],
  [MelodyBehavior.Respond]: [8, 12, 16],
  // Lead phrases are 4 bars (64 sixteenths) — one full chord cycle. Aligning
  // phrase length to the chord cycle means the melody starts a new musical
  // statement exactly when the harmony changes. Shorter options removed because
  // they were guaranteed to start mid-chord-cycle 50% of the time.
  [MelodyBehavior.Lead]:    [64],
}

// Octave range per mode [low, high]
// Trap: mid-high for piercing leads. Boom-bap: mid for soulful. Lo-fi: higher, airy.
export const MODE_OCTAVES: Record<string, [number, number]> = {
  heat:   [3, 4],     // trap — mid register, leaves space for 808 below and vocals above
  ice:    [3, 4],     // lo-fi — warm mid, not piercing
  smoke:  [3, 3],     // boom-bap — soulful low-mid, below the voice
  gravel: [2, 3],     // drill — dark, low menacing
  glow:      [3, 4],     // chill — warm mid
  classical: [4, 6],     // classical — wide range for piano, violin, full keyboard span
}

/**
 * Determine melody behavior from mode, voice activity, and flow depth.
 *
 * Freestyle rule: melody NEVER rests — it's always at least Hint so the
 * MC always has harmonic context to rap over. When the voice is active,
 * melody drops to Hint (gentle fill-the-gap accompaniment). When silent,
 * it steps up to Respond or Lead depending on how deep into flow we are.
 */
export function getMelodyBehavior(
  mode: OrganismMode | string,
  voiceActive: boolean,
  flowDepth: number,
): MelodyBehavior {
  // Voice active → melody hints quietly (call-and-response: MC leads, melody supports)
  if (voiceActive) return MelodyBehavior.Hint

  // No voice, moderate flow → melody responds (takes the spotlight between bars)
  if (flowDepth >= 0.2 && flowDepth < 0.5) return MelodyBehavior.Respond

  // No voice, deep flow → melody leads (full melodic phrase)
  if (flowDepth >= 0.5) return MelodyBehavior.Lead

  // Low flow, no voice → still hint so there's always something playing
  return MelodyBehavior.Hint
}

// ── NEW: Hip-Hop Motif Bank For True Harmonic Flow ────────────────────

export interface MotifStep {
  /** 
   * Index of the tone.
   * If isChordTone = true: 0=root of chord, 1=next chord tone (e.g. 3rd), 2=next (5th), etc.
   * Modulo math applies (e.g., if triad, index 3 = root + 1 octave).
   */
  index: number; 
  isChordTone: boolean;
  dur16ths: number; 
}

export interface MelodyMotif {
  name: string;
  steps: MotifStep[];
}

export const HIP_HOP_MOTIFS: Record<string, MelodyMotif[]> = {
  arps: [
    { name: "Drake Arp", steps: [
        {index: 0, isChordTone: true, dur16ths: 2}, 
        {index: 1, isChordTone: true, dur16ths: 2}, 
        {index: 2, isChordTone: true, dur16ths: 4}
      ] 
    },
    { name: "Ascend Arp", steps: [
        {index: 0, isChordTone: true, dur16ths: 1}, 
        {index: 1, isChordTone: true, dur16ths: 1}, 
        {index: 2, isChordTone: true, dur16ths: 1},
        {index: 3, isChordTone: true, dur16ths: 5}
      ] 
    },
    { name: "Rolling Triplets", steps: [
        {index: 2, isChordTone: true, dur16ths: 2}, 
        {index: 1, isChordTone: true, dur16ths: 2}, 
        {index: 0, isChordTone: true, dur16ths: 4}
      ] 
    }
  ],
  ostinatos: [
    { name: "Trap Bell 1", steps: [
        {index: 2, isChordTone: true, dur16ths: 3}, 
        {index: 0, isChordTone: true, dur16ths: 3}, 
        {index: 1, isChordTone: true, dur16ths: 2}
      ] 
    },
    { name: "Trap Bell 2", steps: [
        {index: 0, isChordTone: true, dur16ths: 1.5}, 
        {index: 0, isChordTone: true, dur16ths: 1.5}, 
        {index: 2, isChordTone: true, dur16ths: 5}
      ] 
    },
    { name: "Phonk Bounce", steps: [
        {index: 0, isChordTone: true, dur16ths: 2}, 
        {index: 1, isChordTone: false, dur16ths: 2}, 
        {index: 0, isChordTone: true, dur16ths: 4}
      ] 
    },
  ],
  fills: [
    { name: "Walk Down", steps: [
        {index: 2, isChordTone: true, dur16ths: 1}, 
        {index: 1, isChordTone: false, dur16ths: 1}, 
        {index: 1, isChordTone: true, dur16ths: 1}, 
        {index: 0, isChordTone: true, dur16ths: 5}
      ] 
    },
    { name: "Soul Flourish", steps: [
        {index: 1, isChordTone: true, dur16ths: 2},
        {index: 2, isChordTone: false, dur16ths: 1},
        {index: 0, isChordTone: true, dur16ths: 5}
      ]
    },
  ],
  // Lyrical bank — for SINGING leads (violin/cello/wind/brass), not bell arps.
  // The win vs. the arp banks: motion is mostly STEPWISE (isChordTone:false steps
  // = scale steps from the root) with chord-tone anchors and HELD notes, plus a
  // suspension that resolves down by step (the emotional "sigh"). Reads as a tune
  // a person could hum, in both auto and live modes.
  lyrical: [
    { name: "Cantabile Rise", steps: [
        {index: 0, isChordTone: true,  dur16ths: 2},  // root — anchor
        {index: 1, isChordTone: false, dur16ths: 2},  // step up (2nd)
        {index: 2, isChordTone: false, dur16ths: 2},  // step up
        {index: 2, isChordTone: true,  dur16ths: 6}   // land on a chord tone, held — the singing note
      ]
    },
    { name: "Sigh", steps: [
        {index: 3, isChordTone: false, dur16ths: 4},  // reach up to a tension tone, held
        {index: 2, isChordTone: false, dur16ths: 2},  // resolve DOWN by step (the sigh)
        {index: 0, isChordTone: true,  dur16ths: 6}   // settle home on a chord tone, held
      ]
    },
    { name: "Gentle Wave", steps: [
        {index: 0, isChordTone: true,  dur16ths: 3},
        {index: 1, isChordTone: false, dur16ths: 1},  // upper neighbour
        {index: 0, isChordTone: true,  dur16ths: 2},
        {index: -1, isChordTone: false, dur16ths: 2}, // lower neighbour
        {index: 0, isChordTone: true,  dur16ths: 4}   // home, held
      ]
    },
    { name: "Held Question", steps: [
        {index: 0, isChordTone: true,  dur16ths: 6},  // long, intimate — sparse/emotional
        {index: 1, isChordTone: false, dur16ths: 2},  // a single step
        {index: 2, isChordTone: true,  dur16ths: 8}   // held answer
      ]
    }
  ]
};
