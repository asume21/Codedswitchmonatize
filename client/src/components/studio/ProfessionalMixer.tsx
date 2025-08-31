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
import { 
  Volume2, VolumeX, Headphones, Settings, 
  Play, Pause, Square, RotateCcw,
  Zap, Waves, Filter, Sliders, 
  BarChart3, TrendingUp, Radio
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  
  const animationRef = useRef<number>();
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Initialize professional audio engine
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await professionalAudio.initialize();
        
        // Create default mixer channels
        const defaultChannels = [
          { id: 'drums', name: 'Drums', color: '#ef4444' },
          { id: 'bass', name: 'Bass', color: '#8b5cf6' },
          { id: 'keys', name: 'Keys', color: '#3b82f6' },
          { id: 'guitar', name: 'Guitar', color: '#f59e0b' },
          { id: 'vocals', name: 'Vocals', color: '#10b981' },
          { id: 'fx', name: 'FX', color: '#ec4899' },
          { id: 'master', name: 'Master', color: '#6b7280' }
        ];
        
        const channels = defaultChannels.map(ch => 
          professionalAudio.createMixerChannel(ch.id, ch.name)
        );
        
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
  }, [toast]);
  
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
    professionalAudio.setChannelVolume(channelId, volume[0] / 100);
  };
  
  const handleChannelPan = (channelId: string, pan: number[]) => {
    professionalAudio.setChannelPan(channelId, (pan[0] - 50) / 50);
  };
  
  const handleChannelEQ = (channelId: string, band: 'low' | 'lowMid' | 'highMid' | 'high', gain: number[]) => {
    professionalAudio.setChannelEQ(channelId, band, (gain[0] - 50) / 5); // Convert to ±10dB range
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
      <Card 
        key={channel.id} 
        className={`w-20 h-full transition-all ${
          isSelected ? 'ring-2 ring-blue-500 bg-gray-800' : 'bg-gray-900'
        }`}
      >
        <CardHeader className="p-2 pb-1">
          <CardTitle className="text-xs text-center truncate">{channel.name}</CardTitle>
        </CardHeader>
        
        <CardContent className="p-2 space-y-2">
          {/* Peak/RMS Meters */}
          <div className="h-24 bg-gray-800 rounded relative overflow-hidden">
            <div 
              className="absolute bottom-0 left-1 w-2 bg-green-500 transition-all"
              style={{ height: `${meters.rms * 100}%` }}
            />
            <div 
              className="absolute bottom-0 right-1 w-2 bg-red-500 transition-all"
              style={{ height: `${meters.peak * 100}%` }}
            />
            <div className="absolute top-1 left-0 right-0 text-center">
              <div className="text-[8px] text-gray-400">RMS</div>
              <div className="text-[8px] text-gray-400">PK</div>
            </div>
          </div>
          
          {/* EQ Section */}
          <div className="space-y-1">
            <div className="text-[8px] text-gray-400 text-center">EQ</div>
            <div className="grid grid-cols-2 gap-1">
              <Slider
                orientation="vertical"
                value={[50]}
                onValueChange={(v) => handleChannelEQ(channel.id, 'high', v)}
                min={0}
                max={100}
                className="h-8"
                data-testid={`eq-high-${channel.id}`}
              />
              <Slider
                orientation="vertical"
                value={[50]}
                onValueChange={(v) => handleChannelEQ(channel.id, 'highMid', v)}
                min={0}
                max={100}
                className="h-8"
                data-testid={`eq-highmid-${channel.id}`}
              />
              <Slider
                orientation="vertical"
                value={[50]}
                onValueChange={(v) => handleChannelEQ(channel.id, 'lowMid', v)}
                min={0}
                max={100}
                className="h-8"
                data-testid={`eq-lowmid-${channel.id}`}
              />
              <Slider
                orientation="vertical"
                value={[50]}
                onValueChange={(v) => handleChannelEQ(channel.id, 'low', v)}
                min={0}
                max={100}
                className="h-8"
                data-testid={`eq-low-${channel.id}`}
              />
            </div>
          </div>
          
          {/* Send Levels */}
          <div className="space-y-1">
            <div className="text-[8px] text-gray-400 text-center">SENDS</div>
            <div className="flex justify-between">
              {mixerState.sends.slice(0, 3).map((send, idx) => (
                <Slider
                  key={send.id}
                  orientation="vertical"
                  value={[0]}
                  onValueChange={(v) => handleSendLevel(channel.id, send.id, v)}
                  min={0}
                  max={100}
                  className="h-6 w-3"
                  data-testid={`send-${send.id}-${channel.id}`}
                />
              ))}
            </div>
          </div>
          
          {/* Pan */}
          <div>
            <div className="text-[8px] text-gray-400 text-center">PAN</div>
            <Slider
              value={[50]}
              onValueChange={(v) => handleChannelPan(channel.id, v)}
              min={0}
              max={100}
              className="w-full"
              data-testid={`pan-${channel.id}`}
            />
          </div>
          
          {/* Mute/Solo */}
          <div className="flex justify-between">
            <Button
              size="sm"
              variant={channel.muted ? "destructive" : "outline"}
              className="text-xs px-1 py-0 h-6"
              onClick={() => handleChannelMute(channel.id, !channel.muted)}
              data-testid={`mute-${channel.id}`}
            >
              M
            </Button>
            <Button
              size="sm"
              variant={channel.solo ? "default" : "outline"}
              className="text-xs px-1 py-0 h-6"
              onClick={() => handleChannelSolo(channel.id, !channel.solo)}
              data-testid={`solo-${channel.id}`}
            >
              S
            </Button>
          </div>
          
          {/* Main Volume Fader */}
          <div className="h-32 flex justify-center">
            <Slider
              orientation="vertical"
              value={[channel.volume * 100]}
              onValueChange={(v) => handleChannelVolume(channel.id, v)}
              min={0}
              max={100}
              className="h-full"
              data-testid={`volume-${channel.id}`}
            />
          </div>
          
          <div className="text-[8px] text-gray-400 text-center">
            {Math.round(channel.volume * 100)}
          </div>
        </CardContent>
      </Card>
    );
  };
  
  if (!mixerState.isInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Zap className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
          <div>Initializing Professional Audio Engine...</div>
          <div className="text-sm text-gray-400">Loading world-class mixing console</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white flex items-center gap-2">
            <Sliders className="h-6 w-6 text-blue-500" />
            Professional Mixer
          </h2>
          <p className="text-gray-400">World-class mixing console with real-time processing</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-400 border-green-400">
            <Radio className="h-3 w-3 mr-1" />
            Live
          </Badge>
          
          <Button
            variant={isPlaying ? "destructive" : "default"}
            onClick={() => setIsPlaying(!isPlaying)}
            data-testid="transport-play"
          >
            {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {/* Main Mixer Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="sends">Send Returns</TabsTrigger>
          <TabsTrigger value="master">Master Section</TabsTrigger>
          <TabsTrigger value="analyzer">Spectrum</TabsTrigger>
        </TabsList>
        
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Channel Strips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-4">
                {mixerState.channels.map(renderChannelStrip)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Waves className="h-5 w-5" />
                Send Returns & Effects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mixerState.sends.map(send => (
                <div key={send.id} className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{send.name}</div>
                    <Badge variant="secondary">{send.effect?.type}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Return Level</label>
                      <Slider
                        value={[send.return * 100]}
                        onValueChange={(v) => {/* Handle send return level */}}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Wet Level</label>
                      <Slider
                        value={[send.wetLevel * 100]}
                        onValueChange={(v) => {/* Handle wet level */}}
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="master" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Master Section
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Master Level</label>
                  <Slider
                    value={[mixerState.masterLevel * 100]}
                    onValueChange={(v) => setMixerState(prev => ({ ...prev, masterLevel: v[0] / 100 }))}
                    min={0}
                    max={100}
                    data-testid="master-volume"
                  />
                </div>
                
                <div className="h-32 bg-gray-800 rounded p-2 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xs text-gray-400">MASTER METERS</div>
                    <div className="flex gap-2 mt-2">
                      <div className="w-4 h-24 bg-gray-700 rounded overflow-hidden">
                        <div 
                          className="w-full bg-green-500 transition-all"
                          style={{ 
                            height: `${mixerState.masterMeters.rms * 100}%`,
                            marginTop: `${100 - mixerState.masterMeters.rms * 100}%`
                          }}
                        />
                      </div>
                      <div className="w-4 h-24 bg-gray-700 rounded overflow-hidden">
                        <div 
                          className="w-full bg-red-500 transition-all"
                          style={{ 
                            height: `${mixerState.masterMeters.peak * 100}%`,
                            marginTop: `${100 - mixerState.masterMeters.peak * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Master Processing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Master Compressor</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <div className="text-xs text-gray-500">Threshold</div>
                      <Slider value={[82]} min={0} max={100} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Ratio</div>
                      <Slider value={[30]} min={0} max={100} />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">Master Limiter</label>
                  <div className="mt-1">
                    <div className="text-xs text-gray-500">Ceiling</div>
                    <Slider value={[99]} min={0} max={100} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="analyzer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Real-time Spectrum Analyzer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <canvas
                ref={spectrumCanvasRef}
                width={800}
                height={300}
                className="w-full border border-gray-700 rounded bg-gray-900"
              />
              <div className="mt-2 text-center text-sm text-gray-400">
                Professional spectrum analysis with real-time frequency visualization
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}