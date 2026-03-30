import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Pause, Play } from 'lucide-react';
import * as Tone from 'tone';

interface SpectrumAnalyzerProps {
  width?: number;
  height?: number;
  className?: string;
}

const FFT_SIZE = 2048;
const BAR_COUNT = 64;
const SMOOTHING = 0.8;

const FREQ_LABELS = ['20', '50', '100', '200', '500', '1k', '2k', '5k', '10k', '20k'];
const FREQ_VALUES = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

function freqToX(freq: number, width: number): number {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  return ((Math.log10(freq) - minLog) / (maxLog - minLog)) * width;
}

export default function SpectrumAnalyzer({
  width = 600,
  height = 200,
  className = '',
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const [running, setRunning] = useState(true);
  const [peakHold, setPeakHold] = useState(true);
  const peaksRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));
  const peakDecayRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));

  useEffect(() => {
    const ctx = Tone.getContext().rawContext;
    if (!ctx) return;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    analyserRef.current = analyser;

    // Connect Tone.js master output to our analyser
    try {
      Tone.getDestination().connect(analyser);
    } catch {
      // Tone may not be started yet
    }

    return () => {
      try {
        Tone.getDestination().disconnect(analyser);
      } catch { /* already disconnected */ }
      analyserRef.current = null;
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser || !running) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatFrequencyData(dataArray);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Draw frequency grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (const freq of FREQ_VALUES) {
      const x = freqToX(freq, width);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw dB grid lines
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    for (let db = -90; db <= 0; db += 15) {
      const y = height * (1 - (db + 100) / 100);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${db}`, width - 4, y - 2);
    }

    // Frequency labels at bottom
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'center';
    ctx.font = '8px monospace';
    for (let i = 0; i < FREQ_LABELS.length; i++) {
      const x = freqToX(FREQ_VALUES[i], width);
      ctx.fillText(FREQ_LABELS[i], x, height - 3);
    }

    // Map FFT bins to logarithmic bars
    const sampleRate = analyser.context.sampleRate;
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const barWidth = width / BAR_COUNT;

    for (let i = 0; i < BAR_COUNT; i++) {
      const freqLow = Math.pow(10, minLog + (i / BAR_COUNT) * (maxLog - minLog));
      const freqHigh = Math.pow(10, minLog + ((i + 1) / BAR_COUNT) * (maxLog - minLog));
      const binLow = Math.max(0, Math.floor((freqLow / sampleRate) * bufferLength * 2));
      const binHigh = Math.min(bufferLength - 1, Math.ceil((freqHigh / sampleRate) * bufferLength * 2));

      let maxVal = -Infinity;
      for (let b = binLow; b <= binHigh; b++) {
        if (dataArray[b] > maxVal) maxVal = dataArray[b];
      }

      // Normalize: -100dB to 0dB → 0 to 1
      const normalized = Math.max(0, Math.min(1, (maxVal + 100) / 100));
      const barHeight = normalized * (height - 16);

      // Color gradient: low freq = blue, mid = green, high = orange/red
      const hue = 200 - (i / BAR_COUNT) * 180;
      const lightness = 45 + normalized * 15;
      ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;

      const x = i * barWidth + 1;
      ctx.fillRect(x, height - 14 - barHeight, barWidth - 2, barHeight);

      // Peak hold
      if (peakHold) {
        if (normalized > peaksRef.current[i]) {
          peaksRef.current[i] = normalized;
          peakDecayRef.current[i] = 0;
        } else {
          peakDecayRef.current[i] += 0.002;
          peaksRef.current[i] = Math.max(0, peaksRef.current[i] - peakDecayRef.current[i]);
        }

        const peakY = height - 14 - peaksRef.current[i] * (height - 16);
        ctx.fillStyle = `hsl(${hue}, 90%, 70%)`;
        ctx.fillRect(x, peakY - 2, barWidth - 2, 2);
      }
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [width, height, running, peakHold]);

  useEffect(() => {
    if (running) {
      animFrameRef.current = requestAnimationFrame(draw);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw, running]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <BarChart3 className="w-3.5 h-3.5" />
          <span className="font-medium">Spectrum Analyzer</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={peakHold ? 'secondary' : 'ghost'}
            onClick={() => {
              setPeakHold(!peakHold);
              peaksRef.current.fill(0);
              peakDecayRef.current.fill(0);
            }}
            className="h-5 text-[9px] px-1.5"
          >
            Peak
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRunning(!running)}
            className="h-5 w-5 p-0"
          >
            {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </Button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="rounded-md border border-zinc-700/50"
        style={{ width, height }}
      />
    </div>
  );
}
