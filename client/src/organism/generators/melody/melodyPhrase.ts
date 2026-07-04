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

/**
 * Conductor Part 3 V3 — strong-beat resolution that COMPLEMENTS the comp.
 *
 * The Conductor's voicing emphasises the 3rd & 7th (guide tones) in the comp.
 * The melody LEANS toward the other chord tones (root / 5th / extensions =
 * `preferredDegs`) so the lead and the comp spell the harmony together instead
 * of mud-doubling the colour — "one carries the other."
 *
 * V3.1 (tuning): this is a SOFT preference, not a ban. The first cut excluded the
 * guide tones outright, which forced every strong beat onto root/5th and bled the
 * colour out of the line (it sounded grey). Now a guide tone is allowed when the
 * melodic contour genuinely lands on it — we add `penalty` scale-steps to a guide
 * tone's distance, so it only wins when it is clearly the nearest target. The
 * line keeps its complement bias but can still hit a 3rd/7th when that's where it
 * wants to go. Weak beats are untouched. `penalty` is the dial: 0 = no preference,
 * large = the old hard exclusion.
 */
export function resolveDegreeComplementing(
  deg: number,
  chordDegs: number[],
  preferredDegs: number[],
  scaleLen: number,
  strong: boolean,
  penalty = 1.5,
): number {
  if (!strong || chordDegs.length === 0) return deg
  const oct = Math.floor(deg / scaleLen)
  const within = ((deg % scaleLen) + scaleLen) % scaleLen
  const preferred = new Set(preferredDegs)
  let best = chordDegs[0]
  let bestScore = Infinity
  for (const c of chordDegs) {
    const dist = Math.abs(c - within)
    const score = preferred.has(c) ? dist : dist + penalty
    // Strictly-less wins; on a tie prefer the complement tone (deterministic, and
    // it keeps the bias toward root/5th when a guide tone is no closer).
    const better =
      score < bestScore - 1e-9 ||
      (Math.abs(score - bestScore) < 1e-9 && preferred.has(c) && !preferred.has(best))
    if (better) {
      bestScore = score
      best = c
    }
  }
  return oct * scaleLen + best
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

/**
 * Detect phrases that technically contain more than one pitch but still read as
 * stuck on one note. This protects the renderer from motif/chord-tone mappings
 * that collapse most of a line onto the same landing pitch.
 */
export function phraseNeedsContourFallback(
  pitches: readonly (string | number)[],
  maxDominantRatio = 0.65,
  maxRepeatRun = 4,
): boolean {
  if (pitches.length <= 1) return true

  const counts = new Map<string, number>()
  let longestRun = 1
  let currentRun = 1
  let previous = String(pitches[0])

  for (const pitch of pitches) {
    const key = String(pitch)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  for (let i = 1; i < pitches.length; i++) {
    const key = String(pitches[i])
    if (key === previous) {
      currentRun += 1
      longestRun = Math.max(longestRun, currentRun)
    } else {
      previous = key
      currentRun = 1
    }
  }

  const dominant = Math.max(...counts.values())
  const dominantRatio = dominant / pitches.length

  return counts.size <= 1
    || longestRun >= maxRepeatRun
    || (counts.size <= 2 && dominantRatio >= maxDominantRatio)
}
