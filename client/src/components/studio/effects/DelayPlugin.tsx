import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Timer, RotateCcw, Save, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DelayPluginProps {
  audioUrl?: string;
  onClose?: () => void;
}

export function DelayPlugin({ audioUrl, onClose }: DelayPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const feedbackGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [delayTime, setDelayTime] = useState(0.3); // seconds
  const [feedback, setFeedback] = useState(40); // percentage
  const [wetMix, setWetMix] = useState(30); // percentage
  const [delayType, setDelayType] = useState('digital');
  const [filterFreq, setFilterFreq] = useState(8000); // Hz for tape/analog simulation

  useEffect(() => {
    if (!audioUrl) return;

    // Initialize Web Audio API
    audioContextRef.current = new AudioContext();
    audioElementRef.current = new Audio(audioUrl);
    audioElementRef.current.crossOrigin = 'anonymous';
    
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
      audioElementRef.current
    );

    // Create delay node
    delayNodeRef.current = audioContextRef.current.createDelay(5.0); // Max 5 seconds
    delayNodeRef.current.delayTime.value = delayTime;

    // Create feedback gain
    feedbackGainRef.current = audioContextRef.current.createGain();
    feedbackGainRef.current.gain.value = feedback / 100;

    // Create dry/wet gains
    dryGainRef.current = audioContextRef.current.createGain();
    wetGainRef.current = audioContextRef.current.createGain();
    dryGainRef.current.gain.value = (100 - wetMix) / 100;
    wetGainRef.current.gain.value = wetMix / 100;

    // Create filter for tape/analog simulation
    filterRef.current = audioContextRef.current.createBiquadFilter();
    filterRef.current.type = 'lowpass';
    filterRef.current.frequency.value = filterFreq;

    // Signal routing:
    // Source -> Dry Gain -> Destination (dry signal)
    // Source -> Delay -> Filter -> Wet Gain -> Destination (wet signal)
    //           ^                    |
    //           +-- Feedback Gain <--+
    
    sourceNodeRef.current.connect(dryGainRef.current);
    dryGainRef.current.connect(audioContextRef.current.destination);

    sourceNodeRef.current.connect(delayNodeRef.current);
    delayNodeRef.current.connect(filterRef.current);
    filterRef.current.connect(wetGainRef.current);
    wetGainRef.current.connect(audioContextRef.current.destination);

    // Feedback loop
    filterRef.current.connect(feedbackGainRef.current);
    feedbackGainRef.current.connect(delayNodeRef.current);

    // Apply delay type characteristics
    applyDelayType(delayType);

    return () => {
      audioElementRef.current?.pause();
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  const applyDelayType = (type: string) => {
    if (!filterRef.current) return;

    switch (type) {
      case 'tape':
        // Tape delay: warmer, darker, slight modulation
        filterRef.current.frequency.value = 4000;
        filterRef.current.Q.value = 0.5;
        break;
      case 'analog':
        // Analog delay: warm, slightly filtered
        filterRef.current.frequency.value = 6000;
        filterRef.current.Q.value = 0.7;
        break;
      case 'digital':
        // Digital delay: clean, full frequency
        filterRef.current.frequency.value = 20000;
        filterRef.current.Q.value = 0.1;
        break;
      case 'slapback':
        // Slapback: short delay, low feedback
        filterRef.current.frequency.value = 12000;
        if (delayNodeRef.current) {
          delayNodeRef.current.delayTime.value = Math.min(delayTime, 0.12);
        }
        if (feedbackGainRef.current) {
          feedbackGainRef.current.gain.value = Math.min(feedback / 100, 0.2);
        }
        break;
      case 'pingpong':
        // Ping-pong simulation (mono approximation)
        filterRef.current.frequency.value = 10000;
        break;
    }
  };

  const updateDelayTime = (value: number) => {
    setDelayTime(value);
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.setValueAtTime(
        value,
        audioContextRef.current?.currentTime || 0
      );
    }
  };

  const updateFeedback = (value: number) => {
    setFeedback(value);
    if (feedbackGainRef.current) {
      // Clamp feedback to prevent runaway
      const clampedValue = Math.min(value, 95) / 100;
      feedbackGainRef.current.gain.value = clampedValue;
    }
  };

  const updateWetMix = (value: number) => {
    setWetMix(value);
    if (dryGainRef.current && wetGainRef.current) {
      dryGainRef.current.gain.value = (100 - value) / 100;
      wetGainRef.current.gain.value = value / 100;
    }
  };

  const updateDelayType = (value: string) => {
    setDelayType(value);
    applyDelayType(value);
  };

  const syncToTempo = (bpm: number, subdivision: string) => {
    // Calculate delay time based on BPM and note subdivision
    const beatDuration = 60 / bpm; // seconds per beat
    let multiplier = 1;

    switch (subdivision) {
      case '1/4': multiplier = 1; break;
      case '1/8': multiplier = 0.5; break;
      case '1/16': multiplier = 0.25; break;
      case '1/4T': multiplier = 2/3; break; // Triplet
      case '1/8T': multiplier = 1/3; break;
      case 'dotted-1/8': multiplier = 0.75; break;
    }

    const syncedTime = beatDuration * multiplier;
    updateDelayTime(Math.min(syncedTime, 5)); // Cap at 5 seconds
  };

  const resetDelay = () => {
    updateDelayTime(0.3);
    updateFeedback(40);
    updateWetMix(30);
    updateDelayType('digital');
    toast({ title: 'Delay Reset', description: 'All settings reset to defaults' });
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
      name: `Delay Preset ${new Date().toLocaleTimeString()}`,
      settings: { delayTime, feedback, wetMix, delayType },
    };
    localStorage.setItem('delay-preset-last', JSON.stringify(preset));
    toast({
      title: 'Preset Saved',
      description: 'Delay settings saved to browser',
    });
  };

  // Convert delay time to ms for display
  const delayMs = Math.round(delayTime * 1000);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-600 rounded-lg">
              <Timer className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Delay / Echo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Time-based echo effect
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
            <Button onClick={resetDelay} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={savePreset} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}

        {/* Delay Parameters */}
        <div className="space-y-6">
          {/* Delay Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Delay Type</label>
            <Select value={delayType} onValueChange={updateDelayType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="digital">Digital (Clean)</SelectItem>
                <SelectItem value="tape">Tape (Warm)</SelectItem>
                <SelectItem value="analog">Analog (Vintage)</SelectItem>
                <SelectItem value="slapback">Slapback (Short)</SelectItem>
                <SelectItem value="pingpong">Ping-Pong</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the delay character
            </p>
          </div>

          {/* Delay Time */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Delay Time: {delayMs}ms ({delayTime.toFixed(2)}s)
            </label>
            <Slider
              value={[delayTime]}
              onValueChange={([value]) => updateDelayTime(value)}
              min={0.01}
              max={2}
              step={0.01}
            />
            <div className="flex gap-2 mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => syncToTempo(120, '1/4')}
                className="text-xs"
              >
                1/4 @120
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => syncToTempo(120, '1/8')}
                className="text-xs"
              >
                1/8 @120
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => syncToTempo(120, 'dotted-1/8')}
                className="text-xs"
              >
                Dotted 1/8
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Time between echoes (use buttons for tempo sync)
            </p>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Feedback: {feedback}%
            </label>
            <Slider
              value={[feedback]}
              onValueChange={([value]) => updateFeedback(value)}
              min={0}
              max={95}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              How many times the echo repeats (capped at 95% for safety)
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
              Balance between dry and delayed signal
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Delay Tips:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Vocals:</strong> 1/8 note delay, 20-30% feedback, 15-25% wet</li>
            <li>• <strong>Guitar:</strong> Dotted 1/8 for U2-style, 30-40% feedback</li>
            <li>• <strong>Slapback:</strong> 80-120ms, low feedback, for rockabilly/vocals</li>
            <li>• <strong>Ambient:</strong> Long delays (500ms+), high feedback, tape mode</li>
            <li>• Sync delay to your track's BPM for rhythmic echoes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
