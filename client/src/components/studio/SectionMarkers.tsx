/**
 * SectionMarkers — Arrangement song-section labels on the DAW ruler
 *
 * Renders colored labels (Intro / Verse / Chorus / Bridge / Outro / Custom)
 * on the arrangement timeline ruler. Double-click the ruler to add a marker,
 * click a marker to rename it, drag it to move it.
 *
 * Includes a song-end marker (red) and section navigation buttons.
 *
 * State is stored in useStudioStore (persisted via Zustand persist).
 */

import React, { useState, useCallback, useRef } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { useStudioStore, type SectionMarker } from '@/stores/useStudioStore';
import { useTransport } from '@/contexts/TransportContext';

export type { SectionMarker };

const PRESETS = [
  { label: 'Intro',   color: '#06b6d4' },
  { label: 'Verse',   color: '#8b5cf6' },
  { label: 'Pre',     color: '#f59e0b' },
  { label: 'Chorus',  color: '#ec4899' },
  { label: 'Bridge',  color: '#22c55e' },
  { label: 'Outro',   color: '#f97316' },
];

interface SectionMarkersProps {
  pxPerBar: number;
  headerWidth: number;    // HEADER_W offset for track headers
  rulerHeight: number;
  beatsPerBar?: number;   // from time signature (default 4)
}

export function SectionMarkers({ pxPerBar, headerWidth, rulerHeight, beatsPerBar = 4 }: SectionMarkersProps) {
  const sectionMarkers = useStudioStore((s) => s.sectionMarkers ?? []);
  const setSectionMarkers = useStudioStore((s) => s.setSectionMarkers);
  const songEndBeat = useStudioStore((s) => s.songEndBeat);
  const setSongEnd = useStudioStore((s) => s.setSongEnd);
  const { seek, position } = useTransport();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showAdd, setShowAdd]     = useState(false);
  const [pendingBar, setPendingBar] = useState(0);
  const dragRef = useRef<{ id: string; startClientX: number; origBeat: number } | null>(null);
  const endDragRef = useRef<{ startClientX: number; origBeat: number } | null>(null);

  const pxPerBeat = pxPerBar / beatsPerBar;

  const addMarker = useCallback((bar: number, preset?: typeof PRESETS[0]) => {
    const p = preset ?? PRESETS[0];
    const marker: SectionMarker = {
      id: `m-${Date.now()}`,
      label: p.label,
      beat: bar * beatsPerBar,
      color: p.color,
      type: 'section',
    };
    setSectionMarkers([...sectionMarkers, marker]);
    setShowAdd(false);
  }, [sectionMarkers, setSectionMarkers, beatsPerBar]);

  const removeMarker = useCallback((id: string) => {
    setSectionMarkers(sectionMarkers.filter(x => x.id !== id));
  }, [sectionMarkers, setSectionMarkers]);

  const startRename = useCallback((marker: SectionMarker) => {
    setEditingId(marker.id);
    setEditLabel(marker.label);
  }, []);

  const commitRename = useCallback((id: string, label: string) => {
    setSectionMarkers(sectionMarkers.map(x =>
      x.id === id ? { ...x, label: label.trim() || x.label } : x
    ));
    setEditingId(null);
  }, [sectionMarkers, setSectionMarkers]);

  // ── Section navigation ──
  const sortedMarkers = [...sectionMarkers].sort((a, b) => a.beat - b.beat);

  const goToPrevSection = useCallback(() => {
    const prev = sortedMarkers.filter(m => m.beat < position - 0.1);
    if (prev.length > 0) {
      seek(prev[prev.length - 1].beat);
    } else {
      seek(0);
    }
  }, [sortedMarkers, position, seek]);

  const goToNextSection = useCallback(() => {
    const next = sortedMarkers.filter(m => m.beat > position + 0.1);
    if (next.length > 0) {
      seek(next[0].beat);
    }
  }, [sortedMarkers, position, seek]);

  return (
    <>
      {/* Section navigation buttons (top-left of ruler area) */}
      <div
        className="absolute z-50 flex items-center gap-0.5"
        style={{ left: headerWidth - 50, top: 2 }}
      >
        <button
          onClick={goToPrevSection}
          className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-cyan-400 transition-colors"
          title="Previous section"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button
          onClick={goToNextSection}
          className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-cyan-400 transition-colors"
          title="Next section"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Render each marker as an absolute-positioned chip on the ruler */}
      {sectionMarkers.map(marker => {
        const left = headerWidth + marker.beat * pxPerBeat;

        return (
          <div
            key={marker.id}
            className="absolute top-0 z-50 flex items-center group select-none"
            style={{ left, top: 0, height: rulerHeight }}
          >
            {/* Vertical guide line */}
            <div
              className="absolute top-0 bottom-0 w-px pointer-events-none"
              style={{ backgroundColor: marker.color, opacity: 0.8 }}
            />

            {/* Label chip */}
            <div
              className="relative ml-0.5 flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 cursor-grab active:cursor-grabbing"
              style={{ backgroundColor: `${marker.color}22`, border: `1px solid ${marker.color}55` }}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = { id: marker.id, startClientX: e.clientX, origBeat: marker.beat };
              }}
              onPointerMove={e => {
                if (!dragRef.current || dragRef.current.id !== marker.id) return;
                const dx = e.clientX - dragRef.current.startClientX;
                const newBeat = Math.max(0, Math.round((dragRef.current.origBeat + dx / pxPerBeat) / beatsPerBar) * beatsPerBar);
                setSectionMarkers(sectionMarkers.map(x =>
                  x.id === marker.id ? { ...x, beat: newBeat } : x
                ));
              }}
              onPointerUp={() => { dragRef.current = null; }}
              onDoubleClick={() => startRename(marker)}
              onClick={() => seek(marker.beat)}
            >
              {editingId === marker.id ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onBlur={() => commitRename(marker.id, editLabel)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(marker.id, editLabel);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  className="bg-transparent outline-none text-[10px] font-bold w-16"
                  style={{ color: marker.color }}
                />
              ) : (
                <span className="text-[10px] font-bold leading-none whitespace-nowrap" style={{ color: marker.color }}>
                  {marker.label}
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); removeMarker(marker.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-gray-600 hover:text-red-400"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Song End Marker (red flag) ── */}
      <div
        className="absolute top-0 z-50 flex items-center group select-none"
        style={{ left: headerWidth + songEndBeat * pxPerBeat, top: 0, height: rulerHeight }}
      >
        {/* Red vertical line extending full height */}
        <div
          className="absolute top-0 w-0.5 pointer-events-none"
          style={{ backgroundColor: '#ef4444', opacity: 0.9, height: '200vh' }}
        />
        {/* Draggable end flag */}
        <div
          className="relative ml-0.5 flex items-center gap-0.5 rounded-sm px-1 py-0.5 cursor-ew-resize"
          style={{ backgroundColor: '#ef444422', border: '1px solid #ef444455' }}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            endDragRef.current = { startClientX: e.clientX, origBeat: songEndBeat };
          }}
          onPointerMove={e => {
            if (!endDragRef.current) return;
            const dx = e.clientX - endDragRef.current.startClientX;
            const newBeat = Math.max(beatsPerBar, Math.round((endDragRef.current.origBeat + dx / pxPerBeat) / beatsPerBar) * beatsPerBar);
            setSongEnd(newBeat, 'manual');
          }}
          onPointerUp={() => { endDragRef.current = null; }}
          title={`Song end: bar ${Math.round(songEndBeat / beatsPerBar)}`}
        >
          <Flag className="w-2.5 h-2.5 text-red-400" />
          <span className="text-[9px] font-bold text-red-400 leading-none whitespace-nowrap">
            END
          </span>
        </div>
      </div>

      {/* Quick-add popup */}
      {showAdd && (
        <div
          className="absolute z-50 bg-[#06080f] border border-cyan-500/30 rounded-lg shadow-xl p-2 flex flex-col gap-1"
          style={{ left: headerWidth + pendingBar * pxPerBar + 8, top: rulerHeight + 2 }}
        >
          <div className="text-[9px] font-mono text-gray-600 uppercase mb-1">Add section at bar {pendingBar + 1}</div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => addMarker(pendingBar, p)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold hover:opacity-80 transition-opacity"
                style={{ backgroundColor: `${p.color}25`, border: `1px solid ${p.color}50`, color: p.color }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAdd(false)} className="text-[9px] text-gray-700 hover:text-gray-400 mt-1">cancel</button>
        </div>
      )}

      {/* Invisible overlay on ruler to catch double-click for new marker */}
      <div
        className="absolute inset-0 z-30"
        onDoubleClick={e => {
          const x = e.clientX - laneRect(e);
          const bar = Math.floor((x - headerWidth) / pxPerBar);
          if (bar < 0) return;
          setPendingBar(bar);
          setShowAdd(true);
        }}
        style={{ pointerEvents: 'auto' }}
      />
    </>
  );
}

// Helper: get left offset of the event's target element
function laneRect(e: React.MouseEvent): number {
  const el = e.currentTarget as HTMLElement;
  return el.getBoundingClientRect().left;
}

export default SectionMarkers;
