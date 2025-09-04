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
<<<<<<< HEAD
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3 text-white flex items-center">
        🎛️ Multi-Track Controls
        <span className="ml-2 text-xs bg-green-600 px-2 py-1 rounded">PLUGIN</span>
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
=======
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
        🎛️ Multi-Track Controls
        <span className="ml-2 text-sm bg-green-600 px-2 py-1 rounded">PLUGIN</span>
      </h3>
      
      <div className="space-y-4">
>>>>>>> 8485ec252f45f5cb49fc4fc23695ca7bb13fbcc6
        {tracks.map((track) => (
          <div 
            key={track.id}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedTrack === track.id 
                ? 'border-blue-500 bg-gray-700' 
                : 'border-gray-600 bg-gray-750'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => onTrackSelect(track.id)}
                  variant={selectedTrack === track.id ? "default" : "outline"}
                  size="sm"
                  className="min-w-[80px]"
                >
                  {track.name}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Volume: {track.volume}%</label>
                <Slider
                  value={[track.volume]}
                  onValueChange={([value]) => onTrackUpdate(track.id, { volume: value })}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-400 mb-1">Pan: {track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}{Math.abs(track.pan)}</label>
                <Slider
                  value={[track.pan]}
                  onValueChange={([value]) => onTrackUpdate(track.id, { pan: value })}
                  min={-50}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-gray-700 rounded text-center">
        <p className="text-sm text-gray-300">
          ✅ Multi-Track System Active | Selected: <strong>{tracks.find(t => t.id === selectedTrack)?.name}</strong>
        </p>
      </div>
    </div>
  );
}
