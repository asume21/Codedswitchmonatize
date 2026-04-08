import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { realisticAudio } from '@/lib/realisticAudio';

interface InstrumentContextType {
  currentInstrument: string;
  setCurrentInstrument: (instrument: string) => void;
  loadInstrument: (instrument: string) => Promise<void>;
  availableInstruments: string[];
}

const InstrumentContext = createContext<InstrumentContextType | null>(null);

const AVAILABLE_INSTRUMENTS = [
  'piano',
  'electric_piano_1',
  'electric_piano_2',
  'harpsichord',
  'organ',
  'bass-electric',
  'electric_bass_pick',
  'bass-upright',
  'bass-synth',
  'synth_bass_2',
  'fretless_bass',
  'slap_bass_1',
  'guitar-acoustic',
  'guitar-nylon',
  'guitar-electric',
  'guitar-distorted',
  'strings-violin',
  'viola',
  'cello',
  'contrabass',
  'strings',
  'orchestral_harp',
  'trumpet',
  'trombone',
  'french_horn',
  'flute',
  'clarinet',
  'tenor_sax',
  'synth-analog',
  'leads-square',
  'leads-saw',
  'pads-warm',
  'pads-strings',
  'pads-choir',
  'neumann_sub_bass',
  'neumann_punch_bass',
  'neumann_grit_bass',
];

export function InstrumentProvider({ children }: { children: ReactNode }) {
  const [currentInstrument, setCurrentInstrumentState] = useState('piano');

  // Track which instruments have been loaded to avoid redundant network requests
  const loadedRef = useRef(new Set<string>());

  const loadInstrument = useCallback(async (instrument: string) => {
    if (loadedRef.current.has(instrument)) return;
    loadedRef.current.add(instrument);
    try {
      await realisticAudio.loadAdditionalInstrument(instrument);
      console.log(`Loaded instrument: ${instrument}`);
    } catch (error) {
      loadedRef.current.delete(instrument);
      console.warn(`Failed to load instrument ${instrument}:`, error);
    }
  }, []);

  const setCurrentInstrument = useCallback((instrument: string) => {
    console.log(`Setting global instrument to: ${instrument}`);
    setCurrentInstrumentState(instrument);
    // Load on demand — only when the user explicitly switches instruments.
    // The default piano is NOT loaded on mount; it loads on first use.
    loadInstrument(instrument);

    window.dispatchEvent(new CustomEvent('instrument-change', {
      detail: { instrument }
    }));
  }, [loadInstrument]);

  return (
    <InstrumentContext.Provider value={{
      currentInstrument,
      setCurrentInstrument,
      loadInstrument,
      availableInstruments: AVAILABLE_INSTRUMENTS,
    }}>
      {children}
    </InstrumentContext.Provider>
  );
}

export function useInstrument() {
  const context = useContext(InstrumentContext);
  if (!context) {
    throw new Error('useInstrument must be used within an InstrumentProvider');
  }
  return context;
}

export function useInstrumentOptional() {
  return useContext(InstrumentContext);
}
