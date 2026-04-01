/**
 * MasterBusPanel — Master bus controls for CodedSwitch Studio
 *
 * Exposes the existing professionalAudio master chain via a UI panel:
 *  • Master volume (gain)
 *  • 3-band EQ (bass / mid / treble)
 *  • Compressor (threshold, ratio, attack, release)
 *  • Limiter (ceiling / output ceiling)
 *  • Peak / RMS meter on the master output
 *
 * The panel is collapsible and can float or be embedded.
 * All values write directly to professionalAudio.*
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { professionalAudio } from '@/lib/professionalAudio';
import { pianoRollScheduler } from '@/lib/pianoRollScheduler';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronUp, Activity, Sliders, Zap, Volume2,
} from 'lucide-react';

// ── Mini knob (slider dressed as a rotary) ────────────────────────────────────
function Knob({
  label, value, min, max, step, unit = '',
  onChange, color = '#06b6d4',
}: {
  label: string; value: number; min: number; max: number; step?: number;
  unit?: string; onChange: (v: number) => void; color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 52 }}>
      <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step ?? (max - min) / 200}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 cursor-pointer"
        style={{ accentColor: color }}
      />
      <span className="text-[9px] font-mono" style={{ color }}>
        {value.toFixed(unit === 'dB' ? 1 : 2)}{unit}
      </span>
    </div>
  );
}

// ── Peak / RMS meter ──────────────────────────────────────────────────────────
function MasterMeter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const analyser  = useRef<AnalyserNode | null>(null);
  const data      = useRef<Float32Array<ArrayBuffer>>(new Float32Array(256));

  useEffect(() => {
    // Try to grab the master analyser from professionalAudio
    try {
      const ch = (professionalAudio as any).masterAnalyser as AnalyserNode | undefined;
      analyser.current = ch ?? null;
      if (analyser.current) {
        data.current = new Float32Array(analyser.current.fftSize);
      }
    } catch {}

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let rms = 0;
      let peak = 0;
      if (analyser.current) {
        analyser.current.getFloatTimeDomainData(data.current);
        for (const s of data.current) {
          rms += s * s;
          if (Math.abs(s) > peak) peak = Math.abs(s);
        }
        rms = Math.sqrt(rms / data.current.length);
      }

      const w = canvas.width;
      const h = canvas.height;

      // RMS bar
      const rmsH = rms * h * 2;
      const rmsGrad = ctx.createLinearGradient(0, h, 0, 0);
      rmsGrad.addColorStop(0,   '#22c55e');
      rmsGrad.addColorStop(0.6, '#f59e0b');
      rmsGrad.addColorStop(1,   '#ef4444');
      ctx.fillStyle = rmsGrad;
      ctx.fillRect(2, h - rmsH, w - 8, rmsH);

      // Peak tick
      const peakY = h - peak * h * 2;
      ctx.fillStyle = peak > 0.8 ? '#ef4444' : '#06b6d4';
      ctx.fillRect(0, Math.max(0, peakY - 1), w - 4, 2);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={20}
      height={80}
      className="rounded-sm bg-black/40"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// ── Master bus panel ──────────────────────────────────────────────────────────
interface MasterBusPanelProps {
  className?: string;
}

export function MasterBusPanel({ className }: MasterBusPanelProps) {
  const [open, setOpen]         = useState(false);
  const [volume, setVolume]     = useState(1.0);
  const [eqBass, setEqBass]     = useState(0);     // dB
  const [eqMid, setEqMid]       = useState(0);
  const [eqHigh, setEqHigh]     = useState(0);
  const [compThresh, setCompThresh] = useState(-18); // dB
  const [compRatio, setCompRatio]   = useState(4);
  const [compAttack, setCompAttack] = useState(0.003);
  const [compRelease, setCompRelease] = useState(0.25);
  const [limitCeiling, setLimitCeiling] = useState(-0.1); // dB

  // Push changes to audio engine
  const apply = useCallback((key: string, val: number) => {
    try {
      switch (key) {
        case 'volume':
          (professionalAudio as any).setMasterVolume?.(val);
          break;
        case 'bass':
          (professionalAudio as any).setMasterEQ?.({ bass: val });
          break;
        case 'mid':
          (professionalAudio as any).setMasterEQ?.({ mid: val });
          break;
        case 'high':
          (professionalAudio as any).setMasterEQ?.({ high: val });
          break;
        case 'compThresh':
          (professionalAudio as any).setMasterCompressor?.({ threshold: val });
          break;
        case 'compRatio':
          (professionalAudio as any).setMasterCompressor?.({ ratio: val });
          break;
        case 'compAttack':
          (professionalAudio as any).setMasterCompressor?.({ attack: val });
          break;
        case 'compRelease':
          (professionalAudio as any).setMasterCompressor?.({ release: val });
          break;
        case 'limitCeiling':
          (professionalAudio as any).setMasterLimiter?.({ ceiling: val });
          break;
      }
    } catch {}
  }, []);

  return (
    <div className={cn('bg-[#06080f] border border-cyan-500/20 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <Activity className="w-3 h-3 text-cyan-500/60" />
        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400/70">Master Bus</span>
        <div className="ml-auto">
          {open ? <ChevronUp className="w-3 h-3 text-gray-600" /> : <ChevronDown className="w-3 h-3 text-gray-600" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Meter + Volume */}
          <div className="flex items-end gap-3">
            <MasterMeter />
            <div className="flex-1">
              <Knob
                label="Volume" value={Math.round(volume * 100)} min={0} max={150} step={1} unit="%"
                onChange={v => { setVolume(v / 100); apply('volume', v / 100); }}
                color="#06b6d4"
              />
            </div>
          </div>

          {/* EQ */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Sliders className="w-3 h-3 text-gray-600" />
              <span className="text-[9px] font-mono text-gray-700 uppercase">EQ</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Bass" value={eqBass} min={-12} max={12} step={0.5} unit="dB"
                onChange={v => { setEqBass(v); apply('bass', v); }} color="#3b82f6" />
              <Knob label="Mid"  value={eqMid}  min={-12} max={12} step={0.5} unit="dB"
                onChange={v => { setEqMid(v);  apply('mid',  v); }} color="#22c55e" />
              <Knob label="High" value={eqHigh} min={-12} max={12} step={0.5} unit="dB"
                onChange={v => { setEqHigh(v); apply('high', v); }} color="#f59e0b" />
            </div>
          </div>

          {/* Compressor */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Zap className="w-3 h-3 text-gray-600" />
              <span className="text-[9px] font-mono text-gray-700 uppercase">Compressor</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Knob label="Thresh" value={compThresh} min={-60} max={0} step={0.5} unit="dB"
                onChange={v => { setCompThresh(v); apply('compThresh', v); }} color="#8b5cf6" />
              <Knob label="Ratio"  value={compRatio}  min={1} max={20} step={0.5} unit=":1"
                onChange={v => { setCompRatio(v);  apply('compRatio',   v); }} color="#8b5cf6" />
              <Knob label="Attack"  value={Math.round(compAttack * 1000)} min={0} max={100} step={1} unit="ms"
                onChange={v => { const s = v / 1000; setCompAttack(s); apply('compAttack', s); }} color="#ec4899" />
              <Knob label="Release" value={Math.round(compRelease * 1000)} min={10} max={2000} step={10} unit="ms"
                onChange={v => { const s = v / 1000; setCompRelease(s); apply('compRelease', s); }} color="#ec4899" />
            </div>
          </div>

          {/* Limiter */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Volume2 className="w-3 h-3 text-gray-600" />
              <span className="text-[9px] font-mono text-gray-700 uppercase">Limiter</span>
            </div>
            <Knob label="Ceiling" value={limitCeiling} min={-12} max={0} step={0.1} unit="dB"
              onChange={v => { setLimitCeiling(v); apply('limitCeiling', v); }} color="#f97316" />
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterBusPanel;
