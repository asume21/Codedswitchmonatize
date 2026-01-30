import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface LoopRegion {
  enabled: boolean;
  start: number;
  end: number;
}

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface TransportContextValue {
  tempo: number;
  isPlaying: boolean;
  position: number; // measured in beats
  loop: LoopRegion;
  timeSignature: TimeSignature;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setTempo: (nextTempo: number) => void;
  seek: (nextPosition: number) => void;
  setLoop: (loopConfig: Partial<LoopRegion>) => void;
  clearLoop: () => void;
  setTimeSignature: (signature: Partial<TimeSignature>) => void;
}

const TransportContext = createContext<TransportContextValue | undefined>(undefined);

const DEFAULT_LOOP: LoopRegion = {
  enabled: false,
  start: 0,
  end: 8,
};

interface TransportProviderProps {
  children: ReactNode;
  initialTempo?: number;
}

export function TransportProvider({ children, initialTempo = 120 }: TransportProviderProps) {
  const [tempo, setTempoState] = useState(initialTempo);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoopState] = useState<LoopRegion>(DEFAULT_LOOP);
  const [timeSignature, setTimeSignatureState] = useState<TimeSignature>({ numerator: 4, denominator: 4 });

  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const clearRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimestampRef.current = null;
  };

  const advancePosition = useCallback(() => {
    rafRef.current = requestAnimationFrame((timestamp) => {
      if (!isPlaying) {
        clearRaf();
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const deltaMs = timestamp - (lastTimestampRef.current ?? timestamp);
      lastTimestampRef.current = timestamp;
      const beatsPerMs = tempo / 60 / 1000;
      setPosition((prev) => {
        let next = prev + deltaMs * beatsPerMs;

        if (loop.enabled && loop.end > loop.start) {
          const loopLength = loop.end - loop.start;
          if (next >= loop.end) {
            const overflow = next - loop.end;
            next = loop.start + (overflow % loopLength);
          }
        }

        return next;
      });

      advancePosition();
    });
  }, [isPlaying, loop, tempo]);

  const play = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
  }, [isPlaying]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    clearRaf();
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    clearRaf();
    setPosition(loop.enabled ? loop.start : 0);
  }, [loop.enabled, loop.start]);

  const setTempo = useCallback((nextTempo: number) => {
    setTempoState(Math.max(20, Math.min(nextTempo, 300)));
  }, []);

  const seek = useCallback((nextPosition: number) => {
    setPosition(Math.max(0, nextPosition));
  }, []);

  const setLoop = useCallback((loopConfig: Partial<LoopRegion>) => {
    setLoopState((prev) => ({
      enabled: loopConfig.enabled ?? prev.enabled,
      start: loopConfig.start ?? prev.start,
      end: loopConfig.end ?? prev.end,
    }));
  }, []);

  const clearLoop = useCallback(() => {
    setLoopState(DEFAULT_LOOP);
  }, []);

  const setTimeSignature = useCallback((signature: Partial<TimeSignature>) => {
    setTimeSignatureState((prev) => ({
      numerator: signature.numerator && signature.numerator > 0 ? signature.numerator : prev.numerator,
      denominator: signature.denominator && signature.denominator > 0 ? signature.denominator : prev.denominator,
    }));
  }, []);

  useEffect(() => {
    if (isPlaying) {
      advancePosition();
    } else {
      clearRaf();
    }

    return () => {
      clearRaf();
    };
  }, [isPlaying, advancePosition]);

  const value = useMemo<TransportContextValue>(() => ({
    tempo,
    isPlaying,
    position,
    loop,
    timeSignature,
    play,
    pause,
    stop,
    setTempo,
    seek,
    setLoop,
    clearLoop,
    setTimeSignature,
  }), [tempo, isPlaying, position, loop, timeSignature, play, pause, stop, setTempo, seek, setLoop, clearLoop, setTimeSignature]);

  return (
    <TransportContext.Provider value={value}>
      {children}
    </TransportContext.Provider>
  );
}

export function useTransport() {
  const context = useContext(TransportContext);
  if (!context) {
    throw new Error('useTransport must be used within a TransportProvider');
  }
  return context;
}
