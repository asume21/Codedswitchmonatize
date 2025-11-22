import React, { useCallback, useRef, forwardRef, CSSProperties } from 'react';
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

// Force rebuild
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
      className="w-28 bg-gradient-to-b from-gray-900 to-black border-r-2 border-gray-700 shadow-2xl"
      onScroll={onScroll}
      style={{ borderTop: 'none', overflow: 'hidden' }}
    >
      {/* Spacer to match step header height */}
      <div className="sticky top-0 z-10" style={{ height: '30px', background: 'transparent', border: 'none' }} />
      
      <div className="relative" style={{ height: `${pianoKeys.length * keyHeight}px`, overflow: 'hidden' }}>
        {pianoKeys.map((key, index) => {
          // Calculate EXACT Y position for this key to match grid row
          const yPosition = index * keyHeight;
          const isActive = activeKeys.has(index);
          const whiteKeyStyle: CSSProperties = {
            position: 'absolute' as const,
            top: `${yPosition}px`,
            left: 0,
            right: 0,
            height: `${keyHeight}px`,
            boxSizing: 'border-box',
            padding: 0,
            margin: 0,
            borderLeft: '1px solid #1a1a1a',
            borderRight: '1px solid #1a1a1a',
            border: 'none',
            lineHeight: `${keyHeight}px`,
            backgroundImage: isActive
              ? 'linear-gradient(180deg, #ffffff, #d9f99d)'
              : 'linear-gradient(180deg, #f8fafc, #e2e8f0)',
            boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.8)',
            zIndex: 1,
          };

          const blackKeyStyle: CSSProperties = {
            position: 'absolute' as const,
            top: `${yPosition}px`,
            left: 0,
            height: `${keyHeight}px`,
            width: '65%',
            boxSizing: 'border-box',
            padding: 0,
            margin: 0,
            border: 'none',
            lineHeight: `${keyHeight}px`,
            backgroundImage: isActive
              ? 'linear-gradient(90deg, #4c1d95, #1e1b4b)'
              : 'linear-gradient(90deg, #0f172a, #000000)',
            boxShadow: '2px 0 4px rgba(0,0,0,0.5), inset -1px 0 2px rgba(255,255,255,0.1)',
            zIndex: 10,
          };

          return (
            <button
              key={key.key}
              className="w-full text-xs font-semibold relative"
              style={key.isBlack ? blackKeyStyle : whiteKeyStyle}
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
