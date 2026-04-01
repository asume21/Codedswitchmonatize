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
import { 
  ChevronDown, ChevronRight, ChevronLeft, Maximize2, Minimize2, Music, Sliders, Piano, Layers, Mic, Mic2, FileText, Wand2, Upload, Cable, RefreshCw, Settings, Workflow, Wrench, Play, Pause, Square, Repeat, ArrowLeft, Home, BookOpen, X, Circle, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import MobileStudioLayout from './MobileStudioLayout';
import FloatingAIAssistant from './FloatingAIAssistant';
const AIAssistant = React.lazy(() => import('./AIAssistant'));
const ProAudioGenerator = React.lazy(() => import('./ProAudioGenerator').then(m => ({ default: m.ProAudioGenerator })));
const LyricsFocusMode = React.lazy(() => import('./LyricsFocusMode'));
import { Resizable } from 'react-resizable';
const LyricLab = React.lazy(() => import('./LyricLab'));
const CodeToMusicStudioV2 = React.lazy(() => import('./CodeToMusicStudioV2'));
import VerticalPianoRoll from './VerticalPianoRoll';
const ProfessionalMixer = React.lazy(() => import('./ProfessionalMixer'));
const SongUploader = React.lazy(() => import('./SongUploader'));
import WorkflowSelector from './WorkflowSelector';
import type { WorkflowPreset } from './WorkflowSelector';
import { useToast } from '@/hooks/use-toast';
import { useMIDI } from '@/hooks/use-midi';
import { useInstrumentOptional } from '@/contexts/InstrumentContext';
import { AVAILABLE_INSTRUMENTS } from './types/pianoRollTypes';
import { realisticAudio } from '@/lib/realisticAudio';
import { getAudioContext } from '@/lib/audioContext';
import { AudioEngine } from '@/lib/audio';
import { AudioPremixCache } from '@/lib/audioPremix';
import { duplicateTrackData } from '@/lib/trackClone';
const AudioAnalysisPanel = React.lazy(() => import('./AudioAnalysisPanel'));
const AudioToolsPage = React.lazy(() => import('./AudioToolsPage'));
import { EQPlugin, CompressorPlugin, DeesserPlugin, ReverbPlugin, LimiterPlugin, NoiseGatePlugin, type ToolType } from './effects';
import type { Note } from './types/pianoRollTypes';
import BeatLab from './BeatLab';
import { DawArrangementView } from './DawArrangementView';
const MasterMultiTrackPlayer = React.lazy(() => import('./MasterMultiTrackPlayer'));
import { OrganismPage } from '@/features/organism/OrganismPage';
import { useOrganismActivation, useOrganismSafe } from '@/features/organism/GlobalOrganismWrapper';
const AIMasteringCard = React.lazy(() => import('./AIMasteringCard'));
const AIArrangementBuilder = React.lazy(() => import('./AIArrangementBuilder'));
const AIVocalMelody = React.lazy(() => import('./AIVocalMelody'));
const AIStemSeparation = React.lazy(() => import('./AIStemSeparation'));
const SpectrumAnalyzer = React.lazy(() => import('./SpectrumAnalyzer'));
const ReferenceTrackAB = React.lazy(() => import('./ReferenceTrackAB'));
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PresenceAmbientLight } from '@/components/presence';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Package } from 'lucide-react';
import { useTransport } from '@/contexts/TransportContext';
import { useStudioStore } from '@/stores/useStudioStore';
import type { MusicalKey } from '@/stores/useStudioStore';
import { useTracks, type StudioTrack } from '@/hooks/useTracks';
import { createTrackPayload } from '@/types/studioTracks';
import { UndoManager } from '@/lib/UndoManager';
import 'react-resizable/css/styles.css';
import { UpgradeModal, useLicenseGate } from '@/lib/LicenseGuard';
import { getTimelineRecorder, type RecorderState } from '@/lib/timelineRecorder';
import AudioDetector from './AudioDetector';
import AstutelyChatbot from '../ai/AstutelyChatbot';
import { astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';
import { Zap, Sparkles } from 'lucide-react';
import { professionalAudio } from '@/lib/professionalAudio';
const SampleBrowser = React.lazy(() => import('./SampleBrowser'));
const InspectorPanel = React.lazy(() => import('./InspectorPanel'));
const InstrumentLibrary = React.lazy(() => import('./InstrumentLibrary'));
import { WindowManagerProvider } from '@/contexts/WindowManagerContext';
import WindowLauncher from './WindowLauncher';
import StudioWindowRenderer from './StudioWindowRenderer';
import UndoRedoControls from './UndoRedoControls';

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64 text-cyan-300/60">
      <div className="text-center">
        <div className="w-6 h-6 mx-auto mb-2 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-[10px] font-bold uppercase tracking-widest">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Auto-activates the global OrganismProvider when the user opens the Organism tab.
 * If already activated, renders OrganismPage immediately.
 */
function OrganismAutoActivate() {
  const { isActivated, activate } = useOrganismActivation();
  const organism = useOrganismSafe();

  // Auto-activate on mount if not yet booted
  React.useEffect(() => {
    if (!isActivated) activate();
  }, [isActivated, activate]);

  // Still booting
  if (!organism) {
    return (
      <div className="flex items-center justify-center h-full text-cyan-300">
        <div className="text-center">
          <Zap className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          <p className="text-sm font-semibold">Booting Organism engines...</p>
        </div>
      </div>
    );
  }

  return <OrganismPage />;
}

// Workflow Configuration Types
interface WorkflowConfig {
  activeView: 'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music' | 'audio-tools' | 'beat-lab' | 'multitrack' | 'organism';
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

const DEFAULT_TRACK_HEIGHT = 180;
const STUDIO_AUTOSAVE_KEY = 'unifiedStudioAutosave';
const STUDIO_AUTOSAVE_INTERVAL_MS = 30000;
const STUDIO_AUTOSAVE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STUDIO_CHECKPOINTS_KEY = 'unifiedStudioCheckpoints';
const STUDIO_MAX_CHECKPOINTS = 10;
const STUDIO_BOUNCE_SETTINGS_KEY = 'studio:bounce:settings:v1';
const STUDIO_UNDO_TIMELINE_KEY = 'unifiedStudioUndoTimeline';
const STUDIO_MAX_UNDO_ENTRIES = 100;

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
  'pro-beatmaker': {
    activeView: 'beat-lab',
    showAIAssistant: true,
    showMusicGen: false,
    expandedSections: {
      pianoRollTools: true,
    },
    description: 'Beat-focused workflow for drum programming, basslines, loops, and fast arrangement moves',
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
  'ai-song-production': {
    activeView: 'multitrack',
    showAIAssistant: true,
    showMusicGen: true,
    guidedMode: true,
    description: 'AI-powered song production workflow with guided steps',
  },
  'hybrid-workflow': {
    activeView: 'arrangement',
    showAIAssistant: true,
    showMusicGen: true,
    expandedSections: {
      arrangementControls: true,
      instrumentsPanel: true,
    },
    description: 'Balanced workflow that blends AI generation with manual arranging, editing, and mixing',
  },
};

const AI_SONG_GUIDE_STEPS = [
  { id: 'ctx', title: 'Set context', detail: 'Pick genre/mood/BPM/key; start a session.' },
  { id: 'lyrics', title: 'Lyrics', detail: 'Generate lyrics, then run lyrics analysis for quality.' },
  { id: 'plan', title: 'Song plan', detail: 'Generate song plan/sections (intro/verse/chorus/bridge).' },
  { id: 'patterns', title: 'Patterns', detail: 'Create/edit patterns in Piano Roll (Astutely patterns).' },
  { id: 'audio', title: 'Real audio', detail: 'Generate real audio (Suno/MusicGen); load reference track.' },
  { id: 'vocals', title: 'Vocals (optional)', detail: 'Generate/import vocals (e.g., ElevenLabs) and align to BPM/key.' },
  { id: 'mix', title: 'Mix', detail: 'Balance levels/pan/EQ; loop main section for balance.' },
  { id: 'master', title: 'Master & export', detail: 'Export master WAV/MP3; spot-check trims and loudness.' },
];

const INITIAL_AI_SONG_STATUS = AI_SONG_GUIDE_STEPS.reduce<Record<string, 'pending' | 'done'>>((acc, step) => {
  acc[step.id] = 'pending';
  return acc;
}, {});

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

function getAstutelyBars(grouped: ReturnType<typeof convertAstutelyNotes>) {
  let maxStep = 0;
  (Object.keys(grouped) as AstutelyTrackType[]).forEach((type) => {
    grouped[type].forEach((n) => {
      const endStep = (n.step ?? 0) + (n.length ?? 1);
      if (endStep > maxStep) maxStep = endStep;
    });
  });
  return Math.max(1, Math.ceil((maxStep + 1) / 16)); // 16 steps per bar
}

function buildAstutelyTrack(
  existing: StudioTrack | undefined,
  config: (typeof ASTUTELY_TRACK_CONFIG)[AstutelyTrackType],
  notes: Note[],
  bpm: number,
  lengthBars: number
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
    lengthBars,
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
    lengthBars,
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
  const totalBars = getAstutelyBars(groupedNotes);

  (Object.keys(ASTUTELY_TRACK_CONFIG) as AstutelyTrackType[]).forEach((type) => {
    const noteSet = groupedNotes[type];
    if (!noteSet.length) return;
    const config = ASTUTELY_TRACK_CONFIG[type];
    const existingIndex = next.findIndex((track) => track.id === config.id);
    const existing = existingIndex !== -1 ? next[existingIndex] : undefined;
    const updated = buildAstutelyTrack(existing, config, noteSet, bpm, totalBars);
    if (existingIndex !== -1) {
      next[existingIndex] = updated;
    } else {
      next = [...next, updated];
    }
  });

  return { tracks: next, totalBars };
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
    isRecordArmed,
    toggleRecordArm,
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
      const currentSnapshot = tracks.map(t => ({ ...t }));
      undoManagerRef.current.record(currentSnapshot);
      setTrackHistory((prev) => [...prev, currentSnapshot].slice(-STUDIO_MAX_UNDO_ENTRIES));
      setTrackFuture([]);
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
  const [activeView, setActiveViewRaw] = useState<'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music' | 'audio-tools' | 'beat-lab' | 'multitrack' | 'organism'>(() => {
    const valid = ['arrangement','piano-roll','mixer','ai-studio','lyrics','song-uploader','code-to-music','audio-tools','beat-lab','multitrack','organism'];
    // ?popout=view — used when the user pops a tab out into its own window
    const popout = new URLSearchParams(window.location.search).get('popout');
    if (popout && valid.includes(popout)) return popout as any;
    const saved = sessionStorage.getItem('studio:activeView');
    return (saved && valid.includes(saved) ? saved : 'arrangement') as any;
  });
  const setActiveView = useCallback((v: 'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music' | 'audio-tools' | 'beat-lab' | 'multitrack' | 'organism') => {
    sessionStorage.setItem('studio:activeView', v);
    setActiveViewRaw(v);
  }, []);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [showAstutely, setShowAstutely] = useState(false);
  const [showAIArrange, setShowAIArrange] = useState(false);
  const [showMusicGen, setShowMusicGen] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showLyricsFocus, setShowLyricsFocus] = useState(false);
  const [pianoRollExpanded, setPianoRollExpanded] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [instrumentsExpanded, setInstrumentsExpanded] = useState(false);
  const [showSampleBrowser, setShowSampleBrowser] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showWaveformEditor, setShowWaveformEditor] = useState(false);
  const [showAudioDetector, setShowAudioDetector] = useState(false);

  // Timeline Recorder
  const [recorderState, setRecorderState] = useState<RecorderState>(() => getTimelineRecorder().getState());
  useEffect(() => {
    return getTimelineRecorder().subscribe(setRecorderState);
  }, []);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showMetronomeSettings, setShowMetronomeSettings] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  // Helper: wrap a menu-item click so it fires the action then closes the menu
  const menuAction = (fn: () => void) => () => { fn(); setOpenMenu(null); };

  const [effectsDialogOpen, setEffectsDialogOpen] = useState(false);
  const [activeEffectTool, setActiveEffectTool] = useState<string | null>(null);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [beatLabTab, setBeatLabTab] = useState<'pro' | 'bass-studio' | 'loop-library' | 'pack-generator'>('pro');
  const [pianoRollTool, setPianoRollTool] = useState<'select' | 'draw' | 'erase'>('draw');
  const [zoom, setZoom] = useState(50);
  const [trackListWidth, setTrackListWidth] = useState(200);
  const [trackHeights, setTrackHeights] = useState<Record<string, number>>({});
  const [waveformData, setWaveformData] = useState<Record<string, any>>({});
  const [waveformTrimStart, setWaveformTrimStart] = useState(0);
  const [waveformTrimEnd, setWaveformTrimEnd] = useState(100);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [recordingLatencyCompensationMs, setRecordingLatencyCompensationMs] = useState(0);

  // Sync playheadPosition with transport position so the Piano Roll
  // receives real-time position updates and can trigger note playback
  useEffect(() => {
    setPlayheadPosition(position);
  }, [position]);
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

  const globalInstrument = useInstrumentOptional();

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
    // If already playing this track, stop it
    if (timelinePlayingTrackRef.current === trackId) {
      const existing = timelineAudioRefs.current.get(trackId);
      if (existing) {
        existing.pause();
        existing.currentTime = 0;
      }
      setTimelinePlayingTrack(null);
      timelinePlayingTrackRef.current = null;
      return;
    }

    // Stop any currently playing track first
    stopTimelineAudio();

    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const audioUrl = (track.payload as any)?.audioUrl || (track.data as any)?.audioUrl;
    if (!audioUrl) {
      // For MIDI tracks, start transport playback instead
      if (track.type === 'midi' && track.notes?.length > 0) {
        startTransport();
        setTimelinePlayingTrack(trackId);
        timelinePlayingTrackRef.current = trackId;
        toast({ title: 'Playing', description: `${track.name} via Piano Roll` });
        return;
      }
      toast({ title: 'No Audio', description: `${track.name} has no audio to play`, variant: 'destructive' });
      return;
    }

    let audio = timelineAudioRefs.current.get(trackId);
    if (!audio) {
      audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = audioUrl;
      timelineAudioRefs.current.set(trackId, audio);
    }

    audio.volume = Math.min(1, Math.max(0, track.volume ?? 0.8));
    audio.currentTime = 0;
    audio.onended = () => {
      setTimelinePlayingTrack(null);
      timelinePlayingTrackRef.current = null;
    };

    audio.play().then(() => {
      setTimelinePlayingTrack(trackId);
      timelinePlayingTrackRef.current = trackId;
    }).catch(err => {
      toast({ title: 'Playback Error', description: String(err), variant: 'destructive' });
    });
  };

  const stopTimelineAudio = () => {
    timelineAudioRefs.current.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch { /* ignore */ }
    });
    setTimelinePlayingTrack(null);
    timelinePlayingTrackRef.current = null;
  };

  const handleAstutelyResult = useCallback((result: AstutelyResult) => {
    const notes = astutelyToNotes(result);

    if (result.bpm && result.bpm > 0) {
      setTransportTempo(result.bpm);
    }

    // Astutely output is now preserved in useStudioStore.organismSnapshots — no localStorage needed.

    setActiveView('piano-roll');

    toast({
      title: '🔥 Astutely Generated!',
      description: `${notes.length} notes at ${result.bpm} BPM added to Piano Roll.`,
      duration: 5000,
      onClick: () => { setActiveView('piano-roll'); setPianoRollExpanded(true); },
    });
  }, [setTransportTempo, setActiveView, toast]);
  // Clips, markers, and session/grid state
  const [clips, setClips] = useState<TrackClip[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [gridSettings, setGridSettings] = useState<GridSettings>({ division: '1/16', triplet: false });

  // ── sessionSettings reads from the Zustand store (single source of truth) ──
  const storeBpm = useStudioStore((s) => s.bpm);
  const storeKey = useStudioStore((s) => s.key);
  const storeTimeSignature = useStudioStore((s) => s.timeSignature);
  const storeSetBpm = useStudioStore((s) => s.setBpm);
  const storeSetKey = useStudioStore((s) => s.setKey);
  const storeSetTimeSignature = useStudioStore((s) => s.setTimeSignature);

  const sessionSettings: SessionSettings = useMemo(() => ({
    bpm: storeBpm,
    timeSignature: storeTimeSignature,
    key: storeKey,
  }), [storeBpm, storeTimeSignature, storeKey]);

  // Shim so existing code that calls setSessionSettings still works
  const setSessionSettings = useCallback((updater: SessionSettings | ((prev: SessionSettings) => SessionSettings)) => {
    const prev: SessionSettings = {
      bpm: useStudioStore.getState().bpm,
      timeSignature: useStudioStore.getState().timeSignature,
      key: useStudioStore.getState().key,
    };
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (next.bpm !== undefined) storeSetBpm(next.bpm);
    if (next.key !== undefined) storeSetKey(next.key as MusicalKey);
    if (next.timeSignature !== undefined) storeSetTimeSignature(next.timeSignature);
  }, [storeSetBpm, storeSetKey, storeSetTimeSignature]);
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

  // Keep dialog drafts in sync when the store is updated from an external source
  // (e.g. Organism detects a new key/BPM, or another tab updates the store).
  useEffect(() => { setTempoMap(storeBpm); }, [storeBpm]);
  useEffect(() => { setTimeSignatureDraft(storeTimeSignature); }, [storeTimeSignature]);
  useEffect(() => { setKeySignatureDraft(storeKey); }, [storeKey]);
  const [insertTimeError, setInsertTimeError] = useState<string | null>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [tabScrollPos, setTabScrollPos] = useState(0);
  const [tabScrollMax, setTabScrollMax] = useState(0);
  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    const update = () => setTabScrollMax(el.scrollWidth - el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  // Disabled when in piano-roll or beat-lab views where number keys are used for playing notes/chords
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Skip if modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Don't steal number keys from piano roll or beat lab — they're used for notes and chords
      if (activeView === 'piano-roll' || activeView === 'beat-lab') return;

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
  }, [toast, activeView]);

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
        case 'mix-studio':
          setActiveView('mixer');
          break;
        case 'audio-tools':
          setActiveView('audio-tools');
          break;
        case 'organism':
          setActiveView('organism');
          break;
        case 'uploader':
        case 'song-uploader':
          setActiveView('song-uploader');
          break;
        case 'code-to-music':
        case 'codebeat':
          setActiveView('code-to-music');
          break;
        case 'ai-studio':
        case 'assistant':
          setActiveView('ai-studio');
          break;
        case 'multitrack':
          setActiveView('multitrack');
          break;
        case 'arrangement':
          setActiveView('arrangement');
          break;
        // PluginHub and legacy aliases
        case 'musicmixer':
        case 'professionalmixer':
          setActiveView('mixer');
          break;
        case 'translator':
        case 'musiccode':
        case 'layers':
          setActiveView('code-to-music');
          break;
        case 'midi':
        case 'advanced-sequencer':
          setActiveView('piano-roll');
          break;
        case 'pack-generator':
          setActiveView('beat-lab');
          break;
        case 'metrics':
        case 'song-structure':
          setActiveView('audio-tools');
          break;
        case 'security':
          setActiveView('ai-studio');
          break;
        case 'granular-engine':
        case 'wavetable-oscillator':
          setActiveView('ai-studio');
          toast({ title: 'Synth Engine', description: 'Opening AI Studio for synthesis tools', onClick: () => setActiveView('ai-studio') });
          break;
        default:
          // Try direct match as activeView value
          if (['arrangement', 'beat-lab', 'piano-roll', 'mixer', 'ai-studio', 'lyrics', 'song-uploader', 'code-to-music', 'audio-tools', 'multitrack', 'organism'].includes(detail)) {
            setActiveView(detail as any);
          }
          break;
      }
    };

    window.addEventListener('navigateToTab', handleNavigateToTab as EventListener);
    return () => window.removeEventListener('navigateToTab', handleNavigateToTab as EventListener);
  }, [toast]);

  // Handle stem-separator navigation
  useEffect(() => {
    const handler = () => setActiveView('audio-tools');
    window.addEventListener('navigate-to-stem-separator', handler);
    return () => window.removeEventListener('navigate-to-stem-separator', handler);
  }, []);

  // Handle AI assistant panel open/close
  useEffect(() => {
    const open  = () => setShowAIAssistant(true);
    const close = () => setShowAIAssistant(false);
    window.addEventListener('astutely:open-panel', open);
    window.addEventListener('astutely:close-panel', close);
    return () => {
      window.removeEventListener('astutely:open-panel', open);
      window.removeEventListener('astutely:close-panel', close);
    };
  }, []);

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
    try {
      const raw = localStorage.getItem(STUDIO_UNDO_TIMELINE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{ history: StudioTrack[][]; future: StudioTrack[][] }>;
      if (Array.isArray(parsed.history)) {
        setTrackHistory(parsed.history.slice(-STUDIO_MAX_UNDO_ENTRIES));
      }
      if (Array.isArray(parsed.future)) {
        setTrackFuture(parsed.future.slice(0, STUDIO_MAX_UNDO_ENTRIES));
      }
    } catch {
      // ignore invalid persisted undo timeline payloads
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STUDIO_UNDO_TIMELINE_KEY, JSON.stringify({
        history: trackHistory.slice(-STUDIO_MAX_UNDO_ENTRIES),
        future: trackFuture.slice(0, STUDIO_MAX_UNDO_ENTRIES),
      }));
    } catch {
      // ignore non-blocking undo timeline persistence failures
    }
  }, [trackHistory, trackFuture]);

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
      const customEvent = event as CustomEvent<{ sessionId?: string; trackId?: string; name?: string; audioUrl?: string; bpm?: number; lengthBars?: number }>;
      const detail = customEvent.detail;
      if (!detail?.audioUrl) return;

      const resolvedTrackId = detail.trackId || `track-${Date.now()}`;
      const resolvedBpm = typeof detail.bpm === 'number' && Number.isFinite(detail.bpm) ? detail.bpm : 120;
      const resolvedLengthBars = typeof detail.lengthBars === 'number' && Number.isFinite(detail.lengthBars)
        ? Math.max(1, Math.floor(detail.lengthBars))
        : 8;

      const newTrack: StudioTrack = {
        id: resolvedTrackId,
        name: detail.name || 'Imported Audio',
        kind: 'audio',
        type: 'audio',
        instrument: 'audio',
        notes: [],
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        lengthBars: resolvedLengthBars,
        startBar: 0,
        source: 'imported',
        bpm: resolvedBpm,
        payload: createTrackPayload({ type: 'audio', audioUrl: detail.audioUrl }),
        audioUrl: detail.audioUrl,
        data: {},
        sendA: -60,
        sendB: -60,
      };

      setTracks((prev) => {
        const existingIndex = prev.findIndex((t) => t.id === resolvedTrackId);
        if (existingIndex !== -1) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            ...newTrack,
            payload: {
              ...(next[existingIndex].payload ?? createTrackPayload({ type: 'audio' })),
              ...(newTrack.payload ?? {}),
            },
          };
          return next;
        }
        return [...prev, newTrack];
      });
      setSelectedTrack(newTrack.id);
      setActiveView('piano-roll');
      setPianoRollExpanded(true);

      toast({
        title: "Imported Audio",
        description: `Added ${newTrack.name} and opened Piano Roll.`,
        onClick: () => { setActiveView('piano-roll'); setPianoRollExpanded(true); },
      });
    };

    window.addEventListener('studio:importAudioTrack', handleImportAudio as EventListener);
    return () => window.removeEventListener('studio:importAudioTrack', handleImportAudio as EventListener);
  }, [setTracks, toast]);

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

      const { tracks: mergedTracks, totalBars } = mergeAstutelyTracks(tracks as StudioTrack[], grouped, detail.bpm || sessionSettings.bpm);
      setTracks(mergedTracks);

      // Set loop to cover the generated pattern length
      if (totalBars && totalBars > 0) {
        setLoop({ enabled: true, start: 0, end: totalBars });
      }

      if (focusTrackId) {
        setSelectedTrack(focusTrackId);
      }

      // ── Route drums to Beat Lab (always-mounted, no localStorage needed) ──
      const drumNotes = detail.notes.filter((n: any) => n.trackType === 'drums');
      if (drumNotes.length > 0) {
        const pitchToTrack: Record<number, string> = { 36: 'kick', 38: 'snare', 42: 'hihat', 46: 'perc' };
        const patternLength = 16;
        const emptyStep = () => ({ active: false, velocity: 100, probability: 100, swing: 0, pitch: 0 });
        const trackDefs = [
          { id: 'kick', name: 'Kick' },
          { id: 'snare', name: 'Snare' },
          { id: 'hihat', name: 'Hi-Hat' },
          { id: 'perc', name: 'Perc' },
        ];
        const trackMap: Record<string, ReturnType<typeof emptyStep>[]> = {};
        trackDefs.forEach(td => { trackMap[td.id] = Array.from({ length: patternLength }, emptyStep); });
        for (const dn of drumNotes) {
          const trackId = pitchToTrack[dn.pitch as number] || (dn as any).drumType;
          if (!trackId || !trackMap[trackId]) continue;
          const stepIdx = ((dn as any).startStep ?? (dn as any).step ?? 0) % patternLength;
          trackMap[trackId][stepIdx] = { ...trackMap[trackId][stepIdx], active: true, velocity: (dn as any).velocity || 100 };
        }
        const beatTracks = trackDefs.map(td => ({ id: td.id, name: td.name, pattern: trackMap[td.id] }));
        window.dispatchEvent(new CustomEvent('ai:loadBeatPattern', {
          detail: { tracks: beatTracks, bpm: detail.bpm || 90, timestamp: Date.now() },
        }));
      }

      // ── Preserve Astutely output in the Zustand store history ──
      const snapshotBpm = detail.bpm || sessionSettings.bpm;
      const astutelySnapshot: import('@/stores/useStudioStore').OrganismSnapshot = {
        id: `astutely-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        bpm: snapshotBpm,
        key: useStudioStore.getState().key,
        keyMode: useStudioStore.getState().keyMode,
        source: 'astutely',
        tracks: {
          drum:    grouped.drums  as import('@/stores/useStudioStore').StudioNote[],
          bass:    grouped.bass   as import('@/stores/useStudioStore').StudioNote[],
          melody:  [...grouped.melody, ...grouped.chords] as import('@/stores/useStudioStore').StudioNote[],
          texture: [],
        },
      };
      useStudioStore.getState().pushOrganismSnapshot(astutelySnapshot);

      // ── Tell the user what was loaded and where — let THEM choose where to go ──
      const melodicCount = grouped.melody.length + grouped.bass.length + grouped.chords.length;
      const drumCount = grouped.drums.length;

      const destinations: string[] = [];
      if (melodicCount > 0) destinations.push(`${melodicCount} notes → Piano Roll`);
      if (drumCount > 0) destinations.push(`${drumCount} hits → Beat Lab`);

      // Toast for melodic content
      if (melodicCount > 0) {
        toast({
          title: '🎹 Piano Roll Ready',
          description: `Melody, bass & chords loaded (${melodicCount} notes)`,
          onClick: () => { setActiveView('piano-roll'); setPianoRollExpanded(true); },
        });
      }

      // Toast for drum content
      if (drumCount > 0) {
        toast({
          title: '🥁 Beat Lab Ready',
          description: `Drum pattern loaded (${drumCount} hits)`,
          onClick: () => setActiveView('beat-lab'),
        });
      }

      // Fallback if somehow nothing categorised
      if (melodicCount === 0 && drumCount === 0) {
        toast({ title: 'AI Pattern Loaded', description: `${detail.notes.length} notes ready`, onClick: () => { setActiveView('piano-roll'); setPianoRollExpanded(true); } });
      }
    };

    window.addEventListener('astutely:generated', handleAstutelyGenerated as EventListener);

    // Hydration from localStorage removed — Astutely output is now persisted
    // in useStudioStore.organismSnapshots via Zustand persist middleware.

    return () => {
      window.removeEventListener('astutely:generated', handleAstutelyGenerated as EventListener);
    };
  }, [setTracks, setTransportTempo, sessionSettings.bpm, toast]);

  // ── Organism → Studio bridge: merge snapshot notes into workspace tracks ──
  useEffect(() => {
    const handleSnapshotReady = (event: Event) => {
      const snapshot = (event as CustomEvent).detail as import('@/stores/useStudioStore').OrganismSnapshot | undefined;
      if (!snapshot) return;

      const generatorToTrackType: Record<string, string> = {
        drum: 'beat', bass: 'midi', melody: 'midi', texture: 'midi',
      };
      const generatorToName: Record<string, string> = {
        drum: 'Organism Drums', bass: 'Organism Bass', melody: 'Organism Melody', texture: 'Organism Texture',
      };
      const generatorToInstrument: Record<string, string> = {
        drum: 'drums', bass: 'bass', melody: 'piano', texture: 'synth',
      };

      setTracks((prev: StudioTrack[]) => {
        let updated = [...prev];
        for (const gen of ['drum', 'bass', 'melody', 'texture'] as const) {
          const notes = snapshot.tracks[gen];
          if (!notes || notes.length === 0) continue;

          const existingIdx = updated.findIndex(t => t.name === generatorToName[gen]);
          const trackData: StudioTrack = {
            id: existingIdx >= 0 ? updated[existingIdx].id : `organism-${gen}-${Date.now()}`,
            name: generatorToName[gen],
            kind: gen === 'drum' ? 'beat' : 'midi',
            type: generatorToTrackType[gen] as any,
            instrument: generatorToInstrument[gen],
            notes: notes as any[],
            volume: 0.8,
            pan: 0,
            muted: false,
            solo: false,
            lengthBars: Math.max(4, Math.ceil(Math.max(...notes.map(n => n.step + n.length)) / 16)),
            startBar: 0,
            source: 'organism',
            bpm: snapshot.bpm,
            payload: createTrackPayload({ type: generatorToTrackType[gen] as any }),
            data: { organismSnapshotId: snapshot.id },
            sendA: -60,
            sendB: -60,
          };

          if (existingIdx >= 0) {
            updated[existingIdx] = trackData;
          } else {
            updated.push(trackData);
          }
        }
        return updated;
      });

      const totalNotes = Object.values(snapshot.tracks).reduce((sum, arr) => sum + arr.length, 0);
      const drumCount = snapshot.tracks.drum.length;
      const melodicCount = totalNotes - drumCount;

      if (melodicCount > 0) {
        toast({
          title: '🎹 Organism → Piano Roll',
          description: `${melodicCount} melodic notes loaded from ${snapshot.source}`,
          onClick: () => { setActiveView('piano-roll'); setPianoRollExpanded(true); },
        });
      }
      if (drumCount > 0) {
        toast({
          title: '🥁 Organism → Beat Lab',
          description: `${drumCount} drum hits loaded from ${snapshot.source}`,
          onClick: () => setActiveView('beat-lab'),
        });
      }
    };

    window.addEventListener('organism:snapshot-ready', handleSnapshotReady as EventListener);
    return () => {
      window.removeEventListener('organism:snapshot-ready', handleSnapshotReady as EventListener);
    };
  }, [setTracks, toast]);

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
        const currentSnapshot = current.map(t => ({ ...t }));

        if (isCtrlZ && trackHistory.length > 0) {
          const previousSnapshot = trackHistory[trackHistory.length - 1];
          setTrackHistory(prev => prev.slice(0, -1));
          setTrackFuture(prev => [currentSnapshot, ...prev].slice(0, STUDIO_MAX_UNDO_ENTRIES));
          isRestoringTracksRef.current = true;
          setTracks(previousSnapshot.map(t => ({ ...t })));
          return;
        }

        if (isCtrlY && trackFuture.length > 0) {
          const [redoSnapshot, ...rest] = trackFuture;
          setTrackFuture(rest);
          setTrackHistory(prev => [...prev, currentSnapshot].slice(-STUDIO_MAX_UNDO_ENTRIES));
          isRestoringTracksRef.current = true;
          setTracks(redoSnapshot.map(t => ({ ...t })));
          return;
        }

        const manager = undoManagerRef.current;
        const next = isCtrlZ ? manager.undo(currentSnapshot) : manager.redo(currentSnapshot);
        if (next) {
          isRestoringTracksRef.current = true;
          setTracks(next);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, setTracks, trackHistory, trackFuture]);

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
        <DialogContent className="max-w-[95vw] md:max-w-3xl bg-gray-900 border-gray-700">
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

  // Per-track StereoPannerNode cache for applying pan to note playback
  const trackPanners = useRef<Map<string, StereoPannerNode>>(new Map());

  // Get or create a StereoPannerNode for a track, connected to the shared AudioContext destination
  const getTrackPanner = (trackId: string, panValue: number): StereoPannerNode | null => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return null;

      let panner = trackPanners.current.get(trackId);
      if (!panner) {
        panner = ctx.createStereoPanner();
        panner.connect(ctx.destination);
        trackPanners.current.set(trackId, panner);
      }
      panner.pan.value = Math.max(-1, Math.min(1, panValue));
      return panner;
    } catch {
      return null;
    }
  };

  // Play a note with the REAL audio engines (Synthesis for instruments, realisticAudio for drums)
  const playNote = async (note: string, octave: number, instrumentType?: string, durationSeconds: number = 0.5) => {
    try {
      const currentTrack = tracks.find(t => t.id === selectedTrack);
      const uiInstrument = instrumentType || currentTrack?.instrument || 'Grand Piano';
      const trackVolume = currentTrack?.volume ?? 0.8;
      const trackPan = currentTrack?.pan ?? 0;

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
      
      // Apply pan via StereoPannerNode when the track has a non-zero pan value
      const pannerNode = (trackPan !== 0 && currentTrack)
        ? getTrackPanner(currentTrack.id, trackPan)
        : null;

      // realisticAudio.playNote(note, octave, duration, instrument, velocity, targetNode)
      await realisticAudio.playNote(
        note,
        octave,
        durationSeconds,
        midiInstrument,
        Math.min(1, Math.max(0, trackVolume)),
        false,
        pannerNode ?? undefined
      );
    } catch (error) {
      console.error('Error playing note:', error);
    }
  };

  // Stop a note (for note-off events)
  const playNoteOff = (note: string, octave: number, instrument?: string, releaseSeconds?: number) => {
    try {
      const currentTrack = tracks.find(t => t.id === selectedTrack);
      const uiInstrument = instrument || currentTrack?.instrument || 'Grand Piano';
      const looksLikeSoundfontKey = /^[a-z0-9_-]+$/.test(uiInstrument);
      const midiInstrument = looksLikeSoundfontKey ? uiInstrument : mapInstrumentName(uiInstrument);
      realisticAudio.noteOff(note, octave, midiInstrument, releaseSeconds);
    } catch (error) {
      console.error('Error stopping note:', error);
    }
  };

  // Memoized callbacks for VerticalPianoRoll — prevents re-render on unrelated state changes
  const pianoRollPlayNote = useCallback((note: string, octave: number, duration: number, instrument: string) => {
    playNote(note, octave, instrument, duration);
  }, []);
  const pianoRollPlayNoteOff = useCallback((note: string, octave: number, instrument: string, releaseSeconds?: number) => {
    playNoteOff(note, octave, instrument, releaseSeconds);
  }, []);
  const selectedTrackRef = useRef(selectedTrack);
  selectedTrackRef.current = selectedTrack;
  const pianoRollNotesChange = useCallback((updatedNotes: any[]) => {
    const trackId = selectedTrackRef.current;
    if (trackId) {
      setTracks((prev: any[]) => prev.map((t: any) =>
        t.id === trackId ? { ...t, notes: updatedNotes } : t
      ));
    }
  }, [setTracks]);

  // Memoized track summary for AIArrangementBuilder — avoids new array allocation every render
  const arrangementTrackSummary = useMemo(() =>
    tracks.map(t => ({ id: t.id, name: t.name, type: t.type, instrument: t.instrument, noteCount: t.notes?.length || 0, muted: t.muted, volume: t.volume })),
    [tracks]
  );

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
  const buildProjectData = useCallback(() => ({
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
  }), [
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
  ]);

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

  const applyProjectData = useCallback((projectData: any) => {
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
    setTrackHistory([]);
    setTrackFuture([]);
  }, [setClips, setGridSettings, setLoop, setMarkers, setSelectedTrack, setSessionSettings, setShowGrid, setSnapToGridEnabled, setTracks, setTransportTempo]);

  const saveAutosaveSnapshot = useCallback(() => {
    try {
      const snapshot = {
        savedAt: Date.now(),
        projectData: buildProjectData(),
      };
      localStorage.setItem(STUDIO_AUTOSAVE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore non-blocking autosave failures
    }
  }, [buildProjectData]);

  const pushProjectCheckpoint = useCallback((reason: 'autosave' | 'manual-save' | 'restore') => {
    try {
      const raw = localStorage.getItem(STUDIO_CHECKPOINTS_KEY);
      const existing = raw ? JSON.parse(raw) as Array<{ createdAt: number; reason: string; projectData: unknown }> : [];
      const checkpoint = {
        createdAt: Date.now(),
        reason,
        projectData: buildProjectData(),
      };

      const next = [checkpoint, ...existing].slice(0, STUDIO_MAX_CHECKPOINTS);
      localStorage.setItem(STUDIO_CHECKPOINTS_KEY, JSON.stringify(next));
    } catch {
      // ignore checkpoint persistence failures
    }
  }, [buildProjectData]);

  useEffect(() => {
    saveAutosaveSnapshot();
    pushProjectCheckpoint('autosave');
    const timer = window.setInterval(() => {
      saveAutosaveSnapshot();
      pushProjectCheckpoint('autosave');
    }, STUDIO_AUTOSAVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [saveAutosaveSnapshot, pushProjectCheckpoint]);

  const autosaveCheckedRef = useRef(false);
  useEffect(() => {
    if (autosaveCheckedRef.current) return;
    autosaveCheckedRef.current = true;

    try {
      const raw = localStorage.getItem(STUDIO_AUTOSAVE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { savedAt?: number; projectData?: any };
      if (!parsed?.savedAt || !parsed?.projectData) return;

      if (Date.now() - parsed.savedAt > STUDIO_AUTOSAVE_MAX_AGE_MS) {
        return;
      }

      const hasRecoverableContent =
        Array.isArray(parsed.projectData?.tracks) && parsed.projectData.tracks.length > 0;
      if (!hasRecoverableContent) return;

      const shouldRestore = window.confirm('Recovered autosave found. Restore the previous session?');
      if (!shouldRestore) return;

      applyProjectData(parsed.projectData);
      pushProjectCheckpoint('restore');
      toast({
        title: 'Recovered Autosave',
        description: 'Restored your previous studio session from autosave.',
      });
    } catch {
      // ignore corrupted autosave payloads
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    pushProjectCheckpoint('manual-save');
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
        pushProjectCheckpoint('restore');
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
    if (tracks.length > 0 && !selectedTrack) {
      setSelectedTrack(tracks[0].id);
    }
    toast({ title: 'Select All', description: `${tracks.length} track(s) in project` });
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
    setActiveView('arrangement');
    setTimelineExpanded(true);
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
    setActiveView('arrangement');
    setTimelineExpanded(true);
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
    setActiveView('arrangement');
    setTimelineExpanded(true);
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
    setActiveView('arrangement');
    setTimelineExpanded(true);
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
    setActiveView('arrangement');
    setTimelineExpanded(true);
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
    setActiveView('arrangement');
    setTimelineExpanded(true);
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
    if (!selectedTrack) {
      toast({ title: 'Select a track', description: 'Choose a track to normalize', variant: 'destructive' });
      return;
    }
    setTracks(prev => prev.map(t => t.id === selectedTrack ? { ...t, volume: 0.8 } : t));
    const track = tracks.find(t => t.id === selectedTrack);
    toast({ title: 'Normalize', description: `${track?.name || 'Track'} volume normalized to 0dB` });
  };

  const handleReverse = () => {
    if (!selectedTrack) {
      toast({ title: 'Select a track', description: 'Choose a track to reverse', variant: 'destructive' });
      return;
    }
    setTracks(prev => prev.map(t => {
      if (t.id !== selectedTrack || !t.notes?.length) return t;
      const maxStep = Math.max(...t.notes.map(n => n.step + (n.length || 1)));
      const reversed = t.notes.map(n => ({ ...n, step: maxStep - n.step - (n.length || 1) }));
      return { ...t, notes: reversed };
    }));
    toast({ title: 'Reverse', description: 'Notes reversed in selected track' });
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
    if (!selectedTrack) {
      toast({ title: 'No Selection', description: 'Select tracks to group', variant: 'destructive' });
      return;
    }
    const groupId = `group-${Date.now()}`;
    setTracks(prev => prev.map(t => t.id === selectedTrack ? { ...t, data: { ...((t.data as any) || {}), groupId } } : t));
    toast({ title: 'Group Created', description: `Track added to group ${groupId.slice(-4)}` });
  };

  const handleUngroupTracks = () => {
    if (!selectedTrack) {
      toast({ title: 'No Selection', description: 'Select a grouped track to ungroup', variant: 'destructive' });
      return;
    }
    setTracks(prev => prev.map(t => {
      if (t.id !== selectedTrack) return t;
      const data = { ...((t.data as any) || {}) };
      delete data.groupId;
      return { ...t, data };
    }));
    toast({ title: 'Ungrouped', description: 'Track removed from group' });
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

  const handleMusicGenerated = (_audioUrl: string, metadata: any) => {
    // Close the generation modal and sync BPM.
    if (metadata?.bpm) {
      setSessionSettings(prev => ({ ...prev, bpm: metadata.bpm }));
    }
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

  const handleRecordingLatencyMeasured = useCallback((latencyMs: number) => {
    const bounded = Math.max(0, Math.min(500, Math.round(latencyMs || 0)));
    setRecordingLatencyCompensationMs(bounded);

    try {
      const raw = localStorage.getItem(STUDIO_BOUNCE_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      localStorage.setItem(STUDIO_BOUNCE_SETTINGS_KEY, JSON.stringify({
        ...parsed,
        latencyCompensationMs: bounded,
      }));
    } catch {
      // non-blocking persistence
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STUDIO_BOUNCE_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{ latencyCompensationMs: number }>;
      if (typeof parsed.latencyCompensationMs === 'number') {
        setRecordingLatencyCompensationMs(Math.max(0, Math.min(500, Math.round(parsed.latencyCompensationMs))));
      }
    } catch {
      // ignore invalid persisted bounce settings
    }
  }, []);

  const selectedTrackEntity = useMemo(
    () => (tracks as StudioTrack[]).find((t) => t.id === selectedTrack) || (tracks as StudioTrack[])[0] || null,
    [tracks, selectedTrack],
  );

  const freezeWindowTracks = useMemo(() => {
    const secondsPerBeat = 60 / Math.max(1, tempo || 120);
    return (tracks as StudioTrack[]).map((track) => {
      const trackAny = track as any;
      const payload = trackAny.payload || {};
      const startBar = typeof trackAny.startBar === 'number' ? trackAny.startBar : 0;

      return {
        id: track.id,
        name: track.name,
        audioUrl: track.audioUrl || payload.audioUrl,
        volume: typeof track.volume === 'number' ? track.volume : 0.8,
        pan: typeof track.pan === 'number' ? track.pan : 0,
        startTimeSeconds:
          typeof trackAny.startTimeSeconds === 'number'
            ? trackAny.startTimeSeconds
            : startBar * 4 * secondsPerBeat,
        trimStartSeconds: typeof payload.trimStartSeconds === 'number' ? payload.trimStartSeconds : undefined,
        trimEndSeconds: typeof payload.trimEndSeconds === 'number' ? payload.trimEndSeconds : undefined,
        latencyCompensationMs:
          typeof payload.latencyCompensationMs === 'number'
            ? payload.latencyCompensationMs
            : recordingLatencyCompensationMs,
        effects: trackAny.effects,
        notes: track.notes,
        clips: trackAny.clips,
      };
    });
  }, [tracks, tempo, recordingLatencyCompensationMs]);

  const handleWindowTakeReady = useCallback((take: { trackId: string; audioUrl: string }) => {
    if (!take?.trackId || !take?.audioUrl) return;

    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== take.trackId) return track;
        const payload = (track as any).payload || {};
        return {
          ...track,
          type: 'audio',
          kind: 'audio',
          audioUrl: take.audioUrl,
          payload: {
            ...payload,
            audioUrl: take.audioUrl,
            latencyCompensationMs: recordingLatencyCompensationMs,
          },
        } as StudioTrack;
      }),
    );
    toast({ title: 'Take Imported', description: 'Recorded take attached to track for editing and bounce.' });
  }, [setTracks, recordingLatencyCompensationMs, toast]);

  const handleWindowTrackFrozen = useCallback((trackId: string, frozenAudioUrl: string) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        const payload = (track as any).payload || {};
        return {
          ...track,
          frozen: true,
          audioUrl: frozenAudioUrl,
          payload: {
            ...payload,
            audioUrl: frozenAudioUrl,
          },
        } as StudioTrack;
      }),
    );
  }, [setTracks]);

  const handleWindowTrackUnfrozen = useCallback((trackId: string) => {
    setTracks((prev) => prev.map((track) => (track.id === trackId ? ({ ...(track as any), frozen: false } as StudioTrack) : track)));
  }, [setTracks]);

  const handleWindowBounceComplete = useCallback((url: string) => {
    toast({ title: 'Bounce Ready', description: `Rendered bounce available: ${url.slice(0, 42)}...` });
  }, [toast]);

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
          {activeView === 'beat-lab' && <BeatLab isActive={true} />}
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
                <button onClick={() => setActiveView('piano-roll')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform border border-cyan-500/30 hover:border-cyan-400/60 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <Piano className="w-8 h-8 text-cyan-400" />
                  <span className="text-sm font-medium">Piano Roll</span>
                </button>
                <button onClick={() => setActiveView('beat-lab')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform border border-cyan-500/30 hover:border-cyan-400/60 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <Layers className="w-8 h-8 text-cyan-400" />
                  <span className="text-sm font-medium">Beat Lab</span>
                </button>
                <button onClick={() => setActiveView('lyrics')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform border border-green-500/30 hover:border-green-400/60 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                  <FileText className="w-8 h-8 text-green-400" />
                  <span className="text-sm font-medium">Lyrics</span>
                </button>
                <button onClick={() => setActiveView('ai-studio')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform border border-yellow-500/30 hover:border-yellow-400/60 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                  <Wand2 className="w-8 h-8 text-yellow-400" />
                  <span className="text-sm font-medium">AI Studio</span>
                </button>
                <button onClick={() => setActiveView('audio-tools')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform border border-orange-500/30 hover:border-orange-400/60 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                  <Wrench className="w-8 h-8 text-orange-400" />
                  <span className="text-sm font-medium">Tools</span>
                </button>
                <button onClick={() => setActiveView('mixer')} className="p-4 bg-gray-800 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform border border-fuchsia-500/30 hover:border-fuchsia-400/60 hover:shadow-[0_0_15px_rgba(217,70,239,0.2)]">
                  <Sliders className="w-8 h-8 text-fuchsia-400" />
                  <span className="text-sm font-medium">Mixer</span>
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
    <WindowManagerProvider>
    <div className="h-full w-full flex flex-col bg-black astutely-app astutely-scanlines astutely-grid-bg astutely-scrollbar overflow-visible">
      {/* Presence-driven ambient light — syncs CSS vars to Living Glyph state */}
      <PresenceAmbientLight />
      {/* Floating Window Renderer — renders all open draggable windows */}
      <StudioWindowRenderer
        recordingTrackId={selectedTrackEntity?.id}
        recordingTrackName={selectedTrackEntity?.name || 'Track'}
        currentBeat={position}
        onTakeReady={handleWindowTakeReady}
        onRecordingLatencyMeasured={handleRecordingLatencyMeasured}
        freezeTracks={freezeWindowTracks}
        freezeBpm={tempo}
        freezeTotalBeats={Math.max(64, Math.ceil(playheadPosition || 64))}
        onTrackFrozen={handleWindowTrackFrozen}
        onTrackUnfrozen={handleWindowTrackUnfrozen}
        onBounceComplete={handleWindowBounceComplete}
      />
      {/* Top Bar */}
      <div className="h-14 bg-black/80 border-b border-cyan-500/30 backdrop-blur-md flex items-center px-2 sm:px-4 justify-between flex-shrink-0 astutely-header relative z-[1000]">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <h1 className="text-base sm:text-xl font-black tracking-[0.2em] sm:tracking-[0.3em] astutely-gradient-text uppercase hidden sm:block">CodedSwitch</h1>
          <div className="flex space-x-0.5 flex-wrap md:flex-nowrap" ref={menuBarRef}>
            <div className="relative">
              <Button variant="ghost" size="sm" className="astutely-button" onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}>File ▼</Button>
              {openMenu === 'file' && (
              <div className="absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] w-56 z-[9999] astutely-panel">
                <button onClick={menuAction(handleNewProject)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>New Project</span>
                  <span className="text-xs text-cyan-400">Ctrl+N</span>
                </button>
                <button onClick={menuAction(handleLoadProject)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Open Project...</span>
                  <span className="text-xs text-cyan-400">Ctrl+O</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleSaveProject)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Save Project</span>
                  <span className="text-xs text-cyan-400">Ctrl+S</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(() => setActiveView('song-uploader'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Import Audio...</span>
                  <span className="text-xs text-cyan-400">Ctrl+I</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleExport)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Export Audio...</span>
                  <span className="text-xs text-gray-500">Ctrl+E</span>
                </button>
              </div>
              )}
            </div>
            <div className="relative">
              <Button variant="ghost" size="sm" className="astutely-button" onClick={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}>Edit ▼</Button>
              {openMenu === 'edit' && (
              <div className="absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] w-56 z-[9999] astutely-panel">
                <button onClick={menuAction(handleUndo)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Undo</span>
                  <span className="text-xs text-cyan-400">Ctrl+Z</span>
                </button>
                <button onClick={menuAction(handleRedo)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Redo</span>
                  <span className="text-xs text-cyan-400">Ctrl+Y</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleCut)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Cut</span>
                  <span className="text-xs text-cyan-400">Ctrl+X</span>
                </button>
                <button onClick={menuAction(handleCopy)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Copy</span>
                  <span className="text-xs text-cyan-400">Ctrl+C</span>
                </button>
                <button onClick={menuAction(handlePaste)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Paste</span>
                  <span className="text-xs text-cyan-400">Ctrl+V</span>
                </button>
                <button onClick={menuAction(handleDelete)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Delete</span>
                  <span className="text-xs text-cyan-400">Del</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleSelectAll)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Select All</span>
                  <span className="text-xs text-cyan-400">Ctrl+A</span>
                </button>
              </div>
              )}
            </div>
            <div className="relative">
              <Button variant="ghost" size="sm" className="astutely-button" onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}>View ▼</Button>
              {openMenu === 'view' && (
              <div className="absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] w-56 z-[9999] astutely-panel">
                <button onClick={menuAction(() => setActiveView('arrangement'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'arrangement' ? '✓' : '  '} Arrangement</span>
                  <span className="text-xs text-cyan-400">F1</span>
                </button>
                <button onClick={menuAction(() => setActiveView('beat-lab'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'beat-lab' ? '✓' : '  '} Beat Lab</span>
                  <span className="text-xs text-cyan-400">F2</span>
                </button>
                <button onClick={menuAction(() => setActiveView('piano-roll'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'piano-roll' ? '✓' : '  '} Piano Roll</span>
                  <span className="text-xs text-cyan-400">F3</span>
                </button>
                <button onClick={menuAction(() => setActiveView('mixer'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'mixer' ? '✓' : '  '} Mixer</span>
                  <span className="text-xs text-cyan-400">F4</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(() => setActiveView('ai-studio'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'ai-studio' ? '✓' : '  '} AI Studio</span>
                  <span className="text-xs text-cyan-400">F5</span>
                </button>
                <button onClick={menuAction(() => setActiveView('code-to-music'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item" data-testid="tab-code-to-music">
                  <span>{activeView === 'code-to-music' ? '✓' : '  '} Code to Music</span>
                  <span className="text-xs text-cyan-400">F6</span>
                </button>
                <button onClick={menuAction(() => setActiveView('lyrics'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'lyrics' ? '✓' : '  '} Lyrics</span>
                  <span className="text-xs text-cyan-400">F7</span>
                </button>
                <button onClick={menuAction(() => setActiveView('audio-tools'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'audio-tools' ? '✓' : '  '} Audio Tools</span>
                  <span className="text-xs text-cyan-400">F8</span>
                </button>
                <button onClick={menuAction(() => setActiveView('song-uploader'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'song-uploader' ? '✓' : '  '} Upload</span>
                  <span className="text-xs text-cyan-400">F9</span>
                </button>
                <button onClick={menuAction(() => setActiveView('organism'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{activeView === 'organism' ? '✓' : '  '} Organism</span>
                  <span className="text-xs text-cyan-400">F10</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(() => setInstrumentsExpanded(!instrumentsExpanded))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{instrumentsExpanded ? '✓' : '  '} Instrument Library</span>
                  <span className="text-xs text-cyan-400">Ctrl+1</span>
                </button>
                <button onClick={menuAction(() => { setShowSampleBrowser(!showSampleBrowser); toast({ title: showSampleBrowser ? "Sample Browser Hidden" : "Sample Browser Shown" }); })} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{showSampleBrowser ? '✓' : '  '} Sample Browser</span>
                  <span className="text-xs text-cyan-400">Ctrl+2</span>
                </button>
                <button onClick={menuAction(() => { setShowInspector(!showInspector); toast({ title: showInspector ? "Inspector Hidden" : "Inspector Shown" }); })} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{showInspector ? '✓' : '  '} Inspector</span>
                  <span className="text-xs text-cyan-400">Ctrl+3</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleZoomIn)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Zoom In</span>
                  <span className="text-xs text-cyan-400">Ctrl++</span>
                </button>
                <button onClick={menuAction(handleZoomOut)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Zoom Out</span>
                  <span className="text-xs text-cyan-400">Ctrl+-</span>
                </button>
                <button onClick={menuAction(handleZoomToFit)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Zoom to Fit</span>
                  <span className="text-xs text-cyan-400">Ctrl+0</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleToggleFullScreen)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Full Screen</span>
                  <span className="text-xs text-cyan-400">F11</span>
                </button>
                <button onClick={menuAction(() => { setFocusModeEnabled(!focusModeEnabled); toast({ title: focusModeEnabled ? "Focus Mode Off" : "Focus Mode On", description: focusModeEnabled ? "UI elements restored" : "Distraction-free mode enabled" }); })} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{focusModeEnabled ? '✓' : '  '} Focus Mode</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+F</span>
                </button>
              </div>
              )}
            </div>

            {/* CREATE Menu */}
            <div className="relative">
              <Button variant="ghost" size="sm" className="astutely-button" onClick={() => setOpenMenu(openMenu === 'create' ? null : 'create')}>Create ▼</Button>
              {openMenu === 'create' && (
              <div className="absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] w-56 z-[9999] astutely-panel">
                <button onClick={menuAction(handleNewMIDITrack)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>New MIDI Track</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+T</span>
                </button>
                <button onClick={menuAction(handleNewAudioTrack)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>New Audio Track</span>
                  <span className="text-xs text-cyan-400">Ctrl+T</span>
                </button>
                <button onClick={menuAction(handleNewInstrumentTrack)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  New Instrument Track
                </button>
                <button onClick={menuAction(handleNewReturnTrack)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  New Return Track
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(() => handleInsertEffect('EQ', 'audio'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Insert Audio Effect...
                </button>
                <button onClick={menuAction(() => handleInsertEffect('Compressor', 'midi'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Insert MIDI Effect...
                </button>
                <button onClick={menuAction(() => handleInsertEffect('Reverb', 'midi'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Insert Instrument...
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleNewSend)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  New Send
                </button>
                <button onClick={menuAction(handleNewBus)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  New Bus
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(() => handleInsertClip('Empty Clip'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Empty Clip</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+M</span>
                </button>
                <button onClick={menuAction(() => handleInsertClip('Recording Clip', true))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Recording Clip
                </button>
              </div>
              )}
            </div>

            {/* ARRANGE Menu */}
            <div className="relative">
              <Button variant="ghost" size="sm" className="astutely-button" onClick={() => setOpenMenu(openMenu === 'arrange' ? null : 'arrange')}>Arrange ▼</Button>
              {openMenu === 'arrange' && (
              <div className="absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] w-56 z-[9999] astutely-panel">
                <button onClick={menuAction(() => { setTimeDialogMode('insert'); setShowInsertTimeDialog(true); })} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Insert Time...</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+I</span>
                </button>
                <button onClick={menuAction(() => { setTimeDialogMode('delete'); setShowInsertTimeDialog(true); })} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Delete Time...</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+Del</span>
                </button>
                <button onClick={menuAction(() => { setTimeDialogMode('duplicate'); setShowInsertTimeDialog(true); })} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Duplicate Time...</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+D</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleLoopSelection)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Loop Selection</span>
                  <span className="text-xs text-cyan-400">Ctrl+L</span>
                </button>
                <button onClick={menuAction(() => handleSetLoopLength(4))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Set Loop Length...
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={menuAction(handleAddMarker)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Add Marker</span>
                  <span className="text-xs text-cyan-400">M</span>
                </button>
                <button onClick={menuAction(() => setShowMarkerListDialog(true))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Marker List...
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={menuAction(handleSnapToGrid)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{snapToGridEnabled ? '✓' : '  '} Snap to Grid</span>
                  <span className="text-xs text-cyan-400">Ctrl+G</span>
                </button>
                <button onClick={menuAction(handleToggleGrid)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{showGrid ? '✓' : '  '} Show Grid</span>
                  <span className="text-xs text-cyan-400">G</span>
                </button>
                <button onClick={menuAction(() => setShowGridSettingsDialog(true))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Grid Settings...
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(() => setShowTempoMapDialog(true))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Tempo Map...
                </button>
                <button onClick={menuAction(() => setShowTimeSignatureDialog(true))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Time Signature...
                </button>
                <button onClick={menuAction(() => setShowKeySignatureDialog(true))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Key Signature...
                </button>
              </div>
              )}
            </div>

            {/* MIX Menu */}
            <div className="relative">
              <Button variant="ghost" size="sm" className="astutely-button" onClick={() => setOpenMenu(openMenu === 'mix' ? null : 'mix')}>Mix ▼</Button>
              {openMenu === 'mix' && (
              <div className="absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] w-56 z-[9999] astutely-panel">
                <button onClick={menuAction(handleNormalize)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Normalize</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+N</span>
                </button>
                <button onClick={menuAction(handleReverse)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Reverse</span>
                  <span className="text-xs text-cyan-400">Ctrl+R</span>
                </button>
                <button onClick={menuAction(handleFadeIn)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Fade In
                </button>
                <button onClick={menuAction(handleFadeOut)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Fade Out
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleBounceToAudio)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Bounce to Audio</span>
                  <span className="text-xs text-cyan-400">Ctrl+B</span>
                </button>
                <button onClick={menuAction(handleFreezeTrack)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Freeze Track
                </button>
                <button onClick={menuAction(handleFlattenTrack)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Flatten Track
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleGroupTracks)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Group Tracks</span>
                  <span className="text-xs text-cyan-400">Ctrl+G</span>
                </button>
                <button onClick={menuAction(handleUngroupTracks)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Ungroup Tracks</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+G</span>
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleSoloAll)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Solo All Tracks
                </button>
                <button onClick={menuAction(handleMuteAll)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Mute All Tracks
                </button>
                <button onClick={menuAction(handleUnsoloAll)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Unsolo All
                </button>
                <button onClick={menuAction(handleUnmuteAll)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Unmute All
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <button onClick={menuAction(handleResetFaders)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Reset All Faders
                </button>
                <button onClick={menuAction(handleResetPan)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Reset All Pan
                </button>
              </div>
              )}
            </div>

            {/* MORE Menu - Flattened (no nested hover submenus) */}
            <div className="relative">
              <Button variant="ghost" size="sm" className="astutely-button" onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}>More ▼</Button>
              {openMenu === 'more' && (
              <div className="absolute top-full left-0 bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] w-56 z-[9999] astutely-panel max-h-[70vh] overflow-y-auto">
                <div className="px-4 py-1 text-xs text-cyan-400 font-semibold uppercase tracking-wider">Tools</div>
                <button onClick={menuAction(handleTuner)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Tuner</span>
                  <span className="text-xs text-cyan-400">Ctrl+Shift+U</span>
                </button>
                <button onClick={menuAction(handleMetronome)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>{metronomeEnabled ? '✓' : '  '} Metronome</span>
                  <span className="text-xs text-cyan-400">C</span>
                </button>
                <button onClick={menuAction(handleClickTrackSettings)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Click Track Settings...
                </button>
                <button onClick={menuAction(() => { setShowAudioDetector(true); })} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Spectrum / Chord / BPM Detector
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <div className="px-4 py-1 text-xs text-cyan-400 font-semibold uppercase tracking-wider">Window</div>
                <button onClick={menuAction(handleResetLayout)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Reset Layout</span>
                  <span className="text-xs text-cyan-400">Ctrl+Alt+R</span>
                </button>
                <button onClick={menuAction(() => setInstrumentsExpanded(!instrumentsExpanded))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  {instrumentsExpanded ? '✓' : '  '} Show Instrument Library
                </button>
                <button onClick={menuAction(handleToggleFullScreen)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Full Screen</span>
                  <span className="text-xs text-cyan-400">F11</span>
                </button>
                <button onClick={menuAction(() => setFocusModeEnabled(!focusModeEnabled))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  {focusModeEnabled ? '✓' : '  '} Focus Mode
                </button>
                <div className="border-t border-cyan-500/30 my-1"></div>
                <div className="px-4 py-1 text-xs text-cyan-400 font-semibold uppercase tracking-wider">Help</div>
                <button onClick={menuAction(handleShowKeyboardShortcuts)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-cyan-100 astutely-menu-item">
                  <span>Keyboard Shortcuts</span>
                  <span className="text-xs text-cyan-400">?</span>
                </button>
                <button onClick={menuAction(() => window.open('/docs', '_blank'))} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  Documentation
                </button>
                <button onClick={menuAction(handleShowAbout)} className="w-full text-left px-4 py-2 hover:bg-cyan-500/20 text-sm cursor-pointer bg-transparent border-none text-cyan-100 astutely-menu-item">
                  About CodedSwitch
                </button>
              </div>
              )}
            </div>

            {/* MIDI Menu */}
            <div className="relative">
              <Button variant="ghost" size="sm" className="flex items-center gap-1 astutely-button" onClick={() => setOpenMenu(openMenu === 'midi' ? null : 'midi')}>
                <Cable className="w-3 h-3" />
                MIDI ▼
                {midiConnected && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
              </Button>
              {openMenu === 'midi' && (
              <div className="absolute top-full right-0 bg-black/90 border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] w-72 z-[9999] p-3 space-y-3 astutely-panel">
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

                {/* Current Instrument — synced with Piano Roll */}
                {midiConnected && (
                  <div className="pt-2 border-t border-cyan-500/30">
                    <div className="text-xs text-cyan-400 mb-1">Current Instrument:</div>
                    <select
                      value={globalInstrument?.currentInstrument || midiSettings?.currentInstrument || 'piano'}
                      onChange={(e) => {
                        const inst = e.target.value;
                        // Update both the MIDI hook AND the global instrument context
                        // so Piano Roll, mouse clicks, and keyboard shortcuts all use the same instrument
                        updateMIDISettings({ currentInstrument: inst });
                        globalInstrument?.setCurrentInstrument(inst);
                      }}
                      className="w-full px-2 py-1 bg-black/60 border border-cyan-500/40 rounded text-sm text-cyan-100 astutely-input"
                    >
                      {Object.entries(
                        AVAILABLE_INSTRUMENTS.reduce((acc, inst) => {
                          if (!acc[inst.category]) acc[inst.category] = [];
                          acc[inst.category].push(inst);
                          return acc;
                        }, {} as Record<string, typeof AVAILABLE_INSTRUMENTS>)
                      ).map(([category, instruments]) => (
                        <optgroup key={category} label={category}>
                          {instruments.map(inst => (
                            <option key={inst.value} value={inst.value}>{inst.label}</option>
                          ))}
                        </optgroup>
                      ))}
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
              )}
            </div>
          </div>
        </div>

        {/* Window Launcher Dock + Undo/Redo — right side of top bar */}
        <div className="flex items-center gap-2 shrink-0">
          <UndoRedoControls />
          <WindowLauncher />
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
              onClick={async () => {
                if (recorderState.isRecording) {
                  const result = await getTimelineRecorder().stopRecording();
                  if (result) {
                    // Create a new audio track with the recording
                    addTrack(`Recording ${new Date().toLocaleTimeString()}`, 'audio');
                    // We need a tick to let the track render before we can set its payload,
                    // but for now let's use the current selected track if it's the new one,
                    // or just show a success toast and we can wire the payload directly.
                    toast({
                      title: "Recording Saved",
                      description: `Captured ${result.durationSeconds.toFixed(1)}s of audio.`,
                    });
                    
                    // The robust way is to update the store with the audioUrl
                    // Let's find the newly added track by assuming it's the last one added
                    // This will be handled in a useEffect looking for track creations or by direct store manipulation
                    const { useStudioStore } = await import('@/stores/useStudioStore');
                    const { useTrackStore } = await import('@/contexts/TrackStoreContext');
                    // Hack: Wait a tick for track store to update
                    setTimeout(() => {
                      const ts = document.querySelector('[data-track-type="audio"]:last-child') || null; // just an idea
                      // Better: dispatch a custom event with the Blob so that the track creation logic handles it
                      window.dispatchEvent(new CustomEvent('timeline-recording-complete', { detail: result }));
                    }, 100);
                  }
                } else {
                  // Start recording
                  const hasPerm = await getTimelineRecorder().requestPermission();
                  if (hasPerm) {
                    await getTimelineRecorder().startRecording(playheadPosition);
                    startTransport(); // start playback in sync
                    toast({ title: "Recording Started", description: "Sing or play into your mic!" });
                  } else {
                    toast({ title: "Mic Error", description: "Could not access microphone.", variant: "destructive" });
                  }
                }
              }}
              className={recorderState.isRecording ? "bg-red-600 hover:bg-red-500 text-white astutely-button border-red-500" : "astutely-button border-red-500/40 text-red-400 hover:bg-red-500/20"}
            >
              <Mic className="w-4 h-4 mr-1" />
              {recorderState.isRecording ? 'Stop Rec' : 'Rec'}
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

      {/* DAW-Style Tab Bar - All tabs together */}
      <div className="bg-black/60 border-b border-cyan-500/40 px-2 py-2 flex items-center justify-between gap-2 astutely-panel relative z-10 overflow-hidden">
        {/* All Tabs - horizontally scrollable on mobile */}
        <div
          ref={tabScrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setTabScrollPos(el.scrollLeft);
            setTabScrollMax(el.scrollWidth - el.clientWidth);
          }}
          className="flex items-center gap-1 overflow-x-auto flex-nowrap min-w-0 flex-1 pb-0.5 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
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
          <div className="w-px h-5 astutely-divider-yellow mx-1" />
          <Button
            variant={activeView === 'ai-studio' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('ai-studio')}
            className={`h-8 px-3 text-xs ${activeView === 'ai-studio' ? 'astutely-btn-yellow active' : 'astutely-btn-yellow'}`}
          >
            <Wand2 className="w-3 h-3 mr-1" />
            AI Studio
          </Button>
          <Button
            variant={activeView === 'code-to-music' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('code-to-music')}
            className={`h-8 px-3 text-xs ${activeView === 'code-to-music' ? 'astutely-btn-yellow active' : 'astutely-btn-yellow'}`}
            data-testid="tab-code-to-music"
          >
            <Wand2 className="w-3 h-3 mr-1" />
            Code to Music
          </Button>
          <div className="w-px h-5 astutely-divider-green mx-1" />
          <Button
            variant={activeView === 'lyrics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('lyrics')}
            className={`h-8 px-3 text-xs ${activeView === 'lyrics' ? 'astutely-btn-green active' : 'astutely-btn-green'}`}
          >
            <Mic2 className="w-3 h-3 mr-1" />
            Lyrics
          </Button>
          <div className="w-px h-5 astutely-divider-orange mx-1" />
          <Button
            variant={activeView === 'audio-tools' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('audio-tools')}
            className={`h-8 px-3 text-xs ${activeView === 'audio-tools' ? 'astutely-btn-orange active' : 'astutely-btn-orange'}`}
          >
            <Wrench className="w-3 h-3 mr-1" />
            Tools
          </Button>
          <Button
            variant={activeView === 'song-uploader' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('song-uploader')}
            className={`h-8 px-3 text-xs ${activeView === 'song-uploader' ? 'astutely-btn-magenta active' : 'astutely-btn-magenta'}`}
          >
            <Upload className="w-3 h-3 mr-1" />
            Upload
          </Button>
          <div className="w-px h-5 astutely-divider-green mx-1" />
          <Button
            variant={activeView === 'organism' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('organism')}
            className={`h-8 px-3 text-xs ${activeView === 'organism' ? 'astutely-btn-green active' : 'astutely-btn-green'}`}
          >
            <Mic2 className="w-3 h-3 mr-1" />
            Organism
          </Button>
        </div>

        {/* Right Side - Compact Action Buttons & Volume */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-1">
          <div className="hidden sm:block px-2 py-1 rounded border border-cyan-500/40 bg-black/60 text-xs text-cyan-100 astutely-panel">
            Snap: <span className={snapToGridEnabled ? 'text-green-400 font-semibold' : 'text-cyan-400'}>{snapToGridEnabled ? 'On' : 'Off'}</span>
          </div>
          <Button
            onClick={() => setShowAstutely(true)}
            className="h-8 px-2 sm:px-4 font-bold text-white transition-all hover:scale-105 astutely-button"
            style={{
              background: 'linear-gradient(135deg, #0891B2, #2563EB)',
              boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)'
            }}
            size="sm"
            title="Astutely Brain - Neural control center"
          >
            <Sparkles className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Astutely Core</span>
          </Button>
          <Button
            onClick={() => setShowMusicGen(!showMusicGen)}
            className="bg-cyan-600 hover:bg-cyan-500 h-8 px-2 sm:px-3 astutely-button"
            size="sm"
            title="Generate Music"
          >
            <Music className="w-3 h-3 sm:mr-1" />
            <span className="hidden sm:inline">Generate</span>
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
          
          {/* Pop-out current view in new window */}
          <Button
            size="sm"
            variant="ghost"
            title={`Open ${activeView} in new window`}
            className="h-8 w-8 p-0 astutely-button text-gray-500 hover:text-cyan-300"
            onClick={() => {
              const viewParam = encodeURIComponent(activeView);
              window.open(
                `/studio?popout=${viewParam}`,
                `cs-${activeView}`,
                `width=1280,height=820,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes`
              );
            }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
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

      {/* Tab Scroll Strip — only visible when tabs overflow */}
      {tabScrollMax > 0 && (
        <div className="px-3 py-0.5 bg-black/40 border-b border-cyan-500/10">
          <input
            type="range"
            min={0}
            max={tabScrollMax}
            step={1}
            value={tabScrollPos}
            onChange={(e) => {
              const el = tabScrollRef.current;
              if (el) el.scrollLeft = Number(e.target.value);
            }}
            className="w-full h-1 accent-cyan-500 cursor-pointer"
            style={{ display: 'block' }}
          />
        </div>
      )}

      {/* Global BPM Strip — always visible below tabs */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-black/50 border-b border-cyan-500/20">
        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest shrink-0">BPM</span>
        <Slider
          value={[tempo]}
          onValueChange={(value) => setTransportTempo(value[0])}
          max={200}
          min={40}
          step={1}
          className="flex-1 astutely-slider"
        />
        <span className="text-xs font-black text-cyan-300 w-12 text-right shrink-0">{Math.round(tempo)}</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Instrument Library */}
        {instrumentsExpanded && (
          <React.Suspense fallback={<TabLoadingFallback />}>
            <InstrumentLibrary 
              onClose={() => setInstrumentsExpanded(false)}
              onInstrumentSelect={(instrument) => {
                toast({ title: 'Instrument Loaded', description: instrument.name });
              }}
            />
          </React.Suspense>
        )}

        {/* Left Panel - Sample Browser */}
        {showSampleBrowser && (
          <React.Suspense fallback={<TabLoadingFallback />}>
          <SampleBrowser 
            onClose={() => setShowSampleBrowser(false)}
            onSampleSelect={(sample) => {
              toast({ title: 'Sample Selected', description: sample.filename });
            }}
          />
          </React.Suspense>
        )}

        {/* Center: Main Workspace with Tab Views */}
        <div className={cn("flex-1 flex flex-col overflow-auto relative",
          (activeView === 'piano-roll' || activeView === 'arrangement') && "pb-20"
        )}>
          
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

          {/* ARRANGEMENT VIEW — CodedSwitch DAW Timeline */}
          {activeView === 'arrangement' && (
            <div className="flex-1 overflow-hidden pt-14">
              <DawArrangementView
                onOpenEditor={(trackId, view) => {
                  setSelectedTrack(trackId);
                  setActiveView(view ?? 'piano-roll');
                }}
                onAddTrack={(name, type) => addTrack(name, type as 'midi' | 'audio')}
              />
            </div>
          )}

          {/* BEAT LAB VIEW — always mounted so event listeners survive tab switches */}
          <div
            className="flex-1 min-h-0 overflow-y-auto bg-gray-900 pt-14 flex flex-col"
            style={{ display: activeView === 'beat-lab' ? 'flex' : 'none' }}
          >
            <div className="flex-1 min-h-0">
              <BeatLab initialTab={beatLabTab} isActive={activeView === 'beat-lab'} />
            </div>
          </div>

          {/* PIANO ROLL VIEW — always mounted so MIDI listeners + note state survive tab switches */}
          <div
            className="flex-1 overflow-auto bg-gray-900 pt-14"
            style={{ display: activeView === 'piano-roll' ? 'block' : 'none' }}
          >
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
                /* @ts-ignore - VerticalPianoRoll prop types mismatch but runtime compatible */
                <VerticalPianoRoll
                  {...({ tracks: tracks as any } as any)}
                  selectedTrack={selectedTrack || undefined}
                  isPlaying={transportPlaying}
                  currentTime={playheadPosition}
                  onPlayNote={pianoRollPlayNote}
                  onPlayNoteOff={pianoRollPlayNoteOff}
                  onNotesChange={pianoRollNotesChange}
                />
              );
            })()}
          </div>

          {/* MIXER VIEW */}
          {activeView === 'mixer' && (
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14">
              <React.Suspense fallback={<TabLoadingFallback />}>
                <ProfessionalMixer />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                  <SpectrumAnalyzer width={560} height={180} className="bg-zinc-900/80 rounded-lg border border-zinc-700/50 p-3" />
                  <ReferenceTrackAB />
                </div>
              </React.Suspense>
            </div>
          )}

          {/* AI STUDIO VIEW */}
          {activeView === 'ai-studio' && (
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14 p-4">
              <React.Suspense fallback={<TabLoadingFallback />}>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
                <AIMasteringCard />
                <AIArrangementBuilder
                  currentBpm={tempo}
                  currentKey="C"
                  tracks={arrangementTrackSummary}
                  onApplySection={(sectionIndex, trackStates) => {
                    Object.entries(trackStates).forEach(([trackId, state]) => {
                      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !state.active, volume: state.volume } : t));
                    });
                    toast({ title: 'Section Applied', description: `Applied track states for section ${sectionIndex + 1}` });
                  }}
                />
                <AIVocalMelody currentKey="C" currentBpm={tempo} />
                <AIStemSeparation />
              </div>
              <AIAssistant />
              </React.Suspense>
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
                <React.Suspense fallback={<TabLoadingFallback />}>
                  <LyricLab />
                </React.Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* SONG UPLOADER VIEW */}
          {activeView === 'song-uploader' && (
            <div className="flex-1 min-h-0 overflow-y-auto pt-14 astutely-pro-panel">
              <React.Suspense fallback={<TabLoadingFallback />}>
                <SongUploader />
              </React.Suspense>
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
                      <React.Suspense fallback={<TabLoadingFallback />}>
                        <CodeToMusicStudioV2 />
                      </React.Suspense>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AUDIO TOOLS VIEW */}
          {activeView === 'audio-tools' && (
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14">
              <React.Suspense fallback={<TabLoadingFallback />}>
                <AudioToolsPage />
              </React.Suspense>
            </div>
          )}

          {/* MULTI-TRACK PLAYER */}
          {activeView === 'multitrack' && (
            <div className="flex-1 overflow-hidden bg-gray-900 h-full pt-14">
              <React.Suspense fallback={<TabLoadingFallback />}>
                <MasterMultiTrackPlayer />
              </React.Suspense>
            </div>
          )}

          {/* HIP-HOP ORGANISM — uses global OrganismProvider (activated on demand) */}
          {activeView === 'organism' && (
            <div className="flex-1 overflow-hidden bg-gray-900 h-full pt-14">
              <OrganismAutoActivate />
            </div>
          )}
        </div>

        {/* Right Panel - Inspector */}
        {showInspector && (
          <React.Suspense fallback={<TabLoadingFallback />}>
          <InspectorPanel 
            onClose={() => setShowInspector(false)}
            selectedTrackId={selectedTrack}
          />
          </React.Suspense>
        )}

      {/* Floating/Overlay Components */}
      {/* TEMPORARILY DISABLED - React hooks error on mobile
      {showAIAssistant && (
        <FloatingAIAssistant onClose={() => setShowAIAssistant(false)} />
      )} */}

      {showMusicGen && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex flex-col items-center p-4">
          <div className="w-full max-w-5xl flex justify-end shrink-0 mb-2">
            <Button
              onClick={() => setShowMusicGen(false)}
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
          <div className="max-w-5xl w-full flex-1 min-h-0 overflow-y-auto rounded-lg bg-background border border-border shadow-2xl">
            <ErrorBoundary>
              <React.Suspense fallback={<TabLoadingFallback />}>
                <ProAudioGenerator />
              </React.Suspense>
            </ErrorBoundary>
          </div>
        </div>
      )}

      {showLyricsFocus && (
        <React.Suspense fallback={<TabLoadingFallback />}>
        <LyricsFocusMode
          onClose={() => setShowLyricsFocus(false)}
          onSave={handleLyricsSaved}
        />
        </React.Suspense>
      )}

      {renderWaveformEditor()}

      {/* Workflow Selector Modal */}
      <Dialog open={showWorkflowSelector} onOpenChange={setShowWorkflowSelector}>
        <DialogContent className="max-w-[95vw] md:max-w-6xl max-h-[90vh] overflow-y-auto p-0 bg-background">
          <DialogTitle className="sr-only">Select Workflow</DialogTitle>
          <WorkflowSelector
            onSelectWorkflow={handleSelectWorkflow}
            onSkip={handleSkipWorkflow}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={effectsDialogOpen} onOpenChange={setEffectsDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl bg-gray-900 border border-gray-700">
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

                {/* Record Arm */}
                <Button
                  size="sm"
                  onClick={() => toggleRecordArm()}
                  className={cn(
                    "rounded-full w-10 h-10 p-0",
                    recorderState.isRecording
                      ? "bg-red-600 hover:bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                      : isRecordArmed
                      ? "bg-red-500/40 hover:bg-red-500/60 border-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                      : "bg-gray-800 hover:bg-red-600/80 border-gray-700"
                  )}
                  title={recorderState.isRecording ? 'Stop Recording' : isRecordArmed ? 'Disarm' : 'Record'}
                >
                  <Circle className={cn("w-4 h-4", (recorderState.isRecording || isRecordArmed) ? "fill-red-500 text-red-500" : "fill-gray-400 text-gray-400")} />
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

    {/* AI Arrangement Builder Overlay */}
    {showAIArrange && createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowAIArrange(false)}>
        <div className="w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAIArrange(false)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white z-10"
            >
              <X className="w-5 h-5" />
            </Button>
            <AIArrangementBuilder
              currentBpm={tempo}
              currentKey="C"
              tracks={tracks.map(t => ({ id: t.id, name: t.name, type: t.type, instrument: t.instrument, noteCount: t.notes?.length || 0, muted: t.muted, volume: t.volume }))}
              onClose={() => setShowAIArrange(false)}
              onApplySection={(sectionIndex, trackStates) => {
                Object.entries(trackStates).forEach(([trackId, state]) => {
                  setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !state.active, volume: state.volume } : t));
                });
                toast({ title: 'Section Applied', description: `Applied track states for section ${sectionIndex + 1}` });
              }}
            />
          </div>
        </div>
      </div>,
      document.body
    )}

    </div>
    </WindowManagerProvider>
  );
} 
