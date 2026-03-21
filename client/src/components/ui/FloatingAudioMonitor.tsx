/**
 * Floating Audio Monitor + Organism Controller
 *
 * Bottom-right widget that shows:
 * 1. Organism mini-controls (start/stop/record) — available on ANY page
 * 2. All currently playing audio elements with kill switches
 *
 * The Organism section only appears once the organism has been activated
 * (via the "Activate" button or the dedicated Organism tab in the studio).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Volume2, VolumeX, X, ChevronUp, ChevronDown, Square,
  Play, Mic2, Circle, Download, Zap, Lock, Unlock,
} from 'lucide-react';
import { globalAudioKillSwitch } from '@/lib/globalAudioKillSwitch';
import { useOrganismActivation, useOrganismSafe } from '@/features/organism/GlobalOrganismWrapper';

interface TrackedAudio {
  id: number;
  element: HTMLAudioElement;
  src: string;
  playing: boolean;
  currentTime: number;
  duration: number;
}

let audioIdCounter = 0;

function OrganismMiniControls() {
  const organism = useOrganismSafe();
  const { isActivated, activate } = useOrganismActivation();
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track recording elapsed time
  useEffect(() => {
    if (organism?.isRecording) {
      const start = Date.now();
      elapsedRef.current = setInterval(() => setElapsed(Date.now() - start), 500);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setElapsed(0);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [organism?.isRecording]);

  const formatElapsed = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Not yet activated — show activate button
  if (!isActivated) {
    return (
      <div className="px-3 py-2.5 border-b border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-300">Organism</span>
          </div>
          <button
            onClick={activate}
            className="px-2.5 py-1 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 text-[10px] font-bold hover:bg-cyan-500/30 transition-colors"
          >
            ACTIVATE
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-1">Boot the beat engine to freestyle anywhere</p>
      </div>
    );
  }

  // Activated but provider not ready yet
  if (!organism) {
    return (
      <div className="px-3 py-2.5 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="text-xs text-cyan-300">Booting engines...</span>
        </div>
      </div>
    );
  }

  const {
    isRunning, isRecording, start, stop, startRecording, stopRecording,
    downloadSession, lastSavedSession,
    latchMode, setLatchMode,
    isPatternLocked, lockPattern, unlockPattern,
    hatDensity, kickVelocity, bassVolume, melodyVolume,
    setHatDensity, setKickVelocity, setBassVolume, setMelodyVolume,
  } = organism;

  return (
    <div className="px-3 py-2.5 border-b border-cyan-500/20 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Zap className={`w-3.5 h-3.5 ${isRunning ? 'text-green-400' : 'text-cyan-400'}`} />
        <span className="text-xs font-semibold text-cyan-300">Organism</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
        {isRecording && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
            <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 animate-pulse" />
            REC {formatElapsed(elapsed)}
          </span>
        )}
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Start / Stop */}
        <button
          onClick={isRunning ? stop : start}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold transition-colors ${
            isRunning
              ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
              : 'bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30'
          }`}
        >
          {isRunning ? (
            <><Square className="w-3 h-3" /> Stop</>
          ) : (
            <><Play className="w-3 h-3" /> Start</>
          )}
        </button>

        {/* Record / Stop Recording */}
        <button
          onClick={isRecording ? () => stopRecording() : startRecording}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold transition-colors ${
            isRecording
              ? 'bg-red-600/30 border border-red-500/50 text-red-200 hover:bg-red-600/40 animate-pulse'
              : 'bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25'
          }`}
          title={isRecording ? 'Stop recording (saves beat + vocals + MIDI + lyrics)' : 'Record everything (beat + vocals + MIDI + lyrics)'}
        >
          {isRecording ? (
            <><Square className="w-3 h-3" /> Save</>
          ) : (
            <><Circle className="w-3 h-3" /> Record</>
          )}
        </button>

        {/* Download last session */}
        {lastSavedSession && (
          <button
            onClick={() => downloadSession(lastSavedSession)}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition-colors"
            title="Download last recorded session (beat + vocals + MIDI + lyrics)"
          >
            <Download className="w-3 h-3" />
          </button>
        )}

        {/* Latch toggle — keeps organism alive when MIDI keys are released */}
        <button
          onClick={() => setLatchMode(!latchMode)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold transition-colors ${
            latchMode
              ? 'bg-yellow-500/25 border border-yellow-400/50 text-yellow-200 hover:bg-yellow-500/35'
              : 'bg-gray-700/50 border border-gray-600/50 text-gray-400 hover:bg-gray-700'
          }`}
          title={latchMode ? 'Latch ON — organism holds energy when keys release. Click to turn off.' : 'Latch OFF — organism fades when you stop playing. Click to hold energy.'}
        >
          {latchMode ? 'LATCH ON' : 'LATCH'}
        </button>

        {/* Pattern lock — freeze the groove */}
        {isRunning && (
          <button
            onClick={isPatternLocked ? unlockPattern : lockPattern}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold transition-colors ${
              isPatternLocked
                ? 'bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/35'
                : 'bg-gray-700/50 border border-gray-600/50 text-gray-400 hover:bg-gray-700'
            }`}
            title={isPatternLocked ? 'Pattern LOCKED — groove is frozen. Click to unlock.' : 'Lock Pattern — freeze the current groove so it loops unchanged.'}
          >
            {isPatternLocked ? (
              <><Lock className="w-3 h-3" /> LOCKED</>
            ) : (
              <><Unlock className="w-3 h-3" /> Lock</>
            )}
          </button>
        )}
      </div>

      {/* Tweak sliders — only visible when pattern is locked */}
      {isPatternLocked && (
        <div className="space-y-1.5 pt-1 border-t border-cyan-500/15">
          <p className="text-[9px] text-cyan-400/70 font-semibold uppercase tracking-wider">Groove Tweaks</p>

          {/* Hat density */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-16 shrink-0">Hats</span>
            <input
              type="range" min={0} max={2} step={0.05}
              value={hatDensity}
              onChange={e => setHatDensity(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-cyan-400 cursor-pointer"
            />
            <span className="text-[10px] text-gray-500 w-6 text-right">{hatDensity.toFixed(1)}</span>
          </div>

          {/* Kick velocity */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-16 shrink-0">Kick</span>
            <input
              type="range" min={0} max={2} step={0.05}
              value={kickVelocity}
              onChange={e => setKickVelocity(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-cyan-400 cursor-pointer"
            />
            <span className="text-[10px] text-gray-500 w-6 text-right">{kickVelocity.toFixed(1)}</span>
          </div>

          {/* Bass volume */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-16 shrink-0">Bass</span>
            <input
              type="range" min={0} max={2} step={0.05}
              value={bassVolume}
              onChange={e => setBassVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-cyan-400 cursor-pointer"
            />
            <span className="text-[10px] text-gray-500 w-6 text-right">{bassVolume.toFixed(1)}</span>
          </div>

          {/* Melody volume */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-16 shrink-0">Melody</span>
            <input
              type="range" min={0} max={2} step={0.05}
              value={melodyVolume}
              onChange={e => setMelodyVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-cyan-400 cursor-pointer"
            />
            <span className="text-[10px] text-gray-500 w-6 text-right">{melodyVolume.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* Last session info */}
      {lastSavedSession && (
        <div className="text-[10px] text-gray-500 flex items-center gap-2 flex-wrap">
          <span>Last: {Math.round(lastSavedSession.durationMs / 1000)}s</span>
          {lastSavedSession.beatBlob && <span className="text-cyan-500">Beat</span>}
          {lastSavedSession.vocalBlob && <span className="text-orange-500">Vocals</span>}
          {lastSavedSession.midiBlob && <span className="text-purple-500">MIDI</span>}
          {lastSavedSession.lyrics && <span className="text-yellow-500">Lyrics</span>}
        </div>
      )}
    </div>
  );
}

export default function FloatingAudioMonitor() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [trackedAudios, setTrackedAudios] = useState<TrackedAudio[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read organism state for the floating button appearance
  const organism = useOrganismSafe();
  const organismRunning = organism?.isRunning ?? false;
  const organismRecording = organism?.isRecording ?? false;

  // Poll all tracked audio elements every 500ms
  const pollAudio = useCallback(() => {
    const elements = (globalAudioKillSwitch as any).audioElements as Set<HTMLAudioElement> | undefined;
    if (!elements) return;

    const list: TrackedAudio[] = [];
    elements.forEach((el: HTMLAudioElement) => {
      if (!el.src || el.src === '' || el.src === 'about:blank') return;
      if (!(el as any).__monitorId) {
        (el as any).__monitorId = ++audioIdCounter;
      }
      list.push({
        id: (el as any).__monitorId,
        element: el,
        src: el.src,
        playing: !el.paused && !el.ended,
        currentTime: el.currentTime || 0,
        duration: el.duration || 0,
      });
    });

    setTrackedAudios(list);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(pollAudio, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollAudio]);

  const playingCount = trackedAudios.filter(a => a.playing).length;

  const stopOne = (audio: HTMLAudioElement) => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      audio.removeAttribute('src');
      audio.load();
    } catch { /* ignore */ }
    pollAudio();
  };

  const killAll = () => {
    globalAudioKillSwitch.killAllAudio();
    setTimeout(pollAudio, 600);
  };

  const formatTime = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const shortenSrc = (src: string) => {
    try {
      const url = new URL(src);
      const path = url.pathname;
      const filename = path.split('/').pop() || path;
      return filename.length > 30 ? filename.slice(0, 27) + '...' : filename;
    } catch {
      return src.length > 30 ? src.slice(0, 27) + '...' : src;
    }
  };

  const { isActivated } = useOrganismActivation();
  // Determine floating button state
  const buttonState = organismRecording ? 'recording' : organismRunning ? 'organism-live' : playingCount > 0 ? 'audio-playing' : 'idle';

  return (
    <div className="fixed z-[200] flex flex-col items-end gap-2"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}
    >
      {/* Expanded panel */}
      {isExpanded && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-[min(20rem,calc(100vw-2rem))] max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
            <span className="text-xs font-semibold text-gray-300">
              Audio &amp; Organism
            </span>
            <button onClick={() => setIsExpanded(false)} className="text-gray-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Organism mini-controls — always visible at top */}
          <OrganismMiniControls />

          {/* Tracked audio elements — only shows <audio> file players, not Organism/Tone.js */}
          {trackedAudios.length > 0 && (
          <div className="overflow-y-auto max-h-44 p-2 space-y-1.5">
            {trackedAudios.map(a => (
              <div
                key={a.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                  a.playing ? 'bg-red-900/40 border border-red-700/50' : 'bg-gray-800 border border-gray-700/50'
                }`}
              >
                {a.playing ? (
                  <Volume2 className="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 truncate" title={a.src}>{shortenSrc(a.src)}</p>
                  <p className="text-gray-500">
                    {formatTime(a.currentTime)} / {formatTime(a.duration)}
                    {a.playing && <span className="ml-1 text-red-400 font-bold">PLAYING</span>}
                  </p>
                </div>
                {a.playing && (
                  <button
                    onClick={() => stopOne(a.element)}
                    className="shrink-0 bg-red-600 hover:bg-red-500 text-white rounded px-1.5 py-0.5 text-[10px] font-bold"
                  >
                    STOP
                  </button>
                )}
              </div>
            ))}
          </div>
          )}

          {playingCount > 0 && (
            <div className="px-3 py-2 border-t border-gray-700">
              <button
                onClick={killAll}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded py-1.5 text-xs font-bold"
              >
                <Square className="w-3.5 h-3.5" />
                KILL ALL AUDIO ({playingCount} playing)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating button — reflects organism + audio state */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full shadow-lg text-xs font-bold transition-all ${
          buttonState === 'recording'
            ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
            : buttonState === 'organism-live'
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : buttonState === 'audio-playing'
            ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
            : !isActivated
            ? 'bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-500/60 animate-pulse'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600'
        }`}
        style={{ minHeight: '44px', minWidth: '44px' }}
      >
        {buttonState === 'recording' ? (
          <>
            <Circle className="w-3.5 h-3.5 fill-white" />
            REC
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </>
        ) : buttonState === 'organism-live' ? (
          <>
            <Mic2 className="w-4 h-4" />
            Live
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </>
        ) : playingCount > 0 ? (
          <>
            <Volume2 className="w-4 h-4" />
            {playingCount} Playing
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            {isActivated ? 'Organism' : 'Start Organism'}
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </>
        )}
      </button>
    </div>
  );
}
