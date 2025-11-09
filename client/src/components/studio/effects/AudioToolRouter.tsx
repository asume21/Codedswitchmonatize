import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  AlertTriangle
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
  songUrl: string;
  songName: string;
  recommendations?: ToolRecommendation[];
}

export function AudioToolRouter({ songUrl, songName, recommendations = [] }: AudioToolRouterProps) {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);

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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Audio Processing Tools</CardTitle>
        <p className="text-sm text-muted-foreground">
          Select a tool to process: <strong>{songName}</strong>
        </p>
      </CardHeader>

      <CardContent>
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
      </CardContent>
    </Card>
  );
}
