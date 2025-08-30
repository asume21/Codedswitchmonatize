import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Square,
  RotateCcw,
  Settings,
  Headphones
} from "lucide-react";

interface ChannelStrip {
  id: string;
  name: string;
  volume: number[];
  gain: number[];
  highEQ: number[];
  midEQ: number[];
  lowEQ: number[];
  pan: number[];
  muted: boolean;
  solo: boolean;
  armed: boolean;
}

export default function Mixer() {
  const [channels, setChannels] = useState<ChannelStrip[]>([
    {
      id: "1",
      name: "Kick",
      volume: [75],
      gain: [0],
      highEQ: [0],
      midEQ: [0],
      lowEQ: [0],
      pan: [0],
      muted: false,
      solo: false,
      armed: false
    },
    {
      id: "2", 
      name: "Snare",
      volume: [68],
      gain: [0],
      highEQ: [0],
      midEQ: [0],
      lowEQ: [0],
      pan: [0],
      muted: false,
      solo: false,
      armed: false
    },
    {
      id: "3",
      name: "Hi-Hat",
      volume: [55],
      gain: [0],
      highEQ: [0],
      midEQ: [0],
      lowEQ: [0],
      pan: [0],
      muted: false,
      solo: false,
      armed: false
    },
    {
      id: "4",
      name: "Bass",
      volume: [70],
      gain: [0],
      highEQ: [0],
      midEQ: [0],
      lowEQ: [0],
      pan: [0],
      muted: false,
      solo: false,
      armed: false
    }
  ]);

  const [masterVolume, setMasterVolume] = useState([80]);
  const [isPlaying, setIsPlaying] = useState(false);

  const updateChannel = (channelId: string, property: keyof ChannelStrip, value: any) => {
    setChannels(prev => prev.map(channel => 
      channel.id === channelId 
        ? { ...channel, [property]: value }
        : channel
    ));
  };

  const resetChannel = (channelId: string) => {
    setChannels(prev => prev.map(channel => 
      channel.id === channelId 
        ? {
            ...channel,
            volume: [75],
            gain: [0],
            highEQ: [0],
            midEQ: [0],
            lowEQ: [0],
            pan: [0]
          }
        : channel
    ));
  };

  return (
    <div className="h-full w-full p-6 bg-gray-50">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-6 w-6" />
            Audio Mixer
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <div className="flex gap-4 h-full">
            {/* Channel Strips */}
            <div className="flex gap-2 flex-1">
              {channels.map((channel) => (
                <Card key={channel.id} className="w-24 h-full">
                  <CardContent className="p-2 h-full flex flex-col">
                    {/* Channel Name */}
                    <div className="text-xs font-medium text-center mb-2 truncate">
                      {channel.name}
                    </div>

                    {/* EQ Section */}
                    <div className="space-y-2 mb-4">
                      <div className="text-xs text-center">EQ</div>
                      
                      {/* High EQ */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs w-4">H</span>
                        <Slider
                          value={channel.highEQ}
                          onValueChange={(value) => updateChannel(channel.id, 'highEQ', value)}
                          max={12}
                          min={-12}
                          step={0.1}
                          orientation="horizontal"
                          className="flex-1"
                        />
                      </div>

                      {/* Mid EQ */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs w-4">M</span>
                        <Slider
                          value={channel.midEQ}
                          onValueChange={(value) => updateChannel(channel.id, 'midEQ', value)}
                          max={12}
                          min={-12}
                          step={0.1}
                          orientation="horizontal"
                          className="flex-1"
                        />
                      </div>

                      {/* Low EQ */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs w-4">L</span>
                        <Slider
                          value={channel.lowEQ}
                          onValueChange={(value) => updateChannel(channel.id, 'lowEQ', value)}
                          max={12}
                          min={-12}
                          step={0.1}
                          orientation="horizontal"
                          className="flex-1"
                        />
                      </div>
                    </div>

                    {/* Gain */}
                    <div className="mb-4">
                      <div className="text-xs text-center mb-1">Gain</div>
                      <Slider
                        value={channel.gain}
                        onValueChange={(value) => updateChannel(channel.id, 'gain', value)}
                        max={20}
                        min={-20}
                        step={0.1}
                        orientation="horizontal"
                      />
                    </div>

                    {/* Pan */}
                    <div className="mb-4">
                      <div className="text-xs text-center mb-1">Pan</div>
                      <Slider
                        value={channel.pan}
                        onValueChange={(value) => updateChannel(channel.id, 'pan', value)}
                        max={100}
                        min={-100}
                        step={1}
                        orientation="horizontal"
                      />
                    </div>

                    {/* Control Buttons */}
                    <div className="space-y-1 mb-4">
                      <Button
                        size="sm"
                        variant={channel.muted ? "destructive" : "outline"}
                        className="w-full h-6 text-xs"
                        onClick={() => updateChannel(channel.id, 'muted', !channel.muted)}
                      >
                        MUTE
                      </Button>
                      <Button
                        size="sm"
                        variant={channel.solo ? "default" : "outline"}
                        className="w-full h-6 text-xs"
                        onClick={() => updateChannel(channel.id, 'solo', !channel.solo)}
                      >
                        SOLO
                      </Button>
                      <Button
                        size="sm"
                        variant={channel.armed ? "destructive" : "outline"}
                        className="w-full h-6 text-xs"
                        onClick={() => updateChannel(channel.id, 'armed', !channel.armed)}
                      >
                        REC
                      </Button>
                    </div>

                    {/* Volume Fader */}
                    <div className="flex-1 flex flex-col items-center">
                      <div className="text-xs mb-1">Vol</div>
                      <div className="flex-1 flex items-center">
                        <Slider
                          value={channel.volume}
                          onValueChange={(value) => updateChannel(channel.id, 'volume', value)}
                          max={100}
                          min={0}
                          step={1}
                          orientation="vertical"
                          className="h-32"
                        />
                      </div>
                      <div className="text-xs mt-1">{channel.volume[0]}</div>
                    </div>

                    {/* Reset Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full h-6 text-xs mt-2"
                      onClick={() => resetChannel(channel.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Master Section */}
            <Card className="w-32">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="text-sm font-medium text-center mb-4">Master</div>

                {/* Transport Controls */}
                <div className="space-y-2 mb-6">
                  <Button
                    size="sm"
                    variant={isPlaying ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" className="w-full">
                    <Square className="h-4 w-4" />
                  </Button>
                </div>

                {/* Master Volume */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="text-xs mb-2">Master</div>
                  <div className="flex-1 flex items-center">
                    <Slider
                      value={masterVolume}
                      onValueChange={setMasterVolume}
                      max={100}
                      min={0}
                      step={1}
                      orientation="vertical"
                      className="h-40"
                    />
                  </div>
                  <div className="text-xs mt-2">{masterVolume[0]}</div>
                </div>

                {/* Master Controls */}
                <div className="space-y-2 mt-4">
                  <Button size="sm" variant="outline" className="w-full">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="w-full">
                    <Headphones className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
