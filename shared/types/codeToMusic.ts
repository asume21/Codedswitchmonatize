/**
 * Code-to-Music Types
 * Defines all interfaces for the Code-to-Music algorithm
 */

export interface CodeToMusicRequest {
  code: string;
  language: string;
  variation: number; // 0-9
  genre: string;     // pop, rock, hiphop, edm, rnb, country
  useAI?: boolean;   // Use AI for enhanced music generation (optional, defaults to false)
}

export interface CodeToMusicResponse {
  success: boolean;
  music?: MusicData;
  error?: string;
  metadata?: {
    genre: string;
    variation: number;
    bpm: number;
    key: string;
    duration: number;
  };
}

export interface MusicData {
  timeline: TimelineEvent[];
  chords: ChordProgression[];
  melody: MelodyNote[];
  drums?: DrumPattern;
  metadata: MusicMetadata;
}

export interface TimelineEvent {
  time: number;        // seconds
  type: string;        // 'chord', 'note', 'drum'
  data: any;
  source?: string;     // which code element created this
}

export interface ChordProgression {
  chord: string;       // 'C', 'G', 'Am', 'F'
  notes: string[];     // ['C4', 'E4', 'G4']
  start: number;       // seconds
  duration: number;    // seconds
}

export interface MelodyNote {
  note: string;        // 'C4', 'E4', etc.
  start: number;       // seconds (time in timeline)
  duration: number;    // seconds
  velocity: number;    // 0-127 (will convert to 0-1 for audioEngine)
  instrument: string;  // 'piano', 'synth', 'bass', 'drums'
  source?: string;     // which code element created this
}

// Compatible with existing audioEngine NoteEvent
export interface AudioEngineNote {
  note: string;
  time: number;
  duration: string | number;
  velocity: number;    // 0-1 for audioEngine
  instrument?: 'piano' | 'synth' | 'bass' | 'drums' | 'custom';
}

export interface DrumPattern {
  kick: boolean[];     // 16 steps
  snare: boolean[];    // 16 steps
  hihat: boolean[];    // 16 steps
  openhat?: boolean[]; // 16 steps
  clap?: boolean[];    // 16 steps
  crash?: boolean[];   // 16 steps
}

export interface MusicMetadata {
  bpm: number;
  key: string;
  genre: string;
  variation: number;
  duration: number;
  generatedAt: string;
  seed: number;        // for reproducibility
  aiEnhanced?: boolean;
}

export interface GenreConfig {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  description: string;
  chords: string[];
  bpm: number;
  instruments: string[];
  style: string;
  drumPattern?: string;
  special?: Record<string, any>;
  progressions?: string[][];
  scales?: string[];
  moodMap?: Record<string, string[]>;
  rhythmicFeel?: 'straight' | 'swung' | 'syncopated' | 'driving';
  harmonicDensity?: 'sparse' | 'moderate' | 'rich';
  melodicRange?: 'narrow' | 'medium' | 'wide';
  tension?: number;
}

export interface CodeElement {
  type: 'class' | 'function' | 'variable' | 'loop' | 'conditional' | 'import' | 'return';
  name: string;
  line: number;
  content: string;
  nestingLevel: number;
}

export interface ParsedCode {
  elements: CodeElement[];
  language: string;
  totalLines: number;
  complexity: number; // 1-10
  mood?: 'happy' | 'sad' | 'neutral' | 'energetic' | 'chill';
}
