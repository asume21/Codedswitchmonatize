import React from 'react';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Track, AVAILABLE_INSTRUMENTS } from './types/pianoRollTypes';

interface TrackControlsProps {
  tracks: Track[];
  selectedTrack: number;
  onTrackSelect: (index: number) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle: (trackId: string) => void;
  onInstrumentChange: (trackId: string, instrument: string) => void;
}

export const TrackControls: React.FC<TrackControlsProps> = ({
  tracks,
  selectedTrack,
  onTrackSelect,
  onVolumeChange,
  onMuteToggle,
  onInstrumentChange
}) => {
  // Group instruments by category
  const instrumentsByCategory = AVAILABLE_INSTRUMENTS.reduce((acc, inst) => {
    if (!acc[inst.category]) acc[inst.category] = [];
    acc[inst.category].push(inst);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_INSTRUMENTS>);

  return (
    <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-600">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            Track: {tracks[selectedTrack]?.name}
          </span>
          <div className="w-48">
            <Select
              value={tracks[selectedTrack]?.instrument}
              onValueChange={(value) => onInstrumentChange(tracks[selectedTrack]?.id, value)}
            >
              <SelectTrigger className="h-8 text-xs bg-gray-700 border-gray-600">
                <SelectValue placeholder="Select Instrument" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {Object.entries(instrumentsByCategory).map(([category, instruments]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 bg-gray-800/50">
                      {category}
                    </div>
                    {instruments.map((inst) => (
                      <SelectItem key={inst.value} value={inst.value} className="text-xs pl-4">
                        {inst.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onMuteToggle(tracks[selectedTrack]?.id)}
            className={`px-2 py-1 text-xs rounded ${
              tracks[selectedTrack]?.muted 
                ? 'bg-red-600 hover:bg-red-500' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            aria-label={tracks[selectedTrack]?.muted ? 'Unmute track' : 'Mute track'}
          >
            {tracks[selectedTrack]?.muted ? '🔇' : '🔊'}
          </button>
          <span className="text-sm">Volume:</span>
          <Slider
            value={[tracks[selectedTrack]?.volume || 80]}
            onValueChange={(value) => onVolumeChange(tracks[selectedTrack]?.id, value[0])}
            min={0}
            max={100}
            step={1}
            className="w-20"
            aria-label="Track volume"
          />
          <span className="text-sm w-8">
            {tracks[selectedTrack]?.volume}%
          </span>
        </div>
      </div>
      
      <div className="mt-3">
        <span className="text-sm font-medium mb-2 block">Tracks:</span>
        <div className="flex flex-wrap gap-2">
          {tracks.map((track, index) => (
            <button
              key={track.id}
              onClick={() => onTrackSelect(index)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                selectedTrack === index
                  ? `${track.color} text-white`
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              aria-label={`Select ${track.name} track`}
              aria-pressed={selectedTrack === index}
            >
              {track.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
