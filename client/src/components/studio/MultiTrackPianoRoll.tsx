import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

// General MIDI instrument list (subset for demo, easy to expand)
const GM_INSTRUMENTS = [
  { value: 'acoustic_grand_piano', label: 'Acoustic Grand Piano' },
  { value: 'electric_piano', label: 'Electric Piano' },
  { value: 'organ', label: 'Organ' },
  { value: 'acoustic_guitar', label: 'Acoustic Guitar' },
  { value: 'electric_guitar', label: 'Electric Guitar' },
  { value: 'electric_bass', label: 'Electric Bass' },
  { value: 'violin', label: 'Violin' },
  { value: 'synth_lead', label: 'Synth Lead' },
  { value: 'synth_pad', label: 'Synth Pad' },
  { value: 'drums', label: 'Drums' },
];

// Demo note and track types
export type PianoRollNote = {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
};

export type PianoRollTrack = {
  id: string;
  name: string;
  instrument: string;
  color: string;
  notes: PianoRollNote[];
  muted: boolean;
  solo: boolean;
};

export type MultiTrackPianoRollData = {
  tracks: PianoRollTrack[];
  length: number;
};

interface MultiTrackPianoRollProps {
  data: MultiTrackPianoRollData;
  onChange?: (data: MultiTrackPianoRollData) => void;
}

// Simple color palette for tracks
const TRACK_COLORS = ['#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1', '#955251', '#B565A7', '#009B77', '#DD4124', '#45B8AC'];

export default function MultiTrackPianoRoll({ data, onChange }: MultiTrackPianoRollProps) {
  const [selectedTrack, setSelectedTrack] = useState(data.tracks[0]?.id);

  const handleInstrumentChange = (trackId: string, instrument: string) => {
    if (!onChange) return;
    const newData = {
      ...data,
      tracks: data.tracks.map(t => t.id === trackId ? { ...t, instrument } : t),
    };
    onChange(newData);
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Multi-Track Piano Roll (Demo)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.tracks.map((track, idx) => (
            <div key={track.id} className="flex items-center gap-4 border-b pb-2 mb-2" style={{ background: track.muted ? '#eee' : track.color + '22' }}>
              <div style={{ width: 16, height: 16, background: track.color, borderRadius: 4 }} />
              <span className="font-medium" style={{ minWidth: 100 }}>{track.name}</span>
              <Select value={track.instrument} onValueChange={val => handleInstrumentChange(track.id, val)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GM_INSTRUMENTS.map(instr => (
                    <SelectItem key={instr.value} value={instr.value}>{instr.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant={track.muted ? 'secondary' : 'ghost'} onClick={() => { if (onChange) onChange({ ...data, tracks: data.tracks.map(t => t.id === track.id ? { ...t, muted: !t.muted } : t) }); }}>{track.muted ? 'Unmute' : 'Mute'}</Button>
              <Button size="sm" variant={track.solo ? 'secondary' : 'ghost'} onClick={() => { if (onChange) onChange({ ...data, tracks: data.tracks.map(t => t.id === track.id ? { ...t, solo: !t.solo } : { ...t, solo: false }) }); }}>{track.solo ? 'Unsolo' : 'Solo'}</Button>
            </div>
          ))}
        </div>
        <div className="mt-6">
          {/* Piano roll grid (demo): Each track is a row, notes are colored blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.tracks.map((track, idx) => (
              <div key={track.id} style={{ display: 'flex', alignItems: 'center', height: 32 }}>
                <div style={{ width: 32, textAlign: 'right', color: track.color }}>{track.name[0]}</div>
                <div style={{ flex: 1, position: 'relative', height: 24, background: '#f9f9f9', borderRadius: 4, marginLeft: 8 }}>
                  {track.notes.map(note => (
                    <div key={note.id} title={`Pitch: ${note.pitch}\nVelocity: ${note.velocity}`} style={{
                      position: 'absolute',
                      left: `${(note.start / data.length) * 100}%`,
                      width: `${(note.duration / data.length) * 100}%`,
                      top: 2,
                      height: 20,
                      background: track.color,
                      opacity: Math.max(0.4, note.velocity / 127),
                      borderRadius: 3,
                      border: '1px solid #aaa',
                      cursor: 'pointer',
                    }} />
                  ))}
                </div>
                {/* Velocity lane (demo): slider for each note */}
                <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
                  {track.notes.map(note => (
                    <Slider key={note.id} value={[note.velocity]} max={127} min={1} step={1} className="w-16" onValueChange={val => {
                      if (onChange) {
                        onChange({ ...data, tracks: data.tracks.map(t => t.id === track.id ? { ...t, notes: t.notes.map(n => n.id === note.id ? { ...n, velocity: val[0] } : n) } : t) });
                      }
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo data for integration
export const demoMultiTrackData: MultiTrackPianoRollData = {
  length: 32,
  tracks: [
    {
      id: 'track1',
      name: 'Piano',
      instrument: 'acoustic_grand_piano',
      color: TRACK_COLORS[0],
      notes: [
        { id: 'n1', pitch: 60, start: 0, duration: 4, velocity: 100 },
        { id: 'n2', pitch: 64, start: 4, duration: 4, velocity: 80 },
        { id: 'n3', pitch: 67, start: 8, duration: 4, velocity: 110 },
      ],
      muted: false,
      solo: false,
    },
    {
      id: 'track2',
      name: 'Guitar',
      instrument: 'electric_guitar',
      color: TRACK_COLORS[1],
      notes: [
        { id: 'n4', pitch: 55, start: 2, duration: 4, velocity: 90 },
        { id: 'n5', pitch: 59, start: 6, duration: 4, velocity: 70 },
      ],
      muted: false,
      solo: false,
    },
    {
      id: 'track3',
      name: 'Drums',
      instrument: 'drums',
      color: TRACK_COLORS[2],
      notes: [
        { id: 'n6', pitch: 36, start: 0, duration: 2, velocity: 120 },
        { id: 'n7', pitch: 38, start: 4, duration: 2, velocity: 110 },
      ],
      muted: false,
      solo: false,
    },
  ],
};
