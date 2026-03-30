/**
 * InstrumentEditor — ADSR Envelope + Preset Selector UI
 * 
 * A pop-up panel that gives the user direct control over:
 * - Attack / Decay / Sustain / Release sliders
 * - Instrument preset selection (Sub Bass, FM Bass, Analog Strings, etc.)
 * - Visual ADSR envelope curve preview
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Sliders, Music, ChevronDown, Waves, Guitar, Piano, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getExpressiveEngine,
  FACTORY_PRESETS,
  type ADSREnvelope,
  type InstrumentPreset,
} from '@/organism/instruments/ExpressiveEngine';

interface InstrumentEditorProps {
  /** Called when the user selects a new preset (so the parent can update track metadata). */
  onPresetChange?: (preset: InstrumentPreset) => void;
  /** Called when ADSR values change. */
  onEnvelopeChange?: (envelope: ADSREnvelope) => void;
  /** Initial preset ID to select. */
  initialPresetId?: string;
  /** Whether the editor is visible. */
  open?: boolean;
  /** Called when the user closes the editor. */
  onClose?: () => void;
}

export default function InstrumentEditor({
  onPresetChange,
  onEnvelopeChange,
  initialPresetId,
  open = true,
  onClose,
}: InstrumentEditorProps) {
  const engine = useMemo(() => getExpressiveEngine(), []);

  const [selectedPresetId, setSelectedPresetId] = useState(
    initialPresetId || FACTORY_PRESETS[0].id
  );
  const [envelope, setEnvelope] = useState<ADSREnvelope>(
    FACTORY_PRESETS.find(p => p.id === initialPresetId)?.envelope || FACTORY_PRESETS[0].envelope
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Apply preset to engine on change
  useEffect(() => {
    const preset = FACTORY_PRESETS.find(p => p.id === selectedPresetId);
    if (preset) {
      engine.setPreset({ ...preset, envelope });
      onPresetChange?.(preset);
    }
  }, [selectedPresetId]);

  // Apply envelope updates
  useEffect(() => {
    engine.updateEnvelope(envelope);
    onEnvelopeChange?.(envelope);
    drawEnvelopeCurve();
  }, [envelope]);

  const handlePresetSelect = useCallback((id: string) => {
    const preset = FACTORY_PRESETS.find(p => p.id === id);
    if (preset) {
      setSelectedPresetId(id);
      setEnvelope(preset.envelope);
    }
  }, []);

  const updateParam = useCallback((key: keyof ADSREnvelope, value: number) => {
    setEnvelope(prev => ({ ...prev, [key]: value }));
  }, []);

  // ─── ADSR Curve Visualization ─────────────────────────────────

  const drawEnvelopeCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const pad = 8;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.roundRect(0, 0, W, H, 6);
    ctx.fill();

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += H / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const { attack, decay, sustain, release } = envelope;

    // Normalize times to fit canvas
    const totalTime = attack + decay + 0.5 + release; // 0.5 = sustain hold visualization
    const scaleX = (W - 2 * pad) / totalTime;
    const baseY = H - pad;
    const topY = pad;
    const sustainY = topY + (1 - sustain) * (baseY - topY);

    // Build path
    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee'; // cyan-400
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';

    let x = pad;

    // Start at zero
    ctx.moveTo(x, baseY);

    // Attack: rise to peak
    x += attack * scaleX;
    ctx.lineTo(x, topY);

    // Decay: fall to sustain level
    x += decay * scaleX;
    ctx.lineTo(x, sustainY);

    // Sustain hold
    x += 0.5 * scaleX;
    ctx.lineTo(x, sustainY);

    // Release: fall to zero
    x += release * scaleX;
    ctx.lineTo(x, baseY);

    ctx.stroke();

    // Fill under curve
    ctx.lineTo(x, baseY);
    ctx.lineTo(pad, baseY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
    ctx.fill();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';

    let labelX = pad;
    ctx.fillText('A', labelX + (attack * scaleX) / 2, baseY - 4);
    labelX += attack * scaleX;
    ctx.fillText('D', labelX + (decay * scaleX) / 2, baseY - 4);
    labelX += decay * scaleX;
    ctx.fillText('S', labelX + (0.5 * scaleX) / 2, sustainY - 6);
    labelX += 0.5 * scaleX;
    ctx.fillText('R', labelX + (release * scaleX) / 2, baseY - 4);
  }, [envelope]);

  useEffect(() => {
    drawEnvelopeCurve();
  }, [drawEnvelopeCurve]);

  if (!open) return null;

  const currentPreset = FACTORY_PRESETS.find(p => p.id === selectedPresetId);

  const getPresetIcon = (preset: InstrumentPreset) => {
    if (preset.mode === 'sampler') return '🎻';
    switch (preset.synthType) {
      case 'subBass':
      case 'fmBass':
        return '🔊';
      case 'analogStrings':
        return '🎹';
      case 'pad':
        return '🌊';
      case 'lead':
        return '⚡';
      default:
        return '🎵';
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-700 w-80 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Instrument Editor
        </h3>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="h-6 w-6 p-0 text-zinc-400">
            ×
          </Button>
        )}
      </div>

      {/* Preset Selector */}
      <div className="space-y-1">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Preset</span>
        <Select value={selectedPresetId} onValueChange={handlePresetSelect}>
          <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-600">
            <SelectValue>
              {currentPreset && (
                <span className="flex items-center gap-1.5">
                  <span>{getPresetIcon(currentPreset)}</span>
                  <span>{currentPreset.name}</span>
                  <span className="text-[9px] text-zinc-500 ml-1">
                    ({currentPreset.mode === 'synth' ? 'Synth' : 'Acoustic'})
                  </span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FACTORY_PRESETS.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-1.5">
                  <span>{getPresetIcon(p)}</span>
                  <span>{p.name}</span>
                  <span className="text-[9px] text-zinc-500 ml-1">
                    ({p.mode === 'synth' ? 'Synth' : 'Acoustic'})
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ADSR Curve Visualization */}
      <div className="space-y-1">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Envelope</span>
        <canvas
          ref={canvasRef}
          width={272}
          height={72}
          className="w-full rounded border border-zinc-700/50"
        />
      </div>

      {/* ADSR Sliders */}
      <div className="grid grid-cols-2 gap-3">
        {/* Attack */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400">Attack</span>
            <span className="text-[10px] text-cyan-400 font-mono">{envelope.attack.toFixed(2)}s</span>
          </div>
          <Slider
            value={[envelope.attack]}
            onValueChange={([v]) => updateParam('attack', v)}
            min={0.001}
            max={5.0}
            step={0.01}
            className="h-5"
          />
        </div>

        {/* Decay */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400">Decay</span>
            <span className="text-[10px] text-cyan-400 font-mono">{envelope.decay.toFixed(2)}s</span>
          </div>
          <Slider
            value={[envelope.decay]}
            onValueChange={([v]) => updateParam('decay', v)}
            min={0.001}
            max={5.0}
            step={0.01}
            className="h-5"
          />
        </div>

        {/* Sustain */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400">Sustain</span>
            <span className="text-[10px] text-cyan-400 font-mono">{Math.round(envelope.sustain * 100)}%</span>
          </div>
          <Slider
            value={[envelope.sustain]}
            onValueChange={([v]) => updateParam('sustain', v)}
            min={0.0}
            max={1.0}
            step={0.01}
            className="h-5"
          />
        </div>

        {/* Release */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400">Release</span>
            <span className="text-[10px] text-cyan-400 font-mono">{envelope.release.toFixed(2)}s</span>
          </div>
          <Slider
            value={[envelope.release]}
            onValueChange={([v]) => updateParam('release', v)}
            min={0.001}
            max={10.0}
            step={0.01}
            className="h-5"
          />
        </div>
      </div>

      {/* Info */}
      <div className="text-[10px] text-zinc-600 leading-relaxed border-t border-zinc-700/50 pt-2">
        <strong className="text-zinc-500">Hold</strong> a key on your keyboard or MIDI controller — 
        the note sustains until you release it. <br />
        <strong className="text-zinc-500">Sustain at 100%</strong> = infinite hold. 
        <strong className="text-zinc-500">Release</strong> = how long the note fades out after you let go.
      </div>
    </div>
  );
}
