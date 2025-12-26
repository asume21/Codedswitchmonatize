import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Gauge, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CompressorPluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function CompressorPlugin({ audioUrl, onClose }: CompressorPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [threshold, setThreshold] = useState(-24);
  const [knee, setKnee] = useState(30);
  const [ratio, setRatio] = useState(12);
  const [attack, setAttack] = useState(0.003);
  const [release, setRelease] = useState(0.25);

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create compressor node
    compressorRef.current = audioContextRef.current.createDynamicsCompressor();
    compressorRef.current.threshold.value = threshold;
    compressorRef.current.knee.value = knee;
    compressorRef.current.ratio.value = ratio;
    compressorRef.current.attack.value = attack;
    compressorRef.current.release.value = release;

    // Connect: source -> compressor -> destination
    sourceNodeRef.current
      .connect(compressorRef.current)
      .connect(audioContextRef.current.destination);

    return () => {
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  const updateParameter = (
    param: 'threshold' | 'knee' | 'ratio' | 'attack' | 'release',
    value: number
  ) => {
    if (!compressorRef.current) return;

    switch (param) {
      case 'threshold':
        setThreshold(value);
        compressorRef.current.threshold.value = value;
        break;
      case 'knee':
        setKnee(value);
        compressorRef.current.knee.value = value;
        break;
      case 'ratio':
        setRatio(value);
        compressorRef.current.ratio.value = value;
        break;
      case 'attack':
        setAttack(value);
        compressorRef.current.attack.value = value;
        break;
      case 'release':
        setRelease(value);
        compressorRef.current.release.value = value;
        break;
    }
  };

  const resetCompressor = () => {
    updateParameter('threshold', -24);
    updateParameter('knee', 30);
    updateParameter('ratio', 12);
    updateParameter('attack', 0.003);
    updateParameter('release', 0.25);
    toast({ title: 'Compressor Reset', description: 'All settings reset to defaults' });
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
      name: `Compressor Preset ${new Date().toLocaleTimeString()}`,
      settings: { threshold, knee, ratio, attack, release },
    };
    localStorage.setItem('compressor-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: 'Compressor settings saved to browser',
    });
  };

  // ISSUE #1: Load preset functionality
  const loadPreset = () => {
    try {
      const saved = localStorage.getItem('compressor-preset-last');
      if (saved) {
        const preset = JSON.parse(saved);
        if (preset.settings) {
          updateParameter('threshold', preset.settings.threshold);
          updateParameter('knee', preset.settings.knee);
          updateParameter('ratio', preset.settings.ratio);
          updateParameter('attack', preset.settings.attack);
          updateParameter('release', preset.settings.release);
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
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Gauge className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Dynamic Compressor</CardTitle>
              <p className="text-sm text-muted-foreground">
                Control dynamic range
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
            <Button onClick={resetCompressor} variant="outline">
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

        {/* Compressor Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Threshold */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Threshold: {threshold.toFixed(1)} dB
            </label>
            <Slider
              value={[threshold]}
              onValueChange={([value]) => updateParameter('threshold', value)}
              min={-100}
              max={0}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Level where compression begins
            </p>
          </div>

          {/* Ratio */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Ratio: {ratio.toFixed(1)}:1</label>
            <Slider
              value={[ratio]}
              onValueChange={([value]) => updateParameter('ratio', value)}
              min={1}
              max={20}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Amount of compression applied
            </p>
          </div>

          {/* Attack */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Attack: {(attack * 1000).toFixed(1)} ms
            </label>
            <Slider
              value={[attack * 1000]}
              onValueChange={([value]) => updateParameter('attack', value / 1000)}
              min={0}
              max={100}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              How fast compressor responds
            </p>
          </div>

          {/* Release */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Release: {(release * 1000).toFixed(0)} ms
            </label>
            <Slider
              value={[release * 1000]}
              onValueChange={([value]) => updateParameter('release', value / 1000)}
              min={0}
              max={1000}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              How fast compressor recovers
            </p>
          </div>

          {/* Knee */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Knee: {knee.toFixed(0)} dB</label>
            <Slider
              value={[knee]}
              onValueChange={([value]) => updateParameter('knee', value)}
              min={0}
              max={40}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Smoothness of compression curve
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Compression Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Vocals:</strong> Ratio 3:1, fast attack, medium release</li>
            <li>• <strong>Drums:</strong> Ratio 4:1, fast attack, fast release</li>
            <li>• <strong>Bass:</strong> Ratio 4:1, medium attack, medium release</li>
            <li>• <strong>Master:</strong> Ratio 2:1, slow attack, slow release</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
