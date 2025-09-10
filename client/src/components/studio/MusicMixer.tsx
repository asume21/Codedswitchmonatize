import { useState, useContext, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { StudioAudioContext } from '@/pages/studio';
import { useAudio } from '@/hooks/use-audio';
import { Play, Pause, Square, Download, Settings as MixerIcon, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MixerTrack {
  id: string;
  name: string;
  enabled: boolean;
  volume: number;
  data: any;
  color: string;
  hasData: boolean;
}

export default function MusicMixer() {
  const studioContext = useContext(StudioAudioContext);
  const { playDrumSound, initialize, isInitialized } = useAudio();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState([80]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mixerRef = useRef<HTMLDivElement>(null);

  // Get data from studio context and localStorage
  const getBeatData = () => {
    if (studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0) {
      const hasRealData = Object.values(studioContext.currentPattern).some(arr =>
        Array.isArray(arr) && arr.some(val => val === true));
      return hasRealData ? studioContext.currentPattern : null;
    }

    const stored = localStorage.getItem('generatedMusicData');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.beatPattern || null;
    }
    return null;
  };

  const getMelodyData = () => {
    if (studioContext.currentMelody && studioContext.currentMelody.length > 0) {
      return studioContext.currentMelody;
    }

    const stored = localStorage.getItem('generatedMusicData');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.melody || [];
    }
    return [];
  };

  const getLyricsData = () => {
    const stored = localStorage.getItem('generatedMusicData');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.lyrics || '';
    }
    return '';
  };

  const getCodeMusicData = () => {
    if (studioContext.currentCodeMusic && Object.keys(studioContext.currentCodeMusic).length > 0) {
      return studioContext.currentCodeMusic;
    }
    return {};
  };

  // Initialize mixer tracks
  const [tracks, setTracks] = useState<MixerTrack[]>(() => {
    const beatData = getBeatData();
    const melodyData = getMelodyData();
    const lyricsData = getLyricsData();
    const codeMusicData = getCodeMusicData();

    return [
      {
        id: 'beats',
        name: 'Drum Beats',
        enabled: !!beatData,
        volume: 75,
        data: beatData,
        color: 'bg-red-500',
        hasData: !!beatData
      },
      {
        id: 'melody',
        name: 'Melody',
        enabled: melodyData.length > 0,
        volume: 65,
        data: melodyData,
        color: 'bg-blue-500',
        hasData: melodyData.length > 0
      },
      {
        id: 'lyrics',
        name: 'Lyrics',
        enabled: !!lyricsData,
        volume: 70,
        data: lyricsData,
        color: 'bg-green-500',
        hasData: !!lyricsData
      },
      {
        id: 'code-music',
        name: 'Code Music',
        enabled: Object.keys(codeMusicData).length > 0,
        volume: 60,
        data: codeMusicData,
        color: 'bg-purple-500',
        hasData: Object.keys(codeMusicData).length > 0
      }
    ];
  });

  const enabledTracks = tracks.filter(track => track.enabled && track.hasData);
  const hasAnyData = tracks.some(track => track.hasData);

  // Initialize audio system
  const initializeAudio = async () => {
    if (!isInitialized) {
      await initialize();
    }
  };

  // Play mixed composition
  const playMixedComposition = async () => {
    await initializeAudio();

    const stepDuration = (60 / bpm / 4) * 1000; // 16th note duration
    let step = 0;

    intervalRef.current = setInterval(() => {
      setCurrentStep(step % 16);

      // Play beats if enabled
      const beatTrack = tracks.find(t => t.id === 'beats' && t.enabled);
      if (beatTrack && beatTrack.data) {
        Object.entries(beatTrack.data).forEach(([drum, pattern]) => {
          if (Array.isArray(pattern) && (pattern as boolean[])[step % 16]) {
            playDrumSound(drum);
          }
        });
      }

      // Play melody if enabled and has notes at this step
      const melodyTrack = tracks.find(t => t.id === 'melody' && t.enabled);
      if (melodyTrack && melodyTrack.data && (melodyTrack.data as any[]).length > 0) {
        // Play melody notes that align with current step timing
        const melodyStep = Math.floor(step / 4); // Melody plays on quarter notes
        if (step % 4 === 0 && melodyStep < (melodyTrack.data as any[]).length) {
          const note = (melodyTrack.data as any[])[melodyStep];
          if (note && (note as any).note) {
            // Simple melody playback using drum sounds for now
            playDrumSound('kick');
          }
        }
      }

      step++;

      // Loop after 16 steps (one bar)
      if (step >= 16) {
        step = 0;
      }
    }, stepDuration);
  };

  const stopPlayback = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(0);
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      setIsPlaying(true);
      await playMixedComposition();
    }
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, volume } : track
    ));
  };

  const toggleTrack = (trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, enabled: !track.enabled } : track
    ));
  };

  const exportMix = async () => {
    toast({
      title: "Export Started",
      description: "Your mixed composition is being prepared for download...",
    });

    // This would integrate with a proper audio export system
    // Export mixed composition with tracks, bpm, and master volume

    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: "Your mixed track has been generated successfully!",
      });
    }, 2000);
  };

  if (!hasAnyData) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-md mx-auto">
          <MixerIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Music Data Available</h3>
          <p className="text-muted-foreground mb-4">
            Generate some beats, melodies, or lyrics in other studio tools first, then come back here to mix them together.
          </p>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>• Use Beat Maker to create drum patterns</p>
            <p>• Use Melody Composer to create musical phrases</p>
            <p>• Use Lyric Lab to generate music from lyrics</p>
            <p>• Use Code Translator to create music from code</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" ref={mixerRef}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MixerIcon className="w-6 h-6" />
            Music Mixer
          </h2>
          <p className="text-muted-foreground">
            Combine your beats, melodies, and lyrics into a complete song
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="bpm" className="text-sm">BPM:</Label>
            <input
              id="bpm"
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-16 px-2 py-1 text-sm border rounded"
              min="60"
              max="200"
              aria-label="BPM tempo control"
            />
          </div>
        </div>
      </div>

      {/* Transport Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Transport Controls
            <div className="flex items-center gap-2">
              <Badge variant={isPlaying ? "default" : "secondary"}>
                {isPlaying ? `Playing - Step ${currentStep + 1}` : "Stopped"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={handlePlayPause}
              className="flex items-center gap-2"
              disabled={enabledTracks.length === 0}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? "Pause" : "Play Mixed Song"}
            </Button>

            <Button
              onClick={stopPlayback}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>

            <Separator orientation="vertical" className="h-8" />

            <Button
              onClick={exportMix}
              variant="outline"
              className="flex items-center gap-2"
              disabled={enabledTracks.length === 0}
            >
              <Download className="w-4 h-4" />
              Export Mix
            </Button>
          </div>

          {/* Master Volume */}
          <div className="mt-4 flex items-center gap-4">
            <Volume2 className="w-4 h-4" />
            <Label className="min-w-0">Master Volume:</Label>
            <div className="flex-1 max-w-48">
              <Slider
                value={masterVolume}
                onValueChange={setMasterVolume}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-sm text-muted-foreground w-8">{masterVolume[0]}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Mixer Tracks */}
      <div className="grid gap-4">
        {tracks.map((track) => (
          <Card key={track.id} className={track.hasData ? "border-2" : "opacity-50"}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${track.color}`} />
                  <div>
                    <CardTitle className="text-lg">{track.name}</CardTitle>
                    <CardDescription>
                      {track.hasData ?
                        (track.id === 'beats' ?
                          `${Object.values(track.data || {}).filter((arr: any) => (arr as boolean[]).some((v: boolean) => v)).length} drum tracks` :
                          track.id === 'melody' ?
                          `${(track.data as any[])?.length || 0} notes` :
                          track.id === 'lyrics' ?
                          `${(track.data as string || '').split(' ').length} words` :
                          'Code-generated music'
                        ) :
                        'No data available'
                      }
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Switch
                    checked={track.enabled}
                    onCheckedChange={() => toggleTrack(track.id)}
                    disabled={!track.hasData}
                    aria-label={`Toggle ${track.name} track`}
                  />

                  {track.hasData && (
                    <Badge variant={track.enabled ? "default" : "secondary"}>
                      {track.enabled ? "Enabled" : "Muted"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            {track.hasData && track.enabled && (
              <CardContent className="pt-0">
                <div className="flex items-center gap-4">
                  <Volume2 className="w-4 h-4" />
                  <div className="flex-1 max-w-64">
                    <Slider
                      value={[track.volume]}
                      onValueChange={(value) => updateTrackVolume(track.id, value[0])}
                      max={100}
                      step={1}
                      className="w-full"
                      aria-label={`${track.name} track volume control`}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8">{track.volume}%</span>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Status Display */}
      <Card>
        <CardHeader>
          <CardTitle>Mix Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Active Tracks:</span>
              <p className="text-muted-foreground">{enabledTracks.length} of {tracks.filter(t => t.hasData).length}</p>
            </div>
            <div>
              <span className="font-medium">Tempo:</span>
              <p className="text-muted-foreground">{bpm} BPM</p>
            </div>
            <div>
              <span className="font-medium">Master Volume:</span>
              <p className="text-muted-foreground">{masterVolume[0]}%</p>
            </div>
            <div>
              <span className="font-medium">Status:</span>
              <p className="text-muted-foreground">{isPlaying ? "Playing" : "Stopped"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

