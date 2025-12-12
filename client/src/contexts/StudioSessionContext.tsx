import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Core contract for a studio-wide musical session
export interface StudioSessionState {
  currentSongId: string | null;
  currentSongName: string | null;
  setCurrentSongName: (name: string | null) => void;

  lyrics: string;
  setLyrics: (value: string) => void;

  // Shared beat pattern for the current song (used by BeatLab / drum sequencer)
  pattern: unknown;
  setPattern: (pattern: unknown) => void;

  // Shared melody notes for the current song (used by MelodyComposerV2 / piano roll)
  melody: any[];
  setMelody: (notes: any[]) => void;

  hasGeneratedMusic: boolean;
  markGeneratedFromLyrics: (meta: { title?: string | null }) => void;
}

const StudioSessionContext = createContext<StudioSessionState | undefined>(undefined);

// Fallback session used if a component calls useStudioSession outside of a provider.
// This prevents runtime crashes in tests or legacy entry points that haven't been wrapped yet.
const defaultSession: StudioSessionState = {
  currentSongId: null,
  currentSongName: null,
  setCurrentSongName: () => {},
  lyrics: "",
  setLyrics: () => {},
  pattern: null,
  setPattern: () => {},
  melody: [],
  setMelody: () => {},
  hasGeneratedMusic: false,
  markGeneratedFromLyrics: () => {},
};

interface StudioSessionProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = "studioSession";

export function StudioSessionProvider({ children }: StudioSessionProviderProps) {
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [currentSongName, setCurrentSongName] = useState<string | null>(null);
  const [lyrics, setLyricsState] = useState<string>("");
  const [pattern, setPatternState] = useState<unknown>(null);
  const [melody, setMelodyState] = useState<any[]>([]);
  const [hasGeneratedMusic, setHasGeneratedMusic] = useState(false);

  // Load persisted session on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        currentSongId: string | null;
        currentSongName: string | null;
        lyrics: string;
        pattern: unknown;
        melody: any[];
        hasGeneratedMusic: boolean;
      }>;

      if (parsed.currentSongId !== undefined) {
        setCurrentSongId(parsed.currentSongId);
      }
      if (parsed.currentSongName !== undefined) {
        setCurrentSongName(parsed.currentSongName);
      }
      if (typeof parsed.lyrics === "string") {
        setLyricsState(parsed.lyrics);
      }
      if (parsed.pattern !== undefined) {
        setPatternState(parsed.pattern);
      }
      if (Array.isArray(parsed.melody)) {
        setMelodyState(parsed.melody);
      }
      if (typeof parsed.hasGeneratedMusic === "boolean") {
        setHasGeneratedMusic(parsed.hasGeneratedMusic);
      }
    } catch {
      // Ignore storage errors (e.g. private mode or malformed data)
    }
  }, []);

  // Persist session whenever core fields change
  useEffect(() => {
    try {
      const payload = {
        currentSongId,
        currentSongName,
        lyrics,
        pattern,
        melody,
        hasGeneratedMusic,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }, [currentSongId, currentSongName, lyrics, pattern, melody, hasGeneratedMusic]);

  const setLyrics = (value: string) => {
    setLyricsState(value);
  };

  const setPattern = (value: unknown) => {
    setPatternState(value);
  };

  const setMelody = (notes: any[]) => {
    setMelodyState(notes);
  };

  const markGeneratedFromLyrics = (meta: { title?: string | null }) => {
    setHasGeneratedMusic(true);
    if (meta.title && !currentSongName) {
      setCurrentSongName(meta.title);
    }
  };

  const value: StudioSessionState = {
    currentSongId,
    currentSongName,
    setCurrentSongName,
    lyrics,
    setLyrics,
    pattern,
    setPattern,
    melody,
    setMelody,
    hasGeneratedMusic,
    markGeneratedFromLyrics,
  };

  return (
    <StudioSessionContext.Provider value={value}>
      {children}
    </StudioSessionContext.Provider>
  );
}

export function useStudioSession(): StudioSessionState {
  const ctx = useContext(StudioSessionContext);
  if (!ctx) {
    return defaultSession;
  }
  return ctx;
}
