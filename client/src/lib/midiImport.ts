// client/src/lib/midiImport.ts
// MIDI file import utility — parses .mid files and converts to Piano Roll Note format
// Uses @tonejs/midi for robust Standard MIDI File parsing

import { Midi } from '@tonejs/midi';
import { v4 as uuidv4 } from 'uuid';

export interface ImportedNote {
  id: string;
  note: string;       // e.g. 'C', 'D#'
  octave: number;     // e.g. 4
  step: number;       // 16th-note step position (0-based)
  velocity: number;   // 0-127
  length: number;     // duration in 16th-note steps
  drumType?: 'kick' | 'snare' | 'hihat' | 'perc';
}

export interface ImportedTrack {
  name: string;
  instrument: string;
  notes: ImportedNote[];
  channel: number;
  isDrum: boolean;
}

export interface MidiImportResult {
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  tracks: ImportedTrack[];
  totalSteps: number;
  durationSeconds: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// General MIDI drum map — maps MIDI note numbers to drum types
const DRUM_MAP: Record<number, 'kick' | 'snare' | 'hihat' | 'perc'> = {
  35: 'kick', 36: 'kick',
  38: 'snare', 40: 'snare', 37: 'snare',
  42: 'hihat', 44: 'hihat', 46: 'hihat',
  // Everything else maps to perc
};

// General MIDI program number to instrument name mapping
const GM_INSTRUMENT_MAP: Record<number, string> = {
  0: 'acoustic_grand_piano', 1: 'acoustic_grand_piano', 2: 'electric_piano_1',
  3: 'electric_piano_1', 4: 'electric_piano_2', 5: 'electric_piano_1',
  6: 'harpsichord', 7: 'harpsichord',
  24: 'acoustic_guitar_nylon', 25: 'acoustic_guitar_steel',
  26: 'electric_guitar_clean', 27: 'electric_guitar_clean',
  28: 'electric_guitar_clean', 29: 'electric_guitar_clean',
  30: 'electric_guitar_clean', 31: 'electric_guitar_clean',
  32: 'acoustic_bass', 33: 'electric_bass_finger', 34: 'electric_bass_pick',
  35: 'fretless_bass', 36: 'slap_bass_1', 37: 'slap_bass_1',
  38: 'synth_bass_1', 39: 'synth_bass_2',
  40: 'violin', 41: 'viola', 42: 'cello', 43: 'contrabass',
  48: 'string_ensemble_1', 49: 'string_ensemble_1',
  56: 'trumpet', 57: 'trombone', 58: 'trombone', 59: 'french_horn',
  60: 'french_horn', 61: 'french_horn', 62: 'french_horn', 63: 'french_horn',
  64: 'tenor_sax', 65: 'tenor_sax', 66: 'tenor_sax', 67: 'tenor_sax',
  68: 'clarinet', 69: 'clarinet',
  73: 'flute', 74: 'flute', 75: 'flute', 76: 'flute',
  80: 'lead_1_square', 81: 'lead_2_sawtooth',
  88: 'pad_2_warm', 89: 'pad_2_warm',
  104: 'acoustic_guitar_steel', // sitar → guitar
  105: 'acoustic_guitar_steel', // banjo → guitar
  46: 'orchestral_harp',
};

function midiNoteToName(midi: number): { note: string; octave: number } {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return { note: NOTE_NAMES[noteIndex], octave };
}

function resolveInstrument(programNumber: number | undefined, trackName: string): string {
  if (programNumber !== undefined && GM_INSTRUMENT_MAP[programNumber]) {
    return GM_INSTRUMENT_MAP[programNumber];
  }
  // Try to guess from track name
  const lower = trackName.toLowerCase();
  if (lower.includes('piano') || lower.includes('keys')) return 'acoustic_grand_piano';
  if (lower.includes('bass')) return 'electric_bass_finger';
  if (lower.includes('guitar')) return 'acoustic_guitar_steel';
  if (lower.includes('violin') || lower.includes('strings')) return 'violin';
  if (lower.includes('flute')) return 'flute';
  if (lower.includes('trumpet') || lower.includes('brass')) return 'trumpet';
  if (lower.includes('sax')) return 'tenor_sax';
  if (lower.includes('synth') || lower.includes('lead')) return 'lead_1_square';
  if (lower.includes('pad')) return 'pad_2_warm';
  if (lower.includes('organ')) return 'church_organ';
  return 'acoustic_grand_piano';
}

/**
 * Parse a MIDI file (ArrayBuffer) and convert to Piano Roll format
 */
export function parseMidiFile(arrayBuffer: ArrayBuffer, targetBpm?: number): MidiImportResult {
  const midi = new Midi(arrayBuffer);

  // Extract tempo — use the first tempo marker, or default to 120
  const bpm = targetBpm || Math.round(midi.header.tempos?.[0]?.bpm || 120);

  // Extract time signature
  const ts = midi.header.timeSignatures?.[0];
  const timeSignature = {
    numerator: ts?.timeSignature?.[0] || 4,
    denominator: ts?.timeSignature?.[1] || 4,
  };

  const secondsPer16th = 60 / bpm / 4; // duration of one 16th note in seconds

  const importedTracks: ImportedTrack[] = [];

  for (const track of midi.tracks) {
    if (track.notes.length === 0) continue;

    const isDrum = track.channel === 9 || track.channel === 10 ||
      track.name?.toLowerCase().includes('drum') ||
      track.name?.toLowerCase().includes('perc');

    const notes: ImportedNote[] = [];

    for (const midiNote of track.notes) {
      // Convert time (seconds) to 16th-note steps
      const step = Math.round(midiNote.time / secondsPer16th);
      const lengthSteps = Math.max(1, Math.round(midiNote.duration / secondsPer16th));
      const velocity = Math.round(midiNote.velocity * 127);
      const { note, octave } = midiNoteToName(midiNote.midi);

      const importedNote: ImportedNote = {
        id: uuidv4(),
        note,
        octave,
        step,
        velocity: Math.min(127, Math.max(1, velocity)),
        length: lengthSteps,
      };

      // Map drum notes
      if (isDrum) {
        importedNote.drumType = DRUM_MAP[midiNote.midi] || 'perc';
      }

      notes.push(importedNote);
    }

    // Sort notes by step position
    notes.sort((a, b) => a.step - b.step);

    const instrument = isDrum
      ? 'drums'
      : resolveInstrument(track.instrument?.number, track.name || '');

    importedTracks.push({
      name: track.name || `Track ${importedTracks.length + 1}`,
      instrument,
      notes,
      channel: track.channel ?? 0,
      isDrum,
    });
  }

  // Calculate total steps and duration
  const maxStep = importedTracks.reduce((max, track) => {
    const trackMax = track.notes.reduce((m, n) => Math.max(m, n.step + n.length), 0);
    return Math.max(max, trackMax);
  }, 0);

  return {
    bpm,
    timeSignature,
    tracks: importedTracks,
    totalSteps: maxStep,
    durationSeconds: midi.duration,
  };
}

/**
 * Parse a base64-encoded MIDI string
 */
export function parseMidiBase64(base64: string, targetBpm?: number): MidiImportResult {
  // Strip data URI prefix if present
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '');
  const binaryString = atob(cleaned);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return parseMidiFile(bytes.buffer, targetBpm);
}

/**
 * Open a file picker dialog and import a MIDI file
 * Returns null if the user cancels
 */
export function openMidiFilePicker(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mid,.midi';
    input.onchange = () => {
      const file = input.files?.[0] || null;
      resolve(file);
    };
    input.oncancel = () => resolve(null);
    // Some browsers don't fire oncancel — resolve null after timeout
    setTimeout(() => {
      if (!input.files?.length) resolve(null);
    }, 120000);
    input.click();
  });
}

/**
 * Read a File as ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
