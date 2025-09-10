import React from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, RotateCcw } from "lucide-react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  onToggleChordMode: () => void;
  chordMode: boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onPlay,
  onStop,
  onClear,
  onToggleChordMode,
  chordMode
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={onPlay}
        className={`${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
      <Button 
        onClick={onStop} 
        variant="outline" 
        className="bg-gray-700 hover:bg-gray-600"
        aria-label="Stop"
      >
        <Square className="h-4 w-4" />
        Stop
      </Button>
      <Button 
        onClick={onClear} 
        variant="outline" 
        className="bg-gray-700 hover:bg-gray-600"
        aria-label="Clear"
      >
        <RotateCcw className="h-4 w-4" />
        Clear
      </Button>
      <Button
        onClick={onToggleChordMode}
        variant={chordMode ? "default" : "outline"}
        className={chordMode ? "bg-purple-600 hover:bg-purple-500" : "bg-gray-700 hover:bg-gray-600"}
        aria-pressed={chordMode}
        aria-label={chordMode ? 'Disable chord mode' : 'Enable chord mode'}
      >
        🎵 {chordMode ? 'Chord Mode On' : 'Chord Mode Off'}
      </Button>
    </div>
  );
};

export default PlaybackControls;
