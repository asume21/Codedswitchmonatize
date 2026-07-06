import type { ScheduledNote } from '../types'
import { noteToMidi, midiToNote } from '../../performers/InstrumentPerformerRouter'

export interface VoiceLeadOptions {
  /** Max semitones allowed between consecutive notes before octave-folding kicks in. */
  maxLeapSemitones: number
  /** Lowest MIDI note the line may sit on. */
  floorMidi: number
  /** Highest MIDI note the line may sit on (register ceiling — kills shrieking highs). */
  ceilingMidi: number
  /**
   * Previous phrase's last MIDI pitch. When provided, the fold treats it as if
   * it were the note immediately before this phrase's first note, so the line
   * continues from where the last phrase left off instead of resetting.
   * Omit/null to keep the original behavior (first note only register-capped).
   */
  seedMidi?: number | null
  /**
   * Note index, if any, that skips the leap-fold on purpose — a deliberate
   * expressive "reach" rather than smoothed voice-leading (still register-capped,
   * so it can't shriek). Omit/null for no break.
   */
  breakAt?: number | null
}

/**
 * Octave voice-leading: keep each note's PITCH CLASS (the harmony chosen upstream
 * stays intact) and only move its OCTAVE so the line moves mostly by step instead
 * of leaping high↔low. Register cap wins over leap — a note is never left above the
 * ceiling. Velocity, duration, and time are untouched; only `pitch` changes.
 */
export function applyVoiceLeading(notes: ScheduledNote[], opts: VoiceLeadOptions): ScheduledNote[] {
  const { maxLeapSemitones, floorMidi, ceilingMidi, seedMidi = null, breakAt = null } = opts
  let prev: number | null = seedMidi

  return notes.map((note, i) => {
    const midi = noteToMidi(note.pitch)
    if (midi == null) return note
    let m = midi

    // 1. Fold toward the previous note until the interval is small (same pitch
    // class) — unless this is the deliberate break note, which is allowed to
    // reach past the leap limit on purpose.
    if (prev != null && i !== breakAt) {
      while (m - prev > maxLeapSemitones) m -= 12
      while (prev - m > maxLeapSemitones) m += 12
    }

    // 2. Register cap takes priority over leap size (and over the break).
    while (m > ceilingMidi) m -= 12
    while (m < floorMidi) m += 12

    prev = m
    return { ...note, pitch: midiToNote(m) }
  })
}
