import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface WaveformVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  className?: string;
  height?: number;
  showControls?: boolean;
}

export default function WaveformVisualizer({
  audioElement,
  isPlaying,
  className = '',
  height = 120,
  showControls = true,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(1);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Initialize Web Audio API
  useEffect(() => {
    if (!audioElement) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    setAudioContext(ctx);

    return () => {
      ctx.close();
    };
  }, [audioElement]);

  // Load audio data and create waveform
  useEffect(() => {
    if (!audioElement || !audioContext || !audioElement.src) return;

    const loadAudioData = async () => {
      try {
        // Fetch audio file
        const response = await fetch(audioElement.src);
        const arrayBuffer = await response.arrayBuffer();
        
        // Decode audio data
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        setAudioBuffer(buffer);
        setDuration(buffer.duration);
        
        // Draw initial waveform
        drawWaveform(buffer, 0);
      } catch (error) {
        console.error('Error loading audio data:', error);
      }
    };

    loadAudioData();
  }, [audioElement, audioContext]);

  // Draw waveform on canvas
  const drawWaveform = (buffer: AudioBuffer | null, playheadPosition: number) => {
    if (!buffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const channelData = buffer.getChannelData(0); // Use first channel
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Calculate samples per pixel based on zoom
    const samplesPerPixel = Math.floor((channelData.length / width) / zoom);
    const centerY = height / 2;

    // Draw waveform
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#3b82f6'; // Blue waveform
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Semi-transparent fill
    
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    // Draw upper half of waveform
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor(x * samplesPerPixel);
      const endSample = Math.floor((x + 1) * samplesPerPixel);
      
      let max = 0;
      for (let i = startSample; i < endSample && i < channelData.length; i++) {
        const amplitude = Math.abs(channelData[i]);
        if (amplitude > max) max = amplitude;
      }
      
      const y = centerY - (max * centerY * 0.9); // Scale to 90% of half height
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Draw lower half (mirror)
    for (let x = width - 1; x >= 0; x--) {
      const startSample = Math.floor(x * samplesPerPixel);
      const endSample = Math.floor((x + 1) * samplesPerPixel);
      
      let max = 0;
      for (let i = startSample; i < endSample && i < channelData.length; i++) {
        const amplitude = Math.abs(channelData[i]);
        if (amplitude > max) max = amplitude;
      }
      
      const y = centerY + (max * centerY * 0.9);
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Vertical time markers (every second)
    const pixelsPerSecond = width / (buffer.duration / zoom);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px monospace';
    
    for (let sec = 0; sec < buffer.duration; sec++) {
      const x = sec * pixelsPerSecond;
      if (x < width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Time labels
        const minutes = Math.floor(sec / 60);
        const seconds = sec % 60;
        const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        ctx.fillText(timeLabel, x + 2, 12);
      }
    }

    // Draw playhead
    const playheadX = (playheadPosition / buffer.duration) * width * zoom;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = '#ef4444'; // Red playhead
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      
      // Playhead triangle at top
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX - 5, 10);
      ctx.lineTo(playheadX + 5, 10);
      ctx.closePath();
      ctx.fill();
    }

    // Draw played region overlay
    if (playheadX > 0) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(0, 0, Math.min(playheadX, width), height);
    }
  };

  // Update playhead position
  useEffect(() => {
    if (!audioElement || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const updatePlayhead = () => {
      setCurrentTime(audioElement.currentTime);
      drawWaveform(audioBuffer, audioElement.currentTime);
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    };

    animationFrameRef.current = requestAnimationFrame(updatePlayhead);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, audioElement, audioBuffer, zoom]);

  // Handle canvas click to seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioElement || !audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / canvas.width;
    const newTime = (percentage * audioBuffer.duration) / zoom;
    
    audioElement.currentTime = Math.max(0, Math.min(newTime, audioBuffer.duration));
    setCurrentTime(audioElement.currentTime);
    drawWaveform(audioBuffer, audioElement.currentTime);
  };

  // Handle canvas resize
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const resizeCanvas = () => {
      const canvas = canvasRef.current!;
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width;
      canvas.height = height;
      
      if (audioBuffer) {
        drawWaveform(audioBuffer, currentTime);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [audioBuffer, currentTime, height, zoom]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.5));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="relative w-full bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full cursor-crosshair"
          style={{ height: `${height}px` }}
        />
        
        {/* Time display overlay */}
        <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs font-mono text-white">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Zoom controls */}
        {showControls && (
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleZoomOut}
              className="h-6 w-6 p-0 bg-black/70 hover:bg-black/90"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleZoomIn}
              className="h-6 w-6 p-0 bg-black/70 hover:bg-black/90"
              disabled={zoom >= 10}
            >
              <ZoomIn className="w-3 h-3" />
            </Button>
            <div className="bg-black/70 px-2 py-0.5 rounded text-xs font-mono text-white flex items-center">
              {zoom.toFixed(1)}x
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {audioBuffer && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          Click anywhere on the waveform to seek • Use zoom controls to see details
        </div>
      )}
    </div>
  );
}
