import React, { useState, useRef, useEffect, useContext } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, Square, Save, Zap, Volume2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useAudio } from '@/hooks/useAudio';
import { useMIDI } from '@/hooks/useMIDI';
import { StudioAudioContext } from '@/contexts/StudioAudioContext';
import { AIProviderSelector } from '@/components/ui/ai-provider-selector';
import { OutputSequencer } from '@/components/producer/OutputSequencer';

interface BeatPattern {
  kick: boolean[];
  snare: boolean[];
  hihat: boolean[];
  openhat: boolean[];
  tom1: boolean[];
  tom2: boolean[];
  tom3: boolean[];
  ride: boolean[];
}

interface BeatMakerProps {
  onBeatGenerated?: (pattern: BeatPattern) => void;
}

const BeatMaker: React.FC<BeatMakerProps> = ({ onBeatGenerated }) => {
  const studioContext = useContext(StudioAudioContext);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDrumKit, setSelectedDrumKit] = useState('acoustic');
  const [bassDrumDuration, setBassDrumDuration] = useState(0.8);
  const [complexity, setComplexity] = useState([5]);
  const [clipLength, setClipLength] = useState(8);
  const [bars, setBars] = useState(4);
  const [activeTab, setActiveTab] = useState('generate');
  const [aiProvider, setAiProvider] = useState("grok");

  // Initialize pattern with default structure or load from studio context
  const [pattern, setPattern] = useState<BeatPattern>(() => {
    // Check for pattern from studio context first
    if (studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0) {
      return {
        kick: studioContext.currentPattern.kick || Array(16).fill(false),
        snare: studioContext.currentPattern.snare || Array(16).fill(false),
        hihat: studioContext.currentPattern.hihat || Array(16).fill(false),
        openhat: studioContext.currentPattern.openhat || Array(16).fill(false),
        tom1: studioContext.currentPattern.tom1 || Array(16).fill(false),
        tom2: studioContext.currentPattern.tom2 || Array(16).fill(false),
        tom3: studioContext.currentPattern.tom3 || Array(16).fill(false),
        ride: studioContext.currentPattern.ride || Array(16).fill(false),
      };
    }
    
    // Check localStorage for persisted data
    const storedData = localStorage.getItem('generatedMusicData');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.beatPattern) {
          return {
            kick: parsed.beatPattern.kick || Array(16).fill(false),
            snare: parsed.beatPattern.snare || Array(16).fill(false),
            hihat: parsed.beatPattern.hihat || Array(16).fill(false),
            openhat: parsed.beatPattern.openhat || Array(16).fill(false),
            tom1: parsed.beatPattern.tom1 || Array(16).fill(false),
            tom2: parsed.beatPattern.tom2 || Array(16).fill(false),
            tom3: parsed.beatPattern.tom3 || Array(16).fill(false),
            ride: parsed.beatPattern.ride || Array(16).fill(false),
          };
        }
      } catch (error) {
        console.error("Error loading stored pattern:", error);
      }
    }
    
    // Default empty pattern
    return {
      kick: Array(16).fill(false),
      snare: Array(16).fill(false),
      hihat: Array(16).fill(false),
      openhat: Array(16).fill(false),
      tom1: Array(16).fill(false),
      tom2: Array(16).fill(false),
      tom3: Array(16).fill(false),
      ride: Array(16).fill(false),
    };
  });

  const { toast } = useToast();
  const { playDrumSound, initialize, isInitialized } = useAudio();
  
  // MIDI Controller Integration  
  const { isConnected: midiConnected, activeNotes, settings: midiSettings } = useMIDI();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stepCounterRef = useRef<number>(0);

  // Initialize audio on first interaction
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Beat generation mutation
  const generateBeatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/beat/generate", {
        genre: "trap",
        bpm,
        complexity: complexity[0],
        pattern_length: 16,
        instruments: ["kick", "snare", "hihat", "openhat", "tom1", "tom2", "tom3", "ride"],
        aiProvider
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate beat");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.beat_pattern) {
        setPattern(data.beat_pattern);
        // Update studio context
        if (studioContext.setCurrentPattern) {
          studioContext.setCurrentPattern(data.beat_pattern);
        }
        if (onBeatGenerated) {
          onBeatGenerated(data.beat_pattern);
        }
        toast({
          title: "Beat Generated!",
          description: "Your AI-powered beat is ready to play",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate beat",
        variant: "destructive",
      });
    },
  });

  // Save beat mutation
  const saveBeatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/beat/save", {
        pattern,
        bpm,
        name: `Beat_${new Date().toISOString().slice(0, 10)}_${bpm}BPM`
      });
      
      if (!response.ok) {
        throw new Error("Failed to save beat");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Beat Saved!",
        description: "Your beat has been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save beat",
        variant: "destructive",
      });
    },
  });

  // Handle beat generation
  const handleGenerateAI = () => {
    generateBeatMutation.mutate();
  };

  // Handle saving
  const handleSave = () => {
    saveBeatMutation.mutate();
  };

  const toggleStep = (track: keyof BeatPattern, stepIndex: number) => {
    setPattern(prev => {
      const newPattern = {
        ...prev,
        [track]: prev[track].map((active, index) => 
          index === stepIndex ? !active : active
        )
      };
      
      // Update studio context
      if (studioContext.setCurrentPattern) {
        studioContext.setCurrentPattern(newPattern);
      }
      
      return newPattern;
    });
  };

  const playPattern = async () => {
    if (!isInitialized) {
      await initialize();
    }

    if (isPlaying) {
      stopPattern();
      return;
    }

    setIsPlaying(true);
    stepCounterRef.current = 0;

    const stepTime = (60 / bpm / 4) * 1000; // 16th note timing
    
    intervalRef.current = setInterval(() => {
      const step = stepCounterRef.current % 16;
      setCurrentStep(step);
      
      // Play sounds for active steps
      Object.entries(pattern).forEach(([track, steps]) => {
        if (steps[step]) {
          playDrumSound(track);
        }
      });
      
      stepCounterRef.current++;
    }, stepTime);
  };

  const stopPattern = () => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCurrentStep(0);
    stepCounterRef.current = 0;
  };

  const drumKits = {
    acoustic: {
      name: "Acoustic Kit",
      sounds: {
        kick: "Kick Drum",
        snare: "Snare Drum", 
        hihat: "Hi-Hat",
        openhat: "Open Hat",
        tom1: "High Tom",
        tom2: "Mid Tom",
        tom3: "Floor Tom",
        ride: "Ride Cymbal"
      }
    },
    electronic: {
      name: "Electronic Kit",
      sounds: {
        kick: "808 Kick",
        snare: "Clap",
        hihat: "Digital Hat",
        openhat: "Open Hat",
        tom1: "Synth Tom 1",
        tom2: "Synth Tom 2", 
        tom3: "Synth Tom 3",
        ride: "Crash"
      }
    }
  };

  const defaultTracks = {
    kick: "Kick",
    snare: "Snare",
    hihat: "Hi-Hat",
    openhat: "Open Hat",
    tom1: "Tom 1",
    tom2: "Tom 2",
    tom3: "Tom 3",
    ride: "Ride"
  };

  // Get tracks safely with fallback
  const currentDrumKit = drumKits[selectedDrumKit as keyof typeof drumKits];
  const tracks = currentDrumKit?.sounds || defaultTracks;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Professional Header */}
      <div className="p-6 border-b border-gray-600 flex-shrink-0">
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <div className="text-2xl mr-3">🎵</div>
            <div>
              <h1 className="text-3xl font-bold text-white">Beat Studio</h1>
              <p className="text-gray-400">Create and edit professional beats with AI assistance</p>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex space-x-8 border-b border-gray-700 mb-6">
            <button 
              onClick={() => setActiveTab('generate')}
              className={`px-6 py-3 border-b-2 transition-colors ${
                activeTab === 'generate' 
                  ? 'text-blue-400 border-blue-500' 
                  : 'text-gray-400 hover:text-white border-transparent hover:border-blue-500'
              }`}
            >
              Generate Beat
            </button>
            <button 
              onClick={() => setActiveTab('edit')}
              className={`px-6 py-3 border-b-2 transition-colors ${
                activeTab === 'edit' 
                  ? 'text-blue-400 border-blue-500' 
                  : 'text-gray-400 hover:text-white border-transparent hover:border-blue-500'
              }`}
            >
              Edit Pattern
            </button>
            <button 
              onClick={() => setActiveTab('sequencer')}
              className={`px-6 py-3 border-b-2 transition-colors ${
                activeTab === 'sequencer' 
                  ? 'text-blue-400 border-blue-500' 
                  : 'text-gray-400 hover:text-white border-transparent hover:border-blue-500'
              }`}
            >
              Pro Sequencer
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'generate' && (
          <div className="space-y-6">
            {/* AI Beat Generation Section */}
            <div className="border border-gray-600 rounded-lg p-4 bg-gray-800">
              <h3 className="text-lg font-bold mb-4 text-blue-400">AI Beat Generation</h3>
              <div className="flex items-center justify-between mb-4">
                <AIProviderSelector value={aiProvider} onValueChange={setAiProvider} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm whitespace-nowrap">AI Complexity:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">Simple</span>
                      <Slider
                        value={complexity}
                        onValueChange={setComplexity}
                        max={10}
                        min={1}
                        step={1}
                        className="w-24"
                        aria-label="AI complexity level control"
                      />
                      <span className="text-xs text-gray-400">Complex</span>
                    </div>
                    <span className="text-xs text-studio-accent font-mono">{complexity[0]}/10</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm whitespace-nowrap">BPM:</span>
                    <Slider
                      value={[bpm]}
                      onValueChange={([value]) => setBpm(value)}
                      max={200}
                      min={60}
                      step={1}
                      className="w-24"
                    />
                    <span className="text-xs text-studio-accent font-mono">{bpm}</span>
                  </div>
                </div>
                <Button 
                  onClick={handleGenerateAI}
                  disabled={generateBeatMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {generateBeatMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Beat
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="space-y-6">
            {/* Beat Pattern Grid */}
            <Card className="p-6 bg-gray-900 border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Beat Pattern Editor</h3>
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={playPattern}
                    variant={isPlaying ? "destructive" : "default"}
                    className="flex items-center space-x-2"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlaying ? 'Stop' : 'Play'}</span>
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saveBeatMutation.isPending}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </Button>
                </div>
              </div>

              {/* Pattern Grid */}
              <div className="space-y-3">
                {Object.entries(tracks).map(([trackKey, trackName]) => (
                  <div key={trackKey} className="flex items-center space-x-2">
                    <div className="w-20 text-sm font-medium text-gray-300 text-right">
                      {trackName}
                    </div>
                    <div className="flex space-x-1">
                      {Array.from({ length: 16 }, (_, stepIndex) => (
                        <button
                          key={stepIndex}
                          onClick={() => toggleStep(trackKey as keyof BeatPattern, stepIndex)}
                          className={`w-8 h-8 rounded border-2 transition-all ${
                            pattern[trackKey as keyof BeatPattern][stepIndex]
                              ? 'bg-blue-500 border-blue-400 shadow-lg'
                              : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                          } ${
                            currentStep === stepIndex && isPlaying
                              ? 'ring-2 ring-yellow-400'
                              : ''
                          }`}
                        >
                          <span className="text-xs text-white font-mono">
                            {stepIndex + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'sequencer' && (
          <div className="space-y-6">
            <OutputSequencer />
          </div>
        )}
      </div>
    </div>
  );
}

export default BeatMaker;
