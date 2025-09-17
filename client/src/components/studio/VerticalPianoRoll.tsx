import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square } from 'lucide-react';

// Constants
const STEPS = 16;
const STEP_WIDTH = 40;
const KEY_HEIGHT = 24;
const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

// Types
interface Note {
  id: string;
  step: number;
  pitch: number;
  velocity: number;
  duration: number;
}

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
  notes?: Note[];
  onNotesChange?: (notes: Note[]) => void;
  selectedTrack?: number;
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
type Note = {
  id: string;
  step: number;
  pitch: number;
  velocity: number;
  duration: number;
};

type Track = {
  id: string;
  name: string;
  notes: Note[];
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
};

interface VerticalPianoRollProps {
  notes?: Note[];
  onNotesChange?: (notes: Note[]) => void;
  selectedTrack?: number;
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

// Constants
const STEPS = 16;
const STEP_WIDTH = 40;
const KEY_HEIGHT = 24;
const PIANO_KEYS: string[] = []; // Initialize empty array for piano keys

// Types
interface Note {
  id: string;
  step: number;
  pitch: number;
  velocity: number;
  duration: number;
}

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
  notes?: Note[];
  onNotesChange?: (notes: Note[]) => void;
  selectedTrack?: number;
  isPlaying?: boolean;
  onPlayNote?: (note: string, octave: number, duration: number) => void;
  noteDuration?: number;
  className?: string;
  showTransportControls?: boolean;
  onBpmChange?: (bpm: number) => void;
  onMetronomeToggle?: (enabled: boolean) => void;
  onCountInToggle?: (enabled: boolean) => void;
  onChordModeToggle?: (enabled: boolean) => void;
}

const VerticalPianoRoll: React.FC<VerticalPianoRollProps> = ({
  notes: externalNotes = [],
  onNotesChange = () => {},
  selectedTrack = 0,
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
  // State
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: '1',
      name: 'Piano',
      notes: [],
      muted: false,
      solo: false,
      volume: 0.7,
      pan: 0,
    },
  ]);

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

  // Audio engine
  const audioEngine = useRef({
    playNote: (note: string, octave: number, duration: number) => {
      if (onPlayNote) {
        onPlayNote(note, octave, duration);
      } else {
        console.log(`Playing note: ${note}${octave} for ${duration}s`);
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

  // Sync with external notes
  useEffect(() => {
    if (externalNotes.length > 0) {
      setTracks((prevTracks) =>
        prevTracks.map((track, i) =>
          i === selectedTrack ? { ...track, notes: [...externalNotes] } : track
        )
      );
    }
  }, [externalNotes, selectedTrack]);

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
    const currentTrack = tracks[selectedTrack];
    if (!currentTrack) return;

    // Play notes for current step
    currentTrack.notes
      .filter((note) => note.step === step)
      .forEach((note) => {
        const pitch = note.pitch;
        const octave = Math.floor(pitch / 12) - 1;
        const noteName = [
          'C',
          'C#',
          'D',
          'D#',
          'E',
          'F',
          'F#',
          'G',
          'G#',
          'A',
          'A#',
          'B',
        ][pitch % 12];
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

  const clearAll = () => {
    setTracks((prevTracks) =>
      prevTracks.map((track) => ({
        ...track,
        notes: [],
      }))
    );

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

  // Play chord function
  const playChord = (chord: string) => {
    console.log('Playing chord:', chord);
    // TODO: Implement chord playback logic
  };

  // Play chord function
  const playChord = (chord: string) => {
    console.log('Playing chord:', chord);
    // TODO: Implement chord playback logic
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
                  <div className="text-xs text-gray-500 text-center">
                    {step + 1}
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
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Piano Roll Grid */}
        <div className="flex-1 overflow-auto relative">
          {/* Piano Keys */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            {Array.from({ length: 25 }).map((_, i) => {
              const pitch = 127 - i;
              const octave = Math.floor(pitch / 12) - 1;
              const noteName = [
                'C',
                'C#',
                'D',
                'D#',
                'E',
                'F',
                'F#',
                'G',
                'G#',
                'A',
                'A#',
                'B',
              ][pitch % 12];
              const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);

              return (
                <div
                  key={i}
                  className={cn(
                    'h-6 flex items-center justify-end pr-2 text-xs font-mono',
                    isBlack
                      ? 'bg-gray-800 text-white h-5 -mt-1 z-10 relative'
                      : 'border-b border-gray-200 dark:border-gray-700',
                    highlightedRow === i && 'bg-blue-100 dark:bg-blue-900/50'
                  )}
                  onMouseEnter={() => setHighlightedRow(i)}
                  onMouseLeave={() => setHighlightedRow(null)}
                >
                  {noteName}
                  {octave}
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="ml-16 h-full relative">
            {/* Step markers */}
            <div className="flex">
              {Array.from({ length: STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-6 border-r flex items-center justify-center text-xs text-gray-500',
                    i % 4 === 0 ? 'border-gray-300' : 'border-gray-200',
                    currentStep === i && 'bg-blue-100 dark:bg-blue-900/50'
                  )}
                  style={{ width: `${STEP_WIDTH}px` }}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="relative">
              {Array.from({ length: 25 }).map((_, rowIndex) => (
                <div
                  key={rowIndex}
                  className={cn(
                    'flex h-6 border-b border-gray-200 dark:border-gray-700',
                    highlightedRow === rowIndex && 'bg-blue-100 dark:bg-blue-900/50'
                  )}
                >
                  {Array.from({ length: STEPS }).map((_, colIndex) => (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      className={cn(
                        'h-full border-r border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50',
                        colIndex % 4 === 0 ? 'border-gray-200' : 'border-gray-100',
                        currentStep === colIndex && 'bg-blue-200/30 dark:bg-blue-800/30'
                      )}
                      style={{ width: `${STEP_WIDTH}px` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transport Controls */}
        {showTransportControls && (
          <div className="p-4 border-t dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <Button
                variant={isPlaying ? 'destructive' : 'default'}
                onClick={handlePlay}
                className="w-24"
              >
                {isPlaying ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Play
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleStop}
                className="w-24"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
                Clear
              </Button>
              <Button
                onClick={() => setChordMode(!chordMode)}
                variant={chordMode ? "default" : "outline"}
                className={chordMode ? "bg-purple-600 hover:bg-purple-500" : "bg-gray-700 hover:bg-gray-600"}
              >
                🎵 Chord Mode
              </Button>
              <Button 
                onClick={() => setHighlightedRow(null)}
                variant="outline" 
                className="bg-yellow-600 hover:bg-yellow-500"
                title="Clear row highlight for alignment"
              >
                🎯 Clear Highlight
              </Button>
              <Button onClick={generateProgression} variant="outline" className="bg-green-700 hover:bg-green-600">
                Generate Progression
              </Button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <CardContent className="h-full overflow-hidden">
          {/* Combined Piano Keys and Grid - Perfect Alignment */}
          <div className="flex-1 overflow-auto">
            <div className="relative bg-gray-900">
              {/* Step Headers */}
              <div className="flex sticky top-0 bg-gray-800 border-b border-gray-600 z-10">
                <div className="w-28"></div> {/* Space for piano keys */}
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

              {/* Unified Piano Keys and Grid Rows */}
              <div className="relative pt-8">
                {PIANO_KEYS.map((key, keyIndex) => (
                  <div key={key.key} className="flex border-b border-gray-700">
                    {/* Piano Key - Part of same unified row */}
                    <div className="w-28 flex-shrink-0">
                      <button
                        className={`w-full text-xs font-mono border-b border-gray-600 hover:bg-gray-600 transition-colors
                          ${key.isBlack
                            ? 'bg-gray-900 text-gray-300 border-l-4 border-l-gray-700'
                            : 'bg-gray-700 text-white'
                          }
                          ${chordMode ? 'ring-2 ring-purple-500 ring-opacity-50' : ''}
                          ${highlightedRow === keyIndex ? 'ring-2 ring-yellow-400 ring-opacity-80' : ''}
                        `}
                        style={{ height: `${KEY_HEIGHT}px` }}
                        onClick={() => {
                          try {
                            setHighlightedRow(keyIndex);

                            if (chordMode) {
                              console.log('🎵 Chord Mode: Trying to play chord for key:', key.note, key.octave);
                              console.log('🎵 Current key:', currentKey);
                              console.log('🎵 Current chord index:', currentChordIndex);
                              console.log('🎵 Selected progression:', selectedProgression);

                              const currentChord = selectedProgression.chords[currentChordIndex];
                              console.log('🎵 Current chord symbol:', currentChord);

                              const keyData = DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys];
                              console.log('🎵 Key data found:', !!keyData);

                              if (keyData && keyData.chords) {
                                const chordNotes = keyData.chords[currentChord as keyof typeof keyData.chords];
                                console.log('🎵 Chord notes found:', chordNotes);

                                if (chordNotes && Array.isArray(chordNotes)) {
                                  playChord(chordNotes, key.octave);
                                  console.log('🎵 Successfully played chord:', chordNotes);
                                } else {
                                  console.error('🎵 Chord notes not found or not array:', chordNotes);
                                }
                              } else {
                                console.error('🎵 Key data or chords not found for key:', currentKey);
                              }

                              setCurrentChordIndex(prev => (prev + 1) % selectedProgression.chords.length);
                            } else {
                              console.log('🎵 Single note mode: Playing', key.note, key.octave, 'with instrument:', tracks[selectedTrack]?.instrument);
                              realisticAudio.playNote(key.note, key.octave, 0.8, tracks[selectedTrack]?.instrument || 'piano', 0.8);
                            }
                          } catch (error) {
                            console.error('❌ Audio playback error:', error);
                            if (error instanceof Error) {
                              console.error('Error name:', error.name);
                              console.error('Error message:', error.message);
                              console.error('Error stack:', error.stack);
                            }
                          }
                        }}
                      >
                        {key.key}
                      </button>
                    </div>

                    {/* Grid Row - Same unified row, perfect alignment */}
                    <div className="flex">
                      {Array.from({ length: STEPS }, (_, step) => {
                        const hasNote = tracks[selectedTrack]?.notes.some(
                          note => note.note === key.note && note.octave === key.octave && Math.floor(note.step) === step
                        );
                        const note = tracks[selectedTrack]?.notes.find(
                          note => note.note === key.note && note.octave === key.octave && Math.floor(note.step) === step
                        );

                        return (
                          <div
                            key={step}
                            className={`border-r border-gray-700 cursor-pointer transition-colors relative hover:bg-gray-600
                              ${hasNote
                                ? 'bg-blue-500 hover:bg-blue-400'
                                : 'hover:bg-gray-700'
                              }
                              ${step % 4 === 0 ? 'border-r-gray-500' : ''}
                              ${currentStep === step ? 'bg-red-900 bg-opacity-50' : ''}
                              ${highlightedRow === keyIndex ? 'ring-1 ring-yellow-300 ring-opacity-50' : ''}
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
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Key:</span>
              <select
                value={currentKey}
                onChange={(e) => {
                  try {
                    const newKey = e.target.value;
                    console.log('🎵 Key dropdown: Changing key from', currentKey, 'to', newKey);

                    if (!DEFAULT_customKeys[newKey as keyof typeof DEFAULT_customKeys]) {
                      console.error('❌ Key not found in DEFAULT_customKeys:', newKey);
                      return;
                    }

                    setCurrentKey(newKey);
                    console.log('✅ Key changed successfully to:', newKey);
                  } catch (error) {
                    console.error('❌ Error changing key via dropdown:', error);
                  }
                }}
                className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
              >
                {Object.keys(DEFAULT_customKeys).map(key => {
                  try {
                    const keyData = DEFAULT_customKeys[key as keyof typeof DEFAULT_customKeys];
                    const displayName = keyData?.name || key;
                    return (
                      <option key={key} value={key}>{displayName}</option>
                    );
                  } catch (error) {
                    console.error('❌ Error rendering key option:', key, error);
                    return (
                      <option key={key} value={key} disabled>{key} (Error)</option>
                    );
                  }
                })}
              </select>
            </div>

            {/* Circle of Fifths */}
            <div className="mb-3">
              <span className="text-xs text-gray-400 mb-2 block">Circle of Fifths:</span>
              <div className="flex flex-wrap gap-1">
                {CIRCLE_OF_FIFTHS.map((key, index) => (
                  <button
                    key={key}
                    onClick={() => {
                      console.log('🎵 Circle of Fifths: Changing key from', currentKey, 'to', key);
                      try {
                        setCurrentKey(key);
                        console.log('✅ Key changed successfully to:', key);
                      } catch (error) {
                        console.error('❌ Error changing key:', error);
                      }
                    }}
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
                  try {
                    console.log('🎵 Rendering chord progression:', chord, 'for key:', currentKey);
                    const keyData = DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys];

                    if (!keyData) {
                      console.error('❌ Key data not found for key:', currentKey);
                      return (
                        <button key={index} disabled className="opacity-50">
                          <div className="font-medium">{chord}</div>
                          <div className="text-xs opacity-75">Key Error</div>
                        </button>
                      );
                    }

                    if (!keyData.chords) {
                      console.error('❌ Chords not found for key:', currentKey);
                      return (
                        <button key={index} disabled className="opacity-50">
                          <div className="font-medium">{chord}</div>
                          <div className="text-xs opacity-75">Chords Error</div>
                        </button>
                      );
                    }

                    const chordNotes = keyData.chords[chord as keyof typeof keyData.chords];
                    console.log('🎵 Chord notes for', chord, ':', chordNotes);

                    if (!chordNotes || !Array.isArray(chordNotes)) {
                      console.error('❌ Invalid chord notes for', chord, ':', chordNotes);
                      return (
                        <button key={index} disabled className="opacity-50">
                          <div className="font-medium">{chord}</div>
                          <div className="text-xs opacity-75">Invalid Notes</div>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => {
                          console.log('🎵 Playing chord progression:', chord, chordNotes);
                          try {
                            setCurrentChordIndex(index);
                            playChord(chordNotes);
                            console.log('✅ Chord progression played successfully');
                          } catch (error) {
                            console.error('❌ Error playing chord progression:', error);
                          }
                        }}
                        className="flex flex-col items-center p-2 hover:bg-gray-700 rounded"
                      >
                        <div className="font-medium">{chord}</div>
                        <div className="text-xs opacity-75">{chordNotes.join('-')}</div>
                      </button>
                    );
                  } catch (error) {
                    console.error('❌ Error rendering chord progression for', chord, ':', error);
                    return (
                      <div key={index}>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{chord}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Volume:</span>
                          <div className="text-sm w-8 text-right">{tracks[selectedTrack]?.volume}%</div>
                        </div>
                      </div>
                    );
                  }
                })}
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
  );
}
