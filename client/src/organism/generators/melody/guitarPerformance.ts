import type { ScheduledNote } from '../types'

export interface GuitarDynamicsOptions {
  /** 0..1 — where the dynamic peak of the phrase sits. Default 0.66 (arch). */
  peakPosition?: number
  /** 0..1 — how much softer the phrase edges are than the peak. Default 0.45. */
  depth?: number
  /** Velocity boost added to picked downbeats. Default 0.12. */
  accent?: number
}

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Parse a note name ("C4", "F#3", "Bb2") to a MIDI number (C4 = 60). null if unparseable. */
export function noteToMidi(name: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim())
  if (!m) return null
  let semi = SEMITONE[m[1].toUpperCase()]
  if (m[2] === '#') semi += 1
  else if (m[2] === 'b') semi -= 1
  return semi + (parseInt(m[3], 10) + 1) * 12
}

export interface GuitarArticulationOptions {
  /** Velocity at/above which a note is "accented" and gets a bend. Default 0.8. */
  accentThreshold?: number
}

/**
 * Pro-instruments M2.6 slice 2 — guitar idiom, per note.
 *
 * Picks an existing articulation id for each note so a soloed guitar phrases
 * like a guitar (no audio-chain change needed — these are note-based ornaments):
 *   - last note        → 'fall-off'    (release / bend-down at the phrase end)
 *   - accented peak     → 'scoop-up'    (bend INTO the loud note)
 *   - stepwise up (1-2) → 'grace-flick' (hammer-on)
 *   - otherwise         → 'none'        (clean pluck)
 *
 * Returns an id per note, aligned to `notes`. The Guitar Player applies these
 * via the existing applyArticulation engine.
 */
export function planGuitarArticulations(
  notes: ScheduledNote[],
  opts: GuitarArticulationOptions = {},
): string[] {
  const accentThreshold = opts.accentThreshold ?? 0.8
  return notes.map((n, i) => {
    if (i === notes.length - 1) return 'fall-off'
    if (n.velocity >= accentThreshold) return 'scoop-up'
    const prev = i > 0 ? noteToMidi(notes[i - 1].pitch) : null
    const cur = noteToMidi(n.pitch)
    if (prev != null && cur != null) {
      const step = cur - prev
      if (step >= 1 && step <= 2) return 'grace-flick'
    }
    return 'none'
  })
}

export interface GuitarDevelopOptions {
  /** Keep 1 of every N weak-beat notes on answer phrases (N=2 → drop half). Default 2. */
  keepEvery?: number
}

/**
 * Pro-instruments M2.6 slice 3 — call-and-answer development.
 *
 * A soloist doesn't restate the same phrase every cycle. Even (statement)
 * phrases play the idea as composed; odd (answer) phrases thin the weak-beat
 * notes to leave space — so consecutive phrases contrast (full → spacious)
 * instead of looping identically. Downbeats are always kept so the structure
 * and chord-tone targeting survive.
 */
export function developGuitarPhrase(
  notes: ScheduledNote[],
  phraseIndex: number,
  opts: GuitarDevelopOptions = {},
): ScheduledNote[] {
  if (phraseIndex % 2 === 0) return notes // statement — play it straight
  const keepEvery = Math.max(2, Math.round(opts.keepEvery ?? 2))
  let weakSeen = 0
  return notes.filter((n) => {
    if (sixteenthPosOf(n.time) % 4 === 0) return true // always keep downbeats
    weakSeen++
    return weakSeen % keepEvery !== 0 // drop every keepEvery-th weak-beat note
  })
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
