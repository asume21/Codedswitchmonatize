import type { MelodyMotif, MotifStep } from '../patterns/MelodyPatternLibrary'

export type MotifVariation = 'identity' | 'transpose' | 'invert' | 'augment' | 'diminish'

/** Return a NEW motif that is the base idea, transformed. Never mutates `base`. */
export function developMotif(base: MelodyMotif, variation: MotifVariation, amount = 0): MelodyMotif {
  const first = base.steps[0]?.index ?? 0
  const steps: MotifStep[] = base.steps.map((s) => {
    switch (variation) {
      case 'transpose': return { ...s, index: s.index + amount }
      case 'invert':    return { ...s, index: 2 * first - s.index }
      case 'augment':   return { ...s, dur16ths: s.dur16ths * 2 }
      case 'diminish':  return { ...s, dur16ths: Math.max(1, s.dur16ths / 2) }
      case 'identity':
      default:          return { ...s }
    }
  })
  return { name: `${base.name}:${variation}`, steps }
}

/**
 * A phrase = the theme stated, then developed. Index 0 is always 'identity'
 * (state the catchphrase) so the listener has something to recognize coming back.
 * Deterministic given the seed.
 */
export function pickPhraseVariations(seed: number, phraseCount: number): MotifVariation[] {
  const cycle: MotifVariation[] = ['transpose', 'identity', 'invert', 'augment']
  const out: MotifVariation[] = []
  for (let i = 0; i < phraseCount; i++) {
    out.push(i === 0 ? 'identity' : cycle[(i - 1 + seed) % cycle.length])
  }
  return out
}
