import { useState, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, Code, Mic, Headphones, Play, Square } from "lucide-react";
import { useAudio, useSequencer } from "@/hooks/use-audio";
import { StudioAudioContext } from "@/pages/studio";
import { useToast } from "@/hooks/use-toast";

export default function UnifiedMusicStudio() {
  const [activeTab, setActiveTab] = useState("compose");
  const [isPlaying, setIsPlaying] = useState(false);
    const { initialize, isInitialized, playNote, playDrum } = useAudio();
  const { playPattern, stopPattern } = useSequencer();
  const studioContext = useContext(StudioAudioContext);
  const { toast } = useToast();

  // Demo melody pattern
  const demoMelody = [
    { note: "C", octave: 4, duration: 0.5, start: 0 },
    { note: "E", octave: 4, duration: 0.5, start: 0.5 },
    { note: "G", octave: 4, duration: 0.5, start: 1.0 },
    { note: "C", octave: 5, duration: 1.0, start: 1.5 },
  ];

  // Demo beat pattern
  const demoBeatPattern = {
    kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    hihat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
  };

  const handlePlayDemo = async () => {
    try {
      if (!isInitialized) {
        await initialize();
      }

      if (isPlaying) {
        stopPattern();
        setIsPlaying(false);
        toast({
          title: "Playback Stopped",
          description: "Demo audio stopped",
        });
      } else {
        // Play demo beat pattern
        playPattern(demoBeatPattern, 120);
        
        // Play demo melody notes
        demoMelody.forEach((note, index) => {
          setTimeout(() => {
            playNote(note.note, note.octave, note.duration);
          }, note.start * 1000);
        });

        setIsPlaying(true);
        toast({
          title: "Playing Demo",
          description: "Unified music studio demo playing",
        });

        // Auto-stop after 4 seconds
        setTimeout(() => {
          stopPattern();
          setIsPlaying(false);
        }, 4000);
      }
    } catch (error) {
      console.error("Demo playback error:", error);
      toast({
        title: "Playback Error",
        description: "Failed to play demo audio",
        variant: "destructive",
      });
    }
  };

  const handleStartComposing = async () => {
    try {
      if (!isInitialized) {
        await initialize();
      }
      
      // Play a simple chord progression
      const chords = [
        [{ note: "C", octave: 4 }, { note: "E", octave: 4 }, { note: "G", octave: 4 }],
        [{ note: "F", octave: 4 }, { note: "A", octave: 4 }, { note: "C", octave: 5 }],
        [{ note: "G", octave: 4 }, { note: "B", octave: 4 }, { note: "D", octave: 5 }],
        [{ note: "C", octave: 4 }, { note: "E", octave: 4 }, { note: "G", octave: 4 }],
      ];

      chords.forEach((chord, chordIndex) => {
        setTimeout(() => {
          chord.forEach((note) => {
            playNote(note.note, note.octave, 1.0);
          });
        }, chordIndex * 1000);
      });

      toast({
        title: "Melody Composer",
        description: "Playing chord progression demo",
      });

      // Navigate to Melody Composer tool in Studio
      if (window.dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent("navigateToTab", { detail: "melody" }),
        );
      }
    } catch (error) {
      console.error("Compose error:", error);
      toast({
        title: "Compose Error",
        description: "Failed to start composing",
        variant: "destructive",
      });
    }
  };

  const handleCreateBeats = async () => {
    try {
      if (!isInitialized) {
        await initialize();
      }

      // Play different drum sounds in sequence
      const drumSequence = ["kick", "snare", "hihat", "kick", "snare", "hihat", "kick", "snare"];
      
      drumSequence.forEach((drum, index) => {
        setTimeout(() => {
                    playDrum(drum as any, 0.8);
        }, index * 200);
      });

      toast({
        title: "Beat Maker",
        description: "Playing drum sequence demo",
      });

      // Navigate to Beat Maker tool in Studio
      if (window.dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent("navigateToTab", { detail: "beatmaker" }),
        );
      }
    } catch (error) {
      console.error("Beat creation error:", error);
      toast({
        title: "Beat Error",
        description: "Failed to create beats",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full p-4 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <Card className="flex-1 shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between text-xl font-bold">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Music className="h-6 w-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Unified Music Studio
              </span>
            </div>
            <Button 
              onClick={handlePlayDemo}
              size="lg"
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                isPlaying 
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                  : 'bg-green-600 hover:bg-green-700 shadow-green-200'
              } shadow-lg hover:shadow-xl transform hover:scale-105`}
            >
              {isPlaying ? (
                <>
                  <Square className="h-5 w-5" />
                  Stop Demo
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Play Demo
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-4 mb-6 bg-white shadow-md rounded-xl p-1">
              <TabsTrigger 
                value="compose" 
                className="flex items-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-200"
              >
                <Music className="h-4 w-4" />
                Compose
              </TabsTrigger>
              <TabsTrigger 
                value="code" 
                className="flex items-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-200"
              >
                <Code className="h-4 w-4" />
                Code
              </TabsTrigger>
              <TabsTrigger 
                value="record" 
                className="flex items-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-200"
              >
                <Mic className="h-4 w-4" />
                Record
              </TabsTrigger>
              <TabsTrigger 
                value="mix" 
                className="flex items-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-200"
              >
                <Headphones className="h-4 w-4" />
                Mix
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow duration-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                      <Music className="h-5 w-5" />
                      Melody Composer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button 
                      onClick={handleStartComposing} 
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                    >
                      <Music className="h-4 w-4 mr-2" />
                      Start Composing
                    </Button>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Create melodies with AI assistance
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow duration-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                      <Headphones className="h-5 w-5" />
                      Beat Maker
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button 
                      onClick={handleCreateBeats} 
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                    >
                      <Headphones className="h-4 w-4 mr-2" />
                      Create Beats
                    </Button>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Generate rhythmic patterns
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="code" className="flex-1">
              <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow duration-200 h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                    <Code className="h-5 w-5" />
                    Code to Music
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={() => {
                    // Play algorithmic music based on code patterns
                    const codePattern = [
                      { note: "C", octave: 3, duration: 0.25 },
                      { note: "D", octave: 3, duration: 0.25 },
                      { note: "E", octave: 3, duration: 0.25 },
                      { note: "F", octave: 3, duration: 0.25 },
                    ];
                    
                    codePattern.forEach((note, index) => {
                      setTimeout(() => {
                        playNote(note.note, note.octave, note.duration);
                      }, index * 300);
                    });

                    toast({
                      title: "Code to Music",
                      description: "Playing algorithmic music pattern",
                    });

                    // Navigate to Code to Music tool in Studio
                    if (window.dispatchEvent) {
                      window.dispatchEvent(
                        new CustomEvent("navigateToTab", { detail: "codebeat" }),
                      );
                    }
                  }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105">
                    <Code className="h-4 w-4 mr-2" />
                    Convert Code
                  </Button>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Transform your code into musical compositions
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="record" className="flex-1">
              <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow duration-200 h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                    <Mic className="h-5 w-5" />
                    Recording Studio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={() => {
                    // Simulate recording with a simple melody
                    const recordingMelody = [
                      { note: "A", octave: 4, duration: 0.5 },
                      { note: "B", octave: 4, duration: 0.5 },
                      { note: "C", octave: 5, duration: 0.5 },
                      { note: "D", octave: 5, duration: 1.0 },
                    ];
                    
                    recordingMelody.forEach((note, index) => {
                      setTimeout(() => {
                        playNote(note.note, note.octave, note.duration);
                      }, index * 600);
                    });

                    toast({
                      title: "Recording Studio",
                      description: "Playing recorded melody demo",
                    });

                    // Navigate to Song Uploader & AI Assistant (recording area)
                    if (window.dispatchEvent) {
                      window.dispatchEvent(
                        new CustomEvent("navigateToTab", { detail: "assistant" }),
                      );
                    }
                  }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105">
                    <Mic className="h-4 w-4 mr-2" />
                    Start Recording
                  </Button>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Record audio with professional quality
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mix" className="flex-1">
              <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow duration-200 h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
                    <Headphones className="h-5 w-5" />
                    Audio Mixer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={() => {
                    // Play layered sounds to demonstrate mixing
                    const mixLayers = [
                      { note: "C", octave: 2, duration: 2.0 }, // Bass
                      { note: "E", octave: 4, duration: 1.5 }, // Mid
                      { note: "G", octave: 5, duration: 1.0 }, // High
                    ];
                    
                    mixLayers.forEach((layer, index) => {
                      setTimeout(() => {
                        playNote(layer.note, layer.octave, layer.duration);
                      }, index * 100);
                    });

                    // Add some drum sounds
                    setTimeout(() => playDrum("kick", 0.8), 500);
                    setTimeout(() => playDrum("hihat", 0.6), 750);
                    setTimeout(() => playDrum("snare", 0.7), 1000);

                    toast({
                      title: "Audio Mixer",
                      description: "Playing layered mix demo",
                    });

                    // Navigate to Mix Studio tool in Studio
                    if (window.dispatchEvent) {
                      window.dispatchEvent(
                        new CustomEvent("navigateToTab", { detail: "mix-studio" }),
                      );
                    }
                  }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105">
                    <Headphones className="h-4 w-4 mr-2" />
                    Open Mixer
                  </Button>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Mix and master your audio tracks
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
