import React, { useCallback, useRef, forwardRef, CSSProperties } from 'react';
import { PianoKey, Note, Track, STEPS } from './types/pianoRollTypes';
import { useAudio } from '@/hooks/use-audio';

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
  arpEnabled?: boolean; // When true, use hold mode instead of toggle
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
  onScroll,
  arpEnabled = false
}, ref) => {
  const sustainedNotesRef = useRef<Map<number, any>>(new Map());
  const { playNote } = useAudio();

  // Handle mouse/touch DOWN - activate key
  const handleKeyDown = useCallback((keyIndex: number) => {
    const key = pianoKeys[keyIndex];
    
    if (arpEnabled) {
      // ARP MODE: Add key on press (arpeggiator handles the repeating)
      const newSet = new Set(activeKeys);
      if (!newSet.has(keyIndex)) {
        newSet.add(keyIndex);
        // Play initial note
        playNote(key.note, key.octave, 0.3, selectedTrack?.instrument || 'piano', 0.8);
        onActiveKeysChange(newSet);
      }
    } else if (chordMode) {
      // CHORD MODE: Toggle key on/off
      const newSet = new Set(activeKeys);
      if (newSet.has(keyIndex)) {
        newSet.delete(keyIndex);
        const notePlayer = sustainedNotesRef.current.get(keyIndex);
        if (notePlayer?.stop) notePlayer.stop();
        sustainedNotesRef.current.delete(keyIndex);
      } else {
        newSet.add(keyIndex);
        playNote(key.note, key.octave, 1.5, selectedTrack?.instrument || 'piano', 0.8);
      }
      onActiveKeysChange(newSet);
    } else {
      // NORMAL MODE: Single note for grid placement
      onKeyClick(keyIndex);
    }
  }, [activeKeys, arpEnabled, chordMode, onActiveKeysChange, onKeyClick, pianoKeys, playNote, selectedTrack?.instrument]);

  // Handle mouse/touch UP - deactivate key (only in arp mode)
  const handleKeyUp = useCallback((keyIndex: number) => {
    if (arpEnabled) {
      const newSet = new Set(activeKeys);
      newSet.delete(keyIndex);
      onActiveKeysChange(newSet);
    }
  }, [arpEnabled, activeKeys, onActiveKeysChange]);

  // Legacy click handler for backwards compatibility
  const handleKeyClick = useCallback((keyIndex: number) => {
    if (!arpEnabled) {
      handleKeyDown(keyIndex);
    }
  }, [arpEnabled, handleKeyDown]);

  const playKeyPreview = useCallback((key: PianoKey) => {
    // Only preview on hover if not in chord mode
    if (!chordMode) {
      playNote(key.note, key.octave, 0.5, selectedTrack?.instrument || 'piano', 0.6);
    }
  }, [chordMode, playNote, selectedTrack?.instrument]);

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
              className="w-full text-xs font-semibold relative select-none"
              style={key.isBlack ? blackKeyStyle : whiteKeyStyle}
              onClick={() => !arpEnabled && handleKeyClick(index)}
              onMouseDown={() => arpEnabled && handleKeyDown(index)}
              onMouseUp={() => arpEnabled && handleKeyUp(index)}
              onMouseLeave={() => arpEnabled && handleKeyUp(index)}
              onTouchStart={(e) => {
                e.preventDefault();
                if (arpEnabled) handleKeyDown(index);
                else playKeyPreview(key);
              }}
              onTouchEnd={() => arpEnabled && handleKeyUp(index)}
              onMouseEnter={() => !arpEnabled && playKeyPreview(key)}
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
                <span
                  className={`${
                    key.isBlack ? 'text-white opacity-90' : 'text-black opacity-90'
                  } ${isActive ? 'font-extrabold' : ''}`}
                >
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
