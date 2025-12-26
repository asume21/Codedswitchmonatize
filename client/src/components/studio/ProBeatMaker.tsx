/**
 * ProBeatMaker - Professional Beat Maker
 * Ableton/Logic-level features merged from all beat makers
 * 
 * Features:
 * - Step sequencer (8-64 steps)
 * - Velocity, probability, flam per step
 * - Multiple drum kits (808, 909, Acoustic, Lo-Fi)
 * - Swing, groove, humanize
 * - MIDI controller support
 * - Undo/redo history
 * - AI beat generation
 * - Pattern chaining
 * - Copy/paste steps
 * - Tap tempo
 * - Metronome
 * - Classic sample library
 * - Export to WAV/MIDI
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTransport } from '@/contexts/TransportContext';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import { useSessionDestination } from '@/contexts/SessionDestinationContext';
import { AIProviderSelector } from '@/components/ui/ai-provider-selector';
import { realisticAudio } from '@/lib/realisticAudio';
import { useMIDI } from '@/hooks/use-midi';

const BEAT_STORAGE_KEY = 'probeat-pattern-state';

// Default MIDI note number to drum type mapping (General MIDI standard + extended)
const DEFAULT_MIDI_NOTE_TO_DRUM: Record<number, DrumEngineType> = {
  36: 'kick',      // C1 - Bass Drum 1
  35: 'kick',      // B0 - Acoustic Bass Drum
  38: 'snare',     // D1 - Acoustic Snare
  40: 'snare',     // E1 - Electric Snare
  37: 'rim',       // C#1 - Side Stick
  39: 'clap',      // D#1 - Hand Clap
  42: 'hihat',     // F#1 - Closed Hi-Hat
  44: 'hihat',     // G#1 - Pedal Hi-Hat
  46: 'openhat',   // A#1 - Open Hi-Hat
  45: 'tom',       // A1 - Low Tom
  47: 'tom',       // B1 - Low-Mid Tom
  48: 'tom_hi',    // C2 - Hi-Mid Tom
  50: 'tom_hi',    // D2 - High Tom
  49: 'crash',     // C#2 - Crash Cymbal 1
  51: 'crash',     // D#2 - Ride Cymbal 1
  52: 'crash',     // E2 - Chinese Cymbal
  53: 'crash',     // F2 - Ride Bell
  54: 'perc',      // F#2 - Tambourine
  56: 'cowbell',   // G#2 - Cowbell
  60: 'conga',     // C3 - Hi Bongo
  61: 'conga',     // C#3 - Low Bongo
  62: 'conga',     // D3 - Mute Hi Conga
  63: 'conga',     // D#3 - Open Hi Conga
  64: 'conga',     // E3 - Low Conga
};

// MIDI note names for display
const MIDI_NOTE_NAMES: Record<number, string> = {};
const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
for (let i = 0; i <= 127; i++) {
  const octave = Math.floor(i / 12) - 1;
  const note = NOTE_LETTERS[i % 12];
  MIDI_NOTE_NAMES[i] = `${note}${octave}`;
}
import {
  Play, Square, RotateCcw, Undo2, Redo2, Shuffle, Send, ChevronDown, Wand2,
  Copy, Clipboard, Volume2, Disc, Zap, Timer, Settings, X, Music,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

// Logical drum engine types – expanded so different rows can sound distinct
type DrumEngineType =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hihat'
  | 'openhat'
  | 'tom'
  | 'tom_hi'
  | 'tom_mid'
  | 'tom_lo'
  | 'conga'
  | 'perc'
  | 'rim'
  | 'crash'
  | 'cowbell'
  | 'fx';

// Normalize drum ids to sound engine types
// Includes both track IDs and engine type names so MIDI can pass either
const DRUM_ID_TO_TYPE: Record<string, DrumEngineType> = {
  kick: 'kick',
  '808 kick': 'kick',
  snare: 'snare',
  'trap snare': 'snare',
  clap: 'clap',
  vox: 'perc',
  hihat: 'hihat',
  'closed hh': 'hihat',
  'soft hat': 'hihat',
  shaker: 'hihat',
  openhat: 'openhat',
  'open hh': 'openhat',
  ride: 'crash',
  crash: 'crash',
  cowbell: 'cowbell',
  fx: 'fx',
  foley: 'fx',
  bell: 'fx',
  perc: 'perc',
  rim: 'rim',
  tom: 'tom_mid',
  tom1: 'tom_hi',
  tom2: 'tom_mid',
  tom3: 'tom_lo',
  conga: 'conga',
  // Engine type names (for MIDI drum triggering)
  tom_hi: 'tom_hi',
  tom_mid: 'tom_mid',
  tom_lo: 'tom_lo',
};

// Types
interface DrumStep {
  active: boolean;
  velocity: number;
  probability: number;
  flam: boolean;      // Double hit
  roll: number;       // 0 = none, 2 = 2x, 3 = 3x, 4 = 4x
  pitch: number;      // -12 to +12 semitones
}

interface DrumTrack {
  id: string;
  name: string;
  color: string;
  pattern: DrumStep[];
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  // Per-track effects
  pitch: number;      // Global pitch shift
  decay: number;      // Envelope decay
  filterFreq: number; // Low-pass filter
  filterRes: number;  // Filter resonance
}

type AiNote = {
  time?: number;
  duration?: number;
  pitch?: string | number;
  velocity?: number;
};

function parsePitch(pitch: unknown): { note: string; octave: number } {
  if (typeof pitch === 'number' && Number.isFinite(pitch)) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(pitch / 12) - 1;
    const noteIndex = ((pitch % 12) + 12) % 12;
    return { note: noteNames[noteIndex] ?? 'C', octave };
  }

  if (typeof pitch === 'string') {
    const match = pitch.trim().match(/^([A-G][#b]?)(-?\d)$/i);
    if (match) {
      const [, noteRaw, octaveRaw] = match;
      const octave = parseInt(octaveRaw, 10);
      return { note: noteRaw.toUpperCase(), octave: Number.isNaN(octave) ? 4 : octave };
    }
  }

  return { note: 'C', octave: 4 };
}

function normalizeVelocity(raw: unknown): number {
  const fallback = 96;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  if (raw <= 1) return Math.max(0, Math.min(127, Math.round(raw * 127)));
  return Math.max(0, Math.min(127, Math.round(raw)));
}

// Drum Kit Definitions
const DRUM_KITS: Record<string, { name: string; description: string; tracks: { id: string; name: string; color: string }[] }> = {
  '808': {
    name: 'TR-808',
    description: 'Classic Roland 808 - Hip-Hop, Trap',
    tracks: [
      { id: 'kick', name: 'Kick', color: 'bg-red-500' },
      { id: 'snare', name: 'Snare', color: 'bg-blue-500' },
      { id: 'clap', name: 'Clap', color: 'bg-purple-500' },
      { id: 'hihat', name: 'Hi-Hat', color: 'bg-yellow-500' },
      { id: 'openhat', name: 'Open Hat', color: 'bg-green-500' },
      { id: 'cowbell', name: 'Cowbell', color: 'bg-orange-500' },
      { id: 'tom', name: 'Tom', color: 'bg-pink-500' },
      { id: 'conga', name: 'Conga', color: 'bg-cyan-500' },
    ],
  },
  '909': {
    name: 'TR-909',
    description: 'Classic Roland 909 - House, Techno',
    tracks: [
      { id: 'kick', name: 'Kick', color: 'bg-red-600' },
      { id: 'snare', name: 'Snare', color: 'bg-blue-600' },
      { id: 'clap', name: 'Clap', color: 'bg-purple-600' },
      { id: 'hihat', name: 'Closed HH', color: 'bg-yellow-600' },
      { id: 'openhat', name: 'Open HH', color: 'bg-green-600' },
      { id: 'ride', name: 'Ride', color: 'bg-orange-600' },
      { id: 'tom', name: 'Tom', color: 'bg-pink-600' },
      { id: 'crash', name: 'Crash', color: 'bg-cyan-600' },
    ],
  },
  'acoustic': {
    name: 'Acoustic Kit',
    description: 'Natural drum kit - Rock, Pop',
    tracks: [
      { id: 'kick', name: 'Kick', color: 'bg-amber-700' },
      { id: 'snare', name: 'Snare', color: 'bg-stone-500' },
      { id: 'hihat', name: 'Hi-Hat', color: 'bg-zinc-400' },
      { id: 'openhat', name: 'Open HH', color: 'bg-zinc-500' },
      { id: 'tom1', name: 'Tom Hi', color: 'bg-amber-600' },
      { id: 'tom2', name: 'Tom Mid', color: 'bg-amber-700' },
      { id: 'tom3', name: 'Tom Lo', color: 'bg-amber-800' },
      { id: 'crash', name: 'Crash', color: 'bg-yellow-300' },
    ],
  },
  'lofi': {
    name: 'Lo-Fi Kit',
    description: 'Dusty, vintage sounds - Lo-Fi Hip-Hop',
    tracks: [
      { id: 'kick', name: 'Dusty Kick', color: 'bg-rose-800' },
      { id: 'snare', name: 'Vinyl Snare', color: 'bg-slate-600' },
      { id: 'hihat', name: 'Soft Hat', color: 'bg-amber-400' },
      { id: 'shaker', name: 'Shaker', color: 'bg-lime-600' },
      { id: 'rim', name: 'Rim Shot', color: 'bg-violet-500' },
      { id: 'perc', name: 'Perc', color: 'bg-teal-500' },
      { id: 'fx', name: 'Vinyl FX', color: 'bg-gray-500' },
      { id: 'foley', name: 'Foley', color: 'bg-emerald-600' },
    ],
  },
  'trap': {
    name: 'Trap Kit',
    description: 'Modern trap sounds - 808s, hi-hat rolls',
    tracks: [
      { id: 'kick', name: '808 Kick', color: 'bg-red-700' },
      { id: 'snare', name: 'Trap Snare', color: 'bg-blue-700' },
      { id: 'clap', name: 'Clap', color: 'bg-purple-700' },
      { id: 'hihat', name: 'Hi-Hat', color: 'bg-yellow-500' },
      { id: 'openhat', name: 'Open Hat', color: 'bg-green-500' },
      { id: 'perc', name: 'Perc', color: 'bg-orange-500' },
      { id: 'bell', name: 'Bell', color: 'bg-pink-400' },
      { id: 'vox', name: 'Vox Chop', color: 'bg-indigo-500' },
    ],
  },
};

const KIT_SOUND_ALIASES: Record<string, string> = {
  trap: '808',
};

const CLASSIC_KIT_PROFILES: Record<string, {
  kick: { start: number; end: number; sweep: number; decay: number; vol: number };
  snare: { tone: number; toneEnd: number; noiseDecay: number; toneDecay: number; noiseVol: number; toneVol: number };
  hihat: { decay: number; hp: number };
  openhat: { decay: number; hp: number };
  tom: { start: number; end: number; decay: number };
  tomHi?: { start: number; end: number; decay: number };
  tomMid?: { start: number; end: number; decay: number };
  tomLo?: { start: number; end: number; decay: number };
  perc?: { decay: number; bp: number; noiseVol?: number };
  cowbell?: { f1: number; f2: number; decay: number; vol: number };
  rim?: { freq: number; decay: number; vol: number };
  conga?: { start: number; end: number; decay: number };
}> = {
  default: {
    kick: { start: 65, end: 40, sweep: 0.15, decay: 0.32, vol: 1 },
    snare: { tone: 200, toneEnd: 170, noiseDecay: 0.15, toneDecay: 0.15, noiseVol: 1, toneVol: 0.6 },
    hihat: { decay: 0.05, hp: 9000 },
    openhat: { decay: 0.24, hp: 8000 },
    tom: { start: 220, end: 140, decay: 0.35 },
    tomHi: { start: 260, end: 170, decay: 0.32 },
    tomMid: { start: 220, end: 140, decay: 0.35 },
    tomLo: { start: 180, end: 110, decay: 0.38 },
    perc: { decay: 0.12, bp: 6500, noiseVol: 0.8 },
    cowbell: { f1: 560, f2: 830, decay: 0.18, vol: 0.9 },
    rim: { freq: 1800, decay: 0.05, vol: 0.7 },
    conga: { start: 340, end: 160, decay: 0.32 },
  },
  '808': {
    kick: { start: 55, end: 32, sweep: 0.18, decay: 0.42, vol: 1.1 },
    snare: { tone: 180, toneEnd: 140, noiseDecay: 0.16, toneDecay: 0.14, noiseVol: 0.95, toneVol: 0.55 },
    hihat: { decay: 0.06, hp: 9500 },
    openhat: { decay: 0.32, hp: 8500 },
    tom: { start: 210, end: 130, decay: 0.4 },
    tomHi: { start: 240, end: 150, decay: 0.36 },
    tomMid: { start: 210, end: 130, decay: 0.4 },
    tomLo: { start: 170, end: 100, decay: 0.42 },
    perc: { decay: 0.14, bp: 7000, noiseVol: 0.9 },
    cowbell: { f1: 540, f2: 800, decay: 0.22, vol: 1.0 },
    rim: { freq: 2000, decay: 0.05, vol: 0.75 },
    conga: { start: 360, end: 170, decay: 0.36 },
  },
  '909': {
    kick: { start: 72, end: 48, sweep: 0.12, decay: 0.28, vol: 1 },
    snare: { tone: 220, toneEnd: 170, noiseDecay: 0.13, toneDecay: 0.1, noiseVol: 1.1, toneVol: 0.65 },
    hihat: { decay: 0.07, hp: 11000 },
    openhat: { decay: 0.28, hp: 9500 },
    tom: { start: 230, end: 150, decay: 0.32 },
    tomHi: { start: 270, end: 170, decay: 0.26 },
    tomMid: { start: 230, end: 150, decay: 0.32 },
    tomLo: { start: 190, end: 120, decay: 0.34 },
    perc: { decay: 0.1, bp: 9000, noiseVol: 0.85 },
    cowbell: { f1: 620, f2: 1180, decay: 0.16, vol: 0.85 },
    rim: { freq: 2200, decay: 0.045, vol: 0.65 },
    conga: { start: 380, end: 200, decay: 0.28 },
  },
  acoustic: {
    kick: { start: 78, end: 55, sweep: 0.1, decay: 0.24, vol: 0.95 },
    snare: { tone: 200, toneEnd: 150, noiseDecay: 0.11, toneDecay: 0.11, noiseVol: 1, toneVol: 0.7 },
    hihat: { decay: 0.06, hp: 9000 },
    openhat: { decay: 0.22, hp: 8500 },
    tom: { start: 205, end: 135, decay: 0.3 },
    tomHi: { start: 240, end: 150, decay: 0.28 },
    tomMid: { start: 205, end: 135, decay: 0.3 },
    tomLo: { start: 170, end: 110, decay: 0.35 },
    perc: { decay: 0.12, bp: 5200, noiseVol: 0.75 },
    cowbell: { f1: 520, f2: 760, decay: 0.18, vol: 0.8 },
    rim: { freq: 1600, decay: 0.06, vol: 0.6 },
    conga: { start: 320, end: 150, decay: 0.34 },
  },
  lofi: {
    kick: { start: 60, end: 38, sweep: 0.16, decay: 0.4, vol: 0.9 },
    snare: { tone: 170, toneEnd: 130, noiseDecay: 0.18, toneDecay: 0.12, noiseVol: 0.9, toneVol: 0.5 },
    hihat: { decay: 0.08, hp: 6500 },
    openhat: { decay: 0.28, hp: 7000 },
    tom: { start: 190, end: 110, decay: 0.38 },
    tomHi: { start: 220, end: 130, decay: 0.32 },
    tomMid: { start: 190, end: 110, decay: 0.38 },
    tomLo: { start: 160, end: 90, decay: 0.42 },
    perc: { decay: 0.16, bp: 4800, noiseVol: 0.8 },
    cowbell: { f1: 500, f2: 720, decay: 0.2, vol: 0.75 },
    rim: { freq: 1500, decay: 0.07, vol: 0.55 },
    conga: { start: 300, end: 130, decay: 0.4 },
  },
};

// Default to 808 kit
const DEFAULT_KIT = '808';

const PRESETS: Record<string, Record<string, boolean[]>> = {
  'Hip-Hop': {
    kick: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0].map(Boolean),
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean),
  },
  'Trap': {
    kick: [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0].map(Boolean),
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hihat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1].map(Boolean),
    openhat: [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1].map(Boolean),
  },
  'House': {
    kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0].map(Boolean),
    clap: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hihat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0].map(Boolean),
  },
  'Techno': {
    kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0].map(Boolean),
    hihat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1].map(Boolean),
    openhat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0].map(Boolean),
  },
  'D&B': {
    kick: [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0].map(Boolean),
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0].map(Boolean),
    hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean),
  },
  'Boom Bap': {
    kick: [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0].map(Boolean),
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean),
  },
};

const createEmptyStep = (): DrumStep => ({ 
  active: false, 
  velocity: 100, 
  probability: 100,
  flam: false,
  roll: 0,
  pitch: 0,
});

const createPattern = (len: number) => Array(len).fill(null).map(() => createEmptyStep());

const initTracks = (len: number, kitId: string = DEFAULT_KIT): DrumTrack[] => {
  const kit = DRUM_KITS[kitId] || DRUM_KITS[DEFAULT_KIT];
  return kit.tracks.map(t => ({
    ...t, 
    pattern: createPattern(len), 
    volume: 80, 
    pan: 0, 
    muted: false, 
    solo: false,
    pitch: 0,
    decay: 100,
    filterFreq: 20000,
    filterRes: 0,
  }));
};

interface Props {
  onPatternChange?: (tracks: DrumTrack[], bpm: number) => void;
}

export default function ProBeatMaker({ onPatternChange }: Props) {
  const { toast } = useToast();
  const { tempo } = useTransport();
  const { addTrack } = useTrackStore();
  const { requestDestination } = useSessionDestination();
  const [, setLocation] = useLocation();
  
  // MIDI keyboard support for drum triggering
  const { lastNote, activeNotes, isConnected: midiConnected, setDrumMode } = useMIDI();
  
  // Enable drum mode when beat maker is active (suppresses instrument sounds from MIDI)
  useEffect(() => {
    setDrumMode(true);
    return () => setDrumMode(false);
  }, [setDrumMode]);
  
  // Restore saved state from localStorage
  const savedState = typeof window !== 'undefined' ? (() => {
    try {
      const saved = localStorage.getItem(BEAT_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
  })() : null;

  // Core state - restore from localStorage if available
  const [tracks, setTracks] = useState<DrumTrack[]>(() => {
    if (savedState?.tracks && Array.isArray(savedState.tracks)) {
      return savedState.tracks;
    }
    // Default: Initialize with Hip-Hop preset so it sounds good on first load
    const initial = initTracks(16);
    const preset = PRESETS['Hip-Hop'];
    return initial.map(t => ({
      ...t,
      pattern: t.pattern.map((step, i) => ({
        ...step,
        active: preset[t.id] ? preset[t.id][i % preset[t.id].length] : false,
      })),
    }));
  });
  const [bpm, setBpm] = useState(savedState?.bpm ?? 90);
  const [patternLength, setPatternLength] = useState(savedState?.patternLength ?? 16);
  const [swing, setSwing] = useState(0);
  const [groove, setGroove] = useState(0);
  const [humanize, setHumanize] = useState(0); // Timing/velocity variation
  const [masterVol, setMasterVol] = useState(80);
  const [useRealisticDrums, setUseRealisticDrums] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStep, setSelectedStep] = useState<{t: number, s: number} | null>(null);
  const [history, setHistory] = useState<DrumTrack[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  
  // New features state
  const [selectedKit, setSelectedKit] = useState(DEFAULT_KIT);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [metronomeVol, setMetronomeVol] = useState(30); // 0-100
  const [copiedTrack, setCopiedTrack] = useState<DrumStep[] | null>(null);
  
  // ISSUE #1: Pattern chaining/song mode
  const [patterns, setPatterns] = useState<{ id: string; name: string; tracks: DrumTrack[] }[]>([]);
  const [currentPatternIndex, setCurrentPatternIndex] = useState(0);
  const [songMode, setSongMode] = useState(false);
  const [songChain, setSongChain] = useState<number[]>([0]); // Pattern indices to play in sequence
  const [chainPosition, setChainPosition] = useState(0);
  
  // ISSUE #2: Pattern save/load
  const [savedPatterns, setSavedPatterns] = useState<{ id: string; name: string; tracks: DrumTrack[]; bpm: number; kit: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('probeat-saved-patterns');
      if (saved) {
        try { return JSON.parse(saved); } catch { return []; }
      }
    }
    return [];
  });
  
  // ISSUE #5: Step copy/paste
  const [copiedStep, setCopiedStep] = useState<DrumStep | null>(null);
  
  // ISSUE #6: Pattern variations (A/B)
  const [patternVariation, setPatternVariation] = useState<'A' | 'B'>('A');
  const [variationB, setVariationB] = useState<DrumTrack[] | null>(null);
  
  // Tap tempo state
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapCount, setTapCount] = useState(0); // For UI feedback
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // MIDI Learn state - customizable drum pad mapping
  const [midiDrumMapping, setMidiDrumMapping] = useState<Record<number, string>>(() => {
    // Convert default mapping to track IDs as fallback
    const defaultMapping: Record<number, string> = {};
    Object.entries(DEFAULT_MIDI_NOTE_TO_DRUM).forEach(([noteStr, drumType]) => {
      defaultMapping[Number(noteStr)] = drumType;
    });
    
    // Load from localStorage (guarded for SSR/test environments)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('midiDrumMapping');
      if (saved) {
        try { return JSON.parse(saved); } catch { return defaultMapping; }
      }
    }
    return defaultMapping;
  });
  const [midiLearnMode, setMidiLearnMode] = useState(false);
  const [midiLearnTarget, setMidiLearnTarget] = useState<string | null>(null); // track id to learn
  const [showMidiMappingPanel, setShowMidiMappingPanel] = useState(false);
  
  // AI Generation state
  const [aiProvider, setAiProvider] = useState('grok');
  const [selectedGenre, setSelectedGenre] = useState('Hip-Hop');
  const [aiMelodySummary, setAiMelodySummary] = useState<string | null>(null);
  const [aiBassSummary, setAiBassSummary] = useState<string | null>(null);
  const [lastDrumsGenMethod, setLastDrumsGenMethod] = useState<'ai' | 'algorithmic' | null>(null);
  const [lastMelodyGenMethod, setLastMelodyGenMethod] = useState<'ai' | 'algorithmic' | null>(null);
  const [lastBassGenMethod, setLastBassGenMethod] = useState<'ai' | 'algorithmic' | null>(null);
  
  // AI Beat generation mutation
  const generateBeatMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        genre: selectedGenre.toLowerCase(),
        bpm,
        duration: Math.max(1, Math.round((patternLength * 60) / bpm / 4)),
        aiProvider,
      };
      
      const response = await apiRequest('POST', '/api/beats/generate', payload);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to generate beat');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const beatPattern = data?.beat?.pattern;
      if (beatPattern) {
        saveHistory();
        setTracks(prev => prev.map(track => {
          const presetPattern = beatPattern[track.id];
          return {
            ...track,
            pattern: track.pattern.map((step, i) => ({
              ...step,
              active: presetPattern ? presetPattern[i % presetPattern.length] : false,
            })),
          };
        }));
        
        toast({ 
          title: '🎵 AI Beat Generated!', 
          description: `${selectedGenre} beat at ${bpm} BPM` 
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate AI beat',
        variant: 'destructive',
      });
    },
  });

  // Phase 3: AI Drum Grid (MIDI pattern engine) using /api/ai/music/drums
  const generatePhase3DrumsMutation = useMutation({
    mutationFn: async () => {
      const bars = Math.max(1, Math.round(patternLength / 16) || 1);
      const payload = {
        songPlanId: undefined,
        sectionId: 'pro-beat-section',
        bpm,
        bars,
        style: selectedGenre.toLowerCase(),
        gridResolution: '1/16' as const,
      };

      const response = await apiRequest('POST', '/api/ai/music/drums', payload);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any).error || 'Failed to generate AI drum grid');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      const grid = data?.data?.grid || data?.grid;
      const genMethod = data?.data?.generationMethod || (data?.data?.provider?.includes('Fallback') ? 'algorithmic' : 'ai');
      setLastDrumsGenMethod(genMethod);
      
      if (!grid) {
        toast({
          title: 'AI Drum Grid',
          description: 'Response received, but no grid was returned.',
        });
        return;
      }

      saveHistory();
      setTracks(prev => prev.map(track => {
        const row = (grid as any)[track.id] as Array<number | boolean> | undefined;
        if (!Array.isArray(row) || row.length === 0) {
          return track;
        }
        const normalized = row.map(v => Boolean(v));
        return {
          ...track,
          pattern: track.pattern.map((step, i) => ({
            ...step,
            active: normalized[i % normalized.length],
          })),
        };
      }));

      const sourceLabel = genMethod === 'ai' ? 'AI-Generated' : 'Algorithmic';
      toast({
        title: '🥁 Drum Grid Ready',
        description: `${selectedGenre} groove at ${bpm} BPM (${sourceLabel})`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Phase 3 Drum Grid Failed',
        description: error.message || 'Failed to generate AI drum grid',
        variant: 'destructive',
      });
    },
  });

  // Phase 3: AI Melody (MIDI pattern engine) using /api/ai/music/melody
  const generatePhase3MelodyMutation = useMutation({
    mutationFn: async () => {
      const bars = Math.max(1, Math.round(patternLength / 16) || 1);
      const payload = {
        songPlanId: undefined,
        sectionId: 'pro-beat-melody-section',
        key: 'C minor',
        bpm,
        lengthBars: bars,
      };

      const response = await apiRequest('POST', '/api/ai/music/melody', payload);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any).error || 'Failed to generate AI melody');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      const track = data?.data || data?.track;
      const notes = track?.notes;
      const genMethod = data?.data?.generationMethod || (data?.data?.provider?.includes('Fallback') ? 'algorithmic' : 'ai');
      setLastMelodyGenMethod(genMethod);

      if (Array.isArray(notes) && notes.length > 0) {
        void (async () => {
          const destination = await requestDestination({ suggestedName: 'ProBeat Session' });
          if (!destination) {
            return;
          }

        const pitches = notes
          .map((n: any) => (typeof n?.pitch === 'string' ? n.pitch : null))
          .filter((p: string | null) => !!p) as string[];
        const uniquePitches = Array.from(new Set(pitches));

        setAiMelodySummary(
          `${notes.length} notes • ${uniquePitches.slice(0, 8).join(', ')}${
            uniquePitches.length > 8 ? '…' : ''
          }`,
        );

        const sourceLabel = genMethod === 'ai' ? 'AI-Generated' : 'Algorithmic';
        toast({
          title: 'AI Melody Ready',
          description: `Generated ${notes.length} melody notes (${sourceLabel})`,
        });

        const bars = Math.max(1, Math.round(patternLength / 16) || 1);
        const melodyTrackId = `melody-${Date.now()}`;
        const notesForTrack = (notes as AiNote[]).map((n, index) => {
          const { note, octave } = parsePitch((n as any)?.pitch);
          const step = Math.max(0, Math.round(((n as any)?.time ?? 0) * 4));
          const length = Math.max(1, Math.round((((n as any)?.duration ?? 0.5) as number) * 4));
          const velocity = normalizeVelocity((n as any)?.velocity);
          return {
            id: `melody-note-${index}-${Date.now()}`,
            note,
            octave,
            step,
            length,
            velocity,
          };
        });

        addTrack({
          id: melodyTrackId,
          kind: 'piano',
          name: 'ProBeat AI Melody',
          lengthBars: bars,
          startBar: 0,
          payload: {
            type: 'midi',
            instrument: 'Lead Synth',
            notes: notesForTrack,
            source: 'probeat-ai-melody',
            bpm,
            volume: 80,
            pan: 0,
          },
        });

        window.dispatchEvent(
          new CustomEvent('studio:focusTrack', {
            detail: { trackId: melodyTrackId, view: 'piano-roll' },
          }),
        );
        })();
      } else {
        toast({
          title: 'AI Melody',
          description: 'Response received, but no melody notes were returned.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Melody Failed',
        description: error.message || 'Failed to generate AI melody',
        variant: 'destructive',
      });
    },
  });

  // Phase 3: AI Bassline (MIDI pattern engine) using /api/ai/music/bass
  const generatePhase3BassMutation = useMutation({
    mutationFn: async () => {
      const bars = Math.max(1, Math.round(patternLength / 16) || 1);
      const payload = {
        songPlanId: undefined,
        sectionId: 'pro-beat-bass-section',
        key: 'C minor',
        bpm,
        bars,
      };

      const response = await apiRequest('POST', '/api/ai/music/bass', payload);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any).error || 'Failed to generate AI bassline');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      const track = data?.data || data?.track;
      const notes = track?.notes;
      const genMethod = data?.data?.generationMethod || (data?.data?.provider?.includes('Fallback') ? 'algorithmic' : 'ai');
      setLastBassGenMethod(genMethod);

      if (Array.isArray(notes) && notes.length > 0) {
        void (async () => {
          const destination = await requestDestination({ suggestedName: 'ProBeat Session' });
          if (!destination) {
            return;
          }

          const pitches = notes
            .map((n: any) => (typeof n?.pitch === 'string' ? n.pitch : null))
            .filter((p: string | null) => !!p) as string[];
          const uniquePitches = Array.from(new Set(pitches));
        setAiBassSummary(
          `${notes.length} notes • ${uniquePitches.slice(0, 6).join(', ')}${
            uniquePitches.length > 6 ? '…' : ''
          }`,
        );

        const sourceLabel = genMethod === 'ai' ? 'AI-Generated' : 'Algorithmic';
        toast({
          title: 'AI Bassline Ready',
          description: `Generated ${notes.length} bass notes (${sourceLabel})`,
        });

        const bars = Math.max(1, Math.round(patternLength / 16) || 1);
        const bassTrackId = `bass-${Date.now()}`;
        const notesForTrack = (notes as AiNote[]).map((n, index) => {
          const { note, octave } = parsePitch((n as any)?.pitch);
          const step = Math.max(0, Math.round(((n as any)?.time ?? 0) * 4));
          const length = Math.max(1, Math.round((((n as any)?.duration ?? 0.5) as number) * 4));
          const velocity = normalizeVelocity((n as any)?.velocity);
          return {
            id: `bass-note-${index}-${Date.now()}`,
            note,
            octave,
            step,
            length,
            velocity,
          };
        });

        addTrack({
          id: bassTrackId,
          kind: 'piano',
          name: 'ProBeat AI Bass',
          lengthBars: bars,
          startBar: 0,
          payload: {
            type: 'midi',
            instrument: 'Bass Synth',
            notes: notesForTrack,
            source: 'probeat-ai-bass',
            bpm,
            volume: 80,
            pan: 0,
          },
        });

        window.dispatchEvent(
          new CustomEvent('studio:focusTrack', {
            detail: { trackId: bassTrackId, view: 'piano-roll' },
          }),
        );
        })();
      } else {
        toast({
          title: 'AI Bassline',
          description: 'Response received, but no bass notes were returned.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Bassline Failed',
        description: error.message || 'Failed to generate AI bassline',
        variant: 'destructive',
      });
    },
  });

  const audioCtx = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    audioCtx.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return () => { audioCtx.current?.close(); };
  }, []);

  useEffect(() => { if (tempo) setBpm(Math.round(tempo)); }, [tempo]);

  // Persist beat pattern to localStorage so it survives navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BEAT_STORAGE_KEY, JSON.stringify({ tracks, bpm, patternLength }));
      } catch { /* ignore storage errors */ }
    }
  }, [tracks, bpm, patternLength]);

  const saveHistory = useCallback(() => {
    const copy = JSON.parse(JSON.stringify(tracks));
    setHistory(h => [...h.slice(0, historyIdx + 1), copy].slice(-30));
    setHistoryIdx(i => i + 1);
  }, [tracks, historyIdx]);

  const undo = () => {
    if (historyIdx > 0) {
      setTracks(JSON.parse(JSON.stringify(history[historyIdx - 1])));
      setHistoryIdx(i => i - 1);
    }
  };

  const redo = () => {
    if (historyIdx < history.length - 1) {
      setTracks(JSON.parse(JSON.stringify(history[historyIdx + 1])));
      setHistoryIdx(i => i + 1);
    }
  };

  // ISSUE #2: Save pattern to localStorage
  const savePattern = (name?: string) => {
    const patternName = name || `Pattern ${savedPatterns.length + 1}`;
    const newPattern = {
      id: `pattern-${Date.now()}`,
      name: patternName,
      tracks: JSON.parse(JSON.stringify(tracks)),
      bpm,
      kit: selectedKit,
    };
    const updated = [...savedPatterns, newPattern];
    setSavedPatterns(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('probeat-saved-patterns', JSON.stringify(updated));
    }
    toast({ title: '💾 Pattern Saved', description: patternName });
  };

  const loadPattern = (patternId: string) => {
    const pattern = savedPatterns.find(p => p.id === patternId);
    if (!pattern) return;
    saveHistory();
    setTracks(JSON.parse(JSON.stringify(pattern.tracks)));
    setBpm(pattern.bpm);
    setSelectedKit(pattern.kit);
    toast({ title: '📂 Pattern Loaded', description: pattern.name });
  };

  const deletePattern = (patternId: string) => {
    const updated = savedPatterns.filter(p => p.id !== patternId);
    setSavedPatterns(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('probeat-saved-patterns', JSON.stringify(updated));
    }
    toast({ title: 'Pattern Deleted' });
  };

  // ISSUE #5: Copy/paste individual step
  const copyStep = (trackIndex: number, stepIndex: number) => {
    setCopiedStep({ ...tracks[trackIndex].pattern[stepIndex] });
    toast({ title: '📋 Step Copied' });
  };

  const pasteStep = (trackIndex: number, stepIndex: number) => {
    if (!copiedStep) {
      toast({ title: 'Nothing to paste', variant: 'destructive' });
      return;
    }
    saveHistory();
    setTracks(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[trackIndex].pattern[stepIndex] = { ...copiedStep };
      return copy;
    });
    toast({ title: '📋 Step Pasted' });
  };

  // ISSUE #6: Switch between pattern variations A/B
  const switchVariation = (variation: 'A' | 'B') => {
    if (variation === patternVariation) return;
    
    if (variation === 'B') {
      // Save current as A, switch to B
      if (!variationB) {
        // Create empty B variation
        setVariationB(JSON.parse(JSON.stringify(tracks)));
      }
      // Store current A
      const currentA = JSON.parse(JSON.stringify(tracks));
      // Load B
      if (variationB) {
        setTracks(JSON.parse(JSON.stringify(variationB)));
      }
      setVariationB(currentA);
    } else {
      // Save current as B, switch to A
      const currentB = JSON.parse(JSON.stringify(tracks));
      if (variationB) {
        setTracks(JSON.parse(JSON.stringify(variationB)));
      }
      setVariationB(currentB);
    }
    setPatternVariation(variation);
    toast({ title: `Pattern ${variation}` });
  };

  // ISSUE #9: Add accent pattern (emphasize beats 2 & 4)
  const applyAccentPattern = () => {
    saveHistory();
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: t.pattern.map((step, i) => ({
        ...step,
        velocity: step.active && (i % 4 === 2 || i % 4 === 3) 
          ? Math.min(127, step.velocity + 20) 
          : step.velocity,
      })),
    })));
    toast({ title: '🎯 Accents Applied', description: 'Beats 2 & 4 emphasized' });
  };

  // ISSUE #10: Generate drum fill
  const generateFill = (trackIndex?: number) => {
    saveHistory();
    const fillLength = 4; // Last 4 steps
    const startStep = patternLength - fillLength;
    
    setTracks(prev => prev.map((t, ti) => {
      if (trackIndex !== undefined && ti !== trackIndex) return t;
      
      // Only apply fill to percussion tracks
      const isPerc = ['hihat', 'snare', 'tom', 'tom1', 'tom2', 'tom3'].includes(t.id.toLowerCase());
      if (!isPerc && trackIndex === undefined) return t;
      
      return {
        ...t,
        pattern: t.pattern.map((step, si) => {
          if (si < startStep) return step;
          // Increasing density toward the end
          const fillDensity = 0.3 + ((si - startStep) / fillLength) * 0.5;
          return {
            ...step,
            active: Math.random() < fillDensity,
            velocity: 80 + Math.floor(Math.random() * 47),
          };
        }),
      };
    }));
    toast({ title: '🥁 Fill Generated', description: `Last ${fillLength} steps` });
  };

  // ISSUE #3: Export beat as audio
  const exportBeatAsAudio = async () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    toast({ title: 'Rendering...', description: 'Exporting beat to audio' });
    
    try {
      const stepDuration = 60 / bpm / 4; // 16th note duration in seconds
      const totalDuration = patternLength * stepDuration;
      const sampleRate = 44100;
      const offline = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);
      
      // Schedule all drum hits
      const hasSolo = tracks.some(t => t.solo);
      
      tracks.forEach(track => {
        if (track.muted) return;
        if (hasSolo && !track.solo) return;
        
        track.pattern.forEach((step, stepIndex) => {
          if (!step.active) return;
          
          const startTime = stepIndex * stepDuration;
          const velocity = step.velocity / 127;
          const volume = track.volume / 100;
          const finalGain = velocity * volume * (masterVol / 100);
          
          // Create simple drum sound for export
          const drumType = DRUM_ID_TO_TYPE[track.id.toLowerCase()] || 'snare';
          
          if (drumType === 'kick') {
            const osc = offline.createOscillator();
            const gain = offline.createGain();
            osc.frequency.setValueAtTime(60, startTime);
            osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.1);
            gain.gain.setValueAtTime(finalGain, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
            osc.connect(gain);
            gain.connect(offline.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.3);
          } else if (drumType === 'snare' || drumType === 'clap') {
            const buf = offline.createBuffer(1, sampleRate * 0.15, sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2) * 0.5;
            }
            const source = offline.createBufferSource();
            source.buffer = buf;
            const gain = offline.createGain();
            gain.gain.value = finalGain;
            source.connect(gain);
            gain.connect(offline.destination);
            source.start(startTime);
          } else if (drumType === 'hihat' || drumType === 'openhat') {
            const decay = drumType === 'openhat' ? 0.2 : 0.05;
            const buf = offline.createBuffer(1, sampleRate * decay, sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2) * 0.3;
            }
            const source = offline.createBufferSource();
            source.buffer = buf;
            const filter = offline.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 8000;
            const gain = offline.createGain();
            gain.gain.value = finalGain;
            source.connect(filter);
            filter.connect(gain);
            gain.connect(offline.destination);
            source.start(startTime);
          } else {
            // Generic percussion
            const buf = offline.createBuffer(1, sampleRate * 0.1, sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5) * 0.4;
            }
            const source = offline.createBufferSource();
            source.buffer = buf;
            const gain = offline.createGain();
            gain.gain.value = finalGain;
            source.connect(gain);
            gain.connect(offline.destination);
            source.start(startTime);
          }
        });
      });
      
      const renderedBuffer = await offline.startRendering();
      
      // Convert to WAV
      const wavBlob = audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = `beat-${bpm}bpm-${selectedGenre.toLowerCase()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: '✅ Beat Exported', description: 'WAV file downloaded' });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Export Failed', variant: 'destructive' });
    }
  };

  // Helper: Convert AudioBuffer to WAV
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const samples = buffer.length;
    const dataSize = samples * blockAlign;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
    
    let offset = 44;
    for (let i = 0; i < samples; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // ISSUE #4: Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      
      // Space: Play/Stop
      if (key === ' ') {
        e.preventDefault();
        setIsPlaying(p => {
          if (p) setCurrentStep(0);
          return !p;
        });
        return;
      }
      
      // Arrow keys: Navigate steps
      if (key === 'arrowright' && selectedStep) {
        e.preventDefault();
        setSelectedStep(s => s ? { ...s, s: Math.min(patternLength - 1, s.s + 1) } : null);
        return;
      }
      if (key === 'arrowleft' && selectedStep) {
        e.preventDefault();
        setSelectedStep(s => s ? { ...s, s: Math.max(0, s.s - 1) } : null);
        return;
      }
      if (key === 'arrowup' && selectedStep) {
        e.preventDefault();
        setSelectedStep(s => s ? { ...s, t: Math.max(0, s.t - 1) } : null);
        return;
      }
      if (key === 'arrowdown' && selectedStep) {
        e.preventDefault();
        setSelectedStep(s => s ? { ...s, t: Math.min(tracks.length - 1, s.t + 1) } : null);
        return;
      }
      
      // Enter: Toggle selected step
      if (key === 'enter' && selectedStep) {
        e.preventDefault();
        toggleStep(selectedStep.t, selectedStep.s);
        return;
      }
      
      // C: Copy step
      if (key === 'c' && selectedStep && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        copyStep(selectedStep.t, selectedStep.s);
        return;
      }
      
      // V: Paste step
      if (key === 'v' && selectedStep && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        pasteStep(selectedStep.t, selectedStep.s);
        return;
      }
      
      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      
      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      
      // R: Randomize
      if (key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        randomize();
        return;
      }
      
      // A/B: Switch variation
      if (key === 'a' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        switchVariation('A');
        return;
      }
      if (key === 'b' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        switchVariation('B');
        return;
      }
      
      // F: Generate fill
      if (key === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        generateFill();
        return;
      }
      
      // M: Toggle metronome
      if (key === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setMetronomeOn(m => !m);
        return;
      }
      
      // Ctrl+S: Save pattern
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        savePattern();
        return;
      }
      
      // Escape: Deselect
      if (key === 'escape') {
        setSelectedStep(null);
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStep, patternLength, tracks.length, copiedStep]);

  const playSound = useCallback(async (id: string, vel: number, vol: number) => {
    const normalizedId = id.toLowerCase();
    const drumType = DRUM_ID_TO_TYPE[normalizedId] || 'snare';
    const kitKey = (KIT_SOUND_ALIASES[selectedKit] || selectedKit || 'default').toLowerCase();
    const kitProfile = CLASSIC_KIT_PROFILES[kitKey] || CLASSIC_KIT_PROFILES.default;
    const tomProfile = {
      hi: kitProfile.tomHi || { ...kitProfile.tom, start: kitProfile.tom.start * 1.15, end: kitProfile.tom.end * 1.15 },
      mid: kitProfile.tomMid || kitProfile.tom,
      lo: kitProfile.tomLo || { ...kitProfile.tom, start: kitProfile.tom.start * 0.85, end: kitProfile.tom.end * 0.85 },
    };
    const cowbellProfile = kitProfile.cowbell || { f1: 560, f2: 830, decay: 0.18, vol: 0.9 };
    const percProfile = kitProfile.perc || { decay: 0.12, bp: 7000, noiseVol: 0.8 };
    const rimProfile = kitProfile.rim || { freq: 1800, decay: 0.05, vol: 0.6 };
    const congaProfile = kitProfile.conga || { start: 340, end: 170, decay: 0.34 };

    // When using the realistic engine, delegate to realisticAudio
    if (useRealisticDrums) {
      const baseVelocity = (vel / 127) * (vol / 100) * (masterVol / 100);
      const normalizedVelocity = Math.max(0, Math.min(1, baseVelocity));

      await realisticAudio.playDrumSound(drumType, normalizedVelocity, kitKey);
      return;
    }

    // Classic internal synth path
    if (!audioCtx.current) return;
    const ctx = audioCtx.current;
    if (ctx.state === 'suspended') await ctx.resume();
    const gain = ctx.createGain();
    gain.gain.value = (vel / 127) * (vol / 100) * (masterVol / 100);
    gain.connect(ctx.destination);

    switch (drumType) {
      case 'kick': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(kitProfile.kick.start, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(kitProfile.kick.end, ctx.currentTime + kitProfile.kick.sweep);
        const g = ctx.createGain();
        g.gain.setValueAtTime(kitProfile.kick.vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + kitProfile.kick.decay);
        o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + kitProfile.kick.decay);
        break;
      }
      case 'snare':
      case 'clap': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * kitProfile.snare.noiseDecay, ctx.sampleRate);
        const d = buf.getChannelData(0);
        const noiseLevel = 0.5 * kitProfile.snare.noiseVol;
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * noiseLevel;
        const s = ctx.createBufferSource(); s.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(kitProfile.snare.noiseVol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + kitProfile.snare.noiseDecay);

        // Add a short snare tone for character
        const tone = ctx.createOscillator();
        const toneGain = ctx.createGain();
        tone.type = 'triangle';
        tone.frequency.setValueAtTime(kitProfile.snare.tone, ctx.currentTime);
        tone.frequency.exponentialRampToValueAtTime(kitProfile.snare.toneEnd, ctx.currentTime + kitProfile.snare.toneDecay);
        toneGain.gain.setValueAtTime(kitProfile.snare.toneVol, ctx.currentTime);
        toneGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + kitProfile.snare.toneDecay);

        s.connect(g); g.connect(gain);
        tone.connect(toneGain); toneGain.connect(gain);

        s.start(); s.stop(ctx.currentTime + kitProfile.snare.noiseDecay);
        tone.start(); tone.stop(ctx.currentTime + kitProfile.snare.toneDecay);
        break;
      }
      case 'hihat': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * kitProfile.hihat.decay, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kitProfile.hihat.hp;
        s.connect(f); f.connect(gain); s.start(); s.stop(ctx.currentTime + kitProfile.hihat.decay);
        break;
      }
      case 'openhat': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * kitProfile.openhat.decay, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.2);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kitProfile.openhat.hp;
        s.connect(f); f.connect(gain); s.start(); s.stop(ctx.currentTime + kitProfile.openhat.decay);
        break;
      }
      case 'tom': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(kitProfile.tom.start, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(kitProfile.tom.end, ctx.currentTime + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.9, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + kitProfile.tom.decay);
        o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + kitProfile.tom.decay);
        break;
      }
      case 'tom_hi':
      case 'tom_mid':
      case 'tom_lo': {
        const profile =
          drumType === 'tom_hi' ? tomProfile.hi :
          drumType === 'tom_lo' ? tomProfile.lo :
          tomProfile.mid;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(profile.start, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(profile.end, ctx.currentTime + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.9, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + profile.decay);
        o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + profile.decay);
        break;
      }
      case 'conga': {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(congaProfile.start, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(congaProfile.end, ctx.currentTime + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.8, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + congaProfile.decay);
        o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + congaProfile.decay);
        break;
      }
      case 'cowbell': {
        // 808-style cowbell: two squares with short decay
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = 'square';
        o2.type = 'square';
        o1.frequency.setValueAtTime(cowbellProfile.f1, ctx.currentTime);
        o2.frequency.setValueAtTime(cowbellProfile.f2, ctx.currentTime);
        const g = ctx.createGain();
        g.gain.setValueAtTime(cowbellProfile.vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + cowbellProfile.decay);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 600;
        o1.connect(g); o2.connect(g); g.connect(hp); hp.connect(gain);
        o1.start(); o2.start();
        o1.stop(ctx.currentTime + cowbellProfile.decay);
        o2.stop(ctx.currentTime + cowbellProfile.decay);
        break;
      }
      case 'perc': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * percProfile.decay, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (percProfile.noiseVol ?? 0.8) * Math.pow(1 - i / d.length, 1.3);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = percProfile.bp;
        s.connect(bp); bp.connect(gain); s.start(); s.stop(ctx.currentTime + percProfile.decay);
        break;
      }
      case 'rim': {
        const o = ctx.createOscillator();
        o.type = 'square';
        const g = ctx.createGain();
        o.frequency.setValueAtTime(rimProfile.freq, ctx.currentTime);
        g.gain.setValueAtTime(rimProfile.vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + rimProfile.decay);
        o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + rimProfile.decay);
        break;
      }
      case 'crash': {
        // Metallic crash/ride-ish hit
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = 'square';
        o2.type = 'square';
        o1.frequency.setValueAtTime(560, ctx.currentTime);
        o2.frequency.setValueAtTime(840, ctx.currentTime);
        const g = ctx.createGain();
        g.gain.setValueAtTime(1, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        o1.connect(g); o2.connect(g); g.connect(gain);
        o1.start(); o2.start();
        o1.stop(ctx.currentTime + 0.2);
        o2.stop(ctx.currentTime + 0.2);
        break;
      }
      default: {
        // Fallback short noise so no pad is silent
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
        const s = ctx.createBufferSource(); s.buffer = buf;
        s.connect(gain); s.start(); s.stop(ctx.currentTime + 0.08);
      }
    }
  }, [masterVol, useRealisticDrums, selectedKit]);

  // MIDI Learn - capture incoming MIDI note when in learn mode
  useEffect(() => {
    if (!lastNote || !midiLearnMode || !midiLearnTarget) return;
    
    // Map the incoming MIDI note to the target drum
    setMidiDrumMapping(prev => {
      const updated = { ...prev, [lastNote.note]: midiLearnTarget };
      if (typeof window !== 'undefined') {
        localStorage.setItem('midiDrumMapping', JSON.stringify(updated));
      }
      return updated;
    });
    
    toast({
      title: 'MIDI Mapped!',
      description: `${MIDI_NOTE_NAMES[lastNote.note]} (note ${lastNote.note}) → ${midiLearnTarget}`,
    });
    
    // Exit learn mode after mapping
    setMidiLearnTarget(null);
    setMidiLearnMode(false);
  }, [lastNote, midiLearnMode, midiLearnTarget, toast]);

  // MIDI keyboard drum triggering - play drums from MIDI controller using custom mapping
  useEffect(() => {
    if (!lastNote) return;
    if (midiLearnMode) return; // Don't play sounds when learning
    
    const drumId = midiDrumMapping[lastNote.note];
    if (drumId) {
      // Get drum type from mapping (drumId could be track id or drum type)
      const drumType = DRUM_ID_TO_TYPE[drumId.toLowerCase()] || drumId as DrumEngineType;
      // Find the track with this drum type and use its volume
      const matchingTrack = tracks.find(t => DRUM_ID_TO_TYPE[t.id.toLowerCase()] === drumType || t.id.toLowerCase() === drumId.toLowerCase());
      const trackVolume = matchingTrack?.volume ?? 80;
      playSound(drumType, lastNote.velocity, trackVolume);
    }
  }, [lastNote, playSound, tracks, midiDrumMapping, midiLearnMode]);

  useEffect(() => {
    if (!isPlaying) return;
    const baseMs = (60 / bpm / 4) * 1000;
    const ms = currentStep % 2 === 1 && swing > 0 ? baseMs + baseMs * swing / 100 * 0.33 : baseMs;
    
    intervalRef.current = setTimeout(() => {
      const hasSolo = tracks.some(t => t.solo);
      tracks.forEach(track => {
        const step = track.pattern[currentStep];
        // FIXED: Check mute/solo logic correctly
        const shouldPlay = step?.active && 
                          !track.muted && 
                          (!hasSolo || track.solo);
        
        if (shouldPlay) {
          if (Math.random() * 100 <= step.probability) {
            const backbeat = currentStep % 4 === 2 || currentStep % 4 === 3;
            const boost = groove > 0 ? 1 + (groove / 200) * (backbeat ? 1 : -0.3) : 1;
            const vel = Math.min(127, step.velocity * boost);
            
            // Play the main hit
            playSound(track.id, vel, track.volume);
            
            // Flam: play a quieter ghost note ~30ms before (simulated as after for simplicity)
            if (step.flam) {
              setTimeout(() => playSound(track.id, vel * 0.6, track.volume), 30);
            }
            
            // Roll: play rapid subdivisions within the step duration
            if (step.roll > 0) {
              const stepDuration = (60 / bpm / 4) * 1000; // ms per step
              const rollInterval = stepDuration / step.roll;
              for (let r = 1; r < step.roll; r++) {
                setTimeout(() => playSound(track.id, vel * (0.9 - r * 0.1), track.volume), rollInterval * r);
              }
            }
          }
        }
      });
      setCurrentStep(s => (s + 1) % patternLength);
    }, ms);
    
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [isPlaying, currentStep, tracks, bpm, swing, groove, patternLength, playSound]);

  const toggleStep = (ti: number, si: number) => {
    saveHistory();
    setTracks(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[ti].pattern[si].active = !copy[ti].pattern[si].active;
      if (copy[ti].pattern[si].active) playSound(copy[ti].id, 100, copy[ti].volume);
      return copy;
    });
    setSelectedStep({ t: ti, s: si });
  };

  const loadPreset = (name: string) => {
    saveHistory();
    const p = PRESETS[name];
    if (!p) return;
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: t.pattern.map((step, i) => ({
        ...step,
        active: p[t.id] ? p[t.id][i % p[t.id].length] : false,
      })),
    })));
    toast({ title: `🎵 ${name}`, description: 'Pattern loaded' });
  };

  const clearAll = () => { saveHistory(); setTracks(initTracks(patternLength, selectedKit)); };
  
  const randomize = () => {
    saveHistory();
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: t.pattern.map(() => ({
        ...createEmptyStep(),
        active: Math.random() < (t.id === 'kick' || t.id === 'snare' ? 0.2 : 0.3),
        velocity: 70 + Math.floor(Math.random() * 57),
        probability: 80 + Math.floor(Math.random() * 20),
      })),
    })));
    toast({ title: '🎲 Randomized!' });
  };

  const changeLength = (len: number) => {
    setPatternLength(len);
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: Array(len).fill(null).map((_, i) => t.pattern[i] || createEmptyStep()),
    })));
  };

  // Change drum kit
  const changeKit = (kitId: string) => {
    saveHistory();
    setSelectedKit(kitId);
    setTracks(initTracks(patternLength, kitId));
    toast({ title: `🥁 ${DRUM_KITS[kitId]?.name || kitId}`, description: 'Kit loaded' });
  };

  // Tap tempo
  const handleTapTempo = () => {
    const now = Date.now();
    
    // Clear timeout if exists
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    
    // Reset if more than 2 seconds since last tap
    const newTaps = tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000 
      ? [now] 
      : [...tapTimes, now].slice(-8); // Keep last 8 taps
    
    setTapTimes(newTaps);
    setTapCount(newTaps.length); // Update tap count for UI feedback
    
    // Calculate BPM from taps
    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avgInterval);
      if (newBpm >= 40 && newBpm <= 240) {
        setBpm(newBpm);
      }
    }
    
    // Clear taps after 2 seconds of inactivity
    tapTimeoutRef.current = setTimeout(() => {
      setTapTimes([]);
      setTapCount(0);
    }, 2000);
  };

  // Copy track pattern
  const copyTrackPattern = (trackIndex: number) => {
    setCopiedTrack([...tracks[trackIndex].pattern]);
    toast({ title: '📋 Pattern copied' });
  };

  // Paste track pattern
  const pasteTrackPattern = (trackIndex: number) => {
    if (!copiedTrack) {
      toast({ title: 'Nothing to paste', variant: 'destructive' });
      return;
    }
    saveHistory();
    setTracks(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[trackIndex].pattern = copiedTrack.map((step) => ({
        ...step,
      })).slice(0, patternLength);
      // Pad if source was shorter
      while (copy[trackIndex].pattern.length < patternLength) {
        copy[trackIndex].pattern.push(createEmptyStep());
      }
      return copy;
    });
    toast({ title: '📋 Pattern pasted' });
  };

  // Humanize - add random timing/velocity variation
  const applyHumanize = () => {
    if (humanize === 0) return;
    saveHistory();
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: t.pattern.map(step => ({
        ...step,
        velocity: step.active 
          ? Math.max(1, Math.min(127, step.velocity + Math.floor((Math.random() - 0.5) * humanize * 0.5)))
          : step.velocity,
      })),
    })));
    toast({ title: '🎭 Humanized!', description: `${humanize}% variation applied` });
  };

  // Play metronome click
  const playClick = useCallback(() => {
    if (!audioCtx.current || !metronomeOn) return;
    const ctx = audioCtx.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = currentStep % 4 === 0 ? 1000 : 800;
    // Use metronomeVol to control click volume (0-100 → 0-0.3)
    const vol = (metronomeVol / 100) * 0.3;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }, [metronomeOn, currentStep, metronomeVol]);

  // Play metronome on each step
  useEffect(() => {
    if (isPlaying && metronomeOn) {
      playClick();
    }
  }, [currentStep, isPlaying, metronomeOn, playClick]);

  return (
    <Card className="p-4 bg-gray-900 border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🥁 Pro Beat Maker
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{bpm} BPM</Badge>
          <Badge variant="outline">Step {currentStep + 1}/{patternLength}</Badge>
          {/* ISSUE #6: Pattern Variation A/B */}
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant={patternVariation === 'A' ? 'default' : 'outline'}
              onClick={() => switchVariation('A')}
              className={patternVariation === 'A' ? 'bg-blue-600' : ''}
            >
              A
            </Button>
            <Button 
              size="sm" 
              variant={patternVariation === 'B' ? 'default' : 'outline'}
              onClick={() => switchVariation('B')}
              className={patternVariation === 'B' ? 'bg-purple-600' : ''}
            >
              B
            </Button>
          </div>
        </div>
      </div>

      {/* Transport & Controls - Row 1 */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Button onClick={() => { setIsPlaying(!isPlaying); if (isPlaying) setCurrentStep(0); }}
          className={isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}>
          {isPlaying ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
          {isPlaying ? 'Stop' : 'Play'}
        </Button>
        
        {/* Metronome with volume */}
        <div className="flex items-center gap-1">
          <Button variant={metronomeOn ? 'default' : 'outline'} onClick={() => setMetronomeOn(!metronomeOn)}
            className={metronomeOn ? 'bg-yellow-600 hover:bg-yellow-500' : ''}
            title="Toggle metronome click">
            <Timer className="w-4 h-4 mr-1" />Click
          </Button>
          {metronomeOn && (
            <Slider 
              value={[metronomeVol]} 
              onValueChange={v => setMetronomeVol(v[0])} 
              max={100} 
              className="w-16" 
              title="Metronome volume"
            />
          )}
        </div>
        
        {/* Tap Tempo with count feedback */}
        <Button variant="outline" onClick={handleTapTempo} className="relative" title="Tap to set tempo">
          <Zap className="w-4 h-4 mr-1" />Tap
          {tapCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {tapCount}
            </span>
          )}
        </Button>
        
        {/* Drum Kit Selector */}
        <Select value={selectedKit} onValueChange={changeKit}>
          <SelectTrigger className="w-32">
            <Disc className="w-4 h-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DRUM_KITS).map(([id, kit]) => (
              <SelectItem key={id} value={id}>
                <div className="flex flex-col">
                  <span className="font-medium">{kit.name}</span>
                  <span className="text-xs text-gray-400">{kit.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* AI Generation Controls */}
        <div className="flex items-center gap-2 border-l border-gray-600 pl-2">
          <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Hip-Hop', 'Trap', 'House', 'Techno', 'D&B', 'Reggaeton', 'Boom Bap', 'Lo-Fi'].map(g => 
                <SelectItem key={g} value={g}>{g}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => generateBeatMutation.mutate()}
              disabled={generateBeatMutation.isPending}
              className="bg-purple-600 hover:bg-purple-500"
            >
              <Wand2 className="w-4 h-4 mr-1" />
              {generateBeatMutation.isPending ? 'Generating...' : 'AI Generate (Legacy)'}
            </Button>
            <Button
              onClick={() => generatePhase3DrumsMutation.mutate()}
              disabled={generatePhase3DrumsMutation.isPending}
              variant="outline"
              className="border-blue-500 text-blue-300 hover:bg-blue-500/10"
            >
              {generatePhase3DrumsMutation.isPending ? 'Phase 3 Drums…' : 'Phase 3 Drum Grid'}
            </Button>
            <Button
              onClick={() => generatePhase3MelodyMutation.mutate()}
              disabled={generatePhase3MelodyMutation.isPending}
              variant="outline"
              className="border-emerald-500 text-emerald-300 hover:bg-emerald-500/10"
            >
              {generatePhase3MelodyMutation.isPending ? 'AI Melody…' : 'AI Melody'}
            </Button>
            <Button
              onClick={() => generatePhase3BassMutation.mutate()}
              disabled={generatePhase3BassMutation.isPending}
              variant="outline"
              className="border-amber-500 text-amber-300 hover:bg-amber-500/10"
            >
              {generatePhase3BassMutation.isPending ? 'AI Bassline…' : 'AI Bassline'}
            </Button>
          </div>
          {(lastDrumsGenMethod || lastMelodyGenMethod || lastBassGenMethod) && (
            <div className="flex items-center gap-1 ml-2">
              {lastDrumsGenMethod && (
                <Badge variant={lastDrumsGenMethod === 'ai' ? 'default' : 'secondary'} className="text-xs">
                  Drums: {lastDrumsGenMethod === 'ai' ? 'AI' : 'Algo'}
                </Badge>
              )}
              {lastMelodyGenMethod && (
                <Badge variant={lastMelodyGenMethod === 'ai' ? 'default' : 'secondary'} className="text-xs">
                  Melody: {lastMelodyGenMethod === 'ai' ? 'AI' : 'Algo'}
                </Badge>
              )}
              {lastBassGenMethod && (
                <Badge variant={lastBassGenMethod === 'ai' ? 'default' : 'secondary'} className="text-xs">
                  Bass: {lastBassGenMethod === 'ai' ? 'AI' : 'Algo'}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Controls - Row 2 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline"><ChevronDown className="w-4 h-4 mr-1" />Presets</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-800 border-gray-700">
            <DropdownMenuLabel>Genre Presets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.keys(PRESETS).map(name => (
              <DropdownMenuItem key={name} onClick={() => loadPreset(name)}>{name}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={String(patternLength)} onValueChange={v => changeLength(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[8, 16, 32, 64].map(n => <SelectItem key={n} value={String(n)}>{n} steps</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={randomize}><Shuffle className="w-4 h-4 mr-1" />Random</Button>
        <Button variant="outline" onClick={clearAll}><RotateCcw className="w-4 h-4 mr-1" />Clear</Button>
        <Button variant="outline" onClick={undo} disabled={historyIdx <= 0}><Undo2 className="w-4 h-4" /></Button>
        <Button variant="outline" onClick={redo} disabled={historyIdx >= history.length - 1}><Redo2 className="w-4 h-4" /></Button>
        
        {/* ISSUE #10: Fill Generator */}
        <Button variant="outline" onClick={() => generateFill()} title="Generate drum fill (F)">
          🥁 Fill
        </Button>
        
        {/* ISSUE #9: Accent Pattern */}
        <Button variant="outline" onClick={applyAccentPattern} title="Emphasize beats 2 & 4">
          🎯 Accent
        </Button>
        
        {/* ISSUE #3: Export Audio */}
        <Button variant="outline" onClick={exportBeatAsAudio} className="border-green-500 text-green-300">
          📥 Export WAV
        </Button>
        
        {/* ISSUE #2: Save/Load Patterns */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">💾 Patterns</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-800 border-gray-700">
            <DropdownMenuLabel>Saved Patterns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => savePattern()}>
              Save Current Pattern
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {savedPatterns.length === 0 ? (
              <DropdownMenuItem disabled>No saved patterns</DropdownMenuItem>
            ) : (
              savedPatterns.map(p => (
                <DropdownMenuItem key={p.id} className="flex justify-between">
                  <span onClick={() => loadPattern(p.id)}>{p.name}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-5 w-5 p-0 text-red-400"
                    onClick={(e) => { e.stopPropagation(); deletePattern(p.id); }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Humanize */}
        <div className="flex items-center gap-2 border-l border-gray-600 pl-2">
          <span className="text-xs text-gray-400">Humanize</span>
          <Slider value={[humanize]} onValueChange={v => setHumanize(v[0])} max={100} className="w-16" />
          <Button variant="outline" size="sm" onClick={applyHumanize} disabled={humanize === 0}>
            Apply
          </Button>
        </div>
      </div>

      {/* Master Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-800 rounded">
        <div className="flex items-center gap-2" title="Master output volume">
          <span className="text-sm text-gray-400">Master</span>
          <Slider value={[masterVol]} onValueChange={v => setMasterVol(v[0])} max={100} className="w-20" />
          <span className="text-xs w-8">{masterVol}</span>
        </div>
        <div className="flex items-center gap-2" title="Choose drum sound engine">
          <span className="text-sm text-gray-400">Sound</span>
          <Button
            variant={useRealisticDrums ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setUseRealisticDrums(prev => !prev)}
          >
            {useRealisticDrums ? 'Realistic' : 'Classic'}
          </Button>
        </div>
        <div className="flex items-center gap-2" title="Swing: delays off-beat steps for groove feel">
          <span className="text-sm text-gray-400">Swing</span>
          <Slider value={[swing]} onValueChange={v => setSwing(v[0])} max={100} className="w-20" />
          <span className="text-xs w-8">{swing}%</span>
        </div>
        <div className="flex items-center gap-2" title="Groove: accents backbeats (2 & 4)">
          <span className="text-sm text-gray-400">Groove</span>
          <Slider value={[groove]} onValueChange={v => setGroove(v[0])} max={100} className="w-20" />
          <span className="text-xs w-8">{groove}%</span>
        </div>
        <div className="flex items-center gap-2" title="Tempo in beats per minute">
          <span className="text-sm text-gray-400">BPM</span>
          <input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))}
            className="w-16 bg-gray-700 rounded px-2 py-1 text-sm" min={40} max={240} />
        </div>
        {/* MIDI Mapping Button */}
        <div className="flex items-center gap-2 border-l border-gray-600 pl-2">
          <Button
            variant={showMidiMappingPanel ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowMidiMappingPanel(prev => !prev)}
            data-testid="button-midi-mapping"
          >
            <Music className="w-4 h-4 mr-1" />
            MIDI Map
            {midiConnected && <Badge variant="secondary" className="ml-1 text-xs">Connected</Badge>}
          </Button>
        </div>
      </div>

      {/* MIDI Mapping Panel */}
      {showMidiMappingPanel && (
        <div className="mb-4 p-4 bg-gray-800 rounded border border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Music className="w-4 h-4" />
              MIDI Pad Mapping
              {midiLearnMode && (
                <Badge variant="destructive" className="animate-pulse">
                  Learning: {midiLearnTarget} - Press a pad!
                </Badge>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Reset to defaults instead of empty
                  const defaultMapping: Record<number, string> = {};
                  Object.entries(DEFAULT_MIDI_NOTE_TO_DRUM).forEach(([noteStr, drumType]) => {
                    defaultMapping[Number(noteStr)] = drumType;
                  });
                  setMidiDrumMapping(defaultMapping);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('midiDrumMapping', JSON.stringify(defaultMapping));
                  }
                  toast({ title: 'MIDI mappings reset to defaults' });
                }}
                data-testid="button-clear-midi-mappings"
              >
                Reset to Defaults
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setShowMidiMappingPanel(false);
                  setMidiLearnMode(false);
                  setMidiLearnTarget(null);
                }}
                data-testid="button-close-midi-panel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 mb-3">
            Click "Learn" next to a drum, then press a pad on your MIDI controller to map it.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {tracks.map(track => {
              const trackType = DRUM_ID_TO_TYPE[track.id.toLowerCase()];
              const mappedNotes = Object.entries(midiDrumMapping)
                .filter(([_, drumId]) => 
                  drumId === track.id || 
                  drumId === trackType ||
                  DRUM_ID_TO_TYPE[drumId.toLowerCase()] === trackType
                )
                .map(([noteStr]) => Number(noteStr));
              
              return (
                <div 
                  key={track.id}
                  className={`p-2 rounded border ${
                    midiLearnTarget === track.id 
                      ? 'border-yellow-500 bg-yellow-500/10' 
                      : 'border-gray-600 bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white">{track.name}</span>
                    <Button
                      size="sm"
                      variant={midiLearnTarget === track.id ? 'default' : 'outline'}
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        if (midiLearnTarget === track.id) {
                          setMidiLearnMode(false);
                          setMidiLearnTarget(null);
                        } else {
                          setMidiLearnMode(true);
                          setMidiLearnTarget(track.id);
                        }
                      }}
                      data-testid={`button-learn-${track.id}`}
                    >
                      {midiLearnTarget === track.id ? 'Cancel' : 'Learn'}
                    </Button>
                  </div>
                  <div className="text-xs text-gray-400">
                    {mappedNotes.length > 0 ? (
                      mappedNotes.map(n => MIDI_NOTE_NAMES[n]).join(', ')
                    ) : (
                      <span className="italic">No mapping</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Step Editor */}
      {selectedStep && (
        <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-600">
          <div className="text-sm text-white mb-2 flex items-center justify-between">
            <span>{tracks[selectedStep.t].name} — Step {selectedStep.s + 1}</span>
            <Button size="sm" variant="ghost" onClick={() => setSelectedStep(null)} className="h-5 w-5 p-0">×</Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Velocity */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Velocity</span>
              <Slider value={[tracks[selectedStep.t].pattern[selectedStep.s].velocity]}
                onValueChange={v => setTracks(prev => {
                  const c = JSON.parse(JSON.stringify(prev));
                  c[selectedStep.t].pattern[selectedStep.s].velocity = v[0];
                  return c;
                })} max={127} className="w-24" />
              <span className="text-xs w-8">{tracks[selectedStep.t].pattern[selectedStep.s].velocity}</span>
            </div>
            {/* Probability */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Probability</span>
              <Slider value={[tracks[selectedStep.t].pattern[selectedStep.s].probability]}
                onValueChange={v => setTracks(prev => {
                  const c = JSON.parse(JSON.stringify(prev));
                  c[selectedStep.t].pattern[selectedStep.s].probability = v[0];
                  return c;
                })} max={100} className="w-24" />
              <span className="text-xs w-8">{tracks[selectedStep.t].pattern[selectedStep.s].probability}%</span>
            </div>
            {/* Flam */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Flam</span>
              <Button size="sm" 
                variant={tracks[selectedStep.t].pattern[selectedStep.s].flam ? 'default' : 'outline'}
                onClick={() => setTracks(prev => {
                  const c = JSON.parse(JSON.stringify(prev));
                  c[selectedStep.t].pattern[selectedStep.s].flam = !c[selectedStep.t].pattern[selectedStep.s].flam;
                  return c;
                })}
                className={`h-6 px-2 text-xs ${tracks[selectedStep.t].pattern[selectedStep.s].flam ? 'bg-orange-500' : ''}`}>
                {tracks[selectedStep.t].pattern[selectedStep.s].flam ? 'ON' : 'OFF'}
              </Button>
            </div>
            {/* Roll */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Roll</span>
              <Select 
                value={String(tracks[selectedStep.t].pattern[selectedStep.s].roll)}
                onValueChange={v => setTracks(prev => {
                  const c = JSON.parse(JSON.stringify(prev));
                  c[selectedStep.t].pattern[selectedStep.s].roll = Number(v);
                  return c;
                })}>
                <SelectTrigger className="w-16 h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="3">3x</SelectItem>
                  <SelectItem value="4">4x</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Pitch */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Pitch</span>
              <Slider value={[tracks[selectedStep.t].pattern[selectedStep.s].pitch + 12]}
                onValueChange={v => setTracks(prev => {
                  const c = JSON.parse(JSON.stringify(prev));
                  c[selectedStep.t].pattern[selectedStep.s].pitch = v[0] - 12;
                  return c;
                })} max={24} className="w-20" />
              <span className="text-xs w-8">{tracks[selectedStep.t].pattern[selectedStep.s].pitch > 0 ? '+' : ''}{tracks[selectedStep.t].pattern[selectedStep.s].pitch}</span>
            </div>
          </div>
        </div>
      )}

      {/* Step Grid */}
      <div className="space-y-2 overflow-x-auto">
        {tracks.map((track, ti) => (
          <div key={track.id} className="flex items-center gap-2">
            {/* Track Controls */}
            <div className="flex items-center gap-1 w-56 flex-shrink-0">
              <div className={`w-3 h-3 rounded ${track.color}`} />
              <span
                className="text-xs font-medium text-white w-14 truncate"
                title={track.name}
              >
                {track.name}
              </span>
              {/* ISSUE #7: Per-track pan control */}
              <div className="flex items-center gap-0.5" title={`Pan: ${track.pan}`}>
                <span className="text-[9px] text-gray-500">L</span>
                <Slider 
                  value={[track.pan + 50]} 
                  onValueChange={v => setTracks(p => { 
                    const c = [...p]; 
                    c[ti] = {...c[ti], pan: v[0] - 50}; 
                    return c; 
                  })}
                  max={100}
                  className="w-10"
                />
                <span className="text-[9px] text-gray-500">R</span>
              </div>
              <Button size="sm" variant={track.muted ? 'destructive' : 'outline'}
                onClick={() => setTracks(p => { const c = [...p]; c[ti] = {...c[ti], muted: !c[ti].muted}; return c; })}
                className="h-5 w-5 p-0 text-xs" title="Mute">M</Button>
              <Button size="sm" variant={track.solo ? 'default' : 'outline'}
                onClick={() => setTracks(p => { const c = [...p]; c[ti] = {...c[ti], solo: !c[ti].solo}; return c; })}
                className="h-5 w-5 p-0 text-xs" title="Solo">S</Button>
              <Button size="sm" variant="outline" onClick={() => copyTrackPattern(ti)}
                className="h-5 w-5 p-0 text-xs" title="Copy pattern">
                <Copy className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => pasteTrackPattern(ti)}
                className="h-5 w-5 p-0 text-xs" title="Paste pattern" disabled={!copiedTrack}>
                <Clipboard className="w-3 h-3" />
              </Button>
            </div>

            {/* Steps */}
            <div className="flex gap-0.5">
              {track.pattern.map((step, si) => {
                // ISSUE #8: Visual velocity display - opacity based on velocity
                const velocityOpacity = step.active ? 0.4 + (step.velocity / 127) * 0.6 : 1;
                const velocityHeight = step.active ? Math.max(2, (step.velocity / 127) * 100) : 0;
                
                return (
                  <button key={si} onClick={() => toggleStep(ti, si)}
                    className={`w-7 h-7 rounded text-xs font-bold transition-all relative overflow-hidden
                      ${step.active ? `${track.color} text-white shadow-lg` : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}
                      ${currentStep === si && isPlaying ? 'ring-2 ring-yellow-400 scale-110' : ''}
                      ${selectedStep?.t === ti && selectedStep?.s === si ? 'ring-2 ring-blue-400' : ''}
                      ${si % 4 === 0 ? 'ml-1' : ''}`}
                    style={{ opacity: velocityOpacity }}
                    title={step.active ? `Vel: ${step.velocity}` : ''}>
                    {si + 1}
                    {/* ISSUE #8: Velocity bar indicator */}
                    {step.active && (
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-white/30"
                        style={{ height: `${velocityHeight}%` }}
                      />
                    )}
                    {/* Flam indicator */}
                    {step.flam && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" />}
                    {/* Roll indicator */}
                    {step.roll > 0 && <span className="absolute -bottom-1 -right-1 text-[8px] bg-cyan-500 rounded px-0.5">{step.roll}x</span>}
                  </button>
                );
              })}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1 w-20 flex-shrink-0">
              <Volume2 className="w-3 h-3 text-gray-500" />
              <Slider value={[track.volume]} onValueChange={v => setTracks(p => {
                const c = [...p]; c[ti] = {...c[ti], volume: v[0]}; return c;
              })} max={100} className="w-14" />
              <span className="text-xs w-6">{track.volume}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="mt-4 flex gap-2">
        <Button className="bg-green-600 hover:bg-green-500" onClick={async () => {
          // Request a session destination first
          const destination = await requestDestination({ suggestedName: 'ProBeat Session' });
          if (!destination) return;

          // Convert drum pattern to notes format for the track store
          // Calculate time in beats: each step is a 16th note = 0.25 beats
          const stepDuration = 0.25; // 16th note in beats
          const drumNotes: Array<{ id: string; note: string; octave: number; time: number; duration: number; velocity: number; drumType: string }> = [];
          tracks.forEach(track => {
            track.pattern.forEach((step, stepIndex) => {
              if (step.active) {
                drumNotes.push({
                  id: `drum-${track.id}-${stepIndex}-${Date.now()}`,
                  note: 'C',
                  octave: 2,
                  time: stepIndex * stepDuration,
                  duration: stepDuration,
                  velocity: step.velocity,
                  drumType: track.id,
                });
              }
            });
          });

          const drumTrackId = `beat-${Date.now()}`;
          const bars = Math.max(1, Math.ceil(patternLength / 16));
          
          // Add track to global store with proper format
          addTrack({
            id: drumTrackId,
            kind: 'beat',
            name: 'ProBeat Drums',
            lengthBars: bars,
            startBar: 0,
            payload: {
              type: 'beat',
              instrument: 'drums',
              notes: drumNotes,
              source: 'probeat-drums',
              bpm,
              volume: masterVol,
              pan: 0,
            },
          });

          // Send to parent component
          onPatternChange?.(tracks, bpm);
          
          toast({ title: 'Pattern Sent', description: 'Beat added to timeline' });
          
          // Navigate to the multi-track view
          setLocation('/studio');
        }}>
          <Send className="w-4 h-4 mr-1" />Send to Timeline
        </Button>
        
        <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => {
          toast({ title: 'Routed to Mixer', description: 'Beat sent to Mix Studio' });
          setLocation('/mixer');
        }}>
          <RotateCcw className="w-4 h-4 mr-1" />Route to Mixer
        </Button>
      </div>
    </Card>
  );
}
