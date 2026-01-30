import React, { useCallback, useMemo, forwardRef, CSSProperties, useState, useRef, memo } from 'react';
import { Note, Track, PianoKey } from './types/pianoRollTypes';
import type { TimeSignature } from '@/contexts/TransportContext';
import { cn } from "@/lib/utils";

const KEY_COLUMN_WIDTH = 112; // Matches PianoKeys w-28
const GRID_SEPARATOR_COLOR = 'rgba(148, 163, 184, 0.35)';

type PianoRollTool = 'draw' | 'select' | 'erase' | 'slice';

interface StepGridProps {
  steps: number;
  pianoKeys: PianoKey[];
  selectedTrack: Track;
  currentStep: number;
  stepWidth: number;
  keyHeight: number;
  zoom: number;
  onStepClick: (keyIndex: number, step: number) => void;
  onChordAdd: (step: number) => void;
  onNoteRemove: (noteId: string) => void;
  onNoteResize?: (noteId: string, newLength: number) => void;
  onNoteMove?: (noteId: string, newStep: number, newKeyIndex: number) => void;
  onNoteCopy?: (noteId: string, newStep: number, newKeyIndex: number) => void;
  onMultiNoteResize?: (noteIds: string[], deltaLength: number) => void;
  onNoteSelect?: (noteId: string, addToSelection: boolean) => void;
  chordMode: boolean;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  selectedNoteIds?: Set<string>;
  onSelectionStart?: (e: React.MouseEvent, keyIndex: number, step: number) => void;
  onSelectionMove?: (keyIndex: number, step: number) => void;
  onSelectionEnd?: (e: React.MouseEvent) => void;
  isSelecting?: boolean;
  selectionStart?: { x: number; y: number } | null;
  selectionEnd?: { x: number; y: number } | null;
  onPlayheadClick?: (step: number) => void;
  tracks?: Track[];
  selectedTrackIndex?: number;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  tool?: PianoRollTool;
  snapEnabled?: boolean;
  snapValue?: number;
  showGhostNotes?: boolean;
  onNotesChange?: (notes: Note[]) => void;
  timeSignature?: TimeSignature;
}

const StepGridComponent = forwardRef<HTMLDivElement, StepGridProps>(({ 
  steps,
  pianoKeys = [],
  selectedTrack,
  currentStep,
  stepWidth,
  keyHeight,
  zoom,
  onStepClick,
  onChordAdd,
  onNoteRemove,
  onNoteResize,
  onNoteMove,
  onNoteCopy,
  onMultiNoteResize,
  onNoteSelect,
  chordMode,
  onScroll,
  selectedNoteIds,
  onSelectionStart,
  onSelectionMove,
  onSelectionEnd,
  isSelecting,
  selectionStart,
  selectionEnd,
  onPlayheadClick,
  tracks,
  selectedTrackIndex,
  scrollRef,
  tool,
  snapEnabled,
  snapValue,
  showGhostNotes,
  onNotesChange,
  timeSignature,
}, ref) => {
  const emitNotesChange = useCallback((producer: (notes: Note[]) => Note[]) => {
    if (!selectedTrack || !onNotesChange) return;
    const current = selectedTrack.notes || [];
    onNotesChange(producer(current));
  }, [selectedTrack, onNotesChange]);

  const beatsPerBar = useMemo(() => Math.max(1, timeSignature?.numerator ?? 4), [timeSignature?.numerator]);
  const stepsPerBeat = useMemo(() => {
    const denominator = timeSignature?.denominator ?? 4;
    const rawStepsPerBeat = (4 / denominator) * 4;
    return Math.max(1, Math.round(rawStepsPerBeat));
  }, [timeSignature?.denominator]);
  const stepsPerBarTotal = useMemo(() => Math.max(stepsPerBeat * beatsPerBar, stepsPerBeat), [stepsPerBeat, beatsPerBar]);

  const handleCellClick = useCallback((keyIndex: number, step: number) => {
    const key = pianoKeys[keyIndex];
    if (!key || !selectedTrack?.notes) return;

    const note = selectedTrack.notes.find(
      n => n?.note === key.note && 
           n?.octave === key.octave && 
           n?.step === step
    );

    switch (tool) {
      case 'erase':
        if (note) {
          onNoteRemove(note.id);
        }
        return;
      case 'select':
        if (note) {
          onNoteSelect?.(note.id, false);
        }
        return;
      case 'draw':
      default:
        if (note) {
          onNoteRemove(note.id);
          return;
        }
        if (chordMode) {
          onChordAdd(step);
        } else {
          onStepClick(keyIndex, step);
        }
        return;
    }
  }, [selectedTrack, pianoKeys, onStepClick, onChordAdd, onNoteRemove, chordMode, tool, onNoteSelect]);

  const renderStepHeaders = useMemo(() => {
    const headers = [];
    for (let step = 0; step < steps; step++) {
      const isCurrentStep = currentStep === step;
      const isBeatStart = step % stepsPerBeat === 0;
      const isBarStart = step % stepsPerBarTotal === 0;
      headers.push(
        <div
          key={step}
          className={cn(
            "flex items-center justify-center text-xs font-mono border-r border-gray-600 cursor-pointer",
            isCurrentStep ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-600',
            isBarStart && !isCurrentStep ? 'bg-cyan-900/40 text-white' : isBeatStart && !isCurrentStep ? 'bg-gray-700/80' : undefined
          )}
          style={{
            width: `${stepWidth * zoom}px`,
            minWidth: `${stepWidth * zoom}px`,
            maxWidth: `${stepWidth * zoom}px`,
            height: '30px',
            boxSizing: 'border-box',
            padding: 0,
            margin: 0
          }}
          onClick={() => onPlayheadClick?.(step)}
          title={`Click to move playhead to step ${step + 1}`}
        >
          {step + 1}
        </div>
      );
    }
    return headers;
  }, [steps, currentStep, stepWidth, zoom, onPlayheadClick, stepsPerBeat, stepsPerBarTotal]);

  const gridBackdropStyle = {
    backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.75)), linear-gradient(180deg, rgba(59,130,246,0.08) 1px, transparent 1px)`,
    backgroundBlendMode: 'overlay',
    backgroundSize: '100% 100%, auto',
    boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.6)',
  };

  const rowStyle: CSSProperties = useMemo(() => ({
    height: `${keyHeight}px`,
    minHeight: `${keyHeight}px`,
    maxHeight: `${keyHeight}px`,
    boxSizing: 'border-box',
    padding: 0,
    margin: 0,
    borderLeft: '1px solid #1a1a1a',
    borderRight: '1px solid #1a1a1a',
    borderTop: '1px solid #1a1a1a',
    borderBottom: 'none',
    position: 'relative' as const,
  }), [keyHeight]);

  // Simple rAF throttle helper to prevent excessive state churn during drags
  const useRafThrottle = () => {
    const ticking = useRef(false);
    return (fn: () => void) => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        fn();
        ticking.current = false;
      });
    };
  };

  const throttleMove = useRafThrottle();
  const throttleResize = useRafThrottle();

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const getResizeDeltaSteps = (deltaX: number) => {
    const baseSteps = deltaX / (stepWidth * zoom);
    const snap = snapEnabled ? (snapValue || 1) : 1;
    if (!snap || snap <= 0) return Math.trunc(baseSteps);
    const snapped = Math.round(baseSteps / snap) * snap;
    return snapped;
  };

  return (
    <div 
      ref={scrollRef || ref}
      className="flex-1 overflow-auto astutely-scrollbar"
      onScroll={onScroll}
    >
      <div className="relative bg-black" style={{...gridBackdropStyle, borderTop: 'none', width: `${steps * stepWidth * zoom}px`}}>
        {/* Step Headers */}
        <div className="flex sticky top-0 bg-black/90 backdrop-blur-md z-20 border-b border-cyan-500/30" style={{borderTop: 'none'}}>
          {renderStepHeaders}
        </div>

        {/* Grid - draw each row at the EXACT position of each piano key */}
        <div className="relative" style={{ height: `${pianoKeys.length * keyHeight}px` }}>
          {pianoKeys.map((key, keyIndex) => {
            const yPosition = keyIndex * keyHeight;
            const thisRowStyle: CSSProperties = {
              position: 'absolute' as const,
              top: `${yPosition}px`,
              left: 0,
              right: 0,
              height: `${keyHeight}px`,
              boxSizing: 'border-box',
              border: 'none',
            };
            
            return (
            <div
              key={key.key}
              className={cn("flex group/row transition-colors", key.isBlack ? "bg-white/[0.02]" : "bg-transparent")}
              style={thisRowStyle}
            >
              {/* Horizontal separator line */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                pointerEvents: 'none',
                zIndex: 1
              }} />
              
              {/* Grid cells */}
              {Array.from({ length: steps }, (_, step) => {
                const isBeatStart = step % stepsPerBeat === 0;
                const isBarStart = step % stepsPerBarTotal === 0;
                return (
                <div
                  key={`${key.key}-${step}`}
                  className={cn(
                    "cursor-pointer transition-colors border-r border-cyan-500/10",
                    currentStep === step ? "bg-cyan-500/10" : "hover:bg-cyan-500/5",
                    isBeatStart && "border-r-cyan-500/30",
                    isBarStart && "border-r-cyan-400/60"
                  )}
                  style={{
                    width: `${stepWidth * zoom}px`,
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                  onClick={() => handleCellClick(keyIndex, step)}
                  onMouseDown={(e) => {
                    if (tool === 'select' && e.button === 0 && onSelectionStart) {
                      onSelectionStart(e, keyIndex, step);
                    }
                  }}
                />
                );
              })}
              
              {/* Ghost Notes from other tracks - memoized */}
              {showGhostNotes && tracks && tracks.map((track, trackIdx) => {
                if (trackIdx === selectedTrackIndex || !track?.notes) return null;
                const ghostNotes = track.notes.filter(note => note?.note === key.note && note?.octave === key.octave);
                if (ghostNotes.length === 0) return null;
                
                return ghostNotes.map((note) => (
                  <div
                    key={`ghost-${track.id}-${note.id}`}
                    className="absolute rounded-sm opacity-20 pointer-events-none border border-white/10"
                    style={{
                      left: `${(note.step || 0) * stepWidth * zoom}px`,
                      width: `${(note.length || 1) * stepWidth * zoom - 2}px`,
                      height: `${keyHeight - 6}px`,
                      top: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      zIndex: 2
                    }}
                  />
                ));
              })}

              {/* Render notes as overlays - optimized */}
              {selectedTrack?.notes && selectedTrack.notes
                .filter(note => note?.note === key.note && note?.octave === key.octave)
                .map((note) => {
                  const isSelected = selectedNoteIds?.has(note.id);
                  return (
                  <div
                    key={note.id}
                    className={cn(
                      "absolute group rounded-sm border cursor-grab active:cursor-grabbing transition-all",
                      isSelected 
                        ? "bg-white border-white shadow-glow-white z-30" 
                        : "bg-cyan-500/80 border-cyan-400 shadow-glow-cyan z-20"
                    )}
                    style={{
                      left: `${note.step * stepWidth * zoom}px`,
                      width: `${(note.length || 1) * stepWidth * zoom - 2}px`,
                      height: `${keyHeight - 6}px`,
                      top: '3px',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const multiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
                      if (multiSelect) {
                        onNoteSelect?.(note.id, true);
                      } else if (!isSelected) {
                        onNoteSelect?.(note.id, false);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (tool !== 'select') return;
                      const target = e.target as HTMLElement;
                      if (target.classList.contains('resize-handle')) return;
                      
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startStep = note.step;
                      const startKeyIndex = keyIndex;
                      let hasMoved = false;
                      const isAltDrag = e.altKey; 
                      
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaY = moveEvent.clientY - startY;
                        const deltaSteps = Math.round(deltaX / (stepWidth * zoom));
                        const deltaKeys = Math.round(deltaY / keyHeight);
                        
                        if (Math.abs(deltaSteps) > 0 || Math.abs(deltaKeys) > 0) {
                          hasMoved = true;
                          const newStep = Math.max(0, Math.min(steps - 1, startStep + deltaSteps));
                          const newKeyIndex = Math.max(0, Math.min(pianoKeys.length - 1, startKeyIndex + deltaKeys));
                          if (!isAltDrag) {
                            throttleMove(() => onNoteMove?.(note.id, newStep, newKeyIndex));
                          }
                        }
                      };
                      
                      const handleMouseUp = (upEvent: MouseEvent) => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        if (isAltDrag && hasMoved && onNoteCopy) {
                          const deltaX = upEvent.clientX - startX;
                          const deltaY = upEvent.clientY - startY;
                          const deltaSteps = Math.round(deltaX / (stepWidth * zoom));
                          const deltaKeys = Math.round(deltaY / keyHeight);
                          const newStep = Math.max(0, Math.min(steps - 1, startStep + deltaSteps));
                          const newKeyIndex = Math.max(0, Math.min(pianoKeys.length - 1, startKeyIndex + deltaKeys));
                          onNoteCopy(note.id, newStep, newKeyIndex);
                        }
                        if (!hasMoved && onNoteSelect) onNoteSelect(note.id, e.ctrlKey || e.metaKey);
                      };
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                    <div className="text-[8px] text-black font-black px-1 truncate pointer-events-none mix-blend-overlay">
                      {note.note}{note.octave}
                    </div>
                    
                    {(onNoteResize || onMultiNoteResize) && (
                      <div
                        className="resize-handle absolute right-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-white/80 hover:w-3 opacity-60 group-hover:opacity-100 transition-all rounded-r-sm border-r-2 border-white/60"
                        style={{ cursor: 'ew-resize', zIndex: 50 }}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const startX = e.clientX;
                          const startLength = note.length || 1;
                          const maxLengthForNote = Math.max(1, steps - (note.step || 0));
                          
                          // Set cursor on body during drag
                          document.body.style.cursor = 'ew-resize';
                          document.body.style.userSelect = 'none';
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            moveEvent.preventDefault();
                            const deltaX = moveEvent.clientX - startX;
                            const deltaSteps = getResizeDeltaSteps(deltaX);

                            throttleResize(() => {
                              if (isSelected && selectedNoteIds && selectedNoteIds.size > 1 && onMultiNoteResize) {
                                onMultiNoteResize(Array.from(selectedNoteIds), deltaSteps);
                                emitNotesChange(notes => notes.map(n => {
                                  if (!selectedNoteIds.has(n.id)) return n;
                                  const baseLength = n.length || 1;
                                  const limit = Math.max(1, steps - (n.step || 0));
                                  const nextLength = clamp(baseLength + deltaSteps, 1, limit);
                                  return { ...n, length: nextLength };
                                }));
                                return;
                              }

                              const rawLength = startLength + deltaSteps;
                              const newLength = clamp(rawLength, 1, maxLengthForNote);
                              onNoteResize?.(note.id, newLength);
                              emitNotesChange(notes => notes.map(n => (
                                n.id === note.id ? { ...n, length: newLength } : n
                              )));
                            });
                          };
                          const handleMouseUp = () => {
                            document.body.style.cursor = '';
                            document.body.style.userSelect = '';
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      />
                    )}
                  </div>
                );
                })}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// Export without custom memo comparison - let React handle re-renders naturally
// The custom memo was causing notes to disappear during resize/drag operations
export const StepGrid = memo(StepGridComponent);
