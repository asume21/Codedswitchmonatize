import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wrench, Music, FileText, Loader2, Sparkles } from 'lucide-react';
import { AudioToolRouter } from './effects/AudioToolRouter';
import type { ToolRecommendation } from './effects';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  const [transcription, setTranscription] = useState<string | null>(null);
  const [lyricAnalysis, setLyricAnalysis] = useState<any>(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const { toast } = useToast();

  const transcribeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/transcribe', {
        fileUrl: songUrl
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTranscription(data.transcription.text);
      setShowTranscription(true);
      toast({
        title: "Transcription Complete",
        description: "Lyrics have been transcribed from audio.",
      });
      // Auto-analyze after transcription
      analyzeLyricsMutation.mutate(data.transcription.text);
    },
    onError: (error: Error) => {
      toast({
        title: "Transcription Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const analyzeLyricsMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest('POST', '/api/lyrics/analyze', {
        lyrics: text,
        genre: analysis?.genre || 'unknown',
        enhanceWithAI: true
      });
      return response.json();
    },
    onSuccess: (data) => {
      setLyricAnalysis(data.analysis);
      toast({
        title: "Analysis Complete",
        description: "AI has analyzed the lyrics.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

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
    <div className="space-y-6">
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

        <CardContent className="space-y-4">
          {analysis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={() => setShowTools(true)} className="w-full" size="lg">
              <Wrench className="h-4 w-4 mr-2" />
              Open in Audio Tools
              {hasRecommendations && analysis?.toolRecommendations && (
                <Badge variant="secondary" className="ml-2 bg-white/20">
                  {analysis.toolRecommendations.length}
                </Badge>
              )}
            </Button>

            <Button 
              onClick={() => transcribeMutation.mutate()} 
              disabled={transcribeMutation.isPending}
              variant="outline" 
              className="w-full" 
              size="lg"
            >
              {transcribeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transcribing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Transcribe & Analyze Lyrics
                </>
              )}
            </Button>
          </div>

          {hasRecommendations && analysis?.toolRecommendations && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
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

      {/* Transcription & Analysis Result */}
      {(showTranscription || transcribeMutation.isPending) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" />
                Lyrics & Analysis
              </CardTitle>
              {lyricAnalysis && (
                <Badge className={lyricAnalysis.quality_score >= 80 ? "bg-green-500" : "bg-yellow-500"}>
                  Quality Score: {Math.round(lyricAnalysis.quality_score)}/100
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lyrics Text */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">Transcribed Lyrics</h3>
                <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                  {transcription ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{transcription}</p>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {transcribeMutation.isPending ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                          <p>Transcribing audio...</p>
                        </div>
                      ) : (
                        <p>No transcription available</p>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Analysis Results */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground">AI Insights</h3>
                {lyricAnalysis ? (
                  <ScrollArea className="h-[300px] w-full pr-4">
                    <div className="space-y-4">
                      {/* AI Suggestions */}
                      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <h4 className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
                          <Sparkles className="h-3 w-3" />
                          Suggestions
                        </h4>
                        <ul className="space-y-1">
                          {lyricAnalysis.ai_insights?.improvement_areas?.map((area: string, i: number) => (
                            <li key={i} className="text-xs list-disc list-inside text-muted-foreground">{area}</li>
                          ))}
                          {(!lyricAnalysis.ai_insights?.improvement_areas?.length) && (
                            <li className="text-xs text-muted-foreground">No specific improvements found. Good job!</li>
                          )}
                        </ul>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-secondary/50 rounded-lg">
                          <span className="text-xs text-muted-foreground block">Rhyme Scheme</span>
                          <span className="text-sm font-mono font-medium">{lyricAnalysis.rhyme_scheme}</span>
                        </div>
                        <div className="p-3 bg-secondary/50 rounded-lg">
                          <span className="text-xs text-muted-foreground block">Sentiment</span>
                          <span className="text-sm font-medium capitalize">{lyricAnalysis.sentiment?.mood}</span>
                        </div>
                        <div className="p-3 bg-secondary/50 rounded-lg">
                          <span className="text-xs text-muted-foreground block">Unique Words</span>
                          <span className="text-sm font-medium">{lyricAnalysis.basic_stats?.unique_word_count}</span>
                        </div>
                        <div className="p-3 bg-secondary/50 rounded-lg">
                          <span className="text-xs text-muted-foreground block">Avg Syllables</span>
                          <span className="text-sm font-medium">{lyricAnalysis.syllable_analysis?.avg_syllables.toFixed(1)}</span>
                        </div>
                      </div>

                      {/* Themes */}
                      <div>
                        <span className="text-xs text-muted-foreground block mb-2">Detected Themes</span>
                        <div className="flex flex-wrap gap-1">
                          {lyricAnalysis.themes?.map((t: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {t.theme}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center justify-center h-[300px] border rounded-md bg-secondary/20">
                    {analyzeLyricsMutation.isPending ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p>Analyzing lyrics...</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Analysis will appear here</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
