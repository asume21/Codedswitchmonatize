/**
 * VelocityLane — Piano roll velocity editor lane
 *
 * Renders a horizontal strip below the note grid showing a velocity bar for
 * each note on the selected track. Click or drag to change velocity (0-127).
 *
 * Features:
 *  • Bar per note, height = velocity / 127
 *  • Drag to scrub velocity across multiple notes
 *  • Selected notes highlighted in cyan
 *  • Velocity value tooltip on hover
 *  • All changes go through the onNotesChange callback
 */

import React, { useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

const LANE_H    = 72;    // px — total lane height
const MIN_VEL   = 1;
const MAX_VEL   = 127;
const BAR_GAP   = 1;

interface VelocityNote {
  id: string;
  step: number;
  length: number;
  velocity: number;
  note: string;
  octave: number;
}

interface VelocityLaneProps {
  notes: VelocityNote[];
  steps: number;
  stepWidth: number;           // px per step (same as StepGrid)
  selectedNoteIds?: Set<string>;
  onNotesChange: (notes: VelocityNote[]) => void;
}

export function VelocityLane({
  notes, steps, stepWidth, selectedNoteIds, onNotesChange,
}: VelocityLaneProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  const totalWidth = steps * stepWidth;

  // Get velocity from Y position within the lane
  const yToVelocity = useCallback((clientY: number): number => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return 64;
    const fraction = 1 - (clientY - rect.top) / LANE_H;
    return Math.max(MIN_VEL, Math.min(MAX_VEL, Math.round(fraction * MAX_VEL)));
  }, []);

  // Find note(s) at a given X position
  const notesAtX = useCallback((clientX: number): string[] => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return [];
    const x = clientX - rect.left;
    const step = Math.floor(x / stepWidth);
    return notes
      .filter(n => step >= n.step && step < n.step + n.length)
      .map(n => n.id);
  }, [notes, stepWidth]);

  const applyVelocity = useCallback((clientX: number, clientY: number) => {
    const ids = notesAtX(clientX);
    if (!ids.length) return;
    const vel = yToVelocity(clientY);
    const updated = notes.map(n =>
      ids.includes(n.id) ? { ...n, velocity: vel } : n
    );
    onNotesChange(updated);
  }, [notesAtX, yToVelocity, notes, onNotesChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    applyVelocity(e.clientX, e.clientY);
  }, [applyVelocity]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    applyVelocity(e.clientX, e.clientY);
  }, [applyVelocity]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <div
      className="relative bg-[#06080f] border-t border-cyan-500/20 flex-shrink-0 select-none overflow-hidden"
      style={{ height: LANE_H, width: totalWidth }}
      ref={laneRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Guideline: 50% velocity */}
      <div className="absolute left-0 right-0 pointer-events-none opacity-30"
        style={{ top: LANE_H * 0.5, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }}
      />
      {/* Guideline: 100% */}
      <div className="absolute left-0 right-0 pointer-events-none"
        style={{ top: 2, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }}
      />

      {/* Velocity bars — one per note */}
      {notes.map(note => {
        const vel    = Math.max(MIN_VEL, Math.min(MAX_VEL, note.velocity ?? 100));
        const barH   = Math.max(4, (vel / MAX_VEL) * (LANE_H - 6));
        const isSelected = selectedNoteIds?.has(note.id);
        const isHovered  = hoveredNoteId === note.id;
        const barW   = Math.max(BAR_GAP + 2, note.length * stepWidth - BAR_GAP);
        const barX   = note.step * stepWidth;
        const color  = isSelected
          ? '#06b6d4'
          : vel > 100 ? '#f97316' : vel > 64 ? '#22c55e' : '#3b82f6';

        return (
          <div
            key={note.id}
            className="absolute bottom-0 rounded-t cursor-ns-resize transition-colors"
            style={{
              left:            barX + BAR_GAP / 2,
              width:           barW,
              height:          barH,
              backgroundColor: color,
              opacity:         isHovered || isSelected ? 1 : 0.7,
              boxShadow:       isSelected ? `0 0 6px ${color}` : undefined,
            }}
            onMouseEnter={() => setHoveredNoteId(note.id)}
            onMouseLeave={() => setHoveredNoteId(null)}
          >
            {/* Velocity label on hover */}
            {(isHovered || isSelected) && barH > 14 && (
              <div className="absolute top-1 left-0 right-0 flex justify-center">
                <span className="text-[8px] font-mono text-white/80 leading-none">{vel}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Lane label */}
      <div className="absolute top-1 right-2 text-[9px] font-mono text-gray-700 pointer-events-none uppercase tracking-widest">
        Velocity
      </div>
    </div>
  );
}

export default VelocityLane;
