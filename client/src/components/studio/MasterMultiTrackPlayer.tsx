/**
 * Master Multi-Track Audio Player
 * Professional audio player for loading and mixing multiple audio files
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Play,
  Pause,
  Square,
  Upload,
  Trash2,
  Volume2,
  VolumeX,
  Headphones,
  Download,
  Plus,
  Music,
  Repeat,
  SkipBack,
  SkipForward,
} from 'lucide-react';

interface AudioTrack {
  id: string;
  name: string;
  audioBuffer: AudioBuffer | null;
  audioUrl: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  color: string;
  gainNode?: GainNode;
  panNode?: StereoPannerNode;
  sourceNode?: AudioBufferSourceNode;
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

export default function MasterMultiTrackPlayer() {
  const { toast } = useToast();
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(80);
  const [loop, setLoop] = useState(false);
  const [tempo, setTempo] = useState(120);

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

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

  // Update master volume
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVolume / 100;
    }
  }, [masterVolume]);

  // Calculate total duration
  useEffect(() => {
    const maxDuration = Math.max(
      ...tracks.map(t => t.audioBuffer?.duration || 0),
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
        muted: false,
        solo: false,
        color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
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

  // Play all tracks
  const playTracks = () => {
    if (!audioContextRef.current || !masterGainRef.current) return;

    const ctx = audioContextRef.current;
    const hasSolo = tracks.some(t => t.solo);

    // Stop any existing playback
    stopTracks();

    const startOffset = pauseTimeRef.current;
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
      source.loop = loop;

      // Set volume and pan
      gainNode.gain.value = track.volume / 100;
      panNode.pan.value = track.pan;

      // Connect: source -> gain -> pan -> master -> destination
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(masterGainRef.current!);

      // Store references
      track.sourceNode = source;
      track.gainNode = gainNode;
      track.panNode = panNode;

      // Start playback
      source.start(0, startOffset);

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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Stop and reset
  const stopPlayback = () => {
    stopTracks();
    setIsPlaying(false);
    pauseTimeRef.current = 0;
    setCurrentTime(0);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // Update current time
  const updateCurrentTime = () => {
    if (!audioContextRef.current || !isPlaying) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    setCurrentTime(elapsed);

    if (elapsed < duration || loop) {
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
            <label htmlFor="audio-upload">
              <Button variant="default" className="cursor-pointer" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Load Audio Files
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
              <Card key={track.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Track Color */}
                    <div
                      className="w-2 h-16 rounded"
                      style={{ backgroundColor: track.color }}
                    />

                    {/* Track Info */}
                    <div className="flex-1">
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

                      {/* Waveform Placeholder */}
                      <div className="h-12 bg-gray-900 rounded mb-2 flex items-center justify-center">
                        <div className="text-xs text-gray-500">
                          Duration: {track.audioBuffer ? formatTime(track.audioBuffer.duration) : '0:00'}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-4">
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
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
    </div>
  );
}
