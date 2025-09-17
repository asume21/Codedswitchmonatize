import { useEffect, useRef, useCallback, useState } from "react";
import * as Tone from "tone";
import { audioEngine, InstrumentName } from "../lib/audioEngine";
import { realisticAudio } from "@/lib/realisticAudio";
import { useToast } from "@/hooks/use-toast";

type DrumType = 'kick' | 'snare' | 'hihat' | 'clap' | 'tom' | 'crash';

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
    await audioEngine.init();
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
  playDrumSound: (type: string, volume?: number) => void;
  setMasterVolume: (volume: number) => void;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  useRealisticSounds: boolean;
  toggleRealisticSounds: () => void;
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
  const { playDrumSound } = useAudio();
  const sequenceTimeouts = useRef<NodeJS.Timeout[]>([]);
  const isSequencePlaying = useRef(false);
  
  const playPattern = useCallback((pattern: PatternType, bpm: number = 120) => {
    // Clear any existing timeouts
    sequenceTimeouts.current.forEach(timeout => clearTimeout(timeout));
    sequenceTimeouts.current = [];
    
    if (Array.isArray(pattern)) {
      // Array format - use Tone.js Transport
      const events = pattern.map((step: SequenceStep, index: number) => ({
        time: index * (60 / (bpm * 4)), // Convert to seconds
        note: step.sound || 'kick',
        velocity: step.velocity || 0.7,
        duration: '16n'
      }));
      
      // Clear any existing patterns
      Tone.Transport.cancel();
      
      // Schedule new pattern
      events.forEach(event => {
        Tone.Transport.scheduleOnce((time: number) => {
          if (isSequencePlaying.current) {
            playDrumSound(event.note, event.velocity);
          }
        }, event.time);
      });
      
      // Start transport if not already running
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }
      
      isSequencePlaying.current = true;
    } else if (pattern && typeof pattern === 'object') {
      // Object format with tracks (kick, snare, etc.)
      const stepDuration = 60000 / (bpm * 4); // 16th note duration in ms
      const totalSteps = 16; // Standard 16-step pattern
      
      for (let step = 0; step < totalSteps; step++) {
        const timeout = setTimeout(() => {
          if (!isSequencePlaying.current) return;
          
          // Play all active tracks for this step
          Object.entries(pattern).forEach(([trackName, steps]: [string, boolean[]]) => {
            if (Array.isArray(steps) && steps[step]) {
              playDrumSound(trackName, 0.7);
            }
          });
        }, step * stepDuration);
        
        sequenceTimeouts.current.push(timeout);
      }
    }
  }, [playDrumSound]);
  
  const stopPattern = useCallback(() => {
    isSequencePlaying.current = false;
    sequenceTimeouts.current.forEach(timeout => clearTimeout(timeout));
    sequenceTimeouts.current = [];
    
    // Stop Tone.js transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }, []);
  
  const isPlaying = useCallback(() => isSequencePlaying.current, []);
  
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
  const [useRealisticSounds, setUseRealisticSounds] = useState(true);
  const { toast } = useToast();

  const initialize = useCallback(async () => {
    if (globalAudioInitialized) return;

    try {
      // Initialize both audio engines
      await audioEngine.initialize();
      await realisticAudio.initialize();
      
      // Make synthetic engine globally available for realistic mode fallback
      if (typeof window !== 'undefined') {
        (window as any).syntheticAudioEngine = audioEngine;
      }
      
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

      console.log(`Audio Mode Check: useRealisticSounds=${useRealisticSounds}, realisticAudio.isReady()=${realisticAudio.isReady()}`);
      
      if (useRealisticSounds && realisticAudio.isReady()) {
        // Use realistic sampled instruments
        console.log(`Playing REALISTIC ${instrument}: ${noteString}${octave}`);
        await realisticAudio.playNote(noteString, octave, duration as number, instrument, velocity, sustainEnabled);
      } else {
        // Use Tone.js audio engine
        const fullNote = `${noteString}${octave}`;
        const durationStr = typeof duration === 'number' ? getDurationNotation(duration) : duration;
        console.log(`Playing SYNTH ${instrument}: ${fullNote} for ${durationStr}`);
        audioEngine.playNote(fullNote, durationStr, velocity, instrument as any);
      }
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }, [useRealisticSounds]);

  const playDrumSound = useCallback((type: DrumType | string, volume: number = 0.7) => {
    if (useRealisticSounds) {
      realisticAudio.playDrumSound(type as string, volume);
    } else {
      // Type assertion since we know the DrumType is compatible
      audioEngine.playDrum(type as DrumType, volume);
    }
  }, [useRealisticSounds]);

  const setMasterVolume = useCallback((volume: number) => {
    // Map 0-1 range to decibels (Tone.js uses -60 to 0)
    const db = volume * 60 - 60;
    Tone.Destination.volume.value = db;
  }, []);

  const toggleRealisticSounds = useCallback(() => {
    setUseRealisticSounds(prev => !prev);
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
    if (isIOS()) {
      // On iOS, we need a user gesture to initialize audio
      const handleFirstInteraction = () => {
        enableIOSAudio();
        window.removeEventListener('touchstart', handleFirstInteraction);
        window.removeEventListener('click', handleFirstInteraction);
      };
      
      window.addEventListener('touchstart', handleFirstInteraction);
      window.addEventListener('click', handleFirstInteraction);
      
      return () => {
        window.removeEventListener('touchstart', handleFirstInteraction);
        window.removeEventListener('click', handleFirstInteraction);
      };
    } else {
      // On other platforms, initialize immediately
      initialize();
    }
  }, [initialize]);

  return {
    playNote,
    playDrumSound,
    setMasterVolume,
    isInitialized,
    initialize,
    useRealisticSounds,
    toggleRealisticSounds,
    isIOSDevice: isIOS(),
    needsIOSAudioEnable: isIOS() && !iOSAudioInitialized,
    enableIOSAudio,
    getLoadingProgress: () => audioEngine.getLoadingProgress()
  };
}
