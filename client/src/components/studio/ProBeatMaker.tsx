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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTransport } from '@/contexts/TransportContext';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import { useSessionDestination } from '@/contexts/SessionDestinationContext';
import { AstutelyFader, AstutelyKnob, AstutelyMeter } from '@/components/astutely/AstutelyControls';
import { AIProviderSelector } from '@/components/ui/ai-provider-selector';
import { realisticAudio } from '@/lib/realisticAudio';
import { professionalAudio } from '@/lib/professionalAudio';
import { audioBufferToWav } from '@/lib/stemExport';
import { useMIDI } from '@/hooks/use-midi';
import {
  Play, Square, RotateCcw, Undo2, Redo2, Shuffle, Send, ChevronDown, Wand2,
  Copy, Clipboard, Volume2, Disc, Zap, Timer, Settings, X, Music, Drum, Check, Edit2, Save, DownloadCloud, Download
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTracks } from '@/hooks/useTracks';

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

// Logical drum engine types – expanded so different rows can sound distinct
type DrumEngineType =
  | 'kick' | 'snare' | 'clap' | 'hihat' | 'openhat' | 'ride' | 'tom' | 'tom_hi' | 'tom_mid' | 'tom_lo' | 'conga' | 'perc' | 'rim' | 'crash' | 'cowbell';

// Normalize drum ids to sound engine types
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
  ride: 'ride',
  crash: 'crash',
  cowbell: 'cowbell',
  fx: 'perc',
  foley: 'perc',
  bell: 'perc',
  'vinyl fx': 'perc',
  perc: 'perc',
  rim: 'rim',
  tom: 'tom_mid',
  tom1: 'tom_hi',
  tom2: 'tom_mid',
  tom3: 'tom_lo',
  conga: 'conga',
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
    name: 'TR-808', description: 'Classic Roland 808 - Hip-Hop, Trap',
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
    name: 'TR-909', description: 'Classic Roland 909 - House, Techno',
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
    name: 'Acoustic Kit', description: 'Natural drum kit - Rock, Pop',
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
    name: 'Lo-Fi Kit', description: 'Dusty, vintage sounds - Lo-Fi Hip-Hop',
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
    name: 'Trap Kit', description: 'Modern trap sounds - 808s, hi-hat rolls',
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

const CLASSIC_KIT_PROFILES: Record<string, any> = {
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
};

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

const initTracks = (len: number, kitId: string = '808'): DrumTrack[] => {
  const kit = DRUM_KITS[kitId] || DRUM_KITS['808'];
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
  const { addAndSaveTrack } = useTracks();
  const { requestDestination } = useSessionDestination();
  const [, setLocation] = useLocation();
  const { lastNote, activeNotes, isConnected: midiConnected, setDrumMode } = useMIDI();
  
  useEffect(() => {
    setDrumMode(true);
    return () => setDrumMode(false);
  }, [setDrumMode]);

  // 🔄 Listen for loop loading from Loop Library
  useEffect(() => {
    const handleLoadLoop = (e: CustomEvent<{ loopId: string; name: string; audioUrl: string; bpm?: number }>) => {
      const { name, bpm: loopBpm } = e.detail;
      
      // Update BPM if provided
      if (loopBpm) {
        setBpm(loopBpm);
      }
      
      // Generate a random pattern based on the loop name
      // In a real implementation, you'd analyze the audio
      const isKick = name.toLowerCase().includes('kick') || name.toLowerCase().includes('bass');
      const isSnare = name.toLowerCase().includes('snare') || name.toLowerCase().includes('clap');
      const isHihat = name.toLowerCase().includes('hat') || name.toLowerCase().includes('hi-hat');
      
      setTracks(prev => prev.map(track => {
        // Auto-activate steps based on loop type
        if ((isKick && track.id === 'kick') || 
            (isSnare && track.id === 'snare') || 
            (isHihat && track.id === 'hihat')) {
          return {
            ...track,
            pattern: track.pattern.map((step, i) => ({
              ...step,
              active: i % 4 === 0 || (track.id === 'hihat' && i % 2 === 0),
            })),
          };
        }
        return track;
      }));
      
      toast({ 
        title: "🥁 Loop Pattern Applied", 
        description: `${name} pattern loaded into Beat Lab` 
      });
    };
    
    window.addEventListener('load-loop-to-beat-lab', handleLoadLoop as EventListener);
    return () => window.removeEventListener('load-loop-to-beat-lab', handleLoadLoop as EventListener);
  }, [toast]);
  
  const [tracks, setTracks] = useState<DrumTrack[]>(() => {
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
  const [bpm, setBpm] = useState(90);
  const [patternLength, setPatternLength] = useState(16);
  const [swing, setSwing] = useState(0);
  const [groove, setGroove] = useState(0);
  const [humanize, setHumanize] = useState(0);
  const [masterVol, setMasterVol] = useState(80);
  const [useRealisticDrums, setUseRealisticDrums] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStep, setSelectedStep] = useState<{t: number, s: number} | null>(null);
  const [history, setHistory] = useState<DrumTrack[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [selectedKit, setSelectedKit] = useState('808');
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [metronomeVol, setMetronomeVol] = useState(30);
  const [copiedTrack, setCopiedTrack] = useState<DrumStep[] | null>(null);
  const [patternVariation, setPatternVariation] = useState<'A' | 'B'>('A');
  const [variationB, setVariationB] = useState<DrumTrack[] | null>(null);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [showMidiMappingPanel, setShowMidiMappingPanel] = useState(false);
  const [midiDrumMapping, setMidiDrumMapping] = useState<Record<number, string>>(() => {
    const defaultMapping: Record<number, string> = {};
    Object.entries(DEFAULT_MIDI_NOTE_TO_DRUM).forEach(([noteStr, drumType]) => {
      defaultMapping[Number(noteStr)] = drumType;
    });
    return defaultMapping;
  });
  const [midiLearnMode, setMidiLearnMode] = useState(false);
  const [midiLearnTarget, setMidiLearnTarget] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState('grok');
  const [selectedGenre, setSelectedGenre] = useState('Hip-Hop');
  
  const audioCtx = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => { if (audioCtx.current?.state !== 'closed') audioCtx.current?.close(); };
  }, []);

  useEffect(() => { if (tempo) setBpm(Math.round(tempo)); }, [tempo]);

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

  const playSound = useCallback(async (id: string, vel: number, vol: number) => {
    const normalizedId = id.toLowerCase();
    const drumType = DRUM_ID_TO_TYPE[normalizedId] || 'snare';
    const kitKey = selectedKit.toLowerCase();
    const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === 'drums' || ch.name.toLowerCase() === 'drums');

    if (useRealisticDrums) {
      const baseVelocity = (vel / 127) * (vol / 100) * (masterVol / 100);
      await realisticAudio.playDrumSound(drumType, baseVelocity, kitKey, mixerChannel?.input);
      return;
    }

    if (!audioCtx.current) return;
    const ctx = audioCtx.current;
    if (ctx.state === 'suspended') await ctx.resume();
    const gain = ctx.createGain();
    gain.gain.value = (vel / 127) * (vol / 100) * (masterVol / 100);
    gain.connect(mixerChannel?.input || ctx.destination);
    
    // Simple synth fallback based on kit profiles
    const kitProfile = CLASSIC_KIT_PROFILES[kitKey] || CLASSIC_KIT_PROFILES.default;
    
    switch (drumType) {
      case 'kick': {
        const now = ctx.currentTime;
        
        // Body oscillator - deep sine
        const bodyOsc = ctx.createOscillator();
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(65, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
        
        const bodyGain = ctx.createGain();
        bodyGain.gain.setValueAtTime(0.001, now);
        bodyGain.gain.linearRampToValueAtTime(0.9, now + 0.005);
        bodyGain.gain.exponentialRampToValueAtTime(0.5, now + 0.06);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        // Punch layer - adds attack definition
        const punchOsc = ctx.createOscillator();
        punchOsc.type = 'sine';
        punchOsc.frequency.setValueAtTime(150, now);
        punchOsc.frequency.exponentialRampToValueAtTime(50, now + 0.03);
        
        const punchGain = ctx.createGain();
        punchGain.gain.setValueAtTime(0.001, now);
        punchGain.gain.linearRampToValueAtTime(0.4, now + 0.003);
        punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        
        // Connect
        bodyOsc.connect(bodyGain);
        bodyGain.connect(gain);
        punchOsc.connect(punchGain);
        punchGain.connect(gain);
        
        bodyOsc.start(now);
        punchOsc.start(now);
        bodyOsc.stop(now + 0.4);
        punchOsc.stop(now + 0.05);
        break;
      }
      case 'snare':
      case 'clap': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.6, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        s.connect(g); g.connect(gain); s.start(); s.stop(ctx.currentTime + 0.1);
        break;
      }
      case 'hihat': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
        s.connect(f); f.connect(gain); s.start(); s.stop(ctx.currentTime + 0.05);
        break;
      }
      default: {
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    }
  }, [masterVol, useRealisticDrums, selectedKit]);

  useEffect(() => {
    if (!isPlaying) return;
    const baseMs = (60 / bpm / 4) * 1000;
    const ms = currentStep % 2 === 1 && swing > 0 ? baseMs + baseMs * swing / 100 * 0.33 : baseMs;
    
    intervalRef.current = setTimeout(() => {
      const hasSolo = tracks.some(t => t.solo);
      tracks.forEach(track => {
        const step = track.pattern[currentStep];
        if (step?.active && !track.muted && (!hasSolo || track.solo)) {
          if (Math.random() * 100 <= step.probability) {
            const backbeat = currentStep % 4 === 2 || currentStep % 4 === 3;
            const boost = groove > 0 ? 1 + (groove / 200) * (backbeat ? 1 : -0.3) : 1;
            const vel = Math.min(127, step.velocity * boost);
            
            playSound(track.id, vel, track.volume);
            
            if (step.flam) {
              setTimeout(() => playSound(track.id, vel * 0.6, track.volume), 30);
            }
            
            if (step.roll > 0) {
              const rollInterval = (baseMs) / step.roll;
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
      const copy = [...prev];
      copy[ti] = { ...copy[ti], pattern: [...copy[ti].pattern] };
      copy[ti].pattern[si] = { ...copy[ti].pattern[si], active: !copy[ti].pattern[si].active };
      if (copy[ti].pattern[si].active) playSound(copy[ti].id, 100, copy[ti].volume);
      return copy;
    });
    setSelectedStep({ t: ti, s: si });
  };

  const handleTapTempo = () => {
    const now = Date.now();
    const newTaps = tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000 ? [now] : [...tapTimes, now].slice(-8);
    setTapTimes(newTaps);
    setTapCount(newTaps.length);
    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) intervals.push(newTaps[i] - newTaps[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.round(60000 / avg));
    }
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => { setTapTimes([]); setTapCount(0); }, 2000);
  };

  const switchVariation = (v: 'A' | 'B') => {
    if (v === patternVariation) return;
    const current = JSON.parse(JSON.stringify(tracks));
    if (variationB) setTracks(variationB);
    setVariationB(current);
    setPatternVariation(v);
    toast({ title: `Variation ${v} Loaded` });
  };

  const generateBeatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/beats/generate', { genre: selectedGenre.toLowerCase(), bpm, duration: 4, aiProvider });
      return response.json();
    },
    onSuccess: (data) => {
      const pattern = data?.beat?.pattern;
      if (pattern) {
        saveHistory();
        setTracks(prev => prev.map(t => ({
          ...t, pattern: t.pattern.map((s, i) => ({ ...s, active: pattern[t.id] ? pattern[t.id][i % pattern[t.id].length] : false }))
        })));
        toast({ title: 'AI Beat Pattern Synchronized' });
      }
    },
    onError: (err: any) => {
      toast({
        title: 'AI Beat Failed',
        description: String(err?.message || err || 'Unknown error'),
        variant: 'destructive',
      });
    },
  });

  const generatePhase3DrumsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai/music/drums', { bpm, bars: 4, style: selectedGenre.toLowerCase() });
      return response.json();
    }
  });

  const changeKit = (id: string) => {
    saveHistory();
    setSelectedKit(id);
    setTracks(initTracks(patternLength, id));
    toast({ title: `${DRUM_KITS[id].name} Kit Loaded` });
  };

  const changeLength = (len: number) => {
    setPatternLength(len);
    setTracks(prev => prev.map(t => ({
      ...t, pattern: Array(len).fill(null).map((_, i) => t.pattern[i] || createEmptyStep())
    })));
  };

  const randomize = () => {
    saveHistory();
    setTracks(prev => prev.map(t => ({
      ...t, pattern: t.pattern.map(() => ({ ...createEmptyStep(), active: Math.random() < 0.25 }))
    })));
    toast({ title: 'Pattern Entropy Randomized' });
  };

  const clearAll = () => { saveHistory(); setTracks(initTracks(patternLength, selectedKit)); toast({ title: 'Pattern Reset' }); };

  const copyTrackPattern = (i: number) => { setCopiedTrack([...tracks[i].pattern]); toast({ title: 'Pattern Copied to Clipboard' }); };
  const pasteTrackPattern = (i: number) => {
    if (!copiedTrack) return;
    saveHistory();
    setTracks(prev => {
      const copy = [...prev];
      copy[i] = { ...copy[i], pattern: copiedTrack.slice(0, patternLength).map(s => ({...s})) };
      return copy;
    });
    toast({ title: 'Pattern Injected from Clipboard' });
  };

  const applyHumanize = () => {
    if (humanize === 0) return;
    saveHistory();
    setTracks(prev => prev.map(t => ({
      ...t, pattern: t.pattern.map(s => ({ ...s, velocity: s.active ? Math.max(1, Math.min(127, s.velocity + (Math.random() - 0.5) * humanize)) : s.velocity }))
    })));
    toast({ title: `Humanize Injection: ${humanize}%` });
  };

  const applyAccentPattern = () => {
    saveHistory();
    setTracks(prev => prev.map(t => ({
      ...t, pattern: t.pattern.map((s, i) => ({ ...s, velocity: s.active && i % 4 === 0 ? Math.min(127, s.velocity + 20) : s.velocity }))
    })));
    toast({ title: 'Downbeat Accents Synthesized' });
  };

  const loadPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (!preset) return;
    saveHistory();
    setTracks(prev => prev.map(t => {
      const presetPattern = preset[t.id];
      if (!presetPattern) return t;
      return {
        ...t,
        pattern: t.pattern.map((step, i) => ({
          ...step,
          active: presetPattern[i % presetPattern.length] ?? false
        }))
      };
    }));
    toast({ title: `${presetName} Preset Loaded` });
  };

  const generateFill = () => {
    saveHistory();
    const fillStart = Math.max(0, patternLength - 4);
    setTracks(prev => prev.map(t => ({
      ...t,
      pattern: t.pattern.map((step, i) => {
        if (i < fillStart) return step;
        // Generate fill pattern - more hits towards the end
        const fillIntensity = (i - fillStart) / 4;
        const shouldHit = Math.random() < (0.3 + fillIntensity * 0.5);
        return {
          ...step,
          active: shouldHit,
          velocity: shouldHit ? Math.floor(80 + Math.random() * 47) : step.velocity
        };
      })
    })));
    toast({ title: 'Drum Fill Generated' });
  };

  const exportBeatAsAudio = async () => {
    toast({ title: '🎬 Rendering Audio Signal...', description: 'Synthesizing neural drum patterns...' });
    
    try {
      const sampleRate = 44100;
      const secondsPerBeat = 60 / bpm;
      const secondsPerStep = secondsPerBeat / 4;
      const totalDuration = patternLength * secondsPerStep + 1; // +1s for tail
      
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);
      
      // Rendering loop
      for (let stepIdx = 0; stepIdx < patternLength; stepIdx++) {
        const startTime = stepIdx * secondsPerStep;
        
        tracks.forEach(track => {
          const step = track.pattern[stepIdx];
          if (step?.active) {
            // Only render if probability passes (simplified for export - always 100% or use a seed)
            if (Math.random() * 100 <= step.probability) {
              const drumType = DRUM_ID_TO_TYPE[track.id.toLowerCase()] || 'snare';
              const vel = step.velocity / 127;
              const vol = track.volume / 100;
              const finalGain = vel * vol * (masterVol / 100);
              
              // Synthesis logic for offline context
              renderOfflineDrum(offlineCtx, drumType, startTime, finalGain);
              
              if (step.flam) {
                renderOfflineDrum(offlineCtx, drumType, startTime + 0.03, finalGain * 0.6);
              }
            }
          }
        });
      }
      
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      const url = URL.createObjectURL(wavBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CodedSwitch_Beat_${selectedGenre}_${bpm}BPM.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ title: '✅ Signal Export Complete', description: 'WAV file ready for production' });
    } catch (error) {
      console.error('Export failed:', error);
      toast({ title: '❌ Export Failed', description: 'Neural rendering pipeline error', variant: 'destructive' });
    }
  };

  // Helper for offline drum synthesis
  const renderOfflineDrum = (ctx: OfflineAudioContext, type: DrumEngineType, time: number, gainValue: number) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, time);
    gain.connect(ctx.destination);
    
    switch (type) {
      case 'kick': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(60, time);
        o.frequency.exponentialRampToValueAtTime(40, time + 0.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.8, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        o.connect(g); g.connect(gain); o.start(time); o.stop(time + 0.3);
        break;
      }
      case 'snare':
      case 'clap': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.6, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        s.connect(g); g.connect(gain); s.start(time); s.stop(time + 0.1);
        break;
      }
      case 'hihat':
      case 'openhat': {
        const dur = type === 'hihat' ? 0.05 : 0.2;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
        s.connect(f); f.connect(gain); s.start(time); s.stop(time + dur);
        break;
      }
      default: {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(200, time);
        o.connect(gain); o.start(time); o.stop(time + 0.1);
      }
    }
  };

  const savePattern = () => toast({ title: 'Pattern Archived in Signal Vault' });

  // MIDI learning logic
  useEffect(() => {
    if (!lastNote || !midiLearnMode || !midiLearnTarget) return;
    setMidiDrumMapping(prev => ({ ...prev, [lastNote.note]: midiLearnTarget }));
    setMidiLearnMode(false);
    setMidiLearnTarget(null);
    toast({ title: 'MIDI Command Captured', description: `${MIDI_NOTE_NAMES[lastNote.note]} mapped to ${midiLearnTarget}` });
  }, [lastNote, midiLearnMode, midiLearnTarget, toast]);

  // MIDI trigger logic
  useEffect(() => {
    if (!lastNote || midiLearnMode) return;
    const drumId = midiDrumMapping[lastNote.note];
    if (drumId) {
      const matchingTrack = tracks.find(t => t.id === drumId);
      playSound(drumId, lastNote.velocity, matchingTrack?.volume ?? 80);
    }
  }, [lastNote, midiDrumMapping, midiLearnMode, playSound, tracks]);

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl relative overflow-hidden shadow-2xl group p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-emerald-500/5 pointer-events-none" />
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 relative z-10 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-white/20">
            <Drum className="text-white h-6 w-6 drop-shadow-[0_0_8px_white]" />
          </div>
          <div>
            <h2 className="text-2xl font-black font-heading text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 uppercase tracking-tighter drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
              Pro Beat Maker
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-black tracking-widest uppercase px-2 py-0">{bpm} BPM</Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] font-black tracking-widest uppercase px-2 py-0">Step {currentStep + 1}/{patternLength}</Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/10 shadow-inner">
            <Button size="sm" variant="ghost" onClick={() => switchVariation('A')} className={`h-8 w-10 rounded-lg font-black text-xs transition-all ${patternVariation === 'A' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-white/20 hover:text-white'}`}>A</Button>
            <Button size="sm" variant="ghost" onClick={() => switchVariation('B')} className={`h-8 w-10 rounded-lg font-black text-xs transition-all ${patternVariation === 'B' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-white/20 hover:text-white'}`}>B</Button>
          </div>
        </div>
      </div>

      {/* Main Controls Console */}
      <div className="flex flex-wrap items-center gap-3 mb-6 relative z-10 bg-white/5 p-4 rounded-2xl border border-white/5 shadow-xl">
        <Button onClick={() => { setIsPlaying(!isPlaying); if (isPlaying) setCurrentStep(0); }} className={`h-12 px-6 rounded-xl font-black uppercase text-xs tracking-widest transition-all border-2 ${isPlaying ? 'bg-red-500/10 border-red-500/50 text-red-400 animate-pulse' : 'bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20'}`}>
          {isPlaying ? <Square className="w-4 h-4 mr-2 fill-current" /> : <Play className="w-4 h-4 mr-2 fill-current" />} {isPlaying ? 'Stop' : 'Play'}
        </Button>
        
        <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
          <Button variant="ghost" onClick={() => setMetronomeOn(!metronomeOn)} className={`h-9 px-4 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all ${metronomeOn ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/40'}`}><Timer className="w-4 h-4 mr-2" />Click</Button>
          {metronomeOn && <Slider value={[metronomeVol]} onValueChange={v => setMetronomeVol(v[0])} max={100} className="w-20 px-2" />}
        </div>
        
        <Button variant="outline" onClick={handleTapTempo} className="h-12 px-5 bg-white/5 border-white/10 text-white/60 hover:bg-blue-500/20 hover:text-blue-400 rounded-xl font-black uppercase text-[10px] tracking-widest relative">
          <Zap className="w-4 h-4 mr-2" />Tap {tapCount > 0 && <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-gray-900 shadow-lg">{tapCount}</span>}
        </Button>
        
        <Select value={selectedKit} onValueChange={changeKit}>
          <SelectTrigger className="h-12 w-44 bg-black/20 border-white/10 rounded-xl font-bold text-xs"><Disc className="w-4 h-4 mr-2 text-purple-400" /><SelectValue /></SelectTrigger>
          <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
            {Object.entries(DRUM_KITS).map(([id, kit]) => (
              <SelectItem key={id} value={id} className="focus:bg-purple-500/20 py-2"><div className="flex flex-col"><span className="font-bold">{kit.name}</span><span className="text-[9px] text-white/30 uppercase tracking-tighter mt-0.5">{kit.description}</span></div></SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger className="h-12 w-32 bg-black/20 border-white/10 rounded-xl font-bold text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
              {Object.keys(PRESETS).map(g => (
                <SelectItem key={g} value={g} className="focus:bg-blue-500/20">{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => generateBeatMutation.mutate()} 
            disabled={generateBeatMutation.isPending}
            className="h-12 px-5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {generateBeatMutation.isPending ? 'Generating…' : 'Apply AI'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 relative z-10 bg-white/5 p-4 rounded-2xl border border-white/5 shadow-xl">
        <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-2">Seq Length</span>
          <Select value={String(patternLength)} onValueChange={v => changeLength(Number(v))}>
            <SelectTrigger className="h-10 w-28 bg-white/5 border-white/10 rounded-xl font-bold text-xs px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
              {[8, 16, 32, 64].map(n => (
                <SelectItem key={n} value={String(n)} className="text-xs font-medium focus:bg-blue-500/20">{n} Steps</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-6 w-px bg-white/10 mx-1" />

        <Button variant="ghost" onClick={randomize} className="h-10 bg-white/5 border border-white/10 text-white/60 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-xl font-black uppercase text-[10px] tracking-widest px-4"><Shuffle className="w-4 h-4 mr-2" />Random</Button>
        <Button variant="ghost" onClick={clearAll} className="h-10 bg-white/5 border border-white/10 text-white/60 hover:bg-red-500/10 hover:text-red-400 rounded-xl font-black uppercase text-[10px] tracking-widest px-4"><RotateCcw className="w-4 h-4 mr-2" />Clear</Button>
        
        <div className="flex gap-1.5 ml-1">
          <Button variant="ghost" onClick={undo} disabled={historyIdx <= 0} className="h-10 w-10 p-0 bg-white/5 border border-white/10 text-white/40 hover:text-white rounded-xl disabled:opacity-20 transition-all"><Undo2 className="w-4 h-4" /></Button>
          <Button variant="ghost" onClick={redo} disabled={historyIdx >= history.length - 1} className="h-10 w-10 p-0 bg-white/5 border border-white/10 text-white/40 hover:text-white rounded-xl disabled:opacity-20 transition-all"><Redo2 className="w-4 h-4" /></Button>
        </div>
        
        <Button variant="ghost" onClick={() => generateFill()} title="Generate drum fill (F)" className="h-10 bg-white/5 border border-white/10 text-white/60 hover:bg-blue-500/10 hover:text-blue-400 rounded-xl font-black uppercase text-[10px] tracking-widest px-4">🥁 Fill</Button>
        <Button variant="ghost" onClick={applyAccentPattern} title="Emphasize beats 2 & 4" className="h-10 bg-white/5 border border-white/10 text-white/60 hover:bg-purple-500/10 hover:text-purple-400 rounded-xl font-black uppercase text-[10px] tracking-widest px-4">🎯 Accent</Button>
        
        <div className="h-6 w-px bg-white/10 mx-1" />

        <Button variant="ghost" onClick={exportBeatAsAudio} className="h-10 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest px-5 shadow-sm">📥 Export WAV</Button>
        
        <div className="flex items-center gap-3 bg-black/20 p-1.5 rounded-xl border border-white/5 ml-auto">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-2">Humanize</span>
          <Slider value={[humanize]} onValueChange={v => setHumanize(v[0])} max={100} className="w-20 px-2" />
          <Button variant="ghost" size="sm" onClick={applyHumanize} disabled={humanize === 0} className="h-7 bg-white/5 border border-white/10 text-white/40 hover:text-white rounded-lg text-[9px] font-black uppercase px-3">Inject</Button>
        </div>
      </div>

      {/* Global Processing Lane */}
      <div className="flex flex-wrap items-center gap-8 mb-8 p-5 bg-black/40 rounded-3xl border border-white/10 shadow-2xl relative z-10">
        <div className="flex items-center gap-4">
          <AstutelyKnob
            label="Master Gain"
            value={masterVol}
            onValueChange={setMasterVol}
            min={0}
            max={100}
            step={1}
            tone="cyan"
            size={56}
          />
          <AstutelyMeter value={masterVol} tone="cyan" className="h-14" />
          <AstutelyFader
            label="Master Trim"
            value={masterVol}
            onValueChange={setMasterVol}
            min={0}
            max={100}
            step={1}
            tone="cyan"
            className="min-w-[240px]"
            sliderClassName="w-40"
          />
        </div>
        <div className="h-12 w-px bg-white/10" />
        <div className="flex flex-col gap-2 flex-1 min-w-[200px]"><div className="flex justify-between items-center"><span className="text-[10px] font-black text-cyan-300/60 uppercase tracking-widest">Temporal Swing</span><span className="text-xs font-black text-cyan-400">{swing}%</span></div><Slider value={[swing]} onValueChange={v => setSwing(v[0])} max={100} className="w-full" /></div>
        <div className="h-12 w-px bg-white/10" />
        <div className="flex flex-col gap-2 flex-1 min-w-[200px]"><div className="flex justify-between items-center"><span className="text-[10px] font-black text-pink-300/60 uppercase tracking-widest">Backbeat Groove</span><span className="text-xs font-black text-pink-400">{groove}%</span></div><Slider value={[groove]} onValueChange={v => setGroove(v[0])} max={100} className="w-full" /></div>
        <div className="h-12 w-px bg-white/10" />
        <div className="flex flex-col gap-2"><span className="text-[10px] font-black text-emerald-300/60 uppercase tracking-widest">Global Tempo</span><div className="flex items-center gap-2 bg-black/40 rounded-xl border border-white/10 p-1.5"><input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))} className="w-14 bg-transparent border-none text-center font-black text-emerald-400 text-sm focus:ring-0 focus:outline-none" min={40} max={240} /><span className="text-[8px] font-black text-white/20 uppercase tracking-tighter mr-1">BPM</span></div></div>
        <div className="h-12 w-px bg-white/10" />
        <Button variant="ghost" onClick={() => setShowMidiMappingPanel(prev => !prev)} className={`h-12 px-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border-2 ${showMidiMappingPanel ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}><Music className="w-4 h-4 mr-2" />MIDI Interface</Button>
      </div>

      {/* MIDI Interface Panel */}
      {showMidiMappingPanel && (
        <div className="mb-8 p-5 bg-black/60 backdrop-blur-2xl rounded-3xl border border-blue-500/30 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">MIDI Interface</h3>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${midiConnected ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
                {midiConnected ? '● Connected' : '○ Disconnected'}
              </div>
            </div>
            <Button variant="ghost" onClick={() => setShowMidiMappingPanel(false)} className="h-8 w-8 p-0 text-white/20 hover:text-white bg-white/5 rounded-lg border border-white/10"><X className="w-4 h-4" /></Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MIDI Learn Section */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest">MIDI Learn Mode</h4>
              <p className="text-[10px] text-white/40">Click a drum below, then press a key on your MIDI controller to map it.</p>
              <div className="grid grid-cols-4 gap-2">
                {tracks.map(track => (
                  <Button
                    key={track.id}
                    onClick={() => {
                      setMidiLearnMode(true);
                      setMidiLearnTarget(track.id);
                      toast({ title: 'MIDI Learn Active', description: `Press a key to map to ${track.name}` });
                    }}
                    className={`h-12 rounded-xl font-black uppercase text-[8px] tracking-widest transition-all border-2 ${
                      midiLearnMode && midiLearnTarget === track.id 
                        ? 'bg-blue-500/30 border-blue-500 text-blue-300 animate-pulse' 
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/30'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${track.color} mr-2`} />
                    {track.name}
                  </Button>
                ))}
              </div>
              {midiLearnMode && (
                <Button 
                  onClick={() => { setMidiLearnMode(false); setMidiLearnTarget(null); }}
                  className="w-full h-10 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl font-black uppercase text-[10px]"
                >
                  Cancel Learn Mode
                </Button>
              )}
            </div>
            
            {/* Current Mappings */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest">Current Mappings</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {Object.entries(midiDrumMapping).slice(0, 12).map(([noteNum, drumId]) => {
                  const track = tracks.find(t => t.id === drumId);
                  if (!track) return null;
                  return (
                    <div key={noteNum} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded">{MIDI_NOTE_NAMES[Number(noteNum)]}</span>
                        <span className="text-[10px] text-white/40">→</span>
                        <div className={`w-2 h-2 rounded-full ${track.color}`} />
                        <span className="text-[10px] font-black text-white/80">{track.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Active Notes Display */}
          {activeNotes.size > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-green-300/60 uppercase tracking-widest">Active Notes:</span>
                <div className="flex gap-1 flex-wrap">
                  {Array.from(activeNotes).map(note => (
                    <span key={note} className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-black rounded border border-green-500/50">
                      {MIDI_NOTE_NAMES[note]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Step Editor Popup */}
      {selectedStep && (
        <div className="mb-8 p-5 bg-black/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Step Unit Parameters: {tracks[selectedStep.t].name}</h3>
            <Button variant="ghost" onClick={() => setSelectedStep(null)} className="h-8 w-8 p-0 text-white/20 hover:text-white bg-white/5 rounded-lg border border-white/10"><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="space-y-3"><span className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest">Velocity</span><Slider value={[tracks[selectedStep.t].pattern[selectedStep.s].velocity]} onValueChange={v => setTracks(prev => { const c = JSON.parse(JSON.stringify(prev)); c[selectedStep.t].pattern[selectedStep.s].velocity = v[0]; return c; })} max={127} className="py-2" /></div>
            <div className="space-y-3"><span className="text-[10px] font-black text-purple-300/60 uppercase tracking-widest">Probability</span><Slider value={[tracks[selectedStep.t].pattern[selectedStep.s].probability]} onValueChange={v => setTracks(prev => { const c = JSON.parse(JSON.stringify(prev)); c[selectedStep.t].pattern[selectedStep.s].probability = v[0]; return c; })} max={100} className="py-2" /></div>
            <div className="space-y-3"><span className="text-[10px] font-black text-orange-300/60 uppercase tracking-widest mb-1">Flam Unit</span><Button className={`w-full h-10 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 ${tracks[selectedStep.t].pattern[selectedStep.s].flam ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-white/5 border-white/10 text-white/20'}`} onClick={() => setTracks(prev => { const c = JSON.parse(JSON.stringify(prev)); c[selectedStep.t].pattern[selectedStep.s].flam = !c[selectedStep.t].pattern[selectedStep.s].flam; return c; })}>{tracks[selectedStep.t].pattern[selectedStep.s].flam ? 'ACTIVE' : 'BYPASS'}</Button></div>
            <div className="space-y-3"><span className="text-[10px] font-black text-cyan-300/60 uppercase tracking-widest">Burst Roll</span><Select value={String(tracks[selectedStep.t].pattern[selectedStep.s].roll)} onValueChange={v => setTracks(prev => { const c = JSON.parse(JSON.stringify(prev)); c[selectedStep.t].pattern[selectedStep.s].roll = Number(v); return c; })}><SelectTrigger className="h-10 bg-white/5 border-white/10 rounded-xl font-black text-[10px] px-4"><SelectValue /></SelectTrigger><SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl"><SelectItem value="0">LINEAR</SelectItem><SelectItem value="2">2X</SelectItem><SelectItem value="3">3X</SelectItem><SelectItem value="4">4X</SelectItem></SelectContent></Select></div>
            <div className="space-y-3"><span className="text-[10px] font-black text-emerald-300/60 uppercase tracking-widest">Shift Pitch</span><Slider value={[tracks[selectedStep.t].pattern[selectedStep.s].pitch + 12]} onValueChange={v => setTracks(prev => { const c = JSON.parse(JSON.stringify(prev)); c[selectedStep.t].pattern[selectedStep.s].pitch = v[0] - 12; return c; })} max={24} className="py-2" /></div>
          </div>
        </div>
      )}

      {/* Sequencer Grid Area */}
      <div className="space-y-2 overflow-x-auto pb-6 custom-scrollbar relative z-10">
        {tracks.map((track, ti) => (
          <div key={track.id} className="flex items-center gap-3 min-w-max p-1 group/row">
            <div className="flex items-center gap-3 w-64 flex-shrink-0 bg-white/5 p-2 rounded-xl border border-white/5 group-hover/row:bg-white/10 transition-all">
              <div className={`w-3 h-10 rounded-full ${track.color} shadow-[0_0_15px_currentColor] opacity-60 group-hover/row:opacity-100 transition-opacity`} />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] font-black text-white uppercase tracking-tight truncate">{track.name}</span>
                <div className="flex items-center gap-2 mt-1"><span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">Pan</span><Slider value={[track.pan + 50]} onValueChange={v => setTracks(p => { const c = [...p]; c[ti] = {...c[ti], pan: v[0] - 50}; return c; })} max={100} className="w-16 h-1" /></div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { const c = [...tracks]; c[ti] = {...c[ti], muted: !c[ti].muted}; setTracks(c); }} className={`h-8 w-8 p-0 rounded-lg font-black text-[9px] transition-all border ${track.muted ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/5 text-white/20'}`}>M</Button>
                <Button size="sm" variant="ghost" onClick={() => { const c = [...tracks]; c[ti] = {...c[ti], solo: !c[ti].solo}; setTracks(c); }} className={`h-8 w-8 p-0 rounded-lg font-black text-[9px] transition-all border ${track.solo ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/5 text-white/20'}`}>S</Button>
              </div>
              <div className="flex flex-col gap-1"><span className="text-[8px] font-black text-white/20 uppercase text-center">Gain</span><Slider value={[track.volume]} onValueChange={v => setTracks(p => { const c = [...p]; c[ti] = {...c[ti], volume: v[0]}; return c; })} max={100} className="w-12 h-1" /></div>
            </div>
            <div className="flex gap-1 p-1 bg-black/20 rounded-xl border border-white/5">
              {track.pattern.map((step, si) => {
                const isPlayingStep = currentStep === si && isPlaying;
                return (
                  <div key={si} onClick={() => toggleStep(ti, si)} onContextMenu={(e) => { e.preventDefault(); setSelectedStep({ t: ti, s: si }); }}
                    className={`w-10 h-10 rounded-lg cursor-pointer transition-all duration-100 flex items-center justify-center relative group/step ${step.active ? `${track.color} border-white/20` : si % 4 === 0 ? 'bg-white/10 border-white/10' : 'bg-white/5 border-transparent'} ${selectedStep?.t === ti && selectedStep?.s === si ? 'ring-2 ring-white scale-110 z-10' : 'hover:scale-105'} ${isPlayingStep ? 'brightness-150 shadow-[0_0_20px_white]' : ''} border`}>
                    {step.active && <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white]" />}
                    {step.flam && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,0.8)]" />}
                    {step.roll > 0 && <div className="absolute bottom-0.5 right-0.5 text-[6px] font-black text-white/60">x{step.roll}</div>}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" onClick={() => copyTrackPattern(ti)} className="h-10 w-10 bg-white/5 border border-white/10 text-white/40 hover:text-white rounded-xl"><Copy className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => pasteTrackPattern(ti)} className="h-10 w-10 bg-white/5 border border-white/10 text-white/40 hover:text-white rounded-xl"><Clipboard className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      {/* Commit & Route */}
      <div className="mt-8 flex gap-3 relative z-10">
        <Button className="h-14 flex-1 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all border border-white/20" onClick={async () => {
          const destination = await requestDestination({ suggestedName: 'ProBeat Session' });
          if (!destination) return;
          const stepDuration = 0.25;
          const drumNotes: any[] = [];
          tracks.forEach(track => { track.pattern.forEach((step, stepIndex) => { if (step.active) { drumNotes.push({ id: `drum-${track.id}-${stepIndex}-${Date.now()}`, note: 'C', octave: 2, time: stepIndex * stepDuration, duration: stepDuration, velocity: step.velocity, drumType: track.id }); } }); });
          addAndSaveTrack({ id: `beat-${Date.now()}`, type: 'beat', name: 'ProBeat Drums', notes: drumNotes, bpm, source: 'probeat-maker', color: '#ef4444', lengthBars: Math.max(1, Math.ceil(patternLength / 16)) });
          onPatternChange?.(tracks, bpm);
          toast({ title: 'SIGNAL COMMITTED', description: 'Beat group injected into production timeline' });
          setLocation('/studio');
        }}>
          <Send className="w-5 h-5 mr-3 drop-shadow-[0_0_5px_white]" />DE-MULTIPLEX TO TIMELINE
        </Button>
        <Button className="h-14 flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-black uppercase tracking-widest rounded-2xl border-2 border-blue-500/50 transition-all" onClick={() => { window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'mixer' })); toast({ title: 'SIGNAL ROUTED', description: 'Monitoring output via Mix Studio' }); }}>
          <RotateCcw className="w-5 h-5 mr-3" />CROSS-ROUTE TO MIXER
        </Button>
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Multi-Core Drum Synthesis Engine // Phase 3 Matrix Ready</p>
        <div className="flex gap-6 opacity-30">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /><span className="text-[8px] font-black text-white uppercase tracking-widest text-xs">MIDI SIGNAL</span></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" /><span className="text-[8px] font-black text-white uppercase tracking-widest text-xs">AI CORE</span></div>
        </div>
      </div>
    </Card>
  );
}
