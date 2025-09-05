import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Target, Zap, Filter, RotateCcw, Shuffle, 
  Layers, Activity 
} from "lucide-react";
import * as Tone from "tone";

interface WavetableParams {
  waveform: string;
  position: number;
  modulation: number;
  harmonics: number;
  phase: number;
  sync: boolean;
  morphing: number;
  brightness: number;
  character: number;
  motion: number;
}

interface LFO {
  rate: number;
  depth: number;
  shape: string;
  target: string;
  sync: boolean;
}

function WavetableOscillator() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [wavetableParams, setWavetableParams] = useState<WavetableParams>({
    waveform: "sawtooth",
    position: 0,
    modulation: 30,
    harmonics: 60,
    phase: 0,
    sync: false,
    morphing: 40,
    brightness: 70,
    character: 50,
    motion: 20
  });
  
  const [lfos, setLfos] = useState<LFO[]>([
    { rate: 2, depth: 50, shape: "sine", target: "position", sync: true },
    { rate: 0.5, depth: 30, shape: "triangle", target: "harmonics", sync: true },
    { rate: 4, depth: 70, shape: "square", target: "brightness", sync: false },
    { rate: 1, depth: 40, shape: "sawtooth", target: "morphing", sync: true }
  ]);
  
  const [selectedLFO, setSelectedLFO] = useState(0);
  const [envelope, setEnvelope] = useState({
    attack: 0.1,
    decay: 0.3,
    sustain: 0.7,
    release: 1.0
  });
  
  const [filter, setFilter] = useState({
    type: "lowpass",
    frequency: 2000,
    resonance: 5,
    drive: 0,
    slope: 24
  });
  
  const synthRef = useRef<Tone.Oscillator | null>(null);
  const lfoRefs = useRef<Tone.LFO[]>([]);

  useEffect(() => {
    const initSynths = async () => {
      await Tone.start();
      
      // Create advanced wavetable oscillator with multiple modulation sources
      synthRef.current = new Tone.Oscillator(220, wavetableParams.waveform as Tone.ToneOscillatorType);
      
      const filter = new Tone.Filter({
        type: "lowpass",
        frequency: 2000,
        Q: 5
      });
      
      const envelope = new Tone.AmplitudeEnvelope({
        attack: 0.1,
        decay: 0.3,
        sustain: 0.7,
        release: 1.0
      });
      
      // Chain: Oscillator -> Filter -> Envelope -> Destination
      synthRef.current.chain(filter, envelope, Tone.Destination);
      
      // Initialize LFOs for modulation
      lfoRefs.current = lfos.map((lfoConfig, index) => {
        const lfo = new Tone.LFO({
          frequency: lfoConfig.rate,
          type: lfoConfig.shape as any
        });
        // set depth via amplitude after construction for TS compatibility
        lfo.amplitude.value = lfoConfig.depth / 100;
        
        // Connect LFO to various parameters based on target
        switch (lfoConfig.target) {
          case "position":
            lfo.connect(synthRef.current.frequency);
            break;
          case "harmonics":
            lfo.connect(filter.frequency);
            break;
          case "brightness":
            lfo.connect(filter.Q);
            break;
          case "morphing":
            // Custom modulation target
            break;
        }
        
        if (lfoConfig.sync) {
          lfo.sync();
        }
        
        lfo.start();
        return lfo;
      });
    };

    initSynths();

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      lfoRefs.current.forEach(lfo => lfo?.dispose());
    };
  }, []);

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        synthRef.current?.stop();
        setIsPlaying(false);
      } else {
        synthRef.current?.start();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  const updateWavetableParam = (param: keyof WavetableParams, value: number | boolean | string) => {
    setWavetableParams(prev => ({ ...prev, [param]: value }));
    
    // Update synth parameters in real-time
    if (synthRef.current) {
      switch (param) {
        case "waveform":
          synthRef.current.type = value as any;
          synthRef.current.type = value;
          break;
        case "harmonics":
          // Simulate harmonic content changes
          if (typeof value === "number") {
            synthRef.current.frequency.value = 220 * (1 + value / 1000);
          }
          break;
        case "phase":
          synthRef.current.phase = typeof value === "number" ? value : 0;
          break;
      }
    }
  };

  const updateLFO = (index: number, param: keyof LFO, value: number | boolean | string) => {
    setLfos(prev => prev.map((lfo, i) => 
      i === index ? { ...lfo, [param]: value } : lfo
    ));
    
    // Update actual LFO
    if (lfoRefs.current[index]) {
      const lfo = lfoRefs.current[index];
      switch (param) {
        case "rate":
          lfo.frequency.value = Number(value);
          break;
        case "depth":
          lfo.amplitude.value = Number(value) / 100;
          break;
        case "shape":
          lfo.type = value as any;
         lfo.frequency.value = value;
          break;
        case "depth":
          lfo.amplitude.value = (value as number) / 100;
          break;
        case "shape":
          lfo.type = value;
          break;
      }
    }
  };

  const randomizeWavetable = () => {
    const waveforms = ["sine", "square", "sawtooth", "triangle"];
    const randomParams = {
      waveform: waveforms[Math.floor(Math.random() * waveforms.length)],
      position: Math.random() * 100,
      modulation: Math.random() * 100,
      harmonics: Math.random() * 100,
      phase: Math.random() * 360,
      sync: Math.random() > 0.5,
      morphing: Math.random() * 100,
      brightness: Math.random() * 100,
      character: Math.random() * 100,
      motion: Math.random() * 100
    };
    setWavetableParams(randomParams);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
            <Target className="text-white h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Wavetable Oscillator</h1>
            <p className="text-muted-foreground">Advanced wavetable synthesis & modulation</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
            <Target className="h-3 w-3 mr-1" />
            Wavetable
          </Badge>
          <Badge variant="secondary">Multi-LFO</Badge>
          <Badge variant="secondary">Real-time</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Wavetable Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Wavetable Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Waveform</label>
              <Select 
                value={wavetableParams.waveform} 
                onValueChange={(v) => updateWavetableParam("waveform", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sine">Sine Wave</SelectItem>
                  <SelectItem value="square">Square Wave</SelectItem>
                  <SelectItem value="sawtooth">Sawtooth</SelectItem>
                  <SelectItem value="triangle">Triangle</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Position: {wavetableParams.position.toFixed(1)}%
              </label>
              <Slider
                value={[wavetableParams.position]}
                onValueChange={(v) => updateWavetableParam("position", v[0])}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Harmonics: {wavetableParams.harmonics.toFixed(1)}%
              </label>
              <Slider
                value={[wavetableParams.harmonics]}
                onValueChange={(v) => updateWavetableParam("harmonics", v[0])}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Morphing: {wavetableParams.morphing.toFixed(1)}%
              </label>
              <Slider
                value={[wavetableParams.morphing]}
                onValueChange={(v) => updateWavetableParam("morphing", v[0])}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Brightness: {wavetableParams.brightness.toFixed(1)}%
              </label>
              <Slider
                value={[wavetableParams.brightness]}
                onValueChange={(v) => updateWavetableParam("brightness", v[0])}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Character: {wavetableParams.character.toFixed(1)}%
              </label>
              <Slider
                value={[wavetableParams.character]}
                onValueChange={(v) => updateWavetableParam("character", v[0])}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={handlePlay} className="flex-1">
                {isPlaying ? "Stop" : "Play"}
              </Button>
              <Button variant="outline" size="sm" onClick={randomizeWavetable}>
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* LFO Modulation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              LFO Modulation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select LFO</label>
              <div className="grid grid-cols-4 gap-1">
                {lfos.map((lfo, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={selectedLFO === index ? "default" : "outline"}
                    onClick={() => setSelectedLFO(index)}
                  >
                    {index + 1}
                  </Button>
                ))}
              </div>
            </div>
            
            {lfos[selectedLFO] && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Shape</label>
                  <Select 
                    value={lfos[selectedLFO].shape}
                    onValueChange={(v) => updateLFO(selectedLFO, "shape", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sine">Sine</SelectItem>
                      <SelectItem value="triangle">Triangle</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="sawtooth">Sawtooth</SelectItem>
                      <SelectItem value="noise">Noise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">
                    Rate: {lfos[selectedLFO].rate.toFixed(2)} Hz
                  </label>
                  <Slider
                    value={[lfos[selectedLFO].rate]}
                    onValueChange={(v) => updateLFO(selectedLFO, "rate", v[0])}
                    min={0.1}
                    max={20}
                    step={0.1}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">
                    Depth: {lfos[selectedLFO].depth}%
                  </label>
                  <Slider
                    value={[lfos[selectedLFO].depth]}
                    onValueChange={(v) => updateLFO(selectedLFO, "depth", v[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Target</label>
                  <Select 
                    value={lfos[selectedLFO].target}
                    onValueChange={(v) => updateLFO(selectedLFO, "target", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="position">Position</SelectItem>
                      <SelectItem value="harmonics">Harmonics</SelectItem>
                      <SelectItem value="brightness">Brightness</SelectItem>
                      <SelectItem value="morphing">Morphing</SelectItem>
                      <SelectItem value="character">Character</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filter & Effects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter & Effects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Filter Type</label>
              <Select 
                value={filter.type}
                onValueChange={(v) => setFilter(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lowpass">Low Pass</SelectItem>
                  <SelectItem value="highpass">High Pass</SelectItem>
                  <SelectItem value="bandpass">Band Pass</SelectItem>
                  <SelectItem value="notch">Notch</SelectItem>
                  <SelectItem value="allpass">All Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">
                Cutoff: {filter.frequency} Hz
              </label>
              <Slider
                value={[filter.frequency]}
                onValueChange={(v) => setFilter(prev => ({ ...prev, frequency: v[0] }))}
                min={20}
                max={20000}
                step={1}
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">
                Resonance: {filter.resonance.toFixed(1)}
              </label>
              <Slider
                value={[filter.resonance]}
                onValueChange={(v) => setFilter(prev => ({ ...prev, resonance: v[0] }))}
                min={0.1}
                max={30}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">
                Drive: {filter.drive}%
              </label>
              <Slider
                value={[filter.drive]}
                onValueChange={(v) => setFilter(prev => ({ ...prev, drive: v[0] }))}
                min={0}
                max={100}
                step={1}
              />
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Envelope (ADSR)</h4>
              
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Attack: {envelope.attack}s</label>
                  <Slider
                    value={[envelope.attack]}
                    onValueChange={(v) => setEnvelope(prev => ({ ...prev, attack: v[0] }))}
                    min={0.001}
                    max={5}
                    step={0.001}
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground">Decay: {envelope.decay}s</label>
                  <Slider
                    value={[envelope.decay]}
                    onValueChange={(v) => setEnvelope(prev => ({ ...prev, decay: v[0] }))}
                    min={0.001}
                    max={5}
                    step={0.001}
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground">Sustain: {envelope.sustain}</label>
                  <Slider
                    value={[envelope.sustain]}
                    onValueChange={(v) => setEnvelope(prev => ({ ...prev, sustain: v[0] }))}
                    min={0}
                    max={1}
                    step={0.01}
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground">Release: {envelope.release}s</label>
                  <Slider
                    value={[envelope.release]}
                    onValueChange={(v) => setEnvelope(prev => ({ ...prev, release: v[0] }))}
                    min={0.001}
                    max={10}
                    step={0.001}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default WavetableOscillator;
export { WavetableOscillator };