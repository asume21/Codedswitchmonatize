import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import VerticalPianoRoll from '../VerticalPianoRoll';

import type { Note } from '../types/pianoRollTypes';

interface PianoRollTrack {
  id: string;
  name: string;
  instrument: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  notes: Note[];
}

interface PianoRollPluginProps {
  tracks: PianoRollTrack[];
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
  selectedTrack: string;
  isPlaying: boolean;
  onPlayNote: (note: string, octave: number, duration: number, instrument?: string) => void;
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
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
        🎹 Advanced Piano Roll
      </h3>

      <div className="bg-gray-900/70 rounded-lg p-4 shadow-inner border border-gray-700/60">
        <VerticalPianoRoll
          tracks={tracks}
          notes={notes}
          onNotesChange={onNotesChange}
          selectedTrack={selectedTrack}
          isPlaying={isPlaying}
          onPlayNote={onPlayNote}
          noteDuration={noteDuration}
          className="h-[520px] xl:h-[600px]"
        />
      </div>
    </div>
  );
}
