import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench, Music } from 'lucide-react';
import { AudioToolRouter } from './effects/AudioToolRouter';
import type { ToolRecommendation } from './effects';

interface SongAnalysisPanelProps {
  songUrl: string;
  songName: string;
  analysis?: {
    toolRecommendations?: ToolRecommendation[];
    estimatedBPM?: number;
    keySignature?: string;
    genre?: string;
    mood?: string;
  };
}

export function SongAnalysisPanel({ songUrl, songName, analysis }: SongAnalysisPanelProps) {
  const [showTools, setShowTools] = useState(false);

  if (showTools) {
    return (
      <AudioToolRouter
        songUrl={songUrl}
        songName={songName}
        recommendations={analysis?.toolRecommendations || []}
      />
    );
  }

  const hasRecommendations = (analysis?.toolRecommendations?.length || 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music className="h-5 w-5 text-blue-500" />
            <div>
              <CardTitle className="text-lg">Ready to Process</CardTitle>
              <p className="text-sm text-muted-foreground">{songName}</p>
            </div>
          </div>
          {hasRecommendations && analysis?.toolRecommendations && (
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
              {analysis.toolRecommendations.length} AI Suggestions
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {analysis && (
          <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {analysis.estimatedBPM && (
              <div>
                <span className="text-muted-foreground">BPM:</span>
                <p className="font-medium">{analysis.estimatedBPM}</p>
              </div>
            )}
            {analysis.keySignature && (
              <div>
                <span className="text-muted-foreground">Key:</span>
                <p className="font-medium">{analysis.keySignature}</p>
              </div>
            )}
            {analysis.genre && (
              <div>
                <span className="text-muted-foreground">Genre:</span>
                <p className="font-medium">{analysis.genre}</p>
              </div>
            )}
            {analysis.mood && (
              <div>
                <span className="text-muted-foreground">Mood:</span>
                <p className="font-medium">{analysis.mood}</p>
              </div>
            )}
          </div>
        )}

        <Button onClick={() => setShowTools(true)} className="w-full" size="lg">
          <Wrench className="h-4 w-4 mr-2" />
          Open in Audio Tools
          {hasRecommendations && analysis?.toolRecommendations && (
            <Badge variant="secondary" className="ml-2 bg-white/20">
              {analysis.toolRecommendations.length}
            </Badge>
          )}
        </Button>

        {hasRecommendations && analysis?.toolRecommendations && (
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">
              🤖 AI suggests using these tools:
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.toolRecommendations.map((rec, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {rec.tool}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
