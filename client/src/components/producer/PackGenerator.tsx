import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sparkles, Dice1, Play, Pause, Download, Volume2, 
  Loader2, Zap, Package, Headphones, Music, Plus, DatabaseIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GeneratedPack {
  id: string;
  title: string;
  description: string;
  bpm: number;
  key: string;
  genre: string;
  samples: {
    id: string;
    name: string;
    type: "loop" | "oneshot" | "midi";
    duration: number;
    url?: string;
    audioUrl?: string;
    pattern?: any;
    aiData?: {
      notes?: string[];
      pattern?: number[];
      intensity?: number;
    }
  }[];
  metadata: {
    energy: number;
    mood: string;
    instruments: string[];
    tags: string[];
  }
}

const RANDOM_PROMPTS = [
  "Heavy synths and ambient guitars with a cyberpunk vibe, 100 BPM, C minor.",
  "Intense and suspenseful movie trailer score with big percussion hits and chilling strings.",
  "Dreamy lo-fi hip hop with vinyl crackle, warm pads, and mellow jazz chords, 85 BPM.",
  "Aggressive trap beats with 808s, dark atmosphere, and industrial elements, 140 BPM.",
  "Uplifting house music with piano melodies, vocal chops, and four-on-the-floor kicks, 128 BPM.",
];

export default function PackGenerator() {
  const [prompt, setPrompt] = useState("");
  const [packCount, setPackCount] = useState(4);
  const [generatedPacks, setGeneratedPacks] = useState<GeneratedPack[]>([]);
  const [playingPack, setPlayingPack] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState("musicgen");
  const [previewVolume, setPreviewVolume] = useState([75]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleRandomPrompt = () => {
    const randomPrompt = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    setPrompt(randomPrompt);
  };

  const handlePlayPack = (pack: GeneratedPack) => {
    console.log("Playing pack:", pack.title);
    setPlayingPack(pack.id);
    setTimeout(() => setPlayingPack(null), 8000);
  };

  const handleDownloadPack = (pack: GeneratedPack) => {
    toast({
      title: `Downloading "${pack.title}"`,
      description: `${pack.samples.length} samples • ${pack.genre} • ${pack.key}`,
    });
  };

  const generateWithMusicGen = async (userPrompt: string) => {
    try {
      const response = await fetch("/api/music/generate-with-musicgen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt, duration: 10 }),
      });

      if (!response.ok) {
        throw new Error(`MusicGen generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      const musicGenPack: GeneratedPack = {
        id: `musicgen-${Date.now()}`,
        title: "MusicGen AI Pack",
        description: `AI-generated music from prompt: "${userPrompt}"`,
        bpm: 120,
        key: "C",
        genre: "Electronic",
        samples: [{
          id: `sample-musicgen-${Date.now()}`,
          name: "AI Generated Track",
          type: "loop",
          duration: 10,
          audioUrl: data.audioUrl,
          aiData: {
            notes: [],
            pattern: [],
            intensity: 0.8
          }
        }],
        metadata: {
          energy: 80,
          mood: "Dynamic",
          instruments: ["AI Synth"],
          tags: ["AI Generated", "MusicGen"]
        }
      };

      setGeneratedPacks([musicGenPack]);
      toast({
        title: "MusicGen AI Pack Generated!",
        description: "Real AI-generated audio created and ready to preview.",
      });
    } catch (error) {
      toast({
        title: "MusicGen Generation Failed",
        description: (error as Error)?.message || "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center">
                <Package className="text-white h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">Pack Generator</h1>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                    Beta
                  </Badge>
                </div>
                <p className="text-xl text-muted-foreground mt-1">
                  Enter a prompt, listen to the previews, then download your favorite pack.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Powered
              </Badge>
              <Badge variant="secondary">Real-time</Badge>
              <Badge variant="secondary">High Quality</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-8">
        {/* Examples */}
        <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-200/20">
          <CardHeader>
            <CardTitle className="text-emerald-700 dark:text-emerald-300">
              Examples of prompts:
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Heavy synths and ambient guitars with a cyberpunk vibe, 100 BPM, C minor.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Intense and suspenseful movie trailer score with big percussion hits and chilling strings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Prompt Input */}
        <Card className="border-2 border-emerald-200/30">
          <CardHeader>
            <CardTitle className="text-emerald-600">Enter Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Textarea
                placeholder="Describe anything..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none text-lg border-emerald-200/50 focus:border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/30"
              />
              
              <Button
                variant="outline"
                onClick={handleRandomPrompt}
                className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              >
                <Dice1 className="h-4 w-4 mr-2" />
                Try a Random Prompt
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Number of Packs</label>
                <Select value={packCount.toString()} onValueChange={(v) => setPackCount(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Pack</SelectItem>
                    <SelectItem value="2">2 Packs</SelectItem>
                    <SelectItem value="4">4 Packs</SelectItem>
                    <SelectItem value="6">6 Packs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">AI Provider</label>
                <Select value={aiProvider} onValueChange={setAiProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="structure">📋 AI Structure Generator</SelectItem>
                    <SelectItem value="musicgen">🎵 MusicGen AI (Real Audio)</SelectItem>
                    <SelectItem value="grok">🤖 Grok AI (Premium)</SelectItem>
                    <SelectItem value="intelligent">🧠 Basic (Free)</SelectItem>
                    <SelectItem value="openai" disabled>💡 OpenAI (Configure API key)</SelectItem>
                    <SelectItem value="gemini" disabled>💎 Gemini (Configure API key)</SelectItem>
                    <SelectItem value="anthropic" disabled>🔬 Anthropic (Configure API key)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Preview Volume: {previewVolume[0]}%
                </label>
                <Slider
                  value={previewVolume}
                  onValueChange={setPreviewVolume}
                  max={100}
                  min={0}
                  step={1}
                />
              </div>
            </div>

            <Button
              onClick={() => generateWithMusicGen(prompt)}
              disabled={!prompt.trim()}
              className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Music className="mr-2 h-5 w-5" />
              Generate with MusicGen AI
            </Button>
          </CardContent>
        </Card>

        {/* Generated Packs */}
        {generatedPacks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Generated Sample Packs</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedPacks.map((pack) => (
                <Card key={pack.id} className="border-emerald-200/30 hover:border-emerald-300/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{pack.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {pack.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                        {pack.genre}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Pack Info */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">BPM:</span>
                        <p className="font-medium">{pack.bpm}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Key:</span>
                        <p className="font-medium">{pack.key}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Samples:</span>
                        <p className="font-medium">{pack.samples.length}</p>
                      </div>
                    </div>

                    {/* Instruments */}
                    <div>
                      <span className="text-sm text-muted-foreground">Instruments:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(Array.isArray(pack.metadata.instruments) ? pack.metadata.instruments : 
                          typeof pack.metadata.instruments === 'string' ? (pack.metadata.instruments as string).split(',').map((s: string) => s.trim()) : 
                          ['Unknown']).map((instrument: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {instrument}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Sample List */}
                    <div>
                      <span className="text-sm text-muted-foreground">Samples:</span>
                      <div className="space-y-1 mt-1">
                        {pack.samples.slice(0, 3).map((sample) => (
                          <div key={sample.id} className="flex items-center justify-between text-xs">
                            <span>{sample.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {sample.type}
                            </Badge>
                          </div>
                        ))}
                        {pack.samples.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{pack.samples.length - 3} more samples
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePlayPack(pack)}
                        className="flex-1"
                      >
                        {playingPack === pack.id ? (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Preview
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => handleDownloadPack(pack)}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      >
                        <DatabaseIcon className="h-4 w-4 mr-1" />
                        Add to Library
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Help Section */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Pro Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">Be Specific</h4>
                <p className="text-muted-foreground">
                  Include BPM, key, genre, and mood for better results
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Use Musical Terms</h4>
                <p className="text-muted-foreground">
                  Mention instruments, scales, and production techniques
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Describe the Vibe</h4>
                <p className="text-muted-foreground">
                  Add emotional context like "aggressive", "dreamy", or "nostalgic"
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Reference Styles</h4>
                <p className="text-muted-foreground">
                  Mention genres, artists, or movie soundtracks for inspiration
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}