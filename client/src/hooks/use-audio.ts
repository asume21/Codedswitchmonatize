import { useEffect, useRef, useCallback, useState } from "react";
import * as Tone from "tone";
import { audioEngine, InstrumentName } from "../lib/audioEngine";
import { useToast } from "@/hooks/use-toast";

export type DrumType = 'kick' | 'snare' | 'hihat' | 'clap' | 'tom' | 'crash';

// Global audio state
let globalAudioInitialized = false;
const audioInitCallbacks: (() => void)[] = [];

// iPhone/iOS audio context management
let iOSAudioContext: AudioContext | null = null;
let iOSAudioInitialized = false;

// Function to detect if we're on iOS
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Function to enable audio on iOS (requires user gesture)
async function enableIOSAudio(): Promise<void> {
  if (!isIOS() || iOSAudioInitialized) return;
  
  try {
    // Initialize Tone.js which handles iOS audio context
    await audioEngine.initialize();
    await audioEngine.startAudio();
    iOSAudioInitialized = true;
    console.log('✅ iOS audio enabled successfully');
    
    // Trigger any waiting callbacks
    audioInitCallbacks.forEach(callback => callback());
    audioInitCallbacks.length = 0;
    
  } catch (error) {
    console.error('Failed to enable iOS audio:', error);
  }
}

// Note frequency calculation helper (kept for backward compatibility)
function getNoteFrequency(note: string, octave: number = 4): number {
  const noteMap: { [key: string]: number } = {
    'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3, 'E': 4, 'F': 5,
    'F#': 6, 'GB': 6, 'G': 7, 'G#': 8, 'AB': 8, 'A': 9, 'A#': 10, 'BB': 10, 'B': 11
  };
  
  const noteNumber = noteMap[note.toUpperCase()];
  if (noteNumber === undefined) {
    console.warn(`Unknown note: ${note}`);
    return 440; // Default to A4
  }
  
  return 440 * Math.pow(2, (octave - 4) + (noteNumber - 9) / 12);
}

interface UseAudioReturn {
  playNote: (note: string | number, octave?: number, duration?: number, instrument?: string, velocity?: number, sustainEnabled?: boolean) => void;
  playDrum: (type: DrumType, volume?: number) => void;
  setMasterVolume: (volume: number) => void;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  isIOSDevice: boolean;
  needsIOSAudioEnable: boolean;
  enableIOSAudio: () => Promise<void>;
  getLoadingProgress: () => number;
}

// Sequencer hook for beat patterns
interface SequenceStep {
  active?: boolean;
  sound?: string;
  velocity?: number;
}

type PatternType = SequenceStep[] | Record<string, boolean[]>;

export function useSequencer() {
  const { playDrum } = useAudio();
  const sequenceTimeouts = useRef<NodeJS.Timeout[]>([]);
  const isPlayingRef = useRef(false);

  const playPattern = useCallback((pattern: PatternType, bpm: number = 120) => {
    stopPattern(); // Stop any existing pattern
    isPlayingRef.current = true;

    const stepDuration = 60000 / (bpm * 4); // 16th note duration in ms
    const totalSteps = 16;

    for (let step = 0; step < totalSteps; step++) {
      const timeout = setTimeout(() => {
        if (!isPlayingRef.current) return;

        Object.entries(pattern).forEach(([trackName, steps]) => {
          if (Array.isArray(steps) && steps[step]) {
            playDrum(trackName as DrumType, 0.7);
          }
        });

      }, step * stepDuration);
      sequenceTimeouts.current.push(timeout);
    }
  }, [playDrum]);

  const stopPattern = useCallback(() => {
    isPlayingRef.current = false;
    sequenceTimeouts.current.forEach(clearTimeout);
    sequenceTimeouts.current = [];
  }, []);

  const isPlaying = useCallback(() => isPlayingRef.current, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPattern();
    };
  }, [stopPattern]);
  
  return {
    playPattern,
    stopPattern,
    isPlaying
  };
}

// Melody player hook for playing note sequences
export function useMelodyPlayer() {
  const { playNote } = useAudio();
  let melodyTimeouts: NodeJS.Timeout[] = [];
  let isPlaying = false;
  
  return {
    playMelody: (notes: any[], bpm: string = '120', tracks?: any[]) => {
      // Clear any existing timeouts first
      melodyTimeouts.forEach(timeout => clearTimeout(timeout));
      melodyTimeouts = [];
      isPlaying = true;
      
      // Group notes by start time for accurate playback
      const notesByTime = notes.reduce((acc: any, note) => {
        const startTime = note.start || 0;
        if (!acc[startTime]) acc[startTime] = [];
        acc[startTime].push(note);
        return acc;
      }, {});
      
      // Play notes at their scheduled times
      Object.entries(notesByTime).forEach(([startTime, notesAtTime]: [string, any]) => {
        const timeout = setTimeout(() => {
          if (!isPlaying) return; // Check if still playing
          
          (notesAtTime as any[]).forEach(note => {
            if (note && note.note && note.track) {
              // Find the correct instrument for this track
              const trackInfo = tracks?.find(t => t.id === note.track);
              const instrument = trackInfo?.instrument || 'piano';
              
              console.log(`Playing ${instrument}: ${note.note}${note.octave} for ${note.duration}s (track: ${note.track})`);
              playNote(note.note, note.octave || 4, note.duration || 0.5, instrument);
            }
          });
        }, parseFloat(startTime) * 1000);
        
        melodyTimeouts.push(timeout);
      });
    },
    playChord: (notes: any[], instrument: string = 'piano') => {
      notes.forEach(note => {
        if (note && note.note) {
          playNote(note.note, note.octave || 4, note.duration || 1.0, instrument);
        }
      });
    },
    stopMelody: () => {
      isPlaying = false;
      melodyTimeouts.forEach(timeout => clearTimeout(timeout));
      melodyTimeouts = [];
      audioEngine.stop();
      console.log("Melody stopped - all timeouts cleared");
    }
  };
}

export function useAudio(): UseAudioReturn {
  const [isInitialized, setIsInitialized] = useState(globalAudioInitialized);
  const { toast } = useToast();

  const initialize = useCallback(async () => {
    if (globalAudioInitialized) return;

    try {
      await audioEngine.initialize();
      await audioEngine.startAudio(); // Start Tone.js from user interaction
      
      globalAudioInitialized = true;
      setIsInitialized(true);
      
      // Notify all components
      audioInitCallbacks.forEach(callback => callback());
      
      toast({
        title: "Audio System Ready",
        description: "Realistic and synthetic audio engines initialized successfully.",
      });
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      toast({
        title: "Audio Initialization Failed",
        description: "Could not initialize audio system. Some features may not work.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Listen for global audio initialization
  useEffect(() => {
    const callback = () => setIsInitialized(true);
    audioInitCallbacks.push(callback);
    
    return () => {
      const index = audioInitCallbacks.indexOf(callback);
      if (index > -1) {
        audioInitCallbacks.splice(index, 1);
      }
    };
  }, []);

  const playNote = useCallback(async (note: string | number, octave: number = 4, duration: number | string = 0.5, instrument: string = 'piano', velocity: number = 0.7, sustainEnabled: boolean = true) => {
    try {
      if (!globalAudioInitialized) {
        await initialize();
      }
      
      let noteString: string;
      if (typeof note === 'number') {
        // Convert MIDI number to note
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const midiOctave = Math.floor(note / 12) - 1;
        const noteIndex = note % 12;
        noteString = noteNames[noteIndex];
        octave = midiOctave;
      } else {
        noteString = note;
      }

      const fullNote = `${noteString}${octave}`;
      const durationStr = typeof duration === 'number' ? getDurationNotation(duration) : duration;
      audioEngine.playNote(fullNote, durationStr, velocity, instrument as any);
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }, []);

  const playDrum = useCallback((type: DrumType, volume: number = 0.7) => {
    audioEngine.playDrum(type, volume);
  }, []);

  const setMasterVolume = useCallback((volume: number) => {
    // Map 0-1 range to decibels (Tone.js uses -60 to 0)
    const db = volume === 0 ? -Infinity : 20 * Math.log10(volume);
    Tone.Destination.volume.value = db;
  }, []);


  // Helper function to convert duration in seconds to musical notation
  const getDurationNotation = (seconds: number): string => {
    // This is a simplified conversion - adjust based on your BPM
    // Assuming 120 BPM (0.5s per beat)
    const beatValue = seconds / 0.5;
    
    if (beatValue >= 4) return '1n';     // Whole note
    if (beatValue >= 2) return '2n';     // Half note
    if (beatValue >= 1) return '4n';     // Quarter note
    if (beatValue >= 0.5) return '8n';   // 8th note
    if (beatValue >= 0.25) return '16n'; // 16th note
    return '8n'; // Default to 8th note
  };

  // Initialize audio on component mount
  useEffect(() => {
    // On ALL platforms, we now need a user gesture to initialize audio due to browser policies
    const handleFirstInteraction = () => {
      if (!globalAudioInitialized) {
        initialize();
      }
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
    };
    
    window.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('click', handleFirstInteraction);
    
    return () => {
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
    };
  }, [initialize]);

  return {
    playNote,
    playDrum,
    setMasterVolume,
    isInitialized,
    initialize,
    isIOSDevice: isIOS(),
    needsIOSAudioEnable: isIOS() && !iOSAudioInitialized,
    enableIOSAudio,
    getLoadingProgress: () => audioEngine.getLoadingProgress()
  };
}
