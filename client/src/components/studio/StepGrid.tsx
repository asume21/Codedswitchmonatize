import React, { useCallback, useMemo, forwardRef, CSSProperties } from 'react';
import { Note, Track, PianoKey } from './types/pianoRollTypes';

const KEY_COLUMN_WIDTH = 112; // Matches PianoKeys w-28
const GRID_SEPARATOR_COLOR = 'rgba(148, 163, 184, 0.35)';

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
  onMultiNoteResize?: (noteIds: string[], deltaLength: number) => void;
  onNoteSelect?: (noteId: string, addToSelection: boolean) => void;
  chordMode: boolean;
  onScroll?: () => void;
  selectedNoteIds?: Set<string>;
  onSelectionStart?: (e: React.MouseEvent, keyIndex: number, step: number) => void;
  onSelectionMove?: (keyIndex: number, step: number) => void;
  onSelectionEnd?: (e: React.MouseEvent) => void;
  isSelecting?: boolean;
  selectionStart?: { x: number; y: number } | null;
  selectionEnd?: { x: number; y: number } | null;
}

export const StepGrid = forwardRef<HTMLDivElement, StepGridProps>(({
  steps,
  pianoKeys,
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
}, ref) => {
  const handleCellClick = useCallback((keyIndex: number, step: number) => {
    const note = selectedTrack.notes.find(
      n => n.note === pianoKeys[keyIndex].note && 
           n.octave === pianoKeys[keyIndex].octave && 
           n.step === step
    );

    if (note) {
      onNoteRemove(note.id);
    } else if (chordMode) {
      onChordAdd(step);
    } else {
      onStepClick(keyIndex, step);
    }
  }, [selectedTrack.notes, pianoKeys, onStepClick, onChordAdd, onNoteRemove, chordMode]);

  const renderStepHeaders = useMemo(() => {
    return Array.from({ length: steps }, (_, step) => (
      <div
        key={`header-${step}`}
        className={`flex items-center justify-center text-xs font-mono border-r border-gray-600
          ${currentStep === step ? 'bg-red-600 text-white' : 'text-gray-400'}
          ${step % 4 === 0 ? 'bg-gray-700' : ''}
        `}
        style={{
          width: `${stepWidth * zoom}px`,
          minWidth: `${stepWidth * zoom}px`,
          maxWidth: `${stepWidth * zoom}px`,
          height: '30px',
          boxSizing: 'border-box',
          padding: 0,
          margin: 0
        }}
      >
        {step + 1}
      </div>
    ));
  }, [steps, currentStep, stepWidth, zoom]);

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

  return (
    <div 
      ref={ref}
      className="flex-1"
      style={{ overflow: 'visible' }}
    >
      <div className="relative bg-gray-900" style={{...gridBackdropStyle, borderTop: 'none'}}>
        {/* Step Headers */}
        <div className="flex sticky top-0 bg-gray-800 z-10" style={{borderTop: 'none', borderBottom: 'none'}}>
          {renderStepHeaders}
        </div>

        {/* Grid - draw each row at the EXACT position of each piano key */}
        <div className="relative" style={{ height: `${pianoKeys.length * keyHeight}px`, paddingTop: '30px' }}>
          {pianoKeys.map((key, keyIndex) => {
            // Calculate the EXACT Y position for this key
            const yPosition = keyIndex * keyHeight;
            
            // Row style with NO borders (we'll draw separator lines separately)
            const thisRowStyle: CSSProperties = {
              position: 'absolute' as const,
              top: `${yPosition}px`,
              left: 0,
              right: 0,
              height: `${keyHeight}px`,
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
              border: 'none',
            };
            
            return (
            <div
              key={key.key}
              className="flex"
              style={thisRowStyle}
            >
              {/* Horizontal separator line at the TOP of this row */}
              {keyIndex > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '1px',
                  backgroundColor: '#1a1a1a',
                  pointerEvents: 'none',
                  zIndex: 100
                }} />
              )}
              
              {/* Vertical left border */}
              <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '1px',
                backgroundColor: '#1a1a1a',
                pointerEvents: 'none',
                zIndex: 100
              }} />
              
              {/* Vertical right border */}
              <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '1px',
                backgroundColor: '#1a1a1a',
                pointerEvents: 'none',
                zIndex: 100
              }} />
              
              {/* Grid cells (transparent, no vertical lines, no separators for now) */}
              {Array.from({ length: steps }, (_, step) => (
                <div
                  key={`${key.key}-${step}`}
                  className={`cursor-pointer transition-colors ${currentStep === step ? 'bg-red-900 bg-opacity-20' : 'hover:bg-gray-800/50'}`}
                  style={{
                    width: `${stepWidth * zoom}px`,
                    height: '100%',
                    boxSizing: 'border-box',
                    padding: 0,
                    margin: 0,
                    border: 'none'
                  }}
                  onClick={() => handleCellClick(keyIndex, step)}
                  onMouseDown={(e) => {
                    // Primary button starts selection
                    if (e.button === 0 && onSelectionStart) {
                      onSelectionStart(e, keyIndex, step);
                    }
                  }}
                  onMouseEnter={(e) => {
                    // While mouse button is held, extend selection
                    if ((e.buttons & 1) === 1 && onSelectionMove) {
                      onSelectionMove(keyIndex, step);
                    }
                  }}
                  onMouseUp={(e) => {
                    if (onSelectionEnd) {
                      onSelectionEnd(e);
                    }
                  }}
                  onTouchStart={(e) => {
                    if (onSelectionStart) {
                      onSelectionStart(e as unknown as React.MouseEvent, keyIndex, step);
                    }
                  }}
                  onTouchMove={() => {
                    if (onSelectionMove) {
                      onSelectionMove(keyIndex, step);
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (onSelectionEnd) {
                      onSelectionEnd(e as unknown as React.MouseEvent);
                    }
                  }}
                />
              ))}
              
              {/* Render notes as overlays */}
              {selectedTrack.notes
                .filter(note => note.note === key.note && note.octave === key.octave)
                .map(note => {
                  const isSelected = selectedNoteIds?.has(note.id);
                  return (
                  <div
                    key={note.id}
                    className={`absolute group rounded-sm border cursor-grab active:cursor-grabbing transition-colors ${
                      isSelected 
                        ? 'bg-yellow-500 hover:bg-yellow-400 border-yellow-300 ring-2 ring-yellow-300' 
                        : 'bg-blue-500 hover:bg-blue-400 border-blue-600'
                    }`}
                    style={{
                      left: `${note.step * stepWidth * zoom}px`,
                      width: `${(note.length || 1) * stepWidth * zoom - 2}px`,
                      height: `${keyHeight - 4}px`,
                      top: '2px',
                      zIndex: isSelected ? 10 : 5
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Ctrl/Cmd+click to add to selection, otherwise toggle or remove
                      if (e.ctrlKey || e.metaKey) {
                        onNoteSelect?.(note.id, true);
                      } else if (e.shiftKey) {
                        // Shift+click to add to selection
                        onNoteSelect?.(note.id, true);
                      } else {
                        // Regular click - if not selected, select it; if selected, delete it
                        if (!isSelected) {
                          onNoteSelect?.(note.id, false);
                        } else {
                          onNoteRemove(note.id);
                        }
                      }
                    }}
                    onMouseDown={(e) => {
                      // Only drag on left click, not on resize handle
                      if (e.button !== 0) return;
                      const target = e.target as HTMLElement;
                      if (target.classList.contains('resize-handle')) return;
                      
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startStep = note.step;
                      const startKeyIndex = keyIndex;
                      let hasMoved = false;
                      
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaY = moveEvent.clientY - startY;
                        const deltaSteps = Math.round(deltaX / (stepWidth * zoom));
                        const deltaKeys = Math.round(deltaY / keyHeight);
                        
                        if (Math.abs(deltaSteps) > 0 || Math.abs(deltaKeys) > 0) {
                          hasMoved = true;
                          const newStep = Math.max(0, Math.min(steps - 1, startStep + deltaSteps));
                          const newKeyIndex = Math.max(0, Math.min(pianoKeys.length - 1, startKeyIndex + deltaKeys));
                          onNoteMove?.(note.id, newStep, newKeyIndex);
                        }
                      };
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        // If we didn't move, treat as a click for selection
                        if (!hasMoved && onNoteSelect) {
                          onNoteSelect(note.id, e.ctrlKey || e.metaKey);
                        }
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    title={`${note.note}${note.octave} - Drag to move, Ctrl+click to multi-select, drag right edge to resize`}
                  >
                    {/* Note label */}
                    <div className="text-xs text-white font-bold px-1 truncate pointer-events-none">
                      {note.note}{note.octave}
                    </div>
                    
                    {/* Resize handle */}
                    {(onNoteResize || onMultiNoteResize) && (
                      <div
                        className="resize-handle absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/20 hover:bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-sm"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const startLength = note.length || 1;
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaSteps = Math.round(deltaX / (stepWidth * zoom));
                            
                            // If this note is selected and there are multiple selected, resize all
                            if (isSelected && selectedNoteIds && selectedNoteIds.size > 1 && onMultiNoteResize) {
                              onMultiNoteResize(Array.from(selectedNoteIds), deltaSteps);
                            } else if (onNoteResize) {
                              const newLength = Math.max(1, startLength + deltaSteps);
                              onNoteResize(note.id, newLength);
                            }
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        title="Drag to resize (resizes all selected notes)"
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
