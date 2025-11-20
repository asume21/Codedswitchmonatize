import React, { useCallback, useMemo, forwardRef } from 'react';
import { Note, Track, PianoKey } from './types/pianoRollTypes';

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
  chordMode: boolean;
  onScroll?: () => void;
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
  chordMode,
  onScroll
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
          height: '30px'
        }}
      >
        {step + 1}
      </div>
    ));
  }, [steps, currentStep, stepWidth, zoom]);

  return (
    <div 
      ref={ref}
      className="flex-1 overflow-auto"
      onScroll={onScroll}
    >
      <div className="relative bg-gray-900">
        {/* Step Headers */}
        <div className="flex sticky top-0 bg-gray-800 border-b border-gray-600 z-10">
          {renderStepHeaders}
        </div>

        {/* Grid */}
        <div className="relative">
          {pianoKeys.map((key, keyIndex) => (
            <div key={key.key} className="flex relative" style={{ height: `${keyHeight}px` }}>
              {/* Horizontal grid line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-700 pointer-events-none" />
              
              {/* Grid cells */}
              {Array.from({ length: steps }, (_, step) => (
                <div
                  key={`${key.key}-${step}`}
                  className={`border-r border-gray-700 cursor-pointer transition-colors
                    ${step % 4 === 0 ? 'border-r-gray-500' : ''}
                    ${currentStep === step ? 'bg-red-900 bg-opacity-20' : 'hover:bg-gray-700'}
                  `}
                  style={{
                    width: `${stepWidth * zoom}px`,
                    height: '100%',
                    boxSizing: 'border-box',
                    padding: 0,
                    margin: 0
                  }}
                  onClick={() => handleCellClick(keyIndex, step)}
                />
              ))}
              
              {/* Render notes as overlays */}
              {selectedTrack.notes
                .filter(note => note.note === key.note && note.octave === key.octave)
                .map(note => (
                  <div
                    key={note.id}
                    className="absolute group bg-blue-500 hover:bg-blue-400 rounded-sm border border-blue-600 cursor-pointer transition-colors"
                    style={{
                      left: `${note.step * stepWidth * zoom}px`,
                      width: `${(note.length || 1) * stepWidth * zoom - 2}px`,
                      height: `${keyHeight - 4}px`,
                      top: '2px',
                      zIndex: 5
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteRemove(note.id);
                    }}
                    title={`${note.note}${note.octave} - Click to delete, drag right edge to resize`}
                  >
                    {/* Note label */}
                    <div className="text-xs text-white font-bold px-1 truncate">
                      {note.note}{note.octave}
                    </div>
                    
                    {/* Resize handle */}
                    {onNoteResize && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const startLength = note.length || 1;
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaSteps = Math.round(deltaX / (stepWidth * zoom));
                            const newLength = Math.max(1, startLength + deltaSteps);
                            onNoteResize(note.id, newLength);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        title="Drag to resize"
                      />
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
