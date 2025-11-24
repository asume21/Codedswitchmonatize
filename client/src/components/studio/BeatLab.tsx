import { useContext, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTracks } from "@/hooks/useTracks";
import { useTransport } from "@/contexts/TransportContext";
import { StudioAudioContext } from "@/pages/studio";
import BeatStudio from "@/pages/beat-studio";
import BeatMaker from "./BeatMaker";
import { BeatMaker as ProducerBeatMaker } from "@/components/producer/BeatMaker";
import CodeBeatStudio from "@/pages/codebeat-studio";
import { Music, Send, SlidersHorizontal, Waves, Rocket } from "lucide-react";

export default function BeatLab() {
  const { addTrack } = useTracks();
  const { tempo } = useTransport();
  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);
  const [latestPattern, setLatestPattern] = useState<any | null>(null);
  const [latestMelody, setLatestMelody] = useState<any[]>([]);

  const sendPatternToTracks = (pattern?: any, meta?: { bpm?: number; name?: string }) => {
    const payloadPattern = pattern ?? latestPattern ?? studioContext.currentPattern;
    if (!payloadPattern) {
      toast({
        title: "No pattern available",
        description: "Generate or edit a beat first.",
        variant: "destructive",
      });
      return;
    }

    setLatestPattern(payloadPattern);
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
    const payloadMelody = melody ?? latestMelody ?? studioContext.currentMelody;
    if (!payloadMelody || payloadMelody.length === 0) {
      toast({
        title: "No melody captured",
        description: "Generate a melody in CodeBeat or the Piano Roll first.",
        variant: "destructive",
      });
      return;
    }

    setLatestMelody(payloadMelody);
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
              Orchestrate generators, pattern editors, sample packs, and CodeBeat into the timeline.
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
          <Tabs defaultValue="generator" className="w-full">
            <TabsList className="flex flex-wrap gap-2 bg-gray-800">
              <TabsTrigger value="generator">AI Generator</TabsTrigger>
              <TabsTrigger value="editor">Beat Maker</TabsTrigger>
              <TabsTrigger value="samples">Sample Packs</TabsTrigger>
              <TabsTrigger value="codebeat">CodeBeat</TabsTrigger>
            </TabsList>

            <TabsContent value="generator" className="mt-4">
              <BeatStudio
                onBeatReady={(beat) => {
                  if (beat?.pattern) {
                    setLatestPattern(beat.pattern);
                    toast({
                      title: "Generator ready",
                      description: "Captured pattern from Beat Studio",
                    });
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="editor" className="mt-4 space-y-2">
              <BeatMaker
                onPatternSend={(pattern, meta) => {
                  setLatestPattern(pattern);
                  sendPatternToTracks(pattern, meta);
                }}
                onRoute={(destination) => handleRoute(destination === "export" ? "uploader" : destination)}
              />
            </TabsContent>

            <TabsContent value="samples" className="mt-4">
              <ProducerBeatMaker
                onBeatGenerated={(beat) => {
                  if (beat?.pattern) {
                    setLatestPattern(beat.pattern);
                    toast({
                      title: "Sample pack pattern captured",
                      description: "Tap Send Pattern to sync it to the timeline.",
                    });
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="codebeat" className="mt-4">
              <CodeBeatStudio />
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500" onClick={() => sendMelodyToTracks()}>
                  <Music className="w-4 h-4 mr-2" />
                  Send CodeBeat Melody
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
