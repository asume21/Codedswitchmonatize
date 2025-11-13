import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SongIssue {
  type: 'melody' | 'rhythm' | 'harmony' | 'structure' | 'production';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
  targetTool?: 'piano-roll' | 'beat-maker' | 'mixer' | 'composition';
  measureRange?: [number, number];
}

export interface SongWorkSession {
  sessionId: string;
  songName: string;
  audioUrl?: string;
  analysis?: {
    bpm?: number;
    key?: string;
    timeSignature?: string;
    duration?: number;
    issues: SongIssue[];
  };
  midiData?: any;
  createdAt: number;
}

interface SongWorkSessionContextType {
  currentSession: SongWorkSession | null;
  createSession: (song: { name: string; audioUrl?: string }) => string;
  updateSession: (sessionId: string, updates: Partial<SongWorkSession>) => void;
  getSession: (sessionId: string) => SongWorkSession | null;
  setCurrentSessionId: (sessionId: string) => void;
  clearSession: () => void;
}

const SongWorkSessionContext = createContext<SongWorkSessionContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'codedswitch_work_sessions';

export function SongWorkSessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<SongWorkSession | null>(null);
  const [sessions, setSessions] = useState<Map<string, SongWorkSession>>(new Map());

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const sessionsMap = new Map<string, SongWorkSession>(Object.entries(parsed.sessions || {}));
        setSessions(sessionsMap);
        if (parsed.currentSessionId) {
          setCurrentSession(sessionsMap.get(parsed.currentSessionId) || null);
        }
      } catch (error) {
        console.error('Failed to load work sessions:', error);
      }
    }
  }, []);

  useEffect(() => {
    const sessionsObj = Object.fromEntries(sessions);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      sessions: sessionsObj,
      currentSessionId: currentSession?.sessionId
    }));
  }, [sessions, currentSession]);

  const createSession = (song: { name: string; audioUrl?: string }): string => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession: SongWorkSession = {
      sessionId,
      songName: song.name,
      audioUrl: song.audioUrl,
      createdAt: Date.now()
    };
    
    setSessions(prev => new Map(prev).set(sessionId, newSession));
    setCurrentSession(newSession);
    return sessionId;
  };

  const updateSession = (sessionId: string, updates: Partial<SongWorkSession>) => {
    setSessions(prev => {
      const newSessions = new Map(prev);
      const existing = newSessions.get(sessionId);
      if (existing) {
        const updated = { ...existing, ...updates };
        newSessions.set(sessionId, updated);
        if (currentSession?.sessionId === sessionId) {
          setCurrentSession(updated);
        }
      }
      return newSessions;
    });
  };

  const getSession = (sessionId: string): SongWorkSession | null => {
    return sessions.get(sessionId) || null;
  };

  const setCurrentSessionId = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (session) {
      setCurrentSession(session);
    }
  };

  const clearSession = () => {
    setCurrentSession(null);
  };

  return (
    <SongWorkSessionContext.Provider value={{
      currentSession,
      createSession,
      updateSession,
      getSession,
      setCurrentSessionId,
      clearSession
    }}>
      {children}
    </SongWorkSessionContext.Provider>
  );
}

export function useSongWorkSession() {
  const context = useContext(SongWorkSessionContext);
  if (!context) {
    throw new Error('useSongWorkSession must be used within SongWorkSessionProvider');
  }
  return context;
}
