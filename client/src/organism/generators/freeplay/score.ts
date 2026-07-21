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
