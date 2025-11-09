import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ShieldOff, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NoiseGatePluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function NoiseGatePlugin({ audioUrl, onClose }: NoiseGatePluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gateRef = useRef<DynamicsCompressorNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [threshold, setThreshold] = useState(-50);
  const [ratio, setRatio] = useState(20);
  const [attack, setAttack] = useState(0.001);
  const [release, setRelease] = useState(0.1);

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create noise gate using compressor with expander settings
    gateRef.current = audioContextRef.current.createDynamicsCompressor();
    gateRef.current.threshold.value = threshold;
    gateRef.current.knee.value = 0; // Hard knee
    gateRef.current.ratio.value = ratio;
    gateRef.current.attack.value = attack;
    gateRef.current.release.value = release;

    // Connect: source -> gate -> destination
    sourceNodeRef.current
      .connect(gateRef.current)
      .connect(audioContextRef.current.destination);

    return () => {
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  const updateThreshold = (value: number) => {
    setThreshold(value);
    if (gateRef.current) {
      gateRef.current.threshold.value = value;
    }
  };

  const updateRatio = (value: number) => {
    setRatio(value);
    if (gateRef.current) {
      gateRef.current.ratio.value = value;
    }
  };

  const updateAttack = (value: number) => {
    setAttack(value);
    if (gateRef.current) {
      gateRef.current.attack.value = value;
    }
  };

  const updateRelease = (value: number) => {
    setRelease(value);
    if (gateRef.current) {
      gateRef.current.release.value = value;
    }
  };

  const resetGate = () => {
    updateThreshold(-50);
    updateRatio(20);
    updateAttack(0.001);
    updateRelease(0.1);
    toast({ title: 'Noise Gate Reset', description: 'All settings reset to defaults' });
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
      name: `Gate Preset ${new Date().toLocaleTimeString()}`,
      settings: { threshold, ratio, attack, release },
    };
    localStorage.setItem('gate-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: 'Noise gate settings saved to browser',
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 rounded-lg">
              <ShieldOff className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Noise Gate</CardTitle>
              <p className="text-sm text-muted-foreground">
                Remove background noise
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
            <Button onClick={resetGate} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={savePreset} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}

        {/* Noise Gate Parameters */}
        <div className="space-y-6">
          {/* Threshold */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Threshold: {threshold.toFixed(1)} dB
            </label>
            <Slider
              value={[threshold]}
              onValueChange={([value]) => updateThreshold(value)}
              min={-80}
              max={-10}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Level below which audio is muted
            </p>
          </div>

          {/* Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Range (Ratio): {ratio.toFixed(1)}:1
            </label>
            <Slider
              value={[ratio]}
              onValueChange={([value]) => updateRatio(value)}
              min={1}
              max={30}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              How much the gate reduces noise (higher = more aggressive)
            </p>
          </div>

          {/* Attack */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Attack: {(attack * 1000).toFixed(1)} ms
            </label>
            <Slider
              value={[attack * 1000]}
              onValueChange={([value]) => updateAttack(value / 1000)}
              min={0}
              max={50}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              How fast gate opens when signal exceeds threshold
            </p>
          </div>

          {/* Release */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Release: {(release * 1000).toFixed(0)} ms
            </label>
            <Slider
              value={[release * 1000]}
              onValueChange={([value]) => updateRelease(value / 1000)}
              min={10}
              max={1000}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              How fast gate closes when signal drops below threshold
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Noise Gate Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Set threshold just above the noise floor</li>
            <li>• Fast attack (0-5ms) to avoid cutting off transients</li>
            <li>• Medium release (100-300ms) for natural decay</li>
            <li>• Higher ratio for aggressive noise removal</li>
            <li>• Test with actual recording to avoid cutting wanted sounds</li>
          </ul>
        </div>

        {/* Use Cases */}
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2 text-blue-400">Perfect For:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>✓ Removing background hiss from vocals</li>
            <li>✓ Cleaning up drum recordings</li>
            <li>✓ Reducing room noise in podcast recordings</li>
            <li>✓ Eliminating amp buzz from guitar tracks</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
