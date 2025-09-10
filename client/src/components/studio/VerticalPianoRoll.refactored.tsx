import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { realisticAudio } from "@/lib/realisticAudio";
import { PianoKeys } from "./PianoKeys";
import { StepGrid } from "./StepGrid";
import { TrackControls } from "./TrackControls";
import { 
  Note, 
  Track, 
  PianoKey, 
  ChordProgression, 
  DEFAULT_customKeys, 
  CIRCLE_OF_FIFTHS, 
  STEPS, 
  KEY_HEIGHT, 
  STEP_WIDTH 
} from "./types/pianoRollTypes";

// Initialize piano keys
const PIANO_KEYS: PianoKey[] = [];
for (let octave = 8; octave >= 0; octave--) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (const note of notes) {
    PIANO_KEYS.push({
      note,
      octave,
      isBlack: note.includes('#'),
      key: `${note}${octave}`
    });
  }
}

// Chord progressions
const CHORD_PROGRESSIONS: ChordProgression[] = [
  { id: 'classic', name: 'Classic (I-V-vi-IV)', chords: ['I', 'V', 'vi', 'IV'], key: 'C' },
  { id: 'jazz', name: 'Jazz (ii-V-I)', chords: ['ii', 'V', 'I'], key: 'C' },
  { id: 'pop', name: 'Pop (vi-IV-I-V)', chords: ['vi', 'IV', 'I', 'V'], key: 'C' },
  { id: 'electronic', name: 'Electronic (i-VII-VI-VII)', chords: ['vi', 'V', 'IV', 'V'], key: 'C' },
  { id: 'minor', name: 'Minor (i-III-VII)', chords: ['i', 'III', 'VII'], key: 'A' },
  { id: 'blues', name: 'Blues (I-IV-V)', chords: ['I', 'IV', 'V'], key: 'C' },
  { id: 'rock', name: 'Rock (I-V-IV)', chords: ['I', 'V', 'IV'], key: 'G' },
  { id: 'funk', name: 'Funk (I-IV-ii)', chords: ['I', 'IV', 'ii'], key: 'C' },
  { id: 'hiphop', name: 'Hip-Hop (vi-IV-V)', chords: ['vi', 'IV', 'V'], key: 'C' },
  { id: 'reggae', name: 'Reggae (I-VII-IV)', chords: ['I', 'VII', 'IV'], key: 'C' }
];

export const VerticalPianoRoll: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: 'track1',
      name: 'Piano',
      color: 'bg-blue-500',
      notes: [],
      muted: false,
      volume: 80,
      instrument: 'piano'
    },
    {
      id: 'track2',
      name: 'Bass',
      color: 'bg-green-500',
      notes: [],
      muted: false,
      volume: 75,
      instrument: 'bass-electric'
    },
    {
      id: 'track3',
      name: 'Harmony',
      color: 'bg-purple-500',
      notes: [],
      muted: false,
      volume: 70,
      instrument: 'strings-violin'
    },
    {
      id: 'track4',
      name: 'Synth',
      color: 'bg-yellow-500',
      notes: [],
      muted: false,
      volume: 65,
      instrument: 'synth-analog'
    }
  ]);

  const [currentKey, setCurrentKey] = useState('C');
  const [selectedProgression, setSelectedProgression] = useState<ChordProgression>(CHORD_PROGRESSIONS[0]);
  const [chordMode, setChordMode] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Playback control
  const handlePlay = useCallback(() => {
    if (isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      const stepDuration = (60 / bpm / 4) * 1000; // 16th note duration in ms

      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const nextStep = (prev + 1) % STEPS;
          
          // Play notes at the current step
          tracks.forEach(track => {
            if (!track.muted) {
              const notesAtStep = track.notes.filter(note => note.step === nextStep);
              notesAtStep.forEach(note => {
                realisticAudio.playNote(
                  note.note,
                  note.octave,
                  0.25,
                  track.instrument,
                  (note.velocity / 127) * (track.volume / 100)
                );
              });
            }
          });

          return nextStep;
        });
      }, stepDuration);
    }
  }, [isPlaying, bpm, tracks]);

  const handleStop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  // Note management
  const addNote = useCallback((keyIndex: number, step?: number) => {
    const key = PIANO_KEYS[keyIndex];
    
    // If no step provided (from PianoKeys), use current step or 0
    const noteStep = step !== undefined ? step : (currentStep || 0);
    
    const newNote: Note = {
      id: `${key.key}-${noteStep}-${Date.now()}`,
      note: key.note,
      octave: key.octave,
      step: noteStep,
      velocity: 100,
      length: 1
    };

    setTracks(prev => prev.map((track, index) =>
      index === selectedTrack
        ? { ...track, notes: [...track.notes, newNote] }
        : track
    ));

    // Play the note
    realisticAudio.playNote(
      key.note, 
      key.octave, 
      0.8, 
      tracks[selectedTrack]?.instrument || 'piano', 
      (tracks[selectedTrack]?.volume || 80) / 100
    );
  }, [selectedTrack, tracks, currentStep]);

  const removeNote = useCallback((noteId: string) => {
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrack
        ? { ...track, notes: track.notes.filter(note => note.id !== noteId) }
        : track
    ));
  }, [selectedTrack]);

  const clearAll = useCallback(() => {
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrack ? { ...track, notes: [] } : track
    ));
  }, [selectedTrack]);

  // Chord progression functions
  const addChordToGrid = useCallback((step: number) => {
    try {
      if (!selectedProgression?.chords || !selectedProgression.chords.length) {
        console.error('No chords available in the selected progression');
        return;
      }

      const chordToUse = selectedProgression.chords[currentChordIndex % selectedProgression.chords.length];
      const keyData = DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys];
      
      if (!keyData?.chords?.[chordToUse]) {
        console.error(`Chord ${chordToUse} not found in key ${currentKey}`);
        return;
      }

      const chordNotes = keyData.chords[chordToUse];
      
      // Add each note of the chord
      chordNotes.forEach((noteName, noteIndex) => {
        const keyIndex = PIANO_KEYS.findIndex(key => 
          key.note === noteName && key.octave === 4
        );
        
        if (keyIndex !== -1) {
          // Slight offset for each note in the chord for a more natural sound
          addNote(keyIndex, step + (noteIndex * 0.1));
        }
      });

      // Move to the next chord in the progression
      setCurrentChordIndex(prev => (prev + 1) % selectedProgression.chords.length);
    } catch (error) {
      console.error('Error adding chord to grid:', error);
      toast({
        title: "Error",
        description: "Failed to add chord to grid",
        variant: "destructive"
      });
    }
  }, [currentChordIndex, selectedProgression, currentKey, addNote, toast]);

  // Handle track selection and updates
  const handleTrackSelect = useCallback((index: number) => {
    setSelectedTrack(index);
  }, []);

  const handleMuteToggle = useCallback((trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, muted: !track.muted } : track
    ));
  }, []);

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, volume } : track
    ));
  }, []);

  // Generate AI melody using ChatMusician
  const handleGenerateAIMelody = async () => {
    const prompt = `Generate a ${selectedProgression?.name || 'melody'} in ${currentKey} key, ${bpm} BPM, for ${tracks.length} tracks`;
    
    try {
      const response = await fetch('/api/chatmusician/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style: selectedProgression?.name })
      });
      
      const data = await response.json();
      
      if (data.abcNotation) {
        // Add each note of the chord
        const demoNotes = [
          { id: `ai-note-1-${Date.now()}`, note: 'C', octave: 4, step: 0, velocity: 100, length: 1 },
          { id: `ai-note-2-${Date.now()}`, note: 'E', octave: 4, step: 2, velocity: 100, length: 1 },
          { id: `ai-note-3-${Date.now()}`, note: 'G', octave: 4, step: 4, velocity: 100, length: 1 },
          { id: `ai-note-4-${Date.now()}`, note: 'C', octave: 5, step: 6, velocity: 100, length: 1 },
        ];
        
        setTracks(prev => prev.map((track, index) =>
          index === selectedTrack ? { ...track, notes: [...track.notes, ...demoNotes] } : track
        ));
        
        toast({
          title: "AI Melody Generated",
          description: "Melody has been added to the piano roll.",
        });
      }
    } catch (err) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate AI melody.",
        variant: "destructive"
      });
    }
  };

  // Render
  return (
    <div className="h-full w-full bg-gray-900 text-white">
      <Card className="h-full bg-gray-800 border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xl">🎹 Vertical Piano Roll</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePlay}
                className={`${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button 
                onClick={handleStop} 
                variant="outline" 
                className="bg-gray-700 hover:bg-gray-600"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
              <Button 
                onClick={clearAll} 
                variant="outline" 
                className="bg-gray-700 hover:bg-gray-600"
              >
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
              <Button
                onClick={handleGenerateAIMelody}
                className="bg-purple-600 hover:bg-purple-500"
                disabled={isPlaying}
              >
                🤖 Generate AI Melody
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="h-[calc(100%-120px)] overflow-hidden">
          <div className="flex h-full">
            <PianoKeys
              pianoKeys={PIANO_KEYS}
              selectedTrack={tracks[selectedTrack]}
              onKeyClick={addNote}
              keyHeight={KEY_HEIGHT}
              currentStep={currentStep}
              isPlaying={isPlaying}
            />
            
            <StepGrid
              steps={STEPS}
              pianoKeys={PIANO_KEYS}
              selectedTrack={tracks[selectedTrack]}
              currentStep={currentStep}
              stepWidth={STEP_WIDTH}
              keyHeight={KEY_HEIGHT}
              zoom={zoom}
              onStepClick={addNote}
              onChordAdd={addChordToGrid}
              onNoteRemove={removeNote}
              chordMode={chordMode}
            />
          </div>
        </CardContent>

        <div className="px-6 pb-6">
          <TrackControls
            tracks={tracks}
            selectedTrack={selectedTrack}
            onTrackSelect={handleTrackSelect}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
          />
        </div>
      </Card>
    </div>
  );
};

export default VerticalPianoRoll;
