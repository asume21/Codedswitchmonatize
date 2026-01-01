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
  Star, History, Edit2, Check, X, Volume2, DownloadCloud, Trash2, Send,
  Square, Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTracks } from "@/hooks/useTracks";
import { packSynthesizer } from "@/lib/packAudioSynthesizer";
import { professionalAudio } from "@/lib/professionalAudio";

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
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pack-generator-favorites');
      if (saved) {
        try { return new Set(JSON.parse(saved)); } catch { return new Set(); }
      }
    }
    return new Set();
  });
  
  const [editingPack, setEditingPack] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  
  const saveHistory = useCallback((packs: GeneratedPack[]) => {
    const updated = [...packs, ...packHistory].slice(0, 50);
    setPackHistory(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PACK_HISTORY_KEY, JSON.stringify(updated));
    }
  }, [packHistory]);
  
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
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };
  
  const clearHistory = () => {
    setPackHistory([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PACK_HISTORY_KEY);
    }
    toast({ title: 'History cleared' });
  };
  
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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to generate packs");
      }

      return data.packs as GeneratedPack[];
    },
    onSuccess: (packs = []) => {
      setGeneratedPacks(packs || []);
      if (!packs?.length) {
        toast({ title: "No packs returned", description: "Try a different prompt." });
        return;
      }
      saveHistory(packs);
      toast({ title: `Generated ${packs.length} packs` });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Generation failed", description: error.message });
    },
  });

  const saveMutation = useMutation<{ packId: string }, Error, GeneratedPack>({
    mutationFn: async (pack) => {
      const response = await fetch("/api/packs/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pack }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save pack");
      return data;
    },
    onSuccess: (_data, pack) => {
      toast({ title: "Pack saved!", description: `"${pack.title}" added to library.` });
    },
  });

  const handleRandomPrompt = () => {
    setPrompt(RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)]);
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
    toast({ title: "Sent to timeline" });
  };

  const handlePlayPack = async (pack: GeneratedPack) => {
    if (playingPack === pack.id) {
      stopPreview();
      return;
    }

    stopPreview();
    setPlayingPack(pack.id);

    const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === 'instruments' || ch.name.toLowerCase() === 'instruments');
    packSynthesizer.setTargetNode(mixerChannel?.input || null);

    const sampleWithAudio = pack.samples.find((sample) => sample.audioUrl);
    if (sampleWithAudio?.audioUrl) {
      const audio = new Audio(sampleWithAudio.audioUrl);
      audio.volume = (previewVolume[0] ?? 75) / 100;
      audioRef.current = audio;
      audio.onended = () => stopPreview();
      audio.play().catch(() => packSynthesizer.playPack(pack, (previewVolume[0] ?? 75) / 100));
    } else {
      await packSynthesizer.playPack(pack, (previewVolume[0] ?? 75) / 100);
    }
  };

  const handleDownloadPack = (pack: GeneratedPack) => {
    const sample = pack.samples.find((s) => s.audioUrl);
    if (!sample?.audioUrl) return;
    const link = document.createElement("a");
    link.href = sample.audioUrl;
    link.download = `${pack.title}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToLibrary = (pack: GeneratedPack) => {
    saveMutation.mutate(pack);
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    stopPreview();
    setGeneratedPacks([]);
    generateMutation.mutate({ prompt: prompt.trim(), count: packCount, provider: aiProvider });
  };

  const useGenreTemplate = (genre: string) => {
    const templates = PROMPT_TEMPLATES[genre];
    if (templates) setPrompt(templates[Math.floor(Math.random() * templates.length)]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
      <div className="flex-none border-b border-white/10 bg-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 pointer-events-none" />
        <div className="p-8 relative z-10">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-white/20">
                  <Package className="text-white h-8 w-8 drop-shadow-[0_0_10px_white]" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-black font-heading text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400 uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                      Pack Generator
                    </h1>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-black tracking-[0.2em] uppercase px-3 py-0.5">
                      Neural v2
                    </Badge>
                  </div>
                  <p className="text-emerald-200/60 font-medium tracking-wide mt-2 max-w-xl">
                    Synthesize complete production suites from pure descriptive data. Neural engines ready for high-fidelity signal rendering.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/30 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">AI Engine Online</span>
                </div>
                <div className="px-4 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/30">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Hi-Fi Previews</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border-2 border-emerald-500/20">
                <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em]">Neural Prompt Interface</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <Textarea
                    placeholder="Describe your sonic vision..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={5}
                    className="resize-none text-lg border-white/5 focus:border-emerald-500/50 bg-black/40 rounded-2xl p-6 font-medium text-white placeholder:text-white/10 custom-scrollbar"
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" onClick={handleRandomPrompt} className="bg-white/5 border-white/10 text-white/60 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-xl font-black uppercase text-[10px] tracking-widest px-4">
                      <Dice1 className="h-4 w-4 mr-2" /> Random
                    </Button>
                    {Object.keys(PROMPT_TEMPLATES).map(genre => (
                      <Button key={genre} variant="outline" size="sm" onClick={() => useGenreTemplate(genre)} className="bg-white/5 border-white/10 text-white/40 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-tighter">
                        {genre}
                      </Button>
                    ))}
                    <div className="ml-auto">
                      <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className={`rounded-xl font-black uppercase text-[10px] tracking-widest px-4 transition-all ${showHistory ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'}`}>
                        <History className="h-4 w-4 mr-2" /> Archive ({packHistory.length})
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl h-full flex flex-col shadow-xl">
                <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="text-xs font-black text-blue-400 uppercase tracking-[0.3em]">Synthesis Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 pt-8 flex-1">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Parallel Units</label>
                      <span className="text-xs font-black text-emerald-400">{packCount}</span>
                    </div>
                    <Select value={packCount.toString()} onValueChange={(v) => setPackCount(parseInt(v))}>
                      <SelectTrigger className="bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold h-10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
                        <SelectItem value="1">1 Suite</SelectItem>
                        <SelectItem value="2">2 Suites</SelectItem>
                        <SelectItem value="4">4 Suites</SelectItem>
                        <SelectItem value="6">6 Suites</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Neural Provider</label>
                    <Select value={aiProvider} onValueChange={setAiProvider}>
                      <SelectTrigger className="bg-white/5 border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold h-10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900/95 border-white/10 backdrop-blur-2xl rounded-xl">
                        {PROVIDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="focus:bg-blue-500/20 py-2">
                            <div className="flex flex-col">
                              <span className="font-bold">{option.label}</span>
                              <span className="text-[9px] text-white/30 uppercase tracking-tighter mt-0.5">{option.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Audition Gain</label>
                      <span className="text-xs font-black text-blue-400">{previewVolume[0]}%</span>
                    </div>
                    <Slider value={previewVolume} onValueChange={setPreviewVolume} max={100} min={0} step={1} className="py-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generateMutation.isPending}
            className="w-full h-20 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:via-teal-500 hover:to-blue-500 text-white font-black uppercase tracking-[0.2em] rounded-3xl shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] border-2 border-white/20 text-xl"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="mr-4 h-8 w-8 animate-spin" /> Initializing...</>
            ) : (
              <><Sparkles className="mr-4 h-8 w-8 drop-shadow-[0_0_10px_white]" /> Synthesize Neural Suites</>
            )}
          </Button>

          {showHistory && (
            <Card className="bg-amber-500/5 border-amber-500/20 backdrop-blur-2xl rounded-3xl shadow-2xl animate-in slide-in-from-top-4 duration-500 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-amber-500/10 p-6">
                <div className="flex items-center gap-3">
                  <History className="text-amber-400 h-5 w-5" />
                  <CardTitle className="text-xs font-black text-amber-400 uppercase tracking-[0.3em]">Signal Archive</CardTitle>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" size="sm" onClick={clearHistory} className="h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">Wipe Data</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="h-8 w-8 p-0 text-white/40 hover:text-white bg-white/5 rounded-lg border border-white/10"><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {packHistory.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl text-[10px] font-black text-white/20 uppercase">Buffers Empty</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                    {packHistory.map(pack => (
                      <div key={pack.id} className="p-4 bg-black/40 rounded-2xl border border-white/5 cursor-pointer hover:border-amber-500/40 hover:bg-white/5 transition-all group shadow-sm" onClick={() => loadFromHistory(pack)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-xs text-white/90 truncate uppercase">{pack.title}</span>
                          {favorites.has(pack.id) && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <div className="text-[9px] font-black text-white/30 uppercase">{pack.genre} • {pack.bpm} BPM</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {generatedPacks.length > 0 && (
            <div className="space-y-8 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-white/40 uppercase tracking-[0.4em]">Active Signal Groups</h2>
                <Button variant="outline" onClick={downloadAllPacks} className="h-9 rounded-xl bg-blue-500/10 border-blue-500/30 text-blue-400 font-black uppercase text-[10px] tracking-widest px-5 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  <DownloadCloud className="h-4 w-4 mr-2" /> Sync All Suites
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {generatedPacks.map((pack) => (
                  <Card key={pack.id} className="bg-white/5 border-white/10 backdrop-blur-xl rounded-3xl border-2 border-emerald-500/10 hover:border-emerald-500/30 transition-all shadow-2xl group/pack overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 z-20">
                      <Button size="sm" variant="ghost" onClick={() => toggleFavorite(pack.id)} className={`h-9 w-9 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md transition-all ${favorites.has(pack.id) ? 'text-yellow-500 scale-110' : 'text-white/40'}`}>
                        <Star className={`h-4 w-4 ${favorites.has(pack.id) ? 'fill-yellow-500' : ''}`} />
                      </Button>
                    </div>
                    <CardHeader className="border-b border-white/5 relative z-10 bg-black/20 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {editingPack === pack.id ? (
                            <div className="flex items-center gap-2">
                              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-9 bg-black/60 border-emerald-500/50 rounded-xl text-lg font-black text-white uppercase" autoFocus />
                              <Button size="sm" variant="ghost" onClick={() => savePackEdit(pack.id)} className="h-9 w-9 p-0 text-emerald-400 hover:bg-emerald-400/10 rounded-xl"><Check className="h-5 w-5" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingPack(null)} className="h-9 w-9 p-0 text-red-400 hover:bg-red-400/10 rounded-xl"><X className="h-5 w-5" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <CardTitle className="text-xl font-black text-white uppercase">{pack.title}</CardTitle>
                              <Button size="sm" variant="ghost" onClick={() => startEditPack(pack)} className="h-7 w-7 p-0 text-white/20 hover:text-white bg-white/5 rounded-lg opacity-0 group-hover/pack:opacity-100"><Edit2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          )}
                          <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mt-2">{pack.description}</p>
                        </div>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase px-3 rounded-full mt-1 shrink-0">{pack.genre}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 relative z-10">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-black/20 rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Tempo</span>
                          <p className="text-lg font-black text-blue-400 leading-none">{pack.bpm}</p>
                        </div>
                        <div className="bg-black/20 rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Harmonic</span>
                          <p className="text-lg font-black text-purple-400 leading-none">{pack.key}</p>
                        </div>
                        <div className="bg-black/20 rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Density</span>
                          <p className="text-lg font-black text-pink-400 leading-none">{pack.samples.length}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Instrument Matrix</label>
                        <div className="flex flex-wrap gap-1.5">
                          {pack.metadata.instruments.map((inst, i) => (
                            <span key={i} className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-white/60 uppercase tracking-tighter">{inst}</span>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button onClick={() => handlePlayPack(pack)} variant="outline" className={`h-12 rounded-2xl font-black uppercase text-xs tracking-widest transition-all border-2 ${playingPack === pack.id ? 'bg-red-500/10 border-red-500/50 text-red-400 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-white/5 border-white/10 text-white hover:bg-emerald-500/20 hover:text-emerald-400'}`}>
                          {playingPack === pack.id ? <Square className="w-4 h-4 mr-3 fill-current" /> : <Play className="w-4 h-4 mr-3 fill-current" />} {playingPack === pack.id ? 'Stop' : 'Audition'}
                        </Button>
                        <Button onClick={() => handleDownloadPack(pack)} variant="outline" className="h-12 rounded-2xl bg-blue-500/10 border-2 border-blue-500/30 text-blue-400 font-black uppercase text-xs tracking-widest transition-all shadow-sm">
                          <Download className="w-4 h-4 mr-3" /> Extract
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button onClick={() => handleSendToTracks(pack)} className="h-12 bg-green-600 hover:bg-green-500 text-white rounded-2xl shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all font-black uppercase text-xs border border-white/20">
                          <Send className="w-4 h-4 mr-3" /> Deploy
                        </Button>
                        <Button onClick={() => handleSaveToLibrary(pack)} variant="ghost" className="h-12 bg-white/5 border border-white/10 rounded-2xl text-white/60 hover:text-white font-black uppercase text-xs tracking-widest">
                          <Save className="w-4 h-4 mr-3" /> Save
                        </Button>
                      </div>
                    </CardContent>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 opacity-20" />
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="pt-12 pb-8 border-t border-white/5 text-center space-y-4">
            <div className="flex justify-center gap-8 opacity-20 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-700">
              <DatabaseIcon className="h-8 w-8 text-blue-400" />
              <Headphones className="h-8 w-8 text-purple-400" />
              <Music className="h-8 w-8 text-pink-400" />
            </div>
            <p className="text-[10px] text-white/10 font-black uppercase tracking-[0.5em]">Sonic Intelligence Layer // Ready for Arrangement</p>
          </div>
        </div>
      </div>
    </div>
  );
}
