// contexts/AstutelyCoreContext.tsx
// ASTUTELY CORE — The Central AI Brain of CodedSwitch
// Every component in the app can connect to this brain via useAstutelyCore()
// It can control: Transport, Tracks, Pattern Generation, Real Audio Generation,
// Song Library, Navigation, Stems, Mixer, Lyrics — everything.

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTransport } from '@/contexts/TransportContext';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import type { TrackClip } from '@/types/studioTracks';
import {
  astutelyGenerate,
  astutelyToNotes,
  astutelyGenerateAudio,
  astutelyGenerateComplete,
  astutelyPlayAudio,
  stopActiveAstutelyAudio,
  stopAstutelyPreview,
  type AstutelyResult,
  type AstutelyGenerateOptions,
  type AstutelyCompleteResult,
} from '@/lib/astutelyEngine';
import { renderAstutelyToStems, audioBufferToWav } from '@/lib/astutelyAudioRenderer';
import { dispatchAstutelyCommand, dispatchAstutelyEvent } from '@/components/presence';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GeneratedAudio {
  audioUrl: string;
  duration: number;
  provider: string;
  style: string;
  timestamp: number;
}

export interface ProjectStatus {
  trackCount: number;
  totalNotes: number;
  bpm: number;
  key: string;
  isPlaying: boolean;
  currentPosition: number;
  tracks: { id: string; name: string; kind: string; muted?: boolean }[];
}

export type NavigationTarget =
  | 'piano-roll'
  | 'beatmaker'
  | 'melody'
  | 'mixer'
  | 'lyrics'
  | 'upload'
  | 'audio-tools'
  | 'stem-separator'
  | 'astutely-panel';

export interface AstutelyCoreValue {
  // ── Status ──
  isGeneratingPattern: boolean;
  isGeneratingAudio: boolean;
  lastGeneratedPattern: AstutelyResult | null;
  lastGeneratedAudio: GeneratedAudio | null;
  audioError: string | null;

  // ── Pattern Generation ──
  generatePattern: (options: AstutelyGenerateOptions) => Promise<AstutelyResult>;

  // ── Real Audio Generation ──
  generateRealAudio: (style: string, options?: {
    prompt?: string;
    bpm?: number;
    key?: string;
  }) => Promise<GeneratedAudio>;

  // ── UNIFIED GENERATION (Pattern + Audio) ──
  generateComplete: (options: AstutelyGenerateOptions) => Promise<AstutelyCompleteResult>;

  // ── Audio Playback ──
  playGeneratedAudio: (audioUrl: string) => Promise<HTMLAudioElement>;
  stopGeneratedAudio: () => void;
  isPlayingGeneratedAudio: boolean;
  activeAudioUrl: string | null;

  // ── Transport Control ──
  transportPlay: () => void;
  transportPause: () => void;
  transportStop: () => void;
  transportSetTempo: (bpm: number) => void;
  transportSeek: (position: number) => void;
  transportToggle: () => 'playing' | 'paused';
  getTransportState: () => { isPlaying: boolean; tempo: number; position: number };

  // ── Track Management ──
  getProjectStatus: () => ProjectStatus;
  addGeneratedTracks: (result: AstutelyResult) => void;
  addAudioTrack: (name: string, audioUrl: string, duration: number, provider: string, bpm: number) => void;
  renderPatternToStems: (result: AstutelyResult) => Promise<void>;
  muteTrack: (trackId: string, muted: boolean) => void;
  removeTrack: (trackId: string) => void;

  // ── Navigation ──
  navigateTo: (target: NavigationTarget, detail?: Record<string, unknown>) => void;
  openAstutelyPanel: () => void;
  closeAstutelyPanel: () => void;

  // ── Song Library ──
  routeToStems: (songName: string, songUrl: string) => void;
  routeToMixer: (songId?: number, songName?: string) => void;
  importAudioTrack: (name: string, audioUrl: string) => void;

  // ── Events ──
  emitEvent: (name: string, detail?: Record<string, unknown>) => void;
  emitCommand: (command: string, detail?: Record<string, unknown>) => void;

  // ── Download ──
  downloadAudio: (audioUrl: string, filename: string) => void;
}

const AstutelyCoreContext = createContext<AstutelyCoreValue | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNEL MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const ASTUTELY_CHANNEL_MAPPING: Record<'drums' | 'bass' | 'chords' | 'melody', string> = {
  drums: 'track-astutely-drums',
  bass: 'track-astutely-bass',
  chords: 'track-astutely-chords',
  melody: 'track-astutely-melody',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export function AstutelyCoreProvider({ children }: { children: ReactNode }) {
  const transport = useTransport();
  const trackStore = useTrackStore();

  // ── State ──
  const [isGeneratingPattern, setIsGeneratingPattern] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [lastGeneratedPattern, setLastGeneratedPattern] = useState<AstutelyResult | null>(null);
  const [lastGeneratedAudio, setLastGeneratedAudio] = useState<GeneratedAudio | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlayingGeneratedAudio, setIsPlayingGeneratedAudio] = useState(false);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);

  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSPORT CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  const transportPlay = useCallback(() => {
    transport.play();
  }, [transport]);

  const transportPause = useCallback(() => {
    transport.pause();
  }, [transport]);

  const transportStop = useCallback(() => {
    transport.stop();
  }, [transport]);

  const transportSetTempo = useCallback((bpm: number) => {
    const clamped = Math.max(40, Math.min(300, bpm));
    transport.setTempo(clamped);
  }, [transport]);

  const transportSeek = useCallback((position: number) => {
    transport.seek(Math.max(0, position));
  }, [transport]);

  const transportToggle = useCallback((): 'playing' | 'paused' => {
    if (transport.isPlaying) {
      transport.pause();
      return 'paused';
    }
    transport.play();
    return 'playing';
  }, [transport]);

  const getTransportState = useCallback(() => ({
    isPlaying: transport.isPlaying,
    tempo: transport.tempo,
    position: transport.position,
  }), [transport]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  const getProjectStatus = useCallback((): ProjectStatus => {
    const totalNotes = trackStore.tracks.reduce((sum: number, track: TrackClip) => {
      const notes = track.payload?.notes;
      return sum + (Array.isArray(notes) ? notes.length : 0);
    }, 0);

    return {
      trackCount: trackStore.tracks.length,
      totalNotes,
      bpm: transport.tempo,
      key: 'C',
      isPlaying: transport.isPlaying,
      currentPosition: transport.position,
      tracks: trackStore.tracks.slice(0, 20).map((t: TrackClip) => ({
        id: t.id,
        name: t.name || t.kind || 'Track',
        kind: t.kind,
        muted: t.muted,
      })),
    };
  }, [trackStore.tracks, transport]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PATTERN GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  const generatePattern = useCallback(async (options: AstutelyGenerateOptions): Promise<AstutelyResult> => {
    setIsGeneratingPattern(true);
    setAudioError(null);
    dispatchAstutelyEvent('generation-started', { style: options.style });

    try {
      const result = await astutelyGenerate(options);
      setLastGeneratedPattern(result);

      const notes = astutelyToNotes(result);

      // Broadcast pattern to all listeners (piano roll, timeline, etc.)
      const payload = {
        notes,
        bpm: result.bpm,
        key: result.key,
        style: result.style,
        timestamp: Date.now(),
        channelMapping: ASTUTELY_CHANNEL_MAPPING,
      };
      window.dispatchEvent(new CustomEvent('astutely:generated', { detail: payload }));
      try {
        localStorage.setItem('astutely-generated', JSON.stringify(payload));
      } catch {
        // storage full — non-critical
      }

      // Focus the most interesting track
      const priorityOrder: Array<keyof typeof ASTUTELY_CHANNEL_MAPPING> = ['melody', 'chords', 'bass', 'drums'];
      const targetType = priorityOrder.find(type => notes.some(n => n.trackType === type));
      if (targetType) {
        setTimeout(() => {
          dispatchAstutelyCommand('focus-track', {
            trackId: ASTUTELY_CHANNEL_MAPPING[targetType],
            view: 'piano-roll',
          });
          window.dispatchEvent(new CustomEvent('studio:focusTrack', {
            detail: { trackId: ASTUTELY_CHANNEL_MAPPING[targetType], view: 'piano-roll' },
          }));
        }, 120);
      }

      // Sync transport
      try {
        transport.setTempo(result.bpm);
        transport.seek(0);
        transport.play();
      } catch {
        // transport sync non-critical
      }

      dispatchAstutelyEvent('generation-completed', { style: options.style, success: true });
      return result;
    } catch (error) {
      dispatchAstutelyEvent('generation-error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        style: options.style,
      });
      throw error;
    } finally {
      setIsGeneratingPattern(false);
    }
  }, [transport]);

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL AUDIO GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  const generateRealAudio = useCallback(async (
    style: string,
    options?: { prompt?: string; bpm?: number; key?: string }
  ): Promise<GeneratedAudio> => {
    setIsGeneratingAudio(true);
    setAudioError(null);

    try {
      const result = await astutelyGenerateAudio(style, options);

      const generated: GeneratedAudio = {
        audioUrl: result.audioUrl,
        duration: result.duration,
        provider: result.provider,
        style,
        timestamp: Date.now(),
      };

      setLastGeneratedAudio(generated);

      // Auto-play
      try {
        const audio = await astutelyPlayAudio(result.audioUrl);
        generatedAudioRef.current = audio;
        setIsPlayingGeneratedAudio(true);
        setActiveAudioUrl(result.audioUrl);
        audio.onended = () => {
          setIsPlayingGeneratedAudio(false);
        };
        audio.onpause = () => setIsPlayingGeneratedAudio(false);
        audio.onplay = () => setIsPlayingGeneratedAudio(true);
      } catch {
        // autoplay blocked — user can click play
      }

      return generated;
    } catch (error: unknown) {
      const msg = (error instanceof Error ? error.message : null) || 'Audio generation failed';
      setAudioError(msg);
      throw error;
    } finally {
      setIsGeneratingAudio(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED GENERATION (Pattern + Audio)
  // ═══════════════════════════════════════════════════════════════════════════

  const generateComplete = useCallback(async (
    options: AstutelyGenerateOptions
  ): Promise<AstutelyCompleteResult> => {
    setIsGeneratingPattern(true);
    setIsGeneratingAudio(true);
    setAudioError(null);

    try {
      console.log(`🎵 UNIFIED: Generating complete music for "${options.style}"...`);
      
      // Generate both pattern and audio
      const result = await astutelyGenerateComplete(options);
      
      // Store pattern
      setLastGeneratedPattern(result.pattern);
      
      // Store audio
      const generated: GeneratedAudio = {
        audioUrl: result.audio.audioUrl,
        duration: result.audio.duration,
        provider: result.audio.provider,
        style: options.style,
        timestamp: Date.now(),
      };
      setLastGeneratedAudio(generated);

      // Auto-play the audio
      try {
        const audio = await astutelyPlayAudio(result.audio.audioUrl);
        generatedAudioRef.current = audio;
        setIsPlayingGeneratedAudio(true);
        setActiveAudioUrl(result.audio.audioUrl);
        audio.onended = () => setIsPlayingGeneratedAudio(false);
        audio.onpause = () => setIsPlayingGeneratedAudio(false);
        audio.onplay = () => setIsPlayingGeneratedAudio(true);
      } catch {
        // autoplay blocked
      }

      // Broadcast pattern to listeners
      const payload = {
        drums: result.notes.filter(n => n.trackType === 'drums'),
        bass: result.notes.filter(n => n.trackType === 'bass'),
        chords: result.notes.filter(n => n.trackType === 'chords'),
        melody: result.notes.filter(n => n.trackType === 'melody'),
        bpm: result.pattern.bpm,
        key: result.pattern.key,
        style: result.pattern.style,
        instruments: result.instruments,
      };
      
      dispatchAstutelyEvent('pattern-generated', payload);
      dispatchAstutelyEvent('generation-completed', { 
        style: options.style, 
        success: true,
        hasAudio: true,
        hasPattern: true,
      });

      console.log(`✅ UNIFIED: Complete generation successful!`);
      return result;
    } catch (error: unknown) {
      const msg = (error instanceof Error ? error.message : null) || 'Unified generation failed';
      setAudioError(msg);
      dispatchAstutelyEvent('generation-error', {
        error: msg,
        style: options.style,
      });
      throw error;
    } finally {
      setIsGeneratingPattern(false);
      setIsGeneratingAudio(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO PLAYBACK
  // ═══════════════════════════════════════════════════════════════════════════

  const playGeneratedAudio = useCallback(async (audioUrl: string): Promise<HTMLAudioElement> => {
    stopActiveAstutelyAudio();
    if (generatedAudioRef.current) {
      generatedAudioRef.current.pause();
    }

    const audio = await astutelyPlayAudio(audioUrl);
    generatedAudioRef.current = audio;
    setIsPlayingGeneratedAudio(true);
    setActiveAudioUrl(audioUrl);
    audio.onended = () => setIsPlayingGeneratedAudio(false);
    audio.onpause = () => setIsPlayingGeneratedAudio(false);
    audio.onplay = () => setIsPlayingGeneratedAudio(true);
    return audio;
  }, []);

  const stopGeneratedAudio = useCallback(() => {
    stopActiveAstutelyAudio();
    stopAstutelyPreview();
    if (generatedAudioRef.current) {
      generatedAudioRef.current.pause();
      generatedAudioRef.current.currentTime = 0;
      generatedAudioRef.current = null;
    }
    setIsPlayingGeneratedAudio(false);
    setActiveAudioUrl(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const addGeneratedTracks = useCallback((result: AstutelyResult) => {
    const notes = astutelyToNotes(result);
    const trackTypes: Array<'drums' | 'bass' | 'chords' | 'melody'> = ['drums', 'bass', 'chords', 'melody'];

    for (const type of trackTypes) {
      const typeNotes = notes.filter(n => n.trackType === type);
      if (typeNotes.length > 0) {
        const trackData: TrackClip = {
          id: `ai-${type}-${Date.now()}`,
          name: `Astutely ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          kind: type === 'drums' ? 'beat' : 'piano',
          lengthBars: 4,
          startBar: 0,
          payload: {
            type: type === 'drums' ? 'beat' : 'midi',
            notes: typeNotes,
            bpm: result.bpm,
            source: 'astutely',
            color: type === 'drums' ? '#ef4444' : type === 'bass' ? '#f59e0b' : type === 'chords' ? '#8b5cf6' : '#3b82f6',
            volume: 0.8,
            pan: 0,
          },
        };
        trackStore.addTrack(trackData);
        trackStore.saveTrackToServer(trackData);
      }
    }
  }, [trackStore]);

  const addAudioTrack = useCallback((name: string, audioUrl: string, duration: number, provider: string, bpm: number) => {
    const track: TrackClip = {
      id: `audio-${Date.now()}`,
      name,
      kind: 'audio',
      lengthBars: Math.ceil((bpm / 60) * duration / 4),
      startBar: 0,
      payload: {
        type: 'audio',
        audioUrl,
        duration,
        bpm,
        source: provider,
        volume: 0.8,
        pan: 0,
        color: '#10b981',
        notes: [],
      },
    };
    trackStore.addTrack(track);
  }, [trackStore]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER PATTERN TO AUDIO STEMS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderPatternToStems = useCallback(async (result: AstutelyResult): Promise<void> => {
    try {
      console.log('🎵 Rendering Astutely pattern to audio stems...');
      const stems = await renderAstutelyToStems(result);
      
      const stemColors: Record<string, string> = {
        drums: '#ef4444',
        bass: '#3b82f6',
        chords: '#10b981',
        melody: '#f59e0b',
      };

      // Convert each stem to WAV blob and create object URL
      for (const stem of stems) {
        const wavBlob = audioBufferToWav(stem.audioBuffer);
        const audioUrl = URL.createObjectURL(wavBlob);

        const track: TrackClip = {
          id: `stem-${stem.name}-${Date.now()}`,
          name: `${stem.name.charAt(0).toUpperCase() + stem.name.slice(1)} (Astutely)`,
          kind: 'audio',
          lengthBars: Math.ceil((result.bpm / 60) * stem.duration / 4),
          startBar: 0,
          payload: {
            type: 'audio',
            audioUrl,
            duration: stem.duration,
            bpm: result.bpm,
            source: 'astutely-render',
            volume: 0.8,
            pan: 0,
            color: stemColors[stem.name] || '#6366f1',
            notes: [],
          },
        };
        
        trackStore.addTrack(track);
      }

      console.log('✅ Astutely stems rendered and imported to Multi-Track');
      
      // Dispatch event for UI feedback
      window.dispatchEvent(new CustomEvent('astutely:stemsRendered', {
        detail: { stemCount: stems.length, bpm: result.bpm },
      }));
    } catch (error) {
      console.error('❌ Failed to render Astutely stems:', error);
      throw error;
    }
  }, [trackStore]);

  const muteTrack = useCallback((trackId: string, muted: boolean) => {
    trackStore.updateTrack(trackId, { muted });
  }, [trackStore]);

// ... (rest of the code remains the same)
  const removeTrack = useCallback((trackId: string) => {
    trackStore.removeTrack(trackId);
  }, [trackStore]);

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  const navigateTo = useCallback((target: NavigationTarget, detail?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: target }));
    dispatchAstutelyCommand('navigate', { target, ...detail });
  }, []);

  const openAstutelyPanel = useCallback(() => {
    window.dispatchEvent(new CustomEvent('astutely:open-panel'));
  }, []);

  const closeAstutelyPanel = useCallback(() => {
    window.dispatchEvent(new CustomEvent('astutely:close-panel'));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // SONG LIBRARY ROUTING
  // ═══════════════════════════════════════════════════════════════════════════

  const routeToStems = useCallback((songName: string, songUrl: string) => {
    sessionStorage.setItem('stem_separator_url', songUrl);
    sessionStorage.setItem('stem_separator_name', songName);
    dispatchAstutelyCommand('navigate-stem-separator', { songName, songUrl });
    window.dispatchEvent(new CustomEvent('navigate-to-stem-separator'));
  }, []);

  const routeToMixer = useCallback((songId?: number, songName?: string) => {
    if (songId || songName) {
      sessionStorage.setItem('astutely_mixer_song', JSON.stringify({ id: songId, name: songName }));
    }
    dispatchAstutelyCommand('open-mixer', {
      route: '/mixer?tab=ai-mix',
      songId,
      songName,
    });
    window.location.href = '/mixer?tab=ai-mix';
  }, []);

  const importAudioTrack = useCallback((name: string, audioUrl: string) => {
    dispatchAstutelyCommand('import-audio-track', { name, audioUrl });
    window.dispatchEvent(new CustomEvent('studio:importAudioTrack', {
      detail: { name, audioUrl },
    }));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const emitEvent = useCallback((name: string, detail?: Record<string, unknown>) => {
    dispatchAstutelyEvent(name, detail);
  }, []);

  const emitCommand = useCallback((command: string, detail?: Record<string, unknown>) => {
    dispatchAstutelyCommand(command, detail);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  const downloadAudio = useCallback((audioUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  const value = useMemo<AstutelyCoreValue>(() => ({
    // Status
    isGeneratingPattern,
    isGeneratingAudio,
    lastGeneratedPattern,
    lastGeneratedAudio,
    audioError,

    // Pattern Generation
    generatePattern,

    // Real Audio Generation
    generateRealAudio,

    // Unified Generation (Pattern + Audio)
    generateComplete,

    // Audio Playback
    playGeneratedAudio,
    stopGeneratedAudio,
    isPlayingGeneratedAudio,
    activeAudioUrl,

    // Transport Control
    transportPlay,
    transportPause,
    transportStop,
    transportSetTempo,
    transportSeek,
    transportToggle,
    getTransportState,

    // Track Management
    getProjectStatus,
    addGeneratedTracks,
    addAudioTrack,
    renderPatternToStems,
    muteTrack,
    removeTrack,

    // Navigation
    navigateTo,
    openAstutelyPanel,
    closeAstutelyPanel,

    // Song Library
    routeToStems,
    routeToMixer,
    importAudioTrack,

    // Events
    emitEvent,
    emitCommand,

    // Download
    downloadAudio,
  }), [
    isGeneratingPattern,
    isGeneratingAudio,
    lastGeneratedPattern,
    lastGeneratedAudio,
    audioError,
    generatePattern,
    generateRealAudio,
    generateComplete,
    playGeneratedAudio,
    stopGeneratedAudio,
    isPlayingGeneratedAudio,
    activeAudioUrl,
    transportPlay,
    transportPause,
    transportStop,
    transportSetTempo,
    transportSeek,
    transportToggle,
    getTransportState,
    getProjectStatus,
    addGeneratedTracks,
    addAudioTrack,
    renderPatternToStems,
    muteTrack,
    removeTrack,
    navigateTo,
    openAstutelyPanel,
    closeAstutelyPanel,
    routeToStems,
    routeToMixer,
    importAudioTrack,
    emitEvent,
    emitCommand,
    downloadAudio,
  ]);

  return (
    <AstutelyCoreContext.Provider value={value}>
      {children}
    </AstutelyCoreContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useAstutelyCore(): AstutelyCoreValue {
  const context = useContext(AstutelyCoreContext);
  if (!context) {
    throw new Error('useAstutelyCore must be used within an AstutelyCoreProvider');
  }
  return context;
}
