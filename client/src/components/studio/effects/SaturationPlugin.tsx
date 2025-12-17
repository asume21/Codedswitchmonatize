import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flame, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SaturationPluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function SaturationPlugin({ audioUrl, onClose }: SaturationPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const waveShaperRef = useRef<WaveShaperNode | null>(null);
  const inputGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  const highpassRef = useRef<BiquadFilterNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [drive, setDrive] = useState(30); // percentage 0-100
  const [tone, setTone] = useState(8000); // Hz - lowpass filter
  const [wetMix, setWetMix] = useState(100); // percentage
  const [satType, setSatType] = useState('tape'); // tape, tube, transistor, fuzz, bitcrush
  const [outputLevel, setOutputLevel] = useState(0); // dB compensation

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create nodes
    inputGainRef.current = audioContextRef.current.createGain();
    outputGainRef.current = audioContextRef.current.createGain();
    dryGainRef.current = audioContextRef.current.createGain();
    wetGainRef.current = audioContextRef.current.createGain();
    waveShaperRef.current = audioContextRef.current.createWaveShaper();
    lowpassRef.current = audioContextRef.current.createBiquadFilter();
    highpassRef.current = audioContextRef.current.createBiquadFilter();

    // Configure filters
    lowpassRef.current.type = 'lowpass';
    lowpassRef.current.frequency.value = tone;
    highpassRef.current.type = 'highpass';
    highpassRef.current.frequency.value = 20; // Remove DC offset

    // Set initial values
    updateDrive(drive);
    updateMix(wetMix);
    updateTone(tone);
    updateSatType(satType);

    // Signal routing:
    // Source -> Input Gain -> WaveShaper -> Lowpass -> Highpass -> Output Gain -> Wet Gain -> Destination
    // Source -> Dry Gain -> Destination
    
    sourceNodeRef.current.connect(inputGainRef.current);
    inputGainRef.current.connect(waveShaperRef.current);
    waveShaperRef.current.connect(lowpassRef.current);
    lowpassRef.current.connect(highpassRef.current);
    highpassRef.current.connect(outputGainRef.current);
    outputGainRef.current.connect(wetGainRef.current);
    wetGainRef.current.connect(audioContextRef.current.destination);

    sourceNodeRef.current.connect(dryGainRef.current);
    dryGainRef.current.connect(audioContextRef.current.destination);

    return () => {
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  // Generate waveshaper curve based on saturation type
  const generateCurve = (type: string, amount: number): Float32Array<ArrayBuffer> => {
    const samples = 44100;
    const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>;
    const k = amount; // 0-100

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1; // -1 to 1

      switch (type) {
        case 'tape':
          // Soft saturation - tape-like warmth
          curve[i] = Math.tanh(x * (1 + k / 25));
          break;

        case 'tube':
          // Asymmetric tube-like distortion
          if (x >= 0) {
            curve[i] = Math.tanh(x * (1 + k / 20));
          } else {
            curve[i] = Math.tanh(x * (1 + k / 30)) * 0.9;
          }
          break;

        case 'transistor':
          // Hard clipping - transistor overdrive
          const threshold = 1 - (k / 150);
          if (x > threshold) {
            curve[i] = threshold + (x - threshold) * 0.1;
          } else if (x < -threshold) {
            curve[i] = -threshold + (x + threshold) * 0.1;
          } else {
            curve[i] = x;
          }
          break;

        case 'fuzz':
          // Extreme distortion - fuzz pedal
          const fuzzAmount = 1 + k / 10;
          curve[i] = Math.sign(x) * (1 - Math.exp(-Math.abs(x * fuzzAmount)));
          break;

        case 'bitcrush':
          // Bit reduction effect
          const bits = Math.max(2, 16 - Math.floor(k / 7));
          const levels = Math.pow(2, bits);
          curve[i] = Math.round(x * levels) / levels;
          break;

        default:
          curve[i] = x;
      }
    }

    return curve;
  };

  const updateDrive = (value: number) => {
    setDrive(value);
    if (inputGainRef.current && waveShaperRef.current) {
      // Increase input gain to drive the waveshaper harder
      const inputBoost = 1 + (value / 25); // 1x to 5x
      inputGainRef.current.gain.value = inputBoost;
      
      // Regenerate curve
      waveShaperRef.current.curve = generateCurve(satType, value);
      
      // Compensate output to maintain similar volume
      if (outputGainRef.current) {
        const compensation = 1 / Math.sqrt(inputBoost);
        outputGainRef.current.gain.value = compensation * Math.pow(10, outputLevel / 20);
      }
    }
  };

  const updateTone = (value: number) => {
    setTone(value);
    if (lowpassRef.current) {
      lowpassRef.current.frequency.value = value;
    }
  };

  const updateMix = (value: number) => {
    setWetMix(value);
    if (dryGainRef.current && wetGainRef.current) {
      dryGainRef.current.gain.value = (100 - value) / 100;
      wetGainRef.current.gain.value = value / 100;
    }
  };

  const updateSatType = (value: string) => {
    setSatType(value);
    if (waveShaperRef.current) {
      waveShaperRef.current.curve = generateCurve(value, drive);
      
      // Set appropriate oversample for quality
      if (value === 'bitcrush') {
        waveShaperRef.current.oversample = 'none';
      } else {
        waveShaperRef.current.oversample = '4x'; // Reduce aliasing
      }
    }
  };

  const updateOutputLevel = (value: number) => {
    setOutputLevel(value);
    if (outputGainRef.current && inputGainRef.current) {
      const inputBoost = 1 + (drive / 25);
      const compensation = 1 / Math.sqrt(inputBoost);
      outputGainRef.current.gain.value = compensation * Math.pow(10, value / 20);
    }
  };

  const resetSaturation = () => {
    updateDrive(30);
    updateTone(8000);
    updateMix(100);
    updateSatType('tape');
    updateOutputLevel(0);
    toast({ title: 'Saturation Reset', description: 'All settings reset to defaults' });
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
      name: `${satType} Preset ${new Date().toLocaleTimeString()}`,
      settings: { drive, tone, wetMix, satType, outputLevel },
    };
    localStorage.setItem('saturation-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: `${satType} settings saved to browser`,
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 rounded-lg">
              <Flame className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Saturation / Distortion</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add warmth, grit, and harmonic richness
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
            <Button onClick={resetSaturation} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={savePreset} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}

        {/* Saturation Parameters */}
        <div className="space-y-6">
          {/* Saturation Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Saturation Type</label>
            <Select value={satType} onValueChange={updateSatType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tape">Tape (Warm & Smooth)</SelectItem>
                <SelectItem value="tube">Tube (Rich & Musical)</SelectItem>
                <SelectItem value="transistor">Transistor (Punchy)</SelectItem>
                <SelectItem value="fuzz">Fuzz (Aggressive)</SelectItem>
                <SelectItem value="bitcrush">Bitcrush (Lo-Fi)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {satType === 'tape' && 'Soft saturation with gentle compression - great for warmth'}
              {satType === 'tube' && 'Asymmetric harmonics like vintage tube amps'}
              {satType === 'transistor' && 'Hard clipping for aggressive overdrive'}
              {satType === 'fuzz' && 'Extreme distortion for guitars and synths'}
              {satType === 'bitcrush' && 'Digital degradation for lo-fi aesthetics'}
            </p>
          </div>

          {/* Drive */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Drive: {drive}%
            </label>
            <Slider
              value={[drive]}
              onValueChange={([value]) => updateDrive(value)}
              min={0}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Amount of saturation/distortion applied
            </p>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Tone: {tone >= 1000 ? `${(tone / 1000).toFixed(1)}kHz` : `${tone}Hz`}
            </label>
            <Slider
              value={[tone]}
              onValueChange={([value]) => updateTone(value)}
              min={500}
              max={20000}
              step={100}
            />
            <p className="text-xs text-muted-foreground">
              Lowpass filter to tame harsh high frequencies
            </p>
          </div>

          {/* Output Level */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Output: {outputLevel > 0 ? '+' : ''}{outputLevel} dB
            </label>
            <Slider
              value={[outputLevel]}
              onValueChange={([value]) => updateOutputLevel(value)}
              min={-12}
              max={12}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground">
              Adjust output level to match bypassed volume
            </p>
          </div>

          {/* Wet/Dry Mix */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Mix: {wetMix}%
            </label>
            <Slider
              value={[wetMix]}
              onValueChange={([value]) => updateMix(value)}
              min={0}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Blend between clean and saturated signal
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Saturation Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Vocals:</strong> Tape at 15-30% for warmth without harshness</li>
            <li>• <strong>Drums:</strong> Tube or Transistor for punch and presence</li>
            <li>• <strong>Bass:</strong> Tape or Tube to help cut through the mix</li>
            <li>• <strong>Synths:</strong> Fuzz for aggressive leads, Bitcrush for lo-fi</li>
            <li>• <strong>Master Bus:</strong> Very subtle tape (5-15%) for analog warmth</li>
            <li>• Use the Tone control to prevent harsh high frequencies</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
