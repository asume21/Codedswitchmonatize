import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/hooks/use-audio";
import { Plus, Trash2, Save, FolderOpen, Download, Upload } from "lucide-react";

// ISSUE #1: Mixer presets storage key
const MIXER_PRESETS_KEY = "mixer-presets";

interface MixerChannel {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  eq: {
    high: number;
    mid: number;
    low: number;
  };
  sends: {
    reverb: number;
    delay: number;
  };
  level: number;
}

export default function Mixer() {
  const [masterVolume, setMasterVolume] = useState(75);
  const [channels, setChannels] = useState<MixerChannel[]>([
    {
      id: "kick",
      name: "KICK",
      volume: 80,
      pan: 0,
      muted: false,
      solo: false,
      eq: { high: 0, mid: 2, low: 5 },
      sends: { reverb: 10, delay: 5 },
      level: 65,
    },
    {
      id: "snare",
      name: "SNARE",
      volume: 75,
      pan: 0,
      muted: false,
      solo: false,
      eq: { high: 3, mid: 1, low: -2 },
      sends: { reverb: 25, delay: 15 },
      level: 80,
    },
    {
      id: "hihat",
      name: "HI-HAT",
      volume: 60,
      pan: 25,
      muted: false,
      solo: false,
      eq: { high: 4, mid: 0, low: -6 },
      sends: { reverb: 20, delay: 30 },
      level: 45,
    },
    {
      id: "melody",
      name: "MELODY",
      volume: 85,
      pan: -15,
      muted: false,
      solo: false,
      eq: { high: 1, mid: 3, low: 0 },
      sends: { reverb: 40, delay: 20 },
      level: 70,
    },
    {
      id: "codebeat",
      name: "CODEBEAT",
      volume: 70,
      pan: 10,
      muted: false,
      solo: false,
      eq: { high: 2, mid: 1, low: 1 },
      sends: { reverb: 60, delay: 50 },
      level: 60,
    },
  ]);

  const [effects, setEffects] = useState({
    reverb: {
      type: "hall",
      roomSize: 35,
      damping: 60,
      wetDry: 25,
      volume: 70,
    },
    delay: {
      time: 40,
      feedback: 30,
      mix: 20,
      volume: 65,
    },
    compressor: {
      threshold: 70,
      ratio: 50,
      attack: 30,
      volume: 80,
    },
  });

  const { toast } = useToast();
  const { initialize, isInitialized } = useAudio();
  const [isLinked, setIsLinked] = useState(false);

  // ISSUE #1: Saved presets state
  const [savedPresets, setSavedPresets] = useState<Array<{id: string; name: string; channels: MixerChannel[]; masterVolume: number; effects: typeof effects}>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(MIXER_PRESETS_KEY);
      if (saved) {
        try { return JSON.parse(saved); } catch { return []; }
      }
    }
    return [];
  });

  // ISSUE #4: Master EQ state
  const [masterEQ, setMasterEQ] = useState({ high: 1, mid: 0, low: 2 });

  const updateChannel = (channelId: string, updates: Partial<MixerChannel>) => {
    setChannels(prev => prev.map(channel => 
      channel.id === channelId ? { ...channel, ...updates } : channel
    ));
  };

  const updateChannelEQ = (channelId: string, band: keyof MixerChannel["eq"], value: number) => {
    setChannels(prev => prev.map(channel => 
      channel.id === channelId 
        ? { ...channel, eq: { ...channel.eq, [band]: value } }
        : channel
    ));
  };

  const updateChannelSend = (channelId: string, send: keyof MixerChannel["sends"], value: number) => {
    setChannels(prev => prev.map(channel => 
      channel.id === channelId 
        ? { ...channel, sends: { ...channel.sends, [send]: value } }
        : channel
    ));
  };

  const toggleMute = (channelId: string) => {
    updateChannel(channelId, { muted: !channels.find(c => c.id === channelId)?.muted });
  };

  const toggleSolo = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    updateChannel(channelId, { solo: !channel?.solo });
  };

  const handleAIMix = () => {
    // Simulate AI auto-mix with some intelligent adjustments
    setChannels(prev => prev.map(channel => ({
      ...channel,
      volume: Math.max(20, Math.min(100, channel.volume + (Math.random() - 0.5) * 10)),
      pan: Math.max(-50, Math.min(50, channel.pan + (Math.random() - 0.5) * 20)),
    })));
  };

  const resetMix = () => {
    setMasterVolume(75);
    setChannels(channels.map(channel => ({
      ...channel,
      volume: channel.id === 'kick' ? 80 : channel.id === 'snare' ? 75 : channel.id === 'hihat' ? 60 : channel.id === 'melody' ? 70 : 65,
      pan: channel.id === 'hihat' ? 10 : channel.id === 'melody' ? -5 : channel.id === 'codebeat' ? 5 : 0,
      hi: 0, mid: 0, lo: 0, reverb: 0, delay: 0, muted: false, solo: false
    })));
  };

  const handleLinkStudio = () => {
    setIsLinked(!isLinked);
    if (!isLinked) {
      // When linking, the mixer will receive audio from active studio components

    }
  };

  // ISSUE #1: Save preset
  const savePreset = useCallback(() => {
    const name = prompt('Enter preset name:', `Preset ${savedPresets.length + 1}`);
    if (!name) return;
    
    const newPreset = {
      id: `preset-${Date.now()}`,
      name,
      channels: JSON.parse(JSON.stringify(channels)),
      masterVolume,
      effects: JSON.parse(JSON.stringify(effects))
    };
    
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MIXER_PRESETS_KEY, JSON.stringify(updated));
    }
    toast({ title: '💾 Preset Saved', description: `"${name}" saved` });
  }, [channels, masterVolume, effects, savedPresets, toast]);

  // ISSUE #1: Load preset
  const loadPreset = useCallback((presetId: string) => {
    const preset = savedPresets.find(p => p.id === presetId);
    if (!preset) return;
    
    setChannels(JSON.parse(JSON.stringify(preset.channels)));
    setMasterVolume(preset.masterVolume);
    setEffects(JSON.parse(JSON.stringify(preset.effects)));
    toast({ title: '📂 Preset Loaded', description: `"${preset.name}" loaded` });
  }, [savedPresets, toast]);

  // ISSUE #1: Delete preset
  const deletePreset = useCallback((presetId: string) => {
    const updated = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MIXER_PRESETS_KEY, JSON.stringify(updated));
    }
    toast({ title: '🗑️ Preset Deleted' });
  }, [savedPresets, toast]);

  // ISSUE #2: Add channel
  const addChannel = useCallback(() => {
    const name = prompt('Enter channel name:', `CH ${channels.length + 1}`);
    if (!name) return;
    
    const newChannel: MixerChannel = {
      id: `channel-${Date.now()}`,
      name: name.toUpperCase(),
      volume: 75,
      pan: 0,
      muted: false,
      solo: false,
      eq: { high: 0, mid: 0, low: 0 },
      sends: { reverb: 0, delay: 0 },
      level: 50
    };
    
    setChannels(prev => [...prev, newChannel]);
    toast({ title: '➕ Channel Added', description: `"${name}" added` });
  }, [channels.length, toast]);

  // ISSUE #2: Remove channel
  const removeChannel = useCallback((channelId: string) => {
    if (channels.length <= 1) {
      toast({ title: 'Cannot remove', description: 'At least one channel required', variant: 'destructive' });
      return;
    }
    setChannels(prev => prev.filter(c => c.id !== channelId));
    toast({ title: '🗑️ Channel Removed' });
  }, [channels.length, toast]);

  // ISSUE #5: Export mix settings as JSON
  const exportMixSettings = useCallback(() => {
    const settings = {
      channels,
      masterVolume,
      masterEQ,
      effects,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mixer-settings-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: '📤 Settings Exported' });
  }, [channels, masterVolume, masterEQ, effects, toast]);

  // ISSUE #5: Import mix settings from JSON
  const importMixSettings = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const settings = JSON.parse(event.target?.result as string);
          if (settings.channels) setChannels(settings.channels);
          if (settings.masterVolume) setMasterVolume(settings.masterVolume);
          if (settings.masterEQ) setMasterEQ(settings.masterEQ);
          if (settings.effects) setEffects(settings.effects);
          toast({ title: '📥 Settings Imported' });
        } catch {
          toast({ title: 'Import Failed', description: 'Invalid JSON file', variant: 'destructive' });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [toast]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold">Professional Mixer</h2>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => {
                initialize();
                toast({ title: "Audio Initialized", description: "The audio engine has started." });
              }}
              className="bg-studio-accent hover:bg-blue-500"
              disabled={isInitialized}
            >
              <i className="fas fa-power-off mr-2"></i>
              Start Audio
            </Button>
            <Button onClick={handleAIMix} className="bg-studio-accent hover:bg-blue-500">
              <i className="fas fa-magic mr-2"></i>AI Auto-Mix
            </Button>
            <Button onClick={resetMix} variant="secondary" className="bg-gray-700 hover:bg-gray-600">
              <i className="fas fa-undo mr-2"></i>Reset
            </Button>
            <Button onClick={handleLinkStudio} className={isLinked ? "bg-green-500 hover:bg-green-400" : "bg-gray-700 hover:bg-gray-600"}>
              {isLinked ? "Studio Linked" : "Link Studio"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <Button onClick={addChannel} variant="outline" size="sm" className="flex items-center gap-1">
          <Plus className="w-4 h-4" />
          Add Channel
        </Button>
        
        <Button onClick={savePreset} variant="outline" size="sm" className="flex items-center gap-1 bg-green-600/20 hover:bg-green-600/30">
          <Save className="w-4 h-4" />
          Save Preset
        </Button>
        
        {savedPresets.length > 0 && (
          <select
            className="h-8 px-2 text-sm bg-gray-700 border border-gray-600 rounded"
            onChange={(e) => {
              if (e.target.value === 'delete') {
                const toDelete = prompt('Enter preset name to delete:');
                const preset = savedPresets.find(p => p.name === toDelete);
                if (preset) deletePreset(preset.id);
              } else if (e.target.value) {
                loadPreset(e.target.value);
              }
              e.target.value = '';
            }}
            defaultValue=""
          >
            <option value="">📂 Load Preset ({savedPresets.length})</option>
            {savedPresets.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="delete">🗑️ Delete Preset...</option>
          </select>
        )}
        
        <div className="border-l border-gray-600 h-6 mx-2" />
        
        <Button onClick={exportMixSettings} variant="outline" size="sm" className="flex items-center gap-1">
          <Download className="w-4 h-4" />
          Export
        </Button>
        
        <Button onClick={importMixSettings} variant="outline" size="sm" className="flex items-center gap-1">
          <Upload className="w-4 h-4" />
          Import
        </Button>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="flex space-x-4 min-w-max pb-4">
          {/* Mixer Channels */}
          {channels.map((channel) => (
            <div key={channel.id} className="bg-studio-panel border border-gray-600 rounded-lg p-3 w-24 flex flex-col flex-shrink-0">
              <div className="text-xs font-medium mb-2 text-center">{channel.name}</div>

              {/* EQ Section */}
              <div className="space-y-2 mb-4">
                <div className="text-xs text-gray-400 text-center">EQ</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">HI</span>
                    <div className="w-12">
                      <Slider
                        value={[channel.eq.high]}
                        onValueChange={([value]) => updateChannelEQ(channel.id, "high", value)}
                        min={-12}
                        max={12}
                        step={1}
                        className="h-1"
                        aria-label={`${channel.name} high EQ control`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">MD</span>
                    <div className="w-12">
                      <Slider
                        value={[channel.eq.mid]}
                        onValueChange={([value]) => updateChannelEQ(channel.id, "mid", value)}
                        min={-12}
                        max={12}
                        step={1}
                        className="h-1"
                        aria-label={`${channel.name} mid EQ control`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">LO</span>
                    <div className="w-12">
                      <Slider
                        value={[channel.eq.low]}
                        onValueChange={([value]) => updateChannelEQ(channel.id, "low", value)}
                        min={-12}
                        max={12}
                        step={1}
                        className="h-1"
                        aria-label={`${channel.name} low EQ control`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Send Effects */}
              <div className="space-y-2 mb-4">
                <div className="text-xs text-gray-400 text-center">SEND</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">RV</span>
                    <div className="w-12">
                      <Slider
                        value={[channel.sends.reverb]}
                        onValueChange={([value]) => updateChannelSend(channel.id, "reverb", value)}
                        min={0}
                        max={100}
                        step={1}
                        className="h-1"
                        aria-label={`${channel.name} reverb send level`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">DL</span>
                    <div className="w-12">
                      <Slider
                        value={[channel.sends.delay]}
                        onValueChange={([value]) => updateChannelSend(channel.id, "delay", value)}
                        min={0}
                        max={100}
                        step={1}
                        className="h-1"
                        aria-label={`${channel.name} delay send level`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pan */}
              <div className="mb-4">
                <div className="text-xs text-gray-400 text-center mb-1">PAN</div>
                <Slider
                  value={[channel.pan]}
                  onValueChange={([value]) => updateChannel(channel.id, { pan: value })}
                  min={-50}
                  max={50}
                  step={1}
                  className="w-full h-1"
                  aria-label={`${channel.name} pan control`}
                />
                <div className="text-xs text-center mt-1">
                  {channel.pan === 0 ? "CENTER" : channel.pan > 0 ? `R+${channel.pan}` : `L${channel.pan}`}
                </div>
              </div>

              {/* Level Meter */}
              <div className="flex-1 flex justify-center mb-4">
                <div className="w-6 bg-gray-700 rounded-full relative overflow-hidden">
                  <div 
                    className="meter-bar absolute bottom-0 w-full rounded-full transition-all duration-200"
                    style={{ height: `${channel.level}%` }}
                  />
                </div>
              </div>

              {/* Volume Fader */}
              <div className="text-center mb-4">
                <div className="text-xs text-gray-400 mb-2">VOL</div>
                <div className="relative h-32 w-6 bg-gray-700 rounded-full mx-auto">
                  <div 
                    className="absolute w-6 h-3 bg-studio-accent rounded-full cursor-pointer transition-all"
                    style={{ bottom: `${channel.volume}%`, transform: 'translateY(50%)' }}
                    role="slider"
                    aria-label={`${channel.name} volume fader`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={channel.volume}
                    tabIndex={0}
                    onMouseDown={(e) => {
                      const slider = e.currentTarget.parentElement!;
                      const rect = slider.getBoundingClientRect();
                      const handleMouseMove = (e: MouseEvent) => {
                        const y = e.clientY - rect.top;
                        const percentage = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
                        updateChannel(channel.id, { volume: percentage });
                      };
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  />
                </div>
                <div className="text-xs font-mono mt-2">
                  {channel.volume > 75 ? `+${Math.round((channel.volume - 75) / 3)}` : `-${Math.round((75 - channel.volume) / 3)}`}dB
                </div>
              </div>

              {/* Mute/Solo */}
              <div className="space-y-1">
                <Button
                  onClick={() => toggleSolo(channel.id)}
                  className={`w-full text-xs py-1 font-bold ${
                    channel.solo 
                      ? "bg-yellow-600 hover:bg-yellow-500 text-black" 
                      : "bg-gray-700 hover:bg-yellow-500 hover:text-black"
                  }`}
                >
                  SOLO
                </Button>
                <Button
                  onClick={() => toggleMute(channel.id)}
                  className={`w-full text-xs py-1 ${
                    channel.muted 
                      ? "bg-red-600 hover:bg-red-500" 
                      : "bg-gray-700 hover:bg-red-600"
                  }`}
                >
                  MUTE
                </Button>
              </div>
            </div>
          ))}

          {/* Master Section */}
          <div className="bg-studio-panel border-2 border-studio-accent rounded-lg p-4 w-32 flex flex-col flex-shrink-0">
            <div className="text-sm font-bold mb-4 text-center text-studio-accent">MASTER</div>

            {/* Master EQ */}
            <div className="space-y-2 mb-6">
              <div className="text-xs text-gray-400 text-center">MASTER EQ</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">HIGH</span>
                  <div className="w-16">
                    <Slider 
                      value={[masterEQ.high]} 
                      onValueChange={([v]) => setMasterEQ(prev => ({ ...prev, high: v }))}
                      min={-12} 
                      max={12} 
                      step={1} 
                      className="h-1" 
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">MID</span>
                  <div className="w-16">
                    <Slider 
                      value={[masterEQ.mid]} 
                      onValueChange={([v]) => setMasterEQ(prev => ({ ...prev, mid: v }))}
                      min={-12} 
                      max={12} 
                      step={1} 
                      className="h-1" 
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">LOW</span>
                  <div className="w-16">
                    <Slider 
                      value={[masterEQ.low]} 
                      onValueChange={([v]) => setMasterEQ(prev => ({ ...prev, low: v }))}
                      min={-12} 
                      max={12} 
                      step={1} 
                      className="h-1" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Master Volume */}
            <div className="flex-1 flex flex-col items-center">
              <div className="text-sm text-gray-400 mb-4">VOLUME</div>
              <div className="relative h-40 w-8 bg-gray-700 rounded-full">
                <div 
                  className="absolute w-8 h-4 bg-studio-accent rounded-full cursor-pointer transition-all"
                  style={{ bottom: `${masterVolume}%`, transform: 'translateY(50%)' }}
                  onMouseDown={(e) => {
                    const slider = e.currentTarget.parentElement!;
                    const rect = slider.getBoundingClientRect();
                    const handleMouseMove = (e: MouseEvent) => {
                      const y = e.clientY - rect.top;
                      const percentage = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
                      setMasterVolume(percentage);
                    };
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </div>
              <div className="text-sm font-mono mt-4 text-studio-accent">
                {masterVolume > 75 ? `+${Math.round((masterVolume - 75) / 3)}` : `-${Math.round((75 - masterVolume) / 3)}`}dB
              </div>
            </div>

            {/* VU Meter */}
            <div className="mt-4">
              <div className="text-xs text-gray-400 text-center mb-2">VU METER</div>
              <div className="flex justify-center space-x-1">
                {[1, 1, 0.8, 0.6, 0.6, 0.4, 0, 0].map((opacity, index) => (
                  <div
                    key={index}
                    className={`w-1 h-8 rounded ${
                      index < 2 ? "bg-green-500" : 
                      index < 4 ? "bg-yellow-400" : 
                      index < 6 ? "bg-orange-500" : "bg-red-500"
                    }`}
                    style={{ opacity }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Effects Rack */}
          <div className="bg-studio-panel border border-gray-600 rounded-lg p-4 w-64 flex flex-col flex-shrink-0">
            <div className="text-sm font-medium mb-4 text-center">Effects Rack</div>

            {/* Reverb */}
            <div className="mb-6 p-3 bg-gray-800 rounded">
              <div className="text-xs font-medium mb-2 text-studio-accent">REVERB</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Room Size</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.reverb.roomSize]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        reverb: { ...prev.reverb, roomSize: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Damping</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.reverb.damping]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        reverb: { ...prev.reverb, damping: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Wet/Dry</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.reverb.wetDry]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        reverb: { ...prev.reverb, wetDry: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Delay */}
            <div className="mb-6 p-3 bg-gray-800 rounded">
              <div className="text-xs font-medium mb-2 text-studio-accent">DELAY</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Time</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.delay.time]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        delay: { ...prev.delay, time: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Feedback</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.delay.feedback]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        delay: { ...prev.delay, feedback: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Mix</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.delay.mix]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        delay: { ...prev.delay, mix: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Compressor */}
            <div className="p-3 bg-gray-800 rounded">
              <div className="text-xs font-medium mb-2 text-studio-accent">COMPRESSOR</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Threshold</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.compressor.threshold]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        compressor: { ...prev.compressor, threshold: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Ratio</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.compressor.ratio]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        compressor: { ...prev.compressor, ratio: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Attack</span>
                  <div className="w-20">
                    <Slider
                      value={[effects.compressor.attack]}
                      onValueChange={([value]) => setEffects(prev => ({
                        ...prev,
                        compressor: { ...prev.compressor, attack: value }
                      }))}
                      min={0}
                      max={100}
                      step={1}
                      className="h-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}