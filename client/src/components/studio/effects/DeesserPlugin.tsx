import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Mic, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeesserPluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function DeesserPlugin({ audioUrl, onClose }: DeesserPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(6000);
  const [threshold, setThreshold] = useState(-40);
  const [ratio, setRatio] = useState(4);
  const [bandwidth, setBandwidth] = useState(2);

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create high-pass filter to isolate sibilant frequencies
    filterRef.current = audioContextRef.current.createBiquadFilter();
    filterRef.current.type = 'peaking';
    filterRef.current.frequency.value = frequency;
    filterRef.current.Q.value = bandwidth;
    filterRef.current.gain.value = -6; // Reduce sibilance

    // Create compressor for dynamic de-essing
    compressorRef.current = audioContextRef.current.createDynamicsCompressor();
    compressorRef.current.threshold.value = threshold;
    compressorRef.current.ratio.value = ratio;
    compressorRef.current.attack.value = 0.001;
    compressorRef.current.release.value = 0.1;

    // Connect: source -> filter -> compressor -> destination
    sourceNodeRef.current
      .connect(filterRef.current)
      .connect(compressorRef.current)
      .connect(audioContextRef.current.destination);

    return () => {
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  const updateFrequency = (value: number) => {
    setFrequency(value);
    if (filterRef.current) {
      filterRef.current.frequency.value = value;
    }
  };

  const updateThreshold = (value: number) => {
    setThreshold(value);
    if (compressorRef.current) {
      compressorRef.current.threshold.value = value;
    }
  };

  const updateRatio = (value: number) => {
    setRatio(value);
    if (compressorRef.current) {
      compressorRef.current.ratio.value = value;
    }
  };

  const updateBandwidth = (value: number) => {
    setBandwidth(value);
    if (filterRef.current) {
      filterRef.current.Q.value = value;
    }
  };

  const resetDeesser = () => {
    updateFrequency(6000);
    updateThreshold(-40);
    updateRatio(4);
    updateBandwidth(2);
    toast({ title: 'Deesser Reset', description: 'All settings reset to defaults' });
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
      name: `Deesser Preset ${new Date().toLocaleTimeString()}`,
      settings: { frequency, threshold, ratio, bandwidth },
    };
    localStorage.setItem('deesser-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: 'Deesser settings saved to browser',
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <Mic className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Deesser</CardTitle>
              <p className="text-sm text-muted-foreground">
                Reduce harsh S sounds
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
            <Button onClick={resetDeesser} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={savePreset} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}

        {/* Deesser Parameters */}
        <div className="space-y-6">
          {/* Frequency */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Frequency: {frequency.toFixed(0)} Hz
            </label>
            <Slider
              value={[frequency]}
              onValueChange={([value]) => updateFrequency(value)}
              min={4000}
              max={10000}
              step={100}
            />
            <p className="text-xs text-muted-foreground">
              Target frequency for sibilance (usually 5-8kHz)
            </p>
          </div>

          {/* Threshold */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Threshold: {threshold.toFixed(1)} dB
            </label>
            <Slider
              value={[threshold]}
              onValueChange={([value]) => updateThreshold(value)}
              min={-60}
              max={0}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Level where de-essing begins
            </p>
          </div>

          {/* Ratio */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Ratio: {ratio.toFixed(1)}:1
            </label>
            <Slider
              value={[ratio]}
              onValueChange={([value]) => updateRatio(value)}
              min={1}
              max={10}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Amount of sibilance reduction
            </p>
          </div>

          {/* Bandwidth */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Bandwidth: {bandwidth.toFixed(1)}
            </label>
            <Slider
              value={[bandwidth]}
              onValueChange={([value]) => updateBandwidth(value)}
              min={0.5}
              max={5}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Width of frequency band to process
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">De-essing Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Most sibilance occurs between 5-8kHz</li>
            <li>• Start with a higher threshold and adjust down</li>
            <li>• Use moderate ratios (3:1 to 5:1) to avoid artifacts</li>
            <li>• Listen for lisping - if vocals sound dull, reduce amount</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
