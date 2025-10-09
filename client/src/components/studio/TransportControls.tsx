import React, { useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudio, useSequencer } from "@/hooks/use-audio";
import { StudioAudioContext } from "@/pages/studio";

interface TransportControlsProps {
  currentTool?: string;
  activeTab?: string;
}

const DEFAULT_PATTERN = {
  kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
  snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
  hihat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
};

const FLOAT_MIN_WIDTH = 800;
const FLOAT_MIN_HEIGHT = 200;

export default function TransportControls({ currentTool = "Studio" }: TransportControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState("00:00");
  const [totalTime] = useState("02:45");
  const [bar] = useState(1);
  const [beat] = useState(1);
  const [volume, setVolume] = useState(75);
  const [isFloating, setIsFloating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const { setMasterVolume, initialize, isInitialized } = useAudio();
  const { playPattern, stopPattern } = useSequencer();
  const studioContext = useContext(StudioAudioContext);

  const handlePlay = async () => {
    try {
      if (!isInitialized) {
        await initialize();
      }

      if (isPlaying) {
        stopPattern();
        studioContext.stopFullSong();
        setIsPlaying(false);
        return;
      }

      const pattern =
        studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0
          ? studioContext.currentPattern
          : DEFAULT_PATTERN;

      playPattern(pattern, studioContext.bpm || 120);
      await studioContext.playFullSong();
      setIsPlaying(true);
    } catch (error) {
      console.error("🚫 Global transport failed", error);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    stopPattern();
    studioContext.stopFullSong();
    setIsPlaying(false);
    setCurrentTime("00:00");
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setMasterVolume(nextVolume);
  };

  const handleFloat = () => {
    setIsFloating(true);
    setIsMinimized(false);

    const centerX = Math.max(0, window.innerWidth / 2 - FLOAT_MIN_WIDTH / 2);
    const centerY = Math.max(0, window.innerHeight / 2 - FLOAT_MIN_HEIGHT / 2);
    setPosition({ x: centerX, y: centerY });
  };

  const handleDock = () => {
    setIsFloating(false);
    setIsMinimized(false);
    setPosition({ x: 0, y: 0 });
  };

  const handleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (!isFloating) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;

    setIsDragging(true);
    setDragOffset({
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      const newX = event.clientX - dragOffset.x;
      const newY = event.clientY - dragOffset.y;

      const maxX = window.innerWidth - FLOAT_MIN_WIDTH;
      const maxY = window.innerHeight - FLOAT_MIN_HEIGHT;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragOffset, isDragging]);

  const containerClasses = isFloating
    ? `fixed bg-studio-panel border border-gray-600 rounded-lg shadow-2xl px-6 z-50 ${
        isDragging ? "cursor-grabbing" : ""
      } ${isMinimized ? "h-auto pb-2 min-w-[400px]" : "py-4 min-w-[800px]"}`
    : "bg-studio-panel border-t border-gray-700 px-6 py-4";

  const containerStyle = isFloating
    ? { left: `${position.x}px`, top: `${position.y}px`, transform: "none" }
    : undefined;

  const renderMinimized = () => (
    <div className="mt-8 flex items-center justify-between gap-4 px-4 py-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handlePlay}
          variant="default"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isPlaying ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"
          }`}
          title={isPlaying ? "Pause" : "Play"}
        >
          <i className={`fas ${isPlaying ? "fa-pause" : "fa-play"} text-white`}></i>
        </Button>
      </div>

      <div className="flex items-center gap-2 min-w-[140px]">
        <i className="fas fa-volume-down text-gray-400 text-xs"></i>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          aria-label={`Master volume control: ${volume}%`}
          title={`Volume: ${volume}%`}
        />
        <span className="text-xs text-gray-300 w-8">{volume}%</span>
      </div>
    </div>
  );

  const renderExpanded = () => (
    <>
      <div className={`mb-3 flex items-center justify-between gap-4 p-3 bg-gray-800 rounded-lg relative ${isFloating ? "mt-8" : "mt-8"}`}>
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-gray-300">Global Transport</span>
          {isFloating ? (
            <Button
              onClick={handleDock}
              size="sm"
              variant="outline"
              className="h-6 w-12 text-xs bg-blue-600 hover:bg-blue-500 text-white border-blue-500"
              title="Dock to bottom"
            >
              Dock
            </Button>
          ) : (
            <Button
              onClick={handleFloat}
              size="sm"
              variant="outline"
              className="h-6 w-12 text-xs bg-green-600 hover:bg-green-500 text-white border-green-500"
              title="Float controls"
            >
              Float
            </Button>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {isPlaying ? `Playing full mix (${currentTool})` : `Ready to play ${currentTool}`}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex flex-col items-center space-y-1">
            <Button
              onClick={handlePlay}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isPlaying ? "bg-red-600 hover:bg-red-500" : "bg-studio-success hover:bg-green-500"
              }`}
              title={isPlaying ? "Pause global mix" : "Play global mix"}
            >
              <i className={`fas ${isPlaying ? "fa-pause" : "fa-play"} text-lg`}></i>
            </Button>
            <span className="text-xs text-gray-300 font-medium">{isPlaying ? "Pause" : "Play"}</span>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <Button
              onClick={handleStop}
              className="bg-red-600 hover:bg-red-500 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              title="Stop and reset"
            >
              <i className="fas fa-stop"></i>
            </Button>
            <span className="text-xs text-gray-400">Stop</span>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="text-sm">
            <span className="font-mono text-lg">{currentTime}</span>
            <span className="text-gray-400 ml-2">/ {totalTime}</span>
          </div>
          <div className="text-sm">
            <span className="font-mono">Bar {bar}</span>
            <span className="text-gray-400 ml-2">Beat {beat}</span>
          </div>
          <div className="text-sm">
            <span className="font-mono">{studioContext.bpm || 120} BPM</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <i className="fas fa-volume-up text-gray-400"></i>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 h-2 bg-gray-700 rounded-lg appearance-none slider"
            aria-label={`Master volume control: ${volume}%`}
            title={`Master volume: ${volume}%`}
          />
          <span className="text-sm text-gray-400 w-8">{volume}%</span>
        </div>
      </div>
    </>
  );

  return (
    <div
      className={containerClasses}
      style={containerStyle}
      onMouseDown={isFloating ? handleMouseDown : undefined}
    >
      {isFloating && (
        <div
          className="absolute top-0 left-0 right-0 h-8 bg-gray-700 rounded-t-lg flex items-center justify-between px-3 cursor-grab hover:bg-gray-600 transition-colors"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
            <span className="text-xs text-gray-400 font-medium">Transport Controls</span>
          </div>

          <div className="flex items-center space-x-1">
            <Button
              onClick={handleMinimize}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-xs hover:bg-yellow-600 bg-yellow-500 border border-yellow-400"
              title={isMinimized ? "Expand controls" : "Minimize controls"}
            >
              <span className="text-black text-lg font-bold leading-none">
                {isMinimized ? "+" : "−"}
              </span>
            </Button>
            <Button
              onClick={handleDock}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-xs hover:bg-red-600 bg-red-500 border border-red-400"
              title="Dock to bottom"
            >
              <span className="text-white text-lg font-bold leading-none">×</span>
            </Button>
          </div>
        </div>
      )}

      {isFloating && isMinimized ? renderMinimized() : renderExpanded()}
    </div>
  );
}
