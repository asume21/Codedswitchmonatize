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
    reverbWet:  0.2,
    gainLevel:  0.12,
  },
  ice: {
    noiseType:  'pink',
    filterFreq: 800,
    reverbWet:  0.4,
    gainLevel:  0.08,
  },
  smoke: {
    noiseType:  'brown',
    filterFreq: 600,
    reverbWet:  0.35,
    gainLevel:  0.10,
  },
  gravel: {
    noiseType:  'pink',
    filterFreq: 1200,
    reverbWet:  0.25,
    gainLevel:  0.10,
  },
  glow: {
    noiseType:  'pink',
    filterFreq: 1000,
    reverbWet:  0.3,
    gainLevel:  0.08,
  },
}
