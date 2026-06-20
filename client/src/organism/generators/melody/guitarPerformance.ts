import type { ScheduledNote } from '../types'

export interface GuitarDynamicsOptions {
  /** 0..1 — where the dynamic peak of the phrase sits. Default 0.66 (arch). */
  peakPosition?: number
  /** 0..1 — how much softer the phrase edges are than the peak. Default 0.45. */
  depth?: number
  /** Velocity boost added to picked downbeats. Default 0.12. */
  accent?: number
}

/** sixteenth-grid position (0..15) from a "bar:beat:sub" Tone time string. */
function sixteenthPosOf(time: string): number {
  const parts = String(time).split(':')
  const beat = parseFloat(parts[1] ?? '0')
  const sub = parseFloat(parts[2] ?? '0')
  return Math.floor(beat * 4 + sub) % 16
}

/**
 * Pro-instruments M2.6 slice 1 — the Guitar Player's dynamics.
 *
 * A real guitarist doesn't pick every note at the same strength. Shape a flat
 * phrase into a performance: an arch swell across the phrase (rise to the peak
 * ~2/3 through, ease at the cadence) plus a picking accent on downbeats.
 *
 * Non-destructive: same notes, pitches, and timing — only velocity changes.
 * This is the "how to play it" layer; the notes come from the Line Source.
 */
export function shapeGuitarDynamics(
  notes: ScheduledNote[],
  opts: GuitarDynamicsOptions = {},
): ScheduledNote[] {
  const peak = opts.peakPosition ?? 0.66
  const depth = opts.depth ?? 0.45
  const accent = opts.accent ?? 0.12
  const n = notes.length
  if (n === 0) return notes

  return notes.map((note, i) => {
    // Phrase position 0..1 (single-note phrase sits at the peak).
    const pos = n <= 1 ? peak : i / (n - 1)
    // Triangular arch: 1 at `peak`, falling toward 0 at both ends.
    const arch = pos <= peak
      ? pos / Math.max(1e-6, peak)
      : 1 - (pos - peak) / Math.max(1e-6, 1 - peak)
    // Envelope dips the edges by `depth`, leaves the peak untouched.
    const envelope = 1 - depth * (1 - Math.max(0, arch))
    const isDownbeat = sixteenthPosOf(note.time) % 4 === 0
    const shaped = note.velocity * envelope + (isDownbeat ? accent : 0)
    return { ...note, velocity: Math.max(0, Math.min(1, shaped)) }
  })
}
