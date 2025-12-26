import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Timer,
  SkipBack,
  Music
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHotkeys } from 'react-hotkeys-hook';

interface PlaybackControlsProps {
  isPlaying: boolean;
  bpm: number;
  metronomeEnabled: boolean;
  countInEnabled: boolean;
  chordMode: boolean;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  onGoToBeginning?: () => void;
  onToggleChordMode: () => void;
  onBpmChange: (bpm: number) => void;
  onToggleMetronome: (enabled: boolean) => void;
  onToggleCountIn: (enabled: boolean) => void;
  className?: string;
  draggable?: boolean;
}

const BPM_MIN = 40;
const BPM_MAX = 240;

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  bpm = 120,
  metronomeEnabled = false,
  countInEnabled = true,
  chordMode = false,
  onPlay,
  onStop,
  onClear,
  onGoToBeginning,
  onToggleChordMode,
  onBpmChange,
  onToggleMetronome,
  onToggleCountIn,
  className,
}) => {
  // Keyboard shortcuts
  useHotkeys('space', (e) => {
    e.preventDefault();
    if (isPlaying) onStop();
    else onPlay();
  }, [isPlaying, onPlay, onStop]);

  useHotkeys('escape', onStop, [onStop]);
  useHotkeys('home', () => onGoToBeginning?.(), [onGoToBeginning]);

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="playback-controls">
      {/* Transport - Compact */}
      <div className="flex items-center gap-1">
        {onGoToBeginning && (
          <Button size="sm" variant="ghost" onClick={onGoToBeginning} title="Beginning" className="h-8 w-8 p-0">
            <SkipBack className="h-4 w-4" />
          </Button>
        )}
        
        <Button
          size="sm"
          onClick={onPlay}
          className={cn("h-8 px-3", isPlaying ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-600 hover:bg-green-500')}
        >
          {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        
        <Button size="sm" variant="ghost" onClick={onStop} title="Stop" className="h-8 w-8 p-0">
          <Square className="h-4 w-4" />
        </Button>
        
        <Button size="sm" variant="ghost" onClick={onClear} title="Clear" className="h-8 w-8 p-0 text-red-400 hover:text-red-300">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="w-px h-6 bg-gray-600" />
      
      {/* BPM - Compact inline */}
      <div className="flex items-center gap-2">
        <Slider
          value={[bpm]}
          min={BPM_MIN}
          max={BPM_MAX}
          step={1}
          onValueChange={([v]) => onBpmChange(v)}
          className="w-20"
        />
        <span className="text-sm font-mono font-bold w-16">{bpm} <span className="text-xs text-gray-400">BPM</span></span>
      </div>
      
      <div className="w-px h-6 bg-gray-600" />
      
      {/* Toggles - Icon only */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={metronomeEnabled ? 'default' : 'ghost'}
          onClick={() => onToggleMetronome(!metronomeEnabled)}
          title="Metronome (M)"
          className="h-8 w-8 p-0"
        >
          <Timer className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant={chordMode ? 'default' : 'ghost'}
          onClick={onToggleChordMode}
          title="Chord Mode (H)"
          className={cn("h-8 w-8 p-0", chordMode && "bg-purple-600 hover:bg-purple-500")}
        >
          <Music className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default PlaybackControls;
