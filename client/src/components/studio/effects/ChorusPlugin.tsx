import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Waves, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChorusPluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function ChorusPlugin({ audioUrl, onClose }: ChorusPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const delayNodesRef = useRef<DelayNode[]>([]);
  const lfoNodesRef = useRef<OscillatorNode[]>([]);
  const lfoGainsRef = useRef<GainNode[]>([]);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1.5); // LFO rate in Hz
  const [depth, setDepth] = useState(5); // Modulation depth in ms
  const [wetMix, setWetMix] = useState(50); // percentage
  const [voices, setVoices] = useState(2); // number of chorus voices
  const [effectType, setEffectType] = useState('chorus'); // chorus, flanger, vibrato

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create dry/wet gains
    dryGainRef.current = audioContextRef.current.createGain();
    wetGainRef.current = audioContextRef.current.createGain();
    
    updateMix(wetMix);

    // Build the effect chain
    buildEffectChain();

    return () => {
      // Stop all LFOs
      lfoNodesRef.current.forEach(lfo => {
        try { lfo.stop(); } catch (e) {}
      });
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  const buildEffectChain = () => {
    if (!audioContextRef.current || !sourceNodeRef.current || !dryGainRef.current || !wetGainRef.current) return;

    // Stop existing LFOs
    lfoNodesRef.current.forEach(lfo => {
      try { lfo.stop(); } catch (e) {}
    });

    // Clear existing nodes
    delayNodesRef.current = [];
    lfoNodesRef.current = [];
    lfoGainsRef.current = [];

    // Disconnect source
    try { sourceNodeRef.current.disconnect(); } catch (e) {}

    // Reconnect dry path
    sourceNodeRef.current.connect(dryGainRef.current);
    dryGainRef.current.connect(audioContextRef.current.destination);

    // Create chorus voices
    const numVoices = effectType === 'vibrato' ? 1 : voices;
    const baseDelay = effectType === 'flanger' ? 0.001 : 0.02; // Flanger uses shorter delays
    const maxDepthMs = effectType === 'flanger' ? 3 : depth;

    for (let i = 0; i < numVoices; i++) {
      // Create delay node for this voice
      const delay = audioContextRef.current.createDelay(0.1);
      delay.delayTime.value = baseDelay + (i * 0.005); // Slight offset per voice
      delayNodesRef.current.push(delay);

      // Create LFO (Low Frequency Oscillator) for modulation
      const lfo = audioContextRef.current.createOscillator();
      lfo.type = 'sine';
      // Slightly different rate per voice for richer sound
      lfo.frequency.value = rate * (1 + i * 0.1);
      lfoNodesRef.current.push(lfo);

      // Create gain to control LFO depth
      const lfoGain = audioContextRef.current.createGain();
      lfoGain.gain.value = maxDepthMs / 1000; // Convert ms to seconds
      lfoGainsRef.current.push(lfoGain);

      // Connect LFO -> LFO Gain -> Delay Time
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);

      // Connect source -> delay -> wet gain
      sourceNodeRef.current.connect(delay);
      delay.connect(wetGainRef.current);

      // Start LFO
      lfo.start();
    }

    // Connect wet to destination
    wetGainRef.current.connect(audioContextRef.current.destination);

    // For vibrato, we want 100% wet (pitch modulation only)
    if (effectType === 'vibrato') {
      dryGainRef.current.gain.value = 0;
      wetGainRef.current.gain.value = 1;
    }
  };

  const updateRate = (value: number) => {
    setRate(value);
    lfoNodesRef.current.forEach((lfo, i) => {
      lfo.frequency.value = value * (1 + i * 0.1);
    });
  };

  const updateDepth = (value: number) => {
    setDepth(value);
    const maxDepthMs = effectType === 'flanger' ? Math.min(value, 10) : value;
    lfoGainsRef.current.forEach(gain => {
      gain.gain.value = maxDepthMs / 1000;
    });
  };

  const updateMix = (value: number) => {
    setWetMix(value);
    if (effectType === 'vibrato') {
      // Vibrato is always 100% wet
      if (dryGainRef.current) dryGainRef.current.gain.value = 0;
      if (wetGainRef.current) wetGainRef.current.gain.value = 1;
    } else {
      if (dryGainRef.current) dryGainRef.current.gain.value = (100 - value) / 100;
      if (wetGainRef.current) wetGainRef.current.gain.value = value / 100;
    }
  };

  const updateVoices = (value: number) => {
    setVoices(value);
    buildEffectChain();
  };

  const updateEffectType = (value: string) => {
    setEffectType(value);
    
    // Set appropriate defaults for each effect type
    switch (value) {
      case 'chorus':
        setRate(1.5);
        setDepth(5);
        setVoices(2);
        break;
      case 'flanger':
        setRate(0.5);
        setDepth(2);
        setVoices(1);
        break;
      case 'vibrato':
        setRate(5);
        setDepth(3);
        setVoices(1);
        break;
    }
    
    // Rebuild with new settings
    setTimeout(() => buildEffectChain(), 50);
  };

  const resetEffect = () => {
    updateEffectType('chorus');
    updateRate(1.5);
    updateDepth(5);
    updateMix(50);
    updateVoices(2);
    toast({ title: 'Effect Reset', description: 'All settings reset to defaults' });
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
      name: `${effectType} Preset ${new Date().toLocaleTimeString()}`,
      settings: { rate, depth, wetMix, voices, effectType },
    };
    localStorage.setItem('chorus-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: `${effectType} settings saved to browser`,
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Waves className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Chorus / Flanger / Vibrato</CardTitle>
              <p className="text-sm text-muted-foreground">
                Modulation effects for width and movement
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
            <Button onClick={resetEffect} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={savePreset} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}

        {/* Effect Parameters */}
        <div className="space-y-6">
          {/* Effect Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Effect Type</label>
            <Select value={effectType} onValueChange={updateEffectType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chorus">Chorus (Width & Shimmer)</SelectItem>
                <SelectItem value="flanger">Flanger (Jet/Swoosh)</SelectItem>
                <SelectItem value="vibrato">Vibrato (Pitch Wobble)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {effectType === 'chorus' && 'Adds width and thickness by layering delayed copies'}
              {effectType === 'flanger' && 'Creates sweeping, jet-like sounds with short delays'}
              {effectType === 'vibrato' && 'Pure pitch modulation without dry signal'}
            </p>
          </div>

          {/* Rate */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Rate: {rate.toFixed(2)} Hz
            </label>
            <Slider
              value={[rate]}
              onValueChange={([value]) => updateRate(value)}
              min={0.1}
              max={effectType === 'vibrato' ? 10 : 5}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Speed of the modulation (LFO frequency)
            </p>
          </div>

          {/* Depth */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Depth: {depth.toFixed(1)} ms
            </label>
            <Slider
              value={[depth]}
              onValueChange={([value]) => updateDepth(value)}
              min={0.5}
              max={effectType === 'flanger' ? 10 : 20}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground">
              Amount of modulation (how much the delay time varies)
            </p>
          </div>

          {/* Voices (Chorus only) */}
          {effectType === 'chorus' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Voices: {voices}
              </label>
              <Slider
                value={[voices]}
                onValueChange={([value]) => updateVoices(value)}
                min={1}
                max={4}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Number of chorus layers (more = thicker sound)
              </p>
            </div>
          )}

          {/* Wet/Dry Mix (not for vibrato) */}
          {effectType !== 'vibrato' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Wet Mix: {wetMix}%
              </label>
              <Slider
                value={[wetMix]}
                onValueChange={([value]) => updateMix(value)}
                min={0}
                max={100}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Balance between dry and effected signal
              </p>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Modulation Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Chorus on Vocals:</strong> Subtle settings (rate 1-2Hz, depth 3-5ms, 30% wet)</li>
            <li>• <strong>Chorus on Guitar:</strong> Classic 80s sound (rate 0.5-1Hz, depth 5-10ms, 50% wet)</li>
            <li>• <strong>Flanger:</strong> Slow rate for sweeps, fast for metallic sounds</li>
            <li>• <strong>Vibrato:</strong> Use sparingly - great for vintage organ/synth sounds</li>
            <li>• Multiple voices create a richer, more complex chorus effect</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
