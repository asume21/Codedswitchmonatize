import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Note {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
  trackId: string;
}

interface PianoRollPluginProps {
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
  selectedTrack: string;
  isPlaying: boolean;
  onPlayNote: (note: string, octave: number, duration: number, instrument: string) => void;
}

const PIANO_KEYS = [
  { note: 'C', octave: 5, isBlack: false, key: 'z' },
  { note: 'C#', octave: 5, isBlack: true, key: 's' },
  { note: 'D', octave: 5, isBlack: false, key: 'x' },
  { note: 'D#', octave: 5, isBlack: true, key: 'd' },
  { note: 'E', octave: 5, isBlack: false, key: 'c' },
  { note: 'F', octave: 5, isBlack: false, key: 'v' },
  { note: 'F#', octave: 5, isBlack: true, key: 'g' },
  { note: 'G', octave: 5, isBlack: false, key: 'b' },
  { note: 'G#', octave: 5, isBlack: true, key: 'h' },
  { note: 'A', octave: 5, isBlack: false, key: 'n' },
  { note: 'A#', octave: 5, isBlack: true, key: 'j' },
  { note: 'B', octave: 5, isBlack: false, key: 'm' },
  { note: 'C', octave: 4, isBlack: false, key: 'q' },
  { note: 'C#', octave: 4, isBlack: true, key: '2' },
  { note: 'D', octave: 4, isBlack: false, key: 'w' },
  { note: 'D#', octave: 4, isBlack: true, key: '3' },
  { note: 'E', octave: 4, isBlack: false, key: 'e' },
  { note: 'F', octave: 4, isBlack: false, key: 'r' },
  { note: 'F#', octave: 4, isBlack: true, key: '5' },
  { note: 'G', octave: 4, isBlack: false, key: 't' },
  { note: 'G#', octave: 4, isBlack: true, key: '6' },
  { note: 'A', octave: 4, isBlack: false, key: 'y' },
  { note: 'A#', octave: 4, isBlack: true, key: '7' },
  { note: 'B', octave: 4, isBlack: false, key: 'u' },
];

export function PianoRollPlugin({ 
  notes, 
  onNotesChange, 
  selectedTrack, 
  isPlaying, 
  onPlayNote 
}: PianoRollPluginProps) {
  const [noteDuration, setNoteDuration] = useState(0.5);
  const [activePianoKey, setActivePianoKey] = useState<string | null>(null);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const pianoKey = PIANO_KEYS.find(pk => pk.key === key);
      
      if (pianoKey) {
        e.preventDefault();
        playKey(pianoKey.note, pianoKey.octave);
        setActivePianoKey(`${pianoKey.note}${pianoKey.octave}`);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const pianoKey = PIANO_KEYS.find(pk => pk.key === key);
      
      if (pianoKey) {
        setActivePianoKey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [noteDuration, selectedTrack, notes]);

  const playKey = (note: string, octave: number) => {
    onPlayNote(note, octave, noteDuration, 'piano');
    
    // Add note to the selected track
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random()}`,
      pitch: (octave * 12) + ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(note),
      start: Date.now() / 1000,
      duration: noteDuration,
      velocity: 0.8,
      trackId: selectedTrack
    };
    
    onNotesChange([...notes, newNote]);
  };

  const getPitchOffset = (note: string): number => {
    const offsets: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    return offsets[note] || 0;
  };

  const clearNotes = () => {
    onNotesChange(notes.filter(note => note.trackId !== selectedTrack));
  };

  const trackNotes = notes.filter(note => note.trackId === selectedTrack);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
        🎹 Piano Roll
        <span className="ml-2 text-sm bg-green-600 px-2 py-1 rounded">PLUGIN</span>
      </h3>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-300">
            Notes: <span className="font-bold text-white">{trackNotes.length}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">Duration:</label>
            <select 
              value={noteDuration}
              onChange={(e) => setNoteDuration(parseFloat(e.target.value))}
              className="bg-gray-600 text-white px-2 py-1 rounded text-sm"
            >
              <option value={0.25}>1/16</option>
              <option value={0.5}>1/8</option>
              <option value={1}>1/4</option>
              <option value={2}>1/2</option>
              <option value={4}>Whole</option>
            </select>
          </div>
        </div>

        <Button
          onClick={clearNotes}
          variant="outline"
          size="sm"
          className="border-red-600 text-red-400 hover:bg-red-900"
        >
          Clear Track
        </Button>
      </div>

      {/* Virtual Piano */}
      <div className="bg-gray-900 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-medium mb-3 text-gray-300">🎹 Virtual Piano (Press Keys: Q-U, Z-M, 2,3,5,6,7)</h4>
        <div className="flex flex-wrap gap-1">
          {PIANO_KEYS.map((key, index) => {
            const isActive = activePianoKey === `${key.note}${key.octave}`;
            return (
              <button
                key={`${key.note}${key.octave}-${index}`}
                onClick={() => playKey(key.note, key.octave)}
                className={`
                  px-3 py-6 text-xs font-medium rounded transition-all transform
                  ${key.isBlack 
                    ? isActive
                      ? 'bg-yellow-500 text-black border-2 border-yellow-400 scale-105 shadow-lg shadow-yellow-500'
                      : 'bg-gray-900 text-white border border-gray-600 hover:bg-gray-700' 
                    : isActive
                      ? 'bg-yellow-300 text-black border-2 border-yellow-500 scale-105 shadow-lg shadow-yellow-400'
                      : 'bg-white text-black border border-gray-300 hover:bg-gray-100'
                  }
                `}
              >
                <div className="font-bold">{key.note}{key.octave}</div>
                <div className="text-xs mt-1 opacity-75">{key.key}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Note Grid Visualization */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3 text-gray-300">Note Timeline</h4>
        {trackNotes.length > 0 ? (
          <div className="space-y-2">
            {trackNotes.map((note, index) => (
              <div 
                key={note.id}
                className="flex items-center justify-between bg-gray-700 p-2 rounded"
              >
                <div className="text-sm text-white">
                  Note #{index + 1} | Pitch: {note.pitch} | Duration: {note.duration}s
                </div>
                <Button
                  onClick={() => onNotesChange(notes.filter(n => n.id !== note.id))}
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-600 hover:bg-red-900"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p>No notes in this track</p>
            <p className="text-sm">Click piano keys above to add notes</p>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-gray-700 rounded text-center">
        <p className="text-sm text-gray-300">
          ✅ Piano Roll Active | Track: <strong>{selectedTrack}</strong> | Notes: <strong>{trackNotes.length}</strong>
        </p>
      </div>
    </div>
  );
}
