import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Waves, Zap, RotateCcw, Shuffle, 
  Layers, Target, Orbit, Sparkles 
} from "lucide-react";
import * as Tone from "tone";

interface GranularParams {
  grainSize: number;
  density: number;
  position: number;
  pitch: number;
  reverse: boolean;
  spread: number;
  shape: string;
  texture: number;
  feedback: number;
  modulation: number;
}

interface SynthEngine {
  id: string;
  name: string;
  type: "granular" | "wavetable" | "fm" | "spectral";
  params: any;
  active: boolean;
}

export default function GranularEngine() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [granularParams, setGranularParams] = useState<GranularParams>({
    grainSize: 50,
    density: 70,
    position: 0,
    pitch: 0,
    reverse: false,
    spread: 30,
    shape: "gaussian",
    texture: 40,
    feedback: 20,
    modulation: 0
  });
  
  const [synthEngines, setSynthEngines] = useState<SynthEngine[]>([
    {
      id: "granular1",
      name: "Granular A",
      type: "granular",
      params: { ...granularParams },
      active: true
    },
    {
      id: "wavetable1", 
      name: "Wavetable B",
      type: "wavetable",
      params: { waveform: "complex", modulation: 30, harmonics: 60 },
      active: false
    },
    {
      id: "fm1",
      name: "FM Synthesis",
      type: "fm",
      params: { carrier: 440, modulator: 220, index: 40, ratio: 2 },
      active: false
    },
    {
      id: "spectral1",
      name: "Spectral Engine",
      type: "spectral",
      params: { bins: 64, morph: 50, harmonics: 80, phase: 0 },
      active: false
    }
  ]);
  
  const [selectedEngine, setSelectedEngine] = useState(0);
  const [macroControls, setMacroControls] = useState({
    macro1: 50,
    macro2: 30,
    macro3: 70,
    macro4: 20
  });
  
  const synthRef = useRef<Tone.Oscillator | null>(null);
  const granularRef = useRef<Tone.GrainPlayer | null>(null);

  useEffect(() => {
    // Initialize Tone.js synthesizers for Output CO Producer-style sound generation
    const initSynths = async () => {
      await Tone.start();
      
      // Advanced granular synthesis engine
      granularRef.current = new Tone.GrainPlayer({
        url: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMRN2O+5cuZbDMAH4Xa9NWuVg4TCz2nz+eTaSkHMV+0zMx5WQ4SFz5+7diLYCtEpOD98IlZNA8VGj6vy/KHCz4+rNDqYyUFJHjH8N2QQAoUcefzzZfJJGMLZLbvfgf7+9eJzO7P2C9AGDq6o8dIpOD99I5ZNBISEy9uy+eHCz5Fr+Hztm0iGDKy18eLYCtEpOD98IlZNA8VGj6vy/KHCz5fr+LyuWwjGC6t2M1pRA0UImHO8Nt5WwwSFTeqze2MSSUIKHzK8tv0KAW6nOJ5cBoFbr/K8+GPTAsTIGPP8d5/XwsRFTqDzeKQSCYGH4Qz" }).toDestination();
      
      // Advanced wavetable oscillator
      synthRef.current = new Tone.Oscillator({
        type: "sawtooth",
        frequency: 440
      }).toDestination();
    };

    initSynths();

    return () => {
      if (granularRef.current) {
        granularRef.current.dispose();
      }
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        synthRef.current?.stop();
        granularRef.current?.stop();
        setIsPlaying(false);
      } else {
        const activeEngine = synthEngines[selectedEngine];
        
        if (activeEngine.type === "granular") {
          granularRef.current?.start();
        } else {
          synthRef.current?.start();
        }
        
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  const updateGranularParam = (param: keyof GranularParams, value: number | boolean | string) => {
    const toNumber = (v: number | boolean | string) =>
      typeof v === "number" ? v : Number(v);
    const toBoolean = (v: number | boolean | string) => Boolean(v);

    setGranularParams((prev) => {
      const next: GranularParams = { ...prev } as GranularParams;
      if (param === "reverse") {
        (next as any)[param] = toBoolean(value);
      } else if (typeof (prev as any)[param] === "number") {
        (next as any)[param] = toNumber(value);
      } else {
        (next as any)[param] = value as string;
      }
      return next;
    });

    // Update active granular engine
    if (granularRef.current) {
      switch (param) {
        case "grainSize":
          granularRef.current.grainSize = toNumber(value) / 1000; // Convert to seconds
          break;
        case "position":
          granularRef.current.loopStart = toNumber(value) / 100;
          break;
        case "pitch": {
          const semis = toNumber(value);
          granularRef.current.playbackRate = Math.pow(2, semis / 12); // Semitone conversion
          break;
        }
        case "reverse":
          granularRef.current.reverse = toBoolean(value);
          break;
        default:
          break;
      }
    }
  };

  const randomizeParams = () => {
    const randomParams = {
      grainSize: Math.random() * 100,
      density: Math.random() * 100,
      position: Math.random() * 100,
      pitch: (Math.random() - 0.5) * 24, // ±1 octave
      reverse: Math.random() > 0.5,
      spread: Math.random() * 100,
      shape: ["gaussian", "triangle", "square"][Math.floor(Math.random() * 3)],
      texture: Math.random() * 100,
      feedback: Math.random() * 50,
      modulation: Math.random() * 100
    };
    setGranularParams(randomParams);
  };

  const resetParams = () => {
    setGranularParams({
      grainSize: 50,
      density: 70,
      position: 0,
      pitch: 0,
      reverse: false,
      spread: 30,
      shape: "gaussian",
      texture: 40,
      feedback: 20,
      modulation: 0
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
            <Waves className="text-white h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Granular Engine</h1>
            <p className="text-muted-foreground">Advanced synthesis & texture manipulation</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-500">
            <Sparkles className="h-3 w-3 mr-1" />
            Spectral
          </Badge>
          <Badge variant="secondary">Multi-Engine</Badge>
          <Badge variant="secondary">Real-time</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Engine Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Synthesis Engines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {synthEngines.map((engine, index) => (
              <Button
                key={engine.id}
                variant={selectedEngine === index ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setSelectedEngine(index)}
              >
                <div className="flex items-center gap-2">
                  {engine.type === "granular" && <Waves className="h-4 w-4" />}
                  {engine.type === "wavetable" && <Target className="h-4 w-4" />}
                  {engine.type === "fm" && <Orbit className="h-4 w-4" />}
                  {engine.type === "spectral" && <Sparkles className="h-4 w-4" />}
                  <span>{engine.name}</span>
                </div>
              </Button>
            ))}
            
            <div className="pt-4 border-t">
              <Button onClick={handlePlay} className="w-full">
                {isPlaying ? "Stop" : "Play"} Engine
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Granular Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5" />
              Granular Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Grain Size: {granularParams.grainSize.toFixed(1)}ms
              </label>
              <Slider
                value={[granularParams.grainSize]}
                onValueChange={(v) => updateGranularParam("grainSize", v[0])}
                min={1}
                max={200}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Density: {granularParams.density.toFixed(1)}%
              </label>
              <Slider
                value={[granularParams.density]}
                onValueChange={(v) => updateGranularParam("density", v[0])}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Position: {granularParams.position.toFixed(1)}%
              </label>
              <Slider
                value={[granularParams.position]}
                onValueChange={(v) => updateGranularParam("position", v[0])}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Pitch: {granularParams.pitch > 0 ? "+" : ""}{granularParams.pitch.toFixed(1)} st
              </label>
              <Slider
                value={[granularParams.pitch]}
                onValueChange={(v) => updateGranularParam("pitch", v[0])}
                min={-24}
                max={24}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Spread: {granularParams.spread.toFixed(1)}%
              </label>
              <Slider
                value={[granularParams.spread]}
                onValueChange={(v) => updateGranularParam("spread", v[0])}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Grain Shape</label>
              <Select 
                value={granularParams.shape} 
                onValueChange={(v) => updateGranularParam("shape", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gaussian">Gaussian</SelectItem>
                  <SelectItem value="triangle">Triangle</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="exponential">Exponential</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={randomizeParams}>
                <Shuffle className="h-4 w-4 mr-1" />
                Random
              </Button>
              <Button variant="outline" size="sm" onClick={resetParams}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Macro Controls & Effects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Macro Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* XY Pad Simulation */}
            <div>
              <label className="text-sm font-medium mb-2 block">X/Y Performance Pad</label>
              <div className="relative w-full h-32 bg-secondary rounded-lg border">
                <div 
                  className="absolute w-4 h-4 bg-primary rounded-full transform -translate-x-2 -translate-y-2 cursor-pointer"
                  style={{
                    left: `${macroControls.macro1}%`,
                    top: `${100 - macroControls.macro2}%`
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>X: {macroControls.macro1}</span>
                <span>Y: {macroControls.macro2}</span>
              </div>
            </div>
            
            {/* Macro Sliders */}
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Macro 1: Texture</label>
                <Slider
                  value={[macroControls.macro1]}
                  onValueChange={(v) => setMacroControls(prev => ({ ...prev, macro1: v[0] }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground">Macro 2: Movement</label>
                <Slider
                  value={[macroControls.macro2]}
                  onValueChange={(v) => setMacroControls(prev => ({ ...prev, macro2: v[0] }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground">Macro 3: Harmonics</label>
                <Slider
                  value={[macroControls.macro3]}
                  onValueChange={(v) => setMacroControls(prev => ({ ...prev, macro3: v[0] }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground">Macro 4: Chaos</label>
                <Slider
                  value={[macroControls.macro4]}
                  onValueChange={(v) => setMacroControls(prev => ({ ...prev, macro4: v[0] }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
            
            {/* Advanced Effects */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium">Advanced Effects</h4>
              
              <div>
                <label className="text-sm text-muted-foreground">Spectral Filter</label>
                <Slider
                  value={[granularParams.texture]}
                  onValueChange={(v) => updateGranularParam("texture", v[0])}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground">Feedback</label>
                <Slider
                  value={[granularParams.feedback]}
                  onValueChange={(v) => updateGranularParam("feedback", v[0])}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground">Modulation</label>
                <Slider
                  value={[granularParams.modulation]}
                  onValueChange={(v) => updateGranularParam("modulation", v[0])}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}