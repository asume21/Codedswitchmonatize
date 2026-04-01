/**
 * AutomationLane — per-track parameter automation editor
 *
 * Renders a horizontal canvas strip below a DAW track. Users can:
 *  • Click empty area to add a point
 *  • Drag an existing point to move it
 *  • Right-click a point to delete it
 *
 * Value is stored 0–1 normalised; the parent maps to the real param range.
 * Export `valueAt` for playback interpolation.
 */

import React, { useRef, useEffect, useCallback } from 'react';

export const AUTO_LANE_H = 52;
const POINT_R = 5;

export interface AutoPoint {
  id: string;
  bar: number;
  value: number; // 0 = min, 1 = max
}

export type AutoParam = 'volume' | 'pan';

// ── Interpolation helper (exported for playback) ──────────────────────────────
export function valueAt(points: AutoPoint[], bar: number, fallback = 0.75): number {
  if (!points.length) return fallback;
  const s = [...points].sort((a, b) => a.bar - b.bar);
  if (bar <= s[0].bar) return s[0].value;
  if (bar >= s[s.length - 1].bar) return s[s.length - 1].value;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if (bar >= a.bar && bar <= b.bar) {
      const t = (bar - a.bar) / (b.bar - a.bar);
      return a.value + t * (b.value - a.value);
    }
  }
  return fallback;
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
function draw(
  canvas: HTMLCanvasElement,
  points: AutoPoint[],
  totalBars: number,
  pxPerBar: number,
  playheadBar: number,
  color: string,
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, w, h);

  // Bar grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let b = 0; b <= totalBars; b++) {
    const x = b * pxPerBar;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }

  // 50% guideline
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();
  ctx.setLineDash([]);

  const sorted = [...points].sort((a, b) => a.bar - b.bar);

  if (sorted.length) {
    // Build full path including left/right edges
    const allX = [0, ...sorted.map(p => p.bar * pxPerBar), w];
    const allY = [
      h - sorted[0].value * h,
      ...sorted.map(p => h - p.value * h),
      h - sorted[sorted.length - 1].value * h,
    ];

    // Fill under curve
    ctx.beginPath();
    ctx.moveTo(allX[0], h);
    for (let i = 0; i < allX.length; i++) ctx.lineTo(allX[i], allY[i]);
    ctx.lineTo(allX[allX.length - 1], h);
    ctx.closePath();
    ctx.fillStyle = `${color}22`;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < allX.length; i++) {
      i === 0 ? ctx.moveTo(allX[i], allY[i]) : ctx.lineTo(allX[i], allY[i]);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Points
    for (const p of sorted) {
      const px = p.bar * pxPerBar;
      const py = h - p.value * h;
      ctx.beginPath();
      ctx.arc(px, py, POINT_R, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Playhead
  const phX = playheadBar * pxPerBar;
  ctx.strokeStyle = 'rgba(6,182,212,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(phX, 0); ctx.lineTo(phX, h); ctx.stroke();
}

// ── Component ─────────────────────────────────────────────────────────────────
interface AutomationLaneProps {
  points: AutoPoint[];
  param: AutoParam;
  pxPerBar: number;
  totalBars: number;
  playheadBar?: number;
  color?: string;
  onChange: (pts: AutoPoint[]) => void;
}

export function AutomationLane({
  points, param, pxPerBar, totalBars, playheadBar = 0, color = '#06b6d4', onChange,
}: AutomationLaneProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const dragRef     = useRef<{ id: string; startY: number; origValue: number; startX: number; origBar: number } | null>(null);
  const width       = totalBars * pxPerBar;

  // Redraw whenever inputs change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = width;
    canvas.height = AUTO_LANE_H;
    draw(canvas, points, totalBars, pxPerBar, playheadBar, color);
  }, [points, totalBars, pxPerBar, playheadBar, color, width]);

  // Hit-test: returns point id within POINT_R, or null
  const hitPoint = useCallback((clientX: number, clientY: number): string | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    for (const p of points) {
      const px = p.bar * pxPerBar;
      const py = AUTO_LANE_H - p.value * AUTO_LANE_H;
      const dist = Math.sqrt((lx - px) ** 2 + (ly - py) ** 2);
      if (dist <= POINT_R + 3) return p.id;
    }
    return null;
  }, [points, pxPerBar]);

  const clientToBarValue = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { bar: 0, value: 0.75 };
    const bar   = Math.max(0, Math.min(totalBars, (clientX - rect.left) / pxPerBar));
    const value = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / AUTO_LANE_H));
    return { bar, value };
  }, [pxPerBar, totalBars]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const hit = hitPoint(e.clientX, e.clientY);
    if (hit) {
      const p = points.find(x => x.id === hit)!;
      dragRef.current = { id: hit, startY: e.clientY, origValue: p.value, startX: e.clientX, origBar: p.bar };
    } else {
      // Add point
      const { bar, value } = clientToBarValue(e.clientX, e.clientY);
      const newPt: AutoPoint = { id: `ap-${Date.now()}`, bar: Math.round(bar * 4) / 4, value: +value.toFixed(3) };
      onChange([...points, newPt]);
    }
  }, [hitPoint, clientToBarValue, points, onChange]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newBar   = Math.max(0, Math.min(totalBars, drag.origBar + (e.clientX - drag.startX) / pxPerBar));
    const newValue = Math.max(0, Math.min(1, drag.origValue - (e.clientY - drag.startY) / AUTO_LANE_H));
    onChange(points.map(p => p.id === drag.id
      ? { ...p, bar: Math.round(newBar * 4) / 4, value: +newValue.toFixed(3) }
      : p
    ));
  }, [points, onChange, pxPerBar, totalBars]);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const hit = hitPoint(e.clientX, e.clientY);
    if (hit) onChange(points.filter(p => p.id !== hit));
  }, [hitPoint, points, onChange]);

  const paramLabel = param === 'volume' ? 'Vol' : 'Pan';

  return (
    <div className="relative flex-shrink-0 border-t border-white/[0.04]" style={{ height: AUTO_LANE_H, width }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: 'crosshair', width, height: AUTO_LANE_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={onContextMenu}
      />
      {/* Label */}
      <div className="absolute top-1 right-2 text-[9px] font-mono text-gray-700 pointer-events-none uppercase tracking-widest">
        Auto / {paramLabel}
      </div>
    </div>
  );
}

export default AutomationLane;
