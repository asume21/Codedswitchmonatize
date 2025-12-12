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
import BassStudio from "./BassStudio";
import LoopLibrary from "./LoopLibrary";
import { Music, Send, SlidersHorizontal, Waves, Rocket, Sparkles, Package, Library } from "lucide-react";
import PackGenerator from "@/components/producer/PackGenerator";

// Tabs: Pro Beat Maker, Bass Studio, Loop Library, and Pack Generator
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
      notes: payloadMelody,
      payload: {
        source: "beat-lab",
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
    <div className="flex flex-col gap-4 p-4 bg-gray-900 h-full overflow-y-auto">
      <Card className="border border-gray-700 bg-gray-850">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-blue-400" />
              Beat Lab
            </CardTitle>
            <p className="text-sm text-gray-400">
              Orchestrate generators, pattern editors, and sample packs into the timeline.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">Tempo: {Math.round(tempo)} BPM</Badge>
              <Badge variant="secondary">Tracks ready to sync</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-500" onClick={() => sendPatternToTracks()}>
              <Send className="w-4 h-4 mr-2" />
              Send Pattern
            </Button>
            <Button size="sm" variant="secondary" onClick={() => sendMelodyToTracks()}>
              <Waves className="w-4 h-4 mr-2" />
              Send Melody
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleRoute("mixer")}>
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Mixer
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleRoute("audio-tools")}>
              <Music className="w-4 h-4 mr-2" />
              Audio Tools
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleRoute("uploader")}>
              <Rocket className="w-4 h-4 mr-2" />
              Save / Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BeatLabTab)} className="w-full">
            <TabsList className="flex flex-wrap gap-2 bg-gray-800">
              <TabsTrigger value="pro" className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-blue-600">
                <Sparkles className="w-4 h-4" />
                Pro Beat Maker
              </TabsTrigger>
              <TabsTrigger value="bass-studio" className="flex items-center gap-1">
                <Waves className="w-4 h-4" />
                Bass Studio
              </TabsTrigger>
              <TabsTrigger value="loop-library" className="flex items-center gap-1">
                <Library className="w-4 h-4" />
                Loop Library
              </TabsTrigger>
              <TabsTrigger value="pack-generator" className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                Pack Generator
              </TabsTrigger>
            </TabsList>

            {/* Pro Beat Maker - Full-featured drum machine with all professional features */}
            <TabsContent value="pro" className="mt-4">
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
            </TabsContent>

            {/* Bass Studio - Dedicated AI bassline generator wired to Multi-Track */}
            <TabsContent value="bass-studio" className="mt-4">
              <BassStudio />
            </TabsContent>

            {/* Loop Library - Browse and add audio loops as tracks */}
            <TabsContent value="loop-library" className="mt-4">
              <LoopLibrary />
            </TabsContent>

            {/* Pack Generator - AI-powered sample pack creation */}
            <TabsContent value="pack-generator" className="mt-4">
              <PackGenerator />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
