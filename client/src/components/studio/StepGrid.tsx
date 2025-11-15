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
              {/* Horizontal grid line - doesn't affect layout or clicks */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-700 pointer-events-none" />
              
              {Array.from({ length: steps }, (_, step) => {
                const hasNote = selectedTrack.notes.some(
                  note => note.note === key.note && 
                         note.octave === key.octave && 
                         note.step === step
                );

                return (
                  <div
                    key={`${key.key}-${step}`}
                    className={`border-r border-gray-700 cursor-pointer transition-colors relative
                      ${hasNote
                        ? 'bg-blue-500 hover:bg-blue-400'
                        : 'hover:bg-gray-700'
                      }
                      ${step % 4 === 0 ? 'border-r-gray-500' : ''}
                      ${currentStep === step ? 'bg-red-900 bg-opacity-50' : ''}
                    `}
                    style={{
                      width: `${stepWidth * zoom}px`,
                      height: '100%'
                    }}
                    onClick={() => handleCellClick(keyIndex, step)}
                    role="gridcell"
                    aria-label={`Step ${step + 1}, Note ${key.note}${key.octave}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCellClick(keyIndex, step);
                      }
                    }}
                  >
                    {hasNote && (
                      <div 
                        className="absolute inset-0 bg-blue-500 rounded-sm m-0.5 flex items-center justify-center"
                        role="presentation"
                      >
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
