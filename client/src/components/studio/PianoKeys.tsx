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
    <div className="w-20 bg-gray-800 border-r border-gray-600 overflow-y-auto">
      <div className="relative">
        {pianoKeys.map((key, index) => (
          <button
            key={key.key}
            className={`w-full text-xs font-mono border-b border-gray-600 hover:bg-gray-600 transition-colors
              ${key.isBlack
                ? 'bg-gray-900 text-gray-300 border-l-4 border-l-gray-700'
                : 'bg-gray-700 text-white'
              }
              ${isPlaying && currentStep % STEPS === 0 ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
            `}
            style={{ height: `${keyHeight}px` }}
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
            {key.key}
          </button>
        ))}
      </div>
    </div>
  );
};
