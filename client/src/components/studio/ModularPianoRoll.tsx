import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, StopCircle, Circle, Repeat } from 'lucide-react';
import { useAudio } from '@/hooks/use-audio';
import { AVAILABLE_INSTRUMENTS } from './types/pianoRollTypes';

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
  const [selectedInstrument, setSelectedInstrument] = useState('piano');

  // Group instruments by category for the dropdown
  const instrumentsByCategory = AVAILABLE_INSTRUMENTS.reduce((acc, inst) => {
    if (!acc[inst.category]) acc[inst.category] = [];
    acc[inst.category].push(inst);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_INSTRUMENTS>);

  const handlePlay = () => {
    setIsPlaying(true);
    // Simple sequential playback for demo
    notes.forEach((note, idx) => {
      setTimeout(() => {
        playNote && playNote('C', 4, note.duration / 2, selectedInstrument, note.velocity / 127, true);
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
        playNote && playNote('C', 4, note.duration / 2, selectedInstrument, note.velocity / 127, true);
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
        <div className="flex gap-2 mb-3 items-center flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select Instrument" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {Object.entries(instrumentsByCategory).map(([category, instruments]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 bg-gray-800/50">
                      {category}
                    </div>
                    {instruments.map((inst) => (
                      <SelectItem key={inst.value} value={inst.value} className="text-sm pl-4">
                        {inst.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mb-2">
          <Button size="sm" onClick={onAISuggest}>AI Suggest</Button>
          <Button size="sm" onClick={() => onNotesChange && onNotesChange([])}>Clear</Button>
          <Button size="sm" onClick={handlePlay} disabled={isPlaying}><Play className="w-4 h-4 mr-1" /> Play</Button>
          <Button size="sm" onClick={handleRecord} disabled={isRecording}><Circle className="w-4 h-4 mr-1" /> {isRecording ? 'Recording...' : 'Pedal Record'}</Button>
          <Button size="sm" onClick={handlePlayLoop} disabled={isPlaying || loop.length === 0}><Repeat className="w-4 h-4 mr-1" /> Play Loop</Button>
        </div>
      </CardContent>
    </Card>
  );
}
