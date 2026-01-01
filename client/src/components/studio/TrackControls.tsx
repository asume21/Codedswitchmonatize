import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Track, AVAILABLE_INSTRUMENTS } from './types/pianoRollTypes';
import { AstutelyKnob, AstutelyLedButton } from '@/components/astutely/AstutelyControls';

interface TrackControlsProps {
  tracks: Track[];
  selectedTrack: number;
  onTrackSelect: (index: number) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onMuteToggle: (trackId: string) => void;
  onInstrumentChange: (trackId: string, instrument: string) => void;
  showTrackList?: boolean;
}

export const TrackControls: React.FC<TrackControlsProps> = ({
  tracks,
  selectedTrack,
  onTrackSelect,
  onVolumeChange,
  onMuteToggle,
  onInstrumentChange,
  showTrackList = true
}) => {
  const track = tracks[selectedTrack];
  const sidebarMode = !showTrackList;

  // Group instruments by category
  const instrumentsByCategory = AVAILABLE_INSTRUMENTS.reduce((acc, inst) => {
    if (!acc[inst.category]) acc[inst.category] = [];
    acc[inst.category].push(inst);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_INSTRUMENTS>);

  if (!track) {
    return null;
  }

  return (
    <div className="p-2 bg-gray-800 rounded border border-gray-600">
      <div className={sidebarMode ? "flex flex-col gap-2" : "flex items-center justify-between mb-4"}>
        <div className={sidebarMode ? "flex flex-col gap-2" : "flex items-center gap-4"}>
          <span className="text-sm font-medium">
            Track: {track.name}
          </span>
          <div className="w-full min-w-0">
            <Select
              value={track.instrument}
              onValueChange={(value) => onInstrumentChange(track.id, value)}
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
        <div className={sidebarMode ? "flex items-center justify-between gap-2" : "flex items-center gap-3"}>
          <AstutelyLedButton
            active={track.muted}
            tone={track.muted ? 'red' : 'cyan'}
            size="sm"
            onClick={() => onMuteToggle(track.id)}
            aria-label={track.muted ? 'Unmute track' : 'Mute track'}
          >
            MUTE
          </AstutelyLedButton>

          <AstutelyKnob
            label="VOL"
            value={track.volume || 0}
            onValueChange={(value) => onVolumeChange(track.id, value)}
            min={0}
            max={100}
            step={1}
            size={46}
            unit="%"
            tone="cyan"
          />
        </div>
      </div>
      
      {showTrackList && (
        <div className="mt-3">
          <span className="text-sm font-medium mb-2 block">Tracks:</span>
          <div className="flex flex-wrap gap-2">
            {tracks.map((track, index) => (
              <AstutelyLedButton
                key={track.id}
                active={selectedTrack === index}
                tone={selectedTrack === index ? 'cyan' : 'cyan'}
                size="sm"
                onClick={() => onTrackSelect(index)}
                aria-label={`Select ${track.name} track`}
                aria-pressed={selectedTrack === index}
              >
                {track.name}
              </AstutelyLedButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
