import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Eye, EyeOff, Plus, Trash2, Pencil, MousePointer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createAutomationLane,
  addAutomationPoint,
  removeAutomationPoint,
  moveAutomationPoint,
  drawAutomationCurve,
  getAutomationValue,
  getParamDisplayName,
  AUTOMATABLE_PARAMS,
  type AutomationMode,
} from '@/lib/automationEngine';
import type { AutomationPoint, AutomationLane } from '@/lib/projectManager';

interface AutomationLaneEditorProps {
  trackId: string;
  trackName: string;
  trackColor: string;
  lanes: AutomationLane[];
  totalBeats: number;
  pixelsPerBeat: number;
  onLanesChange: (lanes: AutomationLane[]) => void;
}

type Tool = 'pointer' | 'pencil';

export default function AutomationLaneEditor({
  trackId,
  trackName,
  trackColor,
  lanes,
  totalBeats,
  pixelsPerBeat,
  onLanesChange,
}: AutomationLaneEditorProps) {
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(lanes[0]?.id || null);
  const [tool, setTool] = useState<Tool>('pointer');
  const [automationMode, setAutomationMode] = useState<AutomationMode>('read');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawSamples, setDrawSamples] = useState<Array<{ time: number; value: number }>>([]);
  const [dragPointTime, setDragPointTime] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedLane = useMemo(() => lanes.find(l => l.id === selectedLaneId), [lanes, selectedLaneId]);
  const laneHeight = 80;
  const canvasWidth = totalBeats * pixelsPerBeat;

  const allParams = useMemo((): string[] => {
    const params: string[] = [...AUTOMATABLE_PARAMS.common];
    // Expression / instrument params (CC11, CC1, filter cutoff)
    if ('expression' in AUTOMATABLE_PARAMS) {
      params.push(...(AUTOMATABLE_PARAMS as any).expression);
    }
    Object.values(AUTOMATABLE_PARAMS.effects).forEach(group => params.push(...group));
    params.push(...AUTOMATABLE_PARAMS.send);
    return params;
  }, []);

  const existingParams = useMemo(() => new Set(lanes.map(l => l.parameter)), [lanes]);

  const updateLane = useCallback((laneId: string, updater: (lane: AutomationLane) => AutomationLane) => {
    onLanesChange(lanes.map(l => l.id === laneId ? updater(l) : l));
  }, [lanes, onLanesChange]);

  const handleAddLane = useCallback((param: string) => {
    const newLane = createAutomationLane(trackId, param);
    onLanesChange([...lanes, newLane]);
    setSelectedLaneId(newLane.id);
  }, [trackId, lanes, onLanesChange]);

  const handleRemoveLane = useCallback((laneId: string) => {
    const filtered = lanes.filter(l => l.id !== laneId);
    onLanesChange(filtered);
    if (selectedLaneId === laneId) {
      setSelectedLaneId(filtered[0]?.id || null);
    }
  }, [lanes, onLanesChange, selectedLaneId]);

  const handleToggleLane = useCallback((laneId: string) => {
    updateLane(laneId, l => ({ ...l, enabled: !l.enabled }));
  }, [updateLane]);

  const canvasToLane = useCallback((clientX: number, clientY: number): { time: number; value: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const time = x / pixelsPerBeat;
    const value = 1 - (y / laneHeight);
    return { time: Math.max(0, Math.min(totalBeats, time)), value: Math.max(0, Math.min(1, value)) };
  }, [pixelsPerBeat, totalBeats, laneHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectedLane) return;
    const pos = canvasToLane(e.clientX, e.clientY);
    if (!pos) return;

    if (tool === 'pencil') {
      setIsDrawing(true);
      setDrawSamples([pos]);
    } else {
      // Pointer tool — check if clicking near a point
      const nearPoint = selectedLane.points.find(p => Math.abs(p.time - pos.time) < 0.3);
      if (nearPoint) {
        if (e.button === 2 || e.altKey) {
          // Right-click or alt-click to delete
          updateLane(selectedLane.id, l => removeAutomationPoint(l, nearPoint.time));
        } else {
          setDragPointTime(nearPoint.time);
        }
      } else {
        // Click empty space — add a point
        const point: AutomationPoint = { time: pos.time, value: pos.value, curve: 'linear' };
        updateLane(selectedLane.id, l => addAutomationPoint(l, point));
      }
    }
  }, [selectedLane, tool, canvasToLane, updateLane]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectedLane) return;
    const pos = canvasToLane(e.clientX, e.clientY);
    if (!pos) return;

    if (isDrawing && tool === 'pencil') {
      setDrawSamples(prev => [...prev, pos]);
    } else if (dragPointTime !== null) {
      updateLane(selectedLane.id, l => moveAutomationPoint(l, dragPointTime, pos.time, pos.value));
      setDragPointTime(pos.time);
    }
  }, [selectedLane, isDrawing, tool, dragPointTime, canvasToLane, updateLane]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing && selectedLane && drawSamples.length > 0) {
      updateLane(selectedLane.id, l => drawAutomationCurve(l, drawSamples, 'linear'));
      setDrawSamples([]);
    }
    setIsDrawing(false);
    setDragPointTime(null);
  }, [isDrawing, selectedLane, drawSamples, updateLane]);

  // Draw the automation curve on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedLane) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = laneHeight;
    ctx.clearRect(0, 0, canvasWidth, laneHeight);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let beat = 0; beat < totalBeats; beat++) {
      const x = beat * pixelsPerBeat;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, laneHeight);
      ctx.stroke();
    }
    for (let v = 0; v <= 4; v++) {
      const y = (v / 4) * laneHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    if (!selectedLane.enabled) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, canvasWidth, laneHeight);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '11px sans-serif';
      ctx.fillText('(disabled)', 10, laneHeight / 2 + 4);
      return;
    }

    // Draw curve
    if (selectedLane.points.length > 0) {
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const step = 0.1;
      for (let t = 0; t <= totalBeats; t += step) {
        const val = getAutomationValue(selectedLane, t);
        if (val === null) continue;
        const x = t * pixelsPerBeat;
        const y = (1 - val) * laneHeight;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill under curve
      ctx.lineTo(canvasWidth, laneHeight);
      ctx.lineTo(0, laneHeight);
      ctx.closePath();
      ctx.fillStyle = trackColor.replace(')', ', 0.1)').replace('rgb', 'rgba').replace('hsl', 'hsla');
      ctx.fill();

      // Draw points
      for (const point of selectedLane.points) {
        const x = point.time * pixelsPerBeat;
        const y = (1 - point.value) * laneHeight;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = trackColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw pencil preview
    if (isDrawing && drawSamples.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      drawSamples.forEach((s, i) => {
        const x = s.time * pixelsPerBeat;
        const y = (1 - s.value) * laneHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [selectedLane, canvasWidth, laneHeight, totalBeats, pixelsPerBeat, trackColor, isDrawing, drawSamples]);

  return (
    <div className="flex flex-col border border-zinc-700 rounded-lg overflow-hidden bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-700">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: trackColor }} />
        <span className="text-xs font-medium text-zinc-300">{trackName} - Automation</span>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            size="sm"
            variant={tool === 'pointer' ? 'secondary' : 'ghost'}
            onClick={() => setTool('pointer')}
            className="p-1 h-6 w-6"
            title="Pointer (click to add/move points)"
          >
            <MousePointer className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant={tool === 'pencil' ? 'secondary' : 'ghost'}
            onClick={() => setTool('pencil')}
            className="p-1 h-6 w-6"
            title="Pencil (draw curves)"
          >
            <Pencil className="w-3 h-3" />
          </Button>

          <div className="w-px h-4 bg-zinc-600 mx-1" />

          {/* Automation recording modes */}
          {(['read', 'write', 'touch', 'latch'] as AutomationMode[]).map(mode => (
            <Button
              key={mode}
              size="sm"
              variant={automationMode === mode ? 'secondary' : 'ghost'}
              onClick={() => setAutomationMode(mode)}
              className={`h-6 text-[10px] px-1.5 ${
                automationMode === mode && mode === 'write' ? 'bg-red-600/80 text-white hover:bg-red-700' :
                automationMode === mode && mode === 'touch' ? 'bg-amber-600/80 text-white hover:bg-amber-700' :
                automationMode === mode && mode === 'latch' ? 'bg-orange-600/80 text-white hover:bg-orange-700' :
                ''
              }`}
              title={{
                read: 'Read — plays back existing automation',
                write: 'Write — continuously records automation',
                touch: 'Touch — records while control is held',
                latch: 'Latch — records from first touch until stop',
              }[mode]}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Lane tabs */}
      <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800/30 border-b border-zinc-700 overflow-x-auto">
        {lanes.map(lane => (
          <div
            key={lane.id}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
              lane.id === selectedLaneId
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-zinc-400 hover:bg-zinc-700/50'
            }`}
            onClick={() => setSelectedLaneId(lane.id)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleLane(lane.id); }}
              className="p-0.5"
              title={lane.enabled ? 'Disable' : 'Enable'}
            >
              {lane.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 opacity-50" />}
            </button>
            <span>{getParamDisplayName(lane.parameter)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveLane(lane.id); }}
              className="p-0.5 hover:text-red-400"
              title="Remove lane"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        <Select onValueChange={handleAddLane}>
          <SelectTrigger className="h-6 w-6 p-0 border-none bg-transparent">
            <Plus className="w-3.5 h-3.5 text-zinc-400" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-600">
            {allParams.filter(p => !existingParams.has(p)).map(param => (
              <SelectItem key={param} value={param} className="text-xs">
                {getParamDisplayName(param)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Canvas */}
      <div className="relative overflow-x-auto" style={{ height: laneHeight }}>
        <canvas
          ref={canvasRef}
          className="block cursor-crosshair"
          style={{ width: canvasWidth, height: laneHeight }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}
