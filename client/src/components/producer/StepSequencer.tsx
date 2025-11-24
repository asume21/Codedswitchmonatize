import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RotateCcw, Volume2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface DrumTrack {
  id: string;
  name: string;
  color: string;
  pattern: boolean[];
  velocity: number[];
  probability: number[];
  muted: boolean;
  solo: boolean;
  volume: number;
}

interface StepSequencerProps {
  bpm?: number;
  onPatternChange?: (tracks: DrumTrack[]) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export function StepSequencer({ 
  bpm = 90, 
  onPatternChange,
  onPlayStateChange 
}: StepSequencerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [swing, setSwing] = useState(0); // 0-100% swing
  const [masterVolume, setMasterVolume] = useState(80);
  const [groove, setGroove] = useState(0); // accent backbeat intensity
  const [selectedStep, setSelectedStep] = useState<{ trackIndex: number; stepIndex: number } | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Classic hip-hop drum tracks
  const [tracks, setTracks] = useState<DrumTrack[]>([
    {
      id: 'kick',
      name: 'Kick',
      color: 'bg-red-500',
      pattern: new Array(16).fill(false),
      velocity: new Array(16).fill(100),
      probability: new Array(16).fill(100),
      muted: false,
      solo: false,
      volume: 85
    },
    {
      id: 'snare',
      name: 'Snare', 
      color: 'bg-blue-500',
      pattern: new Array(16).fill(false),
      velocity: new Array(16).fill(90),
      probability: new Array(16).fill(100),
      muted: false,
      solo: false,
      volume: 80
    },
    {
      id: 'hihat',
      name: 'Hi-Hat',
      color: 'bg-yellow-500',
      pattern: new Array(16).fill(false),
      velocity: new Array(16).fill(70),
      probability: new Array(16).fill(100),
      muted: false,
      solo: false,
      volume: 60
    },
    {
      id: 'openhat',
      name: 'Open Hat',
      color: 'bg-green-500',
      pattern: new Array(16).fill(false),
      velocity: new Array(16).fill(85),
      probability: new Array(16).fill(100),
      muted: false,
      solo: false,
      volume: 70
    },
    {
      id: 'clap',
      name: 'Clap',
      color: 'bg-purple-500',
      pattern: new Array(16).fill(false),
      velocity: new Array(16).fill(95),
      probability: new Array(16).fill(100),
      muted: false,
      solo: false,
      volume: 75
    },
    {
      id: 'crash',
      name: 'Crash',
      color: 'bg-orange-500',
      pattern: new Array(16).fill(false),
      velocity: new Array(16).fill(100),
      probability: new Array(16).fill(100),
      muted: false,
      solo: false,
      volume: 90
    }
  ]);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
  }, []);

  // Calculate step timing with swing
  const getStepTiming = (step: number) => {
    const baseInterval = (60 / bpm) * 1000 / 4; // 16th notes
    if (step % 2 === 1 && swing > 0) {
      // Delay odd steps for swing feel
      return baseInterval + (baseInterval * swing / 100 * 0.3);
    }
    return baseInterval;
  };

  // Generate classic hip-hop drum sound
  const playDrumSound = async (trackId: string, velocity: number, volume: number) => {
    if (!audioContextRef.current) return;
    
    // Resume audio context if suspended (required by browsers)
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    const ctx = audioContextRef.current;
    const gainNode = ctx.createGain();
    const finalVolume = (velocity / 127) * (volume / 100) * (masterVolume / 100);
    gainNode.gain.value = finalVolume;
    
    let oscillator: OscillatorNode;
    let noiseSource: AudioBufferSourceNode | null = null;
    
    switch (trackId) {
      case 'kick':
        // Deep punchy kick with quick decay
        oscillator = ctx.createOscillator();
        oscillator.frequency.setValueAtTime(60, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        oscillator.type = 'sine';
        
        const kickGain = ctx.createGain();
        kickGain.gain.setValueAtTime(1, ctx.currentTime);
        kickGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        oscillator.connect(kickGain);
        kickGain.connect(gainNode);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.3);
        break;
        
      case 'snare':
        // Crisp snare with noise burst
        oscillator = ctx.createOscillator();
        oscillator.frequency.value = 200;
        oscillator.type = 'triangle';
        
        // Add noise for snare crack
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
          noiseData[i] = (Math.random() * 2 - 1) * 0.3;
        }
        
        noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const snareGain = ctx.createGain();
        snareGain.gain.setValueAtTime(1, ctx.currentTime);
        snareGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        
        oscillator.connect(snareGain);
        noiseSource.connect(snareGain);
        snareGain.connect(gainNode);
        
        oscillator.start();
        noiseSource.start();
        oscillator.stop(ctx.currentTime + 0.15);
        noiseSource.stop(ctx.currentTime + 0.15);
        break;
        
      case 'hihat':
        // Short metallic hi-hat
        const hihatBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const hihatData = hihatBuffer.getChannelData(0);
        for (let i = 0; i < hihatData.length; i++) {
          hihatData[i] = (Math.random() * 2 - 1) * Math.pow((1 - i / hihatData.length), 2);
        }
        
        noiseSource = ctx.createBufferSource();
        noiseSource.buffer = hihatBuffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        
        noiseSource.connect(filter);
        filter.connect(gainNode);
        noiseSource.start();
        noiseSource.stop(ctx.currentTime + 0.05);
        break;
        
      case 'openhat':
        // Longer open hi-hat
        const openBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
        const openData = openBuffer.getChannelData(0);
        for (let i = 0; i < openData.length; i++) {
          openData[i] = (Math.random() * 2 - 1) * Math.pow((1 - i / openData.length), 1.5) * 0.7;
        }
        
        noiseSource = ctx.createBufferSource();
        noiseSource.buffer = openBuffer;
        
        const openFilter = ctx.createBiquadFilter();
        openFilter.type = 'highpass';
        openFilter.frequency.value = 6000;
        
        noiseSource.connect(openFilter);
        openFilter.connect(gainNode);
        noiseSource.start();
        noiseSource.stop(ctx.currentTime + 0.3);
        break;
        
      case 'clap':
        // Hand clap simulation
        for (let i = 0; i < 3; i++) {
          const clapDelay = i * 0.01;
          const clapBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
          const clapData = clapBuffer.getChannelData(0);
          
          for (let j = 0; j < clapData.length; j++) {
            clapData[j] = (Math.random() * 2 - 1) * Math.pow((1 - j / clapData.length), 3);
          }
          
          const clapSource = ctx.createBufferSource();
          clapSource.buffer = clapBuffer;
          clapSource.connect(gainNode);
          clapSource.start(ctx.currentTime + clapDelay);
          clapSource.stop(ctx.currentTime + clapDelay + 0.1);
        }
        break;
        
      case 'crash':
        // Crash cymbal
        const crashBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const crashData = crashBuffer.getChannelData(0);
        for (let i = 0; i < crashData.length; i++) {
          crashData[i] = (Math.random() * 2 - 1) * Math.pow((1 - i / crashData.length), 0.5) * 0.8;
        }
        
        noiseSource = ctx.createBufferSource();
        noiseSource.buffer = crashBuffer;
        
        const crashFilter = ctx.createBiquadFilter();
        crashFilter.type = 'bandpass';
        crashFilter.frequency.value = 5000;
        crashFilter.Q.value = 0.5;
        
        const crashGain = ctx.createGain();
        crashGain.gain.setValueAtTime(1, ctx.currentTime);
        crashGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2);
        
        noiseSource.connect(crashFilter);
        crashFilter.connect(crashGain);
        crashGain.connect(gainNode);
        noiseSource.start();
        noiseSource.stop(ctx.currentTime + 2);
        break;
    }
    
    gainNode.connect(ctx.destination);
  };

  // Main sequencer loop
  useEffect(() => {
    if (isPlaying) {
      const stepTime = getStepTiming(currentStep);
      
      intervalRef.current = setTimeout(() => {
        // Play active tracks for current step
        const hasSolo = tracks.some(track => track.solo);
        
        tracks.forEach(track => {
          if (track.pattern[currentStep] && !track.muted) {
            // If any track is soloed, only play soloed tracks
            if (!hasSolo || track.solo) {
              const probability = track.probability?.[currentStep] ?? 100;
              if (Math.random() * 100 > probability) {
                return;
              }
              
              const isBackbeat = currentStep % 4 === 1 || currentStep % 4 === 3;
              const grooveBoost = groove > 0 ? 1 + (groove / 200) * (isBackbeat ? 1 : -0.4) : 1;
              const effectiveVelocity = Math.min(127, Math.max(0, track.velocity[currentStep] * grooveBoost));
              
              playDrumSound(track.id, effectiveVelocity, track.volume);
            }
          }
        });
        
        // Move to next step
        setCurrentStep((prev) => (prev + 1) % 16);
      }, stepTime);
    }
    
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isPlaying, currentStep, tracks, swing, masterVolume, groove]);

  const togglePlay = () => {
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    onPlayStateChange?.(newPlaying);
    
    if (!newPlaying) {
      setCurrentStep(0);
    }
  };

  // Sync with master play state
  useEffect(() => {
    const masterPlayHandler = (event: any) => {
      const shouldPlay = event.detail?.playing;
      console.log(`🥁 Drums received master control: ${shouldPlay ? 'PLAY' : 'STOP'}`);
      
      if (shouldPlay !== undefined) {
        setIsPlaying(shouldPlay);
        if (!shouldPlay) {
          setCurrentStep(0);
        }
      }
    };

    window.addEventListener('masterPlayControl', masterPlayHandler);
    return () => window.removeEventListener('masterPlayControl', masterPlayHandler);
  }, []);

  const toggleStep = (trackIndex: number, stepIndex: number) => {
    const newTracks = [...tracks];
    const wasActive = newTracks[trackIndex].pattern[stepIndex];
    newTracks[trackIndex].pattern[stepIndex] = !wasActive;
    setTracks(newTracks);
    onPatternChange?.(newTracks);
    
    // Live playback - play the sound immediately when activated
    if (!wasActive && newTracks[trackIndex].pattern[stepIndex]) {
      const track = newTracks[trackIndex];
      playDrumSound(track.id, track.velocity[stepIndex], track.volume);
    }
  };

  const setVelocity = (trackIndex: number, stepIndex: number, velocity: number) => {
    const newTracks = [...tracks];
    newTracks[trackIndex].velocity[stepIndex] = velocity;
    setTracks(newTracks);
    
    // Live preview - play sound with new velocity if step is active
    if (newTracks[trackIndex].pattern[stepIndex]) {
      const track = newTracks[trackIndex];
      playDrumSound(track.id, velocity, track.volume);
    }
  };

  const setProbability = (trackIndex: number, stepIndex: number, probability: number) => {
    const newTracks = [...tracks];
    newTracks[trackIndex].probability[stepIndex] = probability;
    setTracks(newTracks);
  };

  const toggleMute = (trackIndex: number) => {
    const newTracks = [...tracks];
    newTracks[trackIndex].muted = !newTracks[trackIndex].muted;
    setTracks(newTracks);
  };

  const toggleSolo = (trackIndex: number) => {
    const newTracks = [...tracks];
    newTracks[trackIndex].solo = !newTracks[trackIndex].solo;
    setTracks(newTracks);
  };

  const setTrackVolume = (trackIndex: number, volume: number) => {
    const newTracks = [...tracks];
    newTracks[trackIndex].volume = volume;
    setTracks(newTracks);
    
    // Live preview - play sound with new volume
    const track = newTracks[trackIndex];
    playDrumSound(track.id, 100, volume);
  };

  const clearPattern = () => {
    const newTracks = tracks.map(track => ({
      ...track,
      pattern: new Array(16).fill(false),
      probability: new Array(16).fill(100),
    }));
    setTracks(newTracks);
    setSelectedStep(null);
    onPatternChange?.(newTracks);
  };

  const loadClassicHipHopPattern = () => {
    const newTracks = [...tracks];
    
    // Classic "All Eyez On Me" style pattern
    newTracks[0].pattern = [true, false, false, false, false, false, true, false, true, false, false, false, false, false, true, false]; // Kick
    newTracks[1].pattern = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false]; // Snare
    newTracks[2].pattern = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false]; // Hi-hat
    newTracks[3].pattern = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true]; // Open hat
    newTracks[4].pattern = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false]; // Clap (doubles snare)
    
    setTracks(newTracks);
    onPatternChange?.(newTracks);
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Step Sequencer</h2>
        <div className="flex items-center gap-4">
          <Badge variant="outline">{bpm} BPM</Badge>
          <Badge variant="outline">Step {currentStep + 1}/16</Badge>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-4">
        <Button
          onClick={togglePlay}
          size="lg"
          data-testid="button-sequencer-play"
          className={isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}
        >
          {isPlaying ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {isPlaying ? "Stop" : "Play"}
        </Button>
        
        <Button onClick={clearPattern} variant="outline" data-testid="button-clear-pattern">
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear
        </Button>
        
        <Button onClick={loadClassicHipHopPattern} variant="outline" data-testid="button-load-pattern">
          Load Hip-Hop Pattern
        </Button>
      </div>

      {/* Master Controls */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          <span className="text-sm font-medium">Master</span>
          <Slider
            value={[masterVolume]}
            onValueChange={(value) => setMasterVolume(value[0])}
            max={100}
            step={1}
            className="w-24"
            data-testid="slider-master-volume"
          />
          <span className="text-sm w-8">{masterVolume}</span>
        </div>
        
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Swing</span>
        <Slider
          value={[swing]}
          onValueChange={(value) => setSwing(value[0])}
          max={100}
          step={1}
          className="w-24"
          data-testid="slider-swing"
        />
        <span className="text-sm w-8">{swing}%</span>
      </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Groove</span>
          <Slider
            value={[groove]}
            onValueChange={(value) => setGroove(value[0])}
            max={100}
            step={1}
            className="w-24"
          />
          <span className="text-sm w-10">{groove}%</span>
        </div>
      </div>

      {selectedStep && tracks[selectedStep.trackIndex] && (
        <div className="border border-gray-700 rounded p-3 bg-gray-850">
          <div className="text-sm text-white mb-2">
            {tracks[selectedStep.trackIndex].name} — Step {selectedStep.stepIndex + 1}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Velocity</span>
              <Slider
                value={[tracks[selectedStep.trackIndex].velocity[selectedStep.stepIndex]]}
                onValueChange={(value) => setVelocity(selectedStep.trackIndex, selectedStep.stepIndex, value[0])}
                max={127}
                min={0}
                step={1}
                className="w-32"
              />
              <span className="text-xs text-white w-10 text-right">
                {tracks[selectedStep.trackIndex].velocity[selectedStep.stepIndex]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Probability</span>
              <Slider
                value={[tracks[selectedStep.trackIndex].probability[selectedStep.stepIndex]]}
                onValueChange={(value) => setProbability(selectedStep.trackIndex, selectedStep.stepIndex, value[0])}
                max={100}
                min={0}
                step={5}
                className="w-32"
              />
              <span className="text-xs text-white w-10 text-right">
                {tracks[selectedStep.trackIndex].probability[selectedStep.stepIndex]}%
              </span>
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Step Grid */}
      <div className="space-y-3">
        {tracks.map((track, trackIndex) => (
          <div key={track.id} className="flex items-center gap-2">
            {/* Track Controls */}
            <div className="flex items-center gap-2 w-32">
              <div className={`w-3 h-3 rounded ${track.color}`} />
              <span className="text-sm font-medium flex-1">{track.name}</span>
              <Button
                size="sm"
                variant={track.muted ? "destructive" : "outline"}
                onClick={() => toggleMute(trackIndex)}
                className="h-6 px-2 text-xs"
                data-testid={`button-mute-${track.id}`}
              >
                M
              </Button>
              <Button
                size="sm"
                variant={track.solo ? "default" : "outline"}
                onClick={() => toggleSolo(trackIndex)}
                className="h-6 px-2 text-xs"
                data-testid={`button-solo-${track.id}`}
              >
                S
              </Button>
            </div>

            {/* Step Buttons */}
            <div className="flex gap-1">
              {track.pattern.map((active, stepIndex) => (
                <Button
                  key={stepIndex}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => {
                    setSelectedStep({ trackIndex, stepIndex });
                    toggleStep(trackIndex, stepIndex);
                  }}
                  className={`w-8 h-8 p-0 text-xs ${
                    currentStep === stepIndex && isPlaying 
                      ? 'ring-2 ring-yellow-400 ring-offset-2' 
                      : ''
                  } ${active ? track.color.replace('bg-', 'bg-') : ''} ${
                    selectedStep?.trackIndex === trackIndex && selectedStep.stepIndex === stepIndex
                      ? 'ring-2 ring-blue-400'
                      : ''
                  }`}
                  data-testid={`button-step-${track.id}-${stepIndex}`}
                >
                  {stepIndex + 1}
                </Button>
              ))}
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 ml-4">
              <Slider
                value={[track.volume]}
                onValueChange={(value) => setTrackVolume(trackIndex, value[0])}
                max={100}
                step={1}
                className="w-16"
                data-testid={`slider-volume-${track.id}`}
              />
              <span className="text-xs w-6">{track.volume}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
