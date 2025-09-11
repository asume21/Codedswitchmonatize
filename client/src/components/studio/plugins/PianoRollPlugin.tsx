import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import VerticalPianoRoll from '../VerticalPianoRoll';

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

  const addNote = (note: string, octave: number) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random()}`,
      pitch: (octave * 12) + getPitchOffset(note),
      start: 0,
      duration: noteDuration,
      velocity: 0.8,
      trackId: selectedTrack
    };

    onNotesChange([...notes, newNote]);
    onPlayNote(note, octave, noteDuration, 'piano');
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
        🎹 Advanced Piano Roll
      </h3>

      {/* Use the full VerticalPianoRoll component with proper props */}
      <VerticalPianoRoll
        notes={notes}
        onNotesChange={onNotesChange}
        selectedTrack={selectedTrack}
        isPlaying={isPlaying}
        onPlayNote={onPlayNote}
        noteDuration={noteDuration}
      />
    </div>
  );
}
