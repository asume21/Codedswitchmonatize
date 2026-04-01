/**
 * SectionMarkers — Arrangement song-section labels on the DAW ruler
 *
 * Renders colored labels (Intro / Verse / Chorus / Bridge / Outro / Custom)
 * on the arrangement timeline ruler. Double-click the ruler to add a marker,
 * click a marker to rename it, drag it to move it.
 *
 * State is persisted to localStorage as a simple JSON array.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionMarker {
  id: string;
  label: string;
  bar: number;       // position in bars (0-based)
  color: string;     // hex
}

const PRESETS = [
  { label: 'Intro',   color: '#06b6d4' },
  { label: 'Verse',   color: '#8b5cf6' },
  { label: 'Pre',     color: '#f59e0b' },
  { label: 'Chorus',  color: '#ec4899' },
  { label: 'Bridge',  color: '#22c55e' },
  { label: 'Outro',   color: '#f97316' },
];

const STORAGE_KEY = 'cs:section-markers';

function loadMarkers(): SectionMarker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMarkers(markers: SectionMarker[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(markers)); } catch {}
}

interface SectionMarkersProps {
  pxPerBar: number;
  headerWidth: number;    // HEADER_W offset for track headers
  rulerHeight: number;
}

export function SectionMarkers({ pxPerBar, headerWidth, rulerHeight }: SectionMarkersProps) {
  const [markers, setMarkers]     = useState<SectionMarker[]>(loadMarkers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showAdd, setShowAdd]     = useState(false);
  const [pendingBar, setPendingBar] = useState(0);
  const dragRef = useRef<{ id: string; startClientX: number; origBar: number } | null>(null);

  const addMarker = useCallback((bar: number, preset?: typeof PRESETS[0]) => {
    const p = preset ?? PRESETS[0];
    const marker: SectionMarker = {
      id:    `m-${Date.now()}`,
      label: p.label,
      bar,
      color: p.color,
    };
    setMarkers(prev => {
      const next = [...prev, marker];
      saveMarkers(next);
      return next;
    });
    setShowAdd(false);
  }, []);

  const removeMarker = useCallback((id: string) => {
    setMarkers(prev => {
      const next = prev.filter(x => x.id !== id);
      saveMarkers(next);
      return next;
    });
  }, []);

  const startRename = useCallback((marker: SectionMarker) => {
    setEditingId(marker.id);
    setEditLabel(marker.label);
  }, []);

  const commitRename = useCallback((id: string, label: string) => {
    setMarkers(prev => {
      const next = prev.map(x => x.id === id ? { ...x, label: label.trim() || x.label } : x);
      saveMarkers(next);
      return next;
    });
    setEditingId(null);
  }, []);

  return (
    <>
      {/* Render each marker as an absolute-positioned chip on the ruler */}
      {markers.map(marker => {
        const left = headerWidth + marker.bar * pxPerBar;
        const isDragging = dragRef.current?.id === marker.id;

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
                dragRef.current = { id: marker.id, startClientX: e.clientX, origBar: marker.bar };
              }}
              onPointerMove={e => {
                if (!dragRef.current || dragRef.current.id !== marker.id) return;
                const dx = e.clientX - dragRef.current.startClientX;
                const newBar = Math.max(0, Math.round(dragRef.current.origBar + dx / pxPerBar));
                setMarkers(prev => {
                  const next = prev.map(x => x.id === marker.id ? { ...x, bar: newBar } : x);
                  saveMarkers(next);
                  return next;
                });
              }}
              onPointerUp={() => { dragRef.current = null; }}
              onDoubleClick={() => startRename(marker)}
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
        className="absolute inset-0 z-30 pointer-events-none"
        onDoubleClick={e => {
          const x = e.clientX - (laneRect(e));
          const bar = Math.floor((x - headerWidth) / pxPerBar);
          if (bar < 0) return;
          setPendingBar(bar);
          setShowAdd(true);
        }}
        style={{ pointerEvents: 'none' }}
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
