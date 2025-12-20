import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2, Volume2, Gauge, Waves, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface MasteringAnalysis {
  loudnessAnalysis: {
    currentLUFS: number;
    targetLUFS: number;
    recommendation: string;
  };
  eq: {
    lowCut: number;
    bassBoost: { freq: number; gain: number };
    midPresence: { freq: number; gain: number };
    airBoost: { freq: number; gain: number };
    recommendations: string[];
  };
  compression: {
    ratio: string;
    attack: string;
    release: string;
    threshold: number;
    recommendation: string;
  };
  limiter: {
    ceiling: number;
    release: string;
    recommendation: string;
  };
  stereoWidth: {
    current: string;
    recommendation: string;
  };
  overallScore: number;
  topIssues: string[];
  quickFixes: string[];
}

interface AIMasteringCardProps {
  peakLevel?: number;
  rmsLevel?: number;
  frequencyData?: { bass: number; mids: number; highs: number };
  onApplySuggestion?: (type: string, value: any) => void;
}

export default function AIMasteringCard({ 
  peakLevel = -3, 
  rmsLevel = -12, 
  frequencyData,
  onApplySuggestion 
}: AIMasteringCardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MasteringAnalysis | null>(null);
  const [genre, setGenre] = useState('pop');
  const [targetLoudness, setTargetLoudness] = useState(-14);
  const { toast } = useToast();

  const analyzeMix = async () => {
    setIsAnalyzing(true);
    try {
      const response = await apiRequest('POST', '/api/ai/mastering', {
        peakLevel,
        rmsLevel,
        frequencyData,
        genre,
        targetLoudness
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        toast({
          title: "Analysis Complete",
          description: `Mastering suggestions generated via ${data.provider}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze mix",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card data-testid="card-ai-mastering">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="w-4 h-4" />
          AI Mastering Assistant
        </CardTitle>
        <Badge variant="secondary" className="text-xs">Pro</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Genre</label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger data-testid="select-mastering-genre">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pop">Pop</SelectItem>
                <SelectItem value="rock">Rock</SelectItem>
                <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                <SelectItem value="electronic">Electronic</SelectItem>
                <SelectItem value="jazz">Jazz</SelectItem>
                <SelectItem value="classical">Classical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Target LUFS: {targetLoudness}</label>
            <Slider
              value={[targetLoudness]}
              onValueChange={([val]) => setTargetLoudness(val)}
              min={-20}
              max={-8}
              step={1}
              data-testid="slider-target-loudness"
            />
          </div>
        </div>

        <Button 
          className="w-full" 
          onClick={analyzeMix} 
          disabled={isAnalyzing}
          data-testid="button-analyze-mix"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing Mix...
            </>
          ) : (
            <>
              <Waves className="w-4 h-4 mr-2" />
              Analyze Mix
            </>
          )}
        </Button>

        {analysis && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Mix Score</span>
              <span className={`text-2xl font-bold ${getScoreColor(analysis.overallScore)}`} data-testid="text-mastering-score">
                {analysis.overallScore}/10
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Loudness</span>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <p>Current: {analysis.loudnessAnalysis.currentLUFS} LUFS</p>
                <p>Target: {analysis.loudnessAnalysis.targetLUFS} LUFS</p>
                <p className="mt-1 text-foreground">{analysis.loudnessAnalysis.recommendation}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Waves className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">EQ Suggestions</span>
              </div>
              <div className="text-xs space-y-1 bg-muted/50 rounded-md p-2">
                <p>Low Cut: {analysis.eq.lowCut}Hz</p>
                <p>Bass Boost: {analysis.eq.bassBoost.freq}Hz @ +{analysis.eq.bassBoost.gain}dB</p>
                <p>Presence: {analysis.eq.midPresence.freq}Hz @ +{analysis.eq.midPresence.gain}dB</p>
                <p>Air: {analysis.eq.airBoost.freq}Hz @ +{analysis.eq.airBoost.gain}dB</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Dynamics</span>
              </div>
              <div className="text-xs space-y-1 bg-muted/50 rounded-md p-2">
                <p>Compression: {analysis.compression.ratio}, {analysis.compression.attack} attack</p>
                <p>Limiter Ceiling: {analysis.limiter.ceiling}dB</p>
                <p className="mt-1 text-foreground">{analysis.compression.recommendation}</p>
              </div>
            </div>

            {analysis.topIssues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">Issues Found</span>
                </div>
                <ul className="text-xs space-y-1">
                  {analysis.topIssues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-yellow-500">-</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.quickFixes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Quick Fixes</span>
                </div>
                <ul className="text-xs space-y-1">
                  {analysis.quickFixes.map((fix, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-500">+</span>
                      {fix}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {onApplySuggestion && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onApplySuggestion('mastering', analysis)}
                data-testid="button-apply-mastering"
              >
                Apply Suggestions to Master Chain
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
