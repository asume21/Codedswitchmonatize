import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, Square, Trash2 } from 'lucide-react';

// Constants
import type { Note, ChordProgression } from './types/pianoRollTypes';
import { DEFAULT_customKeys } from './types/pianoRollTypes';
import { useToast } from '@/hooks/use-toast';
import { useAudio } from '@/hooks/use-audio';
import { cn } from '@/lib/utils';
import { ChordProgressionDisplay } from './ChordProgressionDisplay';

const STEPS = 16;
const STEP_WIDTH = 30; // Reduced from 40 for more compact view
const KEY_HEIGHT = 18; // Reduced from 24 for more compact view
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
const HIGHEST_MIDI = 84; // C7 - More practical range
const LOWEST_MIDI = 36; // C2 - More practical range  
const MIDI_RANGE = Array.from({ length: HIGHEST_MIDI - LOWEST_MIDI + 1 }, (_, idx) => HIGHEST_MIDI - idx);
const MIDI_TO_ROW_INDEX: Record<number, number> = MIDI_RANGE.reduce((acc, pitch, idx) => {
  acc[pitch] = idx;
  return acc;
}, {} as Record<number, number>);

// Chord progressions
const CHORD_PROGRESSIONS: ChordProgression[] = [
  { id: 'classic', name: 'Classic Pop (I-V-vi-IV)', chords: ['I', 'V', 'vi', 'IV'], key: 'C' },
  { id: 'jazz', name: 'Jazz ii-V-I', chords: ['ii', 'V', 'I'], key: 'C' },
  { id: 'pop', name: 'Alt Pop (vi-IV-I-V)', chords: ['vi', 'IV', 'I', 'V'], key: 'C' },
  { id: 'blues', name: 'Blues (I-IV-V)', chords: ['I', 'IV', 'V'], key: 'C' },
  { id: 'simple', name: 'Simple (I-IV-I-V)', chords: ['I', 'IV', 'I', 'V'], key: 'C' },
];

interface Track {
  id: string;
  name: string;
  notes: Note[];
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  instrument?: string;
}

interface VerticalPianoRollProps {
  tracks: Track[];
  notes?: Note[];
  onNotesChange?: (notes: Note[]) => void;
  selectedTrack?: string; // Changed to string to match parent
  isPlaying?: boolean;
  onPlayNote?: (note: string, octave: number, duration: number, instrument?: string) => void;
  noteDuration?: number;
  className?: string;
  showTransportControls?: boolean;
  onBpmChange?: (bpm: number) => void;
  onMetronomeToggle?: (enabled: boolean) => void;
  onCountInToggle?: (enabled: boolean) => void;
  onChordModeToggle?: (enabled: boolean) => void;
  onStartPlayback?: () => void;
  onStopPlayback?: () => void;
}




// Types
// Using imported Note type.



const VerticalPianoRoll: React.FC<VerticalPianoRollProps> = ({
  tracks,
  notes: externalNotes = [],
  onNotesChange = () => {},
  selectedTrack = '1',
  isPlaying: externalIsPlaying = false,
  onPlayNote = () => {},
  noteDuration = 0.5,
  className = '',
  showTransportControls = true,
  onBpmChange = () => {},
  onMetronomeToggle = () => {},
  onCountInToggle = () => {},
  onChordModeToggle = () => {},
  onStartPlayback = () => {},
  onStopPlayback = () => {},
}) => {

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [countInEnabled, setCountInEnabled] = useState(true);
  const [chordMode, setChordMode] = useState(false);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentKey, setCurrentKey] = useState('C');
  const [selectedProgression, setSelectedProgression] = useState<ChordProgression>(CHORD_PROGRESSIONS[0]);
  const [customKeys, setCustomKeys] = useState(DEFAULT_customKeys);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartLength, setResizeStartLength] = useState(0);

  // Refs
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { playNote: audioPlayNote, initialize, isInitialized } = useAudio();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const gridContentRef = useRef<HTMLDivElement>(null);

  // Audio engine
  const audioEngine = useRef({
    playNote: async (note: string, octave: number, duration: number, instrument = 'piano') => {
      if (!isInitialized) {
        await initialize();
      }
      if (onPlayNote) {
        onPlayNote(note, octave, duration, instrument);
      } else {
        // @ts-ignore existing audio hook signature includes instrument
        audioPlayNote(note, octave, duration, instrument, 0.8);
      }
    },
    stopAllNotes: () => {
      console.log('Stopping all notes');
    },
  });

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
      // Stop any playing notes
      audioEngine.current.stopAllNotes();
    };
  }, []);

  // Sync with external isPlaying prop
  useEffect(() => {
    if (externalIsPlaying !== isPlaying) {
      if (externalIsPlaying) {
        startPlayback();
      } else {
        stopPlayback();
      }
    }
  }, [externalIsPlaying]);
  
  // Playback functions
  const getSecondsPerStep = useCallback(() => (60 / bpm) / 4, [bpm]);

  const playStep = useCallback((step: number) => {
    const currentTrack = tracks.find(t => t.id === String(selectedTrack));
    if (!currentTrack) return;

    const trackNotes = currentTrack.notes ?? [];

    trackNotes
      .filter(note => note.step === step)
      .forEach((note) => {
        const noteName = note.note;
        const octave = note.octave;
        const instrument = currentTrack.instrument ?? 'piano';
        const durationSeconds = (note.length ?? 1) * getSecondsPerStep();
        audioEngine.current.playNote(noteName, octave, durationSeconds, instrument);
      });

    if (metronomeEnabled && step % 4 === 0) {
      audioEngine.current.playNote('C', 6, getSecondsPerStep() / 2, currentTrack.instrument ?? 'piano');
    }
  }, [tracks, selectedTrack, getSecondsPerStep, metronomeEnabled]);

  const activeTrack = tracks.find(t => t.id === String(selectedTrack));
  const activeNotes = activeTrack?.notes ?? [];
  const selectedNote = activeNotes.find(note => note.id === selectedNoteId) ?? null;

  const startPlayback = useCallback(() => {
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
    }
    setIsPlaying(true);
    setCurrentStep(0);

    const stepDuration = getSecondsPerStep() * 1000;

    playStep(0);

    playbackInterval.current = setInterval(() => {
      setCurrentStep((prevStep) => {
        const nextStep = (prevStep + 1) % STEPS;
        playStep(nextStep);
        return nextStep;
      });
    }, stepDuration);
    if (onStartPlayback) {
      onStartPlayback();
    }
  }, [bpm, getSecondsPerStep, playStep, onStartPlayback]);

  const stopPlayback = useCallback(() => {
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
      playbackInterval.current = null;
    }

    setIsPlaying(false);
    setCurrentStep(0);
    audioEngine.current.stopAllNotes();
    if (onStopPlayback) {
      onStopPlayback();
    }
  }, [onStopPlayback]);

  // Event handlers
  const handlePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const handleStop = () => {
    stopPlayback();
  };

  const addNoteAt = (step: number, pitch: number) => {
    if (!activeTrack) return;

    const octave = Math.floor(pitch / 12) - 1;
    const noteName = NOTE_NAMES[pitch % 12];

    const newNote: Note = {
      id: uuidv4(),
      step,
      note: noteName,
      octave,
      velocity: 100,
      length: 1,
    };

    const updatedNotes = [...activeNotes, newNote];
    onNotesChange(updatedNotes);
    setSelectedNoteId(newNote.id);

    const instrument = activeTrack.instrument ?? 'piano';
    audioEngine.current.playNote(noteName, octave, getSecondsPerStep(), instrument);
  };

  const handleGridMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTrack || !gridContentRef.current || !gridWrapperRef.current) return;

    const rect = gridContentRef.current.getBoundingClientRect();
    const scrollLeft = gridWrapperRef.current.scrollLeft;
    const scrollTop = gridWrapperRef.current.scrollTop;

    const offsetX = event.clientX - rect.left + scrollLeft;
    const offsetY = event.clientY - rect.top + scrollTop;

    const step = Math.min(Math.max(Math.floor(offsetX / STEP_WIDTH), 0), STEPS - 1);
    const rowIndex = Math.min(Math.max(Math.floor(offsetY / KEY_HEIGHT), 0), MIDI_RANGE.length - 1);
    const pitch = MIDI_RANGE[rowIndex];

    const octave = Math.floor(pitch / 12) - 1;
    const noteName = NOTE_NAMES[pitch % 12];

    const existing = activeNotes.find(note => {
      if (note.note !== noteName || note.octave !== octave) return false;
      const length = note.length ?? 1;
      return step >= note.step && step < note.step + length;
    });

    if (existing) {
      setSelectedNoteId(existing.id);
    } else {
      addNoteAt(step, pitch);
    }
  };

  const handleNoteMouseDown = (event: React.MouseEvent<HTMLDivElement>, note: Note) => {
    event.stopPropagation();
    setSelectedNoteId(note.id);
    
    // Play note every time user clicks it
    if (!activeTrack) return;
    const instrument = activeTrack.instrument ?? 'piano';
    const duration = getSecondsPerStep() * (note.length ?? 1);
    audioEngine.current.playNote(note.note, note.octave, duration, instrument);
  };

  const handleNoteRightClick = (event: React.MouseEvent<HTMLDivElement>, note: Note) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Delete note on right-click
    const updatedNotes = activeNotes.filter(n => n.id !== note.id);
    onNotesChange(updatedNotes);
    if (selectedNoteId === note.id) {
      setSelectedNoteId(null);
    }
    toast({ 
      title: 'Note Deleted', 
      description: `${note.note}${note.octave} removed` 
    });
  };

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>, note: Note) => {
    event.stopPropagation();
    event.preventDefault();
    setResizingNoteId(note.id);
    setResizeStartX(event.clientX);
    setResizeStartLength(note.length ?? 1);
  };

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!resizingNoteId || !gridWrapperRef.current) return;

    const deltaX = event.clientX - resizeStartX;
    const deltaSteps = Math.round(deltaX / STEP_WIDTH);
    const newLength = Math.max(1, Math.min(resizeStartLength + deltaSteps, STEPS));

    const updatedNotes = activeNotes.map(note =>
      note.id === resizingNoteId 
        ? { ...note, length: Math.min(newLength, STEPS - note.step) }
        : note
    );
    onNotesChange(updatedNotes);
  }, [resizingNoteId, resizeStartX, resizeStartLength, activeNotes, onNotesChange]);

  const handleMouseUp = useCallback(() => {
    if (resizingNoteId) {
      setResizingNoteId(null);
      // Play the note to hear the new length
      const note = activeNotes.find(n => n.id === resizingNoteId);
      if (note && activeTrack) {
        const instrument = activeTrack.instrument ?? 'piano';
        const duration = getSecondsPerStep() * (note.length ?? 1);
        audioEngine.current.playNote(note.note, note.octave, duration, instrument);
      }
    }
  }, [resizingNoteId, activeNotes, activeTrack]);

  // Add global mouse listeners for resize
  useEffect(() => {
    if (resizingNoteId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingNoteId, handleMouseMove, handleMouseUp]);

  const handleNoteLengthChange = (length: number) => {
    if (!selectedNote || !activeTrack) return;

    const clampedLength = Math.max(1, Math.min(length, STEPS - selectedNote.step));
    const updatedNotes = activeNotes.map(note =>
      note.id === selectedNote.id ? { ...note, length: clampedLength } : note
    );
    onNotesChange(updatedNotes);
  };

  const playSelectedNote = () => {
    if (!selectedNote || !activeTrack) return;
    
    const instrument = activeTrack.instrument ?? 'piano';
    const duration = getSecondsPerStep() * (selectedNote.length ?? 1);
    audioEngine.current.playNote(
      selectedNote.note, 
      selectedNote.octave, 
      duration, 
      instrument
    );
    
    toast({
      title: 'Preview',
      description: `Playing ${selectedNote.note}${selectedNote.octave} for ${selectedNote.length} step${selectedNote.length === 1 ? '' : 's'}`,
      duration: 1500,
    });
  };

  const handleDeleteSelectedNote = () => {
    if (!selectedNote) return;
    const updatedNotes = activeNotes.filter(note => note.id !== selectedNote.id);
    onNotesChange(updatedNotes);
    setSelectedNoteId(null);
  };

  const clearAll = () => {
    onNotesChange([]);
    setSelectedNoteId(null);
    toast({ title: 'Cleared', description: 'All notes have been cleared.' });
  };

  const handleChordClick = (chordSymbol: string, chordNotes: string[]) => {
    if (!activeTrack) return;

    // Place chord notes at the current step
    const octaveStart = 4; // Start at middle C octave
    const newNotes: Note[] = chordNotes.map((noteName, index) => ({
      id: uuidv4(),
      step: currentStep,
      note: noteName.replace(/[0-9]/g, ''), // Remove any octave numbers from note name
      octave: octaveStart,
      velocity: 100,
      length: 4, // Full beat
    }));

    const updatedNotes = [...activeNotes, ...newNotes];
    onNotesChange(updatedNotes);

    // Play the chord
    const instrument = activeTrack.instrument ?? 'piano';
    newNotes.forEach((note, i) => {
      setTimeout(() => {
        audioEngine.current.playNote(note.note, note.octave, getSecondsPerStep() * 4, instrument);
      }, i * 50); // Slight delay between notes for better sound
    });

    // Move to next step
    setCurrentStep((prev) => Math.min(prev + 4, STEPS - 1));
    
    toast({ 
      title: 'Chord Added', 
      description: `${chordSymbol} chord placed at step ${currentStep + 1}` 
    });
  };

  const getNotePosition = (note: Note) => {
    const midiValue = (note.octave + 1) * 12 + NOTE_NAMES.indexOf(note.note);
    const rowIndex = MIDI_TO_ROW_INDEX[midiValue];
    if (rowIndex === undefined) return null;

    return {
      top: rowIndex * KEY_HEIGHT,
      height: KEY_HEIGHT,
      left: note.step * STEP_WIDTH,
      width: Math.max(1, note.length ?? 1) * STEP_WIDTH,
    };
  };

  const renderPianoRoll = () => {
    return (
      <div className="flex flex-col h-full">
        {/* Header with transport controls */}
        <div className="flex items-center justify-between p-3 bg-slate-900 text-white border-b border-slate-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Piano Roll</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlay}
              className="w-20 justify-center bg-slate-800 text-white border-slate-600 hover:bg-slate-700 hover:text-white"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="w-20 justify-center bg-slate-800 text-white border-slate-600 hover:bg-slate-700 hover:text-white"
            >
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
            <div className="flex items-center space-x-2 px-2">
              <span className="text-sm text-slate-200">BPM:</span>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                min={40}
                max={240}
                className="w-16 px-2 py-1 text-sm border rounded bg-slate-800 text-white border-slate-600 placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>

        {selectedNote && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-gray-800">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Selected Note: {selectedNote.note}{selectedNote.octave}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Step {selectedNote.step + 1} · Right-click any note to delete
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Length:</span>
                <span className="text-sm font-bold text-gray-800 dark:text-white min-w-[2rem]">
                  {selectedNote.length ?? 1}
                </span>
                <Slider
                  className="w-32"
                  value={[selectedNote.length ?? 1]}
                  onValueChange={([value]) => handleNoteLengthChange(value)}
                  min={1}
                  max={Math.max(1, STEPS - selectedNote.step)}
                  step={1}
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={playSelectedNote}
                className="bg-green-600 hover:bg-green-700 text-white border-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Play
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDeleteSelectedNote}
                className="bg-red-600 hover:bg-red-700 text-white border-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Piano roll grid */}
        <div className="flex-1 relative bg-gray-50 dark:bg-slate-950">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gray-100 dark:bg-slate-900 border-r border-gray-300/60 dark:border-gray-700/80 z-10">
            {MIDI_RANGE.map((pitch, i) => {
              const octave = Math.floor(pitch / 12) - 1;
              const noteName = NOTE_NAMES[pitch % 12];
              const isBlackKey = ['C#', 'D#', 'F#', 'G#', 'A#'].includes(noteName);

              return (
                <div
                  key={pitch}
                  className={`flex items-center px-1 text-xs font-medium border-b ${
                    isBlackKey ? 'bg-black text-white dark:bg-black' : 'bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100'
                  } ${highlightedRow === i ? 'bg-blue-100 dark:bg-blue-900/70' : ''}`}
                  style={{ height: KEY_HEIGHT }}
                  onMouseEnter={() => setHighlightedRow(i)}
                  onMouseLeave={() => setHighlightedRow(null)}
                >
                  {noteName}{octave}
                </div>
              );
            })}
          </div>

          <div className="ml-16 h-full overflow-auto" ref={gridWrapperRef}>
            <div
              ref={gridContentRef}
              className="relative"
              style={{ width: STEPS * STEP_WIDTH, height: MIDI_RANGE.length * KEY_HEIGHT }}
              onMouseDown={handleGridMouseDown}
            >
              {MIDI_RANGE.map((pitch, rowIndex) => {
                const isBlackKey = ['C#', 'D#', 'F#', 'G#', 'A#'].includes(NOTE_NAMES[pitch % 12]);
                return (
                  <div
                    key={`row-${pitch}`}
                    className={`absolute inset-x-0 border-b ${
                      isBlackKey ? 'bg-gray-200/70 dark:bg-gray-800/80' : 'bg-white/50 dark:bg-slate-950/60'
                    } border-gray-200 dark:border-gray-800`}
                    style={{
                      top: rowIndex * KEY_HEIGHT,
                      height: KEY_HEIGHT,
                      pointerEvents: 'none',
                    }}
                  />
                );
              })}

              {Array.from({ length: STEPS + 1 }).map((_, index) => (
                <div
                  key={`step-line-${index}`}
                  className={`absolute top-0 bottom-0 ${
                    index % 4 === 0 ? 'border-l-2 border-blue-200/60 dark:border-blue-900/40' : 'border-l border-gray-300/50 dark:border-gray-700/40'
                  }`}
                  style={{ left: index * STEP_WIDTH }}
                />
              ))}

              <div
                className="absolute top-0 bottom-0 bg-blue-400/20 pointer-events-none"
                style={{ left: currentStep * STEP_WIDTH, width: STEP_WIDTH }}
              />

              {activeNotes.map((note) => {
                const position = getNotePosition(note);
                if (!position) return null;
                const isSelected = selectedNoteId === note.id;
                return (
                  <div
                    key={note.id}
                    className={`absolute rounded-sm border ${
                      isSelected ? 'bg-blue-500/80 border-blue-200 shadow-lg' : 'bg-blue-400/70 border-blue-500/60'
                    } transition-all cursor-pointer hover:bg-blue-500/90 group`}
                    style={position}
                    onMouseDown={(event) => handleNoteMouseDown(event, note)}
                    onContextMenu={(event) => handleNoteRightClick(event, note)}
                  >
                    {/* Resize handle on right edge */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={(event) => handleResizeStart(event, note)}
                      title="Drag to resize"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Chord Progression Display */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-300">Key:</label>
            <Select value={currentKey} onValueChange={setCurrentKey}>
              <SelectTrigger className="h-8 w-32 text-sm bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                {Object.keys(DEFAULT_customKeys).map(key => (
                  <SelectItem 
                    key={key} 
                    value={key} 
                    className="text-sm text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer"
                  >
                    {DEFAULT_customKeys[key as keyof typeof DEFAULT_customKeys].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-300">Progression:</label>
            <Select 
              value={selectedProgression.id} 
              onValueChange={(id) => {
                const prog = CHORD_PROGRESSIONS.find(p => p.id === id);
                if (prog) setSelectedProgression(prog);
              }}
            >
              <SelectTrigger className="h-8 w-44 text-sm bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {CHORD_PROGRESSIONS.map(prog => (
                  <SelectItem 
                    key={prog.id} 
                    value={prog.id} 
                    className="text-sm text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer"
                  >
                    {prog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ChordProgressionDisplay
          progression={selectedProgression}
          currentKey={currentKey}
          currentChordIndex={currentChordIndex}
          onChordClick={handleChordClick}
        />
      </div>
      {renderPianoRoll()}
    </div>
  );
}

export default VerticalPianoRoll;
