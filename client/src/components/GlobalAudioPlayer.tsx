import { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import { Play, Pause, Square, Volume2, VolumeX, SkipForward, SkipBack, Minus, Grip } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

type Position = { x: number; y: number };

export function GlobalAudioPlayer() {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    currentSource,
    playlist,
    currentIndex,
    play,
    pause,
    stop,
    seek,
    setVolume,
    next,
    previous,
  } = useGlobalAudio();

  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<Position>(() => {
    const stored = localStorage.getItem('globalTransportPosition');
    return stored ? JSON.parse(stored) : { x: 24, y: 24 };
  });
  const positionRef = useRef<Position>(position);
  const draggingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Derived state (hooks must run consistently across renders)
  const activeSource = useMemo(
    () => currentSource ?? playlist[currentIndex] ?? null,
    [currentIndex, currentSource, playlist]
  );
  const hasContent = Boolean(currentSource) || playlist.length > 0;
  const shouldRender = hasContent && Boolean(activeSource);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const nextPos = { x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y };
      setPosition(nextPos);
    };
    const handleUp = () => {
      draggingRef.current = false;
      localStorage.setItem('globalTransportPosition', JSON.stringify(positionRef.current));
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    draggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 9999,
    minWidth: minimized ? 220 : 420,
    maxWidth: 520,
  };

  const playlistLabel = playlist.length ? `${currentIndex + 1}/${playlist.length}` : '1/1';

  // Hide if nothing loaded (must be AFTER hooks)
  if (!shouldRender || !activeSource) return null;

  return (
    <div
      className="rounded-2xl bg-gray-900/95 border border-white/10 shadow-2xl backdrop-blur-lg text-white"
      style={containerStyle}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 cursor-grab active:cursor-grabbing" onMouseDown={startDrag}>
        <div className="flex items-center gap-2">
          <Grip className="w-4 h-4 text-white/50" />
          <span className="text-sm font-semibold truncate max-w-[200px]" title={activeSource.name}>{activeSource.name || 'Transport'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">{playlistLabel}</span>
          <button
            onClick={() => setMinimized((m) => !m)}
            className="p-1 rounded hover:bg-white/10"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={previous} className="p-2 rounded-full hover:bg-white/10" title="Previous">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={isPlaying ? pause : play}
              className={`p-3 rounded-full ${isPlaying ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={stop} className="p-2 rounded-full hover:bg-white/10" title="Stop">
              <Square className="w-5 h-5" />
            </button>
            <button onClick={next} className="p-2 rounded-full hover:bg-white/10" title="Next">
              <SkipForward className="w-5 h-5" />
            </button>
            <div className="ml-3 text-sm font-mono text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="w-full">
            <div
              className="h-2 bg-white/15 rounded-full cursor-pointer relative overflow-hidden"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                seek(percent * duration);
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-32">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 1)}
                className="p-1 hover:bg-white/10 rounded"
              >
                {volume > 0 ? (
                  <Volume2 className="w-5 h-5 text-white" />
                ) : (
                  <VolumeX className="w-5 h-5 text-white/60" />
                )}
              </button>
              <Slider
                value={[volume * 100]}
                onValueChange={([val]) => setVolume(val / 100)}
                max={100}
                step={1}
                className="w-20"
              />
            </div>
            <div className="flex-1 text-xs text-white/60 truncate">
              {activeSource.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
