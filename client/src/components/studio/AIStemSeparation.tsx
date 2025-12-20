import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Scissors, Music, Mic2, Drum, Guitar, Piano, Download, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface StemResult {
  vocals?: string;
  accompaniment?: string;
  drums?: string;
  bass?: string;
  other?: string;
  piano?: string;
}

interface AIStemSeparationProps {
  audioUrl?: string;
  onStemsReady?: (stems: StemResult) => void;
}

export default function AIStemSeparation({ audioUrl: initialUrl, onStemsReady }: AIStemSeparationProps) {
  const [audioUrl, setAudioUrl] = useState(initialUrl || '');
  const [stemCount, setStemCount] = useState<'2' | '4' | '5'>('2');
  const [isProcessing, setIsProcessing] = useState(false);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [stems, setStems] = useState<StemResult | null>(null);
  const [playingStem, setPlayingStem] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (predictionId && isProcessing) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/ai/stem-separation/status/${predictionId}`);
          const data = await response.json();
          
          if (data.status === 'completed' && data.stems) {
            setStems(data.stems);
            setIsProcessing(false);
            setPredictionId(null);
            onStemsReady?.(data.stems);
            toast({
              title: "Separation Complete",
              description: `Successfully separated into ${Object.keys(data.stems).length} stems`,
            });
          } else if (data.status === 'failed') {
            setIsProcessing(false);
            setPredictionId(null);
            toast({
              title: "Separation Failed",
              description: data.error || "Could not separate audio",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Status check error:', error);
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [predictionId, isProcessing, onStemsReady, toast]);

  const startSeparation = async () => {
    if (!audioUrl) {
      toast({
        title: "URL Required",
        description: "Please enter an audio URL",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setStems(null);

    try {
      const response = await apiRequest('POST', '/api/ai/stem-separation', {
        audioUrl,
        stemCount: parseInt(stemCount)
      });

      const data = await response.json();

      if (data.success && data.predictionId) {
        setPredictionId(data.predictionId);
        toast({
          title: "Processing Started",
          description: data.message,
        });
      } else {
        throw new Error(data.message || 'Failed to start separation');
      }
    } catch (error: any) {
      setIsProcessing(false);
      toast({
        title: "Error",
        description: error.message || "Failed to start separation",
        variant: "destructive"
      });
    }
  };

  const playStem = (stemName: string, url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (playingStem === stemName) {
      setPlayingStem(null);
      return;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingStem(stemName);
    
    audio.onended = () => setPlayingStem(null);
  };

  const getStemIcon = (stemName: string) => {
    switch (stemName) {
      case 'vocals': return <Mic2 className="w-4 h-4" />;
      case 'drums': return <Drum className="w-4 h-4" />;
      case 'bass': return <Guitar className="w-4 h-4" />;
      case 'piano': return <Piano className="w-4 h-4" />;
      default: return <Music className="w-4 h-4" />;
    }
  };

  const stemDescriptions: Record<string, string> = {
    '2': 'Vocals + Accompaniment',
    '4': 'Vocals + Drums + Bass + Other',
    '5': 'Vocals + Drums + Bass + Piano + Other'
  };

  return (
    <Card data-testid="card-ai-stem-separation">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Scissors className="w-4 h-4" />
          AI Stem Separation
        </CardTitle>
        <Badge variant="secondary" className="text-xs">Pro</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Split any song into separate stems (vocals, drums, bass, etc.) using AI
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Audio URL</label>
            <Input
              data-testid="input-stem-audio-url"
              placeholder="https://example.com/song.mp3"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Stem Count</label>
            <Select 
              value={stemCount} 
              onValueChange={(v) => setStemCount(v as '2' | '4' | '5')}
              disabled={isProcessing}
            >
              <SelectTrigger data-testid="select-stem-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Stems</SelectItem>
                <SelectItem value="4">4 Stems</SelectItem>
                <SelectItem value="5">5 Stems</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{stemDescriptions[stemCount]}</p>
          </div>

          <Button
            data-testid="button-start-separation"
            onClick={startSeparation}
            disabled={isProcessing || !audioUrl}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Separating... (1-3 min)
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4 mr-2" />
                Separate Stems
              </>
            )}
          </Button>
        </div>

        {stems && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium">Separated Stems</h4>
            <div className="grid gap-2">
              {Object.entries(stems).map(([name, url]) => (
                <div 
                  key={name}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {getStemIcon(name)}
                    <span className="text-sm capitalize">{name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => playStem(name, url as string)}
                      data-testid={`button-play-stem-${name}`}
                    >
                      <Volume2 className={`w-4 h-4 ${playingStem === name ? 'text-primary' : ''}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                    >
                      <a href={url as string} download={`${name}.wav`} data-testid={`button-download-stem-${name}`}>
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
