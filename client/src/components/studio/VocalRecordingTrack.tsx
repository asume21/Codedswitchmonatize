/**
 * Vocal Recording Track Component
 * Allows users to record vocals directly into a track with waveform display
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Mic, Square, Play, Pause, Trash2, Download, Volume2, VolumeX, Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface VocalRecordingTrackProps {
  trackId: string;
  trackName?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  solo?: boolean;
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void;
  onVolumeChange?: (volume: number) => void;
  onPanChange?: (pan: number) => void;
  onMuteToggle?: () => void;
  onSoloToggle?: () => void;
  onDelete?: () => void;
}

export default function VocalRecordingTrack({
  trackId,
  trackName = 'Vocal Track',
  volume: externalVolume = 80,
  pan: externalPan = 0,
  muted = false,
  solo = false,
  onRecordingComplete,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onDelete,
}: VocalRecordingTrackProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([externalVolume]);
  const [pan, setPan] = useState([externalPan]);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const { toast } = useToast();

  // Sync with external volume/pan
  useEffect(() => {
    setVolume([externalVolume]);
    if (audioRef.current && !muted) {
      audioRef.current.volume = externalVolume / 100;
    }
  }, [externalVolume, muted]);

  useEffect(() => {
    setPan([externalPan]);
  }, [externalPan]);

  // Apply mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume[0] / 100;
    }
  }, [muted, volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioUrl]);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      // Create audio context for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      // Start media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        
        setRecordedAudio(blob);
        setAudioUrl(url);
        
        // Get duration
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
          setDuration(audio.duration);
          if (onRecordingComplete) {
            onRecordingComplete(blob, audio.duration);
          }
        };

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        toast({
          title: 'Recording Complete',
          description: `Recorded ${Math.round(audio.duration)}s of audio`,
        });
      };

      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start waveform visualization
      visualizeWaveform();

      toast({
        title: 'Recording Started',
        description: 'Speak or sing into your microphone',
      });
    } catch (error) {
      toast({
        title: 'Recording Failed',
        description: error instanceof Error ? error.message : 'Please ensure microphone permissions are granted',
        variant: 'destructive',
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  // Visualize waveform during recording
  const visualizeWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;

      animationFrameRef.current = requestAnimationFrame(draw);

      analyserRef.current!.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = 'rgb(15, 23, 42)'; // slate-900
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'rgb(168, 85, 247)'; // purple-500
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();
  };

  // Play recorded audio
  const playRecording = () => {
    if (!audioUrl) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.volume = volume[0] / 100;
        
        audioRef.current.ontimeupdate = () => {
          setCurrentTime(audioRef.current?.currentTime || 0);
        };

        audioRef.current.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };
      }

      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Delete recording
  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    
    setRecordedAudio(null);
    setAudioUrl(null);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    toast({
      title: 'Recording Deleted',
      description: 'Vocal track cleared',
    });
  };

  // Download recording
  const downloadRecording = () => {
    if (!recordedAudio) return;

    const url = URL.createObjectURL(recordedAudio);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trackName}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download Started',
      description: 'Vocal recording saved',
    });
  };

  // Update volume
  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    if (audioRef.current && !muted) {
      audioRef.current.volume = value[0] / 100;
    }
    if (onVolumeChange) {
      onVolumeChange(value[0]);
    }
  };

  // Update pan
  const handlePanChange = (value: number[]) => {
    setPan(value);
    if (onPanChange) {
      onPanChange(value[0]);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="bg-slate-900/50 border-purple-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="w-5 h-5 text-purple-400" />
            {trackName}
          </CardTitle>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Waveform Display */}
        <div className="relative bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={800}
            height={120}
            className="w-full h-[120px]"
          />
          
          {!isRecording && !recordedAudio && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Mic className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recording yet</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!recordedAudio ? (
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex-1 ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={playRecording}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </>
                )}
              </Button>
              <Button
                onClick={downloadRecording}
                variant="outline"
                className="border-purple-500/50 hover:bg-purple-500/10"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                onClick={deleteRecording}
                variant="outline"
                className="border-red-500/50 hover:bg-red-500/10 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* Mixer Controls - Always visible for integration */}
        <div className="space-y-3 pt-2 border-t border-slate-700">
          {/* Mute/Solo Buttons */}
          <div className="flex items-center gap-2">
            {onMuteToggle && (
              <Button
                onClick={onMuteToggle}
                variant="outline"
                size="sm"
                className={`flex-1 ${
                  muted
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'border-slate-600 hover:bg-slate-800'
                }`}
              >
                <VolumeX className="w-4 h-4 mr-2" />
                {muted ? 'Unmute' : 'Mute'}
              </Button>
            )}
            {onSoloToggle && (
              <Button
                onClick={onSoloToggle}
                variant="outline"
                size="sm"
                className={`flex-1 ${
                  solo
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                    : 'border-slate-600 hover:bg-slate-800'
                }`}
              >
                <Radio className="w-4 h-4 mr-2" />
                {solo ? 'Unsolo' : 'Solo'}
              </Button>
            )}
          </div>

          {/* Time Display */}
          {recordedAudio && (
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          )}
          
          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <Slider
              value={volume}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
              disabled={muted}
            />
            <span className="text-sm text-gray-400 w-12 text-right">
              {volume[0]}%
            </span>
          </div>

          {/* Pan Control */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-8">Pan</span>
            <Slider
              value={pan}
              onValueChange={handlePanChange}
              min={-100}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-gray-400 w-12 text-right">
              {pan[0] === 0 ? 'C' : pan[0] > 0 ? `R${pan[0]}` : `L${Math.abs(pan[0])}`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
