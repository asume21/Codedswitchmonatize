import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Zap,
  Code,
  Music,
  Play,
  Pause,
  ArrowRight,
  Download,
  Share,
  Loader2,
  Volume2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { advancedAudioManager } from "@/lib/advancedAudio";
import { Slider } from "@/components/ui/slider";
import { AIProviderSelector } from "@/components/ui/ai-provider-selector";

const PROGRAMMING_LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C#",
  "C++",
  "Go",
  "Rust",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "Dart",
  "Scala",
];

const MUSICAL_KEYS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export default function CodeBeatStudio() {
  const [sourceCode, setSourceCode] = useState("");
  const [language, setLanguage] = useState("");
  const [musicResult, setMusicResult] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [aiProvider, setAiProvider] = useState("openai");
  const { toast } = useToast();

  const convertMutation = useMutation({
    mutationFn: async (data: {
      code: string;
      language: string;
      aiProvider: string;
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/code/convert-to-music",
        data,
      );
      return response.json();
    },
    onSuccess: (data) => {
      setMusicResult(data);
      toast({
        title: "Code converted to music!",
        description: `Created a musical composition in ${data.key} at ${data.tempo} BPM`,
      });
    },
    onError: (error) => {
      toast({
        title: "Conversion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConvert = () => {
    if (!sourceCode.trim()) {
      toast({
        title: "No code provided",
        description: "Please enter some code to convert",
        variant: "destructive",
      });
      return;
    }

    if (!language) {
      toast({
        title: "No language selected",
        description: "Please select the programming language",
        variant: "destructive",
      });
      return;
    }

    convertMutation.mutate({
      code: sourceCode,
      language,
      aiProvider,
    });
  };

  const handleInitializeAudio = async () => {
    try {
      await advancedAudioManager.initialize();
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
    if (!audioInitialized) {
      toast({
        title: "Audio not ready",
        description: "Click 'Start Audio' first to enable sound",
        variant: "destructive",
      });
      return;
    }

    if (!musicResult) return;

    if (isPlaying) {
      advancedAudioManager.stop();
      setIsPlaying(false);
    } else {
      try {
        await advancedAudioManager.playMelody(
          musicResult.melody,
          musicResult.tempo,
        );
        setIsPlaying(true);

        // Auto-stop after melody completes
        setTimeout(
          () => {
            setIsPlaying(false);
          },
          musicResult.melody.length * (60 / musicResult.tempo) * 0.5 * 1000,
        );
      } catch (error) {
        toast({
          title: "Playback failed",
          description: "Could not play the generated music",
          variant: "destructive",
        });
      }
    }
  };

  const exampleCodes = {
    JavaScript: `function fibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

// Recursive pattern creates ascending melody
// Loop structure adds rhythmic complexity`,

    Python: `import random

def generate_pattern(size):
    pattern = []
    for i in range(size):
        if i % 2 == 0:
            pattern.append(random.choice([1, 2, 3]))
        else:
            pattern.append(0)
    return pattern

# Conditional logic creates syncopated rhythm
# Random elements add harmonic variation`,

    Java: `public class MelodyGenerator {
    private int[] notes = {60, 62, 64, 65, 67, 69, 71, 72};
    
    public void playScale() {
        for (int note : notes) {
            System.out.println("Playing note: " + note);
            Thread.sleep(250);
        }
    }
}

// Object structure maps to chord progressions
// Array iteration creates melodic sequences`,
  };

  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const getMIDINoteName = (midiNote: number) => {
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    return `${noteNames[noteIndex]}${octave}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <div className="flex">
        <div className="flex-1 ml-64 p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 rounded-lg flex items-center justify-center mr-4">
                <Zap className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  Code<span className="text-purple-400">Beat</span> Studio
                </h1>
                <p className="text-muted-foreground">
                  Transform your code into musical compositions with AI magic
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Revolutionary</Badge>
              <Badge variant="secondary">Code Analysis</Badge>
              <Badge variant="secondary">Musical Mapping</Badge>
              <Badge variant="secondary">AI-Powered</Badge>
            </div>
          </div>

          {/* Conversion Interface */}
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Code className="mr-2 h-5 w-5 text-purple-400" />
                Code Input
                <ArrowRight className="mx-4 h-5 w-5 text-purple-400" />
                <Music className="mr-2 h-5 w-5 text-pink-400" />
                Music Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Code Input */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Programming Language
                      </label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROGRAMMING_LANGUAGES.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        AI Provider
                      </label>
                      <AIProviderSelector
                        value={aiProvider}
                        onValueChange={setAiProvider}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Source Code
                    </label>
                    <Textarea
                      value={sourceCode}
                      onChange={(e) => setSourceCode(e.target.value)}
                      placeholder="Enter your code here..."
                      className="min-h-64 font-mono bg-background border-border resize-none"
                    />
                  </div>

                  {language &&
                    exampleCodes[language as keyof typeof exampleCodes] && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSourceCode(
                            exampleCodes[language as keyof typeof exampleCodes],
                          )
                        }
                      >
                        Load Example Code
                      </Button>
                    )}
                </div>

                {/* Music Output */}
                <div className="space-y-4">
                  {musicResult ? (
                    <>
                      <div className="space-y-4">
                        <Card className="bg-background border-border">
                          <CardContent className="p-4">
                            {/* Audio Initialization */}
                            {!audioInitialized && (
                              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-medium text-purple-400">
                                      Audio Setup Required
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      Click to enable audio playback
                                    </p>
                                  </div>
                                  <Button
                                    onClick={handleInitializeAudio}
                                    className="bg-purple-600 hover:bg-purple-700"
                                  >
                                    <Volume2 className="mr-2 h-4 w-4" />
                                    Start Audio
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Button
                                  onClick={handlePlay}
                                  disabled={!audioInitialized}
                                  className="w-12 h-12 rounded-full bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-50"
                                >
                                  {isPlaying ? (
                                    <Pause className="h-5 w-5 text-purple-400" />
                                  ) : (
                                    <Play className="h-5 w-5 text-purple-400" />
                                  )}
                                </Button>
                                <div className="text-sm">
                                  <div className="text-foreground">
                                    Generated Composition
                                  </div>
                                  <div className="text-muted-foreground text-xs">
                                    {musicResult.tempo} BPM • {musicResult.key}
                                  </div>
                                </div>
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
                          </CardContent>
                        </Card>

                        <div className="grid grid-cols-2 gap-4">
                          <Card className="bg-background border-border">
                            <CardContent className="p-4">
                              <h3 className="font-medium mb-2 text-purple-400">
                                Musical Key
                              </h3>
                              <Badge
                                variant="outline"
                                className="text-purple-400"
                              >
                                {musicResult.key}
                              </Badge>
                            </CardContent>
                          </Card>

                          <Card className="bg-background border-border">
                            <CardContent className="p-4">
                              <h3 className="font-medium mb-2 text-pink-400">
                                Tempo
                              </h3>
                              <Badge
                                variant="outline"
                                className="text-pink-400"
                              >
                                {musicResult.tempo} BPM
                              </Badge>
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="bg-background border-border">
                          <CardContent className="p-4">
                            <h3 className="font-medium mb-2">Melody Pattern</h3>
                            <div className="grid grid-cols-8 gap-1">
                              {musicResult.melody
                                .slice(0, 16)
                                .map((note: number, index: number) => (
                                  <div
                                    key={index}
                                    className="p-2 bg-purple-600/20 rounded text-center text-xs font-mono"
                                    title={`MIDI Note ${note}`}
                                  >
                                    {getMIDINoteName(note)}
                                  </div>
                                ))}
                            </div>
                          </CardContent>
                        </Card>

                        {musicResult.rhythm && (
                          <Card className="bg-background border-border">
                            <CardContent className="p-4">
                              <h3 className="font-medium mb-2">
                                Rhythm Pattern
                              </h3>
                              <div className="grid grid-cols-16 gap-1">
                                {musicResult.rhythm
                                  .slice(0, 16)
                                  .map((beat: number, index: number) => (
                                    <div
                                      key={index}
                                      className={`w-4 h-4 rounded ${
                                        beat ? "bg-purple-400" : "bg-border"
                                      }`}
                                    />
                                  ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <Button variant="outline" className="flex-1">
                          <Download className="h-4 w-4 mr-2" />
                          Export MIDI
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Share className="h-4 w-4 mr-2" />
                          Share
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="min-h-64 bg-background border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
                      Your musical composition will appear here
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Convert Button */}
          <div className="flex justify-center mb-6">
            <Button
              onClick={handleConvert}
              disabled={convertMutation.isPending}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white font-semibold"
              size="lg"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Converting Code to Music...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Transform Code to Music
                </>
              )}
            </Button>
          </div>

          {/* Explanation */}
          {musicResult && (
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <CardTitle>Conversion Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert max-w-none">
                  <p className="text-muted-foreground">
                    {musicResult.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* How It Works */}
          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-purple-400">
                🎵 How CodeBeat Fusion Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <h3 className="font-medium mb-2 text-purple-400">
                    1. Code Analysis
                  </h3>
                  <ul className="space-y-1 text-xs">
                    <li>• Analyzes code structure and complexity</li>
                    <li>• Identifies patterns and loops</li>
                    <li>• Maps function calls to melodic phrases</li>
                    <li>• Converts variables to harmonic elements</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2 text-pink-400">
                    2. Musical Mapping
                  </h3>
                  <ul className="space-y-1 text-xs">
                    <li>• Conditional statements → chord changes</li>
                    <li>• Loops → repeating musical patterns</li>
                    <li>• Function depth → musical octaves</li>
                    <li>• Code complexity → rhythmic density</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2 text-purple-400">
                    3. Composition
                  </h3>
                  <ul className="space-y-1 text-xs">
                    <li>• Generates MIDI note sequences</li>
                    <li>• Creates rhythmic patterns</li>
                    <li>• Assigns appropriate tempo and key</li>
                    <li>• Produces playable musical output</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
