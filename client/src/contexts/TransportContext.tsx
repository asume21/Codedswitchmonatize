import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useStudioStore } from '../stores/useStudioStore';
import type { LoopRegion as StoreLoopRegion, TimeSignature as StoreTimeSignature } from '../stores/useStudioStore';
import { getTimelineRecorder } from '@/lib/timelineRecorder';
import { useToast } from '@/hooks/use-toast';
import { useTrackStore } from './TrackStoreContext';
import { globalAudioKillSwitch } from '@/lib/globalAudioKillSwitch';
import { pianoRollScheduler } from '@/lib/pianoRollScheduler';
import { arrangementScheduler } from '@/lib/arrangementScheduler';
import { getAudioContext, resumeAudioContext } from '@/lib/audioContext';
import { registerTransportOwner } from '@/lib/transportController';
import * as Tone from 'tone';

declare global {
  interface Window {
    __toneRef?: typeof Tone;
  }
}

// Expose Tone to the global kill switch so it can stop the transport during panic-stop.
if (typeof window !== 'undefined') {
  window.__toneRef = Tone;
}

// Re-export types so existing consumers don't need to change imports
export type LoopRegion = StoreLoopRegion;
export type TimeSignature = StoreTimeSignature;

export interface TransportContextValue {
  tempo: number;
  isPlaying: boolean;
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
  // NOTE: `position` is deliberately NOT subscribed here — it changes 60×/sec during
  // playback. Subscribing at the provider level re-renders the entire studio tree
  // on every RAF tick. Consumers that need the live playhead read it directly via
  // `useStudioStore(s => s.position)` so only they feel the re-render.
  const tempo         = useStudioStore((s) => s.bpm);
  const isPlaying     = useStudioStore((s) => s.isPlaying);
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
  // Audit 2026-04-30: play() now awaits resumeAudioContext(), so a Stop click
  // arriving during the resume could be silently reverted when the resume
  // resolves and the post-await side-effects fire. The epoch ref is bumped
  // by both play() (on entry) and stop() (on entry); the post-await branch
  // checks the captured epoch matches before scheduling Tone.Transport.start.
  const playEpochRef = useRef(0);
  // True while THIS provider is the one broadcasting 'globalAudio:stopAll', so the
  // listener below can tell "someone stopped audio behind our back, resync" from
  // "we just did this deliberately and already set the state we want".
  const selfDispatchedStopAllRef = useRef(false);

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
      clearRaf(); // cancel any existing chain before starting a new one
      advancePosition();
      
      // Start recording if armed — read position fresh from store, not from
      // a closure-captured value (we no longer subscribe to position here).
      if (isRecordArmed) {
        recorder.startRecording(useStudioStore.getState().position).catch(err => {
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
    // Intentionally do NOT depend on `position` — this effect should only run when
    // play/record state toggles, not on every 60fps position tick.
  }, [isPlaying, isRecordArmed, advancePosition, clearRaf, recorder, addTrack, tempo, toast, toggleRecordArm]);

  // ── Song-end auto-stop (arrangement mode) ──
  // When the arrangement scheduler reaches songEndBeat, stop the transport.
  useEffect(() => {
    const unsub = arrangementScheduler.onSongEnd(() => {
      // Use store actions directly to avoid stale closure over stop()
      clearRaf();
      useStudioStore.getState().stop();
      pianoRollScheduler.stop();
      arrangementScheduler.stop();
      Tone.getTransport().stop();
    });
    return unsub;
  }, [clearRaf]);

  // Wrap store actions to match TransportContextValue signature exactly
  const play = useCallback(() => {
    const epoch = ++playEpochRef.current;
    void (async () => {
      await resumeAudioContext();
      // If a stop() (or another play()) ran while we awaited the resume,
      // bail out — the user's most recent intent wins.
      if (epoch !== playEpochRef.current) return;
      storePlay();

      // Start both clocks anchored to the same AudioContext timestamp — zero drift
      const ctx = getAudioContext();
      const startAt = ctx.currentTime + 0.05;
      const { bpm, transportMode, position: pos, songEndBeat } = useStudioStore.getState();
      const effectiveBpm = bpm ?? 120;

      if (transportMode === 'arrangement') {
        // Arrangement mode: scheduler runs without wrapping (patternSteps = MAX_SAFE_INTEGER)
        pianoRollScheduler.start(effectiveBpm, Number.MAX_SAFE_INTEGER, startAt);
        arrangementScheduler.start(pos, songEndBeat);
      } else {
        // Pattern mode: wraps at patternSteps as before
        pianoRollScheduler.start(effectiveBpm, pianoRollScheduler.patternSteps, startAt);
      }

      // Start Tone.Transport at the same offset so Tone.js generators are in lock-step.
      // setBpm is the single writer of Transport tempo (keeps store + clock synced).
      useStudioStore.getState().setBpm(effectiveBpm);
      Tone.getTransport().start(`+0.05`);
    })();
  }, [storePlay]);
  const pause = useCallback(() => {
    clearRaf();
    storePause();
    pianoRollScheduler.stop();
    arrangementScheduler.stop();
    Tone.getTransport().pause();
    // Stop any standalone audio sources (Astutely generated audio, previews, etc.).
    // Flagged as self-dispatched: dispatchEvent is SYNCHRONOUS, so without this the
    // syncStoppedState listener below runs before pause() returns and calls
    // storeStop() — overwriting the storePause() two lines up and resetting the
    // playhead to zero. Pause silently became Stop.
    selfDispatchedStopAllRef.current = true;
    try {
      window.dispatchEvent(new CustomEvent('globalAudio:stopAll'));
    } finally {
      selfDispatchedStopAllRef.current = false;
    }
  }, [clearRaf, storePause]);
  const stop = useCallback(() => {
    // Bump the epoch so any in-flight play() awaiting resumeAudioContext()
    // bails out instead of clobbering the stop.
    playEpochRef.current++;
    clearRaf();
    storeStop();
    pianoRollScheduler.stop();
    arrangementScheduler.stop();
    Tone.getTransport().stop();
    // Same self-dispatch guard: killAllAudio broadcasts 'globalAudio:stopAll', and
    // this path has already done the owner-side teardown above.
    selfDispatchedStopAllRef.current = true;
    try {
      globalAudioKillSwitch.killAllAudio();
    } finally {
      selfDispatchedStopAllRef.current = false;
    }
  }, [clearRaf, storeStop]);
  const setTempo = useCallback((v: number) => {
    storeBpm(v); // store.setBpm writes Transport.bpm too — single source of truth
    pianoRollScheduler.setBpm(v);
  }, [storeBpm]);
  const seek = useCallback((v: number) => { storeSeek(v); }, [storeSeek]);
  const setLoop = useCallback((cfg: Partial<LoopRegion>) => { storeSetLoop(cfg); }, [storeSetLoop]);
  const clearLoop = useCallback(() => { storeClearLoop(); }, [storeClearLoop]);
  const setTimeSignature = useCallback((sig: Partial<TimeSignature>) => { storeSetTs(sig); }, [storeSetTs]);

  // Kill All Audio is a second entry point into "everything stops".
  // stop() above funnels through it correctly, but the nav's Stop All button and
  // the global Ctrl+Shift+K listener call killAllAudio() DIRECTLY — that path
  // halts Tone.Transport (globalAudioKillSwitch.ts:99-107, via window.__toneRef)
  // without ever telling this provider. Audio really stopped, but the store still
  // said isPlaying, the RAF kept ticking the playhead, and the next Play went into
  // a half-torn-down state.
  //
  // The kill switch already broadcasts 'globalAudio:stopAll' for exactly this kind
  // of subsystem hand-off, so listen on that channel rather than adding another.
  // Owner-side teardown ONLY — deliberately does not call killAllAudio() back, or
  // stop() -> killAllAudio() -> here -> killAllAudio() would loop.
  useEffect(() => {
    const syncStoppedState = () => {
      // Our own pause()/stop() already set the correct state before dispatching.
      // Re-running a full stop here would clobber a PAUSE with a STOP.
      if (selfDispatchedStopAllRef.current) return;
      playEpochRef.current++;   // bail out any in-flight play() awaiting the ctx
      clearRaf();
      storeStop();
      pianoRollScheduler.stop();
      arrangementScheduler.stop();
    };
    window.addEventListener('globalAudio:stopAll', syncStoppedState);
    return () => window.removeEventListener('globalAudio:stopAll', syncStoppedState);
  }, [clearRaf, storeStop]);

  // Register as the single owner of Tone.Transport while this provider is
  // mounted. Other modules (GeneratorOrchestrator) call requestTransportStart()
  // through the controller and end up here. See lib/transportController.ts and
  // the project_audio_clock_ownership memory.
  //
  // IMPORTANT: this is the *engine* path, deliberately lighter than play().
  // play() also kicks pianoRollScheduler (a 25ms setInterval), which competes
  // with Tone's lookahead scheduler for main-thread time and causes audio
  // chunking on pages where no piano-roll patterns are scheduled (e.g.
  // /organism). The studio's play button still calls play() directly via the
  // global transport bar, so piano roll still works for actual studio sessions.
  useEffect(() => {
    return registerTransportOwner({
      start: async () => {
        await resumeAudioContext();
        const bpm = useStudioStore.getState().bpm ?? 120;
        const t   = Tone.getTransport();
        // Safety sync: ensure Transport tempo matches the store before starting.
        useStudioStore.getState().setBpm(bpm);
        if (t.state !== 'started') t.start();
        // Mirror the playing state into the studio store so observers
        // (transport bar, etc.) see we're playing.
        useStudioStore.getState().play();
      },
      stop: () => {
        Tone.getTransport().stop();
        useStudioStore.getState().stop();
        // Cancel any scheduled events from previous sessions — without this,
        // disposed Tone.Parts can leave callbacks queued that fire on the
        // next start, producing the "ghost notes" symptom.
        Tone.getTransport().cancel(0);
      },
      cancel: (after = 0) => {
        Tone.getTransport().cancel(after);
      },
      setPosition: (position) => {
        Tone.getTransport().position = position;
        const numericPosition = typeof position === 'number' ? position : Number(position);
        if (Number.isFinite(numericPosition)) {
          useStudioStore.getState().seek(numericPosition);
        }
      },
    });
  }, []);

  const value = useMemo<TransportContextValue>(() => ({
    tempo,
    isPlaying,
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
  }), [tempo, isPlaying, loop, timeSignature, play, pause, stop, setTempo, seek, setLoop, clearLoop, setTimeSignature, isRecordArmed, toggleRecordArm]);

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
