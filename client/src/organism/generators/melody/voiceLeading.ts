import type { ScheduledNote } from '../types'
import { noteToMidi, midiToNote } from '../../performers/InstrumentPerformerRouter'

export interface VoiceLeadOptions {
  /** Max semitones allowed between consecutive notes before octave-folding kicks in. */
  maxLeapSemitones: number
  /** Lowest MIDI note the line may sit on. */
  floorMidi: number
  /** Highest MIDI note the line may sit on (register ceiling — kills shrieking highs). */
  ceilingMidi: number
}

/**
 * Octave voice-leading: keep each note's PITCH CLASS (the harmony chosen upstream
 * stays intact) and only move its OCTAVE so the line moves mostly by step instead
 * of leaping high↔low. Register cap wins over leap — a note is never left above the
 * ceiling. Velocity, duration, and time are untouched; only `pitch` changes.
 */
export function applyVoiceLeading(notes: ScheduledNote[], opts: VoiceLeadOptions): ScheduledNote[] {
  const { maxLeapSemitones, floorMidi, ceilingMidi } = opts
  let prev: number | null = null

  return notes.map((note) => {
    const midi = noteToMidi(note.pitch)
    if (midi == null) return note
    let m = midi

    // 1. Fold toward the previous note until the interval is small (same pitch class).
    if (prev != null) {
      while (m - prev > maxLeapSemitones) m -= 12
      while (prev - m > maxLeapSemitones) m += 12
    }

    // 2. Register cap takes priority over leap size.
    while (m > ceilingMidi) m -= 12
    while (m < floorMidi) m += 12

    prev = m
    return { ...note, pitch: midiToNote(m) }
  })
}
