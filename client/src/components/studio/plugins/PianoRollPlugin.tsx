import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import VerticalPianoRoll from '../VerticalPianoRoll';

import type { Note } from '../types/pianoRollTypes';

interface Track {
  id: string;
  name: string;
  instrument: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

interface PianoRollPluginProps {
  tracks: Track[];
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
  selectedTrack: string;
  isPlaying: boolean;
  onPlayNote: (note: string, octave: number, duration: number, instrument: string) => void;
}

export function PianoRollPlugin({ 
  tracks,
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
      note: note,
      octave: octave,
      step: 0,
      velocity: 0.8,
      length: noteDuration
    };
    
    onNotesChange([...notes, newNote]);
  };

  const addNote = (note: string, octave: number) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random()}`,
      note: note,
      octave: octave,
      step: 0,
      velocity: 0.8,
      length: noteDuration
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
    // Since we don't have trackId in the new Note interface,
    // we'll clear all notes when this is called
    onNotesChange([]);
  };

  const trackNotes = notes; // Return all notes since we don't have trackId filtering in the new interface

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
        🎹 Advanced Piano Roll
      </h3>

      {/* Use the full VerticalPianoRoll component with proper props */}
      <VerticalPianoRoll
        tracks={tracks}
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
