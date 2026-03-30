import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { FileMusic, Play, Pause, Volume2, VolumeX, ToggleLeft, ToggleRight, Upload, X } from 'lucide-react';
import { professionalAudio } from '@/lib/professionalAudio';

interface ReferenceTrackABProps {
  className?: string;
}

export default function ReferenceTrackAB({ className = '' }: ReferenceTrackABProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isABActive, setIsABActive] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Clean up previous
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    setFile(selected);
    setFileName(selected.name);
    setIsPlaying(false);
    setCurrentTime(0);

    const url = URL.createObjectURL(selected);
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    // Decode for waveform
    try {
      const arrayBuffer = await selected.arrayBuffer();
      const offlineCtx = new OfflineAudioContext(1, 1, 44100);
      const decoded = await offlineCtx.decodeAudioData(arrayBuffer);
      const channelData = decoded.getChannelData(0);
      const peakCount = 200;
      const blockSize = Math.floor(channelData.length / peakCount);
      const peaks: number[] = [];
      for (let i = 0; i < peakCount; i++) {
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          const abs = Math.abs(channelData[i * blockSize + j] || 0);
          if (abs > max) max = abs;
        }
        peaks.push(max);
      }
      setWaveformPeaks(peaks);
    } catch {
      setWaveformPeaks([]);
    }

    // Wire to Web Audio for volume control
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* ok */ }
    }
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    sourceRef.current = source;
    gainRef.current = gain;
  }, [volume]);

  // Update gain when volume/mute changes
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Time update loop
  useEffect(() => {
    const tick = () => {
      if (audioRef.current && isPlaying) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    if (isPlaying) {
      animRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformPeaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    // Waveform bars
    const barW = w / waveformPeaks.length;
    for (let i = 0; i < waveformPeaks.length; i++) {
      const peak = waveformPeaks[i];
      const barH = peak * h * 0.9;
      const x = i * barW;
      const progress = duration > 0 ? currentTime / duration : 0;
      const isPast = i / waveformPeaks.length < progress;

      ctx.fillStyle = isPast
        ? 'rgba(168, 85, 247, 0.7)'
        : 'rgba(113, 113, 122, 0.4)';
      ctx.fillRect(x + 0.5, (h - barH) / 2, Math.max(1, barW - 1), barH);
    }

    // Playhead
    if (duration > 0) {
      const playX = (currentTime / duration) * w;
      ctx.strokeStyle = 'rgba(168, 85, 247, 1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, h);
      ctx.stroke();
    }
  }, [waveformPeaks, currentTime, duration]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      ctxRef.current?.resume();
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !canvasRef.current || duration === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration]);

  const handleRemove = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setFile(null);
    setFileName('');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setWaveformPeaks([]);
    setIsABActive(false);
  }, []);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col gap-2 bg-zinc-900/80 rounded-lg border border-zinc-700/50 p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <FileMusic className="w-3.5 h-3.5" />
          <span className="font-medium">Reference Track A/B</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={isABActive ? 'default' : 'ghost'}
            onClick={() => {
              const willBeActive = !isABActive;
              setIsABActive(willBeActive);
              // When A/B is active: play reference, mute project master
              // When A/B is off: stop reference, restore project master
              if (gainRef.current) {
                gainRef.current.gain.value = willBeActive ? (isMuted ? 0 : volume) : 0;
              }
              const masterBus = professionalAudio.getMasterBus();
              if (masterBus) {
                masterBus.gain.value = willBeActive ? 0 : 1;
              }
            }}
            className={`h-6 text-[10px] px-2 gap-1 ${isABActive ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
          >
            {isABActive ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
            A/B
          </Button>
        </div>
      </div>

      {!file ? (
        <label className="flex items-center justify-center gap-2 h-16 rounded-md border-2 border-dashed border-zinc-600 hover:border-purple-500 cursor-pointer transition-colors">
          <Upload className="w-4 h-4 text-zinc-500" />
          <span className="text-xs text-zinc-500">Drop or click to load reference</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={togglePlay} className="h-6 w-6 p-0">
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
            <span className="text-[10px] text-zinc-400 truncate flex-1" title={fileName}>
              {fileName}
            </span>
            <span className="text-[10px] text-zinc-500 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <Button size="sm" variant="ghost" onClick={handleRemove} className="h-5 w-5 p-0">
              <X className="w-3 h-3" />
            </Button>
          </div>

          <canvas
            ref={canvasRef}
            className="w-full h-10 rounded cursor-pointer"
            onClick={handleSeek}
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsMuted(!isMuted)}
              className="h-5 w-5 p-0"
            >
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </Button>
            <Slider
              value={[volume * 100]}
              onValueChange={([v]) => setVolume(v / 100)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-[9px] text-zinc-500 w-8 text-right tabular-nums">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
