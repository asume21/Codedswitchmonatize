// Section 04 — Texture Pattern Library

export interface TextureLayer {
  noiseType:  'white' | 'pink' | 'brown'
  filterFreq: number
  reverbWet:  number
  gainLevel:  number
}

export const TEXTURE_BY_MODE: Record<string, TextureLayer> = {
  heat: {
    noiseType:  'white',
    filterFreq: 2000,
    reverbWet:  0.3,
    gainLevel:  0.5,
  },
  ice: {
    noiseType:  'pink',
    filterFreq: 800,
    reverbWet:  0.7,
    gainLevel:  0.3,
  },
  smoke: {
    noiseType:  'brown',
    filterFreq: 600,
    reverbWet:  0.6,
    gainLevel:  0.4,
  },
  gravel: {
    noiseType:  'pink',
    filterFreq: 1200,
    reverbWet:  0.4,
    gainLevel:  0.45,
  },
  glow: {
    noiseType:  'pink',
    filterFreq: 1000,
    reverbWet:  0.5,
    gainLevel:  0.35,
  },
}
