import React, { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, Music, Drum,
  Piano, Mic2, ChevronUp, ChevronDown,
  Settings, Layers, Circle
} from 'lucide-react';
import { StudioAudioContext } from '@/pages/studio';
import { useTransport } from '@/contexts/TransportContext';
import { useAudio, useSequencer } from '@/hooks/use-audio';
import { useTracks } from '@/hooks/useTracks';
import { cn } from '@/lib/utils';
import { getTimelineRecorder, type RecorderState, type RecordingResult } from '@/lib/timelineRecorder';
import { getCurrentProject, markDirty, type AudioClip } from '@/lib/projectManager';
import { professionalAudio } from '@/lib/professionalAudio';
import { MasterBusPanel } from './MasterBusPanel';
import { pianoRollScheduler } from '@/lib/pianoRollScheduler';

interface TrackChannel {
  id: string;
  name: string;
  type: 'beat' | 'melody' | 'bass' | 'vocals' | 'fx' | 'master';
  icon: React.ReactNode;
  muted: boolean;
  solo: boolean;
  volume: number;
  color: string;
}

interface GlobalTransportBarProps {
  variant?: 'fixed' | 'inline';
}

export default function GlobalTransportBar({ variant = 'fixed' }: GlobalTransportBarProps) {
  const isInline = variant === 'inline';
  const studioContext = useContext(StudioAudioContext);
  const { 
    tempo, setTempo, position, isPlaying: transportPlaying, 
    play: startTransport, pause: pauseTransport, stop: stopTransport, 
    loop, setLoop, seek,
    timeSignature,
    setTimeSignature,
    isRecordArmed, toggleRecordArm
  } = useTransport();
  const { initialize, isInitialized, playNote, playDrum, setMasterVolume } = useAudio();
  const { playPattern, stopPattern } = useSequencer();
  const { tracks: storeTracks } = useTracks();

  const [expanded, setExpanded] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(80);

  // ─── Visual metronome ─────────────────────────────────────────────
  const [beatFlash, setBeatFlash] = useState<'beat1' | 'beat' | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsub = pianoRollScheduler.subscribeVisual((step) => {
      if (step % 4 === 0) {
        setBeatFlash(step === 0 ? 'beat1' : 'beat');
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setBeatFlash(null), 90);
      }
    });
    return () => { unsub(); if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, []);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'all' | 'beat' | 'melody' | 'custom'>('all');

  // ─── Recording State ──────────────────────────────────────────────
  const recorder = useRef(getTimelineRecorder()).current;
  const [recorderState, setRecorderState] = useState<RecorderState>(recorder.getState());

  useEffect(() => {
    return recorder.subscribe(setRecorderState);
  }, [recorder]);

  const isRecording = recorderState.isRecording;

  const handleRecord = async () => {
    await ensureAudioInit();
    
    // If not armed and not recording, check permissions
    if (!isRecordArmed && !isRecording) {
      if (!recorderState.hasPermission) {
        const granted = await recorder.requestPermission();
        if (!granted) return;
      }
    }

    toggleRecordArm();
  };

  const addRecordingToTimeline = (result: RecordingResult) => {
    const project = getCurrentProject();
    if (!project) return;

    const durationBeats = (result.durationSeconds / 60) * tempo;
    const clip: AudioClip = {
      id: crypto.randomUUID(),
      trackId: 'recording-' + Date.now(),
      name: `Recording @ Bar ${Math.floor(result.startBeat / timeSignature.numerator) + 1}`,
      audioUrl: result.url,
      startBeat: result.startBeat,
      endBeat: result.startBeat + durationBeats,
      offsetBeat: 0,
      fadeInBeats: 0,
      fadeOutBeats: 0,
      gain: 1,
      loop: false,
      loopEndBeat: 0,
      source: 'recording',
    };

    project.audioClips.push(clip);
    markDirty();
    console.log(`🎤 Recording added to timeline: ${clip.name} (${result.durationSeconds.toFixed(1)}s)`);
  };
  
  // Track channels for mixing
  const [channels, setChannels] = useState<TrackChannel[]>([
    { id: 'beat', name: 'Drums/Beat', type: 'beat', icon: <Drum className="w-3 h-3" />, muted: false, solo: false, volume: 80, color: 'bg-orange-500' },
    { id: 'melody', name: 'Melody', type: 'melody', icon: <Piano className="w-3 h-3" />, muted: false, solo: false, volume: 80, color: 'bg-blue-500' },
    { id: 'bass', name: 'Bass', type: 'bass', icon: <Music className="w-3 h-3" />, muted: false, solo: false, volume: 80, color: 'bg-purple-500' },
    { id: 'vocals', name: 'Vocals', type: 'vocals', icon: <Mic2 className="w-3 h-3" />, muted: false, solo: false, volume: 80, color: 'bg-pink-500' },
    { id: 'fx', name: 'FX/Other', type: 'fx', icon: <Layers className="w-3 h-3" />, muted: false, solo: false, volume: 80, color: 'bg-green-500' },
  ]);

  // Format time display
  const formatTime = (beats: number) => {
    const totalSeconds = (beats / tempo) * 60;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Format bar/beat display respecting time signature
  const formatBarBeat = (beats: number) => {
    const beatsPerBar = Math.max(1, timeSignature.numerator);
    const bar = Math.floor(beats / beatsPerBar) + 1;
    const beat = Math.floor(beats % beatsPerBar) + 1;
    return `${bar}.${beat}`;
  };

  // Initialize audio on first interaction
  const ensureAudioInit = async () => {
    if (!isInitialized) {
      await initialize();
    }
  };

  // Play handler with mode support
  const handlePlay = async () => {
    await ensureAudioInit();
    
    if (transportPlaying) {
      pauseTransport();
      stopPattern();
      studioContext.stopFullSong();
      return;
    }

    startTransport();

    // Determine what to play based on mode and channel states
    const soloChannels = channels.filter(c => c.solo);
    const activeChannels = soloChannels.length > 0 
      ? soloChannels 
      : channels.filter(c => !c.muted);

    const shouldPlayBeat = activeChannels.some(c => c.type === 'beat');
    const shouldPlayMelody = activeChannels.some(c => c.type === 'melody' || c.type === 'bass');
    const shouldPlayVocals = activeChannels.some(c => c.type === 'vocals');

    // Play drum pattern if beat channel is active
    if (shouldPlayBeat && studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0) {
      playPattern(studioContext.currentPattern, tempo);
    }

    // Play full song (melody, vocals, etc.) if those channels are active
    if (shouldPlayMelody || shouldPlayVocals) {
      await studioContext.playFullSong();
    }

    // Play uploaded song if available
    if (studioContext.uploadedSongAudio && studioContext.currentUploadedSong) {
      await studioContext.uploadedSongAudio.play();
    }
  };

  // Stop handler
  const handleStop = async () => {
    // Stop recording if active
    if (isRecording) {
      const result = await recorder.stopRecording();
      if (result) addRecordingToTimeline(result);
    }

    stopTransport();
    stopPattern();
    studioContext.stopFullSong();
    seek(0);

    if (studioContext.uploadedSongAudio) {
      studioContext.uploadedSongAudio.pause();
      studioContext.uploadedSongAudio.currentTime = 0;
    }
  };

  // Skip back/forward
  const handleSkipBack = () => seek(Math.max(0, position - 4));
  const handleSkipForward = () => seek(position + 4);

  // Toggle loop
  const handleToggleLoop = () => {
    const newLooping = !isLooping;
    setIsLooping(newLooping);
    setLoop({ enabled: newLooping, start: 0, end: 16 });
  };

  // Master volume change
  const handleMasterVolumeChange = (value: number[]) => {
    const vol = value[0];
    setMasterVolumeState(vol);
    setMasterVolume(vol / 100);
    setIsMuted(vol === 0);
  };

  // Toggle mute
  const handleToggleMute = () => {
    if (isMuted) {
      setMasterVolume(masterVolume / 100);
      setIsMuted(false);
    } else {
      setMasterVolume(0);
      setIsMuted(true);
    }
  };

  // Channel mute/solo handlers — wired to real audio engine
  const toggleChannelMute = (channelId: string) => {
    setChannels(prev => {
      const channel = prev.find(c => c.id === channelId);
      if (channel) {
        const newMuted = !channel.muted;
        // Route matching tracks through the professional audio engine
        const paChannels = professionalAudio.getChannels();
        for (const paCh of paChannels) {
          if (paCh.name?.toLowerCase().includes(channelId) || paCh.id === channelId) {
            professionalAudio.muteChannel(paCh.id, newMuted);
          }
        }
      }
      return prev.map(c => c.id === channelId ? { ...c, muted: !c.muted } : c);
    });
  };

  const toggleChannelSolo = (channelId: string) => {
    setChannels(prev => {
      const channel = prev.find(c => c.id === channelId);
      if (channel) {
        const newSolo = !channel.solo;
        const paChannels = professionalAudio.getChannels();
        for (const paCh of paChannels) {
          if (paCh.name?.toLowerCase().includes(channelId) || paCh.id === channelId) {
            professionalAudio.soloChannel(paCh.id, newSolo);
          }
        }
      }
      return prev.map(c => c.id === channelId ? { ...c, solo: !c.solo } : c);
    });
  };

  const setChannelVolume = (channelId: string, volume: number) => {
    // Route to professional audio engine (normalize 0-100 to 0-1)
    const paChannels = professionalAudio.getChannels();
    for (const paCh of paChannels) {
      if (paCh.name?.toLowerCase().includes(channelId) || paCh.id === channelId) {
        professionalAudio.setChannelVolume(paCh.id, volume / 100);
      }
    }
    setChannels(prev => prev.map(c =>
      c.id === channelId ? { ...c, volume } : c
    ));
  };

  // Time signature change handler
  const handleTimeSignatureChange = (part: 'numerator' | 'denominator', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1 || numValue > 16) return;
    setTimeSignature({
      ...timeSignature,
      [part]: numValue,
    });
  };

  // Quick play modes
  const playBeatOnly = async () => {
    await ensureAudioInit();
    setChannels(prev => prev.map(c => ({ ...c, solo: c.type === 'beat' })));
    setPlaybackMode('beat');
    if (!transportPlaying) {
      handlePlay();
    }
  };

  const playMelodyOnly = async () => {
    await ensureAudioInit();
    setChannels(prev => prev.map(c => ({ ...c, solo: c.type === 'melody' || c.type === 'bass' })));
    setPlaybackMode('melody');
    if (!transportPlaying) {
      handlePlay();
    }
  };

  const playAll = async () => {
    await ensureAudioInit();
    setChannels(prev => prev.map(c => ({ ...c, solo: false, muted: false })));
    setPlaybackMode('all');
    if (!transportPlaying) {
      handlePlay();
    }
  };

  // Check if we have content to play - always allow play for Piano Roll internal playback
  const hasContent = 
    (studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0) ||
    (studioContext.currentMelody && studioContext.currentMelody.length > 0) ||
    (studioContext.currentTracks && studioContext.currentTracks.length > 0) ||
    (studioContext.currentUploadedSong) ||
    (storeTracks && storeTracks.length > 0) ||
    true; // Always enable play - Piano Roll handles its own playback

  const containerClasses = cn(
    "bg-gray-900/95 backdrop-blur-md border-gray-700 transition-all duration-300",
    isInline
      ? "relative w-full rounded-lg border px-4 py-3 flex flex-col gap-3"
      : "fixed bottom-0 left-0 right-0 z-50 border-t",
  );

  const mainRowClasses = cn(
    "flex items-center gap-4",
    isInline ? "flex-wrap" : "h-16 px-4"
  );

  return (
    <div className={containerClasses}>
      {/* Expand/Collapse Handle */}
      {!isInline && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 border-b-0 rounded-t-lg px-4 py-1 hover:bg-gray-700 transition-colors"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      )}

      {/* Main Transport Bar */}
      <div className={mainRowClasses}>
        {/* Time Display */}
        <div className="flex flex-col items-center min-w-[100px] bg-gray-800 rounded px-3 py-1">
          <span className="text-lg font-mono text-green-400">{formatTime(position)}</span>
          <span className="text-xs text-gray-400">Bar {formatBarBeat(position)}</span>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleSkipBack} className="h-8 w-8 p-0">
            <SkipBack className="w-4 h-4" />
          </Button>
          
          <Button 
            size="sm" 
            onClick={handlePlay}
            disabled={!hasContent}
            className={cn(
              "h-10 w-10 p-0 rounded-full",
              transportPlaying ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"
            )}
          >
            {transportPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>
          
          <Button size="sm" variant="ghost" onClick={handleStop} className="h-8 w-8 p-0">
            <Square className="w-4 h-4" />
          </Button>
          
          <Button size="sm" variant="ghost" onClick={handleSkipForward} className="h-8 w-8 p-0">
            <SkipForward className="w-4 h-4" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleLoop}
            className={cn("h-8 w-8 p-0", isLooping && "text-blue-400")}
          >
            <Repeat className="w-4 h-4" />
          </Button>

          {/* Metronome beat flash */}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0 transition-all duration-75"
            style={{
              backgroundColor:
                beatFlash === 'beat1' ? '#ffffff' :
                beatFlash === 'beat'  ? '#06b6d4' :
                'rgba(255,255,255,0.08)',
              boxShadow:
                beatFlash === 'beat1' ? '0 0 8px #fff, 0 0 16px #fff' :
                beatFlash === 'beat'  ? '0 0 6px #06b6d4' :
                'none',
            }}
            title="Beat indicator"
          />

          {/* Record Button */}
          <Button
            size="sm"
            onClick={handleRecord}
            className={cn(
              "h-10 w-10 p-0 rounded-full transition-all",
              isRecording
                ? "bg-red-600 hover:bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                : isRecordArmed
                ? "bg-red-500/40 hover:bg-red-500/60 border-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                : "bg-gray-700 hover:bg-red-600/80"
            )}
            title={isRecording ? 'Stop Recording' : isRecordArmed ? 'Disarm' : 'Record'}
          >
            <Circle className={cn("w-5 h-5", (isRecording || isRecordArmed) ? "fill-red-500 text-red-500" : "fill-gray-400 text-gray-400")} />
          </Button>
        </div>

        {/* Recording Indicator */}
        {isRecording && recorderState && (
          <div className="flex items-center gap-2 border-l border-gray-700 pl-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-mono font-bold">
              REC {recorderState.elapsedSeconds.toFixed(1)}s
            </span>
            {/* Input Level Meter */}
            <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-75",
                  recorderState.inputLevel > 0.8 ? "bg-red-500" :
                  recorderState.inputLevel > 0.5 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(100, recorderState.inputLevel * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick Play Mode Buttons */}
        <div className="flex items-center gap-1 border-l border-gray-700 pl-4">
          <Button
            size="sm"
            variant={playbackMode === 'beat' ? 'default' : 'outline'}
            onClick={playBeatOnly}
            className="h-8 text-xs gap-1"
            disabled={!studioContext.currentPattern || Object.keys(studioContext.currentPattern).length === 0}
          >
            <Drum className="w-3 h-3" />
            Beat
          </Button>
          <Button
            size="sm"
            variant={playbackMode === 'melody' ? 'default' : 'outline'}
            onClick={playMelodyOnly}
            className="h-8 text-xs gap-1"
            disabled={!studioContext.currentMelody || studioContext.currentMelody.length === 0}
          >
            <Piano className="w-3 h-3" />
            Melody
          </Button>
          <Button
            size="sm"
            variant={playbackMode === 'all' ? 'default' : 'outline'}
            onClick={playAll}
            className="h-8 text-xs gap-1"
          >
            <Layers className="w-3 h-3" />
            All
          </Button>
        </div>

        {/* Tempo */}
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
          <span className="text-xs text-gray-400">BPM</span>
          <input
            type="number"
            value={tempo}
            onChange={(e) => setTempo(parseInt(e.target.value) || 120)}
            className="w-14 h-8 bg-gray-800 border border-gray-700 rounded text-center text-sm"
            min={40}
            max={240}
          />
        </div>

        {/* Time Signature */}
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
          <span className="text-xs text-gray-400">Time Sig</span>
          <input
            type="number"
            min={1}
            max={16}
            value={timeSignature.numerator}
            onChange={(e) => handleTimeSignatureChange('numerator', e.target.value)}
            className="w-12 h-8 bg-gray-800 border border-gray-700 rounded text-center text-sm"
          />
          <span className="text-xs text-gray-500">/</span>
          <input
            type="number"
            min={1}
            max={16}
            value={timeSignature.denominator}
            onChange={(e) => handleTimeSignatureChange('denominator', e.target.value)}
            className="w-12 h-8 bg-gray-800 border border-gray-700 rounded text-center text-sm"
          />
        </div>

        {/* Master Volume */}
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4 ml-auto">
          <Button size="sm" variant="ghost" onClick={handleToggleMute} className="h-8 w-8 p-0">
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : masterVolume]}
            onValueChange={handleMasterVolumeChange}
            max={100}
            step={1}
            className="w-24"
          />
          <span className="text-xs text-gray-400 w-8">{isMuted ? 0 : masterVolume}%</span>
          {isInline && (
            <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Hide Mixer' : 'Show Mixer'}
            </Button>
          )}
        </div>

        {/* Content Indicator */}
        <div className="flex items-center gap-1">
          {studioContext.currentPattern && Object.keys(studioContext.currentPattern).length > 0 && (
            <Badge variant="outline" className="text-orange-400 border-orange-400/50">Beat</Badge>
          )}
          {studioContext.currentMelody && studioContext.currentMelody.length > 0 && (
            <Badge variant="outline" className="text-blue-400 border-blue-400/50">Melody</Badge>
          )}
          {studioContext.currentUploadedSong && (
            <Badge variant="outline" className="text-green-400 border-green-400/50">Song</Badge>
          )}
          {getCurrentProject()?.audioClips && getCurrentProject()!.audioClips.length > 0 && (
            <Badge variant="outline" className="text-red-400 border-red-400/50">
              {getCurrentProject()!.audioClips.length} Clip{getCurrentProject()!.audioClips.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Expanded Channel Mixer */}
      {expanded && (
        <div className={cn(
          "px-4 py-2 border-t border-gray-800",
          isInline ? "rounded-b-lg bg-gray-900/80" : "h-32"
        )}>
          <div className="flex items-end gap-4 h-full">
            {channels.map((channel) => (
              <div key={channel.id} className="flex flex-col items-center gap-1 w-16">
                {/* Volume Slider (Vertical) */}
                <div className="h-16 flex items-center">
                  <Slider
                    value={[channel.volume]}
                    onValueChange={(v) => setChannelVolume(channel.id, v[0])}
                    max={100}
                    step={1}
                    orientation="vertical"
                    className="h-full"
                  />
                </div>
                
                {/* Mute/Solo Buttons */}
                <div className="flex gap-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleChannelMute(channel.id)}
                    className={cn(
                      "h-5 w-5 p-0 text-[10px]",
                      channel.muted && "bg-red-600 text-white"
                    )}
                  >
                    M
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleChannelSolo(channel.id)}
                    className={cn(
                      "h-5 w-5 p-0 text-[10px]",
                      channel.solo && "bg-yellow-600 text-white"
                    )}
                  >
                    S
                  </Button>
                </div>
                
                {/* Channel Label */}
                <div className={cn("w-full h-1 rounded", channel.color)} />
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  {channel.icon}
                  <span className="truncate">{channel.name}</span>
                </div>
              </div>
            ))}
            
            {/* Master Bus Panel */}
            <div className="flex-shrink-0 w-48 border-l border-gray-700 pl-3 self-stretch flex flex-col justify-center">
              <MasterBusPanel />
            </div>

            {/* Master Channel */}
            <div className="flex flex-col items-center gap-1 w-16 border-l border-gray-700 pl-4">
              <div className="h-16 flex items-center">
                <Slider
                  value={[masterVolume]}
                  onValueChange={handleMasterVolumeChange}
                  max={100}
                  step={1}
                  orientation="vertical"
                  className="h-full"
                />
              </div>
              <div className="w-full h-1 rounded bg-white" />
              <span className="text-[10px] text-gray-400 font-semibold">MASTER</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
