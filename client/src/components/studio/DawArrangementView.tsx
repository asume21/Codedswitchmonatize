/**
 * DawArrangementView — CodedSwitch professional DAW timeline (v2)
 *
 * Features:
 *  • Clip drag (move along timeline with pointer capture)
 *  • Clip resize (right-edge drag)
 *  • Track rename (double-click name label)
 *  • Track color (click swatch → native color picker)
 *  • Per-track volume fader + pan in header
 *  • Expandable FX strip (volume, pan, send A, send B)
 *  • Mini MIDI note canvas in clips
 *  • Playhead follows TransportContext.position
 *  • Auto-scroll during playback
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useTracks, type StudioTrack } from '@/hooks/useTracks';
import { useTransport } from '@/contexts/TransportContext';
import { useStudioStore } from '@/stores/useStudioStore';
import {
  Plus, ChevronRight, ChevronDown, ZoomIn, ZoomOut, Mic2, Piano,
  Layers, Music2, Drum, Trash2, Settings2, GripVertical, Sliders, Repeat,
} from 'lucide-react';
import { SectionMarkers } from './SectionMarkers';
import { cn } from '@/lib/utils';

// ── Layout ────────────────────────────────────────────────────────────────────
const HEADER_W    = 212;
const ROW_H       = 78;      // collapsed track height
const FX_H        = 84;      // extra height when FX strip is open
const RULER_H     = 32;
const BASE_PX_BAR = 112;
const MIN_ZOOM    = 0.25;
const MAX_ZOOM    = 6;

// ── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = [
  { base: '#06b6d4', dim: 'rgba(6,182,212,0.16)',  glow: 'rgba(6,182,212,0.5)'  },
  { base: '#8b5cf6', dim: 'rgba(139,92,246,0.16)', glow: 'rgba(139,92,246,0.5)' },
  { base: '#ec4899', dim: 'rgba(236,72,153,0.16)', glow: 'rgba(236,72,153,0.5)' },
  { base: '#22c55e', dim: 'rgba(34,197,94,0.16)',  glow: 'rgba(34,197,94,0.5)'  },
  { base: '#f59e0b', dim: 'rgba(245,158,11,0.16)', glow: 'rgba(245,158,11,0.5)' },
  { base: '#f97316', dim: 'rgba(249,115,22,0.16)', glow: 'rgba(249,115,22,0.5)' },
  { base: '#3b82f6', dim: 'rgba(59,130,246,0.16)', glow: 'rgba(59,130,246,0.5)' },
  { base: '#14b8a6', dim: 'rgba(20,184,166,0.16)', glow: 'rgba(20,184,166,0.5)' },
];

interface Swatch { base: string; dim: string; glow: string; }

function resolveColor(track: StudioTrack, idx: number): Swatch {
  const userColor = (track as any).color as string | undefined;
  if (userColor) return { base: userColor, dim: `${userColor}28`, glow: `${userColor}70` };
  const kind = (track as any).kind as string;
  if (kind === 'beat')  return PALETTE[5];
  if (kind === 'vocal') return PALETTE[2];
  if (kind === 'piano') return PALETTE[0];
  return PALETTE[idx % PALETTE.length];
}

// ── KindIcon ──────────────────────────────────────────────────────────────────
function KindIcon({ kind }: { kind: string }) {
  if (kind === 'beat')  return <Drum   className="w-3 h-3" />;
  if (kind === 'vocal') return <Mic2   className="w-3 h-3" />;
  if (kind === 'piano') return <Piano  className="w-3 h-3" />;
  if (kind === 'midi')  return <Music2 className="w-3 h-3" />;
  return <Layers className="w-3 h-3" />;
}

// ── Mini MIDI note canvas ─────────────────────────────────────────────────────
function MiniNoteCanvas({
  notes, width, height, color,
}: { notes: any[]; width: number; height: number; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !notes.length || width < 2 || height < 2) return;
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const steps = notes.map(n => n.step  ?? 0);
    const ends  = notes.map(n => (n.step ?? 0) + (n.length ?? 1));
    const octs  = notes.map(n => n.octave ?? 4);
    const minS  = Math.min(...steps);
    const maxE  = Math.max(...ends);
    const minO  = Math.min(...octs);
    const maxO  = Math.max(...octs);
    const spanS = Math.max(1, maxE - minS);
    const spanO = Math.max(1, maxO - minO + 1);

    ctx.fillStyle = color;
    for (const n of notes) {
      const x = ((n.step - minS) / spanS) * width;
      const w = Math.max(2, ((n.length ?? 1) / spanS) * width - 1);
      const yF = maxO === minO ? 0.5 : 1 - (n.octave - minO) / spanO;
      const y  = yF * (height - 5) + 2;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(x, y, w, 3);
    }
  }, [notes, width, height, color]);

  return <canvas ref={ref} style={{ width, height, display: 'block' }} />;
}

// ── Drag state (kept in a ref to avoid re-renders during drag) ────────────────
interface DragState {
  type: 'move' | 'resize';
  trackId: string;
  startClientX: number;
  originalValue: number;   // startBar (move) or lengthBars (resize)
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface DawArrangementViewProps {
  onOpenEditor?: (trackId: string, view: 'piano-roll' | 'beat-lab' | 'lyrics') => void;
  onAddTrack?: (name: string, type: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DawArrangementView({ onOpenEditor, onAddTrack }: DawArrangementViewProps) {
  const { tracks, updateTrack, removeTrack } = useTracks();
  const { position, tempo, isPlaying, setLoop, clearLoop } = useTransport();
  const loop    = useStudioStore(s => s.loop);
  // Loop region in BARS (4 beats per bar)
  const loopStartBar = loop.enabled ? loop.start / 4 : null;
  const loopEndBar   = loop.enabled ? loop.end   / 4 : null;

  const [zoom,       setZoom]       = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playheadBar, setPlayheadBar] = useState(0);
  const [expandedFx, setExpandedFx] = useState<Set<string>>(new Set());
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');
  // Loop region drag on ruler
  const loopDragRef = useRef<{ startClientX: number; startBar: number } | null>(null);

  // Local drag overrides (startBar / lengthBars while dragging, not yet committed)
  const [localPos, setLocalPos] = useState<Record<string, { startBar?: number; lengthBars?: number }>>({});
  const dragRef = useRef<DragState | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const colorTargetId = useRef<string | null>(null);

  const outerRef = useRef<HTMLDivElement>(null);
  const pxPerBar = BASE_PX_BAR * zoom;

  // Transport position → bars (4/4 assumed)
  useEffect(() => { setPlayheadBar(position / 4); }, [position]);

  // Auto-scroll playhead
  useEffect(() => {
    if (!isPlaying || !outerRef.current) return;
    const el = outerRef.current;
    const phPx = HEADER_W + playheadBar * pxPerBar;
    if (phPx > el.scrollLeft + el.clientWidth - 80) {
      el.scrollLeft = phPx - el.clientWidth * 0.25;
    }
  }, [isPlaying, playheadBar, pxPerBar]);

  const totalBars = useMemo(() => {
    if (!tracks.length) return 32;
    const max = Math.max(
      ...tracks.map(t => ((t as any).startBar ?? 0) + ((t as any).lengthBars ?? 8))
    );
    return Math.max(32, max + 16);
  }, [tracks]);

  const totalW = totalBars * pxPerBar;

  // Row height helper (expanded FX = bigger)
  const rowH = useCallback((id: string) =>
    expandedFx.has(id) ? ROW_H + FX_H : ROW_H, [expandedFx]);

  // Effective clip position (uses localPos during drag)
  const clipStart = (track: StudioTrack) =>
    localPos[track.id]?.startBar ?? (track as any).startBar ?? 0;
  const clipLen = (track: StudioTrack) =>
    localPos[track.id]?.lengthBars ?? (track as any).lengthBars ?? 8;

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const startDrag = useCallback((
    e: React.PointerEvent,
    type: DragState['type'],
    track: StudioTrack,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const originalValue = type === 'move' ? clipStart(track) : clipLen(track);
    dragRef.current = { type, trackId: track.id, startClientX: e.clientX, originalValue };
  }, [clipStart, clipLen]);

  const onDragMove = useCallback((e: React.PointerEvent, track: StudioTrack) => {
    const drag = dragRef.current;
    if (!drag || drag.trackId !== track.id) return;
    const dx       = e.clientX - drag.startClientX;
    const deltaBars = dx / pxPerBar;
    if (drag.type === 'move') {
      const newStart = Math.max(0, Math.round(drag.originalValue + deltaBars));
      setLocalPos(p => ({ ...p, [track.id]: { ...p[track.id], startBar: newStart } }));
    } else {
      const newLen = Math.max(1, Math.round(drag.originalValue + deltaBars));
      setLocalPos(p => ({ ...p, [track.id]: { ...p[track.id], lengthBars: newLen } }));
    }
  }, [pxPerBar]);

  const onDragEnd = useCallback((e: React.PointerEvent, track: StudioTrack) => {
    const drag = dragRef.current;
    if (!drag || drag.trackId !== track.id) return;
    dragRef.current = null;
    const override = localPos[track.id] ?? {};
    if (drag.type === 'move' && override.startBar !== undefined) {
      updateTrack(track.id, { startBar: override.startBar } as any);
    } else if (drag.type === 'resize' && override.lengthBars !== undefined) {
      updateTrack(track.id, { lengthBars: override.lengthBars } as any);
    }
    setLocalPos(p => { const n = { ...p }; delete n[track.id]; return n; });
  }, [localPos, updateTrack]);

  // ── Rename ──────────────────────────────────────────────────────────────────
  const startRename = useCallback((track: StudioTrack) => {
    setEditingId(track.id);
    setEditName(track.name);
  }, []);

  const commitRename = useCallback((track: StudioTrack) => {
    if (editName.trim()) updateTrack(track.id, { name: editName.trim() } as any);
    setEditingId(null);
  }, [editName, updateTrack]);

  // ── Color picker ─────────────────────────────────────────────────────────────
  const openColorPicker = useCallback((trackId: string) => {
    colorTargetId.current = trackId;
    colorInputRef.current?.click();
  }, []);

  const onColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const id = colorTargetId.current;
    if (!id) return;
    updateTrack(id, { color: e.target.value } as any);
  }, [updateTrack]);

  // ── Open editor ─────────────────────────────────────────────────────────────
  const openEditor = useCallback((track: StudioTrack) => {
    if (!onOpenEditor) return;
    const kind = (track as any).kind as string;
    onOpenEditor(
      track.id,
      kind === 'beat' ? 'beat-lab' : kind === 'vocal' ? 'lyrics' : 'piano-roll'
    );
  }, [onOpenEditor]);

  // ── Ruler memo ───────────────────────────────────────────────────────────────
  const rulerMarks = useMemo(() =>
    Array.from({ length: totalBars }, (_, bar) => {
      const isMajor = bar % 4 === 0;
      return (
        <React.Fragment key={bar}>
          <div
            className="absolute top-0 bottom-0 w-px pointer-events-none"
            style={{ left: bar * pxPerBar, backgroundColor: isMajor ? 'rgba(6,182,212,0.14)' : 'rgba(255,255,255,0.04)' }}
          />
          <div className="absolute top-0 bottom-0 flex items-end pb-1 select-none pointer-events-none"
            style={{ left: bar * pxPerBar, width: pxPerBar }}
          >
            <span className={cn('ml-1 text-[10px] font-mono', isMajor ? 'text-cyan-400/70 font-semibold' : 'text-gray-800')}>
              {bar + 1}
            </span>
          </div>
          {pxPerBar > 50 && [1, 2, 3].map(b => (
            <div key={b} className="absolute bottom-0 w-px pointer-events-none"
              style={{ left: bar * pxPerBar + b * (pxPerBar / 4), height: b === 2 ? 7 : 4, backgroundColor: 'rgba(255,255,255,0.08)' }}
            />
          ))}
        </React.Fragment>
      );
    }), [totalBars, pxPerBar]);

  const playheadLeft = HEADER_W + playheadBar * pxPerBar;

  return (
    <div className="flex flex-col h-full bg-[#06080f] overflow-hidden">

      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06]">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-500/40">Arrangement</span>

        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}
            className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-white transition-colors" title="Zoom out">
            <ZoomOut className="w-3 h-3" />
          </button>
          <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.05} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-20 h-1 accent-cyan-400 cursor-pointer" />
          <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}
            className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-white transition-colors" title="Zoom in">
            <ZoomIn className="w-3 h-3" />
          </button>
        </div>

        <div className="w-px h-4 bg-white/10 mx-1" />

        <button onClick={() => onAddTrack?.('New Track', 'midi')}
          className="flex items-center gap-1 px-2.5 py-1 rounded border border-cyan-500/20 bg-cyan-500/8 hover:bg-cyan-500/20 hover:border-cyan-400/40 text-[11px] text-cyan-400/70 hover:text-cyan-100 transition-all">
          <Plus className="w-3 h-3" /> Add Track
        </button>

        {/* Loop toggle */}
        <button
          onClick={() => loop.enabled ? clearLoop() : setLoop({ enabled: true, start: 0, end: 8 })}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] transition-all',
            loop.enabled
              ? 'border-green-500/50 bg-green-500/20 text-green-300 hover:bg-green-500/30'
              : 'border-white/10 bg-white/5 text-gray-600 hover:text-green-400 hover:border-green-500/30'
          )}
          title={loop.enabled ? 'Disable loop (drag on ruler to set region)' : 'Enable loop — then drag on the ruler to set region'}
        >
          <Repeat className="w-3 h-3" />
          {loop.enabled ? `Loop ${loopStartBar?.toFixed(1)}–${loopEndBar?.toFixed(1)} bars` : 'Loop'}
        </button>

        <div className="ml-auto font-mono text-[10px] text-gray-700">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''} · {tempo} BPM
        </div>
      </div>

      {/* Hidden color input — triggered programmatically */}
      <input ref={colorInputRef} type="color" className="sr-only" onChange={onColorChange} />

      {/* ── Main scrollable viewport ──────────────────────────────────────────── */}
      <div ref={outerRef} className="flex-1 overflow-auto relative">
        {/* Inner logical canvas */}
        <div className="relative" style={{ width: HEADER_W + totalW, minHeight: 200 }}>

          {/* ── Sticky ruler row ────────────────────────────────────────────────── */}
          <div className="sticky top-0 z-30 flex flex-shrink-0" style={{ height: RULER_H }}>
            <div className="sticky left-0 z-10 flex-shrink-0 flex items-end pb-1 px-3 border-r border-b border-white/[0.06]"
              style={{ width: HEADER_W, backgroundColor: '#06080f' }}>
              <span className="text-[9px] font-mono text-gray-800 uppercase tracking-widest">Bars</span>
            </div>
            <div className="relative flex-1 border-b border-white/[0.06] overflow-hidden"
              style={{ width: totalW, backgroundColor: '#07090e', cursor: 'crosshair' }}
              onPointerDown={e => {
                if (!loop.enabled) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const barX = Math.max(0, Math.floor((e.clientX - rect.left) / pxPerBar));
                loopDragRef.current = { startClientX: e.clientX, startBar: barX };
                e.currentTarget.setPointerCapture(e.pointerId);
                setLoop({ enabled: true, start: barX * 4, end: (barX + 2) * 4 });
              }}
              onPointerMove={e => {
                if (!loopDragRef.current || !loop.enabled) return;
                const dx = e.clientX - loopDragRef.current.startClientX;
                const deltaBars = dx / pxPerBar;
                const s = loopDragRef.current.startBar;
                const endBar = Math.max(s + 1, Math.round(s + deltaBars));
                setLoop({ enabled: true, start: s * 4, end: endBar * 4 });
              }}
              onPointerUp={() => { loopDragRef.current = null; }}
            >
              {rulerMarks}
              {/* Section markers */}
              <SectionMarkers
                pxPerBar={pxPerBar}
                headerWidth={0}
                rulerHeight={RULER_H}
              />
              {/* Loop region highlight on ruler */}
              {loop.enabled && loopStartBar !== null && loopEndBar !== null && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left:            loopStartBar * pxPerBar,
                    width:           (loopEndBar - loopStartBar) * pxPerBar,
                    backgroundColor: 'rgba(34,197,94,0.15)',
                    borderLeft:      '2px solid rgba(34,197,94,0.6)',
                    borderRight:     '2px solid rgba(34,197,94,0.6)',
                  }}
                />
              )}
            </div>
          </div>

          {/* ── Track rows ────────────────────────────────────────────────────────── */}
          {tracks.map((track, i) => {
            const color      = resolveColor(track, i);
            const isSelected = selectedId === track.id;
            const isFxOpen   = expandedFx.has(track.id);
            const rh         = rowH(track.id);
            const start      = clipStart(track);
            const len        = clipLen(track);
            const clipW      = Math.max(pxPerBar, len * pxPerBar);
            const notes      = (track as any).notes ?? [];
            const innerH     = ROW_H - 14;   // clip visual height within ROW_H portion
            const vol        = (track as any).volume ?? 0.8;
            const pan        = (track as any).pan    ?? 0;
            const sendA      = (track as any).sendA  ?? -60;
            const sendB      = (track as any).sendB  ?? -60;

            return (
              <div key={track.id} className="flex"
                style={{ height: rh, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onClick={() => setSelectedId(track.id)}
              >

                {/* ── Sticky track header ───────────────────────────────────────── */}
                <div
                  className={cn(
                    'sticky left-0 z-20 flex-shrink-0 flex flex-col group relative cursor-pointer transition-colors',
                    isSelected ? 'bg-white/[0.05]' : 'bg-[#06080f] hover:bg-white/[0.025]'
                  )}
                  style={{ width: HEADER_W, height: rh, borderRight: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {/* ── Main header row (ROW_H tall) ─────────────────────────── */}
                  <div className="flex items-center gap-1.5 px-2 relative" style={{ height: ROW_H }}>
                    {/* Track color strip — click to change color */}
                    <button
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full hover:w-[5px] transition-all"
                      style={{ backgroundColor: color.base }}
                      onClick={e => { e.stopPropagation(); openColorPicker(track.id); }}
                      title="Change track color"
                    />

                    {/* Kind icon */}
                    <div className="ml-2 w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: color.dim, border: `1px solid ${color.base}45`, color: color.base }}>
                      <KindIcon kind={(track as any).kind ?? 'midi'} />
                    </div>

                    {/* Name (editable) */}
                    <div className="flex-1 min-w-0">
                      {editingId === track.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onBlur={() => commitRename(track)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitRename(track);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-transparent border-b border-cyan-400 text-[11px] text-cyan-100 outline-none font-medium"
                        />
                      ) : (
                        <div
                          className="text-[11px] font-medium text-gray-200 truncate leading-tight"
                          onDoubleClick={e => { e.stopPropagation(); startRename(track); }}
                          title="Double-click to rename"
                        >
                          {track.name}
                        </div>
                      )}
                      {(track as any).instrument && (
                        <div className="text-[9px] text-gray-600 truncate">{(track as any).instrument}</div>
                      )}
                    </div>

                    {/* Control buttons (visible on hover) */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); updateTrack(track.id, { muted: !(track as any).muted } as any); }}
                        className={cn('w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-colors',
                          (track as any).muted ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-500 hover:text-white')}
                        title="Mute"
                      >M</button>
                      <button
                        onClick={e => { e.stopPropagation(); updateTrack(track.id, { solo: !(track as any).solo } as any); }}
                        className={cn('w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-colors',
                          (track as any).solo ? 'bg-yellow-400 text-black' : 'bg-white/10 text-gray-500 hover:text-white')}
                        title="Solo"
                      >S</button>
                      <button
                        onClick={e => { e.stopPropagation(); openEditor(track); }}
                        className="w-5 h-5 rounded bg-white/10 text-gray-500 hover:text-cyan-400 flex items-center justify-center transition-colors"
                        title="Open in editor"
                      ><ChevronRight className="w-3 h-3" /></button>
                      <button
                        onClick={e => { e.stopPropagation(); setExpandedFx(s => { const n = new Set(s); n.has(track.id) ? n.delete(track.id) : n.add(track.id); return n; }); }}
                        className={cn('w-5 h-5 rounded flex items-center justify-center transition-colors',
                          isFxOpen ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-gray-500 hover:text-cyan-400')}
                        title="FX strip"
                      ><Sliders className="w-2.5 h-2.5" /></button>
                      <button
                        onClick={e => { e.stopPropagation(); removeTrack(track.id); }}
                        className="w-5 h-5 rounded bg-white/10 text-gray-600 hover:text-red-400 flex items-center justify-center transition-colors"
                        title="Delete"
                      ><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  </div>

                  {/* ── FX strip (expanded) ─────────────────────────────────── */}
                  {isFxOpen && (
                    <div className="px-3 py-2 border-t border-white/[0.06] bg-black/40"
                      style={{ height: FX_H }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-2 gap-2 h-full">
                        {/* Volume */}
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-gray-600 uppercase tracking-widest">Vol</label>
                          <input type="range" min={0} max={1} step={0.01} value={vol}
                            onChange={e => updateTrack(track.id, { volume: Number(e.target.value) } as any)}
                            className="w-full h-1 accent-cyan-400 cursor-pointer" />
                          <span className="text-[9px] font-mono text-gray-600">{Math.round(vol * 100)}%</span>
                        </div>
                        {/* Pan */}
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-gray-600 uppercase tracking-widest">Pan</label>
                          <input type="range" min={-1} max={1} step={0.01} value={pan}
                            onChange={e => updateTrack(track.id, { pan: Number(e.target.value) } as any)}
                            className="w-full h-1 accent-violet-400 cursor-pointer" />
                          <span className="text-[9px] font-mono text-gray-600">
                            {pan === 0 ? 'C' : pan > 0 ? `R${Math.round(pan * 100)}` : `L${Math.round(-pan * 100)}`}
                          </span>
                        </div>
                        {/* Send A */}
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-gray-600 uppercase tracking-widest">Hall</label>
                          <input type="range" min={-60} max={0} step={1} value={sendA}
                            onChange={e => updateTrack(track.id, { sendA: Number(e.target.value) } as any)}
                            className="w-full h-1 accent-blue-400 cursor-pointer" />
                          <span className="text-[9px] font-mono text-gray-600">{sendA <= -60 ? '—' : `${sendA}dB`}</span>
                        </div>
                        {/* Send B */}
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[9px] text-gray-600 uppercase tracking-widest">Delay</label>
                          <input type="range" min={-60} max={0} step={1} value={sendB}
                            onChange={e => updateTrack(track.id, { sendB: Number(e.target.value) } as any)}
                            className="w-full h-1 accent-purple-400 cursor-pointer" />
                          <span className="text-[9px] font-mono text-gray-600">{sendB <= -60 ? '—' : `${sendB}dB`}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Clip lane ─────────────────────────────────────────────────── */}
                <div className="relative flex-shrink-0"
                  style={{ width: totalW, height: rh, backgroundColor: isSelected ? 'rgba(255,255,255,0.008)' : 'transparent' }}
                >
                  {/* Grid lines */}
                  {Array.from({ length: totalBars }, (_, bar) => bar % 4 === 0 && (
                    <div key={bar} className="absolute top-0 bottom-0 w-px pointer-events-none"
                      style={{ left: bar * pxPerBar, backgroundColor: 'rgba(6,182,212,0.06)' }}
                    />
                  ))}

                  {/* ── Clip block (draggable + resizable) ─────────────────────── */}
                  <div
                    className={cn(
                      'absolute rounded overflow-hidden touch-none select-none',
                      'hover:brightness-110 active:cursor-grabbing'
                    )}
                    style={{
                      left:            start * pxPerBar,
                      width:           Math.max(18, clipW),
                      height:          innerH,
                      top:             6,
                      backgroundColor: color.dim,
                      border:         `1px solid ${color.base}50`,
                      boxShadow:       isSelected ? `0 0 0 1px ${color.base}, 0 0 14px ${color.glow}` : undefined,
                      cursor:          dragRef.current?.trackId === track.id && dragRef.current?.type === 'move' ? 'grabbing' : 'grab',
                    }}
                    onPointerDown={e => startDrag(e, 'move', track)}
                    onPointerMove={e => onDragMove(e, track)}
                    onPointerUp={e => onDragEnd(e, track)}
                    onDoubleClick={e => { e.stopPropagation(); openEditor(track); }}
                  >
                    {/* Top accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: color.base }} />

                    {/* Track name */}
                    <div className="absolute top-1.5 left-2 text-[10px] font-semibold pointer-events-none truncate"
                      style={{ color: color.base, maxWidth: clipW - 30, opacity: 0.9 }}>
                      {track.name}
                    </div>

                    {/* Mini note canvas */}
                    {notes.length > 0 && clipW > 16 && (
                      <div className="absolute left-0 right-0 bottom-1" style={{ top: 20 }}>
                        <MiniNoteCanvas
                          notes={notes}
                          width={Math.max(2, clipW - 2)}
                          height={Math.max(8, innerH - 24)}
                          color={color.base}
                        />
                      </div>
                    )}

                    {/* Empty hint */}
                    {notes.length === 0 && (track as any).type !== 'audio' && clipW > 60 && (
                      <div className="absolute inset-0 top-5 flex items-center justify-center text-[9px] pointer-events-none"
                        style={{ color: color.base, opacity: 0.22 }}>
                        double-click to edit
                      </div>
                    )}

                    {/* Resize handle (right edge) */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-ew-resize"
                      style={{ backgroundColor: `${color.base}18`, cursor: 'ew-resize' }}
                      onPointerDown={e => { e.stopPropagation(); startDrag(e, 'resize', track); }}
                      onPointerMove={e => onDragMove(e, track)}
                      onPointerUp={e => onDragEnd(e, track)}
                    >
                      <GripVertical className="w-2 h-2 rotate-90 opacity-40" style={{ color: color.base }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Add track row ────────────────────────────────────────────────────── */}
          <div
            onClick={() => onAddTrack?.('New Track', 'midi')}
            className="sticky left-0 flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-cyan-500/5 border-t border-cyan-500/10 transition-colors"
            style={{ width: HEADER_W, backgroundColor: '#06080f' }}
          >
            <Plus className="w-3 h-3 text-cyan-500/40" />
            <span className="text-[11px] text-cyan-500/40 hover:text-cyan-400 transition-colors">Add Track</span>
          </div>

          {/* ── Empty state ───────────────────────────────────────────────────────── */}
          {tracks.length === 0 && (
            <div className="absolute flex flex-col items-center justify-center gap-4"
              style={{ left: HEADER_W, right: 0, top: RULER_H, bottom: 0 }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)' }}>
                <Layers className="w-6 h-6 text-cyan-500/40" />
              </div>
              <p className="text-[11px] text-gray-700 text-center">
                No tracks yet.<br />Create something in Beat Lab or Piano Roll,<br />or click Add Track.
              </p>
              <button onClick={() => onAddTrack?.('New Track', 'midi')}
                className="px-4 py-2 rounded border border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs text-cyan-400 hover:text-cyan-100 transition-all">
                + Add Track
              </button>
            </div>
          )}

          {/* ── Loop region shading over track lanes ────────────────────────────── */}
          {loop.enabled && loopStartBar !== null && loopEndBar !== null && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left:   HEADER_W + loopStartBar * pxPerBar,
                width:  (loopEndBar - loopStartBar) * pxPerBar,
                top:    RULER_H,
                bottom: 0,
                backgroundColor: 'rgba(34,197,94,0.06)',
                borderLeft:  '1px solid rgba(34,197,94,0.35)',
                borderRight: '1px solid rgba(34,197,94,0.35)',
              }}
            />
          )}

          {/* ── Playhead ─────────────────────────────────────────────────────────── */}
          <div className="absolute top-0 bottom-0 pointer-events-none z-40"
            style={{
              left:            playheadLeft,
              width:           1,
              backgroundColor: '#06b6d4',
              boxShadow:       '0 0 6px rgba(6,182,212,0.9), 0 0 18px rgba(6,182,212,0.35)',
            }}
          >
            <div className="absolute -top-0.5 -translate-x-1/2"
              style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #06b6d4', filter: 'drop-shadow(0 0 4px rgba(6,182,212,0.9))' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DawArrangementView;
