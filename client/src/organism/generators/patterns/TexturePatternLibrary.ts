// Section 04 — Texture Pattern Library

export interface TextureLayer {
  noiseType:  'white' | 'pink' | 'brown'
  filterFreq: number
  reverbWet:  number
  gainLevel:  number
}

// Gain levels are intentionally low — texture should be felt, not heard.
// Filter cutoffs stay below 400Hz so noise reads as sub-rumble, not wind.
// Reverb wet kept minimal to prevent ambient wash building up over time.
export const TEXTURE_BY_MODE: Record<string, TextureLayer> = {
  heat: {
    noiseType:  'pink',
    filterFreq: 300,
    reverbWet:  0.08,
    gainLevel:  0.04,
  },
  ice: {
    noiseType:  'pink',
    filterFreq: 250,
    reverbWet:  0.10,
    gainLevel:  0.03,
  },
  smoke: {
    noiseType:  'brown',
    filterFreq: 200,
    reverbWet:  0.08,
    gainLevel:  0.04,
  },
  gravel: {
    noiseType:  'pink',
    filterFreq: 280,
    reverbWet:  0.07,
    gainLevel:  0.04,
  },
  glow: {
    noiseType:  'pink',
    filterFreq: 250,
    reverbWet:  0.08,
    gainLevel:  0.03,
  },
}
