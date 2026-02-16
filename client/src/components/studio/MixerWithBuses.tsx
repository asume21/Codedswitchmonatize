import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Headphones, Plus, Trash2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  subscribeMeter,
  setChannelVolume,
  setChannelPan,
  setChannelMute,
  applySoloState,
  setSendAmount,
  setBusVolume,
  type MeterLevels,
} from '@/lib/mixerEngine';
import { createDefaultChannel, createAuxBus, createGroupBus } from '@/lib/mixerEngine';
import type { MixerChannel, MixBus } from '@/lib/projectManager';

interface MixerWithBusesProps {
  channels: MixerChannel[];
  buses: MixBus[];
  masterVolume: number;
  trackNames: Map<string, string>;
  trackColors: Map<string, string>;
  onChannelsChange: (channels: MixerChannel[]) => void;
  onBusesChange: (buses: MixBus[]) => void;
  onMasterVolumeChange: (volume: number) => void;
}

export default function MixerWithBuses({
  channels,
  buses,
  masterVolume,
  trackNames,
  trackColors,
  onChannelsChange,
  onBusesChange,
  onMasterVolumeChange,
}: MixerWithBusesProps) {
  const [meters, setMeters] = useState<Map<string, MeterLevels>>(new Map());
  const [soloedTracks, setSoloedTracks] = useState<Set<string>>(new Set());
  const [showSends, setShowSends] = useState(false);

  useEffect(() => {
    const unsub = subscribeMeter(setMeters);
    return unsub;
  }, []);

  const updateChannel = useCallback((trackId: string, updates: Partial<MixerChannel>) => {
    onChannelsChange(channels.map(ch => ch.trackId === trackId ? { ...ch, ...updates } : ch));
  }, [channels, onChannelsChange]);

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    setChannelVolume(trackId, volume);
    updateChannel(trackId, { volume });
  }, [updateChannel]);

  const handlePanChange = useCallback((trackId: string, pan: number) => {
    setChannelPan(trackId, pan);
    updateChannel(trackId, { pan });
  }, [updateChannel]);

  const handleMuteToggle = useCallback((trackId: string) => {
    const ch = channels.find(c => c.trackId === trackId);
    if (!ch) return;
    const muted = !ch.muted;
    setChannelMute(trackId, muted);
    updateChannel(trackId, { muted });
  }, [channels, updateChannel]);

  const handleSoloToggle = useCallback((trackId: string) => {
    setSoloedTracks(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      applySoloState(next);
      return next;
    });
  }, []);

  const handleSendChange = useCallback((trackId: string, busId: string, amount: number) => {
    setSendAmount(trackId, busId, amount);
    onChannelsChange(channels.map(ch => {
      if (ch.trackId !== trackId) return ch;
      const sends = ch.sends.map(s => s.busId === busId ? { ...s, amount } : s);
      if (!sends.find(s => s.busId === busId)) {
        sends.push({ busId, amount, preFader: false });
      }
      return { ...ch, sends };
    }));
  }, [channels, onChannelsChange]);

  const handleAddBus = useCallback((type: 'aux' | 'group') => {
    if (type === 'aux') {
      onBusesChange([...buses, createAuxBus(`Aux ${buses.length + 1}`, 'reverb')]);
    } else {
      onBusesChange([...buses, createGroupBus(`Group ${buses.length + 1}`, [])]);
    }
  }, [buses, onBusesChange]);

  const handleRemoveBus = useCallback((busId: string) => {
    onBusesChange(buses.filter(b => b.id !== busId));
    // Remove sends to this bus from all channels
    onChannelsChange(channels.map(ch => ({
      ...ch,
      sends: ch.sends.filter(s => s.busId !== busId),
    })));
  }, [buses, channels, onBusesChange, onChannelsChange]);

  const handleBusVolumeChange = useCallback((busId: string, volume: number) => {
    setBusVolume(busId, volume);
    onBusesChange(buses.map(b => b.id === busId ? { ...b, volume } : b));
  }, [buses, onBusesChange]);

  const getMeterWidth = (trackId: string): number => {
    const m = meters.get(trackId);
    return m ? Math.min(100, m.rms * 100 * 2) : 0;
  };

  const getMeterPeak = (trackId: string): number => {
    const m = meters.get(trackId);
    return m ? Math.min(100, m.peak * 100) : 0;
  };

  const isClipping = (trackId: string): boolean => {
    return meters.get(trackId)?.clipping ?? false;
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Mixer</h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowSends(!showSends)} className="text-xs h-6 px-2">
            <Settings2 className="w-3 h-3 mr-1" /> Sends
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleAddBus('aux')} className="text-xs h-6 px-2">
            <Plus className="w-3 h-3 mr-1" /> Aux
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleAddBus('group')} className="text-xs h-6 px-2">
            <Plus className="w-3 h-3 mr-1" /> Group
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2">
        {/* Channel strips */}
        {channels.map(ch => {
          const name = trackNames.get(ch.trackId) || 'Track';
          const color = trackColors.get(ch.trackId) || '#888';
          const meterRms = getMeterWidth(ch.trackId);
          const meterPeak = getMeterPeak(ch.trackId);
          const clipping = isClipping(ch.trackId);

          return (
            <div key={ch.trackId} className="flex flex-col items-center gap-1 w-16 shrink-0">
              {/* Track name */}
              <div className="text-[9px] text-zinc-400 truncate w-full text-center" title={name}>
                {name}
              </div>

              {/* Color indicator */}
              <div className="w-full h-0.5 rounded" style={{ backgroundColor: color }} />

              {/* Meter */}
              <div className="relative w-4 h-32 bg-zinc-800 rounded overflow-hidden">
                <div
                  className={`absolute bottom-0 w-full transition-all duration-75 rounded ${clipping ? 'bg-red-500' : 'bg-green-500/70'}`}
                  style={{ height: `${meterRms}%` }}
                />
                <div
                  className="absolute bottom-0 w-full bg-green-400 rounded"
                  style={{ height: '2px', bottom: `${meterPeak}%` }}
                />
              </div>

              {/* Volume fader */}
              <div className="h-24 flex items-center">
                <Slider
                  orientation="vertical"
                  value={[ch.volume]}
                  min={0}
                  max={1.25}
                  step={0.01}
                  onValueChange={([v]) => handleVolumeChange(ch.trackId, v)}
                  className="h-20"
                />
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">
                {ch.volume > 0 ? `${(20 * Math.log10(ch.volume)).toFixed(1)}` : '-inf'}
              </span>

              {/* Pan */}
              <Slider
                value={[ch.pan]}
                min={-1}
                max={1}
                step={0.01}
                onValueChange={([v]) => handlePanChange(ch.trackId, v)}
                className="w-12 h-3"
              />
              <span className="text-[8px] text-zinc-600">
                {ch.pan === 0 ? 'C' : ch.pan < 0 ? `L${Math.round(Math.abs(ch.pan) * 100)}` : `R${Math.round(ch.pan * 100)}`}
              </span>

              {/* Mute / Solo */}
              <div className="flex gap-0.5">
                <button
                  onClick={() => handleMuteToggle(ch.trackId)}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ch.muted ? 'bg-red-500/30 text-red-400' : 'text-zinc-500 hover:bg-zinc-700'}`}
                >
                  M
                </button>
                <button
                  onClick={() => handleSoloToggle(ch.trackId)}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${soloedTracks.has(ch.trackId) ? 'bg-yellow-500/30 text-yellow-400' : 'text-zinc-500 hover:bg-zinc-700'}`}
                >
                  S
                </button>
              </div>

              {/* Sends */}
              {showSends && buses.filter(b => b.type === 'aux').map(bus => {
                const send = ch.sends.find(s => s.busId === bus.id);
                return (
                  <div key={bus.id} className="flex flex-col items-center gap-0.5 w-full">
                    <span className="text-[8px] text-zinc-600 truncate w-full text-center">{bus.name}</span>
                    <Slider
                      value={[send?.amount ?? 0]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([v]) => handleSendChange(ch.trackId, bus.id, v)}
                      className="w-12 h-3"
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Separator */}
        {channels.length > 0 && buses.length > 0 && (
          <div className="w-px bg-zinc-700 mx-1 self-stretch" />
        )}

        {/* Bus strips */}
        {buses.map(bus => {
          const meterRms = getMeterWidth(`bus:${bus.id}`);
          const clipping = isClipping(`bus:${bus.id}`);

          return (
            <div key={bus.id} className="flex flex-col items-center gap-1 w-16 shrink-0">
              <div className="text-[9px] text-zinc-400 truncate w-full text-center flex items-center justify-center gap-0.5">
                {bus.name}
                <button onClick={() => handleRemoveBus(bus.id)} className="text-zinc-600 hover:text-red-400">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className={`w-full h-0.5 rounded ${bus.type === 'aux' ? 'bg-purple-500' : 'bg-cyan-500'}`} />

              <div className="relative w-4 h-32 bg-zinc-800 rounded overflow-hidden">
                <div
                  className={`absolute bottom-0 w-full transition-all duration-75 rounded ${clipping ? 'bg-red-500' : 'bg-purple-500/70'}`}
                  style={{ height: `${meterRms}%` }}
                />
              </div>

              <div className="h-24 flex items-center">
                <Slider
                  orientation="vertical"
                  value={[bus.volume]}
                  min={0}
                  max={1.25}
                  step={0.01}
                  onValueChange={([v]) => handleBusVolumeChange(bus.id, v)}
                  className="h-20"
                />
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">
                {bus.volume > 0 ? `${(20 * Math.log10(bus.volume)).toFixed(1)}` : '-inf'}
              </span>

              <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-500">
                {bus.type === 'aux' ? 'AUX' : 'GRP'}
              </span>
            </div>
          );
        })}

        {/* Master strip */}
        <div className="w-px bg-zinc-600 mx-1 self-stretch" />
        <div className="flex flex-col items-center gap-1 w-16 shrink-0">
          <div className="text-[9px] text-white font-bold">MASTER</div>
          <div className="w-full h-0.5 rounded bg-white" />

          <div className="relative w-4 h-32 bg-zinc-800 rounded overflow-hidden">
            <div
              className={`absolute bottom-0 w-full transition-all duration-75 rounded ${isClipping('master') ? 'bg-red-500' : 'bg-white/70'}`}
              style={{ height: `${getMeterWidth('master')}%` }}
            />
          </div>

          <div className="h-24 flex items-center">
            <Slider
              orientation="vertical"
              value={[masterVolume]}
              min={0}
              max={1.25}
              step={0.01}
              onValueChange={([v]) => { onMasterVolumeChange(v); setBusVolume('master', v); }}
              className="h-20"
            />
          </div>
          <span className="text-[9px] text-zinc-400 font-mono">
            {masterVolume > 0 ? `${(20 * Math.log10(masterVolume)).toFixed(1)}` : '-inf'}
          </span>
        </div>
      </div>
    </div>
  );
}
