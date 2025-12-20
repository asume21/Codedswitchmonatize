import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Mic, Music, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface VocalNote {
  syllable: string;
  pitch: number;
  duration: number;
  startTime: number;
}

interface VocalMelodyResult {
  syllables: string[];
  notes: VocalNote[];
  vocalRange: { low: string; high: string };
  singabilityScore: number;
  tips: string[];
}

interface AIVocalMelodyProps {
  currentKey?: string;
  currentBpm?: number;
  onApplyMelody?: (notes: VocalNote[]) => void;
}

export default function AIVocalMelody({ 
  currentKey = 'C', 
  currentBpm = 120,
  onApplyMelody 
}: AIVocalMelodyProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<VocalMelodyResult | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [key, setKey] = useState(currentKey);
  const [bpm, setBpm] = useState(currentBpm);
  const [mood, setMood] = useState('uplifting');
  const [vocalRange, setVocalRange] = useState('tenor');
  const { toast } = useToast();

  const generateMelody = async () => {
    if (!lyrics.trim()) {
      toast({
        title: "Lyrics Required",
        description: "Please enter some lyrics to generate a melody",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiRequest('POST', '/api/ai/vocal-melody', {
        lyrics,
        key,
        bpm,
        mood,
        vocalRange
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.melody) {
        setResult(data.melody);
        toast({
          title: "Melody Generated",
          description: `Created melody with ${data.melody.notes?.length || 0} notes`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate vocal melody",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getSingabilityColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card data-testid="card-ai-vocal-melody">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="w-4 h-4" />
          AI Vocal Melody
        </CardTitle>
        <Badge variant="secondary" className="text-xs">Pro</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Lyrics</label>
          <Textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Enter your lyrics here...&#10;Each line will be a phrase"
            rows={4}
            className="resize-none text-sm"
            data-testid="textarea-lyrics"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Key</label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger data-testid="select-vocal-key">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">BPM</label>
            <Input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              min={60}
              max={200}
              data-testid="input-vocal-bpm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mood</label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger data-testid="select-vocal-mood">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uplifting">Uplifting</SelectItem>
                <SelectItem value="melancholic">Melancholic</SelectItem>
                <SelectItem value="energetic">Energetic</SelectItem>
                <SelectItem value="romantic">Romantic</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Vocal Range</label>
            <Select value={vocalRange} onValueChange={setVocalRange}>
              <SelectTrigger data-testid="select-vocal-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soprano">Soprano</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="tenor">Tenor</SelectItem>
                <SelectItem value="baritone">Baritone</SelectItem>
                <SelectItem value="bass">Bass</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          className="w-full" 
          onClick={generateMelody} 
          disabled={isGenerating || !lyrics.trim()}
          data-testid="button-generate-vocal-melody"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Composing Melody...
            </>
          ) : (
            <>
              <Music className="w-4 h-4 mr-2" />
              Generate Vocal Melody
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-yellow-500" />
                <span>Singability</span>
              </div>
              <span className={`text-lg font-bold ${getSingabilityColor(result.singabilityScore)}`} data-testid="text-vocal-singability">
                {result.singabilityScore}/10
              </span>
            </div>

            {result.vocalRange && (
              <div className="text-xs bg-muted/50 rounded-md p-2">
                <span className="text-muted-foreground">Range: </span>
                <span className="font-medium">{result.vocalRange.low} - {result.vocalRange.high}</span>
              </div>
            )}

            {result.notes && result.notes.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Melody Preview</span>
                <div className="flex flex-wrap gap-1">
                  {result.notes.slice(0, 16).map((note, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-[10px] font-mono"
                    >
                      {note.syllable}
                    </Badge>
                  ))}
                  {result.notes.length > 16 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{result.notes.length - 16} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {result.tips && result.tips.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm font-medium">Performance Tips</span>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {result.tips.slice(0, 3).map((tip, i) => (
                    <li key={i}>- {tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {onApplyMelody && result.notes && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onApplyMelody(result.notes)}
                data-testid="button-apply-vocal-melody"
              >
                Add to Piano Roll
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
