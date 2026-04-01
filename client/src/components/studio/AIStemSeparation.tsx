import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Scissors, Music, Mic2, Drum, Guitar, Piano, Download, Volume2, Upload, Wand2, Square, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useTracks } from '@/hooks/useTracks';

interface StemResult {
  vocals?: string;
  accompaniment?: string;
  drums?: string;
  bass?: string;
  other?: string;
  piano?: string;
}

interface MasteringAnalysis {
  overallScore?: number;
  quickFixes?: string[];
  topIssues?: string[];
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
  const [pipelineStatus, setPipelineStatus] = useState<string>('');
  const [voiceId, setVoiceId] = useState<string>(() => localStorage.getItem('elevenlabs:voiceId') || '');
  const [isCloning, setIsCloning] = useState(false);
  const [clonedVocalsUrl, setClonedVocalsUrl] = useState<string | null>(null);
  const [remixPreviewUrl, setRemixPreviewUrl] = useState<string | null>(null);
  const [masteringAnalysis, setMasteringAnalysis] = useState<MasteringAnalysis | null>(null);
  const [playingStem, setPlayingStem] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remixedObjectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { addTrack } = useTracks();

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
    
    // Restore previously separated stems from sessionStorage (persistence)
    const savedStems = sessionStorage.getItem('separated_stems');
    const savedSource = sessionStorage.getItem('separated_stems_source');
    if (savedStems) {
      try {
        const parsedStems = JSON.parse(savedStems);
        setStems(parsedStems);
        if (savedSource) setUploadedFileName(savedSource);
      } catch (e) {
        console.error('Failed to restore stems:', e);
      }
    }
  }, [toast]);
  
  // Persist stems to sessionStorage whenever they change
  useEffect(() => {
    if (stems) {
      sessionStorage.setItem('separated_stems', JSON.stringify(stems));
      sessionStorage.setItem('separated_stems_source', uploadedFileName);
    }
  }, [stems, uploadedFileName]);

  useEffect(() => {
    if (voiceId.trim()) {
      localStorage.setItem('elevenlabs:voiceId', voiceId.trim());
    }
  }, [voiceId]);

  useEffect(() => {
    return () => {
      if (remixedObjectUrlRef.current) {
        URL.revokeObjectURL(remixedObjectUrlRef.current);
      }
    };
  }, []);

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

  const audioBufferToWavBlob = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = buffer.length * blockAlign;

    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  const renderRemixPreview = async (vocalUrl: string, backingUrl: string): Promise<string> => {
    const [vocalRes, backingRes] = await Promise.all([fetch(vocalUrl), fetch(backingUrl)]);
    if (!vocalRes.ok || !backingRes.ok) {
      throw new Error('Could not download vocal or backing stem for remix preview');
    }

    const audioContext = new AudioContext();
    try {
      const [vocalBufRaw, backingBufRaw] = await Promise.all([
        audioContext.decodeAudioData(await vocalRes.arrayBuffer()),
        audioContext.decodeAudioData(await backingRes.arrayBuffer()),
      ]);

      const sampleRate = 44100;
      const channels = 2;
      const duration = Math.max(vocalBufRaw.duration, backingBufRaw.duration, 1);
      const offline = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);

      const toStereo = (source: AudioBuffer) => {
        if (source.numberOfChannels >= 2 && source.sampleRate === sampleRate) {
          return source;
        }
        const converted = offline.createBuffer(2, Math.ceil(source.duration * sampleRate), sampleRate);
        const leftSource = source.getChannelData(0);
        const rightSource = source.numberOfChannels > 1 ? source.getChannelData(1) : leftSource;
        converted.getChannelData(0).set(leftSource);
        converted.getChannelData(1).set(rightSource);
        return converted;
      };

      const backingSource = offline.createBufferSource();
      backingSource.buffer = toStereo(backingBufRaw);
      const backingGain = offline.createGain();
      backingGain.gain.value = 0.88;
      backingSource.connect(backingGain).connect(offline.destination);
      backingSource.start(0);

      const vocalSource = offline.createBufferSource();
      vocalSource.buffer = toStereo(vocalBufRaw);
      const vocalGain = offline.createGain();
      vocalGain.gain.value = 1.0;
      vocalSource.connect(vocalGain).connect(offline.destination);
      vocalSource.start(0);

      const rendered = await offline.startRendering();
      const blob = audioBufferToWavBlob(rendered);

      if (remixedObjectUrlRef.current) {
        URL.revokeObjectURL(remixedObjectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(blob);
      remixedObjectUrlRef.current = objectUrl;
      return objectUrl;
    } finally {
      await audioContext.close();
    }
  };

  const runCloneRemixMaster = async () => {
    if (!stems?.vocals) {
      toast({
        title: 'No vocal stem available',
        description: 'Separate stems first to extract vocals before cloning.',
        variant: 'destructive',
      });
      return;
    }

    if (!voiceId.trim()) {
      toast({
        title: 'Voice ID required',
        description: 'Enter your ElevenLabs voice ID to clone the vocals.',
        variant: 'destructive',
      });
      return;
    }

    setIsCloning(true);
    setPipelineStatus('Cloning vocal stem with ElevenLabs...');

    try {
      const cloneResponse = await apiRequest('POST', `/api/voices/${encodeURIComponent(voiceId.trim())}/convert`, {
        audioUrl: stems.vocals,
        provider: 'elevenlabs',
      });

      const cloneData = await cloneResponse.json();
      if (!cloneData?.success || !cloneData?.url) {
        throw new Error(cloneData?.message || 'Voice cloning failed');
      }

      const replacedVocalsUrl = String(cloneData.url);
      const updatedStems = {
        ...stems,
        vocals: replacedVocalsUrl,
      };

      setClonedVocalsUrl(replacedVocalsUrl);
      setStems(updatedStems);
      onStemsReady?.(updatedStems);

      setPipelineStatus('Rendering remix preview...');
      const backingUrl = updatedStems.accompaniment || updatedStems.other || updatedStems.drums;
      if (backingUrl) {
        const previewUrl = await renderRemixPreview(replacedVocalsUrl, backingUrl);
        setRemixPreviewUrl(previewUrl);
      }

      setPipelineStatus('Generating mastering guidance...');
      const masterResponse = await apiRequest('POST', '/api/ai/mastering', {
        peakLevel: -3,
        rmsLevel: -14,
        genre: 'pop',
        targetLoudness: -14,
      });
      const masterData = await masterResponse.json();
      if (masterData?.success && masterData?.analysis) {
        setMasteringAnalysis(masterData.analysis);
      }

      setPipelineStatus('Complete: vocals cloned, remix preview rendered, mastering plan ready.');
      toast({
        title: 'Pipeline complete',
        description: 'Cloned vocal and remix/mastering outputs are ready below.',
      });
    } catch (error: any) {
      setPipelineStatus('Pipeline failed.');
      toast({
        title: 'Clone/remix failed',
        description: error?.message || 'Could not run cloned vocal remix pipeline.',
        variant: 'destructive',
      });
    } finally {
      setIsCloning(false);
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
    setClonedVocalsUrl(null);
    setRemixPreviewUrl(null);
    setMasteringAnalysis(null);
    setPipelineStatus('Separating stems...');

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
        setPipelineStatus('Stems ready. Clone vocals next.');
        onStemsReady?.(data.stems);
        toast({
          title: "Separation Complete",
          description: data.message || `Successfully separated into stems`,
        });
      } else if (data.success && data.predictionId) {
        // Legacy flow: poll for results
        setPredictionId(data.predictionId);
        setPipelineStatus('Stem job submitted. Waiting for completion...');
        toast({
          title: "Processing Started",
          description: data.message,
        });
      } else {
        throw new Error(data.message || data.error || 'Failed to separate stems');
      }
    } catch (error: any) {
      setIsProcessing(false);
      setPipelineStatus('Stem separation failed.');
      toast({
        title: "Separation Failed",
        description: error.message || "Failed to separate stems",
        variant: "destructive"
      });
    }
  };

  const playStem = (stemName: string, url: string) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Toggle off if clicking same stem
    if (playingStem === stemName) {
      setPlayingStem(null);
      return;
    }

    // Create and play new audio
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingStem(stemName);
    
    audio.onended = () => {
      setPlayingStem(null);
      audioRef.current = null;
    };
    
    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      setPlayingStem(null);
      audioRef.current = null;
      toast({
        title: "Playback Error",
        description: `Could not play ${stemName}. Try downloading instead.`,
        variant: "destructive"
      });
    };
    
    audio.play().catch(err => {
      console.error('Failed to play audio:', err);
      setPlayingStem(null);
      toast({
        title: "Playback Error",
        description: "Browser blocked audio playback. Click again to retry.",
        variant: "destructive"
      });
    });
  };
  
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingStem(null);
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
    
    // Stop any playing audio first
    stopPlayback();
    
    // Add each stem as a track in the project
    const stemColors: Record<string, string> = {
      vocals: '#ec4899',
      drums: '#f59e0b', 
      bass: '#8b5cf6',
      other: '#06b6d4',
      piano: '#10b981',
      accompaniment: '#6366f1',
    };
    
    const sourceName = uploadedFileName || 'Separated Track';
    let addedCount = 0;
    
    Object.entries(stems).forEach(([stemName, url]) => {
      if (url) {
        addTrack({
          name: `${sourceName} - ${stemName.charAt(0).toUpperCase() + stemName.slice(1)}`,
          type: 'audio',
          kind: 'audio',
          audioUrl: url as string,
          source: 'stem-separation',
          color: stemColors[stemName] || '#64748b',
          volume: 0.8,
          pan: 0,
        });
        addedCount++;
      }
    });
    
    // Also store in sessionStorage for other components
    sessionStorage.setItem('astutely_stems', JSON.stringify(stems));
    sessionStorage.setItem('astutely_stem_source', sourceName);
    
    toast({
      title: "Stems Added to Project",
      description: `${addedCount} stems added as tracks. Switch to Mixer or Arrangement to see them.`,
    });
    
    // Dispatch event to switch to mixer tab within studio
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'mixer' }));
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

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ElevenLabs Voice ID</label>
            <Input
              id="stem-voice-id"
              name="stem-voice-id"
              autoComplete="off"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="e.g. 0UoWMp8jHDjyEstFbfsf"
              disabled={isProcessing || isCloning}
              data-testid="input-elevenlabs-voice-id"
            />
            <p className="text-xs text-muted-foreground">Used to replace the separated vocal stem with your cloned voice.</p>
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

          <Button
            onClick={runCloneRemixMaster}
            disabled={isProcessing || isCloning || !stems?.vocals || !voiceId.trim()}
            className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500"
            data-testid="button-clone-remix-master"
          >
            {isCloning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Vocal Clone + Remix + Master...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Clone Vocal + Remix + Master Plan
              </>
            )}
          </Button>

          {pipelineStatus && (
            <div className="rounded-md border border-purple-500/30 bg-purple-500/10 p-2 text-xs text-purple-100" data-testid="text-pipeline-status">
              {pipelineStatus}
            </div>
          )}
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
                      {playingStem === name ? (
                        <Square className="w-4 h-4 text-primary fill-primary" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                    >
                      <a href={url as string} download={`${name}.mp3`} data-testid={`button-download-stem-${name}`}>
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

            {clonedVocalsUrl && (
              <div className="space-y-2 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
                <p className="text-xs font-semibold text-fuchsia-200">Cloned Vocal Stem</p>
                <audio src={clonedVocalsUrl} controls className="w-full" />
                <a href={clonedVocalsUrl} download="cloned-vocals.mp3" className="text-xs text-fuchsia-100 underline">
                  Download cloned vocal
                </a>
              </div>
            )}

            {remixPreviewUrl && (
              <div className="space-y-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3">
                <p className="text-xs font-semibold text-cyan-200">Remix Preview (Cloned Vocal + Backing)</p>
                <audio src={remixPreviewUrl} controls className="w-full" />
                <a href={remixPreviewUrl} download="cloned-remix-preview.wav" className="text-xs text-cyan-100 underline">
                  Download remix preview
                </a>
              </div>
            )}

            {masteringAnalysis && (
              <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                <p className="font-semibold">Mastering Guidance</p>
                {typeof masteringAnalysis.overallScore === 'number' && (
                  <p>Overall score: {masteringAnalysis.overallScore}/10</p>
                )}
                {Array.isArray(masteringAnalysis.topIssues) && masteringAnalysis.topIssues.length > 0 && (
                  <div>
                    <p className="font-medium">Top Issues:</p>
                    <ul className="list-disc list-inside">
                      {masteringAnalysis.topIssues.slice(0, 3).map((issue, i) => (
                        <li key={`${issue}-${i}`}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(masteringAnalysis.quickFixes) && masteringAnalysis.quickFixes.length > 0 && (
                  <div>
                    <p className="font-medium">Quick Fixes:</p>
                    <ul className="list-disc list-inside">
                      {masteringAnalysis.quickFixes.slice(0, 3).map((fix, i) => (
                        <li key={`${fix}-${i}`}>{fix}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
