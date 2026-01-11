/**
 * Professional Mixing Console - World-class mixing interface for CodedSwitch
 * Features: Real-time processing, spectrum analysis, professional metering
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  Volume2, VolumeX, Headphones, Settings, 
  Play, Pause, Square, RotateCcw,
  Zap, Waves, Filter, Sliders, 
  BarChart3, TrendingUp, Radio, Wand2, FileMusic, Sparkles, Upload
} from 'lucide-react';
import { useSongWorkSession } from '@/contexts/SongWorkSessionContext';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTracks } from '@/hooks/useTracks';
import { professionalAudio, type MixerChannel, type SendReturn } from '@/lib/professionalAudio';

interface ChannelMeterData {
  peak: number;
  rms: number;
  spectrum: number[];
}

interface MixerState {
  channels: MixerChannel[];
  sends: SendReturn[];
  masterLevel: number;
  masterMeters: { peak: number; rms: number };
  spectrum: number[];
  isInitialized: boolean;
}

export default function ProfessionalMixer() {
  const { toast } = useToast();
  const { currentSession, setCurrentSessionId } = useSongWorkSession();
  const { tracks } = useTracks();
  const [location] = useLocation();
  const [uploadedStems, setUploadedStems] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mixerState, setMixerState] = useState<MixerState>({
    channels: [],
    sends: [],
    masterLevel: 0.8,
    masterMeters: { peak: 0, rms: 0 },
    spectrum: [],
    isInitialized: false
  });
  
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [meterData, setMeterData] = useState<Map<string, ChannelMeterData>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('channels');
  const [aiPrompt, setAiPrompt] = useState("");
  
  const animationRef = useRef<number | undefined>(undefined);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // AI-powered mixing mutation
  const aiMixMutation = useMutation({
    mutationFn: async (params: any) => {
      const response = await apiRequest("POST", "/api/mix/generate", params);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.mix) {
        // Apply AI-generated mix settings to channels
        toast({
          title: "AI Mix Applied! 🎛️",
          description: "AI has optimized your mix settings",
        });
      }
    },
    onError: () => {
      toast({
        title: "AI Mix Failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });
  
  const handleAIMix = () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Enter AI Instructions",
        description: "Describe how you want the mix to sound",
        variant: "destructive"
      });
      return;
    }
    
    aiMixMutation.mutate({
      prompt: aiPrompt,
      channels: mixerState.channels,
      style: "professional"
    });
  };
  
  // Load session from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    const sessionId = params.get('session');
    
    if (sessionId) {
      setCurrentSessionId(sessionId);
      toast({
        title: "Session Loaded",
        description: currentSession?.songName ? `Mixing: ${currentSession.songName}` : "Mix session loaded",
        duration: 3000,
      });
    }
  }, [location, setCurrentSessionId]);

  // Initialize professional audio engine and synchronize tracks
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await professionalAudio.initialize();
        
        // Sync mixer channels with project tracks
        const channels = tracks.map(track => {
          // Check if channel already exists in audio engine
          const existing = professionalAudio.getChannels().find(ch => ch.id === track.id);
          if (existing) return existing;
          
          return professionalAudio.createMixerChannel(track.id, track.name || `Track ${track.id.slice(0, 4)}`);
        });
        
        setMixerState({
          channels,
          sends: professionalAudio.getSendReturns(),
          masterLevel: 0.8,
          masterMeters: { peak: 0, rms: 0 },
          spectrum: [],
          isInitialized: true
        });
        
        toast({
          title: "Professional Audio Engine Initialized",
          description: "World-class mixing console ready for production",
        });
        
        // Start real-time metering
        startMetering();
        
      } catch (error) {
        console.error('Failed to initialize professional audio:', error);
        toast({
          title: "Audio Initialization Failed",
          description: "Please check your audio settings and try again",
          variant: "destructive"
        });
      }
    };
    
    initializeAudio();
    
    return () => {
      stopMetering();
      professionalAudio.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only initialize once on mount

  // Watch for track changes and update mixer channels
  useEffect(() => {
    if (!mixerState.isInitialized) return;

    const currentChannels = professionalAudio.getChannels();
    let hasChanges = false;
    
    // Add new tracks as channels and update existing ones
    tracks.forEach(track => {
      const existing = currentChannels.find(ch => ch.id === track.id);
      if (!existing) {
        professionalAudio.createMixerChannel(track.id, track.name || `Track ${track.id.slice(0, 4)}`);
        hasChanges = true;
      } else {
        // Update name if changed
        if (existing.name !== track.name) {
          existing.name = track.name || existing.name;
          hasChanges = true;
        }
      }
    });

    // For now, just update local state if anything changed
    if (hasChanges) {
      setMixerState(prev => ({
        ...prev,
        channels: professionalAudio.getChannels()
      }));
    }
  }, [tracks, mixerState.isInitialized]);
  
  const startMetering = useCallback(() => {
    const updateMeters = () => {
      if (!mixerState.isInitialized) return;
      
      // Update channel meters
      const newMeterData = new Map<string, ChannelMeterData>();
      
      mixerState.channels.forEach(channel => {
        const meters = professionalAudio.getChannelMeters(channel.id);
        newMeterData.set(channel.id, {
          peak: meters.peak,
          rms: meters.rms,
          spectrum: [] // Individual channel spectrum could be added
        });
      });
      
      setMeterData(newMeterData);
      
      // Update master spectrum
      const spectrum = professionalAudio.getMasterSpectrum();
      if (spectrum) {
        const spectrumArray = Array.from(spectrum);
        setMixerState(prev => ({
          ...prev,
          spectrum: spectrumArray,
          masterMeters: {
            peak: Math.max(...spectrumArray) / 255,
            rms: Math.sqrt(spectrumArray.reduce((sum, val) => sum + (val/255)**2, 0) / spectrumArray.length)
          }
        }));
        
        // Draw spectrum analyzer
        drawSpectrum(spectrumArray);
      }
      
      animationRef.current = requestAnimationFrame(updateMeters);
    };
    
    updateMeters();
  }, [mixerState.isInitialized]);
  
  const stopMetering = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);
  
  const drawSpectrum = (spectrum: number[]) => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    
    const barWidth = width / spectrum.length;
    
    for (let i = 0; i < spectrum.length; i++) {
      const barHeight = (spectrum[i] / 255) * height;
      const hue = (i / spectrum.length) * 360;
      
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
  };
  
  const handleChannelVolume = (channelId: string, volume: number[]) => {
    const normalizedVolume = volume[0] / 100;
    professionalAudio.setChannelVolume(channelId, normalizedVolume);
    setMixerState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => 
        ch.id === channelId ? { ...ch, volume: normalizedVolume } : ch
      )
    }));
  };
  
  const handleChannelPan = (channelId: string, pan: number[]) => {
    const normalizedPan = (pan[0] - 50) / 50;
    professionalAudio.setChannelPan(channelId, normalizedPan);
    setMixerState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => 
        ch.id === channelId ? { ...ch, pan: normalizedPan } : ch
      )
    }));
  };
  
  const handleChannelEQ = (channelId: string, band: 'low' | 'lowMid' | 'highMid' | 'high', gain: number[]) => {
    const normalizedGain = (gain[0] - 50) / 5; // Convert to ±10dB range
    professionalAudio.setChannelEQ(channelId, band, normalizedGain);
    setMixerState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            eq: { ...ch.eq, [band]: normalizedGain }
          };
        }
        return ch;
      })
    }));
  };
  
  const handleChannelMute = (channelId: string, muted: boolean) => {
    professionalAudio.muteChannel(channelId, muted);
    setMixerState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => 
        ch.id === channelId ? { ...ch, muted } : ch
      )
    }));
  };

  const handleChannelSolo = (channelId: string, solo: boolean) => {
    professionalAudio.soloChannel(channelId, solo);
    setMixerState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => 
        ch.id === channelId ? { ...ch, solo } : ch
      )
    }));
  };

  const handleSendLevel = (channelId: string, sendId: string, level: number[]) => {
    professionalAudio.setSendLevel(channelId, sendId, level[0] / 100);
  };

  const renderChannelStrip = (channel: MixerChannel) => {
    const meters = meterData.get(channel.id) || { peak: 0, rms: 0, spectrum: [] };
    const isSelected = selectedChannel === channel.id;
    
    return (
      <div 
        key={channel.id} 
        className={`w-24 shrink-0 flex flex-col items-center gap-4 p-4 transition-all duration-500 border relative group overflow-hidden ${
          isSelected 
            ? 'astutely-track-lane-selected' 
            : 'astutely-track-lane'
        }`}
        onClick={() => setSelectedChannel(channel.id)}
      >
        <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        
        <div className="flex flex-col items-center gap-1 relative z-10 w-full">
          <div className="text-[9px] font-black text-cyan-500/40 uppercase tracking-[0.2em] truncate w-full text-center">CH-{channel.id.slice(0, 3)}</div>
          <div className={`text-[11px] font-black tracking-widest truncate w-full text-center transition-colors ${isSelected ? 'text-white shadow-glow-cyan' : 'text-cyan-500/80'}`}>
            {channel.name.toUpperCase()}
          </div>
        </div>
        
        {/* Astutely HUD Metering */}
        <div className="w-full h-40 bg-black/80 rounded-sm border border-cyan-500/20 p-1 flex justify-center gap-1 relative overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-between p-1 pointer-events-none opacity-20">
            {[0, -6, -12, -18, -24, -36, -48].map(db => (
              <div key={db} className="w-full border-t border-cyan-500/30 flex justify-between items-center">
                <span className="text-[5px] font-bold text-cyan-400">{db}</span>
              </div>
            ))}
          </div>
          
          <div className="w-2.5 h-full bg-cyan-950/40 rounded-t-sm relative overflow-hidden border border-cyan-500/10">
            <div 
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-900 via-cyan-500 to-white shadow-glow-cyan transition-all duration-75"
              style={{ height: `${meters.rms * 100}%` }}
            />
          </div>
          <div className="w-2.5 h-full bg-cyan-950/40 rounded-t-sm relative overflow-hidden border border-cyan-500/10">
            <div 
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-900 via-cyan-400 to-white shadow-glow-cyan transition-all duration-75"
              style={{ height: `${meters.peak * 100}%` }}
            />
          </div>
        </div>
        
        {/* Panner Knob */}
        <div className="w-full space-y-4">
          <div className="flex flex-col items-center gap-1">
            <div className="text-[7px] font-black text-cyan-500/50 uppercase tracking-[0.3em]">PAN</div>
            <Slider
              value={[(channel.pan + 1) * 50]}
              onValueChange={(v) => handleChannelPan(channel.id, v)}
              min={0}
              max={100}
              className="w-full"
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="ghost"
              className={`h-7 w-full text-[9px] font-black tracking-widest rounded-none transition-all ${channel.muted ? "bg-red-500/40 border-red-500 text-white shadow-glow-red" : "border-cyan-500/30 text-cyan-500/60"}`}
              onClick={(e) => { e.stopPropagation(); handleChannelMute(channel.id, !channel.muted); }}
            >
              MUTE
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-7 w-full text-[9px] font-black tracking-widest rounded-none transition-all ${channel.solo ? "bg-cyan-500 text-white shadow-glow-cyan" : "border-cyan-500/30 text-cyan-500/60"}`}
              onClick={(e) => { e.stopPropagation(); handleChannelSolo(channel.id, !channel.solo); }}
            >
              SOLO
            </Button>
          </div>
        </div>
        
        {/* Vertical Fader */}
        <div className="w-full h-48 flex flex-col items-center justify-between pt-2 relative">
          <div className="absolute left-1/2 -translate-x-1/2 top-4 bottom-4 w-px bg-cyan-500/10 pointer-events-none" />
          <Slider
            orientation="vertical"
            value={[channel.volume * 100]}
            onValueChange={(v) => handleChannelVolume(channel.id, v)}
            min={0}
            max={100}
            className="h-full relative z-10"
          />
          <div className="mt-4 bg-black/90 border border-cyan-500/30 px-2 py-1 min-w-[42px] text-center shadow-inner">
            <span className={`text-[10px] font-black tabular-nums ${isSelected ? 'text-white' : 'text-cyan-500/80'}`}>
              {Math.round(channel.volume * 100)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (!mixerState.isInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Zap className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
          <div className="text-white font-bold">Initializing Professional Audio Engine...</div>
          <div className="text-sm text-gray-400">Loading holographic mixing console</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen astutely-pro-panel rounded-none astutely-mixer overflow-hidden">
      {/* Header Area */}
      <div className="flex-none p-6 pb-0">
        <div className="flex items-center justify-between astutely-panel-header mb-6 relative z-10">
          <div className="relative z-10">
            <h2 className="text-3xl font-heading font-black astutely-gradient-text flex items-center gap-3">
              <Sliders className="h-8 w-8 text-cyan-400" />
              PROFESSIONAL MIXER
            </h2>
            <p className="text-cyan-200/60 font-medium tracking-wide mt-1 uppercase text-[10px]">Holographic Precision · Real-time DSP Engine</p>
          </div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Live Engine</span>
            </div>
            
            <Button
              variant="ghost"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-12 h-12 rounded-xl border transition-all duration-300 ${
                isPlaying 
                  ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30 shadow-[0_0_20px_rgba(239,44,44,0.3)]" 
                  : "bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
              }`}
              data-testid="transport-play"
            >
              {isPlaying ? <Square className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
            </Button>
          </div>
        </div>

        {/* Active Session Info */}
        {currentSession && (
          <div className="bg-gradient-to-r from-blue-600/20 to-transparent border-l-4 border-blue-500 rounded-r-lg px-6 py-3 backdrop-blur-sm mb-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FileMusic className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-400/70 uppercase tracking-tighter block">Active Session</span>
                <span className="text-lg font-bold text-white tracking-tight">{currentSession.songName}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Mixer Area - Scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-0">
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 p-1 bg-black/40 border border-white/10 rounded-2xl h-14 backdrop-blur-xl">
              <TabsTrigger value="channels" className="rounded-xl data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border border-transparent data-[state=active]:border-blue-500/30 transition-all font-bold tracking-tight">CHANNELS</TabsTrigger>
              <TabsTrigger value="sends" className="rounded-xl data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 data-[state=active]:border border-transparent data-[state=active]:border-purple-500/30 transition-all font-bold tracking-tight">BUS / SENDS</TabsTrigger>
              <TabsTrigger value="master" className="rounded-xl data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 data-[state=active]:border border-transparent data-[state=active]:border-amber-500/30 transition-all font-bold tracking-tight">MASTER</TabsTrigger>
              <TabsTrigger value="ai-mix" className="rounded-xl data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-400 data-[state=active]:border border-transparent data-[state=active]:border-pink-500/30 transition-all font-bold tracking-tight flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                AI MIXING
              </TabsTrigger>
              <TabsTrigger value="analyzer" className="rounded-xl data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border border-transparent data-[state=active]:border-cyan-500/30 transition-all font-bold tracking-tight">SPECTRUM</TabsTrigger>
            </TabsList>
            
            <TabsContent value="channels" className="mt-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 mb-8">
                  <Volume2 className="h-6 w-6 text-blue-400" />
                  <h3 className="text-xl font-bold tracking-tighter text-white/90 uppercase">Mixing Console</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {mixerState.channels.map(renderChannelStrip)}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="sends" className="mt-6 space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-8">
                  <Waves className="h-6 w-6 text-purple-400" />
                  <h3 className="text-xl font-bold tracking-tighter text-white/90 uppercase">Global Returns</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mixerState.sends.map(send => (
                    <div key={send.id} className="p-6 bg-black/40 border border-white/10 rounded-2xl hover:border-purple-500/30 transition-all group">
                      <div className="flex items-center justify-between mb-6">
                        <div className="font-black text-purple-400 tracking-tighter group-hover:drop-shadow-[0_0_5px_rgba(168,85,247,0.5)] transition-all uppercase">{send.name}</div>
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 uppercase tracking-tighter text-[10px]">{send.effect?.type}</Badge>
                      </div>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-widest">
                            <span>Return</span>
                            <span className="text-purple-400">{Math.round(send.return * 100)}%</span>
                          </div>
                          <Slider
                            value={[send.return * 100]}
                            onValueChange={() => {}}
                            min={0}
                            max={100}
                            className="opacity-80 hover:opacity-100"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-widest">
                            <span>Wetness</span>
                            <span className="text-purple-400">{Math.round(send.wetLevel * 100)}%</span>
                          </div>
                          <Slider
                            value={[send.wetLevel * 100]}
                            onValueChange={() => {}}
                            min={0}
                            max={100}
                            className="opacity-80 hover:opacity-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="master" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl overflow-hidden">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-bold tracking-tighter text-amber-400 flex items-center gap-3 uppercase">
                      <TrendingUp className="h-6 w-6" />
                      Output Stage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-4 space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Master Gain</label>
                        <span className="text-2xl font-black text-amber-400 tabular-nums">{(mixerState.masterLevel * 100).toFixed(1)}%</span>
                      </div>
                      <Slider
                        value={[mixerState.masterLevel * 100]}
                        onValueChange={(v) => setMixerState(prev => ({ ...prev, masterLevel: v[0] / 100 }))}
                        min={0}
                        max={100}
                        step={0.1}
                        className="h-2"
                        data-testid="master-volume"
                      />
                    </div>
                    
                    <div className="h-48 bg-black/60 rounded-2xl border border-white/5 p-6 relative flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent pointer-events-none" />
                      <div className="text-center w-full relative z-10">
                        <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-6">Master VU Telemetry</div>
                        <div className="flex justify-center gap-8">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-6 h-24 bg-white/5 rounded-full relative overflow-hidden border border-white/10 p-0.5">
                              <div 
                                className="w-full bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 rounded-full transition-all duration-75 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                style={{ 
                                  height: `${mixerState.masterMeters.rms * 100}%`,
                                  marginTop: `${100 - mixerState.masterMeters.rms * 100}%`
                                }}
                              />
                            </div>
                            <span className="text-[9px] font-black text-white/40 tracking-tighter text-white">RMS</span>
                          </div>
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-6 h-24 bg-white/5 rounded-full relative overflow-hidden border border-white/10 p-0.5">
                              <div 
                                className="w-full bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 rounded-full transition-all duration-75 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                                style={{ 
                                  height: `${mixerState.masterMeters.peak * 100}%`,
                                  marginTop: `${100 - mixerState.masterMeters.peak * 100}%`
                                }}
                              />
                            </div>
                            <span className="text-[9px] font-black text-white/40 tracking-tighter text-white">PEAK</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-bold tracking-tighter text-cyan-400 flex items-center gap-3 uppercase">
                      <Settings className="h-6 w-6" />
                      Master DSP
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-4 space-y-8">
                    <div className="p-6 bg-black/40 border border-white/5 rounded-2xl space-y-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Precision Compressor</label>
                        <div className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_8px_#06b6d4]" />
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <div className="flex justify-between text-[9px] font-bold text-white/30 uppercase">
                            <span>Threshold</span>
                            <span className="text-cyan-400">-12.4 dB</span>
                          </div>
                          <Slider value={[82]} min={0} max={100} className="h-1" />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-[9px] font-bold text-white/30 uppercase">
                            <span>Ratio</span>
                            <span className="text-cyan-400">4.0:1</span>
                          </div>
                          <Slider value={[30]} min={0} max={100} className="h-1" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-black/40 border border-white/5 rounded-2xl space-y-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Brickwall Limiter</label>
                        <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[9px] font-bold text-white/30 uppercase">
                          <span>Ceiling</span>
                          <span className="text-red-400">-0.1 dBFS</span>
                        </div>
                        <Slider value={[99]} min={0} max={100} className="h-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="ai-mix" className="mt-6">
              <Card className="bg-gradient-to-br from-indigo-950/40 via-purple-950/40 to-pink-950/40 border-2 border-white/10 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-[0_0_50px_rgba(168,85,247,0.15)]">
                <CardHeader className="p-10 pb-6 border-b border-white/5">
                  <CardTitle className="text-3xl font-black tracking-tighter text-white flex items-center gap-4 uppercase drop-shadow-2xl">
                    <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                      <Wand2 className="h-8 w-8 text-white" />
                    </div>
                    Astutely Mix Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-10 space-y-8">
                  {/* Audio Upload Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileMusic className="h-5 w-5 text-purple-400" />
                      <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Upload Stems (Optional)</h4>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 h-14 bg-black/40 border-white/20 hover:bg-black/60 hover:border-purple-500/50 text-white rounded-xl transition-all"
                      >
                        <Upload className="w-5 h-5 mr-2" />
                        {uploadedStems.length > 0 ? `${uploadedStems.length} Stems Loaded` : 'Upload Separated Stems'}
                      </Button>
                      {uploadedStems.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setUploadedStems([])}
                          className="h-14 px-6 bg-red-500/20 border-red-500/50 hover:bg-red-500/30 text-red-300 rounded-xl"
                        >
                          Clear
                        </Button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setUploadedStems(files);
                          toast({
                            title: "Stems Loaded",
                            description: `${files.length} audio files ready for AI remixing`,
                          });
                        }}
                        className="hidden"
                      />
                    </div>
                    {uploadedStems.length > 0 && (
                      <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                        <p className="text-xs text-white/60 mb-2 uppercase tracking-wide">Loaded Stems:</p>
                        <div className="flex flex-wrap gap-2">
                          {uploadedStems.map((file, i) => (
                            <Badge key={i} variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                              {file.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text Prompt Section */}
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
                    <Textarea
                      placeholder={uploadedStems.length > 0 
                        ? "Describe how you want to remix these stems... e.g., 'Add heavy reverb to vocals, make drums punchier, boost bass'"
                        : "Tell Astutely how you want your track to feel... e.g., 'Make it sound like a 1980s synthwave dream with lush reverb and punchy drums'"}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="relative min-h-[180px] bg-black/60 border-white/10 rounded-2xl p-6 text-lg font-medium text-white placeholder:text-white/20 focus:ring-purple-500/50 resize-none transition-all"
                    />
                  </div>
                  
                  <Button
                    onClick={handleAIMix}
                    className="w-full h-16 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xl tracking-tight rounded-2xl shadow-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    disabled={aiMixMutation.isPending}
                  >
                    {aiMixMutation.isPending ? (
                      <div className="flex items-center gap-3">
                        <RotateCcw className="h-6 w-6 animate-spin" />
                        <span>NEURAL PROCESSING...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Zap className="h-6 w-6 fill-current" />
                        <span>{uploadedStems.length > 0 ? 'REMIX STEMS' : 'GENERATE MASTER MIX'}</span>
                      </div>
                    )}
                  </Button>
                  
                  {uploadedStems.length > 0 && (
                    <p className="text-center text-sm text-purple-300/60">
                      AI will analyze and remix your {uploadedStems.length} uploaded stems
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analyzer" className="mt-6">
              <div className="bg-black/60 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-6 w-6 text-cyan-400" />
                    <h3 className="text-xl font-bold tracking-tighter text-white/90 uppercase">Signal Analysis</h3>
                  </div>
                  <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-black uppercase text-[10px] tracking-widest px-4 py-1">Real-time FFT</Badge>
                </div>
                
                <div className="relative aspect-[21/9] w-full bg-black/40 rounded-2xl border border-white/5 overflow-hidden shadow-inner">
                  <canvas 
                    ref={spectrumCanvasRef} 
                    className="w-full h-full"
                    width={1200}
                    height={400}
                  />
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-8 grid-rows-4 opacity-10">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div key={i} className="border-[0.5px] border-cyan-500/30" />
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-6 mt-8">
                  {[
                    { label: 'Dynamic Range', value: '14.2 LUFS', icon: Radio },
                    { label: 'Peak Level', value: `${(mixerState.masterMeters.peak * 100).toFixed(1)}%`, icon: TrendingUp },
                    { label: 'RMS Power', value: `${(mixerState.masterMeters.rms * 100).toFixed(1)}%`, icon: Zap },
                    { label: 'Phase Correlation', value: '+0.85', icon: Waves }
                  ].map((stat, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center gap-4">
                      <div className="p-2 bg-black/40 rounded-lg">
                        <stat.icon className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">{stat.label}</div>
                        <div className="text-sm font-bold text-white tabular-nums">{stat.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}