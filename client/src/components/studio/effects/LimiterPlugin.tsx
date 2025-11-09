import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LimiterPluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function LimiterPlugin({ audioUrl, onClose }: LimiterPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const makeupGainRef = useRef<GainNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [ceiling, setCeiling] = useState(-0.1);
  const [release, setRelease] = useState(0.01);
  const [makeupGain, setMakeupGain] = useState(0);

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create limiter (compressor with extreme settings)
    limiterRef.current = audioContextRef.current.createDynamicsCompressor();
    limiterRef.current.threshold.value = ceiling;
    limiterRef.current.knee.value = 0; // Hard knee for limiting
    limiterRef.current.ratio.value = 20; // Very high ratio
    limiterRef.current.attack.value = 0; // Instant attack
    limiterRef.current.release.value = release;

    // Create makeup gain
    makeupGainRef.current = audioContextRef.current.createGain();
    makeupGainRef.current.gain.value = Math.pow(10, makeupGain / 20);

    // Connect: source -> limiter -> makeup gain -> destination
    sourceNodeRef.current
      .connect(limiterRef.current)
      .connect(makeupGainRef.current)
      .connect(audioContextRef.current.destination);

    return () => {
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  const updateCeiling = (value: number) => {
    setCeiling(value);
    if (limiterRef.current) {
      limiterRef.current.threshold.value = value;
    }
  };

  const updateRelease = (value: number) => {
    setRelease(value);
    if (limiterRef.current) {
      limiterRef.current.release.value = value;
    }
  };

  const updateMakeupGain = (value: number) => {
    setMakeupGain(value);
    if (makeupGainRef.current) {
      makeupGainRef.current.gain.value = Math.pow(10, value / 20);
    }
  };

  const resetLimiter = () => {
    updateCeiling(-0.1);
    updateRelease(0.01);
    updateMakeupGain(0);
    toast({ title: 'Limiter Reset', description: 'All settings reset to defaults' });
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
      name: `Limiter Preset ${new Date().toLocaleTimeString()}`,
      settings: { ceiling, release, makeupGain },
    };
    localStorage.setItem('limiter-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: 'Limiter settings saved to browser',
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-lg">
              <TrendingDown className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Peak Limiter</CardTitle>
              <p className="text-sm text-muted-foreground">
                Prevent clipping and maximize loudness
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
            <Button onClick={resetLimiter} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={savePreset} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}

        {/* Limiter Parameters */}
        <div className="space-y-6">
          {/* Ceiling */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Ceiling: {ceiling.toFixed(2)} dBFS
            </label>
            <Slider
              value={[ceiling]}
              onValueChange={([value]) => updateCeiling(value)}
              min={-10}
              max={0}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Maximum output level (prevent clipping at 0 dBFS)
            </p>
          </div>

          {/* Release */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Release: {(release * 1000).toFixed(1)} ms
            </label>
            <Slider
              value={[release * 1000]}
              onValueChange={([value]) => updateRelease(value / 1000)}
              min={1}
              max={100}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              How fast the limiter recovers after reducing peaks
            </p>
          </div>

          {/* Makeup Gain */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Makeup Gain: {makeupGain > 0 ? '+' : ''}{makeupGain.toFixed(1)} dB
            </label>
            <Slider
              value={[makeupGain]}
              onValueChange={([value]) => updateMakeupGain(value)}
              min={0}
              max={12}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Boost overall level to compensate for limiting
            </p>
          </div>
        </div>

        {/* Visual Indicator */}
        <div className="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-4 rounded-full relative">
          <div 
            className="absolute top-0 h-full bg-black/30 rounded-full"
            style={{ 
              left: 0,
              right: `${((ceiling + 10) / 10) * 100}%`
            }}
          />
          <div className="absolute top-1/2 -translate-y-1/2 text-xs text-white font-bold left-2">
            Safe Zone
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Limiter Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Set ceiling to -0.1 dBFS to prevent clipping</li>
            <li>• Use on master bus for final loudness control</li>
            <li>• Fast release (1-10ms) for transparent limiting</li>
            <li>• Slower release (20-50ms) for more audible pumping effect</li>
            <li>• Add makeup gain to match perceived loudness</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
