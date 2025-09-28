import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

// General MIDI instrument list (subset for MVP)
const GM_INSTRUMENTS = [
  { value: 'acoustic_grand_piano', label: 'Acoustic Grand Piano' },
  { value: 'electric_piano', label: 'Electric Piano' },
  { value: 'organ', label: 'Organ' },
  { value: 'electric_guitar', label: 'Electric Guitar' },
  { value: 'electric_bass', label: 'Electric Bass' },
  { value: 'violin', label: 'Violin' },
  { value: 'synth_lead', label: 'Synth Lead' },
  { value: 'drums', label: 'Drums' },
];

// DAW-style data model
export type DAWNote = {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
};

export type DAWTrack = {
  id: string;
  name: string;
  instrument: string;
  color: string;
  notes: DAWNote[];
  muted: boolean;
  solo: boolean;
  type: 'midi' | 'drum' | 'automation';
};

export type DAWSession = {
  tracks: DAWTrack[];
  length: number;
  zoom: number;
  scroll: number;
};

interface DAWMultiTrackPianoRollProps {
  session: DAWSession;
  onSessionChange?: (session: DAWSession) => void;
  onRequestAIGenerate?: (trackId: string) => void; // AI integration hook
}

const TRACK_COLORS = ['#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1', '#955251', '#B565A7', '#009B77'];

export default function DAWMultiTrackPianoRoll({ session, onSessionChange, onRequestAIGenerate }: DAWMultiTrackPianoRollProps) {
  const [selectedTrack, setSelectedTrack] = useState(session.tracks[0]?.id);

  const handleInstrumentChange = (trackId: string, instrument: string) => {
    if (!onSessionChange) return;
    onSessionChange({
      ...session,
      tracks: session.tracks.map(t => t.id === trackId ? { ...t, instrument } : t),
    });
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>DAW Multi-Track Piano Roll</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {session.tracks.map((track, idx) => (
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
              <Button size="sm" variant={track.muted ? 'secondary' : 'ghost'} onClick={() => { if (onSessionChange) onSessionChange({ ...session, tracks: session.tracks.map(t => t.id === track.id ? { ...t, muted: !t.muted } : t) }); }}>{track.muted ? 'Unmute' : 'Mute'}</Button>
              <Button size="sm" variant={track.solo ? 'secondary' : 'ghost'} onClick={() => { if (onSessionChange) onSessionChange({ ...session, tracks: session.tracks.map(t => t.id === track.id ? { ...t, solo: !t.solo } : { ...t, solo: false }) }); }}>{track.solo ? 'Unsolo' : 'Solo'}</Button>
              <Button size="sm" variant="outline" onClick={() => onRequestAIGenerate && onRequestAIGenerate(track.id)}>
                AI Suggest
              </Button>
            </div>
          ))}
        </div>
        {/* Full piano roll grid and editing UI would go here (MVP: just show track rows for now) */}
        <div className="mt-6 text-gray-400 text-sm">[Piano roll grid and editing coming next]</div>
      </CardContent>
    </Card>
  );
}

export const demoDAWSession: DAWSession = {
  length: 32,
  zoom: 1,
  scroll: 0,
  tracks: [
    {
      id: 'track1',
      name: 'Piano',
      instrument: 'acoustic_grand_piano',
      color: TRACK_COLORS[0],
      notes: [],
      muted: false,
      solo: false,
      type: 'midi',
    },
    {
      id: 'track2',
      name: 'Drums',
      instrument: 'drums',
      color: TRACK_COLORS[1],
      notes: [],
      muted: false,
      solo: false,
      type: 'drum',
    },
    {
      id: 'track3',
      name: 'Automation',
      instrument: 'automation',
      color: TRACK_COLORS[2],
      notes: [],
      muted: false,
      solo: false,
      type: 'automation',
    },
  ],
};
