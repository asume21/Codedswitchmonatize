import { useContext, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTracks } from "@/hooks/useTracks";
import { useTransport } from "@/contexts/TransportContext";
import { StudioAudioContext } from "@/pages/studio";
import { useStudioSession } from "@/contexts/StudioSessionContext";
import ProBeatMaker from "./ProBeatMaker";
import AIBassGenerator from "./AIBassGenerator";
import LoopLibrary from "./LoopLibrary";
import { Music, Send, SlidersHorizontal, Waves, Rocket, Sparkles, Package, Library } from "lucide-react";
import PackGenerator from "@/components/producer/PackGenerator";

// Tabs: Pro Beat Maker, Bass Studio (AIBassGenerator), Loop Library, and Pack Generator
type BeatLabTab = "pro" | "bass-studio" | "loop-library" | "pack-generator";

interface BeatLabProps {
  initialTab?: BeatLabTab;
}

export default function BeatLab({ initialTab = "pro" }: BeatLabProps) {
  const { addTrack } = useTracks();
  const { tempo } = useTransport();
  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);
  const session = useStudioSession();
  const [latestPattern, setLatestPattern] = useState<any | null>(null);
  const [latestMelody, setLatestMelody] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<BeatLabTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const sendPatternToTracks = (pattern?: any, meta?: { bpm?: number; name?: string }) => {
    const payloadPattern = pattern ?? latestPattern ?? studioContext.currentPattern ?? session.pattern;
    if (!payloadPattern) {
      toast({
        title: "No pattern available",
        description: "Generate or edit a beat first.",
        variant: "destructive",
      });
      return;
    }

    setLatestPattern(payloadPattern);
    session.setPattern(payloadPattern);
    addTrack({
      name: meta?.name ?? "Beat Pattern",
      type: "beat",
      payload: {
        pattern: payloadPattern,
        bpm: meta?.bpm ?? tempo,
        source: "beat-lab",
      },
      lengthBars: 4,
      startBar: 0,
    });

    toast({
      title: "Pattern added",
      description: "Synced with the shared track store for the timeline.",
    });
  };

  const sendMelodyToTracks = (melody?: any[]) => {
    const payloadMelody = melody ?? latestMelody ?? studioContext.currentMelody ?? session.melody;
    if (!payloadMelody || payloadMelody.length === 0) {
      toast({
        title: "No melody captured",
        description: "Generate a melody in CodeBeat or the Piano Roll first.",
        variant: "destructive",
      });
      return;
    }

    setLatestMelody(payloadMelody);
    session.setMelody(payloadMelody);
    addTrack({
      name: "Beat Lab Melody",
      type: "midi",
      kind: "midi",
      notes: payloadMelody,
      payload: {
        source: "beat-lab",
        type: "midi",
        notes: payloadMelody,
      },
      lengthBars: 4,
      startBar: 0,
    });

    toast({
      title: "Melody added",
      description: "Melody is now aligned with the transport timeline.",
    });
  };

  const handleRoute = (destination: "mixer" | "audio-tools" | "uploader") => {
    window.dispatchEvent(
      new CustomEvent("navigateToTab", {
        detail: destination,
      }),
    );
    toast({
      title: "Routing",
      description:
        destination === "mixer"
          ? "Opening Mixer for this beat."
          : destination === "audio-tools"
            ? "Sending track to Audio Tools."
            : "Ready to export or upload your beat.",
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-black/40 backdrop-blur-3xl overflow-y-auto rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      <div className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />
        
        <div className="p-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between relative z-10">
          <div>
            <CardTitle className="text-3xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 flex items-center gap-3 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] uppercase tracking-tight">
              <Music className="w-8 h-8 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
              Beat Lab
            </CardTitle>
            <p className="text-blue-200/60 font-medium tracking-wide mt-2 max-w-xl">
              Orchestrate advanced neural generators, pattern editors, and premium sample packs directly into your production timeline.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="px-3 py-1 bg-blue-500/20 rounded-full border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Tempo: {Math.round(tempo)} BPM</span>
              </div>
              <div className="px-3 py-1 bg-green-500/20 rounded-full border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Engine Sync Ready</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button 
              size="lg" 
              className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.2)] font-black uppercase tracking-tighter" 
              onClick={() => sendPatternToTracks()}
            >
              <Send className="w-5 h-5 mr-2" />
              Send Pattern
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)] font-black uppercase tracking-tighter" 
              onClick={() => sendMelodyToTracks()}
            >
              <Waves className="w-5 h-5 mr-2" />
              Send Melody
            </Button>
            
            <div className="flex gap-2 ml-2 pl-4 border-l border-white/10">
              <Button 
                size="icon" 
                variant="ghost" 
                className="w-12 h-12 bg-white/5 border border-white/10 text-blue-400 hover:bg-blue-500/20 transition-all rounded-xl" 
                onClick={() => handleRoute("mixer")}
                title="Mixer"
              >
                <SlidersHorizontal className="w-5 h-5" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="w-12 h-12 bg-white/5 border border-white/10 text-cyan-400 hover:bg-cyan-500/20 transition-all rounded-xl" 
                onClick={() => handleRoute("audio-tools")}
                title="Audio Tools"
              >
                <Music className="w-5 h-5" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="w-12 h-12 bg-white/5 border border-white/10 text-amber-400 hover:bg-amber-500/20 transition-all rounded-xl" 
                onClick={() => handleRoute("uploader")}
                title="Save / Export"
              >
                <Rocket className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-8 pt-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BeatLabTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 p-1 bg-black/40 border border-white/10 rounded-2xl h-14 backdrop-blur-xl mb-8">
              <TabsTrigger 
                value="pro" 
                className="rounded-xl data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 data-[state=active]:border border-transparent data-[state=active]:border-purple-500/30 transition-all font-black tracking-tight flex items-center gap-2 uppercase text-xs"
              >
                <Sparkles className="w-4 h-4" />
                Pro Beat Maker
              </TabsTrigger>
              <TabsTrigger 
                value="bass-studio" 
                className="rounded-xl data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border border-transparent data-[state=active]:border-blue-500/30 transition-all font-black tracking-tight flex items-center gap-2 uppercase text-xs"
              >
                <Waves className="w-4 h-4" />
                Bass Studio
              </TabsTrigger>
              <TabsTrigger 
                value="loop-library" 
                className="rounded-xl data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border border-transparent data-[state=active]:border-cyan-500/30 transition-all font-black tracking-tight flex items-center gap-2 uppercase text-xs"
              >
                <Library className="w-4 h-4" />
                Loop Library
              </TabsTrigger>
              <TabsTrigger 
                value="pack-generator" 
                className="rounded-xl data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-400 data-[state=active]:border border-transparent data-[state=active]:border-pink-500/30 transition-all font-black tracking-tight flex items-center gap-2 uppercase text-xs"
              >
                <Package className="w-4 h-4" />
                Pack Generator
              </TabsTrigger>
            </TabsList>

            {/* Pro Beat Maker - Full-featured drum machine with all professional features */}
            <TabsContent value="pro" className="mt-4 outline-none">
              <div className="bg-black/20 rounded-2xl border border-white/5 p-1">
                <ProBeatMaker 
                  onPatternChange={(tracks, bpm) => {
                    // Convert tracks to pattern format for timeline
                    const pattern: Record<string, boolean[]> = {};
                    tracks.forEach(t => {
                      pattern[t.id] = t.pattern.map(s => s.active);
                    });
                    setLatestPattern(pattern);
                    session.setPattern(pattern);
                    toast({
                      title: "🎵 Pattern Ready",
                      description: `Beat at ${bpm} BPM captured`,
                    });
                  }}
                />
              </div>
            </TabsContent>

            {/* Bass Studio - AI Bass Generator with 808/Sub/Synth/Electric/Upright styles */}
            <TabsContent value="bass-studio" className="mt-4 outline-none">
              <div className="bg-black/20 rounded-2xl border border-white/5 p-1">
                <AIBassGenerator 
                  chordProgression={(studioContext as any)?.chordProgression}
                  onBassGenerated={(bassNotes) => {
                    // Add bass to tracks
                    if (bassNotes && bassNotes.length > 0) {
                      addTrack({
                        name: "AI Bass Line",
                        type: "midi",
                        kind: "midi",
                        instrument: "Bass Synth",
                        notes: bassNotes.map((n: any, idx: number) => ({
                          id: `bass-${idx}-${Date.now()}`,
                          note: n.note || 'C',
                          octave: n.octave || 2,
                          step: Math.round((n.time || idx * 0.5) * 4),
                          length: Math.round((n.duration || 0.5) * 4),
                          velocity: Math.round((n.velocity || 0.8) * 127),
                        })),
                        payload: {
                          source: "ai-bass-generator",
                          type: "midi",
                        },
                        lengthBars: 4,
                        startBar: 0,
                      });
                      toast({
                        title: "🎸 Bass Added to Tracks",
                        description: `${bassNotes.length} bass notes sent to Multi-Track`,
                      });
                    }
                  }}
                />
              </div>
            </TabsContent>

            {/* Loop Library - Browse and add audio loops as tracks */}
            <TabsContent value="loop-library" className="mt-4 outline-none">
              <div className="bg-black/20 rounded-2xl border border-white/5 p-6">
                <LoopLibrary />
              </div>
            </TabsContent>

            {/* Pack Generator - AI-powered sample pack creation */}
            <TabsContent value="pack-generator" className="mt-4 outline-none">
              <div className="bg-black/20 rounded-2xl border border-white/5 p-6">
                <PackGenerator />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
