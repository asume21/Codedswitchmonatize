import { useState, useContext, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTransport } from "@/contexts/TransportContext";
import { useSongWorkSession } from "@/contexts/SongWorkSessionContext";
import { useSessionDestination } from "@/contexts/SessionDestinationContext";
import { useTracks } from "@/hooks/useTracks";
import { StudioAudioContext } from "@/pages/studio";
import { Music, Waves, Send, Play, Square, Piano } from "lucide-react";
import { useAudio } from "@/hooks/use-audio";
import { BasslineGenerator } from "@/components/producer/BasslineGenerator";

// Bass notes for interactive keyboard
const BASS_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface AiNote {
  time: number;
  duration: number;
  pitch: string;
  velocity: number;
}

function parsePitch(pitch: string): { note: string; octave: number } {
  // Expect formats like C2, D#3, F#1
  const match = pitch.match(/^([A-G][#b]?)(-?\d)$/i);
  if (!match) {
    return { note: "C", octave: 2 };
  }
  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  return { note: note.toUpperCase(), octave: Number.isNaN(octave) ? 2 : octave };
}

export default function BassStudio() {
  const { tempo } = useTransport();
  const { currentSession } = useSongWorkSession();
  const { requestDestination } = useSessionDestination();
  const { addTrack } = useTracks();
  const studioContext = useContext(StudioAudioContext);
  const { toast } = useToast();

  const [key, setKey] = useState<string>((currentSession as any)?.songKey || "C minor");
  const [bars, setBars] = useState<number>(4);
  const [style, setStyle] = useState<string>("hip-hop");
  const [complexity, setComplexity] = useState<number[]>([5]);
  const [mode, setMode] = useState<"ai" | "step">("ai");
  const [generatedNotes, setGeneratedNotes] = useState<AiNote[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [lastGenMethod, setLastGenMethod] = useState<'ai' | 'algorithmic' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bassOctave, setBassOctave] = useState<number>(2);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const playbackTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { playNote, initialize } = useAudio();

  // Cleanup synths on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      playbackTimeoutsRef.current.forEach(clearTimeout);
      playbackTimeoutsRef.current = [];
    };
  }, []);

  const stopPlayback = () => {
    playbackTimeoutsRef.current.forEach(clearTimeout);
    playbackTimeoutsRef.current = [];
    setIsPlaying(false);
  };

  // Play a single bass note from the interactive keyboard
  const playBassNote = async (note: string) => {
    const pitch = `${note}${bassOctave}`;
    setActiveNote(pitch);
    
    try {
      await initialize();
      playNote(note, bassOctave, 0.3, 'bass', 0.8);
    } catch (error) {
      console.error('Bass note playback error:', error);
    }
    
    setTimeout(() => setActiveNote(null), 200);
  };

  const playPreview = async () => {
    if (generatedNotes.length === 0) {
      toast({
        title: "No bassline",
        description: "Generate a bassline first to preview it.",
        variant: "destructive",
      });
      return;
    }

    // If already playing, stop
    if (isPlaying) {
      stopPlayback();
      return;
    }

    setIsPlaying(true);

    await initialize();

    const bpm = tempo || 120;
    generatedNotes.forEach((note) => {
      const { note: noteName, octave } = parsePitch(note.pitch);
      const startMs = (note.time * (60 / bpm)) * 1000;
      const durationSec = note.duration * (60 / bpm);
      const timeout = setTimeout(() => {
        playNote(noteName, octave, durationSec, 'bass', note.velocity ?? 0.8);
      }, Math.max(0, startMs));
      playbackTimeoutsRef.current.push(timeout);
    });

    const lastNote = generatedNotes.reduce(
      (max, n) => (n.time + n.duration > max ? n.time + n.duration : max),
      0,
    );
    const endMs = (lastNote + 0.5) * (60 / bpm) * 1000;
    const endTimeout = setTimeout(() => {
      stopPlayback();
    }, Math.max(0, endMs));
    playbackTimeoutsRef.current.push(endTimeout);
  };

  const generateBassMutation = useMutation({
    mutationFn: async () => {
      const bpm = Math.max(40, Math.min(240, tempo || 120));
      const safeBars = Math.max(1, Math.min(16, bars || 4));

      const payload = {
        songPlanId: (currentSession as any)?.songPlanId || undefined,
        sectionId: (currentSession as any)?.currentSectionId || "bass-section",
        key,
        bpm,
        bars: safeBars,
        chordProgression: (currentSession as any)?.chordProgression || undefined,
      };

      const response = await apiRequest("POST", "/api/ai/music/bass", payload);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = (errorBody as any)?.error || "Failed to generate bassline";
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (data: any) => {
      const track = data?.data || data?.track;
      const rawNotes = track?.notes || [];
      const genMethod = data?.data?.generationMethod || (data?.data?.provider?.includes('Fallback') ? 'algorithmic' : 'ai');
      setLastGenMethod(genMethod);

      if (!Array.isArray(rawNotes) || rawNotes.length === 0) {
        toast({
          title: "Bassline",
          description: "Response received, but no bass notes were returned.",
        });
        return;
      }

      // Map API response fields to expected format (start -> time)
      const notes: AiNote[] = rawNotes.map((n: any) => ({
        time: n.time ?? n.start ?? 0,
        duration: n.duration ?? 0.5,
        pitch: n.pitch ?? "C2",
        velocity: n.velocity ?? 0.8,
      }));

      setGeneratedNotes(notes);

      const pitches = notes
        .map((n) => (typeof n?.pitch === "string" ? n.pitch : null))
        .filter((p): p is string => !!p);
      const uniquePitches = Array.from(new Set(pitches));

      setSummary(
        `${notes.length} notes • ${uniquePitches.slice(0, 6).join(", ")}${
          uniquePitches.length > 6 ? "…" : ""
        }`,
      );

      const sourceLabel = genMethod === 'ai' ? 'AI-Generated' : 'Algorithmic';
      toast({
        title: "Bassline Ready",
        description: `Generated ${notes.length} bass notes in ${key} (${sourceLabel})`,
      });

      // Stash in studio context for other tools if needed
      (studioContext as any).currentBass = notes;
    },
    onError: (error: any) => {
      toast({
        title: "Bassline Generation Failed",
        description: error.message || "Failed to generate AI bassline",
        variant: "destructive",
      });
    },
  });

  const sendToTracks = async () => {
    if (!generatedNotes.length) {
      toast({
        title: "No bassline yet",
        description: "Generate a bassline first.",
        variant: "destructive",
      });
      return;
    }

    const destination = await requestDestination({
      suggestedName: (currentSession as any)?.songName || `Bass - ${key}`,
    });
    if (!destination) {
      return;
    }

    const bpm = Math.max(40, Math.min(240, tempo || 120));
    const safeBars = Math.max(1, Math.min(16, bars || 4));

    // Convert AiNote (time in beats, duration in beats, pitch like C2) to Note structure used by tracks
    const notesForTrack = generatedNotes.map((n, index) => {
      const { note, octave } = parsePitch(n.pitch);
      const step = Math.max(0, Math.round(n.time * 4)); // 4 steps per beat
      const length = Math.max(1, Math.round(n.duration * 4));
      const velocity = Math.max(0, Math.min(127, Math.round((n.velocity ?? 0.8) * 127)));
      return {
        id: `bass-note-${index}-${Date.now()}`,
        note,
        octave,
        step,
        length,
        velocity,
      };
    });

    const trackId = `bass-${Date.now()}`;
    
    addTrack({
      id: trackId,
      name: `Bass - ${key}`,
      kind: "midi",
      type: "midi",
      instrument: "bass",
      notes: notesForTrack as any,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      lengthBars: safeBars,
      startBar: 0,
      payload: {
        source: "bass-studio",
        key,
        bpm,
        style,
        complexity: complexity[0],
        notes: notesForTrack,
        type: "midi",
        instrument: "bass",
      },
    } as any);

    setLastTrackId(trackId);

    window.dispatchEvent(
      new CustomEvent("studio:focusTrack", {
        detail: { trackId, view: "piano-roll" },
      }),
    );

    toast({
      title: "Bassline added to Multi-Track",
      description: "Bass track is now available in the timeline and mixer.",
    });
  };

  const goToPianoRoll = () => {
    if (!lastTrackId) {
      toast({
        title: "No bass track yet",
        description: "Send the bassline to Multi-Track first.",
        variant: "destructive",
      });
      return;
    }

    // Let the studio shell know which track to focus in Piano Roll
    window.dispatchEvent(
      new CustomEvent("studio:focusTrack", {
        detail: { trackId: lastTrackId, view: "piano-roll" },
      }),
    );

    window.dispatchEvent(
      new CustomEvent("navigateToTab", {
        detail: "piano-roll",
      }),
    );
  };

  return (
    <Card className="border border-gray-700 bg-gray-850">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-white text-xl">
              <Waves className="w-5 h-5 text-blue-400" />
              Bass Studio
            </CardTitle>
            <p className="text-sm text-gray-400">
              Design basslines that lock with your drums and chord progressions, then send them straight into the Multi-Track.
            </p>
            {summary && (
              <Badge variant="outline" className="mt-1 text-xs text-blue-200 border-blue-500">
                {summary}
              </Badge>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="secondary">Key: {key}</Badge>
            <Badge variant="outline">Tempo: {Math.round(tempo || 120)} BPM</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)} className="w-full">
          <TabsList className="flex flex-wrap gap-2 bg-gray-800">
            <TabsTrigger value="ai" className="flex items-center gap-1">
              <Waves className="w-4 h-4" />
              AI Bassline
            </TabsTrigger>
            <TabsTrigger value="step" className="flex items-center gap-1">
              <Music className="w-4 h-4" />
              Step Sequencer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-gray-400">Key</label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-sm">
                <SelectValue placeholder="Select key" />
              </SelectTrigger>
              <SelectContent>
                {["C minor", "D minor", "E minor", "F minor", "G minor", "A minor", "B minor", "C major", "D major", "E major", "F major", "G major", "A major", "B major"].map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-gray-400">Bars</label>
            <Input
              type="number"
              min={1}
              max={16}
              value={bars}
              onChange={(e) => setBars(Number(e.target.value) || 4)}
              className="bg-gray-800 border-gray-700 text-sm w-24"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-gray-400">Style</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-sm">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {["hip-hop", "trap", "house", "funk", "rock", "pop", "r&b", "dnb"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-gray-400">Bass Complexity</span>
            <span className="text-xs text-gray-300">{complexity[0]}/10</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">Simple</span>
            <Slider
              value={complexity}
              onValueChange={setComplexity}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-[11px] text-gray-500">Busy</span>
          </div>
        </div>

        {/* Interactive Bass Keyboard */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Piano className="w-4 h-4 text-blue-400" />
              <span className="text-xs uppercase tracking-wide text-gray-400">Play Bass</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Octave:</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((oct) => (
                  <Button
                    key={oct}
                    size="sm"
                    variant={bassOctave === oct ? "default" : "outline"}
                    className="text-xs px-2"
                    onClick={() => setBassOctave(oct)}
                    data-testid={`button-octave-${oct}`}
                  >
                    {oct}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {BASS_NOTES.map((note) => {
              const isSharp = note.includes('#');
              const pitch = `${note}${bassOctave}`;
              const isActive = activeNote === pitch;
              return (
                <Button
                  key={note}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className={`min-w-[40px] text-xs font-mono transition-all ${
                    isSharp 
                      ? 'bg-gray-800 border-gray-600 text-gray-300' 
                      : 'bg-gray-700 border-gray-500 text-white'
                  } ${isActive ? 'scale-95 bg-blue-600 border-blue-500' : ''}`}
                  onClick={() => playBassNote(note)}
                  data-testid={`button-bass-note-${note.replace('#', 'sharp')}`}
                >
                  {note}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">Click notes to play bass sounds. Change octave for different pitch ranges.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => generateBassMutation.mutate()}
            disabled={generateBassMutation.isPending}
            className="bg-blue-600 hover:bg-blue-500"
            data-testid="button-generate-bassline"
          >
            {generateBassMutation.isPending ? (
              <>
                <i className="fas fa-spinner animate-spin mr-2" />
                Generating Bassline...
              </>
            ) : (
              <>
                <Music className="w-4 h-4 mr-2" />
                Generate Bassline
              </>
            )}
          </Button>

          <Button
            onClick={playPreview}
            disabled={!generatedNotes.length}
            variant={isPlaying ? "destructive" : "default"}
            data-testid="button-play-preview-bass"
          >
            {isPlaying ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Play Preview
              </>
            )}
          </Button>

          <Button
            onClick={sendToTracks}
            disabled={!generatedNotes.length}
            variant="secondary"
            data-testid="button-send-to-tracks"
          >
            <Send className="w-4 h-4 mr-2" />
            Send to Multi-Track
          </Button>

          <Button
            onClick={goToPianoRoll}
            disabled={!lastTrackId}
            variant="outline"
            data-testid="button-edit-piano-roll"
          >
            <Waves className="w-4 h-4 mr-2" />
            Edit in Piano Roll
          </Button>
        </div>

        {generatedNotes.length > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-300">Preview:</span> {summary || `${generatedNotes.length} notes generated`}
              {lastGenMethod && (
                <Badge variant={lastGenMethod === 'ai' ? 'default' : 'secondary'} className="text-xs">
                  {lastGenMethod === 'ai' ? 'AI-Generated' : 'Algorithmic'}
                </Badge>
              )}
            </div>
            <div className="mt-1">
              This bassline uses low register notes designed to lock in with your kick. Fine-tune it in the Piano Roll after sending to Multi-Track.
            </div>
          </div>
        )}
          </TabsContent>

          <TabsContent value="step" className="mt-4 space-y-4">
            <BasslineGenerator
              bpm={Math.round(tempo || 120)}
              kickPattern={(studioContext as any)?.currentPattern?.kick ?? undefined}
              onBasslineChange={(bassline) => {
                const bpm = Math.max(40, Math.min(240, tempo || 120));
                const pattern: string[] = Array.isArray(bassline?.pattern) ? bassline.pattern : [];
                const lengths: number[] = Array.isArray(bassline?.lengths) ? bassline.lengths : [];
                const octave = typeof bassline?.octave === 'number' ? bassline.octave : 2;

                const notes: AiNote[] = pattern
                  .map((note, step) => {
                    if (!note) return null;
                    const durationSec = typeof lengths[step] === 'number' ? lengths[step] : 0.5;
                    const durationBeats = durationSec / (60 / bpm);
                    return {
                      time: step / 4,
                      duration: durationBeats,
                      pitch: `${note}${octave}`,
                      velocity: 0.8,
                    };
                  })
                  .filter((n): n is AiNote => !!n);

                setGeneratedNotes(notes);
                setLastGenMethod('algorithmic');
                setSummary(`${notes.length} steps • Step Sequencer`);
              }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
