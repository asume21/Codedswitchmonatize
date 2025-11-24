import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Music, Link2, Link2Off, Info, Play, Pause, RotateCw, GripVertical, Plus, Trash2, Circle, Repeat, Wand2 } from "lucide-react";
import { realisticAudio } from "@/lib/realisticAudio";
import { useToast } from "@/hooks/use-toast";
import { useSongWorkSession } from "@/contexts/SongWorkSessionContext";
import { useTransport } from "@/contexts/TransportContext";
import { useTrackStore } from "@/contexts/TrackStoreContext";
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
  STEP_WIDTH,
  AVAILABLE_INSTRUMENTS
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

// Track color palette for multi-track visualization
const TRACK_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500', 'bg-yellow-500', 'bg-red-500', 'bg-indigo-500', 'bg-orange-500'];

// ALL AVAILABLE INSTRUMENTS
// Imported from types/pianoRollTypes.ts

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
  
  // LVTR-style features
  const [chordInversion, setChordInversion] = useState(0); // 0 = root, 1 = 1st inversion, 2 = 2nd inversion
  const [customProgression, setCustomProgression] = useState<string[]>([]);
  const [draggedChordIndex, setDraggedChordIndex] = useState<number | null>(null);
  const [showProgressionBuilder, setShowProgressionBuilder] = useState(false);
  const [scaleStates, setScaleStates] = useState<Record<string, Set<number>>>({});
  
  // NEW ADVANCED FEATURES
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapValue, setSnapValue] = useState(1); // 1 = 1/4 note, 0.5 = 1/8, 0.25 = 1/16
  const [showVelocityEditor, setShowVelocityEditor] = useState(true);
  const [clipboard, setClipboard] = useState<Note[]>([]);
  const [pianoRollTool, setPianoRollTool] = useState<'draw' | 'select' | 'erase'>('draw');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Note[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // EVEN MORE ADVANCED FEATURES
  const [arpeggioMode, setArpeggioMode] = useState<'off' | 'up' | 'down' | 'updown' | 'random'>('off');
  const [arpeggioSpeed, setArpeggioSpeed] = useState(4); // steps between notes
  const [humanizeAmount, setHumanizeAmount] = useState(0); // 0-100% timing/velocity variation
  const [transposeAmount, setTransposeAmount] = useState(0); // semitones
  const [strumMode, setStrumMode] = useState(false); // guitar-style strum delay
  
  // FINAL MISSING FEATURES
  const [showGhostNotes, setShowGhostNotes] = useState(true); // Show other tracks' notes in gray
  const [swingAmount, setSwingAmount] = useState(0); // 0-100% swing/groove
  const [scaleSnapEnabled, setScaleSnapEnabled] = useState(false); // Snap to scale notes only
  const [showNoteNames, setShowNoteNames] = useState(true); // Show note names on grid
  const [loopStart, setLoopStart] = useState<number | null>(null); // Loop region start
  const [loopEnd, setLoopEnd] = useState<number | null>(null); // Loop region end
  const [automationLane, setAutomationLane] = useState<'volume' | 'pan' | 'off'>('off'); // Automation type
  const [detectedChord, setDetectedChord] = useState<string>(''); // Detected chord name
  const [loopEnabled, setLoopEnabled] = useState(false); // Loop playback toggle
  const [loopNotes, setLoopNotes] = useState<Note[]>([]); // Saved loop notes
  
  // DRAG-TO-SELECT BOX FEATURE
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  
  const { toast } = useToast();
  const { currentSession, updateSession } = useSongWorkSession();
  const { play: startTransport, stop: stopTransport } = useTransport();
  const { tracks: registeredClips, addTrack, updateTrack, removeTrack } = useTrackStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pianoKeysRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingNotesRef = useRef<Note[]>([]);
  const selectedTrack = tracks[selectedTrackIndex];
  const pianoTrackIdRef = useRef<string>(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `piano-${Date.now()}`);
  const hasRegisteredTrackRef = useRef(false);
  
  // Original song playback state
  const [originalAudioPlaying, setOriginalAudioPlaying] = useState(false);
  const [originalAudioLoaded, setOriginalAudioLoaded] = useState(false);
  const [originalAudioCurrentTime, setOriginalAudioCurrentTime] = useState(0);
  const [originalAudioDuration, setOriginalAudioDuration] = useState(0);
  
  // Find the piano-roll specific issue from the session
  const pianoRollIssue = currentSession?.analysis?.issues?.find(
    issue => issue.targetTool === 'piano-roll'
  );

  // Scroll synchronization - keep piano keys and grid in sync
  const handlePianoScroll = useCallback(() => {
    if (!syncScroll || isSyncingRef.current) return;
    if (!pianoKeysRef.current || !gridRef.current) return;
    
    isSyncingRef.current = true;
    const scrollTop = pianoKeysRef.current.scrollTop;
    gridRef.current.scrollTop = scrollTop;
    
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 0);
  }, [syncScroll]);

  const handleGridScroll = useCallback(() => {
    if (!syncScroll || isSyncingRef.current) return;
    if (!pianoKeysRef.current || !gridRef.current) return;
    
    isSyncingRef.current = true;
    const scrollTop = gridRef.current.scrollTop;
    pianoKeysRef.current.scrollTop = scrollTop;
    
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 0);
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
      if (hasRegisteredTrackRef.current) {
        removeTrack(pianoTrackIdRef.current);
        hasRegisteredTrackRef.current = false;
      }
    };
  }, [removeTrack]);

  const patternLengthSteps = useMemo(() => {
    const noteEndSteps = tracks.flatMap(track => track.notes.map(note => note.step + note.length));
    if (noteEndSteps.length === 0) {
      return STEPS;
    }
    return Math.max(...noteEndSteps);
  }, [tracks]);

  useEffect(() => {
    const clipLengthBars = Math.max(1, Math.ceil(patternLengthSteps / 16));
    const clipPayload = {
      tracks,
      bpm,
      key: currentKey,
      progression: selectedProgression,
    };

    const clip = {
      id: pianoTrackIdRef.current,
      kind: 'piano' as const,
      name: `Piano Roll - ${selectedTrack?.name ?? 'Track'}`,
      lengthBars: clipLengthBars,
      startBar: 0,
      payload: clipPayload,
    };

    if (hasRegisteredTrackRef.current) {
      updateTrack(pianoTrackIdRef.current, clip);
    } else {
      addTrack(clip);
      hasRegisteredTrackRef.current = true;
    }
  }, [tracks, bpm, currentKey, selectedProgression, selectedTrack, addTrack, updateTrack, patternLengthSteps]);

  useEffect(() => {
    if (currentSession) {
      updateSession(currentSession.sessionId, { tracks: registeredClips });
    }
  }, [registeredClips, currentSession, updateSession]);

  // Playback control
  const handlePlay = useCallback(() => {
    if (isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Debug: Log track state before playback
      console.log('▶️ Starting playback...');
      tracks.forEach((track, idx) => {
        console.log(`Track ${idx} (${track.name}): ${track.notes.length} notes`, track.notes);
      });
      
      setIsPlaying(true);
      const stepDuration = (60 / bpm / 4) * 1000; // 16th note duration in ms

      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const nextStep = (prev + 1) % STEPS;
          
          // Play notes at the current step
          tracks.forEach(track => {
            if (!track.muted) {
              const notesAtStep = track.notes.filter(note => note.step === nextStep);
              if (notesAtStep.length > 0) {
                console.log(`🎵 Step ${nextStep}: Playing ${notesAtStep.length} notes`, notesAtStep);
              }
              notesAtStep.forEach(note => {
                // Calculate duration based on note length and BPM
                // Each step is a 16th note, so duration = (note.length * stepDuration) / 1000 seconds
                const noteDuration = (note.length * stepDuration) / 1000;
                
                realisticAudio.playNote(
                  note.note,
                  note.octave,
                  noteDuration,
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
    if (!isPlaying) {
      startTransport();
    }
  }, [isPlaying, bpm, tracks, startTransport]);

  const handleStop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(0);
    stopTransport();
  }, [stopTransport]);

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
    
    // CRITICAL: Store notes in local variable BEFORE clearing ref!
    const recordedNotes = [...recordingNotesRef.current];
    console.log('🎵 Stopping recording with notes:', recordedNotes);
    
    // Clear the ref immediately
    recordingNotesRef.current = [];
    
    // Add all recorded notes to the track
    if (recordedNotes.length > 0) {
      setTracks(prev => {
        const newTracks = prev.map((track, index) => {
          if (index === selectedTrackIndex) {
            const updatedTrack = { 
              ...track, 
              notes: [...track.notes, ...recordedNotes] 
            };
            console.log('✅ Updated track:', updatedTrack.name, 'Total notes:', updatedTrack.notes.length);
            return updatedTrack;
          }
          return track;
        });
        return newTracks;
      });
      
      toast({
        title: "✅ Recording Saved",
        description: `${recordedNotes.length} notes added to track! Press PLAY to hear it back.`,
      });
    } else {
      toast({
        title: "Recording Stopped",
        description: "No notes were recorded",
        variant: "default"
      });
    }
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

      // ENHANCED: Number keys 1-7 trigger chords from progression
      if (key >= '1' && key <= '7') {
        e.preventDefault();
        const chordIndex = parseInt(key) - 1;
        if (selectedProgression.chords[chordIndex]) {
          const chordSymbol = selectedProgression.chords[chordIndex];
          const keyData = DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys];
          let chordNotes = keyData?.chords?.[chordSymbol];
          if (chordNotes) {
            // Apply inversion inline
            if (chordInversion > 0) {
              const inverted = [...chordNotes];
              for (let i = 0; i < chordInversion; i++) {
                const first = inverted.shift();
                if (first) inverted.push(first);
              }
              chordNotes = inverted;
            }
            
            // Play chord
            chordNotes.forEach((note, index) => {
              setTimeout(() => {
                realisticAudio.playNote(note, 4, 0.8, selectedTrack.instrument, selectedTrack.volume / 100);
              }, index * 50);
            });
            
            // Visual feedback
            toast({
              title: `${chordSymbol} Chord`,
              description: `Inversion: ${chordInversion === 0 ? 'Root' : chordInversion === 1 ? '1st' : '2nd'} • Notes: ${chordNotes.join('-')}`,
              duration: 2000
            });
          }
        }
        return;
      }

      // NEW KEYBOARD SHORTCUTS
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Z - Undo
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }
        // Ctrl+Y or Ctrl+Shift+Z - Redo
        if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
          return;
        }
        // Ctrl+C - Copy (but not chord mode toggle)
        if (key === 'c' && selectedNoteIds.size > 0) {
          e.preventDefault();
          copySelected();
          return;
        }
        // Ctrl+V - Paste
        if (key === 'v') {
          e.preventDefault();
          pasteNotes();
          return;
        }
        // Ctrl+A - Select all
        if (key === 'a') {
          e.preventDefault();
          setSelectedNoteIds(new Set(selectedTrack.notes.map(n => n.id)));
          toast({ title: 'All Selected' });
          return;
        }
        // Ctrl+I - Cycle chord inversion
        if (key === 'i') {
          e.preventDefault();
          setChordInversion((prev) => (prev + 1) % 3);
          return;
        }
      }

      // Delete/Backspace - Delete selected notes
      if ((key === 'delete' || key === 'backspace') && selectedNoteIds.size > 0) {
        e.preventDefault();
        deleteSelected();
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
            
            // 🎯 QUANTIZATION: Round to nearest step for tighter timing
            // This makes chords easier - notes within ~60ms snap together
            const rawStep = elapsedMs / msPerStep;
            const calculatedStep = Math.round(rawStep); // Round instead of floor!
            
            // Wrap around if exceeding grid (loop back to start)
            const step = calculatedStep % STEPS;
            
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chordMode, selectedTrack, handlePlay, isRecording, recordingStartTime, bpm, selectedProgression, currentKey, chordInversion, toast, selectedNoteIds]);

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

  const resizeNote = useCallback((noteId: string, newLength: number) => {
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex
        ? { ...track, notes: track.notes.map(note => 
            note.id === noteId ? { ...note, length: newLength } : note
          ) }
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

  const handleInstrumentChange = useCallback((trackId: string, instrument: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, instrument } : track
    ));
    
    // Pre-load the instrument
    realisticAudio.loadAdditionalInstrument(instrument).then(() => {
      toast({
        title: "Instrument Loaded",
        description: `Changed track instrument to ${AVAILABLE_INSTRUMENTS.find(i => i.value === instrument)?.label}`,
      });
    });
  }, [toast]);

  const handleKeyChange = useCallback((key: string) => {
    // Save current scale state before switching
    setScaleStates(prev => ({
      ...prev,
      [currentKey]: activeKeys
    }));
    
    // Switch to new key
    setCurrentKey(key);
    
    // Restore saved state for new key or start fresh
    const savedState = scaleStates[key];
    if (savedState) {
      setActiveKeys(savedState);
    } else {
      setActiveKeys(new Set());
    }
  }, [currentKey, activeKeys, scaleStates]);

  const handleProgressionChange = useCallback((progression: ChordProgression) => {
    setSelectedProgression(progression);
    setCurrentChordIndex(0);
  }, []);

  // LVTR-style chord inversion function
  const invertChord = useCallback((notes: string[], inversion: number): string[] => {
    if (inversion === 0 || notes.length === 0) return notes;
    
    const inverted = [...notes];
    for (let i = 0; i < inversion; i++) {
      const first = inverted.shift();
      if (first) inverted.push(first);
    }
    return inverted;
  }, []);

  const handleChordClick = useCallback((chordSymbol: string, chordNotes: string[]) => {
    // Apply inversion to chord
    const invertedNotes = invertChord(chordNotes, chordInversion);
    
    // Play the chord with inversion
    invertedNotes.forEach((note, index) => {
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
    
    // Visual feedback
    toast({
      title: `${chordSymbol} Chord`,
      description: `Inversion: ${chordInversion === 0 ? 'Root' : chordInversion === 1 ? '1st' : '2nd'} • Notes: ${invertedNotes.join('-')}`,
      duration: 2000
    });
  }, [selectedTrack, chordInversion, invertChord, toast]);

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

  // NEW ADVANCED FEATURE FUNCTIONS
  
  // Snap to grid function
  const snapToGrid = useCallback((step: number): number => {
    if (!snapEnabled) return step;
    return Math.round(step / snapValue) * snapValue;
  }, [snapEnabled, snapValue]);

  // Add to history for undo/redo
  const addToHistory = useCallback((notes: Note[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...notes]);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setTracks(prev => prev.map((track, index) =>
        index === selectedTrackIndex ? { ...track, notes: previousState } : track
      ));
      setHistoryIndex(prev => prev - 1);
    }
  }, [historyIndex, history, selectedTrackIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setTracks(prev => prev.map((track, index) =>
        index === selectedTrackIndex ? { ...track, notes: nextState } : track
      ));
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex, history, selectedTrackIndex]);

  // Copy selected notes
  const copySelected = useCallback(() => {
    if (selectedNoteIds.size === 0) return;
    const selectedNotes = selectedTrack.notes.filter(n => selectedNoteIds.has(n.id));
    setClipboard(selectedNotes);
    toast({ title: '📋 Copied', description: `${selectedNotes.length} note${selectedNotes.length === 1 ? '' : 's'} copied` });
  }, [selectedNoteIds, selectedTrack, toast]);

  // Paste notes
  const pasteNotes = useCallback(() => {
    if (clipboard.length === 0) return;
    const minStep = Math.min(...clipboard.map(n => n.step));
    const newNotes = clipboard.map(note => ({
      ...note,
      id: `${Date.now()}-${Math.random()}`,
      step: snapToGrid(currentStep + (note.step - minStep)),
    }));
    const updatedNotes = [...selectedTrack.notes, ...newNotes];
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    toast({ title: '📌 Pasted', description: `${newNotes.length} note${newNotes.length === 1 ? '' : 's'} pasted` });
  }, [clipboard, currentStep, selectedTrack, selectedTrackIndex, snapToGrid, addToHistory, toast]);

  // Delete selected notes
  const deleteSelected = useCallback(() => {
    if (selectedNoteIds.size === 0) return;
    const updatedNotes = selectedTrack.notes.filter(n => !selectedNoteIds.has(n.id));
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    setSelectedNoteIds(new Set());
    toast({ title: '🗑️ Deleted', description: `${selectedNoteIds.size} note${selectedNoteIds.size === 1 ? '' : 's'} removed` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, addToHistory, toast]);

  // Update note velocity
  const updateNoteVelocity = useCallback((noteId: string, velocity: number) => {
    const updatedNotes = selectedTrack.notes.map(n => 
      n.id === noteId ? { ...n, velocity: Math.max(1, Math.min(127, velocity)) } : n
    );
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
  }, [selectedTrack, selectedTrackIndex]);

  // ARPEGGIO FUNCTION
  const applyArpeggio = useCallback(() => {
    if (selectedNoteIds.size === 0 || arpeggioMode === 'off') return;
    
    const selectedNotes = selectedTrack.notes.filter(n => selectedNoteIds.has(n.id));
    if (selectedNotes.length === 0) return;
    
    // Sort notes by pitch
    const sortedNotes = [...selectedNotes].sort((a, b) => {
      const pitchA = a.octave * 12 + ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(a.note);
      const pitchB = b.octave * 12 + ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(b.note);
      return pitchA - pitchB;
    });
    
    // Apply arpeggio pattern
    let arpeggioNotes: Note[] = [];
    const baseStep = Math.min(...selectedNotes.map(n => n.step));
    
    if (arpeggioMode === 'up') {
      sortedNotes.forEach((note, i) => {
        arpeggioNotes.push({ ...note, step: baseStep + (i * arpeggioSpeed), id: `arp-${Date.now()}-${i}` });
      });
    } else if (arpeggioMode === 'down') {
      sortedNotes.reverse().forEach((note, i) => {
        arpeggioNotes.push({ ...note, step: baseStep + (i * arpeggioSpeed), id: `arp-${Date.now()}-${i}` });
      });
    } else if (arpeggioMode === 'updown') {
      const upDown = [...sortedNotes, ...sortedNotes.slice(1, -1).reverse()];
      upDown.forEach((note, i) => {
        arpeggioNotes.push({ ...note, step: baseStep + (i * arpeggioSpeed), id: `arp-${Date.now()}-${i}` });
      });
    } else if (arpeggioMode === 'random') {
      const shuffled = [...sortedNotes].sort(() => Math.random() - 0.5);
      shuffled.forEach((note, i) => {
        arpeggioNotes.push({ ...note, step: baseStep + (i * arpeggioSpeed), id: `arp-${Date.now()}-${i}` });
      });
    }
    
    // Remove original notes and add arpeggio
    const otherNotes = selectedTrack.notes.filter(n => !selectedNoteIds.has(n.id));
    const updatedNotes = [...otherNotes, ...arpeggioNotes];
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    setSelectedNoteIds(new Set(arpeggioNotes.map(n => n.id)));
    toast({ title: '🎵 Arpeggio Applied', description: `${arpeggioMode.toUpperCase()} pattern created` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, arpeggioMode, arpeggioSpeed, addToHistory, toast]);

  // HUMANIZE FUNCTION
  const applyHumanize = useCallback(() => {
    if (selectedNoteIds.size === 0 || humanizeAmount === 0) return;
    
    const updatedNotes = selectedTrack.notes.map(note => {
      if (!selectedNoteIds.has(note.id)) return note;
      
      // Randomize timing (±humanizeAmount% of a step)
      const timingVariation = (Math.random() - 0.5) * (humanizeAmount / 100) * 2;
      const newStep = Math.max(0, note.step + timingVariation);
      
      // Randomize velocity (±humanizeAmount% of current velocity)
      const velocityVariation = (Math.random() - 0.5) * (humanizeAmount / 100) * 40;
      const newVelocity = Math.max(1, Math.min(127, (note.velocity || 100) + velocityVariation));
      
      return { ...note, step: newStep, velocity: newVelocity };
    });
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    toast({ title: '🎲 Humanized', description: `${humanizeAmount}% variation applied` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, humanizeAmount, addToHistory, toast]);

  // TRANSPOSE FUNCTION
  const applyTranspose = useCallback(() => {
    if (selectedNoteIds.size === 0 || transposeAmount === 0) return;
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const updatedNotes = selectedTrack.notes.map(note => {
      if (!selectedNoteIds.has(note.id)) return note;
      
      const currentPitch = note.octave * 12 + noteNames.indexOf(note.note);
      const newPitch = currentPitch + transposeAmount;
      const newOctave = Math.floor(newPitch / 12);
      const newNote = noteNames[((newPitch % 12) + 12) % 12];
      
      return { ...note, note: newNote, octave: newOctave };
    });
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    toast({ title: '🎼 Transposed', description: `${transposeAmount > 0 ? '+' : ''}${transposeAmount} semitones` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, transposeAmount, addToHistory, toast]);

  // OCTAVE SHIFT FUNCTION
  const shiftOctave = useCallback((direction: 1 | -1) => {
    if (selectedNoteIds.size === 0) return;
    
    const updatedNotes = selectedTrack.notes.map(note => {
      if (!selectedNoteIds.has(note.id)) return note;
      return { ...note, octave: Math.max(0, Math.min(8, note.octave + direction)) };
    });
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    toast({ title: '🎵 Octave Shifted', description: `${direction > 0 ? 'Up' : 'Down'} one octave` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, addToHistory, toast]);

  // RECORDING MODE FUNCTION
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      toast({ 
        title: '⏹️ Recording Stopped', 
        description: `Captured ${recordingNotesRef.current.length} notes`,
        duration: 2000 
      });
    } else {
      // Start recording
      setIsRecording(true);
      recordingNotesRef.current = [];
      setRecordingStartTime(Date.now());
      toast({ 
        title: '🔴 Recording Started', 
        description: 'Play notes on your keyboard or click the piano keys',
        duration: 2000 
      });
    }
  }, [isRecording, toast]);

  // LOOP PLAYBACK FUNCTION
  const toggleLoop = useCallback(() => {
    if (loopEnabled) {
      setLoopEnabled(false);
      toast({ title: '🔁 Loop Disabled' });
    } else {
      // Save current notes as loop
      setLoopNotes([...selectedTrack.notes]);
      setLoopEnabled(true);
      toast({ 
        title: '🔁 Loop Enabled', 
        description: `Looping ${selectedTrack.notes.length} notes`,
        duration: 2000 
      });
    }
  }, [loopEnabled, selectedTrack.notes, toast]);

  // AI SUGGEST FUNCTION (placeholder for AI integration)
  const handleAISuggest = useCallback(() => {
    toast({ 
      title: '🪄 AI Suggest', 
      description: 'AI melody generation coming soon! This will analyze your current notes and suggest improvements.',
      duration: 4000 
    });
    // TODO: Integrate with AI melody generation API
    // Example: Call /api/melody/suggest with current notes
  }, [toast]);

  // DUPLICATE TRACK FUNCTION
  const duplicateTrack = useCallback(() => {
    const newTrack: Track = {
      ...selectedTrack,
      id: `track-${Date.now()}`,
      name: `${selectedTrack.name} (Copy)`,
      notes: selectedTrack.notes.map(n => ({ ...n, id: `${Date.now()}-${Math.random()}` }))
    };
    setTracks(prev => [...prev, newTrack]);
    toast({ title: '📋 Track Duplicated', description: `${selectedTrack.name} copied` });
  }, [selectedTrack, toast]);

  // CHORD DETECTION FUNCTION
  const detectChord = useCallback(() => {
    if (selectedNoteIds.size === 0) return;
    
    const selectedNotes = selectedTrack.notes.filter(n => selectedNoteIds.has(n.id));
    if (selectedNotes.length < 2) {
      setDetectedChord('Single Note');
      return;
    }
    
    // Get unique note names (ignore octaves)
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const uniqueNotes = Array.from(new Set(selectedNotes.map(n => n.note)));
    
    // Simple chord detection
    const intervals = uniqueNotes.map(note => noteNames.indexOf(note)).sort((a, b) => a - b);
    const root = noteNames[intervals[0]];
    
    // Check common chord patterns
    const pattern = intervals.map(i => (i - intervals[0] + 12) % 12).join(',');
    
    const chordMap: Record<string, string> = {
      '0,4,7': 'Major',
      '0,3,7': 'Minor',
      '0,4,7,11': 'Major 7',
      '0,3,7,10': 'Minor 7',
      '0,4,7,10': 'Dominant 7',
      '0,3,6': 'Diminished',
      '0,4,8': 'Augmented',
      '0,5,7': 'Sus4',
      '0,2,7': 'Sus2',
    };
    
    const chordType = chordMap[pattern] || 'Unknown';
    const detectedName = `${root} ${chordType}`;
    setDetectedChord(detectedName);
    toast({ title: '🎵 Chord Detected', description: detectedName });
  }, [selectedNoteIds, selectedTrack, toast]);

  // APPLY SWING FUNCTION
  const applySwing = useCallback(() => {
    if (selectedNoteIds.size === 0 || swingAmount === 0) return;
    
    const updatedNotes = selectedTrack.notes.map(note => {
      if (!selectedNoteIds.has(note.id)) return note;
      
      // Apply swing to off-beat notes (odd steps)
      if (note.step % 2 === 1) {
        const swingOffset = (swingAmount / 100) * 0.5; // Max 50% swing
        return { ...note, step: note.step + swingOffset };
      }
      return note;
    });
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    toast({ title: '🎷 Swing Applied', description: `${swingAmount}% groove added` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, swingAmount, addToHistory, toast]);

  // DRAG-TO-SELECT HANDLERS
  const handleSelectionStart = useCallback((e: React.MouseEvent, keyIndex: number, step: number) => {
    if (pianoRollTool !== 'select') return;
    
    setIsSelecting(true);
    setSelectionStart({ x: step, y: keyIndex });
    setSelectionEnd({ x: step, y: keyIndex });
    
    // Clear previous selection if not holding Ctrl
    if (!e.ctrlKey && !e.metaKey) {
      setSelectedNoteIds(new Set());
    }
  }, [pianoRollTool]);

  const handleSelectionMove = useCallback((keyIndex: number, step: number) => {
    if (!isSelecting || !selectionStart) return;
    
    setSelectionEnd({ x: step, y: keyIndex });
  }, [isSelecting, selectionStart]);

  const handleSelectionEnd = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart || !selectionEnd) return;
    
    // Calculate selection bounds
    const minStep = Math.min(selectionStart.x, selectionEnd.x);
    const maxStep = Math.max(selectionStart.x, selectionEnd.x);
    const minKey = Math.min(selectionStart.y, selectionEnd.y);
    const maxKey = Math.max(selectionStart.y, selectionEnd.y);
    
    // Find notes within selection box
    const notesInSelection = selectedTrack.notes.filter(note => {
      const noteKeyIndex = PIANO_KEYS.findIndex(k => k.note === note.note && k.octave === note.octave);
      return note.step >= minStep && note.step <= maxStep && 
             noteKeyIndex >= minKey && noteKeyIndex <= maxKey;
    });
    
    // Add to selection (or replace if not holding Ctrl)
    if (e.ctrlKey || e.metaKey) {
      const newSelection = new Set(selectedNoteIds);
      notesInSelection.forEach(note => newSelection.add(note.id));
      setSelectedNoteIds(newSelection);
    } else {
      setSelectedNoteIds(new Set(notesInSelection.map(n => n.id)));
    }
    
    // Reset selection state
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    
    if (notesInSelection.length > 0) {
      toast({ 
        title: '✅ Selected', 
        description: `${notesInSelection.length} note${notesInSelection.length === 1 ? '' : 's'} selected` 
      });
    }
  }, [isSelecting, selectionStart, selectionEnd, selectedTrack, selectedNoteIds, toast]);

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
            
            {/* New Features: Recording, Loop, AI Suggest */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant={isRecording ? 'destructive' : 'outline'}
                onClick={toggleRecording}
                className="flex items-center gap-2"
              >
                <Circle className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                {isRecording ? 'Stop Recording' : 'Record'}
              </Button>
              
              <Button
                size="sm"
                variant={loopEnabled ? 'default' : 'outline'}
                onClick={toggleLoop}
                disabled={selectedTrack.notes.length === 0}
                className="flex items-center gap-2"
              >
                <Repeat className="w-4 h-4" />
                {loopEnabled ? 'Loop On' : 'Loop Off'}
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleAISuggest}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30"
              >
                <Wand2 className="w-4 h-4" />
                AI Suggest
              </Button>
            </div>
            
            {keyScaleSelector}
            {chordProgressionDisplay}
            
            {/* LVTR-Style Chord Inversion Slider */}
            <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-lg p-4 border border-indigo-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-indigo-300">Chord Inversion</h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowProgressionBuilder(!showProgressionBuilder)}
                  className="text-xs"
                >
                  {showProgressionBuilder ? 'Hide' : 'Show'} Builder
                </Button>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400 w-16">Root</span>
                <Slider
                  value={[chordInversion]}
                  onValueChange={(v) => setChordInversion(v[0])}
                  min={0}
                  max={2}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-gray-400 w-16 text-right">2nd Inv</span>
                <div className="px-3 py-1 bg-indigo-600 rounded text-xs font-bold min-w-[80px] text-center">
                  {chordInversion === 0 ? 'Root' : chordInversion === 1 ? '1st Inv' : '2nd Inv'}
                </div>
              </div>
              
              {/* Drag & Drop Progression Builder */}
              {showProgressionBuilder && (
                <div className="mt-4 pt-4 border-t border-indigo-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-indigo-300">Custom Progression</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCustomProgression([])}
                      className="text-xs h-6"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  
                  {/* Custom Progression Display */}
                  <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-gray-900/50 rounded border-2 border-dashed border-indigo-500/30 mb-3">
                    {customProgression.length === 0 ? (
                      <span className="text-xs text-gray-500 italic">Drag chords here to build your progression...</span>
                    ) : (
                      customProgression.map((chord, index) => (
                        <div
                          key={`custom-${index}`}
                          draggable
                          onDragStart={() => setDraggedChordIndex(index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedChordIndex !== null && draggedChordIndex !== index) {
                              const newProgression = [...customProgression];
                              const [removed] = newProgression.splice(draggedChordIndex, 1);
                              newProgression.splice(index, 0, removed);
                              setCustomProgression(newProgression);
                            }
                            setDraggedChordIndex(null);
                          }}
                          className="flex items-center gap-1 px-3 py-2 bg-indigo-600 rounded cursor-move hover:bg-indigo-500 transition-colors"
                        >
                          <GripVertical className="w-3 h-3 text-indigo-200" />
                          <span className="text-sm font-medium">{chord}</span>
                          <button
                            onClick={() => setCustomProgression(prev => prev.filter((_, i) => i !== index))}
                            className="ml-1 text-indigo-200 hover:text-white"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Available Chords */}
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(DEFAULT_customKeys[currentKey as keyof typeof DEFAULT_customKeys]?.chords || {}).map((chord) => (
                      <button
                        key={chord}
                        onClick={() => setCustomProgression(prev => [...prev, chord])}
                        className="px-2 py-1 bg-gray-700 hover:bg-indigo-600 rounded text-xs font-medium transition-colors"
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        {chord}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
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
          <div className="flex h-full relative overflow-auto" ref={gridRef} onScroll={handleGridScroll}>
            {/* Piano Keys - fixed on left, scrolls with content */}
            <div className="sticky left-0 z-10">
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
            </div>
            
            {/* Grid on right */}
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
              onNoteResize={resizeNote}
              chordMode={chordMode}
              onScroll={handleGridScroll}
              selectedNoteIds={selectedNoteIds}
              onSelectionStart={handleSelectionStart}
              onSelectionMove={handleSelectionMove}
              onSelectionEnd={handleSelectionEnd}
              isSelecting={isSelecting}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
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
            onInstrumentChange={handleInstrumentChange}
          />
        </div>
      </Card>
    </div>
  );
};

export default VerticalPianoRoll;
