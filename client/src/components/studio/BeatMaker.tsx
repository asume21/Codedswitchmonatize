import { useState, useRef, useEffect, useContext, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio, type DrumType } from "@/hooks/use-audio";
import { useMIDI } from "@/hooks/use-midi";
import { Slider } from "@/components/ui/slider";
import { StudioAudioContext } from "@/pages/studio";
import { AIProviderSelector } from "@/components/ui/ai-provider-selector";
import OutputSequencer from "@/components/producer/OutputSequencer";
import { AudioPlayer } from "@/components/ui/audio-player";
import audioRouter from "@/lib/audioRouter";
import { Send, Layers, Music } from "lucide-react";

const GENRE_OPTIONS = [
  { value: "hip-hop", label: "Hip-Hop" },
  { value: "trap", label: "Trap" },
  { value: "house", label: "House" },
  { value: "techno", label: "Techno" },
  { value: "dnb", label: "Drum & Bass" },
  { value: "ambient", label: "Ambient" },
];

interface BeatPattern {
  kick: boolean[];
  snare: boolean[];
  hihat: boolean[];
  clap: boolean[];
  tom: boolean[];
  crash: boolean[];
}

const drumKits = {
  acoustic: {
    name: 'Acoustic',
    sounds: [
      { id: 'kick', name: 'Kick', color: 'bg-red-500' },
      { id: 'snare', name: 'Snare', color: 'bg-blue-500' },
      { id: 'hihat', name: 'Hi-Hat', color: 'bg-yellow-500' },
      { id: 'clap', name: 'Clap', color: 'bg-green-500' },
      { id: 'tom', name: 'Tom', color: 'bg-purple-600' },
      { id: 'crash', name: 'Crash', color: 'bg-orange-500' },
    ]
  }
};

const defaultTracks = [
  { id: "kick", name: "Kick", color: "bg-red-500" },
  { id: "snare", name: "Snare", color: "bg-blue-500" },
  { id: "hihat", name: "Hi-hat", color: "bg-yellow-500" },
  { id: "clap", name: "Clap", color: "bg-green-500" },
  { id: "tom", name: "Tom", color: "bg-purple-600" },
  { id: "crash", name: "Crash", color: "bg-orange-500" },
];

const createEmptyPattern = (): BeatPattern => ({
  kick: Array(16).fill(false),
  snare: Array(16).fill(false),
  hihat: Array(16).fill(false),
  clap: Array(16).fill(false),
  tom: Array(16).fill(false),
  crash: Array(16).fill(false),
});

const toBooleanSteps = (source?: Array<number | boolean>) => {
  const length = 16;
  if (!Array.isArray(source) || source.length === 0) {
    return Array(length).fill(false);
  }

  return Array.from({ length }, (_, index) => Boolean(source[index % source.length]));
};

const normalizeToBeatPattern = (source?: Record<string, any>): BeatPattern => {
  if (!source || typeof source !== "object") {
    return createEmptyPattern();
  }

  return {
    kick: toBooleanSteps(source.kick),
    snare: toBooleanSteps(source.snare),
    hihat: toBooleanSteps(source.hihat ?? source.hiHat ?? source.closedHat),
    clap: toBooleanSteps(source.clap ?? source.percussion ?? source.openhat),
    tom: toBooleanSteps(source.tom ?? source.tom1 ?? source.tom2 ?? source.tom3),
    crash: toBooleanSteps(source.crash ?? source.ride ?? source.cymbal),
  };
};

export default function BeatMaker() {
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
  const [selectedGenre, setSelectedGenre] = useState(GENRE_OPTIONS[0].value);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

  // Initialize pattern with default structure or load from studio context
  const [pattern, setPattern] = useState<BeatPattern>(() => {
    if (studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0) {
      return normalizeToBeatPattern(studioContext.currentPattern);
    }

    const storedData = localStorage.getItem("generatedMusicData");
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed?.beatPattern) {
          return normalizeToBeatPattern(parsed.beatPattern);
        }
      } catch (error) {
        console.error("Error loading stored pattern:", error);
      }
    }

    return createEmptyPattern();
  });

  const { toast } = useToast();
  const { playDrum, initialize, isInitialized } = useAudio();
  
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

  const calculatedDuration = useMemo(() => {
    const safeBpm = Math.max(40, Math.min(240, bpm || 120));
    const barCount = Math.max(1, bars || 1);
    const totalBeats = barCount * 4;
    const seconds = (totalBeats * 60) / safeBpm;
    return Math.max(1, Math.round(seconds));
  }, [bars, bpm]);

  // Beat generation mutation
  const generateBeatMutation = useMutation({
    mutationFn: async () => {
      const normalizedBpm = Math.max(40, Math.min(240, bpm || 120));
      const payload = {
        genre: selectedGenre,
        bpm: normalizedBpm,
        duration: calculatedDuration,
        aiProvider: aiProvider,
      };

      const response = await apiRequest("POST", "/api/beats/generate", payload);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = errorBody?.error || "Failed to generate beat";
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (data) => {
      const beatPattern = data?.beat?.pattern;
      const audioUrl = data?.beat?.audioUrl;
      
      if (beatPattern) {
        const normalizedPattern = normalizeToBeatPattern(beatPattern);
        setPattern(normalizedPattern);

        if (studioContext.setCurrentPattern) {
          studioContext.setCurrentPattern(normalizedPattern);
        }

        try {
          localStorage.setItem(
            "generatedMusicData",
            JSON.stringify({ 
              beatPattern: beatPattern,
              audioUrl: audioUrl,
              creditsRemaining: data?.creditsRemaining
            })
          );
        } catch (error) {
          console.warn("Unable to cache generated beat pattern:", error);
        }

        toast({
          title: "Beat Generated! 🎵",
          description: `Fresh ${selectedGenre} groove at ${bpm} BPM. ${audioUrl ? 'AI audio ready!' : 'Pattern loaded.'}`,
        });
        
        // Set the generated audio URL to display the player
        if (audioUrl) {
          setGeneratedAudioUrl(audioUrl);
          console.log('✅ AI-generated beat audio available:', audioUrl);
        }
      } else {
        toast({
          title: "Beat Generation",
          description: "Response received, but no beat pattern was returned.",
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
    try {
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
        try {
          const step = stepCounterRef.current % 16;
          setCurrentStep(step);
          
          // Play sounds for active steps with mobile-safe error handling
          Object.entries(pattern).forEach(([track, steps]) => {
            if (steps[step]) {
              try {
                playDrum(track as DrumType);
              } catch (drumError) {
                console.warn(`Failed to play ${track}:`, drumError);
                // Don't crash the whole interval if one drum fails
              }
            }
          });
          
          stepCounterRef.current++;
        } catch (stepError) {
          console.error('Step playback error:', stepError);
          // If step fails, stop playback to prevent crashes
          stopPattern();
          toast({
            title: "Playback Error",
            description: "Audio playback stopped due to an error. Try restarting.",
            variant: "destructive"
          });
        }
      }, stepTime);
    } catch (error) {
      console.error('Failed to start playback:', error);
      setIsPlaying(false);
      toast({
        title: "Audio Error",
        description: "Failed to initialize audio. Please try again.",
        variant: "destructive"
      });
    }
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

  // Export functions for audio routing
  const exportToMixer = () => {
    const beatData = {
      pattern,
      bpm,
      genre: selectedGenre,
      name: `Beat_${selectedGenre}_${bpm}BPM`,
      timestamp: new Date().toISOString()
    };

    // Add to audio router as a track
    audioRouter.addTrack({
      id: `beat-${Date.now()}`,
      name: beatData.name,
      type: 'drums',
      instrument: 'drums',
      pattern: pattern,
      audioUrl: generatedAudioUrl,
      volume: 75,
      pan: 0,
      muted: false,
      solo: false,
      bus: 'drums' // Route to drums bus
    });

    // Route to MixStudio
    audioRouter.routeAudio(
      'BeatMaker',
      'MixStudio',
      beatData,
      'beat',
      { bpm, key: 'drums' }
    );

    toast({
      title: "Sent to Mixer",
      description: "Your beat has been routed to the Mix Studio",
    });
  };

  const exportToArrangement = () => {
    const beatData = {
      pattern,
      bpm,
      genre: selectedGenre,
      name: `Beat_${selectedGenre}_${bpm}BPM`
    };

    // Route to Arrangement Timeline
    audioRouter.routeAudio(
      'BeatMaker',
      'ArrangementTimeline',
      beatData,
      'beat',
      { bpm }
    );

    toast({
      title: "Added to Arrangement",
      description: "Your beat has been added to the timeline",
    });
  };

  const exportToEffects = () => {
    // Route to Effects Bus for processing
    audioRouter.updateTrackRouting(`beat-${Date.now()}`, 'effects');
    
    toast({
      title: "Sent to Effects",
      description: "Your beat is routed through the effects bus",
    });
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
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">BPM:</span>
                    <Input
                      type="number"
                      value={bpm}
                      onChange={(e) => setBpm(Number(e.target.value))}
                      className="w-16 text-sm"
                      min="60"
                      max="200"
                      aria-label="BPM tempo control"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateAI}
                    disabled={generateBeatMutation.isPending}
                    className="bg-studio-accent hover:bg-blue-500"
                  >
                    {generateBeatMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner animate-spin mr-2"></i>
                        Generating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-magic mr-2"></i>
                        Generate Beat
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* AI Generated Audio Player */}
            {generatedAudioUrl && (
              <AudioPlayer 
                audioUrl={generatedAudioUrl}
                title={`AI Beat - ${selectedGenre} (${bpm} BPM)`}
                className="mt-6"
              />
            )}
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="space-y-6">
            {/* Pattern Editor */}
            <div className="border border-gray-600 rounded-lg p-4 bg-gray-800">
              <h3 className="text-lg font-medium mb-2">Drum Pattern Sequencer</h3>
              <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                <span>Click squares to add drum hits • 16 steps per pattern</span>
                <span>BPM: {bpm}</span>
              </div>
              
              {/* Controls */}
              <div className="flex items-center space-x-4 mb-4">
                <Button
                  onClick={initialize}
                  disabled={isInitialized}
                  className="bg-studio-accent hover:bg-blue-500"
                >
                  <i className="fas fa-power-off mr-2"></i>
                  {isInitialized ? 'Audio Ready' : 'Start Audio'}
                </Button>
                <Button
                  onClick={playPattern}
                  className={`${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-studio-success hover:bg-green-500'}`}
                >
                  <i className={`fas ${isPlaying ? 'fa-stop' : 'fa-play'} mr-2`}></i>
                  {isPlaying ? 'Stop' : 'Play'}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveBeatMutation.isPending}
                  className="bg-gray-600 hover:bg-gray-500"
                >
                  {saveBeatMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner animate-spin mr-2"></i>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i>
                      Save Beat
                    </>
                  )}
                </Button>
                
                {/* Export/Routing Buttons */}
                <div className="border-l border-gray-600 pl-4 ml-2 flex items-center space-x-2">
                  <span className="text-xs text-gray-400 mr-2">Route to:</span>
                  <Button
                    onClick={exportToMixer}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-500"
                    title="Send beat to Mix Studio"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Mixer
                  </Button>
                  <Button
                    onClick={exportToArrangement}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-500"
                    title="Add to arrangement timeline"
                  >
                    <Layers className="w-4 h-4 mr-1" />
                    Timeline
                  </Button>
                  <Button
                    onClick={exportToEffects}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-500"
                    title="Send through effects bus"
                  >
                    <Music className="w-4 h-4 mr-1" />
                    Effects
                  </Button>
                </div>
              </div>
              
              {/* Visual Time Indicator */}
              {isPlaying && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Beat Progress</span>
                    <span>Step {(currentStep % 16) + 1} of 16</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                    <div 
                      className="bg-yellow-400 h-2 rounded-full transition-all duration-75 relative"
                      style={{ width: `${((currentStep % 16) + 1) / 16 * 100}%` }}
                    >
                      <div className="absolute right-0 top-0 w-1 h-2 bg-yellow-300 animate-pulse rounded-full"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-16 gap-px">
                    {Array.from({ length: 16 }, (_, i) => (
                      <div 
                        key={i}
                        className={`h-1 rounded-sm transition-all duration-75 ${
                          i === (currentStep % 16) 
                            ? 'bg-yellow-400 animate-pulse' 
                            : i < (currentStep % 16) 
                              ? 'bg-yellow-600' 
                              : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Drum Grid */}
              <div className="space-y-4">
                {tracks.map((track) => (
                  <div key={track.id} className="flex items-center space-x-4">
                    <div className="w-24 text-sm font-medium flex items-center space-x-2">
                      <button
                        onClick={async () => {
                          if (!isInitialized) {
                            await initialize();
                          }
                          playDrum(track.id as DrumType);
                        }}
                        className={`w-8 h-8 rounded ${track.color} flex items-center justify-center text-xs font-bold text-white shadow-lg hover:scale-110 transition-transform`}
                        title={`Test ${track.name} sound`}
                      >
                        ▶
                      </button>
                      <span className="text-gray-200">{track.name}</span>
                    </div>

                    <div className="flex space-x-1">
                      {(pattern[track.id as keyof BeatPattern] || Array(16).fill(false)).map((active, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            toggleStep(track.id as keyof BeatPattern, index);
                            if (!active && isInitialized) {
                              playDrum(track.id as DrumType);
                            }
                          }}
                          className={`beat-pad w-10 h-10 rounded border-2 transition-all relative flex items-center justify-center text-xs font-bold ${
                            active 
                              ? `${track.color} shadow-lg transform scale-105 border-gray-300 text-white` 
                              : "bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-400 hover:border-gray-400"
                          } ${
                            isPlaying && (currentStep % 16) === index 
                              ? "ring-4 ring-yellow-400 ring-opacity-100 shadow-lg shadow-yellow-400/50 animate-pulse scale-110" 
                              : ""
                          }`}
                          title={`${track.name} - Step ${index + 1} (Click to toggle)`}
                        >
                          <span className="opacity-70">{index + 1}</span>
                          
                          {/* Beat markers above */}
                          {index % 4 === 0 && (
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-yellow-400 font-bold bg-gray-800 px-1 rounded">
                              Beat {(index / 4) + 1}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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