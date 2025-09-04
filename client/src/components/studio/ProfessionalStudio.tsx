import React, { useState, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StudioAudioContext } from '@/pages/studio';
import { useToast } from '@/hooks/use-toast';
import { useAudio } from '@/hooks/use-audio';
import { 
  Music, Code, Mic, Upload, Drum, Shield, 
  MessageSquare, Layers, Settings, Play, Pause 
} from 'lucide-react';

// Import studio components
import BeatMaker from '@/components/studio/BeatMaker';
import VerticalPianoRoll from '@/components/studio/VerticalPianoRoll';
import CodeToMusic from '@/components/studio/CodeToMusic';
import MusicToCode from '@/components/studio/MusicToCode';
import AIAssistant from '@/components/studio/AIAssistant';
import VulnerabilityScanner from '@/components/studio/VulnerabilityScanner';
import LyricLab from '@/components/studio/LyricLab';
import MusicMixer from '@/components/studio/MusicMixer';
import DynamicLayering from '@/components/studio/DynamicLayering';
import { MIDIController } from '@/components/studio/MIDIController';
import { PerformanceMetrics } from '@/components/studio/PerformanceMetrics';

type StudioTool = 
  | 'beatmaker' 
  | 'melody' 
  | 'codebeat' 
  | 'musiccode' 
  | 'assistant' 
  | 'security' 
  | 'lyrics' 
  | 'mixer' 
  | 'layers' 
  | 'midi' 
  | 'metrics';

export default function ProfessionalStudio() {
  const [activeTool, setActiveTool] = useState<StudioTool>('beatmaker');
  const [isPlaying, setIsPlaying] = useState(false);
  const studioContext = useContext(StudioAudioContext);
  const { toast } = useToast();
  const { initialize, isInitialized } = useAudio();

  const tools = [
    { id: 'beatmaker', name: 'Beat Maker', icon: Drum, color: 'bg-red-500' },
    { id: 'melody', name: 'Melody Composer', icon: Music, color: 'bg-blue-500' },
    { id: 'codebeat', name: 'Code to Music', icon: Code, color: 'bg-green-500' },
    { id: 'musiccode', name: 'Music to Code', icon: Code, color: 'bg-purple-500' },
    { id: 'assistant', name: 'AI Assistant', icon: MessageSquare, color: 'bg-pink-500' },
    { id: 'security', name: 'Security Scanner', icon: Shield, color: 'bg-orange-500' },
    { id: 'lyrics', name: 'Lyric Lab', icon: Mic, color: 'bg-yellow-500' },
    { id: 'mixer', name: 'Music Mixer', icon: Layers, color: 'bg-cyan-500' },
    { id: 'layers', name: 'Dynamic Layering', icon: Layers, color: 'bg-indigo-500' },
    { id: 'midi', name: 'MIDI Controller', icon: Settings, color: 'bg-gray-500' },
    { id: 'metrics', name: 'Performance Metrics', icon: Settings, color: 'bg-teal-500' },
  ];

  const handleMasterPlay = async () => {
    try {
      if (!isInitialized) {
        await initialize();
      }

      if (isPlaying) {
        // Stop all audio
        studioContext.stopFullSong();
        setIsPlaying(false);
      } else {
        // Play all available content
        await studioContext.playFullSong();
        setIsPlaying(true);
      }
    } catch (error) {
      toast({
        title: "Playback Error",
        description: "Failed to control audio playback",
        variant: "destructive",
      });
    }
  };

  const renderActiveTool = () => {
    switch (activeTool) {
      case 'beatmaker':
        return <BeatMaker />;
      case 'melody':
        return <VerticalPianoRoll />;
      case 'codebeat':
        return <CodeToMusic />;
      case 'musiccode':
        return <MusicToCode />;
      case 'assistant':
        return <AIAssistant />;
      case 'security':
        return <VulnerabilityScanner />;
      case 'lyrics':
        return <LyricLab />;
      case 'mixer':
        return <MusicMixer />;
      case 'layers':
        return <DynamicLayering />;
      case 'midi':
        return <MIDIController />;
      case 'metrics':
        return <PerformanceMetrics />;
      default:
        return <BeatMaker />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Music className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Professional Music Studio</h1>
              <p className="text-gray-400">Complete music production environment</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              onClick={handleMasterPlay}
              className={`${isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
            >
              {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isPlaying ? 'Stop All' : 'Play All'}
            </Button>
            
            <div className="flex gap-2">
              <Badge variant="secondary">Professional</Badge>
              <Badge variant="secondary">Multi-Tool</Badge>
              <Badge variant="secondary">AI-Powered</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Navigation */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700">
        <div className="flex flex-wrap gap-2">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              onClick={() => setActiveTool(tool.id as StudioTool)}
              variant={activeTool === tool.id ? "default" : "outline"}
              className={`flex items-center gap-2 ${
                activeTool === tool.id ? tool.color : 'border-gray-600'
              }`}
            >
              <tool.icon className="h-4 w-4" />
              {tool.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Active Tool Content */}
      <div className="flex-1 overflow-hidden">
        {renderActiveTool()}
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span>Active Tool: <strong>{tools.find(t => t.id === activeTool)?.name}</strong></span>
            <Separator orientation="vertical" className="h-4" />
            <span>Status: {isPlaying ? '🟢 Playing' : '🔴 Stopped'}</span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Audio: {isInitialized ? 'Ready' : 'Not Ready'}</span>
            <span>BPM: {studioContext.bpm || 120}</span>
            <span>Tools: {tools.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}