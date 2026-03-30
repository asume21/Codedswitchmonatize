/**
 * SidechainControl — UI panel for configuring per-channel sidechain ducking.
 * Connects to the Organism MixEngine's SidechainDucker system.
 */

import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Activity } from 'lucide-react';
import type { SidechainConfig } from '@/organism/mix/channels/SidechainDucker';

interface SidechainControlProps {
  /** Which channel this sidechain controls */
  channelName: string;
  /** Whether sidechain is currently enabled */
  enabled: boolean;
  /** Current sidechain config (null if not enabled) */
  config: SidechainConfig | null;
  /** Callback when user toggles enable/disable */
  onToggle: (enabled: boolean) => void;
  /** Callback when user changes a parameter */
  onConfigChange: (config: Partial<SidechainConfig>) => void;
  /** Which source is triggering the duck */
  source?: string;
  /** Callback when user changes source */
  onSourceChange?: (source: string) => void;
}

export default function SidechainControl({
  channelName,
  enabled,
  config,
  onToggle,
  onConfigChange,
  source = 'kick',
  onSourceChange,
}: SidechainControlProps) {
  const depth = config?.depthDb ?? -6;
  const attack = config?.attackMs ?? 2;
  const release = config?.releaseMs ?? 120;
  const hold = config?.holdMs ?? 30;

  return (
    <div className="space-y-3 p-3 rounded-lg border border-cyan-500/10 bg-black/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-100 uppercase tracking-wider">
            Sidechain — {channelName}
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          className="scale-75"
        />
      </div>

      {enabled && (
        <div className="space-y-3">
          {/* Source Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-cyan-500/60 uppercase w-14">Source</Label>
            <Select value={source} onValueChange={onSourceChange}>
              <SelectTrigger className="h-7 bg-black/20 border-cyan-500/15 text-cyan-100 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-cyan-500/20">
                <SelectItem value="kick" className="text-cyan-100 text-xs">Kick</SelectItem>
                <SelectItem value="snare" className="text-cyan-100 text-xs">Snare</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Depth */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-cyan-500/60 uppercase">Depth</Label>
              <span className="text-[10px] text-cyan-400 font-mono">{depth} dB</span>
            </div>
            <Slider
              value={[depth]}
              onValueChange={([v]) => onConfigChange({ depthDb: v })}
              min={-24}
              max={0}
              step={0.5}
              className="w-full"
            />
          </div>

          {/* Attack */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-cyan-500/60 uppercase">Attack</Label>
              <span className="text-[10px] text-cyan-400 font-mono">{attack} ms</span>
            </div>
            <Slider
              value={[attack]}
              onValueChange={([v]) => onConfigChange({ attackMs: v })}
              min={0.1}
              max={100}
              step={0.5}
              className="w-full"
            />
          </div>

          {/* Hold */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-cyan-500/60 uppercase">Hold</Label>
              <span className="text-[10px] text-cyan-400 font-mono">{hold} ms</span>
            </div>
            <Slider
              value={[hold]}
              onValueChange={([v]) => onConfigChange({ holdMs: v })}
              min={0}
              max={500}
              step={5}
              className="w-full"
            />
          </div>

          {/* Release */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-cyan-500/60 uppercase">Release</Label>
              <span className="text-[10px] text-cyan-400 font-mono">{release} ms</span>
            </div>
            <Slider
              value={[release]}
              onValueChange={([v]) => onConfigChange({ releaseMs: v })}
              min={10}
              max={2000}
              step={10}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
