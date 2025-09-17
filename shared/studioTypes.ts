// Shared types and utilities for the DAW-like studio
import { v4 as uuidv4 } from 'uuid';

export interface NoteEvent {
  id: string;
  pitch: string; // e.g., "C4"
  start: number; // in beats
  duration: number; // in beats
  velocity: number; // 0-127
  trackId: string;
}

export interface Note {
  id: string;
  note: string; // e.g., "C"
  octave: number;
  step: number;
  velocity: number;
  length: number;
  trackId?: string;
}

export interface DrumPattern {
  kick: number[];    // 16 or 32 steps (0 or 1)
  snare: number[];
  hihat: number[];
  openhat: number[];
  clap: number[];
  tom: number[];
  perc: number[];
  crash: number[];
}

export interface LyricSection {
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  lines: {
    text: string;
    syllables?: number[];
  }[];
}

export interface PackManifest {
  id: string;
  name: string;
  description: string;
  samples: {
    id: string;
    name: string;
    type: 'one-shot' | 'loop' | 'fx';
    key?: string;
    bpm?: number;
    audioUrl?: string;
  }[];
  recipes: {
    id: string;
    name: string;
    description: string;
    parameters: Record<string, any>;
  }[];
}

export interface MasteringChain {
  modules: {
    eq?: {
      low: number;
      mid: number;
      high: number;
    };
    compressor?: {
      threshold: number;
      ratio: number;
      attack: number;
      release: number;
    };
    limiter?: {
      threshold: number;
      ceiling: number;
    };
  };
  targets: {
    lufs: number;
    truePeak: number;
  };
}

export interface Track {
  id: string;
  name: string;
  type: 'midi' | 'audio' | 'drum';
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  instrument?: string;
  notes: Note[];
  clips: Clip[];
  effects: Effect[];
}

export interface Clip {
  id: string;
  name: string;
  start: number; // in beats
  end: number;   // in beats
  loop: boolean;
  source: {
    type: 'recording' | 'ai' | 'imported';
    seed?: string;
    prompt?: string;
    provider?: string;
  };
  data: any; // Could be notes, audio buffer, etc.
}

export interface Effect {
  id: string;
  type: string;
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  key: string;
  swing: number; // 0-100%
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
}

// AI Generation Results
export interface AIGenerationResult<T> {
  data: T;
  seed: string;
  assumptions: string[];
  provider: string;
  model: string;
  timestamp: string;
}

// Constants
export const DEFAULT_BPM = 120;
export const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
export const DEFAULT_SWING = 10; // %
export const DEFAULT_MASTERING_TARGET = {
  lufs: -14,
  truePeak: -1
};

// Generate AI clip/region label
export function makeAIClipName(type: "Melody" | "Beat" | "Bass" | "Lyrics", seed: string): string {
  return `AI ${type} v1 (seed ${seed})`;
}

// Create a new empty project
export function createNewProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    bpm: DEFAULT_BPM,
    timeSignature: [...DEFAULT_TIME_SIGNATURE],
    key: 'C',
    swing: DEFAULT_SWING,
    tracks: [],
    createdAt: now,
    updatedAt: now
  };
}

// Create a new track with default values
export function createNewTrack(type: 'midi' | 'audio' | 'drum', name?: string): Track {
  return {
    id: uuidv4(),
    name: name || `Track ${Math.floor(Math.random() * 1000)}`,
    type,
    color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
    volume: 0.8,
    pan: 0,
    muted: false,
    soloed: false,
    notes: [],
    clips: [],
    effects: []
  };
}

// Create a new note with default values
export function createNewNote(pitch: string, start: number, duration: number, velocity: number = 100): Note {
  const note = pitch.replace(/[0-9]/g, '');
  const octave = parseInt(pitch.replace(/[^0-9]/g, ''), 10) || 4;
  
  return {
    id: uuidv4(),
    note,
    octave,
    step: Math.round(start * 4), // Convert beats to steps (16th notes)
    velocity,
    length: Math.round(duration * 4)
  };
}

// Convert between NoteEvent and Note
export function noteEventToNote(event: NoteEvent): Note {
  const note = event.pitch.replace(/[0-9]/g, '');
  const octave = parseInt(event.pitch.replace(/[^0-9]/g, ''), 10) || 4;
  
  return {
    id: event.id,
    note,
    octave,
    step: Math.round(event.start * 4), // 4 steps per beat
    velocity: event.velocity,
    length: Math.round(event.duration * 4),
    trackId: event.trackId
  };
}

export function noteToNoteEvent(note: Note): NoteEvent {
  return {
    id: note.id,
    pitch: `${note.note}${note.octave}`,
    start: note.step / 4,
    duration: note.length / 4,
    velocity: note.velocity,
    trackId: note.trackId || ''
  };
}

// Validation functions
export function validateNoteEvent(event: Partial<NoteEvent>): event is NoteEvent {
  return (
    typeof event.id === 'string' &&
    typeof event.pitch === 'string' &&
    typeof event.start === 'number' && event.start >= 0 &&
    typeof event.duration === 'number' && event.duration > 0 &&
    typeof event.velocity === 'number' && event.velocity >= 0 && event.velocity <= 127 &&
    typeof event.trackId === 'string' && event.trackId.length > 0
  );
}

export function validateDrumPattern(pattern: Partial<DrumPattern>): pattern is DrumPattern {
  const requiredLanes = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'tom', 'perc', 'crash'];
  return requiredLanes.every(lane => {
    const laneData = pattern[lane as keyof DrumPattern];
    return (
      Array.isArray(laneData) &&
      laneData.length > 0 &&
      laneData.every(step => step === 0 || step === 1)
    );
  });
}
