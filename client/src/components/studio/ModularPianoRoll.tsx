import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, StopCircle, Circle, Repeat } from 'lucide-react';
import { useAudio } from '@/hooks/use-audio';

export type PianoRollNote = {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
};

export type PianoRollProps = {
  notes: PianoRollNote[];
  onNotesChange?: (notes: PianoRollNote[]) => void;
  onAISuggest?: () => void;
};

export default function ModularPianoRoll({ notes, onNotesChange, onAISuggest }: PianoRollProps) {
  const { playNote } = useAudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loop, setLoop] = useState<PianoRollNote[]>([]);

  const handlePlay = () => {
    setIsPlaying(true);
    // Simple sequential playback for demo
    notes.forEach((note, idx) => {
      setTimeout(() => {
        playNote && playNote('C', 4, note.duration / 2, 'piano', note.velocity / 127, true); // Replace with real mapping
        if (idx === notes.length - 1) setIsPlaying(false);
      }, note.start * 300); // 300ms per beat (adjust for tempo)
    });
  };

  const handleRecord = () => {
    setIsRecording(true);
    setLoop([]);
    // In a real DAW, you'd capture input events here
    setTimeout(() => {
      setIsRecording(false);
      setLoop(notes); // For demo, just copy current notes
    }, 4000); // 4s loop
  };

  const handlePlayLoop = () => {
    setIsPlaying(true);
    loop.forEach((note, idx) => {
      setTimeout(() => {
        playNote && playNote('C', 4, note.duration / 2, 'piano', note.velocity / 127, true);
        if (idx === loop.length - 1) setIsPlaying(false);
      }, note.start * 300);
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Piano Roll (AI & Manual)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-2">
          <Button size="sm" onClick={onAISuggest}>AI Suggest</Button>
          <Button size="sm" onClick={() => onNotesChange && onNotesChange([])}>Clear</Button>
          <Button size="sm" onClick={handlePlay} disabled={isPlaying}><Play className="w-4 h-4 mr-1" /> Play</Button>
          <Button size="sm" onClick={handleRecord} disabled={isRecording}><Circle className="w-4 h-4 mr-1" /> {isRecording ? 'Recording...' : 'Pedal Record'}</Button>
          <Button size="sm" onClick={handlePlayLoop} disabled={isPlaying || loop.length === 0}><Repeat className="w-4 h-4 mr-1" /> Play Loop</Button>
        </div>
        <div className="text-gray-400 text-sm">[Piano roll grid and note editing coming next]</div>
      </CardContent>
    </Card>
  );
}
