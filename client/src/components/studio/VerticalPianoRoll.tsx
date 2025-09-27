import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Installed @types/uuid
import { Button } from '@/components/ui/button';
import { Play, Pause, Square } from 'lucide-react';

// Constants
import type { Note } from './types/pianoRollTypes';
import { DEFAULT_customKeys } from './types/pianoRollTypes';
import { useToast } from '@/hooks/use-toast';
import { useAudio } from '@/hooks/use-audio';
import { cn } from '@/lib/utils';

const STEPS = 16;
const STEP_WIDTH = 40;
const KEY_HEIGHT = 24;
const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

interface Track {
  id: string;
  name: string;
  notes: Note[];
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
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
  const [selectedProgression, setSelectedProgression] = useState('I-IV-V-I');
  const [customKeys, setCustomKeys] = useState(DEFAULT_customKeys);

  // Refs
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { playNote: audioPlayNote, initialize, isInitialized } = useAudio();

  // Audio engine
  const audioEngine = useRef({
    playNote: async (note: string, octave: number, duration: number) => {
      if (!isInitialized) {
        await initialize();
      }
      if (onPlayNote) {
        onPlayNote(note, octave, duration);
      } else {
        // @ts-ignore
        audioPlayNote(note, octave, duration, 'piano', 0.8);
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
  const startPlayback = useCallback(() => {
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
    }

    setIsPlaying(true);
    setCurrentStep(0);

    const stepDuration = (60 / bpm) * (4 / 4) * 1000; // 16th notes

    // Play first step immediately
    playStep(0);

    playbackInterval.current = setInterval(() => {
      setCurrentStep((prevStep) => {
        const nextStep = (prevStep + 1) % STEPS;
        playStep(nextStep);
        return nextStep;
      });
    }, stepDuration);
  }, [bpm, tracks, selectedTrack, noteDuration, metronomeEnabled]);

  const stopPlayback = useCallback(() => {
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
      playbackInterval.current = null;
    }

    setIsPlaying(false);
    setCurrentStep(0);
    audioEngine.current.stopAllNotes();
  }, []);

  const playStep = useCallback((step: number) => {
    const currentTrack = tracks.find(t => t.id === String(selectedTrack));
    if (!currentTrack) return;

    // Play notes for current step
    currentTrack.notes
      .filter((note) => note.step === step)
      .forEach((note) => {
        const noteName = note.note;
const octave = note.octave;
audioEngine.current.playNote(noteName, octave, noteDuration);
      });

    // Play metronome click on beat
    if (metronomeEnabled && step % 4 === 0) {
      audioEngine.current.playNote('C', 6, 0.1);
    }
  }, [tracks, selectedTrack, noteDuration, metronomeEnabled]);

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

  const toggleNote = (step: number, pitch: number) => {
    const currentTrack = tracks.find(t => t.id === String(selectedTrack));
    if (!currentTrack) return;

    const octave = Math.floor(pitch / 12) - 1;
    const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][pitch % 12];

    const newNotes = [...currentTrack.notes];
    const noteIndex = newNotes.findIndex((note) => note.step === step && note.note === noteName && note.octave === octave);

    if (noteIndex > -1) {
      newNotes.splice(noteIndex, 1);
    } else {
      const newNote: Note = { id: uuidv4(), step, note: noteName, octave, length: 1, velocity: 100 };
      newNotes.push(newNote);
    }

        onNotesChange(newNotes);
  };

  const clearAll = () => {
    
    if (onNotesChange) {
      onNotesChange([]);
    }

    toast({
      title: 'Cleared',
      description: 'All notes have been cleared.',
    });
  };

  // Generate chord progression
  const generateProgression = () => {
    if (toast) {
      toast({
        title: 'Progression Generated',
        description: 'New chord progression has been generated.',
      });
    }

    // TODO: Implement chord progression generation
    console.log('Generating chord progression...');
  };

  
  
  // Render piano roll grid
  const renderPianoRoll = () => {
    return (
      <div className="flex flex-col h-full">
        {/* Header with transport controls */}
        <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800">
          <h3 className="text-lg font-medium">Piano Roll</h3>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePlay}
              className="w-20 justify-center"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleStop}
              className="w-20 justify-center"
            >
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
            <div className="flex items-center space-x-2 px-2">
              <span className="text-sm">BPM:</span>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                min={40}
                max={240}
                className="w-16 px-2 py-1 text-sm border rounded"
              />
            </div>
          </div>
        </div>

        {/* Piano roll grid */}
        <div className="flex-1 overflow-auto relative">
          {/* Piano keys */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gray-50 dark:bg-gray-900 border-r">
            {Array.from({ length: 25 }).map((_, i) => {
              const pitch = 127 - i;
              const octave = Math.floor(pitch / 12) - 1;
              const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][pitch % 12];
              const isBlackKey = ['C#', 'D#', 'F#', 'G#', 'A#'].includes(noteName);
              
              return (
                <div
                  key={i}
                  className={`h-8 flex items-center px-2 text-xs border-b ${
                    isBlackKey ? 'bg-gray-200 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
                  } ${highlightedRow === i ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                  onMouseEnter={() => setHighlightedRow(i)}
                  onMouseLeave={() => setHighlightedRow(null)}
                >
                  {noteName}{octave}
                </div>
              );
            })}
          </div>

          {/* Grid lines */}
          <div className="ml-16 h-full relative">
            <div className="grid grid-cols-16 absolute inset-0">
              {Array.from({ length: STEPS }).map((_, step) => (
                <div 
                  key={step}
                  className={`h-full border-r ${
                    step % 4 === 0 ? 'border-gray-300' : 'border-gray-100'
                  } ${currentStep === step ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                >
                  <div className="text-xs text-gray-500 text-center h-full relative">
                    {step + 1}
                    {/* Render notes for this step */}
                    {Array.from({ length: 25 }).map((_, i) => {
                      const pitch = 127 - i;
                      const octave = Math.floor(pitch / 12) - 1;
                      const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][pitch % 12];
                      const noteExists = tracks.find(t => t.id === String(selectedTrack))?.notes.some(
                        (note) => note.step === step && note.note === noteName && note.octave === octave
                      );

                      return (
                        <div
                          key={i}
                          className={`absolute w-full h-8`}
                          style={{ top: `${i * 32}px` }}
                          onMouseDown={() => toggleNote(step, pitch)}
                        >
                          {noteExists && (
                            <div className="bg-blue-500 h-full w-full rounded-sm opacity-80"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {renderPianoRoll()}
    </div>
  );
}

export default VerticalPianoRoll;
