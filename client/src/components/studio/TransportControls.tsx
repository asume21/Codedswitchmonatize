import React, { useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudio, useSequencer } from "@/hooks/use-audio";
import { StudioAudioContext } from "@/pages/studio";
import { useQuery } from "@tanstack/react-query";
import { Music, ChevronDown, ChevronUp, Pin, PinOff } from "lucide-react";
import WaveformVisualizer from "@/components/studio/WaveformVisualizer";

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
  const [playbackTimeSeconds, setPlaybackTimeSeconds] = useState(0);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [showWaveform, setShowWaveform] = useState(false);
  const [waveformPinned, setWaveformPinned] = useState(false);

  const { setMasterVolume, initialize, isInitialized } = useAudio();
  const { playPattern, stopPattern } = useSequencer();
  const studioContext = useContext(StudioAudioContext);

  // Fetch uploaded songs
  const { data: songs = [] } = useQuery<any[]>({
    queryKey: ['/api/songs'],
    initialData: [],
  });

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

      // Check for uploaded song first
      const hasUploadedSong = studioContext.currentUploadedSong && studioContext.uploadedSongAudio;
      
      if (hasUploadedSong && studioContext.uploadedSongAudio) {
        // Play uploaded song through audio element
        console.log('▶️ Playing uploaded song:', studioContext.currentUploadedSong.name);
        await studioContext.uploadedSongAudio.play();
        setIsPlaying(true);
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
    
    // Stop uploaded song if playing
    if (studioContext.uploadedSongAudio) {
      studioContext.uploadedSongAudio.pause();
      studioContext.uploadedSongAudio.currentTime = 0;
    }
    
    setIsPlaying(false);
    setCurrentTime("00:00");
    setPlaybackTimeSeconds(0);
    
    // Stop recording if active
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
    }
  };

  const handleRewind = () => {
    const newTime = Math.max(0, playbackTimeSeconds - 10);
    setPlaybackTimeSeconds(newTime);
    const minutes = Math.floor(newTime / 60);
    const seconds = Math.floor(newTime % 60);
    setCurrentTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    // TODO: Seek audio playback to new time
    console.log('⏪ Rewind to:', newTime);
  };

  const handleFastForward = () => {
    const totalSeconds = 165; // 02:45 in seconds
    const newTime = Math.min(totalSeconds, playbackTimeSeconds + 10);
    setPlaybackTimeSeconds(newTime);
    const minutes = Math.floor(newTime / 60);
    const seconds = Math.floor(newTime % 60);
    setCurrentTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    // TODO: Seek audio playback to new time
    console.log('⏩ Fast forward to:', newTime);
  };

  const handlePrevious = () => {
    // Skip to start if past 3 seconds, otherwise go to actual previous track
    if (playbackTimeSeconds > 3) {
      setPlaybackTimeSeconds(0);
      setCurrentTime("00:00");
    } else {
      // TODO: Load previous track from playlist
      console.log('⏮ Skip to previous track');
    }
  };

  const handleNext = () => {
    // TODO: Load next track from playlist
    console.log('⏭ Skip to next track');
    setPlaybackTimeSeconds(0);
    setCurrentTime("00:00");
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
    
    // Also update uploaded song volume if playing
    if (studioContext.uploadedSongAudio) {
      studioContext.uploadedSongAudio.volume = nextVolume / 100;
    }
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

  const loadSong = async (song: any) => {
    try {
      // Try multiple URL sources
      let accessibleURL = song.accessibleUrl || song.originalUrl || song.songURL;
      
      if (!accessibleURL) {
        console.error("No URL available for song");
        return;
      }

      // Add timestamp for cache busting
      if (accessibleURL.includes('/api/internal/uploads/')) {
        const timestamp = Date.now();
        accessibleURL = accessibleURL.includes('?') 
          ? `${accessibleURL}&t=${timestamp}&direct=true`
          : `${accessibleURL}?t=${timestamp}&direct=true`;
      }

      // Create new audio element
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = accessibleURL;
      audio.preload = "metadata";
      audio.volume = volume / 100; // Set initial volume from master volume
      
      audio.addEventListener('ended', () => {
        console.log(`✅ Song finished: ${song.name}`);
        studioContext.setCurrentUploadedSong(null, null);
        setIsPlaying(false);
      });

      // Store in context
      studioContext.setCurrentUploadedSong(song, audio);
      setShowSongPicker(false);
      
      console.log(`✅ Song loaded: ${song.name} at ${volume}% volume`);
    } catch (error) {
      console.error('Failed to load song:', error);
    }
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

  // Update playback timer when playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setPlaybackTimeSeconds((prev) => {
        const newTime = prev + 1;
        const minutes = Math.floor(newTime / 60);
        const seconds = Math.floor(newTime % 60);
        setCurrentTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        
        // Stop at end of track
        if (newTime >= 165) { // 02:45
          setIsPlaying(false);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

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
          onClick={handlePrevious}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Previous (or restart if past 3s)"
        >
          <i className="fas fa-step-backward text-xs"></i>
        </Button>
        
        <Button
          onClick={handleRewind}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Rewind 10 seconds"
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
          onClick={handleFastForward}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Fast forward 10 seconds"
        >
          <i className="fas fa-forward text-xs"></i>
        </Button>
        
        <Button
          onClick={handleNext}
          size="sm"
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600"
          title="Next track"
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
            
            // Also update uploaded song volume
            if (studioContext.uploadedSongAudio) {
              studioContext.uploadedSongAudio.volume = nextVolume / 100;
            }
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
        
        {/* Current Song Info & Picker */}
        <div className="flex items-center gap-2">
          {studioContext.currentUploadedSong ? (
            <div className="flex items-center gap-2 bg-blue-900/20 px-3 py-1 rounded-full">
              <Music className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-blue-300 max-w-[150px] truncate">
                {studioContext.currentUploadedSong.name}
              </span>
            </div>
          ) : null}
          
          <Button
            onClick={() => setShowSongPicker(!showSongPicker)}
            size="sm"
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 relative"
            title="Song Library"
          >
            <Music className="w-4 h-4" />
            {songs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[9px] flex items-center justify-center">
                {songs.length}
              </span>
            )}
          </Button>
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
      onMouseEnter={() => !isFloating && studioContext.currentUploadedSong && !waveformPinned && setShowWaveform(true)}
      onMouseLeave={() => !isFloating && !waveformPinned && setShowWaveform(false)}
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
      
      {/* Song Picker Dropdown */}
      {showSongPicker && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Song Library</h3>
            </div>
            <Button
              onClick={() => setShowSongPicker(false)}
              size="sm"
              variant="ghost"
              className="w-6 h-6 p-0"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {songs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Music className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No songs uploaded yet</p>
                <p className="text-xs mt-1">Go to Song Uploader to add songs</p>
              </div>
            ) : (
              <div className="space-y-1">
                {songs.map((song: any) => (
                  <button
                    key={song.id}
                    onClick={() => loadSong(song)}
                    className={`w-full text-left p-2 rounded hover:bg-gray-700 transition-colors ${
                      studioContext.currentUploadedSong?.id === song.id
                        ? 'bg-blue-900/30 border border-blue-500/30'
                        : 'border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {song.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {song.duration ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}` : 'Unknown duration'}
                        </div>
                      </div>
                      {studioContext.currentUploadedSong?.id === song.id && (
                        <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-700 bg-gray-900/50">
            <p className="text-xs text-gray-400 text-center">
              Click a song to load, then press ▶️ to play
            </p>
          </div>
        </div>
      )}

      {/* Waveform Panel - Collapsible, shows above transport */}
      {studioContext.currentUploadedSong && studioContext.uploadedSongAudio && (
        <div
          className="absolute bottom-full left-0 right-0 transition-all duration-300 ease-in-out"
          style={{
            transform: (showWaveform || waveformPinned) ? 'translateY(0)' : 'translateY(calc(100% - 40px))',
          }}
          onMouseEnter={() => !waveformPinned && setShowWaveform(true)}
          onMouseLeave={() => !waveformPinned && setShowWaveform(false)}
        >
          <div className="bg-gradient-to-b from-gray-800 to-gray-850 border border-gray-700 border-b-0 rounded-t-lg shadow-2xl overflow-hidden">
            {/* Collapsed Header Bar (always visible) */}
            <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <Music className="w-4 h-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">
                    {studioContext.currentUploadedSong.name}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Pin/Unpin Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setWaveformPinned(!waveformPinned);
                    if (!waveformPinned) {
                      setShowWaveform(true);
                    }
                  }}
                  className={`h-6 w-6 p-0 ${waveformPinned ? 'bg-blue-600 hover:bg-blue-500' : 'hover:bg-gray-700'}`}
                  title={waveformPinned ? "Unpin waveform (will collapse on mouse leave)" : "Pin waveform (keep expanded)"}
                >
                  {waveformPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
                </Button>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{waveformPinned ? 'Pinned' : `Hover to ${showWaveform ? 'collapse' : 'expand'}`}</span>
                  <ChevronUp className={`w-4 h-4 transition-transform ${(showWaveform || waveformPinned) ? '' : 'rotate-180'}`} />
                </div>
              </div>
            </div>

            {/* Expanded Content (waveform) */}
            <div
              className="transition-all duration-300 ease-in-out overflow-hidden"
              style={{
                maxHeight: (showWaveform || waveformPinned) ? '200px' : '0',
                opacity: (showWaveform || waveformPinned) ? 1 : 0,
              }}
            >
              <div className="p-4">
                <WaveformVisualizer
                  audioElement={studioContext.uploadedSongAudio}
                  isPlaying={isPlaying}
                  height={120}
                  showControls={true}
                />
                <p className="text-xs text-gray-400 text-center mt-2">
                  Click anywhere on the waveform to seek • Use zoom controls to see details
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
