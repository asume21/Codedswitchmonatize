// Section 04 — Texture Pattern Library

export interface TextureLayer {
  noiseType:  'white' | 'pink' | 'brown'
  filterFreq: number
  reverbWet:  number
  gainLevel:  number
}

// Gain levels are intentionally low — texture should be felt, not heard.
// Filter cutoffs sit above 500Hz so noise reads as air/atmosphere, not hum.
// Earlier design used sub-300Hz cutoffs which created audible low-frequency hum.
// Reverb wet kept minimal to prevent ambient wash building up over time.
export const TEXTURE_BY_MODE: Record<string, TextureLayer> = {
  heat: {
    noiseType:  'white',
    filterFreq: 800,
    reverbWet:  0.08,
    gainLevel:  0.025,
  },
  ice: {
    noiseType:  'white',
    filterFreq: 1200,
    reverbWet:  0.10,
    gainLevel:  0.020,
  },
  smoke: {
    noiseType:  'pink',
    filterFreq: 600,
    reverbWet:  0.08,
    gainLevel:  0.025,
  },
  gravel: {
    noiseType:  'pink',
    filterFreq: 700,
    reverbWet:  0.07,
    gainLevel:  0.025,
  },
  glow: {
    noiseType:  'pink',
    filterFreq: 900,
    reverbWet:  0.08,
    gainLevel:  0.020,
  },
}
