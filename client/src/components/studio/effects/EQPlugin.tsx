import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Sliders, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EQBand {
  id: string;
  frequency: number;
  gain: number;
  q: number;
  type: BiquadFilterType;
}

interface EQPluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function EQPlugin({ audioUrl, onClose }: EQPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [bands, setBands] = useState<EQBand[]>([
    { id: 'low', frequency: 100, gain: 0, q: 1, type: 'lowshelf' },
    { id: 'lowmid', frequency: 400, gain: 0, q: 1, type: 'peaking' },
    { id: 'mid', frequency: 1000, gain: 0, q: 1, type: 'peaking' },
    { id: 'highmid', frequency: 3000, gain: 0, q: 1, type: 'peaking' },
    { id: 'high', frequency: 8000, gain: 0, q: 1, type: 'highshelf' },
  ]);

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create filter nodes for each band
    bands.forEach((band, index) => {
      const filter = audioContextRef.current!.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = band.q;
      filtersRef.current[index] = filter;
    });

    // Connect nodes: source -> filters -> destination
    let currentNode: AudioNode = sourceNodeRef.current;
    filtersRef.current.forEach((filter) => {
      currentNode.connect(filter);
      currentNode = filter;
    });
    currentNode.connect(audioContextRef.current.destination);

    return () => {
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  const updateBand = (index: number, property: keyof EQBand, value: number) => {
    const newBands = [...bands];
    newBands[index] = { ...newBands[index], [property]: value };
    setBands(newBands);

    // Update actual filter
    if (filtersRef.current[index]) {
      if (property === 'frequency') {
        filtersRef.current[index].frequency.value = value;
      } else if (property === 'gain') {
        filtersRef.current[index].gain.value = value;
      } else if (property === 'q') {
        filtersRef.current[index].Q.value = value;
      }
    }
  };

  const resetEQ = () => {
    const resetBands = bands.map((band) => ({ ...band, gain: 0 }));
    setBands(resetBands);
    filtersRef.current.forEach((filter) => {
      filter.gain.value = 0;
    });
    toast({ title: 'EQ Reset', description: 'All bands reset to 0dB' });
  };

  const togglePlayback = () => {
    if (!audioElementRef.current) return;

    if (isPlaying) {
      audioElementRef.current.pause();
    } else {
      audioElementRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const savePreset = () => {
    const preset = {
      name: `EQ Preset ${new Date().toLocaleTimeString()}`,
      bands: bands,
    };
    localStorage.setItem('eq-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: 'EQ settings saved to browser',
    });
  };

  // ISSUE #1: Load preset functionality
  const loadPreset = () => {
    try {
      const saved = localStorage.getItem('eq-preset-last');
      if (saved) {
        const preset = JSON.parse(saved);
        if (preset.bands) {
          setBands(preset.bands);
          // Apply to actual filters
          preset.bands.forEach((band: EQBand, index: number) => {
            if (filtersRef.current[index]) {
              filtersRef.current[index].frequency.value = band.frequency;
              filtersRef.current[index].gain.value = band.gain;
              filtersRef.current[index].Q.value = band.q;
            }
          });
          toast({ title: 'Preset Loaded', description: `Loaded: ${preset.name}` });
        }
      } else {
        toast({ title: 'No Preset', description: 'No saved preset found', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Load Failed', description: 'Could not load preset', variant: 'destructive' });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Sliders className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Parametric EQ</CardTitle>
              <p className="text-sm text-muted-foreground">
                5-Band Equalizer
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">Web Audio API</Badge>
            <Badge variant="outline">Real-time</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Playback Controls */}
        {audioUrl && (
          <div className="flex gap-2">
            <Button onClick={togglePlayback} className="flex-1">
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Play
                </>
              )}
            </Button>
            <Button onClick={resetEQ} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={savePreset} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={loadPreset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Load
            </Button>
          </div>
        )}

        {/* EQ Bands */}
        <div className="grid grid-cols-5 gap-4">
          {bands.map((band, index) => (
            <div key={band.id} className="space-y-3">
              <div className="text-center">
                <p className="text-sm font-medium">{band.frequency}Hz</p>
                <p className="text-xs text-muted-foreground">
                  {band.gain > 0 ? '+' : ''}
                  {band.gain.toFixed(1)}dB
                </p>
              </div>

              {/* Vertical Gain Slider */}
              <div className="flex justify-center h-48">
                <Slider
                  orientation="vertical"
                  value={[band.gain]}
                  onValueChange={([value]) => updateBand(index, 'gain', value)}
                  min={-12}
                  max={12}
                  step={0.1}
                  className="h-full"
                />
              </div>

              {/* Q Factor */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Q: {band.q.toFixed(1)}
                </label>
                <Slider
                  value={[band.q]}
                  onValueChange={([value]) => updateBand(index, 'q', value)}
                  min={0.1}
                  max={10}
                  step={0.1}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Visual Guide */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">EQ Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>100Hz:</strong> Sub bass and kick drums</li>
            <li>• <strong>400Hz:</strong> Warmth and body</li>
            <li>• <strong>1kHz:</strong> Presence and clarity</li>
            <li>• <strong>3kHz:</strong> Vocal clarity</li>
            <li>• <strong>8kHz:</strong> Air and brightness</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
