import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Timer,
  Volume2,
  ChevronDown,
  ChevronUp,
  Keyboard,
  SkipBack,
  GripVertical,
  X,
  Minimize2,
  Maximize2
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
const BPM_STEP = 1;

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
  draggable = true
}) => {
  const [isFloating, setIsFloating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBpmChange = (value: number) => {
    const newBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, value));
    onBpmChange(newBpm);
  };

  const incrementBpm = () => handleBpmChange(bpm + BPM_STEP);
  const decrementBpm = () => handleBpmChange(bpm - BPM_STEP);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!isFloating) return;
    e.preventDefault();
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y)
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const popOut = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({ x: rect.left, y: rect.top });
    }
    setIsFloating(true);
  };

  const dockBack = () => {
    setIsFloating(false);
    setIsMinimized(false);
  };

  // Keyboard shortcuts
  useHotkeys('space', (e) => {
    e.preventDefault();
    if (isPlaying) onStop();
    else onPlay();
  }, [isPlaying, onPlay, onStop]);

  useHotkeys('escape', onStop, [onStop]);
  useHotkeys('r', onClear, [onClear]);
  useHotkeys('m', () => onToggleMetronome(!metronomeEnabled), [metronomeEnabled, onToggleMetronome]);
  useHotkeys('c', () => onToggleCountIn(!countInEnabled), [countInEnabled, onToggleCountIn]);
  useHotkeys('h', onToggleChordMode, [onToggleChordMode]);
  useHotkeys('up', incrementBpm, [bpm, onBpmChange]);
  useHotkeys('down', decrementBpm, [bpm, onBpmChange]);
  useHotkeys('home', () => onGoToBeginning?.(), [onGoToBeginning]);

  const containerClasses = isFloating
    ? cn(
        "fixed z-50 bg-card rounded-lg border shadow-2xl",
        isDragging ? "cursor-grabbing" : "",
        isMinimized ? "p-2" : "p-4"
      )
    : cn("flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border", className);

  const containerStyle = isFloating
    ? { left: `${position.x}px`, top: `${position.y}px` }
    : undefined;

  if (isFloating && isMinimized) {
    return (
      <div
        ref={containerRef}
        className={containerClasses}
        style={containerStyle}
        data-testid="playback-controls-minimized"
      >
        <div className="flex items-center gap-2">
          <div
            className="cursor-grab p-1 hover:bg-muted rounded"
            onMouseDown={handleDragStart}
            data-testid="drag-handle-minimized"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <Button
            onClick={onPlay}
            size="icon"
            className={cn(
              isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
            )}
            data-testid="button-play-minimized"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="text-sm font-mono">{bpm} BPM</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(false)}
            data-testid="button-expand"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={dockBack}
            data-testid="button-dock"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      style={containerStyle}
      data-testid="playback-controls"
    >
      {isFloating && (
        <div className="flex items-center gap-1 mr-2 border-r pr-2">
          <div
            className="cursor-grab p-1 hover:bg-muted rounded"
            onMouseDown={handleDragStart}
            title="Drag to move"
            data-testid="drag-handle"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
            data-testid="button-minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={dockBack}
            title="Dock back"
            data-testid="button-close-floating"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {draggable && !isFloating && (
        <Button
          variant="ghost"
          size="icon"
          onClick={popOut}
          title="Pop out (make draggable)"
          className="mr-2"
          data-testid="button-popout"
        >
          <GripVertical className="h-5 w-5" />
        </Button>
      )}
      
      <div className="flex flex-wrap items-center gap-4">
      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        {/* Go to Beginning Button */}
        {onGoToBeginning && (
          <Button 
            onClick={onGoToBeginning} 
            variant="outline" 
            className="w-12 justify-center"
            aria-label="Go to Beginning"
            title="Return to beginning (Home)"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
        )}
        
        <Button
          onClick={onPlay}
          className={cn(
            "w-24 justify-center",
            isPlaying 
              ? 'bg-red-600 hover:bg-red-500' 
              : 'bg-green-600 hover:bg-green-500'
          )}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 mr-2" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {isPlaying ? 'Pause' : 'Play'}
          <kbd className="ml-2 text-xs opacity-70">Space</kbd>
        </Button>
        
        <Button 
          onClick={onStop} 
          variant="outline" 
          className="w-24 justify-center"
          aria-label="Stop"
        >
          <Square className="h-4 w-4 mr-2" />
          Stop
          <kbd className="ml-2 text-xs opacity-70">Esc</kbd>
        </Button>
        
        <Button 
          onClick={onClear} 
          variant="outline" 
          className="w-24 justify-center"
          aria-label="Clear"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear
          <kbd className="ml-2 text-xs opacity-70">R</kbd>
        </Button>
      </div>
      
      {/* BPM Control */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center w-32">
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={incrementBpm}
              aria-label="Increase BPM"
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <div className="text-center w-16">
              <span className="text-2xl font-mono font-bold">{bpm}</span>
              <span className="text-xs text-muted-foreground ml-1">BPM</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={decrementBpm}
              aria-label="Decrease BPM"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          <div className="w-full px-2">
            <Slider
              value={[bpm]}
              min={BPM_MIN}
              max={BPM_MAX}
              step={BPM_STEP}
              onValueChange={([value]) => { handleBpmChange(value); }}
              className="w-full"
            />
          </div>
        </div>
      </div>
      
      {/* Toggles */}
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="metronome"
            checked={metronomeEnabled}
            onCheckedChange={onToggleMetronome}
          />
          <div className="flex flex-col">
            <Label htmlFor="metronome" className="flex items-center gap-1 cursor-pointer">
              <Timer className="h-4 w-4" />
              <span>Metronome</span>
              <kbd className="ml-1 text-xs opacity-70">M</kbd>
            </Label>
            <span className="text-xs text-muted-foreground">{metronomeEnabled ? 'On' : 'Off'}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="count-in"
            checked={countInEnabled}
            onCheckedChange={onToggleCountIn}
            disabled={!metronomeEnabled}
          />
          <div className="flex flex-col">
            <Label 
              htmlFor="count-in" 
              className={cn("flex items-center gap-1", metronomeEnabled ? 'cursor-pointer' : 'opacity-50')}
            >
              <Volume2 className="h-4 w-4" />
              <span>Count In</span>
              <kbd className="ml-1 text-xs opacity-70">C</kbd>
            </Label>
            <span className="text-xs text-muted-foreground">
              {!metronomeEnabled ? 'Enable metronome' : countInEnabled ? 'On' : 'Off'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={chordMode ? "default" : "outline"}
            size="sm"
            className={cn(
              "relative",
              chordMode && "bg-purple-600 hover:bg-purple-500"
            )}
            onClick={onToggleChordMode}
            aria-pressed={chordMode}
            aria-label={chordMode ? 'Disable chord mode' : 'Enable chord mode'}
          >
            <span className={cn(chordMode ? 'opacity-100' : 'opacity-70')}>🎵</span>
            <span className="ml-1">Chords</span>
            <kbd className="ml-2 text-xs opacity-70">H</kbd>
          </Button>
        </div>
      </div>
      
      {/* Keyboard Shortcuts Help */}
      <div className="hidden md:flex items-center ml-auto text-sm text-muted-foreground">
        <Keyboard className="h-4 w-4 mr-2" />
        <span className="text-xs">
          <kbd className="px-1.5 py-0.5 border rounded bg-muted">Space</kbd> Play/Pause • 
          <kbd className="px-1.5 py-0.5 border rounded bg-muted">Esc</kbd> Stop • 
          <kbd className="px-1.5 py-0.5 border rounded bg-muted">↑/↓</kbd> BPM • 
          <kbd className="px-1.5 py-0.5 border rounded bg-muted">M</kbd> Metronome • 
          <kbd className="px-1.5 py-0.5 border rounded bg-muted">H</kbd> Chords
        </span>
      </div>
      </div>
    </div>
  );
};

export default PlaybackControls;
