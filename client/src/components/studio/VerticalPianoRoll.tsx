import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RealisticAudioEngine } from "@/lib/realisticAudio";

interface Note {
  id: string;
  note: string;
  octave: number;
  step: number;
  velocity: number;
  length: number;
}

interface Track {
  id: string;
  name: string;
  color: string;
  notes: Note[];
  muted: boolean;
  volume: number;
}

interface ChordProgression {
  id: string;
  name: string;
  chords: string[];
  key: string;
}

interface MusicKey {
  name: string;
  notes: string[];
  chords: {
    I: string[];
    ii: string[];
    iii: string[];
    IV: string[];
    V: string[];
    vi: string[];
    vii: string[];
  };
}

interface PianoKey {
  note: string;
  octave: number;
  isBlack: boolean;
  key: string;
}

// Piano keys from C8 (top) to C0 (bottom) - vertical layout
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

const STEPS = 32; // 32 step grid
const KEY_HEIGHT = 20;
const STEP_WIDTH = 25;

// Music theory data
const MUSIC_KEYS: Record<string, MusicKey> = {
  'C': {
    name: 'C Major',
    notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    chords: {
      I: ['C', 'E', 'G'],
      ii: ['D', 'F', 'A'],
      iii: ['E', 'G', 'B'],
      IV: ['F', 'A', 'C'],
      V: ['G', 'B', 'D'],
      vi: ['A', 'C', 'E'],
      vii: ['B', 'D', 'F']
    }
  },
  'G': {
    name: 'G Major',
    notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    chords: {
      I: ['G', 'B', 'D'],
      ii: ['A', 'C', 'E'],
      iii: ['B', 'D', 'F#'],
      IV: ['C', 'E', 'G'],
      V: ['D', 'F#', 'A'],
      vi: ['E', 'G', 'B'],
      vii: ['F#', 'A', 'C']
    }
  },
  'F': {
    name: 'F Major',
    notes: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    chords: {
      I: ['F', 'A', 'C'],
      ii: ['G', 'Bb', 'D'],
      iii: ['A', 'C', 'E'],
      IV: ['Bb', 'D', 'F'],
      V: ['C', 'E', 'G'],
      vi: ['D', 'F', 'A'],
      vii: ['E', 'G', 'Bb']
    }
  }
};

const CHORD_PROGRESSIONS: ChordProgression[] = [
  { id: 'classic', name: 'Classic (I-V-vi-IV)', chords: ['I', 'V', 'vi', 'IV'], key: 'C' },
  { id: 'jazz', name: 'Jazz (ii-V-I)', chords: ['ii', 'V', 'I'], key: 'C' },
  { id: 'pop', name: 'Pop (vi-IV-I-V)', chords: ['vi', 'IV', 'I', 'V'], key: 'C' },
  { id: 'electronic', name: 'Electronic (i-VII-VI-VII)', chords: ['vi', 'V', 'IV', 'V'], key: 'C' }
];

// Circle of Fifths
const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

export default function VerticalPianoRoll() {
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
      volume: 80
    }
  ]);

  // Chord progression state
  const [currentKey, setCurrentKey] = useState('C');
  const [selectedProgression, setSelectedProgression] = useState<ChordProgression>(CHORD_PROGRESSIONS[0]);
  const [chordMode, setChordMode] = useState(false);
  const [scaleLock, setScaleLock] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);

  const { toast } = useToast();
  const audioEngine = useRef(new RealisticAudioEngine());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handlePlay = async () => {
    try {
      await audioEngine.current.initialize();
      
      if (isPlaying) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsPlaying(false);
        setCurrentStep(0);
      } else {
        setIsPlaying(true);
        const stepDuration = (60 / bpm / 4) * 1000; // 16th note duration in ms
        
        intervalRef.current = setInterval(() => {
          setCurrentStep(prev => {
            const nextStep = (prev + 1) % STEPS;
            
            // Play notes at current step
            tracks.forEach(track => {
              if (!track.muted) {
                const notesAtStep = track.notes.filter(note => note.step === nextStep);
                notesAtStep.forEach(note => {
                  audioEngine.current.playNote(
                    note.note,
                    note.octave,
                    note.velocity / 127,
                    0.25 // quarter note duration
                  );
                });
              }
            });
            
            return nextStep;
          });
        }, stepDuration);
      }
    } catch (error) {
      toast({
        title: "Audio Error",
        description: "Failed to initialize audio",
        variant: "destructive"
      });
    }
  };

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsPlaying(false);
    setCurrentStep(0);
  };

  const addNote = (keyIndex: number, step: number) => {
    const key = PIANO_KEYS[keyIndex];
    const newNote: Note = {
      id: `${key.key}-${step}-${Date.now()}`,
      note: key.note,
      octave: key.octave,
      step,
      velocity: 100,
      length: 1
    };

    setTracks(prev => prev.map((track, index) => 
      index === selectedTrack 
        ? { ...track, notes: [...track.notes, newNote] }
        : track
    ));

    // Play the note immediately
    audioEngine.current.playNote(key.note, key.octave, 0.8, 0.25);
  };

  const removeNote = (noteId: string) => {
    setTracks(prev => prev.map((track, index) => 
      index === selectedTrack 
        ? { ...track, notes: track.notes.filter(note => note.id !== noteId) }
        : track
    ));
  };

  const clearAll = () => {
    setTracks(prev => prev.map((track, index) => 
      index === selectedTrack 
        ? { ...track, notes: [] }
        : track
    ));
  };

  // Chord progression functions
  const playChord = (chordNotes: string[], octave: number = 4) => {
    chordNotes.forEach((note, index) => {
      setTimeout(() => {
        audioEngine.current.playNote(note, octave, 0.6, 1.0);
      }, index * 50); // Slight stagger for chord effect
    });
  };

  const addChordToGrid = (step: number) => {
    const currentChord = selectedProgression.chords[currentChordIndex];
    const chordNotes = MUSIC_KEYS[currentKey].chords[currentChord as keyof typeof MUSIC_KEYS[typeof currentKey]['chords']];
    
    chordNotes.forEach((note, index) => {
      const newNote: Note = {
        id: `${note}-${step}-${Date.now()}-${index}`,
        note,
        octave: 4,
        step,
        velocity: 100,
        length: 1
      };
      
      setTracks(prev => prev.map((track, trackIndex) => 
        trackIndex === selectedTrack 
          ? { ...track, notes: [...track.notes, newNote] }
          : track
      ));
    });

    // Play the chord
    playChord(chordNotes);
    
    // Move to next chord in progression
    setCurrentChordIndex(prev => (prev + 1) % selectedProgression.chords.length);
  };

  const generateProgression = () => {
    let step = 0;
    selectedProgression.chords.forEach((chordSymbol, index) => {
      const chordNotes = MUSIC_KEYS[currentKey].chords[chordSymbol as keyof typeof MUSIC_KEYS[typeof currentKey]['chords']];
      
      chordNotes.forEach((note, noteIndex) => {
        const newNote: Note = {
          id: `${note}-${step}-${Date.now()}-${noteIndex}`,
          note,
          octave: 4,
          step: step + (index * 8), // 8 steps per chord
          velocity: 100,
          length: 8
        };
        
        setTracks(prev => prev.map((track, trackIndex) => 
          trackIndex === selectedTrack 
            ? { ...track, notes: [...track.notes, newNote] }
            : track
        ));
      });
    });
  };

  return (
    <div className="h-full w-full bg-gray-900 text-white">
      <Card className="h-full bg-gray-800 border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xl">🎹 Vertical Piano Roll</span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePlay}
                  className={`${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button onClick={handleStop} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
                <Button onClick={clearAll} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                  <RotateCcw className="h-4 w-4" />
                  Clear
                </Button>
                <Button 
                  onClick={() => setChordMode(!chordMode)} 
                  variant={chordMode ? "default" : "outline"}
                  className={chordMode ? "bg-purple-600 hover:bg-purple-500" : "bg-gray-700 hover:bg-gray-600"}
                >
                  🎵 Chord Mode
                </Button>
                <Button onClick={generateProgression} variant="outline" className="bg-green-700 hover:bg-green-600">
                  Generate Progression
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Key:</span>
                <select 
                  value={currentKey} 
                  onChange={(e) => setCurrentKey(e.target.value)}
                  className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                >
                  {Object.keys(MUSIC_KEYS).map(key => (
                    <option key={key} value={key}>{MUSIC_KEYS[key].name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Progression:</span>
                <select 
                  value={selectedProgression.id} 
                  onChange={(e) => {
                    const prog = CHORD_PROGRESSIONS.find(p => p.id === e.target.value);
                    if (prog) setSelectedProgression(prog);
                  }}
                  className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                >
                  {CHORD_PROGRESSIONS.map(prog => (
                    <option key={prog.id} value={prog.id}>{prog.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">BPM:</span>
                <Slider
                  value={[bpm]}
                  onValueChange={(value) => setBpm(value[0])}
                  min={60}
                  max={200}
                  step={1}
                  className="w-20"
                />
                <span className="text-sm w-8">{bpm}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Zoom:</span>
                <Slider
                  value={[zoom]}
                  onValueChange={(value) => setZoom(value[0])}
                  min={0.5}
                  max={3}
                  step={0.25}
                  className="w-20"
                />
                <span className="text-sm w-8">{zoom}x</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="h-full overflow-hidden">
          <div className="flex h-full">
            {/* Vertical Piano Keys */}
            <div className="w-20 bg-gray-800 border-r border-gray-600 overflow-y-auto">
              <div className="relative">
                {PIANO_KEYS.map((key, index) => (
                  <button
                    key={key.key}
                    className={`
                      w-full text-xs font-mono border-b border-gray-600 hover:bg-gray-600 transition-colors
                      ${key.isBlack 
                        ? 'bg-gray-900 text-gray-300 border-l-4 border-l-gray-700' 
                        : 'bg-gray-700 text-white'
                      }
                      ${chordMode ? 'ring-2 ring-purple-500 ring-opacity-50' : ''}
                    `}
                    style={{ height: `${KEY_HEIGHT}px` }}
                    onClick={() => {
                      if (chordMode) {
                        // In chord mode, play the current chord when any key is clicked
                        const currentChord = selectedProgression.chords[currentChordIndex];
                        const chordNotes = MUSIC_KEYS[currentKey].chords[currentChord as keyof typeof MUSIC_KEYS[typeof currentKey]['chords']];
                        playChord(chordNotes, key.octave);
                      } else {
                        // Normal mode - play single note
                        audioEngine.current.playNote(key.note, key.octave, 0.8, 0.25);
                      }
                    }}
                  >
                    {key.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Step Grid */}
            <div className="flex-1 overflow-auto">
              <div className="relative bg-gray-900">
                {/* Step Headers */}
                <div className="flex sticky top-0 bg-gray-800 border-b border-gray-600 z-10">
                  {Array.from({ length: STEPS }, (_, step) => (
                    <div
                      key={step}
                      className={`
                        flex items-center justify-center text-xs font-mono border-r border-gray-600
                        ${currentStep === step ? 'bg-red-600 text-white' : 'text-gray-400'}
                        ${step % 4 === 0 ? 'bg-gray-700' : ''}
                      `}
                      style={{ 
                        width: `${STEP_WIDTH * zoom}px`,
                        height: '30px'
                      }}
                    >
                      {step + 1}
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div className="relative">
                  {PIANO_KEYS.map((key, keyIndex) => (
                    <div key={key.key} className="flex border-b border-gray-700">
                      {Array.from({ length: STEPS }, (_, step) => {
                        const hasNote = tracks[selectedTrack]?.notes.some(
                          note => note.note === key.note && note.octave === key.octave && note.step === step
                        );
                        const note = tracks[selectedTrack]?.notes.find(
                          note => note.note === key.note && note.octave === key.octave && note.step === step
                        );

                        return (
                          <div
                            key={step}
                            className={`
                              border-r border-gray-700 cursor-pointer transition-colors relative
                              ${hasNote 
                                ? 'bg-blue-500 hover:bg-blue-400' 
                                : 'hover:bg-gray-700'
                              }
                              ${step % 4 === 0 ? 'border-r-gray-500' : ''}
                              ${currentStep === step ? 'bg-red-900 bg-opacity-50' : ''}
                            `}
                            style={{ 
                              width: `${STEP_WIDTH * zoom}px`,
                              height: `${KEY_HEIGHT}px`
                            }}
                            onClick={() => {
                              if (hasNote && note) {
                                removeNote(note.id);
                              } else if (chordMode) {
                                addChordToGrid(step);
                              } else {
                                addNote(keyIndex, step);
                              }
                            }}
                          >
                            {hasNote && (
                              <div className="absolute inset-0 bg-blue-500 rounded-sm m-0.5 flex items-center justify-center">
                                <div className="w-1 h-1 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Chord Progression Panel */}
          <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">🎼 Chord Progression</span>
                <span className="text-sm text-gray-400">
                  Key: {MUSIC_KEYS[currentKey].name}
                </span>
                <span className="text-sm text-gray-400">
                  Current: {selectedProgression.chords[currentChordIndex]} ({currentChordIndex + 1}/{selectedProgression.chords.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setScaleLock(!scaleLock)} 
                  variant={scaleLock ? "default" : "outline"}
                  className={`text-xs ${scaleLock ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-700 hover:bg-gray-600"}`}
                >
                  Scale Lock
                </Button>
              </div>
            </div>
            
            {/* Circle of Fifths */}
            <div className="mb-3">
              <span className="text-xs text-gray-400 mb-2 block">Circle of Fifths:</span>
              <div className="flex flex-wrap gap-1">
                {CIRCLE_OF_FIFTHS.map((key, index) => (
                  <button
                    key={key}
                    onClick={() => setCurrentKey(key)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      currentKey === key 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Progression Display */}
            <div className="mb-3">
              <span className="text-xs text-gray-400 mb-2 block">Current Progression ({selectedProgression.name}):</span>
              <div className="flex gap-2">
                {selectedProgression.chords.map((chord, index) => {
                  const chordNotes = MUSIC_KEYS[currentKey].chords[chord as keyof typeof MUSIC_KEYS[typeof currentKey]['chords']];
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentChordIndex(index);
                        playChord(chordNotes);
                      }}
                      className={`px-3 py-2 text-sm rounded transition-colors ${
                        currentChordIndex === index 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      <div className="font-medium">{chord}</div>
                      <div className="text-xs opacity-75">{chordNotes.join('-')}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Track Info */}
          <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Track: {tracks[selectedTrack]?.name}</span>
                <span className="text-sm text-gray-400">
                  Notes: {tracks[selectedTrack]?.notes.length || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Volume:</span>
                <Slider
                  value={[tracks[selectedTrack]?.volume || 80]}
                  onValueChange={(value) => {
                    setTracks(prev => prev.map((track, index) => 
                      index === selectedTrack 
                        ? { ...track, volume: value[0] }
                        : track
                    ));
                  }}
                  min={0}
                  max={100}
                  step={1}
                  className="w-20"
                />
                <span className="text-sm w-8">{tracks[selectedTrack]?.volume}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
