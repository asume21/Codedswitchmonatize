import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

/**
 * Global Audio Player - Shows at bottom of screen when audio is loaded
 * Persists across all page navigation so music never stops
 */
export function GlobalAudioPlayer() {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    currentSource,
    play,
    pause,
    stop,
    seek,
    setVolume,
  } = useGlobalAudio();

  // Don't show if no audio loaded
  if (!currentSource) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-[9998] bg-gradient-to-r from-purple-900/95 to-pink-900/95 backdrop-blur-lg border-t border-white/10"
      style={{ height: '72px' }}
    >
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center gap-4">
        {/* Song Info */}
        <div className="flex-shrink-0 w-48 truncate">
          <p className="text-sm font-medium text-white truncate">{currentSource.name}</p>
          <p className="text-xs text-white/60">{formatTime(currentTime)} / {formatTime(duration)}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={stop}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="Stop"
          >
            <Square className="w-5 h-5 text-white" />
          </button>
          
          <button
            onClick={isPlaying ? pause : play}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" />
            ) : (
              <Play className="w-6 h-6 text-white ml-0.5" />
            )}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 mx-4">
          <div 
            className="h-2 bg-white/20 rounded-full cursor-pointer relative overflow-hidden"
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

        {/* Volume */}
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

        {/* Status indicator */}
        <div className="flex-shrink-0">
          {isPlaying && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-400">Playing</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
