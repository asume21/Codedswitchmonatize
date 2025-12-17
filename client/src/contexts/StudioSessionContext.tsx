import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";

// Auto-save configuration
const AUTO_SAVE_DELAY_MS = 2000; // Debounce delay for auto-save
const BACKUP_INTERVAL_MS = 60000; // Create backup every minute
const MAX_BACKUPS = 5; // Keep last 5 backups

// Core contract for a studio-wide musical session
export interface LyricsVersion {
  id: string;
  label: string;
  source: "manual" | "ai" | "transcription";
  content: string;
  createdAt: number;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SessionBackup {
  id: string;
  timestamp: number;
  data: string;
}

export interface StudioSessionState {
  currentSongId: string | null;
  currentSongName: string | null;
  setCurrentSongName: (name: string | null) => void;
  setSong: (data: { songId: string | null; songName?: string | null }) => void;

  resetSession: (data?: { songName?: string | null }) => void;

  lyrics: string;
  setLyrics: (value: string) => void;
  lyricsVersions: LyricsVersion[];
  activeLyricsVersionId: string | null;
  setActiveLyricsVersionId: (id: string) => void;
  createLyricsVersion: (data: {
    content: string;
    source: LyricsVersion["source"];
    label?: string;
  }) => string;

  // Shared beat pattern for the current song (used by BeatLab / drum sequencer)
  pattern: unknown;
  setPattern: (pattern: unknown) => void;

  // Shared melody notes for the current song (used by MelodyComposerV2 / piano roll)
  melody: any[];
  setMelody: (notes: any[]) => void;

  hasGeneratedMusic: boolean;
  markGeneratedFromLyrics: (meta: { title?: string | null }) => void;

  // Auto-save status and controls
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  forceSave: () => void;
  getBackups: () => SessionBackup[];
  restoreBackup: (backupId: string) => boolean;
}

const StudioSessionContext = createContext<StudioSessionState | undefined>(undefined);

// Fallback session used if a component calls useStudioSession outside of a provider.
// This prevents runtime crashes in tests or legacy entry points that haven't been wrapped yet.
const defaultSession: StudioSessionState = {
  currentSongId: null,
  currentSongName: null,
  setCurrentSongName: () => {},
  setSong: () => {},
  resetSession: () => {},
  lyrics: "",
  setLyrics: () => {},
  lyricsVersions: [],
  activeLyricsVersionId: null,
  setActiveLyricsVersionId: () => {},
  createLyricsVersion: () => "",
  pattern: null,
  setPattern: () => {},
  melody: [],
  setMelody: () => {},
  hasGeneratedMusic: false,
  markGeneratedFromLyrics: () => {},
  saveStatus: 'idle',
  lastSavedAt: null,
  forceSave: () => {},
  getBackups: () => [],
  restoreBackup: () => false,
};

interface StudioSessionProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = "studioSession";

const createId = () => {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID() as string;
  }
  return `v_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export function StudioSessionProvider({ children }: StudioSessionProviderProps) {
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [currentSongName, setCurrentSongName] = useState<string | null>(null);
  const [lyrics, setLyricsState] = useState<string>("");
  const [lyricsVersions, setLyricsVersions] = useState<LyricsVersion[]>([]);
  const [activeLyricsVersionId, setActiveLyricsVersionIdState] = useState<string | null>(null);
  const [pattern, setPatternState] = useState<unknown>(null);
  const [melody, setMelodyState] = useState<any[]>([]);
  const [hasGeneratedMusic, setHasGeneratedMusic] = useState(false);

  useEffect(() => {
    if (activeLyricsVersionId) return;
    setLyricsVersions((prev) => {
      if (prev.length > 0) {
        setActiveLyricsVersionIdState(prev[0].id);
        return prev;
      }
      const firstId = createId();
      setActiveLyricsVersionIdState(firstId);
      return [
        {
          id: firstId,
          label: "Draft 1",
          source: "manual",
          content: lyrics,
          createdAt: Date.now(),
        },
      ];
    });
  }, [activeLyricsVersionId, lyrics]);

  useEffect(() => {
    if (!activeLyricsVersionId) return;
    const found = lyricsVersions.find((v) => v.id === activeLyricsVersionId);
    if (found && found.content !== lyrics) {
      setLyricsState(found.content);
    }
  }, [activeLyricsVersionId, lyricsVersions, lyrics]);

  // Load persisted session on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        currentSongId: string | null;
        currentSongName: string | null;
        lyrics: string;
        lyricsVersions: LyricsVersion[];
        activeLyricsVersionId: string | null;
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
      if (Array.isArray(parsed.lyricsVersions)) {
        setLyricsVersions(parsed.lyricsVersions);
      }
      if (parsed.activeLyricsVersionId !== undefined) {
        setActiveLyricsVersionIdState(parsed.activeLyricsVersionId ?? null);
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
      // Backfill a first version if older storage had only `lyrics`.
      setLyricsVersions((prev) => {
        if (prev.length > 0) return prev;
        const firstId = createId();
        setActiveLyricsVersionIdState(firstId);
        return [
          {
            id: firstId,
            label: "Draft 1",
            source: "manual",
            content: parsed.lyrics ?? "",
            createdAt: Date.now(),
          },
        ];
      });
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
        lyricsVersions,
        activeLyricsVersionId,
        pattern,
        melody,
        hasGeneratedMusic,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }, [currentSongId, currentSongName, lyrics, lyricsVersions, activeLyricsVersionId, pattern, melody, hasGeneratedMusic]);

  const setLyrics = (value: string) => {
    setLyricsState(value);
    setLyricsVersions((prev) => {
      if (!activeLyricsVersionId) return prev;
      const idx = prev.findIndex((v) => v.id === activeLyricsVersionId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], content: value };
      return next;
    });
  };

  const createLyricsVersion = (data: {
    content: string;
    source: LyricsVersion["source"];
    label?: string;
  }) => {
    const id = createId();
    const createdAt = Date.now();

    setLyricsVersions((prev) => {
      const next: LyricsVersion = {
        id,
        label: data.label ?? `Version ${prev.length + 1}`,
        source: data.source,
        content: data.content,
        createdAt,
      };
      return [...prev, next];
    });
    setActiveLyricsVersionIdState(id);
    setLyricsState(data.content);
    return id;
  };

  const setActiveLyricsVersionId = (id: string) => {
    setActiveLyricsVersionIdState(id);
  };

  const setSong = (data: { songId: string | null; songName?: string | null }) => {
    setCurrentSongId(data.songId);
    if (data.songName !== undefined) {
      setCurrentSongName(data.songName);
    }
  };

  const resetSession = (data?: { songName?: string | null }) => {
    const songName = data?.songName ?? null;
    setCurrentSongId(null);
    setCurrentSongName(songName);
    setLyricsState('');
    setPatternState(null);
    setMelodyState([]);
    setHasGeneratedMusic(false);

    const firstId = createId();
    setLyricsVersions([
      {
        id: firstId,
        label: 'Draft 1',
        source: 'manual',
        content: '',
        createdAt: Date.now(),
      },
    ]);
    setActiveLyricsVersionIdState(firstId);
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

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounced save function
  const performSave = useCallback(() => {
    try {
      setSaveStatus('saving');
      const payload = {
        currentSongId,
        currentSongName,
        lyrics,
        lyricsVersions,
        activeLyricsVersionId,
        pattern,
        melody,
        hasGeneratedMusic,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(Date.now());
      setSaveStatus('saved');
      
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaveStatus('error');
    }
  }, [currentSongId, currentSongName, lyrics, lyricsVersions, activeLyricsVersionId, pattern, melody, hasGeneratedMusic]);

  // Force immediate save
  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    performSave();
  }, [performSave]);

  // Create backup
  const createBackup = useCallback(() => {
    try {
      const backupsKey = `${STORAGE_KEY}_backups`;
      const existingBackups: SessionBackup[] = JSON.parse(
        window.localStorage.getItem(backupsKey) || '[]'
      );
      
      const currentData = window.localStorage.getItem(STORAGE_KEY);
      if (!currentData) return;

      const newBackup: SessionBackup = {
        id: createId(),
        timestamp: Date.now(),
        data: currentData,
      };

      // Keep only last MAX_BACKUPS
      const updatedBackups = [...existingBackups, newBackup].slice(-MAX_BACKUPS);
      window.localStorage.setItem(backupsKey, JSON.stringify(updatedBackups));
    } catch (error) {
      console.error('Backup creation failed:', error);
    }
  }, []);

  // Get all backups
  const getBackups = useCallback((): SessionBackup[] => {
    try {
      const backupsKey = `${STORAGE_KEY}_backups`;
      return JSON.parse(window.localStorage.getItem(backupsKey) || '[]');
    } catch {
      return [];
    }
  }, []);

  // Restore from backup
  const restoreBackup = useCallback((backupId: string): boolean => {
    try {
      const backups = getBackups();
      const backup = backups.find(b => b.id === backupId);
      if (!backup) return false;

      const parsed = JSON.parse(backup.data);
      if (parsed.currentSongId !== undefined) setCurrentSongId(parsed.currentSongId);
      if (parsed.currentSongName !== undefined) setCurrentSongName(parsed.currentSongName);
      if (typeof parsed.lyrics === 'string') setLyricsState(parsed.lyrics);
      if (Array.isArray(parsed.lyricsVersions)) setLyricsVersions(parsed.lyricsVersions);
      if (parsed.activeLyricsVersionId !== undefined) setActiveLyricsVersionIdState(parsed.activeLyricsVersionId);
      if (parsed.pattern !== undefined) setPatternState(parsed.pattern);
      if (Array.isArray(parsed.melody)) setMelodyState(parsed.melody);
      if (typeof parsed.hasGeneratedMusic === 'boolean') setHasGeneratedMusic(parsed.hasGeneratedMusic);
      
      return true;
    } catch (error) {
      console.error('Backup restore failed:', error);
      return false;
    }
  }, [getBackups]);

  // Debounced auto-save effect
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentSongId, currentSongName, lyrics, lyricsVersions, activeLyricsVersionId, pattern, melody, hasGeneratedMusic, performSave]);

  // Periodic backup effect
  useEffect(() => {
    backupIntervalRef.current = setInterval(() => {
      createBackup();
    }, BACKUP_INTERVAL_MS);

    return () => {
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
      }
    };
  }, [createBackup]);

  const value: StudioSessionState = {
    currentSongId,
    currentSongName,
    setCurrentSongName,
    setSong,
    resetSession,
    lyrics,
    setLyrics,
    lyricsVersions,
    activeLyricsVersionId,
    setActiveLyricsVersionId,
    createLyricsVersion,
    pattern,
    setPattern,
    melody,
    setMelody,
    hasGeneratedMusic,
    markGeneratedFromLyrics,
    saveStatus,
    lastSavedAt,
    forceSave,
    getBackups,
    restoreBackup,
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
