import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useSongWorkSession } from '@/contexts/SongWorkSessionContext';
import { useLocation } from 'wouter';
import { 
  Sliders,
  Gauge,
  Mic,
  Radio,
  TrendingDown,
  ShieldOff,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Music
} from 'lucide-react';
import {
  EQPlugin,
  CompressorPlugin,
  DeesserPlugin,
  ReverbPlugin,
  LimiterPlugin,
  NoiseGatePlugin,
  type ToolType,
  type ToolRecommendation
} from './index';

interface AudioToolRouterProps {
  songUrl?: string;
  songName?: string;
  recommendations?: ToolRecommendation[];
  onAudioLoad?: (url: string, name: string) => void;
}

export function AudioToolRouter({ songUrl, songName, recommendations = [], onAudioLoad }: AudioToolRouterProps) {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const { toast } = useToast();
  const { createSession, updateSession } = useSongWorkSession();
  const [, setLocation] = useLocation();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAudioLoad) {
      const url = URL.createObjectURL(file);
      onAudioLoad(url, file.name);
      toast({
        title: "Audio Loaded",
        description: `Loaded ${file.name} for processing`,
      });
    }
  };

  const handleAutoFix = async () => {
    if (!songUrl) {
      toast({
        title: "No Audio",
        description: "Please load an audio file first.",
        variant: "destructive"
      });
      return;
    }
    setIsAutoFixing(true);
    try {
      toast({
        title: "AI Auto Fix Started",
        description: "Analyzing and processing your track...",
      });

      // Call AI analysis endpoint
      const response = await apiRequest('POST', '/api/songs/auto-master', {
        songUrl,
        songName,
      });

      const result = await response.json();

      toast({
        title: "AI Auto Fix Complete!",
        description: `Applied ${result.fixesApplied || 0} improvements. Check the download.`,
      });

      // Download the fixed file
      if (result.fixedAudioUrl) {
        const a = document.createElement('a');
        a.href = result.fixedAudioUrl;
        a.download = `${songName}-MASTERED.wav`;
        a.click();
      }
    } catch (error) {
      console.error('Auto fix error:', error);
      toast({
        title: "Auto Fix Failed",
        description: "Could not automatically master the track. Try manual tools.",
        variant: "destructive",
      });
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleOpenInLyricLab = () => {
    // Create or update session with song data
    const sessionId = createSession({
      name: songName || 'Unknown Track',
      audioUrl: songUrl || ''
    });
    
    toast({
      title: "Opening Lyric Lab",
      description: `Routing ${songName || 'Unknown Track'} to Lyric Lab for editing`,
    });
    
    // Navigate to Lyric Lab with session parameter
    setLocation(`/lyric-lab?session=${sessionId}`);
  };

  const handleOpenInPianoRoll = () => {
    const sessionId = createSession({
      name: songName || 'Unknown Track',
      audioUrl: songUrl || ''
    });
    
    toast({
      title: "Opening Piano Roll",
      description: `Routing ${songName || 'Unknown Track'} to Piano Roll for melody editing`,
    });
    
    setLocation(`/melody-composer?session=${sessionId}`);
  };

  const tools = [
    {
      type: 'EQ' as ToolType,
      name: 'Equalizer',
      icon: Sliders,
      color: 'bg-blue-600',
      description: 'Shape frequency balance',
      component: EQPlugin
    },
    {
      type: 'Compressor' as ToolType,
      name: 'Compressor',
      icon: Gauge,
      color: 'bg-purple-600',
      description: 'Control dynamics',
      component: CompressorPlugin
    },
    {
      type: 'Deesser' as ToolType,
      name: 'Deesser',
      icon: Mic,
      color: 'bg-green-600',
      description: 'Remove harsh S sounds',
      component: DeesserPlugin
    },
    {
      type: 'Reverb' as ToolType,
      name: 'Reverb',
      icon: Radio,
      color: 'bg-indigo-600',
      description: 'Add space and depth',
      component: ReverbPlugin
    },
    {
      type: 'Limiter' as ToolType,
      name: 'Limiter',
      icon: TrendingDown,
      color: 'bg-red-600',
      description: 'Prevent clipping',
      component: LimiterPlugin
    },
    {
      type: 'NoiseGate' as ToolType,
      name: 'Noise Gate',
      icon: ShieldOff,
      color: 'bg-orange-600',
      description: 'Remove background noise',
      component: NoiseGatePlugin
    }
  ];

  const getRecommendationForTool = (toolType: ToolType) => {
    return recommendations.find(r => r.tool === toolType);
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  if (activeTool) {
    const ToolComponent = tools.find(t => t.type === activeTool)?.component;
    if (ToolComponent) {
      return (
        <div className="space-y-4">
          <Button 
            variant="outline" 
            onClick={() => setActiveTool(null)}
            className="mb-4"
          >
            ← Back to Tool Selection
          </Button>
          <ToolComponent audioUrl={songUrl} onClose={() => setActiveTool(null)} />
        </div>
      );
    }
  }

  return (
    <Card className="w-full border-none shadow-none bg-transparent">
      <CardHeader className="px-0">
        <CardTitle>Audio Processing Tools</CardTitle>
        <p className="text-sm text-muted-foreground">
          {songName ? (
            <>Select a tool to process: <strong>{songName}</strong></>
          ) : (
            "Select a tool to begin processing audio"
          )}
        </p>
      </CardHeader>

      <CardContent className="px-0">
        {/* AI Auto Fix Button - Only show if audio is loaded */}
        {songUrl && (
          <div className="mb-6">
            <Button
              onClick={handleAutoFix}
              disabled={isAutoFixing}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-6 text-lg"
              size="lg"
            >
              {isAutoFixing ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  AI Processing...
                </>
              ) : (
                <>
                  <i className="fas fa-magic mr-2"></i>
                  AI Auto Fix - Mix & Master Automatically
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              AI will analyze and automatically apply professional mixing & mastering
            </p>
          </div>
        )}

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h3 className="text-sm font-medium mb-3 text-blue-400">
              🤖 AI Recommendations
            </h3>
            <div className="space-y-2">
              {recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  {getPriorityIcon(rec.priority)}
                  <div className="flex-1">
                    <span className="font-medium">{rec.tool}:</span>{' '}
                    <span className="text-muted-foreground">{rec.reason}</span>
                    {rec.settings && (
                      <div className="text-xs text-muted-foreground mt-1">
                        💡 {rec.settings}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tool Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const recommendation = getRecommendationForTool(tool.type);
            const isRecommended = !!recommendation;

            return (
              <Button
                key={tool.type}
                variant="outline"
                className={`h-auto p-4 flex flex-col items-start gap-3 hover:border-blue-500 transition-all ${
                  isRecommended ? 'border-blue-500 bg-blue-500/5' : ''
                }`}
                onClick={() => setActiveTool(tool.type)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-2 ${tool.color} rounded-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  {isRecommended && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                      Recommended
                    </Badge>
                  )}
                </div>

                <div className="text-left w-full">
                  <h4 className="font-medium">{tool.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tool.description}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground w-full">
                  <span>Open tool</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </Button>
            );
          })}
        </div>

        {/* Other Editing Tools Section */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <h3 className="text-sm font-medium mb-4 text-gray-300">
            🎵 Route to Other Tools
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lyric Lab Button */}
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-3 hover:border-green-500 transition-all border-green-600/30 bg-green-500/5"
              onClick={handleOpenInLyricLab}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2 bg-green-600 rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <Badge className="bg-green-600 text-white">
                  Lyrics
                </Badge>
              </div>

              <div className="text-left w-full">
                <h4 className="font-medium">Open in Lyric Lab</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Edit and improve lyrics for this song
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs text-green-400 w-full">
                <span>Route to Lyric Lab</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </Button>

            {/* Piano Roll Button */}
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-3 hover:border-purple-500 transition-all border-purple-600/30 bg-purple-500/5"
              onClick={handleOpenInPianoRoll}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Music className="h-5 w-5 text-white" />
                </div>
                <Badge className="bg-purple-600 text-white">
                  Melody
                </Badge>
              </div>

              <div className="text-left w-full">
                <h4 className="font-medium">Open in Piano Roll</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Edit melody and musical structure
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs text-purple-400 w-full">
                <span>Route to Piano Roll</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
