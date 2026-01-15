import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Scissors, Music, Mic2, Drum, Guitar, Piano, Download, Volume2, Upload, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

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
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Check for routed song from Song Library/Uploader
  useEffect(() => {
    const routedUrl = sessionStorage.getItem('stem_separator_url');
    const routedName = sessionStorage.getItem('stem_separator_name');
    
    if (routedUrl) {
      setAudioUrl(routedUrl);
      setUploadedFileName(routedName || 'Routed Song');
      
      // Clear sessionStorage
      sessionStorage.removeItem('stem_separator_url');
      sessionStorage.removeItem('stem_separator_name');
      
      toast({
        title: "Song Loaded",
        description: `${routedName || 'Song'} ready for stem separation`,
      });
    }
  }, [toast]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setUploadedFileName(file.name);
      toast({
        title: "File Loaded",
        description: `${file.name} ready for stem separation`,
      });
    }
  };

  const startSeparation = async () => {
    if (!audioUrl) {
      toast({
        title: "Audio Required",
        description: "Please upload a file or enter an audio URL",
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

      // New flow: results come back directly (no polling needed)
      if (data.success && data.status === 'completed' && data.stems) {
        setStems(data.stems);
        setIsProcessing(false);
        onStemsReady?.(data.stems);
        toast({
          title: "Separation Complete",
          description: data.message || `Successfully separated into stems`,
        });
      } else if (data.success && data.predictionId) {
        // Legacy flow: poll for results
        setPredictionId(data.predictionId);
        toast({
          title: "Processing Started",
          description: data.message,
        });
      } else {
        throw new Error(data.message || data.error || 'Failed to separate stems');
      }
    } catch (error: any) {
      setIsProcessing(false);
      toast({
        title: "Separation Failed",
        description: error.message || "Failed to separate stems",
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

  const sendToAstutely = () => {
    if (!stems) return;
    
    // Store stems in sessionStorage for Astutely to access
    sessionStorage.setItem('astutely_stems', JSON.stringify(stems));
    sessionStorage.setItem('astutely_stem_source', uploadedFileName || 'Separated Track');
    
    toast({
      title: "Routing to Astutely",
      description: `Sending ${Object.keys(stems).length} stems for AI remixing`,
    });
    
    // Navigate to mixer with AI tab active
    setLocation('/mixer?tab=ai-mix');
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
          {!audioUrl && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                💡 <strong>Tip:</strong> Upload your song in the <strong>Upload</strong> tab, then click <strong>"Separate Stems"</strong> to route it here automatically.
              </p>
            </div>
          )}
          
          {audioUrl && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-xs text-green-300">
                ✓ Song loaded: <strong>{uploadedFileName || 'Ready for separation'}</strong>
              </p>
            </div>
          )}

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
          <div className="space-y-3 pt-2 border-t">
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
            
            {/* Send to Astutely Button */}
            <Button
              onClick={sendToAstutely}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              data-testid="button-send-to-astutely"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Send to Astutely for AI Remix
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
