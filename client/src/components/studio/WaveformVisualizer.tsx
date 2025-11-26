import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Scissors, Copy, Clipboard, Volume2, Trash2, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  
  // Editing state
  const [editMode, setEditMode] = useState<'select' | 'volume' | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [copiedRegion, setCopiedRegion] = useState<{ start: number; end: number; data: Float32Array } | null>(null);
  const [volumePoints, setVolumePoints] = useState<{ id: string; time: number; volume: number }[]>([]);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [draggingVolumeId, setDraggingVolumeId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const makePointId = () => (crypto.randomUUID ? crypto.randomUUID() : `vp-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const sortVolumePoints = (points: { id: string; time: number; volume: number }[]) =>
    [...points].sort((a, b) => a.time - b.time);

  const getVolumeAtTime = (time: number) => {
    if (volumePoints.length === 0 || !audioBuffer) return 1;
    const sorted = sortVolumePoints(volumePoints);

    // Before first point, ramp from unity to first point
    if (time <= sorted[0].time) {
      const first = sorted[0];
      const t = Math.max(0, first.time);
      if (t === 0) return first.volume;
      const progress = Math.min(1, time / t);
      return 1 + (first.volume - 1) * progress;
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (time >= a.time && time <= b.time) {
        const range = b.time - a.time || 1;
        const ratio = (time - a.time) / range;
        return a.volume + (b.volume - a.volume) * ratio;
      }
    }

    // After last point, hold last value
    return sorted[sorted.length - 1].volume;
  };

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

    // Draw selection region
    if (selectionStart !== null && selectionEnd !== null) {
      const startX = (selectionStart / buffer.duration) * width * zoom;
      const endX = (selectionEnd / buffer.duration) * width * zoom;
      const selectionWidth = Math.abs(endX - startX);
      const selectionX = Math.min(startX, endX);
      
      // Selection background
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)'; // Yellow tint
      ctx.fillRect(selectionX, 0, selectionWidth, height);
      
      // Selection borders
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(selectionX, 0);
      ctx.lineTo(selectionX, height);
      ctx.moveTo(selectionX + selectionWidth, 0);
      ctx.lineTo(selectionX + selectionWidth, height);
      ctx.stroke();
    }

    const sortedVolumePoints = [...volumePoints].sort((a, b) => a.time - b.time);

    // Draw volume automation points and envelope
    if (sortedVolumePoints.length > 0) {
      ctx.strokeStyle = '#10b981'; // Green line
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      sortedVolumePoints.forEach((point, i) => {
        const x = (point.time / buffer.duration) * width * zoom;
        const y = centerY - (point.volume * centerY * 0.5); // Volume affects Y position
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        // Draw point handle
        ctx.fillStyle = '#10b981';
        ctx.fillRect(x - 4, y - 4, 8, 8);
      });
      ctx.stroke();
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

    // Draw played region overlay (only if not selecting)
    if (playheadX > 0 && !isSelecting) {
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
      const now = audioElement.currentTime;
      setCurrentTime(now);

      // Apply real-time volume automation to the audio element
      const targetVolume = getVolumeAtTime(now);
      const clampedVolume = Math.min(Math.max(targetVolume, 0), 2);
      // audioElement.volume caps at 1, so values >1 are treated as max
      audioElement.volume = Math.min(clampedVolume, 1);

      drawWaveform(audioBuffer, now);
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    };

    animationFrameRef.current = requestAnimationFrame(updatePlayhead);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, audioElement, audioBuffer, zoom]);

  // Keep element volume in sync when automation changes, even while paused
  useEffect(() => {
    if (!audioElement) return;
    const target = Math.min(Math.max(getVolumeAtTime(audioElement.currentTime), 0), 2);
    audioElement.volume = Math.min(target, 1);
  }, [audioElement, audioBuffer, volumePoints]);

  // Handle canvas mouse down (start selection or add volume point)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / canvas.width;
    const clickTime = Math.max(0, Math.min((percentage * audioBuffer.duration) / zoom, audioBuffer.duration));

    if (editMode === 'select') {
      // Start selection
      setIsSelecting(true);
      setSelectionStart(clickTime);
      setSelectionEnd(clickTime);
    } else if (editMode === 'volume') {
      const y = e.clientY - rect.top;
      const centerY = canvas.height / 2;
      const volume = Math.max(0, Math.min(2, 1 - ((y - centerY) / centerY))); // 0-2x volume

      // Check if we're grabbing an existing handle
      const sorted = sortVolumePoints(volumePoints);
      const handleIndex = sorted.findIndex((point) => {
        const px = (point.time / audioBuffer.duration) * canvas.width * zoom;
        const py = centerY - (point.volume * centerY * 0.5);
        return Math.abs(px - x) <= 8 && Math.abs(py - y) <= 8;
      });

      if (handleIndex !== -1) {
        setIsDraggingVolume(true);
        setDraggingVolumeId(sorted[handleIndex].id);
        return;
      }

      const newPoint = { id: makePointId(), time: clickTime, volume };
      let createdId = newPoint.id;
      setVolumePoints(prev => {
        const next = sortVolumePoints([...prev, newPoint]);
        createdId = newPoint.id;
        return next;
      });
      setIsDraggingVolume(true);
      setDraggingVolumeId(createdId);
      
      toast({
        title: "Volume Point Added",
        description: `${(volume * 100).toFixed(0)}% at ${formatTime(clickTime)}`,
        duration: 2000,
      });
    } else if (audioElement) {
      // Seek to position
      audioElement.currentTime = Math.max(0, Math.min(clickTime, audioBuffer.duration));
      setCurrentTime(audioElement.currentTime);
      drawWaveform(audioBuffer, audioElement.currentTime);
    }
  };

  // Handle canvas mouse move (update selection)
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / canvas.width;
    const moveTime = Math.max(0, Math.min((percentage * audioBuffer.duration) / zoom, audioBuffer.duration));

    if (editMode === 'volume' && isDraggingVolume && draggingVolumeId) {
      const y = e.clientY - rect.top;
      const centerY = canvas.height / 2;
      const volume = Math.max(0, Math.min(2, 1 - ((y - centerY) / centerY)));

      setVolumePoints(prev => {
        const sorted = sortVolumePoints(prev);
        const targetIndex = sorted.findIndex((p) => p.id === draggingVolumeId);
        if (targetIndex === -1) return prev;
        sorted[targetIndex] = { ...sorted[targetIndex], time: moveTime, volume };
        return sortVolumePoints(sorted);
      });
      drawWaveform(audioBuffer, currentTime);
      return;
    }

    if (!isSelecting) return;

    setSelectionEnd(moveTime);
    drawWaveform(audioBuffer, currentTime);
  };

  // Handle canvas mouse up (finish selection)
  const handleCanvasMouseUp = () => {
    setIsSelecting(false);
    setIsDraggingVolume(false);
    setDraggingVolumeId(null);
    
    if (selectionStart !== null && selectionEnd !== null && Math.abs(selectionEnd - selectionStart) < 0.1) {
      // Click without drag - clear selection
      setSelectionStart(null);
      setSelectionEnd(null);
    }
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
  }, [audioBuffer, currentTime, height, zoom, selectionStart, selectionEnd, volumePoints, isSelecting]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.5));
  };

  // Editing functions
  const handleCut = () => {
    if (selectionStart === null || selectionEnd === null || !audioBuffer) return;
    
    // Copy to clipboard first
    handleCopy();
    
    // Then delete
    handleDelete();
  };

  const handleCopy = () => {
    if (selectionStart === null || selectionEnd === null || !audioBuffer) return;
    
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);
    const regionData = channelData.slice(startSample, endSample);
    
    setCopiedRegion({ start, end, data: regionData });
    
    toast({
      title: "Region Copied",
      description: `${formatTime(end - start)} copied to clipboard`,
      duration: 2000,
    });
  };

  const handlePaste = () => {
    if (!copiedRegion || !audioElement) return;
    
    toast({
      title: "Paste Not Yet Implemented",
      description: "This feature requires audio processing backend",
      variant: "destructive",
      duration: 3000,
    });
  };

  const handleDelete = () => {
    if (selectionStart === null || selectionEnd === null) return;
    
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    
    toast({
      title: "Region Marked for Deletion",
      description: `${formatTime(end - start)} - Apply to process audio`,
      duration: 3000,
    });
    
    // Clear selection
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleClearVolume = () => {
    setVolumePoints([]);
    toast({
      title: "Volume Automation Cleared",
      description: "All volume points removed",
      duration: 2000,
    });
  };

  const handleTrimPeaks = () => {
    if (selectionStart === null || selectionEnd === null || !audioBuffer) return;

    const start = Math.max(0, Math.min(selectionStart, selectionEnd));
    const end = Math.min(audioBuffer.duration, Math.max(selectionStart, selectionEnd));

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);

    let peak = 0;
    for (let i = startSample; i < endSample; i++) {
      const amp = Math.abs(channelData[i]);
      if (amp > peak) peak = amp;
    }

    if (peak <= 0.9) {
      toast({
        title: "No Clipping Detected",
        description: "Selected region is already below the safe ceiling.",
        duration: 2000,
      });
      return;
    }

    const reduction = 0.9 / peak;
    const fade = Math.min(0.15, (end - start) / 3);
    const entryTime = Math.max(0, start - fade);
    const exitTime = Math.min(audioBuffer.duration, end + fade);

    const anchorBefore = getVolumeAtTime(entryTime);
    const anchorAfter = getVolumeAtTime(exitTime);

    setVolumePoints(prev => sortVolumePoints([
      ...prev,
      { id: makePointId(), time: entryTime, volume: anchorBefore },
      { id: makePointId(), time: start, volume: reduction },
      { id: makePointId(), time: end, volume: reduction },
      { id: makePointId(), time: exitTime, volume: anchorAfter },
    ]));

    toast({
      title: "Trim Applied",
      description: `Rounded peaks in selection (${formatTime(end - start)}).`,
      duration: 2500,
    });
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
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          className={`w-full ${editMode ? 'cursor-crosshair' : 'cursor-pointer'}`}
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

      {/* Editing Toolbar */}
      {showControls && audioBuffer && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {/* Edit Mode Selection */}
          <div className="flex gap-1 bg-gray-800 rounded p-1">
            <Button
              size="sm"
              variant={editMode === null ? 'default' : 'ghost'}
              onClick={() => setEditMode(null)}
              className="h-7 px-2 text-xs"
            >
              Seek
            </Button>
            <Button
              size="sm"
              variant={editMode === 'select' ? 'default' : 'ghost'}
              onClick={() => setEditMode('select')}
              className="h-7 px-2 text-xs"
            >
              Select
            </Button>
            <Button
              size="sm"
              variant={editMode === 'volume' ? 'default' : 'ghost'}
              onClick={() => setEditMode('volume')}
              className="h-7 px-2 text-xs"
            >
              <Volume2 className="w-3 h-3 mr-1" />
              Volume
            </Button>
          </div>

          {/* Edit Actions (only visible when selection exists or in volume mode) */}
          {(selectionStart !== null && selectionEnd !== null) && (
            <div className="flex gap-1 bg-gray-800 rounded p-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCut}
                className="h-7 px-2 text-xs hover:bg-red-600"
                title="Cut selected region"
              >
                <Scissors className="w-3 h-3 mr-1" />
                Cut
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                className="h-7 px-2 text-xs hover:bg-blue-600"
                title="Copy selected region"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePaste}
                className="h-7 px-2 text-xs hover:bg-green-600"
                title="Paste from clipboard"
                disabled={!copiedRegion}
              >
                <Clipboard className="w-3 h-3 mr-1" />
                Paste
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleTrimPeaks}
                className="h-7 px-2 text-xs hover:bg-green-700"
                title="Tame clipping by rounding peaks in the selection"
              >
                <SlidersHorizontal className="w-3 h-3 mr-1" />
                Trim Peaks
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                className="h-7 px-2 text-xs hover:bg-orange-600"
                title="Delete selected region"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </div>
          )}

          {/* Volume Actions */}
          {volumePoints.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearVolume}
              className="h-7 px-2 text-xs bg-gray-800 hover:bg-red-600"
              title="Clear all volume points"
            >
              Clear Volume ({volumePoints.length})
            </Button>
          )}

          {/* Selection Info */}
          {selectionStart !== null && selectionEnd !== null && (
            <div className="bg-yellow-900/30 px-3 py-1 rounded text-xs text-yellow-300 border border-yellow-500/30">
              Selected: {formatTime(Math.abs(selectionEnd - selectionStart))}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {audioBuffer && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          {editMode === 'select' && 'Click and drag to select a region - cut, copy, delete, or Trim Peaks to tame clipping'}
          {editMode === 'volume' && 'Add or drag green squares to shape volume - higher is louder, lower is quieter'}
          {!editMode && 'Click anywhere on the waveform to seek - use zoom controls to see details'}
        </div>
      )}
    </div>
  );
}
