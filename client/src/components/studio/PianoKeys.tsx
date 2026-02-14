import React, { useCallback, useRef, forwardRef, CSSProperties, memo, useMemo } from 'react';
import { PianoKey, Track } from './types/pianoRollTypes';
import { useAudio } from '@/hooks/use-audio';

interface PianoKeysProps {
  pianoKeys: PianoKey[];
  selectedTrack?: Track;
  onKeyClick: (keyIndex: number, step?: number) => void;
  keyHeight: number;
  currentStep: number;
  isPlaying: boolean;
  chordMode: boolean;
  activeKeys: Set<number>;
  onActiveKeysChange: (keys: Set<number>) => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onPlayNote?: (note: string, octave: number) => void;
  onPlayNoteOff?: (note: string, octave: number) => void;
  arpEnabled?: boolean;
}

const PianoKeysComponent = forwardRef<HTMLDivElement, PianoKeysProps>(({
  pianoKeys = [],
  selectedTrack,
  onKeyClick,
  keyHeight,
  currentStep,
  isPlaying,
  chordMode,
  activeKeys = new Set<number>(),
  onActiveKeysChange,
  onScroll,
  scrollRef,
  onPlayNote,
  onPlayNoteOff,
  arpEnabled = false
}, ref) => {
  const isMouseDownRef = useRef(false);
  const lastPressedKeyRef = useRef<number | null>(null);
  const { playNote } = useAudio();

  const handleKeyDown = useCallback((keyIndex: number) => {
    const key = pianoKeys[keyIndex];

    if (!key) return;
    
    if (onPlayNote) {
      onPlayNote(key.note, key.octave);
    } else {
      playNote(key.note, key.octave, 0.3, selectedTrack?.instrument || 'piano', 0.8);
    }

    if (arpEnabled || chordMode) {
      const newSet = new Set(activeKeys);
      if (!newSet.has(keyIndex)) {
        newSet.add(keyIndex);
        onActiveKeysChange(newSet);
      }
    } else {
      onKeyClick(keyIndex);
    }
  }, [activeKeys, arpEnabled, chordMode, onActiveKeysChange, onKeyClick, pianoKeys, playNote, onPlayNote, selectedTrack?.instrument]);

  const handleKeyUp = useCallback((keyIndex: number) => {
    const key = pianoKeys[keyIndex];
    if (!key) return;

    if (onPlayNoteOff) {
      onPlayNoteOff(key.note, key.octave);
    }

    if (arpEnabled) {
      const newSet = new Set(activeKeys);
      newSet.delete(keyIndex);
      onActiveKeysChange(newSet);
    }
  }, [arpEnabled, activeKeys, onActiveKeysChange, onPlayNoteOff, pianoKeys]);

  const handleMouseDownKey = useCallback((keyIndex: number) => {
    isMouseDownRef.current = true;

    const previousKey = lastPressedKeyRef.current;
    if (previousKey !== null && previousKey !== keyIndex) {
      handleKeyUp(previousKey);
    }

    handleKeyDown(keyIndex);
    lastPressedKeyRef.current = keyIndex;
  }, [handleKeyDown, handleKeyUp]);

  const handleMouseEnterKey = useCallback((keyIndex: number) => {
    if (!isMouseDownRef.current) return;

    const previousKey = lastPressedKeyRef.current;
    if (previousKey === keyIndex) return;

    if (previousKey !== null) {
      handleKeyUp(previousKey);
    }

    handleKeyDown(keyIndex);
    lastPressedKeyRef.current = keyIndex;
  }, [handleKeyDown, handleKeyUp]);

  const handleMouseRelease = useCallback(() => {
    isMouseDownRef.current = false;

    const previousKey = lastPressedKeyRef.current;
    if (previousKey !== null) {
      handleKeyUp(previousKey);
      lastPressedKeyRef.current = null;
    }
  }, [handleKeyUp]);

  // Memoize rendered keys to prevent re-rendering all keys on every update
  const renderedKeys = useMemo(() => {
    return pianoKeys.map((key, index) => {
      const yPosition = index * keyHeight;
      const isActive = activeKeys.has(index);
      const whiteKeyStyle: CSSProperties = {
        position: 'absolute' as const,
        top: `${yPosition}px`,
        left: 0,
        right: 0,
        height: `${keyHeight}px`,
        boxSizing: 'border-box',
        borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
        backgroundColor: isActive ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.02)',
        color: isActive ? '#fff' : 'rgba(6, 182, 212, 0.4)',
        zIndex: 1,
        transition: 'all 0.1s ease',
      };

      const blackKeyStyle: CSSProperties = {
        position: 'absolute' as const,
        top: `${yPosition}px`,
        left: 0,
        height: `${keyHeight}px`,
        width: '65%',
        boxSizing: 'border-box',
        backgroundColor: isActive ? '#06b6d4' : '#000',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        boxShadow: isActive ? '0 0 15px #06b6d4' : 'none',
        zIndex: 10,
        transition: 'all 0.1s ease',
      };

      return (
        <button
          key={key.key}
          className="w-full text-xs font-semibold relative select-none"
          style={key.isBlack ? blackKeyStyle : whiteKeyStyle}
          onClick={() => {
            // Prevent duplicate playback from click after mouse down/up sequence
          }}
          onMouseDown={() => handleMouseDownKey(index)}
          onMouseUp={handleMouseRelease}
          onMouseLeave={() => {
            if (arpEnabled) handleMouseRelease();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleMouseDownKey(index);
          }}
          onTouchEnd={handleMouseRelease}
          onMouseEnter={() => handleMouseEnterKey(index)}
          aria-label={`Piano key ${key.note}${key.octave}${isActive ? ' - Active' : ''}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleKeyDown(index);
            }
          }}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <span
              className={`${
                key.isBlack ? 'text-white opacity-90' : 'text-cyan-500 opacity-90'
              } ${isActive ? 'font-extrabold text-white' : ''}`}
            >
              {key.key}
            </span>
            {isActive && (
              <span className="text-[10px] font-extrabold text-white mt-0.5 animate-pulse">
                ♪
              </span>
            )}
          </div>
        </button>
      );
    });
  }, [pianoKeys, keyHeight, activeKeys, arpEnabled, handleKeyDown, handleMouseDownKey, handleMouseEnterKey, handleMouseRelease]);

  return (
    <div 
      ref={scrollRef || ref}
      className="w-28 bg-black border-r border-cyan-500/30 shadow-2xl overflow-y-auto astutely-scrollbar"
      onScroll={onScroll}
      style={{ borderTop: 'none' }}
    >
      {/* Spacer to match step header height */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-sm border-b border-cyan-500/20" style={{ height: '30px' }} />
      
      <div className="relative" style={{ height: `${pianoKeys.length * keyHeight}px` }}>
        {renderedKeys}
      </div>
    </div>
  );
});

// Memoize component to prevent unnecessary re-renders
export const PianoKeys = memo(PianoKeysComponent, (prevProps, nextProps) => {
  return (
    prevProps.keyHeight === nextProps.keyHeight &&
    prevProps.currentStep === nextProps.currentStep &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.chordMode === nextProps.chordMode &&
    prevProps.arpEnabled === nextProps.arpEnabled &&
    prevProps.activeKeys === nextProps.activeKeys &&
    prevProps.pianoKeys === nextProps.pianoKeys &&
    prevProps.selectedTrack?.instrument === nextProps.selectedTrack?.instrument
  );
});

