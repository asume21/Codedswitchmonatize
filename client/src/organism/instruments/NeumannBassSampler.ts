import * as Tone from 'tone'

// Neumann bass pack — 159 chromatic WAV files served from server/Assets/neumann-bass/
// Files are numbered 0000.wav–0158.wav, each representing one MIDI semitone.
// BASE_MIDI is the MIDI note that 0000.wav was recorded at.
// If the bass sounds sharp/flat, adjust BASE_MIDI by ±1 semitone.
const BASE_MIDI = 24  // C1 — assumption; adjust if samples sound off-pitch

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function midiToNoteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[pc]}${octave}`
}

function fileId(midiNote: number): string {
  const idx = midiNote - BASE_MIDI
  if (idx < 0 || idx > 158) return ''
  return String(idx).padStart(4, '0') + '.wav'
}

// Load one sample per octave across the bass register (C1–C5).
// Tone.Sampler pitch-shifts to fill the gaps between reference notes.
const REFERENCE_MIDI_NOTES = [24, 36, 48, 60, 72]  // C1, C2, C3, C4, C5

export function createNeumannBassSampler(
  onLoad?: () => void,
): Tone.Sampler {
  const urls: Record<string, string> = {}

  for (const midi of REFERENCE_MIDI_NOTES) {
    const id = fileId(midi)
    if (id) urls[midiToNoteName(midi)] = `/api/neumann-bass/${id}`
  }

  return new Tone.Sampler({
    urls,
    release: 1.2,
    attack: 0.01,
    onload: onLoad,
  })
}
