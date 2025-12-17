/**
 * MIDI Export Utility
 * Converts piano roll notes to Standard MIDI File (SMF) format
 */

import type { Note, Track } from '@/components/studio/types/pianoRollTypes';

// MIDI Constants
const MIDI_HEADER = [0x4D, 0x54, 0x68, 0x64]; // "MThd"
const MIDI_TRACK_HEADER = [0x4D, 0x54, 0x72, 0x6B]; // "MTrk"
const TICKS_PER_QUARTER = 480; // Standard resolution

// Note name to MIDI number mapping
const NOTE_TO_MIDI: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4, 'E#': 5,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11, 'B#': 0,
};

// General MIDI instrument mapping
const INSTRUMENT_TO_PROGRAM: Record<string, number> = {
  'piano': 0,
  'electric_piano_1': 4,
  'electric_piano_2': 5,
  'harpsichord': 6,
  'organ': 19,
  'bass-electric': 33,
  'electric_bass_pick': 34,
  'bass-upright': 32,
  'bass-synth': 38,
  'synth_bass_2': 39,
  'fretless_bass': 35,
  'slap_bass_1': 36,
  'guitar-acoustic': 25,
  'guitar-nylon': 24,
  'guitar-electric': 27,
  'guitar-distorted': 30,
  'strings-violin': 40,
  'viola': 41,
  'cello': 42,
  'contrabass': 43,
  'strings': 48,
  'orchestral_harp': 46,
  'trumpet': 56,
  'trombone': 57,
  'french_horn': 60,
  'flute': 73,
  'clarinet': 71,
  'tenor_sax': 66,
  'synth-analog': 81,
  'leads-square': 80,
  'leads-saw': 81,
  'pads-warm': 89,
  'pads-strings': 91,
  'pads-choir': 91,
  'timpani': 47,
  'taiko_drum': 116,
  'steel_drums': 114,
  'woodblock': 115,
  'choir_aahs': 52,
  'synth_voice': 54,
};

/**
 * Convert note name and octave to MIDI note number
 */
function noteToMidi(noteName: string, octave: number): number {
  const baseNote = NOTE_TO_MIDI[noteName];
  if (baseNote === undefined) {
    console.warn(`Unknown note: ${noteName}, defaulting to C`);
    return 60 + (octave - 4) * 12; // Default to C
  }
  // MIDI note 60 = C4 (middle C)
  return baseNote + (octave + 1) * 12;
}

/**
 * Convert steps to MIDI ticks
 * Assuming 4 steps = 1 quarter note
 */
function stepsToTicks(steps: number): number {
  return Math.round((steps / 4) * TICKS_PER_QUARTER);
}

/**
 * Write variable-length quantity (VLQ) for MIDI delta times
 */
function writeVLQ(value: number): number[] {
  if (value < 0) value = 0;
  
  const bytes: number[] = [];
  let v = value;
  
  bytes.unshift(v & 0x7F);
  v >>= 7;
  
  while (v > 0) {
    bytes.unshift((v & 0x7F) | 0x80);
    v >>= 7;
  }
  
  return bytes;
}

/**
 * Write a 16-bit big-endian value
 */
function write16(value: number): number[] {
  return [(value >> 8) & 0xFF, value & 0xFF];
}

/**
 * Write a 32-bit big-endian value
 */
function write32(value: number): number[] {
  return [
    (value >> 24) & 0xFF,
    (value >> 16) & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF,
  ];
}

interface MidiEvent {
  delta: number;
  data: number[];
}

/**
 * Create a tempo meta event
 */
function createTempoEvent(bpm: number): MidiEvent {
  const microsecondsPerBeat = Math.round(60000000 / bpm);
  return {
    delta: 0,
    data: [
      0xFF, 0x51, 0x03, // Meta event: Set Tempo
      (microsecondsPerBeat >> 16) & 0xFF,
      (microsecondsPerBeat >> 8) & 0xFF,
      microsecondsPerBeat & 0xFF,
    ],
  };
}

/**
 * Create a time signature meta event
 */
function createTimeSignatureEvent(numerator: number = 4, denominator: number = 4): MidiEvent {
  const denominatorPower = Math.log2(denominator);
  return {
    delta: 0,
    data: [
      0xFF, 0x58, 0x04, // Meta event: Time Signature
      numerator,
      denominatorPower,
      24, // MIDI clocks per metronome click
      8,  // 32nd notes per quarter note
    ],
  };
}

/**
 * Create a track name meta event
 */
function createTrackNameEvent(name: string): MidiEvent {
  const nameBytes = Array.from(new TextEncoder().encode(name));
  return {
    delta: 0,
    data: [0xFF, 0x03, nameBytes.length, ...nameBytes],
  };
}

/**
 * Create a program change event
 */
function createProgramChangeEvent(channel: number, program: number): MidiEvent {
  return {
    delta: 0,
    data: [0xC0 | (channel & 0x0F), program & 0x7F],
  };
}

/**
 * Create a note on event
 */
function createNoteOnEvent(delta: number, channel: number, note: number, velocity: number): MidiEvent {
  return {
    delta,
    data: [0x90 | (channel & 0x0F), note & 0x7F, velocity & 0x7F],
  };
}

/**
 * Create a note off event
 */
function createNoteOffEvent(delta: number, channel: number, note: number): MidiEvent {
  return {
    delta,
    data: [0x80 | (channel & 0x0F), note & 0x7F, 0],
  };
}

/**
 * Create end of track meta event
 */
function createEndOfTrackEvent(delta: number = 0): MidiEvent {
  return {
    delta,
    data: [0xFF, 0x2F, 0x00],
  };
}

/**
 * Build a MIDI track from events
 */
function buildTrack(events: MidiEvent[]): number[] {
  const trackData: number[] = [];
  
  for (const event of events) {
    trackData.push(...writeVLQ(event.delta));
    trackData.push(...event.data);
  }
  
  return [
    ...MIDI_TRACK_HEADER,
    ...write32(trackData.length),
    ...trackData,
  ];
}

export interface MidiExportOptions {
  bpm?: number;
  timeSignature?: { numerator: number; denominator: number };
  projectName?: string;
}

/**
 * Export notes to MIDI file format
 */
export function exportNotesToMidi(
  notes: Note[],
  options: MidiExportOptions = {}
): Uint8Array {
  const { bpm = 120, timeSignature = { numerator: 4, denominator: 4 }, projectName = 'CodedSwitch Export' } = options;

  // Create tempo track (track 0)
  const tempoTrackEvents: MidiEvent[] = [
    createTrackNameEvent(projectName),
    createTimeSignatureEvent(timeSignature.numerator, timeSignature.denominator),
    createTempoEvent(bpm),
    createEndOfTrackEvent(stepsToTicks(64)), // End after 4 bars
  ];

  // Create note track (track 1)
  const noteTrackEvents: MidiEvent[] = [
    createTrackNameEvent('Piano Roll'),
    createProgramChangeEvent(0, 0), // Piano on channel 0
  ];

  // Sort notes by start time
  const sortedNotes = [...notes].sort((a, b) => a.step - b.step);

  // Create note on/off events
  interface NoteEvent {
    tick: number;
    type: 'on' | 'off';
    midiNote: number;
    velocity: number;
  }

  const noteEvents: NoteEvent[] = [];

  for (const note of sortedNotes) {
    const midiNote = noteToMidi(note.note, note.octave);
    const startTick = stepsToTicks(note.step);
    const endTick = stepsToTicks(note.step + note.length);
    const velocity = Math.min(127, Math.max(1, note.velocity));

    noteEvents.push({ tick: startTick, type: 'on', midiNote, velocity });
    noteEvents.push({ tick: endTick, type: 'off', midiNote, velocity: 0 });
  }

  // Sort by tick, with note-offs before note-ons at same tick
  noteEvents.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return a.type === 'off' ? -1 : 1;
  });

  // Convert to MIDI events with delta times
  let lastTick = 0;
  for (const event of noteEvents) {
    const delta = event.tick - lastTick;
    lastTick = event.tick;

    if (event.type === 'on') {
      noteTrackEvents.push(createNoteOnEvent(delta, 0, event.midiNote, event.velocity));
    } else {
      noteTrackEvents.push(createNoteOffEvent(delta, 0, event.midiNote));
    }
  }

  // Add end of track
  noteTrackEvents.push(createEndOfTrackEvent(TICKS_PER_QUARTER));

  // Build MIDI file
  const tempoTrack = buildTrack(tempoTrackEvents);
  const noteTrack = buildTrack(noteTrackEvents);

  // MIDI header: format 1, 2 tracks, resolution
  const header = [
    ...MIDI_HEADER,
    ...write32(6), // Header length
    ...write16(1), // Format 1 (multiple tracks)
    ...write16(2), // Number of tracks
    ...write16(TICKS_PER_QUARTER), // Ticks per quarter note
  ];

  const midiData = new Uint8Array([...header, ...tempoTrack, ...noteTrack]);
  return midiData;
}

/**
 * Export multiple tracks to MIDI file format
 */
export function exportTracksToMidi(
  tracks: Track[],
  options: MidiExportOptions = {}
): Uint8Array {
  const { bpm = 120, timeSignature = { numerator: 4, denominator: 4 }, projectName = 'CodedSwitch Export' } = options;

  const allTracks: number[][] = [];

  // Create tempo track (track 0)
  const tempoTrackEvents: MidiEvent[] = [
    createTrackNameEvent(projectName),
    createTimeSignatureEvent(timeSignature.numerator, timeSignature.denominator),
    createTempoEvent(bpm),
    createEndOfTrackEvent(stepsToTicks(64)),
  ];
  allTracks.push(buildTrack(tempoTrackEvents));

  // Create a track for each input track
  tracks.forEach((track, index) => {
    const channel = Math.min(index, 15); // MIDI has 16 channels (0-15)
    const program = INSTRUMENT_TO_PROGRAM[track.instrument] ?? 0;

    const trackEvents: MidiEvent[] = [
      createTrackNameEvent(track.name || `Track ${index + 1}`),
      createProgramChangeEvent(channel, program),
    ];

    // Sort notes by start time
    const sortedNotes = [...track.notes].sort((a, b) => a.step - b.step);

    interface NoteEvent {
      tick: number;
      type: 'on' | 'off';
      midiNote: number;
      velocity: number;
    }

    const noteEvents: NoteEvent[] = [];

    for (const note of sortedNotes) {
      const midiNote = noteToMidi(note.note, note.octave);
      const startTick = stepsToTicks(note.step);
      const endTick = stepsToTicks(note.step + note.length);
      // Apply track volume to velocity
      const velocity = Math.min(127, Math.max(1, Math.round(note.velocity * (track.volume / 100))));

      if (!track.muted) {
        noteEvents.push({ tick: startTick, type: 'on', midiNote, velocity });
        noteEvents.push({ tick: endTick, type: 'off', midiNote, velocity: 0 });
      }
    }

    // Sort by tick
    noteEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.type === 'off' ? -1 : 1;
    });

    // Convert to MIDI events
    let lastTick = 0;
    for (const event of noteEvents) {
      const delta = event.tick - lastTick;
      lastTick = event.tick;

      if (event.type === 'on') {
        trackEvents.push(createNoteOnEvent(delta, channel, event.midiNote, event.velocity));
      } else {
        trackEvents.push(createNoteOffEvent(delta, channel, event.midiNote));
      }
    }

    trackEvents.push(createEndOfTrackEvent(TICKS_PER_QUARTER));
    allTracks.push(buildTrack(trackEvents));
  });

  // Build MIDI file header
  const header = [
    ...MIDI_HEADER,
    ...write32(6),
    ...write16(1), // Format 1
    ...write16(allTracks.length),
    ...write16(TICKS_PER_QUARTER),
  ];

  // Combine all data
  const totalLength = header.length + allTracks.reduce((sum, t) => sum + t.length, 0);
  const midiData = new Uint8Array(totalLength);
  
  let offset = 0;
  midiData.set(header, offset);
  offset += header.length;
  
  for (const track of allTracks) {
    midiData.set(track, offset);
    offset += track.length;
  }

  return midiData;
}

/**
 * Download MIDI data as a file
 */
export function downloadMidi(data: Uint8Array, filename: string = 'export.mid'): void {
  // Create blob directly from the Uint8Array
  const blob = new Blob([new Uint8Array(data)], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.mid') ? filename : `${filename}.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export and download notes as MIDI
 */
export function exportAndDownloadMidi(
  notes: Note[],
  filename: string = 'export.mid',
  options: MidiExportOptions = {}
): void {
  const midiData = exportNotesToMidi(notes, options);
  downloadMidi(midiData, filename);
}

/**
 * Export and download tracks as MIDI
 */
export function exportAndDownloadTracksMidi(
  tracks: Track[],
  filename: string = 'export.mid',
  options: MidiExportOptions = {}
): void {
  const midiData = exportTracksToMidi(tracks, options);
  downloadMidi(midiData, filename);
}
