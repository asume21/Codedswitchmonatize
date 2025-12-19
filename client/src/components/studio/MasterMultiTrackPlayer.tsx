/**
 * Master Multi-Track Audio Player
 * Professional audio player for loading and mixing multiple audio files
 * Integrates with: Uploaded Songs, Beat Lab, Melody Composer, Piano Roll
 */

import { useState, useRef, useEffect, useContext } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { StudioAudioContext } from '@/pages/studio';
import {
  Play,
  Pause,
  Square,
  Upload,
  Trash2,
  Volume2,
  VolumeX,
  Headphones,
  Plus,
  Music,
  Repeat,
  SkipBack,
  SkipForward,
  Library,
  FolderOpen,
  Mic,
  Drum,
  Piano,
  StopCircle,
  Layers,
  Wand2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTracks } from '@/hooks/useTracks';
import { Resizable } from 'react-resizable';
import { RepeatIcon } from 'lucide-react';
import WaveformVisualizer from './WaveformVisualizer';

interface MidiNote {
  id: string;
  note: string;
  octave: number;
  step: number;
  length: number;
  velocity: number;
}

interface AudioTrack {
  id: string;
  name: string;
  audioBuffer: AudioBuffer | null;
  audioUrl: string;
  volume: number;
  pan: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  volumePoints?: { time: number; volume: number }[];
  muted: boolean;
  solo: boolean;
  color: string;
  trackType?: 'beat' | 'melody' | 'vocal' | 'audio' | 'midi'; // Track type for tool integration
  gainNode?: GainNode;
  panNode?: StereoPannerNode;
  sourceNode?: AudioBufferSourceNode;
  origin?: 'store' | 'manual';
  height?: number; // per-track visual height for arranger-style view
  trimStartSeconds?: number; // per-track trim start (seconds, within audioBuffer)
  trimEndSeconds?: number; // per-track trim end (seconds, within audioBuffer)
  midiNotes?: MidiNote[]; // MIDI note data for MIDI tracks
  instrument?: string; // Instrument name for MIDI tracks
}

const TRACK_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#F97316', // orange
];

const DEFAULT_TRACK_HEIGHT = 80; // px

// Inline waveform component for each track
interface TrackWaveformProps {
  audioBuffer: AudioBuffer | null;
  color: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  height?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  onTrimChange?: (startSeconds: number, endSeconds: number) => void;
}

function TrackWaveform({
  audioBuffer,
  color,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  height,
  trimStartSeconds,
  trimEndSeconds,
  onTrimChange,
}: TrackWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);

  // Draw waveform
  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);

    const fullDuration = audioBuffer.duration || duration || 0;
    const effectiveStart = Math.max(0, trimStartSeconds ?? 0);
    const effectiveEnd = Math.min(fullDuration, trimEndSeconds ?? fullDuration);
    const clipDuration = Math.max(0.01, effectiveEnd - effectiveStart);

    ctx.clearRect(0, 0, width, height);
    
    // Draw waveform background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    for (let i = 0; i < width; i++) {
      // Map canvas X to time within trimmed region, then to sample index
      const relTime = effectiveStart + (i / width) * clipDuration;
      const sampleIndex = Math.floor((relTime / fullDuration) * data.length);
      const step = Math.max(1, Math.floor(data.length / width));
      const sliceStart = sampleIndex;
      const sliceEnd = sliceStart + step;
      let min = 1.0;
      let max = -1.0;

      for (let j = sliceStart; j < sliceEnd && j < data.length; j++) {
        const value = data[j];
        if (value < min) min = value;
        if (value > max) max = value;
      }

      const yMin = ((1 + min) / 2) * height;
      const yMax = ((1 + max) / 2) * height;

      ctx.moveTo(i, yMin);
      ctx.lineTo(i, yMax);
    }
    ctx.stroke();

    // Draw playhead (relative to trimmed region)
    if (clipDuration > 0) {
      const localTime = Math.min(
        Math.max(currentTime - effectiveStart, 0),
        clipDuration
      );
      const playheadX = (localTime / clipDuration) * width;
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [audioBuffer, color, currentTime, duration, trimStartSeconds, trimEndSeconds]);

  const seekFromClientX = (clientX: number) => {
    if (!canvasRef.current || !audioBuffer) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const fullDuration = audioBuffer.duration || duration || 0;
    const effectiveStart = Math.max(0, trimStartSeconds ?? 0);
    const effectiveEnd = Math.min(fullDuration, trimEndSeconds ?? fullDuration);
    const clipDuration = Math.max(0.01, effectiveEnd - effectiveStart);
    const localTime = (x / rect.width) * clipDuration;
    const seekTime = effectiveStart + localTime;
    onSeek(Math.max(0, Math.min(fullDuration, seekTime)));
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    seekFromClientX(e.clientX);
  };

  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    seekFromClientX(touch.clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleClick(e as any);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleClick(e as any);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingHandle(null);
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingHandle || !containerRef.current || !audioBuffer) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fullDuration = audioBuffer.duration || duration || 0;
    const effectiveStart = Math.max(0, trimStartSeconds ?? 0);
    const effectiveEnd = Math.min(fullDuration, trimEndSeconds ?? fullDuration);
    const clipDuration = Math.max(0.01, effectiveEnd - effectiveStart);

    const ratio = Math.min(Math.max(x / rect.width, 0), 1);
    const newGlobalTime = effectiveStart + ratio * clipDuration;

    let nextStart = effectiveStart;
    let nextEnd = effectiveEnd;

    if (draggingHandle === 'start') {
      nextStart = Math.min(newGlobalTime, effectiveEnd - 0.01);
    } else {
      nextEnd = Math.max(newGlobalTime, effectiveStart + 0.01);
    }

    if (onTrimChange) {
      onTrimChange(nextStart, nextEnd);
    }
  };

  const handleTrimMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    handle: 'start' | 'end'
  ) => {
    e.stopPropagation();
    setDraggingHandle(handle);
  };

  if (!audioBuffer) {
    return (
      <div
        ref={containerRef}
        className="bg-gray-900 rounded mb-2 flex items-center justify-center"
        style={{ height: height ?? 64 }}
      >
        <span className="text-xs text-gray-500">No audio data</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="bg-gray-900 rounded mb-2 cursor-pointer relative overflow-hidden"
      style={{ height: height ?? 64 }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleContainerMouseMove}
    >
      <canvas
        ref={canvasRef}
        width={600}
        height={64}
        className="w-full h-full"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
      />
      {/* Trim handles overlay */}
      {audioBuffer && (
        <>
          <div
            className="absolute top-0 bottom-0 w-1 bg-blue-300 cursor-ew-resize"
            style={{
              left: `${((Math.max(0, trimStartSeconds ?? 0)) / (audioBuffer.duration || duration || 1)) * 100}%`,
            }}
            onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-blue-300 cursor-ew-resize"
            style={{
              left: `${((Math.min(audioBuffer.duration || duration || 0, trimEndSeconds ?? (audioBuffer.duration || duration || 0))) /
                (audioBuffer.duration || duration || 1)) * 100}%`,
            }}
            onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
          />
        </>
      )}
      <div className="absolute bottom-1 right-2 text-xs text-gray-400 bg-gray-900/80 px-1 rounded">
        {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
      </div>
    </div>
  );
}

export default function MasterMultiTrackPlayer() {
  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);
  const { tracks: storeTracks } = useTracks();
  
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(80);
  const [loop, setLoop] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [activeSourceTab, setActiveSourceTab] = useState<'library' | 'beatlab' | 'melody' | 'pianoroll'>('library');
  const [punch, setPunch] = useState<{ enabled: boolean; in: number; out: number }>({ enabled: false, in: 0, out: 8 });
  const [waveformEditorTrack, setWaveformEditorTrack] = useState<AudioTrack | null>(null);
  const [waveformAudio, setWaveformAudio] = useState<HTMLAudioElement | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const audioBufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const manualTracksRef = useRef<AudioTrack[]>([]);

  const getTrackEffectiveDuration = (track: AudioTrack): number => {
    const full = track.audioBuffer?.duration || 0;
    const start = Math.max(0, track.trimStartSeconds ?? 0);
    const end = Math.min(full, track.trimEndSeconds ?? full);
    return Math.max(0, end - start);
  };

  // Fetch uploaded songs from library
  const { data: librarySongs = [] } = useQuery<any[]>({
    queryKey: ['/api/songs'],
    enabled: showLibrary || showAddTrack,
  });

  // Listen for tracks from other studio tools (Beat Lab, Melody, Piano Roll)
  useEffect(() => {
    const handleImportTrack = async (event: CustomEvent) => {
      const { type, name, audioData, audioUrl } = event.detail;
      
      if (!audioContextRef.current) return;
      
      try {
        let audioBuffer: AudioBuffer | null = null;
        let url = audioUrl || '';
        
        if (audioData instanceof ArrayBuffer) {
          audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
        } else if (audioData instanceof Blob) {
          const arrayBuffer = await audioData.arrayBuffer();
          audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          url = URL.createObjectURL(audioData);
        } else if (audioUrl) {
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        }
        
        const trackColor = type === 'beat' ? '#F59E0B' : 
                          type === 'melody' ? '#8B5CF6' : 
                          type === 'pianoroll' ? '#3B82F6' : 
                          TRACK_COLORS[tracks.length % TRACK_COLORS.length];
        
        const newTrack: AudioTrack = {
          id: `${type}-${Date.now()}`,
          name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Track`,
          audioBuffer,
          audioUrl: url,
          volume: 80,
          pan: 0,
          fadeInSeconds: 0.05,
          fadeOutSeconds: 0.1,
          volumePoints: [],
          muted: false,
          solo: false,
          color: trackColor,
          trackType: type as 'beat' | 'melody' | 'vocal' | 'audio',
          origin: 'manual',
          height: DEFAULT_TRACK_HEIGHT,
        };
        
        setTracks(prev => [...prev, newTrack]);
        toast({
          title: '✅ Track Imported',
          description: `${newTrack.name} added from ${type}`,
        });
      } catch (error) {
        console.error('Error importing track:', error);
        toast({
          title: '❌ Import Failed',
          description: 'Could not import track from studio tool',
          variant: 'destructive',
        });
      }
    };
    
    window.addEventListener('importToMultiTrack' as any, handleImportTrack);
    return () => {
      window.removeEventListener('importToMultiTrack' as any, handleImportTrack);
    };
  }, [tracks.length, toast]);

  // Sync with studio context tracks
  useEffect(() => {
    if (studioContext.currentTracks && studioContext.currentTracks.length > 0) {
      // Could auto-import tracks from context if needed
    }
  }, [studioContext.currentTracks]);

  // Track manual (locally added) tracks so store sync doesn't overwrite them
  useEffect(() => {
    manualTracksRef.current = tracks.filter(t => t.origin !== 'store');
  }, [tracks]);

  // Initialize Audio Context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGainRef.current = audioContextRef.current.createGain();
    masterGainRef.current.connect(audioContextRef.current.destination);
    masterGainRef.current.gain.value = masterVolume / 100;

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Sync canonical track store into the master player (central hub)
  useEffect(() => {
    if (!audioContextRef.current) return;
    let cancelled = false;
    const ctx = audioContextRef.current;
    const cache = audioBufferCacheRef.current;

    const renderPatternToBuffer = async (track: any): Promise<AudioBuffer | null> => {
      const bpm = track.bpm ?? track.payload?.bpm ?? 120;
      const pattern = track.payload?.pattern || track.pattern;
      const notes = track.notes ?? track.payload?.notes ?? [];

      if (pattern && typeof pattern === 'object') {
        const stepArrays = Object.values(pattern) as any[];
        const steps = stepArrays.reduce((max, arr) => Math.max(max, Array.isArray(arr) ? arr.length : 0), 0) || 16;
        const secondsPerBeat = 60 / bpm;
        const stepDur = secondsPerBeat / 4;
        const duration = Math.max(steps * stepDur, 1);
        const sampleRate = 44100;
        const offline = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);

        const clickEnv = (time: number) => {
          const osc = offline.createOscillator();
          const gain = offline.createGain();
          osc.frequency.value = 1500;
          gain.gain.setValueAtTime(0.4, time);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
          osc.connect(gain).connect(offline.destination);
          osc.start(time);
          osc.stop(time + 0.1);
        };

        for (let i = 0; i < steps; i++) {
          const anyHit = stepArrays.some((arr: any) => Array.isArray(arr) && arr[i]);
          if (anyHit) clickEnv(i * stepDur);
        }

        return offline.startRendering();
      }

      if (Array.isArray(notes) && notes.length > 0) {
        const secondsPerBeat = 60 / bpm;
        
        // Normalize notes to handle both formats: {time, duration} or {step, length, note, octave}
        const noteMap: Record<string, number> = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
        
        const normalizedNotes = notes.map((n: any) => {
          // Handle time: use 'time' field, or convert 'step' (4 steps per beat)
          const time = n.time ?? (n.step !== undefined ? n.step / 4 : 0);
          // Handle duration: use 'duration' field, or convert 'length' (4 steps per beat)
          const dur = n.duration ?? (n.length !== undefined ? n.length / 4 : 0.5);
          
          // Calculate frequency from note+octave or midi number
          let freq: number;
          if (n.note && typeof n.note === 'string' && n.octave !== undefined) {
            const semitone = noteMap[n.note] ?? 0;
            const midi = (n.octave + 1) * 12 + semitone;
            freq = 440 * Math.pow(2, (midi - 69) / 12);
          } else if (typeof n.midi === 'number') {
            freq = 440 * Math.pow(2, (n.midi - 69) / 12);
          } else if (typeof n.note === 'number') {
            freq = 440 * Math.pow(2, (n.note - 69) / 12);
          } else {
            freq = 220; // Default to A3
          }
          
          const velocity = (n.velocity ?? 100) / 127;
          return { time, dur, freq, velocity };
        });
        
        const duration = Math.max(normalizedNotes.reduce((m, n) => Math.max(m, n.time + n.dur), 1) * secondsPerBeat, 1);
        const sampleRate = 44100;
        const offline = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);

        normalizedNotes.forEach((n) => {
          const start = n.time * secondsPerBeat;
          const len = n.dur * secondsPerBeat;
          const osc = offline.createOscillator();
          const gain = offline.createGain();
          // Use sawtooth for bass-like sound, or triangle for softer tones
          osc.type = n.freq < 200 ? 'sawtooth' : 'triangle';
          osc.frequency.value = n.freq;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.4 * n.velocity, start + 0.02);
          gain.gain.setValueAtTime(0.3 * n.velocity, start + len * 0.7);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
          osc.connect(gain).connect(offline.destination);
          osc.start(start);
          osc.stop(start + len + 0.05);
        });

        const buffer = await offline.startRendering();
        return buffer;
      }

      return null;
    };

    const syncFromStore = async () => {
      const manualTracks = manualTracksRef.current;
      const synced: AudioTrack[] = [];

      for (const storeTrack of storeTracks) {
        const audioUrl = storeTrack.audioUrl;

        let audioBuffer: AudioBuffer | null = cache.get(storeTrack.id) ?? null;
        if (!audioBuffer) {
          try {
            if (audioUrl) {
              const response = await fetch(audioUrl);
              const arrayBuffer = await response.arrayBuffer();
              audioBuffer = await ctx.decodeAudioData(arrayBuffer);
              cache.set(storeTrack.id, audioBuffer);
            } else {
              audioBuffer = await renderPatternToBuffer(storeTrack);
              if (audioBuffer) cache.set(storeTrack.id, audioBuffer);
            }
          } catch (error) {
            console.error('Failed to load store track audio', error);
          }
        }

        if (!audioBuffer) {
          try {
            audioBuffer = await renderPatternToBuffer(storeTrack);
            if (audioBuffer) cache.set(storeTrack.id, audioBuffer);
          } catch (error) {
            console.error('Failed to render pattern/notes for track', error);
          }
        }

        const midiNotes = storeTrack.notes ?? [];
        const isMidiTrack = storeTrack.type === 'midi' || storeTrack.kind === 'midi' || storeTrack.kind === 'piano';
        const instrumentName = storeTrack.instrument;

        if (!audioBuffer && (!isMidiTrack || midiNotes.length === 0)) {
          continue;
        }

        const trackVolume = typeof storeTrack.volume === 'number' ? storeTrack.volume : 0.8;
        const volumePercent = trackVolume > 1 ? trackVolume : Math.round(trackVolume * 100);

        const mappedTrackType = isMidiTrack ? 'midi' : 
          (storeTrack.type === 'beat' || storeTrack.type === 'audio' || storeTrack.type === 'midi') 
            ? storeTrack.type 
            : 'audio';

        const mapped: AudioTrack = {
          id: storeTrack.id,
          name: storeTrack.name,
          audioBuffer,
          audioUrl: audioUrl ?? '',
          volume: volumePercent,
          pan: storeTrack.pan ?? 0,
          muted: storeTrack.muted ?? false,
          solo: storeTrack.solo ?? false,
          color: storeTrack.color || TRACK_COLORS[synced.length % TRACK_COLORS.length],
          trackType: mappedTrackType,
          origin: 'store',
          height: DEFAULT_TRACK_HEIGHT,
          trimStartSeconds: 0,
          trimEndSeconds: audioBuffer ? audioBuffer.duration : 16,
          midiNotes: isMidiTrack ? midiNotes : undefined,
          instrument: instrumentName,
        };

        synced.push(mapped);
      }

      if (!cancelled) {
        setTracks([...manualTracks, ...synced]);
      }
    };

    syncFromStore();
    return () => { cancelled = true; };
  }, [storeTracks]);

  // Update master volume
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVolume / 100;
    }
  }, [masterVolume]);

  // Calculate total duration
  useEffect(() => {
    if (tracks.length === 0) {
      setDuration(0);
      return;
    }

    const maxDuration = Math.max(
      ...tracks.map(t => getTrackEffectiveDuration(t)),
      0
    );
    setDuration(maxDuration);
  }, [tracks]);

  // Load audio file
  const loadAudioFile = async (file: File) => {
    if (!audioContextRef.current) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const audioUrl = URL.createObjectURL(file);

      const newTrack: AudioTrack = {
        id: `track-${Date.now()}-${Math.random()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        audioBuffer,
        audioUrl,
        volume: 80,
        pan: 0,
        fadeInSeconds: 0.05,
        fadeOutSeconds: 0.1,
        volumePoints: [],
        muted: false,
        solo: false,
        color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
        origin: 'manual',
        trimStartSeconds: 0,
        trimEndSeconds: audioBuffer.duration,
      };

      setTracks(prev => [...prev, newTrack]);
      toast({
        title: '✅ Track Loaded',
        description: `${newTrack.name} added to project`,
      });
    } catch (error) {
      console.error('Error loading audio:', error);
      toast({
        title: '❌ Error',
        description: 'Failed to load audio file',
        variant: 'destructive',
      });
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('audio/')) {
        loadAudioFile(file);
      }
    });
  };

  // Load song from library (uploaded songs)
  const loadFromLibrary = async (song: any) => {
    if (!audioContextRef.current) return;

    const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
    if (!audioUrl) {
      toast({
        title: '❌ Error',
        description: 'No audio URL available for this song',
        variant: 'destructive',
      });
      return;
    }

    try {
      toast({ title: '⏳ Loading...', description: `Loading ${song.name}...` });
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      const newTrack: AudioTrack = {
        id: `track-${Date.now()}-${song.id}`,
        name: song.name,
        audioBuffer,
        audioUrl,
        volume: 80,
        pan: 0,
        fadeInSeconds: 0.05,
        fadeOutSeconds: 0.1,
        volumePoints: [],
        muted: false,
        solo: false,
        color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
        origin: 'manual',
      };

      setTracks(prev => [...prev, newTrack]);
      setShowLibrary(false);
      
      // Also load into global audio player for persistent playback across navigation
      window.dispatchEvent(new CustomEvent('globalAudio:load', {
        detail: { name: song.name, url: audioUrl, type: 'song', autoplay: false }
      }));
      
      toast({
        title: '✅ Track Added!',
        description: `${song.name} loaded into multi-track`,
      });
    } catch (error) {
      console.error('Error loading from library:', error);
      toast({
        title: '❌ Error',
        description: 'Failed to load song from library',
        variant: 'destructive',
      });
    }
  };

  // Start recording from microphone
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        
        if (audioContextRef.current) {
          try {
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            const audioUrl = URL.createObjectURL(blob);

      const newTrack: AudioTrack = {
        id: `recording-${Date.now()}`,
        name: `Recording ${tracks.length + 1}`,
        audioBuffer,
        audioUrl,
        volume: 80,
        pan: 0,
        fadeInSeconds: 0.05,
        fadeOutSeconds: 0.1,
        volumePoints: [],
        muted: false,
        solo: false,
        color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
        origin: 'manual',
        trimStartSeconds: 0,
              trimEndSeconds: audioBuffer.duration,
            };

            setTracks(prev => [...prev, newTrack]);
            toast({
              title: '🎤 Recording Saved!',
              description: `Recording added as new track`,
            });
          } catch (err) {
            console.error('Error decoding recording:', err);
          }
        }

        // Stop all tracks from the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Update recording time
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({
        title: '🔴 Recording Started',
        description: 'Speak or sing into your microphone',
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: '❌ Microphone Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Add empty track for Beat Lab / Melody / Piano Roll import
  const addEmptyTrack = (name: string, type: 'beat' | 'melody' | 'vocal' | 'audio') => {
    const newTrack: AudioTrack = {
      id: `${type}-${Date.now()}`,
      name,
      audioBuffer: null,
      audioUrl: '',
      volume: 80,
      pan: 0,
      fadeInSeconds: 0.05,
      fadeOutSeconds: 0.1,
      volumePoints: [],
      muted: false,
      solo: false,
      color: type === 'beat' ? '#F59E0B' : type === 'melody' ? '#8B5CF6' : '#10B981',
      trackType: type,
      height: DEFAULT_TRACK_HEIGHT,
      trimStartSeconds: 0,
      trimEndSeconds: 0,
    };

    setTracks(prev => [...prev, newTrack]);
    setShowAddTrack(false);
    
    toast({
      title: '✅ Track Created',
      description: `${name} track ready - click "Open ${type === 'beat' ? 'Beat Lab' : type === 'melody' ? 'Melody Composer' : 'Recorder'}" to create content`,
    });
  };

  // Play all tracks
  const playTracks = () => {
    if (!audioContextRef.current || !masterGainRef.current) return;

    const ctx = audioContextRef.current;
    const hasSolo = tracks.some(t => t.solo);

    // Stop any existing playback
    stopTracks();

    const startOffset = punch.enabled ? Math.max(punch.in, pauseTimeRef.current) : pauseTimeRef.current;
    startTimeRef.current = ctx.currentTime - startOffset;

    tracks.forEach(track => {
      if (!track.audioBuffer) return;

      // Skip if muted or if solo mode and this track isn't soloed
      if (track.muted || (hasSolo && !track.solo)) return;

      // Create nodes
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();

      source.buffer = track.audioBuffer;

      const fullDur = track.audioBuffer.duration;
      const trimStart = Math.max(0, track.trimStartSeconds ?? 0);
      const trimEnd = Math.min(fullDur, track.trimEndSeconds ?? fullDur);
      const globalEnd = punch.enabled ? Math.min(trimEnd, punch.out) : trimEnd;
      const clipDuration = Math.max(0, globalEnd - trimStart);

      // Only loop untrimmed clips for now; trimmed clips play their region once
      source.loop = loop && clipDuration === fullDur;

      // Set pan (volume handled with envelope below)
      panNode.pan.value = track.pan;

      // Connect: source -> gain -> pan -> master -> destination
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(masterGainRef.current!);

      // Store references
      track.sourceNode = source;
      track.gainNode = gainNode;
      track.panNode = panNode;

      // Start playback within trimmed region
      if (clipDuration <= 0) {
        return;
      }

      if (startOffset >= clipDuration) {
        // Playback position is past the trimmed region; this track stays silent
        return;
      }

      const bufferStart = trimStart + startOffset;
      const stopAt = punch.enabled ? Math.min(globalEnd, punch.out) : globalEnd;
      const allowedDuration = stopAt - bufferStart;
      const playDuration = Math.max(0, Math.min(clipDuration - startOffset, allowedDuration));

      const fadeIn = Math.min(track.fadeInSeconds ?? 0, playDuration / 2);
      const fadeOut = loop ? 0 : Math.min(track.fadeOutSeconds ?? 0, Math.max(playDuration - fadeIn - 0.01, 0.01));

      // Build combined gain envelope (volume slider * automation * fades)
      const baseGain = track.volume / 100;
      const points: number[] = [0, playDuration];
      const autoPoints = (track.volumePoints || []).filter(
        (p) => p.time >= bufferStart && p.time <= bufferStart + playDuration
      );
      autoPoints.forEach((p) => points.push(Math.max(0, p.time - bufferStart)));
      if (fadeIn > 0) points.push(fadeIn);
      if (fadeOut > 0) points.push(Math.max(playDuration - fadeOut, 0));
      const uniquePoints = Array.from(new Set(points.filter((p) => p >= 0 && p <= playDuration))).sort((a, b) => a - b);

      const calcFadeMultiplier = (t: number) => {
        if (fadeIn > 0 && t <= fadeIn) return Math.max(0, t / fadeIn);
        if (fadeOut > 0 && t >= playDuration - fadeOut) {
          const rel = playDuration - t;
          return Math.max(0, rel / fadeOut);
        }
        return 1;
      };

      const computeGain = (t: number) => {
        const auto = getAutomationGainAt(track.volumePoints, bufferStart + t, clipDuration);
        const fadeMul = calcFadeMultiplier(t);
        return Math.max(0, baseGain * auto * fadeMul);
      };

      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      uniquePoints.forEach((t, idx) => {
        const g = computeGain(t);
        const at = ctx.currentTime + t;
        if (idx === 0) {
          gainNode.gain.setValueAtTime(g, at);
        } else {
          gainNode.gain.linearRampToValueAtTime(g, at);
        }
      });
      source.start(0, bufferStart, playDuration);

      // Handle end of playback
      source.onended = () => {
        if (!loop) {
          const allEnded = tracks.every(t => !t.sourceNode || t.sourceNode === source);
          if (allEnded) {
            setIsPlaying(false);
            pauseTimeRef.current = 0;
            setCurrentTime(0);
          }
        }
      };
    });

    setIsPlaying(true);
    isPlayingRef.current = true;
    updateCurrentTime();
  };

  // Stop all tracks
  const stopTracks = () => {
    tracks.forEach(track => {
      if (track.sourceNode) {
        try {
          track.sourceNode.stop();
          track.sourceNode.disconnect();
        } catch (e) {
          // Already stopped
        }
        track.sourceNode = undefined;
      }
    });
  };

  // Pause playback
  const pausePlayback = () => {
    if (audioContextRef.current) {
      pauseTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
    }
    stopTracks();
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Stop and reset
  const stopPlayback = () => {
    stopTracks();
    setIsPlaying(false);
    isPlayingRef.current = false;
    pauseTimeRef.current = 0;
    setCurrentTime(0);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Update current time
  const updateCurrentTime = () => {
    if (!audioContextRef.current || !isPlayingRef.current) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    setCurrentTime(elapsed);

    const punchEnd = punch.enabled ? punch.out : duration;
    if (elapsed < punchEnd || loop) {
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    }
  };

  // Update track volume
  const updateTrackVolume = (trackId: string, volume: number) => {
    setTracks(prev =>
      prev.map(t => {
        if (t.id === trackId) {
          if (t.gainNode) {
            t.gainNode.gain.value = volume / 100;
          }
          return { ...t, volume };
        }
        return t;
      })
    );
  };

  // Update track pan
  const updateTrackPan = (trackId: string, pan: number) => {
    setTracks(prev =>
      prev.map(t => {
        if (t.id === trackId) {
          if (t.panNode) {
            t.panNode.pan.value = pan;
          }
          return { ...t, pan };
        }
        return t;
      })
    );
  };

  const updateTrackFade = (trackId: string, fadeInSeconds: number, fadeOutSeconds: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, fadeInSeconds, fadeOutSeconds } : t))
    );
  };

  const updateTrackVolumePoints = (trackId: string, points: { time: number; volume: number }[]) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, volumePoints: points } : t)));
  };

  const getAutomationGainAt = (points: { time: number; volume: number }[] | undefined, time: number, clipDuration: number) => {
    if (!points || points.length === 0) return 1;
    const sorted = [...points].sort((a, b) => a.time - b.time);
    if (time <= sorted[0].time) {
      const first = sorted[0];
      const denom = Math.max(first.time, 0.001);
      return 1 + (first.volume - 1) * Math.min(1, Math.max(0, time / denom));
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (time >= a.time && time <= b.time) {
        const span = Math.max(b.time - a.time, 0.001);
        const ratio = (time - a.time) / span;
        return a.volume + (b.volume - a.volume) * ratio;
      }
    }
    return sorted[sorted.length - 1].volume;
  };

  // Toggle mute
  const toggleMute = (trackId: string) => {
    setTracks(prev =>
      prev.map(t => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
    if (isPlaying) {
      pausePlayback();
      setTimeout(() => playTracks(), 10);
    }
  };

  // Toggle solo
  const toggleSolo = (trackId: string) => {
    setTracks(prev =>
      prev.map(t => (t.id === trackId ? { ...t, solo: !t.solo } : t))
    );
    if (isPlaying) {
      pausePlayback();
      setTimeout(() => playTracks(), 10);
    }
  };

  // Delete track
  const deleteTrack = (trackId: string) => {
    setTracks(prev => prev.filter(t => t.id !== trackId));
    toast({
      title: '🗑️ Track Removed',
      description: 'Track deleted from project',
    });
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const applyTemplate = (template: 'band' | 'podcast') => {
    const baseTracks =
      template === 'band'
        ? [
            { name: 'Drums', type: 'beat' as const },
            { name: 'Bass', type: 'bass' as any },
            { name: 'Melody', type: 'melody' as const },
            { name: 'Vocals', type: 'vocal' as const },
          ]
        : [
            { name: 'Host Mic', type: 'vocal' as const },
            { name: 'Guest Mic', type: 'vocal' as const },
            { name: 'Music Bed', type: 'audio' as const },
          ];

    setTracks((prev) => {
      const next = [...prev];
      baseTracks.forEach((t, idx) => {
        next.push({
          id: `${t.name.toLowerCase().replace(/\\s+/g, '-')}-${Date.now()}-${idx}`,
          name: t.name,
          audioBuffer: null,
          audioUrl: '',
          volume: 80,
          pan: 0,
          volumePoints: [],
          muted: false,
          solo: false,
          color: TRACK_COLORS[next.length % TRACK_COLORS.length],
          trackType: t.type as any,
          origin: 'manual',
          height: DEFAULT_TRACK_HEIGHT,
          trimStartSeconds: 0,
          trimEndSeconds: 0,
        });
      });
      return next;
    });

    toast({
      title: template === 'band' ? 'Band template added' : 'Podcast template added',
      description:
        template === 'band'
          ? 'Drums, bass, melody, and vocal tracks created'
          : 'Host, guest, and music bed tracks created',
    });
  };

  // Keyboard shortcuts: space play/pause, L loop, P punch toggle, arrows seek
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (target && (target as HTMLElement).isContentEditable) return;

      if (e.code === 'Space') {
        e.preventDefault();
        isPlaying ? pausePlayback() : playTracks();
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLoop((v) => !v);
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPunch((p) => ({ ...p, enabled: !p.enabled }));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stopPlayback();
        pauseTimeRef.current = Math.max(0, pauseTimeRef.current - 1);
        setCurrentTime(pauseTimeRef.current);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stopPlayback();
        pauseTimeRef.current = Math.min(duration, pauseTimeRef.current + 1);
        setCurrentTime(pauseTimeRef.current);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, duration]);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Music className="w-6 h-6" />
              Master Multi-Track Player
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Load and mix multiple audio files together
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Recording Button */}
            {isRecording ? (
              <Button 
                onClick={stopRecording}
                className="bg-red-600 hover:bg-red-500 animate-pulse"
              >
                <StopCircle className="w-4 h-4 mr-2" />
                Stop ({formatTime(recordingTime)})
              </Button>
            ) : (
              <Button 
                onClick={startRecording}
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/20"
              >
                <Mic className="w-4 h-4 mr-2" />
                Record
              </Button>
            )}

            {/* Add Track Dialog */}
            <Dialog open={showAddTrack} onOpenChange={setShowAddTrack}>
              <DialogTrigger asChild>
                <Button variant="default" className="bg-green-600 hover:bg-green-500">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Track
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    Add Track to Multi-Track Player
                  </DialogTitle>
                </DialogHeader>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" className="justify-start" onClick={() => applyTemplate('band')}>
                    Band Template (Drums, Bass, Melody, Vocal)
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => applyTemplate('podcast')}>
                    Podcast Template (Host, Guest, Bed)
                  </Button>
                </div>
                
                <Tabs value={activeSourceTab} onValueChange={(v) => setActiveSourceTab(v as any)} className="mt-4">
                  <TabsList className="grid grid-cols-4 bg-gray-800">
                    <TabsTrigger value="library" className="data-[state=active]:bg-blue-600">
                      <Library className="w-4 h-4 mr-1" />
                      Library
                    </TabsTrigger>
                    <TabsTrigger value="beatlab" className="data-[state=active]:bg-amber-600">
                      <Drum className="w-4 h-4 mr-1" />
                      Beat Lab
                    </TabsTrigger>
                    <TabsTrigger value="melody" className="data-[state=active]:bg-purple-600">
                      <Piano className="w-4 h-4 mr-1" />
                      Melody
                    </TabsTrigger>
                    <TabsTrigger value="pianoroll" className="data-[state=active]:bg-blue-500">
                      <Music className="w-4 h-4 mr-1" />
                      Piano Roll
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Library Tab - Uploaded Songs */}
                  <TabsContent value="library" className="mt-4">
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {librarySongs.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No songs in library yet.</p>
                          <p className="text-sm">Upload songs in the Song Uploader tab first.</p>
                        </div>
                      ) : (
                        librarySongs.map((song: any) => (
                          <div
                            key={song.id}
                            className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Music className="w-5 h-5 text-blue-400" />
                              <div>
                                <p className="font-medium text-white">{song.name}</p>
                                <p className="text-xs text-gray-400">
                                  {song.format?.toUpperCase()} • {song.duration ? `${Math.round(song.duration)}s` : 'Unknown'}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                loadFromLibrary(song);
                                setShowAddTrack(false);
                              }}
                              className="bg-green-600 hover:bg-green-500"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* Beat Lab Tab */}
                  <TabsContent value="beatlab" className="mt-4">
                    <div className="text-center py-8">
                      <Drum className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                      <h3 className="text-lg font-semibold mb-2">Import from Beat Lab</h3>
                      <p className="text-gray-400 mb-4 text-sm">
                        Create beats in Beat Lab and export them here
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => {
                            addEmptyTrack('Beat Track', 'beat');
                            setShowAddTrack(false);
                          }}
                          className="bg-amber-600 hover:bg-amber-500"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Empty Beat Track
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'beatmaker' }));
                            setShowAddTrack(false);
                            toast({ title: '🥁 Opening Beat Lab', description: 'Create your beat, then export to Multi-Track' });
                          }}
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Open Beat Lab
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Melody Tab */}
                  <TabsContent value="melody" className="mt-4">
                    <div className="text-center py-8">
                      <Piano className="w-16 h-16 mx-auto mb-4 text-purple-500" />
                      <h3 className="text-lg font-semibold mb-2">Import from Melody Composer</h3>
                      <p className="text-gray-400 mb-4 text-sm">
                        Create melodies and export them here
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => {
                            addEmptyTrack('Melody Track', 'melody');
                            setShowAddTrack(false);
                          }}
                          className="bg-purple-600 hover:bg-purple-500"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Empty Melody Track
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'melody' }));
                            setShowAddTrack(false);
                            toast({ title: '🎹 Opening Melody Composer', description: 'Create your melody, then export to Multi-Track' });
                          }}
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Open Melody Composer
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Piano Roll Tab */}
                  <TabsContent value="pianoroll" className="mt-4">
                    <div className="text-center py-8">
                      <Music className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                      <h3 className="text-lg font-semibold mb-2">Import from Piano Roll</h3>
                      <p className="text-gray-400 mb-4 text-sm">
                        Create MIDI sequences in Piano Roll and export them here
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => {
                            addEmptyTrack('Piano Roll Track', 'audio');
                            setShowAddTrack(false);
                          }}
                          className="bg-blue-600 hover:bg-blue-500"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Empty Track
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'unified-studio' }));
                            setShowAddTrack(false);
                            toast({ title: '🎵 Opening Piano Roll', description: 'Create your sequence, then export to Multi-Track' });
                          }}
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Open Piano Roll
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                
                {/* Quick Add Options */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400 mb-3">Quick Add:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        addEmptyTrack('Vocal Track', 'vocal');
                        setShowAddTrack(false);
                      }}
                    >
                      <Mic className="w-4 h-4 mr-1" />
                      Vocal Track
                    </Button>
                    <label htmlFor="quick-upload" className="cursor-pointer">
                      <Button size="sm" variant="outline" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-1" />
                          Upload Audio File
                        </span>
                      </Button>
                    </label>
                    <input
                      id="quick-upload"
                      type="file"
                      accept="audio/*"
                      multiple
                      onChange={(e) => {
                        handleFileUpload(e);
                        setShowAddTrack(false);
                      }}
                      className="hidden"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Load from Library Button */}
            <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
              <DialogTrigger asChild>
                <Button variant="default" className="bg-purple-600 hover:bg-purple-500">
                  <Library className="w-4 h-4 mr-2" />
                  From Library
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <FolderOpen className="w-5 h-5" />
                    Load from Song Library
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 mt-4">
                  {librarySongs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No songs in library yet.</p>
                      <p className="text-sm">Upload songs in the Song Uploader tab first.</p>
                    </div>
                  ) : (
                    librarySongs.map((song: any) => (
                      <div
                        key={song.id}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Music className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="font-medium text-white">{song.name}</p>
                            <p className="text-xs text-gray-400">
                              {song.format?.toUpperCase()} • {song.duration ? `${Math.round(song.duration)}s` : 'Unknown duration'}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => loadFromLibrary(song)}
                          className="bg-green-600 hover:bg-green-500"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <label htmlFor="audio-upload">
              <Button variant="outline" className="cursor-pointer" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload New
                </span>
              </Button>
            </label>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="bg-gray-850 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                stopPlayback();
                pauseTimeRef.current = Math.max(0, pauseTimeRef.current - 5);
                setCurrentTime(pauseTimeRef.current);
              }}
              variant="outline"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              onClick={() => (isPlaying ? pausePlayback() : playTracks())}
              className={isPlaying ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}
              disabled={tracks.length === 0}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button size="sm" onClick={stopPlayback} variant="outline">
              <Square className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                stopPlayback();
                pauseTimeRef.current = Math.min(duration, pauseTimeRef.current + 5);
                setCurrentTime(pauseTimeRef.current);
              }}
              variant="outline"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setLoop(!loop)}
              variant={loop ? 'default' : 'outline'}
            >
              <Repeat className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setPunch((p) => ({ ...p, enabled: !p.enabled }))}
              variant={punch.enabled ? 'default' : 'outline'}
              title="Punch in/out recording window"
            >
              <RepeatIcon className="w-4 h-4" />
            </Button>
            {punch.enabled && (
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span>In</span>
                <Input
                  type="number"
                  value={punch.in}
                  min={0}
                  step={0.5}
                  onChange={(e) =>
                    setPunch((p) => ({
                      ...p,
                      in: Math.max(0, Math.min(Number(e.target.value) || 0, p.out - 0.1)),
                    }))
                  }
                  className="w-16 h-8 bg-gray-800 text-white border-gray-700"
                />
                <span>Out</span>
                <Input
                  type="number"
                  value={punch.out}
                  min={punch.in + 0.1}
                  step={0.5}
                  onChange={(e) =>
                    setPunch((p) => ({
                      ...p,
                      out: Math.max(p.in + 0.1, Number(e.target.value) || p.in + 0.1),
                    }))
                  }
                  className="w-16 h-8 bg-gray-800 text-white border-gray-700"
                />
              </div>
            )}
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-4">
            <div className="text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Tempo:</span>
              <Input
                type="number"
                value={tempo}
                onChange={(e) => setTempo(Number(e.target.value))}
                className="w-20 h-8 bg-gray-800 text-white border-gray-600"
                min={40}
                max={200}
              />
              <span className="text-sm text-gray-400">BPM</span>
            </div>
          </div>

          {/* Master Volume */}
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Master</span>
            <Slider
              value={[masterVolume]}
              onValueChange={(val) => setMasterVolume(val[0])}
              max={100}
              min={0}
              step={1}
              className="w-32"
            />
            <span className="text-sm font-bold w-12">{masterVolume}%</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-4">
          <div className="bg-gray-900 rounded h-2 relative overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-blue-500"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-y-auto p-4">
        {tracks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Music className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2">No Tracks Loaded</h3>
              <p className="text-gray-400 mb-4">
                Click "Load Audio Files" to add beats, melodies, vocals, and more
              </p>
              <label htmlFor="audio-upload-empty">
                <Button variant="default" className="cursor-pointer" asChild>
                  <span>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Track
                  </span>
                </Button>
              </label>
              <input
                id="audio-upload-empty"
                type="file"
                accept="audio/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track, index) => (
              <Resizable
                key={track.id}
                axis="y"
                height={track.height ?? DEFAULT_TRACK_HEIGHT}
                width={0}
                minConstraints={[0, 40]}
                maxConstraints={[0, 300]}
                onResize={(_, data) => {
                  const nextHeight = Math.max(40, Math.min(300, data.size.height));
                  setTracks(prev =>
                    prev.map(t =>
                      t.id === track.id ? { ...t, height: nextHeight } : t
                    )
                  );
                }}
                resizeHandles={['s']}
              >
                <div style={{ height: (track.height ?? DEFAULT_TRACK_HEIGHT) + 32 }}>
                  <Card className="bg-gray-800 border-gray-700 relative overflow-hidden h-full">
                    <CardContent className="p-4 h-full flex flex-col">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Track color stripe */}
                        <div
                          className="w-2 h-full rounded"
                          style={{ backgroundColor: track.color }}
                        />

                        <div className="flex-1 flex flex-col gap-2">
                          {/* Header with name + delete */}
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{track.name}</h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTrack(track.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Waveform, MIDI notes, or empty state */}
                          {track.audioBuffer ? (
                            <TrackWaveform
                              audioBuffer={track.audioBuffer}
                              color={track.color}
                              currentTime={currentTime}
                              duration={track.audioBuffer?.duration || 0}
                              isPlaying={isPlaying}
                              height={track.height ?? DEFAULT_TRACK_HEIGHT}
                              onSeek={(time) => {
                                pauseTimeRef.current = time;
                                setCurrentTime(time);
                                if (isPlaying) {
                                  stopTracks();
                                  playTracks();
                                }
                              }}
                            />
                          ) : track.midiNotes && track.midiNotes.length > 0 ? (
                            <div
                              className="relative bg-gray-900 rounded overflow-x-auto"
                              style={{ height: track.height ?? DEFAULT_TRACK_HEIGHT }}
                            >
                              <div className="relative h-full min-w-[600px]">
                                {track.midiNotes.map((note) => (
                                  <div
                                    key={note.id}
                                    className="absolute bg-green-600/80 border border-green-400 rounded text-xs flex items-center justify-center text-white font-medium"
                                    style={{
                                      left: `${note.step * 12}px`,
                                      width: `${Math.max((note.length || 4) * 12 - 2, 20)}px`,
                                      height: '24px',
                                      top: '8px',
                                    }}
                                  >
                                    {note.note}{note.octave}
                                  </div>
                                ))}
                              </div>
                              <div className="absolute bottom-1 left-2 text-xs text-green-400 bg-gray-900/80 px-1 rounded">
                                MIDI: {track.instrument || 'Synth'} ({track.midiNotes.length} notes)
                              </div>
                            </div>
                          ) : (
                            <div
                              className="bg-gray-900 rounded flex items-center justify-center gap-3 border-2 border-dashed border-gray-600"
                              style={{ height: track.height ?? DEFAULT_TRACK_HEIGHT }}
                            >
                              {track.trackType === 'beat' && (
                                <Button
                                  size="sm"
                                  className="bg-amber-600 hover:bg-amber-500"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('openStudioTool', {
                                      detail: { tool: 'beat-lab', trackId: track.id },
                                    }));
                                    toast({
                                      title: '🥁 Opening Beat Lab',
                                      description: 'Create your beat, then export to load it here',
                                    });
                                  }}
                                >
                                  <Drum className="w-4 h-4 mr-2" />
                                  Open Beat Lab
                                </Button>
                              )}
                              {track.trackType === 'melody' && (
                                <Button
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-500"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('openStudioTool', {
                                      detail: { tool: 'melody', trackId: track.id },
                                    }));
                                    toast({
                                      title: '🎹 Opening Melody Composer',
                                      description: 'Create your melody, then export to load it here',
                                    });
                                  }}
                                >
                                  <Piano className="w-4 h-4 mr-2" />
                                  Open Melody Composer
                                </Button>
                              )}
                              {track.trackType === 'vocal' && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-500"
                                  onClick={startRecording}
                                >
                                  <Mic className="w-4 h-4 mr-2" />
                                  Start Recording
                                </Button>
                              )}
                              {!track.trackType && (
                                <span className="text-gray-500 text-sm">
                                  Drop audio file here or use buttons above
                                </span>
                              )}
                              <label htmlFor={`track-upload-${track.id}`} className="cursor-pointer">
                                <Button size="sm" variant="outline" asChild>
                                  <span>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Audio
                                  </span>
                                </Button>
                              </label>
                              <input
                                id={`track-upload-${track.id}`}
                                type="file"
                                accept="audio/*"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </div>
                          )}

                          {/* Controls */}
                          <div className="flex items-center gap-4 mt-2">
                            {/* Mute/Solo */}
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={track.muted ? 'default' : 'outline'}
                                onClick={() => toggleMute(track.id)}
                                className="w-8 h-8 p-0"
                              >
                                {track.muted ? <VolumeX className="w-3 h-3" /> : 'M'}
                              </Button>
                              <Button
                                size="sm"
                                variant={track.solo ? 'default' : 'outline'}
                                onClick={() => toggleSolo(track.id)}
                                className="w-8 h-8 p-0"
                              >
                                S
                              </Button>
                            </div>

                            {/* Volume */}
                            <div className="flex items-center gap-2 flex-1">
                              <Volume2 className="w-3 h-3 text-gray-400" />
                              <Slider
                                value={[track.volume]}
                                onValueChange={(val) => updateTrackVolume(track.id, val[0])}
                                max={100}
                                min={0}
                                step={1}
                                className="flex-1"
                              />
                              <span className="text-xs w-10">{track.volume}%</span>
                            </div>

                            {/* Pan */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">Pan</span>
                              <Slider
                                value={[track.pan * 100]}
                                onValueChange={(val) => updateTrackPan(track.id, val[0] / 100)}
                                max={100}
                                min={-100}
                                step={1}
                                className="w-24"
                              />
                              <span className="text-xs w-8">
                                {track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}
                              </span>
                            </div>

                            {/* Fade In/Out */}
                            <div className="flex items-center gap-2 w-48">
                              <span className="text-xs text-gray-400 whitespace-nowrap">Fade</span>
                              <Slider
                                value={[Math.round((track.fadeInSeconds ?? 0) * 100)]}
                                onValueChange={(val) =>
                                  updateTrackFade(track.id, val[0] / 100, track.fadeOutSeconds ?? 0.1)
                                }
                                max={200}
                                min={0}
                                step={5}
                              />
                              <Slider
                                value={[Math.round((track.fadeOutSeconds ?? 0) * 100)]}
                                onValueChange={(val) =>
                                  updateTrackFade(track.id, track.fadeInSeconds ?? 0.05, val[0] / 100)
                                }
                                max={200}
                                min={0}
                                step={5}
                              />
                            </div>

                            {/* Waveform edit */}
                            <div className="flex items-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (!track.audioUrl) {
                                    toast({
                                      title: 'No audio URL',
                                      description: 'Load or render this track to edit its waveform.',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }
                                  setWaveformEditorTrack(track);
                                  const audio = new Audio(track.audioUrl);
                                  setWaveformAudio(audio);
                                }}
                              >
                                Waveform
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    {/* Resize handle */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/70 hover:bg-gray-400/90 cursor-row-resize" />
                  </Card>
                </div>
              </Resizable>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            Tracks: <span className="text-white font-semibold">{tracks.length}</span>
          </span>
          <span className="text-gray-400">
            Duration: <span className="text-white font-semibold">{formatTime(duration)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400">Professional Multi-Track Mixing</span>
        </div>
      </div>

      {/* Waveform editor dialog */}
      <Dialog
        open={!!waveformEditorTrack}
        onOpenChange={(open) => {
          if (!open) {
            setWaveformEditorTrack(null);
            setWaveformAudio(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              Waveform Editor {waveformEditorTrack ? `– ${waveformEditorTrack.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <WaveformVisualizer
              audioElement={waveformAudio}
              isPlaying={false}
              showControls
              height={220}
              className="w-full"
              initialVolumePoints={waveformEditorTrack?.volumePoints}
              onVolumePointsChange={(pts) => {
                if (waveformEditorTrack) {
                  updateTrackVolumePoints(waveformEditorTrack.id, pts);
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
