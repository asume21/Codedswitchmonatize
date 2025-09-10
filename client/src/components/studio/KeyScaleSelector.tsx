import React from 'react';
import { KeyType, DEFAULT_customKeys, CIRCLE_OF_FIFTHS } from './types/pianoRollTypes';

interface KeyScaleSelectorProps {
  currentKey: string;
  onKeyChange: (key: KeyType) => void;
  selectedProgression: {
    id: string;
    name: string;
    chords: string[];
    key: string;
  };
  onProgressionChange: (progression: any) => void;
  chordProgressions: Array<{
    id: string;
    name: string;
    chords: string[];
    key: string;
  }>;
}

export const KeyScaleSelector: React.FC<KeyScaleSelectorProps> = ({
  currentKey,
  onKeyChange,
  selectedProgression,
  onProgressionChange,
  chordProgressions
}) => {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex flex-col">
        <label htmlFor="key-select" className="text-sm text-gray-400 mb-1">
          Key:
        </label>
        <select
          id="key-select"
          value={currentKey}
          onChange={(e) => onKeyChange(e.target.value as KeyType)}
          className="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600"
          aria-label="Select musical key"
        >
          {Object.entries(DEFAULT_customKeys).map(([key, data]) => (
            <option key={key} value={key}>
              {data.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <span className="text-sm text-gray-400 mb-1">Circle of Fifths:</span>
        <div className="flex flex-wrap gap-1">
          {CIRCLE_OF_FIFTHS.map((key) => (
            <button
              key={key}
              onClick={() => onKeyChange(key as KeyType)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                currentKey === key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              aria-label={`Set key to ${key}`}
              aria-pressed={currentKey === key}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        <label htmlFor="progression-select" className="text-sm text-gray-400 mb-1">
          Progression:
        </label>
        <select
          id="progression-select"
          value={selectedProgression.id}
          onChange={(e) => {
            const prog = chordProgressions.find(p => p.id === e.target.value);
            if (prog) onProgressionChange(prog);
          }}
          className="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600"
          aria-label="Select chord progression"
        >
          {chordProgressions.map((prog) => (
            <option key={prog.id} value={prog.id}>
              {prog.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default KeyScaleSelector;
