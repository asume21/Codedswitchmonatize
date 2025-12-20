import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, LayoutList, ArrowRight, Music2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ArrangementSection {
  name: string;
  startBar: number;
  endBar: number;
  energy: 'low' | 'medium' | 'high';
  instruments: string[];
  dynamics: string;
}

interface ArrangementResult {
  totalBars: number;
  sections: ArrangementSection[];
  transitions: { from: string; to: string; type: string; bar: number }[];
  recommendations: string[];
}

interface AIArrangementBuilderProps {
  currentBpm?: number;
  currentKey?: string;
  onApplyArrangement?: (arrangement: ArrangementResult) => void;
}

export default function AIArrangementBuilder({ 
  currentBpm = 120, 
  currentKey = 'C',
  onApplyArrangement 
}: AIArrangementBuilderProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [arrangement, setArrangement] = useState<ArrangementResult | null>(null);
  const [bpm, setBpm] = useState(currentBpm);
  const [key, setKey] = useState(currentKey);
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('energetic');
  const [duration, setDuration] = useState(3);
  const { toast } = useToast();

  const generateArrangement = async () => {
    setIsGenerating(true);
    try {
      const response = await apiRequest('POST', '/api/ai/arrangement', {
        bpm,
        key,
        genre,
        mood,
        durationMinutes: duration,
        existingSections: []
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.arrangement) {
        setArrangement(data.arrangement);
        toast({
          title: "Arrangement Generated",
          description: `Created ${data.arrangement.sections?.length || 0} sections`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate arrangement",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getEnergyColor = (energy: string) => {
    switch (energy) {
      case 'high': return 'bg-red-500/20 text-red-500';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500';
      case 'low': return 'bg-blue-500/20 text-blue-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card data-testid="card-ai-arrangement">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutList className="w-4 h-4" />
          AI Arrangement Builder
        </CardTitle>
        <Badge variant="secondary" className="text-xs">Pro</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">BPM</label>
            <Input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              min={60}
              max={200}
              data-testid="input-arrangement-bpm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Key</label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger data-testid="select-arrangement-key">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Genre</label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger data-testid="select-arrangement-genre">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pop">Pop</SelectItem>
                <SelectItem value="rock">Rock</SelectItem>
                <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                <SelectItem value="electronic">Electronic</SelectItem>
                <SelectItem value="r-and-b">R&B</SelectItem>
                <SelectItem value="jazz">Jazz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mood</label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger data-testid="select-arrangement-mood">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="energetic">Energetic</SelectItem>
                <SelectItem value="calm">Calm</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="uplifting">Uplifting</SelectItem>
                <SelectItem value="melancholic">Melancholic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Duration: {duration} minutes</label>
          <Input
            type="range"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={2}
            max={6}
            step={0.5}
            className="w-full"
            data-testid="input-arrangement-duration"
          />
        </div>

        <Button 
          className="w-full" 
          onClick={generateArrangement} 
          disabled={isGenerating}
          data-testid="button-generate-arrangement"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Building Arrangement...
            </>
          ) : (
            <>
              <LayoutList className="w-4 h-4 mr-2" />
              Generate Arrangement
            </>
          )}
        </Button>

        {arrangement && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Length</span>
              <span className="font-medium" data-testid="text-arrangement-bars">{arrangement.totalBars} bars</span>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Sections</span>
              <div className="space-y-1">
                {arrangement.sections?.map((section, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Music2 className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{section.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {section.startBar}-{section.endBar}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] ${getEnergyColor(section.energy)}`}
                      >
                        {section.energy}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {arrangement.transitions && arrangement.transitions.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Transitions</span>
                <div className="flex flex-wrap gap-1">
                  {arrangement.transitions.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {t.from} <ArrowRight className="w-2 h-2 mx-1" /> {t.to}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {arrangement.recommendations && arrangement.recommendations.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm font-medium">Tips</span>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {arrangement.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i}>- {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {onApplyArrangement && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onApplyArrangement(arrangement)}
                data-testid="button-apply-arrangement"
              >
                Apply to Timeline
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
