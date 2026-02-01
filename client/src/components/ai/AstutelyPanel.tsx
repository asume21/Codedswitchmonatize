// client/src/components/ai/AstutelyPanel.tsx
// ASTUTELY - The AI that makes beats legendary

import { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { Sparkles, X, Loader2, Music, Library, Play, Pause, Scissors, Sliders, FileText, BarChart3, Layers, Wand2, MoveDiagonal2 } from 'lucide-react';
import { astutelyGenerate, astutelyToNotes, type AstutelyResult } from '@/lib/astutelyEngine';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useTransport } from '@/contexts/TransportContext';
import { StudioAudioContext } from '@/pages/studio';
import { AudioPremixCache } from '@/lib/audioPremix';
import { professionalAudio } from '@/lib/professionalAudio';
import type { Song } from '../../../../shared/schema';
import { dispatchAstutelyEvent } from '@/components/presence';

const styles = [
  { name: "Travis Scott rage", icon: "🔥", preview: "808s + dark pads" },
  { name: "The Weeknd dark", icon: "🌙", preview: "Glassy synths + vocal chops" },
  { name: "Drake smooth", icon: "😌", preview: "Soft piano + trap hats" },
  { name: "K-pop cute", icon: "💖", preview: "Bright plucks + bubbly synth" },
  { name: "Phonk drift", icon: "🚗", preview: "Cowbell + slowed reverb" },
  { name: "Future bass", icon: "⚡", preview: "Wobble bass + supersaw chords" },
  { name: "Lo-fi chill", icon: "☕", preview: "Vinyl crackle + jazz chords" },
  { name: "Hyperpop glitch", icon: "💻", preview: "Chopped vocals + sidechain" },
  { name: "Afrobeats bounce", icon: "🕺", preview: "Log drums + highlife guitar" },
  { name: "Latin trap", icon: "🌴", preview: "Dem bow rhythm + reggaeton keys" },
];

interface AstutelyPanelProps {
  onClose: () => void;
  onGenerated?: (result: AstutelyResult) => void;
}

const ASTUTELY_CHANNEL_MAPPING: Record<'drums' | 'bass' | 'chords' | 'melody', string> = {
  drums: 'track-astutely-drums',
  bass: 'track-astutely-bass',
  chords: 'track-astutely-chords',
  melody: 'track-astutely-melody'
};

export default function AstutelyPanel({ onClose, onGenerated }: AstutelyPanelProps) {
  const [selectedStyle, setSelectedStyle] = useState(styles[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState(0);
  const [generatedResult, setGeneratedResult] = useState<AstutelyResult | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [songAnalysis, setSongAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const { play: playTransport, seek, setTempo: setTransportTempo, timeSignature, tempo: transportTempo } = useTransport();
  const studioContext = useContext(StudioAudioContext);

  const currentKey = studioContext?.currentKey ?? 'C';
  const premixCacheRef = useRef(new AudioPremixCache());
  const inFlightPremixRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 520, height: 660 });
  const [showResizeGuide, setShowResizeGuide] = useState(true);
  const resizeStateRef = useRef({
    startX: 0,
    startY: 0,
    startWidth: 520,
    startHeight: 660,
  });
  const resizingRef = useRef(false);
  const MIN_WIDTH = 420;
  const MAX_WIDTH = 900;
  const MIN_HEIGHT = 520;
  const MAX_HEIGHT = 860;

  const trackSummaries = useMemo(() => {
    if (!studioContext || !Array.isArray(studioContext.currentTracks)) {
      return [] as {
        id?: string;
        name?: string;
        instrument?: string;
        type?: string;
        notes?: number;
        muted?: boolean;
        volume?: number;
      }[];
    }

    return studioContext.currentTracks.slice(0, 12).map((track: any) => {
      const payload = track?.payload ?? {};
      const notesLength = Array.isArray(track?.notes)
        ? track.notes.length
        : Array.isArray(payload?.notes)
          ? payload.notes.length
          : undefined;

      return {
        id: track?.id ?? payload?.id,
        name: track?.name ?? payload?.name,
        instrument: track?.instrument ?? payload?.instrument,
        type: track?.type ?? payload?.type ?? track?.kind,
        notes: typeof notesLength === 'number' ? notesLength : undefined,
        muted: typeof track?.muted === 'boolean' ? track.muted : undefined,
        volume: typeof track?.volume === 'number'
          ? track.volume
          : (typeof payload?.volume === 'number' ? payload.volume : undefined),
      };
    }).filter(summary => summary.name || summary.instrument || summary.type);
  }, [studioContext]);

  const focusAstutelyTrack = (notes: ReturnType<typeof astutelyToNotes>) => {
    const priorityOrder: Array<keyof typeof ASTUTELY_CHANNEL_MAPPING> = ['melody', 'chords', 'bass', 'drums'];
    const targetType = priorityOrder.find(type => notes.some(n => n.trackType === type));
    if (!targetType) return;

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('studio:focusTrack', {
        detail: {
          trackId: ASTUTELY_CHANNEL_MAPPING[targetType],
          view: 'piano-roll'
        }
      }));
    }, 120);
  };

  const broadcastAstutelyPattern = (result: AstutelyResult, notes: ReturnType<typeof astutelyToNotes>) => {
    const payload = {
      notes,
      bpm: result.bpm,
      key: result.key,
      style: result.style,
      timestamp: Date.now(),
      channelMapping: ASTUTELY_CHANNEL_MAPPING
    };

    window.dispatchEvent(new CustomEvent('astutely:generated', { detail: payload }));
    try {
      localStorage.setItem('astutely-generated', JSON.stringify(payload));
    } catch (error) {
      console.warn('Unable to persist Astutely payload', error);
    }
  };

  // Fetch user's song library
  const { data: songs = [] } = useQuery<any[]>({
    queryKey: ['/api/songs'],
  });

  // Emit panel opened event for Presence Engine
  useEffect(() => {
    dispatchAstutelyEvent('panel-opened');
    
    return () => {
      dispatchAstutelyEvent('panel-closed');
    };
  }, []);
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const detachResizeListeners = useCallback(() => {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    resizingRef.current = false;
  }, []);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!resizingRef.current) return;
    const { startX, startY, startWidth, startHeight } = resizeStateRef.current;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    setPanelSize({
      width: clamp(startWidth + deltaX, MIN_WIDTH, MAX_WIDTH),
      height: clamp(startHeight + deltaY, MIN_HEIGHT, MAX_HEIGHT),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    detachResizeListeners();
  }, [detachResizeListeners]);

  const handleResizeStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect?.width ?? panelSize.width,
      startHeight: rect?.height ?? panelSize.height,
    };
    resizingRef.current = true;
    setShowResizeGuide(false);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove, handlePointerUp, panelSize.width, panelSize.height]);

  const handleContentWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey) return;
    event.preventDefault();
    event.currentTarget.scrollBy({
      top: event.deltaY * 0.65,
      behavior: 'auto',
    });
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
      detachResizeListeners();
    };
  }, [audioElement, detachResizeListeners]);

  useEffect(() => {
    if (!showResizeGuide) return;
    const timer = setTimeout(() => setShowResizeGuide(false), 6000);
    return () => clearTimeout(timer);
  }, [showResizeGuide]);

  const handleSongSelect = async (songId: string) => {
    setSelectedSongId(songId);
    setSongAnalysis(null);
    
    // Emit analysis started event
    if (songId && songId !== 'none') {
      dispatchAstutelyEvent('analysis-started', { songId });
    }

    // Stop current playback
    if (audioElement) {
      audioElement.pause();
      setIsPlaying(false);
    }

    // Auto-analyze the selected song
    if (songId && songId !== 'none') {
      const song = songs.find(s => s.id.toString() === songId);
      if (song) {
        setIsAnalyzing(true);
        try {
          const response = await apiRequest('POST', '/api/songs/analyze', {
            songId: song.id
          });
          const data = await response.json();
          setSongAnalysis(data);
          
          // Emit analysis completed event
          dispatchAstutelyEvent('analysis-completed', { songId: song.id, success: true });
          
          toast({
            title: '🧠 Song Analyzed',
            description: `${data.tempo || 'Unknown'} BPM • Key: ${data.key || 'Unknown'}`,
          });
        } catch (error) {
          console.error('Analysis failed:', error);
        } finally {
          setIsAnalyzing(false);
        }
      }
    }
  };

  const resolvePlaybackUrl = useCallback(async (song: Song, baseUrl: string) => {
    const separatedStemsStorage = sessionStorage.getItem('separated_stems');
    const routedStemSource = sessionStorage.getItem('separated_stems_source');
    const stemSourceMatchesSelection = routedStemSource && (routedStemSource === song.name || routedStemSource === song.id?.toString());
    const stemUrls: string[] = [];

    if (separatedStemsStorage && stemSourceMatchesSelection) {
      try {
        const parsed = JSON.parse(separatedStemsStorage);
        Object.values(parsed).forEach((url) => {
          if (typeof url === 'string' && url.length) {
            stemUrls.push(url);
          }
        });
      } catch (error) {
        console.warn('Failed to parse cached stems for Astutely song playback', error);
      }
    }

    const targetUrls = stemUrls.length ? stemUrls : [baseUrl];
    const cacheKey = `${song.id ?? baseUrl}:${targetUrls.join('|')}`;

    if (!inFlightPremixRef.current.has(cacheKey)) {
      inFlightPremixRef.current.set(
        cacheKey,
        premixCacheRef.current
          .getOrCreate(cacheKey, targetUrls)
          .catch((err: unknown) => {
            console.warn('Astutely song premix failed', err);
            return null;
          })
      );
    }

    const premixed = await inFlightPremixRef.current.get(cacheKey)!;
    inFlightPremixRef.current.delete(cacheKey);
    return premixed ?? baseUrl;
  }, []);

  const selectedSong = useMemo(() => {
    if (!Array.isArray(songs) || !selectedSongId || selectedSongId === 'none') {
      return undefined;
    }
    return songs.find((s) => s.id?.toString() === selectedSongId);
  }, [songs, selectedSongId]);

  const handlePlayPause = useCallback(async () => {
    const song = selectedSong as Song | undefined;
    if (!song) {
      toast({
        title: 'No Song Selected',
        description: 'Please select a song from your library first',
        variant: 'destructive'
      });
      return;
    }

    const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
    if (!audioUrl) {
      toast({
        title: 'No Audio URL',
        description: 'This song has no playable audio',
        variant: 'destructive'
      });
      return;
    }

    if (audioElement && isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
      return;
    }

    let targetAudio = audioElement;
    if (!targetAudio) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        toast({
          title: 'Playback Error',
          description: 'Failed to load audio',
          variant: 'destructive'
        });
        setIsPlaying(false);
      };
      setAudioElement(audio);
      targetAudio = audio;
    }

    try {
      const playbackUrl = await resolvePlaybackUrl(song, audioUrl);
      targetAudio.pause();
      targetAudio.src = playbackUrl;
      targetAudio.currentTime = 0;

      if (!audioSourceRef.current) {
        await professionalAudio.initialize();
        const audioCtx = professionalAudio.getAudioContext();
        const masterBus = professionalAudio.getMasterBus();
        if (audioCtx && masterBus) {
          audioSourceRef.current = audioCtx.createMediaElementSource(targetAudio);
          audioSourceRef.current.connect(masterBus);
        }
      }

      await targetAudio.play();
      setIsPlaying(true);
      toast({
        title: '🎵 Now Playing',
        description: song.name || 'Song'
      });
    } catch (error) {
      console.error('Astutely playback failed', error);
      setIsPlaying(false);
      toast({
        title: 'Playback Error',
        description: 'Failed to start audio playback',
        variant: 'destructive'
      });
    }
  }, [audioElement, isPlaying, resolvePlaybackUrl, selectedSong, toast]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    
    // Emit generation started event
    dispatchAstutelyEvent('generation-started', { style: selectedStyle.name });
    
    toast({ title: '✨ Astutely Activated', description: `Creating ${selectedStyle.name} beat...` });

    // Simulate progress for UX
    const interval = setInterval(() => {
      setProgress(p => {
        const newProgress = Math.min(p + 15, 90);
        // Emit progress events
        if (newProgress < 30) {
          dispatchAstutelyEvent('generation-progress', { step: 'planning', progress: newProgress });
        } else if (newProgress < 70) {
          dispatchAstutelyEvent('generation-progress', { step: 'generating', progress: newProgress });
        } else {
          dispatchAstutelyEvent('generation-progress', { step: 'post-processing', progress: newProgress });
        }
        return newProgress;
      });
    }, 300);

    try {
      const trimmedPrompt = query.trim();
      const result = await astutelyGenerate({
        style: selectedStyle.name,
        prompt: trimmedPrompt.length ? trimmedPrompt : undefined,
        tempo: transportTempo,
        timeSignature,
        key: currentKey,
        trackSummaries,
      });
      clearInterval(interval);
      setProgress(100);
      setGeneratedResult(result);
      
      // Emit generation completed event
      dispatchAstutelyEvent('generation-completed', { style: selectedStyle.name, success: true });

      if (result.meta?.usedFallback || result.isFallback) {
        toast({
          title: '⚠️ Using Offline Template',
          description: 'Astutely could not reach the live AI provider and returned a safety pattern. Start the local Phi3 server or add your XAI/OpenAI keys for fresh generations.',
          variant: 'destructive',
        });
      }

      // Convert to timeline notes
      const notes = astutelyToNotes(result);
      broadcastAstutelyPattern(result, notes);
      focusAstutelyTrack(notes);
      try {
        setTransportTempo(result.bpm);
        seek(0);
        playTransport();
      } catch (error) {
        console.warn('Unable to sync transport with Astutely output', error);
      }
      const drumCount = notes.filter(n => n.trackType === 'drums').length;
      const bassCount = notes.filter(n => n.trackType === 'bass').length;
      const chordCount = notes.filter(n => n.trackType === 'chords').length;
      const melodyCount = notes.filter(n => n.trackType === 'melody').length;

      toast({ 
        title: '🔥 Beat Generated & Added to Timeline!', 
        description: `${drumCount} drums, ${bassCount} bass, ${chordCount} chords, ${melodyCount} melody notes` 
      });

      if (onGenerated) {
        onGenerated(result);
      }

      // Auto-close after success
      setTimeout(() => onClose(), 1500);

    } catch (error) {
      clearInterval(interval);
      setProgress(0);
      
      // Emit generation error event
      dispatchAstutelyEvent('generation-error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        style: selectedStyle.name 
      });
      
      toast({ 
        title: '❌ Generation Failed', 
        description: 'Astutely encountered an error. Try again!',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl w-full mx-4 shadow-2xl relative flex flex-col border border-white/10"
        onClick={e => e.stopPropagation()}
        style={{
          minWidth: `${MIN_WIDTH}px`,
          minHeight: `${MIN_HEIGHT}px`,
          maxWidth: `${MAX_WIDTH}px`,
          maxHeight: `${MAX_HEIGHT}px`,
          width: `${panelSize.width}px`,
          height: `${panelSize.height}px`,
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-8 pt-8 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-pink-200/80">Astutely</p>
            <h2 className="text-3xl font-bold flex items-center gap-3 text-white">
              <Sparkles className="w-10 h-10 text-yellow-300" />
              Legendary Beat Architect
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-all">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="px-8 text-gray-300 pb-4">Transform your loop into a full beat instantly</div>

        <div
          className="flex-1 px-8 pb-8 overflow-y-auto"
          onWheel={handleContentWheel}
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Song Library Selector */}
          <div className="mb-6 p-4 rounded-xl bg-white/10 border border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <Library className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-gray-200">Your Song Library</span>
            </div>
            <div className="flex gap-2">
              <Select value={selectedSongId} onValueChange={handleSongSelect}>
                <SelectTrigger className="flex-1 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select a song to play..." />
                </SelectTrigger>
                <SelectContent>
                  {songs.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No songs uploaded yet
                    </SelectItem>
                  ) : (
                    songs.map((song) => (
                      <SelectItem key={song.id} value={song.id.toString()}>
                        {song.name || `Song ${song.id}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <button
                onClick={handlePlayPause}
                disabled={!selectedSongId || selectedSongId === 'none'}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
            </div>
            {selectedSongId && selectedSongId !== 'none' && (
              <div className="mt-3 space-y-2">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analyzing song...
                  </div>
                ) : songAnalysis ? (
                  <div className="text-xs text-green-400">
                    ✓ {songAnalysis.tempo || '?'} BPM • {songAnalysis.key || '?'} • {songAnalysis.genre || 'Unknown'}
                  </div>
                ) : null}

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      sessionStorage.setItem('stem_separator_url', selectedSong?.accessibleUrl || selectedSong?.originalUrl || '');
                      sessionStorage.setItem('stem_separator_name', selectedSong?.name || 'Song');
                      toast({ title: 'Routing to Stem Separator', description: 'Opening AI Studio...' });
                      window.dispatchEvent(new CustomEvent('navigate-to-stem-separator'));
                      onClose();
                    }}
                    className="px-2 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded text-xs flex items-center justify-center gap-1 transition-all"
                    title="Separate Stems"
                  >
                    <Scissors className="w-3 h-3" />
                    <span>Stems</span>
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('studio:importAudioTrack', {
                        detail: {
                          name: selectedSong?.name || 'Track',
                          audioUrl: selectedSong?.accessibleUrl || selectedSong?.originalUrl || ''
                        }
                      }));
                      toast({ title: 'Added to Multi-Track', description: selectedSong?.name });
                      onClose();
                    }}
                    className="px-2 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded text-xs flex items-center justify-center gap-1 transition-all"
                    title="Add to Multi-Track"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Track</span>
                  </button>
                  <button
                    onClick={() => {
                      sessionStorage.setItem('astutely_mixer_song', JSON.stringify(selectedSong));
                      toast({ title: 'Opening Mixer', description: 'Loading song...' });
                      window.location.href = '/mixer?tab=ai-mix';
                    }}
                    className="px-2 py-1.5 bg-pink-500/20 hover:bg-pink-500/30 rounded text-xs flex items-center justify-center gap-1 transition-all"
                    title="Send to Mixer"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Mix</span>
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  💡 Generate beats that match this song's vibe
                </p>
              </div>
            )}
          </div>

          {/* Style Grid with Previews */}
          <div className="grid grid-cols-2 gap-3 mb-6 max-h-[280px] overflow-y-auto pr-1">
            {styles.map(style => (
              <button
                key={style.name}
                onClick={() => setSelectedStyle(style)}
                disabled={isGenerating}
                className={`p-4 rounded-xl font-medium transition-all text-left ${
                  selectedStyle.name === style.name
                    ? 'bg-white text-black shadow-lg scale-105'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-xl">{style.icon}</span>
                  <span className="text-sm font-semibold">{style.name}</span>
                  <span className={`text-xs ${selectedStyle.name === style.name ? 'text-gray-600' : 'text-gray-400'}`}>
                    {style.preview}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Freeform Prompt */}
          <div className="mb-6">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 'Add 808 slides and dark pads'"
              className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
              disabled={isGenerating}
            />
          </div>

          {/* Progress Bar */}
          {isGenerating && (
            <div className="mb-4">
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-300 mt-2">
                {progress < 100 ? `Generating... ${progress}%` : 'Adding to timeline...'}
              </p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold text-xl hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Creating Magic...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Music className="w-6 h-6" />
                <span>Make It Bang 🔥</span>
              </div>
            )}
          </button>

          {/* Result Preview */}
          {generatedResult && (
            <div className="mt-4 p-4 rounded-xl bg-green-500/20 border border-green-500/40">
              <p className="text-green-400 font-semibold flex items-center gap-2">
                ✅ Added to Timeline!
              </p>
              <p className="text-gray-300 text-sm mt-1">
                {generatedResult.bpm} BPM • Key of {generatedResult.key} • {generatedResult.style}
              </p>
            </div>
          )}

          {/* Keyboard hint */}
          <p className="text-xs text-gray-400 mt-4 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded">Esc</kbd> to close
          </p>
        </div>

        <div className="absolute bottom-3 right-3 flex items-end gap-2">
          {showResizeGuide && (
            <div className="px-3 py-2 rounded-lg bg-black/50 text-white text-xs border border-white/30 shadow-lg">
              Drag corner to resize
            </div>
          )}
          <button
            type="button"
            aria-label="Resize Astutely panel"
            onPointerDown={handleResizeStart}
            className="h-10 w-10 rounded-full bg-white/15 border border-white/30 text-white flex items-center justify-center hover:bg-white/25 transition-colors cursor-se-resize"
          >
            <MoveDiagonal2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
