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
  const { initialize, isInitialized, playNote, playDrumSound } = useAudio();
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
    console.log("🎵 Starting composition...");
    try {
      if (!isInitialized) {
        console.log("🎵 Initializing audio...");
        await initialize();
      }

      // Play a simple chord progression
      const chords = [
        [{ note: "C", octave: 4 }, { note: "E", octave: 4 }, { note: "G", octave: 4 }],
        [{ note: "F", octave: 4 }, { note: "A", octave: 4 }, { note: "C", octave: 5 }],
        [{ note: "G", octave: 4 }, { note: "B", octave: 4 }, { note: "D", octave: 5 }],
        [{ note: "C", octave: 4 }, { note: "E", octave: 4 }, { note: "G", octave: 4 }],
      ];

      console.log("🎵 Playing chord progression...");
      chords.forEach((chord, chordIndex) => {
        setTimeout(() => {
          console.log(`🎵 Playing chord ${chordIndex + 1}:`, chord);
          chord.forEach((note) => {
            playNote(note.note, note.octave, 1.0);
          });
        }, chordIndex * 1000);
      });

      toast({
        title: "Melody Composer",
        description: "Playing chord progression demo",
      });
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
    console.log("🎵 Creating beats...");
    try {
      if (!isInitialized) {
        console.log("🎵 Initializing audio for beats...");
        await initialize();
      }

      // Play different drum sounds in sequence
      const drumSequence = ["kick", "snare", "hihat", "kick", "snare", "hihat", "kick", "snare"];

      console.log("🎵 Playing drum sequence...");
      drumSequence.forEach((drum, index) => {
        setTimeout(() => {
          console.log(`🎵 Playing drum: ${drum} at index ${index}`);
          playDrumSound(drum, 0.8);
        }, index * 200);
      });

      toast({
        title: "Beat Maker",
        description: "Playing drum sequence demo",
      });
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
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="h-6 w-6" />
              Unified Music Studio
            </div>
            <Button 
              onClick={handlePlayDemo}
              className={`flex items-center gap-2 ${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
            >
              {isPlaying ? (
                <>
                  <Square className="h-4 w-4" />
                  Stop Demo
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Play Demo
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="compose" className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                Compose
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Code
              </TabsTrigger>
              <TabsTrigger value="record" className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Record
              </TabsTrigger>
              <TabsTrigger value="mix" className="flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Mix
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="mt-6 h-full">
              <div className="grid grid-cols-2 gap-6 h-full">
                <Card>
                  <CardHeader>
                    <CardTitle>Melody Composer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button onClick={handleStartComposing} className="w-full">
                        <Music className="h-4 w-4 mr-2" />
                        Start Composing
                      </Button>
                      <p className="text-sm text-gray-600">
                        Create melodies with AI assistance
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Beat Maker</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button onClick={handleCreateBeats} className="w-full">
                        <Headphones className="h-4 w-4 mr-2" />
                        Create Beats
                      </Button>
                      <p className="text-sm text-gray-600">
                        Generate rhythmic patterns
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="code" className="mt-6 h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Code to Music</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button onClick={() => {
                      console.log("🎵 Converting code to music...");
                      // Play algorithmic music based on code patterns
                      const codePattern = [
                        { note: "C", octave: 3, duration: 0.25 },
                        { note: "D", octave: 3, duration: 0.25 },
                        { note: "E", octave: 3, duration: 0.25 },
                        { note: "F", octave: 3, duration: 0.25 },
                      ];

                      console.log("🎵 Playing code pattern...");
                      codePattern.forEach((note, index) => {
                        setTimeout(() => {
                          console.log(`🎵 Playing code note: ${note.note}${note.octave}`);
                          playNote(note.note, note.octave, note.duration);
                        }, index * 300);
                      });

                      toast({
                        title: "Code to Music",
                        description: "Playing algorithmic music pattern",
                      });
                    }} className="w-full">
                      <Code className="h-4 w-4 mr-2" />
                      Convert Code
                    </Button>
                    <p className="text-sm text-gray-600">
                      Transform your code into musical compositions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="record" className="mt-6 h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Recording Studio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
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
                    }} className="w-full">
                      <Mic className="h-4 w-4 mr-2" />
                      Start Recording
                    </Button>
                    <p className="text-sm text-gray-600">
                      Record audio with professional quality
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mix" className="mt-6 h-full">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Headphones className="h-6 w-6" />
                    Audio Mixer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
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
                      setTimeout(() => playDrumSound("kick", 0.8), 500);
                      setTimeout(() => playDrumSound("hihat", 0.6), 750);
                      setTimeout(() => playDrumSound("snare", 0.7), 1000);

                      toast({
                        title: "Audio Mixer",
                        description: "Playing layered mix demo",
                      });
                    }} className="w-full">
                      <Headphones className="h-4 w-4 mr-2" />
                      Open Mixer
                    </Button>
                    <p className="text-sm text-gray-600">
                      Mix and master your audio tracks
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
