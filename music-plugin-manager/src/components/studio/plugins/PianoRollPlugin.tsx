import React, { useState } from 'react';
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
  { note: 'C', octave: 5, isBlack: false },
  { note: 'C#', octave: 5, isBlack: true },
  { note: 'D', octave: 5, isBlack: false },
  { note: 'D#', octave: 5, isBlack: true },
  { note: 'E', octave: 5, isBlack: false },
  { note: 'F', octave: 5, isBlack: false },
  { note: 'F#', octave: 5, isBlack: true },
  { note: 'G', octave: 5, isBlack: false },
  { note: 'G#', octave: 5, isBlack: true },
  { note: 'A', octave: 5, isBlack: false },
  { note: 'A#', octave: 5, isBlack: true },
  { note: 'B', octave: 5, isBlack: false },
  { note: 'C', octave: 4, isBlack: false },
  { note: 'C#', octave: 4, isBlack: true },
  { note: 'D', octave: 4, isBlack: false },
  { note: 'D#', octave: 4, isBlack: true },
  { note: 'E', octave: 4, isBlack: false },
  { note: 'F', octave: 4, isBlack: false },
  { note: 'F#', octave: 4, isBlack: true },
  { note: 'G', octave: 4, isBlack: false },
  { note: 'G#', octave: 4, isBlack: true },
  { note: 'A', octave: 4, isBlack: false },
  { note: 'A#', octave: 4, isBlack: true },
  { note: 'B', octave: 4, isBlack: false },
];

export function PianoRollPlugin({ 
  notes, 
  onNotesChange, 
  selectedTrack, 
  isPlaying, 
  onPlayNote 
}: PianoRollPluginProps) {
  const [noteDuration, setNoteDuration] = useState(0.5);

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
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(parseFloat(e.target.value))}
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
        <h4 className="text-sm font-medium mb-3 text-gray-300">Virtual Piano</h4>
        <div className="flex flex-wrap gap-1">
          {PIANO_KEYS.map((key, index) => (
            <button
              key={`${key.note}${key.octave}-${index}`}
              onClick={() => addNote(key.note, key.octave)}
              className={`
                px-3 py-6 text-xs font-medium rounded transition-all
                ${key.isBlack 
                  ? 'bg-gray-900 text-white border border-gray-600 hover:bg-gray-700' 
                  : 'bg-white text-black border border-gray-300 hover:bg-gray-100'
                }
                ${isPlaying ? 'animate-pulse' : ''}
              `}
            >
              {key.note}{key.octave}
            </button>
          ))}
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
