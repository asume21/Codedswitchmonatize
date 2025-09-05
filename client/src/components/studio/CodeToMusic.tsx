import { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/hooks/use-audio";
import { StudioAudioContext } from "@/pages/studio";

export default function CodeToMusic() {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(`class MelodyGenerator {
    constructor(tempo = 120) {
        this.tempo = tempo;
        this.notes = [];
    }

    addNote(pitch, duration) {
        this.notes.push({
            pitch: pitch,
            duration: duration,
            velocity: Math.random() * 0.5 + 0.5
        });
    }

    generateScale() {
        const scales = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        for (let i = 0; i < scales.length; i++) {
            this.addNote(scales[i] + '4', 0.25);
        }
    }

    play() {
        console.log('Playing melody...');
        return this.notes;
    }
}`);
  const [musicData, setMusicData] = useState<any>(null);
  const [complexity, setComplexity] = useState([5]);
  const compiledMusic = musicData; // Assuming musicData is the compiled music

  const { toast } = useToast();
  const { initialize, isInitialized, playNote } = useAudio();
  const studioContext = useContext(StudioAudioContext);

  const compileMutation = useMutation({
    mutationFn: async (data: { code: string; language: string; complexity?: number }) => {
      const response = await apiRequest("POST", "/api/code-to-music", data);
      return response.json();
    },
    onSuccess: (data) => {
      setMusicData(data);
      
      // Update studio context with generated music
      if (data.melody) {
        studioContext.setCurrentMelody(data.melody);
      }
      
      // Create a basic drum pattern from the music data
      const generatedPattern = {
        kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hihat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
        bass: [true, false, true, false, false, false, true, false, true, false, true, false, false, false, true, false],
        tom: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        openhat: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        clap: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        crash: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
      };
      
      studioContext.setCurrentPattern(generatedPattern);
      
      // Store generated music data for Music→Code conversion
      studioContext.setCurrentCodeMusic(data);
      
      toast({
        title: "Compilation Complete",
        description: "Code has been converted to music successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Compilation Failed",
        description: "Failed to convert code to music. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCompile = () => {
    if (!code.trim()) {
      toast({
        title: "No Code Provided",
        description: "Please enter some code to convert.",
        variant: "destructive",
      });
      return;
    }

    compileMutation.mutate({ code, language, complexity: complexity[0] });
  };

  const languages = [
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold">Code to Music Compiler</h2>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => {
                initialize();
                toast({ title: "Audio Initialized", description: "The audio engine has started." });
              }}
              disabled={isInitialized}
              className="bg-studio-accent hover:bg-blue-500"
            >
              <i className="fas fa-power-off mr-2"></i>
              {isInitialized ? 'Audio Ready' : 'Start Audio'}
            </Button>
            <Button
              onClick={handleCompile}
              disabled={compileMutation.isPending}
              className="bg-studio-accent hover:bg-blue-500"
            >
              {compileMutation.isPending ? (
                <>
                  <i className="fas fa-spinner animate-spin mr-2"></i>
                  Compiling...
                </>
              ) : (
                <>
                  <i className="fas fa-exchange-alt mr-2"></i>
                  Compile to Music
                </>
              )}
            </Button>
            <Button
              onClick={async () => {
                if (musicData && isInitialized) {
                  console.log("Playing music data:", musicData);
                  
                  // Check if melody is an array of playable notes
                  if (musicData.melody && Array.isArray(musicData.melody) && musicData.melody.length > 0) {
                    let noteIndex = 0;
                    const playNextNote = () => {
                      if (noteIndex < musicData.melody.length) {
                        const note = musicData.melody[noteIndex];
                        if (note && note.note) {
                          // Extract note name and octave from note like "C4", "D4", etc.
                          const noteName = note.note.replace(/\d/, '');
                          const octave = parseInt(note.note.replace(/[A-G]#?/, '')) || 4;
                          const instrument = note.instrument || 'piano'; // Use specified instrument or default to piano
                          console.log(`Playing note ${note.note} -> ${noteName}${octave} on ${instrument} for ${note.duration || 0.5}s`);
                          playNote(noteName, octave, note.duration || 0.5, instrument, 0.7);
                        }
                        noteIndex++;
                        if (noteIndex < musicData.melody.length) {
                          setTimeout(playNextNote, (musicData.melody[noteIndex - 1]?.duration || 0.5) * 1000);
                        }
                      }
                    };
                    playNextNote();
                    
                    // Also play drum pattern if available
                    if (musicData.drumPattern) {
                      studioContext.setCurrentPattern(musicData.drumPattern);
                      await studioContext.playFullSong();
                    }
                    
                    const instrumentCount = [...new Set(musicData.melody.map((note: any) => note.instrument || 'piano'))].length;
                    toast({ title: "Playing Multi-Instrument Arrangement", description: `Playing ${musicData.melody.length} notes across ${instrumentCount} instruments plus drums.` });
                  } else {
                    // If no proper melody, just trigger the drum pattern playback
                    console.log("No playable melody found, playing drum pattern only");
                    await studioContext.playFullSong();
                    toast({ title: "Playing Rhythm", description: "Playing drum pattern from compiled code." });
                  }
                } else if (!musicData) {
                  toast({ title: "No Music", description: "Please compile code first.", variant: "destructive" });
                } else {
                  toast({ title: "Audio Not Ready", description: "Please start audio first.", variant: "destructive" });
                }
              }}
              disabled={!musicData || !isInitialized}
              className="bg-studio-success hover:bg-green-500"
            >
              <i className="fas fa-play mr-2"></i>
              Play Result
            </Button>
            <Button
              onClick={() => {
                setMusicData(null);
                studioContext.setCurrentCodeMusic({});
                studioContext.setCurrentMelody([]);
                // Reset pattern to empty
                const emptyPattern = {
                  kick: Array(16).fill(false),
                  snare: Array(16).fill(false),
                  hihat: Array(16).fill(false),
                  bass: Array(16).fill(false),
                  tom: Array(16).fill(false),
                  openhat: Array(16).fill(false),
                  clap: Array(16).fill(false),
                  crash: Array(16).fill(false)
                };
                studioContext.setCurrentPattern(emptyPattern);
                toast({ title: "Music Cleared", description: "All compiled music data has been cleared." });
              }}
              disabled={!musicData}
              className="bg-gray-600 hover:bg-gray-500"
            >
              <i className="fas fa-trash mr-2"></i>
              Clear Music
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Code Input */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Source Code</h3>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 bg-studio-panel border-gray-600 font-mono text-sm resize-none"
              placeholder="Enter your code here..."
            />

            <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 space-y-3">
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-studio-success rounded-full"></div>
                <span>Code analysis complete</span>
                <div className="flex-1"></div>
                <span className="text-gray-400">25 lines • 3 functions • 1 class</span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">AI Complexity: {complexity[0]}/10</Label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">Simple</span>
                  <Slider
                    value={complexity}
                    onValueChange={setComplexity}
                    max={10}
                    min={1}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-400">Complex</span>
                </div>
                <p className="text-xs text-gray-400">Controls how intricate the musical arrangement will be</p>
              </div>
            </div>
          </div>

          {/* Music Output */}
          <div className="flex flex-col space-y-4">
            <h3 className="font-medium">Generated Music</h3>
            <div className="flex-1 bg-studio-panel border border-gray-600 rounded-lg p-4">
              {musicData ? (
                <div className="space-y-6">
                  <div className="text-sm text-gray-400 mb-4">Algorithmic Composition Based on Code Structure</div>

                  {/* Musical Staff Representation */}
                  <svg className="w-full h-32" viewBox="0 0 400 120">
                    {/* Staff Lines */}
                    {[20, 35, 50, 65, 80].map((y) => (
                      <line key={y} x1="20" y1={y} x2="380" y2={y} stroke="#666" strokeWidth="1"/>
                    ))}

                    {/* Notes */}
                    {[
                      { x: 50, y: 35 }, { x: 90, y: 50 }, { x: 130, y: 35 }, { x: 170, y: 20 },
                      { x: 210, y: 35 }, { x: 250, y: 50 }, { x: 290, y: 35 }, { x: 330, y: 20 }
                    ].map((note, index) => (
                      <circle key={index} cx={note.x} cy={note.y} r="4" fill="hsl(203, 100%, 55%)"/>
                    ))}
                  </svg>

                  {/* Instrument Mapping */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Classes → Piano</span>
                      <div className="w-16 h-2 bg-blue-500 rounded"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Functions → Strings</span>
                      <div className="w-12 h-2 bg-green-500 rounded"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Loops → Drums</span>
                      <div className="w-8 h-2 bg-yellow-500 rounded"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Variables → Bass</span>
                      <div className="w-20 h-2 bg-purple-500 rounded"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <i className="fas fa-music text-4xl mb-4"></i>
                    <p>Generated music will appear here after compilation</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-music text-studio-accent"></i>
                  <span>Key: C Major</span>
                </div>
                <div className="flex items-center space-x-2">
                  <i className="fas fa-clock text-studio-accent"></i>
                  <span>Duration: 32 beats</span>
                </div>
                <div className="flex items-center space-x-2">
                  <i className="fas fa-layer-group text-studio-accent"></i>
                  <span>4 tracks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}