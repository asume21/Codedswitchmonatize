/**
 * Floating Audio Monitor — Shows ALL currently playing audio in the app.
 * Appears as a small widget in the bottom-right corner.
 * Lets users see what's playing and stop individual sources or kill all.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, X, ChevronUp, ChevronDown, Square } from 'lucide-react';
import { globalAudioKillSwitch } from '@/lib/globalAudioKillSwitch';

interface TrackedAudio {
  id: number;
  element: HTMLAudioElement;
  src: string;
  playing: boolean;
  currentTime: number;
  duration: number;
}

let audioIdCounter = 0;

export default function FloatingAudioMonitor() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [trackedAudios, setTrackedAudios] = useState<TrackedAudio[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll all tracked audio elements every 500ms
  const pollAudio = useCallback(() => {
    // Access the private set via the singleton — we read it through a
    // helper we'll attach below.
    const elements = (globalAudioKillSwitch as any).audioElements as Set<HTMLAudioElement> | undefined;
    if (!elements) return;

    const list: TrackedAudio[] = [];
    elements.forEach((el: HTMLAudioElement) => {
      // Only show elements that have a src and are not silent stubs
      if (!el.src || el.src === '' || el.src === 'about:blank') return;
      // Assign a stable id
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

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {isExpanded && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-80 max-h-80 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
            <span className="text-xs font-semibold text-gray-300">
              Audio Monitor ({trackedAudios.length} tracked, {playingCount} playing)
            </span>
            <button onClick={() => setIsExpanded(false)} className="text-gray-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-56 p-2 space-y-1.5">
            {trackedAudios.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No audio elements tracked</p>
            )}
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

      {/* Floating button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg text-xs font-bold transition-all ${
          playingCount > 0
            ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600'
        }`}
      >
        {playingCount > 0 ? (
          <>
            <Volume2 className="w-4 h-4" />
            {playingCount} Playing
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </>
        ) : (
          <>
            <VolumeX className="w-4 h-4" />
            Audio
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </>
        )}
      </button>
    </div>
  );
}
