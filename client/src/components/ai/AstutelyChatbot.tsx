// client/src/components/ai/AstutelyChatbot.tsx
// ASTUTELY CHATBOT - The Single Source of Truth AI for CodedSwitch
// A conversational AI assistant that can chat, generate beats, analyze audio, and CONTROL THE ENTIRE DAW
// Connected to: TrackStore, Transport, SongWorkSession, StudioAudio, GlobalSystems

import { useState, useRef, useEffect, useLayoutEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Minus, Sparkles, GripHorizontal, Zap, Music, Mic2, Wand2, Layers, Send, Play, Pause, Square, Volume2, Settings, Eye, Sliders, Activity, Database, Cpu, Search, MoveDiagonal2, Brain, Palette, Lock, Unlock, ChevronDown, ChevronUp, Drum, Guitar, FileText, Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useAbortableRequest, isAbortError } from '@/hooks/use-abortable-request';
import { useQuery } from '@tanstack/react-query';
import { astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';
import { useOrganismSafe } from '@/features/organism/GlobalOrganismWrapper';
import { useAstutelyCore } from '@/contexts/AstutelyCoreContext';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import { useTransport } from '@/contexts/TransportContext';
import { useSongWorkSession } from '@/contexts/SongWorkSessionContext';
import { useStudioStore } from '@/stores/useStudioStore';
import { setUploadedSongAudio } from '@/stores/useStudioStore';
import { globalSystems, globalAI, globalAudio } from '@/lib/globalSystems';
import { AstroHUD } from './AstroHUD';
import AstutelyBrainContent from '@/components/studio/AstutelyBrainPanel';
import { AIProviderSelector } from '@/components/ui/ai-provider-selector';

type AstutelyTab = 'chat' | 'brain' | 'create';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: 'beat' | 'stems' | 'analyze' | 'melody' | 'play' | 'stop' | 'status' | null;
  audioUrl?: string;
}

interface AstutelyChatbotProps {
  onClose?: () => void;
  onBeatGenerated?: (result: AstutelyResult) => void;
  /**
   * When true, render as a child of its parent (fills 100% × 100%) instead of
   * a viewport-pinned floating panel. Used by the ⌘K AssistantOverlay so the
   * Sheet positions the chatbot and the same React instance keeps owning the
   * conversation state — no second message store, no sync.
   */
  embedded?: boolean;
}

interface AstutelyBeatIntent {
  userPrompt: string;
  presetId: string;
  genre: string;
  mood: string;
  bpm: number;
  section: string;
  melodyArticulation: string;
  bassArticulation: string;
  chordTechnique: string;
  acePrompt: string;
  summary: string;
}

function pickAstutelyBeatIntent(input: string, fallbackBpm: number): AstutelyBeatIntent {
  const text = input.toLowerCase();
  const bpmMatch = text.match(/(\d{2,3})\s*bpm/) || text.match(/(?:tempo|speed)\s*(?:to|at)?\s*(\d{2,3})/);
  const parsedBpm = bpmMatch ? Number.parseInt(bpmMatch[1], 10) : NaN;
  const explicitBpm = Number.isFinite(parsedBpm) ? Math.max(60, Math.min(180, parsedBpm)) : null;
  const safeFallbackBpm = Math.max(60, Math.min(180, Math.round(fallbackBpm || 140)));

  const has = (...words: string[]) => words.some(w => text.includes(w));
  const instruments = [
    has('violin', 'strings', 'orchestral') ? 'violin strings' : '',
    has('piano', 'keys') ? 'piano keys' : '',
    has('guitar') ? 'guitar' : '',
    has('flute') ? 'flute' : '',
    has('sax') ? 'saxophone' : '',
    has('brass', 'trumpet', 'horn') ? 'brass' : '',
    has('808') ? 'heavy 808 bass' : '',
  ].filter(Boolean);

  let presetId = 'trap-140';
  let genre = 'trap';
  let bpm = explicitBpm ?? safeFallbackBpm;

  if (has('violin', 'orchestral', 'strings')) {
    presetId = 'ref-violin-trap-130';
    genre = 'orchestral trap';
    bpm = explicitBpm ?? 130;
  } else if (has('drill')) {
    presetId = 'drill-140';
    genre = 'drill';
    bpm = explicitBpm ?? 144;
  } else if (has('boom bap', 'boombap', 'old school')) {
    presetId = 'boombap-90';
    genre = 'boom bap';
    bpm = explicitBpm ?? 90;
  } else if (has('lofi', 'lo-fi', 'chill')) {
    presetId = 'lofi-85';
    genre = 'lo-fi hip-hop';
    bpm = explicitBpm ?? 85;
  } else if (has('r&b', 'rnb', 'soul', 'weeknd')) {
    presetId = 'ref-weekend-110';
    genre = 'r&b trap';
    bpm = explicitBpm ?? 110;
  } else if (has('afro', 'afrobeats')) {
    presetId = 'ref-alt-pop-120';
    genre = 'afrobeats';
    bpm = explicitBpm ?? 112;
  } else if (has('melodic', 'sad', 'emo')) {
    presetId = 'ref-lucid-dreams-80';
    genre = 'melodic emo trap';
    bpm = explicitBpm ?? 80;
  } else if (has('cypher', 'freestyle')) {
    presetId = 'cypher-90';
    genre = 'cypher freestyle';
    bpm = explicitBpm ?? 90;
  }

  const mood = has('dark', 'evil', 'menacing') ? 'dark'
    : has('sad', 'emo', 'melancholy') ? 'sad'
    : has('aggressive', 'hard', 'rage') ? 'aggressive'
    : has('smooth', 'r&b', 'rnb') ? 'smooth'
    : has('chill', 'lofi', 'lo-fi') ? 'chill'
    : 'focused';

  const melodyArticulation = has('violin', 'strings', 'flute', 'sax', 'smooth', 'sad', 'r&b', 'rnb')
    ? 'legato-slur'
    : 'staccato-pop';
  const bassArticulation = has('drill', 'trap', '808', 'rage', 'hard')
    ? 'bass-octave-jump'
    : 'bass-slide-up';
  const chordTechnique = has('violin', 'strings', 'orchestral') ? 'strings-legato'
    : has('piano', 'sad', 'story') ? 'piano-rolled-chord'
    : has('guitar') ? 'guitar-arp-rolled'
    : has('flute', 'sax') ? 'wind-legato'
    : 'guitar-muted-stab';

  const section = has('hook', 'chorus') ? 'hook'
    : has('intro') ? 'intro'
    : has('drop') ? 'drop'
    : 'verse';

  const aceTags = [
    genre,
    'hip-hop',
    `${bpm} bpm`,
    mood,
    'minor key',
    ...instruments,
    has('808', 'trap', 'drill') ? 'punchy 808 bass' : 'warm bass',
    has('drill') ? 'sliding 808' : '',
    'hard kick',
    'crisp hi-hats',
    'radio-ready mix',
    'wide stereo',
    'professional beat',
  ].filter(Boolean);

  return {
    userPrompt: input,
    presetId,
    genre,
    mood,
    bpm,
    section,
    melodyArticulation,
    bassArticulation,
    chordTechnique,
    acePrompt: `${aceTags.join(', ')}. Producer direction: ${input}`,
    summary: `${genre}, ${mood}, ${bpm} BPM${instruments.length ? `, ${instruments.join(', ')}` : ''}`,
  };
}

// Project status for AI context
interface ProjectStatus {
  trackCount: number;
  totalNotes: number;
  bpm: number;
  key: string;
  isPlaying: boolean;
  currentPosition: number;
  hasUploadedSong: boolean;
  songName?: string;
}

interface OrganismSnapshot {
  running: boolean;
  starting: boolean;
  inputSource: string;
  activePresetId: string | null;
  bpm: number;
  physics: {
    mode: string;
    pulse: number;
    bounce: number;
    swing: number;
    pocket: number;
    presence: number;
    density: number;
    voiceActive: boolean;
  } | null;
  organism: {
    state: string;
    flowDepth: number;
  } | null;
  levels: {
    masterRmsDb: number;
    channels: Record<string, number>;
  } | null;
  generators: Record<string, number> | null;
  transcription: {
    supported: boolean;
    enabled: boolean;
    lineCount: number;
    latestLine: string | null;
  } | null;
  updatedAt: number;
}

interface WebEarBridgeStatus {
  state: 'initializing' | 'connected' | 'disconnected' | 'no-auth' | 'no-key' | 'error';
  message: string;
  updatedAt: number;
}

const readOrganismSnapshot = (): OrganismSnapshot | null => {
  if (typeof window === 'undefined') return null;
  const snapshot = (window as unknown as { __organismSnapshot?: OrganismSnapshot }).__organismSnapshot;
  return snapshot ?? null;
};

const readWebEarStatus = (): WebEarBridgeStatus | null => {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __webearStatus?: WebEarBridgeStatus }).__webearStatus ?? null;
};

const STORAGE_KEY = 'astutelyChatbot';
const DEFAULT_WIDTH = 420; // Increased for HUD
const DEFAULT_HEIGHT = 650; // Increased for HUD
const MIN_WIDTH = 360;
const MAX_WIDTH = 860;
const MIN_HEIGHT = 420;
const MAX_HEIGHT = 960;

const clampPosition = (x: number, y: number, width: number, height: number) => {
  const padding = 24;
  const maxX = window.innerWidth - padding;
  const maxY = window.innerHeight - padding;
  
  return {
    x: Math.max(padding - width + padding, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY - padding)),
  };
};

const quickActions = [
  { icon: Music, label: 'Generate Beat', action: 'beat', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' },
  { icon: Wand2, label: 'Create Melody', action: 'melody', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
  { icon: Play, label: 'Play/Pause', action: 'play', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
  { icon: Eye, label: 'Project Status', action: 'status', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
];

export default function AstutelyChatbot({ onClose, onBeatGenerated, embedded = false }: AstutelyChatbotProps) {
  // ═══════════════════════════════════════════════════════════════════════════
  // CENTRAL BRAIN CONNECTIONS - All contexts connected here
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Track Store - knows all tracks in the project
  const { tracks, addTrack, saveTrackToServer } = useTrackStore();

  // Organism trigger pipeline — same detector that handles voice transcription.
  // Safe variant returns null if no OrganismProvider is mounted (e.g. chatbot
  // rendered before Organism activation); the handler guards with `?.`.
  const organism = useOrganismSafe();
  
  // Transport - controls playback (play/pause/stop, tempo, position)
  const transport = useTransport();
  
  // Song Work Session - current song session with analysis
  const songSession = useSongWorkSession();
  
  // Studio Store (Zustand) - patterns, melodies, lyrics, uploaded songs
  const currentKey = useStudioStore((s) => s.key);
  const currentUploadedSong = useStudioStore((s) => s.currentUploadedSong);
  // Astutely Core - organism controls routed through context
  const {
    startOrganism,
    stopOrganism,
    captureOrganism,
    generatePattern,
    generateRealAudio,
    playGeneratedAudio,
    organismQuickStart,
    organismSetBpm,
    organismSetChordTechnique,
    organismSetMelodyArticulation,
    organismSetBassArticulation,
  } = useAstutelyCore();
  
  // Fetch uploaded songs from library
  const { data: uploadedSongs = [] } = useQuery<any[]>({
    queryKey: ['/api/songs'],
    initialData: [],
  });
  
  // Get current project status for AI context
  const getProjectStatus = (): ProjectStatus => {
    const totalNotes = tracks.reduce((sum: number, track: any) => {
      const notes = track.payload?.notes || [];
      return sum + (Array.isArray(notes) ? notes.length : 0);
    }, 0);
    
    return {
      trackCount: tracks.length,
      totalNotes,
      bpm: transport.tempo || 120,
      key: currentKey || 'C',
      isPlaying: transport.isPlaying || false,
      currentPosition: useStudioStore.getState().position || 0,
      hasUploadedSong: !!currentUploadedSong,
      songName: currentUploadedSong?.name || songSession.currentSession?.songName,
    };
  };

  const getOrganismSnapshot = (): OrganismSnapshot | null => {
    return readOrganismSnapshot();
  };

  const describeOrganism = (snapshot: OrganismSnapshot, webearStatus: WebEarBridgeStatus | null): string => {
    const physics = snapshot.physics;
    const organism = snapshot.organism;
    const generators = snapshot.generators;
    const generatorText = generators
      ? Object.entries(generators)
          .filter(([, level]) => level > 0.05)
          .map(([name, level]) => `${name} ${(level * 100).toFixed(0)}%`)
          .join(', ')
      : 'generator activity is still warming up';

    const hearingLine = webearStatus?.state === 'connected'
      ? `Yes, I hear it through WebEar.`
      : `I can read the Organism's live state, but WebEar is not connected yet (${webearStatus?.message ?? 'no WebEar status'}).`;

    return [
      hearingLine,
      `The Organism is ${snapshot.running ? 'playing' : snapshot.starting ? 'starting' : 'not currently running'} at about ${Math.round(snapshot.bpm)} BPM.`,
      physics ? `Mode is ${physics.mode}, with bounce ${physics.bounce.toFixed(2)}, swing ${physics.swing.toFixed(2)}, density ${physics.density.toFixed(2)}, and presence ${physics.presence.toFixed(2)}.` : '',
      organism ? `State is ${organism.state}, flow depth ${(organism.flowDepth * 100).toFixed(0)}%.` : '',
      `I’m seeing ${generatorText}.`,
      `Tell me what you want changed and I can help direct it.`
    ].filter(Boolean).join('\n');
  };

  const getSavedState = () => {
    const fallback = {
      x: typeof window !== 'undefined' ? window.innerWidth - DEFAULT_WIDTH - 24 : 100,
      y: 80,
      isMinimized: false,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const width = Math.min(Math.max(parsed.width ?? DEFAULT_WIDTH, MIN_WIDTH), MAX_WIDTH);
        const height = Math.min(Math.max(parsed.height ?? DEFAULT_HEIGHT, MIN_HEIGHT), MAX_HEIGHT);
        const clamped = clampPosition(parsed.x ?? fallback.x, parsed.y ?? fallback.y, width, height);
        return {
          x: clamped.x,
          y: clamped.y,
          isMinimized: Boolean(parsed.isMinimized),
          width,
          height,
        };
      }
    } catch (e) {
      console.error('Failed to load Astutely state:', e);
    }

    return fallback;
  };

  const savedState = getSavedState();
  const [activeTab, setActiveTab] = useState<AstutelyTab>('chat');
  const [isMinimized, setIsMinimized] = useState(savedState.isMinimized);
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmInputValue, setBpmInputValue] = useState('');
  const [syncLocked, setSyncLocked] = useState(true);
  const [showVolume, setShowVolume] = useState(false);
  const [masterVolume, setMasterVolume] = useState(80);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [position, setPosition] = useState({ x: savedState.x, y: savedState.y });
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({ width: savedState.width, height: savedState.height });
  const [showResizeGuide, setShowResizeGuide] = useState(true);
  const resizeStateRef = useRef({ startX: 0, startY: 0, startWidth: DEFAULT_WIDTH, startHeight: DEFAULT_HEIGHT });
  const resizingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `CENTRAL AI BRAIN ONLINE. 🧠
Connected to all tracks and transport. Ready to generate, mix, and control.

Try: "play", "make a drill beat", or "analyze my project".`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const getChatAbortSignal = useAbortableRequest();
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [organismSnapshotForUi, setOrganismSnapshotForUi] = useState<OrganismSnapshot | null>(() => readOrganismSnapshot());
  const lastOrganismCommandAtRef = useRef(0);
  const queuedOrganismCommandRef = useRef<number | null>(null);
  const [lastAceIntent, setLastAceIntent] = useState<AstutelyBeatIntent | null>(null);
  const [isAceRendering, setIsAceRendering] = useState(false);
  const performanceSafeMode = !!organismSnapshotForUi?.running || !!organismSnapshotForUi?.starting;
  const organismUiSummary = organismSnapshotForUi
    ? `${Math.round(organismSnapshotForUi.bpm)} BPM / ${organismSnapshotForUi.physics?.mode ?? 'warming'} / ${organismSnapshotForUi.physics?.voiceActive ? 'voice active' : 'voice waiting'}`
    : 'No Organism signal';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const refreshSnapshot = () => setOrganismSnapshotForUi(readOrganismSnapshot());
    let lastFlush = 0;

    const handleSnapshot = () => {
      const next = readOrganismSnapshot();
      const now = performance.now();
      const previousLive = !!organismSnapshotForUi?.running || !!organismSnapshotForUi?.starting;
      const nextLive = !!next?.running || !!next?.starting;

      if (previousLive !== nextLive || now - lastFlush > 1000) {
        lastFlush = now;
        setOrganismSnapshotForUi(next);
      }
    };

    refreshSnapshot();
    window.addEventListener('organism:snapshot', handleSnapshot);
    return () => window.removeEventListener('organism:snapshot', handleSnapshot);
  }, [organismSnapshotForUi?.running, organismSnapshotForUi?.starting]);

  useEffect(() => {
    if (performanceSafeMode && activeTab !== 'chat') {
      setActiveTab('chat');
    }
  }, [activeTab, performanceSafeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        x: position.x,
        y: position.y,
        isMinimized,
        width: panelSize.width,
        height: panelSize.height,
      }));
    } catch (e) {
      console.error('Failed to save Astutely state:', e);
    }
  }, [position, isMinimized, panelSize.width, panelSize.height]);

  useLayoutEffect(() => {
    const handleResize = () => {
      setPosition(prev => clampPosition(prev.x, prev.y, panelSize.width, panelSize.height));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [panelSize.width, panelSize.height]);

  useEffect(() => {
    setPosition(prev => clampPosition(prev.x, prev.y, panelSize.width, panelSize.height));
  }, [panelSize.width, panelSize.height]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const newPos = clampPosition(
        e.clientX - dragOffset.x,
        e.clientY - dragOffset.y,
        panelSize.width,
        panelSize.height
      );
      setPosition(newPos);
    };

    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, dragOffset, panelSize.width, panelSize.height]);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const handleResizePointerMove = useCallback((event: PointerEvent) => {
    if (!resizingRef.current) return;
    const { startX, startY, startWidth, startHeight } = resizeStateRef.current;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    setPanelSize({
      width: clamp(startWidth + deltaX, MIN_WIDTH, MAX_WIDTH),
      height: clamp(startHeight + deltaY, MIN_HEIGHT, MAX_HEIGHT),
    });
  }, []);

  const handleResizePointerUp = useCallback(() => {
    document.removeEventListener('pointermove', handleResizePointerMove);
    document.removeEventListener('pointerup', handleResizePointerUp);
    resizingRef.current = false;
  }, [handleResizePointerMove]);

  const handleResizeStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelSize.width,
      startHeight: panelSize.height,
    };
    resizingRef.current = true;
    setShowResizeGuide(false);
    document.addEventListener('pointermove', handleResizePointerMove);
    document.addEventListener('pointerup', handleResizePointerUp);
  }, [panelSize.width, panelSize.height, handleResizePointerMove, handleResizePointerUp]);

  useEffect(() => () => {
    document.removeEventListener('pointermove', handleResizePointerMove);
    document.removeEventListener('pointerup', handleResizePointerUp);
  }, [handleResizePointerMove, handleResizePointerUp]);

  useEffect(() => () => {
    if (queuedOrganismCommandRef.current !== null) {
      window.clearTimeout(queuedOrganismCommandRef.current);
    }
  }, []);

  useEffect(() => {
    if (!showResizeGuide) return;
    const timer = setTimeout(() => setShowResizeGuide(false), 5000);
    return () => clearTimeout(timer);
  }, [showResizeGuide]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError(null);
    };

    recognition.onerror = (event: any) => {
      const message = event.error === 'not-allowed'
        ? 'Microphone access was blocked. Please allow it in your browser permissions.'
        : 'Voice capture failed. Please try again.';
      setSpeechError(message);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(prev => {
        const trimmed = prev.trim();
        if (!trimmed) return transcript;
        return `${trimmed} ${transcript}`.trim();
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleStartListening = () => {
    if (performanceSafeMode) {
      setSpeechError('Type while the Organism is playing so Astutely does not open another mic listener.');
      return;
    }
    if (!speechSupported || !recognitionRef.current) {
      toast({ title: 'Voice Input Not Supported', description: 'Your browser does not support speech recognition.' });
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (error) {
      setSpeechError('Unable to access your microphone. Please try again.');
    }
  };

  const handleStopListening = () => {
    recognitionRef.current?.stop();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DAW CONTROL FUNCTIONS - Astutely can control the entire DAW
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handlePlayPause = () => {
    if (transport.isPlaying) {
      transport.pause();
      return 'paused';
    } else {
      transport.play();
      return 'playing';
    }
  };
  
  const handleStop = () => {
    transport.stop();
    return 'stopped';
  };
  
  const handleSetTempo = (newBpm: number) => {
    transport.setTempo(newBpm);
    useStudioStore.getState().setBpm(newBpm);
    return newBpm;
  };

  const commitBpmEdit = () => {
    const parsed = parseInt(bpmInputValue, 10);
    if (!isNaN(parsed) && parsed >= 40 && parsed <= 300) {
      handleSetTempo(parsed);
    }
    setEditingBpm(false);
  };

  const handleMasterVolume = (vol: number) => {
    setMasterVolume(vol);
    try {
      // Tone.js master volume: convert 0-100 to dB (-60 to 0)
      const Tone = (window as any).Tone;
      if (Tone?.Destination) {
        Tone.Destination.volume.value = vol === 0 ? -Infinity : (vol / 100) * 6 - 6;
      }
    } catch {}
  };
  
  const handleNavigateToTool = (tool: string) => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: tool }));
    return tool;
  };

  const handleQuickAction = async (action: string) => {
    const actionMessages: Record<string, string> = {
      beat: "Generate a beat for me",
      melody: "Create a melody for my project",
      play: transport.isPlaying ? "Pause playback" : "Start playback",
      status: "Show me my project status",
    };

    const userMessage: Message = {
      role: 'user',
      content: actionMessages[action] || action,
      timestamp: new Date(),
      action: action as any,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (action === 'beat') {
        const status = getProjectStatus();
        const intent = pickAstutelyBeatIntent('make a reference-level hip-hop beat', status.bpm);
        applyBeatIntentToOrganism(intent);

        const assistantMessage: Message = {
          role: 'assistant',
          content: `I started the Organism with a reference-level direction.

**Direction:** ${intent.summary}
**Live engine:** ${intent.presetId}
**Playing style:** ${intent.chordTechnique}, ${intent.melodyArticulation}, ${intent.bassArticulation}

Listen live and adjust the vibe. Say **"render this with ACE"** when you want the polished WAV.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        toast({ title: 'Organism directed', description: intent.summary });

      } else if (action === 'play') {
        const state = handlePlayPause();
        const status = getProjectStatus();
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: state === 'playing' 
            ? `▶️ **Playing** at ${status.bpm} BPM in ${status.key}

${status.trackCount} tracks • ${status.totalNotes} notes
${status.songName ? `🎵 "${status.songName}"` : ''}
The song is now playing. Say "stop" or "pause" to stop playback.`
            : `⏸️ **Paused** at position ${status.currentPosition.toFixed(1)} beats

Say "play" to resume or "stop" to reset.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        toast({ 
          title: state === 'playing' ? '▶️ Playing' : '⏸️ Paused',
          description: `${status.bpm} BPM`
        });

      } else if (action === 'status') {
        const status = getProjectStatus();
        const projectTracks = tracks;
        
        let trackList = '';
        if (projectTracks.length > 0) {
          trackList = projectTracks.slice(0, 5).map((t: any, i: number) => 
            `  ${i + 1}. ${t.name || t.type || 'Track'}`
          ).join('\n');
          if (projectTracks.length > 5) {
            trackList += `\n  ... and ${projectTracks.length - 5} more`;
          }
        }
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: `📊 **Project Status**

🎵 **${status.trackCount}** tracks • **${status.totalNotes}** notes
🎹 Key: **${status.key}** • BPM: **${status.bpm}**
${status.isPlaying ? '▶️ Currently playing' : '⏹️ Stopped'} at beat ${status.currentPosition.toFixed(1)}
${status.hasUploadedSong ? `🎧 Song loaded: "${status.songName}"` : '📂 No song uploaded'}

${projectTracks.length > 0 ? `**Tracks:**\n${trackList}` : '💡 No tracks yet - say "make a beat" to get started!'}

What would you like to do?`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

      } else if (action === 'melody') {
        const result = await generatePattern({ style: 'Lo-fi chill' });
        const notes = astutelyToNotes(result);
        const melodyNotes = notes.filter(n => n.trackType === 'melody');
        
        if (onBeatGenerated) {
          onBeatGenerated(result);
        }

        window.dispatchEvent(new CustomEvent('astutely:generated', { 
          detail: { notes, bpm: result.bpm } 
        }));

        // Generate real AI audio for the melody
        let audioInfo = { provider: 'synth', audioUrl: '' };
        try {
          toast({ title: '🎵 Generating audio...', description: 'Creating real melody audio with AI' });
          const audioResult = await generateRealAudio('Lo-fi chill', { bpm: result.bpm, key: result.key });
          audioInfo = audioResult;
          try {
            await playGeneratedAudio(audioResult.audioUrl);
          } catch (playErr) {
            console.warn('Autoplay blocked:', playErr);
          }
          const audioTrack: any = {
            id: `ai-audio-melody-${Date.now()}`,
            name: `Astutely Melody Audio`,
            kind: 'audio',
            lengthBars: Math.ceil(audioResult.duration / (60 / result.bpm) / 4),
            startBar: 0,
            payload: {
              type: 'audio',
              audioUrl: audioResult.audioUrl,
              duration: audioResult.duration,
              bpm: result.bpm,
              source: 'astutely-audio',
              provider: audioResult.provider,
              color: '#3b82f6',
              volume: 0.9,
              pan: 0,
            }
          };
          addTrack(audioTrack);
          await saveTrackToServer(audioTrack);
        } catch (audioError) {
          console.warn('Melody audio generation failed, using synth preview:', audioError);
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: `🎹 Melody created!

Generated a **${result.style}** melody with **${melodyNotes.length} notes** in **${result.key}**.
${audioInfo.audioUrl ? `🔊 **Real audio generated** via ${audioInfo.provider}!` : ''}

The melody is now in your Piano Roll. Say "play" to hear it!`,
          timestamp: new Date(),
          audioUrl: audioInfo.audioUrl || undefined,
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        toast({ title: '🎹 Melody Created!', description: `${melodyNotes.length} notes in ${result.key}` });
      }

    } catch (error) {
      console.error('Astutely action error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Oops! Something went wrong. Let me try again or try a different approach.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const dispatchOrganismCommandSafely = (detail: Record<string, unknown>, snapshot: OrganismSnapshot | null) => {
    if (queuedOrganismCommandRef.current !== null) {
      window.clearTimeout(queuedOrganismCommandRef.current);
      queuedOrganismCommandRef.current = null;
    }

    const now = performance.now();
    const msSinceLastCommand = now - lastOrganismCommandAtRef.current;
    const delay = snapshot?.starting
      ? 700
      : msSinceLastCommand < 1500
        ? 1500 - msSinceLastCommand
        : 0;

    const send = () => {
      lastOrganismCommandAtRef.current = performance.now();
      window.dispatchEvent(new CustomEvent('organism:command', {
        detail: {
          ...detail,
          source: 'astutely-safe-chat',
        },
      }));
      queuedOrganismCommandRef.current = null;
    };

    if (delay > 0) {
      queuedOrganismCommandRef.current = window.setTimeout(send, delay);
    } else {
      send();
    }
  };

  const applyBeatIntentToOrganism = (intent: AstutelyBeatIntent) => {
    organismQuickStart(intent.presetId);
    window.setTimeout(() => {
      organismSetBpm(intent.bpm);
      organismSetChordTechnique(intent.chordTechnique);
      organismSetMelodyArticulation(intent.melodyArticulation);
      organismSetBassArticulation(intent.bassArticulation);
    }, 900);
    setLastAceIntent(intent);
    useStudioStore.getState().setBpm(intent.bpm);
    window.dispatchEvent(new CustomEvent('astutely:ace-intent-ready', { detail: intent }));
  };

  const renderAceIntent = async (intent: AstutelyBeatIntent): Promise<{ audioUrl: string; duration?: number; prompt: string }> => {
    setIsAceRendering(true);
    try {
      const submit = await fetch('/api/ai-music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: intent.acePrompt,
          genre: intent.genre,
          mood: intent.mood,
          bpm: intent.bpm,
          section: intent.section,
          extraHints: intent.userPrompt,
          lyrics: '',
          audioDuration: 90,
          inferStep: 35,
        }),
      });
      if (!submit.ok) throw new Error(`ACE render failed: ${submit.status}`);
      const submitted = await submit.json() as { jobId?: string; job_id?: string; prompt?: string };
      const jobId = submitted.jobId ?? submitted.job_id;
      if (!jobId) throw new Error('ACE did not return a job id');

      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise(r => window.setTimeout(r, 2500));
        const poll = await fetch(`/api/ai-music/job/${jobId}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!poll.ok) continue;
        const job = await poll.json() as {
          status?: string;
          outputUrl?: string;
          output_url?: string;
          durationS?: number;
          duration_s?: number;
          error?: string;
        };
        if (job.status === 'done') {
          const audioUrl = job.outputUrl ?? job.output_url;
          if (!audioUrl) throw new Error('ACE finished but returned no audio URL');
          return {
            audioUrl,
            duration: job.durationS ?? job.duration_s,
            prompt: submitted.prompt ?? intent.acePrompt,
          };
        }
        if (job.status === 'error') {
          throw new Error(job.error || 'ACE render failed');
        }
      }
      throw new Error('ACE render timed out');
    } finally {
      setIsAceRendering(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // Direct Patch: any music-generating interface should feed typed text
    // through the same trigger pipeline as voice transcription. Emotional /
    // mood phrases ("sad violin", "beautiful lush") commit to the orchestrator
    // before the LLM round-trip so the live engine reacts immediately, even
    // if the model response is slow or never arrives.
    if (organism?.triggerDetectorRef.current) {
      await organism.triggerDetectorRef.current.processText(currentInput);
    }

    try {
      // ═══════════════════════════════════════════════════════════════════════════
      // INTELLIGENT COMMAND PARSING - Astutely understands natural language commands
      // ═══════════════════════════════════════════════════════════════════════════
      const lowerInput = currentInput.toLowerCase().trim();
      const status = getProjectStatus();
      const organismSnapshot = getOrganismSnapshot();
      const webearStatus = readWebEarStatus();

      const asksIfAstutelyHearsOrganism =
        (lowerInput.includes('hear') || lowerInput.includes('hearing') || lowerInput.includes('listen')) &&
        (lowerInput.includes('organism') || lowerInput.includes('him') || lowerInput.includes('it'));

      if (asksIfAstutelyHearsOrganism) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: organismSnapshot
            ? describeOrganism(organismSnapshot, webearStatus)
            : `I do not have a live Organism signal yet. Start the Organism first, then ask me again.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        return;
      }

      const asksForBetterMelody =
        (lowerInput.includes('melody') || lowerInput.includes('melodie') || lowerInput.includes('melodi') || lowerInput.includes('mealodie')) &&
        (
          lowerInput.includes('better') ||
          lowerInput.includes('improve') ||
          lowerInput.includes('help') ||
          lowerInput.includes('fix') ||
          lowerInput.includes('make it good')
        );

      if (asksForBetterMelody && organismSnapshot?.running) {
        dispatchOrganismCommandSafely({
          action: 'improve-melody',
          articulationId: 'legato',
        }, organismSnapshot);

        const assistantMessage: Message = {
          role: 'assistant',
          content: `Got it. I’m keeping the drums, bass, and chords locked, then asking the Organism to rebuild only the melody against the current ${Math.round(organismSnapshot.bpm)} BPM ${organismSnapshot.physics?.mode ?? ''} groove.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        toast({ title: 'Melody update sent', description: 'Organism is rebuilding melody only.' });
        return;
      }

      if (asksForBetterMelody && organismSnapshot && !organismSnapshot.running) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: `I can help with the melody, but the Organism is not playing right now. Start it first, then tell me to improve the melody.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        return;
      }

      const asksToRenderWithAce =
        (lowerInput.includes('ace') || lowerInput.includes('render') || lowerInput.includes('final') || lowerInput.includes('bounce')) &&
        (lowerInput.includes('beat') || lowerInput.includes('track') || lowerInput.includes('this') || lowerInput.includes('audio') || lowerInput.includes('song'));

      if (asksToRenderWithAce) {
        const intent = lastAceIntent ?? pickAstutelyBeatIntent(currentInput, status.bpm);
        setLastAceIntent(intent);
        const workingMessage: Message = {
          role: 'assistant',
          content: `Rendering this with ACE now: **${intent.summary}**. I’ll return the WAV when the job finishes.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, workingMessage]);
        toast({ title: 'ACE render started', description: intent.summary });

        const rendered = await renderAceIntent(intent);
        const assistantMessage: Message = {
          role: 'assistant',
          content: `ACE render is ready.

**${intent.summary}**
${rendered.duration ? `Duration: ${Math.round(rendered.duration)}s\n` : ''}Use the player below to audition it or download the WAV.`,
          timestamp: new Date(),
          audioUrl: rendered.audioUrl,
        };
        setMessages(prev => [...prev, assistantMessage]);
        toast({ title: 'ACE render ready', description: `${intent.genre} beat rendered` });
        return;
      }
      
      // PLAYBACK COMMANDS
      if (lowerInput === 'play' || lowerInput === 'start' || lowerInput.includes('play it') || lowerInput.includes('start playing')) {
        if (!transport.isPlaying) {
          transport.play();
          const assistantMessage: Message = {
            role: 'assistant',
            content: `▶️ **Playing** at ${status.bpm} BPM in ${status.key}\n\n${status.trackCount} tracks • ${status.totalNotes} notes`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          toast({ title: '▶️ Playing', description: `${status.bpm} BPM` });
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `Already playing! Say "pause" or "stop" to control playback.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      if (lowerInput === 'pause' || lowerInput === 'stop' || lowerInput.includes('stop it') || lowerInput.includes('pause it')) {
        if (lowerInput === 'stop' || lowerInput.includes('stop')) {
          transport.stop();
          const assistantMessage: Message = {
            role: 'assistant',
            content: `⏹️ **Stopped** and reset to beginning.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          transport.pause();
          const assistantMessage: Message = {
            role: 'assistant',
            content: `⏸️ **Paused** at beat ${status.currentPosition.toFixed(1)}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      // ORGANISM / FREESTYLE COMMANDS
      if (lowerInput.includes('start listening') || lowerInput.includes('freestyle mode') || lowerInput.includes('start freestyle') || lowerInput.includes('start organism')) {
        startOrganism('mic');
        const assistantMessage: Message = {
          role: 'assistant',
          content: `🎤 **Freestyle Mode Activated**\n\nThe Organism is now listening to your mic. Start freestyling — the beat will follow your flow, cadence, and energy in real-time.\n\n- Say **"stop listening"** when you're done\n- Say **"capture that"** to save the session\n- Your lyrics are being transcribed live`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        toast({ title: '🎤 Freestyle Mode', description: 'Organism is listening...' });
        return;
      }

      if (lowerInput.includes('stop listening') || lowerInput.includes('stop freestyle') || lowerInput.includes('stop organism')) {
        stopOrganism();
        const assistantMessage: Message = {
          role: 'assistant',
          content: `⏹️ **Freestyle Stopped**\n\nThe Organism has stopped listening. Your lyrics were captured — use the **Copy Lyrics** or **Export .txt** buttons on the Organism page to save them.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        return;
      }

      if (lowerInput.includes('capture that') || lowerInput.includes('capture session') || lowerInput.includes('save session')) {
        captureOrganism();
        const assistantMessage: Message = {
          role: 'assistant',
          content: `💾 **Session Captured**\n\nYour freestyle session DNA has been saved. Check the sidebar for details — mode, BPM, flow %, energy profile, and more.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        return;
      }

      if (lowerInput.includes('download midi') && (lowerInput.includes('organism') || lowerInput.includes('freestyle') || lowerInput.includes('session'))) {
        window.dispatchEvent(new CustomEvent('organism:command', {
          detail: { action: 'download-midi' },
        }));
        const assistantMessage: Message = {
          role: 'assistant',
          content: `🎹 **MIDI Download Started**\n\nYour freestyle session MIDI file is being prepared for download.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        return;
      }

      // BPM COMMANDS
      const bpmMatch = lowerInput.match(/(?:set\s+)?(?:bpm|tempo)\s*(?:to\s+)?(\d+)/i) || 
                       lowerInput.match(/(\d+)\s*bpm/i);
      if (bpmMatch) {
        const newBpm = parseInt(bpmMatch[1]);
        if (newBpm >= 40 && newBpm <= 300) {
          handleSetTempo(newBpm);
          const assistantMessage: Message = {
            role: 'assistant',
            content: `🎚️ **Tempo set to ${newBpm} BPM**\n\nYour project is now at ${newBpm} BPM.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          toast({ title: '🎚️ Tempo Changed', description: `${newBpm} BPM` });
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `BPM should be between 40 and 300. Try "set bpm to 120".`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      // SONG LIBRARY COMMANDS
      if (lowerInput.includes('list songs') || lowerInput.includes('show songs') || lowerInput.includes('my songs') || lowerInput.includes('song library')) {
        if (uploadedSongs.length === 0) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `📂 **Your Song Library is Empty**

No songs uploaded yet. Say "go to upload" to upload your first song!`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          const songList = uploadedSongs.slice(0, 10).map((song: any, i: number) => 
            `  ${i + 1}. **${song.title || song.name || 'Untitled'}**${song.artist ? ` - ${song.artist}` : ''}`
          ).join('\n');
          
          const assistantMessage: Message = {
            role: 'assistant',
            content: `🎵 **Your Song Library** (${uploadedSongs.length} songs)

${songList}
${uploadedSongs.length > 10 ? `\n... and ${uploadedSongs.length - 10} more` : ''}

Say "play [song name]" to load and play a song!`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      // PLAY UPLOADED SONG COMMAND
      if (lowerInput.includes('play ') && !lowerInput.includes('play it') && !lowerInput.includes('playback')) {
        const songQuery = lowerInput.replace(/^play\s+/i, '').trim();
        const matchedSong = uploadedSongs.find((song: any) => 
          (song.title || song.name || '').toLowerCase().includes(songQuery) ||
          (song.artist || '').toLowerCase().includes(songQuery)
        );
        
        if (matchedSong) {
          // Load the song into the studio context
          // Create audio element for the song
          const audio = new Audio();
          const songUrl = matchedSong.accessibleUrl || matchedSong.originalUrl || matchedSong.songURL || '';
          
          if (songUrl) {
            audio.src = songUrl;
            audio.load();
            
            useStudioStore.getState().setCurrentUploadedSong(matchedSong);
            setUploadedSongAudio(audio);
            
            const assistantMessage: Message = {
              role: 'assistant',
              content: `🎵 **Loaded: ${matchedSong.title || matchedSong.name || 'Untitled'}**
${matchedSong.artist ? `Artist: ${matchedSong.artist}\n` : ''}
The song is now loaded in your workspace. Say "play" to start playback!`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            toast({ 
              title: '🎵 Song Loaded', 
              description: matchedSong.title || matchedSong.name || 'Untitled'
            });
          } else {
            const assistantMessage: Message = {
              role: 'assistant',
              content: `❌ Couldn't load "${matchedSong.title || matchedSong.name}" - no audio URL found.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
          }
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `❌ Couldn't find a song matching "${songQuery}".

Say "list songs" to see your uploaded songs.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        return;
      }
      
      // STATUS COMMAND
      if (lowerInput === 'status' || lowerInput.includes('project status') || lowerInput.includes('what do i have')) {
        await handleQuickAction('status');
        return;
      }
      
      // NAVIGATION COMMANDS
      if (lowerInput.includes('go to') || lowerInput.includes('open') || lowerInput.includes('show me')) {
        const toolMap: Record<string, string> = {
          'piano': 'piano-roll',
          'piano roll': 'piano-roll',
          'beat': 'beatmaker',
          'beats': 'beatmaker',
          'drum': 'beatmaker',
          'melody': 'melody',
          'mixer': 'mixer',
          'mix': 'mixer',
          'lyrics': 'lyrics',
          'lyric': 'lyrics',
          'upload': 'upload',
          'tools': 'tools',
          'audio': 'audio-tools',
        };
        
        for (const [keyword, tool] of Object.entries(toolMap)) {
          if (lowerInput.includes(keyword)) {
            handleNavigateToTool(tool);
            const assistantMessage: Message = {
              role: 'assistant',
              content: `🧭 Navigating to **${tool.replace('-', ' ')}**...`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            return;
          }
        }
      }
      
      // BEAT GENERATION — pass user's FULL message as prompt so AI uses their instrument requests
      if (lowerInput.includes('beat') || lowerInput.includes('drum') || lowerInput.includes('808') || 
          lowerInput.includes('make a') || lowerInput.includes('create a') || lowerInput.includes('generate') ||
          lowerInput.includes('flute') || lowerInput.includes('violin') || lowerInput.includes('guitar') ||
          lowerInput.includes('piano') || lowerInput.includes('bass') || lowerInput.includes('synth') ||
          lowerInput.includes('strings') || lowerInput.includes('trumpet') || lowerInput.includes('sax') ||
          lowerInput.includes('harp') || lowerInput.includes('cello') || lowerInput.includes('orchestra')) {
        const intent = pickAstutelyBeatIntent(currentInput, status.bpm);
        applyBeatIntentToOrganism(intent);

        const assistantMessage: Message = {
          role: 'assistant',
          content: `I routed that into the Organism.

**Direction:** ${intent.summary}
**Live engine:** ${intent.presetId}
**Playing style:** ${intent.chordTechnique}, ${intent.melodyArticulation}, ${intent.bassArticulation}

The Organism should start playing the live/editable version now. Say **"render this with ACE"** when you want the polished WAV.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        toast({ title: 'Organism directed', description: intent.summary });
        return;
      }

      // GENERAL CHAT - Use AI with full project context
      const response = await apiRequest('POST', '/api/ai/chat', {
        messages: [
          {
            role: 'system',
            content: `You are Astutely — the creative director and music producer AI inside CodedSwitch Studio. You have the instincts of a seasoned hip-hop and R&B producer, the knowledge of a music theorist, and the directness of a collaborator who's heard it all.

YOUR VOICE: Confident, specific, concise. You give real answers — chord names, BPM ranges, scale degrees, specific mixing moves. You don't hedge. You don't pad. One sentence of context, then the answer.

YOUR EXPERTISE:
- Hip-hop, trap, drill, R&B, soul, Afrobeats, boom bap — you know the DNA of each
- Arrangement: intro → verse → pre-hook → hook → breakdown → drop. You know why tension and release work
- Music theory in producer terms: you talk about the flat-7 chord, the minor pentatonic, the deceptive cadence — but always in context of what it sounds like, not textbook definitions
- Mixing: you know what "mud" sounds like (200–400 Hz buildup), what "air" is (12kHz+ shelf), what makes a vocal sit vs. fight the beat
- The Organism AI: it generates live drums, bass, chords, and melody. It responds to voice, cycles through intro/verse/hook/breakdown/drop sections automatically
- Recording Booth: user raps/sings over the Organism's live beat while it records both
- The full Studio: beat maker, piano roll, multi-track mixer, AI mastering, stem separation

RULES:
- Never introduce yourself — the user knows who you are
- Never say "Great question!" or "Certainly!" — just answer
- If you don't know something specific to this project, ask one targeted question rather than giving a generic answer
- When the user shares a lyric line, respond like a co-writer — react to it, suggest the next bar, point out what's strong
- Keep responses tight: 2–4 sentences for explanations, bullet points for lists. No essays.

CURRENT PROJECT STATE:
- Tracks: ${status.trackCount} | Notes: ${status.totalNotes} | BPM: ${status.bpm} | Key: ${status.key}
- Playback: ${status.isPlaying ? `Playing at beat ${status.currentPosition.toFixed(1)}` : 'Stopped'}
${status.songName ? `- Song: "${status.songName}"` : ''}
${organismSnapshot ? `
ORGANISM RUNNING:
- BPM: ${Math.round(organismSnapshot.bpm)} | Mode: ${organismSnapshot.physics?.mode ?? 'unknown'} | State: ${organismSnapshot.organism?.state ?? 'unknown'}
- Voice: ${organismSnapshot.physics?.voiceActive ? 'active' : 'waiting'} | Input: ${organismSnapshot.inputSource}
- Active generators: ${organismSnapshot.generators ? Object.entries(organismSnapshot.generators).filter(([, level]) => level > 0.05).map(([name, level]) => `${name} ${(level * 100).toFixed(0)}%`).join(', ') || 'quiet' : 'none'}
${organismSnapshot.transcription?.latestLine ? `- Last lyric heard: "${organismSnapshot.transcription.latestLine}"` : ''}` : ''}

QUICK COMMANDS the user can say:
play · stop · pause · set bpm to [n] · make a [genre] beat · status · go to [tool name]`,
          },
          ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: currentInput },
        ],
      }, { signal: getChatAbortSignal() });

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || "I'm here to help! Try commands like 'play', 'make a trap beat', or 'status'.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Astutely chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "Oops! The server didn't respond. Try 'play', 'stop', 'status', or 'make a beat' instead!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Minimized state - floating button. Skip entirely when embedded: the host
  // (Sheet/Dialog) owns open/close, so a minimized chip would orphan itself
  // outside the host container.
  if (isMinimized && !embedded) {
    return (
      <div
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 9999,
        }}
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-14 px-6 font-bold text-white shadow-2xl hover:scale-105 transition-all"
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
            boxShadow: '0 0 30px rgba(245, 158, 11, 0.5)'
          }}
        >
          <Sparkles className="w-6 h-6 mr-2" />
          Astutely
        </Button>
      </div>
    );
  }

  return (
    <div
      style={
        embedded
          ? { width: '100%', height: '100%' }
          : {
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: `${panelSize.width}px`,
              height: `${panelSize.height}px`,
              zIndex: 9999,
            }
      }
      className={embedded ? '' : (performanceSafeMode ? '' : 'animate-in fade-in zoom-in duration-300')}
    >
      <div className={cn('relative group', embedded && 'h-full')}>
        {/* Holographic Border Glow */}
        <div className={`absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 ${performanceSafeMode ? '' : 'animate-pulse'}`} />
        
        <Card className="relative shadow-2xl border border-cyan-500/50 bg-black/80 backdrop-blur-3xl rounded-xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)]">
          {/* Scanline Effect Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]" />
          
          {/* Header - Draggable */}
          <CardHeader 
            className="pb-2 cursor-move border-b border-cyan-500/30 bg-cyan-950/40 backdrop-blur-md"
            onPointerDown={handlePointerDown}
          >
            <div className="flex items-center justify-center py-0.5 opacity-30">
              <div className="w-12 h-1 bg-cyan-500 rounded-full" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative group/brain">
                  <div className="absolute -inset-2 bg-cyan-500/20 rounded-full blur-xl group-hover/brain:bg-cyan-500/40 transition-all duration-500" />
                  <Cpu className={`w-7 h-7 text-cyan-400 relative z-10 ${performanceSafeMode ? '' : 'animate-[pulse_2s_infinite]'}`} />
                  <Sparkles className={`w-3 h-3 text-white absolute -top-1 -right-1 z-20 ${performanceSafeMode ? '' : 'animate-spin-slow'}`} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 uppercase tracking-[0.2em] leading-none">
                    Astutely Core
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                      <div className={`w-1.5 h-1.5 rounded-full ${performanceSafeMode ? 'bg-amber-400' : 'bg-emerald-500 animate-ping'}`} />
                      <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">
                        {performanceSafeMode ? 'Performance Safe' : 'Neural Link Active'}
                      </span>
                    </div>
                    <Activity className={`w-3 h-3 text-cyan-500/50 ${performanceSafeMode ? '' : 'animate-pulse'}`} />
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(true)}
                  className="h-8 w-8 p-0 text-cyan-400 hover:bg-cyan-500/20"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 text-cyan-400 hover:bg-red-500/20 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* ── Tab Bar ─────────────────────────────────────────── */}
          <div className="flex border-b border-cyan-500/20 bg-cyan-950/30">
            {([
              { id: 'chat' as const, label: 'Chat', icon: Cpu },
              { id: 'brain' as const, label: 'Brain', icon: Brain },
              { id: 'create' as const, label: 'Create', icon: Palette },
            ]).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                disabled={performanceSafeMode && tab.id !== 'chat'}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 bg-transparent cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : performanceSafeMode && tab.id !== 'chat'
                      ? 'border-transparent text-white/20 cursor-not-allowed'
                    : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
                title={performanceSafeMode && tab.id !== 'chat' ? 'Locked while Organism is playing' : undefined}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <CardContent className="p-0 flex flex-col" style={{ height: `${Math.max(panelSize.height - 125, MIN_HEIGHT - 125)}px` }}>

            {/* ═══ BRAIN TAB ═══════════════════════════════════════ */}
            {activeTab === 'brain' && (
              <div className="flex-1 overflow-y-auto">
                <AstutelyBrainContent />
              </div>
            )}

            {/* ═══ CREATE TAB ══════════════════════════════════════ */}
            {activeTab === 'create' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AstutelyCreateContent
                  onBeatGenerated={onBeatGenerated}
                  toast={toast}
                  transport={transport}
                  currentKey={currentKey}
                  tracks={tracks}
                  addTrack={addTrack}
                  saveTrackToServer={saveTrackToServer}
                  lastAceIntent={lastAceIntent}
                  setLastAceIntent={setLastAceIntent}
                  isAceRendering={isAceRendering}
                  renderAceIntent={renderAceIntent}
                  applyBeatIntentToOrganism={applyBeatIntentToOrganism}
                />
              </div>
            )}

            {/* ═══ CHAT TAB ════════════════════════════════════════ */}
            {activeTab === 'chat' && <>
            {performanceSafeMode && (
              <div className="px-4 py-2 border-b border-amber-400/20 bg-amber-400/10 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Performance Safe</div>
                  <div className="text-[10px] text-cyan-100/70 truncate">{organismUiSummary}</div>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-cyan-300/70 whitespace-nowrap">
                  Type to control
                </div>
              </div>
            )}
            {/* HOLOGRAPHIC ASTRO-HUD */}
            <div className="p-5 bg-gradient-to-b from-cyan-950/30 to-transparent relative overflow-hidden group/hud">
              {/* Dynamic Grid Background for HUD area */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(6,182,212,0.4) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
              
              <div className="flex justify-between items-end mb-3 px-1 relative z-10">
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveTab('brain')}
                    className="flex items-center gap-2 text-[10px] font-bold text-cyan-400/80 uppercase tracking-[0.15em] hover:text-cyan-300 transition-colors cursor-pointer"
                    title="Open project brain"
                  >
                    <Database className="w-3 h-3 animate-[bounce_2s_infinite]" /> Matrix Status
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab('brain')}
                      className="flex flex-col text-left hover:opacity-80 transition-opacity cursor-pointer"
                      title="View all tracks"
                    >
                      <span className="text-[8px] text-cyan-500/60 uppercase font-black">Streams</span>
                      <span className="text-lg font-black text-white leading-none tracking-tighter">{getProjectStatus().trackCount}</span>
                    </button>
                    <div className="w-px h-6 bg-cyan-500/20 self-end mb-1" />
                    <button
                      onClick={() => setActiveTab('brain')}
                      className="flex flex-col text-left hover:opacity-80 transition-opacity cursor-pointer"
                      title="View all notes"
                    >
                      <span className="text-[8px] text-cyan-500/60 uppercase font-black">Elements</span>
                      <span className="text-lg font-black text-white leading-none tracking-tighter">{getProjectStatus().totalNotes}</span>
                    </button>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <button
                    onClick={() => { setEditingBpm(true); setBpmInputValue(String(getProjectStatus().bpm)); }}
                    className="flex items-center gap-2 justify-end text-[10px] font-bold text-cyan-400/80 uppercase tracking-[0.15em] hover:text-cyan-300 transition-colors cursor-pointer"
                    title="Edit tempo"
                  >
                    Temporal Sync <Cpu className="w-3 h-3 text-cyan-400" />
                  </button>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-cyan-500/60 uppercase font-black">Velocity</span>
                    {editingBpm ? (
                      <Input
                        autoFocus
                        type="number"
                        min={40}
                        max={300}
                        value={bpmInputValue}
                        onChange={e => setBpmInputValue(e.target.value)}
                        onBlur={commitBpmEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitBpmEdit(); if (e.key === 'Escape') setEditingBpm(false); }}
                        className="w-16 h-6 text-lg font-black text-cyan-400 bg-black/60 border-cyan-500/40 text-right p-1 tabular-nums"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingBpm(true); setBpmInputValue(String(getProjectStatus().bpm)); }}
                        className="flex items-baseline gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                        title="Click to edit BPM"
                      >
                        <span className="text-2xl font-black text-cyan-400 leading-none tabular-nums tracking-tighter">{getProjectStatus().bpm}</span>
                        <span className="text-[9px] font-black text-cyan-500/40">BPM</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {performanceSafeMode ? (
                <div className="relative rounded-xl border border-amber-400/20 bg-black/40 p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-cyan-500/60">Organism</div>
                      <div className="mt-1 text-sm font-black text-cyan-200">
                        {organismSnapshotForUi?.running ? 'Playing' : organismSnapshotForUi?.starting ? 'Starting' : 'Ready'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-cyan-500/60">Groove</div>
                      <div className="mt-1 text-sm font-black text-cyan-200">
                        {organismSnapshotForUi ? `${Math.round(organismSnapshotForUi.bpm)} BPM` : '-- BPM'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-cyan-500/60">Capture</div>
                      <div className="mt-1 text-sm font-black text-cyan-200">
                        {organismSnapshotForUi?.physics?.voiceActive ? 'Voice' : 'Waiting'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`relative ${syncLocked ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
                  onClick={(e) => {
                    if (syncLocked) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const newPos = (x / rect.width) * 16;
                    transport.seek(newPos);
                  }}
                  title={syncLocked ? 'Unlock sync to scrub position' : 'Click to seek'}
                >
                  <AstroHUD
                    tracks={tracks.map(t => ({
                      id: t.id,
                      name: t.name || 'Unnamed Track',
                      color: t.payload?.color || '#3b82f6',
                      notes: (t.payload?.notes || []).map(n => ({
                        ...n,
                        id: n.id || `note-${Math.random().toString(36).substr(2, 9)}`
                      })),
                      muted: false, // Default for HUD
                      volume: (t.payload?.volume || 0.8) * 100,
                      instrument: t.payload?.instrument || 'piano'
                    })) as any}
                    currentStep={Math.floor((useStudioStore.getState().position || 0) * 4)}
                    totalSteps={64}
                    isPlaying={transport.isPlaying}
                  />
                </div>
              )}

              {/* HOLOGRAPHIC TRANSPORT CONTROLS */}
              <div className="mt-5 flex items-center justify-between bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2.5 backdrop-blur-xl relative z-10 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => transport.stop()}
                    className="h-10 w-10 p-0 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-all active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current opacity-80" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handlePlayPause}
                    className={`h-10 w-14 p-0 border border-cyan-400/40 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95 ${
                      transport.isPlaying 
                        ? 'bg-cyan-500/30 text-white animate-[pulse_1.5s_infinite] border-cyan-300' 
                        : 'text-cyan-400 hover:bg-cyan-500/20'
                    }`}
                  >
                    {transport.isPlaying 
                      ? <Pause className="w-5 h-5 fill-current" /> 
                      : <Play className="w-5 h-5 fill-current ml-0.5" />
                    }
                  </Button>
                </div>

                <div className="flex-1 px-4 flex flex-col gap-1">
                  <div className="flex justify-between text-[8px] font-black text-cyan-500/60 uppercase tracking-widest">
                    <span>Signal Strength</span>
                    <span>{transport.isPlaying ? 'Transmitting' : 'Standby'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-cyan-950/60 rounded-full overflow-hidden border border-cyan-500/10">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-300 transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                      style={{ width: transport.isPlaying ? '100%' : '15%' }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSyncLocked(l => !l)}
                    className="flex flex-col items-end hover:opacity-80 transition-opacity cursor-pointer"
                    title={syncLocked ? 'Click to unlock timeline scrubbing' : 'Click to lock timeline'}
                  >
                    <div className="text-[8px] text-cyan-500/40 font-mono uppercase leading-none">Sync</div>
                    <Badge
                      variant="outline"
                      className={`text-[8px] h-3 px-1 font-mono uppercase flex items-center gap-0.5 transition-colors ${
                        syncLocked
                          ? 'border-cyan-500/20 text-cyan-400/60'
                          : 'border-orange-500/40 text-orange-400/80'
                      }`}
                    >
                      {syncLocked ? <Lock className="w-2 h-2" /> : <Unlock className="w-2 h-2" />}
                      {syncLocked ? 'LOCKED' : 'FREE'}
                    </Badge>
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowVolume(v => !v)}
                      className="w-8 h-8 rounded-full border border-cyan-500/30 flex items-center justify-center relative overflow-hidden hover:bg-cyan-500/20 transition-colors cursor-pointer"
                      title="Master volume"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400 z-10" />
                    </button>
                    {showVolume && (
                      <div className="absolute bottom-10 right-0 bg-cyan-950/90 border border-cyan-500/30 rounded-lg p-2 w-28 shadow-lg z-50">
                        <div className="text-[8px] text-cyan-500/60 uppercase font-black mb-1.5 text-center">Master Vol</div>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[masterVolume]}
                          onValueChange={([v]) => handleMasterVolume(v)}
                          className="w-full"
                        />
                        <div className="text-[9px] text-cyan-400 text-center mt-1 font-mono">{masterVolume}%</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Track & Song Library Display */}
            <div className="px-4 py-3 border-b border-cyan-500/10 bg-black/20">
              {/* Tracks Section */}
              {tracks.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-400/80 uppercase tracking-wider">Active Tracks ({tracks.length})</span>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20">
                    {(showAllTracks ? tracks : tracks.slice(0, 5)).map((track: any, i: number) => (
                      <button
                        key={track.id}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'mixer' }));
                          window.dispatchEvent(new CustomEvent('select-track', { detail: { trackId: track.id } }));
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded bg-cyan-950/20 border border-cyan-500/10 hover:border-cyan-500/40 hover:bg-cyan-900/30 transition-colors text-left cursor-pointer"
                        title={`Go to ${track.name || `Track ${i + 1}`} in mixer`}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: track.payload?.color || '#3b82f6' }}
                        />
                        <span className="text-[10px] text-white/80 flex-1 truncate">
                          {track.name || `Track ${i + 1}`}
                        </span>
                        <span className="text-[9px] text-cyan-500/60 font-mono">
                          {track.payload?.notes?.length || 0} notes
                        </span>
                      </button>
                    ))}
                    {tracks.length > 5 && (
                      <button
                        onClick={() => setShowAllTracks(s => !s)}
                        className="w-full text-[9px] text-cyan-500/50 hover:text-cyan-400 text-center py-1 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        {showAllTracks
                          ? <><ChevronUp className="w-3 h-3" /> Show less</>
                          : <><ChevronDown className="w-3 h-3" /> +{tracks.length - 5} more tracks</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Uploaded Songs Section */}
              {uploadedSongs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] font-bold text-purple-400/80 uppercase tracking-wider">Song Library ({uploadedSongs.length})</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500/20">
                    {uploadedSongs.slice(0, 5).map((song: any, i: number) => (
                      <button
                        key={song.id}
                        onClick={() => {
                          const audio = new Audio();
                          const songUrl = song.accessibleUrl || song.originalUrl || song.songURL || '';
                          if (songUrl) {
                            audio.src = songUrl;
                            audio.load();
                            useStudioStore.getState().setCurrentUploadedSong(song);
                            setUploadedSongAudio(audio);
                            toast({ 
                              title: '🎵 Song Loaded', 
                              description: song.title || song.name || 'Untitled'
                            });
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded bg-purple-950/20 border border-purple-500/10 hover:border-purple-500/30 hover:bg-purple-950/30 transition-colors text-left"
                      >
                        <Play className="w-2.5 h-2.5 text-purple-400/60" />
                        <span className="text-[10px] text-white/80 flex-1 truncate">
                          {song.title || song.name || 'Untitled'}
                        </span>
                        {song.artist && (
                          <span className="text-[9px] text-purple-500/60 truncate max-w-[80px]">
                            {song.artist}
                          </span>
                        )}
                      </button>
                    ))}
                    {uploadedSongs.length > 5 && (
                      <div className="text-[9px] text-purple-500/40 text-center py-1">
                        +{uploadedSongs.length - 5} more songs
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {tracks.length === 0 && uploadedSongs.length === 0 && (
                <div className="text-center py-2">
                  <span className="text-[10px] text-cyan-500/40">No tracks or songs loaded yet</span>
                </div>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="px-4 py-2 flex gap-2 border-b border-cyan-500/10 bg-black/20">
              {quickActions.map(action => (
                <button
                  key={action.action}
                  onClick={() => handleQuickAction(action.action)}
                  disabled={isLoading}
                  className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 disabled:opacity-50 bg-black/40 border-cyan-500/20 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10 shadow-lg`}
                >
                  <action.icon className="w-4 h-4 mb-1" />
                  <span className="text-[9px] uppercase font-bold tracking-tighter">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Chat Interface */}
            <div className="flex-none overflow-hidden flex flex-col bg-black/40" style={{ maxHeight: 240 }}>
              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/20 border-b border-cyan-500/10"
                style={{ minHeight: 140, maxHeight: 200 }}
              >
                {messages.length === 0 && (
                  <div className="text-xs text-cyan-300/60 bg-white/5 border border-cyan-500/20 rounded-lg p-3">
                    Astutely is ready. Ask a question or type a command.
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 relative group/msg ${
                        msg.role === 'user'
                          ? 'bg-cyan-600/20 text-cyan-100 border border-cyan-500/30'
                          : 'bg-white/5 text-gray-200 border border-white/10'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="absolute -left-1 -top-1 w-2 h-2 border-t border-l border-cyan-500" />
                      )}
                      <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{msg.content}</p>
                      {msg.audioUrl && (
                        <div className="mt-2 p-2 bg-black/40 rounded-lg border border-cyan-500/20">
                          <audio
                            controls
                            src={msg.audioUrl}
                            className="w-full h-8"
                            style={{ filter: 'invert(1) hue-rotate(180deg)', opacity: 0.9 }}
                          />
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[8px] text-cyan-500/60 font-mono uppercase">AI Generated Audio</span>
                            <a
                              href={msg.audioUrl}
                              download="astutely-beat.wav"
                              className="text-[8px] text-cyan-400 hover:text-cyan-300 font-mono uppercase"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between opacity-30 group-hover/msg:opacity-100 transition-opacity">
                        <span className="text-[9px] font-mono">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === 'assistant' && (
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-cyan-500/30 rounded-full" />
                            <div className="w-1.5 h-1.5 bg-cyan-500/30 rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <div className="flex space-x-2">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Control Center */}
              <div className="p-4 border-t border-cyan-500/20 bg-cyan-500/5">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-cyan-400/10 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                  <div className="relative flex items-end gap-2">
                    <div className="flex-1 bg-black/60 rounded-lg border border-cyan-500/30 overflow-hidden focus-within:border-cyan-400 transition-colors">
                      <div className="px-2 pt-1 flex items-center gap-1.5 text-[8px] text-cyan-500 font-mono uppercase tracking-widest">
                        <Search className="w-2.5 h-2.5" /> Input Command
                      </div>
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type command or ask Astutely..."
                        className="w-full bg-transparent border-none text-xs text-white placeholder:text-cyan-900 focus:ring-0 min-h-[50px] max-h-[120px] resize-none px-3 pb-2"
                        disabled={isLoading}
                      />
                      {speechError && (
                        <div className="px-3 pb-2 text-[10px] text-red-400/80">
                          {speechError}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={isListening ? handleStopListening : handleStartListening}
                      disabled={!speechSupported || isLoading || performanceSafeMode}
                      title={performanceSafeMode ? 'Type while Organism is playing to avoid opening another mic listener' : undefined}
                      className={`h-[50px] w-[50px] border border-cyan-500/30 bg-black/60 text-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95 ${!speechSupported || performanceSafeMode ? 'opacity-40 cursor-not-allowed' : ''} ${isListening ? 'shadow-[0_0_15px_rgba(34,211,238,0.6)] bg-cyan-500/30 text-white' : ''}`}
                    >
                      <Mic2 className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      className="h-[50px] w-[50px] bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-90"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            </>}
          </CardContent>

          <div className="absolute bottom-3 right-3 flex items-end gap-2">
            {showResizeGuide && (
              <div className="px-3 py-2 rounded-lg bg-black/60 text-white text-xs border border-cyan-500/40 shadow-xl">
                Drag to resize
              </div>
            )}
            <button
              type="button"
              aria-label="Resize Astutely core panel"
              onPointerDown={handleResizeStart}
              className="h-10 w-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-se-resize"
            >
              <MoveDiagonal2 className="w-5 h-5" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE TAB — Centralized AI Generation Hub
// All AI generation actions live here with proper labels + AI provider selectors
// ═══════════════════════════════════════════════════════════════════════════════

const BEAT_GENRES = [
  'Hip-Hop', 'Trap', 'Lo-Fi', 'Pop', 'EDM', 'House', 'R&B', 'Jazz', 'Rock',
  'Drill', 'Phonk', 'Afrobeats', 'Reggaeton', 'Future Bass', 'Ambient',
];

const MELODY_STYLES = [
  { value: 'melodic', label: 'Melodic' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'aggressive', label: 'Aggressive' },
  { value: 'dark', label: 'Dark' },
  { value: 'uplifting', label: 'Uplifting' },
  { value: 'jazzy', label: 'Jazzy' },
];

const LYRIC_MOODS = ['Happy', 'Sad', 'Energetic', 'Chill', 'Dark', 'Romantic', 'Aggressive', 'Nostalgic'];

const GROOVE_MODES = [
  { value: 'tight', label: 'Tight' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'busy', label: 'Busy' },
];

// Collapsible card wrapper used by each generation section
function CreateCard({
  title,
  icon: Icon,
  color,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border transition-all ${isOpen ? `border-${color}-500/40 bg-${color}-500/5` : 'border-white/10 bg-white/[0.02]'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 rounded-xl transition-all"
      >
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 text-${color}-400`} />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-white/80">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
      </button>
      {isOpen && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

function AstutelyCreateContent({
  onBeatGenerated,
  toast,
  transport,
  currentKey,
  tracks,
  addTrack,
  saveTrackToServer,
  lastAceIntent,
  setLastAceIntent,
  isAceRendering,
  renderAceIntent,
  applyBeatIntentToOrganism,
}: {
  onBeatGenerated?: (result: AstutelyResult) => void;
  toast: ReturnType<typeof import('@/hooks/use-toast').useToast>['toast'];
  transport: ReturnType<typeof import('@/contexts/TransportContext').useTransport>;
  currentKey: string;
  tracks: any[];
  addTrack: (t: any) => void;
  saveTrackToServer: (t: any) => Promise<any>;
  lastAceIntent: AstutelyBeatIntent | null;
  setLastAceIntent: (intent: AstutelyBeatIntent | null) => void;
  isAceRendering: boolean;
  renderAceIntent: (intent: AstutelyBeatIntent) => Promise<{ audioUrl: string; duration?: number; prompt: string }>;
  applyBeatIntentToOrganism: (intent: AstutelyBeatIntent) => void;
}) {
  const { generatePattern, generateRealAudio, playGeneratedAudio } = useAstutelyCore();
  const getMelodyAbortSignal = useAbortableRequest();
  const getLyricsAbortSignal = useAbortableRequest();

  // Track which cards are expanded
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({ beat: true });
  const toggleCard = (id: string) => setOpenCards(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Shared state ──────────────────────────────────────────
  const [activeGeneration, setActiveGeneration] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [audioProvider, setAudioProvider] = useState<string | null>(null);
  const [isPlayingGenerated, setIsPlayingGenerated] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Beat Generation state ─────────────────────────────────
  const [beatGenre, setBeatGenre] = useState('Hip-Hop');
  const [beatGroove, setBeatGroove] = useState('balanced');
  // ── Melody Generation state ───────────────────────────────
  const [melodyStyle, setMelodyStyle] = useState('melodic');
  const [melodyProvider, setMelodyProvider] = useState('astutely');

  // ── Lyrics Generation state ───────────────────────────────
  const [lyricTheme, setLyricTheme] = useState('');
  const [lyricGenre, setLyricGenre] = useState('Hip-Hop');
  const [lyricMood, setLyricMood] = useState('Energetic');
  const [lyricProvider, setLyricProvider] = useState('grok');

  // ── Full Audio state ──────────────────────────────────────
  const [audioPrompt, setAudioPrompt] = useState('');
  // ── Bass Generation state ─────────────────────────────────
  const [bassStyle, setBassStyle] = useState('808');
  const [bassProvider, setBassProvider] = useState('astutely');

  // ── Loop Generation state ─────────────────────────────────
  const [loopGenre, setLoopGenre] = useState('hip-hop');
  const [loopProvider, setLoopProvider] = useState('astutely');

  // ── Vocal Melody state ────────────────────────────────────
  const [vocalMood, setVocalMood] = useState('Energetic');
  const [vocalProvider, setVocalProvider] = useState('suno');

  // ── Helper: progress animation ────────────────────────────
  const runWithProgress = async (genId: string, fn: () => Promise<void>) => {
    setActiveGeneration(genId);
    setProgress(0);
    setAudioError(null);
    const interval = setInterval(() => setProgress(p => Math.min(p + 8, 90)), 400);
    try {
      await fn();
      setProgress(100);
    } catch (error: any) {
      if (isAbortError(error)) return;
      setAudioError(error?.message || 'Generation failed');
      toast({ title: 'Generation Failed', description: error?.message || 'Something went wrong.', variant: 'destructive' });
    } finally {
      clearInterval(interval);
      setActiveGeneration(null);
    }
  };

  // ── Audio playback toggle ─────────────────────────────────
  const handleToggleAudio = async () => {
    if (!generatedAudioUrl) return;
    if (isPlayingGenerated && generatedAudioRef.current) {
      generatedAudioRef.current.pause();
      setIsPlayingGenerated(false);
      return;
    }
    try {
      window.dispatchEvent(new CustomEvent('globalAudio:stopAll'));
      const audio = new Audio(generatedAudioUrl);
      generatedAudioRef.current = audio;
      setIsPlayingGenerated(true);
      audio.onended = () => setIsPlayingGenerated(false);
      audio.onpause = () => setIsPlayingGenerated(false);
      await audio.play();
    } catch {
      toast({ title: 'Playback Error', variant: 'destructive' });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // GENERATION HANDLERS
  // ═══════════════════════════════════════════════════════════

  const handleBeatGenerate = () => runWithProgress('beat', async () => {
    const intent = pickAstutelyBeatIntent(`${beatGroove} ${beatGenre} beat`, transport.tempo || 120);
    applyBeatIntentToOrganism(intent);
    setLastAceIntent(intent);
    toast({ title: 'Organism Directed', description: `${intent.summary}. Use ACE Render for the WAV.` });
  });

  const handleMelodyGenerate = () => runWithProgress('melody', async () => {
    const response = await apiRequest('POST', '/api/melody/generate', {
      scale: `${currentKey || 'C'} Major`,
      style: melodyStyle,
      complexity: 'medium',
      musicalParams: {
        bpm: transport.tempo || 120,
        key: currentKey || 'C',
        timeSignature: '4/4',
      },
    }, { signal: getMelodyAbortSignal() });
    const result = await response.json();
    const data = result.data || result;
    if (data?.audioUrl) {
      setGeneratedAudioUrl(data.audioUrl);
      setAudioProvider('melody-ai');
    }

    // Store melody notes in context so MelodyComposerV2 / piano roll can pick them up
    if (data?.notes && Array.isArray(data.notes)) {
      useStudioStore.getState().setPendingMelodyNotes(data.notes);
    }

    toast({ title: 'Melody Generated!', description: `${melodyStyle} melody composed by AI` });
  });

  const handleLyricsGenerate = () => runWithProgress('lyrics', async () => {
    if (!lyricTheme.trim()) throw new Error('Please enter a theme for lyrics');
    const response = await apiRequest('POST', '/api/lyrics/generate', {
      theme: lyricTheme,
      genre: lyricGenre,
      mood: lyricMood,
      aiProvider: lyricProvider,
    }, { signal: getLyricsAbortSignal() });
    const data = await response.json();
    // Push lyrics into studio context
    if (data.content) {
      useStudioStore.getState().setCurrentLyrics(data.content);
    }
    toast({ title: 'Lyrics Generated!', description: `${lyricGenre} lyrics about "${lyricTheme}"` });
  });

  const handleFullAudioGenerate = () => runWithProgress('audio', async () => {
    const intent = audioPrompt.trim()
      ? pickAstutelyBeatIntent(audioPrompt.trim(), transport.tempo || 120)
      : lastAceIntent ?? pickAstutelyBeatIntent(`${beatGenre} instrumental`, transport.tempo || 120);
    setLastAceIntent(intent);
    const rendered = await renderAceIntent(intent);
    setGeneratedAudioUrl(rendered.audioUrl);
    setAudioProvider('ACE-Step');
    toast({ title: 'ACE Audio Ready!', description: intent.summary });
  });

  const handleBassGenerate = () => runWithProgress('bass', async () => {
    const result = await generatePattern({
      style: `${bassStyle} bass line`,
      prompt: `Generate a ${bassStyle} bass line in ${currentKey || 'C'}`,
    });
    const notes = astutelyToNotes(result);
    const bassNotes = notes.filter(n => n.trackType === 'bass');
    if (bassNotes.length > 0) {
      const trackData = {
        id: `ai-bass-${Date.now()}`,
        name: `Astutely Bass (${bassStyle})`,
        kind: 'midi',
        lengthBars: 4,
        startBar: 0,
        payload: { type: 'midi', notes: bassNotes, bpm: result.bpm, source: 'astutely', color: '#f59e0b', volume: 0.8, pan: 0 },
      };
      addTrack(trackData);
      await saveTrackToServer(trackData);
    }
    // Also try real audio
    try {
      const audioResult = await generateRealAudio(`${bassStyle} bass`, { bpm: transport.tempo || 120 });
      setGeneratedAudioUrl(audioResult.audioUrl);
      setAudioProvider(audioResult.provider);
    } catch {}
    toast({ title: 'Bass Line Generated!', description: `${bassStyle} bass added to timeline` });
  });

  const handleLoopGenerate = () => runWithProgress('loop', async () => {
    const result = await generatePattern({
      style: loopGenre,
      prompt: `${loopGenre} loop pattern`,
    });
    const notes = astutelyToNotes(result);
    transport.setTempo(result.bpm);

    const trackTypes = ['drums', 'bass', 'chords', 'melody'] as const;
    for (const type of trackTypes) {
      const typeNotes = notes.filter(n => n.trackType === type);
      if (typeNotes.length > 0) {
        const trackData = {
          id: `ai-loop-${type}-${Date.now()}`,
          name: `Loop ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          kind: type === 'drums' ? 'beat' : 'midi',
          lengthBars: 4,
          startBar: 0,
          payload: { type: type === 'drums' ? 'beat' : 'midi', notes: typeNotes, bpm: result.bpm, source: 'astutely', color: '#10b981', volume: 0.8, pan: 0 },
        };
        addTrack(trackData);
        await saveTrackToServer(trackData);
      }
    }
    toast({ title: 'Loop Generated!', description: `${loopGenre} loop added to timeline` });
  });

  const handleVocalMelodyGenerate = () => runWithProgress('vocal', async () => {
    const result = await generatePattern({
      style: `${vocalMood} vocal melody`,
      prompt: `Vocal melody with ${vocalMood.toLowerCase()} mood`,
    });
    const notes = astutelyToNotes(result);
    const melodyNotes = notes.filter(n => n.trackType === 'melody');
    if (melodyNotes.length > 0) {
      const trackData = {
        id: `ai-vocal-${Date.now()}`,
        name: `Vocal Melody (${vocalMood})`,
        kind: 'midi',
        lengthBars: 4,
        startBar: 0,
        payload: { type: 'midi', notes: melodyNotes, bpm: result.bpm, source: 'astutely', color: '#ec4899', volume: 0.8, pan: 0 },
      };
      addTrack(trackData);
      await saveTrackToServer(trackData);
    }
    // Also try real audio
    try {
      const audioResult = await generateRealAudio(`${vocalMood} vocal melody`, { bpm: transport.tempo || 120 });
      setGeneratedAudioUrl(audioResult.audioUrl);
      setAudioProvider(audioResult.provider);
    } catch {}
    toast({ title: 'Vocal Melody Generated!', description: `${vocalMood} vocal melody added` });
  });

  const isGenerating = activeGeneration !== null || isAceRendering;

  return (
    <>
      {/* ── Progress Bar (shared) ──────────────────────────── */}
      {isGenerating && (
        <div className="mb-2">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-[10px] text-white/50 mt-1">
            {progress < 100 ? `Generating ${activeGeneration}... ${progress}%` : 'Done!'}
          </p>
        </div>
      )}

      {/* ═══ 1. BEAT GENERATION ═════════════════════════════ */}
      <CreateCard title="Organism Beat Direction" icon={Drum} color="purple" isOpen={!!openCards.beat} onToggle={() => toggleCard('beat')}>
        <p className="text-[10px] text-white/45 leading-relaxed">
          Astutely picks the Organism preset, BPM, and playing style. Render with ACE after the live beat feels right.
        </p>
        <div className="flex gap-2">
          <Select value={beatGenre} onValueChange={setBeatGenre}>
            <SelectTrigger className="flex-1 h-9 bg-black/30 border-white/10 rounded-lg text-xs">
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl">
              {BEAT_GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={beatGroove} onValueChange={setBeatGroove}>
            <SelectTrigger className="w-28 h-9 bg-black/30 border-white/10 rounded-lg text-xs">
              <SelectValue placeholder="Groove" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl">
              {GROOVE_MODES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={handleBeatGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-xs text-white hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Drum className="w-4 h-4" />
          {activeGeneration === 'beat' ? 'Directing...' : 'Send to Organism'}
        </button>
      </CreateCard>

      {/* ═══ 2. MELODY GENERATION ═══════════════════════════ */}
      <CreateCard title="Melody Generation" icon={Music} color="blue" isOpen={!!openCards.melody} onToggle={() => toggleCard('melody')}>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Provider</label>
          <AIProviderSelector value={melodyProvider} onValueChange={setMelodyProvider} feature="melody" />
        </div>
        <Select value={melodyStyle} onValueChange={setMelodyStyle}>
          <SelectTrigger className="h-9 bg-black/30 border-white/10 rounded-lg text-xs">
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl">
            {MELODY_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={handleMelodyGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-bold text-xs text-white hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Music className="w-4 h-4" />
          {activeGeneration === 'melody' ? 'Composing...' : 'Generate Melody'}
        </button>
      </CreateCard>

      {/* ═══ 3. LYRICS GENERATION ═══════════════════════════ */}
      <CreateCard title="Lyrics Generation" icon={FileText} color="yellow" isOpen={!!openCards.lyrics} onToggle={() => toggleCard('lyrics')}>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Provider</label>
          <AIProviderSelector value={lyricProvider} onValueChange={setLyricProvider} feature="lyrics" />
        </div>
        <input
          type="text"
          value={lyricTheme}
          onChange={(e) => setLyricTheme(e.target.value)}
          placeholder="Theme (e.g. 'midnight drive', 'heartbreak')"
          className="w-full p-2.5 bg-black/30 border border-white/10 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
          disabled={isGenerating}
        />
        <div className="flex gap-2">
          <Select value={lyricGenre} onValueChange={setLyricGenre}>
            <SelectTrigger className="flex-1 h-9 bg-black/30 border-white/10 rounded-lg text-xs">
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl">
              {BEAT_GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={lyricMood} onValueChange={setLyricMood}>
            <SelectTrigger className="w-28 h-9 bg-black/30 border-white/10 rounded-lg text-xs">
              <SelectValue placeholder="Mood" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl">
              {LYRIC_MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={handleLyricsGenerate}
          disabled={isGenerating || !lyricTheme.trim()}
          className="w-full py-2.5 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl font-bold text-xs text-white hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          {activeGeneration === 'lyrics' ? 'Writing...' : 'Generate Lyrics'}
        </button>
      </CreateCard>

      {/* ═══ 4. ACE AUDIO RENDER ════════════════════════════ */}
      <CreateCard title="ACE Audio Render" icon={Volume2} color="emerald" isOpen={!!openCards.audio} onToggle={() => toggleCard('audio')}>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
          Engine: ACE-Step text-to-music
        </div>
        <input
          type="text"
          value={audioPrompt}
          onChange={(e) => setAudioPrompt(e.target.value)}
          placeholder="Describe the beat for ACE, or leave blank to render the last Organism direction"
          className="w-full p-2.5 bg-black/30 border border-white/10 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none focus:border-emerald-400/50"
          disabled={isGenerating}
        />
        <button
          type="button"
          onClick={handleFullAudioGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl font-bold text-xs text-white hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Volume2 className="w-4 h-4" />
          {activeGeneration === 'audio' || isAceRendering ? 'Rendering ACE...' : 'Render with ACE'}
        </button>
      </CreateCard>

      {/* ═══ 5. BASS LINE GENERATION ════════════════════════ */}
      <CreateCard title="Bass Line Generation" icon={Guitar} color="amber" isOpen={!!openCards.bass} onToggle={() => toggleCard('bass')}>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Provider</label>
          <AIProviderSelector value={bassProvider} onValueChange={setBassProvider} feature="bass" />
        </div>
        <Select value={bassStyle} onValueChange={setBassStyle}>
          <SelectTrigger className="h-9 bg-black/30 border-white/10 rounded-lg text-xs">
            <SelectValue placeholder="Bass Style" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl">
            {['808', 'Sub Bass', 'Synth Bass', 'Acoustic Bass', 'Funk Bass', 'Slap Bass'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={handleBassGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 rounded-xl font-bold text-xs text-white hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Guitar className="w-4 h-4" />
          {activeGeneration === 'bass' ? 'Generating...' : 'Generate Bass Line'}
        </button>
      </CreateCard>

      {/* ═══ 6. LOOP GENERATION ═════════════════════════════ */}
      <CreateCard title="Loop Generation" icon={Radio} color="green" isOpen={!!openCards.loop} onToggle={() => toggleCard('loop')}>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Provider</label>
          <AIProviderSelector value={loopProvider} onValueChange={setLoopProvider} feature="loop" />
        </div>
        <Select value={loopGenre} onValueChange={setLoopGenre}>
          <SelectTrigger className="h-9 bg-black/30 border-white/10 rounded-lg text-xs">
            <SelectValue placeholder="Genre" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl">
            {BEAT_GENRES.map(g => <SelectItem key={g} value={g.toLowerCase().replace(/\s+/g, '-')}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={handleLoopGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold text-xs text-white hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Radio className="w-4 h-4" />
          {activeGeneration === 'loop' ? 'Looping...' : 'Generate Loop'}
        </button>
      </CreateCard>

      {/* ═══ 7. VOCAL MELODY GENERATION ═════════════════════ */}
      <CreateCard title="Vocal Melody" icon={Mic2} color="pink" isOpen={!!openCards.vocal} onToggle={() => toggleCard('vocal')}>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Provider</label>
          <AIProviderSelector value={vocalProvider} onValueChange={setVocalProvider} feature="vocal" />
        </div>
        <Select value={vocalMood} onValueChange={setVocalMood}>
          <SelectTrigger className="h-9 bg-black/30 border-white/10 rounded-lg text-xs">
            <SelectValue placeholder="Mood" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl">
            {LYRIC_MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={handleVocalMelodyGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl font-bold text-xs text-white hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Mic2 className="w-4 h-4" />
          {activeGeneration === 'vocal' ? 'Composing...' : 'Generate Vocal Melody'}
        </button>
      </CreateCard>

      {/* ── Audio Player (shared across all generators) ──── */}
      {generatedAudioUrl && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                AI Audio Ready
              </p>
              <p className="text-[10px] text-white/40">via {audioProvider || 'AI'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleToggleAudio}
              className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                isPlayingGenerated
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isPlayingGenerated ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Play</>}
            </button>
            <a
              href={generatedAudioUrl}
              download={`astutely-generated-${Date.now()}.mp3`}
              className="py-2 px-3 rounded-lg bg-white/10 border border-white/20 text-white/70 text-xs font-bold hover:bg-white/20 transition-all"
            >
              Download
            </a>
          </div>
        </div>
      )}

      {/* ── Error display ────────────────────────────────── */}
      {audioError && !generatedAudioUrl && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-red-400 text-xs font-bold">Generation Failed</p>
          <p className="text-[10px] text-white/40 mt-1">{audioError}</p>
        </div>
      )}
    </>
  );
}
