import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Music, Link2, Link2Off, Info, Play, Pause } from "lucide-react";
import { realisticAudio } from "@/lib/realisticAudio";
import { useToast } from "@/hooks/use-toast";
import { useSongWorkSession } from "@/contexts/SongWorkSessionContext";
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

// Keyboard shortcut mapping - QWERTY keys to piano notes
const KEYBOARD_TO_NOTE: Record<string, { note: string; octave: number }> = {
  'z': { note: 'C', octave: 3 }, 's': { note: 'C#', octave: 3 }, 'x': { note: 'D', octave: 3 },
  'd': { note: 'D#', octave: 3 }, 'c': { note: 'E', octave: 3 }, 'v': { note: 'F', octave: 3 },
  'g': { note: 'F#', octave: 3 }, 'b': { note: 'G', octave: 3 }, 'h': { note: 'G#', octave: 3 },
  'n': { note: 'A', octave: 3 }, 'j': { note: 'A#', octave: 3 }, 'm': { note: 'B', octave: 3 },
  'q': { note: 'C', octave: 4 }, '2': { note: 'C#', octave: 4 }, 'w': { note: 'D', octave: 4 },
  '3': { note: 'D#', octave: 4 }, 'e': { note: 'E', octave: 4 }, 'r': { note: 'F', octave: 4 },
  '5': { note: 'F#', octave: 4 }, 't': { note: 'G', octave: 4 }, '6': { note: 'G#', octave: 4 },
  'y': { note: 'A', octave: 4 }, '7': { note: 'A#', octave: 4 }, 'u': { note: 'B', octave: 4 },
  'i': { note: 'C', octave: 5 }, '9': { note: 'C#', octave: 5 }, 'o': { note: 'D', octave: 5 },
  '0': { note: 'D#', octave: 5 }, 'p': { note: 'E', octave: 5 },
};

// Chord progressions
const CHORD_PROGRESSIONS: ChordProgression[] = [
  { id: 'heartsoul', name: '♥ Heart and Soul (from Big)', chords: ['I', 'vi', 'IV', 'V'], key: 'C' },
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
  const [syncScroll, setSyncScroll] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  
  const { toast } = useToast();
  const { currentSession } = useSongWorkSession();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pianoKeysRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingNotesRef = useRef<Note[]>([]);
  const selectedTrack = tracks[selectedTrackIndex];
  
  // Original song playback state
  const [originalAudioPlaying, setOriginalAudioPlaying] = useState(false);
  const [originalAudioLoaded, setOriginalAudioLoaded] = useState(false);
  const [originalAudioCurrentTime, setOriginalAudioCurrentTime] = useState(0);
  const [originalAudioDuration, setOriginalAudioDuration] = useState(0);
  
  // Find the piano-roll specific issue from the session
  const pianoRollIssue = currentSession?.analysis?.issues?.find(
    issue => issue.targetTool === 'piano-roll'
  );

  // Scroll synchronization
  const handlePianoScroll = useCallback(() => {
    if (!syncScroll || isSyncingRef.current || !pianoKeysRef.current || !gridRef.current) return;
    isSyncingRef.current = true;
    gridRef.current.scrollTop = pianoKeysRef.current.scrollTop;
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }, [syncScroll]);

  const handleGridScroll = useCallback(() => {
    if (!syncScroll || isSyncingRef.current || !pianoKeysRef.current || !gridRef.current) return;
    isSyncingRef.current = true;
    pianoKeysRef.current.scrollTop = gridRef.current.scrollTop;
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }, [syncScroll]);

  // Load original audio from session
  useEffect(() => {
    // Reset state before loading new audio
    setOriginalAudioPlaying(false);
    setOriginalAudioLoaded(false);
    setOriginalAudioCurrentTime(0);
    setOriginalAudioDuration(0);
    
    if (currentSession?.audioUrl) {
      console.log('🎵 Loading original song audio:', currentSession.audioUrl);
      
      const audio = new Audio(currentSession.audioUrl);
      audioRef.current = audio;
      
      audio.addEventListener('loadedmetadata', () => {
        console.log('✅ Audio loaded, duration:', audio.duration);
        setOriginalAudioDuration(audio.duration);
        setOriginalAudioLoaded(true);
      });
      
      audio.addEventListener('timeupdate', () => {
        setOriginalAudioCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setOriginalAudioPlaying(false);
        // Reset to beginning so user can replay
        audio.currentTime = 0;
        setOriginalAudioCurrentTime(0);
      });
      
      audio.addEventListener('error', (e) => {
        console.error('❌ Audio load error:', e);
        setOriginalAudioLoaded(false);
        toast({
          title: "Audio Load Error",
          description: "Could not load original song audio",
          variant: "destructive"
        });
      });
      
      return () => {
        audio.pause();
        audio.remove();
        audioRef.current = null;
      };
    }
  }, [currentSession?.audioUrl, toast]);

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

  // 🎙️ RECORDING CONTROLS
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    recordingNotesRef.current = [];
    setCurrentStep(0);
    toast({
      title: "🔴 Recording Started",
      description: "Play notes on your keyboard - timing will be captured!",
    });
  }, [toast]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    
    // Add all recorded notes to the track
    if (recordingNotesRef.current.length > 0) {
      setTracks(prev => prev.map((track, index) =>
        index === selectedTrackIndex
          ? { ...track, notes: [...track.notes, ...recordingNotesRef.current] }
          : track
      ));
      
      toast({
        title: "✅ Recording Saved",
        description: `${recordingNotesRef.current.length} notes added to track!`,
      });
    } else {
      toast({
        title: "Recording Stopped",
        description: "No notes were recorded",
        variant: "default"
      });
    }
    
    recordingNotesRef.current = [];
  }, [selectedTrackIndex, toast]);

  // 🎹 KEYBOARD SHORTCUTS - Play piano with your QWERTY keyboard!
  useEffect(() => {
    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      
      // Prevent key repeat
      if (pressedKeys.has(key)) return;
      pressedKeys.add(key);

      // SPACE - Play/Pause
      if (key === ' ') {
        e.preventDefault();
        handlePlay();
        return;
      }

      // Check if this key maps to a piano note
      const noteMapping = KEYBOARD_TO_NOTE[key];
      if (noteMapping) {
        e.preventDefault();
        
        // Find the piano key index
        const keyIndex = PIANO_KEYS.findIndex(
          pk => pk.note === noteMapping.note && pk.octave === noteMapping.octave
        );

        if (keyIndex !== -1) {
          // Play the note
          const pianoKey = PIANO_KEYS[keyIndex];
          realisticAudio.playNote(
            pianoKey.note,
            pianoKey.octave,
            0.8,
            selectedTrack.instrument,
            selectedTrack.volume / 100
          );

          // 🎙️ RECORDING MODE - Capture timing!
          if (isRecording) {
            const elapsedMs = Date.now() - recordingStartTime;
            // Convert milliseconds to steps based on BPM
            // Each step is a 16th note: (60000ms / bpm) / 4
            const msPerStep = (60000 / bpm) / 4;
            const calculatedStep = Math.floor(elapsedMs / msPerStep);
            
            // Clamp to available steps
            const step = Math.min(calculatedStep, STEPS - 1);
            
            // Create and add note to recording buffer
            const newNote: Note = {
              id: `rec-${pianoKey.key}-${Date.now()}`,
              note: pianoKey.note,
              octave: pianoKey.octave,
              step,
              velocity: 100,
              length: 1
            };
            
            recordingNotesRef.current.push(newNote);
            
            // Visual feedback - move playhead to show position
            setCurrentStep(step);
            
            console.log(`🎵 Recorded: ${pianoKey.note}${pianoKey.octave} at step ${step}`);
          } 
          // Chord mode (not recording)
          else if (chordMode) {
            // In chord mode, accumulate selected keys
            setActiveKeys(prev => new Set(prev).add(keyIndex));
          } 
          // Normal mode
          else {
            // In normal mode, just show which key is pressed
            setActiveKeys(new Set([keyIndex]));
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressedKeys.delete(key);

      // Clear visual feedback when not in chord mode
      if (!chordMode) {
        const noteMapping = KEYBOARD_TO_NOTE[key];
        if (noteMapping) {
          setActiveKeys(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [chordMode, selectedTrack, handlePlay, isRecording, recordingStartTime, bpm]);

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

  // Chord progression functions - adds YOUR selected keys to the grid
  const addChordToGrid = useCallback((step: number) => {
    try {
      if (activeKeys.size === 0) {
        toast({
          title: "No Keys Selected",
          description: "Click piano keys first to build your chord, then click the grid!",
          variant: "default"
        });
        return;
      }

      console.log('🎵 Adding chord with selected keys:', Array.from(activeKeys));
      
      // Convert activeKeys (Set of indices) to actual notes and add them to the grid
      const keysArray = Array.from(activeKeys);
      keysArray.forEach((keyIndex, index) => {
        const pianoKey = PIANO_KEYS[keyIndex];
        if (pianoKey) {
          // Add note to grid
          addNote(keyIndex, step);
          
          // Play the note with slight delay for chord effect
          setTimeout(() => {
            realisticAudio.playNote(
              pianoKey.note, 
              pianoKey.octave, 
              0.8, 
              selectedTrack.instrument, 
              selectedTrack.volume / 100
            );
          }, index * 50);
        }
      });
      
      // Clear selected keys after adding to grid
      setActiveKeys(new Set());
      
      toast({
        title: "Chord Added! ✅",
        description: `${keysArray.length} notes added to step ${step + 1}`,
      });
    } catch (error) {
      console.error('Error adding chord to grid:', error);
      toast({
        title: "Error",
        description: "Failed to add chord to grid",
        variant: "destructive"
      });
    }
  }, [activeKeys, addNote, selectedTrack, toast]);

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

  // Original audio playback handlers
  const handleOriginalAudioPlayPause = useCallback(async () => {
    if (!audioRef.current) return;
    
    if (originalAudioPlaying) {
      audioRef.current.pause();
      setOriginalAudioPlaying(false);
    } else {
      try {
        setOriginalAudioPlaying(true);
        await audioRef.current.play();
      } catch (error) {
        console.warn('⚠️ Audio playback blocked:', error);
        setOriginalAudioPlaying(false);
        toast({
          title: "Playback Blocked",
          description: "Browser blocked audio playback. Please try clicking play again.",
          variant: "default"
        });
      }
    }
  }, [originalAudioPlaying, toast]);

  const handleOriginalAudioSeek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setOriginalAudioCurrentTime(time);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          {/* Session Context Banner */}
          {currentSession && pianoRollIssue && (
            <Alert className="mb-4 bg-blue-900/30 border-blue-500/50" data-testid="alert-session-context">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="font-semibold" data-testid="text-session-song-name">
                      Working on: {currentSession.songName}
                    </div>
                    <div className="text-xs text-gray-300" data-testid="text-session-metadata">
                      {currentSession.analysis?.bpm ? `${currentSession.analysis.bpm} BPM` : ''} 
                      {currentSession.analysis?.key && currentSession.analysis?.bpm ? ' • ' : ''}
                      {currentSession.analysis?.key ? `Key of ${currentSession.analysis.key}` : ''}
                    </div>
                    <div className="text-sm text-blue-200 mt-1" data-testid="text-session-issue">
                      Issue: {pianoRollIssue.description}
                    </div>
                  </div>
                  
                  {/* Audio Playback Controls */}
                  {originalAudioLoaded && (
                    <div className="flex items-center gap-3 pt-2 border-t border-blue-500/30" data-testid="audio-controls">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOriginalAudioPlayPause}
                        className="shrink-0"
                        data-testid="button-play-original"
                      >
                        {originalAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-10 text-right" data-testid="text-current-time">
                          {formatTime(originalAudioCurrentTime)}
                        </span>
                        <Slider
                          value={[originalAudioCurrentTime]}
                          max={originalAudioDuration}
                          step={0.1}
                          className="flex-1"
                          onValueChange={(values) => handleOriginalAudioSeek(values[0])}
                          data-testid="slider-audio-seek"
                        />
                        <span className="text-xs text-gray-400 w-10" data-testid="text-total-time">
                          {formatTime(originalAudioDuration)}
                        </span>
                      </div>
                    </div>
                  )}
                  {!originalAudioLoaded && currentSession.audioUrl && (
                    <div className="text-xs text-gray-400 pt-2 border-t border-blue-500/30">
                      Loading original audio...
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">🎹 Piano Roll</h1>
              {playbackControls}
            </div>
            
            {keyScaleSelector}
            {chordProgressionDisplay}
            
            {/* Chord Mode Toggle & Sync Scroll - Moved from PianoKeys */}
            <div className="flex items-center justify-between gap-4 p-3 bg-gradient-to-r from-purple-900/50 to-gray-800/50 rounded-md border border-purple-500/30">
              <div className="flex items-center gap-4">
                <Button
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  className={`text-sm font-bold px-6 ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-400 animate-pulse' : 'bg-red-700 hover:bg-red-800'}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  data-testid="button-record"
                >
                  <div className="w-3 h-3 rounded-full bg-white mr-2" />
                  <span className="text-base">
                    {isRecording ? '⏹️ STOP RECORDING' : '🎙️ RECORD'}
                  </span>
                </Button>
                
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
                  disabled={isRecording}
                  data-testid="button-chord-mode"
                >
                  <Music className="w-5 h-5 mr-2" />
                  <span className="text-base">
                    {chordMode ? '🎵 CHORD ON' : '🎵 Chord OFF'}
                  </span>
                </Button>
                {isRecording && (
                  <p className="text-sm text-red-300 font-medium animate-pulse">
                    🔴 Recording... Play notes on your keyboard!
                  </p>
                )}
                {!isRecording && chordMode && (
                  <p className="text-sm text-purple-300 font-medium">
                    Tap piano keys to build your chord, then click the grid!
                  </p>
                )}
              </div>
              
              <Button
                size="sm"
                variant={syncScroll ? "default" : "secondary"}
                className={`text-xs font-medium px-4 ${syncScroll ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700'}`}
                onClick={() => setSyncScroll(!syncScroll)}
                data-testid="button-sync-scroll"
              >
                {syncScroll ? <Link2 className="w-4 h-4 mr-1.5" /> : <Link2Off className="w-4 h-4 mr-1.5" />}
                {syncScroll ? 'Linked' : 'Free Scroll'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="h-[calc(100%-250px)] overflow-hidden">
          <div className="flex h-full">
            <PianoKeys
              ref={pianoKeysRef}
              pianoKeys={PIANO_KEYS}
              selectedTrack={selectedTrack}
              onKeyClick={addNote}
              keyHeight={KEY_HEIGHT}
              currentStep={currentStep}
              isPlaying={isPlaying}
              chordMode={chordMode}
              activeKeys={activeKeys}
              onActiveKeysChange={setActiveKeys}
              onScroll={handlePianoScroll}
            />
            
            <StepGrid
              ref={gridRef}
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
              onScroll={handleGridScroll}
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
