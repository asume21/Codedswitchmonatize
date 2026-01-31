import * as React from "react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { 
  Music, Link2, Link2Off, Info, Play, Pause, RotateCw, GripVertical, Plus, Trash2, Circle, Repeat, Wand2, Send, Zap, Undo2, Redo2, Copy, Clipboard, Scissors, ArrowUp, ArrowDown, Grid3X3, Magnet, Eye, EyeOff, Shuffle, MousePointer2, Pencil, Eraser, ZoomIn, ZoomOut, Layers, Guitar, Link, SplitSquareVertical, Repeat1, X, Volume2, FolderOpen, Sliders, Drum, Piano, Waves, Mic2, Sparkles, Download, Square, RotateCcw, VolumeX, Headphones, Settings, BarChart3, TrendingUp, Radio, FileMusic, Filter
} from "lucide-react";
import { Arpeggiator } from "./Arpeggiator";
import { realisticAudio } from "@/lib/realisticAudio";
import { professionalAudio } from "@/lib/professionalAudio";
import { useToast } from "@/hooks/use-toast";
import { useSongWorkSession } from "@/contexts/SongWorkSessionContext";
import { useTransport } from "@/contexts/TransportContext";
import { useTracks } from "@/hooks/useTracks";
import type { TrackClip } from "@/types/studioTracks";
import { useTrackStore } from "@/contexts/TrackStoreContext";
import { useInstrumentOptional } from "@/contexts/InstrumentContext";
import { PianoKeys } from "./PianoKeys";
import { StepGrid } from "./StepGrid";
import { TrackControls } from "./TrackControls";
import { TrackWaveformLane } from "./TrackWaveformLane";
import AILoopGenerator from "./AILoopGenerator";
import { PlaybackControls } from "./PlaybackControls";
import { KeyScaleSelector } from "./KeyScaleSelector";
import { ChordProgressionDisplay } from "./ChordProgressionDisplay";
import GlobalTransportBar from "./GlobalTransportBar";
import { duplicateTrackData } from "@/lib/trackClone";
import { apiRequest } from "@/lib/queryClient";
import { useMIDI } from "@/hooks/use-midi";
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
import { createTrackPayload } from "@/types/studioTracks";

// ISSUE #1: Pattern storage key
const PIANO_ROLL_STORAGE_KEY = "piano-roll-patterns";

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

const DRUM_PITCH_TO_TYPE: Record<number, 'kick' | 'snare' | 'hihat' | 'perc'> = {
  36: 'kick',
  38: 'snare',
  42: 'hihat',
  46: 'perc',
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

interface VerticalPianoRollProps {
  tracks?: any[];
  selectedTrack?: string;
  isPlaying?: boolean;
  currentTime?: number;
  onPlayNote?: (note: string, octave: number, duration: number, instrument: string) => void;
  onPlayNoteOff?: (note: string, octave: number, instrument: string) => void;
  onNotesChange?: (updatedNotes: any[]) => void;
}

export const VerticalPianoRoll: React.FC<VerticalPianoRollProps> = ({
  tracks: propTracks,
  selectedTrack: propSelectedTrack,
  isPlaying: propIsPlaying,
  currentTime: propCurrentTime,
  onPlayNote,
  onPlayNoteOff,
  onNotesChange
}) => {
  // Get transport state from context for sync with floating transport
  const { isPlaying: transportIsPlaying, tempo: transportTempo, play: playTransport, pause: pauseTransport, stop: stopTransportCtx, timeSignature } = useTransport();
  
  // Get global instrument context for unified MIDI/piano roll sync
  const globalInstrument = useInstrumentOptional();
  
  // Get MIDI hook for recording from MIDI controller
  const { 
    isConnected: midiConnected, 
    activeNotes: midiActiveNotes,
    lastNote: midiLastNote 
  } = useMIDI();
  
  // State - sync with transport context
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const isPlaying = propIsPlaying !== undefined ? propIsPlaying : internalIsPlaying;
  
  const [internalCurrentStep, setInternalCurrentStep] = useState(0);
  const currentStep = propCurrentTime !== undefined ? Math.floor(propCurrentTime * 4) : internalCurrentStep;

  const [bpm, setBpm] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [countInEnabled, setCountInEnabled] = useState(true);
  
  const [internalTracks, setInternalTracks] = useState<Track[]>(() => 
    JSON.parse(JSON.stringify(DEFAULT_TRACKS))
  );

  const [trackSettingsOverrides, setTrackSettingsOverrides] = useState<Record<string, Partial<Pick<Track, 'instrument' | 'volume' | 'muted'>>>>({});
  
  // Use prop tracks if provided, otherwise internal
  const tracks = useMemo(() => {
    if (propTracks && propTracks.length > 0) {
      return propTracks.map(t => {
        const override = trackSettingsOverrides[t.id] || {};
        return {
          id: t.id,
          name: t.name,
          color: t.color || 'bg-blue-500',
          notes: t.notes || [],
          muted: override.muted ?? t.muted ?? false,
          volume: override.volume ?? ((t.volume || 0.8) * 100),
          instrument: override.instrument ?? (t.instrument || 'piano')
        };
      });
    }
    return internalTracks;
  }, [propTracks, internalTracks, trackSettingsOverrides]);

  const [internalSelectedTrackIndex, setInternalSelectedTrackIndex] = useState(0);
  
  const selectedTrackIndex = useMemo(() => {
    if (propSelectedTrack) {
      const idx = tracks.findIndex(t => t.id === propSelectedTrack);
      return idx !== -1 ? idx : 0;
    }
    return internalSelectedTrackIndex;
  }, [propSelectedTrack, tracks, internalSelectedTrackIndex]);

  const setSelectedTrackIndex = (idx: number) => {
    setInternalSelectedTrackIndex(idx);
  };

  const setTracks = (newTracks: Track[] | ((prev: Track[]) => Track[])) => {
    if (onNotesChange && propSelectedTrack) {
      const updatedTracks = typeof newTracks === 'function' ? newTracks(tracks) : newTracks;
      const currentTrackNotes = updatedTracks.find(t => t.id === propSelectedTrack)?.notes || [];
      onNotesChange(currentTrackNotes);
    } else {
      setInternalTracks(newTracks as any);
    }
  };

  const setIsPlaying = (playing: boolean) => {
    setInternalIsPlaying(playing);
  };

  const setCurrentStep = (step: number | ((prev: number) => number)) => {
    setInternalCurrentStep(step as any);
  };
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
  const [showTrackOverview, setShowTrackOverview] = useState(true);
  const [clipboard, setClipboard] = useState<Note[]>([]);
  const [pianoRollTool, setPianoRollTool] = useState<'draw' | 'select' | 'erase' | 'slice'>('draw');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Note[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // EVEN MORE ADVANCED FEATURES
  const [arpeggioMode, setArpeggioMode] = useState<'off' | 'up' | 'down' | 'updown' | 'random'>('off');
  const [arpeggioSpeed, setArpeggioSpeed] = useState(4); // steps between notes
  
  // LIVE ARPEGGIATOR - plays notes automatically when keys are held
  const [liveArpEnabled, setLiveArpEnabled] = useState(false);
  const [humanizeAmount, setHumanizeAmount] = useState(0); // 0-100% timing/velocity variation
  const [transposeAmount, setTransposeAmount] = useState(0); // semitones
  const [strumMode, setStrumMode] = useState(false); // guitar-style strum delay
  
  // FINAL MISSING FEATURES
  const [showAILoopGenerator, setShowAILoopGenerator] = useState(false); // AI Loop Generator panel
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
  
  // ADDITIONAL PRO FEATURES
  const [foldViewEnabled, setFoldViewEnabled] = useState(false); // Hide unused keys
  const [horizontalZoom, setHorizontalZoom] = useState(1); // H zoom factor
  const [verticalZoom, setVerticalZoom] = useState(1); // V zoom factor
  const [noteProbability, setNoteProbability] = useState<Record<string, number>>({}); // Per-note probability
  const [legatoMode, setLegatoMode] = useState(false); // Legato/connected notes
  const [portamentoEnabled, setPortamentoEnabled] = useState(false); // Slide between notes
  const [noteRepeatEnabled, setNoteRepeatEnabled] = useState(false); // Note roll/repeat
  const [noteRepeatRate, setNoteRepeatRate] = useState(4); // Repeat divisions (4=16th notes)
  
  // FLOATING PANELS STATE (merged from CodedSwitchFlow)
  const [mixerPanelOpen, setMixerPanelOpen] = useState(false);
  const [browserPanelOpen, setBrowserPanelOpen] = useState(false);
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState(false);
  
  // ISSUE #1: Pattern save/load state
  const [savedPatterns, setSavedPatterns] = useState<Array<{id: string; name: string; tracks: Track[]; bpm: number; key: string}>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PIANO_ROLL_STORAGE_KEY);
      if (saved) {
        try { return JSON.parse(saved); } catch { return []; }
      }
    }
    return [];
  });
  
  // ISSUE #6: Pattern length control
  const [patternSteps, setPatternSteps] = useState(64);
  
  const { toast } = useToast();
  const { currentSession, updateSession } = useSongWorkSession();
  // Use useTracks hook for persistence
  const { tracks: registeredClips, addAndSaveTrack, updateTrack: updateTrackInStore, removeTrack } = useTracks();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pianoKeysRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingNotesRef = useRef<Note[]>([]);
  const selectedTrack = useMemo(() => 
    (tracks[selectedTrackIndex] || tracks[0] || internalTracks[0]) as Track,
    [tracks, selectedTrackIndex, internalTracks]
  );
  const pianoTrackIdRef = useRef<string>(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `piano-${Date.now()}`);
  const hasRegisteredTrackRef = useRef(false);
  const wavCacheRef = useRef<string | null>(null);
  
  // Original song playback state
  const [originalAudioPlaying, setOriginalAudioPlaying] = useState(false);
  const [originalAudioLoaded, setOriginalAudioLoaded] = useState(false);
  const [originalAudioCurrentTime, setOriginalAudioCurrentTime] = useState(0);
  const [originalAudioDuration, setOriginalAudioDuration] = useState(0);
  
  // Find the piano-roll specific issue from the session
  const pianoRollIssue = currentSession?.analysis?.issues?.find(
    issue => issue.targetTool === 'piano-roll'
  );

  // Sync local isPlaying with transport context - this makes floating transport work!
  useEffect(() => {
    if (transportIsPlaying && !isPlaying) {
      // Transport started externally (e.g., floating transport bar)
      handlePlay();
    } else if (!transportIsPlaying && isPlaying) {
      // Transport stopped externally
      handleStop();
    }
  }, [transportIsPlaying]);

  // Sync BPM with transport tempo
  useEffect(() => {
    if (transportTempo && transportTempo !== bpm) {
      setBpm(transportTempo);
    }
  }, [transportTempo]);

  // Listen for Astutely-generated notes and load them into tracks
  // Use ref to avoid stale closure issues
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // 🎹 MIDI RECORDING - Capture notes from MIDI controller when recording
  useEffect(() => {
    if (!midiLastNote || !isRecording) return;
    
    const { note: midiNote, velocity } = midiLastNote;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    const noteName = noteNames[noteIndex];
    
    const now = Date.now();
    
    // Start timer on first note
    let actualStartTime = recordingStartTime;
    if (actualStartTime === 0) {
      actualStartTime = now;
      setRecordingStartTime(now);
      toast({
        title: "🎵 MIDI Recording Started!",
        description: "Timer started - keep playing!",
        duration: 1500,
      });
    }
    
    // Calculate step position based on elapsed time
    const elapsedMs = now - actualStartTime;
    const msPerBeat = 60000 / bpm;
    const msPerStep = msPerBeat / 4; // 16th notes
    const step = Math.round(elapsedMs / msPerStep);
    
    const newNote: Note = {
      id: `midi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      note: noteName,
      octave,
      step,
      velocity: Math.round((velocity / 127) * 127),
      length: 1
    };
    
    recordingNotesRef.current.push(newNote);
    setCurrentStep(step);
    
    console.log(`🎹 MIDI Recorded: ${noteName}${octave} at step ${step}`);
  }, [midiLastNote, isRecording, recordingStartTime, bpm, toast]);
  
  useEffect(() => {
    const handleAstutelyGenerated = (e: CustomEvent<{ notes: any[]; bpm: number; channelMapping?: Record<string, string> }>) => {
      const { notes, bpm: newBpm, channelMapping } = e.detail;
      if (!notes || notes.length === 0) {
        console.warn('🎵 No notes received from AI Loop Generator');
        return;
      }
      
      console.log('🎵 Loading Astutely-generated notes:', notes.length, notes, channelMapping);
      setBpm(newBpm);
      
      // Group notes by track type
      const drumNotes = notes.filter((n: any) => n.trackType === 'drums');
      const bassNotes = notes.filter((n: any) => n.trackType === 'bass');
      const melodyNotes = notes.filter((n: any) => n.trackType === 'melody');
      const chordNotes = notes.filter((n: any) => n.trackType === 'chords');
      
      // Convert Astutely notes to Piano Roll format
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const convertNote = (n: any) => {
        const midiPitch = n.pitch || 60;
        const octave = Math.floor(midiPitch / 12) - 1;
        const noteIndex = midiPitch % 12;
        const noteName = noteNames[noteIndex];
        
        return {
          id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          note: noteName,
          octave: octave,
          step: n.startStep || 0,
          length: Math.max(1, n.duration || 1),
          velocity: n.velocity || 100
        };
      };
      
      // Track which index to select after update
      let bestTrackIndex = 0;
      
      setTracks((prevTracks: Track[]) => {
        const newTracks = [...prevTracks]; // Deep copy
        
        // Find or create tracks for each type
        const findOrCreateTrack = (name: string, instrument: string, color: string, typeHint?: string) => {
          let trackIndex = newTracks.findIndex(t => t.name.toLowerCase().includes(name.toLowerCase()));
          if (trackIndex === -1) {
            const newTrackId = (typeHint && channelMapping && channelMapping[typeHint]) 
              ? channelMapping[typeHint] 
              : `track-${Date.now()}-${name}`;

            const newTrack = {
              id: newTrackId,
              name: name.charAt(0).toUpperCase() + name.slice(1),
              color,
              notes: [] as Note[],
              muted: false,
              volume: 80,
              instrument
            };
            newTracks.push(newTrack);
            trackIndex = newTracks.length - 1;
          }
          return { track: newTracks[trackIndex], index: trackIndex };
        };
        
        // Add drum notes
        if (drumNotes.length > 0) {
          const { track, index } = findOrCreateTrack('drums', 'drums', 'bg-pink-500', 'drums');
          track.notes = drumNotes.map(convertNote);
          bestTrackIndex = index;
          console.log(`🥁 Added ${drumNotes.length} drum notes to track ${index}`);
        }
        
        // Add bass notes
        if (bassNotes.length > 0) {
          const { track, index } = findOrCreateTrack('bass', 'bass-electric', 'bg-green-500', 'bass');
          track.notes = bassNotes.map(convertNote);
          bestTrackIndex = index;
          console.log(`🎸 Added ${bassNotes.length} bass notes to track ${index}`);
        }
        
        // Add chord notes
        if (chordNotes.length > 0) {
          const { track, index } = findOrCreateTrack('chords', 'piano', 'bg-purple-500', 'chords');
          track.notes = chordNotes.map(convertNote);
          bestTrackIndex = index;
          console.log(`🎹 Added ${chordNotes.length} chord notes to track ${index}`);
        }
        
        // Add melody notes (highest priority for display)
        if (melodyNotes.length > 0) {
          const { track, index } = findOrCreateTrack('melody', 'piano', 'bg-blue-500', 'melody');
          track.notes = melodyNotes.map(convertNote);
          bestTrackIndex = index;
          console.log(`🎵 Added ${melodyNotes.length} melody notes to track ${index}`);
        }
        
        console.log('🎵 Updated tracks:', newTracks.map(t => `${t.name}: ${t.notes.length} notes`));
        return newTracks;
      });
      
      // Select the best track after state update
      setTimeout(() => {
        setSelectedTrackIndex(bestTrackIndex);
        console.log(`👁️ Auto-selected track index: ${bestTrackIndex}`);
      }, 50);
      
      toastRef.current({
        title: '🎹 Notes Loaded!',
        description: `${notes.length} notes added to Piano Roll`,
      });
    };
    
    window.addEventListener('astutely:generated', handleAstutelyGenerated as EventListener);
    
    // Check localStorage on mount for any pending notes
    const stored = localStorage.getItem('astutely-generated');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          console.log('🎵 Loading stored notes from localStorage');
          handleAstutelyGenerated(new CustomEvent('astutely:generated', { detail: data }));
        }
        localStorage.removeItem('astutely-generated');
      } catch (e) {
        console.error('Failed to load stored Astutely notes:', e);
      }
    }
    
    return () => {
      window.removeEventListener('astutely:generated', handleAstutelyGenerated as EventListener);
    };
  }, []); // Empty deps - only run once on mount

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
    const noteEndSteps = tracks.flatMap(track => track.notes.map((note: Note) => note.step + note.length));
    if (noteEndSteps.length === 0) {
      return STEPS;
    }
    return Math.max(...noteEndSteps);
  }, [tracks]);

  // NOTE: Auto-sync disabled to prevent duplicate track creation in timeline
  // Tracks are managed by the parent component (UnifiedStudioWorkspace) instead
  // useEffect(() => {
  //   const syncTrack = async () => {
  //     // ... sync logic removed to prevent duplicates
  //   };
  //   syncTrack();
  // }, [tracks, bpm, currentKey, selectedProgression, selectedTrack, addAndSaveTrack, updateTrackInStore, patternLengthSteps]);

  useEffect(() => {
    if (currentSession) {
      updateSession(currentSession.sessionId, { tracks: registeredClips });
    }
  }, [registeredClips, currentSession, updateSession]);

  // Check if we're being controlled externally
  const isExternallyControlled = propCurrentTime !== undefined;
  
  // Track the previous step to detect step changes for external playback
  const prevStepRef = useRef<number>(-1);
  
  // Effect to play notes when externally controlled and step changes
  useEffect(() => {
    if (!isExternallyControlled || !propIsPlaying) return;
    
    const newStep = Math.floor(propCurrentTime * 4) % STEPS;
    if (newStep === prevStepRef.current) return;
    
    prevStepRef.current = newStep;
    const stepDuration = (60 / bpm / 4);
    
    // Play notes at the current step
    tracks.forEach(track => {
      if (!track.muted) {
        const notesAtStep = track.notes.filter((note: Note) => note.step === newStep);
        notesAtStep.forEach((note: Note) => {
          const noteDuration = note.length * stepDuration;
          
          if (onPlayNote) {
            // Use parent's playNote for centralized audio routing
            onPlayNote(note.note, note.octave, noteDuration, track.instrument);
          } else {
            // Fallback to direct playback
            const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === track.id);
            realisticAudio.playNote(
              note.note,
              note.octave,
              noteDuration,
              track.instrument,
              track.volume / 100,
              true,
              mixerChannel?.input
            );
          }
        });
      }
    });
  }, [isExternallyControlled, propIsPlaying, propCurrentTime, bpm, tracks, onPlayNote]);

  // Playback control - synced with transport context
  const handlePlay = useCallback(() => {
    // If externally controlled, don't run internal playback - just toggle state
    if (isExternallyControlled) {
      setIsPlaying(!isPlaying);
      if (isPlaying) {
        pauseTransport();
      } else {
        playTransport();
      }
      return;
    }
    
    if (isPlaying) {
      // Pause
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
      pauseTransport(); // Sync with transport context
    } else {
      // Play
      console.log('▶️ Starting playback...');
      tracks.forEach((track, idx) => {
        console.log(`Track ${idx} (${track.name}): ${track.notes.length} notes`, track.notes);
      });
      
      setIsPlaying(true);
      playTransport(); // Sync with transport context
      
      const stepDuration = (60 / bpm / 4) * 1000; // 16th note duration in ms

      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const nextStep = (prev + 1) % STEPS;
          
          // Play notes at the current step
          tracks.forEach(track => {
            if (!track.muted) {
              const notesAtStep = track.notes.filter((note: Note) => note.step === nextStep);
              if (notesAtStep.length > 0) {
                console.log(`🎵 Step ${nextStep}: Playing ${notesAtStep.length} notes`, notesAtStep);
              }
              notesAtStep.forEach((note: Note) => {
                const noteDuration = (note.length * stepDuration) / 1000;
                
                // Route to mixer channel
                const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === track.id);
                
                realisticAudio.playNote(
                  note.note,
                  note.octave,
                  noteDuration,
                  track.instrument,
                  track.volume / 100,
                  true,
                  mixerChannel?.input
                );
              });
            }
          });

          return nextStep;
        });
      }, stepDuration);
    }
  }, [isPlaying, bpm, tracks, playTransport, pauseTransport, isExternallyControlled]);

  const handleStop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(0);
    stopTransportCtx(); // Use context stop to sync with floating transport
  }, [stopTransportCtx]);

  // 🎙️ RECORDING CONTROLS
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingStartTime(0); // Will be set on first note!
    recordingNotesRef.current = [];
    setCurrentStep(0);
    toast({
      title: "🔴 Recording Armed",
      description: "Play your first note to start - timing begins when you play!",
    });
  }, [toast]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    
    // CRITICAL: Store notes in local variable BEFORE clearing ref!
    const recordedNotes = [...recordingNotesRef.current];
    console.log('🎵 Stopping recording with notes:', recordedNotes);
    
    // Clear the ref immediately
    recordingNotesRef.current = [];
    
    // 🔄 RETURN TO BEGINNING when recording stops
    setCurrentStep(0);
    
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

  // 🔄 RETURN TO BEGINNING button
  const goToBeginning = useCallback(() => {
    setCurrentStep(0);
    if (isPlaying) {
      handleStop();
    }
    toast({
      title: "⏮️ Back to Start",
      description: "Playhead returned to beginning",
      duration: 1500,
    });
  }, [isPlaying, handleStop, toast]);

  // ADVANCED FEATURE FUNCTIONS (moved before keyboard shortcuts to fix declaration order)
  
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
    const selectedNotes = selectedTrack.notes.filter((n: Note) => selectedNoteIds.has(n.id));
    setClipboard(selectedNotes);
    toast({ title: '📋 Copied', description: `${selectedNotes.length} note${selectedNotes.length === 1 ? '' : 's'} copied` });
  }, [selectedNoteIds, selectedTrack, toast]);

  // Paste notes
  const pasteNotes = useCallback(() => {
    if (clipboard.length === 0) return;
    const minStep = Math.min(...clipboard.map((n: Note) => n.step));
    const newNotes = clipboard.map((note: Note) => ({
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
    const updatedNotes = selectedTrack.notes.filter((n: Note) => !selectedNoteIds.has(n.id));
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    setSelectedNoteIds(new Set());
    toast({ title: '🗑️ Deleted', description: `${selectedNoteIds.size} note${selectedNoteIds.size === 1 ? '' : 's'} removed` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, addToHistory, toast]);

  // 🎹 KEYBOARD SHORTCUTS - Play piano with your QWERTY keyboard!
  useEffect(() => {
    const pressedKeys = new Set<string>();

    const handleKeyDown = (ev: KeyboardEvent) => {
      // Don't capture if user is typing in an input field
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      
      const k = ev.key.toLowerCase();
      
      // Prevent key repeat
      if (pressedKeys.has(k)) return;
      pressedKeys.add(k);

      // SPACE - Play/Pause
      if (k === ' ') {
        ev.preventDefault();
        handlePlay();
        return;
      }

      // ENHANCED: Number keys 1-7 trigger chords from progression
      if (k >= '1' && k <= '7') {
        ev.preventDefault();
        const chordIndex = parseInt(k) - 1;
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
            const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === selectedTrack.id);
            chordNotes.forEach((note, index) => {
              setTimeout(() => {
                realisticAudio.playNote(
                  note, 
                  4, 
                  0.8, 
                  selectedTrack.instrument, 
                  selectedTrack.volume / 100,
                  true,
                  mixerChannel?.input
                );
              }, index * 50);
            });
          }
          
          // Visual feedback
          toast({
            title: `${chordSymbol} Chord`,
            description: `Inversion: ${chordInversion === 0 ? 'Root' : chordInversion === 1 ? '1st' : '2nd'} • Notes: ${chordNotes?.join('-')}`,
          });
          setTracks((prev: Track[]) => {
            const c = [...prev];
            c[selectedTrackIndex] = { ...c[selectedTrackIndex], volume: selectedTrack.volume };
            return c;
          });
        }
        return;
      }

      // CTRL + KEYS
      if (ev.ctrlKey || ev.metaKey) {
        // Ctrl+Z - Undo
        if (k === 'z' && !ev.shiftKey) {
          ev.preventDefault();
          undo();
          return;
        }
        if (k === 'y' || (k === 'z' && ev.shiftKey)) {
          ev.preventDefault();
          redo();
          return;
        }
        // Ctrl+C - Copy
        if (k === 'c' && selectedNoteIds.size > 0) {
          ev.preventDefault();
          copySelected();
          return;
        }
        // Ctrl+V - Paste
        if (k === 'v') {
          ev.preventDefault();
          pasteNotes();
          return;
        }
        // Ctrl+A - Select all
        if (k === 'a') {
          ev.preventDefault();
          setSelectedNoteIds(new Set(selectedTrack.notes.map((n: Note) => n.id)));
          toast({ title: 'All Selected' });
          return;
        }
        // Ctrl+I - Cycle chord inversion
        if (k === 'i') {
          ev.preventDefault();
          setChordInversion((prev) => (prev + 1) % 3);
          return;
        }
      }

      // Delete/Backspace - Delete selected notes
      if ((k === 'delete' || k === 'backspace') && selectedNoteIds.size > 0) {
        ev.preventDefault();
        deleteSelected();
        return;
      }

      // FLOATING PANEL SHORTCUTS
      // M - Toggle Mixer Panel
      if (k === 'm' && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        setMixerPanelOpen(prev => !prev);
        return;
      }
      // B - Toggle Browser Panel
      if (k === 'b' && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        setBrowserPanelOpen(prev => !prev);
        return;
      }
      // I - Toggle Inspector Panel (only without Ctrl)
      if (k === 'i' && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        setInspectorPanelOpen(prev => !prev);
        return;
      }
      // Escape - Close all panels
      if (k === 'escape') {
        ev.preventDefault();
        setMixerPanelOpen(false);
        setBrowserPanelOpen(false);
        setInspectorPanelOpen(false);
        return;
      }

      // Check if this key maps to a piano note
      const noteMapping = KEYBOARD_TO_NOTE[k];
      if (noteMapping) {
        ev.preventDefault();
        
        // Find the piano key index
        const keyIndex = PIANO_KEYS.findIndex(
          pk => pk.note === noteMapping.note && pk.octave === noteMapping.octave
        );

        if (keyIndex !== -1) {
          // Play the note
          const pianoKey = PIANO_KEYS[keyIndex];
          const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === selectedTrack.id);
          realisticAudio.playNote(
            pianoKey.note,
            pianoKey.octave,
            0.8,
            selectedTrack.instrument,
            selectedTrack.volume / 100,
            true,
            mixerChannel?.input
          );

          // RECORDING MODE - Capture timing!
          if (isRecording) {
            const now = Date.now();
            
            // 🎯 FIRST NOTE STARTS THE TIMER - no rushing after hitting record!
            let actualStartTime = recordingStartTime;
            if (actualStartTime === 0) {
              // This is the first note - start the timer NOW
              actualStartTime = now;
              setRecordingStartTime(now);
              toast({
                title: "🎵 Recording Started!",
                description: "Timer started - keep playing!",
                duration: 1500,
              });
              console.log('🎬 Recording timer started on first note!');
            }
            
            const elapsedMs = now - actualStartTime;
            // Convert milliseconds to steps based on BPM
            const msPerStep = (60000 / bpm) / 4;
            
            // 🎹 CHORD TOLERANCE
            const CHORD_TOLERANCE_MS = 150;
            
            let step: number;
            const recentNotes = recordingNotesRef.current;
            
            if (recentNotes.length > 0) {
              const lastNote = recentNotes[recentNotes.length - 1];
              const lastNoteTimestamp = parseInt(lastNote.id.split('-').pop() || '0');
              const timeSinceLastNote = now - lastNoteTimestamp;
              
              if (timeSinceLastNote <= CHORD_TOLERANCE_MS) {
                step = lastNote.step;
              } else {
                const rawStep = elapsedMs / msPerStep;
                step = Math.round(rawStep) % STEPS;
              }
            } else {
              step = 0;
            }
            
            step = step % STEPS;
            
            const newNote: Note = {
              id: `rec-${pianoKey.key}-${now}`,
              note: pianoKey.note,
              octave: pianoKey.octave,
              step,
              velocity: 100,
              length: 1
            };
            
            recordingNotesRef.current.push(newNote);
            setCurrentStep(step);
          } 
          else if (chordMode) {
            setActiveKeys(prev => {
              const next = new Set(prev);
              next.add(keyIndex);
              return next;
            });
            const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === selectedTrack.id);
            realisticAudio.playNote(
              pianoKey.note, 
              pianoKey.octave, 
              0.8, 
              selectedTrack.instrument, 
              selectedTrack.volume / 100,
              true,
              mixerChannel?.input
            );
          }
        }
      }
    };

    const handleKeyUp = (ev: KeyboardEvent) => {
      pressedKeys.delete(ev.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePlay, isRecording, recordingStartTime, bpm, selectedTrack, chordMode, selectedProgression, currentKey, chordInversion, selectedTrackIndex, selectedNoteIds, deleteSelected, copySelected, pasteNotes, redo, undo, toast]);

  const resizeNote = useCallback((noteId: string, newLength: number) => {
    setTracks(prev => {
      const newTracks = [...prev];
      const track = newTracks[selectedTrackIndex];
      if (!track) return prev;
      
      newTracks[selectedTrackIndex] = {
        ...track,
        notes: track.notes.map(note => 
          note.id === noteId ? { ...note, length: newLength } : note
        )
      };
      return newTracks;
    });
  }, [selectedTrackIndex]);

  const clearAll = useCallback(() => {
    console.log('🗑️ Clear button clicked, clearing track:', selectedTrackIndex);
    setTracks(prev => {
      const newTracks = [...prev];
      const track = newTracks[selectedTrackIndex];
      if (!track) return prev;
      
      newTracks[selectedTrackIndex] = { ...track, notes: [] };
      return newTracks;
    });
    toast({
      title: "Notes Cleared",
      description: `Cleared all notes from track ${selectedTrackIndex + 1}`,
    });
  }, [selectedTrackIndex, toast]);

  // Move a note to a new position (drag and drop)
  const moveNote = useCallback((noteId: string, newStep: number, newKeyIndex: number) => {
    const newKey = PIANO_KEYS[newKeyIndex];
    if (!newKey) return;
    
    setTracks(prev => {
      const newTracks = [...prev];
      const track = newTracks[selectedTrackIndex];
      if (!track) return prev;
      
      newTracks[selectedTrackIndex] = {
        ...track,
        notes: track.notes.map(note => 
          note.id === noteId 
            ? { ...note, step: newStep, note: newKey.note, octave: newKey.octave }
            : note
        )
      };
      return newTracks;
    });
  }, [selectedTrackIndex]);

  // Remove a note from the grid
  const removeNote = useCallback((noteId: string) => {
    setTracks(prev => {
      const newTracks = [...prev];
      const track = newTracks[selectedTrackIndex];
      if (!track) return prev;
      
      const updatedNotes = track.notes.filter((n: Note) => n.id !== noteId);
      newTracks[selectedTrackIndex] = { ...track, notes: updatedNotes };
      addToHistory(updatedNotes);
      return newTracks;
    });
  }, [selectedTrackIndex, addToHistory]);

  // Add a note to the grid (used by PianoKeys and StepGrid)
  const addNote = useCallback((keyIndex: number, step?: number) => {
    const pianoKey = PIANO_KEYS[keyIndex];
    if (!pianoKey) return;
    
    const targetStep = step ?? currentStep;
    
    setTracks(prev => {
      const newTracks = [...prev];
      const track = newTracks[selectedTrackIndex];
      if (!track) return prev;
      
      // Check if note already exists at this position
      const existingNote = track.notes.find(
        (n: Note) => n.note === pianoKey.note && n.octave === pianoKey.octave && n.step === targetStep
      );
      
      if (existingNote) {
        // If note exists, remove it (toggle behavior)
        const updatedNotes = track.notes.filter((n: Note) => n.id !== existingNote.id);
        newTracks[selectedTrackIndex] = { ...track, notes: updatedNotes };
        addToHistory(updatedNotes);
        return newTracks;
      }
      
      // Create new note
      const newNote: Note = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        note: pianoKey.note,
        octave: pianoKey.octave,
        step: targetStep,
        velocity: 100,
        length: 1
      };
      
      // Play the note for audio feedback
      const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === track.id);
      realisticAudio.playNote(
        pianoKey.note,
        pianoKey.octave,
        0.8,
        track.instrument,
        track.volume / 100,
        true,
        mixerChannel?.input
      );
      
      const updatedNotes = [...track.notes, newNote];
      newTracks[selectedTrackIndex] = { ...track, notes: updatedNotes };
      addToHistory(updatedNotes);
      return newTracks;
    });
  }, [currentStep, selectedTrackIndex, addToHistory]);

  // Copy a note to a new position (Alt+drag)
  const copyNote = useCallback((noteId: string, newStep: number, newKeyIndex: number) => {
    const newKey = PIANO_KEYS[newKeyIndex];
    if (!newKey) return;
    
    setTracks(prev => prev.map((track, index) => {
      if (index !== selectedTrackIndex) return track;
      
      const originalNote = track.notes.find(n => n.id === noteId);
      if (!originalNote) return track;
      
      // Create a copy with new ID and position
      const copiedNote: Note = {
        ...originalNote,
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        step: newStep,
        note: newKey.note,
        octave: newKey.octave,
      };
      
      return { ...track, notes: [...track.notes, copiedNote] };
    }));
    
    toast({ title: '📋 Note Copied', description: `${newKey.note}${newKey.octave} at step ${newStep + 1}` });
  }, [selectedTrackIndex, toast]);

  // Resize multiple notes at once
  const resizeMultipleNotes = useCallback((noteIds: string[], deltaLength: number) => {
    setTracks(prev => {
      const newTracks = [...prev];
      const track = newTracks[selectedTrackIndex];
      if (!track) return prev;
      
      newTracks[selectedTrackIndex] = {
        ...track,
        notes: track.notes.map(note => 
          noteIds.includes(note.id)
            ? { ...note, length: Math.max(1, (note.length || 1) + deltaLength) }
            : note
        )
      };
      return newTracks;
    });
  }, [selectedTrackIndex]);

  // Select/deselect a note
  const selectNote = useCallback((noteId: string, addToSelection: boolean) => {
    setSelectedNoteIds(prev => {
      const next = new Set(addToSelection ? prev : []);
      if (prev.has(noteId) && addToSelection) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  }, []);

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
          const mixerChannel = professionalAudio.getChannels().find(ch => ch.id === selectedTrack.id);
          setTimeout(() => {
            realisticAudio.playNote(
              pianoKey.note, 
              pianoKey.octave, 
              0.8, 
              selectedTrack.instrument, 
              selectedTrack.volume / 100,
              true,
              mixerChannel?.input
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
    setTrackSettingsOverrides(prev => ({
      ...prev,
      [trackId]: { ...(prev[trackId] || {}), volume }
    }));

    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, volume } : track
    ));

    // Persist to shared track store when Piano Roll is driven by external tracks
    if (propTracks && propTracks.length > 0) {
      updateTrackInStore(trackId, { volume: volume / 100 });
    }
  }, [propTracks, updateTrackInStore]);

  const handleMuteToggle = useCallback((trackId: string) => {
    const currentMuted = trackSettingsOverrides[trackId]?.muted ?? tracks.find(t => t.id === trackId)?.muted ?? false;
    const nextMuted = !currentMuted;

    setTrackSettingsOverrides(prev => ({
      ...prev,
      [trackId]: { ...(prev[trackId] || {}), muted: nextMuted }
    }));

    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, muted: nextMuted } : track
    ));

    if (propTracks && propTracks.length > 0) {
      updateTrackInStore(trackId, { muted: nextMuted });
    }
  }, [propTracks, trackSettingsOverrides, tracks, updateTrackInStore]);

  const handleInstrumentChange = useCallback((trackId: string, instrument: string) => {
    setTrackSettingsOverrides(prev => ({
      ...prev,
      [trackId]: { ...(prev[trackId] || {}), instrument }
    }));

    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, instrument } : track
    ));
    
    // Persist to shared track store when Piano Roll is driven by external tracks
    if (propTracks && propTracks.length > 0) {
      updateTrackInStore(trackId, { instrument });
    }

    // Update global instrument context for MIDI sync
    if (globalInstrument?.setCurrentInstrument) {
      globalInstrument.setCurrentInstrument(instrument);
    }
    
    // Pre-load the instrument
    realisticAudio.loadAdditionalInstrument(instrument).then(() => {
      toast({
        title: "Instrument Loaded",
        description: `Changed track instrument to ${AVAILABLE_INSTRUMENTS.find(i => i.value === instrument)?.label}`,
      });
    });
  }, [toast, globalInstrument, propTracks, updateTrackInStore]);

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

  // Update note velocity
  const updateNoteVelocity = useCallback((noteId: string, velocity: number) => {
    setTracks(prev => {
      const newTracks = [...prev];
      const track = newTracks[selectedTrackIndex];
      if (!track) return prev;
      
      newTracks[selectedTrackIndex] = {
        ...track,
        notes: track.notes.map((n: Note) => 
          n.id === noteId ? { ...n, velocity: Math.max(1, Math.min(127, velocity)) } : n
        )
      };
      return newTracks;
    });
  }, [selectedTrackIndex]);

  // ARPEGGIO FUNCTION
  const applyArpeggio = useCallback(() => {
    if (selectedNoteIds.size === 0 || arpeggioMode === 'off') return;
    
    const selectedNotes = selectedTrack.notes.filter((n: Note) => selectedNoteIds.has(n.id));
    if (selectedNotes.length === 0) return;
    
    // Sort notes by pitch
    const sortedNotes = [...selectedNotes].sort((a, b) => {
      const pitchA = a.octave * 12 + ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(a.note);
      const pitchB = b.octave * 12 + ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(b.note);
      return pitchA - pitchB;
    });
    
    // Apply arpeggio pattern
    let arpeggioNotes: Note[] = [];
    const baseStep = Math.min(...selectedNotes.map((n: Note) => n.step));
    
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
    const otherNotes = selectedTrack.notes.filter((n: Note) => !selectedNoteIds.has(n.id));
    const updatedNotes = [...otherNotes, ...arpeggioNotes];
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    setSelectedNoteIds(new Set(arpeggioNotes.map((n: Note) => n.id)));
    toast({ title: '🎵 Arpeggio Applied', description: `${arpeggioMode.toUpperCase()} pattern created` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, arpeggioMode, arpeggioSpeed, addToHistory, toast]);

  // HUMANIZE FUNCTION
  const applyHumanize = useCallback(() => {
    if (selectedNoteIds.size === 0 || humanizeAmount === 0) return;
    
    const updatedNotes = selectedTrack.notes.map((note: Note) => {
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
    
    const updatedNotes = selectedTrack.notes.map((note: Note) => {
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
    
    const updatedNotes = selectedTrack.notes.map((note: Note) => {
      if (!selectedNoteIds.has(note.id)) return note;
      return { ...note, octave: Math.max(0, Math.min(8, note.octave + direction)) };
    });
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    toast({ title: '🎵 Octave Shifted', description: `${direction > 0 ? 'Up' : 'Down'} one octave` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, addToHistory, toast]);

  // SLICE NOTES AT PLAYHEAD
  const sliceNotesAtPlayhead = useCallback(() => {
    const sliceStep = currentStep;
    
    // Check if playhead is at the beginning
    if (sliceStep === 0) {
      toast({ 
        title: '⚠️ Position Playhead First', 
        description: 'Click on a step number in the timeline header to position the playhead where you want to slice',
        duration: 4000
      });
      return;
    }
    
    const notesToSlice = selectedTrack.notes.filter((note: Note) => 
      note.step < sliceStep && (note.step + note.length) > sliceStep
    );
    
    if (notesToSlice.length === 0) {
      toast({ 
        title: 'No notes at playhead', 
        description: `No notes span across step ${sliceStep + 1}. Click timeline to move playhead over a note.`
      });
      return;
    }
    
    let sliceCounter = 0;
    const slicedNotes: Note[] = [];
    const updatedNotes = selectedTrack.notes.filter((note: Note) => {
      if (note.step < sliceStep && (note.step + note.length) > sliceStep) {
        const leftPart: Note = {
          ...note,
          length: sliceStep - note.step
        };
        const rightPart: Note = {
          ...note,
          id: crypto.randomUUID ? crypto.randomUUID() : `slice-${Date.now()}-${++sliceCounter}-${note.id}`,
          step: sliceStep,
          length: note.step + note.length - sliceStep
        };
        slicedNotes.push(leftPart, rightPart);
        return false;
      }
      return true;
    });
    
    const newNotes = [...updatedNotes, ...slicedNotes];
    addToHistory(newNotes);
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: newNotes } : track
    ));
    
    toast({ title: 'Notes Sliced', description: `Split ${notesToSlice.length} note(s) at step ${sliceStep}` });
  }, [currentStep, selectedTrack, selectedTrackIndex, addToHistory, toast]);

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

  // AI NEURAL MELODY GENERATION
  const handleAISuggest = useCallback(async () => {
    try {
      toast({ 
        title: '🪄 Neural Processing', 
        description: 'Generating holographic melody ideas...',
      });

      const stepDurationSeconds = 60 / bpm / 4; 
      const response = await apiRequest('POST', '/api/melody/generate', {
        scale: `${currentKey} Major`,
        style: 'melodic',
        complexity: 5,
        availableTracks: tracks.map((t) => ({
          instrument: t.instrument,
          name: t.name,
          notes: t.notes?.length || 0,
        })),
        musicalParams: {
          bpm,
          key: currentKey,
          timeSignature: '4/4',
        },
      });

      const result = await response.json();
      const aiNotes = result?.data?.notes || result?.data || [];
      
      if (!Array.isArray(aiNotes) || aiNotes.length === 0) {
        throw new Error('No holographic data returned from neural engine');
      }

      const generatedNotes: Note[] = aiNotes.map((n: any, index: number) => {
        const timeSec = n.time ?? n.start ?? 0;
        const durationSec = n.duration ?? stepDurationSeconds;
        const step = Math.max(0, Math.round(timeSec / stepDurationSeconds));
        const length = Math.max(1, Math.round(durationSec / stepDurationSeconds));
        return {
          id: `ai-note-${Date.now()}-${index}`,
          note: n.note || n.pitch || 'C',
          octave: n.octave ?? 4,
          step,
          length,
          velocity: Math.max(1, Math.min(127, Math.round((n.velocity ?? 0.8) * 127))),
        };
      });

      setTracks((prev) =>
        prev.map((track, idx) =>
          idx === selectedTrackIndex ? { ...track, notes: generatedNotes } : track
        )
      );
      addToHistory(generatedNotes);

      toast({ 
        title: '✨ Sequence Synchronized', 
        description: `Successfully injected ${generatedNotes.length} notes into ${selectedTrack.name}`,
      });
    } catch (error) {
      console.error('Neural suggestion failed:', error);
      toast({ 
        title: 'Neural Engine Error', 
        description: error instanceof Error ? error.message : 'Could not synchronize melody sequence',
        variant: 'destructive'
      });
    }
  }, [apiRequest, addToHistory, bpm, currentKey, selectedTrack.name, selectedTrackIndex, toast, tracks]);

  const noteToMidi = (key: string) => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = key.match(/([A-G]#?)(-?\d)/);
    if (!match) return 60;
    const [, note, oct] = match;
    const idx = names.indexOf(note.toUpperCase());
    const octave = parseInt(oct, 10);
    return (octave + 1) * 12 + idx;
  };

  const renderNotesToAudioBuffer = async (notes: Note[], bpmValue: number) => {
    const secondsPerBeat = 60 / bpmValue;
    // Cast notes to any to handle different note formats (some have time/duration, others have step/length)
    const anyNotes = notes as any[];
    const duration = Math.max(
      anyNotes.reduce((m, n) => Math.max(m, (n.time ?? n.step ?? 0) + (n.duration ?? n.length ?? 0.5)), 1) * secondsPerBeat,
      1
    );
    const sampleRate = 44100;
    const offline = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);

    anyNotes.forEach((n) => {
      const start = (n.time ?? n.step ?? 0) * secondsPerBeat;
      const len = (n.duration ?? n.length ?? 0.5) * secondsPerBeat;
      const freq = 220 * Math.pow(2, ((n.midi ?? noteToMidi(n.key ?? `${n.note ?? 'C'}${n.octave ?? 4}`)) - 60) / 12);
      const osc = offline.createOscillator();
      const gain = offline.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
      osc.connect(gain).connect(offline.destination);
      osc.start(start);
      osc.stop(start + len + 0.05);
    });

    return offline.startRendering();
  };

  const bufferToWav = (buffer: AudioBuffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    let offset = 0;

    const writeString = (s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
    };

    writeString('RIFF');
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, buffer.sampleRate, true); offset += 4;
    view.setUint32(offset, buffer.sampleRate * numOfChan * 2, true); offset += 4;
    view.setUint16(offset, numOfChan * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString('data');
    view.setUint32(offset, length - offset - 4, true); offset += 4;

    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChan; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  };

  const handleSendToMaster = useCallback(async () => {
    try {
      const notePool = tracks.flatMap(t => t.notes);
      if (notePool.length === 0) {
        toast({ title: "Nothing to send", description: "Add some notes first.", variant: "destructive" });
        return;
      }

      const audioBuffer = await renderNotesToAudioBuffer(notePool, bpm);
      const wavBuffer = bufferToWav(audioBuffer);
      const url = URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' }));
      wavCacheRef.current = url;

      const existingPayload = registeredClips.find(c => c.id === pianoTrackIdRef.current)?.payload;
      updateTrackInStore(pianoTrackIdRef.current, {
        payload: createTrackPayload({
          ...existingPayload,
          notes: notePool,
          waveformUrl: url,
          type: 'audio',
          source: 'piano-roll'
        })
      });

      window.dispatchEvent(new CustomEvent('importToMultiTrack', {
        detail: {
          type: 'melody',
          name: `Piano Roll ${selectedTrack?.name ?? ''}`.trim(),
          audioData: wavBuffer,
        }
      }));

      toast({ title: "Sent to Master", description: "Piano roll bounced to arrangement." });
    } catch (error) {
      console.error('Send to master failed', error);
      toast({ title: "Send failed", description: "Could not bounce piano roll.", variant: "destructive" });
    }
  }, [tracks, bpm, toast, registeredClips, updateTrackInStore, selectedTrack]);

  // DUPLICATE TRACK FUNCTION
  const duplicateTrack = useCallback(() => {
    if (!selectedTrack) return;
    const newTrack: Track = duplicateTrackData(selectedTrack);
    setTracks(prev => [...prev, newTrack]);
    toast({ title: '📋 Track Duplicated', description: `${selectedTrack.name} copied` });
  }, [selectedTrack, toast]);

  // CHORD DETECTION FUNCTION
  const detectChord = useCallback(() => {
    if (selectedNoteIds.size === 0) return;
    
    const selectedNotes = selectedTrack.notes.filter((n: Note) => selectedNoteIds.has(n.id));
    if (selectedNotes.length < 2) {
      setDetectedChord('Single Note');
      return;
    }
    
    // Get unique note names (ignore octaves)
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const uniqueNotes = Array.from(new Set(selectedNotes.map((n: Note) => n.note))) as string[];
    
    // Simple chord detection
    const intervals = uniqueNotes.map((note: string) => noteNames.indexOf(note)).sort((a, b) => a - b);
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
    
    const updatedNotes = selectedTrack.notes.map((note: Note) => {
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

  // ISSUE #1: Save pattern to localStorage
  const savePattern = useCallback(() => {
    const name = prompt('Enter pattern name:', `Pattern ${savedPatterns.length + 1}`);
    if (!name) return;
    
    const newPattern = {
      id: `pattern-${Date.now()}`,
      name,
      tracks: JSON.parse(JSON.stringify(tracks)),
      bpm,
      key: currentKey
    };
    
    const updated = [...savedPatterns, newPattern];
    setSavedPatterns(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PIANO_ROLL_STORAGE_KEY, JSON.stringify(updated));
    }
    toast({ title: '💾 Pattern Saved', description: `"${name}" saved to library` });
  }, [tracks, bpm, currentKey, savedPatterns, toast]);

  // ISSUE #1: Load pattern from localStorage
  const loadPattern = useCallback((patternId: string) => {
    const pattern = savedPatterns.find(p => p.id === patternId);
    if (!pattern) return;
    
    setTracks(JSON.parse(JSON.stringify(pattern.tracks)));
    setBpm(pattern.bpm);
    setCurrentKey(pattern.key);
    toast({ title: '📂 Pattern Loaded', description: `"${pattern.name}" loaded` });
  }, [savedPatterns, toast]);

  // ISSUE #1: Delete pattern from localStorage
  const deletePattern = useCallback((patternId: string) => {
    const updated = savedPatterns.filter(p => p.id !== patternId);
    setSavedPatterns(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PIANO_ROLL_STORAGE_KEY, JSON.stringify(updated));
    }
    toast({ title: '🗑️ Pattern Deleted' });
  }, [savedPatterns, toast]);

  // ISSUE #2: Export as MIDI file
  const exportMIDI = useCallback(() => {
    const allNotes = tracks.flatMap(t => t.notes);
    if (allNotes.length === 0) {
      toast({ title: 'No notes to export', variant: 'destructive' });
      return;
    }
    
    // Simple MIDI file format (Type 0)
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const ticksPerBeat = 480;
    const ticksPerStep = ticksPerBeat / 4; // 16th notes
    
    // Build MIDI events
    const events: Array<{time: number; type: 'on' | 'off'; note: number; velocity: number}> = [];
    
    allNotes.forEach(note => {
      const midiNote = (note.octave + 1) * 12 + noteNames.indexOf(note.note);
      const startTick = note.step * ticksPerStep;
      const endTick = (note.step + note.length) * ticksPerStep;
      
      events.push({ time: startTick, type: 'on', note: midiNote, velocity: note.velocity });
      events.push({ time: endTick, type: 'off', note: midiNote, velocity: 0 });
    });
    
    // Sort by time
    events.sort((a, b) => a.time - b.time);
    
    // Build MIDI binary
    const midiData: number[] = [];
    
    // Header chunk
    midiData.push(0x4D, 0x54, 0x68, 0x64); // "MThd"
    midiData.push(0x00, 0x00, 0x00, 0x06); // Header length
    midiData.push(0x00, 0x00); // Format type 0
    midiData.push(0x00, 0x01); // 1 track
    midiData.push((ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF); // Ticks per beat
    
    // Track chunk
    const trackData: number[] = [];
    
    // Tempo meta event (microseconds per beat)
    const microsecondsPerBeat = Math.round(60000000 / bpm);
    trackData.push(0x00); // Delta time
    trackData.push(0xFF, 0x51, 0x03); // Tempo meta event
    trackData.push((microsecondsPerBeat >> 16) & 0xFF);
    trackData.push((microsecondsPerBeat >> 8) & 0xFF);
    trackData.push(microsecondsPerBeat & 0xFF);
    
    // Note events
    let lastTime = 0;
    events.forEach(event => {
      const delta = event.time - lastTime;
      lastTime = event.time;
      
      // Variable length delta time
      if (delta < 128) {
        trackData.push(delta);
      } else {
        trackData.push(0x80 | ((delta >> 7) & 0x7F));
        trackData.push(delta & 0x7F);
      }
      
      // Note on/off
      trackData.push(event.type === 'on' ? 0x90 : 0x80);
      trackData.push(event.note);
      trackData.push(event.velocity);
    });
    
    // End of track
    trackData.push(0x00, 0xFF, 0x2F, 0x00);
    
    // Track header
    midiData.push(0x4D, 0x54, 0x72, 0x6B); // "MTrk"
    const trackLength = trackData.length;
    midiData.push((trackLength >> 24) & 0xFF);
    midiData.push((trackLength >> 16) & 0xFF);
    midiData.push((trackLength >> 8) & 0xFF);
    midiData.push(trackLength & 0xFF);
    midiData.push(...trackData);
    
    // Download
    const blob = new Blob([new Uint8Array(midiData)], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `piano-roll-${Date.now()}.mid`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({ title: '🎹 MIDI Exported', description: `${allNotes.length} notes exported` });
  }, [tracks, bpm, toast]);

  // ISSUE #3: Quantize selected notes
  const quantizeNotes = useCallback((quantizeValue: number = 4) => {
    if (selectedNoteIds.size === 0) {
      toast({ title: 'Select notes first', variant: 'destructive' });
      return;
    }
    
    const updatedNotes = selectedTrack.notes.map((note: Note) => {
      if (!selectedNoteIds.has(note.id)) return note;
      const quantizedStep = Math.round(note.step / quantizeValue) * quantizeValue;
      return { ...note, step: quantizedStep };
    });
    
    setTracks(prev => prev.map((track, index) =>
      index === selectedTrackIndex ? { ...track, notes: updatedNotes } : track
    ));
    addToHistory(updatedNotes);
    toast({ title: '🎯 Quantized', description: `${selectedNoteIds.size} notes snapped to 1/${16/quantizeValue} grid` });
  }, [selectedNoteIds, selectedTrack, selectedTrackIndex, addToHistory, toast]);

  // ISSUE #5: Clear all tracks
  const clearAllTracks = useCallback(() => {
    if (!confirm('Clear all notes from all tracks?')) return;
    setTracks(prev => prev.map(track => ({ ...track, notes: [] })));
    toast({ title: '🗑️ All Tracks Cleared' });
  }, [toast]);

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
    const notesInSelection = selectedTrack.notes.filter((note: Note) => {
      const noteKeyIndex = PIANO_KEYS.findIndex(k => k.note === note.note && k.octave === note.octave);
      return note.step >= minStep && note.step <= maxStep && 
             noteKeyIndex >= minKey && noteKeyIndex <= maxKey;
    });
    
    // Add to selection (or replace if not holding Ctrl)
    if (e.ctrlKey || e.metaKey) {
      const newSelection = new Set(selectedNoteIds);
      notesInSelection.forEach((note: Note) => newSelection.add(note.id));
      setSelectedNoteIds(newSelection);
    } else {
      setSelectedNoteIds(new Set(notesInSelection.map((n: Note) => n.id)));
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
      onGoToBeginning={goToBeginning}
      onToggleChordMode={() => setChordMode(!chordMode)}
      onBpmChange={setBpm}
      onToggleMetronome={setMetronomeEnabled}
      onToggleCountIn={setCountInEnabled}
      chordMode={chordMode}
      draggable={true}
    />
  ), [isPlaying, bpm, metronomeEnabled, countInEnabled, handlePlay, handleStop, clearAll, goToBeginning, chordMode]);

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
      chordInversion={chordInversion}
    />
  ), [selectedProgression, currentKey, currentChordIndex, handleChordClick, chordInversion]);

  const handleNoteOff = useCallback((note: string, octave: number) => {
    if (onPlayNoteOff) {
      onPlayNoteOff(note, octave, selectedTrack?.instrument || 'piano');
    } else {
      const channel = professionalAudio.getChannels().find(ch => ch.id === selectedTrack?.id);
      realisticAudio.noteOff(note, octave, selectedTrack?.instrument || 'piano');
    }
  }, [onPlayNoteOff, selectedTrack]);

  // Callback for piano key playback - uses current track's instrument
  const handlePianoKeyPlay = useCallback((note: string, octave: number) => {
    const channel = professionalAudio.getChannels().find(ch => ch.id === selectedTrack?.id);
    const instrument = selectedTrack?.instrument || 'piano';
    realisticAudio.playNote(note, octave, 0.5, instrument, 0.8, true, channel?.input);
  }, [selectedTrack]);

  return (
    <div className="flex flex-col h-full bg-black/90 text-cyan-500 font-mono overflow-hidden astutely-panel rounded-none">
      {/* Top Professional DAW Toolbar */}
      <div className="flex flex-col gap-2 p-2 border-b border-cyan-500/30 astutely-header">
        <GlobalTransportBar variant="inline" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30">
              <Piano className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black tracking-widest uppercase">Astutely Piano Roll</span>
            </div>
            <div className="h-6 w-px bg-cyan-500/20" />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPianoRollTool('draw')}
                className={cn("h-8 w-8 p-0 rounded-none", pianoRollTool === 'draw' ? "bg-cyan-500 text-white shadow-glow-cyan" : "text-cyan-500/60")}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPianoRollTool('select')}
                className={cn("h-8 w-8 p-0 rounded-none", pianoRollTool === 'select' ? "bg-cyan-500 text-white shadow-glow-cyan" : "text-cyan-500/60")}
              >
                <MousePointer2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPianoRollTool('erase')}
                className={cn("h-8 w-8 p-0 rounded-none", pianoRollTool === 'erase' ? "bg-cyan-500 text-white shadow-glow-cyan" : "text-cyan-500/60")}
              >
                <Eraser className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-cyan-500/30">
              <div className={cn("w-2 h-2 rounded-full", isPlaying ? "bg-cyan-500 animate-pulse shadow-glow-cyan" : "bg-cyan-950")} />
              <span className="text-[10px] font-black tabular-nums tracking-widest uppercase">
                {currentKey} {selectedProgression.name}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAILoopGenerator(v => !v)}
              className={cn(
                "h-8 px-4 rounded-none font-black tracking-widest",
                showAILoopGenerator
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "bg-black/60 text-cyan-500/60 border border-cyan-500/30"
              )}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              LOOP
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {showAILoopGenerator && (
          <div className="absolute inset-0 z-[200] bg-black/70">
            <div className="absolute right-4 top-4 bottom-4 w-[min(760px,calc(100%-2rem))] overflow-y-auto">
              <AILoopGenerator
                currentBpm={bpm}
                currentKey={currentKey}
                currentScale={'minor'}
                onClose={() => setShowAILoopGenerator(false)}
              />
            </div>
          </div>
        )}
        {/* Track Overview Sidebar */}
        {showTrackOverview && (
          <div className="w-48 border-r border-cyan-500/30 bg-black/40 flex flex-col">
            <div className="p-3 border-b border-cyan-500/20 bg-cyan-500/5">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase opacity-60">Matrix Status</span>
            </div>

            <div className="border-b border-cyan-500/20 p-2 bg-black/60">
              <TrackControls
                tracks={tracks}
                selectedTrack={selectedTrackIndex}
                onTrackSelect={handleTrackSelect}
                onVolumeChange={handleVolumeChange}
                onMuteToggle={handleMuteToggle}
                onInstrumentChange={handleInstrumentChange}
                showTrackList={false}
              />
            </div>

            <div className="flex-1 overflow-y-auto astutely-scrollbar">
              {tracks.map((track, idx) => (
                <div 
                  key={`track-${idx}`}
                  onClick={() => setSelectedTrackIndex(idx)}
                  className={cn(
                    "p-3 border-b border-cyan-500/10 cursor-pointer transition-all",
                    selectedTrackIndex === idx ? "bg-cyan-500/20 border-l-4 border-l-cyan-500" : "hover:bg-cyan-500/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-[10px] font-black truncate uppercase tracking-tighter", selectedTrackIndex === idx ? "text-white" : "text-cyan-500/60")}>
                      {track.name}
                    </span>
                    <div className={cn("w-1.5 h-1.5 rounded-full", track.muted ? "bg-red-500" : "bg-cyan-500")} />
                  </div>
                  <div className="text-[8px] font-bold opacity-40 uppercase">{track.instrument}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Piano Roll Grid Area */}
        <div className="flex-1 flex overflow-hidden relative">
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
            scrollRef={pianoKeysRef}
            onScroll={handlePianoScroll}
            onPlayNote={handlePianoKeyPlay}
            onPlayNoteOff={handleNoteOff}
            arpEnabled={liveArpEnabled}
          />
          <StepGrid 
            steps={patternSteps}
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
            onNoteMove={moveNote}
            onNoteCopy={copyNote}
            onMultiNoteResize={resizeMultipleNotes}
            onNoteSelect={selectNote}
            chordMode={chordMode}
            onScroll={handleGridScroll}
            selectedNoteIds={selectedNoteIds}
            onSelectionStart={handleSelectionStart}
            onSelectionMove={handleSelectionMove}
            onSelectionEnd={handleSelectionEnd}
            isSelecting={isSelecting}
            selectionStart={selectionStart}
            selectionEnd={selectionEnd}
            onPlayheadClick={(step) => setCurrentStep(step)}
            tracks={tracks}
            selectedTrackIndex={selectedTrackIndex}
            scrollRef={gridRef}
            tool={pianoRollTool}
            snapEnabled={snapEnabled}
            snapValue={snapValue}
            showGhostNotes={showGhostNotes}
            onNotesChange={(newNotes: any[]) => {
              setTracks(prev => prev.map((t, i) => i === selectedTrackIndex ? { ...t, notes: newNotes } : t));
            }}
            timeSignature={timeSignature}
          />
        </div>
      </div>
    </div>
  );
};

export default VerticalPianoRoll;

