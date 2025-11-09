import React, { useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudio, useSequencer } from "@/hooks/use-audio";
import { StudioAudioContext } from "@/pages/studio";

interface TransportControlsProps {
  currentTool?: string;
  activeTab?: string;
}

const FLOAT_MIN_WIDTH = 800;
const FLOAT_MIN_HEIGHT = 200;

export default function TransportControls({ currentTool = "Studio" }: TransportControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

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

      // Play everything loaded in the context
      const hasPattern = studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0;
      const hasMelody = studioContext.currentMelody && studioContext.currentMelody.length > 0;
      const hasTracks = studioContext.currentTracks && studioContext.currentTracks.length > 0;

      // Only play drum pattern if one is actually loaded
      if (hasPattern) {
        playPattern(studioContext.currentPattern, studioContext.bpm || 120);
      }

      // Play full song (includes melody, vocals, etc) if anything is loaded
      if (hasPattern || hasMelody || hasTracks) {
        await studioContext.playFullSong();
        setIsPlaying(true);
      } else {
        // Nothing loaded, don't play anything
        console.log('No content loaded to play');
      }
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
    
    // Stop recording if active
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
    }
  };

  const handleRecord = async () => {
    try {
      if (!isInitialized) {
        await initialize();
      }

      if (isRecording) {
        // Stop recording
        if (mediaRecorder) {
          mediaRecorder.stop();
        }
        return;
      }

      // Start recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        saveRecording(blob);
        setRecordedChunks([]);
        setIsRecording(false);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Auto-start playback when recording
      if (!isPlaying) {
        handlePlay();
      }
    } catch (error) {
      console.error("🚫 Recording failed:", error);
      alert("Recording failed. Please ensure microphone permissions are granted.");
    }
  };

  const saveRecording = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CodedSwitch-Recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log("✅ Recording saved successfully");
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
    : "bg-transparent";

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
    <div className="flex items-center justify-between px-6 py-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-t border-gray-700">
      {/* Left: Playback Controls */}
      <div className="flex items-center space-x-2">
        <Button
          onClick={() => {/* TODO: Skip to previous */}}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Previous"
        >
          <i className="fas fa-step-backward text-xs"></i>
        </Button>
        
        <Button
          onClick={() => {/* TODO: Rewind */}}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Rewind"
        >
          <i className="fas fa-backward text-xs"></i>
        </Button>
        
        <Button
          onClick={handlePlay}
          size="sm"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isPlaying ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"
          }`}
          title={isPlaying ? "Pause" : "Play"}
        >
          <i className={`fas ${isPlaying ? "fa-pause" : "fa-play"} text-base`}></i>
        </Button>
        
        <Button
          onClick={handleStop}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Stop"
        >
          <i className="fas fa-stop text-xs"></i>
        </Button>
        
        <Button
          onClick={() => {/* TODO: Fast forward */}}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Fast Forward"
        >
          <i className="fas fa-forward text-xs"></i>
        </Button>
        
        <Button
          onClick={() => {/* TODO: Skip to next */}}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Next"
        >
          <i className="fas fa-step-forward text-xs"></i>
        </Button>
        
        <div className="w-px h-6 bg-gray-700 mx-1"></div>
        
        <Button
          onClick={handleRecord}
          size="sm"
          className={`w-8 h-8 rounded-full ${
            isRecording ? "bg-red-600 animate-pulse" : "bg-gray-700 hover:bg-gray-600"
          }`}
          title={isRecording ? "Stop recording" : "Record"}
        >
          <i className={`fas fa-circle text-xs ${isRecording ? "text-white" : "text-red-400"}`}></i>
        </Button>
        
        <Button
          onClick={() => {
            const nextVolume = volume === 0 ? 75 : 0;
            setVolume(nextVolume);
            setMasterVolume(nextVolume);
          }}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title={volume === 0 ? "Unmute" : "Mute"}
        >
          <i className={`fas ${volume === 0 ? "fa-volume-mute" : "fa-volume-up"} text-xs`}></i>
        </Button>
      </div>

      {/* Center: Time & BPM */}
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-gray-300">{currentTime}</span>
          <span className="text-gray-500">/</span>
          <span className="font-mono text-gray-500">{totalTime}</span>
        </div>
        
        <div className="border-l border-gray-700 pl-6">
          <span className="font-mono text-gray-400">{studioContext.bpm || 120} BPM</span>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center gap-1">
          {studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0 && (
            <span className="w-2 h-2 bg-blue-500 rounded-full" title="Drums loaded"></span>
          )}
          {studioContext.currentMelody && studioContext.currentMelody.length > 0 && (
            <span className="w-2 h-2 bg-purple-500 rounded-full" title="Melody loaded"></span>
          )}
          {studioContext.currentTracks && studioContext.currentTracks.length > 0 && (
            <span className="w-2 h-2 bg-green-500 rounded-full" title="Tracks loaded"></span>
          )}
        </div>
      </div>

      {/* Right: Volume */}
      <div className="flex items-center space-x-2">
        <i className="fas fa-volume-up text-gray-400 text-sm"></i>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolumeChange}
          className="w-24 h-1 bg-gray-700 rounded-lg appearance-none slider cursor-pointer"
          aria-label={`Master volume: ${volume}%`}
          title={`Volume: ${volume}%`}
        />
        <span className="text-xs text-gray-400 w-8">{volume}%</span>
        
        {!isFloating && (
          <Button
            onClick={handleFloat}
            size="sm"
            variant="ghost"
            className="ml-2 h-7 text-xs text-gray-400 hover:text-white"
            title="Float player"
          >
            <i className="fas fa-external-link-alt"></i>
          </Button>
        )}
      </div>
    </div>
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
