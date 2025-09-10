import React from 'react';
import { Slider } from "@/components/ui/slider";
import { Track } from './types/pianoRollTypes';

interface TrackControlsProps {
  tracks: Track[];
  selectedTrack: number;
  onTrackSelect: (index: number) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle: (trackId: string) => void;
}

export const TrackControls: React.FC<TrackControlsProps> = ({
  tracks,
  selectedTrack,
  onTrackSelect,
  onVolumeChange,
  onMuteToggle
}) => {
  return (
    <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            Track: {tracks[selectedTrack]?.name}
          </span>
          <span className="text-sm text-gray-400">
            Notes: {tracks[selectedTrack]?.notes.length || 0}
          </span>
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
