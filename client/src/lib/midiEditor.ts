/**
 * MIDI Editor Engine — Velocity editing, CC automation, scale snap/highlight.
 * Extends the existing piano roll with professional MIDI editing features.
 */

import type { Note } from '../../../shared/studioTypes';

// ─── Scale Definitions ──────────────────────────────────────────────

export interface ScaleDefinition {
  name: string;
  intervals: number[]; // semitone intervals from root (0-11)
}

export const SCALES: Record<string, ScaleDefinition> = {
  'major':            { name: 'Major (Ionian)',      intervals: [0, 2, 4, 5, 7, 9, 11] },
  'minor':            { name: 'Natural Minor',       intervals: [0, 2, 3, 5, 7, 8, 10] },
  'harmonic-minor':   { name: 'Harmonic Minor',      intervals: [0, 2, 3, 5, 7, 8, 11] },
  'melodic-minor':    { name: 'Melodic Minor',       intervals: [0, 2, 3, 5, 7, 9, 11] },
  'dorian':           { name: 'Dorian',              intervals: [0, 2, 3, 5, 7, 9, 10] },
  'phrygian':         { name: 'Phrygian',            intervals: [0, 1, 3, 5, 7, 8, 10] },
  'lydian':           { name: 'Lydian',              intervals: [0, 2, 4, 6, 7, 9, 11] },
  'mixolydian':       { name: 'Mixolydian',          intervals: [0, 2, 4, 5, 7, 9, 10] },
  'pentatonic-major': { name: 'Major Pentatonic',    intervals: [0, 2, 4, 7, 9] },
  'pentatonic-minor': { name: 'Minor Pentatonic',    intervals: [0, 3, 5, 7, 10] },
  'blues':            { name: 'Blues',                intervals: [0, 3, 5, 6, 7, 10] },
  'chromatic':        { name: 'Chromatic',           intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  'whole-tone':       { name: 'Whole Tone',          intervals: [0, 2, 4, 6, 8, 10] },
  'diminished':       { name: 'Diminished',          intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Get the MIDI note number for a note name + octave.
 */
export function noteToMidi(noteName: string, octave: number): number {
  const idx = NOTE_NAMES.indexOf(noteName.replace('b', '#')); // normalize flats
  if (idx === -1) return 60; // default C4
  return idx + (octave + 1) * 12;
}

/**
 * Get note name + octave from MIDI number.
 */
export function midiToNote(midi: number): { name: string; octave: number } {
  return {
    name: NOTE_NAMES[midi % 12],
    octave: Math.floor(midi / 12) - 1,
  };
}

/**
 * Get the root note's MIDI offset (0-11) from a key name like "C", "F#", "Bb".
 */
export function keyToSemitone(key: string): number {
  const normalized = key.replace('b', '#'); // Bb -> A#, etc.
  const flatToSharp: Record<string, string> = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
  };
  const lookup = flatToSharp[key] || normalized;
  const idx = NOTE_NAMES.indexOf(lookup.charAt(0) + (lookup.length > 1 ? lookup.charAt(1) : ''));
  return idx >= 0 ? idx : 0;
}

/**
 * Check if a MIDI note is in the given scale.
 */
export function isNoteInScale(midiNote: number, rootKey: string, scaleName: string): boolean {
  const scale = SCALES[scaleName];
  if (!scale) return true; // chromatic = everything in scale
  const root = keyToSemitone(rootKey);
  const degree = ((midiNote % 12) - root + 12) % 12;
  return scale.intervals.includes(degree);
}

/**
 * Get all MIDI notes in a scale within a range.
 */
export function getScaleNotes(rootKey: string, scaleName: string, minMidi: number, maxMidi: number): number[] {
  const scale = SCALES[scaleName];
  if (!scale) return [];
  const root = keyToSemitone(rootKey);
  const notes: number[] = [];

  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const degree = ((midi % 12) - root + 12) % 12;
    if (scale.intervals.includes(degree)) {
      notes.push(midi);
    }
  }

  return notes;
}

/**
 * Snap a MIDI note to the nearest note in the scale.
 */
export function snapToScale(midiNote: number, rootKey: string, scaleName: string): number {
  if (isNoteInScale(midiNote, rootKey, scaleName)) return midiNote;

  const scale = SCALES[scaleName];
  if (!scale) return midiNote;
  const root = keyToSemitone(rootKey);

  // Search up and down for nearest scale note
  for (let offset = 1; offset <= 6; offset++) {
    const up = midiNote + offset;
    const down = midiNote - offset;
    if (up <= 127 && isNoteInScale(up, rootKey, scaleName)) return up;
    if (down >= 0 && isNoteInScale(down, rootKey, scaleName)) return down;
  }

  return midiNote;
}

/**
 * Snap all notes in a selection to the current scale.
 */
export function snapNotesToScale(notes: Note[], rootKey: string, scaleName: string): Note[] {
  return notes.map(note => {
    const midi = noteToMidi(note.note, note.octave);
    const snapped = snapToScale(midi, rootKey, scaleName);
    const { name, octave } = midiToNote(snapped);
    return { ...note, note: name, octave };
  });
}

// ─── Velocity Editing ───────────────────────────────────────────────

/**
 * Set velocity for a single note.
 */
export function setNoteVelocity(note: Note, velocity: number): Note {
  return { ...note, velocity: Math.max(1, Math.min(127, Math.round(velocity))) };
}

/**
 * Scale velocities of multiple notes by a factor.
 */
export function scaleVelocities(notes: Note[], factor: number): Note[] {
  return notes.map(n => ({
    ...n,
    velocity: Math.max(1, Math.min(127, Math.round(n.velocity * factor))),
  }));
}

/**
 * Humanize velocities — add random variation.
 */
export function humanizeVelocities(notes: Note[], amount: number = 15): Note[] {
  return notes.map(n => {
    const variation = (Math.random() - 0.5) * 2 * amount;
    return {
      ...n,
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity + variation))),
    };
  });
}

/**
 * Apply a velocity curve across a selection (crescendo/decrescendo).
 */
export function applyVelocityCurve(
  notes: Note[],
  startVelocity: number,
  endVelocity: number,
): Note[] {
  if (notes.length === 0) return notes;

  const sorted = [...notes].sort((a, b) => a.step - b.step);
  const minStep = sorted[0].step;
  const maxStep = sorted[sorted.length - 1].step;
  const range = maxStep - minStep || 1;

  return sorted.map(n => {
    const t = (n.step - minStep) / range;
    const velocity = startVelocity + (endVelocity - startVelocity) * t;
    return { ...n, velocity: Math.max(1, Math.min(127, Math.round(velocity))) };
  });
}

/**
 * Compress velocities — reduce dynamic range.
 */
export function compressVelocities(notes: Note[], threshold: number = 80, ratio: number = 2): Note[] {
  return notes.map(n => {
    if (n.velocity <= threshold) return n;
    const excess = n.velocity - threshold;
    const compressed = threshold + excess / ratio;
    return { ...n, velocity: Math.max(1, Math.min(127, Math.round(compressed))) };
  });
}

// ─── CC (Continuous Controller) Automation ───────────────────────────

export interface CCEvent {
  id: string;
  cc: number;       // CC number (0-127)
  value: number;     // 0-127
  step: number;      // position in steps (16th notes)
  trackId: string;
}

export interface CCLane {
  id: string;
  trackId: string;
  cc: number;
  name: string;
  events: CCEvent[];
}

export const COMMON_CC: Array<{ cc: number; name: string }> = [
  { cc: 1, name: 'Mod Wheel' },
  { cc: 2, name: 'Breath' },
  { cc: 7, name: 'Volume' },
  { cc: 10, name: 'Pan' },
  { cc: 11, name: 'Expression' },
  { cc: 64, name: 'Sustain Pedal' },
  { cc: 71, name: 'Filter Resonance' },
  { cc: 74, name: 'Filter Cutoff' },
  { cc: 91, name: 'Reverb Send' },
  { cc: 93, name: 'Chorus Send' },
];

/**
 * Create a new CC lane.
 */
export function createCCLane(trackId: string, cc: number): CCLane {
  const ccDef = COMMON_CC.find(c => c.cc === cc);
  return {
    id: crypto.randomUUID(),
    trackId,
    cc,
    name: ccDef?.name || `CC ${cc}`,
    events: [],
  };
}

/**
 * Add a CC event to a lane.
 */
export function addCCEvent(lane: CCLane, step: number, value: number): CCLane {
  const event: CCEvent = {
    id: crypto.randomUUID(),
    cc: lane.cc,
    value: Math.max(0, Math.min(127, Math.round(value))),
    step,
    trackId: lane.trackId,
  };

  // Replace any event at the same step
  const filtered = lane.events.filter(e => e.step !== step);
  return {
    ...lane,
    events: [...filtered, event].sort((a, b) => a.step - b.step),
  };
}

/**
 * Remove a CC event from a lane.
 */
export function removeCCEvent(lane: CCLane, eventId: string): CCLane {
  return {
    ...lane,
    events: lane.events.filter(e => e.id !== eventId),
  };
}

/**
 * Draw a CC curve (pencil tool) — takes samples and reduces to key events.
 */
export function drawCCCurve(
  lane: CCLane,
  samples: Array<{ step: number; value: number }>,
): CCLane {
  if (samples.length === 0) return lane;

  const minStep = Math.min(...samples.map(s => s.step));
  const maxStep = Math.max(...samples.map(s => s.step));

  // Remove existing events in the drawn range
  const existing = lane.events.filter(e => e.step < minStep || e.step > maxStep);

  // Simplify samples (keep every Nth + endpoints)
  const simplified = simplifyCCSamples(samples, 2);

  const newEvents: CCEvent[] = simplified.map(s => ({
    id: crypto.randomUUID(),
    cc: lane.cc,
    value: Math.max(0, Math.min(127, Math.round(s.value))),
    step: s.step,
    trackId: lane.trackId,
  }));

  return {
    ...lane,
    events: [...existing, ...newEvents].sort((a, b) => a.step - b.step),
  };
}

function simplifyCCSamples(
  samples: Array<{ step: number; value: number }>,
  tolerance: number,
): Array<{ step: number; value: number }> {
  if (samples.length <= 2) return samples;

  const first = samples[0];
  const last = samples[samples.length - 1];
  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < samples.length - 1; i++) {
    const expected = first.value + ((last.value - first.value) * (samples[i].step - first.step)) / (last.step - first.step || 1);
    const dist = Math.abs(samples[i].value - expected);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyCCSamples(samples.slice(0, maxIdx + 1), tolerance);
    const right = simplifyCCSamples(samples.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

/**
 * Get interpolated CC value at a specific step.
 */
export function getCCValueAtStep(lane: CCLane, step: number): number {
  if (lane.events.length === 0) return 0;

  const sorted = [...lane.events].sort((a, b) => a.step - b.step);

  if (step <= sorted[0].step) return sorted[0].value;
  if (step >= sorted[sorted.length - 1].step) return sorted[sorted.length - 1].value;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (step >= sorted[i].step && step <= sorted[i + 1].step) {
      const t = (step - sorted[i].step) / (sorted[i + 1].step - sorted[i].step || 1);
      return Math.round(sorted[i].value + (sorted[i + 1].value - sorted[i].value) * t);
    }
  }

  return sorted[sorted.length - 1].value;
}

// ─── Timing / Quantize ──────────────────────────────────────────────

export type QuantizeGrid = '1/4' | '1/8' | '1/16' | '1/32' | '1/4T' | '1/8T' | '1/16T';

const GRID_STEPS: Record<QuantizeGrid, number> = {
  '1/4': 4,
  '1/8': 2,
  '1/16': 1,
  '1/32': 0.5,
  '1/4T': 2.667,
  '1/8T': 1.333,
  '1/16T': 0.667,
};

/**
 * Quantize note positions to a grid.
 */
export function quantizeNotes(notes: Note[], grid: QuantizeGrid, strength: number = 1): Note[] {
  const gridSize = GRID_STEPS[grid];
  return notes.map(n => {
    const nearest = Math.round(n.step / gridSize) * gridSize;
    const quantized = n.step + (nearest - n.step) * strength;
    return { ...n, step: Math.round(quantized * 100) / 100 };
  });
}

/**
 * Humanize note timing — add subtle random offsets.
 */
export function humanizeTiming(notes: Note[], amountSteps: number = 0.3): Note[] {
  return notes.map(n => {
    const offset = (Math.random() - 0.5) * 2 * amountSteps;
    return { ...n, step: Math.max(0, n.step + offset) };
  });
}

/**
 * Apply swing to notes (shift every other 16th note).
 */
export function applySwing(notes: Note[], swingPercent: number = 60): Note[] {
  const swingAmount = (swingPercent - 50) / 100; // 0 = no swing, 0.1 = 60% swing
  return notes.map(n => {
    // Check if this note is on an "off" 16th note (odd steps)
    const isOffBeat = Math.round(n.step) % 2 === 1;
    if (isOffBeat) {
      return { ...n, step: n.step + swingAmount };
    }
    return n;
  });
}

// ─── Note Transformations ───────────────────────────────────────────

/**
 * Transpose notes by semitones.
 */
export function transposeNotes(notes: Note[], semitones: number): Note[] {
  return notes.map(n => {
    const midi = noteToMidi(n.note, n.octave) + semitones;
    const clamped = Math.max(0, Math.min(127, midi));
    const { name, octave } = midiToNote(clamped);
    return { ...n, note: name, octave };
  });
}

/**
 * Invert notes around a pivot point.
 */
export function invertNotes(notes: Note[], pivotMidi?: number): Note[] {
  if (notes.length === 0) return notes;

  const midis = notes.map(n => noteToMidi(n.note, n.octave));
  const pivot = pivotMidi ?? Math.round(midis.reduce((a, b) => a + b, 0) / midis.length);

  return notes.map((n, i) => {
    const inverted = pivot * 2 - midis[i];
    const clamped = Math.max(0, Math.min(127, inverted));
    const { name, octave } = midiToNote(clamped);
    return { ...n, note: name, octave };
  });
}

/**
 * Reverse the order of notes in time.
 */
export function reverseNotes(notes: Note[]): Note[] {
  if (notes.length <= 1) return notes;

  const sorted = [...notes].sort((a, b) => a.step - b.step);
  const minStep = sorted[0].step;
  const maxStep = sorted[sorted.length - 1].step + sorted[sorted.length - 1].length;

  return sorted.map(n => ({
    ...n,
    step: maxStep - (n.step - minStep) - n.length,
  }));
}

/**
 * Legato — extend each note to meet the next note.
 */
export function applyLegato(notes: Note[]): Note[] {
  const sorted = [...notes].sort((a, b) => a.step - b.step);
  return sorted.map((n, i) => {
    if (i < sorted.length - 1) {
      const nextStart = sorted[i + 1].step;
      return { ...n, length: Math.max(1, nextStart - n.step) };
    }
    return n;
  });
}

/**
 * Staccato — shorten all notes to a fraction of their length.
 */
export function applyStaccato(notes: Note[], fraction: number = 0.5): Note[] {
  return notes.map(n => ({
    ...n,
    length: Math.max(1, Math.round(n.length * fraction)),
  }));
}
