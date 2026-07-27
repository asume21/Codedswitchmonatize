// client/src/organism/generators/freeplay/score.ts
// Helpers for performing Claude-composed SectionScores (shared/arrangement.ts).
// The score grid is 16th-note slots over 4 bars (slot 0..63).

/** Map a duration in 16th-slots to the nearest Tone.js notation string.
 *  Exact for the common values; rounds down for odd in-between lengths so a
 *  written note never bleeds past the next one. */
export function slotsToDur(slots: number): string {
  const n = Math.max(1, Math.round(slots))
  if (n >= 32) return '2m'
  if (n >= 24) return '1m.'
  if (n >= 16) return '1m'
  if (n >= 12) return '2n.'
  if (n >= 8)  return '2n'
  if (n >= 6)  return '4n.'
  if (n >= 4)  return '4n'
  if (n >= 3)  return '8n.'
  if (n >= 2)  return '8n'
  return '16n'
}

/**
 * Comp ONE hit of a held chord like a player, not a stamp.
 *
 * The Conductor voices each chord (voice-led, common tones held). But the comp
 * used to play that IDENTICAL block on every hit — 8-15 stamps of the same four
 * notes per chord — which is the "robotic / blocky" sound: no movement WITHIN a
 * held chord. This varies WHICH voiced tones sound (and their octave) per hit so
 * a static block becomes motion, WITHOUT inventing any harmony: every returned
 * note is one of the Conductor's voiced tones, at most shifted an octave.
 *
 * Deterministic in `hitIndex` so the locked loop stays byte-identical each cycle.
 * The 4-cycle: full stack → drop the lowest voice (lighter) → MOVE THE TOP up to
 * the next chord tone (an octave of an inner voice, so the ear hears the top line
 * step up — the audible part of a comp) → shell (bottom + top two). Downbeat hits
 * (hitIndex 0) always get the full statement.
 *
 * Moving the TOP matters: the Conductor's voicing is a wide drop voicing, so
 * shuffling inner/low voices under a fixed top note is nearly inaudible — a comp
 * only sounds alive when the top voice actually walks.
 */
export function compVoicingForHit(inner: number[], hitIndex: number): number[] {
  if (inner.length < 3) return inner
  const v = [...inner].sort((a, b) => a - b)   // low → high
  switch (((hitIndex % 4) + 4) % 4) {
    case 1: return v.slice(1)                          // lighter — drop lowest voice
    case 2: return [...v.slice(1), v[1] + 12]          // top moves UP (octave of 2nd voice on top)
    case 3: return [v[0], v[v.length - 2], v[v.length - 1]]        // shell — bottom + top two
    default: return v                                  // statement — full stack
  }
}
