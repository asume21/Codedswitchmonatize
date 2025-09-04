import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAudio } from '@/hooks/use-audio';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  Music, 
  Mic, 
  Download,
  Sliders,
  Layers,
  Settings
} from 'lucide-react';

interface Track {
  id: string;
  name: string;
  type: 'beat' | 'melody' | 'bass' | 'vocals' | 'lead';
  volume: number;
  muted: boolean;
  solo: boolean;
  pan: number;
  eq: {
    low: number;
    mid: number;
    high: number;
  };
  effects: {
    reverb: number;
    delay: number;
    compression: number;
  };
  isPlaying: boolean;
  audioBuffer?: any;
}

export default function MixerStudio() {
  const { toast } = useToast();
  const { playDrumSound, initialize, isInitialized } = useAudio();
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterVolumeRef = useRef<number>(75);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120); // 2 minutes default
  const [masterVolume, setMasterVolume] = useState([75]);
  const [masterEQ, setMasterEQ] = useState({ low: 0, mid: 0, high: 0 });

  // Track management
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: 'beat',
      name: 'Beat/Drums',
      type: 'beat',
      volume: 80,
      muted: false,
      solo: false,
      pan: 0,
      eq: { low: 0, mid: 0, high: 0 },
      effects: { reverb: 0, delay: 0, compression: 20 },
      isPlaying: false
    },
    {
      id: 'melody',
      name: 'Melody',
      type: 'melody',
      volume: 70,
      muted: false,
      solo: false,
      pan: 0,
      eq: { low: 0, mid: 0, high: 5 },
      effects: { reverb: 15, delay: 0, compression: 10 },
      isPlaying: false
    },
    {
      id: 'bass',
      name: 'Bass',
      type: 'bass',
      volume: 85,
      muted: false,
      solo: false,
      pan: 0,
      eq: { low: 10, mid: -5, high: -10 },
      effects: { reverb: 0, delay: 0, compression: 30 },
      isPlaying: false
    }
  ]);

  // Generate layered composition
  const generateComposition = useMutation({
    mutationFn: async (options: any) => {
      const response = await apiRequest('POST', '/api/audio/layered-composition', options);
      return response;
    },
    onSuccess: (result) => {
      toast({
        title: "🎵 Composition Generated",
        description: "Your layered beat and melody are ready for mixing!"
      });
      // Load tracks into mixer
      loadCompositionIntoMixer(result);
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Master and export composition
  const exportComposition = useMutation({
    mutationFn: async () => {
      const mixData = {
        tracks: tracks,
        masterVolume: masterVolume[0],
        masterEQ: masterEQ,
        duration: duration
      };
      const response = await apiRequest('POST', '/api/audio/export-master', mixData);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "🎧 Mix Exported Successfully",
        description: "Your mastered track is ready for download!"
      });
      // Trigger download
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const loadCompositionIntoMixer = (composition: any) => {
    // Update tracks with generated audio data
    setTracks(prevTracks => 
      prevTracks.map(track => ({
        ...track,
        audioBuffer: composition[track.type] || null,
        isPlaying: false
      }))
    );
  };

  const updateTrack = (trackId: string, updates: Partial<Track>) => {
    setTracks(prev => 
      prev.map(track => 
        track.id === trackId ? { ...track, ...updates } : track
      )
    );
  };

  const togglePlayback = () => {
    if (!isInitialized) {
      initialize();
    }
    setIsPlaying(!isPlaying);
    
    // Toggle all unmuted tracks
    tracks.forEach(track => {
      if (!track.muted) {
        updateTrack(track.id, { isPlaying: !isPlaying });
      }
    });
  };

  const soloTrack = (trackId: string) => {
    setTracks(prev => 
      prev.map(track => ({
        ...track,
        muted: track.id !== trackId ? !track.solo : track.muted,
        solo: track.id === trackId ? !track.solo : false
      }))
    );
  };

  const addTrack = () => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${tracks.length + 1}`,
      type: 'lead',
      volume: 70,
      muted: false,
      solo: false,
      pan: 0,
      eq: { low: 0, mid: 0, high: 0 },
      effects: { reverb: 0, delay: 0, compression: 0 },
      isPlaying: false
    };
    setTracks(prev => [...prev, newTrack]);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6" data-testid="mixer-studio">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layers className="w-8 h-8 text-primary" />
            Professional Mixer Studio
          </h1>
          <p className="text-muted-foreground mt-2">
            Layer beats with melodies, then mix and master your creation
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={togglePlayback}
            size="lg"
            data-testid="button-playback-toggle"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsPlaying(false)}
            data-testid="button-stop"
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Generate Layered Composition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Beat Style</Label>
              <Select defaultValue="hip-hop">
                <SelectTrigger data-testid="select-beat-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                  <SelectItem value="trap">Trap</SelectItem>
                  <SelectItem value="pop">Pop</SelectItem>
                  <SelectItem value="rock">Rock</SelectItem>
                  <SelectItem value="electronic">Electronic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Melody Type</Label>
              <Select defaultValue="piano">
                <SelectTrigger data-testid="select-melody-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piano">Piano</SelectItem>
                  <SelectItem value="guitar">Guitar</SelectItem>
                  <SelectItem value="strings">Strings</SelectItem>
                  <SelectItem value="synth">Synth</SelectItem>
                  <SelectItem value="vocal">Vocal Melody</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Key & BPM</Label>
              <div className="flex gap-2">
                <Select defaultValue="C">
                  <SelectTrigger className="w-20" data-testid="select-key">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="G">G</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="120">
                  <SelectTrigger data-testid="select-bpm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80">80 BPM</SelectItem>
                    <SelectItem value="100">100 BPM</SelectItem>
                    <SelectItem value="120">120 BPM</SelectItem>
                    <SelectItem value="140">140 BPM</SelectItem>
                    <SelectItem value="160">160 BPM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => generateComposition.mutate({})}
            disabled={generateComposition.isPending}
            className="w-full"
            data-testid="button-generate-composition"
          >
            {generateComposition.isPending ? 'Generating...' : 'Generate Layered Beat + Melody'}
          </Button>
        </CardContent>
      </Card>

      {/* Mixer Board */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5" />
            Mixer Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {tracks.map(track => (
              <div key={track.id} className="space-y-4 p-4 border rounded-lg">
                <div className="text-center">
                  <h3 className="font-semibold">{track.name}</h3>
                  <div className="flex justify-center gap-2 mt-2">
                    <Button
                      size="sm"
                      variant={track.muted ? "destructive" : "outline"}
                      onClick={() => updateTrack(track.id, { muted: !track.muted })}
                      data-testid={`button-mute-${track.id}`}
                    >
                      {track.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant={track.solo ? "default" : "outline"}
                      onClick={() => soloTrack(track.id)}
                      data-testid={`button-solo-${track.id}`}
                    >
                      S
                    </Button>
                  </div>
                </div>

                {/* Volume Fader */}
                <div className="space-y-2">
                  <Label>Volume: {track.volume}</Label>
                  <div className="h-32">
                    <Slider
                      orientation="vertical"
                      value={[track.volume]}
                      onValueChange={([value]) => updateTrack(track.id, { volume: value })}
                      max={100}
                      className="h-full"
                      data-testid={`slider-volume-${track.id}`}
                    />
                  </div>
                </div>

                {/* Pan Control */}
                <div className="space-y-2">
                  <Label>Pan: {track.pan > 0 ? `R${track.pan}` : track.pan < 0 ? `L${Math.abs(track.pan)}` : 'C'}</Label>
                  <Slider
                    value={[track.pan]}
                    onValueChange={([value]) => updateTrack(track.id, { pan: value })}
                    min={-50}
                    max={50}
                    data-testid={`slider-pan-${track.id}`}
                  />
                </div>

                {/* EQ Controls */}
                <div className="space-y-2">
                  <Label className="text-xs">EQ</Label>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div>
                      <Label className="text-xs">High</Label>
                      <Slider
                        value={[track.eq.high]}
                        onValueChange={([value]) => 
                          updateTrack(track.id, { 
                            eq: { ...track.eq, high: value }
                          })
                        }
                        min={-20}
                        max={20}
                        className="h-16"
                        orientation="vertical"
                        data-testid={`slider-eq-high-${track.id}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mid</Label>
                      <Slider
                        value={[track.eq.mid]}
                        onValueChange={([value]) => 
                          updateTrack(track.id, { 
                            eq: { ...track.eq, mid: value }
                          })
                        }
                        min={-20}
                        max={20}
                        className="h-16"
                        orientation="vertical"
                        data-testid={`slider-eq-mid-${track.id}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Low</Label>
                      <Slider
                        value={[track.eq.low]}
                        onValueChange={([value]) => 
                          updateTrack(track.id, { 
                            eq: { ...track.eq, low: value }
                          })
                        }
                        min={-20}
                        max={20}
                        className="h-16"
                        orientation="vertical"
                        data-testid={`slider-eq-low-${track.id}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Effects */}
                <div className="space-y-2">
                  <Label className="text-xs">Effects</Label>
                  <div className="space-y-1">
                    <div>
                      <Label className="text-xs">Reverb: {track.effects.reverb}%</Label>
                      <Slider
                        value={[track.effects.reverb]}
                        onValueChange={([value]) => 
                          updateTrack(track.id, { 
                            effects: { ...track.effects, reverb: value }
                          })
                        }
                        max={100}
                        className="h-2"
                        data-testid={`slider-reverb-${track.id}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Compression: {track.effects.compression}%</Label>
                      <Slider
                        value={[track.effects.compression]}
                        onValueChange={([value]) => 
                          updateTrack(track.id, { 
                            effects: { ...track.effects, compression: value }
                          })
                        }
                        max={100}
                        className="h-2"
                        data-testid={`slider-compression-${track.id}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Master Section */}
            <div className="space-y-4 p-4 border rounded-lg bg-primary/5">
              <div className="text-center">
                <h3 className="font-bold text-lg">MASTER</h3>
              </div>

              {/* Master Volume */}
              <div className="space-y-2">
                <Label>Master Volume: {masterVolume[0]}</Label>
                <div className="h-32">
                  <Slider
                    orientation="vertical"
                    value={masterVolume}
                    onValueChange={setMasterVolume}
                    max={100}
                    className="h-full"
                    data-testid="slider-master-volume"
                  />
                </div>
              </div>

              {/* Master EQ */}
              <div className="space-y-2">
                <Label className="text-xs">Master EQ</Label>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div>
                    <Label className="text-xs">High</Label>
                    <Slider
                      value={[masterEQ.high]}
                      onValueChange={([value]) => 
                        setMasterEQ(prev => ({ ...prev, high: value }))
                      }
                      min={-20}
                      max={20}
                      className="h-16"
                      orientation="vertical"
                      data-testid="slider-master-eq-high"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mid</Label>
                    <Slider
                      value={[masterEQ.mid]}
                      onValueChange={([value]) => 
                        setMasterEQ(prev => ({ ...prev, mid: value }))
                      }
                      min={-20}
                      max={20}
                      className="h-16"
                      orientation="vertical"
                      data-testid="slider-master-eq-mid"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Low</Label>
                    <Slider
                      value={[masterEQ.low]}
                      onValueChange={([value]) => 
                        setMasterEQ(prev => ({ ...prev, low: value }))
                      }
                      min={-20}
                      max={20}
                      className="h-16"
                      orientation="vertical"
                      data-testid="slider-master-eq-low"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transport and Export Controls */}
          <div className="flex justify-between items-center mt-6 p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <Button onClick={addTrack} variant="outline" data-testid="button-add-track">
                Add Track
              </Button>
              <div className="text-sm text-muted-foreground">
                {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => exportComposition.mutate()}
                disabled={exportComposition.isPending}
                data-testid="button-export"
              >
                <Download className="w-4 h-4 mr-2" />
                {exportComposition.isPending ? 'Mastering...' : 'Export Master'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}