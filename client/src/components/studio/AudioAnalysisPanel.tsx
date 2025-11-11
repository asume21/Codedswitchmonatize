import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import audioAnalyzer, { AnalysisResult, AudioIssue, EditMode } from '@/lib/audioAnalyzer';
import audioRouter from '@/lib/audioRouter';
import {
  AlertCircle,
  CheckCircle,
  Wand2,
  Settings,
  Hand,
  Volume2,
  Mic,
  Activity,
  Sliders,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  XCircle,
  Info,
  Zap,
  Music,
  Headphones
} from 'lucide-react';

interface AudioAnalysisPanelProps {
  audioUrl?: string;
  audioBuffer?: ArrayBuffer;
}

export default function AudioAnalysisPanel({ audioUrl, audioBuffer }: AudioAnalysisPanelProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<AudioIssue | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('guided');

  const analyzeAudio = useCallback(async () => {
    if (!audioUrl && !audioBuffer) {
      toast({
        title: "No audio",
        description: "Please load or generate audio first",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await audioAnalyzer.analyzeAudio(audioUrl || audioBuffer!);
      setAnalysisResult(result);
      
      if (result.issues.length > 0) {
        setSelectedIssue(result.issues[0]); // Select first issue by default
      }

      toast({
        title: "Analysis complete",
        description: `Found ${result.issues.length} ${result.issues.length === 1 ? 'issue' : 'issues'} to fix`
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis failed",
        description: "Could not analyze the audio",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [audioUrl, audioBuffer, toast]);

  const routeToFix = useCallback((issue: AudioIssue, mode: EditMode) => {
    // Update the recommendation with the selected mode
    const recommendation = {
      ...issue.recommendation,
      mode
    };

    // Route through the audio router
    const route = audioAnalyzer.routeToTool(recommendation);

    // Store the issue and mode in local storage for the tool to pick up
    localStorage.setItem('audio_fix_context', JSON.stringify({
      issue,
      mode,
      analysisResult,
      sourceAudio: audioUrl || 'buffer'
    }));

    // Navigate to the tool
    setLocation(route);

    toast({
      title: `Opening ${issue.recommendation.tool}`,
      description: `${mode === 'auto' ? 'AI will fix this automatically' : 
                    mode === 'guided' ? 'AI will guide you through the fix' : 
                    'Full manual control enabled'}`
    });
  }, [analysisResult, audioUrl, setLocation, toast]);

  const getSeverityIcon = (severity: AudioIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: AudioIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'secondary';
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-blue-500';
      case 'fair':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getIssueIcon = (type: AudioIssue['type']) => {
    switch (type) {
      case 'vocals':
        return <Mic className="w-4 h-4" />;
      case 'noise':
        return <Activity className="w-4 h-4" />;
      case 'eq':
        return <Sliders className="w-4 h-4" />;
      case 'dynamics':
        return <Volume2 className="w-4 h-4" />;
      case 'clipping':
        return <Zap className="w-4 h-4" />;
      case 'pitch':
        return <Music className="w-4 h-4" />;
      default:
        return <Headphones className="w-4 h-4" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          AI Audio Analysis & Repair
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Analyze Button */}
        {!analysisResult ? (
          <div className="text-center py-8">
            <Button 
              size="lg" 
              onClick={analyzeAudio}
              disabled={isAnalyzing || (!audioUrl && !audioBuffer)}
              data-testid="button-analyze-audio"
            >
              {isAnalyzing ? (
                <>
                  <Activity className="w-4 h-4 mr-2 animate-pulse" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze Audio
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              AI will detect issues and recommend fixes
            </p>
          </div>
        ) : (
          <>
            {/* Overall Quality */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Quality</span>
                <span className={`text-lg font-bold ${getQualityColor(analysisResult.overallQuality)}`}>
                  {analysisResult.overallQuality.toUpperCase()}
                </span>
              </div>
              
              {/* Audio Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                <div>Duration: {analysisResult.duration.toFixed(1)}s</div>
                <div>Sample Rate: {analysisResult.sampleRate}Hz</div>
                <div>Peak: {analysisResult.peakLevel.toFixed(1)}dB</div>
                <div>RMS: {analysisResult.rmsLevel.toFixed(1)}dB</div>
              </div>

              {/* Frequency Balance */}
              {analysisResult.spectrum && (
                <div className="mt-3">
                  <div className="text-xs font-medium mb-1">Frequency Balance</div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Bass</div>
                      <Progress value={analysisResult.spectrum.bass * 100} className="h-1" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Mid</div>
                      <Progress value={analysisResult.spectrum.midrange * 100} className="h-1" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">High</div>
                      <Progress value={analysisResult.spectrum.treble * 100} className="h-1" />
                    </div>
                  </div>
                  {analysisResult.spectrum.balance !== 'balanced' && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {analysisResult.spectrum.balance}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Issues List */}
            {analysisResult.issues.length > 0 ? (
              <Tabs defaultValue="issues" className="flex-1">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="issues">
                    Issues ({analysisResult.issues.length})
                  </TabsTrigger>
                  <TabsTrigger value="fixes">
                    Recommended Fixes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="issues" className="space-y-2">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {analysisResult.issues.map((issue) => (
                        <Card
                          key={issue.id}
                          className={`cursor-pointer transition-colors ${
                            selectedIssue?.id === issue.id ? 'border-primary' : ''
                          }`}
                          onClick={() => setSelectedIssue(issue)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                              {getIssueIcon(issue.type)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} Issue
                                  </span>
                                  <Badge variant={getSeverityColor(issue.severity) as any} className="text-xs">
                                    {issue.severity}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {issue.description}
                                </p>
                                <div className="flex items-center gap-1 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {issue.recommendation.tool}
                                  </Badge>
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  <Badge variant="outline" className="text-xs">
                                    {issue.recommendation.mode} mode
                                  </Badge>
                                </div>
                              </div>
                              {getSeverityIcon(issue.severity)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="fixes" className="space-y-2">
                  {selectedIssue && (
                    <Card className="border-primary">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            {getIssueIcon(selectedIssue.type)}
                            <h4 className="font-medium">
                              Fix {selectedIssue.type} issue
                            </h4>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {selectedIssue.recommendation.aiPrompt}
                          </p>

                          <div className="space-y-2">
                            <p className="text-xs font-medium">Choose editing mode:</p>
                            
                            {/* Auto Mode */}
                            <Button
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => routeToFix(selectedIssue, 'auto')}
                              data-testid="button-fix-auto"
                            >
                              <Wand2 className="w-4 h-4 mr-2" />
                              <div className="text-left flex-1">
                                <div className="font-medium">AI Auto Fix</div>
                                <div className="text-xs text-muted-foreground">
                                  AI applies the fix automatically
                                </div>
                              </div>
                              <Badge variant="secondary">Fastest</Badge>
                            </Button>

                            {/* Guided Mode */}
                            <Button
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => routeToFix(selectedIssue, 'guided')}
                              data-testid="button-fix-guided"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              <div className="text-left flex-1">
                                <div className="font-medium">AI Guided</div>
                                <div className="text-xs text-muted-foreground">
                                  AI suggests, you approve each step
                                </div>
                              </div>
                              <Badge variant="secondary">Recommended</Badge>
                            </Button>

                            {/* Manual Mode */}
                            <Button
                              variant="outline"
                              className="w-full justify-start"
                              onClick={() => routeToFix(selectedIssue, 'manual')}
                              data-testid="button-fix-manual"
                            >
                              <Hand className="w-4 h-4 mr-2" />
                              <div className="text-left flex-1">
                                <div className="font-medium">Full Manual</div>
                                <div className="text-xs text-muted-foreground">
                                  Complete control, no AI assistance
                                </div>
                              </div>
                              <Badge variant="secondary">Expert</Badge>
                            </Button>
                          </div>

                          {/* Recommended Settings Preview */}
                          {selectedIssue.recommendation.settings && (
                            <div className="bg-muted/30 rounded-lg p-3 mt-3">
                              <p className="text-xs font-medium mb-2">Recommended Settings:</p>
                              <div className="text-xs space-y-1">
                                {Object.entries(selectedIssue.recommendation.settings).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="text-muted-foreground">{key}:</span>
                                    <span className="font-mono">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="font-medium">No issues detected!</p>
                <p className="text-sm text-muted-foreground">Your audio quality is excellent</p>
              </div>
            )}

            {/* Re-analyze Button */}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={analyzeAudio}
              disabled={isAnalyzing}
              data-testid="button-reanalyze"
            >
              <Activity className="w-4 h-4 mr-2" />
              Re-analyze Audio
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}