import React, { useCallback } from 'react';
import { PianoKey, Note, Track, STEPS } from './types/pianoRollTypes';
import { realisticAudio } from '@/lib/realisticAudio';

interface PianoKeysProps {
  pianoKeys: PianoKey[];
  selectedTrack: Track;
  onKeyClick: (keyIndex: number, step?: number) => void;
  keyHeight: number;
  currentStep: number;
  isPlaying: boolean;
}

export const PianoKeys: React.FC<PianoKeysProps> = ({
  pianoKeys,
  selectedTrack,
  onKeyClick,
  keyHeight,
  currentStep,
  isPlaying
}) => {
  const handleKeyClick = useCallback((keyIndex: number) => {
    onKeyClick(keyIndex);
  }, [onKeyClick]);

  const playKeyPreview = useCallback((key: PianoKey) => {
    realisticAudio.playNote(
      key.note,
      key.octave,
      0.8,
      selectedTrack?.instrument || 'piano',
      0.8
    );
  }, [selectedTrack?.instrument]);

  return (
    <div className="w-24 bg-gradient-to-b from-gray-900 to-black border-r-2 border-gray-700 overflow-y-auto shadow-2xl">
      <div className="relative">
        {pianoKeys.map((key, index) => (
          <button
            key={key.key}
            className={`
              w-full text-xs font-semibold transition-all duration-150 relative
              ${key.isBlack
                ? 'bg-gradient-to-b from-gray-900 via-black to-gray-950 text-gray-400 border-l-4 border-l-black shadow-lg hover:from-gray-800 hover:via-gray-900 active:from-black active:via-gray-950'
                : 'bg-gradient-to-b from-gray-100 via-white to-gray-50 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 shadow-inner hover:from-gray-50 hover:via-gray-100 dark:hover:from-gray-600 dark:hover:via-gray-500 active:from-gray-200 active:via-gray-300 dark:active:from-gray-800 dark:active:via-gray-700'
              }
              ${key.isBlack ? 'ml-2 mr-2 z-10' : 'z-0'}
              ${isPlaying && currentStep % STEPS === 0 ? 'ring-2 ring-blue-400 ring-opacity-60' : ''}
            `}
            style={{ 
              height: `${keyHeight}px`,
              boxShadow: key.isBlack 
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.3)' 
                : '0 1px 3px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
            }}
            onClick={() => handleKeyClick(index)}
            onMouseEnter={() => playKeyPreview(key)}
            aria-label={`Piano key ${key.note}${key.octave}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleKeyClick(index);
              }
            }}
          >
            <span className={key.isBlack ? 'opacity-70' : 'opacity-80'}>
              {key.key}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
