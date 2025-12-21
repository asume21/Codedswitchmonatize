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
import { DrumType, useAudio } from '@/hooks/use-audio';
import { audioEngine } from '@/lib/audioEngine';
import {
  Play, Square, RotateCcw, Undo2, Redo2, Shuffle, Send, ChevronDown, Wand2,
  Copy, Clipboard, Volume2, Disc, Zap, Timer,
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
  | 'fx';

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
  ride: 'crash',
  crash: 'crash',
  cowbell: 'fx',
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

type PadBinding = {
  note: number;
  trackId: string;
};

type MidiMessageDetail =
  | { kind: 'noteon'; note: number; velocity: number; channel: number; raw: number[] }
  | { kind: 'noteoff'; note: number; channel: number; raw: number[] }
  | { kind: 'cc'; cc: number; value: number; channel: number; raw: number[] }
  | { kind: 'pitchbend'; value14bit: number; semitones: number; channel: number; raw: number[] };

type SliderTarget = 'master' | 'swing' | 'groove' | 'humanize';

type CCBinding = {
  cc: number;
  channel: number | null;
};

type CCBindings = {
  master: CCBinding | null;
  swing: CCBinding | null;
  groove: CCBinding | null;
  humanize: CCBinding | null;
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
  const { playDrum, initialize } = useAudio();
  
  // Core state
  const [tracks, setTracks] = useState<DrumTrack[]>(() => {
    // Initialize with Hip-Hop preset so it sounds good on first load
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
  const [humanize, setHumanize] = useState(0); // Timing/velocity variation
  const [masterVol, setMasterVol] = useState(80);
  const [useRealisticDrums, setUseRealisticDrums] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [isRecordingArmed, setIsRecordingArmed] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStep, setSelectedStep] = useState<{t: number, s: number} | null>(null);
  const [history, setHistory] = useState<DrumTrack[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  
  // New features state
  const [selectedKit, setSelectedKit] = useState(DEFAULT_KIT);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [metronomeVol, setMetronomeVol] = useState(30); // 0-100
  const [copiedTrack, setCopiedTrack] = useState<DrumStep[] | null>(null);

  const [padBindings, setPadBindings] = useState<PadBinding[]>(() => {
    try {
      const raw = localStorage.getItem('proBeatMaker.padBindings.v1');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((v: any) => v && typeof v.note === 'number' && typeof v.trackId === 'string')
            .slice(0, 8) as PadBinding[];
          if (cleaned.length === 8) return cleaned;
        }
      }
    } catch {
      // ignore
    }

    const defaultNotes = [36, 37, 38, 39, 40, 41, 42, 43];
    const kit = DRUM_KITS[DEFAULT_KIT] || DRUM_KITS['808'];
    const ids = kit.tracks.map(t => t.id);
    return defaultNotes.map((note, i) => ({ note, trackId: ids[i] || 'kick' }));
  });
  const [padLearnIndex, setPadLearnIndex] = useState<number | null>(null);

  const [ccBindings, setCcBindings] = useState<CCBindings>(() => {
    try {
      const raw = localStorage.getItem('proBeatMaker.ccBindings.v1');
      if (raw) {
        const parsed = JSON.parse(raw) as any;

        const normalize = (value: any, fallback: CCBinding | null): CCBinding | null => {
          if (value && typeof value.cc === 'number') {
            return {
              cc: value.cc,
              channel: typeof value.channel === 'number' ? value.channel : null,
            };
          }
          if (typeof value === 'number') {
            return { cc: value, channel: null };
          }
          return fallback;
        };

        return {
          master: normalize(parsed.master, { cc: 7, channel: 0 }),
          swing: normalize(parsed.swing, { cc: 7, channel: 1 }),
          groove: normalize(parsed.groove, { cc: 7, channel: 2 }),
          humanize: normalize(parsed.humanize, { cc: 7, channel: 3 }),
        };
      }
    } catch {
      // ignore
    }

    return {
      master: { cc: 7, channel: 0 },
      swing: { cc: 7, channel: 1 },
      groove: { cc: 7, channel: 2 },
      humanize: { cc: 7, channel: 3 },
    };
  });
  const [ccLearnTarget, setCcLearnTarget] = useState<SliderTarget | null>(null);
  const [midiMappingOpen, setMidiMappingOpen] = useState(false);
  
  // Tap tempo state
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapCount, setTapCount] = useState(0); // For UI feedback
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // AI Generation state
  const [aiProvider, setAiProvider] = useState('grok');
  const [selectedGenre, setSelectedGenre] = useState('Hip-Hop');
  const [aiMelodySummary, setAiMelodySummary] = useState<string | null>(null);
  const [aiBassSummary, setAiBassSummary] = useState<string | null>(null);
  const [lastDrumsGenMethod, setLastDrumsGenMethod] = useState<'ai' | 'algorithmic' | null>(null);
  const [lastMelodyGenMethod, setLastMelodyGenMethod] = useState<'ai' | 'algorithmic' | null>(null);
  const [lastBassGenMethod, setLastBassGenMethod] = useState<'ai' | 'algorithmic' | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('proBeatMaker.padBindings.v1', JSON.stringify(padBindings));
    } catch {
      // ignore
    }
  }, [padBindings]);

  useEffect(() => {
    try {
      localStorage.setItem('proBeatMaker.ccBindings.v1', JSON.stringify(ccBindings));
    } catch {
      // ignore
    }
  }, [ccBindings]);
  
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
            volume: 0.8,
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
            volume: 0.8,
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
    return () => { audioCtx.current?.close(); };
  }, []);

  const triggerDrumAudition = useCallback((trackId: string, velocity0to127: number) => {
    const drumType = (DRUM_ID_TO_TYPE[trackId] || 'kick') as DrumEngineType;
    const vol = Math.max(0, Math.min(1, velocity0to127 / 127));
    playDrum(toUnifiedDrumType(drumType), vol);
  }, [playDrum, toUnifiedDrumType]);

  const stepBackward = useCallback(() => {
    setCurrentStep(prev => {
      const len = Math.max(1, patternLength);
      return (prev - 1 + len) % len;
    });
  }, [patternLength]);

  const stepForward = useCallback(() => {
    setCurrentStep(prev => {
      const len = Math.max(1, patternLength);
      return (prev + 1) % len;
    });
  }, [patternLength]);

  const stopTransport = useCallback(() => {
    setIsPlaying(false);
    setIsRecordingArmed(false);
    setCurrentStep(0);
  }, []);

  const playTransport = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const togglePlayStop = useCallback(() => {
    setIsPlaying(prev => {
      if (prev) {
        setIsRecordingArmed(false);
        setCurrentStep(0);
        return false;
      }
      return true;
    });
  }, []);

  const toggleRecord = useCallback(() => {
    setIsRecordingArmed(prev => {
      const next = !prev;
      if (next) {
        setIsPlaying(true);
      }
      return next;
    });
  }, []);

  const toggleLoop = useCallback(() => {
    setLoopEnabled(v => !v);
  }, []);

  const writeHitToGrid = useCallback((trackId: string, stepIndex: number, velocity0to127: number) => {
    setTracks(prev => {
      const trackIdx = prev.findIndex(t => t.id === trackId);
      if (trackIdx < 0) return prev;
      const next = [...prev];
      const t = next[trackIdx];
      const step = t.pattern[stepIndex];
      if (!step) return prev;
      const vel = Math.max(1, Math.min(127, Math.round(velocity0to127)));
      const updatedStep: DrumStep = {
        ...step,
        active: true,
        velocity: vel,
      };
      const updatedPattern = t.pattern.map((s, i) => (i === stepIndex ? updatedStep : s));
      next[trackIdx] = { ...t, pattern: updatedPattern };
      return next;
    });
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

  const toUnifiedDrumType = useCallback((drum: DrumEngineType): DrumType => {
    switch (drum) {
      case 'kick':
        return 'kick';
      case 'snare':
        return 'snare';
      case 'clap':
        return 'clap';
      case 'hihat':
      case 'openhat':
        return 'hihat';
      case 'tom':
      case 'tom_hi':
      case 'tom_mid':
      case 'tom_lo':
      case 'conga':
      case 'perc':
      case 'rim':
        return 'tom';
      case 'crash':
      case 'fx':
      default:
        return 'crash';
    }
  }, []);

  const playSound = useCallback(async (id: string, vel: number, vol: number) => {
    const normalizedId = id.toLowerCase();
    const drumType = DRUM_ID_TO_TYPE[normalizedId] || 'snare';

    // When using the realistic engine, delegate to realisticAudio
    if (useRealisticDrums) {
      const baseVelocity = (vel / 127) * (vol / 100) * (masterVol / 100);
      const normalizedVelocity = Math.max(0, Math.min(1, baseVelocity));

      await initialize();
      playDrum(toUnifiedDrumType(drumType), normalizedVelocity);
      return;
    }

    // Classic internal synth path
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioCtx.current;
    if (ctx.state === 'suspended') await ctx.resume();
    const gain = ctx.createGain();
    gain.gain.value = (vel / 127) * (vol / 100) * (masterVol / 100);
    gain.connect(ctx.destination);

    switch (drumType) {
      case 'kick': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(150, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(1, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + 0.3);
        break;
      }
      case 'snare':
      case 'clap': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
        const s = ctx.createBufferSource(); s.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(1, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        s.connect(g); g.connect(gain); s.start(); s.stop(ctx.currentTime + 0.15);
        break;
      }
      case 'hihat': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
        s.connect(f); f.connect(gain); s.start(); s.stop(ctx.currentTime + 0.05);
        break;
      }
      case 'openhat': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.2);
        const s = ctx.createBufferSource(); s.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
        s.connect(f); f.connect(gain); s.start(); s.stop(ctx.currentTime + 0.25);
        break;
      }
      case 'tom': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(220, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.9, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + 0.35);
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
  }, [initialize, masterVol, playDrum, toUnifiedDrumType, useRealisticDrums]);

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

      const next = currentStep + 1;
      const len = Math.max(1, patternLength);
      if (!loopEnabled && next >= len) {
        stopTransport();
        return;
      }
      setCurrentStep(next % len);
    }, ms);
    
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [isPlaying, currentStep, tracks, bpm, swing, groove, patternLength, playSound, loopEnabled, stopTransport]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<MidiMessageDetail>;
      const detail = ev.detail;
      if (!detail) return;

      const handleTransportCommand = (code: number) => {
        switch (code) {
          case 14:
            stepBackward();
            return true;
          case 15:
            stepForward();
            return true;
          case 16:
            stopTransport();
            return true;
          case 17:
            playTransport();
            return true;
          case 18:
            toggleRecord();
            return true;
          case 19:
            toggleLoop();
            return true;
          default:
            return false;
        }
      };

      if (detail.kind === 'noteon') {
        if (handleTransportCommand(detail.note)) {
          ev.preventDefault();
          return;
        }

        if (padLearnIndex !== null) {
          ev.preventDefault();
          const nextNote = detail.note;
          setPadBindings(prev => prev.map((b, i) => (i === padLearnIndex ? { ...b, note: nextNote } : b)));
          setPadLearnIndex(null);
          toast({ title: '✅ Pad Learned', description: `Pad ${padLearnIndex + 1} mapped to MIDI note ${nextNote}` });
          return;
        }

        const binding = padBindings.find(b => b.note === detail.note);
        if (!binding) return;

        ev.preventDefault();

        if (isPlaying) {
          const stepIndex = currentStep % patternLength;
          writeHitToGrid(binding.trackId, stepIndex, detail.velocity);
        } else {
          triggerDrumAudition(binding.trackId, detail.velocity);
        }
      }

      if (detail.kind === 'cc') {
        if (detail.value > 0 && handleTransportCommand(detail.cc)) {
          ev.preventDefault();
          return;
        }

        if (ccLearnTarget) {
          const learned = detail.cc;
          setCcBindings(prev => ({
            ...prev,
            [ccLearnTarget]: { cc: learned, channel: detail.channel },
          }));
          const label = ccLearnTarget === 'master'
            ? 'Master'
            : ccLearnTarget === 'swing'
              ? 'Swing'
              : ccLearnTarget === 'groove'
                ? 'Groove'
                : 'Humanize';
          setCcLearnTarget(null);
          toast({ title: '✅ Slider Learned', description: `${label} mapped to CC${learned}` });
          return;
        }

        const pct0to100 = Math.max(0, Math.min(100, Math.round((detail.value / 127) * 100)));

        const matches = (binding: CCBinding | null) => {
          if (!binding) return false;
          if (binding.cc !== detail.cc) return false;
          if (binding.channel === null) return true;
          return binding.channel === detail.channel;
        };

        if (matches(ccBindings.master)) {
          setMasterVol(pct0to100);
          return;
        }
        if (matches(ccBindings.swing)) {
          setSwing(pct0to100);
          return;
        }
        if (matches(ccBindings.groove)) {
          setGroove(pct0to100);
          return;
        }
        if (matches(ccBindings.humanize)) {
          setHumanize(pct0to100);
          return;
        }
      }
    };

    window.addEventListener('midi-message', handler as EventListener);
    return () => window.removeEventListener('midi-message', handler as EventListener);
  }, [
    ccBindings,
    ccLearnTarget,
    currentStep,
    isPlaying,
    padBindings,
    padLearnIndex,
    patternLength,
    playTransport,
    stepBackward,
    stepForward,
    stopTransport,
    toast,
    toggleLoop,
    toggleRecord,
    triggerDrumAudition,
    writeHitToGrid,
  ]);

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
  const playClick = useCallback(async () => {
    if (!metronomeOn) return;
    await initialize();
    const vol = (metronomeVol / 100) * 0.3;
    audioEngine.playMetronomeClick(currentStep % 4 === 0, vol);
  }, [currentStep, initialize, metronomeOn, metronomeVol]);

  // Play metronome on each step
  useEffect(() => {
    if (isPlaying && metronomeOn) {
      void playClick();
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
        </div>
      </div>

      {/* Transport & Controls - Row 1 */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Button onClick={togglePlayStop}
          className={isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}>
          {isPlaying ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
          {isPlaying ? 'Stop' : 'Play'}
        </Button>

        <Button
          variant={isRecordingArmed ? 'default' : 'outline'}
          onClick={toggleRecord}
          className={isRecordingArmed ? 'bg-red-700 hover:bg-red-600' : ''}
        >
          Rec
        </Button>

        <Button
          variant={loopEnabled ? 'default' : 'outline'}
          onClick={toggleLoop}
          className={loopEnabled ? 'bg-blue-700 hover:bg-blue-600' : ''}
        >
          Loop
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

        <div className="flex items-center gap-2 border-l border-gray-600 pl-2">
          <Button
            size="sm"
            variant={midiMappingOpen ? 'default' : 'outline'}
            className="text-xs"
            onClick={() => setMidiMappingOpen(v => !v)}
          >
            MIDI Learn
          </Button>
          {(padLearnIndex !== null || ccLearnTarget !== null) && (
            <Badge variant="secondary" className="text-xs">
              Listening…
            </Badge>
          )}
        </div>
      </div>

      {midiMappingOpen && (
        <div className="mb-4 p-3 bg-gray-900/60 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-200">MIDI Mapping</div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => {
                  setPadLearnIndex(null);
                  setCcLearnTarget(null);
                }}
              >
                Cancel Learn
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => {
                  try {
                    localStorage.removeItem('proBeatMaker.padBindings.v1');
                    localStorage.removeItem('proBeatMaker.ccBindings.v1');
                  } catch {
                    // ignore
                  }
                  const defaultNotes = [36, 37, 38, 39, 40, 41, 42, 43];
                  const ids = tracks.map(t => t.id);
                  setPadBindings(defaultNotes.map((note, i) => ({ note, trackId: ids[i] || 'kick' })));
                  setCcBindings({
                    master: { cc: 7, channel: 0 },
                    swing: { cc: 7, channel: 1 },
                    groove: { cc: 7, channel: 2 },
                    humanize: { cc: 7, channel: 3 },
                  });
                  setPadLearnIndex(null);
                  setCcLearnTarget(null);
                  toast({ title: 'Reset MIDI Mappings', description: 'Restored defaults.' });
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-gray-400">Pads (Note On)</div>
              {padBindings.map((b, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={padLearnIndex === idx ? 'default' : 'outline'}
                    className="text-xs w-24"
                    onClick={() => {
                      setCcLearnTarget(null);
                      setPadLearnIndex(idx);
                    }}
                  >
                    Learn Pad {idx + 1}
                  </Button>
                  <div className="text-xs text-gray-300 w-16">Note {b.note}</div>
                  <Select
                    value={b.trackId}
                    onValueChange={(v) => setPadBindings(prev => prev.map((p, i) => (i === idx ? { ...p, trackId: v } : p)))}
                  >
                    <SelectTrigger className="h-8 w-40 bg-gray-800 border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {tracks.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="text-[11px] text-gray-500">Stopped = audition. Playing = write to grid at current step.</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-400">Sliders / Rollers (CC)</div>
              <div className="space-y-2">
                {([
                  { key: 'master' as const, label: 'Master' },
                  { key: 'swing' as const, label: 'Swing' },
                  { key: 'groove' as const, label: 'Groove' },
                  { key: 'humanize' as const, label: 'Humanize' },
                ]).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={ccLearnTarget === key ? 'default' : 'outline'}
                      className="text-xs w-24"
                      onClick={() => {
                        setPadLearnIndex(null);
                        setCcLearnTarget(key);
                      }}
                    >
                      Learn {label}
                    </Button>
                    <div className="text-xs text-gray-300 w-20">
                      {ccBindings[key] === null
                        ? 'Unmapped'
                        : `CC${ccBindings[key]!.cc} Ch${(ccBindings[key]!.channel ?? 0) + 1}`}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setCcBindings(prev => ({ ...prev, [key]: null }))}
                      disabled={ccBindings[key] === null}
                    >
                      Clear
                    </Button>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-gray-500">Tip: click Learn, then move the slider/roller on your DMK 25 Pro.</div>
            </div>
          </div>
        </div>
      )}
      
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
      </div>

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
            <div className="flex items-center gap-1 w-44 flex-shrink-0">
              <div className={`w-3 h-3 rounded ${track.color}`} />
              <span
                className="text-xs font-medium text-white flex-1"
                title={track.name}
              >
                {track.name}
              </span>
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
              {track.pattern.map((step, si) => (
                <button key={si} onClick={() => toggleStep(ti, si)}
                  className={`w-7 h-7 rounded text-xs font-bold transition-all relative
                    ${step.active ? `${track.color} text-white shadow-lg` : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}
                    ${currentStep === si && isPlaying ? 'ring-2 ring-yellow-400 scale-110' : ''}
                    ${selectedStep?.t === ti && selectedStep?.s === si ? 'ring-2 ring-blue-400' : ''}
                    ${si % 4 === 0 ? 'ml-1' : ''}`}>
                  {si + 1}
                  {/* Flam indicator */}
                  {step.flam && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" />}
                  {/* Roll indicator */}
                  {step.roll > 0 && <span className="absolute -bottom-1 -right-1 text-[8px] bg-cyan-500 rounded px-0.5">{step.roll}x</span>}
                </button>
              ))}
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
        <Button className="bg-green-600 hover:bg-green-500" onClick={() => {
          // Convert tracks to pattern format
          const pattern: Record<string, boolean[]> = {};
          tracks.forEach(t => {
            pattern[t.id] = t.pattern.map(s => s.active);
          });
          
          // Send to parent component
          onPatternChange?.(tracks, bpm);
          
          // Central communication - dispatch event for Multi-Track Player
          const event = new CustomEvent('openStudioTool', {
            detail: { tool: 'multitrack', data: { pattern, bpm, type: 'beat' } }
          });
          window.dispatchEvent(event);
          
          // Also send to timeline directly
          const timelineEvent = new CustomEvent('addBeatToTimeline', {
            detail: { pattern, bpm, tracks }
          });
          window.dispatchEvent(timelineEvent);
          
          toast({ title: '✅ Pattern Sent', description: 'Beat sent to timeline & Multi-Track' });
        }}>
          <Send className="w-4 h-4 mr-1" />Send to Timeline
        </Button>
        
        <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => {
          // Route to Mixer
          const event = new CustomEvent('openStudioTool', {
            detail: { tool: 'mixer', data: { tracks, bpm, type: 'beat' } }
          });
          window.dispatchEvent(event);
          toast({ title: '🎛️ Routed to Mixer', description: 'Beat sent to Mix Studio' });
        }}>
          <RotateCcw className="w-4 h-4 mr-1" />Route to Mixer
        </Button>
      </div>
    </Card>
  );
}
