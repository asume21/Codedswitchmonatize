import { useState, useContext, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTransport } from "@/contexts/TransportContext";
import { useSongWorkSession } from "@/contexts/SongWorkSessionContext";
import { useSessionDestination } from "@/contexts/SessionDestinationContext";
import { useTracks } from "@/hooks/useTracks";
import { StudioAudioContext } from "@/pages/studio";
import { Music, Waves, Send, Play, Square, Piano } from "lucide-react";
import * as Tone from "tone";

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
  const [generatedNotes, setGeneratedNotes] = useState<AiNote[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bassOctave, setBassOctave] = useState<number>(2);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const synthRef = useRef<Tone.MonoSynth | null>(null);
  const keyboardSynthRef = useRef<Tone.MonoSynth | null>(null);
  const scheduledEventsRef = useRef<number[]>([]);

  // Cleanup synths on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      if (keyboardSynthRef.current) {
        keyboardSynthRef.current.dispose();
        keyboardSynthRef.current = null;
      }
      scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
      scheduledEventsRef.current = [];
    };
  }, []);

  // Convert pitch string like "C2" to frequency
  const pitchToFrequency = (pitch: string): number => {
    const match = pitch.match(/^([A-G][#b]?)(-?\d)$/i);
    if (!match) return 65.41; // Default to C2
    const [, noteName, octaveStr] = match;
    const octave = parseInt(octaveStr, 10);
    const noteMap: Record<string, number> = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    const semitone = noteMap[noteName.charAt(0).toUpperCase() + (noteName.length > 1 ? noteName.charAt(1) : '')] || 0;
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  const stopPlayback = () => {
    // Clear all scheduled events
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    
    // Stop transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Dispose synth
    if (synthRef.current) {
      synthRef.current.dispose();
      synthRef.current = null;
    }
    
    setIsPlaying(false);
  };

  // Play a single bass note from the interactive keyboard
  const playBassNote = async (note: string) => {
    const pitch = `${note}${bassOctave}`;
    setActiveNote(pitch);
    
    try {
      await Tone.start();
      
      // Create or reuse keyboard synth
      if (!keyboardSynthRef.current) {
        keyboardSynthRef.current = new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.4 },
          filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.5, baseFrequency: 80, octaves: 2 }
        }).toDestination();
        keyboardSynthRef.current.volume.value = -6;
      }
      
      const freq = pitchToFrequency(pitch);
      keyboardSynthRef.current.triggerAttackRelease(freq, 0.3);
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

    await Tone.start();
    setIsPlaying(true);

    // Create a bass synth
    synthRef.current = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 },
      filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.5, baseFrequency: 100, octaves: 2.5 }
    }).toDestination();
    synthRef.current.volume.value = -6;

    const bpm = tempo || 120;
    Tone.Transport.bpm.value = bpm;

    // Schedule all notes
    generatedNotes.forEach((note) => {
      const freq = pitchToFrequency(note.pitch);
      const startTime = `${note.time * (60 / bpm)}`;
      const duration = note.duration * (60 / bpm);
      
      const eventId = Tone.Transport.schedule((time) => {
        if (synthRef.current) {
          synthRef.current.triggerAttackRelease(freq, duration, time, note.velocity || 0.8);
        }
      }, startTime);
      scheduledEventsRef.current.push(eventId);
    });

    // Schedule stop at end
    const lastNote = generatedNotes.reduce((max, n) => n.time + n.duration > max ? n.time + n.duration : max, 0);
    const endTimeSeconds = (lastNote + 0.5) * (60 / bpm);
    
    const stopEventId = Tone.Transport.schedule(() => {
      stopPlayback();
    }, endTimeSeconds);
    scheduledEventsRef.current.push(stopEventId);

    Tone.Transport.start();
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

      toast({
        title: "AI Bassline Ready",
        description: `Generated ${notes.length} bass notes in ${key}`,
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
      instrument: "Bass Synth",
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
            <div>
              <span className="font-semibold text-gray-300">Preview:</span> {summary || `${generatedNotes.length} notes generated`}
            </div>
            <div className="mt-1">
              This bassline uses low register notes designed to lock in with your kick. Fine-tune it in the Piano Roll after sending to Multi-Track.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
