import type { MotifStep } from '../patterns/MelodyPatternLibrary'

/** A 16th-grid cursor lands on a downbeat (beat 1 or 3, on the beat). */
export function isStrongBeat(cursor16: number): boolean {
  const inBar = ((cursor16 % 16) + 16) % 16
  const beat = Math.floor(inBar / 4)
  const sub = inBar % 4
  return sub === 0 && (beat === 0 || beat === 2)
}

/** Nearest chord-tone scale-degree to `deg`, preserving deg's octave region. */
export function nearestChordDegree(deg: number, chordDegs: number[], scaleLen: number): number {
  if (chordDegs.length === 0) return deg
  const oct = Math.floor(deg / scaleLen)
  const within = ((deg % scaleLen) + scaleLen) % scaleLen
  let best = chordDegs[0]
  let bestDist = Infinity
  for (const c of chordDegs) {
    const d = Math.abs(c - within)
    if (d < bestDist) { bestDist = d; best = c }
  }
  return oct * scaleLen + best
}

/** Strong beats MUST be chord tones (stable); weak beats may be passing tones. */
export function resolveDegreeForBeat(deg: number, chordDegs: number[], scaleLen: number, strong: boolean): number {
  return strong ? nearestChordDegree(deg, chordDegs, scaleLen) : deg
}

/** Arch curve: rises to a single climax ~2/3 through, falls back to ~0 at the end. */
export function contourOffset(posFraction: number, intensity: number): number {
  const peak = 0.66
  const x = posFraction <= peak ? posFraction / peak : 1 - (posFraction - peak) / (1 - peak)
  return Math.round(intensity * Math.max(0, x))
}

/** The "period" at the end of the sentence: resolve to the chord root, held. */
export function cadenceStep(dur16ths = 4): MotifStep {
  return { index: 0, isChordTone: true, dur16ths }
}
