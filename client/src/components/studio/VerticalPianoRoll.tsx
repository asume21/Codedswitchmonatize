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
}

interface ProgressionStep {
  id: string;
  chordSymbol: string;
  lengthSteps: number;
  inversion: 0 | 1 | 2; // root, 1st, 2nd inversion
  octave: number;
  voicing: 'close' | 'open';
}

interface ChordProgression {
  id: string;
  name: string;
  steps: ProgressionStep[];
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

const createProgressionStep = (chordSymbol: string, lengthSteps: number = 8): ProgressionStep => ({
  id: `${chordSymbol}-${Date.now()}-${Math.random()}`,
  chordSymbol,
  lengthSteps,
  inversion: 0,
  octave: 4,
  voicing: 'close'
});

const CHORD_PROGRESSIONS: ChordProgression[] = [
  { 
    id: 'classic', 
    name: 'Classic (I-V-vi-IV)', 
    steps: [
      createProgressionStep('I'),
      createProgressionStep('V'),
      createProgressionStep('vi'),
      createProgressionStep('IV')
    ], 
    key: 'C' 
  },
  { 
    id: 'jazz', 
    name: 'Jazz (ii-V-I)', 
    steps: [
      createProgressionStep('ii'),
      createProgressionStep('V'),
      createProgressionStep('I')
    ], 
    key: 'C' 
  },
  { 
    id: 'pop', 
    name: 'Pop (vi-IV-I-V)', 
    steps: [
      createProgressionStep('vi'),
      createProgressionStep('IV'),
      createProgressionStep('I'),
      createProgressionStep('V')
    ], 
    key: 'C' 
  },
  { 
    id: 'electronic', 
    name: 'Electronic (vi-V-IV-V)', 
    steps: [
      createProgressionStep('vi'),
      createProgressionStep('V'),
      createProgressionStep('IV'),
      createProgressionStep('V')
    ], 
    key: 'C' 
  }
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

  // Grid editing tools & interaction
  const [currentTool, setCurrentTool] = useState<'paint' | 'erase' | 'select'>('paint');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [paintVelocity, setPaintVelocity] = useState(100);
  const [paintLength, setPaintLength] = useState(1);
  const paintedCellsRef = useRef<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const originalLengthRef = useRef<number>(0);
  const [snapDivision, setSnapDivision] = useState<4 | 8 | 16 | 32>(16);
  const [swing, setSwing] = useState(0); // 0-100 swing amount (placeholder for future playback timing)

  // Chord progression state
  const [currentKey, setCurrentKey] = useState('C');
  const [selectedProgression, setSelectedProgression] = useState<ChordProgression>(CHORD_PROGRESSIONS[0]);
  const [chordMode, setChordMode] = useState(false);
  const [scaleLock, setScaleLock] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [isEditingProgression, setIsEditingProgression] = useState(false);
  const [progressionSteps, setProgressionSteps] = useState<ProgressionStep[]>(CHORD_PROGRESSIONS[0].steps);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [savedChords, setSavedChords] = useState<{name: string, keys: string[]}[]>([]);
  const [chordBuildMode, setChordBuildMode] = useState(false);
  const [chordSequence, setChordSequence] = useState<string[]>([]);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [customKeys, setCustomKeys] = useState<any>({
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
  });

  // Custom key functions
  const addCustomKey = () => {
    if (!newKeyName || !newKeyNotes) return;
    
    const notes = newKeyNotes.split(',').map(n => n.trim());
    if (notes.length !== 7) {
      toast({ title: "Error", description: "Please enter exactly 7 notes separated by commas" });
      return;
    }

    // Generate basic triads for the custom key
    const newKey = {
      name: newKeyName,
      notes: notes,
      chords: {
        'I': [notes[0], notes[2], notes[4]],
        'ii': [notes[1], notes[3], notes[5]],
        'iii': [notes[2], notes[4], notes[6]],
        'IV': [notes[3], notes[5], notes[0]],
        'V': [notes[4], notes[6], notes[1]],
        'vi': [notes[5], notes[0], notes[2]],
        'vii°': [notes[6], notes[1], notes[3]]
      }
    };

    setCustomKeys((prev: any) => ({
      ...prev,
      [newKeyName.charAt(0).toUpperCase()]: newKey
    }));

    setNewKeyName('');
    setNewKeyNotes('');
    setShowCustomKeyDialog(false);
    toast({ title: "Success", description: `Added custom key: ${newKeyName}` });
  };
  const [showCustomKeyDialog, setShowCustomKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyNotes, setNewKeyNotes] = useState('');
  const [audioInitialized, setAudioInitialized] = useState(false);

  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Instrument selection (defaults to piano for now)
  const selectedInstrument = 'piano';

  // Clamp octave to supported range [2, 7]
  const clampOct = (o: number) => Math.max(2, Math.min(7, o));

  // Helper functions for chord voicing and inversion
  const applyInversion = (chordNotes: string[], inversion: number): string[] => {
    if (inversion === 0) return chordNotes;
    const inverted = [...chordNotes];
    for (let i = 0; i < inversion; i++) {
      const note = inverted.shift();
      if (note) inverted.push(note);
    }
    return inverted;
  };

  const applyVoicing = (chordNotes: string[], voicing: 'close' | 'open', octave: number): { note: string, octave: number }[] => {
    if (voicing === 'close') {
      return chordNotes.map(note => ({ note, octave }));
    } else {
      // Open voicing: spread notes across octaves
      return chordNotes.map((note, index) => ({
        note,
        octave: octave + Math.floor(index / 2)
      }));
    }
  };

  // Add note using current paint settings (velocity/length)
  const addPaintNote = (keyIndex: number, step: number) => {
    const key = PIANO_KEYS[keyIndex];
    const newNote: Note = {
      id: `${key.note}${key.octave}-${step}-${Date.now()}`,
      note: key.note,
      octave: key.octave,
      step,
      velocity: paintVelocity,
      length: Math.max(1, Math.round(paintLength))
    };
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrack ? { ...track, notes: [...track.notes, newNote] } : track
    ));
  };

  const removeNoteAt = (keyIndex: number, step: number) => {
    const key = PIANO_KEYS[keyIndex];
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrack
        ? { ...track, notes: track.notes.filter(n => !(n.note === key.note && n.octave === key.octave && n.step === step)) }
        : track
    ));
  };

  const startResize = (e: React.MouseEvent, noteId: string, startStep: number, currentLength: number) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingNoteId(noteId);
    resizeStartXRef.current = e.clientX;
    originalLengthRef.current = currentLength;
  };

  const handleResizeMove = (clientX: number) => {
    if (!resizingNoteId) return;
    const stepWidthPx = STEP_WIDTH * zoom;
    const dx = clientX - resizeStartXRef.current;
    const deltaSteps = Math.round(dx / stepWidthPx);
    const minLen = 1;
    const newLen = Math.max(minLen, originalLengthRef.current + deltaSteps);
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrack
        ? {
            ...track,
            notes: track.notes.map(n => n.id === resizingNoteId ? { ...n, length: newLen } : n)
          }
        : track
    ));
  };

  useEffect(() => {
    const onUp = () => {
      setIsMouseDown(false);
      setResizingNoteId(null);
      paintedCellsRef.current.clear();
    };
    const onMove = (e: MouseEvent) => {
      if (resizingNoteId) {
        handleResizeMove(e.clientX);
      }
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
    };
  }, [resizingNoteId, zoom, selectedTrack]);

  const getChordWithVoicing = (step: ProgressionStep): { note: string, octave: number }[] => {
    const baseChord = customKeys[currentKey].chords[step.chordSymbol as keyof typeof customKeys[typeof currentKey]['chords']];
    if (!baseChord) return [];
    
    const invertedChord = applyInversion(baseChord, step.inversion);
    return applyVoicing(invertedChord, step.voicing, step.octave);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const initializeAudio = async () => {
    try {
      console.log('🎹 Initializing audio engine...');
      await realisticAudio.initialize();
      setAudioInitialized(true);
      console.log('🎹 Audio engine initialized successfully');
      toast({ title: "Audio Ready", description: "Piano keys are now active!" });
    } catch (error) {
      console.error('🎹 Failed to initialize audio:', error);
      toast({ title: "Audio Error", description: "Failed to initialize audio system" });
    }
  };

  const handlePlay = async () => {
    try {
      if (!audioInitialized) {
        await initializeAudio();
      }
      
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
                  realisticAudio.playNote(
                    note.note,
                    clampOct(note.octave),
                    0.25,
                    'piano',
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

  const addNote = async (keyIndex: number, step: number) => {
    const key = PIANO_KEYS[keyIndex];
    const newNote: Note = {
      id: `${key.note}${key.octave}-${step}-${Date.now()}`,
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
    try {
      console.log('🎹 Adding note and playing:', key.note, key.octave);
      await realisticAudio.initialize();
      realisticAudio.playNote(key.note, clampOct(key.octave), 0.25, 'piano', 0.8);
    } catch (error) {
      console.error('🎹 Error playing note on add:', error);
    }
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

  // Handle piano key clicks for chord building and audio playback
  const handleKeyClick = (key: PianoKey) => {
    if (!audioInitialized) {
      initializeAudio();
      return;
    }

    const keyId = `${key.note}${key.octave}`;

    if (chordBuildMode) {
      if (selectedKeys.includes(keyId)) {
        setSelectedKeys(prev => prev.filter(k => k !== keyId));
      } else if (selectedKeys.length < 3) {
        setSelectedKeys(prev => [...prev, keyId]);
      }
      realisticAudio.playNote(key.note, clampOct(key.octave), 1.0, selectedInstrument, 0.8);
    } else if (chordMode) {
      if (progressionSteps[currentChordIndex]) {
        const step = progressionSteps[currentChordIndex];
        const voicedChord = getChordWithVoicing(step);
        voicedChord.forEach((chordNote, index) => {
          setTimeout(() => {
            realisticAudio.playNote(chordNote.note, clampOct(chordNote.octave), 1.0, selectedInstrument, 0.8);
          }, index * 50);
        });
        setCurrentChordIndex((prev) => (prev + 1) % progressionSteps.length);
      }
    } else {
      realisticAudio.playNote(key.note, clampOct(key.octave), 1.0, selectedInstrument, 0.8);
    }
  };

  // Chord progression functions
  const playChord = (chordNotes: string[], octave: number = 4) => {
    chordNotes.forEach((note, index) => {
      setTimeout(() => {
        realisticAudio.playNote(note, clampOct(octave), 1.0, 'piano', 0.6);
      }, index * 50); // Slight stagger for chord effect
    });
  };

  const playProgressionStep = (step: ProgressionStep) => {
    const voicedChord = getChordWithVoicing(step);
    voicedChord.forEach((chordNote, index) => {
      setTimeout(() => {
        realisticAudio.playNote(chordNote.note, clampOct(chordNote.octave), 1.0, 'piano', 0.6);
      }, index * 50);
    });
  };

  const updateProgressionStep = (stepId: string, updates: Partial<ProgressionStep>) => {
    setProgressionSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const addProgressionStep = (chordSymbol: string = 'I') => {
    const newStep = createProgressionStep(chordSymbol);
    setProgressionSteps(prev => [...prev, newStep]);
  };

  const removeProgressionStep = (stepId: string) => {
    setProgressionSteps(prev => prev.filter(step => step.id !== stepId));
  };

  const reorderProgressionSteps = (fromIndex: number, toIndex: number) => {
    setProgressionSteps(prev => {
      const newSteps = [...prev];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      return newSteps;
    });
  };

  const addChordToGrid = (gridStep: number) => {
    if (chordSequence.length > 0) {
      // Use chord from custom sequence
      const chordToUse = chordSequence[sequenceIndex % chordSequence.length];
      const chordNotes = customKeys[currentKey].chords[chordToUse as keyof typeof customKeys[typeof currentKey]['chords']];
      setSequenceIndex((prev) => (prev + 1) % chordSequence.length);
      
      chordNotes.forEach((noteName: string, noteIndex: number) => {
        const keyIndex = PIANO_KEYS.findIndex(key => key.note === noteName && key.octave === 4);
        if (keyIndex !== -1) {
          addNote(keyIndex, gridStep + noteIndex * 0.1);
        }
      });
    } else {
      // Use chord from progression steps
      const progressionStep = progressionSteps[currentChordIndex];
      if (progressionStep) {
        const voicedChord = getChordWithVoicing(progressionStep);
        voicedChord.forEach((chordNote, noteIndex) => {
          const keyIndex = PIANO_KEYS.findIndex(key => key.note === chordNote.note && key.octave === chordNote.octave);
          if (keyIndex !== -1) {
            addNote(keyIndex, gridStep + noteIndex * 0.1);
          }
        });
        setCurrentChordIndex(prev => (prev + 1) % progressionSteps.length);
      }
    }
  };

  const generateProgression = () => {
    let currentStep = 0;
    
    progressionSteps.forEach((step, stepIndex) => {
      const voicedChord = getChordWithVoicing(step);
      
      voicedChord.forEach((chordNote, noteIndex) => {
        const newNote: Note = {
          id: `${chordNote.note}-${currentStep}-${Date.now()}-${noteIndex}`,
          note: chordNote.note,
          octave: chordNote.octave,
          step: currentStep + noteIndex * 0.1, // Slight offset for chord notes
          velocity: 100,
          length: step.lengthSteps
        };
        
        setTracks(prev => prev.map((track, trackIndex) => 
          trackIndex === selectedTrack 
            ? { ...track, notes: [...track.notes, newNote] }
            : track
        ));
      });
      
      currentStep += step.lengthSteps;
    });
  };

  return (
    <div className="h-full w-full bg-gray-900 text-white">
      <Card className="h-full bg-gray-800 border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xl">🎹 Vertical Piano Roll</span>
              <div className="flex items-center space-x-4">
                {!audioInitialized && (
                  <Button
                    onClick={initializeAudio}
                    className="bg-blue-600 hover:bg-blue-500 animate-pulse"
                  >
                    🎵 Start Audio
                  </Button>
                )}
                <Button
                  onClick={handlePlay}
                  className={`${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                  disabled={!audioInitialized}
                >
                  {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  {isPlaying ? 'Stop' : 'Play'}
                </Button>
                <Button onClick={handleStop} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
                <Button onClick={clearAll} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                  <RotateCcw className="h-4 w-4" />
                  Clear
                </Button>
                {/* Tool selector */}
                <select
                  value={currentTool}
                  onChange={(e) => setCurrentTool(e.target.value as 'paint' | 'erase' | 'select')}
                  className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                >
                  <option value="paint">🖌️ Paint</option>
                  <option value="erase">🧽 Erase</option>
                  <option value="select">🔲 Select</option>
                </select>
                {/* Default length/velocity for painting */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">Len:</span>
                  <Slider value={[paintLength]} onValueChange={(v) => setPaintLength(v[0])} min={1} max={16} step={1} className="w-24" />
                  <span className="text-sm w-6 text-center">{paintLength}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Vel:</span>
                  <Slider value={[paintVelocity]} onValueChange={(v) => setPaintVelocity(v[0])} min={1} max={127} step={1} className="w-24" />
                  <span className="text-sm w-8 text-center">{paintVelocity}</span>
                </div>
                {/* Snap and Swing (basic placeholders) */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">Snap:</span>
                  <select value={snapDivision} onChange={(e) => setSnapDivision(parseInt(e.target.value) as 4 | 8 | 16 | 32)} className="bg-gray-700 text-white px-2 py-1 rounded text-sm">
                    <option value={4}>1/4</option>
                    <option value={8}>1/8</option>
                    <option value={16}>1/16</option>
                    <option value={32}>1/32</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Swing:</span>
                  <Slider value={[swing]} onValueChange={(v) => setSwing(v[0])} min={0} max={100} step={1} className="w-24" />
                  <span className="text-sm w-8 text-center">{swing}%</span>
                </div>
                <Button 
                  onClick={() => setChordMode(!chordMode)} 
                  variant={chordMode ? "default" : "outline"}
                  className={chordMode ? "bg-purple-600 hover:bg-purple-500" : "bg-gray-700 hover:bg-gray-600"}
                >
                  🎵 Chord Mode
                </Button>
                <Button onClick={generateProgression} variant="outline" className="bg-green-700 hover:bg-green-600">
                  Apply to Grid
                </Button>
                <Button 
                  onClick={() => {
                    // Preview entire progression
                    let delay = 0;
                    progressionSteps.forEach((step) => {
                      setTimeout(() => playProgressionStep(step), delay);
                      delay += 800; // 800ms between chords
                    });
                  }}
                  variant="outline" 
                  className="bg-blue-700 hover:bg-blue-600"
                >
                  Preview All
                </Button>
                <Button 
                  onClick={() => setShowCustomKeyDialog(true)} 
                  variant="outline" 
                  className="bg-blue-700 hover:bg-blue-600"
                >
                  + Add Custom Key
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
                  {Object.keys(customKeys).map(key => (
                    <option key={key} value={key}>{customKeys[key].name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Progression:</span>
                <select 
                  value={selectedProgression.id} 
                  onChange={(e) => {
                    const prog = CHORD_PROGRESSIONS.find(p => p.id === e.target.value);
                    if (prog) {
                      setSelectedProgression(prog);
                      setProgressionSteps([...prog.steps]);
                      setCurrentChordIndex(0);
                    }
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
                    onClick={() => handleKeyClick(key)}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="text-xs font-bold">{key.note}{key.octave}</span>
                      {selectedKeys.includes(`${key.note}${key.octave}`) && (
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mt-1"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step Grid */}
            <div className="flex-1 overflow-auto" ref={el => (gridRef.current = el)}>
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
                  {PIANO_KEYS.map((key, keyIndex) => {
                    const rowNotes = tracks[selectedTrack]?.notes.filter(n => n.note === key.note && n.octave === key.octave) || [];
                    const stepWidthPx = STEP_WIDTH * zoom;
                    return (
                      <div key={key.key} className="border-b border-gray-700 relative" style={{ height: `${KEY_HEIGHT}px` }}>
                        {/* Grid cells for interaction */}
                        <div className="flex absolute inset-0">
                          {Array.from({ length: STEPS }, (_, step) => {
                            const keyCell = `${keyIndex}-${step}`;
                            const hasNote = rowNotes.some(nn => nn.step === step);
                            const cellNote = hasNote ? rowNotes.find(nn => nn.step === step) : undefined;
                            return (
                              <div
                                key={step}
                                className={`
                                  border-r border-gray-700 cursor-pointer transition-colors relative
                                  ${hasNote ? 'bg-blue-500/40 hover:bg-blue-400/50' : 'hover:bg-gray-700/60'}
                                  ${step % 4 === 0 ? 'border-r-gray-500' : ''}
                                  ${currentStep === step ? 'bg-red-900 bg-opacity-40' : ''}
                                `}
                                style={{ width: `${stepWidthPx}px` }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setIsMouseDown(true);
                                  paintedCellsRef.current.clear();
                                  if (e.button === 2 || currentTool === 'erase' || hasNote) {
                                    if (cellNote) removeNote(cellNote.id);
                                  } else if (!chordMode) {
                                    addPaintNote(keyIndex, step);
                                    paintedCellsRef.current.add(keyCell);
                                  } else {
                                    addChordToGrid(step);
                                  }
                                }}
                                onMouseEnter={() => {
                                  if (!isMouseDown) return;
                                  const already = paintedCellsRef.current.has(keyCell);
                                  if (currentTool === 'erase') {
                                    if (cellNote) removeNote(cellNote.id);
                                  } else if (!already && !chordMode) {
                                    addPaintNote(keyIndex, step);
                                    paintedCellsRef.current.add(keyCell);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  if (cellNote) removeNote(cellNote.id);
                                }}
                              />
                            );
                          })}
                        </div>

                        {/* Note blocks overlay with resize handles */}
                        {rowNotes
                          .filter(n => n.length >= 1)
                          .map(n => (
                            <div
                              key={n.id}
                              className="absolute bg-blue-500 rounded-sm flex items-center"
                              style={{
                                left: `${n.step * stepWidthPx}px`,
                                width: `${Math.max(stepWidthPx * n.length - 2, stepWidthPx * 0.5)}px`,
                                height: `${KEY_HEIGHT - 2}px`,
                                top: '1px'
                              }}
                            >
                              <div className="w-1 h-3 bg-white/80 rounded-sm ml-auto mr-0.5 cursor-ew-resize"
                                   onMouseDown={(e) => startResize(e, n.id, n.step, n.length)}
                              />
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Velocity Lane */}
          <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Velocity Lane</span>
              <span className="text-xs text-gray-400">Drag bars to set note velocities at each step</span>
            </div>
            <div className="flex items-end gap-0.5" style={{ height: '60px' }}>
              {Array.from({ length: STEPS }, (_, step) => {
                const notesAtStep = tracks[selectedTrack]?.notes.filter(n => n.step === step) || [];
                const avgVel = notesAtStep.length > 0 ? Math.round(notesAtStep.reduce((acc, n) => acc + n.velocity, 0) / notesAtStep.length) : 0;
                const barHeight = Math.round((avgVel / 127) * 56);
                return (
                  <div key={step} className="relative flex items-end" style={{ width: `${STEP_WIDTH * zoom}px` }}
                    onMouseDown={(e) => {
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const relY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
                      const val = Math.max(1, Math.min(127, Math.round((1 - relY / rect.height) * 127)));
                      setTracks(prev => prev.map((track, idx) =>
                        idx === selectedTrack
                          ? { ...track, notes: track.notes.map(n => n.step === step ? { ...n, velocity: val } : n) }
                          : track
                      ));
                      setIsMouseDown(true);
                    }}
                    onMouseEnter={(e) => {
                      if (!isMouseDown) return;
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const relY = Math.min(Math.max((e as any).clientY - rect.top, 0), rect.height);
                      const val = Math.max(1, Math.min(127, Math.round((1 - relY / rect.height) * 127)));
                      setTracks(prev => prev.map((track, idx) =>
                        idx === selectedTrack
                          ? { ...track, notes: track.notes.map(n => n.step === step ? { ...n, velocity: val } : n) }
                          : track
                      ));
                    }}
                    onMouseUp={() => setIsMouseDown(false)}
                  >
                    <div className={`mx-0.5 w-full ${avgVel > 0 ? 'bg-green-500' : 'bg-gray-600'}`} style={{ height: `${barHeight}px` }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chord Progression Panel */}
          <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">🎼 Chord Progression</span>
                <span className="text-sm text-gray-400">
                  Key: {customKeys[currentKey].name}
                </span>
                <span className="text-sm text-gray-400">
                  Current: {progressionSteps[currentChordIndex]?.chordSymbol || 'N/A'} ({currentChordIndex + 1}/{progressionSteps.length})
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

            {/* Chord Progression Editor */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Progression Editor ({selectedProgression.name}):</span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsEditingProgression(!isEditingProgression)}
                    size="sm"
                    variant={isEditingProgression ? "default" : "outline"}
                    className={isEditingProgression ? "bg-purple-600 hover:bg-purple-700" : "bg-gray-700 hover:bg-gray-600"}
                  >
                    {isEditingProgression ? 'Done' : 'Edit'}
                  </Button>
                  <Button
                    onClick={() => addProgressionStep()}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    + Add
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {progressionSteps.map((step, index) => {
                  const voicedChord = getChordWithVoicing(step);
                  return (
                    <div
                      key={step.id}
                      className={`relative p-2 rounded border transition-colors ${
                        currentChordIndex === index 
                          ? 'bg-green-600 border-green-500 text-white' 
                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {/* Chord Info */}
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => {
                            setCurrentChordIndex(index);
                            playProgressionStep(step);
                          }}
                          className="font-medium text-sm hover:underline"
                        >
                          {step.chordSymbol}
                        </button>
                        {isEditingProgression && (
                          <button
                            onClick={() => removeProgressionStep(step.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      
                      {/* Chord Notes */}
                      <div className="text-xs opacity-75 mb-1">
                        {voicedChord.map(c => c.note).join('-')}
                      </div>
                      
                      {/* Edit Controls */}
                      {isEditingProgression && (
                        <div className="space-y-1">
                          {/* Duration */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs">Len:</span>
                            <input
                              type="number"
                              value={step.lengthSteps}
                              onChange={(e) => updateProgressionStep(step.id, { lengthSteps: parseInt(e.target.value) || 8 })}
                              className="w-12 px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded"
                              min="1"
                              max="32"
                            />
                          </div>
                          
                          {/* Octave */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs">Oct:</span>
                            <select
                              value={step.octave}
                              onChange={(e) => updateProgressionStep(step.id, { octave: parseInt(e.target.value) })}
                              className="px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded"
                            >
                              {[2, 3, 4, 5, 6].map(oct => (
                                <option key={oct} value={oct}>{oct}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Inversion */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs">Inv:</span>
                            <select
                              value={step.inversion}
                              onChange={(e) => updateProgressionStep(step.id, { inversion: parseInt(e.target.value) as 0 | 1 | 2 })}
                              className="px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded"
                            >
                              <option value={0}>Root</option>
                              <option value={1}>1st</option>
                              <option value={2}>2nd</option>
                            </select>
                          </div>
                          
                          {/* Voicing */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs">Voice:</span>
                            <select
                              value={step.voicing}
                              onChange={(e) => updateProgressionStep(step.id, { voicing: e.target.value as 'close' | 'open' })}
                              className="px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded"
                            >
                              <option value="close">Close</option>
                              <option value="open">Open</option>
                            </select>
                          </div>
                        </div>
                      )}
                      
                      {!isEditingProgression && (
                        <div className="text-xs opacity-50">{step.lengthSteps}st • Oct{step.octave}</div>
                      )}
                    </div>
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
        
        {/* Custom Key Dialog */}
        {showCustomKeyDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-600 w-96">
            <h3 className="text-lg font-bold mb-4">Add Custom Key</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Key Name:</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., D Minor, A Harmonic"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">7 Notes (comma separated):</label>
                <input
                  type="text"
                  value={newKeyNotes}
                  onChange={(e) => setNewKeyNotes(e.target.value)}
                  placeholder="e.g., D, E, F, G, A, Bb, C"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                />
                <p className="text-xs text-gray-400 mt-1">Enter exactly 7 notes for the scale</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={addCustomKey} className="bg-blue-600 hover:bg-blue-500">
                Add Key
              </Button>
              <Button 
                onClick={() => setShowCustomKeyDialog(false)} 
                variant="outline"
                className="bg-gray-700 hover:bg-gray-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
        )}

        {/* Chord Builder Panel */}
        <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Chord Builder</h3>
            <Button
              onClick={() => setChordBuildMode(!chordBuildMode)}
              className={chordBuildMode ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-600 hover:bg-gray-700"}
            >
              {chordBuildMode ? "Exit Build Mode" : "Build Chord"}
            </Button>
          </div>

          {chordBuildMode && (
            <div className="space-y-3">
              <div className="text-sm text-gray-300">
                Click up to 3 piano keys to build a chord. Selected: {selectedKeys.length}/3
              </div>
              <div className="flex gap-2">
                {selectedKeys.map((key, index) => (
                  <span key={index} className="px-2 py-1 bg-yellow-600 text-white rounded text-sm">
                    {key}
                  </span>
                ))}
              </div>
              {selectedKeys.length === 3 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Chord name (e.g., C Major)"
                    className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const name = (e.target as HTMLInputElement).value || `Chord ${savedChords.length + 1}`;
                        setSavedChords(prev => [...prev, { name, keys: [...selectedKeys] }]);
                        setSelectedKeys([]);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      const name = `Chord ${savedChords.length + 1}`;
                      setSavedChords(prev => [...prev, { name, keys: [...selectedKeys] }]);
                      setSelectedKeys([]);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Save Chord
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Saved Chords */}
          {savedChords.length > 0 && (
            <div className="mt-4">
              <h4 className="text-md font-medium text-white mb-2">Saved Chords</h4>
              <div className="grid grid-cols-2 gap-2">
                {savedChords.map((chord, index) => (
                  <div key={index} className="p-2 bg-gray-700 rounded border border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">{chord.name}</span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => {
                            // Play the chord
                            chord.keys.forEach((key, i) => {
                              const [note, octave] = [key.slice(0, -1), key.slice(-1)];
                              setTimeout(() => {
                                realisticAudio.playNote(note, clampOct(Number(octave)), 1.0, selectedInstrument, 0.8);
                              }, i * 50);
                            });
                          }}
                          className="bg-blue-600 hover:bg-blue-700 px-2 py-1"
                        >
                          Play
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setChordSequence(prev => [...prev, chord.name]);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 px-2 py-1"
                        >
                          +Seq
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {chord.keys.join(' - ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chord Sequence */}
          {chordSequence.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-md font-medium text-white">Chord Sequence</h4>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      // Play the entire sequence
                      chordSequence.forEach((chordName, seqIndex) => {
                        const chord = savedChords.find(c => c.name === chordName);
                        if (chord) {
                          setTimeout(() => {
                            chord.keys.forEach((key, keyIndex) => {
                              const [note, octave] = [key.slice(0, -1), key.slice(-1)];
                              setTimeout(() => {
                                realisticAudio.playNote(note, clampOct(Number(octave)), 1.0, selectedInstrument, 0.8);
                              }, keyIndex * 50);
                            });
                          }, seqIndex * 1000);
                        }
                      });
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Play Sequence
                  </Button>
                  <Button
                    onClick={() => setChordSequence([])}
                    variant="outline"
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {chordSequence.map((chordName, index) => (
                  <div key={index} className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded">
                    <span>{index + 1}. {chordName}</span>
                    <button
                      onClick={() => setChordSequence(prev => prev.filter((_, i) => i !== index))}
                      className="ml-1 text-purple-200 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
