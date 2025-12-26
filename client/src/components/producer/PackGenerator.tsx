import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Dice1, Play, Pause, Download,
  Loader2, Package, Headphones, Music, DatabaseIcon,
  Star, History, Edit2, Check, X, Volume2, DownloadCloud, Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTracks } from "@/hooks/useTracks";
import { packSynthesizer } from "@/lib/packAudioSynthesizer";

const PACK_HISTORY_KEY = "pack-generator-history";

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
    };
  }[];
  metadata: {
    energy: number;
    mood: string;
    instruments: string[];
    tags: string[];
  };
}

const RANDOM_PROMPTS = [
  "Heavy synths and ambient guitars with a cyberpunk vibe, 100 BPM, C minor.",
  "Intense and suspenseful movie trailer score with big percussion hits and chilling strings.",
  "Dreamy lo-fi hip hop with vinyl crackle, warm pads, and mellow jazz chords, 85 BPM.",
  "Aggressive trap beats with 808s, dark atmosphere, and industrial elements, 140 BPM.",
  "Uplifting house music with piano melodies, vocal chops, and four-on-the-floor kicks, 128 BPM."
];

const PROVIDER_OPTIONS = [
  {
    value: "musicgen",
    label: "🎵 MusicGen AI (Audio)",
    description: "Replicate-powered generation with real audio when tokens are configured.",
  },
  {
    value: "suno",
    label: "🌞 Suno Instrumentals",
    description: "Uses the official Suno API for polished stems (requires SUNO_API_KEY).",
  },
  {
    value: "jasco",
    label: "🎹 JASCO Chords/Drums/Melody",
    description: "Hugging Face JASCO-1B model for theory-heavy arrangements (HUGGINGFACE_API_KEY).",
  },
  {
    value: "structure",
    label: "📋 AI Structure Generator",
    description: "Gemini-powered structured packs (metadata focused).",
  },
  {
    value: "intelligent",
    label: "🧠 Intelligent (Fast & Offline)",
    description: "Server-side intelligent generator with zero external APIs.",
  },
] as const;

// ISSUE #8: Prompt templates by genre
const PROMPT_TEMPLATES: Record<string, string[]> = {
  'Hip-Hop': [
    "Boom bap drums with dusty vinyl samples, jazzy piano chops, 90 BPM, A minor",
    "Modern trap-influenced hip hop with 808s and melodic synths, 140 BPM, F minor",
  ],
  'Electronic': [
    "Driving techno with pulsing basslines and atmospheric pads, 130 BPM, G minor",
    "Ambient electronic with granular textures and evolving soundscapes, 100 BPM, D major",
  ],
  'Lo-Fi': [
    "Chill lo-fi beats with vinyl crackle, warm Rhodes, and soft drums, 75 BPM, C major",
    "Nostalgic lo-fi with tape saturation and mellow guitar loops, 85 BPM, E minor",
  ],
  'Cinematic': [
    "Epic orchestral trailer music with massive percussion and brass, 120 BPM, D minor",
    "Tense thriller score with strings, piano, and suspenseful builds, 90 BPM, B minor",
  ],
  'House': [
    "Deep house with groovy basslines and soulful vocal chops, 124 BPM, A minor",
    "Tech house with driving rhythms and hypnotic synth patterns, 128 BPM, F minor",
  ],
};

export default function PackGenerator() {
  const [prompt, setPrompt] = useState("");
  const [packCount, setPackCount] = useState(4);
  const [generatedPacks, setGeneratedPacks] = useState<GeneratedPack[]>([]);
  const [playingPack, setPlayingPack] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState("musicgen");
  const [previewVolume, setPreviewVolume] = useState([75]);
  const { toast } = useToast();
  const { addTrack } = useTracks();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // ISSUE #1: Generation history
  const [packHistory, setPackHistory] = useState<GeneratedPack[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PACK_HISTORY_KEY);
      if (saved) {
        try { return JSON.parse(saved); } catch { return []; }
      }
    }
    return [];
  });
  const [showHistory, setShowHistory] = useState(false);
  
  // ISSUE #5: Favorites
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pack-generator-favorites');
      if (saved) {
        try { return new Set(JSON.parse(saved)); } catch { return new Set(); }
      }
    }
    return new Set();
  });
  
  // ISSUE #4: Pack editing
  const [editingPack, setEditingPack] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  
  // ISSUE #6: Individual sample preview
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  
  // Save history to localStorage
  const saveHistory = useCallback((packs: GeneratedPack[]) => {
    const updated = [...packs, ...packHistory].slice(0, 50); // Keep last 50
    setPackHistory(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PACK_HISTORY_KEY, JSON.stringify(updated));
    }
  }, [packHistory]);
  
  // Toggle favorite
  const toggleFavorite = (packId: string) => {
    setFavorites(prev => {
      const updated = new Set(prev);
      if (updated.has(packId)) {
        updated.delete(packId);
      } else {
        updated.add(packId);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('pack-generator-favorites', JSON.stringify([...updated]));
      }
      return updated;
    });
  };
  
  // ISSUE #4: Start/save pack edit
  const startEditPack = (pack: GeneratedPack) => {
    setEditingPack(pack.id);
    setEditTitle(pack.title);
  };
  
  const savePackEdit = (packId: string) => {
    setGeneratedPacks(prev => prev.map(p => 
      p.id === packId ? { ...p, title: editTitle } : p
    ));
    setPackHistory(prev => prev.map(p => 
      p.id === packId ? { ...p, title: editTitle } : p
    ));
    setEditingPack(null);
    toast({ title: 'Pack renamed' });
  };
  
  // ISSUE #3: Batch download all packs
  const downloadAllPacks = async () => {
    const packsWithAudio = generatedPacks.filter(p => 
      p.samples.some(s => s.audioUrl)
    );
    
    if (packsWithAudio.length === 0) {
      toast({ title: 'No audio available', variant: 'destructive' });
      return;
    }
    
    toast({ title: `Downloading ${packsWithAudio.length} packs...` });
    
    for (const pack of packsWithAudio) {
      const sample = pack.samples.find(s => s.audioUrl);
      if (sample?.audioUrl) {
        const link = document.createElement('a');
        link.href = sample.audioUrl;
        link.download = `${pack.title.replace(/[^a-z0-9]/gi, '_')}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(r => setTimeout(r, 500)); // Delay between downloads
      }
    }
  };
  
  // Clear history
  const clearHistory = () => {
    setPackHistory([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PACK_HISTORY_KEY);
    }
    toast({ title: 'History cleared' });
  };
  
  // Load pack from history
  const loadFromHistory = (pack: GeneratedPack) => {
    setGeneratedPacks([pack]);
    setShowHistory(false);
    toast({ title: 'Pack loaded from history' });
  };

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    packSynthesizer.stop();
    setPlayingPack(null);
  };

  useEffect(() => {
    return () => {
      stopPreview();
      packSynthesizer.dispose();
    };
  }, []);

  const generateMutation = useMutation<GeneratedPack[], Error, { prompt: string; count: number; provider: string }>({
    mutationFn: async (body) => {
      const response = await fetch("/api/packs/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        const statusMessage =
          response.status === 401
            ? `Unauthorized: provider "${body.provider}" needs valid API credentials`
            : data.message || "Failed to generate packs";
        throw new Error(statusMessage);
      }

      return data.packs as GeneratedPack[];
    },
    onSuccess: (packs = []) => {
      setGeneratedPacks(packs || []);
      if (!packs?.length) {
        toast({
          title: "No packs returned",
          description: "Try a different prompt or provider.",
        });
        return;
      }
      
      // ISSUE #1: Save to history
      saveHistory(packs);

      toast({
        title: `Generated ${packs.length} pack${packs.length === 1 ? "" : "s"}`,
        description: "Scroll down to preview, download, or save them.",
      });
    },
    onError: (error, vars) => {
      const message = error?.message || "Unknown error";
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: `${vars?.provider ?? "provider"}: ${message}`,
      });
    },
  });

  const saveMutation = useMutation<{ packId: string }, Error, GeneratedPack>({
    mutationFn: async (pack) => {
      const response = await fetch("/api/packs/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ pack }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to save pack");
      }

      return data;
    },
    onSuccess: (_data, pack) => {
      toast({
        title: "Pack saved!",
        description: `"${pack.title}" has been added to your library.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error?.message || "Unable to save pack",
        variant: "destructive",
      });
    },
  });

  const handleRandomPrompt = () => {
    const randomPrompt = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    setPrompt(randomPrompt);
  };

  const handleSendToTracks = (pack: GeneratedPack) => {
    const firstSample = pack.samples.find((s) => s.audioUrl || s.url);
    addTrack({
      name: pack.title || "Generated Pack",
      type: "audio",
      audioUrl: firstSample?.audioUrl || firstSample?.url,
      payload: {
        source: "pack-generator",
        packId: pack.id,
        samples: pack.samples,
        bpm: pack.bpm,
        key: pack.key,
        genre: pack.genre,
      },
      lengthBars: 4,
      startBar: 0,
    });

    toast({
      title: "Sent to timeline",
      description: "Pack registered in the track store for arrangement.",
    });
  };

  const handlePlayPack = async (pack: GeneratedPack) => {
    const sampleWithAudio = pack.samples.find((sample) => sample.audioUrl);

    if (playingPack === pack.id) {
      stopPreview();
      packSynthesizer.stop();
      return;
    }

    stopPreview();
    packSynthesizer.stop();
    setPlayingPack(pack.id);

    const playSynthFallback = async () => {
      try {
        await packSynthesizer.playPack(pack, (previewVolume[0] ?? 75) / 100);
        const checkInterval = setInterval(() => {
          if (!packSynthesizer.getIsPlaying()) {
            clearInterval(checkInterval);
            setPlayingPack(null);
          }
        }, 100);
      } catch (err) {
        console.error("Synth preview failed:", err);
        toast({
          title: "Preview error",
          description: "Unable to synthesize audio preview.",
          variant: "destructive",
        });
        setPlayingPack(null);
      }
    };

    if (sampleWithAudio?.audioUrl) {
      const audio = new Audio(sampleWithAudio.audioUrl);
      audio.volume = (previewVolume[0] ?? 75) / 100;
      audioRef.current = audio;

      audio.onerror = async () => {
        console.warn("Audio file failed to load, falling back to synthesizer");
        audioRef.current = null;
        await playSynthFallback();
      };

      audio.play().catch(async (err) => {
        console.warn("Audio preview failed, trying synthesizer:", err);
        audioRef.current = null;
        await playSynthFallback();
      });

      audio.addEventListener("ended", () => {
        stopPreview();
      });
    } else {
      await playSynthFallback();
    }
  };

  const handleDownloadPack = (pack: GeneratedPack) => {
    const sampleWithAudio = pack.samples.find((sample) => sample.audioUrl);

    if (!sampleWithAudio?.audioUrl) {
      toast({
        title: "Download unavailable",
        description: "This pack does not include audio URLs.",
      });
      return;
    }

    const link = document.createElement("a");
    link.href = sampleWithAudio.audioUrl;
    link.download = `${pack.title}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: `Downloading "${pack.title}"`,
      description: `${pack.samples.length} samples • ${pack.genre} • ${pack.key}`,
    });
  };

  const handleSaveToLibrary = (pack: GeneratedPack) => {
    saveMutation.mutate(pack);
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Describe the style of pack you want to generate.",
      });
      return;
    }

    stopPreview();
    setGeneratedPacks([]);
    generateMutation.mutate({
      prompt: prompt.trim(),
      count: packCount,
      provider: aiProvider,
    });
  };

  // ISSUE #8: Use genre template
  const useGenreTemplate = (genre: string) => {
    const templates = PROMPT_TEMPLATES[genre];
    if (templates && templates.length > 0) {
      const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
      setPrompt(randomTemplate);
      toast({ title: `${genre} template loaded` });
    }
  };

  // ISSUE #2: Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      
      // Ctrl+Enter: Generate
      if ((e.ctrlKey || e.metaKey) && key === 'enter') {
        e.preventDefault();
        handleGenerate();
        return;
      }
      
      // H: Toggle history
      if (key === 'h' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHistory(h => !h);
        return;
      }
      
      // R: Random prompt
      if (key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleRandomPrompt();
        return;
      }
      
      // Escape: Close history
      if (key === 'escape') {
        setShowHistory(false);
        setEditingPack(null);
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prompt]);

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

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleRandomPrompt}
                  className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                >
                  <Dice1 className="h-4 w-4 mr-2" />
                  Random (R)
                </Button>
                
                {/* ISSUE #8: Genre template buttons */}
                {Object.keys(PROMPT_TEMPLATES).map(genre => (
                  <Button
                    key={genre}
                    variant="outline"
                    size="sm"
                    onClick={() => useGenreTemplate(genre)}
                    className="text-xs"
                  >
                    {genre}
                  </Button>
                ))}
                
                {/* ISSUE #1: History button */}
                <Button
                  variant="outline"
                  onClick={() => setShowHistory(!showHistory)}
                  className={showHistory ? 'bg-emerald-100 dark:bg-emerald-900' : ''}
                >
                  <History className="h-4 w-4 mr-2" />
                  History ({packHistory.length})
                </Button>
              </div>
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
                    {PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {PROVIDER_OPTIONS.find((option) => option.value === aiProvider)?.description}
                </p>
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
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateMutation.isPending}
              className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating packs...
                </>
              ) : (
                <>
                  <Music className="mr-2 h-5 w-5" />
                  Generate Sample Packs
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ISSUE #7: Loading skeleton during generation */}
        {generateMutation.isPending && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: packCount }).map((_, i) => (
              <Card key={i} className="border-emerald-200/30 animate-pulse">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                    </div>
                    <div className="h-6 w-16 bg-emerald-200 dark:bg-emerald-900 rounded" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(j => (
                      <div key={j} className="space-y-1">
                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-12" />
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-8" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-20" />
                    <div className="flex gap-1">
                      {[1, 2, 3].map(j => (
                        <div key={j} className="h-5 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <div className="h-9 flex-1 bg-gray-200 dark:bg-gray-800 rounded" />
                    <div className="h-9 flex-1 bg-gray-200 dark:bg-gray-800 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ISSUE #1: History Panel */}
        {showHistory && (
          <Card className="border-amber-200/30 bg-amber-50/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-amber-600">Generation History</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearHistory}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {packHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm">No history yet. Generate some packs!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {packHistory.map(pack => (
                    <div 
                      key={pack.id} 
                      className="p-3 bg-background rounded border cursor-pointer hover:border-amber-400 transition-colors"
                      onClick={() => loadFromHistory(pack)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{pack.title}</span>
                        {favorites.has(pack.id) && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pack.genre} • {pack.bpm} BPM • {pack.key}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Generated Packs */}
        {generatedPacks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Generated Sample Packs</h2>
              {/* ISSUE #3: Batch download */}
              {generatedPacks.some(p => p.samples.some(s => s.audioUrl)) && (
                <Button variant="outline" onClick={downloadAllPacks}>
                  <DownloadCloud className="h-4 w-4 mr-2" />
                  Download All
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedPacks.map((pack) => (
                <Card key={pack.id} className="border-emerald-200/30 hover:border-emerald-300/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* ISSUE #4: Editable title */}
                        {editingPack === pack.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              className="h-8 text-lg font-semibold"
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" onClick={() => savePackEdit(pack.id)}>
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingPack(null)}>
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{pack.title}</CardTitle>
                            <Button size="sm" variant="ghost" onClick={() => startEditPack(pack)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {pack.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* ISSUE #5: Favorite button */}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => toggleFavorite(pack.id)}
                          className={favorites.has(pack.id) ? 'text-yellow-500' : ''}
                        >
                          <Star className={`h-4 w-4 ${favorites.has(pack.id) ? 'fill-yellow-500' : ''}`} />
                        </Button>
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                          {pack.genre}
                        </Badge>
                      </div>
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
                        onClick={() => handleSendToTracks(pack)}
                        size="sm"
                        variant="outline"
                        className="border-purple-500 text-purple-500 hover:bg-purple-50"
                      >
                        <Music className="h-4 w-4 mr-1" />
                        Send to Timeline
                      </Button>

                      <Button
                        onClick={() => handleSaveToLibrary(pack)}
                        size="sm"
                        variant="outline"
                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                        disabled={saveMutation.isPending}
                      >
                        {saveMutation.isPending && saveMutation.variables?.id === pack.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <DatabaseIcon className="h-4 w-4 mr-1" />
                            Add to Library
                          </>
                        )}
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
