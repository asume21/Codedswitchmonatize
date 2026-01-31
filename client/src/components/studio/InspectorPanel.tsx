/**
 * Inspector Panel Component
 * Shows details and properties of the selected track or element
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, Settings, Volume2, Music, Sliders, 
  Palette, Wand2, Info
} from 'lucide-react';
import { useTracks, type StudioTrack } from '@/hooks/useTracks';

interface InspectorPanelProps {
  onClose: () => void;
  selectedTrackId?: string | null;
}

export default function InspectorPanel({ onClose, selectedTrackId }: InspectorPanelProps) {
  const { tracks, updateTrack } = useTracks();
  const selectedTrack = selectedTrackId ? tracks.find(t => t.id === selectedTrackId) : null;

  const handleVolumeChange = (value: number[]) => {
    if (selectedTrack) {
      updateTrack(selectedTrack.id, { volume: value[0] / 100 });
    }
  };

  const handlePanChange = (value: number[]) => {
    if (selectedTrack) {
      updateTrack(selectedTrack.id, { pan: value[0] / 100 });
    }
  };

  const handleNameChange = (name: string) => {
    if (selectedTrack) {
      updateTrack(selectedTrack.id, { name });
    }
  };

  const handleMuteToggle = (muted: boolean) => {
    if (selectedTrack) {
      updateTrack(selectedTrack.id, { muted });
    }
  };

  const handleSoloToggle = (solo: boolean) => {
    if (selectedTrack) {
      updateTrack(selectedTrack.id, { solo });
    }
  };

  return (
    <div className="w-72 h-full bg-black/95 border-l border-cyan-500/40 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-cyan-500/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cyan-100 flex items-center gap-2">
          <Settings className="w-4 h-4 text-cyan-400" />
          Inspector
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-4 h-4 text-cyan-400" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {selectedTrack ? (
          <div className="p-4 space-y-6">
            {/* Track Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Music className="w-3 h-3" />
                Track Info
              </h4>
              <div className="space-y-2">
                <Label className="text-xs text-cyan-300">Name</Label>
                <Input
                  value={selectedTrack.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="h-8 bg-black/60 border-cyan-500/40 text-cyan-100 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-cyan-300">Type</span>
                <span className="text-xs text-cyan-100 bg-cyan-500/20 px-2 py-0.5 rounded">
                  {selectedTrack.type}
                </span>
              </div>
              {selectedTrack.kind && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-cyan-300">Kind</span>
                  <span className="text-xs text-cyan-100 bg-cyan-500/20 px-2 py-0.5 rounded">
                    {selectedTrack.kind}
                  </span>
                </div>
              )}
            </div>

            {/* Volume & Pan */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="w-3 h-3" />
                Levels
              </h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-cyan-300">Volume</Label>
                    <span className="text-xs text-cyan-100">{Math.round((selectedTrack.volume ?? 1) * 100)}%</span>
                  </div>
                  <Slider
                    value={[(selectedTrack.volume ?? 1) * 100]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-cyan-300">Pan</Label>
                    <span className="text-xs text-cyan-100">
                      {(selectedTrack.pan ?? 0) === 0 ? 'C' : 
                       (selectedTrack.pan ?? 0) < 0 ? `L${Math.abs(Math.round((selectedTrack.pan ?? 0) * 100))}` : 
                       `R${Math.round((selectedTrack.pan ?? 0) * 100)}`}
                    </span>
                  </div>
                  <Slider
                    value={[(selectedTrack.pan ?? 0) * 100]}
                    onValueChange={handlePanChange}
                    max={100}
                    min={-100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Mute/Solo */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-3 h-3" />
                Controls
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-cyan-300">Mute</Label>
                  <Switch
                    checked={selectedTrack.muted ?? false}
                    onCheckedChange={handleMuteToggle}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-cyan-300">Solo</Label>
                  <Switch
                    checked={selectedTrack.solo ?? false}
                    onCheckedChange={handleSoloToggle}
                  />
                </div>
              </div>
            </div>

            {/* Color */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-3 h-3" />
                Appearance
              </h4>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-cyan-300">Color</Label>
                <div 
                  className="w-6 h-6 rounded border border-cyan-500/40"
                  style={{ backgroundColor: selectedTrack.color || '#06B6D4' }}
                />
              </div>
            </div>

          </div>
        ) : (
          <div className="p-8 text-center">
            <Info className="w-12 h-12 text-cyan-400/30 mx-auto mb-3" />
            <p className="text-sm text-cyan-400/70">No track selected</p>
            <p className="text-xs text-cyan-400/50 mt-2">
              Select a track to view and edit its properties
            </p>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {selectedTrack && (
        <div className="p-3 border-t border-cyan-500/40">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/20"
          >
            <Wand2 className="w-3 h-3 mr-2" />
            AI Enhance Track
          </Button>
        </div>
      )}
    </div>
  );
}
