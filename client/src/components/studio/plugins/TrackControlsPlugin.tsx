import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface Track {
  id: string;
  name: string;
  instrument: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

interface TrackControlsPluginProps {
  tracks: Track[];
  onTrackUpdate: (trackId: string, updates: Partial<Track>) => void;
  selectedTrack: string;
  onTrackSelect: (trackId: string) => void;
}

const INSTRUMENTS = [
  { value: 'piano', label: '🎹 Piano' },
  { value: 'guitar', label: '🎸 Guitar' },
  { value: 'bass', label: '🎸 Bass' },
  { value: 'violin', label: '🎻 Violin' },
  { value: 'trumpet', label: '🎺 Trumpet' },
  { value: 'flute', label: '🪈 Flute' },
  { value: 'synth', label: '🎛️ Synth' },
  { value: 'drums', label: '🥁 Drums' }
];

export function TrackControlsPlugin({ 
  tracks,
  onTrackUpdate, 
  selectedTrack, 
  onTrackSelect 
}: TrackControlsPluginProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-5">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
        🎛️ Multi-Track Controls
        <span className="ml-2 text-sm bg-green-600 px-2 py-1 rounded">PLUGIN</span>
      </h3>

      <div className="grid gap-4">
        {tracks.map((track) => (
          <div 
            key={track.id}
            className={`relative overflow-hidden p-5 rounded-xl border-2 transition-all shadow-lg ${
              selectedTrack === track.id 
                ? 'border-blue-400 bg-gray-700/95 ring-2 ring-blue-300/40' 
                : 'border-gray-600 bg-gray-750'
            }`}
          >
            {selectedTrack === track.id && (
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-blue-400/10 via-transparent to-blue-400/10" />
            )}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => onTrackSelect(track.id)}
                  variant={selectedTrack === track.id ? "default" : "outline"}
                  size="sm"
                  className="min-w-[80px] flex flex-col items-start"
                >
                  <span className="text-sm font-semibold">{track.name}</span>
                  <span className="text-[11px] text-white/70">{track.instrument.toUpperCase()}</span>
                </Button>
                
                <Select
                  value={track.instrument}
                  onValueChange={(value) => onTrackUpdate(track.id, { instrument: value })}
                >
                  <SelectTrigger className="w-[140px] bg-gray-600 border-gray-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTRUMENTS.map((inst) => (
                      <SelectItem key={inst.value} value={inst.value}>
                        {inst.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => onTrackUpdate(track.id, { muted: !track.muted })}
                  variant={track.muted ? "destructive" : "outline"}
                  size="sm"
                >
                  {track.muted ? '🔇' : '🔊'}
                </Button>
                
                <Button
                  onClick={() => onTrackUpdate(track.id, { solo: !track.solo })}
                  variant={track.solo ? "default" : "outline"}
                  size="sm"
                  className={track.solo ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                >
                  SOLO
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-gray-300 uppercase tracking-wide">
                  <span>Volume</span>
                  <span className="text-sm font-semibold text-white">{track.volume}%</span>
                </div>
                <Slider
                  value={[track.volume]}
                  onValueChange={([value]) => onTrackUpdate(track.id, { volume: value })}
                  max={100}
                  step={1}
                  className="w-full h-2 [&_.slider-track]:bg-gray-600 [&_.slider-range]:bg-blue-500"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-gray-300 uppercase tracking-wide">
                  <span>Pan</span>
                  <span className="text-sm font-semibold text-white">
                    {track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}{Math.abs(track.pan)}
                  </span>
                </div>
                <Slider
                  value={[track.pan]}
                  onValueChange={([value]) => onTrackUpdate(track.id, { pan: value })}
                  min={-50}
                  max={50}
                  step={1}
                  className="w-full h-2 [&_.slider-track]:bg-gray-600 [&_.slider-range]:bg-purple-500"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400">
              <div className="bg-gray-700/70 rounded-md px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] text-gray-400">Instrument</p>
                <p className="text-white text-sm font-semibold">{track.instrument}</p>
              </div>
              <div className="bg-gray-700/70 rounded-md px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] text-gray-400">Muted</p>
                <p className="text-white text-sm font-semibold">{track.muted ? 'Yes' : 'No'}</p>
              </div>
              <div className="bg-gray-700/70 rounded-md px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] text-gray-400">Solo</p>
                <p className="text-white text-sm font-semibold">{track.solo ? 'Active' : 'Off'}</p>
              </div>
              <div className="bg-gray-700/70 rounded-md px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] text-gray-400">Track ID</p>
                <p className="text-white text-sm font-semibold">{track.id.toUpperCase()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-gray-900/80 rounded-xl border border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm text-gray-300 flex items-center gap-2">
          <span className="text-green-400 text-lg">✅</span>
          <span>
            Multi-Track System Active · Selected Track: <strong>{tracks.find(t => t.id === selectedTrack)?.name}</strong>
          </span>
        </div>
        <div className="flex gap-2 text-xs text-gray-400">
          <span className="bg-gray-700/80 px-2 py-1 rounded">🎚️ Volume & Pan Linked</span>
          <span className="bg-gray-700/80 px-2 py-1 rounded">🔁 Sync with Sequencer</span>
          <span className="bg-gray-700/80 px-2 py-1 rounded">🎹 Piano Roll Ready</span>
        </div>
      </div>
    </div>
  );
}
