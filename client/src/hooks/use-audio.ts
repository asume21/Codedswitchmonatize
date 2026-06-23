import { useEffect, useRef, useCallback, useState } from "react";
import * as Tone from "tone";
import { audioEngine, InstrumentName } from "../lib/audioEngine";
import { useToast } from "@/hooks/use-toast";
import { professionalAudio } from "@/lib/professionalAudio";

export type DrumType = 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap' | 'tom' | 'crash' | 'perc';

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
  playNote: (note: string | number, octave?: number, duration?: number | string, instrument?: string, velocity?: number, sustainEnabled?: boolean, targetNode?: AudioNode, when?: number) => void;
  playDrum: (type: DrumType, velocity?: number, targetNode?: AudioNode) => void;
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

// useSequencer schedules drum-pattern callbacks against Tone.Transport but does
// NOT own start/stop — TransportContext is the single owner of the audio clock.
// Callers must invoke playPattern() BEFORE useTransport().play() so callbacks
// register at Transport time 0 before the clock advances; calling start first
// would put time 0 in the past and step 0 would never fire.
export function useSequencer() {
  const { playDrum } = useAudio();
  const scheduledIds = useRef<number[]>([]);
  const isPlayingRef = useRef(false);

  const stopPattern = useCallback(() => {
    isPlayingRef.current = false;
    scheduledIds.current.forEach((id) => Tone.Transport.clear(id));
    scheduledIds.current = [];
  }, []);

  const playPattern = useCallback((pattern: PatternType, bpm: number = 120) => {
    stopPattern();
    isPlayingRef.current = true;

    Tone.Transport.bpm.value = bpm;
    const totalSteps = 16;
    const stepDuration = Tone.Time('16n').toSeconds();

    for (let step = 0; step < totalSteps; step++) {
      const id = Tone.Transport.schedule((time) => {
        if (!isPlayingRef.current) return;
        Object.entries(pattern).forEach(([trackName, steps]) => {
          if (Array.isArray(steps) && steps[step]) {
            playDrum(trackName as DrumType, 0.7);
          }
        });
      }, step * stepDuration);
      scheduledIds.current.push(id);
    }
  }, [playDrum, stopPattern]);

  const isPlaying = useCallback(() => isPlayingRef.current, []);

  useEffect(() => () => stopPattern(), [stopPattern]);

  return { playPattern, stopPattern, isPlaying };
}

export function useAudio(): UseAudioReturn {
  const [isInitialized, setIsInitialized] = useState(globalAudioInitialized);
  const { toast } = useToast();

  const initialize = useCallback(async () => {
    if (globalAudioInitialized) return;

    try {
      await professionalAudio.initialize();
      const masterBus = professionalAudio.getMasterBus();
      audioEngine.setTargetNode(masterBus ?? null);
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

  const playNote = useCallback(async (note: string | number, octave: number = 4, duration: number | string = 0.5, instrument: string = 'piano', velocity: number = 0.7, sustainEnabled: boolean = true, targetNode?: AudioNode, when?: number) => {
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
      audioEngine.playNote(fullNote, duration, velocity, instrument as any, targetNode, when);
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }, [initialize]);

  const playDrum = useCallback((type: DrumType, velocity: number = 0.7, targetNode?: AudioNode) => {
    audioEngine.playDrum(type, velocity);
    // Note: audioEngine.playDrum doesn't currently support targetNode directly in its signature, 
    // but it uses realisticAudio which does. RealisticAudio is managed inside audioEngine.
  }, []);

  const setMasterVolume = useCallback((volume: number) => {
    // Map 0-1 range to decibels (Tone.js uses -60 to 0)
    const db = volume === 0 ? -Infinity : 20 * Math.log10(volume);
    Tone.Destination.volume.value = db;
  }, []);


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
