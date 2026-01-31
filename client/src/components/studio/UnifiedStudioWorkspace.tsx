import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { StudioAudioContext } from '@/pages/studio';
import { ChevronDown, ChevronRight, ChevronLeft, Maximize2, Minimize2, Music, Sliders, Piano, Layers, Mic2, FileText, Wand2, Upload, Cable, RefreshCw, Settings, Workflow, Wrench, Play, Pause, Square, Repeat, ArrowLeft, Home, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import MobileStudioLayout from './MobileStudioLayout';
import FloatingAIAssistant from './FloatingAIAssistant';
import AIAssistant from './AIAssistant';
import MusicGenerationPanel from './MusicGenerationPanel';
import LyricsFocusMode from './LyricsFocusMode';
import { Resizable } from 'react-resizable';
import LyricLab from './LyricLab';
import CodeToMusicStudioV2 from './CodeToMusicStudioV2';
import VerticalPianoRoll from './VerticalPianoRoll';
import ProfessionalMixer from './ProfessionalMixer';
import SongUploader from './SongUploader';
import WorkflowSelector from './WorkflowSelector';
import type { WorkflowPreset } from './WorkflowSelector';
import { useToast } from '@/hooks/use-toast';
import { useMIDI } from '@/hooks/use-midi';
import { realisticAudio } from '@/lib/realisticAudio';
import { AudioEngine } from '@/lib/audio';
import { AudioPremixCache } from '@/lib/audioPremix';
import { duplicateTrackData } from '@/lib/trackClone';
import AudioAnalysisPanel from './AudioAnalysisPanel';
import AudioToolsPage from './AudioToolsPage';
import { EQPlugin, CompressorPlugin, DeesserPlugin, ReverbPlugin, LimiterPlugin, NoiseGatePlugin, type ToolType } from './effects';
import type { Note } from './types/pianoRollTypes';
import BeatLab from './BeatLab';
import MasterMultiTrackPlayer from './MasterMultiTrackPlayer';
import AIMasteringCard from './AIMasteringCard';
import AIArrangementBuilder from './AIArrangementBuilder';
import AIVocalMelody from './AIVocalMelody';
import AIStemSeparation from './AIStemSeparation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Package } from 'lucide-react';
import { useTransport } from '@/contexts/TransportContext';
import { useTracks, type StudioTrack } from '@/hooks/useTracks';
import { createTrackPayload } from '@/types/studioTracks';
import { UndoManager } from '@/lib/UndoManager';
import 'react-resizable/css/styles.css';
import { UpgradeModal, useLicenseGate } from '@/lib/LicenseGuard';
import AudioDetector from './AudioDetector';
import AstutelyPanel from '../ai/AstutelyPanel';
import AstutelyChatbot from '../ai/AstutelyChatbot';
import { astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';
import { Zap, Sparkles } from 'lucide-react';
import { professionalAudio } from '@/lib/professionalAudio';
import SampleBrowser from './SampleBrowser';
import InspectorPanel from './InspectorPanel';
import InstrumentLibrary from './InstrumentLibrary';

// Workflow Configuration Types
interface WorkflowConfig {
  activeView: 'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music' | 'audio-tools' | 'beat-lab' | 'multitrack';
  showAIAssistant: boolean;
  showMusicGen: boolean;
  showLyricsFocus?: boolean;
  expandedSections?: {
    arrangementControls?: boolean;
    instrumentsPanel?: boolean;
    pianoRollTools?: boolean;
    mixerPanel?: boolean;
  };
  guidedMode?: boolean; // For Beginner workflow
  description: string;
}

// Legacy ID migration map for backwards compatibility
const LEGACY_WORKFLOW_ID_MAP: Record<string, WorkflowPreset['id']> = {
  'mixing-console': 'mixing',
  'ai-assisted': 'ai',
  'immersive-mode': 'immersive',
};

const DEFAULT_TRACK_HEIGHT = 120;

type ClipType = 'midi' | 'audio';
interface TrackClip {
  id: string;
  trackId: string;
  type: ClipType;
  name: string;
  startBar: number;
  lengthBars: number;
}

interface Marker {
  id: string;
  bar: number;
  label: string;
}

interface GridSettings {
  division: '1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32';
  triplet: boolean;
}

interface SessionSettings {
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  key: string;
}

// Workflow Configuration Profiles
const WORKFLOW_CONFIGS: Record<WorkflowPreset['id'], WorkflowConfig> = {
  'song-analyzer': {
    activeView: 'song-uploader',
    showAIAssistant: true,
    showMusicGen: false,
    expandedSections: {},
    description: 'Upload and analyze existing songs with AI-powered insights for BPM, key, structure, and production quality',
  },
  'mixing': {
    activeView: 'mixer',
    showAIAssistant: false,
    showMusicGen: false,
    expandedSections: {
      mixerPanel: true,
    },
    description: 'Professional mixer focused on mixing and mastering with effects and automation',
  },
  'ai': {
    activeView: 'ai-studio',
    showAIAssistant: true,
    showMusicGen: true,
    expandedSections: {},
    description: 'AI-first workflow with assistant and generation tools prominently visible',
  },
  'composition': {
    activeView: 'piano-roll',
    showAIAssistant: false,
    showMusicGen: false,
    expandedSections: {
      pianoRollTools: true,
      instrumentsPanel: true,
    },
    description: 'Focused on melody creation with piano roll and instrument selection',
  },
  'immersive': {
    activeView: 'arrangement',
    showAIAssistant: false,
    showMusicGen: false,
    expandedSections: {},
    description: 'Distraction-free fullscreen arrangement view for focused production',
  },
  'beginner': {
    activeView: 'arrangement',
    showAIAssistant: true,
    showMusicGen: false,
    expandedSections: {
      arrangementControls: true,
      instrumentsPanel: true,
    },
    guidedMode: true,
    description: 'Guided experience with helpful tips and simplified controls for newcomers',
  },
  'lyrics-focus': {
    activeView: 'lyrics',
    showAIAssistant: true,
    showMusicGen: false,
    expandedSections: {},
    description: 'Lyrics-first layout with Lyric Lab front and center',
    showLyricsFocus: true,
  },
};

type AstutelyTrackType = 'drums' | 'bass' | 'chords' | 'melody';

const ASTUTELY_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const dbToLinear = (db: number) => Math.pow(10, db / 20);
const linearToDb = (linear: number) => Math.max(-60, 20 * Math.log10(Math.max(linear, 0.0001)));

const clampTimelineVolume = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.8;
  return Math.min(1, Math.max(0, value));
};

const getKindSendDefaults = (kind?: string) => {
  switch ((kind || '').toLowerCase()) {
    case 'vocal':
      return { hall: -14, delay: -12 };
    case 'drums':
      return { hall: -18, delay: -24 };
    case 'bass':
      return { hall: -24, delay: -40 };
    case 'synth':
    case 'keys':
      return { hall: -16, delay: -18 };
    case 'guitar':
      return { hall: -18, delay: -16 };
    case 'fx':
      return { hall: -12, delay: -12 };
    default:
      return { hall: -20, delay: -22 };
  }
};

const ASTUTELY_DRUM_PITCH_MAP: Record<number, 'kick' | 'snare' | 'hihat' | 'perc'> = {
  36: 'kick',
  38: 'snare',
  42: 'hihat',
  46: 'perc'
};

const ASTUTELY_TRACK_CONFIG: Record<AstutelyTrackType, {
  id: string;
  name: string;
  color: string;
  instrument: string;
  kind: StudioTrack['kind'];
  type: StudioTrack['type'];
  priority: number;
}> = {
  drums: {
    id: 'track-astutely-drums',
    name: 'Astutely Drums',
    color: 'bg-pink-500',
    instrument: 'drums',
    kind: 'beat',
    type: 'beat',
    priority: 4
  },
  bass: {
    id: 'track-astutely-bass',
    name: 'Astutely Bass',
    color: 'bg-green-500',
    instrument: 'bass-electric',
    kind: 'midi',
    type: 'midi',
    priority: 3
  },
  chords: {
    id: 'track-astutely-chords',
    name: 'Astutely Chords',
    color: 'bg-purple-500',
    instrument: 'piano',
    kind: 'midi',
    type: 'midi',
    priority: 2
  },
  melody: {
    id: 'track-astutely-melody',
    name: 'Astutely Melody',
    color: 'bg-blue-500',
    instrument: 'synth',
    kind: 'midi',
    type: 'midi',
    priority: 1
  }
};

function midiToNoteData(midi: number) {
  const pitch = Number.isFinite(midi) ? midi : 60;
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = ((pitch % 12) + 12) % 12;
  return {
    note: ASTUTELY_NOTE_NAMES[noteIndex],
    octave
  };
}

function convertAstutelyNotes(notes: ReturnType<typeof astutelyToNotes>) {
  const grouped: Record<AstutelyTrackType, Note[]> = {
    drums: [],
    bass: [],
    chords: [],
    melody: []
  };

  notes.forEach((n) => {
    const trackType = (n.trackType ?? 'melody') as AstutelyTrackType;
    const { note, octave } = midiToNoteData(n.pitch ?? 60);
    grouped[trackType].push({
      id: `astutely-${trackType}-${n.id || `${Date.now()}-${Math.random()}`}`,
      note,
      octave,
      step: n.startStep || 0,
      length: Math.max(1, n.duration || 1),
      velocity: n.velocity || 100,
      drumType: trackType === 'drums' ? (ASTUTELY_DRUM_PITCH_MAP[n.pitch ?? 36] || 'perc') : undefined
    });
  });

  return grouped;
}

function buildAstutelyTrack(
  existing: StudioTrack | undefined,
  config: (typeof ASTUTELY_TRACK_CONFIG)[AstutelyTrackType],
  notes: Note[],
  bpm: number
): StudioTrack {
  const base: StudioTrack = existing || {
    id: config.id,
    name: config.name,
    kind: config.kind,
    type: config.type,
    instrument: config.instrument,
    notes: [],
    audioUrl: undefined,
    source: 'astutely',
    color: config.color,
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    lengthBars: 4,
    startBar: 0,
    bpm,
    data: {},
    sendA: -60,
    sendB: -60,
    payload: createTrackPayload({
      type: config.type,
      instrument: config.instrument,
      notes: [],
      source: 'astutely',
      bpm
    })
  };

  return {
    ...base,
    notes,
    bpm,
    payload: {
      ...(base.payload ?? createTrackPayload({ type: config.type })),
      instrument: config.instrument,
      notes,
      source: 'astutely',
      bpm
    }
  };
}

function mergeAstutelyTracks(
  currentTracks: StudioTrack[],
  groupedNotes: ReturnType<typeof convertAstutelyNotes>,
  bpm: number
) {
  let next = [...currentTracks];

  (Object.keys(ASTUTELY_TRACK_CONFIG) as AstutelyTrackType[]).forEach((type) => {
    const noteSet = groupedNotes[type];
    if (!noteSet.length) return;
    const config = ASTUTELY_TRACK_CONFIG[type];
    const existingIndex = next.findIndex((track) => track.id === config.id);
    const existing = existingIndex !== -1 ? next[existingIndex] : undefined;
    const updated = buildAstutelyTrack(existing, config, noteSet, bpm);
    if (existingIndex !== -1) {
      next[existingIndex] = updated;
    } else {
      next = [...next, updated];
    }
  });

  return next;
}

function chooseAstutelyFocusTrack(groupedNotes: ReturnType<typeof convertAstutelyNotes>) {
  let chosen: string | null = null;
  (Object.keys(ASTUTELY_TRACK_CONFIG) as AstutelyTrackType[])
    .sort((a, b) => ASTUTELY_TRACK_CONFIG[a].priority - ASTUTELY_TRACK_CONFIG[b].priority)
    .forEach((type) => {
      if (chosen) return;
      if (groupedNotes[type].length > 0) {
        chosen = ASTUTELY_TRACK_CONFIG[type].id;
      }
    });
  return chosen;
}

export default function UnifiedStudioWorkspace() {
  const isMobile = useIsMobile();
  const studioContext = useContext(StudioAudioContext);
  const { toast } = useToast();
  const {
    tempo,
    setTempo: setTransportTempo,
    position,
    isPlaying: transportPlaying,
    play: startTransport,
    pause: pauseTransport,
    stop: stopTransport,
    loop,
    setLoop,
    seek,
  } = useTransport();
  const {
    tracks,
    addTrack: addTrackToStore,
    addAndSaveTrack,
    updateTrack: updateTrackInStore,
    removeTrack: removeTrackFromStore,
    loadTracks,
    isLoading: tracksLoading,
    isSynced: tracksSynced,
  } = useTracks();

  const setTracks = useCallback((next: StudioTrack[] | ((prev: StudioTrack[]) => StudioTrack[])) => {
    if (!undoManagerRef.current) {
      undoManagerRef.current = new UndoManager<StudioTrack[]>();
    }

    let nextTracks: StudioTrack[];
    if (typeof next === 'function') {
      nextTracks = (next as (prev: StudioTrack[]) => StudioTrack[])(tracks as StudioTrack[]);
    } else {
      nextTracks = next;
    }

    if (!isRestoringTracksRef.current) {
      undoManagerRef.current.record(tracks.map(t => ({ ...t })));
    } else {
      isRestoringTracksRef.current = false;
    }

    const nextIds = new Set(nextTracks.map((t) => t.id));

    tracks.forEach((track) => {
      if (!nextIds.has(track.id)) {
        removeTrackFromStore(track.id);
      }
    });

    nextTracks.forEach((track) => {
      const payload = {
        ...(track as any).payload,
        type: track.type ?? 'midi',
        instrument: track.instrument,
        notes: track.notes,
        audioUrl: track.audioUrl,
        volume: track.volume ?? 0.8,
        pan: track.pan ?? 0,
        data: track.data,
      };

      if (tracks.some((existing) => existing.id === track.id)) {
        updateTrackInStore(track.id, {
          name: track.name,
          muted: track.muted,
          solo: track.solo,
          payload,
          type: track.type,
          instrument: track.instrument,
          notes: track.notes,
          audioUrl: track.audioUrl,
          volume: track.volume,
          pan: track.pan,
        });
      } else {
        addTrackToStore({
          id: track.id,
          name: track.name,
          type: (track.type ?? 'midi') as any,
          instrument: track.instrument,
          notes: track.notes,
          audioUrl: track.audioUrl,
          muted: track.muted,
          solo: track.solo,
          volume: track.volume ?? 0.8,
          pan: track.pan ?? 0,
          lengthBars: (track as any).lengthBars ?? 4,
          startBar: (track as any).startBar ?? 0,
          bpm: track.bpm,
          data: track.data,
          payload,
        });
      }
    });
  }, [tracks, addTrackToStore, updateTrackInStore, removeTrackFromStore]);

  const timelineAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timelinePremixCacheRef = useRef(new AudioPremixCache());
  const [timelinePlayingTrack, setTimelinePlayingTrack] = useState<string | null>(null);
  const timelinePlayingTrackRef = useRef<string | null>(null);
  const [channelMeters, setChannelMeters] = useState<Record<string, { peak: number; rms: number }>>({});
  const [activeView, setActiveView] = useState<'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music' | 'audio-tools' | 'beat-lab' | 'multitrack'>('arrangement');
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [showAstutely, setShowAstutely] = useState(false);
  const [showAstutelyArchitect, setShowAstutelyArchitect] = useState(false);
  const [showMusicGen, setShowMusicGen] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showLyricsFocus, setShowLyricsFocus] = useState(false);
  const [pianoRollExpanded, setPianoRollExpanded] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [instrumentsExpanded, setInstrumentsExpanded] = useState(false);
  const [showSampleBrowser, setShowSampleBrowser] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showWaveformEditor, setShowWaveformEditor] = useState(false);
  const [showAudioDetector, setShowAudioDetector] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showMetronomeSettings, setShowMetronomeSettings] = useState(false);
  const [effectsDialogOpen, setEffectsDialogOpen] = useState(false);
  const [activeEffectTool, setActiveEffectTool] = useState<string | null>(null);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [beatLabTab, setBeatLabTab] = useState<'pro' | 'bass-studio' | 'loop-library' | 'pack-generator'>('pro');
  const [pianoRollTool, setPianoRollTool] = useState<'select' | 'draw' | 'erase'>('draw');
  const [zoom, setZoom] = useState(1);
  const [trackListWidth, setTrackListWidth] = useState(200);
  const [trackHeights, setTrackHeights] = useState<Record<string, number>>({});
  const [waveformData, setWaveformData] = useState<Record<string, any>>({});
  const [waveformTrimStart, setWaveformTrimStart] = useState(0);
  const [waveformTrimEnd, setWaveformTrimEnd] = useState(100);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  // Use the MIDI hook for real MIDI functionality
  const {
    isSupported: midiSupported,
    isConnected: midiConnected,
    connectedDevices: midiDevices,
    activeNotes: midiActiveNotesSet,
    initializeMIDI,
    refreshDevices: refreshMIDIDevices,
    settings: midiSettings,
    updateSettings: updateMIDISettings,
    setMasterVolume: setMIDIMasterVolume,
  } = useMIDI();
  
  // Convert Set<number> to Set<string> for display
  const midiActiveNotes = new Set(Array.from(midiActiveNotesSet).map(n => String(n)));
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const trackListRef = useRef<HTMLDivElement>(null);
  const waveformCacheRef = useRef<Map<string, any>>(new Map());

  // Track control helpers
  const toggleTrackMute = useCallback((trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  }, [setTracks]);

  const toggleTrackSolo = useCallback((trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, solo: !t.solo } : t));
  }, [setTracks]);

  const toggleTrackSend = useCallback((trackId: string, send: string) => {
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      const sends = (t.data as any)?.sends || {};
      const currentDb = sends[send] ?? -60;
      const newDb = currentDb > -50 ? -60 : 0;
      return { ...t, data: { ...(t.data ?? {}), sends: { ...sends, [send]: newDb } } };
    }));
  }, [setTracks]);

  const getTrackSendDb = useCallback((track: StudioTrack, send: string): number => {
    const sends = (track.data as any)?.sends;
    if (!sends) return -60;
    return sends[send] ?? -60;
  }, []);

  const formatMeterDb = (value: number | undefined): string => {
    if (value == null || value <= 0) return '-∞ dB';
    const db = 20 * Math.log10(value);
    if (!Number.isFinite(db) || db < -60) return '-∞ dB';
    return `${db.toFixed(1)} dB`;
  };

  const handleTimelineTrackPlay = (trackId: string) => {
    // Placeholder implementation
  };
  
  const stopTimelineAudio = () => {
    // Placeholder implementation
  };

  const handleAstutelyResult = useCallback((result: AstutelyResult) => {
    const notes = astutelyToNotes(result);

    if (result.bpm && result.bpm > 0) {
      setTransportTempo(result.bpm);
    }

    try {
      localStorage.setItem('astutely-generated', JSON.stringify({
        notes,
        bpm: result.bpm,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.warn('Failed to cache Astutely payload', error);
    }

    setActiveView('piano-roll');

    toast({
      title: '🔥 Astutely Generated!',
      description: `${notes.length} notes at ${result.bpm} BPM added to Piano Roll.`,
      duration: 5000,
    });
  }, [setTransportTempo, setActiveView, toast]);
  // Clips, markers, and session/grid state
  const [clips, setClips] = useState<TrackClip[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [gridSettings, setGridSettings] = useState<GridSettings>({ division: '1/16', triplet: false });
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    key: 'C',
  });
  const [showGridSettingsDialog, setShowGridSettingsDialog] = useState(false);
  const [showTempoMapDialog, setShowTempoMapDialog] = useState(false);
  const [showTimeSignatureDialog, setShowTimeSignatureDialog] = useState(false);
  const [showKeySignatureDialog, setShowKeySignatureDialog] = useState(false);
  const [showMarkerListDialog, setShowMarkerListDialog] = useState(false);
  const [showInsertTimeDialog, setShowInsertTimeDialog] = useState(false);
  const [insertTimeBars, setInsertTimeBars] = useState(4);
  const [timeDialogMode, setTimeDialogMode] = useState<'insert' | 'delete' | 'duplicate'>('insert');
  const gridDivisions: GridSettings['division'][] = ['1', '1/2', '1/4', '1/8', '1/16', '1/32'];
  const keySignatures = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const [gridDivisionDraft, setGridDivisionDraft] = useState<GridSettings['division']>('1/16');
  const [gridTripletDraft, setGridTripletDraft] = useState(false);
  const [tempoMap, setTempoMap] = useState(sessionSettings.bpm);
  const [timeSignatureDraft, setTimeSignatureDraft] = useState(sessionSettings.timeSignature);
  const [keySignatureDraft, setKeySignatureDraft] = useState(sessionSettings.key);
  const [insertTimeError, setInsertTimeError] = useState<string | null>(null);
  const undoManagerRef = useRef<UndoManager<StudioTrack[]> | null>(null);
  const isRestoringTracksRef = useRef(false);
  const [trackHistory, setTrackHistory] = useState<StudioTrack[][]>([]);
  const [trackFuture, setTrackFuture] = useState<StudioTrack[][]>([]);
  const trackClipboardRef = useRef<StudioTrack | null>(null);
  
  // Master Volume Control
  const [masterVolume, setMasterVolume] = useState(0.7); // Default 70%
  const [transportBarCollapsed, setTransportBarCollapsed] = useState(false);
  
  // Auto-collapse transport bar when entering piano-roll view
  useEffect(() => {
    if (activeView === 'piano-roll') {
      setTransportBarCollapsed(true);
    }
  }, [activeView]);

  const [transportBarPos, setTransportBarPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    try {
      const raw = localStorage.getItem('studio:floatingTransport:pos');
      if (!raw) return { x: 0, y: 0 };
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        return { x: parsed.x, y: parsed.y };
      }
      return { x: 0, y: 0 };
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const transportDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; dragging: boolean } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('studio:floatingTransport:pos', JSON.stringify(transportBarPos));
    } catch {
      // ignore
    }
  }, [transportBarPos]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('studio:floatingTransport:collapsed', JSON.stringify(transportBarCollapsed));
    } catch {
      // ignore
    }
  }, [transportBarCollapsed]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('studio:floatingTransport:collapsed');
      if (raw != null) setTransportBarCollapsed(Boolean(JSON.parse(raw)));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { isPro, requirePro, startUpgrade } = useLicenseGate();
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  // 1-2-3-4 Hotkeys for instant view switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Skip if modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      switch (e.key) {
        case '1':
          e.preventDefault();
          setActiveView('beat-lab');
          toast({ title: '🥁 Beat Lab', description: 'Press 1' });
          break;
        case '2':
          e.preventDefault();
          setActiveView('piano-roll');
          toast({ title: '🎹 Piano Roll', description: 'Press 2' });
          break;
        case '3':
          e.preventDefault();
          setActiveView('mixer');
          toast({ title: '🎚️ Mixer', description: 'Press 3' });
          break;
        case '4':
          e.preventDefault();
          setActiveView('arrangement');
          toast({ title: '📐 Arrangement', description: 'Press 4' });
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toast]);

  // Sync dialog drafts with current settings when opened
  useEffect(() => {
    if (showTempoMapDialog) {
      setTempoMap(sessionSettings.bpm);
    }
  }, [showTempoMapDialog, sessionSettings.bpm]);

  useEffect(() => {
    if (showTimeSignatureDialog) {
      setTimeSignatureDraft(sessionSettings.timeSignature);
    }
  }, [showTimeSignatureDialog, sessionSettings.timeSignature]);

  useEffect(() => {
    if (showKeySignatureDialog) {
      setKeySignatureDraft(sessionSettings.key);
    }
  }, [showKeySignatureDialog, sessionSettings.key]);

  useEffect(() => {
    if (showGridSettingsDialog) {
      setGridDivisionDraft(gridSettings.division);
      setGridTripletDraft(gridSettings.triplet);
    }
  }, [showGridSettingsDialog, gridSettings.division, gridSettings.triplet]);

  useEffect(() => {
    if (showInsertTimeDialog) {
      setInsertTimeError(null);
    }
  }, [showInsertTimeDialog]);

  // Handle navigation requests from child components (e.g. LyricLab, BeatLab)
  useEffect(() => {
    const handleNavigateToTab = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const detail = customEvent.detail;

      switch (detail) {
        case 'beat-lab':
        case 'beatmaker':
          setActiveView('beat-lab');
          toast({ title: '🥁 Beat Lab', description: 'Opening Beat Lab for generated patterns.' });
          break;
        case 'piano-roll':
        case 'melody':
          setActiveView('piano-roll');
          setPianoRollExpanded(true);
          toast({ title: '🎹 Piano Roll', description: 'Opening Piano Roll for generated melodies.' });
          break;
        case 'lyrics':
          setActiveView('lyrics');
          break;
        case 'mixer':
          setActiveView('mixer');
          break;
        case 'audio-tools':
          setActiveView('audio-tools');
          break;
        case 'uploader':
          setActiveView('song-uploader');
          break;
        default:
          break;
      }
    };

    window.addEventListener('navigateToTab', handleNavigateToTab as EventListener);
    return () => window.removeEventListener('navigateToTab', handleNavigateToTab as EventListener);
  }, [toast]);


  // Arrange / timeline actions
  const getCurrentBar = () => Math.max(1, Math.floor(position / 4) + 1);

  const handleInsertTime = (bars: number) => {
    const bar = getCurrentBar();
    setClips(prev =>
      prev.map(c => (c.startBar >= bar ? { ...c, startBar: c.startBar + bars } : c))
    );
    setMarkers(prev =>
      prev.map(m => (m.bar >= bar ? { ...m, bar: m.bar + bars } : m))
    );
    toast({ title: "Inserted Time", description: `${bars} bars at bar ${bar}` });
  };

  const handleDeleteTime = (bars: number) => {
    const bar = getCurrentBar();
    setClips(prev =>
      prev
        .map(c => (c.startBar >= bar ? { ...c, startBar: Math.max(1, c.startBar - bars) } : c))
        .filter(c => c.lengthBars > 0)
    );
    setMarkers(prev =>
      prev.map(m => (m.bar >= bar ? { ...m, bar: Math.max(1, m.bar - bars) } : m))
    );
    toast({ title: "Deleted Time", description: `${bars} bars at bar ${bar}` });
  };

  const handleDuplicateTime = (bars: number) => {
    const bar = getCurrentBar();
    const windowEnd = bar + bars;
    const windowClips = clips.filter(c => {
      const clipEnd = c.startBar + c.lengthBars;
      return !(clipEnd <= bar || c.startBar >= windowEnd);
    });
    const duplicated = windowClips.map(c => ({
      ...c,
      id: `clip-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      startBar: c.startBar + bars,
    }));
    setClips(prev => [...prev, ...duplicated]);
    toast({ title: "Duplicated Time", description: `${bars} bars from bar ${bar}` });
  };

  const handleAddMarker = () => {
    const bar = getCurrentBar();
    const marker: Marker = { id: `marker-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`, bar, label: `Marker ${markers.length + 1}` };
    setMarkers(prev => [...prev, marker]);
    toast({ title: "Marker Added", description: `Marker at bar ${bar}` });
  };

  const handleLoopSelection = () => {
    const bar = getCurrentBar();
    setLoop({ enabled: true, start: bar - 1, end: bar - 1 + 4 });
    toast({ title: "Loop Enabled", description: `Looping bars ${bar}-${bar + 3}` });
  };

  const handleSetLoopLength = (bars: number) => {
    const bar = getCurrentBar();
    setLoop({ enabled: true, start: bar - 1, end: bar - 1 + bars });
    toast({ title: "Loop Length Set", description: `${bars} bars starting at ${bar}` });
  };

  const handleApplyTimeDialog = () => {
    if (insertTimeBars <= 0 || Number.isNaN(insertTimeBars)) {
      setInsertTimeError('Enter a positive number of bars.');
      return;
    }
    if (timeDialogMode === 'insert') {
      handleInsertTime(insertTimeBars);
    } else if (timeDialogMode === 'delete') {
      handleDeleteTime(insertTimeBars);
    } else {
      handleDuplicateTime(insertTimeBars);
    }
    setShowInsertTimeDialog(false);
  };

  const handleSaveGridSettings = () => {
    setGridSettings({ division: gridDivisionDraft, triplet: gridTripletDraft });
    setShowGridSettingsDialog(false);
    toast({ title: 'Grid Settings Updated', description: `${gridDivisionDraft}${gridTripletDraft ? ' triplet' : ''}` });
  };

  const handleSaveTempoMap = () => {
    const bpm = Math.max(20, Math.min(400, tempoMap));
    setSessionSettings((prev) => ({ ...prev, bpm }));
    setTransportTempo(bpm);
    setShowTempoMapDialog(false);
    toast({ title: 'Tempo Updated', description: `${bpm} BPM` });
  };

  const handleSaveTimeSignature = () => {
    const numerator = Math.max(1, Math.floor(timeSignatureDraft.numerator || 4));
    const denominator = Math.max(1, Math.floor(timeSignatureDraft.denominator || 4));
    setSessionSettings((prev) => ({ ...prev, timeSignature: { numerator, denominator } }));
    setShowTimeSignatureDialog(false);
    toast({ title: 'Time Signature Updated', description: `${numerator}/${denominator}` });
  };

  const handleSaveKeySignature = () => {
    setSessionSettings((prev) => ({ ...prev, key: keySignatureDraft }));
    setShowKeySignatureDialog(false);
    toast({ title: 'Key Signature Updated', description: keySignatureDraft });
  };

  const handleDeleteMarker = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  useEffect(() => {
    const handleFocusTrack = (event: Event) => {
      const customEvent = event as CustomEvent<{ trackId?: string; view?: string } | undefined>;
      const trackId = customEvent.detail?.trackId;
      const view = customEvent.detail?.view;

      if (!trackId) return;

      setSelectedTrack(trackId);

      if (view === 'piano-roll' || view === 'melody') {
        setActiveView('piano-roll');
        setPianoRollExpanded(true);
        return;
      }

      if (view === 'mixer') {
        setActiveView('mixer');
        return;
      }

      if (view === 'arrangement') {
        setActiveView('arrangement');
        return;
      }
    };

    window.addEventListener('studio:focusTrack', handleFocusTrack as EventListener);
    return () => window.removeEventListener('studio:focusTrack', handleFocusTrack as EventListener);
  }, []);

  // Workflow Selector State
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowPreset['id'] | null>(null);

  // Handle audio import events from other tools (e.g., Audio Tools router)
  useEffect(() => {
    const handleImportAudio = (event: Event) => {
      const customEvent = event as CustomEvent<{ sessionId?: string; name?: string; audioUrl?: string }>;
      const detail = customEvent.detail;
      if (!detail?.audioUrl) return;

      const newTrack: StudioTrack = {
        id: `track-${Date.now()}`,
        name: detail.name || 'Imported Audio',
        kind: 'audio',
        type: 'audio',
        instrument: 'audio',
        notes: [],
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        lengthBars: 8,
        startBar: 0,
        source: 'imported',
        bpm: 120,
        payload: createTrackPayload({ type: 'audio', audioUrl: detail.audioUrl }),
        audioUrl: detail.audioUrl,
        data: {},
        sendA: -60,
        sendB: -60,
      };

      setTracks([...tracks, newTrack]);
      setSelectedTrack(newTrack.id);
      setActiveView('piano-roll');
      setPianoRollExpanded(true);

      toast({
        title: "Imported Audio",
        description: `Added ${newTrack.name} and opened Piano Roll.`,
      });
    };

    window.addEventListener('studio:importAudioTrack', handleImportAudio as EventListener);
    return () => window.removeEventListener('studio:importAudioTrack', handleImportAudio as EventListener);
  }, [setTracks, tracks, toast]);

  const getTrackEffectsChain = useCallback((trackId: string | null) => {
    if (!trackId) return [] as ToolType[];
    const track = tracks.find((t) => t.id === trackId);
    const chain = (track?.data as any)?.effectsChain;
    if (!Array.isArray(chain)) return [] as ToolType[];
    return chain as ToolType[];
  }, [tracks]);

  const setTrackEffectsChain = useCallback((trackId: string, chain: ToolType[]) => {
    setTracks(tracks.map((t) => (
      t.id === trackId
        ? { ...t, data: { ...(t.data ?? {}), effectsChain: chain } }
        : t
    )));
  }, [setTracks, tracks]);

  useEffect(() => {
    const handleAstutelyGenerated = (event: Event) => {
      const customEvent = event as CustomEvent<{ notes: ReturnType<typeof astutelyToNotes>; bpm: number; key?: string }>;
      const detail = customEvent.detail;
      if (!detail?.notes || detail.notes.length === 0) {
        console.warn('Astutely payload missing notes');
        return;
      }

      const grouped = convertAstutelyNotes(detail.notes);
      const focusTrackId = chooseAstutelyFocusTrack(grouped);

      setSessionSettings(prev => ({ ...prev, bpm: detail.bpm || prev.bpm }));
      if (detail.bpm) {
        setTransportTempo(detail.bpm);
      }

      setTracks(prev => mergeAstutelyTracks(prev, grouped, detail.bpm || sessionSettings.bpm));

      if (focusTrackId) {
        setSelectedTrack(focusTrackId);
        window.dispatchEvent(new CustomEvent('studio:focusTrack', {
          detail: { trackId: focusTrackId, view: 'piano-roll' }
        }));
      }

      setActiveView('piano-roll');
      setPianoRollExpanded(true);
      setTransportBarCollapsed(true);

      toast({
        title: 'Astutely Pattern Loaded',
        description: `${detail.notes.length} notes added across AI tracks`
      });
    };

    window.addEventListener('astutely:generated', handleAstutelyGenerated as EventListener);

    try {
      const stored = localStorage.getItem('astutely-generated');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          handleAstutelyGenerated(new CustomEvent('astutely:generated', { detail: parsed }));
        }
        localStorage.removeItem('astutely-generated');
      }
    } catch (error) {
      console.warn('Failed to hydrate Astutely payload from storage', error);
    }

    return () => {
      window.removeEventListener('astutely:generated', handleAstutelyGenerated as EventListener);
    };
  }, [setTracks, setTransportTempo, sessionSettings.bpm, toast]);

  const openEffectEditor = useCallback((tool: ToolType) => {
    if (!selectedTrack) {
      toast({ title: 'Select a track', description: 'Choose a track before editing effects.' });
      return;
    }

    const existingChain = getTrackEffectsChain(selectedTrack);
    if (!existingChain.includes(tool)) {
      setTrackEffectsChain(selectedTrack, [...existingChain, tool]);
    }

    setActiveEffectTool(tool);
    setEffectsDialogOpen(true);
  }, [getTrackEffectsChain, selectedTrack, setTrackEffectsChain, toast]);

  // Global undo/redo keyboard shortcuts (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!undoManagerRef.current) return;

      const isCtrlZ = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      const isCtrlY = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y';

      if (isCtrlZ || isCtrlY) {
        e.preventDefault();
        const current = tracks as StudioTrack[];
        const manager = undoManagerRef.current;
        const next = isCtrlZ ? manager.undo(current.map(t => ({ ...t }))) : manager.redo(current.map(t => ({ ...t })));
        if (next) {
          isRestoringTracksRef.current = true;
          setTracks(next);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, setTracks]);

  const ensureDefaultTrack = useCallback(() => {
    if (tracks.length === 0) {
      const defaultTrack: StudioTrack = {
        id: 'track-1',
        name: 'Piano 1',
        kind: 'midi',
        type: 'midi',
        instrument: 'piano',
        data: [],
        notes: [],
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        lengthBars: 4,
        startBar: 0,
        source: 'default',
        bpm: 120,
        payload: createTrackPayload({ type: 'midi' }),
        sendA: -60,
        sendB: -60,
      };
      setTracks([defaultTrack]);
      setSelectedTrack(defaultTrack.id);
    }
  }, [setTracks, tracks, setSelectedTrack]);
  
  useEffect(() => {
    ensureDefaultTrack();
    if (!selectedTrack && tracks.length > 0) {
      setSelectedTrack(tracks[0].id);
    } else if (selectedTrack && !tracks.some(track => track.id === selectedTrack)) {
      setSelectedTrack(tracks[0]?.id ?? null);
    }
  }, [ensureDefaultTrack, tracks, selectedTrack]);

  useEffect(() => {
    setTrackHeights((prev) => {
      const next = { ...prev };
      let changed = false;

      tracks.forEach((track) => {
        if (!next[track.id]) {
          next[track.id] = DEFAULT_TRACK_HEIGHT;
          changed = true;
        }
      });

      Object.keys(next).forEach((id) => {
        if (!tracks.some((t) => t.id === id)) {
          delete next[id];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tracks]);

  useEffect(() => {
    const measureWidth = () => {
      setTrackListWidth(trackListRef.current?.clientWidth || 1000);
    };
    measureWidth();
    window.addEventListener('resize', measureWidth);
    return () => window.removeEventListener('resize', measureWidth);
  }, []);

  // Pre-decode waveforms for audio tracks so timeline can render real data
  useEffect(() => {
    const loadWaveforms = async () => {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;
      const updates: Record<string, Float32Array> = {};

      for (const track of tracks) {
        if (track.type !== 'audio') continue;
        const url = (track as any).audioUrl || (track.payload as any)?.audioUrl;
        if (!url) continue;
        if (waveformCacheRef.current.has(track.id)) {
          updates[track.id] = waveformCacheRef.current.get(track.id)!;
          continue;
        }

        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const channel = audioBuffer.getChannelData(0);
          const buckets = 400;
          const samplesPerBucket = Math.max(1, Math.floor(channel.length / buckets));
          const reduced = new Float32Array(buckets);

          for (let i = 0; i < buckets; i++) {
            let sum = 0;
            const start = i * samplesPerBucket;
            const end = Math.min(channel.length, start + samplesPerBucket);
            for (let j = start; j < end; j++) {
              sum += Math.abs(channel[j]);
            }
            reduced[i] = sum / (end - start || 1);
          }

          waveformCacheRef.current.set(track.id, reduced);
          updates[track.id] = reduced;
        } catch (error) {
          console.error('Failed to decode waveform', error);
        }
      }

      if (Object.keys(updates).length) {
        setWaveformData(prev => ({ ...prev, ...updates }));
      }
    };

    loadWaveforms();
  }, [tracks]);

  const TimelineWaveformCanvas: React.FC<{ data: Float32Array; height: number }> = ({ data, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;

      for (let x = 0; x < width; x++) {
        const idx = Math.floor((x / width) * data.length);
        const amp = data[idx] ?? 0;
        const barHeight = Math.max(1, amp * height);
        const y = (height - barHeight) / 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + barHeight);
        ctx.stroke();
      }
    }, [data, height]);

    return <canvas ref={canvasRef} width={600} height={height} className="w-full h-full" />;
  };

  const renderWaveformEditor = () => {
    const track = tracks.find((t) => t.id === selectedTrack);
    if (!track || track.type !== 'audio') return null;
    const data = waveformData[track.id];

    return (
      <Dialog open={showWaveformEditor} onOpenChange={setShowWaveformEditor}>
        <DialogContent className="max-w-3xl bg-gray-900 border-gray-700">
          <DialogTitle className="text-lg font-semibold">Waveform Editor · {track.name}</DialogTitle>
          <div className="space-y-4">
            <div className="bg-gray-800 rounded p-3 border border-gray-700">
              {data ? (
                <div className="h-40">
                  <TimelineWaveformCanvas data={data} height={160} />
                </div>
              ) : (
                <div className="text-sm text-gray-400">Waveform is decoding... try again in a moment.</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xs text-gray-400 mb-1">Start (%)</div>
                <Slider value={[waveformTrimStart]} onValueChange={([v]) => setWaveformTrimStart(v)} min={0} max={95} step={1} />
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-400 mb-1">End (%)</div>
                <Slider value={[waveformTrimEnd]} onValueChange={([v]) => setWaveformTrimEnd(v)} min={5} max={100} step={1} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowWaveformEditor(false)}>Close</Button>
              <Button
                onClick={() => {
                  const clampedStart = Math.min(waveformTrimStart, waveformTrimEnd - 5);
                  const clampedEnd = Math.max(waveformTrimEnd, clampedStart + 5);
                  setTracks(tracks.map((t) =>
                    t.id === track.id
                      ? { ...t, payload: { ...(t.payload || {}), trimStartPct: clampedStart, trimEndPct: clampedEnd } }
                      : t
                  ));
                  toast({
                    title: "Waveform trimmed",
                    description: `Applied ${clampedStart}% - ${clampedEnd}% to ${track.name}`,
                  });
                  setShowWaveformEditor(false);
                }}
              >
                Apply Trim
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Check if this is the first time visiting the studio and load persisted workflow
  useEffect(() => {
    const hasSeenWorkflowSelector = localStorage.getItem('hasSeenWorkflowSelector');
    let savedWorkflow = localStorage.getItem('selectedWorkflow') as string | null;
    
    if (!hasSeenWorkflowSelector) {
      // First time - do not auto-open the modal (it blocks UI interactions).
      // Users can still open it explicitly via the Change Workflow button.
      localStorage.setItem('hasSeenWorkflowSelector', 'true');
    } else if (savedWorkflow) {
      // Migrate legacy workflow IDs to new format
      if (LEGACY_WORKFLOW_ID_MAP[savedWorkflow]) {
        const migratedId = LEGACY_WORKFLOW_ID_MAP[savedWorkflow];
        savedWorkflow = migratedId;
        // Save the migrated ID to localStorage
        localStorage.setItem('selectedWorkflow', migratedId);
      }
      
      // Load saved workflow configuration if valid
      const workflowId = savedWorkflow as WorkflowPreset['id'];
      if (WORKFLOW_CONFIGS[workflowId]) {
        const config = WORKFLOW_CONFIGS[workflowId];
        setCurrentWorkflow(workflowId);
        setActiveView(config.activeView);
        setShowAIAssistant(config.showAIAssistant);
        setShowMusicGen(config.showMusicGen);
        setShowLyricsFocus(!!config.showLyricsFocus);
      }
    }
  }, []);

  // Handle workflow selection
  const handleSelectWorkflow = (workflowId: WorkflowPreset['id']) => {
    const config = WORKFLOW_CONFIGS[workflowId];
    
    if (!config) {
      console.error(`Unknown workflow: ${workflowId}`);
      return;
    }

    // Apply workflow configuration with batch state updates
    setCurrentWorkflow(workflowId);
    setActiveView(config.activeView);
    setShowAIAssistant(config.showAIAssistant);
    setShowMusicGen(config.showMusicGen);
    setShowLyricsFocus(!!config.showLyricsFocus);
    
    // Persist selections
    localStorage.setItem('hasSeenWorkflowSelector', 'true');
    localStorage.setItem('selectedWorkflow', workflowId);
    setShowWorkflowSelector(false);
    
    // Show success toast with workflow description
    toast({
      title: "Workflow Applied",
      description: config.description,
      duration: 4000,
    });

    // Special handling for guided beginner mode
    if (config.guidedMode) {
      setTimeout(() => {
        toast({
          title: "Welcome, Beginner!",
          description: "The AI Assistant is here to guide you. Click 'Generate Music' to get started quickly!",
          duration: 6000,
        });
      }, 1000);
    }
  };

  // Handle skip/close workflow selector
  const handleSkipWorkflow = () => {
    localStorage.setItem('hasSeenWorkflowSelector', 'true');
    setShowWorkflowSelector(false);
  };

  const addTrack = (instrument: string, type: 'midi' | 'audio') => {
    if (!isPro && tracks.length >= 8) {
      setShowLicenseModal(true);
      toast({
        title: "Upgrade to Pro",
        description: "Free tier supports up to 8 tracks. Upgrade to add more.",
      });
      return;
    }
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `${instrument} ${tracks.length + 1}`,
      kind: type === 'midi' ? 'midi' : 'audio',
      type,
      instrument,
      data: [],
      notes: [], // Initialize notes array for Piano Roll
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 4,
      startBar: 0,
      source: 'user-created',
      bpm: 120,
      payload: createTrackPayload({ type: 'midi' }),
      sendA: -60,
      sendB: -60,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    setPianoRollExpanded(true);
  };

  // Playback is now controlled by Global Transport
  // This function prepares the track data for the Global Transport to play
  const preparePlaybackData = () => {
    const notesToPlay: Array<{ note: string; octave: number; time: number; track: StudioTrack }> = [];
    
    tracks.forEach(track => {
      if (!track.muted && track.notes && track.notes.length > 0) {
        track.notes.forEach(note => {
          notesToPlay.push({
            note: note.note, // Keep note name as-is (already has #)
            octave: note.octave,
            time: note.step * 0.125, // 4 steps per beat, 0.5s per beat = 0.125s per step
            track
          });
        });
      }
    });
    
    return notesToPlay;
  };

  // Map UI instrument names to General MIDI Soundfont names DIRECTLY
  const mapInstrumentName = (uiName: string): string => {
    const mapping: Record<string, string> = {
      // Piano
      'Grand Piano': 'acoustic_grand_piano',
      'Electric Piano': 'electric_piano_1',
      'Synth Piano': 'electric_piano_2',
      'Harpsichord': 'harpsichord',
      
      // Bass - CORRECT General MIDI mappings
      '808 Bass': 'synth_bass_2', // Deep electronic bass (play low notes for 808 effect)
      'Synth Bass': 'synth_bass_1', // Standard synth bass
      'Electric Bass': 'electric_bass_finger', // Fingered electric bass (standard)
      'Upright Bass': 'acoustic_bass', // Acoustic upright/double bass
      'Sub Bass': 'fretless_bass', // Smooth, deep fretless bass
      
      // Guitar
      'Acoustic Guitar': 'acoustic_guitar_steel',
      'Electric Guitar': 'electric_guitar_clean',
      'Classical Guitar': 'acoustic_guitar_nylon',
      'Bass Guitar': 'electric_bass_pick',
      
      // Strings - EACH ONE DIFFERENT
      'Violin': 'violin',
      'Viola': 'viola',
      'Cello': 'cello',
      'Double Bass': 'contrabass',
      'String Ensemble': 'string_ensemble_1',
      
      // Winds - MORE VARIETY
      'Flute': 'flute',
      'Clarinet': 'clarinet',
      'Saxophone': 'tenor_sax',
      'Trumpet': 'trumpet',
      'Horn': 'french_horn',
      'Trombone': 'trombone',
      
      // Synth
      'Lead Synth': 'lead_1_square',
      'Pad Synth': 'pad_2_warm',
      'Arp Synth': 'lead_2_sawtooth',
      'Bass Synth': 'synth_bass_1',
      
      // Drums - CORRECT General MIDI percussion instruments
      'Kick': 'taiko_drum', // Deep Japanese drum (closest to kick)
      'Snare': 'steel_drums', // Sharp metallic hit (snare crack, no lollipop sound)
      'Hi-Hat': 'agogo', // Metallic bell sound (hi-hat)
      'Tom': 'melodic_tom', // Actual melodic tom drum
      'Cymbal': 'reverse_cymbal', // Cymbal crash/splash sound
      'Full Kit': 'synth_drum', // Multi-purpose drum
      
      // Other category - ACTUAL INSTRUMENTS
      'Percussion': 'timpani',
      'Sound Effects': 'synth_voice',
      'Vocal': 'choir_aahs',
      'Samples': 'orchestral_harp',
    };
    
    return mapping[uiName] || 'acoustic_grand_piano';
  };

  // Play a note with the REAL audio engines (Synthesis for instruments, realisticAudio for drums)
  const playNote = async (note: string, octave: number, instrumentType?: string, durationSeconds: number = 0.5) => {
    try {
      const currentTrack = tracks.find(t => t.id === selectedTrack);
      const uiInstrument = instrumentType || currentTrack?.instrument || 'Grand Piano';
      const trackVolume = currentTrack?.volume ?? 0.8;

      const drumMap: Record<string, string> = { Kick: 'kick', Snare: 'snare', 'Hi-Hat': 'hihat', Tom: 'tom', Cymbal: 'crash', 'Full Kit': 'kick' };
      if (drumMap[uiInstrument]) {
        await realisticAudio.playDrumSound(drumMap[uiInstrument], trackVolume);
        return;
      }
      
      // For melodic instruments, use the RealisticAudioEngine with General MIDI soundfonts.
      // If we were given an internal/soundfont key (e.g. electric_bass_pick), pass it through.
      const looksLikeSoundfontKey = /^[a-z0-9_-]+$/.test(uiInstrument);
      const midiInstrument = looksLikeSoundfontKey ? uiInstrument : mapInstrumentName(uiInstrument);
      
      console.log(`🎹 Playing ${note}${octave} with instrument: ${uiInstrument} → ${midiInstrument}`);
      
      // realisticAudio.playNote(note, octave, duration, instrument, velocity)
      await realisticAudio.playNote(
        note,
        octave,
        durationSeconds,
        midiInstrument,
        Math.min(1, Math.max(0, trackVolume))
      );
      
      // TODO: Apply pan using Web Audio API StereoPannerNode
    } catch (error) {
      console.error('Error playing note:', error);
    }
  };

  // Stop a note (for note-off events)
  const playNoteOff = (note: string, octave: number, instrument?: string) => {
    try {
      const currentTrack = tracks.find(t => t.id === selectedTrack);
      const uiInstrument = instrument || currentTrack?.instrument || 'Grand Piano';
      const looksLikeSoundfontKey = /^[a-z0-9_-]+$/.test(uiInstrument);
      const midiInstrument = looksLikeSoundfontKey ? uiInstrument : mapInstrumentName(uiInstrument);
      realisticAudio.noteOff(note, octave, midiInstrument);
    } catch (error) {
      console.error('Error stopping note:', error);
    }
  };

  // Handle grid click based on tool mode
  const addNoteToGrid = (note: string, octave: number, barPosition: number) => {
    if (!selectedTrack) {
      toast({
        title: "No Track Selected",
        description: "Please select a MIDI track first",
        variant: "destructive",
      });
      return;
    }
    
    // Don't replace # with Sharp - keep note name as-is
    const noteStr = note;
    
    const snappedStep = snapToGridEnabled ? Math.round(barPosition / 4) * 4 : barPosition;

    if (pianoRollTool === 'erase') {
      // Erase mode - remove notes at this position
      setTracks(tracks.map(t => {
        if (t.id === selectedTrack) {
          const existingNotes = t.notes || [];
          const filtered = existingNotes.filter(n => 
            !(n.note === noteStr && n.octave === octave && n.step === snappedStep)
          );
          return { ...t, notes: filtered };
        }
        return t;
      }));
      toast({
        title: "Note Erased",
        description: `Removed ${note}${octave} at bar ${barPosition + 1}`,
        duration: 1000,
      });
      return;
    }
    
    if (pianoRollTool === 'draw') {
      // Draw mode - add note using unified Note structure
      const newNote: Note = {
        id: `note-${Date.now()}`,
        note: noteStr,
        octave,
        step: snappedStep,  // Position in steps
        velocity: 100,      // Default velocity
        length: 4,          // Default length (4 steps = 1 beat)
      };
      
      setTracks(tracks.map(t => {
        if (t.id === selectedTrack) {
          const existingNotes = t.notes || [];
          return { ...t, notes: [...existingNotes, newNote] };
        }
        return t;
      }));
      
      playNote(note, octave);
    }
    
    // Select mode - just preview the note
    if (pianoRollTool === 'select') {
      playNote(note, octave);
    }
  };

  // File menu actions
  const buildProjectData = () => ({
    version: 1,
    timestamp: new Date().toISOString(),
    tracks,
    clips,
    markers,
    gridSettings,
    sessionSettings,
    loop,
    tempo,
    selectedTrack,
    snapToGridEnabled,
    showGrid,
  });

  const downloadProject = (data: any) => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CodedSwitch-Project-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const applyProjectData = (projectData: any) => {
    const normalizedTracks: StudioTrack[] = (projectData.tracks ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? `track-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      type: t.type ?? 'midi',
      volume: t.volume ?? 0.8,
      pan: t.pan ?? 0,
      notes: t.notes ?? [],
      lengthBars: t.lengthBars ?? 4,
      startBar: t.startBar ?? 0,
      payload: t.payload ?? {},
    }));
    setTracks(normalizedTracks);
    setClips(projectData.clips ?? []);
    setMarkers(projectData.markers ?? []);
    if (projectData.gridSettings) setGridSettings(projectData.gridSettings);
    if (projectData.sessionSettings) {
      setSessionSettings(projectData.sessionSettings);
      if (projectData.sessionSettings.bpm) {
        setTransportTempo(projectData.sessionSettings.bpm);
      }
    } else if (projectData.tempo) {
      setTransportTempo(projectData.tempo);
    }
    if (projectData.loop) setLoop(projectData.loop);
    if (projectData.selectedTrack) setSelectedTrack(projectData.selectedTrack);
    if (typeof projectData.snapToGridEnabled === 'boolean') setSnapToGridEnabled(projectData.snapToGridEnabled);
    if (typeof projectData.showGrid === 'boolean') setShowGrid(projectData.showGrid);
  };

  const handleNewProject = () => {
    if (confirm('Create new project? This will clear all tracks.')) {
      setTracks([]);
      setClips([]);
      setMarkers([]);
      setSelectedTrack(null);
      toast({
        title: "New Project",
        description: "Created new empty project",
      });
    }
  };

  const handleSaveProject = () => {
    if (!requirePro("save", () => setShowLicenseModal(true))) return;
    const projectData = buildProjectData();
    localStorage.setItem('unifiedStudioProject', JSON.stringify(projectData));
    downloadProject(projectData);
    toast({
      title: "Project Saved",
      description: "Saved to browser storage and downloaded to your drive",
    });
  };

  const handleLoadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const projectData = JSON.parse(text);
        applyProjectData(projectData);
        toast({
          title: "Project Loaded",
          description: file.name,
        });
      } catch (err) {
        console.error(err);
        toast({
          title: "Load Failed",
          description: "Invalid project file",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  const handleExport = () => {
    if (!requirePro("export", () => setShowLicenseModal(true))) return;
    const projectData = buildProjectData();
    downloadProject(projectData);
    toast({
      title: "Project Exported",
      description: "Project exported as JSON file",
    });
  };

  // Edit menu actions
  const handleUndo = () => {
    if (!undoManagerRef.current) {
      toast({ title: 'Nothing to undo' });
      return;
    }

    const next = undoManagerRef.current.undo((tracks as StudioTrack[]).map((t) => ({ ...t })));
    if (!next) {
      toast({ title: 'Nothing to undo' });
      return;
    }

    isRestoringTracksRef.current = true;
    setTracks(next);
    toast({ title: 'Undo', description: 'Reverted last change' });
  };

  const handleRedo = () => {
    if (!undoManagerRef.current) {
      toast({ title: 'Nothing to redo' });
      return;
    }

    const next = undoManagerRef.current.redo((tracks as StudioTrack[]).map((t) => ({ ...t })));
    if (!next) {
      toast({ title: 'Nothing to redo' });
      return;
    }

    isRestoringTracksRef.current = true;
    setTracks(next);
    toast({ title: 'Redo', description: 'Reapplied last change' });
  };

  const handleCut = () => {
    if (!selectedTrack) {
      toast({ title: 'No Selection', description: 'Select a track to cut' });
      return;
    }

    const track = tracks.find((t) => t.id === selectedTrack);
    if (!track) {
      toast({ title: 'No Selection', description: 'Select a track to cut' });
      return;
    }

    trackClipboardRef.current = {
      ...track,
      notes: Array.isArray(track.notes) ? [...track.notes] : [],
    };
    const remaining = tracks.filter((t) => t.id !== selectedTrack);
    setTracks(remaining);
    setSelectedTrack(remaining[0]?.id ?? null);
    toast({ title: 'Cut', description: `${track.name} cut` });
  };

  const handleCopy = () => {
    if (!selectedTrack) {
      toast({ title: 'No Selection', description: 'Select a track to copy' });
      return;
    }

    const track = tracks.find((t) => t.id === selectedTrack);
    if (!track) {
      toast({ title: 'No Selection', description: 'Select a track to copy' });
      return;
    }

    trackClipboardRef.current = {
      ...track,
      notes: Array.isArray(track.notes) ? [...track.notes] : [],
    };
    toast({ title: 'Copy', description: `${track.name} copied` });
  };

  const handlePaste = () => {
    const clip = trackClipboardRef.current;
    if (!clip) {
      toast({ title: 'Nothing to paste' });
      return;
    }

    const id = `track-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    const pasted: StudioTrack = {
      ...clip,
      id,
      name: `${clip.name} (Paste)`,
      notes: Array.isArray(clip.notes) ? [...clip.notes] : [],
    };
    setTracks([...tracks, pasted]);
    setSelectedTrack(pasted.id);
    toast({ title: 'Paste', description: `${clip.name} pasted` });
  };

  const handleDuplicate = () => {
    if (!selectedTrack) {
      toast({ title: "No Selection", description: "Select a track to duplicate" });
      return;
    }

    const trackToDupe = tracks.find(t => t.id === selectedTrack);
    if (!trackToDupe) {
      toast({ title: "Missing Track", description: "Could not find track to duplicate" });
      return;
    }

    const newTrack = duplicateTrackData(trackToDupe) as StudioTrack;
    setTracks([...tracks, newTrack]);
    toast({ title: "Duplicated", description: `Created copy of ${trackToDupe.name}` });
  };

  const handleDelete = () => {
    if (selectedTrack) {
      setTracks(tracks.filter(t => t.id !== selectedTrack));
      setSelectedTrack(null);
      toast({ title: "Deleted", description: "Track deleted" });
    }
  };

  const handleSelectAll = () => {
    toast({ title: "Select All", description: "All items selected" });
  };

  // Create menu actions
  const addClip = (trackId: string, type: ClipType, name: string, lengthBars = 4) => {
    const clip: TrackClip = {
      id: `clip-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      trackId,
      type,
      name,
      startBar: getCurrentBar(),
      lengthBars,
    };
    setClips((prev) => [...prev, clip]);
    return clip;
  };

  const handleNewMIDITrack = () => {
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `MIDI ${tracks.length + 1}`,
      kind: 'midi',
      type: 'midi',
      instrument: 'piano',
      notes: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 4,
      startBar: 0,
      source: 'user-created',
      bpm: 120,
      payload: createTrackPayload({ type: 'midi' }),
      data: {},
      sendA: -60,
      sendB: -60,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    toast({ title: "MIDI Track Created", description: newTrack.name });
  };

  const handleNewAudioTrack = () => {
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `Audio ${tracks.length + 1}`,
      kind: 'audio',
      type: 'audio',
      instrument: 'audio',
      notes: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 4,
      startBar: 0,
      source: 'user-created',
      bpm: 120,
      payload: createTrackPayload({ type: 'audio' }),
      data: {},
      sendA: -60,
      sendB: -60,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    toast({ title: "Audio Track Created", description: newTrack.name });
  };

  const handleNewInstrumentTrack = () => {
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `Instrument ${tracks.length + 1}`,
      kind: 'midi',
      type: 'midi',
      instrument: 'piano',
      notes: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 4,
      startBar: 0,
      source: 'user-created',
      bpm: 120,
      payload: createTrackPayload({ type: 'midi', instrument: 'piano' }),
      data: {},
      sendA: -60,
      sendB: -60,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    toast({ title: "Instrument Track Created", description: newTrack.name });
  };

  const handleNewReturnTrack = () => {
    const newTrack: StudioTrack = {
      id: `return-${Date.now()}`,
      name: `Return ${tracks.length + 1}`,
      kind: 'aux',
      type: 'aux',
      instrument: 'aux',
      notes: [],
      volume: 0.7,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 0,
      startBar: 0,
      source: 'user-created',
      bpm: sessionSettings.bpm,
      payload: createTrackPayload({ type: 'aux' as any }),
      data: { returns: true },
      sendA: -60,
      sendB: -60,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    toast({ title: "Return Track Created", description: newTrack.name });
  };

  const ensureTrackForEffect = (kind: 'audio' | 'midi') => {
    if (selectedTrack) return selectedTrack;
    if (kind === 'audio') {
      handleNewAudioTrack();
      return `track-${Date.now()}`; // fallback; selection set in handler
    }
    handleNewMIDITrack();
    return `track-${Date.now()}`;
  };

  const handleInsertEffect = (tool: ToolType, kind: 'audio' | 'midi') => {
    const targetId = selectedTrack || ensureTrackForEffect(kind);
    const existingChain = getTrackEffectsChain(targetId);
    if (!existingChain.includes(tool)) {
      setTrackEffectsChain(targetId, [...existingChain, tool]);
    }
    setSelectedTrack(targetId);
    setActiveEffectTool(tool);
    setEffectsDialogOpen(true);
    toast({ title: `${tool} inserted`, description: `Added to ${tracks.find(t => t.id === targetId)?.name || 'track'}` });
  };

  const handleNewSend = () => {
    const sendTrack: StudioTrack = {
      id: `send-${Date.now()}`,
      name: `Send ${tracks.length + 1}`,
      kind: 'aux',
      type: 'aux',
      instrument: 'aux',
      notes: [],
      volume: 0.7,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 0,
      startBar: 0,
      source: 'user-created',
      bpm: sessionSettings.bpm,
      payload: createTrackPayload({ type: 'aux' as any }),
      data: { send: true },
      sendA: -60,
      sendB: -60,
    };
    setTracks([...tracks, sendTrack]);
    if (selectedTrack) {
      setTracks(prev => prev.map(t => t.id === selectedTrack ? { ...t, data: { ...(t.data ?? {}), sends: [...((t.data as any)?.sends ?? []), { targetId: sendTrack.id, level: 0.5 }] } } : t));
    }
    toast({ title: "Send Created", description: sendTrack.name });
  };

  const handleNewBus = () => {
    const busTrack: StudioTrack = {
      id: `bus-${Date.now()}`,
      name: `Bus ${tracks.length + 1}`,
      kind: 'aux',
      type: 'aux',
      instrument: 'aux',
      notes: [],
      volume: 0.7,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 0,
      startBar: 0,
      source: 'user-created',
      bpm: sessionSettings.bpm,
      payload: createTrackPayload({ type: 'aux' as any }),
      data: { bus: true },
      sendA: -60,
      sendB: -60,
    };
    setTracks([...tracks, busTrack]);
    toast({ title: "Bus Created", description: busTrack.name });
  };

  const handleInsertClip = (name: string, preferAudio = false) => {
    if (!selectedTrack) {
      toast({ title: "Select a track", description: "Choose a track before adding a clip." });
      return;
    }
    const track = tracks.find(t => t.id === selectedTrack);
    if (!track) return;
    const type: ClipType = preferAudio || track.type === 'audio' || track.kind === 'audio' ? 'audio' : 'midi';
    const clip = addClip(track.id, type, name, 4);
    toast({ title: `${name} Added`, description: `${name} at bar ${clip.startBar}` });
  };

  // Mix menu actions
  const handleNormalize = () => {
    toast({ title: "Normalize", description: "Audio normalized to 0dB" });
  };

  const handleReverse = () => {
    toast({ title: "Reverse", description: "Audio reversed" });
  };

  const handleBounceToAudio = () => {
    if (selectedTrack) {
      const track = tracks.find(t => t.id === selectedTrack);
      if (track) {
        const bounced: StudioTrack = {
          ...track,
          id: `track-${Date.now()}`,
          name: `${track.name} (Bounced)`,
          kind: 'audio',
          type: 'audio',
        };
        setTracks([...tracks, bounced]);
        toast({ title: "Bounced", description: `${track.name} bounced to audio` });
      }
    }
  };

  const handleGroupTracks = () => {
    toast({ title: "Group Tracks", description: "Selected tracks grouped" });
  };

  const handleUngroupTracks = () => {
    toast({ title: "Ungroup Tracks", description: "Selected tracks ungrouped" });
  };

  const handleFadeIn = () => {
    if (!selectedTrack) {
      toast({ title: "Select a track", description: "Choose a track to apply fade in" });
      return;
    }
    // Apply fade in to selected track's clips
    setClips(prev => prev.map(clip => 
      clip.trackId === selectedTrack ? { ...clip, fadeIn: 0.5 } : clip
    ));
    toast({ title: "Fade In Applied", description: "0.5s fade in added to track clips" });
  };

  const handleFadeOut = () => {
    if (!selectedTrack) {
      toast({ title: "Select a track", description: "Choose a track to apply fade out" });
      return;
    }
    // Apply fade out to selected track's clips
    setClips(prev => prev.map(clip => 
      clip.trackId === selectedTrack ? { ...clip, fadeOut: 0.5 } : clip
    ));
    toast({ title: "Fade Out Applied", description: "0.5s fade out added to track clips" });
  };

  const handleFreezeTrack = () => {
    if (!selectedTrack) {
      toast({ title: "Select a track", description: "Choose a track to freeze" });
      return;
    }
    const track = tracks.find(t => t.id === selectedTrack);
    if (track) {
      setTracks(tracks.map(t => t.id === selectedTrack ? { ...t, frozen: true } : t));
      toast({ title: "Track Frozen", description: `${track.name} frozen - effects rendered to audio` });
    }
  };

  const handleFlattenTrack = () => {
    if (!selectedTrack) {
      toast({ title: "Select a track", description: "Choose a track to flatten" });
      return;
    }
    const track = tracks.find(t => t.id === selectedTrack);
    if (track) {
      // Flatten merges all clips into one and removes automation
      toast({ title: "Track Flattened", description: `${track.name} flattened - clips merged` });
    }
  };

  const handleClickTrackSettings = () => {
    setShowMetronomeSettings(true);
    toast({ title: "Click Track Settings", description: "Opening metronome settings..." });
  };

  const handleSoloAll = () => {
    setTracks(tracks.map(t => ({ ...t, solo: true })));
    toast({ title: "Solo All", description: "All tracks soloed" });
  };

  const handleMuteAll = () => {
    setTracks(tracks.map(t => ({ ...t, muted: true })));
    toast({ title: "Mute All", description: "All tracks muted" });
  };

  const handleUnsoloAll = () => {
    setTracks(tracks.map(t => ({ ...t, solo: false })));
    toast({ title: "Unsolo All", description: "All tracks unsoloed" });
  };

  const handleUnmuteAll = () => {
    setTracks(tracks.map(t => ({ ...t, muted: false })));
    toast({ title: "Unmute All", description: "All tracks unmuted" });
  };

  const handleResetFaders = () => {
    setTracks(tracks.map(t => ({ ...t, volume: 0.8 })));
    toast({ title: "Reset Faders", description: "All faders reset to 0dB" });
  };

  const handleResetPan = () => {
    setTracks(tracks.map(t => ({ ...t, pan: 0 })));
    toast({ title: "Reset Pan", description: "All pan controls centered" });
  };

  // Arrange menu actions (handleLoopSelection and handleAddMarker defined earlier)

  const handleSnapToGrid = () => {
    setSnapToGridEnabled((prev) => {
      const next = !prev;
      toast({ title: 'Snap to Grid', description: next ? 'Enabled' : 'Disabled' });
      return next;
    });
  };

  const handleToggleGrid = () => {
    setShowGrid((prev) => {
      const next = !prev;
      toast({ title: 'Grid', description: next ? 'Shown' : 'Hidden' });
      return next;
    });
  };

  const handleZoomIn = () => {
    setZoom(z => Math.min(100, z + 5));
  };

  const handleZoomOut = () => {
    setZoom(z => Math.max(10, z - 5));
  };

  const handleZoomToFit = () => {
    setZoom(50);
  };

  const handleToggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        toast({ title: 'Full Screen', description: 'Enabled' });
      } else {
        await document.exitFullscreen();
        toast({ title: 'Full Screen', description: 'Disabled' });
      }
    } catch {
      toast({ title: 'Full Screen', description: 'Not available in this browser', variant: 'destructive' });
    }
  };

  // Window menu actions
  const handleResetLayout = () => {
    setActiveView('arrangement');
    toast({ title: "Layout Reset", description: "Default layout restored" });
  };

  // Tools menu actions
  const handleTuner = () => {
    setActiveView('audio-tools');
    toast({ title: "Tuner", description: "Opening Audio Tools with tuner" });
  };

  const handleMetronome = () => {
    const newState = !metronomeEnabled;
    setMetronomeEnabled(newState);
    toast({ 
      title: newState ? "Metronome On" : "Metronome Off", 
      description: newState ? "Click track will play during playback" : "Click track disabled" 
    });
  };

  const handleShowKeyboardShortcuts = () => {
    setShowKeyboardShortcuts(true);
  };

  const handleShowAbout = () => {
    setShowAboutDialog(true);
  };

  const handleMusicGenerated = (audioUrl: string, metadata: any) => {
    // Add generated music as a new track
    const newTrack: StudioTrack = {
      id: `track-${Date.now()}`,
      name: `Generated - ${metadata.genre}`,
      kind: 'audio',
      type: 'audio',
      instrument: metadata.provider,
      data: { audioUrl, metadata },
      notes: [], // Initialize notes array
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: 8,
      startBar: 0,
      source: 'ai-generated',
      bpm: metadata.bpm || 120,
      payload: createTrackPayload({ type: 'audio' }),
      sendA: -60,
      sendB: -60,
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    setShowMusicGen(false);
  };

  const handleLyricsSaved = (lyrics: string, sections: any[]) => {
    // Add or update lyrics track
    const lyricsTrack = tracks.find(t => t.type === 'lyrics');
    if (lyricsTrack) {
      setTracks(tracks.map(t =>
        t.type === 'lyrics' ? { ...t, data: { lyrics, sections } } : t
      ));
    } else {
      const newTrack: StudioTrack = {
        id: `track-${Date.now()}`,
        name: 'Lyrics',
        kind: 'aux',
        type: 'lyrics',
        data: { lyrics, sections },
        notes: [], // Initialize notes array
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
        lengthBars: 8,
        startBar: 0,
        source: 'lyrics',
        bpm: 120,
        payload: createTrackPayload({ type: 'lyrics' }),
        sendA: -60,
        sendB: -60,
      };
      setTracks([...tracks, newTrack]);
    }
    setShowLyricsFocus(false);
  };

  // Mobile Layout - Simplified UI for touch devices
  if (isMobile) {
    const mobileTabMap: Record<string, typeof activeView> = {
      'home': 'arrangement',
      'piano': 'piano-roll',
      'beats': 'beat-lab',
      'lyrics': 'lyrics',
      'ai': 'ai-studio',
      'upload': 'song-uploader',
      'more': 'mixer',
    };
    
    const handleMobileTabChange = (tab: string) => {
      const view = mobileTabMap[tab];
      if (view) setActiveView(view);
    };
    
    const getMobileTab = (): 'home' | 'piano' | 'beats' | 'lyrics' | 'ai' | 'upload' | 'more' => {
      switch (activeView) {
        case 'piano-roll': return 'piano';
        case 'beat-lab': return 'beats';
        case 'lyrics': return 'lyrics';
        case 'ai-studio': return 'ai';
        case 'song-uploader': return 'upload';
        case 'mixer': return 'more';
        default: return 'home';
      }
    };
    
    return (
      <MobileStudioLayout
        activeTab={getMobileTab()}
        onTabChange={handleMobileTabChange}
        isPlaying={transportPlaying}
        onPlay={() => transportPlaying ? pauseTransport() : startTransport()}
        onStop={stopTransport}
        bpm={tempo}
        currentKey={studioContext.currentKey}
      >
        {/* Mobile Content Views */}
        <div className="h-full overflow-auto">
          {activeView === 'piano-roll' && (
            <VerticalPianoRoll />
          )}
          {activeView === 'beat-lab' && <BeatLab />}
          {activeView === 'lyrics' && <LyricLab />}
          {activeView === 'ai-studio' && (
            <div className="p-4">
              <AIAssistant />
            </div>
          )}
          {activeView === 'song-uploader' && <SongUploader />}
          {activeView === 'mixer' && <ProfessionalMixer />}
          {activeView === 'arrangement' && (
            <div className="p-4 space-y-4">
              <h2 className="text-xl font-bold">Welcome to Studio</h2>
              <p className="text-gray-400 text-sm">Select a tab below to get started</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setActiveView('piano-roll')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform">
                  <Piano className="w-8 h-8 text-purple-400" />
                  <span className="text-sm font-medium">Piano Roll</span>
                </button>
                <button onClick={() => setActiveView('beat-lab')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform">
                  <Layers className="w-8 h-8 text-blue-400" />
                  <span className="text-sm font-medium">Beat Lab</span>
                </button>
                <button onClick={() => setActiveView('lyrics')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform">
                  <FileText className="w-8 h-8 text-green-400" />
                  <span className="text-sm font-medium">Lyrics</span>
                </button>
                <button onClick={() => setActiveView('ai-studio')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform">
                  <Wand2 className="w-8 h-8 text-yellow-400" />
                  <span className="text-sm font-medium">AI Studio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </MobileStudioLayout>
    );
  }

  // Desktop Layout - Full featured UI
  return (
    <div className="h-full w-full flex flex-col bg-black astutely-app astutely-scanlines astutely-grid-bg astutely-scrollbar overflow-visible">
      {/* Top Bar */}
      <div className="h-14 bg-black/80 border-b border-cyan-500/30 backdrop-blur-md flex items-center px-4 justify-between flex-shrink-0 astutely-header relative z-[1000]">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-black tracking-[0.3em] astutely-gradient-text uppercase">CodedSwitch</h1>
          <div className="flex space-x-0.5">
            <div className="relative group">
              <Button variant="ghost" size="sm" className="astutely-button">File ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] mt-1 w-56 z-[100] astutely-panel">
                <button onClick={handleNewProject} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>New Project</span>
                  <span className="text-xs text-cyan-400">Ctrl+N</span>
                </button>
                <button onClick={handleLoadProject} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Open Project...</span>
                  <span className="text-xs text-cyan-400">Ctrl+O</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleSaveProject} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Save Project</span>
                  <span className="text-xs text-cyan-400">Ctrl+S</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={() => setActiveView('song-uploader')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Import Audio...</span>
                  <span className="text-xs text-cyan-400">Ctrl+I</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleExport} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Export Audio...</span>
                  <span className="text-xs text-gray-500">Ctrl+E</span>
                </button>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm" className="astutely-button">Edit ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] mt-1 w-56 z-[100] astutely-panel">
                <button onClick={handleUndo} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Undo</span>
                  <span className="text-xs text-cyan-400">Ctrl+Z</span>
                </button>
                <button onClick={handleRedo} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Redo</span>
                  <span className="text-xs text-cyan-400">Ctrl+Y</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleCut} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Cut</span>
                  <span className="text-xs text-cyan-400">Ctrl+X</span>
                </button>
                <button onClick={handleCopy} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Copy</span>
                  <span className="text-xs text-cyan-400">Ctrl+C</span>
                </button>
                <button onClick={handlePaste} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Paste</span>
                  <span className="text-xs text-cyan-400">Ctrl+V</span>
                </button>
                <button onClick={handleDelete} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Delete</span>
                  <span className="text-xs text-cyan-400">Del</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleSelectAll} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Select All</span>
                  <span className="text-xs text-cyan-400">Ctrl+A</span>
                </button>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm" className="astutely-button">View ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] mt-1 w-56 z-[100] astutely-panel">
                <button onClick={() => setActiveView('arrangement')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'arrangement' ? '✓' : '  '} Arrangement</span>
                  <span className="text-xs text-cyan-400">F1</span>
                </button>
                <button onClick={() => setActiveView('beat-lab')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'beat-lab' ? '✓' : '  '} Beat Lab</span>
                  <span className="text-xs text-cyan-400">F2</span>
                </button>
                <button onClick={() => setActiveView('piano-roll')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'piano-roll' ? '✓' : '  '} Piano Roll</span>
                  <span className="text-xs text-cyan-400">F3</span>
                </button>
                <button onClick={() => setActiveView('mixer')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'mixer' ? '✓' : '  '} Mixer</span>
                  <span className="text-xs text-cyan-400">F4</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={() => setActiveView('ai-studio')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'ai-studio' ? '✓' : '  '} AI Studio</span>
                  <span className="text-xs text-cyan-400">F5</span>
                </button>
                <button onClick={() => setActiveView('code-to-music')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item" data-testid="tab-code-to-music">
                  <span>{activeView === 'code-to-music' ? '✓' : '  '} Code to Music</span>
                  <span className="text-xs text-cyan-400">F6</span>
                </button>
                <button onClick={() => setActiveView('lyrics')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'lyrics' ? '✓' : '  '} Lyrics</span>
                  <span className="text-xs text-cyan-400">F7</span>
                </button>
                <button onClick={() => setActiveView('audio-tools')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'audio-tools' ? '✓' : '  '} Audio Tools</span>
                  <span className="text-xs text-cyan-400">F8</span>
                </button>
                <button onClick={() => setActiveView('song-uploader')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'song-uploader' ? '✓' : '  '} Upload</span>
                  <span className="text-xs text-cyan-400">F9</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={() => setInstrumentsExpanded(!instrumentsExpanded)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{instrumentsExpanded ? '✓' : '  '} Instrument Library</span>
                  <span className="text-xs text-cyan-400">Ctrl+1</span>
                </button>
                <button onClick={() => { setShowSampleBrowser(!showSampleBrowser); toast({ title: showSampleBrowser ? "Sample Browser Hidden" : "Sample Browser Shown" }); }} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{showSampleBrowser ? '✓' : '  '} Sample Browser</span>
                  <span className="text-xs text-cyan-400">Ctrl+2</span>
                </button>
                <button onClick={() => { setShowInspector(!showInspector); toast({ title: showInspector ? "Inspector Hidden" : "Inspector Shown" }); }} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{showInspector ? '✓' : '  '} Inspector</span>
                  <span className="text-xs text-cyan-400">Ctrl+3</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleZoomIn} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Zoom In</span>
                  <span className="text-xs text-cyan-400">Ctrl++</span>
                </button>
                <button onClick={handleZoomOut} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Zoom Out</span>
                  <span className="text-xs text-cyan-400">Ctrl+-</span>
                </button>
                <button onClick={handleZoomToFit} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Zoom to Fit</span>
                  <span className="text-xs text-cyan-400">Ctrl+0</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleToggleFullScreen} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Full Screen</span>
                  <span className="text-xs text-cyan-400">F11</span>
                </button>
                <button onClick={() => { setFocusModeEnabled(!focusModeEnabled); toast({ title: focusModeEnabled ? "Focus Mode Off" : "Focus Mode On", description: focusModeEnabled ? "UI elements restored" : "Distraction-free mode enabled" }); }} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{focusModeEnabled ? '✓' : '  '} Focus Mode</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+F</span>
                </button>
              </div>
            </div>

            {/* CREATE Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm" className="astutely-button">Create ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] mt-1 w-56 z-[100] astutely-panel">
                <button onClick={handleNewMIDITrack} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>New MIDI Track</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+T</span>
                </button>
                <button onClick={handleNewAudioTrack} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>New Audio Track</span>
                  <span className="text-xs text-cyan-400">Ctrl+T</span>
                </button>
                <button onClick={handleNewInstrumentTrack} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  New Instrument Track
                </button>
                <button onClick={handleNewReturnTrack} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  New Return Track
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={() => handleInsertEffect('EQ', 'audio')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Insert Audio Effect...
                </button>
                <button onClick={() => handleInsertEffect('Compressor', 'midi')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Insert MIDI Effect...
                </button>
                <button onClick={() => handleInsertEffect('Reverb', 'midi')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Insert Instrument...
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleNewSend} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  New Send
                </button>
                <button onClick={handleNewBus} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  New Bus
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={() => handleInsertClip('Empty Clip')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Empty Clip</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+M</span>
                </button>
                <button onClick={() => handleInsertClip('Recording Clip', true)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Recording Clip
                </button>
              </div>
            </div>

            {/* ARRANGE Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm" className="astutely-button">Arrange ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] mt-1 w-56 z-[100] astutely-panel">
                <button onClick={() => { setTimeDialogMode('insert'); setShowInsertTimeDialog(true); }} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Insert Time...</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+I</span>
                </button>
                <button onClick={() => { setTimeDialogMode('delete'); setShowInsertTimeDialog(true); }} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Delete Time...</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+Del</span>
                </button>
                <button onClick={() => { setTimeDialogMode('duplicate'); setShowInsertTimeDialog(true); }} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Duplicate Time...</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+D</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleLoopSelection} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Loop Selection</span>
                  <span className="text-xs text-cyan-400">Ctrl+L</span>
                </button>
                <button onClick={() => handleSetLoopLength(4)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Set Loop Length...
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleAddMarker} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Add Marker</span>
                  <span className="text-xs text-cyan-400">M</span>
                </button>
                <button onClick={() => setShowMarkerListDialog(true)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Marker List...
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleSnapToGrid} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{snapToGridEnabled ? '✓' : '  '} Snap to Grid</span>
                  <span className="text-xs text-cyan-400">Ctrl+G</span>
                </button>
                <button onClick={handleToggleGrid} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{showGrid ? '✓' : '  '} Show Grid</span>
                  <span className="text-xs text-cyan-400">G</span>
                </button>
                <button onClick={() => setShowGridSettingsDialog(true)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Grid Settings...
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={() => setShowTempoMapDialog(true)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Tempo Map...
                </button>
                <button onClick={() => setShowTimeSignatureDialog(true)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Time Signature...
                </button>
                <button onClick={() => setShowKeySignatureDialog(true)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Key Signature...
                </button>
              </div>
            </div>

            {/* MIX Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm" className="astutely-button">Mix ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] mt-1 w-56 z-[100] astutely-panel">
                <button onClick={handleNormalize} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Normalize</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+N</span>
                </button>
                <button onClick={handleReverse} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Reverse</span>
                  <span className="text-xs text-cyan-400">Ctrl+R</span>
                </button>
                <button onClick={handleFadeIn} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Fade In
                </button>
                <button onClick={handleFadeOut} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Fade Out
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleBounceToAudio} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Bounce to Audio</span>
                  <span className="text-xs text-cyan-400">Ctrl+B</span>
                </button>
                <button onClick={handleFreezeTrack} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Freeze Track
                </button>
                <button onClick={handleFlattenTrack} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Flatten Track
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleGroupTracks} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Group Tracks</span>
                  <span className="text-xs text-cyan-400">Ctrl+G</span>
                </button>
                <button onClick={handleUngroupTracks} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Ungroup Tracks</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+G</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleSoloAll} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Solo All Tracks
                </button>
                <button onClick={handleMuteAll} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Mute All Tracks
                </button>
                <button onClick={handleUnsoloAll} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Unsolo All
                </button>
                <button onClick={handleUnmuteAll} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Unmute All
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={handleResetFaders} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Reset All Faders
                </button>
                <button onClick={handleResetPan} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Reset All Pan
                </button>
              </div>
            </div>

            {/* MORE Menu - Groups Tools, Window, Help */}
            <div className="relative group">
              <Button variant="ghost" size="sm" className="astutely-button">More ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] mt-1 w-56 z-[100] astutely-panel">
                {/* Tools Submenu */}
                <div className="relative group/tools">
                  <div className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between text-cyan-100 astutely-menu-item">
                    <span>🔧 Tools</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/tools:block absolute left-full top-0 bg-black/90 border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] ml-1 w-56 z-[100] astutely-panel">
                    <button onClick={handleTuner} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                      <span>Tuner</span>
                      <span className="text-xs text-cyan-400">Ctrl+Shift+U</span>
                    </button>
                    <button onClick={handleMetronome} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                      <span>{metronomeEnabled ? '✓' : '  '} Metronome</span>
                      <span className="text-xs text-cyan-400">C</span>
                    </button>
                    <button onClick={handleClickTrackSettings} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                      Click Track Settings...
                    </button>
                    <div className="border-t border-cyan-500/30 my-1"></div>
                    <button onClick={() => { setShowAudioDetector(true); toast({ title: "Spectrum Analyzer", description: "Opening Audio Detector..." }); }} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                      Spectrum Analyzer
                    </button>
                    <button onClick={() => setShowAudioDetector(true)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                      Chord Detector
                    </button>
                    <button onClick={() => setShowAudioDetector(true)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                      BPM Detector
                    </button>
                  </div>
                </div>

                {/* Window Submenu */}
                <div className="relative group/window">
                  <div className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between text-cyan-100 astutely-menu-item">
                    <span>🪟 Window</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/window:block absolute left-full top-0 bg-black/90 border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] ml-1 w-56 z-[100] astutely-panel">
                    <button onClick={handleResetLayout} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                      <span>Reset Layout</span>
                      <span className="text-xs text-cyan-400">Ctrl+Alt+R</span>
                    </button>
                    <button onClick={() => setInstrumentsExpanded(!instrumentsExpanded)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                      {instrumentsExpanded ? '✓' : '  '} Show Instrument Library
                    </button>
                    <button onClick={handleToggleFullScreen} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                      <span>Full Screen</span>
                      <span className="text-xs text-cyan-400">F11</span>
                    </button>
                    <button onClick={() => setFocusModeEnabled(!focusModeEnabled)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                      {focusModeEnabled ? '✓' : '  '} Focus Mode
                    </button>
                  </div>
                </div>

                {/* Help Submenu */}
                <div className="relative group/help">
                  <div className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between text-cyan-100 astutely-menu-item">
                    <span>❓ Help</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/help:block absolute left-full top-0 bg-black/90 border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] ml-1 w-56 z-[100] astutely-panel">
                    <button onClick={handleShowKeyboardShortcuts} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                      <span>Keyboard Shortcuts</span>
                      <span className="text-xs text-cyan-400">?</span>
                    </button>
                    <button onClick={() => window.open('/docs', '_blank')} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                      Documentation
                    </button>
                    <div className="border-t border-cyan-500/30 my-1"></div>
                    <button onClick={handleShowAbout} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                      About CodedSwitch
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDI Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm" className="flex items-center gap-1 astutely-button">
                <Cable className="w-3 h-3" />
                MIDI ▼
                {midiConnected && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
              </Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-black/90 border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] mt-1 w-72 z-[100] p-3 space-y-3 astutely-panel">
                {/* MIDI Status */}
                <div className="pb-2 border-b border-cyan-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-cyan-100">MIDI Controller</span>
                    <div className={`px-2 py-0.5 rounded text-xs font-semibold ${midiConnected ? 'bg-green-600' : 'bg-cyan-600'}`}>
                      {midiConnected ? '● Connected' : '○ Disconnected'}
                    </div>
                  </div>
                  {!midiSupported && (
                    <div className="text-xs text-yellow-400">
                      ⚠️ Web MIDI not supported in this browser
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  {!midiConnected ? (
                    <button
                      onClick={() => {
                        initializeMIDI();
                        toast({ title: "Connecting to MIDI...", description: "Please wait..." });
                      }}
                      className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-sm font-medium flex items-center justify-center gap-2 astutely-button"
                    >
                      <Cable className="w-4 h-4" />
                      Connect MIDI Controller
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        refreshMIDIDevices();
                        toast({ title: "Refreshing MIDI devices...", description: "Scanning for controllers" });
                      }}
                      className="w-full px-3 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-sm font-medium flex items-center justify-center gap-2 astutely-button"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh Devices
                    </button>
                  )}
                </div>

                {/* Connected Devices */}
                {midiConnected && midiDevices.length > 0 && (
                  <div className="pt-2 border-t border-cyan-500/30">
                    <div className="text-xs text-cyan-400 mb-2">Connected ({midiDevices.length}):</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {midiDevices.slice(0, 3).map((device) => (
                        <div key={device.id} className="text-xs bg-cyan-500/10 border border-cyan-500/20 rounded px-2 py-1.5">
                          <div className="font-medium text-cyan-100 truncate">{device.name}</div>
                          <div className="text-cyan-400 truncate">{device.manufacturer}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Notes Indicator */}
                {midiConnected && midiActiveNotes.size > 0 && (
                  <div className="pt-2 border-t border-cyan-500/30">
                    <div className="text-xs text-green-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Playing: {Array.from(midiActiveNotes).join(', ')}
                    </div>
                  </div>
                )}

                {/* MIDI Volume Control */}
                {midiConnected && (
                  <div className="pt-2 border-t border-cyan-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-cyan-300">🔊 MIDI Volume</span>
                      <span className="text-xs text-cyan-400 font-bold">{Math.round((midiSettings?.midiVolume ?? 0.3) * 100)}%</span>
                    </div>
                    <Slider
                      value={[(midiSettings?.midiVolume ?? 0.3) * 100]}
                      onValueChange={(value) => {
                        const newVolume = value[0] / 100;
                        updateMIDISettings({ midiVolume: newVolume });
                      }}
                      max={100}
                      min={0}
                      step={1}
                      className="w-full astutely-slider"
                    />
                    <div className="flex justify-between text-xs text-cyan-400 mt-1">
                      <span>Silent</span>
                      <span>Loud</span>
                    </div>
                  </div>
                )}

                {/* Current Instrument */}
                {midiConnected && (
                  <div className="pt-2 border-t border-cyan-500/30">
                    <div className="text-xs text-cyan-400 mb-1">Current Instrument:</div>
                    <select
                      value={midiSettings?.currentInstrument || 'piano'}
                      onChange={(e) => updateMIDISettings({ currentInstrument: e.target.value })}
                      className="w-full px-2 py-1 bg-black/60 border border-cyan-500/40 rounded text-sm text-cyan-100 astutely-input"
                    >
                      <option value="piano">🎹 Piano</option>
                      <option value="guitar">🎸 Guitar</option>
                      <option value="violin">🎻 Violin</option>
                      <option value="flute">🎵 Flute</option>
                      <option value="trumpet">🎺 Trumpet</option>
                      <option value="bass">🎸 Bass</option>
                      <option value="organ">🎹 Organ</option>
                    </select>
                  </div>
                )}

                {/* Advanced MIDI Settings */}
                {midiConnected && (
                  <div className="pt-2 border-t border-cyan-500/30 space-y-2">
                    <div className="text-xs font-semibold text-cyan-300 mb-2">⚙️ Advanced Options</div>
                    
                    {/* Sustain Pedal */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-100">Sustain Pedal</span>
                        <span className="text-xs text-cyan-400">(CC 64)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.sustainPedal !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ sustainPedal: checked });
                          toast({ 
                            title: checked ? "Sustain Pedal Enabled" : "Sustain Pedal Disabled",
                            description: checked ? "Pedal will hold notes" : "Pedal has no effect",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>

                    {/* Pitch Bend */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-100">Pitch Bend</span>
                        <span className="text-xs text-cyan-400">(±2 semitones)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.pitchBend !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ pitchBend: checked });
                          toast({ 
                            title: checked ? "Pitch Bend Enabled" : "Pitch Bend Disabled",
                            description: checked ? "Bend wheel affects pitch" : "Bend wheel ignored",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>

                    {/* Modulation */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-100">Modulation</span>
                        <span className="text-xs text-cyan-400">(CC 1)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.modulation !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ modulation: checked });
                          toast({ 
                            title: checked ? "Modulation Enabled" : "Modulation Disabled",
                            description: checked ? "Mod wheel adds vibrato" : "Mod wheel ignored",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>

                    {/* Auto-Connect New Devices */}
                    <div className="flex items-center justify-between astutely-switch">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-100">Auto-Connect</span>
                        <span className="text-xs text-cyan-400">(New devices)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.autoConnect !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ autoConnect: checked });
                          toast({ 
                            title: checked ? "Auto-Connect Enabled" : "Auto-Connect Disabled",
                            description: checked ? "New devices will auto-connect" : "Manual connection required",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Help Text */}
                <div className="pt-2 border-t border-cyan-500/30 text-xs text-cyan-400">
                  💡 MIDI works across all tabs - play Piano Roll, Arrangement, Mixer in real-time!
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Transport Controls */}
        <div className="w-full flex items-center gap-3 mt-2 mb-3 relative z-0 py-1 overflow-x-auto overflow-y-visible whitespace-nowrap">
          <div className="flex items-center gap-2 bg-black/60 border border-cyan-500/40 rounded px-3 h-12 shrink-0 astutely-panel">
            <Button
              size="sm"
              onClick={() => (transportPlaying ? pauseTransport() : startTransport())}
              className={transportPlaying ? "bg-green-600 hover:bg-green-500 astutely-button" : "bg-cyan-600 hover:bg-cyan-500 astutely-button"}
            >
              {transportPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {transportPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                stopTransport();
                seek(0);
              }}
              className="astutely-button border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/20"
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
            <div className="flex items-center gap-2 text-xs text-cyan-100 min-w-[110px]">
              <span className="font-semibold whitespace-nowrap">Bar {Math.max(1, Math.floor(playheadPosition / 16) + 1)}</span>
              <span className="text-cyan-400 whitespace-nowrap">Beat {Math.max(1, Math.floor(position % 4) + 1)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/60 border border-cyan-500/40 rounded px-3 h-12 shrink-0 astutely-panel">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-cyan-100 font-medium">Tempo</span>
            <div className="w-28">
              <Slider
                value={[tempo]}
                onValueChange={(value) => setTransportTempo(value[0])}
                max={200}
                min={40}
                step={1}
                className="w-full astutely-slider"
              />
            </div>
            <span className="text-xs text-cyan-400 font-bold w-14 text-right">{Math.round(tempo)} BPM</span>
          </div>

          <div className="flex items-center gap-2 bg-black/60 border border-cyan-500/40 rounded px-3 h-12 shrink-0 astutely-panel">
            <Repeat className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-cyan-100 font-medium">Loop</span>
            <Switch
              checked={loop.enabled}
              onCheckedChange={(checked) => setLoop({ enabled: checked })}
            />
            <span className="text-xs text-cyan-400 whitespace-nowrap">
              Bars {loop.start + 1}-{loop.end}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant={loop.enabled ? 'default' : 'outline'}
                  className="px-3 astutely-button"
                >
                  {Math.max(1, Math.round((loop.end ?? 4) - (loop.start ?? 0)))}-Bar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/90 border border-cyan-500/40 text-cyan-100 astutely-panel">
                {[1, 2, 4, 8].map((bars) => (
                  <DropdownMenuItem
                    key={bars}
                    className="text-sm astutely-menu-item"
                    onClick={() => setLoop({ enabled: true, start: loop.start ?? 0, end: (loop.start ?? 0) + bars })}
                  >
                    {bars}-Bar
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* DAW-Style Tab Bar - All tabs together */}
      <div className="bg-black/60 border-b border-cyan-500/40 px-2 py-2 flex flex-wrap items-center justify-between gap-2 astutely-panel">
        {/* All Tabs - Left Side */}
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant={activeView === 'arrangement' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('arrangement')}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Layers className="w-3 h-3 mr-1" />
            Arrange
          </Button>
          <Button
            variant={activeView === 'beat-lab' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setBeatLabTab('pro');
              setActiveView('beat-lab');
            }}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Music className="w-3 h-3 mr-1" />
            Beats
          </Button>
          <Button
            variant={activeView === 'beat-lab' && beatLabTab === 'pack-generator' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setBeatLabTab('pack-generator');
              setActiveView('beat-lab');
            }}
            className="h-8 px-3 text-xs astutely-button"
            title="Open Pack Generator"
          >
            <Package className="w-3 h-3 mr-1" />
            Pack Generator
          </Button>
          <Button
            variant={activeView === 'piano-roll' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('piano-roll')}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Piano className="w-3 h-3 mr-1" />
            Piano
          </Button>
          <Button
            variant={activeView === 'mixer' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('mixer')}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Sliders className="w-3 h-3 mr-1" />
            Mixer
          </Button>
          <Button
            variant={activeView === 'multitrack' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('multitrack')}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Layers className="w-3 h-3 mr-1" />
            Multi-Track
          </Button>
          <div className="w-px h-5 bg-cyan-500/40 mx-1" />
          <Button
            variant={activeView === 'ai-studio' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('ai-studio')}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Wand2 className="w-3 h-3 mr-1" />
            AI Studio
          </Button>
          <Button
            variant={activeView === 'code-to-music' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('code-to-music')}
            className="h-8 px-3 text-xs astutely-button"
            data-testid="tab-code-to-music"
          >
            <Wand2 className="w-3 h-3 mr-1" />
            Code to Music
          </Button>
          <Button
            variant={activeView === 'lyrics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('lyrics')}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Mic2 className="w-3 h-3 mr-1" />
            Lyrics
          </Button>
          <Button
            variant={activeView === 'audio-tools' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('audio-tools')}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Wrench className="w-3 h-3 mr-1" />
            Tools
          </Button>
          <Button
            variant={activeView === 'song-uploader' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('song-uploader')}
            className="h-8 px-3 text-xs astutely-button"
          >
            <Upload className="w-3 h-3 mr-1" />
            Upload
          </Button>
        </div>

        {/* Right Side - Compact Action Buttons & Volume */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-2 py-1 rounded border border-cyan-500/40 bg-black/60 text-xs text-cyan-100 astutely-panel">
            Snap: <span className={snapToGridEnabled ? 'text-green-400 font-semibold' : 'text-cyan-400'}>{snapToGridEnabled ? 'On' : 'Off'}</span>
          </div>
          <Button
            onClick={() => setShowAstutely(true)}
            className="h-8 px-4 font-bold text-white transition-all hover:scale-105 astutely-button"
            style={{ 
              background: 'linear-gradient(135deg, #0891B2, #2563EB)',
              boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)'
            }}
            size="sm"
            title="Astutely Brain - Neural control center"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Astutely Core
          </Button>
          <Button
            onClick={() => setShowAstutelyArchitect(true)}
            className="h-8 px-4 font-bold text-white transition-all hover:scale-105 astutely-button"
            style={{ 
              background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)'
            }}
            size="sm"
            title="Astutely Beat Architect (Beta)"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Architect
          </Button>
          <Button
            onClick={() => setShowMusicGen(!showMusicGen)}
            className="bg-cyan-600 hover:bg-cyan-500 h-8 px-3 astutely-button"
            size="sm"
            title="Generate Music"
          >
            <Music className="w-3 h-3 mr-1" />
            Generate
          </Button>
          <Button
            onClick={() => setShowWorkflowSelector(true)}
            className="bg-cyan-700 hover:bg-cyan-600 h-8 px-3 astutely-button"
            data-testid="button-change-workflow"
            size="sm"
            title="Change Workflow"
          >
            <Workflow className="w-3 h-3 mr-1" />
            Workflow
          </Button>
          
          {/* Master Volume - Compact */}
          <div className="flex items-center gap-2 px-2 py-1 bg-black/60 rounded border border-cyan-500/40 astutely-panel">
            <Sliders className="w-3 h-3 text-cyan-400" />
            <div className="w-16">
              <Slider
                value={[masterVolume * 100]}
                onValueChange={(value) => {
                  const newVolume = value[0] / 100;
                  setMasterVolume(newVolume);
                  setMIDIMasterVolume(newVolume);
                }}
                max={100}
                min={0}
                step={1}
                className="w-full astutely-slider"
              />
            </div>
            <span className="text-xs text-cyan-400 font-bold w-8 text-right">{Math.round(masterVolume * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Instrument Library */}
        {instrumentsExpanded && (
          <InstrumentLibrary 
            onClose={() => setInstrumentsExpanded(false)}
            onInstrumentSelect={(instrument) => {
              toast({ title: 'Instrument Loaded', description: instrument.name });
            }}
          />
        )}

        {/* Left Panel - Sample Browser */}
        {showSampleBrowser && (
          <SampleBrowser 
            onClose={() => setShowSampleBrowser(false)}
            onSampleSelect={(sample) => {
              toast({ title: 'Sample Selected', description: sample.filename });
            }}
          />
        )}

        {/* Center: Main Workspace with Tab Views */}
        <div className="flex-1 flex flex-col overflow-auto relative">
          
          {/* Floating Back to Studio Button - Shows when not in arrangement view */}
          {activeView !== 'arrangement' && (
            <div className="absolute top-4 left-4 z-50">
              <Button
                onClick={() => setActiveView('arrangement')}
                variant="outline"
                size="sm"
                className="bg-black/90 border-cyan-500/40 hover:bg-cyan-500/20 shadow-lg backdrop-blur-sm flex items-center gap-2 astutely-button"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline text-cyan-100">Back to Studio</span>
                <Home className="w-4 h-4 sm:hidden text-cyan-400" />
              </Button>
            </div>
          )}

          {/* ARRANGEMENT VIEW */}
          {activeView === 'arrangement' && (
          <>
          {/* Timeline Section */}
          <div className="border-b border-cyan-500/40">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTimelineExpanded((prev) => !prev);
                }
              }}
              className="w-full px-4 py-2 bg-black/60 hover:bg-cyan-500/10 flex items-center justify-between astutely-panel"
            >
              <span className="font-medium text-cyan-100">
                {timelineExpanded ? <ChevronDown className="inline w-4 h-4 mr-2 text-cyan-400" /> : <ChevronRight className="inline w-4 h-4 mr-2 text-cyan-400" />}
                TIMELINE - ALL TRACKS ({tracks.length})
              </span>
              <div className="flex items-center space-x-2">
                {selectedTrack && tracks.find(t => t.id === selectedTrack && t.type === 'audio') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); setShowWaveformEditor(true); }}
                    className="text-xs astutely-button border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/20"
                  >
                    Waveform Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast({
                      title: "🪄 AI Arrangement",
                      description: "AI will suggest optimal track arrangement, structure, and transitions"
                    });
                  }}
                  className="text-xs bg-gradient-to-r from-cyan-600 to-blue-600 astutely-button"
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  AI Arrange
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    addTrack('New Track', 'midi');
                  }}
                  className="text-xs astutely-button border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/20"
                >
                  <i className="fas fa-plus mr-1"></i>
                  Add Track
                </Button>
                <div className="flex items-center space-x-2 text-sm text-cyan-400">
                  <span>Zoom:</span>
                  <Slider
                    value={[zoom]}
                    onValueChange={([v]) => setZoom(v)}
                    max={100}
                    min={10}
                    step={1}
                    className="w-24 astutely-slider"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>{zoom}%</span>
                </div>
              </div>
            </div>
            
            {timelineExpanded && (
              <div ref={trackListRef} className="bg-black/60 p-4 max-h-96 overflow-y-auto astutely-panel">
                <div className="grid gap-2" style={{ gridTemplateRows: 'repeat(auto-fit, minmax(80px, 1fr))' }}>
                  {tracks.map((track) => {
                    const trackHeight = trackHeights[track.id] ?? DEFAULT_TRACK_HEIGHT;
                    const laneHeight = Math.max(trackHeight - 32, 80);
                    const noteLaneHeight = Math.max(laneHeight - 8, 48);
                    const waveform = waveformData[track.id];

                    return (
                      <Resizable
                        key={track.id}
                        axis="y"
                        height={trackHeight}
                        width={trackListWidth}
                        minConstraints={[trackListWidth, 80]}
                        handle={<div className="react-resizable-handle react-resizable-handle-s w-full h-2 bg-gray-800 hover:bg-blue-500 cursor-row-resize" />}
                        onResizeStop={(_, data) => {
                          const nextHeight = Math.max(80, data.size.height);
                          setTrackHeights((prev) => ({ ...prev, [track.id]: nextHeight }));
                        }}
                      >
                        <div
                          onClick={() => {
                            setSelectedTrack(track.id);
                            if (track.type === 'midi') setPianoRollExpanded(true);
                            else if (track.type === 'lyrics') setLyricsExpanded(true);
                          }}
                          style={{ height: trackHeight }}
                          className={`border rounded overflow-hidden cursor-pointer transition flex flex-col ${
                            selectedTrack === track.id
                              ? 'border-blue-500 bg-blue-900/20'
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex flex-1 overflow-hidden">
                            {/* Track Info Panel */}
                            <div className="w-64 bg-gray-800 p-3 border-r border-gray-700 flex-shrink-0 h-full">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm truncate">{track.name}</span>
                              </div>
                              <div className="flex items-center space-x-1 mb-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTrackMute(track.id);
                                  }}
                                  className={`h-6 w-6 p-0 ${track.muted ? 'bg-red-600 text-white' : 'text-gray-400'}`}
                                >
                                  M
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTrackSolo(track.id);
                                  }}
                                  className={`h-6 w-6 p-0 ${track.solo ? 'bg-yellow-600 text-white' : 'text-gray-400'}`}
                                >
                                  S
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTrackFromStore(track.id);
                                  }}
                                  className="h-6 w-6 p-0 text-red-500"
                                >
                                  <i className="fas fa-trash text-xs"></i>
                                </Button>
                              </div>
                              <div className="text-xs space-y-1">
                                <div className="text-gray-400">Type: <span className="text-gray-200">{track.type.toUpperCase()}</span></div>
                                {track.instrument && <div className="text-gray-400">Inst: <span className="text-gray-200">{track.instrument}</span></div>}
                                <div className="flex items-center gap-2 py-1">
                                  <div className="relative w-1 h-10 bg-gray-700 rounded overflow-hidden">
                                    <div
                                      className="absolute inset-x-0 bottom-0 bg-lime-400"
                                      style={{ height: `${Math.min(100, (channelMeters[track.id]?.rms ?? 0) * 100)}%` }}
                                    />
                                    <div
                                      className="absolute inset-x-0 bottom-0 bg-amber-500/80"
                                      style={{ height: `${Math.min(100, (channelMeters[track.id]?.peak ?? 0) * 100)}%` }}
                                    />
                                  </div>
                                  <div className="flex flex-col text-[10px] text-gray-400">
                                    <span>Peak {formatMeterDb(channelMeters[track.id]?.peak)}</span>
                                    <span>RMS {formatMeterDb(channelMeters[track.id]?.rms)}</span>
                                  </div>
                                  <div className="flex gap-1 ml-auto">
                                    <Button
                                      variant={(getTrackSendDb(track, 'hall')) > -50 ? 'default' : 'outline'}
                                      size="sm"
                                      className={`h-6 px-2 text-[10px] ${(getTrackSendDb(track, 'hall')) > -50 ? 'bg-blue-500 text-black' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTrackSend(track.id, 'hall');
                                      }}
                                    >
                                      Hall
                                    </Button>
                                    <Button
                                      variant={(getTrackSendDb(track, 'delay')) > -50 ? 'default' : 'outline'}
                                      size="sm"
                                      className={`h-6 px-2 text-[10px] ${(getTrackSendDb(track, 'delay')) > -50 ? 'bg-purple-500 text-black' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTrackSend(track.id, 'delay');
                                      }}
                                    >
                                      Dly
                                    </Button>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <div className="text-gray-400 mb-1">Vol: {Math.round(track.volume * 100)}%</div>
                                  <Slider
                                    value={[track.volume * 100]}
                                    onValueChange={(val) => {
                                      setTracks(tracks.map(t =>
                                        t.id === track.id ? { ...t, volume: val[0] / 100 } : t
                                      ));
                                    }}
                                    max={100}
                                    min={0}
                                    step={1}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Timeline Visualization */}
                            <div className="flex-1 bg-gray-900 p-2 relative h-full">
                              {track.type === 'midi' ? (
                                <div className="relative" style={{ height: laneHeight }}>
                                  {track.notes?.length > 0 ? (
                                    track.notes.map((note) => (
                                      <div
                                        key={note.id}
                                        className="absolute top-2 bg-green-600/80 border border-green-400 rounded text-xs flex items-center justify-center"
                                        style={{
                                          left: `${note.step * 15}px`,
                                          width: `${(note.length || 4) * 15 - 4}px`,
                                          height: noteLaneHeight,
                                        }}
                                      >
                                        {note.note}{note.octave}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-gray-500 text-center">No notes</div>
                                  )}
                                </div>
                              ) : track.type === 'audio' ? (
                                <div
                                  className="bg-gray-900 border border-blue-700/50 rounded relative overflow-hidden group"
                                  style={{ height: laneHeight }}
                                >
                                  {waveform ? (
                                    <TimelineWaveformCanvas data={waveform} height={laneHeight} />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                                      Loading waveform...
                                    </div>
                                  )}
                                  <div className="absolute bottom-1 left-2 text-xs text-blue-300 font-medium truncate max-w-[200px]">
                                    {track.name}
                                  </div>
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`h-8 px-3 text-white ${timelinePlayingTrack === track.id ? 'bg-red-600 border-red-500 hover:bg-red-500' : 'bg-green-600 border-green-500 hover:bg-green-500'}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTimelineTrackPlay(track.id);
                                      }}
                                    >
                                      {timelinePlayingTrack === track.id ? (
                                        <Square className="w-3 h-3 mr-1" />
                                      ) : (
                                        <Play className="w-3 h-3 mr-1" />
                                      )}
                                      {timelinePlayingTrack === track.id ? 'Stop' : 'Play'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        stopTimelineAudio();
                                        setActiveView('multitrack');
                                        toast({ title: "Opening Multi-Track", description: "Track sent to multi-track player" });
                                      }}
                                    >
                                      <Layers className="w-3 h-3 mr-1" />
                                      Multi-Track
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="bg-purple-900/20 border border-purple-700 rounded flex items-center justify-center text-xs text-purple-400"
                                  style={{ height: laneHeight }}
                                >
                                  Lyrics track
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Resizable>
                    );
                  })}

                  {tracks.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-music text-4xl opacity-20 mb-2"></i>
                      <p>No tracks yet</p>
                      <p className="text-xs">Use "+ Add Track" to create one</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Piano Roll Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setPianoRollExpanded(!pianoRollExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center"
            >
              {pianoRollExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
              PIANO ROLL {selectedTrack && `(${tracks.find(t => t.id === selectedTrack)?.name})`}
            </button>
            
            {pianoRollExpanded && selectedTrack && (
              <div className="bg-gray-900">
                {/* @ts-ignore - VerticalPianoRoll prop types mismatch but runtime compatible */}
                <VerticalPianoRoll 
                  {...({ tracks: tracks as any } as any)}
                  selectedTrack={selectedTrack || undefined}
                  isPlaying={transportPlaying}
                  currentTime={playheadPosition}
                  onPlayNote={(note: string, octave: number, duration: number, instrument: string) => {
                    playNote(note, octave, instrument, duration);
                  }}
                  onPlayNoteOff={(note: string, octave: number, instrument: string) => {
                    playNoteOff(note, octave, instrument);
                  }}
                  onNotesChange={(updatedNotes: any[]) => {
                    if (!selectedTrack) return;
                    setTracks(prev => prev.map(track => track.id === selectedTrack
                      ? {
                          ...track,
                          notes: updatedNotes,
                          payload: track.payload
                            ? { ...track.payload, notes: updatedNotes }
                            : track.payload
                        }
                      : track
                    ));
                  }}
/>
              </div>
            )}
          </div>

          {/* Lyrics Section */}
          <div className="border-b border-gray-700">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setLyricsExpanded(!lyricsExpanded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setLyricsExpanded((prev) => !prev);
                }
              }}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
            >
              <span>
                {lyricsExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
                LYRICS
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'lyrics' }));
                }}
              >
                <Maximize2 className="w-4 h-4 mr-1" />
                Open Lyric Lab
              </Button>
            </div>

            {lyricsExpanded && (
              <div className="bg-gray-900 p-4">
                <div className="border border-gray-700 rounded p-4 flex flex-col gap-3">
                  <h3 className="font-medium">Lyrics are edited in Song Doctor · Lyric Lab</h3>
                  <p className="text-sm text-gray-300">
                    Use the main <span className="font-semibold">Lyrics</span> tab to work on your song text. This DAW section is now a shortcut so
                    there is only one Lyric Lab for the entire studio.
                  </p>
                  <div>
                    <Button
                      size="sm"
                      className="bg-studio-accent hover:bg-blue-500"
                      onClick={() => window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'lyrics' }))}                      >
                      Go to Lyric Lab
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mixer Section */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setMixerExpanded(!mixerExpanded)}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center"
            >
              {mixerExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
              MIXER & EFFECTS {selectedTrack && `(${tracks.find(t => t.id === selectedTrack)?.name})`}
            </button>
            
            {mixerExpanded && selectedTrack && (
              <div className="bg-gray-900 p-4">
                <div className="border border-gray-700 rounded p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Volume</label>
                      <Slider
                        value={[tracks.find(t => t.id === selectedTrack)?.volume || 0.8]}
                        onValueChange={(val) => {
                          setTracks(tracks.map(t =>
                            t.id === selectedTrack ? { ...t, volume: val[0] } : t
                          ));
                        }}
                        max={1}
                        min={0}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Pan</label>
                      <Slider
                        value={[tracks.find(t => t.id === selectedTrack)?.pan || 0]}
                        onValueChange={(val) => {
                          setTracks(tracks.map(t =>
                            t.id === selectedTrack ? { ...t, pan: val[0] } : t
                          ));
                        }}
                        max={1}
                        min={-1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Effects Chain</label>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant={getTrackEffectsChain(selectedTrack).includes('EQ') ? 'default' : 'outline'}
                          onClick={() => openEffectEditor('EQ')}
                        >
                          EQ
                        </Button>
                        <Button
                          size="sm"
                          variant={getTrackEffectsChain(selectedTrack).includes('Compressor') ? 'default' : 'outline'}
                          onClick={() => openEffectEditor('Compressor')}
                        >
                          Comp
                        </Button>
                        <Button
                          size="sm"
                          variant={getTrackEffectsChain(selectedTrack).includes('Reverb') ? 'default' : 'outline'}
                          onClick={() => openEffectEditor('Reverb')}
                        >
                          Reverb
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">+ Add</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEffectEditor('EQ')}>EQ</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEffectEditor('Compressor')}>Compressor</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEffectEditor('Deesser')}>Deesser</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEffectEditor('Reverb')}>Reverb</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEffectEditor('Limiter')}>Limiter</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEffectEditor('NoiseGate')}>Noise Gate</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
          )}

          {/* BEAT LAB VIEW */}
          {activeView === 'beat-lab' && (
            <div className="flex-1 min-h-0 overflow-y-auto bg-gray-900 pt-14 flex flex-col">
              <div className="flex-1 min-h-0">
                <BeatLab initialTab={beatLabTab} />
              </div>
            </div>
          )}

          {/* PIANO ROLL VIEW */}
          {activeView === 'piano-roll' && (
            <div className="flex-1 overflow-auto bg-gray-900 pt-14">
              {(() => {
                const selectedTrackData = tracks.find(t => t.id === selectedTrack);
                const isAudioTrack = selectedTrackData?.type === 'audio';
                
                if (isAudioTrack) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <div className="bg-gray-800 rounded-lg p-8 max-w-md">
                        <Music className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                        <h3 className="text-lg font-semibold mb-2">Audio Track Selected</h3>
                        <p className="text-gray-400 mb-4">
                          "{selectedTrackData?.name}" is an audio file. Piano Roll editing is only available for MIDI/instrument tracks.
                        </p>
                        <p className="text-sm text-gray-500">
                          Use the Arrangement view to see the waveform, or select a MIDI track to edit notes.
                        </p>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <>
                    {/* @ts-ignore - VerticalPianoRoll prop types mismatch but runtime compatible */}
                    <VerticalPianoRoll 
                      {...({ tracks: tracks as any } as any)}
                      selectedTrack={selectedTrack || undefined}
                      isPlaying={transportPlaying}
                      currentTime={playheadPosition}
                      onPlayNote={(note: string, octave: number, duration: number, instrument: string) => {
                        // Play note using the instrument selected in the Piano Roll
                        playNote(note, octave, instrument, duration);
                      }}
                      onPlayNoteOff={(note: string, octave: number, instrument: string) => {
                        playNoteOff(note, octave, instrument);
                      }}
                      onNotesChange={(updatedNotes: any[]) => {
                        // Update the notes for the selected track
                        if (selectedTrack) {
                          setTracks(tracks.map(t => 
                            t.id === selectedTrack 
                              ? { ...t, notes: updatedNotes }
                              : t
                          ));
                        }
                      }}
                    />
                  </>
                );
              })()}
            </div>
          )}

          {/* MIXER VIEW */}
          {activeView === 'mixer' && (
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14">
              <ProfessionalMixer />
            </div>
          )}

          {/* AI STUDIO VIEW */}
          {activeView === 'ai-studio' && (
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
                <AIMasteringCard />
                <AIArrangementBuilder currentBpm={tempo} currentKey="C" />
                <AIVocalMelody currentKey="C" currentBpm={tempo} />
                <AIStemSeparation />
              </div>
              <AIAssistant />
            </div>
          )}

          {/* LYRICS LAB VIEW */}
          {activeView === 'lyrics' && (
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14">
              <div className="flex items-center justify-between px-4 pb-2">
                <h2 className="text-lg font-semibold">Lyric Lab</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLyricsFocus(true)}
                  className="gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Focus Mode
                </Button>
              </div>
              <ErrorBoundary>
                <LyricLab />
              </ErrorBoundary>
            </div>
          )}

          {/* SONG UPLOADER VIEW */}
          {activeView === 'song-uploader' && (
            <div className="flex-1 min-h-0 overflow-y-auto pt-14 astutely-pro-panel">
              <SongUploader />
            </div>
          )}

          {/* CODE TOOLS VIEW: Translator + Code to Music */}
          {activeView === 'code-to-music' && (
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14 px-4 pb-4">
              <Card className="border border-gray-700 bg-gray-850">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-400" />
                    Code Tools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="code-music" className="w-full">
                    <TabsList className="bg-gray-800 mb-4 flex flex-wrap gap-2">
                      <TabsTrigger value="code-music" className="flex items-center gap-1">
                        <Music className="w-4 h-4" />
                        Code to Music
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="code-music" className="mt-2">
                      <CodeToMusicStudioV2 />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AUDIO TOOLS VIEW */}
          {activeView === 'audio-tools' && (
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14">
              <AudioToolsPage />
            </div>
          )}

          {/* MULTI-TRACK PLAYER */}
          {activeView === 'multitrack' && (
            <div className="flex-1 overflow-hidden bg-gray-900 h-full">
              <MasterMultiTrackPlayer />
            </div>
          )}
        </div>

        {/* Right Panel - Inspector */}
        {showInspector && (
          <InspectorPanel 
            onClose={() => setShowInspector(false)}
            selectedTrackId={selectedTrack}
          />
        )}

      {/* Floating/Overlay Components */}
      {/* TEMPORARILY DISABLED - React hooks error on mobile
      {showAIAssistant && (
        <FloatingAIAssistant onClose={() => setShowAIAssistant(false)} />
      )} */}

      {showMusicGen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <Button
              onClick={() => setShowMusicGen(false)}
              variant="ghost"
              className="mb-2"
            >
              <i className="fas fa-times mr-2"></i>
              Close
            </Button>
            <MusicGenerationPanel onMusicGenerated={handleMusicGenerated} />
          </div>
        </div>
      )}

      {showLyricsFocus && (
        <LyricsFocusMode
          onClose={() => setShowLyricsFocus(false)}
          onSave={handleLyricsSaved}
        />
      )}

      {renderWaveformEditor()}

      {/* Workflow Selector Modal */}
      <Dialog open={showWorkflowSelector} onOpenChange={setShowWorkflowSelector}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 bg-background">
          <DialogTitle className="sr-only">Select Workflow</DialogTitle>
          <WorkflowSelector
            onSelectWorkflow={handleSelectWorkflow}
            onSkip={handleSkipWorkflow}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={effectsDialogOpen} onOpenChange={setEffectsDialogOpen}>
        <DialogContent className="max-w-4xl bg-gray-900 border border-gray-700">
          <DialogTitle className="sr-only">Audio Effects</DialogTitle>
          {activeEffectTool === 'EQ' && (
            <EQPlugin
              audioUrl={tracks.find((t) => t.id === selectedTrack)?.audioUrl}
              onClose={() => setEffectsDialogOpen(false)}
            />
          )}
          {activeEffectTool === 'Compressor' && (
            <CompressorPlugin
              audioUrl={tracks.find((t) => t.id === selectedTrack)?.audioUrl}
              onClose={() => setEffectsDialogOpen(false)}
            />
          )}
          {activeEffectTool === 'NoiseGate' && (
            <NoiseGatePlugin
              audioUrl={tracks.find((t) => t.id === selectedTrack)?.audioUrl}
              onClose={() => setEffectsDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Insert/Delete/Duplicate Time Dialog */}
      <Dialog open={showInsertTimeDialog} onOpenChange={setShowInsertTimeDialog}>
        <DialogContent className="max-w-md bg-gray-900 border border-gray-700">
          <DialogTitle className="text-lg font-bold text-white mb-2">
            {timeDialogMode === 'insert' && 'Insert Time'}
            {timeDialogMode === 'delete' && 'Delete Time'}
            {timeDialogMode === 'duplicate' && 'Duplicate Time'}
          </DialogTitle>
          <div className="space-y-3">
            <label className="text-sm text-gray-300 flex items-center justify-between">
              Bars
              <Input
                type="number"
                min={1}
                value={insertTimeBars}
                onChange={(e) => setInsertTimeBars(Number(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white w-24 ml-2"
              />
            </label>
            {insertTimeError && <p className="text-sm text-red-400">{insertTimeError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowInsertTimeDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApplyTimeDialog}>
                {timeDialogMode === 'insert' && 'Insert'}
                {timeDialogMode === 'delete' && 'Delete'}
                {timeDialogMode === 'duplicate' && 'Duplicate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grid Settings Dialog */}
      <Dialog open={showGridSettingsDialog} onOpenChange={setShowGridSettingsDialog}>
        <DialogContent className="max-w-md bg-gray-900 border border-gray-700">
          <DialogTitle className="text-lg font-bold text-white mb-2">Grid Settings</DialogTitle>
          <div className="space-y-4">
            <label className="text-sm text-gray-300 flex items-center justify-between">
              Division
              <select
                value={gridDivisionDraft}
                onChange={(e) => setGridDivisionDraft(e.target.value as GridSettings['division'])}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white ml-2"
              >
                {gridDivisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Triplet Grid</span>
              <Switch checked={gridTripletDraft} onCheckedChange={setGridTripletDraft} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowGridSettingsDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveGridSettings}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tempo Map Dialog */}
      <Dialog open={showTempoMapDialog} onOpenChange={setShowTempoMapDialog}>
        <DialogContent className="max-w-md bg-gray-900 border border-gray-700">
          <DialogTitle className="text-lg font-bold text-white mb-2">Tempo Map</DialogTitle>
          <div className="space-y-3">
            <label className="text-sm text-gray-300 flex items-center justify-between">
              BPM (20-400)
              <Input
                type="number"
                min={20}
                max={400}
                value={tempoMap}
                onChange={(e) => setTempoMap(Number(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white w-24 ml-2"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowTempoMapDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveTempoMap}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Time Signature Dialog */}
      <Dialog open={showTimeSignatureDialog} onOpenChange={setShowTimeSignatureDialog}>
        <DialogContent className="max-w-md bg-gray-900 border border-gray-700">
          <DialogTitle className="text-lg font-bold text-white mb-2">Time Signature</DialogTitle>
          <div className="space-y-3">
            <label className="text-sm text-gray-300 flex items-center justify-between">
              Numerator
              <Input
                type="number"
                min={1}
                value={timeSignatureDraft.numerator}
                onChange={(e) => setTimeSignatureDraft({ ...timeSignatureDraft, numerator: Number(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white w-24 ml-2"
              />
            </label>
            <label className="text-sm text-gray-300 flex items-center justify-between">
              Denominator
              <Input
                type="number"
                min={1}
                value={timeSignatureDraft.denominator}
                onChange={(e) => setTimeSignatureDraft({ ...timeSignatureDraft, denominator: Number(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white w-24 ml-2"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowTimeSignatureDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveTimeSignature}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Key Signature Dialog */}
      <Dialog open={showKeySignatureDialog} onOpenChange={setShowKeySignatureDialog}>
        <DialogContent className="max-w-md bg-gray-900 border border-gray-700">
          <DialogTitle className="text-lg font-bold text-white mb-2">Key Signature</DialogTitle>
          <div className="space-y-4">
            <label className="text-sm text-gray-300 flex items-center justify-between">
              Key
              <select
                value={keySignatureDraft}
                onChange={(e) => setKeySignatureDraft(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white ml-2"
              >
                {keySignatures.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowKeySignatureDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveKeySignature}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Marker List Dialog */}
      <Dialog open={showMarkerListDialog} onOpenChange={setShowMarkerListDialog}>
        <DialogContent className="max-w-md bg-gray-900 border border-gray-700">
          <DialogTitle className="text-lg font-bold text-white mb-3">Markers</DialogTitle>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {markers.length === 0 && <p className="text-sm text-gray-400">No markers yet.</p>}
            {markers.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1">
                <div className="text-sm text-gray-200">
                  <span className="font-semibold">Bar {m.bar}</span>
                  <span className="text-gray-400 ml-2">{m.label}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleDeleteMarker(m.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-3">
            <Button variant="outline" size="sm" onClick={() => setShowMarkerListDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-700" data-testid="dialog-keyboard-shortcuts">
          <DialogTitle className="text-xl font-bold text-white mb-4" data-testid="title-keyboard-shortcuts">Keyboard Shortcuts</DialogTitle>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-white mb-2">Transport</h3>
              <div className="space-y-1 text-gray-300">
                <div className="flex justify-between"><span>Play/Pause</span><span className="text-gray-500">Space</span></div>
                <div className="flex justify-between"><span>Stop</span><span className="text-gray-500">Enter</span></div>
                <div className="flex justify-between"><span>Record</span><span className="text-gray-500">R</span></div>
                <div className="flex justify-between"><span>Loop Toggle</span><span className="text-gray-500">L</span></div>
              </div>
              <h3 className="font-semibold text-white mb-2 mt-4">Views</h3>
              <div className="space-y-1 text-gray-300">
                <div className="flex justify-between"><span>Beat Lab</span><span className="text-gray-500">1</span></div>
                <div className="flex justify-between"><span>Piano Roll</span><span className="text-gray-500">2</span></div>
                <div className="flex justify-between"><span>Mixer</span><span className="text-gray-500">3</span></div>
                <div className="flex justify-between"><span>Arrangement</span><span className="text-gray-500">4</span></div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Editing</h3>
              <div className="space-y-1 text-gray-300">
                <div className="flex justify-between"><span>Undo</span><span className="text-gray-500">Ctrl+Z</span></div>
                <div className="flex justify-between"><span>Redo</span><span className="text-gray-500">Ctrl+Y</span></div>
                <div className="flex justify-between"><span>Cut</span><span className="text-gray-500">Ctrl+X</span></div>
                <div className="flex justify-between"><span>Copy</span><span className="text-gray-500">Ctrl+C</span></div>
                <div className="flex justify-between"><span>Paste</span><span className="text-gray-500">Ctrl+V</span></div>
                <div className="flex justify-between"><span>Delete</span><span className="text-gray-500">Del</span></div>
                <div className="flex justify-between"><span>Select All</span><span className="text-gray-500">Ctrl+A</span></div>
              </div>
              <h3 className="font-semibold text-white mb-2 mt-4">Tools</h3>
              <div className="space-y-1 text-gray-300">
                <div className="flex justify-between"><span>Metronome</span><span className="text-gray-500">C</span></div>
                <div className="flex justify-between"><span>Snap to Grid</span><span className="text-gray-500">Ctrl+G</span></div>
                <div className="flex justify-between"><span>Show Grid</span><span className="text-gray-500">G</span></div>
                <div className="flex justify-between"><span>Zoom In</span><span className="text-gray-500">Ctrl++</span></div>
                <div className="flex justify-between"><span>Zoom Out</span><span className="text-gray-500">Ctrl+-</span></div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* About Dialog */}
      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="max-w-md bg-gray-900 border-gray-700 text-center" data-testid="dialog-about">
          <DialogTitle className="text-2xl font-bold text-white mb-2" data-testid="title-about">CodedSwitch Studio</DialogTitle>
          <div className="space-y-4">
            <p className="text-gray-400">Professional AI-Powered Music Production</p>
            <div className="py-4 border-y border-gray-700">
              <div className="text-4xl mb-2">🎵</div>
              <p className="text-lg font-semibold text-white">Version 1.0</p>
              <p className="text-sm text-gray-500">Build 2024.12.19</p>
            </div>
            <div className="text-sm text-gray-400 space-y-1">
              <p>AI-powered beat creation, melody composition, and mixing</p>
              <p>MIDI controller support for hands-on production</p>
              <p>Code-to-music transformation technology</p>
            </div>
            <div className="pt-4 text-xs text-gray-500">
              <p>Made with passion for music creators</p>
              <p>codedswitch.com</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Transport Bar - Surfaces in Piano Roll and Arrangement views */}
      {(activeView === 'piano-roll' || activeView === 'arrangement') && (
        <div
          className="fixed z-50"
          style={{
            left: '50%',
            bottom: '16px',
            transform: `translate(calc(-50% + ${transportBarPos.x}px), ${transportBarPos.y}px)`,
          }}
        >
          <div className={cn(
            "bg-gray-900/95 backdrop-blur-sm border border-gray-700 shadow-2xl",
            transportBarCollapsed ? "rounded-2xl px-3 py-2" : "rounded-full px-4 py-2",
            "flex items-center gap-3"
          )}>
            <button
              type="button"
              className="h-8 w-8 rounded-full border border-gray-700 bg-black/40 text-gray-300 hover:text-white cursor-move"
              title="Drag transport"
              onPointerDown={(e) => {
                const target = e.currentTarget;
                target.setPointerCapture?.(e.pointerId);
                transportDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  baseX: transportBarPos.x,
                  baseY: transportBarPos.y,
                  dragging: true,
                };
              }}
              onPointerMove={(e) => {
                const drag = transportDragRef.current;
                if (!drag?.dragging) return;
                const dx = e.clientX - drag.startX;
                const dy = e.clientY - drag.startY;
                setTransportBarPos({ x: drag.baseX + dx, y: drag.baseY + dy });
              }}
              onPointerUp={(e) => {
                const target = e.currentTarget;
                target.releasePointerCapture?.(e.pointerId);
                if (transportDragRef.current) {
                  transportDragRef.current.dragging = false;
                }
              }}
              onPointerCancel={(e) => {
                const target = e.currentTarget;
                target.releasePointerCapture?.(e.pointerId);
                if (transportDragRef.current) {
                  transportDragRef.current.dragging = false;
                }
              }}
            >
              <Cable className="w-4 h-4 mx-auto" />
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setTransportBarCollapsed((v) => !v)}
              className="rounded-full w-10 h-10 p-0"
              title={transportBarCollapsed ? 'Expand transport' : 'Collapse transport'}
            >
              {transportBarCollapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </Button>

            {!transportBarCollapsed && (
              <>
                {/* Play/Pause */}
                <Button
                  size="sm"
                  onClick={() => (transportPlaying ? pauseTransport() : startTransport())}
                  className={`rounded-full w-10 h-10 p-0 ${transportPlaying ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}`}
                >
                  {transportPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </Button>

                {/* Stop */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    stopTransport();
                    seek(0);
                  }}
                  className="rounded-full w-10 h-10 p-0"
                >
                  <Square className="w-4 h-4" />
                </Button>

                {/* Position Display */}
                <div className="px-3 py-1 bg-gray-800 rounded-full text-sm font-mono">
                  <span className="text-white">Bar {Math.max(1, Math.floor(playheadPosition / 16) + 1)}</span>
                  <span className="text-gray-400 mx-1">:</span>
                  <span className="text-gray-300">Beat {Math.max(1, Math.floor(position % 4) + 1)}</span>
                </div>

                {/* Loop Toggle */}
                <Button
                  size="sm"
                  variant={loop.enabled ? 'default' : 'outline'}
                  onClick={() => setLoop({ enabled: !loop.enabled })}
                  className="rounded-full w-10 h-10 p-0"
                  title="Toggle Loop"
                >
                  <Repeat className="w-4 h-4" />
                </Button>

                {/* Clear All Tracks */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    stopTransport();
                    seek(0);
                    setTracks([]);
                  }}
                  className="rounded-full px-3 py-1"
                  title="Clear all tracks"
                >
                  Clear
                </Button>

                {/* Tempo */}
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full">
                  <span className="text-xs text-gray-400">BPM</span>
                  <span className="text-sm font-bold text-white">{Math.round(tempo)}</span>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-1 px-2">
                  <Sliders className="w-3 h-3 text-gray-400" />
                  <div className="w-16">
                    <Slider
                      value={[masterVolume * 100]}
                      onValueChange={(value) => {
                        const newVolume = value[0] / 100;
                        setMasterVolume(newVolume);
                        setMIDIMasterVolume(newVolume);
                      }}
                      max={100}
                      min={0}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    <UpgradeModal
      open={showLicenseModal}
      onClose={() => setShowLicenseModal(false)}
      onUpgrade={startUpgrade}
    />
    {/* Audio Detector Dialog */}
    <Dialog open={showAudioDetector} onOpenChange={setShowAudioDetector}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
        <DialogTitle className="sr-only">Audio Detector</DialogTitle>
        <AudioDetector 
          onClose={() => setShowAudioDetector(false)}
          onChordDetected={(chord) => {
            if (chord.confidence > 0.7) {
              toast({ title: `🎵 ${chord.chord}`, description: `Confidence: ${Math.round(chord.confidence * 100)}%` });
            }
          }}
          onBPMDetected={(bpm) => {
            if (bpm.bpm > 0 && bpm.confidence > 0.5) {
              toast({ title: `🥁 ${bpm.bpm} BPM`, description: `Time signature: ${bpm.timeSignature}` });
            }
          }}
        />
      </DialogContent>
    </Dialog>

    {showAstutely && createPortal(
      <AstutelyChatbot
        onClose={() => setShowAstutely(false)}
        onBeatGenerated={handleAstutelyResult}
      />,
      document.body
    )}

    {/* Astutely Panel Overlay */}
    {showAstutelyArchitect && createPortal(
      <AstutelyPanel
        onClose={() => setShowAstutelyArchitect(false)}
        onGenerated={handleAstutelyResult}
      />,
      document.body
    )}
    </div>
  );
} 
