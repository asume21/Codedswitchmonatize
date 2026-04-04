/**
 * organismToStudioBridge — converts Organism GeneratorEvent[] into
 * StudioNote[] that the Piano Roll, Beat Maker, and Beat Lab can consume.
 *
 * Called when:
 *  1. A recording stops (stopRecording)
 *  2. A session is captured (captureSession)
 *  3. Astutely generates a pattern (broadcastAstutelyPattern)
 *
 * The converted notes are pushed into useStudioStore as an OrganismSnapshot,
 * preserving history so earlier generations are never lost.
 */

import { useStudioStore } from './useStudioStore'
import type {
  StudioNote,
  GeneratorType,
  OrganismSnapshot,
} from './useStudioStore'

// ── Organism types (imported inline to avoid circular deps) ────────

interface GeneratorEvent {
  frameIndex:   number
  timestamp:    number
  generator:    'drum' | 'bass' | 'melody' | 'texture' | 'chord'
  eventType:    'note_on' | 'note_off' | 'pattern_change' | 'behavior_change'
  pitch?:       number
  velocity?:    number
  durationMs?:  number
  meta?:        string
}

// ── MIDI note → name/octave ────────────────────────────────────────

// Use sharps exclusively — Piano Roll PIANO_KEYS and pianoRollTypes both use sharps (D#/G#/A#).
// Using flats (Eb/Ab/Bb) causes those notes to be invisible in the Piano Roll.
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

function midiToNoteName(midi: number): { note: string; octave: number } {
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  return { note: NOTE_NAMES[noteIndex], octave }
}

// ── Drum MIDI mapping ──────────────────────────────────────────────

const DRUM_MIDI_MAP: Record<number, 'kick' | 'snare' | 'hihat' | 'perc'> = {
  35: 'kick',  36: 'kick',
  38: 'snare', 40: 'snare',
  42: 'hihat', 44: 'hihat', 46: 'hihat',
}

function drumTypeFromMidi(midi: number): 'kick' | 'snare' | 'hihat' | 'perc' {
  return DRUM_MIDI_MAP[midi] ?? 'perc'
}

// ── Core conversion ────────────────────────────────────────────────

function eventsToStudioNotes(
  events: GeneratorEvent[],
  bpm: number,
  generator: GeneratorType
): StudioNote[] {
  const noteOns = events.filter(e => e.eventType === 'note_on' && e.pitch !== undefined)
  if (noteOns.length === 0) return []

  const msPerStep = (60000 / bpm) / 4  // 16th note duration in ms
  const sessionStartMs = noteOns[0].timestamp

  const notes: StudioNote[] = []

  for (const event of noteOns) {
    const pitch = event.pitch!

    // Find matching note_off to determine duration
    const noteOff = events.find(e =>
      e.eventType === 'note_off' &&
      e.pitch === pitch &&
      e.timestamp > event.timestamp
    )

    const durationMs = noteOff
      ? noteOff.timestamp - event.timestamp
      : (event.durationMs ?? 100)

    const relativeMs = event.timestamp - sessionStartMs
    const step = Math.round(relativeMs / msPerStep)
    const length = Math.max(1, Math.round(durationMs / msPerStep))

    const { note, octave } = midiToNoteName(pitch)

    const studioNote: StudioNote = {
      id: `org-${generator}-${step}-${pitch}-${Date.now().toString(36)}`,
      note,
      octave,
      step,
      velocity: event.velocity ?? 80,
      length,
    }

    if (generator === 'drum') {
      studioNote.drumType = drumTypeFromMidi(pitch)
    }

    notes.push(studioNote)
  }

  return notes
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Convert raw GeneratorEvents from a CaptureEngine session and push
 * the result into useStudioStore as an OrganismSnapshot.
 */
export function bridgeOrganismToStore(
  generatorEvents: GeneratorEvent[],
  bpm: number,
  source: 'organism' | 'astutely' = 'organism'
): OrganismSnapshot {
  const store = useStudioStore.getState()

  const byGenerator: Record<GeneratorType, GeneratorEvent[]> = {
    drum:    generatorEvents.filter(e => e.generator === 'drum'),
    bass:    generatorEvents.filter(e => e.generator === 'bass'),
    melody:  generatorEvents.filter(e => e.generator === 'melody'),
    texture: generatorEvents.filter(e => e.generator === 'texture'),
  }

  const tracks: Record<GeneratorType, StudioNote[]> = {
    drum:    eventsToStudioNotes(byGenerator.drum,    bpm, 'drum'),
    bass:    eventsToStudioNotes(byGenerator.bass,    bpm, 'bass'),
    melody:  eventsToStudioNotes(byGenerator.melody,  bpm, 'melody'),
    texture: eventsToStudioNotes(byGenerator.texture, bpm, 'texture'),
  }

  const snapshot: OrganismSnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    bpm,
    key: store.key,
    keyMode: store.keyMode,
    source,
    tracks,
  }

  store.pushOrganismSnapshot(snapshot)

  // Broadcast a CustomEvent so UnifiedStudioWorkspace can merge the notes
  // into its track list without needing a direct import of this bridge.
  window.dispatchEvent(new CustomEvent('organism:snapshot-ready', {
    detail: snapshot,
  }))

  return snapshot
}

/**
 * Convenience: get total note count across all generators in a snapshot.
 */
export function snapshotNoteCount(snapshot: OrganismSnapshot): number {
  return (
    snapshot.tracks.drum.length +
    snapshot.tracks.bass.length +
    snapshot.tracks.melody.length +
    snapshot.tracks.texture.length
  )
}
