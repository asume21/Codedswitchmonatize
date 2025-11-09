import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Radio, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReverbPluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function ReverbPlugin({ audioUrl, onClose }: ReverbPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [roomType, setRoomType] = useState('hall');
  const [wetMix, setWetMix] = useState(30);
  const [decay, setDecay] = useState(2);

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create convolver for reverb
    convolverRef.current = audioContextRef.current.createConvolver();
    
    // Create gain nodes for dry/wet mix
    dryGainRef.current = audioContextRef.current.createGain();
    wetGainRef.current = audioContextRef.current.createGain();
    
    dryGainRef.current.gain.value = (100 - wetMix) / 100;
    wetGainRef.current.gain.value = wetMix / 100;

    // Generate impulse response based on room type
    generateImpulseResponse(roomType, decay);

    // Connect: source -> dry -> destination
    //                -> convolver -> wet -> destination
    sourceNodeRef.current.connect(dryGainRef.current);
    sourceNodeRef.current.connect(convolverRef.current);
    
    convolverRef.current.connect(wetGainRef.current);
    
    dryGainRef.current.connect(audioContextRef.current.destination);
    wetGainRef.current.connect(audioContextRef.current.destination);

    return () => {
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  const generateImpulseResponse = (type: string, decayTime: number) => {
    if (!audioContextRef.current || !convolverRef.current) return;

    const sampleRate = audioContextRef.current.sampleRate;
    const length = sampleRate * decayTime;
    const impulse = audioContextRef.current.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    // Use crypto.getRandomValues for better random quality
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * decayTime / 4));
      // Convert random uint32 to float in range [-1, 1]
      const noise = ((randomValues[i] / 0xFFFFFFFF) * 2 - 1) * decay;
      
      // Different characteristics for different room types
      let modifier = 1;
      if (type === 'room') {
        modifier = i < length * 0.1 ? 1.5 : 0.8;
      } else if (type === 'hall') {
        modifier = i < length * 0.05 ? 1.2 : 1;
      } else if (type === 'plate') {
        modifier = Math.sin(i / 100) * 0.3 + 1;
      } else if (type === 'chamber') {
        modifier = i < length * 0.15 ? 1.8 : 0.9;
      }
      
      impulseL[i] = noise * modifier;
      impulseR[i] = noise * modifier * 0.9; // Slight stereo variation
    }

    convolverRef.current.buffer = impulse;
  };

  const updateRoomType = (value: string) => {
    setRoomType(value);
    generateImpulseResponse(value, decay);
  };

  const updateWetMix = (value: number) => {
    setWetMix(value);
    if (dryGainRef.current && wetGainRef.current) {
      dryGainRef.current.gain.value = (100 - value) / 100;
      wetGainRef.current.gain.value = value / 100;
    }
  };

  const updateDecay = (value: number) => {
    setDecay(value);
    generateImpulseResponse(roomType, value);
  };

  const resetReverb = () => {
    updateRoomType('hall');
    updateWetMix(30);
    updateDecay(2);
    toast({ title: 'Reverb Reset', description: 'All settings reset to defaults' });
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
      name: `Reverb Preset ${new Date().toLocaleTimeString()}`,
      settings: { roomType, wetMix, decay },
    };
    localStorage.setItem('reverb-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: 'Reverb settings saved to browser',
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Radio className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Algorithmic Reverb</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add space and depth
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
            <Button onClick={resetReverb} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={savePreset} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}

        {/* Reverb Parameters */}
        <div className="space-y-6">
          {/* Room Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Room Type</label>
            <Select value={roomType} onValueChange={updateRoomType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room">Small Room</SelectItem>
                <SelectItem value="hall">Concert Hall</SelectItem>
                <SelectItem value="plate">Plate Reverb</SelectItem>
                <SelectItem value="chamber">Chamber</SelectItem>
                <SelectItem value="cathedral">Cathedral</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the acoustic space
            </p>
          </div>

          {/* Wet/Dry Mix */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Wet Mix: {wetMix}%
            </label>
            <Slider
              value={[wetMix]}
              onValueChange={([value]) => updateWetMix(value)}
              min={0}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Balance between dry and reverb signal
            </p>
          </div>

          {/* Decay Time */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Decay Time: {decay.toFixed(1)}s
            </label>
            <Slider
              value={[decay]}
              onValueChange={([value]) => updateDecay(value)}
              min={0.1}
              max={10}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              How long the reverb tail lasts
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Reverb Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Vocals:</strong> Hall or Plate, 15-25% wet, 1.5-2.5s decay</li>
            <li>• <strong>Drums:</strong> Room or Chamber, 10-20% wet, 0.5-1.5s decay</li>
            <li>• <strong>Ambient:</strong> Cathedral, 40-60% wet, 4-8s decay</li>
            <li>• Too much reverb can muddy your mix - use sparingly</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
