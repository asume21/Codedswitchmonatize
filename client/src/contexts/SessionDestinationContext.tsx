import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSongWorkSession } from '@/contexts/SongWorkSessionContext';
import { useTrackStore } from '@/contexts/TrackStoreContext';
import { useStudioSession } from '@/contexts/StudioSessionContext';

type SessionDestinationResult = {
  sessionId: string;
  createdNew: boolean;
};

type SessionDestinationRequest = {
  suggestedName: string;
};

type PendingRequest = {
  request: SessionDestinationRequest;
  resolve: (result: SessionDestinationResult | null) => void;
};

type SessionDestinationContextValue = {
  requestDestination: (request?: Partial<SessionDestinationRequest>) => Promise<SessionDestinationResult | null>;
};

const SessionDestinationContext = createContext<SessionDestinationContextValue | undefined>(undefined);

export function SessionDestinationProvider({ children }: { children: React.ReactNode }) {
  const { currentSession, createSession, listSessions, setCurrentSessionId, deleteSession } = useSongWorkSession();
  const { clearTracks } = useTrackStore();
  const studioSession = useStudioSession();

  const resolverRef = useRef<PendingRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'appendOrCreate'>('create');
  const [sessionName, setSessionName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setMode('create');
    setSessionName('');
    const pending = resolverRef.current;
    resolverRef.current = null;
    pending?.resolve(null);
  }, []);

  const beginNewSession = useCallback(
    (name: string) => {
      clearTracks();
      studioSession.resetSession({ songName: name });
      const id = createSession({ name, audioUrl: undefined });
      const pending = resolverRef.current;
      resolverRef.current = null;
      setIsOpen(false);
      pending?.resolve({ sessionId: id, createdNew: true });
    },
    [clearTracks, createSession, studioSession],
  );

  const appendToCurrent = useCallback(() => {
    if (!currentSession) return;
    const pending = resolverRef.current;
    resolverRef.current = null;
    setIsOpen(false);
    pending?.resolve({ sessionId: currentSession.sessionId, createdNew: false });
  }, [currentSession]);

  const requestDestination = useCallback(
    async (request?: Partial<SessionDestinationRequest>) => {
      const suggestedName = request?.suggestedName?.trim() || 'Untitled Session';

      if (!currentSession) {
        return await new Promise<SessionDestinationResult | null>((resolve) => {
          resolverRef.current = { request: { suggestedName }, resolve };
          setMode('create');
          setSessionName(suggestedName);
          setIsOpen(true);
        });
      }

      return await new Promise<SessionDestinationResult | null>((resolve) => {
        resolverRef.current = { request: { suggestedName }, resolve };
        setMode('appendOrCreate');
        setSessionName(suggestedName);
        setSelectedSessionId(currentSession.sessionId);
        setIsOpen(true);
      });
    },
    [currentSession],
  );

  const value = useMemo<SessionDestinationContextValue>(() => ({ requestDestination }), [requestDestination]);

  return (
    <SessionDestinationContext.Provider value={value}>
      {children}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Start a Studio Session' : 'Where should this go?'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'To save and edit what you generate, start a session.'
                : 'Append to your current session or start a new one.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Session name</div>
            <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Untitled Session" />
            {mode === 'appendOrCreate' && listSessions().length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Drafts</span>
                  {selectedSessionId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        deleteSession(selectedSessionId);
                        setSelectedSessionId(null);
                        if (currentSession?.sessionId === selectedSessionId) {
                          setSessionName('');
                        }
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <select
                  className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                  value={selectedSessionId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedSessionId(id || null);
                    if (id) {
                      setCurrentSessionId(id);
                    }
                  }}
                >
                  <option value="">Current session ({currentSession?.songName || 'Untitled'})</option>
                  {listSessions().map((session) => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {session.songName || 'Untitled'} • {new Date(session.createdAt).toLocaleTimeString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            {mode === 'appendOrCreate' && currentSession ? (
              <>
                <Button variant="secondary" onClick={appendToCurrent}>
                  Append to "{currentSession.songName}"
                </Button>
                <Button onClick={() => beginNewSession(sessionName || resolverRef.current?.request.suggestedName || 'Untitled Session')}>
                  Start New Session
                </Button>
              </>
            ) : (
              <Button onClick={() => beginNewSession(sessionName || resolverRef.current?.request.suggestedName || 'Untitled Session')}>
                Start Session
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SessionDestinationContext.Provider>
  );
}

export function useSessionDestination() {
  const ctx = useContext(SessionDestinationContext);
  if (!ctx) {
    throw new Error('useSessionDestination must be used within SessionDestinationProvider');
  }
  return ctx;
}
