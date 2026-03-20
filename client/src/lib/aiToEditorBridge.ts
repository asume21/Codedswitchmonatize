/**
 * AI-to-Editor Bridge
 * 
 * Converts AI-generated music data (AstutelyResult format) into the native
 * formats used by each editor:
 *   - Piano Roll: Note[] (id, note name, octave, step, length, velocity)
 *   - Beat Lab / ProBeatMaker: DrumTrack[] with DrumStep[] patterns
 *   - Bass Generator: bass note arrays
 * 
 * This is the missing link that makes AI-generated music editable.
 */

// --- Types matching the AI output (AstutelyResult from shared/astutelyFallback.ts) ---

export interface AIBeatEvent {
  step: number;
  type: 'kick' | 'snare' | 'hihat' | 'perc';
}

export interface AINoteEvent {
  step: number;
  note: number;    // MIDI note number (0-127)
  duration: number; // in steps
}

export interface AIChordEvent {
  step: number;
  notes: number[]; // MIDI note numbers
  duration: number;
}

export interface AstutelyGenerated {
  style?: string;
  bpm: number;
  key?: string;
  drums?: AIBeatEvent[];
  bass?: AINoteEvent[];
  melody?: AINoteEvent[];
  chords?: AIChordEvent[];
  instruments?: {
    bass?: string;
    chords?: string;
    melody?: string;
    drumKit?: string;
  };
}

// --- Types matching Piano Roll (from types/pianoRollTypes.ts) ---

export interface PianoRollNote {
  id: string;
  note: string;       // 'C', 'C#', 'D', etc.
  octave: number;
  step: number;
  velocity: number;
  length: number;
  drumType?: 'kick' | 'snare' | 'hihat' | 'perc';
}

// --- Types matching ProBeatMaker ---

export interface DrumStep {
  active: boolean;
  velocity: number;
  probability: number;
  swing: number;
  pitch: number;
}

export interface DrumTrackPattern {
  id: string;
  name: string;
  pattern: DrumStep[];
}

// ============================================================================
//  MIDI number → note name + octave
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): { note: string; octave: number } {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return { note: NOTE_NAMES[noteIndex], octave };
}

export function noteNameToMidi(note: string, octave: number): number {
  const index = NOTE_NAMES.indexOf(note);
  if (index === -1) return 60; // default to middle C
  return (octave + 1) * 12 + index;
}

// ============================================================================
//  AI → Piano Roll Notes
// ============================================================================

let noteIdCounter = 0;
function genNoteId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++noteIdCounter}-${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Convert AI melody/bass/chord events into Piano Roll Note[] format.
 */
export function aiNotesToPianoRoll(
  events: AINoteEvent[],
  prefix = 'ai'
): PianoRollNote[] {
  return events.map(ev => {
    const { note, octave } = midiToNoteName(ev.note);
    return {
      id: genNoteId(prefix),
      note,
      octave,
      step: ev.step,
      velocity: 100,
      length: Math.max(1, ev.duration),
    };
  });
}

/**
 * Convert AI chord events into Piano Roll Note[] — one Note per chord tone.
 */
export function aiChordsToPianoRoll(chords: AIChordEvent[]): PianoRollNote[] {
  const notes: PianoRollNote[] = [];
  for (const chord of chords) {
    for (const midiNote of chord.notes) {
      const { note, octave } = midiToNoteName(midiNote);
      notes.push({
        id: genNoteId('chord'),
        note,
        octave,
        step: chord.step,
        velocity: 90,
        length: Math.max(1, chord.duration),
      });
    }
  }
  return notes;
}

/**
 * Convert AI drum events into Piano Roll Note[] with drumType field.
 */
export function aiDrumsToPianoRollNotes(drums: AIBeatEvent[]): PianoRollNote[] {
  // Map drum types to reasonable MIDI pitches for display
  const drumPitchMap: Record<string, { note: string; octave: number }> = {
    kick:  { note: 'C', octave: 2 },
    snare: { note: 'D', octave: 2 },
    hihat: { note: 'F#', octave: 2 },
    perc:  { note: 'A', octave: 2 },
  };

  return drums.map(ev => {
    const pitch = drumPitchMap[ev.type] || { note: 'C', octave: 2 };
    return {
      id: genNoteId('drum'),
      note: pitch.note,
      octave: pitch.octave,
      step: ev.step,
      velocity: 100,
      length: 1,
      drumType: ev.type,
    };
  });
}

// ============================================================================
//  AI → ProBeatMaker DrumTrack patterns
// ============================================================================

const DEFAULT_DRUM_TRACKS = [
  { id: 'kick',  name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'hihat', name: 'Hi-Hat' },
  { id: 'perc',  name: 'Perc' },
];

function createEmptyStep(): DrumStep {
  return { active: false, velocity: 100, probability: 100, swing: 0, pitch: 0 };
}

/**
 * Convert AI drum events into ProBeatMaker DrumTrack[] patterns.
 * patternLength = number of steps (default 16).
 */
export function aiDrumsToBeatMaker(
  drums: AIBeatEvent[],
  patternLength = 16
): DrumTrackPattern[] {
  // Initialize empty tracks
  const trackMap: Record<string, DrumStep[]> = {};
  for (const dt of DEFAULT_DRUM_TRACKS) {
    trackMap[dt.id] = Array.from({ length: patternLength }, () => createEmptyStep());
  }

  // Fill in active steps from AI data
  for (const ev of drums) {
    const trackId = ev.type;
    if (!trackMap[trackId]) {
      trackMap[trackId] = Array.from({ length: patternLength }, () => createEmptyStep());
    }
    const stepIdx = ev.step % patternLength;
    trackMap[trackId][stepIdx] = {
      ...trackMap[trackId][stepIdx],
      active: true,
      velocity: 100,
    };
  }

  return DEFAULT_DRUM_TRACKS.map(dt => ({
    id: dt.id,
    name: dt.name,
    pattern: trackMap[dt.id] || Array.from({ length: patternLength }, () => createEmptyStep()),
  }));
}

// ============================================================================
//  Full conversion: AstutelyResult → all editor formats at once
// ============================================================================

export interface ConvertedEditorData {
  /** For Piano Roll melody track */
  melodyNotes: PianoRollNote[];
  /** For Piano Roll bass track */
  bassNotes: PianoRollNote[];
  /** For Piano Roll chord track */
  chordNotes: PianoRollNote[];
  /** For Piano Roll drum notes (with drumType) */
  drumNotes: PianoRollNote[];
  /** For ProBeatMaker step sequencer */
  beatMakerTracks: DrumTrackPattern[];
  /** BPM from generation */
  bpm: number;
  /** Key from generation */
  key: string;
  /** Instrument assignments */
  instruments: {
    bass: string;
    chords: string;
    melody: string;
    drumKit: string;
  };
}

/**
 * Master conversion function: takes raw AI output and produces all editor formats.
 */
export function convertAIToEditorData(ai: AstutelyGenerated): ConvertedEditorData {
  return {
    melodyNotes: ai.melody ? aiNotesToPianoRoll(ai.melody, 'melody') : [],
    bassNotes: ai.bass ? aiNotesToPianoRoll(ai.bass, 'bass') : [],
    chordNotes: ai.chords ? aiChordsToPianoRoll(ai.chords) : [],
    drumNotes: ai.drums ? aiDrumsToPianoRollNotes(ai.drums) : [],
    beatMakerTracks: ai.drums ? aiDrumsToBeatMaker(ai.drums) : [],
    bpm: ai.bpm || 120,
    key: ai.key || 'C',
    instruments: {
      bass: ai.instruments?.bass || 'synth_bass',
      chords: ai.instruments?.chords || 'acoustic_grand_piano',
      melody: ai.instruments?.melody || 'acoustic_grand_piano',
      drumKit: ai.instruments?.drumKit || 'standard',
    },
  };
}

// ============================================================================
//  Event dispatchers — push converted data into editors via window events
// ============================================================================

/**
 * Dispatch converted AI data to the Piano Roll.
 * The Piano Roll listens for 'ai:loadNotes' and merges/replaces notes.
 */
export function dispatchToPianoRoll(notes: PianoRollNote[], trackName: string, instrument: string) {
  window.dispatchEvent(new CustomEvent('ai:loadNotes', {
    detail: { notes, trackName, instrument },
  }));
}

/**
 * Dispatch converted AI data to the Beat Lab / ProBeatMaker.
 * ProBeatMaker listens for 'ai:loadBeatPattern' and replaces its drum tracks.
 */
export function dispatchToBeatMaker(tracks: DrumTrackPattern[], bpm: number) {
  window.dispatchEvent(new CustomEvent('ai:loadBeatPattern', {
    detail: { tracks, bpm },
  }));
}

/**
 * Master dispatch: converts AI result and pushes to all relevant editors.
 * Also navigates to the appropriate view.
 */
export function dispatchAIGenerationToEditors(
  ai: AstutelyGenerated,
  options: {
    targetEditor?: 'piano-roll' | 'beat-lab' | 'arrangement' | 'all';
    navigateAfter?: boolean;
  } = {}
) {
  const { targetEditor = 'all', navigateAfter = true } = options;
  const data = convertAIToEditorData(ai);

  // Send melody to Piano Roll
  if (data.melodyNotes.length > 0 && (targetEditor === 'piano-roll' || targetEditor === 'all')) {
    dispatchToPianoRoll(data.melodyNotes, 'AI Melody', data.instruments.melody);
  }

  // Send bass to Piano Roll
  if (data.bassNotes.length > 0 && (targetEditor === 'piano-roll' || targetEditor === 'all')) {
    dispatchToPianoRoll(data.bassNotes, 'AI Bass', data.instruments.bass);
  }

  // Send chords to Piano Roll
  if (data.chordNotes.length > 0 && (targetEditor === 'piano-roll' || targetEditor === 'all')) {
    dispatchToPianoRoll(data.chordNotes, 'AI Chords', data.instruments.chords);
  }

  // Send drums to Beat Lab
  if (data.beatMakerTracks.length > 0 && (targetEditor === 'beat-lab' || targetEditor === 'all')) {
    dispatchToBeatMaker(data.beatMakerTracks, data.bpm);
  }

  // Send drum notes to Piano Roll too (for arrangement view)
  if (data.drumNotes.length > 0 && (targetEditor === 'piano-roll' || targetEditor === 'arrangement' || targetEditor === 'all')) {
    dispatchToPianoRoll(data.drumNotes, 'AI Drums', data.instruments.drumKit);
  }

  // Navigate to the target editor
  if (navigateAfter && targetEditor !== 'all') {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: targetEditor }));
  }

  return data;
}
