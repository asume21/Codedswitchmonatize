import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, Square, Download, Share, Volume2, Loader2, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { audioManager } from "@/lib/audio";
import { Waveform } from "@/components/ui/waveform";
import { AudioVisualizer } from "@/components/ui/audio-visualizer";
import { AIProviderSelector } from "@/components/ui/ai-provider-selector";
import Sequencer from "@/components/sequencer/Sequencer";

const GENRES = [
  "Hip-Hop", "Electronic", "Pop", "Rock", "R&B", "Trap", "House", "Techno",
  "Dubstep", "Drum & Bass", "Jazz", "Funk", "Reggae", "Latin"
];

const DRUM_SAMPLES = [
  "Kick", "Snare", "Hi-Hat", "Open Hat", "Crash", "Ride", "Tom", "Clap"
];

export default function BeatStudio() {
  const [genre, setGenre] = useState("");
  const [bpm, setBpm] = useState([120]);
  const [duration, setDuration] = useState([16]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedBeat, setGeneratedBeat] = useState<any>(null);
  const [beatPattern, setBeatPattern] = useState<number[]>([]);
  const [selectedSample, setSelectedSample] = useState("Kick");
  const [volume, setVolume] = useState([75]);
  const [aiProvider, setAiProvider] = useState<"grok" | "openai" | "gemini">("grok");
  const [audioInitialized, setAudioInitialized] = useState(false);
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();

  const generateMutation = useMutation({
    mutationFn: async (params: { genre: string; bpm: number; duration: number; aiProvider: string }) => {
      // Simulate beat generation - create a simple pattern
      const pattern = Array(16).fill(0);
      
      // Generate a basic beat pattern based on genre
      if (params.genre === 'Hip-Hop' || params.genre === 'Trap') {
        // Basic hip-hop/trap pattern
        pattern[0] = 1; // Kick on 1
        pattern[4] = 1; // Snare on 2
        pattern[8] = 1; // Kick on 3
        pattern[12] = 1; // Snare on 4
        pattern[2] = 0.5; // Light kick
        pattern[6] = 0.3; // Light snare
        pattern[10] = 0.5; // Light kick
        pattern[14] = 0.3; // Light snare
      } else if (params.genre === 'House' || params.genre === 'Techno') {
        // Basic house/techno pattern
        pattern[0] = 1; // Kick on 1
        pattern[2] = 0.7; // Light kick
        pattern[4] = 0.8; // Snare
        pattern[6] = 0.7; // Light kick
        pattern[8] = 1; // Kick
        pattern[10] = 0.7; // Light kick
        pattern[12] = 0.8; // Snare
        pattern[14] = 0.7; // Light kick
      } else {
        // Random pattern for other genres
        for (let i = 0; i < 16; i++) {
          pattern[i] = Math.random() > 0.7 ? 1 : 0;
        }
      }

      return {
        pattern,
        samples: ['kick', 'snare', 'hihat'],
        description: `A ${params.genre} beat at ${params.bpm} BPM with a ${params.duration} bar pattern`,
        bpm: params.bpm,
        genre: params.genre
      };
    },
    onSuccess: (data) => {
      setGeneratedBeat(data);
      setBeatPattern(data.pattern);
      toast({
        title: "Beat generated!",
        description: `Created a ${genre} beat at ${bpm[0]} BPM`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!genre) {
      toast({
        title: "No genre selected",
        description: "Please select a genre for your beat",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      genre,
      bpm: bpm[0],
      duration: duration[0],
      aiProvider: aiProvider
    });
  };

  const handleInitializeAudio = async () => {
    try {
      await audioManager.initialize();
      setAudioInitialized(true);
      toast({
        title: "Audio ready",
        description: "Audio system initialized successfully",
      });
    } catch (error) {
      toast({
        title: "Audio initialization failed",
        description: "Please check your browser audio settings",
        variant: "destructive",
      });
    }
  };

  const handlePlay = async () => {
    try {
      if (!audioInitialized) {
        await audioManager.initialize();
        setAudioInitialized(true);
        toast({ title: "Audio ready", description: "Audio system initialized" });
      }

      const patternToPlay = generatedBeat?.pattern?.length
        ? generatedBeat.pattern
        : (beatPattern?.length ? beatPattern : null);

      if (!patternToPlay) {
        toast({
          title: "No pattern to play",
          description: "Generate a beat or edit the pattern to add steps",
          variant: "destructive",
        });
        return;
      }

      if (isPlaying) {
        audioManager.stop();
        setIsPlaying(false);
        return;
      }

      await audioManager.playBeat(
        patternToPlay,
        generatedBeat?.samples || ["kick", "snare", "hihat"],
        bpm[0]
      );
      setIsPlaying(true);
      toast({ title: "Playing beat", description: generatedBeat?.description || "Beat is now playing" });
    } catch (error) {
      console.error("Playback error:", error);
      toast({
        title: "Playback failed",
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setIsPlaying(false);
    }
  };

  const handlePatternClick = (index: number) => {
    const newPattern = [...beatPattern];
    newPattern[index] = newPattern[index] ? 0 : 1;
    setBeatPattern(newPattern);
    if (generatedBeat) {
      setGeneratedBeat({ ...generatedBeat, pattern: newPattern });
    }
  };

  const clearPattern = () => {
    setBeatPattern(Array(16).fill(0));
    if (generatedBeat) {
      setGeneratedBeat({ ...generatedBeat, pattern: Array(16).fill(0) });
    }
  };

  const randomizePattern = () => {
    const newPattern = Array(16).fill(0).map(() => Math.random() > 0.6 ? 1 : 0);
    setBeatPattern(newPattern);
    if (generatedBeat) {
      setGeneratedBeat({ ...generatedBeat, pattern: newPattern });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mr-4">
            <Music className="text-cyan-400 h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Beat Studio</h1>
            <p className="text-muted-foreground">
              Create and edit professional beats with AI assistance
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">AI-Generated</Badge>
          <Badge variant="secondary">Real-time Editing</Badge>
          <Badge variant="secondary">Multiple Genres</Badge>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="generate">Generate Beat</TabsTrigger>
          <TabsTrigger value="bass">Bass Generator</TabsTrigger>
          <TabsTrigger value="edit">Edit Pattern</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          {/* Beat Parameters */}
          <Card className="bg-background border-border mb-6">
            <CardHeader>
              <CardTitle>Beat Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Genre</label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    BPM: {bpm[0]}
                  </label>
                  <Slider
                    value={bpm}
                    onValueChange={setBpm}
                    max={200}
                    min={60}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Duration: {duration[0]} bars
                  </label>
                  <Slider
                    value={duration}
                    onValueChange={setDuration}
                    max={32}
                    min={4}
                    step={4}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">AI Provider</label>
                  <AIProviderSelector
                    value={aiProvider}
                    onValueChange={(v) => setAiProvider(v as "grok" | "openai" | "gemini")}
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Beat...
                  </>
                ) : (
                  <>
                    <Music className="mr-2 h-4 w-4" />
                    Generate Beat
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Beat Preview */}
          {generatedBeat && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-background border-border">
                <CardHeader>
                  <CardTitle>Beat Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <AudioVisualizer
                      isPlaying={isPlaying}
                      className="h-32"
                    />

                    {/* Audio Initialization */}
                    {!audioInitialized && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-purple-400">Audio Setup Required</h4>
                            <p className="text-sm text-muted-foreground">Click to enable audio playback</p>
                          </div>
                          <Button
                            onClick={handleInitializeAudio}
                            className="bg-purple-500 hover:bg-purple-500/80"
                          >
                            <Volume2 className="mr-2 h-4 w-4" />
                            Start Audio
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={handlePlay}
                          disabled={!audioInitialized}
                          className="w-12 h-12 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-50"
                        >
                          {isPlaying ? (
                            <Pause className="h-5 w-5 text-cyan-400" />
                          ) : (
                            <Play className="h-5 w-5 text-cyan-400" />
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            audioManager.stop();
                            setIsPlaying(false);
                          }}
                          variant="outline"
                          size="sm"
                          disabled={!audioInitialized}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        <Slider
                          value={volume}
                          onValueChange={setVolume}
                          max={100}
                          min={0}
                          className="w-20"
                        />
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Share className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background border-border">
                <CardHeader>
                  <CardTitle>Beat Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Samples Used</h3>
                      <div className="flex flex-wrap gap-2">
                        {(generatedBeat.samples || DRUM_SAMPLES.slice(0, 3)).map((sample: string, index: number) => (
                          <Badge key={index} variant="outline">
                            {sample}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Pattern Description</h3>
                      <p className="text-sm text-muted-foreground">
                        {generatedBeat.description || "A professionally generated beat pattern with dynamic rhythm and excellent groove."}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Specifications</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">BPM:</span>
                          <span>{bpm[0]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Genre:</span>
                          <span>{genre}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pattern Length:</span>
                          <span>{beatPattern.length} steps</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bass">
          <Card className="bg-background border-border">
            <CardHeader>
              <CardTitle>Bass Generator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Bass Type</label>
                    <Select value={selectedSample} onValueChange={setSelectedSample}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select bass type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kick">Sub Bass</SelectItem>
                        <SelectItem value="Snare">Wobble Bass</SelectItem>
                        <SelectItem value="Hi-Hat">808 Bass</SelectItem>
                        <SelectItem value="Open Hat">FM Bass</SelectItem>
                        <SelectItem value="Clap">Acid Bass</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Key</label>
                    <Select value="C" onValueChange={() => {}}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select key" />
                      </SelectTrigger>
                      <SelectContent>
                        {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(key => (
                          <SelectItem key={key} value={key}>{key} Major</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Pattern Style</label>
                    <Select value="walking" onValueChange={() => {}}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="walking">Walking Bass</SelectItem>
                        <SelectItem value="octave">Octave Jumps</SelectItem>
                        <SelectItem value="chromatic">Chromatic</SelectItem>
                        <SelectItem value="pentatonic">Pentatonic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button className="bg-green-600 hover:bg-green-700">
                    Generate Bassline
                  </Button>
                  <Button variant="outline">
                    Preview Bass
                  </Button>
                  <Button variant="outline">
                    Add to Beat
                  </Button>
                </div>

                <div className="bg-secondary/20 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Bass Pattern Preview</h3>
                  <div className="text-sm text-muted-foreground mb-4">
                    Bass generator will create complementary basslines that work with your drum patterns.
                    Select different styles, keys, and bass types to create the perfect foundation for your tracks.
                  </div>
                  <div className="grid grid-cols-16 gap-1">
                    {Array.from({ length: 16 }, (_, i) => (
                      <div key={i} className="h-8 bg-secondary/50 rounded text-xs flex items-center justify-center">
                        {i % 4 === 0 ? '•' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit">
          <Card className="bg-background border-border">
            <CardHeader>
              <CardTitle>Pattern Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Step Sequencer</h3>
                  <div className="flex space-x-2">
                    <Button onClick={clearPattern} variant="outline" size="sm">
                      Clear
                    </Button>
                    <Button onClick={randomizePattern} variant="outline" size="sm">
                      Randomize
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-16 gap-1">
                  {Array.from({ length: 16 }, (_, i) => (
                    <Button
                      key={i}
                      onClick={() => handlePatternClick(i)}
                      className={`w-8 h-8 p-0 ${
                        beatPattern[i] 
                          ? "bg-cyan-500 hover:bg-cyan-600" 
                          : "bg-secondary hover:bg-secondary/80"
                      }`}
                      size="sm"
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>

                <div className="text-sm text-muted-foreground">
                  Click steps to activate/deactivate them in the beat pattern
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequencer">
          <Sequencer />
        </TabsContent>
      </Tabs>
    </div>
  );
}