import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { realisticAudio } from "@/lib/realisticAudio";

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
  instrument: string;
}

interface ChordProgression {
  id: string;
  name: string;
  chords: string[];
  key: string;
}

interface PianoKey {
  note: string;
  octave: number;
  isBlack: boolean;
  key: string;
}

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

// Circle of Fifths
const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

const DEFAULT_customKeys = {
  'C': {
    name: 'C Major',
    notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    chords: {
      'I': ['C', 'E', 'G'],
      'ii': ['D', 'F', 'A'],
      'iii': ['E', 'G', 'B'],
      'IV': ['F', 'A', 'C'],
      'V': ['G', 'B', 'D'],
      'vi': ['A', 'C', 'E'],
      'vii°': ['B', 'D', 'F']
    }
  },
  'G': {
    name: 'G Major',
    notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    chords: {
      'I': ['G', 'B', 'D'],
      'ii': ['A', 'C', 'E'],
      'iii': ['B', 'D', 'F#'],
      'IV': ['C', 'E', 'G'],
      'V': ['D', 'F#', 'A'],
      'vi': ['E', 'G', 'B'],
      'vii°': ['F#', 'A', 'C']
    }
  },
  'F': {
    name: 'F Major',
    notes: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    chords: {
      'I': ['F', 'A', 'C'],
      'ii': ['G', 'Bb', 'D'],
      'iii': ['A', 'C', 'E'],
      'IV': ['Bb', 'D', 'F'],
      'V': ['C', 'E', 'G'],
      'vi': ['D', 'F', 'A'],
      'vii°': ['E', 'G', 'Bb']
    }
  }
};

const CHORD_PROGRESSIONS: ChordProgression[] = [
  { id: 'classic', name: 'Classic (I-V-vi-IV)', chords: ['I', 'V', 'vi', 'IV'], key: 'C' },
  { id: 'jazz', name: 'Jazz (ii-V-I)', chords: ['ii', 'V', 'I'], key: 'C' },
  { id: 'pop', name: 'Pop (vi-IV-I-V)', chords: ['vi', 'IV', 'I', 'V'], key: 'C' },
  { id: 'electronic', name: 'Electronic (i-VII-VI-VII)', chords: ['vi', 'V', 'IV', 'V'], key: 'C' }
];

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
  const [scaleLock, setScaleLock] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);

  const { toast } = useToast();
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

            tracks.forEach(track => {
              if (!track.muted) {
                const notesAtStep = track.notes.filter(note => note.step === nextStep);
                notesAtStep.forEach(note => {
                  realisticAudio.playNote(
                    note.note,
                    note.octave,
                    0.25,
                    track.instrument || 'piano',
                    note.velocity / 127
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

    realisticAudio.playNote(key.note, key.octave, 0.8, tracks[selectedTrack]?.instrument || 'piano', 0.8);
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

  const playChord = (chordNotes: string[], octave: number = 4) => {
    chordNotes.forEach((note, index) => {
      setTimeout(() => {
        realisticAudio.playNote(note, octave, 1.0, tracks[selectedTrack]?.instrument || 'piano', 0.6);
      }, index * 50); // Slight stagger for chord effect
    });
  };

  const addChordToGrid = (step: number) => {
    let chordToUse: string;
    let chordNotes: string[];

    if (chordMode) {
      chordToUse = selectedProgression.chords[currentChordIndex];
      chordNotes = (DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys] as any).chords[chordToUse];
      setCurrentChordIndex(prev => (prev + 1) % selectedProgression.chords.length);
    } else {
      chordToUse = selectedProgression.chords[0];
      chordNotes = (DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys] as any).chords[chordToUse];
    }

    chordNotes.forEach((noteName: string, noteIndex: number) => {
      const keyIndex = PIANO_KEYS.findIndex(key => key.note === noteName && key.octave === 4);
      if (keyIndex !== -1) {
        addNote(keyIndex, step + noteIndex * 0.1); // Slight offset for chord notes
      }
    });
  };

  const generateProgression = () => {
    let step = 0;
    selectedProgression.chords.forEach((chordSymbol, index) => {
      const chordNotes = (DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys] as any).chords[chordSymbol];

      chordNotes.forEach((note: string, noteIndex: number) => {
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
            </div>
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
          </CardTitle>
          
          {/* Track Selection - Moved to top for visibility */}
          <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-600">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-white">Track:</span>
              <div className="flex gap-2">
                {tracks.map((track, index) => (
                  <button
                    key={track.id}
                    onClick={() => setSelectedTrack(index)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      selectedTrack === index
                        ? `${track.color} text-white`
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {track.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm font-medium text-white">Instrument:</span>
              <select
                value={tracks[selectedTrack]?.instrument || 'piano'}
                onChange={(e) => {
                  setTracks(prev => prev.map((track, index) => 
                    index === selectedTrack 
                      ? { ...track, instrument: e.target.value }
                      : track
                  ));
                }}
                className="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600"
              >
                {/* Piano */}
                <option value="piano">🎹 Piano</option>
                <option value="piano-organ">🎹 Organ</option>
                
                {/* Strings */}
                <option value="strings-violin">🎻 Violin</option>
                <option value="strings">🎻 Strings</option>
                <option value="guitar">🎸 Guitar</option>
                <option value="strings-guitar">🎸 Guitar (Steel)</option>
                <option value="guitar-nylon">🎸 Guitar (Nylon)</option>
                <option value="pads-strings">🎻 Pad Strings</option>
                
                {/* Horns */}
                <option value="horns-trumpet">🎺 Trumpet</option>
                <option value="horns-trombone">🎺 Trombone</option>
                <option value="horns-french">🎺 French Horn</option>
                
                {/* Flutes */}
                <option value="flute-concert">🪈 Flute</option>
                <option value="flute-recorder">🪈 Recorder</option>
                <option value="flute-indian">🪈 Indian Flute</option>
                
                {/* Bass */}
                <option value="bass-electric">🎸 Bass (Electric)</option>
                <option value="bass-upright">🎸 Bass (Upright)</option>
                <option value="bass-synth">🎸 Bass (Synth)</option>
                
                {/* Synth */}
                <option value="synth-analog">🎛️ Synth (Analog)</option>
                <option value="synth-digital">🎛️ Synth (Digital)</option>
                <option value="synth-fm">🎛️ Synth (FM)</option>
                
                {/* Leads */}
                <option value="leads-square">🎛️ Lead (Square)</option>
                <option value="leads-saw">🎛️ Lead (Saw)</option>
                <option value="leads-pluck">🎛️ Lead (Pluck)</option>
                
                {/* Pads */}
                <option value="pads-warm">🎛️ Pad (Warm)</option>
                <option value="pads-choir">🎛️ Pad (Choir)</option>
                
                {/* Drums */}
                <option value="drum-kick">🥁 Kick Drum</option>
                <option value="drum-snare">🥁 Snare Drum</option>
                <option value="drum-hihat">🥁 Hi-Hat</option>
                <option value="drum-crash">🥁 Crash</option>
                <option value="drum-tom">🥁 Tom</option>
                <option value="drum-clap">🥁 Clap</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="h-full overflow-hidden">
          <div className="flex h-full">
            {/* Vertical Piano Keys */}
            <div className="w-20 bg-gray-800 border-r border-gray-600 overflow-y-auto">
              <div className="relative">
                {PIANO_KEYS.map((key, index) => (
                  <button
                    key={key.key}
                    className={`w-full text-xs font-mono border-b border-gray-600 hover:bg-gray-600 transition-colors
                      ${key.isBlack
                        ? 'bg-gray-900 text-gray-300 border-l-4 border-l-gray-700'
                        : 'bg-gray-700 text-white'
                      }
                      ${chordMode ? 'ring-2 ring-purple-500 ring-opacity-50' : ''}
                    `}
                    style={{ height: `${KEY_HEIGHT}px` }}
                    onClick={() => {
                      try {
                        if (chordMode) {
                          const currentChord = selectedProgression.chords[currentChordIndex];
                          const chordNotes = (DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys] as any).chords[currentChord];
                          playChord(chordNotes, key.octave);
                        } else {
                          realisticAudio.playNote(key.note, key.octave, 0.8, tracks[selectedTrack]?.instrument || 'piano', 0.8);
                        }
                      } catch (error) {
                        console.error('Audio playback error:', error);
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
                      className={`flex items-center justify-center text-xs font-mono border-r border-gray-600
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
                            className={`border-r border-gray-700 cursor-pointer transition-colors relative
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

          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Key:</span>
              <select
                value={currentKey}
                onChange={(e) => setCurrentKey(e.target.value)}
                className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
              >
                {Object.keys(DEFAULT_customKeys).map(key => (
                  <option key={key} value={key}>{DEFAULT_customKeys[key as keyof typeof DEFAULT_customKeys].name}</option>
                ))}
              </select>
            </div>
            
            {/* Circle of Fifths */}
            <div className="mb-3">
              <span className="text-xs text-gray-400 mb-2 block">Circle of Fifths:</span>
              <div className="flex flex-wrap gap-1">
                {CIRCLE_OF_FIFTHS.map((key, index) => (
                  <button
                    key={key}
                    onClick={() => setCurrentKey(key)}
                    className={currentKey === key ? "px-2 py-1 text-xs rounded transition-colors bg-purple-600 text-white" : "px-2 py-1 text-xs rounded transition-colors bg-gray-700 hover:bg-gray-600 text-gray-300"}
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
                  const chordNotes = (DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys] as any).chords[chord];
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentChordIndex(index);
                        playChord(chordNotes);
                      }}
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
                    setTracks(prev => {
                      return prev.map(track => {
                        if (track.id === tracks[selectedTrack]?.id) {
                          return { ...track, volume: value[0] };
                        }
                        return track;
                      });
                    });
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
  )
}
