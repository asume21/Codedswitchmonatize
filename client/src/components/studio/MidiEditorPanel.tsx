import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Music, Zap, Wand2, ArrowUpDown, Gauge, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  SCALES,
  COMMON_CC,
  isNoteInScale,
  snapNotesToScale,
  setNoteVelocity,
  scaleVelocities,
  humanizeVelocities,
  applyVelocityCurve,
  compressVelocities,
  quantizeNotes,
  humanizeTiming,
  applySwing,
  transposeNotes,
  invertNotes,
  reverseNotes,
  applyLegato,
  applyStaccato,
  noteToMidi,
  createCCLane,
  addCCEvent,
  drawCCCurve,
  getCCValueAtStep,
  type CCLane,
  type QuantizeGrid,
} from '@/lib/midiEditor';
import type { Note } from '../../../../shared/studioTypes';

interface MidiEditorPanelProps {
  trackId: string;
  notes: Note[];
  rootKey: string;
  scaleName: string;
  totalSteps: number;
  pixelsPerStep: number;
  onNotesChange: (notes: Note[]) => void;
  onKeyChange?: (key: string) => void;
  onScaleChange?: (scale: string) => void;
}

type BottomPanel = 'velocity' | 'cc';

export default function MidiEditorPanel({
  trackId,
  notes,
  rootKey,
  scaleName,
  totalSteps,
  pixelsPerStep,
  onNotesChange,
  onKeyChange,
  onScaleChange,
}: MidiEditorPanelProps) {
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('velocity');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [scaleSnap, setScaleSnap] = useState(false);
  const [scaleHighlight, setScaleHighlight] = useState(true);
  const [ccLanes, setCcLanes] = useState<CCLane[]>([]);
  const [activeCcLane, setActiveCcLane] = useState<string | null>(null);
  const [isDrawingCC, setIsDrawingCC] = useState(false);
  const [ccDrawSamples, setCcDrawSamples] = useState<Array<{ step: number; value: number }>>([]);
  const velocityCanvasRef = useRef<HTMLCanvasElement>(null);
  const ccCanvasRef = useRef<HTMLCanvasElement>(null);

  const selectedNotes = useMemo(() => notes.filter(n => selectedNoteIds.has(n.id)), [notes, selectedNoteIds]);
  const canvasWidth = totalSteps * pixelsPerStep;
  const velocityHeight = 80;
  const ccHeight = 80;

  const activeCc = useMemo(() => ccLanes.find(l => l.id === activeCcLane), [ccLanes, activeCcLane]);

  // ─── Scale operations ─────────────────────────────────────────────

  const handleSnapToScale = useCallback(() => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const snapped = snapNotesToScale(target, rootKey, scaleName);
    if (selectedNotes.length > 0) {
      const snappedMap = new Map(snapped.map(n => [n.id, n]));
      onNotesChange(notes.map(n => snappedMap.get(n.id) || n));
    } else {
      onNotesChange(snapped);
    }
  }, [notes, selectedNotes, rootKey, scaleName, onNotesChange]);

  // ─── Velocity operations ──────────────────────────────────────────

  const handleVelocityChange = useCallback((noteId: string, velocity: number) => {
    onNotesChange(notes.map(n => n.id === noteId ? setNoteVelocity(n, velocity) : n));
  }, [notes, onNotesChange]);

  const handleScaleVelocities = useCallback((factor: number) => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const scaled = scaleVelocities(target, factor);
    const scaledMap = new Map(scaled.map(n => [n.id, n]));
    onNotesChange(notes.map(n => scaledMap.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleHumanizeVelocities = useCallback(() => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const humanized = humanizeVelocities(target, 15);
    const map = new Map(humanized.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleVelocityCurve = useCallback((startVel: number, endVel: number) => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const curved = applyVelocityCurve(target, startVel, endVel);
    const map = new Map(curved.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleCompressVelocities = useCallback(() => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const compressed = compressVelocities(target, 80, 2);
    const map = new Map(compressed.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  // ─── Timing operations ────────────────────────────────────────────

  const handleQuantize = useCallback((grid: QuantizeGrid) => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const quantized = quantizeNotes(target, grid, 1);
    const map = new Map(quantized.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleHumanizeTiming = useCallback(() => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const humanized = humanizeTiming(target, 0.3);
    const map = new Map(humanized.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleSwing = useCallback((percent: number) => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const swung = applySwing(target, percent);
    const map = new Map(swung.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  // ─── Transform operations ─────────────────────────────────────────

  const handleTranspose = useCallback((semitones: number) => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const transposed = transposeNotes(target, semitones);
    const map = new Map(transposed.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleInvert = useCallback(() => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const inverted = invertNotes(target);
    const map = new Map(inverted.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleReverse = useCallback(() => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const reversed = reverseNotes(target);
    const map = new Map(reversed.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleLegato = useCallback(() => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const result = applyLegato(target);
    const map = new Map(result.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  const handleStaccato = useCallback(() => {
    const target = selectedNotes.length > 0 ? selectedNotes : notes;
    const result = applyStaccato(target, 0.5);
    const map = new Map(result.map(n => [n.id, n]));
    onNotesChange(notes.map(n => map.get(n.id) || n));
  }, [notes, selectedNotes, onNotesChange]);

  // ─── CC Lane operations ───────────────────────────────────────────

  const handleAddCCLane = useCallback((cc: number) => {
    const lane = createCCLane(trackId, cc);
    setCcLanes(prev => [...prev, lane]);
    setActiveCcLane(lane.id);
  }, [trackId]);

  const handleCCMouseDown = useCallback((e: React.MouseEvent) => {
    if (!activeCc || !ccCanvasRef.current) return;
    const rect = ccCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const step = (x / canvasWidth) * totalSteps;
    const value = (1 - y / ccHeight) * 127;
    setIsDrawingCC(true);
    setCcDrawSamples([{ step, value }]);
  }, [activeCc, canvasWidth, totalSteps, ccHeight]);

  const handleCCMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingCC || !ccCanvasRef.current) return;
    const rect = ccCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const step = (x / canvasWidth) * totalSteps;
    const value = (1 - y / ccHeight) * 127;
    setCcDrawSamples(prev => [...prev, { step, value }]);
  }, [isDrawingCC, canvasWidth, totalSteps, ccHeight]);

  const handleCCMouseUp = useCallback(() => {
    if (isDrawingCC && activeCc && ccDrawSamples.length > 0) {
      const updated = drawCCCurve(activeCc, ccDrawSamples);
      setCcLanes(prev => prev.map(l => l.id === activeCc.id ? updated : l));
    }
    setIsDrawingCC(false);
    setCcDrawSamples([]);
  }, [isDrawingCC, activeCc, ccDrawSamples]);

  // ─── Draw velocity bars ───────────────────────────────────────────

  useEffect(() => {
    const canvas = velocityCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = velocityHeight;
    ctx.clearRect(0, 0, canvasWidth, velocityHeight);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let s = 0; s < totalSteps; s += 4) {
      const x = s * pixelsPerStep;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, velocityHeight);
      ctx.stroke();
    }

    // Velocity bars
    for (const note of notes) {
      const x = note.step * pixelsPerStep;
      const barWidth = Math.max(pixelsPerStep * 0.6, 3);
      const barHeight = (note.velocity / 127) * velocityHeight;
      const isSelected = selectedNoteIds.has(note.id);

      // Color based on velocity
      const hue = 120 - (note.velocity / 127) * 120; // green (low) to red (high)
      ctx.fillStyle = isSelected
        ? `hsla(270, 80%, 60%, 0.8)`
        : `hsla(${hue}, 70%, 50%, 0.7)`;

      ctx.fillRect(x - barWidth / 2, velocityHeight - barHeight, barWidth, barHeight);

      // Velocity text
      if (barWidth > 8) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '8px sans-serif';
        ctx.fillText(String(note.velocity), x - 4, velocityHeight - barHeight - 2);
      }
    }
  }, [notes, canvasWidth, velocityHeight, totalSteps, pixelsPerStep, selectedNoteIds]);

  // ─── Draw CC lane ─────────────────────────────────────────────────

  useEffect(() => {
    const canvas = ccCanvasRef.current;
    if (!canvas || !activeCc) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = ccHeight;
    ctx.clearRect(0, 0, canvasWidth, ccHeight);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let s = 0; s < totalSteps; s += 4) {
      ctx.beginPath();
      ctx.moveTo(s * pixelsPerStep, 0);
      ctx.lineTo(s * pixelsPerStep, ccHeight);
      ctx.stroke();
    }

    // CC curve
    if (activeCc.events.length > 0) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s <= totalSteps; s += 0.5) {
        const val = getCCValueAtStep(activeCc, s);
        const x = s * pixelsPerStep;
        const y = (1 - val / 127) * ccHeight;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Points
      for (const event of activeCc.events) {
        const x = event.step * pixelsPerStep;
        const y = (1 - event.value / 127) * ccHeight;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }

    // Draw preview
    if (isDrawingCC && ccDrawSamples.length > 1) {
      ctx.strokeStyle = 'rgba(245,158,11,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ccDrawSamples.forEach((s, i) => {
        const x = (s.step / totalSteps) * canvasWidth;
        const y = (1 - s.value / 127) * ccHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [activeCc, canvasWidth, ccHeight, totalSteps, pixelsPerStep, isDrawingCC, ccDrawSamples]);

  // Handle velocity bar click/drag
  const handleVelocityMouseDown = useCallback((e: React.MouseEvent) => {
    if (!velocityCanvasRef.current) return;
    const rect = velocityCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickStep = x / pixelsPerStep;
    const newVelocity = Math.round((1 - y / velocityHeight) * 127);

    // Find nearest note
    let nearest: Note | null = null;
    let minDist = Infinity;
    for (const note of notes) {
      const dist = Math.abs(note.step - clickStep);
      if (dist < minDist && dist < 2) {
        minDist = dist;
        nearest = note;
      }
    }
    if (nearest) {
      handleVelocityChange(nearest.id, newVelocity);
    }
  }, [notes, pixelsPerStep, velocityHeight, handleVelocityChange]);

  return (
    <div className="flex flex-col gap-2 bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-700 flex-wrap">
        {/* Scale controls */}
        <div className="flex items-center gap-1 mr-2">
          <Select value={rootKey} onValueChange={onKeyChange}>
            <SelectTrigger className="h-6 w-14 text-[10px] bg-zinc-700/50 border-zinc-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-600">
              {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => (
                <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scaleName} onValueChange={onScaleChange}>
            <SelectTrigger className="h-6 w-28 text-[10px] bg-zinc-700/50 border-zinc-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-600">
              {Object.entries(SCALES).map(([key, scale]) => (
                <SelectItem key={key} value={key} className="text-xs">{scale.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={scaleHighlight ? 'secondary' : 'ghost'}
            onClick={() => setScaleHighlight(!scaleHighlight)}
            className="h-6 text-[10px] px-1.5"
            title="Highlight scale notes"
          >
            HL
          </Button>
          <Button
            size="sm"
            variant={scaleSnap ? 'secondary' : 'ghost'}
            onClick={() => setScaleSnap(!scaleSnap)}
            className="h-6 text-[10px] px-1.5"
            title="Snap to scale"
          >
            SN
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSnapToScale} className="h-6 text-[10px] px-1.5" title="Snap selection to scale">
            <Wand2 className="w-3 h-3" />
          </Button>
        </div>

        {/* Quantize */}
        <div className="flex items-center gap-0.5 mr-2">
          <span className="text-[9px] text-zinc-500">Q:</span>
          {(['1/4', '1/8', '1/16', '1/32'] as QuantizeGrid[]).map(grid => (
            <Button key={grid} size="sm" variant="ghost" onClick={() => handleQuantize(grid)} className="h-6 text-[10px] px-1">
              {grid}
            </Button>
          ))}
        </div>

        {/* Transforms */}
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={() => handleTranspose(-12)} className="h-6 text-[10px] px-1" title="Octave down">-8va</Button>
          <Button size="sm" variant="ghost" onClick={() => handleTranspose(-1)} className="h-6 text-[10px] px-1" title="Semitone down">-1</Button>
          <Button size="sm" variant="ghost" onClick={() => handleTranspose(1)} className="h-6 text-[10px] px-1" title="Semitone up">+1</Button>
          <Button size="sm" variant="ghost" onClick={() => handleTranspose(12)} className="h-6 text-[10px] px-1" title="Octave up">+8va</Button>
          <div className="w-px h-4 bg-zinc-600 mx-0.5" />
          <Button size="sm" variant="ghost" onClick={handleInvert} className="h-6 text-[10px] px-1" title="Invert">Inv</Button>
          <Button size="sm" variant="ghost" onClick={handleReverse} className="h-6 text-[10px] px-1" title="Reverse">Rev</Button>
          <Button size="sm" variant="ghost" onClick={handleLegato} className="h-6 text-[10px] px-1" title="Legato">Leg</Button>
          <Button size="sm" variant="ghost" onClick={handleStaccato} className="h-6 text-[10px] px-1" title="Staccato">Stac</Button>
        </div>
      </div>

      {/* Bottom panel tabs */}
      <div className="flex items-center gap-1 px-3">
        <Button
          size="sm"
          variant={bottomPanel === 'velocity' ? 'secondary' : 'ghost'}
          onClick={() => setBottomPanel('velocity')}
          className="h-6 text-[10px] gap-1"
        >
          <Gauge className="w-3 h-3" /> Velocity
        </Button>
        <Button
          size="sm"
          variant={bottomPanel === 'cc' ? 'secondary' : 'ghost'}
          onClick={() => setBottomPanel('cc')}
          className="h-6 text-[10px] gap-1"
        >
          <Waves className="w-3 h-3" /> CC
        </Button>

        {bottomPanel === 'velocity' && (
          <div className="flex items-center gap-0.5 ml-auto">
            <Button size="sm" variant="ghost" onClick={() => handleScaleVelocities(1.2)} className="h-5 text-[9px] px-1">+20%</Button>
            <Button size="sm" variant="ghost" onClick={() => handleScaleVelocities(0.8)} className="h-5 text-[9px] px-1">-20%</Button>
            <Button size="sm" variant="ghost" onClick={handleHumanizeVelocities} className="h-5 text-[9px] px-1">Humanize</Button>
            <Button size="sm" variant="ghost" onClick={handleCompressVelocities} className="h-5 text-[9px] px-1">Compress</Button>
            <Button size="sm" variant="ghost" onClick={() => handleVelocityCurve(40, 120)} className="h-5 text-[9px] px-1">Cresc</Button>
            <Button size="sm" variant="ghost" onClick={() => handleVelocityCurve(120, 40)} className="h-5 text-[9px] px-1">Decresc</Button>
          </div>
        )}

        {bottomPanel === 'cc' && (
          <div className="flex items-center gap-1 ml-auto">
            {ccLanes.map(lane => (
              <Button
                key={lane.id}
                size="sm"
                variant={activeCcLane === lane.id ? 'secondary' : 'ghost'}
                onClick={() => setActiveCcLane(lane.id)}
                className="h-5 text-[9px] px-1.5"
              >
                {lane.name}
              </Button>
            ))}
            <Select onValueChange={(v) => handleAddCCLane(Number(v))}>
              <SelectTrigger className="h-5 w-5 p-0 border-none bg-transparent">
                <span className="text-[10px] text-zinc-400">+</span>
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-600">
                {COMMON_CC.filter(cc => !ccLanes.find(l => l.cc === cc.cc)).map(cc => (
                  <SelectItem key={cc.cc} value={String(cc.cc)} className="text-xs">
                    CC{cc.cc}: {cc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div className="overflow-x-auto px-3 pb-2">
        {bottomPanel === 'velocity' && (
          <canvas
            ref={velocityCanvasRef}
            className="block bg-zinc-800/50 rounded cursor-crosshair"
            style={{ width: canvasWidth, height: velocityHeight }}
            onMouseDown={handleVelocityMouseDown}
          />
        )}
        {bottomPanel === 'cc' && (
          <canvas
            ref={ccCanvasRef}
            className="block bg-zinc-800/50 rounded cursor-crosshair"
            style={{ width: canvasWidth, height: ccHeight }}
            onMouseDown={handleCCMouseDown}
            onMouseMove={handleCCMouseMove}
            onMouseUp={handleCCMouseUp}
            onMouseLeave={handleCCMouseUp}
          />
        )}
      </div>
    </div>
  );
}
