import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, Pause, Square, Settings, Shuffle, RotateCcw, Volume2, 
  Filter, Zap, Layers, Activity, Sliders 
} from "lucide-react";
import { audioManager } from "@/lib/audio";
import { useToast } from "@/hooks/use-toast";

interface PatternStep {
  active: boolean;
  velocity: number;
  probability: number;
  swing: number;
  retrigger: number;
  filter: number;
  distortion: number;
}

interface Track {
  id: string;
  name: string;
  pattern: PatternStep[];
  volume: number;
  muted: boolean;
  solo: boolean;
  effects: {
    filter: { cutoff: number; resonance: number; type: string };
    distortion: { drive: number; tone: number };
    reverb: { size: number; decay: number; wet: number };
    delay: { time: number; feedback: number; wet: number };
  };
}

const OUTPUT_TRACKS: Omit<Track, "pattern">[] = [
  { id: "kick", name: "Kick", volume: 0.8, muted: false, solo: false, effects: { filter: { cutoff: 100, resonance: 0, type: "lowpass" }, distortion: { drive: 0, tone: 50 }, reverb: { size: 30, decay: 40, wet: 0 }, delay: { time: 0.25, feedback: 0, wet: 0 } } },
  { id: "snare", name: "Snare", volume: 0.7, muted: false, solo: false, effects: { filter: { cutoff: 80, resonance: 10, type: "highpass" }, distortion: { drive: 15, tone: 60 }, reverb: { size: 50, decay: 60, wet: 20 }, delay: { time: 0.125, feedback: 0, wet: 0 } } },
  { id: "hhc", name: "Hi-Hat C", volume: 0.6, muted: false, solo: false, effects: { filter: { cutoff: 90, resonance: 5, type: "highpass" }, distortion: { drive: 0, tone: 70 }, reverb: { size: 20, decay: 30, wet: 10 }, delay: { time: 0.125, feedback: 0, wet: 0 } } },
  { id: "hho", name: "Hi-Hat O", volume: 0.5, muted: false, solo: false, effects: { filter: { cutoff: 85, resonance: 8, type: "highpass" }, distortion: { drive: 0, tone: 75 }, reverb: { size: 40, decay: 50, wet: 15 }, delay: { time: 0.25, feedback: 0, wet: 0 } } },
  { id: "clap", name: "Clap", volume: 0.6, muted: false, solo: false, effects: { filter: { cutoff: 70, resonance: 5, type: "bandpass" }, distortion: { drive: 10, tone: 55 }, reverb: { size: 60, decay: 70, wet: 25 }, delay: { time: 0.25, feedback: 10, wet: 5 } } },
  { id: "crash", name: "Crash", volume: 0.4, muted: false, solo: false, effects: { filter: { cutoff: 95, resonance: 2, type: "highpass" }, distortion: { drive: 0, tone: 80 }, reverb: { size: 80, decay: 90, wet: 40 }, delay: { time: 0.5, feedback: 15, wet: 10 } } },
  { id: "tom", name: "Tom", volume: 0.7, muted: false, solo: false, effects: { filter: { cutoff: 60, resonance: 15, type: "lowpass" }, distortion: { drive: 5, tone: 45 }, reverb: { size: 40, decay: 50, wet: 15 }, delay: { time: 0.25, feedback: 0, wet: 0 } } },
  { id: "perc", name: "Perc", volume: 0.5, muted: false, solo: false, effects: { filter: { cutoff: 75, resonance: 8, type: "bandpass" }, distortion: { drive: 8, tone: 65 }, reverb: { size: 30, decay: 40, wet: 12 }, delay: { time: 0.375, feedback: 8, wet: 3 } } },
];

export default function OutputSequencer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(0);
  const [patternLength, setPatternLength] = useState(16);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [tracks, setTracks] = useState<Track[]>(() => 
    OUTPUT_TRACKS.map(track => ({
      ...track,
      pattern: Array(16).fill(null).map(() => ({
        active: false,
        velocity: 100,
        probability: 100,
        swing: 0,
        retrigger: 1,
        filter: 50,
        distortion: 0
      }))
    }))
  );
  const [masterEffects, setMasterEffects] = useState({
    compressor: { threshold: -12, ratio: 4, attack: 3, release: 100 },
    eq: { low: 0, mid: 0, high: 0 },
    reverb: { size: 50, decay: 50, wet: 20 },
    limiter: { threshold: -1, release: 50 }
  });
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  // Centralized stop logic to ensure timers and audio are cleaned up
  const stopPlayback = () => {
    audioManager.stop();
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    setCurrentStep(0);
  };

  const handlePlay = async () => {
    try {
      await audioManager.initialize();
      if (isPlaying) {
        // Toggle off
        stopPlayback();
      } else {
        // Convert to simple pattern format for playback
        const simplePattern = {
          kick: tracks[0].pattern.map(step => step.active),
          snare: tracks[1].pattern.map(step => step.active),
          hihat: tracks[2].pattern.map(step => step.active),
          openhat: tracks[3].pattern.map(step => step.active),
          clap: tracks[4].pattern.map(step => step.active),
          crash: tracks[5].pattern.map(step => step.active),
          tom: tracks[6].pattern.map(step => step.active),
          perc: tracks[7].pattern.map(step => step.active),
        };
        
        await audioManager.playBeat(simplePattern, [], bpm);
        setIsPlaying(true);
        // Reset visual step indicator to start
        setCurrentStep(0);
      }
    } catch (error) {
      toast({
        title: "Playback Error",
        description: "Failed to start audio playback",
        variant: "destructive",
      });
    }
  };

  const toggleStep = (trackIndex: number, stepIndex: number) => {
    setTracks(prev => prev.map((track, tIdx) => 
      tIdx === trackIndex ? {
        ...track,
        pattern: track.pattern.map((step, sIdx) => 
          sIdx === stepIndex ? { ...step, active: !step.active } : step
        )
      } : track
    ));
  };

  const adjustVelocity = (trackIndex: number, stepIndex: number, velocity: number) => {
    setTracks(prev => prev.map((track, tIdx) => 
      tIdx === trackIndex ? {
        ...track,
        pattern: track.pattern.map((step, sIdx) => 
          sIdx === stepIndex ? { ...step, velocity } : step
        )
      } : track
    ));
  };

  const randomizePattern = (trackIndex: number) => {
    setTracks(prev => prev.map((track, tIdx) => 
      tIdx === trackIndex ? {
        ...track,
        pattern: track.pattern.map(step => ({
          ...step,
          active: Math.random() > 0.7,
          velocity: 60 + Math.random() * 40,
          probability: 70 + Math.random() * 30
        }))
      } : track
    ));
  };

  const clearPattern = (trackIndex: number) => {
    setTracks(prev => prev.map((track, tIdx) => 
      tIdx === trackIndex ? {
        ...track,
        pattern: track.pattern.map(step => ({ ...step, active: false }))
      } : track
    ));
  };

  // Manage the visual step indicator interval based on playback state and tempo
  useEffect(() => {
    if (!isPlaying) {
      // Ensure no stray intervals when not playing
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    // Recreate interval when bpm or pattern length changes
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    const stepMs = (60 / bpm / 4) * 1000;
    intervalRef.current = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % patternLength);
    }, stepMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [isPlaying, bpm, patternLength]);

  // On unmount, clear any existing interval
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <Layers className="text-white h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Advanced Sequencer</h1>
            <p className="text-muted-foreground">Professional multi-layered beat production</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-orange-500/10 text-orange-500">
            <Zap className="h-3 w-3 mr-1" />
            CO Producer
          </Badge>
          <Badge variant="secondary">32-Step</Badge>
          <Badge variant="secondary">Multi-FX</Badge>
        </div>
      </div>

      <Tabs defaultValue="sequencer" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sequencer">Sequencer</TabsTrigger>
          <TabsTrigger value="modulation">Modulation</TabsTrigger>
          <TabsTrigger value="effects">Effects</TabsTrigger>
          <TabsTrigger value="mixer">Mixer</TabsTrigger>
        </TabsList>

        <TabsContent value="sequencer">
          {/* Transport Controls */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Transport
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handlePlay}
                    className={`w-16 h-16 rounded-full ${
                      isPlaying 
                        ? "bg-red-500 hover:bg-red-600" 
                        : "bg-green-500 hover:bg-green-600"
                    }`}
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                  </Button>
                  <Button variant="outline" onClick={stopPlayback}>
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">BPM: {bpm}</label>
                  <Slider 
                    value={[bpm]} 
                    onValueChange={(v) => setBpm(v[0])} 
                    min={60} 
                    max={200} 
                    step={1} 
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Swing: {swing}%</label>
                  <Slider 
                    value={[swing]} 
                    onValueChange={(v) => setSwing(v[0])} 
                    min={0} 
                    max={50} 
                    step={1} 
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Pattern Length</label>
                  <Select value={patternLength.toString()} onValueChange={(v) => setPatternLength(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8 Steps</SelectItem>
                      <SelectItem value="16">16 Steps</SelectItem>
                      <SelectItem value="32">32 Steps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => randomizePattern(selectedTrack)}>
                    <Shuffle className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => clearPattern(selectedTrack)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step Sequencer Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Step Sequencer Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Step Headers */}
                <div className="grid grid-cols-17 gap-1">
                  <div className="text-xs text-center font-medium">Track</div>
                  {Array.from({ length: 16 }, (_, i) => (
                    <div 
                      key={i}
                      className={`text-xs text-center font-medium p-1 rounded ${
                        currentStep === i && isPlaying 
                          ? "bg-orange-500 text-white" 
                          : i % 4 === 0 
                            ? "bg-primary/20" 
                            : "bg-secondary/50"
                      }`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                
                {/* Track Rows */}
                {tracks.map((track, trackIndex) => (
                  <div key={track.id} className="grid grid-cols-17 gap-1 items-center">
                    <Button
                      variant={selectedTrack === trackIndex ? "default" : "outline"}
                      size="sm"
                      className="text-xs justify-start"
                      onClick={() => setSelectedTrack(trackIndex)}
                    >
                      {track.name}
                    </Button>
                    
                    {track.pattern.slice(0, patternLength).map((step, stepIndex) => (
                      <Button
                        key={stepIndex}
                        size="sm"
                        className={`w-8 h-8 p-0 relative ${
                          step.active 
                            ? "bg-orange-500 hover:bg-orange-600" 
                            : "bg-secondary hover:bg-secondary/80"
                        }`}
                        onClick={() => toggleStep(trackIndex, stepIndex)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          // Show velocity/probability controls on right click
                        }}
                      >
                        {step.active && (
                          <div 
                            className="absolute inset-0 bg-white/20 rounded"
                            style={{ height: `${step.velocity}%` }}
                          />
                        )}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modulation">
          <Card>
            <CardHeader>
              <CardTitle>Step Modulation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-4">Velocity Modulation</h3>
                    <div className="grid grid-cols-16 gap-1">
                      {tracks[selectedTrack]?.pattern.slice(0, patternLength).map((step, i) => (
                        <div key={i} className="space-y-1">
                          <Slider
                            orientation="vertical"
                            value={[step.velocity]}
                            onValueChange={(v) => adjustVelocity(selectedTrack, i, v[0])}
                            min={0}
                            max={127}
                            step={1}
                            className="h-16"
                          />
                          <div className="text-xs text-center">{i + 1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-4">Probability</h3>
                    <div className="space-y-2">
                      <Slider
                        value={[tracks[selectedTrack]?.pattern[0]?.probability || 100]}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                      <div className="text-sm text-muted-foreground">
                        Per-step probability controls coming soon
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="effects">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Track Effects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {tracks[selectedTrack]?.name} Effects
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Filter Cutoff</label>
                      <Slider 
                        value={[tracks[selectedTrack]?.effects.filter.cutoff || 50]}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground">Distortion Drive</label>
                      <Slider 
                        value={[tracks[selectedTrack]?.effects.distortion.drive || 0]}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground">Reverb Send</label>
                      <Slider 
                        value={[tracks[selectedTrack]?.effects.reverb.wet || 0]}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground">Delay Send</label>
                      <Slider 
                        value={[tracks[selectedTrack]?.effects.delay.wet || 0]}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sliders className="h-5 w-5" />
                  Master Effects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Compressor Threshold</label>
                    <Slider 
                      value={[masterEffects.compressor.threshold + 40]}
                      min={0}
                      max={40}
                      step={1}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground">EQ Low</label>
                    <Slider 
                      value={[masterEffects.eq.low + 12]}
                      min={0}
                      max={24}
                      step={0.5}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground">EQ Mid</label>
                    <Slider 
                      value={[masterEffects.eq.mid + 12]}
                      min={0}
                      max={24}
                      step={0.5}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground">EQ High</label>
                    <Slider 
                      value={[masterEffects.eq.high + 12]}
                      min={0}
                      max={24}
                      step={0.5}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground">Master Reverb</label>
                    <Slider 
                      value={[masterEffects.reverb.wet]}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mixer">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Mixer Console
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-8 gap-4">
                {tracks.map((track, index) => (
                  <div key={track.id} className="space-y-3">
                    <div className="text-xs font-medium text-center">{track.name}</div>
                    
                    <div className="flex flex-col items-center space-y-2">
                      <Button
                        size="sm"
                        variant={track.solo ? "default" : "outline"}
                        className="w-8 h-6 text-xs"
                        onClick={() => {
                          setTracks(prev => prev.map((t, i) => 
                            i === index ? { ...t, solo: !t.solo } : t
                          ));
                        }}
                      >
                        S
                      </Button>
                      
                      <Button
                        size="sm"
                        variant={track.muted ? "destructive" : "outline"}
                        className="w-8 h-6 text-xs"
                        onClick={() => {
                          setTracks(prev => prev.map((t, i) => 
                            i === index ? { ...t, muted: !t.muted } : t
                          ));
                        }}
                      >
                        M
                      </Button>
                      
                      <Slider
                        orientation="vertical"
                        value={[track.volume * 100]}
                        onValueChange={(v) => {
                          setTracks(prev => prev.map((t, i) => 
                            i === index ? { ...t, volume: v[0] / 100 } : t
                          ));
                        }}
                        min={0}
                        max={100}
                        step={1}
                        className="h-32"
                      />
                      
                      <div className="text-xs text-center">{Math.round(track.volume * 100)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}