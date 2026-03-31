import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useStudioStore } from '../stores/useStudioStore';
import type { LoopRegion as StoreLoopRegion, TimeSignature as StoreTimeSignature } from '../stores/useStudioStore';
import { getTimelineRecorder } from '@/lib/timelineRecorder';
import { useToast } from '@/hooks/use-toast';
import { useTrackStore } from './TrackStoreContext';
import { globalAudioKillSwitch } from '@/lib/globalAudioKillSwitch';

// Re-export types so existing consumers don't need to change imports
export type LoopRegion = StoreLoopRegion;
export type TimeSignature = StoreTimeSignature;

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
  isRecordArmed: boolean;
  toggleRecordArm: (armed?: boolean) => void;
}

const TransportContext = createContext<TransportContextValue | undefined>(undefined);

interface TransportProviderProps {
  children: ReactNode;
  initialTempo?: number;
}

/**
 * TransportProvider — thin bridge over useStudioStore.
 *
 * All state (BPM, key, time signature, transport) lives in the Zustand store.
 * This provider adds the RAF-based position ticker and exposes the same API
 * that existing useTransport() consumers expect, so nothing breaks.
 */
export function TransportProvider({ children, initialTempo = 120 }: TransportProviderProps) {
  // Seed store with initialTempo on first mount (only if it differs from default)
  useEffect(() => {
    if (initialTempo !== 120) {
      useStudioStore.getState().setBpm(initialTempo);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to store slices
  const tempo         = useStudioStore((s) => s.bpm);
  const isPlaying     = useStudioStore((s) => s.isPlaying);
  const position      = useStudioStore((s) => s.position);
  const loop          = useStudioStore((s) => s.loop);
  const timeSignature = useStudioStore((s) => s.timeSignature);
  const isRecordArmed = useStudioStore((s) => s.isRecordArmed);
  const toggleRecordArm = useStudioStore((s) => s.toggleRecordArm);

  const { toast } = useToast();
  const { addTrack } = useTrackStore();
  const recorder = getTimelineRecorder();

  // Store actions (stable references from Zustand)
  const storeBpm    = useStudioStore((s) => s.setBpm);
  const storePlay   = useStudioStore((s) => s.play);
  const storePause  = useStudioStore((s) => s.pause);
  const storeStop   = useStudioStore((s) => s.stop);
  const storeSeek   = useStudioStore((s) => s.seek);
  const storeSetLoop   = useStudioStore((s) => s.setLoop);
  const storeClearLoop = useStudioStore((s) => s.clearLoop);
  const storeSetTs     = useStudioStore((s) => s.setTimeSignature);

  // ── RAF position ticker ──
  // This runs a requestAnimationFrame loop that advances `position` in the
  // store while `isPlaying` is true. It reads BPM and loop from the store
  // directly (via refs) to avoid stale closures.
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const clearRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimestampRef.current = null;
  }, []);

  const advancePosition = useCallback(() => {
    rafRef.current = requestAnimationFrame((timestamp) => {
      const state = useStudioStore.getState();
      if (!state.isPlaying) {
        clearRaf();
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const deltaMs = timestamp - (lastTimestampRef.current ?? timestamp);
      lastTimestampRef.current = timestamp;
      const beatsPerMs = state.bpm / 60 / 1000;
      let next = state.position + deltaMs * beatsPerMs;

      if (state.loop.enabled && state.loop.end > state.loop.start) {
        const loopLength = state.loop.end - state.loop.start;
        if (next >= state.loop.end) {
          const overflow = next - state.loop.end;
          next = state.loop.start + (overflow % loopLength);
        }
      }

      useStudioStore.setState({ position: next });
      advancePosition();
    });
  }, [clearRaf]);

  useEffect(() => {
    if (isPlaying) {
      advancePosition();
      
      // Start recording if armed
      if (isRecordArmed) {
        recorder.startRecording(position).catch(err => {
          toast({
            title: "Recording Failed",
            description: err.message,
            variant: "destructive"
          });
          toggleRecordArm(false);
        });
      }
    } else {
      clearRaf();
      
      // Stop recording if active
      if (recorder.getState().isRecording) {
        recorder.stopRecording().then(result => {
          if (result) {
            // Add a new audio track with the recording
            addTrack({
              id: `rec_${Date.now()}`,
              name: `Recording ${new Date().toLocaleTimeString()}`,
              kind: 'audio',
              startBar: Math.floor(result.startBeat / 4), // Assuming 4/4 for now, need TS logic
              lengthBars: Math.ceil((result.durationSeconds * (tempo / 60)) / 4),
              payload: {
                type: 'audio',
                source: 'recording',
                audioUrl: result.url,
                volume: 0.8,
                pan: 0,
                bpm: tempo,
                metadata: {
                  isRecording: true,
                  duration: result.durationSeconds,
                  peaks: result.waveformPeaks
                }
              }
            });
            toast({
              title: "Recording Saved",
              description: `Added to project at beat ${result.startBeat.toFixed(1)}`
            });
          }
        });
      }
    }
    return () => { 
      clearRaf(); 
    };
  }, [isPlaying, isRecordArmed, advancePosition, clearRaf, recorder, position, addTrack, tempo, toast, toggleRecordArm]);

  // Wrap store actions to match TransportContextValue signature exactly
  const play = useCallback(() => { storePlay(); }, [storePlay]);
  const pause = useCallback(() => { clearRaf(); storePause(); }, [clearRaf, storePause]);
  const stop = useCallback(() => {
    clearRaf();
    storeStop();
    globalAudioKillSwitch.killAllAudio();
  }, [clearRaf, storeStop]);
  const setTempo = useCallback((v: number) => { storeBpm(v); }, [storeBpm]);
  const seek = useCallback((v: number) => { storeSeek(v); }, [storeSeek]);
  const setLoop = useCallback((cfg: Partial<LoopRegion>) => { storeSetLoop(cfg); }, [storeSetLoop]);
  const clearLoop = useCallback(() => { storeClearLoop(); }, [storeClearLoop]);
  const setTimeSignature = useCallback((sig: Partial<TimeSignature>) => { storeSetTs(sig); }, [storeSetTs]);

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
    isRecordArmed,
    toggleRecordArm,
  }), [tempo, isPlaying, position, loop, timeSignature, play, pause, stop, setTempo, seek, setLoop, clearLoop, setTimeSignature, isRecordArmed, toggleRecordArm]);

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
