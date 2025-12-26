/**
 * Master Multi-Track Audio Player
 * Professional audio player for loading and mixing multiple audio files
 * Integrates with: Uploaded Songs, Beat Lab, Melody Composer, Piano Roll
 */

import { useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { StudioAudioContext } from '@/pages/studio';
import { useAudio } from '@/hooks/use-audio';
import { apiRequest } from '@/lib/queryClient';
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
  Mic,
  Drum,
  Piano,
  Wand2,
  GripVertical,
  Scissors,
  Flag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTracks } from '@/hooks/useTracks';
import { Resizable } from 'react-resizable';
import { RepeatIcon } from 'lucide-react';
import WaveformVisualizer from './WaveformVisualizer';
import { Dialog as BaseDialog, DialogContent as BaseDialogContent, DialogHeader as BaseDialogHeader, DialogTitle as BaseDialogTitle } from '@/components/ui/dialog';
import ProfessionalMixer from './ProfessionalMixer';
import { GridOverlay } from './GridOverlay';
import { TunerModal } from './TunerModal';
import { MTPHeaderContainer } from './MTPHeaderContainer';

interface MidiNote {
  id: string;
  note: string;
  octave: number;
  step: number;
  length: number;
  velocity: number;
}

// ISSUE #3: Region interface for multi-region support
interface AudioRegion {
  id: string;
  audioBuffer: AudioBuffer | null;
  audioUrl: string;
  startTimeSeconds: number; // Position on timeline
  trimStartSeconds: number; // Trim start within buffer
  trimEndSeconds: number; // Trim end within buffer
  fadeInSeconds: number;
  fadeOutSeconds: number;
  regionGain: number; // dB gain for this region
  midiNotes?: MidiNote[]; // For MIDI regions
  color?: string; // Optional override color
}

interface AudioTrack {
  id: string;
  name: string;
  audioBuffer: AudioBuffer | null;
  audioUrl: string;
  volume: number;
  pan: number;
   kind?: string; // track kind for defaults (vocal, drums, etc.)
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  volumePoints?: { time: number; volume: number }[];
  muted: boolean;
  solo: boolean;
  color: string;
  trackType?: 'beat' | 'melody' | 'vocal' | 'audio' | 'midi'; // Track type for tool integration
   sendA?: number;
   sendB?: number;
   regionGain?: number;
  gainNode?: GainNode;
  panNode?: StereoPannerNode;
  sourceNode?: AudioBufferSourceNode;
  origin?: 'store' | 'manual';
  height?: number; // per-track visual height for arranger-style view
  trimStartSeconds?: number; // per-track trim start (seconds, within audioBuffer)
  trimEndSeconds?: number; // per-track trim end (seconds, within audioBuffer)
  midiNotes?: MidiNote[]; // MIDI note data for MIDI tracks
  instrument?: string; // Instrument name for MIDI tracks
  startTimeSeconds?: number; // ISSUE #2: Position on timeline (seconds from start)
  regions?: AudioRegion[]; // ISSUE #3: Multiple regions per track
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

const DEFAULT_TRACK_HEIGHT = 140; // px - enough for controls row

// Helper function to convert AudioBuffer to WAV Blob
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

// Inline waveform component for each track
interface TrackWaveformProps {
  audioBuffer: AudioBuffer | null;
  color: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  height?: number;
  width?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  onTrimChange?: (startSeconds: number, endSeconds: number) => void;
  selected?: boolean;
  onSelect?: () => void;
}

function TrackWaveform({
  audioBuffer,
  color,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  height,
  width,
  trimStartSeconds,
  trimEndSeconds,
  onTrimChange,
  selected,
  onSelect,
}: TrackWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);
  const renderWidth = Math.max(width ?? 600, 240);
  const renderHeight = Math.max(height ?? 64, 48);

  // Draw waveform
  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;
    
    const canvas = canvasRef.current;
    canvas.width = Math.round(renderWidth);
    canvas.height = Math.round(renderHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const data = audioBuffer.getChannelData(0);

    const fullDuration = audioBuffer.duration || duration || 0;
    const effectiveStart = Math.max(0, trimStartSeconds ?? 0);
    const effectiveEnd = Math.min(fullDuration, trimEndSeconds ?? fullDuration);
    const clipDuration = Math.max(0.01, effectiveEnd - effectiveStart);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw waveform background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    for (let i = 0; i < canvasWidth; i++) {
      // Map canvas X to time within trimmed region, then to sample index
      const relTime = effectiveStart + (i / canvasWidth) * clipDuration;
      const sampleIndex = Math.floor((relTime / fullDuration) * data.length);
      const step = Math.max(1, Math.floor(data.length / canvasWidth));
      const sliceStart = sampleIndex;
      const sliceEnd = sliceStart + step;
      let min = 1.0;
      let max = -1.0;

      for (let j = sliceStart; j < sliceEnd && j < data.length; j++) {
        const value = data[j];
        if (value < min) min = value;
        if (value > max) max = value;
      }

      const yMin = ((1 + min) / 2) * canvasHeight;
      const yMax = ((1 + max) / 2) * canvasHeight;

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
      const playheadX = (localTime / clipDuration) * canvasWidth;
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.stroke();
    }
  }, [audioBuffer, color, currentTime, duration, renderHeight, renderWidth, trimEndSeconds, trimStartSeconds]);

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
    onSelect?.();
    seekFromClientX(e.clientX);
  };

  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    onSelect?.();
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
        className={`bg-gray-900 rounded mb-2 flex items-center justify-center ${selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}`}
        style={{ height: renderHeight, width: renderWidth }}
        onClick={() => onSelect?.()}
      >
        <span className="text-xs text-gray-500">No audio data</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`bg-gray-900 rounded mb-2 cursor-pointer relative overflow-hidden ${selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}`}
      style={{ height: renderHeight, width: renderWidth }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleContainerMouseMove}
    >
      <canvas
        ref={canvasRef}
        width={renderWidth}
        height={renderHeight}
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
  const { playNote, initialize } = useAudio();
  
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(80);
  const [masterLimiter, setMasterLimiter] = useState<{ threshold: number; release: number; ceiling: number }>({
    threshold: -1,
    release: 100,
    ceiling: -0.3,
  });
  const [loop, setLoop] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [projectKey, setProjectKey] = useState('C');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [activeSourceTab, setActiveSourceTab] = useState<'library' | 'beatlab' | 'melody' | 'pianoroll'>('library');
  const [punch, setPunch] = useState<{ enabled: boolean; in: number; out: number }>({ enabled: false, in: 0, out: 8 });
  const [waveformEditorTrack, setWaveformEditorTrack] = useState<AudioTrack | null>(null);
  const [waveformAudio, setWaveformAudio] = useState<HTMLAudioElement | null>(null);
  const [renderQuality, setRenderQuality] = useState<'fast' | 'high'>('fast');
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [showTuner, setShowTuner] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [tunerFreq, setTunerFreq] = useState(440);
  const jobPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ISSUE #1: Drag-and-drop track reordering state
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

  // ISSUE #2: Horizontal region dragging state
  const [regionDragTrackId, setRegionDragTrackId] = useState<string | null>(null);
  const [regionDragStartX, setRegionDragStartX] = useState<number>(0);
  const [regionDragOriginalStart, setRegionDragOriginalStart] = useState<number>(0);

  // ISSUE #7: Markers/Locators system
  const [markers, setMarkers] = useState<{ id: string; time: number; label: string; color: string }[]>([]);

  // ISSUE #6: Automation lanes state
  const [showAutomation, setShowAutomation] = useState<Record<string, boolean>>({});
  const [automationType, setAutomationType] = useState<'volume' | 'pan'>('volume');

  // ISSUE #12: Track grouping/folders state
  const [trackGroups, setTrackGroups] = useState<{ id: string; name: string; trackIds: string[]; collapsed: boolean; color: string }[]>([]);

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
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const audioBufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const manualTracksRef = useRef<AudioTrack[]>([]);
  const midiTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  // Store active audio source nodes separately to prevent them from being lost during state updates
  const activeSourcesRef = useRef<Map<string, { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }>>(new Map());
  const trackKindDefaultsRef = useRef<Record<string, string>>({});
  const clipboardTracksRef = useRef<AudioTrack[]>([]);
  const undoStackRef = useRef<AudioTrack[][]>([]);
  const redoStackRef = useRef<AudioTrack[][]>([]);
  const regionIdForTrack = (trackId: string, regionIndex = 0) => `${trackId}-region-${regionIndex}`;
  const regionIdToTrackId = (regionId: string) => regionId.split('-region-')[0];
  const selectedTrackIdSet = useMemo(() => new Set(selectedRegionIds.map(regionIdToTrackId)), [selectedRegionIds]);

  const getTrackEffectiveDuration = (track: AudioTrack): number => {
    const full = track.audioBuffer?.duration || 0;
    const start = Math.max(0, track.trimStartSeconds ?? 0);
    const end = Math.min(full, track.trimEndSeconds ?? full);
    const audioDuration = Math.max(0, end - start);

    if (audioDuration > 0) {
      return audioDuration;
    }

    if (Array.isArray(track.midiNotes) && track.midiNotes.length > 0) {
      const bpm = track.trackType === 'midi' ? (track as any).bpm ?? tempo : tempo;
      const secondsPerBeat = 60 / Math.max(40, Math.min(240, bpm || 120));
      const maxBeats = track.midiNotes.reduce((m, n) => {
        const startBeat = (n.step ?? 0) / 4;
        const durBeat = (n.length ?? 1) / 4;
        return Math.max(m, startBeat + durBeat);
      }, 0);
      return Math.max(0, maxBeats * secondsPerBeat);
    }

    return 0;
  };

  const scheduleMidiTrack = useCallback(async (track: AudioTrack, startOffsetSeconds: number) => {
    if (!Array.isArray(track.midiNotes) || track.midiNotes.length === 0) return;

    try {
      await initialize();
    } catch {
      return;
    }

    const bpm = (track as any).bpm ?? tempo;
    const secondsPerBeat = 60 / Math.max(40, Math.min(240, bpm || 120));
    const instrument = (track.instrument || 'piano').toLowerCase().includes('bass') ? 'bass' : (track.instrument || 'piano');
    const volume = Math.max(0, Math.min(1, (track.volume ?? 80) / 100));

    track.midiNotes.forEach((n) => {
      const startBeat = (n.step ?? 0) / 4;
      const durBeat = (n.length ?? 1) / 4;
      const startSeconds = startBeat * secondsPerBeat;
      const durationSeconds = Math.max(0.02, durBeat * secondsPerBeat);

      const whenMs = (startSeconds - startOffsetSeconds) * 1000;
      if (whenMs < 0) {
        return;
      }

      const timeout = setTimeout(() => {
        if (!isPlayingRef.current) return;
        void playNote(n.note, n.octave, durationSeconds, instrument, volume);
      }, whenMs);
      midiTimeoutsRef.current.push(timeout);
    });
  }, [initialize, isPlayingRef, playNote, tempo]);

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
        const mappedKind =
          type === 'beat'
            ? 'drums'
            : type === 'vocal'
            ? 'vocal'
            : type === 'melody'
            ? 'synth'
            : 'other';
        
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
          sendA: -60,
          sendB: -60,
          regionGain: 0,
          muted: false,
          solo: false,
          color: trackColor,
          trackType: type as 'beat' | 'melody' | 'vocal' | 'audio',
          kind: mappedKind,
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
          kind: storeTrack.kind,
          origin: 'store',
          height: DEFAULT_TRACK_HEIGHT,
          trimStartSeconds: 0,
          trimEndSeconds: audioBuffer ? audioBuffer.duration : 16,
          midiNotes: isMidiTrack ? midiNotes : undefined,
          instrument: instrumentName,
          sendA: typeof (storeTrack as any).sendA === 'number' ? (storeTrack as any).sendA : -60,
          sendB: typeof (storeTrack as any).sendB === 'number' ? (storeTrack as any).sendB : -60,
          regionGain: typeof (storeTrack as any).regionGain === 'number' ? (storeTrack as any).regionGain : 0,
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

    // ISSUE #2: Account for startTimeSeconds when calculating total duration
    const maxDuration = Math.max(
      ...tracks.map(t => (t.startTimeSeconds ?? 0) + getTrackEffectiveDuration(t)),
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
              sendA: -60,
              sendB: -60,
              regionGain: 0,
              muted: false,
              solo: false,
              color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
              trackType: 'vocal',
              kind: 'vocal',
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
      sendA: -60,
      sendB: -60,
      regionGain: 0,
      muted: false,
      solo: false,
      color: type === 'beat' ? '#F59E0B' : type === 'melody' ? '#8B5CF6' : '#10B981',
      trackType: type,
      kind: type === 'beat' ? 'drums' : type === 'vocal' ? 'vocal' : type === 'melody' ? 'synth' : 'other',
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

  const handleOpenBeatLab = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'beatmaker' }));
    setShowAddTrack(false);
    toast({ title: '?? Opening Beat Lab', description: 'Create your beat, then export to Multi-Track' });
  };

  const handleOpenMelody = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'melody' }));
    setShowAddTrack(false);
    toast({ title: '?? Opening Melody Composer', description: 'Create your melody, then export to Multi-Track' });
  };

  const handleOpenPianoRoll = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'unified-studio' }));
    setShowAddTrack(false);
    toast({ title: '?? Opening Piano Roll', description: 'Create your sequence, then export to Multi-Track' });
  };

  // Play all tracks
  const playTracks = () => {
    if (!audioContextRef.current || !masterGainRef.current) return;

    const ctx = audioContextRef.current;
    const hasSolo = tracks.some(t => t.solo);

    // Stop any existing playback
    stopTracks();

    const startOffset = snapEnabled ? snapTime(pauseTimeRef.current) : pauseTimeRef.current;
    const punchStart = punch.enabled ? Math.max(punch.in, startOffset) : startOffset;
    startTimeRef.current = ctx.currentTime - punchStart;

    tracks.forEach(track => {
      const isMidi = track.trackType === 'midi' && Array.isArray(track.midiNotes) && track.midiNotes.length > 0;
      if (!track.audioBuffer && !isMidi) return;

      // Skip if muted or if solo mode and this track isn't soloed
      if (track.muted || (hasSolo && !track.solo)) return;

      // ISSUE #2: Account for track's position on timeline
      const trackStartTime = track.startTimeSeconds ?? 0;

      if (isMidi) {
        // Adjust MIDI scheduling for track start time
        void scheduleMidiTrack(track, punchStart - trackStartTime);
        return;
      }

      if (!track.audioBuffer) return;
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
      
      // ISSUE #2: Calculate when this track should start relative to playhead
      const trackEndTime = trackStartTime + clipDuration;

      // Only loop untrimmed clips for now; trimmed clips play their region once
      source.loop = loop && clipDuration === fullDur;

      // Set pan (volume handled with envelope below)
      panNode.pan.value = track.pan;

      // Connect: source -> gain -> pan -> master -> destination
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(masterGainRef.current!);

      // Store references in both track and ref (ref is the reliable source for cleanup)
      track.sourceNode = source;
      track.gainNode = gainNode;
      track.panNode = panNode;
      activeSourcesRef.current.set(track.id, { source, gain: gainNode, pan: panNode });

      // Start playback within trimmed region
      if (clipDuration <= 0) {
        return;
      }

      // ISSUE #2: Calculate offset relative to track's start position
      const relativeOffset = startOffset - trackStartTime;
      
      // If playhead is before this track starts, schedule it to start later
      if (relativeOffset < 0) {
        // Track starts in the future - schedule it
        const delaySeconds = -relativeOffset;
        const bufferStart = trimStart;
        const playDuration = Math.min(clipDuration, punch.enabled ? punch.out - trackStartTime : clipDuration);
        
        if (playDuration <= 0) return;
        
        const fadeIn = Math.min(track.fadeInSeconds ?? 0, playDuration / 2);
        const fadeOut = loop ? 0 : Math.min(track.fadeOutSeconds ?? 0, Math.max(playDuration - fadeIn - 0.01, 0.01));
        const baseGain = track.volume / 100;
        
        gainNode.gain.setValueAtTime(baseGain, ctx.currentTime + delaySeconds);
        source.start(ctx.currentTime + delaySeconds, bufferStart, playDuration);
        return;
      }

      if (relativeOffset >= clipDuration) {
        // Playback position is past the trimmed region; this track stays silent
        return;
      }

      const bufferStart = trimStart + relativeOffset;
      const stopAt = punch.enabled ? Math.min(globalEnd, punch.out - trackStartTime) : globalEnd;
      const allowedDuration = stopAt - bufferStart;
      const playDuration = Math.max(0, Math.min(clipDuration - relativeOffset, allowedDuration));

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

  // Stop all tracks - use activeSourcesRef to ensure we stop all sources
  const stopTracks = () => {
    midiTimeoutsRef.current.forEach((t) => clearTimeout(t));
    midiTimeoutsRef.current = [];
    
    // Stop all active sources from the ref (this is the reliable source of truth)
    activeSourcesRef.current.forEach(({ source, gain, pan }, trackId) => {
      try {
        source.stop();
        source.disconnect();
        gain.disconnect();
        pan.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    activeSourcesRef.current.clear();
    
    // Also clean up any sourceNode references on tracks (legacy cleanup)
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

  const updateTrackKind = (trackId: string, kind: string) => {
    const defaults = getKindSendDefaults(kind);
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const sendA = t.sendA ?? -60;
        const sendB = t.sendB ?? -60;
        const shouldApplyDefaults = sendA === -60 && sendB === -60;
        return {
          ...t,
          kind,
          sendA: shouldApplyDefaults ? defaults.sendA : sendA,
          sendB: shouldApplyDefaults ? defaults.sendB : sendB,
        };
      })
    );
  };

  const updateTrackSends = (trackId: string, sendA?: number, sendB?: number) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? {
              ...t,
              sendA: typeof sendA === 'number' ? sendA : t.sendA ?? -60,
              sendB: typeof sendB === 'number' ? sendB : t.sendB ?? -60,
            }
          : t
      )
    );
  };

  const updateRegionGain = (trackId: string, gain: number) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, regionGain: gain } : t)));
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
    setSelectedRegionIds((prev) => prev.filter((id) => regionIdToTrackId(id) !== trackId));
    toast({
      title: '🗑️ Track Removed',
      description: 'Track deleted from project',
    });
  };

  // ISSUE #4: Duplicate track
  const duplicateTrack = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    const newTrack: AudioTrack = {
      ...JSON.parse(JSON.stringify(track)),
      id: `${track.id}-copy-${Date.now()}`,
      name: `${track.name} (Copy)`,
      sourceNode: undefined,
      gainNode: undefined,
      panNode: undefined,
    };
    
    setTracks(prev => [...prev, newTrack]);
    toast({
      title: '📋 Track Duplicated',
      description: `Created copy of "${track.name}"`,
    });
  };

  // ISSUE #3: Rename track inline
  const renameTrack = (trackId: string, newName: string) => {
    if (!newName.trim()) return;
    setTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, name: newName.trim() } : t
    ));
  };

  // ISSUE #2: Update track color
  const updateTrackColor = (trackId: string, color: string) => {
    setTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, color } : t
    ));
  };

  // ISSUE #1: Export project to WAV
  const exportProjectToWav = async () => {
    if (tracks.length === 0 || duration <= 0) {
      toast({ title: 'Nothing to export', description: 'Add tracks first', variant: 'destructive' });
      return;
    }
    
    toast({ title: '🎵 Exporting...', description: 'Rendering project to WAV' });
    
    try {
      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
      const masterGain = offlineCtx.createGain();
      masterGain.gain.value = masterVolume / 100;
      masterGain.connect(offlineCtx.destination);
      
      // Render each track
      for (const track of tracks) {
        if (track.muted) continue;
        if (!track.audioBuffer) continue;
        
        const source = offlineCtx.createBufferSource();
        source.buffer = track.audioBuffer;
        
        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = track.volume / 100;
        
        const panNode = offlineCtx.createStereoPanner();
        panNode.pan.value = track.pan;
        
        source.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(masterGain);
        
        const trimStart = track.trimStartSeconds ?? 0;
        const trimEnd = track.trimEndSeconds ?? track.audioBuffer.duration;
        const trackStart = track.startTimeSeconds ?? 0;
        
        source.start(trackStart, trimStart, trimEnd - trimStart);
      }
      
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      const url = URL.createObjectURL(wavBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ title: '✅ Export Complete', description: 'WAV file downloaded' });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Export Failed', description: 'Could not render project', variant: 'destructive' });
    }
  };

  // ISSUE #5: Bounce/Freeze MIDI track to audio
  const bounceTrackToAudio = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    if (track.trackType !== 'midi' || !track.midiNotes?.length) {
      toast({ title: 'Cannot bounce', description: 'Only MIDI tracks can be bounced', variant: 'destructive' });
      return;
    }
    
    toast({ title: '🎹 Bouncing...', description: 'Rendering MIDI to audio' });
    
    try {
      const trackDuration = getTrackEffectiveDuration(track);
      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(1, Math.ceil(trackDuration * sampleRate), sampleRate);
      
      const bpm = tempo;
      const secondsPerBeat = 60 / bpm;
      
      // Simple synth rendering for MIDI notes
      for (const note of track.midiNotes) {
        const noteMap: Record<string, number> = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
        const semitone = noteMap[note.note] ?? 0;
        const midi = (note.octave + 1) * 12 + semitone;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        
        const startTime = (note.step / 4) * secondsPerBeat;
        const duration = Math.max(0.05, (note.length / 4) * secondsPerBeat);
        
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        
        osc.frequency.value = freq;
        osc.type = 'triangle';
        
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
      }
      
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      const audioUrl = URL.createObjectURL(wavBlob);
      
      // Decode the rendered audio
      const arrayBuffer = await wavBlob.arrayBuffer();
      const audioBuffer = await audioContextRef.current?.decodeAudioData(arrayBuffer);
      
      // Update track to audio type
      setTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const updated: AudioTrack = {
          ...t,
          trackType: 'audio',
          audioBuffer: audioBuffer ?? null,
          audioUrl,
          midiNotes: undefined,
          name: `${t.name} (Bounced)`,
        };
        return updated;
      }));
      
      toast({ title: '✅ Bounce Complete', description: 'MIDI track converted to audio' });
    } catch (error) {
      console.error('Bounce error:', error);
      toast({ title: 'Bounce Failed', description: 'Could not render MIDI', variant: 'destructive' });
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const dbToLinear = (db: number) => Math.pow(10, db / 20);

  const getKindSendDefaults = (kind?: string) => {
    switch ((kind || '').toLowerCase()) {
      case 'vocal':
        return { sendA: -14, sendB: -12 };
      case 'drums':
        return { sendA: -18, sendB: -24 };
      case 'bass':
        return { sendA: -24, sendB: -40 };
      case 'synth':
      case 'keys':
        return { sendA: -16, sendB: -18 };
      case 'guitar':
        return { sendA: -18, sendB: -16 };
      case 'fx':
        return { sendA: -12, sendB: -10 };
      default:
        return { sendA: -60, sendB: -60 };
    }
  };

  const buildSessionPayload = () => {
    const sessionTracks = tracks.map((t) => {
      const trackDuration = getTrackEffectiveDuration(t);
      const regionStart = 0;
      const regionEnd = Math.max(trackDuration, (t.trimEndSeconds ?? trackDuration) || 0);
      const regionDuration = Math.max(regionEnd - regionStart, 0);
      const offset = Math.max(0, t.trimStartSeconds ?? 0);
      return {
        id: t.id,
        type: t.trackType === 'midi' ? 'midi' : t.trackType === 'beat' ? 'drums' : 'audio',
        kind: t.kind,
        name: t.name,
        color: t.color,
        regions: [
          {
            id: `${t.id}-region-0`,
            start: regionStart,
            end: regionEnd,
            src: t.audioUrl,
            type: 'audio',
            offset,
            duration: regionDuration,
            stretch: t.trimEndSeconds ? regionDuration / Math.max(regionEnd - regionStart, 0.001) : undefined,
            gain: t.regionGain ?? 0,
          },
        ],
        volume: (t.volume ?? 80) / 100,
        pan: t.pan ?? 0,
        muted: !!t.muted,
        solo: !!t.solo,
        inserts: [
          { type: 'eq', enabled: true, params: {} },
          { type: 'compressor', enabled: true, params: {} },
        ],
        sends: [
          { target: 'reverb', level: dbToLinear(t.sendA ?? -60), preFader: false },
          { target: 'delay', level: dbToLinear(t.sendB ?? -60), preFader: false },
        ],
      };
    });

    return {
      id: 'timeline-session',
      name: 'Timeline Mix',
      bpm: tempo,
      key: projectKey,
      timeSignature,
      loopStart: loop ? 0 : undefined,
      loopEnd: loop ? duration : undefined,
      tracks: sessionTracks,
      masterBus: {
        volume: masterVolume / 100,
        limiter: masterLimiter,
      },
      buses: {
        reverb: { level: 1 },
        delay: { level: 1 },
      },
    };
  };

  const stopPreviewPolling = () => {
    if (jobPollRef.current) {
      clearInterval(jobPollRef.current);
      jobPollRef.current = null;
    }
  };

  const pollJob = (jobId: string, format: string) => {
    stopPreviewPolling();
    jobPollRef.current = setInterval(async () => {
      try {
        const res = await apiRequest('GET', `/api/jobs/${jobId}`);
        const data = await res.json();
        const job = data.job || data?.data || data;
        if (job?.progress !== undefined) setPreviewProgress(job.progress);
        if (job?.status === 'completed') {
          stopPreviewPolling();
          setPreviewStatus('completed');
          setPreviewUrl(`/api/mix/preview/${jobId}/audio.${format}`);
        } else if (job?.status === 'failed') {
          stopPreviewPolling();
          setPreviewStatus('failed');
          toast({
            title: 'Mix preview failed',
            description: job?.error || 'Unknown error',
            variant: 'destructive',
          });
        } else {
          setPreviewStatus(job?.status || 'running');
        }
      } catch (error) {
        console.error('Job polling error', error);
      }
    }, 1500);
  };

  const handleMixPreview = async () => {
    try {
      setPreviewStatus('starting');
      setPreviewProgress(0);
      setPreviewUrl(null);
      const payload = {
        session: buildSessionPayload(),
        renderQuality,
        format: 'mp3',
      };
      const res = await apiRequest('POST', '/api/mix/preview', payload);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Preview start failed');
      }
      const jobId = data.jobId || data.id;
      if (!jobId) {
        throw new Error('No job id returned');
      }
      setPreviewJobId(jobId);
      setPreviewStatus('queued');
      pollJob(jobId, 'mp3');
      toast({ title: 'Mix preview started', description: `Job ${jobId}` });
    } catch (error: any) {
      console.error('Mix preview error', error);
      toast({
        title: 'Mix preview failed to start',
        description: error?.message || 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => () => stopPreviewPolling(), []);

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
          kind: t.type === 'vocal' ? 'vocal' : t.type === 'beat' ? 'drums' : t.type === 'bass' ? 'bass' : 'other',
          sendA: -60,
          sendB: -60,
          regionGain: 0,
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

  const snapTime = (time: number) => {
    if (!snapEnabled) return time;
    const beat = 60 / Math.max(40, Math.min(240, tempo || 120));
    return Math.round(time / beat) * beat;
  };

  const pushUndo = (nextTracks: AudioTrack[]) => {
    undoStackRef.current = [...undoStackRef.current, JSON.parse(JSON.stringify(tracks))].slice(-20);
    redoStackRef.current = [];
    setTracks(nextTracks);
  };

  // Simple metronome tick using current audio context
  useEffect(() => {
    if (!metronomeOn || !isPlaying || !audioContextRef.current) {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
      return;
    }
    const beatMs = (60 / Math.max(40, Math.min(240, tempo || 120))) * 1000;
    metronomeIntervalRef.current = setInterval(() => {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }, beatMs);
    return () => {
      if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    };
  }, [metronomeOn, isPlaying, tempo]);

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

  // Menu handlers
  const handleFullScreen = () => {
    if (!document.fullscreenElement) {
      (document.documentElement as any).requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleNewProject = () => {
    setTracks([]);
    setProjectName('Untitled Project');
    setSelectedRegionIds([]);
    setPreviewUrl(null);
    toast({ title: 'New project created' });
  };

  const handleSaveSession = (asTemplate?: boolean) => {
    const session = buildSessionPayload();
    const payload = { ...session, template: !!asTemplate };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = asTemplate ? `${projectName || 'Session'}-template.cws.json` : `${projectName || 'Session'}.cws.json`;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    try {
      const recentRaw = localStorage.getItem('recentProjects');
      const recent = recentRaw ? JSON.parse(recentRaw) : [];
      const entry = { name, timestamp: Date.now() };
      const next = [entry, ...recent].slice(0, 5);
      localStorage.setItem('recentProjects', JSON.stringify(next));
    } catch { /* ignore */ }
    toast({ title: asTemplate ? 'Template saved' : 'Project saved', description: name });
  };

  const handleLoadSession = async (file?: File) => {
    const inputFile = file;
    if (!inputFile) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.cws.json';
      input.onchange = (e: any) => {
        const f = e.target.files?.[0];
        if (f) handleLoadSession(f);
      };
      input.click();
      return;
    }
    try {
      const text = await inputFile.text();
      const data = JSON.parse(text);
      if (data?.tracks) {
        setTracks([]);
        setProjectName(data.name || inputFile.name.replace(/\.[^/.]+$/, ''));
        setTempo(data.bpm || tempo);
        setProjectKey(data.key || projectKey);
        setTimeSignature(data.timeSignature || timeSignature);
        setMasterLimiter(data.masterBus?.limiter || masterLimiter);
        const restored = (data.tracks as any[]).map((t, idx) => ({
          id: t.id || `track-${idx}`,
          name: t.name || `Track ${idx + 1}`,
          audioBuffer: null,
          audioUrl: t.regions?.[0]?.src || '',
          volume: Math.round((t.volume ?? 0.8) * 100),
          pan: t.pan ?? 0,
          fadeInSeconds: 0,
          fadeOutSeconds: 0,
          volumePoints: [],
          sendA: (t.sends?.a?.level ? Math.round(20 * Math.log10(t.sends.a.level)) : -60),
          sendB: (t.sends?.b?.level ? Math.round(20 * Math.log10(t.sends.b.level)) : -60),
          regionGain: t.regions?.[0]?.gain ?? 0,
          muted: !!t.muted,
          solo: !!t.solo,
          color: TRACK_COLORS[idx % TRACK_COLORS.length],
          trackType: t.type === 'drums' ? 'beat' : t.type === 'midi' ? 'midi' : 'audio',
          kind: t.kind || 'other',
          origin: 'manual',
          height: DEFAULT_TRACK_HEIGHT,
          trimStartSeconds: t.regions?.[0]?.offset || 0,
          trimEndSeconds: t.regions?.[0]?.duration || 0,
        }));
        setTracks(restored as AudioTrack[]);
        toast({ title: 'Project loaded', description: inputFile.name });
      } else {
        toast({ title: 'Invalid project file', variant: 'destructive' });
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to load project', variant: 'destructive' });
    }
  };

  const handleRecentProjects = () => {
    try {
      const recentRaw = localStorage.getItem('recentProjects');
      if (!recentRaw) {
        toast({ title: 'No recent projects' });
        return;
      }
      const recent = JSON.parse(recentRaw);
      const list = recent.map((r: any) => `- ${r.name}`).join('\n');
      toast({ title: 'Recent Projects', description: list || 'None' });
    } catch {
      toast({ title: 'No recent projects' });
    }
  };

  const handleExportAudio = async () => {
    await handleMixPreview();
    toast({ title: 'Export started', description: 'Mix rendering...' });
  };

  const handleExportMIDI = () => {
    exportMidiFile();
  };

  const handleSelectAll = () => {
    setSelectedRegionIds(tracks.map((t) => regionIdForTrack(t.id)));
  };

  const exportMidiFile = () => {
    const midiTracks = tracks.filter((t) => t.trackType === 'midi' && t.midiNotes?.length);
    if (!midiTracks.length) {
      toast({ title: 'No MIDI to export', description: 'Create or import MIDI first.' });
      return;
    }
    // Simple SMF type 0 exporter (single track)
    const notes = midiTracks.flatMap((t) => t.midiNotes || []);
    const events: Array<{ delta: number; bytes: number[] }> = [];
    const noteOn = (delta: number, midi: number, vel: number) => events.push({ delta, bytes: [0x90, midi, vel] });
    const noteOff = (delta: number, midi: number) => events.push({ delta, bytes: [0x80, midi, 0] });
    const ticksPerBeat = 480;
    const beat = 60 / Math.max(40, Math.min(240, tempo || 120));
    const noteToMidi = (note: string | undefined, octave: number | undefined) => {
      if (!note || typeof octave !== 'number') return 60;
      const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const idx = names.indexOf(note.toUpperCase());
      if (idx === -1) return 60;
      return Math.max(0, Math.min(127, (octave + 1) * 12 + idx));
    };
    notes.forEach((n) => {
      const startBeat = (n.step ?? 0) / 4;
      const durBeat = (n.length ?? 1) / 4;
      const startTick = Math.round(startBeat * ticksPerBeat);
      const durTick = Math.max(1, Math.round(durBeat * ticksPerBeat));
      const midi = noteToMidi((n as any).note, (n as any).octave);
      noteOn(startTick, midi, Math.min(127, Math.max(1, n.velocity ?? 100)));
      noteOff(startTick + durTick, midi);
    });
    events.sort((a, b) => a.delta - b.delta);
    // Convert to delta times
    let last = 0;
    const trackBytes: number[] = [];
    const writeVarLen = (val: number) => {
      let buffer = val & 0x7F;
      while ((val >>= 7)) {
        buffer <<= 8;
        buffer |= ((val & 0x7F) | 0x80);
      }
      while (true) {
        trackBytes.push(buffer & 0xFF);
        if (buffer & 0x80) buffer >>= 8;
        else break;
      }
    };
    events.forEach((e) => {
      const delta = e.delta - last;
      writeVarLen(delta);
      trackBytes.push(...e.bytes);
      last = e.delta;
    });
    // End of track
    writeVarLen(0);
    trackBytes.push(0xFF, 0x2F, 0x00);

    // Header chunk
    const header = [
      0x4d, 0x54, 0x68, 0x64, // MThd
      0x00, 0x00, 0x00, 0x06, // header length
      0x00, 0x00, // format 0
      0x00, 0x01, // tracks
      (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF, // division
    ];
    const trackHeader = [
      0x4d, 0x54, 0x72, 0x6b, // MTrk
      (trackBytes.length >> 24) & 0xFF,
      (trackBytes.length >> 16) & 0xFF,
      (trackBytes.length >> 8) & 0xFF,
      trackBytes.length & 0xFF,
    ];
    const all = new Uint8Array([...header, ...trackHeader, ...trackBytes]);
    const blob = new Blob([all], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'session'}.mid`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'MIDI exported', description: 'Saved .mid file' });
  };

  const handleDeselectAll = () => {
    setSelectedRegionIds([]);
  };

  const handleUndo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(JSON.parse(JSON.stringify(tracks)));
    setTracks(prev);
  };

  const handleRedo = () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(JSON.parse(JSON.stringify(tracks)));
    setTracks(next);
  };

  const handleCopy = () => {
    const selected = tracks.filter((t) => selectedTrackIdSet.has(t.id));
    clipboardTracksRef.current = selected.map((t) => JSON.parse(JSON.stringify(t)));
    toast({ title: 'Copied', description: `${clipboardTracksRef.current.length} region(s)` });
  };

  const handleCut = () => {
    const remaining = tracks.filter((t) => !selectedTrackIdSet.has(t.id));
    const selected = tracks.filter((t) => selectedTrackIdSet.has(t.id));
    clipboardTracksRef.current = selected.map((t) => JSON.parse(JSON.stringify(t)));
    pushUndo(remaining);
    setSelectedRegionIds([]);
    toast({ title: 'Cut', description: `${clipboardTracksRef.current.length} region(s)` });
  };

  const handlePaste = () => {
    if (!clipboardTracksRef.current.length) {
      toast({ title: 'Clipboard empty' });
      return;
    }
    const clones = clipboardTracksRef.current.map((t, idx) => ({
      ...t,
      id: `${t.id}-copy-${Date.now()}-${idx}`,
      name: `${t.name} (Copy)`,
    }));
    pushUndo([...tracks, ...clones]);
    toast({ title: 'Pasted', description: `${clones.length} track(s)` });
  };

  const handleDeleteTracks = () => {
    const remaining = tracks.filter((t) => !selectedTrackIdSet.has(t.id));
    pushUndo(remaining);
    setSelectedRegionIds([]);
    toast({ title: 'Deleted', description: 'Selected regions removed' });
  };

  const toggleRegionSelection = (trackId: string) => {
    const regionId = regionIdForTrack(trackId);
    setSelectedRegionIds((prev) =>
      prev.includes(regionId) ? prev.filter((id) => id !== regionId) : [...prev, regionId]
    );
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z * 1.2, 8));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z / 1.2, 0.25));
  const handleFit = () => setZoomLevel(1);

  // ISSUE #6: Automation lane management
  const toggleAutomationLane = (trackId: string) => {
    setShowAutomation((prev) => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  const addAutomationPoint = (trackId: string, time: number, value: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const points = [...(t.volumePoints || [])];
        // Remove existing point at same time
        const filtered = points.filter((p) => Math.abs(p.time - time) > 0.05);
        filtered.push({ time, volume: value });
        filtered.sort((a, b) => a.time - b.time);
        return { ...t, volumePoints: filtered };
      })
    );
  };

  const removeAutomationPoint = (trackId: string, time: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const points = (t.volumePoints || []).filter((p) => Math.abs(p.time - time) > 0.05);
        return { ...t, volumePoints: points };
      })
    );
  };

  // ISSUE #12: Track grouping/folders management
  const createTrackGroup = (name: string, trackIds: string[]) => {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
    const newGroup = {
      id: `group-${Date.now()}`,
      name,
      trackIds,
      collapsed: false,
      color: colors[trackGroups.length % colors.length],
    };
    setTrackGroups((prev) => [...prev, newGroup]);
    toast({ title: 'Group Created', description: `${name} with ${trackIds.length} tracks` });
  };

  const toggleGroupCollapse = (groupId: string) => {
    setTrackGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g))
    );
  };

  const addTrackToGroup = (groupId: string, trackId: string) => {
    setTrackGroups((prev) =>
      prev.map((g) =>
        g.id === groupId && !g.trackIds.includes(trackId)
          ? { ...g, trackIds: [...g.trackIds, trackId] }
          : g
      )
    );
  };

  const removeTrackFromGroup = (groupId: string, trackId: string) => {
    setTrackGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, trackIds: g.trackIds.filter((id) => id !== trackId) } : g
      )
    );
  };

  const deleteTrackGroup = (groupId: string) => {
    setTrackGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  // ISSUE #13: Freeze/Bounce track functionality
  const freezeTrack = async (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track || !audioContextRef.current) {
      toast({ title: 'Cannot Freeze', description: 'Track not found or audio context unavailable', variant: 'destructive' });
      return;
    }

    toast({ title: 'Freezing Track...', description: 'Rendering audio...' });

    try {
      const duration = getTrackEffectiveDuration(track);
      if (duration <= 0) {
        toast({ title: 'Cannot Freeze', description: 'Track has no content', variant: 'destructive' });
        return;
      }

      const sampleRate = 44100;
      const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);

      if (track.audioBuffer) {
        const source = offline.createBufferSource();
        source.buffer = track.audioBuffer;
        const gain = offline.createGain();
        gain.gain.value = track.volume / 100;
        source.connect(gain);
        gain.connect(offline.destination);
        source.start(0, track.trimStartSeconds ?? 0);
      } else if (track.midiNotes && track.midiNotes.length > 0) {
        // Render MIDI to audio using simple oscillators
        const bpm = tempo;
        const secondsPerBeat = 60 / bpm;
        
        track.midiNotes.forEach((n) => {
          const startBeat = (n.step ?? 0) / 4;
          const durBeat = (n.length ?? 1) / 4;
          const startSeconds = startBeat * secondsPerBeat;
          const durationSeconds = Math.max(0.02, durBeat * secondsPerBeat);
          
          const noteMap: Record<string, number> = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
          const semitone = noteMap[n.note] ?? 0;
          const midi = (n.octave + 1) * 12 + semitone;
          const freq = 440 * Math.pow(2, (midi - 69) / 12);
          
          const osc = offline.createOscillator();
          const gain = offline.createGain();
          osc.type = freq < 200 ? 'sawtooth' : 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, startSeconds);
          gain.gain.linearRampToValueAtTime(0.3 * (n.velocity / 127), startSeconds + 0.02);
          gain.gain.setValueAtTime(0.2 * (n.velocity / 127), startSeconds + durationSeconds * 0.7);
          gain.gain.exponentialRampToValueAtTime(0.0001, startSeconds + durationSeconds);
          osc.connect(gain);
          gain.connect(offline.destination);
          osc.start(startSeconds);
          osc.stop(startSeconds + durationSeconds + 0.05);
        });
      }

      const renderedBuffer = await offline.startRendering();
      
      // Update track with frozen audio
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? {
                ...t,
                audioBuffer: renderedBuffer,
                midiNotes: undefined, // Clear MIDI data after freeze
                trackType: 'audio',
              }
            : t
        )
      );

      toast({ title: 'Track Frozen', description: `${track.name} rendered to audio` });
    } catch (error) {
      console.error('Freeze error:', error);
      toast({ title: 'Freeze Failed', description: 'Could not render track', variant: 'destructive' });
    }
  };

  const bounceSelectedTracks = async () => {
    if (selectedRegionIds.length === 0) {
      toast({ title: 'No Selection', description: 'Select tracks to bounce', variant: 'destructive' });
      return;
    }

    toast({ title: 'Bouncing Tracks...', description: 'Mixing selected tracks...' });

    try {
      const selectedTrackIds = selectedRegionIds.map((r) => r.split('-region-')[0]);
      const selectedTracks = tracks.filter((t) => selectedTrackIds.includes(t.id));
      
      if (selectedTracks.length === 0) return;

      const maxDuration = Math.max(...selectedTracks.map((t) => (t.startTimeSeconds ?? 0) + getTrackEffectiveDuration(t)));
      const sampleRate = 44100;
      const offline = new OfflineAudioContext(2, Math.ceil(maxDuration * sampleRate), sampleRate);

      selectedTracks.forEach((track) => {
        if (track.audioBuffer) {
          const source = offline.createBufferSource();
          source.buffer = track.audioBuffer;
          const gain = offline.createGain();
          gain.gain.value = track.volume / 100;
          source.connect(gain);
          gain.connect(offline.destination);
          source.start(track.startTimeSeconds ?? 0, track.trimStartSeconds ?? 0);
        }
      });

      const renderedBuffer = await offline.startRendering();
      // Convert AudioBuffer to WAV blob
      const wavBlob = audioBufferToWav(renderedBuffer);
      const audioUrl = URL.createObjectURL(wavBlob);

      // Create new bounced track
      const bouncedTrack: AudioTrack = {
        id: `bounced-${Date.now()}`,
        name: `Bounced (${selectedTracks.length} tracks)`,
        audioBuffer: renderedBuffer,
        audioUrl,
        volume: 80,
        pan: 0,
        muted: false,
        solo: false,
        color: '#EC4899',
        origin: 'manual',
        height: DEFAULT_TRACK_HEIGHT,
        startTimeSeconds: 0,
      };

      // Remove original tracks and add bounced
      setTracks((prev) => [
        ...prev.filter((t) => !selectedTrackIds.includes(t.id)),
        bouncedTrack,
      ]);

      setSelectedRegionIds([]);
      toast({ title: 'Tracks Bounced', description: `${selectedTracks.length} tracks mixed into one` });
    } catch (error) {
      console.error('Bounce error:', error);
      toast({ title: 'Bounce Failed', description: 'Could not mix tracks', variant: 'destructive' });
    }
  };

  // ISSUE #10: Zoom to selection
  const handleZoomToSelection = () => {
    if (selectedRegionIds.length === 0) {
      toast({ title: 'No Selection', description: 'Select a region first to zoom to it' });
      return;
    }

    // Find the time range of selected regions
    let minTime = Infinity;
    let maxTime = 0;

    selectedRegionIds.forEach((regionId) => {
      const trackId = regionId.split('-region-')[0];
      const track = tracks.find((t) => t.id === trackId);
      if (track) {
        const start = track.startTimeSeconds ?? 0;
        const end = start + getTrackEffectiveDuration(track);
        minTime = Math.min(minTime, start);
        maxTime = Math.max(maxTime, end);
      }
    });

    if (minTime === Infinity || maxTime === 0) return;

    // Calculate zoom level to fit selection in view (assuming ~800px visible width)
    const selectionDuration = maxTime - minTime;
    const targetWidth = 800; // Approximate visible width
    const pxPerSecond = targetWidth / Math.max(selectionDuration, 1);
    const newZoom = pxPerSecond / 120; // 120 is base pxPerSecond

    setZoomLevel(Math.max(0.25, Math.min(8, newZoom)));
    
    // Scroll to selection start
    pauseTimeRef.current = minTime;
    setCurrentTime(minTime);
    
    toast({ title: 'Zoomed to Selection', description: `${minTime.toFixed(1)}s - ${maxTime.toFixed(1)}s` });
  };

  // ISSUE #1: Drag-and-drop track reordering handlers
  const handleTrackDragStart = (e: React.DragEvent, trackId: string) => {
    setDraggedTrackId(trackId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', trackId);
  };

  const handleTrackDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTrackId && trackId !== draggedTrackId) {
      setDragOverTrackId(trackId);
    }
  };

  const handleTrackDragLeave = () => {
    setDragOverTrackId(null);
  };

  const handleTrackDrop = (e: React.DragEvent, targetTrackId: string) => {
    e.preventDefault();
    if (!draggedTrackId || draggedTrackId === targetTrackId) {
      setDraggedTrackId(null);
      setDragOverTrackId(null);
      return;
    }

    setTracks((prev) => {
      const draggedIndex = prev.findIndex((t) => t.id === draggedTrackId);
      const targetIndex = prev.findIndex((t) => t.id === targetTrackId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newTracks = [...prev];
      const [draggedTrack] = newTracks.splice(draggedIndex, 1);
      newTracks.splice(targetIndex, 0, draggedTrack);
      return newTracks;
    });

    setDraggedTrackId(null);
    setDragOverTrackId(null);
    toast({ title: 'Track Reordered', description: 'Drag tracks to rearrange order' });
  };

  const handleTrackDragEnd = () => {
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  };

  // ISSUE #2: Horizontal region dragging handlers
  const handleRegionMouseDown = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    setRegionDragTrackId(trackId);
    setRegionDragStartX(e.clientX);
    setRegionDragOriginalStart(track.startTimeSeconds ?? 0);
  };

  const handleRegionMouseMove = (e: React.MouseEvent) => {
    if (!regionDragTrackId) return;
    const pxPerSecond = 120 * zoomLevel;
    const deltaX = e.clientX - regionDragStartX;
    const deltaSeconds = deltaX / pxPerSecond;
    let newStart = regionDragOriginalStart + deltaSeconds;
    
    // Snap to grid if enabled
    if (snapEnabled) {
      newStart = snapTime(newStart);
    }
    newStart = Math.max(0, newStart);
    
    setTracks((prev) =>
      prev.map((t) =>
        t.id === regionDragTrackId ? { ...t, startTimeSeconds: newStart } : t
      )
    );
  };

  const handleRegionMouseUp = () => {
    if (regionDragTrackId) {
      setRegionDragTrackId(null);
    }
  };

  // Update track start time directly
  const updateTrackStartTime = (trackId: string, startTime: number) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, startTimeSeconds: Math.max(0, startTime) } : t
      )
    );
  };

  // ISSUE #3: Multi-region management functions
  const addRegionToTrack = (trackId: string, region: Omit<AudioRegion, 'id'>) => {
    const newRegion: AudioRegion = {
      ...region,
      id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, regions: [...(t.regions || []), newRegion] }
          : t
      )
    );
    return newRegion.id;
  };

  const removeRegionFromTrack = (trackId: string, regionId: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, regions: (t.regions || []).filter((r) => r.id !== regionId) }
          : t
      )
    );
  };

  const duplicateRegion = (trackId: string, regionId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    const region = track?.regions?.find((r) => r.id === regionId);
    if (!region) return;

    const duration = (region.trimEndSeconds || 0) - (region.trimStartSeconds || 0);
    const newRegion: AudioRegion = {
      ...region,
      id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTimeSeconds: region.startTimeSeconds + duration + 0.1, // Place after original
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, regions: [...(t.regions || []), newRegion] }
          : t
      )
    );
    toast({ title: 'Region Duplicated', description: 'New region placed after original' });
  };

  const updateRegion = (trackId: string, regionId: string, updates: Partial<AudioRegion>) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? {
              ...t,
              regions: (t.regions || []).map((r) =>
                r.id === regionId ? { ...r, ...updates } : r
              ),
            }
          : t
      )
    );
  };

  // ISSUE #4: Split/Slice tool - splits a region at the current playhead position
  const splitRegionAtPlayhead = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;

    const splitTime = currentTime;
    const trackStart = track.startTimeSeconds ?? 0;
    const trackDuration = getTrackEffectiveDuration(track);
    const trackEnd = trackStart + trackDuration;

    // Check if playhead is within this track's region
    if (splitTime <= trackStart || splitTime >= trackEnd) {
      toast({ title: 'Cannot Split', description: 'Playhead must be within the region to split', variant: 'destructive' });
      return;
    }

    const relativeTime = splitTime - trackStart;
    const trimStart = track.trimStartSeconds ?? 0;
    const trimEnd = track.trimEndSeconds ?? (track.audioBuffer?.duration ?? 16);

    // Create two regions from the split
    const region1: AudioRegion = {
      id: `region-${Date.now()}-left`,
      audioBuffer: track.audioBuffer,
      audioUrl: track.audioUrl,
      startTimeSeconds: trackStart,
      trimStartSeconds: trimStart,
      trimEndSeconds: trimStart + relativeTime,
      fadeInSeconds: track.fadeInSeconds ?? 0.05,
      fadeOutSeconds: 0.01, // Small fade at split point
      regionGain: track.regionGain ?? 0,
      midiNotes: track.midiNotes?.filter((n) => (n.step / 4) * (60 / tempo) < relativeTime),
    };

    const region2: AudioRegion = {
      id: `region-${Date.now()}-right`,
      audioBuffer: track.audioBuffer,
      audioUrl: track.audioUrl,
      startTimeSeconds: splitTime,
      trimStartSeconds: trimStart + relativeTime,
      trimEndSeconds: trimEnd,
      fadeInSeconds: 0.01, // Small fade at split point
      fadeOutSeconds: track.fadeOutSeconds ?? 0.1,
      regionGain: track.regionGain ?? 0,
      midiNotes: track.midiNotes?.filter((n) => (n.step / 4) * (60 / tempo) >= relativeTime),
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, regions: [region1, region2], audioBuffer: null, midiNotes: undefined }
          : t
      )
    );

    toast({ title: 'Region Split', description: `Split at ${splitTime.toFixed(2)}s` });
  };

  // Split at a specific time (for context menu or keyboard shortcut)
  const splitRegionAtTime = (trackId: string, splitTime: number) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;

    const trackStart = track.startTimeSeconds ?? 0;
    const trackDuration = getTrackEffectiveDuration(track);
    const trackEnd = trackStart + trackDuration;

    if (splitTime <= trackStart || splitTime >= trackEnd) {
      return; // Invalid split point
    }

    const relativeTime = splitTime - trackStart;
    const trimStart = track.trimStartSeconds ?? 0;
    const trimEnd = track.trimEndSeconds ?? (track.audioBuffer?.duration ?? 16);

    const region1: AudioRegion = {
      id: `region-${Date.now()}-left`,
      audioBuffer: track.audioBuffer,
      audioUrl: track.audioUrl,
      startTimeSeconds: trackStart,
      trimStartSeconds: trimStart,
      trimEndSeconds: trimStart + relativeTime,
      fadeInSeconds: track.fadeInSeconds ?? 0.05,
      fadeOutSeconds: 0.01,
      regionGain: track.regionGain ?? 0,
    };

    const region2: AudioRegion = {
      id: `region-${Date.now()}-right`,
      audioBuffer: track.audioBuffer,
      audioUrl: track.audioUrl,
      startTimeSeconds: splitTime,
      trimStartSeconds: trimStart + relativeTime,
      trimEndSeconds: trimEnd,
      fadeInSeconds: 0.01,
      fadeOutSeconds: track.fadeOutSeconds ?? 0.1,
      regionGain: track.regionGain ?? 0,
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, regions: [region1, region2], audioBuffer: null }
          : t
      )
    );
  };

  // ISSUE #7: Markers/Locators management functions
  const addMarker = (time?: number, label?: string) => {
    const markerTime = time ?? currentTime;
    const markerLabel = label ?? `Marker ${markers.length + 1}`;
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const newMarker = {
      id: `marker-${Date.now()}`,
      time: markerTime,
      label: markerLabel,
      color: colors[markers.length % colors.length],
    };
    setMarkers((prev) => [...prev, newMarker].sort((a, b) => a.time - b.time));
    toast({ title: 'Marker Added', description: `${markerLabel} at ${markerTime.toFixed(2)}s` });
  };

  const removeMarker = (markerId: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== markerId));
  };

  const updateMarkerLabel = (markerId: string, newLabel: string) => {
    setMarkers((prev) =>
      prev.map((m) => (m.id === markerId ? { ...m, label: newLabel } : m))
    );
  };

  const jumpToMarker = (markerId: string) => {
    const marker = markers.find((m) => m.id === markerId);
    if (marker) {
      pauseTimeRef.current = marker.time;
      setCurrentTime(marker.time);
      if (isPlaying) {
        stopTracks();
        playTracks();
      }
    }
  };

  const jumpToNextMarker = () => {
    const nextMarker = markers.find((m) => m.time > currentTime + 0.1);
    if (nextMarker) {
      jumpToMarker(nextMarker.id);
    }
  };

  const jumpToPrevMarker = () => {
    const prevMarkers = markers.filter((m) => m.time < currentTime - 0.1);
    if (prevMarkers.length > 0) {
      jumpToMarker(prevMarkers[prevMarkers.length - 1].id);
    }
  };

  // ISSUE #8: Click-to-seek on timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pxPerSecond = 120 * zoomLevel;
    let seekTime = clickX / pxPerSecond;
    
    if (snapEnabled) {
      seekTime = snapTime(seekTime);
    }
    seekTime = Math.max(0, Math.min(seekTime, duration));
    
    pauseTimeRef.current = seekTime;
    setCurrentTime(seekTime);
    
    if (isPlaying) {
      stopTracks();
      playTracks();
    }
  };

  // ISSUE #9: Comprehensive keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();

      // Space: Play/Pause
      if (key === ' ') {
        e.preventDefault();
        if (isPlaying) pausePlayback();
        else playTracks();
        return;
      }

      // S: Split selected track at playhead
      if (key === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const selectedTrackId = selectedRegionIds[0]?.split('-region-')[0];
        if (selectedTrackId) {
          splitRegionAtPlayhead(selectedTrackId);
        }
        return;
      }

      // M: Add marker at playhead
      if (key === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        addMarker();
        return;
      }

      // Delete/Backspace: Delete selected
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        handleDeleteTracks();
        return;
      }

      // Arrow keys: Nudge playhead
      if (key === 'arrowleft') {
        e.preventDefault();
        const nudge = e.shiftKey ? 1 : 0.1;
        pauseTimeRef.current = Math.max(0, currentTime - nudge);
        setCurrentTime(pauseTimeRef.current);
        return;
      }
      if (key === 'arrowright') {
        e.preventDefault();
        const nudge = e.shiftKey ? 1 : 0.1;
        pauseTimeRef.current = Math.min(duration, currentTime + nudge);
        setCurrentTime(pauseTimeRef.current);
        return;
      }

      // Home: Go to start
      if (key === 'home') {
        e.preventDefault();
        pauseTimeRef.current = 0;
        setCurrentTime(0);
        return;
      }

      // End: Go to end
      if (key === 'end') {
        e.preventDefault();
        pauseTimeRef.current = duration;
        setCurrentTime(duration);
        return;
      }

      // [ and ]: Jump to prev/next marker
      if (key === '[') {
        e.preventDefault();
        jumpToPrevMarker();
        return;
      }
      if (key === ']') {
        e.preventDefault();
        jumpToNextMarker();
        return;
      }

      // +/-: Zoom in/out
      if (key === '=' || key === '+') {
        e.preventDefault();
        handleZoomIn();
        return;
      }
      if (key === '-') {
        e.preventDefault();
        handleZoomOut();
        return;
      }

      // G: Toggle grid
      if (key === 'g') {
        e.preventDefault();
        setShowGrid((g) => !g);
        return;
      }

      // N: Toggle snap
      if (key === 'n') {
        e.preventDefault();
        setSnapEnabled((s) => !s);
        toast({ title: snapEnabled ? 'Snap Off' : 'Snap On' });
        return;
      }

      // L: Toggle loop
      if (key === 'l') {
        e.preventDefault();
        setLoop((l) => !l);
        return;
      }

      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+C: Copy
      if ((e.ctrlKey || e.metaKey) && key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Ctrl+X: Cut
      if ((e.ctrlKey || e.metaKey) && key === 'x') {
        e.preventDefault();
        handleCut();
        return;
      }

      // Ctrl+V: Paste
      if ((e.ctrlKey || e.metaKey) && key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Ctrl+A: Select all
      if ((e.ctrlKey || e.metaKey) && key === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Ctrl+S: Save
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        handleSaveSession(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration, selectedRegionIds, snapEnabled, markers]);

  // ISSUE #5: Calculate crossfade between overlapping regions
  const calculateCrossfade = (region1: AudioRegion, region2: AudioRegion): { fadeOut: number; fadeIn: number } => {
    const end1 = region1.startTimeSeconds + (region1.trimEndSeconds - region1.trimStartSeconds);
    const start2 = region2.startTimeSeconds;
    const overlap = Math.max(0, end1 - start2);
    
    if (overlap > 0) {
      // Apply equal-power crossfade
      const crossfadeDuration = Math.min(overlap, 0.5); // Max 500ms crossfade
      return { fadeOut: crossfadeDuration, fadeIn: crossfadeDuration };
    }
    return { fadeOut: region1.fadeOutSeconds, fadeIn: region2.fadeInSeconds };
  };

  // Apply crossfade to overlapping regions in a track
  const applyCrossfades = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track?.regions || track.regions.length < 2) return;

    const sortedRegions = [...track.regions].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    const updatedRegions = sortedRegions.map((region, idx) => {
      if (idx === sortedRegions.length - 1) return region;
      
      const nextRegion = sortedRegions[idx + 1];
      const { fadeOut } = calculateCrossfade(region, nextRegion);
      return { ...region, fadeOutSeconds: fadeOut };
    });

    // Apply fade-ins
    const finalRegions = updatedRegions.map((region, idx) => {
      if (idx === 0) return region;
      
      const prevRegion = updatedRegions[idx - 1];
      const { fadeIn } = calculateCrossfade(prevRegion, region);
      return { ...region, fadeInSeconds: fadeIn };
    });

    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, regions: finalRegions } : t))
    );
    toast({ title: 'Crossfades Applied', description: 'Overlapping regions now have smooth transitions' });
  };

  // Convert legacy single-region track to multi-region format
  const migrateTrackToRegions = (track: AudioTrack): AudioRegion[] => {
    if (track.regions && track.regions.length > 0) {
      return track.regions;
    }
    // Create a single region from the track's current data
    if (track.audioBuffer || (track.midiNotes && track.midiNotes.length > 0)) {
      return [{
        id: `region-${track.id}-0`,
        audioBuffer: track.audioBuffer,
        audioUrl: track.audioUrl,
        startTimeSeconds: track.startTimeSeconds ?? 0,
        trimStartSeconds: track.trimStartSeconds ?? 0,
        trimEndSeconds: track.trimEndSeconds ?? (track.audioBuffer?.duration ?? 16),
        fadeInSeconds: track.fadeInSeconds ?? 0.05,
        fadeOutSeconds: track.fadeOutSeconds ?? 0.1,
        regionGain: track.regionGain ?? 0,
        midiNotes: track.midiNotes,
      }];
    }
    return [];
  };

  const handleQuantize = () => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.trackType !== 'midi' || !t.midiNotes?.length || (selectedRegionIds.length && !selectedTrackIdSet.has(t.id))) return t;
        const snapped = t.midiNotes.map((n) => {
          const start = snapTime((n.step || 0) * 0.1);
          const len = Math.max(0.05, snapTime(n.length || 0.1));
          return { ...n, step: start / 0.1, length: len / 0.1 };
        });
        return { ...t, midiNotes: snapped };
      })
    );
    toast({ title: 'Quantized', description: 'MIDI notes snapped to grid.' });
  };

  const handleTranspose = (semitones: number = 2) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.trackType !== 'midi' || !t.midiNotes?.length || (selectedRegionIds.length && !selectedTrackIdSet.has(t.id))) return t;
        const shifted = t.midiNotes.map((n) => {
          // Transpose by adjusting octave (12 semitones = 1 octave)
          const octaveShift = Math.floor(semitones / 12);
          const noteShift = semitones % 12;
          const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const currentNoteIndex = notes.indexOf(n.note.replace(/\d+$/, ''));
          if (currentNoteIndex === -1) return n;
          let newNoteIndex = currentNoteIndex + noteShift;
          let newOctave = n.octave + octaveShift;
          if (newNoteIndex >= 12) { newNoteIndex -= 12; newOctave++; }
          if (newNoteIndex < 0) { newNoteIndex += 12; newOctave--; }
          return { ...n, note: notes[newNoteIndex], octave: newOctave };
        });
        return { ...t, midiNotes: shifted };
      })
    );
    toast({ title: 'Transposed', description: `MIDI shifted by ${semitones} semitones.` });
  };

  const handleTimeStretch = (factor: number = 1.1) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (!t.midiNotes?.length || (selectedRegionIds.length && !selectedTrackIdSet.has(t.id))) return t;
        const stretched = t.midiNotes.map((n) => ({ ...n, length: (n.length || 1) * factor }));
        return { ...t, midiNotes: stretched };
      })
    );
    toast({ title: 'Time-stretched', description: `Notes length x${factor}` });
  };

  const handleProjectSettings = () => {
    setShowProjectSettingsModal(true);
  };

  const handleAbout = () => {
    toast({
      title: 'CodedSwitch Studio',
      description: 'Timeline+Mixer build with mix/export, grid, snap, and project save/load.',
    });
  };

  const pxPerSecond = 120 * zoomLevel;
  const baseDurationSeconds = duration > 0 ? duration : 8;
  const timelineWidth = Math.max(baseDurationSeconds * pxPerSecond, 640);
  const recordingTimeLabel = formatTime(recordingTime);
  const menuHandlers = {
    onNewProject: handleNewProject,
    onLoadProject: () => handleLoadSession(),
    onSaveProject: () => handleSaveSession(false),
    onSaveAs: () => handleSaveSession(false),
    onSaveTemplate: () => handleSaveSession(true),
    onRecentProjects: handleRecentProjects,
    onImportAudio: () => setShowAddTrack(true),
    onExportAudio: handleExportAudio,
    onExportMIDI: handleExportMIDI,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCut: handleCut,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDelete: handleDeleteTracks,
    onSelectAll: handleSelectAll,
    onDeselectAll: handleDeselectAll,
    onShowPreferences: () => toast({ title: 'Preferences', description: 'Use Project Settings for audio preferences.' }),
    onShowProjectSettings: handleProjectSettings,
    onShowKeyboardShortcuts: () => toast({ title: 'Keyboard Shortcuts', description: 'Space: Play/Pause | Ctrl+S: Save | Ctrl+Z: Undo | Ctrl+Y: Redo | Del: Delete | G: Grid | M: Metronome' }),
    onResetLayout: handleFit,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitToWindow: handleFit,
    onToggleGrid: () => setShowGrid((g) => !g),
    onToggleSnap: () => setSnapEnabled((s) => !s),
    onToggleFullScreen: handleFullScreen,
    onToggleMetronome: () => setMetronomeOn((m) => !m),
    onShowTuner: () => setShowTuner(true),
    onQuantize: handleQuantize,
    onTranspose: () => handleTranspose(2),
    onTimeStretch: () => handleTimeStretch(1.1),
    onAbout: handleAbout,
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white overflow-hidden">
      <MTPHeaderContainer
        tempo={tempo}
        setTempo={setTempo}
        projectName={projectName}
        setProjectName={setProjectName}
        projectKey={projectKey}
        setProjectKey={setProjectKey}
        timeSignature={timeSignature}
        setTimeSignature={setTimeSignature}
        metronomeOn={metronomeOn}
        setMetronomeOn={setMetronomeOn}
        isRecording={isRecording}
        recordingTimeLabel={recordingTimeLabel}
        startRecording={startRecording}
        stopRecording={stopRecording}
        showMixer={showMixer}
        onToggleMixer={() => setShowMixer((v) => !v)}
        handleFileUpload={handleFileUpload}
        applyTemplate={applyTemplate}
        showAddTrack={showAddTrack}
        setShowAddTrack={setShowAddTrack}
        activeSourceTab={activeSourceTab}
        setActiveSourceTab={setActiveSourceTab}
        librarySongs={librarySongs}
        loadFromLibrary={(song) => {
          loadFromLibrary(song);
          setShowLibrary(false);
        }}
        onAddEmptyTrack={addEmptyTrack}
        onOpenBeatLab={handleOpenBeatLab}
        onOpenMelody={handleOpenMelody}
        onOpenPianoRoll={handleOpenPianoRoll}
        menuHandlers={menuHandlers}
      />

      {/* Transport Controls */}
      <div className="bg-gray-850 border-b border-gray-700 px-4 py-2">
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
        <div className="mt-4 overflow-auto">
          <div className="bg-gray-900 rounded h-2 relative overflow-hidden" style={{ minWidth: `${timelineWidth}px` }}>
            <div
              className="absolute top-0 left-0 h-full bg-blue-500"
              style={{ width: `${duration > 0 ? Math.min(currentTime / duration, 1) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Mix Preview & Master - Compact bar */}
      <div className="px-4 py-2 bg-gray-900 border-t border-b border-gray-800 flex flex-wrap items-center gap-3">
        <Button className="bg-blue-600 hover:bg-blue-500" onClick={handleMixPreview}>
          <Wand2 className="w-4 h-4 mr-2" />
          Mix Preview
        </Button>
        <Button className="bg-green-600 hover:bg-green-500" onClick={exportProjectToWav}>
          <Music className="w-4 h-4 mr-2" />
          Export WAV
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Quality</span>
          <Select value={renderQuality} onValueChange={(v: any) => setRenderQuality(v)}>
            <SelectTrigger className="w-28 bg-gray-800 border-gray-700 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fast">Fast</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <span>Status:</span>
          <span className={previewStatus === 'failed' ? 'text-red-400' : 'text-blue-300'}>
            {previewStatus || 'idle'}
          </span>
          {previewProgress > 0 && previewProgress < 100 && (
            <span className="text-gray-400">{Math.round(previewProgress)}%</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-300">
          <span>Limiter</span>
          <span>Thresh</span>
          <Input
            type="number"
            className="w-16 h-8 bg-gray-800 border-gray-700 text-xs"
            value={masterLimiter.threshold}
            onChange={(e) => setMasterLimiter((p) => ({ ...p, threshold: Number(e.target.value) }))}
          />
          <span>Release</span>
          <Input
            type="number"
            className="w-16 h-8 bg-gray-800 border-gray-700 text-xs"
            value={masterLimiter.release}
            onChange={(e) => setMasterLimiter((p) => ({ ...p, release: Number(e.target.value) }))}
          />
          <span>Ceiling</span>
          <Input
            type="number"
            className="w-16 h-8 bg-gray-800 border-gray-700 text-xs"
            value={masterLimiter.ceiling}
            onChange={(e) => setMasterLimiter((p) => ({ ...p, ceiling: Number(e.target.value) }))}
          />
        </div>
        {previewUrl && (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span>Preview:</span>
            <audio controls src={previewUrl} className="w-64" />
          </div>
        )}
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-auto min-h-[200px]">
        <div className="relative px-4" style={{ minWidth: `${timelineWidth}px` }}>
          <GridOverlay duration={duration || baseDurationSeconds} zoom={zoomLevel} showGrid={showGrid} timelineWidth={timelineWidth} />
          {tracks.length === 0 ? (
            <div className="h-full flex items-center justify-center py-16 relative z-10">
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
            <div className="space-y-3 relative z-10 pt-8">
            {tracks.map((track, index) => {
              const regionId = regionIdForTrack(track.id);
              const isRegionSelected = selectedRegionIds.includes(regionId);
              const clipDuration = Math.max(getTrackEffectiveDuration(track), baseDurationSeconds / 2);
              const regionWidth = Math.max(clipDuration * pxPerSecond, 220);
              const laneWidth = Math.max(timelineWidth, regionWidth);
              return (
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
                  <div 
                    style={{ height: (track.height ?? DEFAULT_TRACK_HEIGHT) + 32, minWidth: `${laneWidth}px` }}
                    draggable
                    onDragStart={(e) => handleTrackDragStart(e, track.id)}
                    onDragOver={(e) => handleTrackDragOver(e, track.id)}
                    onDragLeave={handleTrackDragLeave}
                    onDrop={(e) => handleTrackDrop(e, track.id)}
                    onDragEnd={handleTrackDragEnd}
                  >
                    <Card
                      className={`bg-gray-800 border ${isRegionSelected ? 'border-blue-500 ring-2 ring-blue-400' : dragOverTrackId === track.id ? 'border-green-500 ring-2 ring-green-400' : 'border-gray-700'} ${draggedTrackId === track.id ? 'opacity-50' : ''} relative overflow-hidden h-full transition-all`}
                    >
                    <CardContent className="p-4 h-full flex flex-col">
                      <div className="flex items-center gap-4 flex-1">
                        {/* ISSUE #1: Drag handle for track reordering */}
                        <div
                          className="w-6 h-full flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-gray-700/50 rounded transition-colors"
                          title="Drag to reorder track"
                        >
                          <GripVertical className="w-4 h-4 text-gray-500" />
                        </div>
                        {/* Track color stripe */}
                        <div
                          className="w-2 h-full rounded"
                          style={{ backgroundColor: track.color }}
                        />

                        <div className="flex-1 flex flex-col gap-2">
                          {/* Header with name + delete */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold cursor-pointer" onClick={() => toggleRegionSelection(track.id)}>{track.name}</h4>
                              <Select
                                value={track.kind || ''}
                                onValueChange={(v) => updateTrackKind(track.id, v)}
                              >
                                <SelectTrigger className="w-32 h-8 bg-gray-800 border-gray-700 text-xs">
                                  <SelectValue placeholder="Kind" />
                                </SelectTrigger>
                                <SelectContent>
                                  {['vocal','drums','bass','synth','guitar','keys','fx','other'].map((k) => (
                                    <SelectItem key={k} value={k}>{k}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* ISSUE #4: Split button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => splitRegionAtPlayhead(track.id)}
                              title="Split at playhead (S)"
                            >
                              <Scissors className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => duplicateTrack(track.id)}
                              title="Duplicate track"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            {track.trackType === 'midi' && track.midiNotes?.length && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => bounceTrackToAudio(track.id)}
                                title="Bounce MIDI to audio"
                              >
                                <Wand2 className="w-4 h-4" />
                              </Button>
                            )}
                            <input
                              type="color"
                              value={track.color}
                              onChange={(e) => updateTrackColor(track.id, e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0"
                              title="Change track color"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTrack(track.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Waveform, MIDI notes, or empty state - ISSUE #2: positioned with startTimeSeconds */}
                          {track.audioBuffer ? (
                            <div 
                              className="relative" 
                              style={{ minWidth: `${laneWidth}px` }}
                              onMouseMove={handleRegionMouseMove}
                              onMouseUp={handleRegionMouseUp}
                              onMouseLeave={handleRegionMouseUp}
                            >
                              <div
                                className={`absolute cursor-move ${regionDragTrackId === track.id ? 'opacity-80' : ''}`}
                                style={{ 
                                  left: `${(track.startTimeSeconds ?? 0) * pxPerSecond}px`,
                                  width: `${regionWidth}px`
                                }}
                                onMouseDown={(e) => handleRegionMouseDown(e, track.id)}
                              >
                                <TrackWaveform
                                  audioBuffer={track.audioBuffer}
                                  color={track.color}
                                  currentTime={currentTime - (track.startTimeSeconds ?? 0)}
                                  duration={track.audioBuffer?.duration || 0}
                                  isPlaying={isPlaying}
                                  height={track.height ?? DEFAULT_TRACK_HEIGHT}
                                  width={regionWidth}
                                  selected={isRegionSelected}
                                  onSelect={() => toggleRegionSelection(track.id)}
                                  onSeek={(time) => {
                                    pauseTimeRef.current = time + (track.startTimeSeconds ?? 0);
                                    setCurrentTime(time + (track.startTimeSeconds ?? 0));
                                    if (isPlaying) {
                                      stopTracks();
                                      playTracks();
                                    }
                                  }}
                                />
                                {/* Start time indicator */}
                                <div className="absolute -top-5 left-0 text-[10px] text-gray-400 bg-gray-800 px-1 rounded">
                                  {(track.startTimeSeconds ?? 0).toFixed(1)}s
                                </div>
                              </div>
                            </div>
                          ) : track.midiNotes && track.midiNotes.length > 0 ? (
                            <div
                              className="relative"
                              style={{ minWidth: `${laneWidth}px` }}
                              onMouseMove={handleRegionMouseMove}
                              onMouseUp={handleRegionMouseUp}
                              onMouseLeave={handleRegionMouseUp}
                            >
                              <div
                                className={`absolute bg-gray-900 rounded overflow-x-auto cursor-move ${isRegionSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''} ${regionDragTrackId === track.id ? 'opacity-80' : ''}`}
                                style={{ 
                                  height: track.height ?? DEFAULT_TRACK_HEIGHT, 
                                  left: `${(track.startTimeSeconds ?? 0) * pxPerSecond}px`,
                                  width: `${regionWidth}px`
                                }}
                                onClick={() => toggleRegionSelection(track.id)}
                                onMouseDown={(e) => handleRegionMouseDown(e, track.id)}
                              >
                                {/* ISSUE #11: Improved MIDI visualization with velocity colors and piano roll style */}
                                <div className="relative h-full" style={{ width: `${regionWidth}px` }}>
                                  {/* Mini piano roll background */}
                                  <div className="absolute inset-0 opacity-20">
                                    {[0, 1, 2, 3, 4, 5, 6, 7].map((octave) => (
                                      <div key={octave} className="absolute w-full h-3 border-b border-gray-700" style={{ top: `${octave * 12}%` }} />
                                    ))}
                                  </div>
                                  {track.midiNotes.map((note) => {
                                    // ISSUE #11: Velocity-based color intensity
                                    const velocity = note.velocity ?? 100;
                                    const intensity = Math.max(0.3, velocity / 127);
                                    const hue = velocity > 100 ? 120 : velocity > 70 ? 80 : velocity > 40 ? 45 : 0; // Green -> Yellow -> Orange -> Red
                                    const noteHeight = Math.max(16, (track.height ?? DEFAULT_TRACK_HEIGHT) / 8);
                                    // Position based on octave (higher octave = higher on screen)
                                    const noteY = Math.max(4, ((7 - note.octave) / 8) * (track.height ?? DEFAULT_TRACK_HEIGHT));
                                    
                                    return (
                                      <div
                                        key={note.id}
                                        className="absolute rounded text-[10px] flex items-center justify-center text-white font-medium shadow-sm transition-all hover:scale-105 hover:z-10"
                                        style={{
                                          left: `${note.step * 12 * zoomLevel}px`,
                                          width: `${Math.max((note.length || 4) * 12 * zoomLevel - 2, 20)}px`,
                                          height: `${noteHeight}px`,
                                          top: `${noteY}px`,
                                          backgroundColor: `hsla(${hue}, 70%, 50%, ${intensity})`,
                                          borderLeft: `3px solid hsla(${hue}, 80%, 60%, 1)`,
                                          boxShadow: `0 1px 3px rgba(0,0,0,0.3)`,
                                        }}
                                        title={`${note.note}${note.octave} | Vel: ${velocity}`}
                                      >
                                        {zoomLevel > 0.8 && <span className="truncate px-1">{note.note}{note.octave}</span>}
                                      </div>
                                    );
                                  })}
                                  {/* Velocity bar visualization */}
                                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gray-800/50 flex items-end">
                                    {track.midiNotes.slice(0, 50).map((note, idx) => (
                                      <div
                                        key={`vel-${note.id}`}
                                        className="w-1 mx-px bg-green-500"
                                        style={{
                                          height: `${(note.velocity ?? 100) / 127 * 100}%`,
                                          opacity: 0.7,
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className="absolute bottom-5 left-2 text-xs text-green-400 bg-gray-900/80 px-1 rounded">
                                  MIDI: {track.instrument || 'Synth'} ({track.midiNotes.length} notes)
                                </div>
                                {/* Start time indicator */}
                                <div className="absolute -top-5 left-0 text-[10px] text-gray-400 bg-gray-800 px-1 rounded">
                                  {(track.startTimeSeconds ?? 0).toFixed(1)}s
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`bg-gray-900 rounded flex items-center justify-center gap-3 border-2 border-dashed border-gray-600 ${isRegionSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}`}
                              style={{ height: track.height ?? DEFAULT_TRACK_HEIGHT, minWidth: `${laneWidth}px` }}
                              onClick={() => toggleRegionSelection(track.id)}
                            >
                              {track.trackType === 'beat' && (
                                <Button
                                  size="sm"
                                  className="bg-amber-600 hover:bg-amber-500"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'beatmaker' }));
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
                                    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'melody' }));
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

                            {/* Track Kind */}
                            <Select
                              value={track.kind || ''}
                              onValueChange={(v) => {
                                updateTrackKind(track.id, v);
                                const defaults = getKindSendDefaults(v);
                                updateTrackSends(track.id, defaults.sendA, defaults.sendB);
                              }}
                            >
                              <SelectTrigger className="w-24 h-8 bg-gray-800 border-gray-700 text-xs">
                                <SelectValue placeholder="Kind" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="vocal">Vocal</SelectItem>
                                <SelectItem value="drums">Drums</SelectItem>
                                <SelectItem value="bass">Bass</SelectItem>
                                <SelectItem value="synth">Synth</SelectItem>
                                <SelectItem value="keys">Keys</SelectItem>
                                <SelectItem value="guitar">Guitar</SelectItem>
                                <SelectItem value="fx">FX</SelectItem>
                              </SelectContent>
                            </Select>

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

                            {/* Sends */}
                            <div className="flex items-center gap-2 w-56">
                              <span className="text-xs text-gray-400 whitespace-nowrap">Sends (dB)</span>
                              <div className="flex flex-col gap-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400">A</span>
                                  <Slider
                                    value={[track.sendA ?? -60]}
                                    onValueChange={(val) => updateTrackSends(track.id, val[0], track.sendB)}
                                    max={12}
                                    min={-60}
                                    step={1}
                                    className="flex-1"
                                  />
                                  <span className="text-[11px] text-gray-300 w-10 text-right">{Math.round(track.sendA ?? -60)} dB</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400">B</span>
                                  <Slider
                                    value={[track.sendB ?? -60]}
                                    onValueChange={(val) => updateTrackSends(track.id, track.sendA, val[0])}
                                    max={12}
                                    min={-60}
                                    step={1}
                                    className="flex-1"
                                  />
                                  <span className="text-[11px] text-gray-300 w-10 text-right">{Math.round(track.sendB ?? -60)} dB</span>
                                </div>
                              </div>
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
            );
          })}
          </div>
        )}
        </div>
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
              Waveform Editor {waveformEditorTrack ? `- ${waveformEditorTrack.name}` : ''}
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

      {/* Mixer */}
      {showMixer && (
        <div className="h-96 border-t border-gray-800 bg-gray-900">
          <ProfessionalMixer />
        </div>
      )}

      {/* Tuner */}
      <TunerModal open={showTuner} onClose={() => setShowTuner(false)} freq={tunerFreq} setFreq={setTunerFreq} />

      {/* Project Settings Modal */}
      <BaseDialog open={showProjectSettingsModal} onOpenChange={setShowProjectSettingsModal}>
        <BaseDialogContent className="bg-gray-900 border-gray-700">
          <BaseDialogHeader>
            <BaseDialogTitle className="text-white">Project Settings</BaseDialogTitle>
          </BaseDialogHeader>
          <div className="space-y-3 text-sm text-gray-200">
            <div className="flex items-center gap-2">
              <span className="w-32 text-gray-400">Project Name</span>
              <Input className="bg-gray-800 border-gray-700" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-gray-400">BPM</span>
              <Input type="number" className="bg-gray-800 border-gray-700 w-24" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-gray-400">Key</span>
              <Input className="bg-gray-800 border-gray-700 w-24" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-gray-400">Time Signature</span>
              <Input className="bg-gray-800 border-gray-700 w-24" value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-gray-400">Limiter Threshold</span>
              <Input type="number" className="bg-gray-800 border-gray-700 w-24" value={masterLimiter.threshold} onChange={(e) => setMasterLimiter((p) => ({ ...p, threshold: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-gray-400">Limiter Release</span>
              <Input type="number" className="bg-gray-800 border-gray-700 w-24" value={masterLimiter.release} onChange={(e) => setMasterLimiter((p) => ({ ...p, release: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-gray-400">Limiter Ceiling</span>
              <Input type="number" className="bg-gray-800 border-gray-700 w-24" value={masterLimiter.ceiling} onChange={(e) => setMasterLimiter((p) => ({ ...p, ceiling: Number(e.target.value) }))} />
            </div>
          </div>
        </BaseDialogContent>
      </BaseDialog>
    </div>
  );
}
