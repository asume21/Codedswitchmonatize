import React, { useCallback, useRef, forwardRef } from 'react';
import { PianoKey, Note, Track, STEPS } from './types/pianoRollTypes';
import { realisticAudio } from '@/lib/realisticAudio';

interface PianoKeysProps {
  pianoKeys: PianoKey[];
  selectedTrack: Track;
  onKeyClick: (keyIndex: number, step?: number) => void;
  keyHeight: number;
  currentStep: number;
  isPlaying: boolean;
  chordMode: boolean;
  activeKeys: Set<number>;
  onActiveKeysChange: (keys: Set<number>) => void;
  onScroll?: () => void;
}

export const PianoKeys = forwardRef<HTMLDivElement, PianoKeysProps>(({
  pianoKeys,
  selectedTrack,
  onKeyClick,
  keyHeight,
  currentStep,
  isPlaying,
  chordMode,
  activeKeys,
  onActiveKeysChange,
  onScroll
}, ref) => {
  const sustainedNotesRef = useRef<Map<number, any>>(new Map());

  const handleKeyClick = useCallback((keyIndex: number) => {
    const key = pianoKeys[keyIndex];
    
    if (chordMode) {
      // Chord mode: toggle key on/off with live playback (mobile-friendly!)
      const newSet = new Set(activeKeys);
      
      if (newSet.has(keyIndex)) {
        // Key already active, turn it off and stop its note
        newSet.delete(keyIndex);
        // Stop only this key's note (not all notes)
        const notePlayer = sustainedNotesRef.current.get(keyIndex);
        if (notePlayer?.stop) {
          notePlayer.stop();
        }
        sustainedNotesRef.current.delete(keyIndex);
      } else {
        // Key not active, turn it on and play
        newSet.add(keyIndex);
        // Play note with longer sustain
        realisticAudio.playNote(
          key.note,
          key.octave,
          1.5, // Sustain duration
          selectedTrack?.instrument || 'piano',
          0.8
        );
        // Note: We don't track individual players since realisticAudio doesn't return them
        // but the shorter duration prevents buildup
      }
      
      onActiveKeysChange(newSet);
    } else {
      // Normal mode: single note (for grid placement)
      onKeyClick(keyIndex);
    }
  }, [chordMode, onKeyClick, pianoKeys, selectedTrack?.instrument, activeKeys, onActiveKeysChange]);

  const playKeyPreview = useCallback((key: PianoKey) => {
    // Only preview on hover if not in chord mode
    if (!chordMode) {
      realisticAudio.playNote(
        key.note,
        key.octave,
        0.5,
        selectedTrack?.instrument || 'piano',
        0.6
      );
    }
  }, [selectedTrack?.instrument, chordMode]);

  return (
    <div 
      ref={ref}
      className="w-28 bg-gradient-to-b from-gray-900 to-black border-r-2 border-gray-700 overflow-y-auto shadow-2xl"
      onScroll={onScroll}
    >
      {/* Spacer to match step header height */}
      <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-600" style={{ height: '30px' }} />
      
      <div className="relative">
        {pianoKeys.map((key, index) => {
          const isActive = activeKeys.has(index);
          return (
            <button
              key={key.key}
              className={`
                w-full text-xs font-bold transition-all duration-200 relative overflow-visible
                ${key.isBlack
                  ? isActive 
                    ? 'bg-gradient-to-b from-green-600 via-green-700 to-green-800 text-white border-l-4 border-l-green-400 shadow-2xl'
                    : 'bg-gradient-to-b from-gray-900 via-black to-gray-950 text-gray-400 border-l-4 border-l-black shadow-lg hover:from-gray-800 hover:via-gray-900 active:from-black active:via-gray-950'
                  : isActive
                    ? 'bg-gradient-to-b from-green-400 via-green-300 to-green-200 dark:from-green-500 dark:via-green-600 dark:to-green-700 text-green-900 dark:text-white border-b-4 border-green-600 shadow-2xl'
                    : 'bg-gradient-to-b from-gray-100 via-white to-gray-50 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 shadow-inner hover:from-gray-50 hover:via-gray-100 dark:hover:from-gray-600 dark:hover:via-gray-500 active:from-gray-200 active:via-gray-300 dark:active:from-gray-800 dark:active:via-gray-700'
                }
                ${key.isBlack ? 'ml-2 mr-2 z-10' : 'z-0'}
                ${isActive ? 'ring-4 ring-green-400 ring-opacity-80 z-20' : ''}
                ${isPlaying && currentStep % STEPS === 0 ? 'ring-2 ring-purple-400 ring-opacity-60' : ''}
              `}
              style={{ 
                height: `${keyHeight}px`,
                boxSizing: 'border-box',
                boxShadow: isActive
                  ? '0 0 20px rgba(34, 197, 94, 0.9), inset 0 2px 8px rgba(34, 197, 94, 0.4)'
                  : key.isBlack 
                    ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.3)' 
                    : '0 1px 3px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
              }}
              onClick={() => handleKeyClick(index)}
              onMouseEnter={() => playKeyPreview(key)}
              onTouchStart={() => playKeyPreview(key)}
              aria-label={`Piano key ${key.note}${key.octave}${isActive ? ' - Active' : ''}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleKeyClick(index);
                }
              }}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span className={`${key.isBlack ? 'opacity-90' : 'opacity-90'} ${isActive ? 'font-extrabold' : ''}`}>
                  {key.key}
                </span>
                {isActive && (
                  <span className="text-[10px] font-extrabold text-green-900 dark:text-green-100 mt-0.5 animate-pulse">
                    ♪
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
