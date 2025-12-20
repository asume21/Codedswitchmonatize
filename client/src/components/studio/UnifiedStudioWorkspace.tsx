import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { StudioAudioContext } from '@/pages/studio';
import { ChevronDown, ChevronRight, ChevronLeft, Maximize2, Minimize2, Music, Sliders, Piano, Layers, Mic2, FileText, Wand2, Upload, Cable, RefreshCw, Settings, Workflow, Wrench, Play, Pause, Square, Repeat, ArrowLeft, Home, BookOpen } from 'lucide-react';
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
import { UndoManager } from '@/lib/UndoManager';
import 'react-resizable/css/styles.css';
import { UpgradeModal, useLicenseGate } from '@/lib/LicenseGuard';

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

export default function UnifiedStudioWorkspace() {
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
    updateTrack: updateTrackInStore,
    removeTrack: removeTrackFromStore,
  } = useTracks();
  
  // MIDI Controller Integration
  const { 
    isSupported: midiSupported, 
    isConnected: midiConnected, 
    connectedDevices: midiDevices,
    lastNote: midiLastNote,
    activeNotes: midiActiveNotes,
    initializeMIDI,
    refreshDevices: refreshMIDIDevices,
    settings: midiSettings,
    updateSettings: updateMIDISettings,
    setMasterVolume: setMIDIMasterVolume
  } = useMIDI();
  
  // Audio engines
  const [synthesisEngine] = useState(() => new AudioEngine());

  // Initialize audio engines on mount
  useEffect(() => {
    realisticAudio.initialize().catch(err => {
      console.error('Failed to initialize realistic audio (drums):', err);
    });
    synthesisEngine.initialize().catch(err => {
      console.error('Failed to initialize synthesis engine (instruments):', err);
    });
  }, [synthesisEngine]);
  
  
  // Main View State (DAW-style tabs)
  const [activeView, setActiveView] = useState<'arrangement' | 'piano-roll' | 'mixer' | 'ai-studio' | 'lyrics' | 'song-uploader' | 'code-to-music' | 'audio-tools' | 'beat-lab' | 'multitrack'>('arrangement');
  
  // Section expansion states
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [pianoRollExpanded, setPianoRollExpanded] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);

  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [trackHeights, setTrackHeights] = useState<Record<string, number>>({});
  const trackListRef = useRef<HTMLDivElement>(null);
  const [trackListWidth, setTrackListWidth] = useState(1000);
  const [zoom, setZoom] = useState([50]);
  const playheadPosition = position * 4; // Convert beats to 16th-note steps
  const audioContextRef = useRef<AudioContext | null>(null);
  const waveformCacheRef = useRef<Map<string, Float32Array>>(new Map());
  const [waveformData, setWaveformData] = useState<Record<string, Float32Array>>({});
  const [showWaveformEditor, setShowWaveformEditor] = useState(false);
  const [waveformTrimStart, setWaveformTrimStart] = useState(0);
  const [waveformTrimEnd, setWaveformTrimEnd] = useState(100);
  
  // UI State
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [showMusicGen, setShowMusicGen] = useState(false);
  const [showLyricsFocus, setShowLyricsFocus] = useState(false);
  const [effectsDialogOpen, setEffectsDialogOpen] = useState(false);
  const [activeEffectTool, setActiveEffectTool] = useState<ToolType | null>(null);
  const [pianoRollTool, setPianoRollTool] = useState<'draw' | 'select' | 'erase'>('draw');
  const [beatLabTab, setBeatLabTab] = useState<'pro' | 'bass-studio' | 'loop-library' | 'pack-generator'>('pro');
  const [instrumentsExpanded, setInstrumentsExpanded] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showSampleBrowser, setShowSampleBrowser] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const undoManagerRef = useRef<UndoManager<StudioTrack[]> | null>(null);
  const isRestoringTracksRef = useRef(false);
  const [trackHistory, setTrackHistory] = useState<StudioTrack[][]>([]);
  const [trackFuture, setTrackFuture] = useState<StudioTrack[][]>([]);
  const trackClipboardRef = useRef<StudioTrack | null>(null);
  
  // Master Volume Control
  const [masterVolume, setMasterVolume] = useState(0.7); // Default 70%
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
      // Record current state for undo; clone to avoid future mutation issues
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
          payload,
        });
      }
    });
  }, [tracks, addTrackToStore, updateTrackInStore, removeTrackFromStore]);

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
        payload: { audioUrl: detail.audioUrl },
        audioUrl: detail.audioUrl,
        data: {},
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
        payload: {},
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
      // First time - show workflow selector
      setShowWorkflowSelector(true);
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
      payload: {},
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
  const playNote = async (note: string, octave: number, instrumentType?: string) => {
    try {
      // Get current track's instrument or use default
      const currentTrack = tracks.find(t => t.id === selectedTrack);
      let uiInstrument = instrumentType || currentTrack?.instrument || 'Grand Piano';
      
      // GET VOLUME AND PAN FROM TRACK
      const trackVolume = currentTrack?.volume ?? 0.8;
      const trackPan = currentTrack?.pan ?? 0;
      
      // Check if it's a drum instrument - use realisticAudio drum synthesis
      const drumMap: Record<string, string> = {
        'Kick': 'kick',
        'Snare': 'snare',
        'Hi-Hat': 'hihat',
        'Tom': 'tom',
        'Cymbal': 'crash',
        'Full Kit': 'kick'
      };
      
      if (drumMap[uiInstrument]) {
        // Use real drum synthesis from realisticAudio WITH TRACK VOLUME
        await realisticAudio.playDrumSound(drumMap[uiInstrument], trackVolume);
        return;
      }
      
      // For melodic instruments, use the RealisticAudioEngine with General MIDI soundfonts
      // This supports ALL instruments: trumpet, synth bass, violin, flute, etc.
      const midiInstrument = mapInstrumentName(uiInstrument);
      
      console.log(`🎹 Playing ${note}${octave} with instrument: ${uiInstrument} → ${midiInstrument}`);
      
      // Play using RealisticAudioEngine (soundfont-player) WITH TRACK VOLUME
      await realisticAudio.playNote(note, octave, trackVolume, midiInstrument, 0.5);
      
      // TODO: Apply pan using Web Audio API StereoPannerNode
    } catch (error) {
      console.error('Error playing note:', error);
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
  const handleNewProject = () => {
    if (confirm('Create new project? This will clear all tracks.')) {
      setTracks([]);
      toast({
        title: "New Project",
        description: "Created new empty project",
      });
    }
  };

  const handleSaveProject = () => {
    if (!requirePro("save", () => setShowLicenseModal(true))) return;
    const projectData = {
      tracks,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('unifiedStudioProject', JSON.stringify(projectData));
    toast({
      title: "Project Saved",
      description: "Your project has been saved locally",
    });
  };

  const handleLoadProject = () => {
    const saved = localStorage.getItem('unifiedStudioProject');
    if (saved) {
      const projectData = JSON.parse(saved);
      const normalized: StudioTrack[] = (projectData.tracks ?? []).map((t: any) => ({
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
      setTracks(normalized);
      toast({
        title: "Project Loaded",
        description: "Project loaded successfully",
      });
    } else {
      toast({
        title: "No Project Found",
        description: "No saved project found",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    if (!requirePro("export", () => setShowLicenseModal(true))) return;
    // Create a simple audio export
    const projectData = {
      tracks,
      tempo,
      timestamp: new Date().toISOString(),
    };
    const dataStr = JSON.stringify(projectData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CodedSwitch-Project-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
      payload: {},
      data: {},
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
      payload: {},
      data: {},
    };
    setTracks([...tracks, newTrack]);
    setSelectedTrack(newTrack.id);
    toast({ title: "Audio Track Created", description: newTrack.name });
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

  // Arrange menu actions
  const handleLoopSelection = () => {
    setLoop({ enabled: true, start: 0, end: 4 });
    toast({ title: "Loop Enabled", description: "Selection looped" });
  };

  const handleAddMarker = () => {
    toast({ title: "Marker Added", description: `Marker at bar ${Math.floor(playheadPosition / 16) + 1}` });
  };

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
    setZoom(([z]) => [Math.min(100, z + 5)]);
  };

  const handleZoomOut = () => {
    setZoom(([z]) => [Math.max(10, z - 5)]);
  };

  const handleZoomToFit = () => {
    setZoom([50]);
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
      payload: {},
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
        payload: {},
      };
      setTracks([...tracks, newTrack]);
    }
    setShowLyricsFocus(false);
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Top Bar */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-2 justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <h1 className="text-lg font-bold">🎵 Studio</h1>
          <div className="flex space-x-0.5">
            <div className="relative group">
              <Button variant="ghost" size="sm">File ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-900/80 backdrop-blur-md border border-gray-600/60 rounded shadow-2xl mt-1 w-56 z-[100] ring-1 ring-white/10">
                <button onClick={handleNewProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>New Project</span>
                  <span className="text-xs text-gray-500">Ctrl+N</span>
                </button>
                <button onClick={handleLoadProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Open Project...</span>
                  <span className="text-xs text-gray-500">Ctrl+O</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleSaveProject} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Save Project</span>
                  <span className="text-xs text-gray-500">Ctrl+S</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={() => setActiveView('song-uploader')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Import Audio...</span>
                  <span className="text-xs text-gray-500">Ctrl+I</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleExport} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Export Audio...</span>
                  <span className="text-xs text-gray-500">Ctrl+E</span>
                </button>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm">Edit ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-900/80 backdrop-blur-md border border-gray-600/60 rounded shadow-2xl mt-1 w-56 z-[100] ring-1 ring-white/10">
                <button onClick={handleUndo} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Undo</span>
                  <span className="text-xs text-gray-500">Ctrl+Z</span>
                </button>
                <button onClick={handleRedo} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Redo</span>
                  <span className="text-xs text-gray-500">Ctrl+Y</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleCut} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Cut</span>
                  <span className="text-xs text-gray-500">Ctrl+X</span>
                </button>
                <button onClick={handleCopy} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Copy</span>
                  <span className="text-xs text-gray-500">Ctrl+C</span>
                </button>
                <button onClick={handlePaste} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Paste</span>
                  <span className="text-xs text-gray-500">Ctrl+V</span>
                </button>
                <button onClick={handleDelete} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Delete</span>
                  <span className="text-xs text-gray-500">Del</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleSelectAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Select All</span>
                  <span className="text-xs text-gray-500">Ctrl+A</span>
                </button>
              </div>
            </div>
            <div className="relative group">
              <Button variant="ghost" size="sm">View ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-900/80 backdrop-blur-md border border-gray-600/60 rounded shadow-2xl mt-1 w-56 z-[100] ring-1 ring-white/10">
                <button onClick={() => setActiveView('arrangement')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'arrangement' ? '✓' : '  '} Arrangement</span>
                  <span className="text-xs text-gray-500">F1</span>
                </button>
                <button onClick={() => setActiveView('beat-lab')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'beat-lab' ? '✓' : '  '} Beat Lab</span>
                  <span className="text-xs text-gray-500">F2</span>
                </button>
                <button onClick={() => setActiveView('piano-roll')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'piano-roll' ? '✓' : '  '} Piano Roll</span>
                  <span className="text-xs text-gray-500">F3</span>
                </button>
                <button onClick={() => setActiveView('mixer')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'mixer' ? '✓' : '  '} Mixer</span>
                  <span className="text-xs text-gray-500">F4</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={() => setActiveView('ai-studio')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'ai-studio' ? '✓' : '  '} AI Studio</span>
                  <span className="text-xs text-gray-500">F5</span>
                </button>
                <button onClick={() => setActiveView('code-to-music')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'code-to-music' ? '✓' : '  '} Code to Music</span>
                  <span className="text-xs text-gray-500">F6</span>
                </button>
                <button onClick={() => setActiveView('lyrics')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'lyrics' ? '✓' : '  '} Lyrics</span>
                  <span className="text-xs text-gray-500">F7</span>
                </button>
                <button onClick={() => setActiveView('audio-tools')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'audio-tools' ? '✓' : '  '} Audio Tools</span>
                  <span className="text-xs text-gray-500">F8</span>
                </button>
                <button onClick={() => setActiveView('song-uploader')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{activeView === 'song-uploader' ? '✓' : '  '} Upload</span>
                  <span className="text-xs text-gray-500">F9</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={() => setInstrumentsExpanded(!instrumentsExpanded)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{instrumentsExpanded ? '✓' : '  '} Instrument Library</span>
                  <span className="text-xs text-gray-500">Ctrl+1</span>
                </button>
                <button onClick={() => { setShowSampleBrowser(!showSampleBrowser); toast({ title: showSampleBrowser ? "Sample Browser Hidden" : "Sample Browser Shown" }); }} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{showSampleBrowser ? '✓' : '  '} Sample Browser</span>
                  <span className="text-xs text-gray-500">Ctrl+2</span>
                </button>
                <button onClick={() => { setShowInspector(!showInspector); toast({ title: showInspector ? "Inspector Hidden" : "Inspector Shown" }); }} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{showInspector ? '✓' : '  '} Inspector</span>
                  <span className="text-xs text-gray-500">Ctrl+3</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleZoomIn} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Zoom In</span>
                  <span className="text-xs text-gray-500">Ctrl++</span>
                </button>
                <button onClick={handleZoomOut} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Zoom Out</span>
                  <span className="text-xs text-gray-500">Ctrl+-</span>
                </button>
                <button onClick={handleZoomToFit} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Zoom to Fit</span>
                  <span className="text-xs text-gray-500">Ctrl+0</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleToggleFullScreen} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Full Screen</span>
                  <span className="text-xs text-gray-500">F11</span>
                </button>
                <button onClick={() => { setFocusModeEnabled(!focusModeEnabled); toast({ title: focusModeEnabled ? "Focus Mode Off" : "Focus Mode On", description: focusModeEnabled ? "UI elements restored" : "Distraction-free mode enabled" }); }} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{focusModeEnabled ? '✓' : '  '} Focus Mode</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+F</span>
                </button>
              </div>
            </div>

            {/* CREATE Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm">Create ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-900/80 backdrop-blur-md border border-gray-600/60 rounded shadow-2xl mt-1 w-56 z-[100] ring-1 ring-white/10">
                <button onClick={handleNewMIDITrack} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>New MIDI Track</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+T</span>
                </button>
                <button onClick={handleNewAudioTrack} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>New Audio Track</span>
                  <span className="text-xs text-gray-500">Ctrl+T</span>
                </button>
                <button onClick={() => toast({ title: "New Instrument Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  New Instrument Track
                </button>
                <button onClick={() => toast({ title: "New Return Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  New Return Track
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={() => toast({ title: "Insert Audio Effect" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Insert Audio Effect...
                </button>
                <button onClick={() => toast({ title: "Insert MIDI Effect" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Insert MIDI Effect...
                </button>
                <button onClick={() => toast({ title: "Insert Instrument" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Insert Instrument...
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={() => toast({ title: "New Send" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  New Send
                </button>
                <button onClick={() => toast({ title: "New Bus" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  New Bus
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={() => toast({ title: "Empty Clip" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Empty Clip</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+M</span>
                </button>
                <button onClick={() => toast({ title: "Recording Clip" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Recording Clip
                </button>
              </div>
            </div>

            {/* ARRANGE Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm">Arrange ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-900/80 backdrop-blur-md border border-gray-600/60 rounded shadow-2xl mt-1 w-56 z-[100] ring-1 ring-white/10">
                <button onClick={() => toast({ title: "Insert Time" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Insert Time...</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+I</span>
                </button>
                <button onClick={() => toast({ title: "Delete Time" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Delete Time...</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+Del</span>
                </button>
                <button onClick={() => toast({ title: "Duplicate Time" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Duplicate Time...</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+D</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleLoopSelection} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Loop Selection</span>
                  <span className="text-xs text-gray-500">Ctrl+L</span>
                </button>
                <button onClick={() => toast({ title: "Set Loop Length" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Set Loop Length...
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleAddMarker} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Add Marker</span>
                  <span className="text-xs text-gray-500">M</span>
                </button>
                <button onClick={() => toast({ title: "Add Locator" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Add Locator
                </button>
                <button onClick={() => toast({ title: "Marker List" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Marker List...
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleSnapToGrid} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{snapToGridEnabled ? '✓' : '  '} Snap to Grid</span>
                  <span className="text-xs text-gray-500">Ctrl+G</span>
                </button>
                <button onClick={handleToggleGrid} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>{showGrid ? '✓' : '  '} Show Grid</span>
                  <span className="text-xs text-gray-500">G</span>
                </button>
                <button onClick={() => toast({ title: "Grid Settings" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Grid Settings...
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={() => toast({ title: "Tempo Map" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Tempo Map...
                </button>
                <button onClick={() => toast({ title: "Time Signature" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Time Signature...
                </button>
                <button onClick={() => toast({ title: "Key Signature" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Key Signature...
                </button>
              </div>
            </div>

            {/* MIX Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm">Mix ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-900/80 backdrop-blur-md border border-gray-600/60 rounded shadow-2xl mt-1 w-56 z-[100] ring-1 ring-white/10">
                <button onClick={handleNormalize} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Normalize</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+N</span>
                </button>
                <button onClick={handleReverse} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Reverse</span>
                  <span className="text-xs text-gray-500">Ctrl+R</span>
                </button>
                <button onClick={() => toast({ title: "Fade In" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Fade In
                </button>
                <button onClick={() => toast({ title: "Fade Out" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Fade Out
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleBounceToAudio} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Bounce to Audio</span>
                  <span className="text-xs text-gray-500">Ctrl+B</span>
                </button>
                <button onClick={() => toast({ title: "Freeze Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Freeze Track
                </button>
                <button onClick={() => toast({ title: "Flatten Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Flatten Track
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleGroupTracks} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Group Tracks</span>
                  <span className="text-xs text-gray-500">Ctrl+G</span>
                </button>
                <button onClick={() => toast({ title: "Ungroup Tracks" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                  <span>Ungroup Tracks</span>
                  <span className="text-xs text-gray-500">Ctrl+Shift+G</span>
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleSoloAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Solo All Tracks
                </button>
                <button onClick={handleMuteAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Mute All Tracks
                </button>
                <button onClick={handleUnsoloAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Unsolo All
                </button>
                <button onClick={handleUnmuteAll} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Unmute All
                </button>
                <div className="border-t border-gray-700 my-1"></div>
                <button onClick={handleResetFaders} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Reset All Faders
                </button>
                <button onClick={handleResetPan} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                  Reset All Pan
                </button>
              </div>
            </div>

            {/* MORE Menu - Groups Tools, Window, Help */}
            <div className="relative group">
              <Button variant="ghost" size="sm">More ▼</Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-900/80 backdrop-blur-md border border-gray-600/60 rounded shadow-2xl mt-1 w-56 z-[100] ring-1 ring-white/10">
                {/* Tools Submenu */}
                <div className="relative group/tools">
                  <div className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                    <span>🔧 Tools</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/tools:block absolute left-full top-0 bg-gray-800 border border-gray-700 rounded shadow-lg ml-1 w-56 z-[100]">
                    <button onClick={handleTuner} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                      <span>Tuner</span>
                      <span className="text-xs text-gray-500">Ctrl+Shift+U</span>
                    </button>
                    <button onClick={handleMetronome} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                      <span>{metronomeEnabled ? '✓' : '  '} Metronome</span>
                      <span className="text-xs text-gray-500">C</span>
                    </button>
                    <button onClick={() => toast({ title: "Click Track" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                      Click Track Settings...
                    </button>
                    <div className="border-t border-gray-700 my-1"></div>
                    <button onClick={() => toast({ title: "Spectrum Analyzer" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                      Spectrum Analyzer
                    </button>
                    <button onClick={() => toast({ title: "Chord Detector" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                      Chord Detector
                    </button>
                    <button onClick={() => toast({ title: "BPM Detector" })} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                      BPM Detector
                    </button>
                  </div>
                </div>

                {/* Window Submenu */}
                <div className="relative group/window">
                  <div className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                    <span>🪟 Window</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/window:block absolute left-full top-0 bg-gray-800 border border-gray-700 rounded shadow-lg ml-1 w-56 z-[100]">
                    <button onClick={handleResetLayout} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                      <span>Reset Layout</span>
                      <span className="text-xs text-gray-500">Ctrl+Alt+R</span>
                    </button>
                    <button onClick={() => setInstrumentsExpanded(!instrumentsExpanded)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                      {instrumentsExpanded ? '✓' : '  '} Show Instrument Library
                    </button>
                    <button onClick={handleToggleFullScreen} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                      <span>Full Screen</span>
                      <span className="text-xs text-gray-500">F11</span>
                    </button>
                  </div>
                </div>

                {/* Help Submenu */}
                <div className="relative group/help">
                  <div className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between">
                    <span>❓ Help</span>
                    <span>▶</span>
                  </div>
                  <div className="hidden group-hover/help:block absolute left-full top-0 bg-gray-800 border border-gray-700 rounded shadow-lg ml-1 w-56 z-[100]">
                    <button onClick={handleShowKeyboardShortcuts} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer flex items-center justify-between bg-transparent border-none text-white">
                      <span>Keyboard Shortcuts</span>
                      <span className="text-xs text-gray-500">?</span>
                    </button>
                    <button onClick={() => window.open('/docs', '_blank')} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                      Documentation
                    </button>
                    <div className="border-t border-gray-700 my-1"></div>
                    <button onClick={handleShowAbout} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm cursor-pointer bg-transparent border-none text-white">
                      About CodedSwitch
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDI Menu */}
            <div className="relative group">
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <Cable className="w-3 h-3" />
                MIDI ▼
                {midiConnected && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
              </Button>
              <div className="hidden group-hover:block absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-lg mt-1 w-72 z-[100] p-3 space-y-3">
                {/* MIDI Status */}
                <div className="pb-2 border-b border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">MIDI Controller</span>
                    <div className={`px-2 py-0.5 rounded text-xs font-semibold ${midiConnected ? 'bg-green-600' : 'bg-gray-600'}`}>
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
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium flex items-center justify-center gap-2"
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
                      className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh Devices
                    </button>
                  )}
                </div>

                {/* Connected Devices */}
                {midiConnected && midiDevices.length > 0 && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">Connected ({midiDevices.length}):</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {midiDevices.slice(0, 3).map((device) => (
                        <div key={device.id} className="text-xs bg-gray-700/50 rounded px-2 py-1.5">
                          <div className="font-medium text-white truncate">{device.name}</div>
                          <div className="text-gray-400 truncate">{device.manufacturer}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Notes Indicator */}
                {midiConnected && midiActiveNotes.size > 0 && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-green-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Playing: {Array.from(midiActiveNotes).join(', ')}
                    </div>
                  </div>
                )}

                {/* MIDI Volume Control */}
                {midiConnected && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-300">🔊 MIDI Volume</span>
                      <span className="text-xs text-blue-400 font-bold">{Math.round((midiSettings?.midiVolume ?? 0.3) * 100)}%</span>
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
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Silent</span>
                      <span>Loud</span>
                    </div>
                  </div>
                )}

                {/* Current Instrument */}
                {midiConnected && (
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Current Instrument:</div>
                    <select
                      value={midiSettings?.currentInstrument || 'piano'}
                      onChange={(e) => updateMIDISettings({ currentInstrument: e.target.value })}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
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
                  <div className="pt-2 border-t border-gray-700 space-y-2">
                    <div className="text-xs font-semibold text-gray-300 mb-2">⚙️ Advanced Options</div>
                    
                    {/* Sustain Pedal */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300">Sustain Pedal</span>
                        <span className="text-xs text-gray-500">(CC 64)</span>
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
                        <span className="text-xs text-gray-300">Pitch Bend</span>
                        <span className="text-xs text-gray-500">(±2 semitones)</span>
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
                        <span className="text-xs text-gray-300">Modulation</span>
                        <span className="text-xs text-gray-500">(CC 1)</span>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300">Auto-Connect</span>
                        <span className="text-xs text-gray-500">(New devices)</span>
                      </div>
                      <Switch
                        checked={midiSettings?.autoConnect !== false}
                        onCheckedChange={(checked) => {
                          updateMIDISettings({ autoConnect: checked });
                          toast({ 
                            title: checked ? "Auto-Connect Enabled" : "Auto-Connect Disabled",
                            description: checked ? "New devices connect automatically" : "Manual connection required",
                            duration: 2000 
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Help Text */}
                <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
                  💡 MIDI works across all tabs - play Piano Roll, Arrangement, Mixer in real-time!
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Transport Controls */}
        <div className="w-full flex items-center gap-3 mt-2 mb-3 relative z-0 py-1 overflow-x-auto overflow-y-visible whitespace-nowrap">
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 h-12 shrink-0">
            <Button
              size="sm"
              onClick={() => (transportPlaying ? pauseTransport() : startTransport())}
              className={transportPlaying ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"}
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
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
            <div className="flex items-center gap-2 text-xs text-gray-300 min-w-[110px]">
              <span className="font-semibold whitespace-nowrap">Bar {Math.max(1, Math.floor(playheadPosition / 16) + 1)}</span>
              <span className="text-gray-500 whitespace-nowrap">Beat {Math.max(1, Math.floor(position % 4) + 1)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 h-12 shrink-0">
            <Sliders className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-300 font-medium">Tempo</span>
            <div className="w-28">
              <Slider
                value={[tempo]}
                onValueChange={(value) => setTransportTempo(value[0])}
                max={200}
                min={40}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-xs text-white font-bold w-14 text-right">{Math.round(tempo)} BPM</span>
          </div>

          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 h-12 shrink-0">
            <Repeat className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-300 font-medium">Loop</span>
            <Switch
              checked={loop.enabled}
              onCheckedChange={(checked) => setLoop({ enabled: checked })}
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">
              Bars {loop.start + 1}-{loop.end}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant={loop.enabled ? 'default' : 'outline'}
                  className="px-3"
                >
                  {Math.max(1, Math.round((loop.end ?? 4) - (loop.start ?? 0)))}-Bar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900 border border-gray-700 text-white">
                {[1, 2, 4, 8].map((bars) => (
                  <DropdownMenuItem
                    key={bars}
                    className="text-sm"
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
      <div className="bg-gray-850 border-b border-gray-700 px-2 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* All Tabs - Left Side */}
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant={activeView === 'arrangement' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('arrangement')}
            className="h-8 px-3 text-xs"
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
            className="h-8 px-3 text-xs"
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
            className="h-8 px-3 text-xs"
            title="Open Pack Generator"
          >
            <Package className="w-3 h-3 mr-1" />
            Pack Generator
          </Button>
          <Button
            variant={activeView === 'piano-roll' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('piano-roll')}
            className="h-8 px-3 text-xs"
          >
            <Piano className="w-3 h-3 mr-1" />
            Piano
          </Button>
          <Button
            variant={activeView === 'mixer' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('mixer')}
            className="h-8 px-3 text-xs"
          >
            <Sliders className="w-3 h-3 mr-1" />
            Mixer
          </Button>
          <Button
            variant={activeView === 'multitrack' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('multitrack')}
            className="h-8 px-3 text-xs"
          >
            <Layers className="w-3 h-3 mr-1" />
            Multi-Track
          </Button>
          <div className="w-px h-5 bg-gray-600 mx-1" />
          <Button
            variant={activeView === 'ai-studio' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('ai-studio')}
            className="h-8 px-3 text-xs"
          >
            <Wand2 className="w-3 h-3 mr-1" />
            AI Studio
          </Button>
          <Button
            variant={activeView === 'code-to-music' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('code-to-music')}
            className="h-8 px-3 text-xs"
            data-testid="tab-code-to-music"
          >
            <Wand2 className="w-3 h-3 mr-1" />
            Code to Music
          </Button>
          <Button
            variant={activeView === 'lyrics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('lyrics')}
            className="h-8 px-3 text-xs"
          >
            <Mic2 className="w-3 h-3 mr-1" />
            Lyrics
          </Button>
          <Button
            variant={activeView === 'audio-tools' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('audio-tools')}
            className="h-8 px-3 text-xs"
          >
            <Wrench className="w-3 h-3 mr-1" />
            Tools
          </Button>
          <Button
            variant={activeView === 'song-uploader' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('song-uploader')}
            className="h-8 px-3 text-xs"
          >
            <Upload className="w-3 h-3 mr-1" />
            Upload
          </Button>
        </div>

        {/* Right Side - Compact Action Buttons & Volume */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-2 py-1 rounded border border-gray-700 bg-gray-800 text-xs text-gray-200">
            Snap: <span className={snapToGridEnabled ? 'text-green-400 font-semibold' : 'text-gray-400'}>{snapToGridEnabled ? 'On' : 'Off'}</span>
          </div>
          <Button
            onClick={() => setShowMusicGen(!showMusicGen)}
            className="bg-purple-600 hover:bg-purple-500 h-8 px-3"
            size="sm"
            title="Generate Music"
          >
            <Music className="w-3 h-3 mr-1" />
            Generate
          </Button>
          <Button
            onClick={() => setShowWorkflowSelector(true)}
            className="bg-green-600 hover:bg-green-500 h-8 px-3"
            data-testid="button-change-workflow"
            size="sm"
            title="Change Workflow"
          >
            <Workflow className="w-3 h-3 mr-1" />
            Workflow
          </Button>
          
          {/* Master Volume - Compact */}
          <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded border border-gray-700">
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
            <span className="text-xs text-white font-bold w-8 text-right">{Math.round(masterVolume * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Main Workspace with Tab Views */}
        <div className="flex-1 flex flex-col overflow-auto relative">
          
          {/* Floating Back to Studio Button - Shows when not in arrangement view */}
          {activeView !== 'arrangement' && (
            <div className="absolute top-4 left-4 z-50">
              <Button
                onClick={() => setActiveView('arrangement')}
                variant="outline"
                size="sm"
                className="bg-gray-900/95 border-gray-600 hover:bg-gray-800 shadow-lg backdrop-blur-sm flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Studio</span>
                <Home className="w-4 h-4 sm:hidden" />
              </Button>
            </div>
          )}

          {/* ARRANGEMENT VIEW */}
          {activeView === 'arrangement' && (
          <>
          {/* Timeline Section */}
          <div className="border-b border-gray-700">
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
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
            >
              <span className="font-medium">
                {timelineExpanded ? <ChevronDown className="inline w-4 h-4 mr-2" /> : <ChevronRight className="inline w-4 h-4 mr-2" />}
                TIMELINE - ALL TRACKS ({tracks.length})
              </span>
              <div className="flex items-center space-x-2">
                {selectedTrack && tracks.find(t => t.id === selectedTrack && t.type === 'audio') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); setShowWaveformEditor(true); }}
                    className="text-xs"
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
                  className="text-xs bg-gradient-to-r from-purple-600 to-blue-600"
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
                  className="text-xs"
                >
                  <i className="fas fa-plus mr-1"></i>
                  Add Track
                </Button>
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <span>Zoom:</span>
                  <Slider
                    value={zoom}
                    onValueChange={setZoom}
                    max={100}
                    min={10}
                    step={1}
                    className="w-24"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>{zoom[0]}%</span>
                </div>
              </div>
            </div>
            
            {timelineExpanded && (
              <div ref={trackListRef} className="bg-gray-900 p-4 max-h-96 overflow-y-auto">
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
                            <div className="w-48 bg-gray-800 p-3 border-r border-gray-700 flex-shrink-0 h-full">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm truncate">{track.name}</span>
                              </div>
                              <div className="flex items-center space-x-1 mb-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTracks(tracks.map(t =>
                                      t.id === track.id ? { ...t, muted: !t.muted } : t
                                    ));
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
                                    setTracks(tracks.map(t =>
                                      t.id === track.id ? { ...t, solo: !t.solo } : t
                                    ));
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
                                    setTracks(tracks.filter(t => t.id !== track.id));
                                  }}
                                  className="h-6 w-6 p-0 text-red-500"
                                >
                                  <i className="fas fa-trash text-xs"></i>
                                </Button>
                              </div>
                              <div className="text-xs space-y-1">
                                <div className="text-gray-400">Type: <span className="text-gray-200">{track.type.toUpperCase()}</span></div>
                                {track.instrument && <div className="text-gray-400">Inst: <span className="text-gray-200">{track.instrument}</span></div>}
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
                                      className="h-8 px-3 bg-green-600 border-green-500 hover:bg-green-500"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const url = (track as any).audioUrl || (track.payload as any)?.audioUrl;
                                        if (url) {
                                          const audio = new Audio(url);
                                          audio.play();
                                          toast({ title: "Playing", description: track.name });
                                        }
                                      }}
                                    >
                                      <Play className="w-3 h-3 mr-1" />
                                      Play
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3"
                                      onClick={(e) => {
                                        e.stopPropagation();
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
                    playNote(note, octave, instrument);
                  }}
                  onNotesChange={(updatedNotes: any[]) => {
                    if (selectedTrack) {
                      setTracks(tracks.map(t => 
                        t.id === selectedTrack 
                          ? { ...t, notes: updatedNotes }
                          : t
                      ));
                    }
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
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14">
              <BeatLab initialTab={beatLabTab} />
            </div>
          )}

          {/* PIANO ROLL VIEW */}
          {activeView === 'piano-roll' && (
            <div className="flex-1 overflow-auto bg-gray-900 pt-14">
              {/* @ts-ignore - VerticalPianoRoll prop types mismatch but runtime compatible */}
              <VerticalPianoRoll 
                {...({ tracks: tracks as any } as any)}
                selectedTrack={selectedTrack || undefined}
                isPlaying={transportPlaying}
                currentTime={playheadPosition}
                onPlayNote={(note: string, octave: number, duration: number, instrument: string) => {
                  // Play note with current track's instrument
                  playNote(note, octave, instrument);
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
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14 min-h-0">
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
            <div className="flex-1 overflow-y-auto bg-gray-900 pt-14">
              <MasterMultiTrackPlayer />
            </div>
          )}
        </div>

      {/* Floating/Overlay Components */}
      {/* TEMPORARILY DISABLED - React hooks error on mobile */}
      {/* {showAIAssistant && (
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
          {activeEffectTool === 'Deesser' && (
            <DeesserPlugin
              audioUrl={tracks.find((t) => t.id === selectedTrack)?.audioUrl}
              onClose={() => setEffectsDialogOpen(false)}
            />
          )}
          {activeEffectTool === 'Reverb' && (
            <ReverbPlugin
              audioUrl={tracks.find((t) => t.id === selectedTrack)?.audioUrl}
              onClose={() => setEffectsDialogOpen(false)}
            />
          )}
          {activeEffectTool === 'Limiter' && (
            <LimiterPlugin
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
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-full px-4 py-2 shadow-2xl flex items-center gap-3">
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
          </div>
        </div>
      )}
    </div>
    <UpgradeModal
      open={showLicenseModal}
      onClose={() => setShowLicenseModal(false)}
      onUpgrade={startUpgrade}
    />
    </div>
  );
} 
