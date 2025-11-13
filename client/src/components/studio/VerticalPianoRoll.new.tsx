import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music } from "lucide-react";
import { realisticAudio } from "@/lib/realisticAudio";
import { useToast } from "@/hooks/use-toast";
import { PianoKeys } from "./PianoKeys";
import { StepGrid } from "./StepGrid";
import { TrackControls } from "./TrackControls";
import { PlaybackControls } from "./PlaybackControls";
import { KeyScaleSelector } from "./KeyScaleSelector";
import { ChordProgressionDisplay } from "./ChordProgressionDisplay";
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

const DEFAULT_TRACKS: Track[] = [
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
    name: 'Strings',
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
];

export const VerticalPianoRoll: React.FC = () => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [countInEnabled, setCountInEnabled] = useState(true);
  const [tracks, setTracks] = useState<Track[]>(() => 
    JSON.parse(JSON.stringify(DEFAULT_TRACKS))
  );
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentKey, setCurrentKey] = useState('C');
  const [selectedProgression, setSelectedProgression] = useState<ChordProgression>(CHORD_PROGRESSIONS[0]);
  const [chordMode, setChordMode] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const selectedTrack = tracks[selectedTrackIndex];

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
      index === selectedTrackIndex
        ? { ...track, notes: [...track.notes, newNote] }
        : track
    ));

    // Play the note
    realisticAudio.playNote(
      key.note, 
      key.octave, 
      0.8, 
      selectedTrack.instrument, 
      selectedTrack.volume / 100
    );
  }, [selectedTrackIndex, selectedTrack, currentStep]);

  const removeNote = useCallback((noteId: string) => {
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex
        ? { ...track, notes: track.notes.filter(note => note.id !== noteId) }
        : track
    ));
  }, [selectedTrackIndex]);

  const clearAll = useCallback(() => {
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: [] } : track
    ));
  }, [selectedTrackIndex]);

  // Chord progression functions
  const addChordToGrid = useCallback((step: number) => {
    try {
      if (!selectedProgression?.chords?.length) {
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

  // Track management
  const handleTrackSelect = useCallback((index: number) => {
    setSelectedTrackIndex(index);
  }, []);

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, volume } : track
    ));
  }, []);

  const handleMuteToggle = useCallback((trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, muted: !track.muted } : track
    ));
  }, []);

  const handleKeyChange = useCallback((key: string) => {
    setCurrentKey(key);
  }, []);

  const handleProgressionChange = useCallback((progression: ChordProgression) => {
    setSelectedProgression(progression);
    setCurrentChordIndex(0);
  }, []);

  const handleChordClick = useCallback((chordSymbol: string, chordNotes: string[]) => {
    // Play the chord
    chordNotes.forEach((note, index) => {
      setTimeout(() => {
        realisticAudio.playNote(
          note, 
          4, // Middle octave
          0.8, 
          selectedTrack.instrument, 
          selectedTrack.volume / 100
        );
      }, index * 50); // Slight delay between notes for arpeggio effect
    });
  }, [selectedTrack]);

  // Memoized components
  const playbackControls = useMemo(() => (
    <PlaybackControls
      isPlaying={isPlaying}
      bpm={bpm}
      metronomeEnabled={metronomeEnabled}
      countInEnabled={countInEnabled}
      onPlay={handlePlay}
      onStop={handleStop}
      onClear={clearAll}
      onToggleChordMode={() => setChordMode(!chordMode)}
      onBpmChange={setBpm}
      onToggleMetronome={setMetronomeEnabled}
      onToggleCountIn={setCountInEnabled}
      chordMode={chordMode}
    />
  ), [isPlaying, bpm, metronomeEnabled, countInEnabled, handlePlay, handleStop, clearAll, chordMode]);

  const keyScaleSelector = useMemo(() => (
    <KeyScaleSelector
      currentKey={currentKey}
      onKeyChange={handleKeyChange}
      selectedProgression={selectedProgression}
      onProgressionChange={handleProgressionChange}
      chordProgressions={CHORD_PROGRESSIONS}
    />
  ), [currentKey, handleKeyChange, selectedProgression, handleProgressionChange]);

  const chordProgressionDisplay = useMemo(() => (
    <ChordProgressionDisplay
      progression={selectedProgression}
      currentKey={currentKey}
      currentChordIndex={currentChordIndex}
      onChordClick={handleChordClick}
    />
  ), [selectedProgression, currentKey, currentChordIndex, handleChordClick]);

  return (
    <div className="h-full w-full bg-gray-900 text-white">
      <Card className="h-full bg-gray-800 border-gray-700">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">🎹 Piano Roll</h1>
              {playbackControls}
            </div>
            
            {keyScaleSelector}
            {chordProgressionDisplay}
            
            {/* Chord Mode Toggle - Moved from PianoKeys */}
            <div className="flex items-center justify-center gap-4 p-3 bg-gradient-to-r from-purple-900/50 to-gray-800/50 rounded-md border border-purple-500/30">
              <Button
                size="lg"
                variant={chordMode ? "default" : "secondary"}
                className={`text-sm font-bold px-6 ${chordMode ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-400' : 'bg-gray-700'}`}
                onClick={() => {
                  setChordMode(!chordMode);
                  if (!chordMode) {
                    setActiveKeys(new Set());
                  }
                }}
                data-testid="button-chord-mode"
              >
                <Music className="w-5 h-5 mr-2" />
                <span className="text-base">
                  {chordMode ? '🎵 CHORD ON' : '🎵 Chord OFF'}
                </span>
              </Button>
              {chordMode && (
                <p className="text-sm text-purple-300 font-medium">
                  Tap piano keys to build your chord, then click the grid!
                </p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="h-[calc(100%-250px)] overflow-hidden">
          <div className="flex h-full">
            <PianoKeys
              pianoKeys={PIANO_KEYS}
              selectedTrack={selectedTrack}
              onKeyClick={addNote}
              keyHeight={KEY_HEIGHT}
              currentStep={currentStep}
              isPlaying={isPlaying}
              chordMode={chordMode}
              activeKeys={activeKeys}
              onActiveKeysChange={setActiveKeys}
            />
            
            <StepGrid
              steps={STEPS}
              pianoKeys={PIANO_KEYS}
              selectedTrack={selectedTrack}
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
            selectedTrack={selectedTrackIndex}
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
