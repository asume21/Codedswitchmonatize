import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Wand2, Music, DollarSign, Piano, Play, Pause, Square } from 'lucide-react';
import { RealisticAudioEngine } from '@/lib/realisticAudio';
import { UpgradeModal, useLicenseGate } from '@/lib/LicenseGuard';

interface MusicGenerationPanelProps {
  onMusicGenerated?: (audioUrl: string, metadata: any) => void;
}

export default function MusicGenerationPanel({ onMusicGenerated }: MusicGenerationPanelProps) {
  const [provider, setProvider] = useState<'musicgen' | 'suno'>('musicgen');
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('electronic');
  const [duration, setDuration] = useState([30]);
  const [bpm, setBpm] = useState([120]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useRealisticInstruments, setUseRealisticInstruments] = useState(true); // Default to realistic
  const [isPlaying, setIsPlaying] = useState(false);
  const [_generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null); // For raw audio files
  const { toast } = useToast();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { requirePro, startUpgrade } = useLicenseGate();
  
  const audioEngineRef = useRef<RealisticAudioEngine | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentPatternRef = useRef<any>(null);
  const _audioElementRef = useRef<HTMLAudioElement | null>(null); // For playing raw audio files
  
  // Initialize audio engine
  useEffect(() => {
    if (useRealisticInstruments && !audioEngineRef.current) {
      audioEngineRef.current = new RealisticAudioEngine();
    }
  }, [useRealisticInstruments]);

  const providers = {
    musicgen: {
      name: 'MusicGen',
      icon: Music,
      cost: 'Low',
      quality: 'Good',
      maxDuration: 30,
      description: 'Fast, affordable instrumental generation',
      color: 'bg-blue-600',
    },
    suno: {
      name: 'Suno AI',
      icon: Wand2,
      cost: 'High',
      quality: 'Exceptional',
      maxDuration: 240,
      description: 'Professional quality with vocals',
      color: 'bg-purple-600',
    },
  };

  const genres = [
    'electronic', 'hip-hop', 'rock', 'pop', 'jazz', 'classical', 
    'ambient', 'lo-fi', 'trap', 'house', 'techno', 'dubstep',
    'r&b', 'funk', 'reggae', 'country', 'metal', 'indie'
  ];

  // Play generated pattern through RealisticAudioEngine
  const playPattern = async (pattern: any) => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new RealisticAudioEngine();
    }
    
    const engine = audioEngineRef.current;
    await engine.initialize();
    
    // Load all instruments needed for the pattern
    const instrumentPromises = pattern.patterns.map((p: any) => 
      p.instrument !== 'drums' ? engine.loadAdditionalInstrument(p.instrument) : null
    ).filter(Boolean);
    
    await Promise.all(instrumentPromises);
    
    const msPerBeat = (60 / pattern.bpm) * 1000;
    let currentBeat = 0;
    const totalBeats = duration[0] * (pattern.bpm / 60); // Convert seconds to beats
    
    setIsPlaying(true);
    
    // Play notes in real-time
    playbackIntervalRef.current = setInterval(() => {
      if (currentBeat >= totalBeats) {
        stopPlayback();
        return;
      }
      
      // Play notes from all instruments at this beat
      pattern.patterns.forEach((instrumentPattern: any) => {
        const notesToPlay = instrumentPattern.notes.filter((note: any) => 
          Math.abs(note.time - currentBeat) < 0.1
        );
        
        notesToPlay.forEach((note: any) => {
          if (instrumentPattern.instrument === 'drums') {
            // Play drum sounds
            engine.playDrumSound(note.pitch, note.velocity / 127);
          } else {
            // Parse pitch string (e.g., "C4" -> note: "C", octave: 4)
            const match = note.pitch.match(/([A-G]#?)(\d+)/);
            if (match) {
              const noteName = match[1];
              const octave = parseInt(match[2]);
              
              // Play instrument note
              engine.playNote(
                noteName,
                octave,
                note.duration * msPerBeat / 1000,
                instrumentPattern.instrument,
                note.velocity / 127
              );
            }
          }
        });
      });
      
      currentBeat += 0.25; // Move forward by 16th note
    }, msPerBeat / 4); // Run every 16th note
  };
  
  const stopPlayback = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    
    if (audioEngineRef.current) {
      audioEngineRef.current.stopAllSounds();
    }
  };

  const handleGenerate = async () => {
    if (!requirePro("ai", () => setShowUpgrade(true))) {
      return;
    }
    if (!prompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please describe the music you want to generate.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      if (useRealisticInstruments) {
        // Generate pattern for realistic instruments
        toast({
          title: 'Generating Music Pattern',
          description: 'Creating a beautiful composition with realistic instruments...',
        });
        
        const response = await apiRequest('POST', '/api/songs/generate-pattern', {
          prompt: `${genre} ${prompt}`,
          duration: duration[0],
          bpm: bpm[0],
        });
        
        const data = await response.json();
        
        if (data.success && data.pattern) {
          currentPatternRef.current = data.pattern;
          
          toast({
            title: 'Music Pattern Generated!',
            description: `Created ${data.pattern.patterns.length} instrument tracks. Press play to hear your music!`,
          });
          
          // Auto-play the pattern
          await playPattern(data.pattern);
        } else {
          throw new Error('Failed to generate pattern');
        }
      } else {
        // Original raw audio generation
        toast({
          title: `${providers[provider].name} Generation Started`,
          description: 'Your music is being generated. This may take a minute...',
        });

        const endpoint = provider === 'suno' 
          ? '/api/songs/generate-professional'
          : '/api/songs/generate-beat';

        const response = await apiRequest('POST', endpoint, {
          prompt: `${genre} ${prompt}`,
          duration: duration[0],
          bpm: bpm[0],
          genre,
        });

        const data = await response.json();

        if (data.audioUrl || data.audio_url || data.result?.audioUrl || data.result?.audio_url) {
          const audioUrl = data.audioUrl || data.audio_url || data.result?.audioUrl || data.result?.audio_url;
          
          // Store the audio URL for playback
          setGeneratedAudioUrl(audioUrl);
          
          toast({
            title: 'Music Generated!',
            description: `Your ${provider === 'suno' ? 'professional track' : 'beat'} is ready! Click play to listen.`,
          });

          if (onMusicGenerated) {
            onMusicGenerated(audioUrl, {
              provider,
              prompt,
              genre,
              duration: duration[0],
              bpm: bpm[0],
              generatedAt: new Date(),
            });
          }
        } else {
          throw new Error('No audio URL in response');
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate music. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentProvider = providers[provider];
  const ProviderIcon = currentProvider.icon;

  return (
    <>
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Wand2 className="w-5 h-5 mr-2 text-purple-400" />
            AI Music Generation
          </span>
          <div className="text-sm font-normal text-gray-400">
            Powered by {currentProvider.name}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Realistic Instruments Toggle */}
        <div className="flex items-center justify-between p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
          <div className="flex items-center space-x-2">
            <Piano className="w-5 h-5 text-purple-400" />
            <Label htmlFor="realistic-mode" className="text-white cursor-pointer">
              Use Realistic Instruments (High Quality Soundfonts)
            </Label>
          </div>
          <Switch
            id="realistic-mode"
            checked={useRealisticInstruments}
            onCheckedChange={setUseRealisticInstruments}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
        
        {/* Playback Controls (for realistic mode) */}
        {useRealisticInstruments && currentPatternRef.current && (
          <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg">
            {!isPlaying ? (
              <Button
                onClick={() => playPattern(currentPatternRef.current)}
                size="sm"
                className="bg-green-600 hover:bg-green-500"
              >
                <Play className="w-4 h-4 mr-1" />
                Play
              </Button>
            ) : (
              <Button
                onClick={stopPlayback}
                size="sm"
                className="bg-red-600 hover:bg-red-500"
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
            <span className="text-sm text-gray-400 ml-2">
              {currentPatternRef.current.patterns.length} instruments loaded
            </span>
          </div>
        )}
        
        {/* Provider Selection (only show for raw audio mode) */}
        {!useRealisticInstruments && (
        <div>
          <label className="text-sm text-gray-400 mb-2 block">AI Provider</label>
          <Select value={provider} onValueChange={(val: 'musicgen' | 'suno') => setProvider(val)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(providers) as Array<keyof typeof providers>).map((key) => {
                const p = providers[key];
                const Icon = p.icon;
                return (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center">
                        <Icon className="w-4 h-4 mr-2" />
                        <span>{p.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          p.cost === 'Low' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'
                        }`}>
                          {p.cost} Cost
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300">
                          {p.quality}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-700">
            <div className="flex items-start space-x-2">
              <ProviderIcon className={`w-5 h-5 mt-0.5 ${provider === 'suno' ? 'text-purple-400' : 'text-blue-400'}`} />
              <div className="flex-1">
                <p className="text-sm text-gray-300">{currentProvider.description}</p>
                <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
                  <span className="flex items-center">
                    <DollarSign className="w-3 h-3 mr-1" />
                    Cost: {currentProvider.cost}
                  </span>
                  <span>•</span>
                  <span>Max: {currentProvider.maxDuration}s</span>
                  <span>•</span>
                  <span>Quality: {currentProvider.quality}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Prompt */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Describe Your Music</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'upbeat melody with piano and strings, emotional and cinematic'"
            className="min-h-[100px] resize-none text-black dark:text-white"
            disabled={isGenerating}
          />
        </div>

        {/* Genre */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Genre</label>
          <Select value={genre} onValueChange={setGenre} disabled={isGenerating}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {genres.map((g) => (
                <SelectItem key={g} value={g}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Duration: {duration[0]}s (max: {currentProvider.maxDuration}s)
          </label>
          <Slider
            value={duration}
            onValueChange={setDuration}
            max={currentProvider.maxDuration}
            min={10}
            step={5}
            disabled={isGenerating}
          />
        </div>

        {/* BPM */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            BPM: {bpm[0]}
          </label>
          <Slider
            value={bpm}
            onValueChange={setBpm}
            max={180}
            min={60}
            step={5}
            disabled={isGenerating}
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className={`w-full ${currentProvider.color} hover:opacity-90 text-white font-bold py-6 text-lg`}
        >
          {isGenerating ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Generating with {currentProvider.name}...
            </>
          ) : (
            <>
              <ProviderIcon className="w-5 h-5 mr-2" />
              Generate Music ({currentProvider.cost} Cost)
            </>
          )}
        </Button>

        {/* Info */}
        <div className="text-xs text-gray-500 text-center">
          {provider === 'musicgen' && 'MusicGen: Fast generation, great for beats and instrumentals'}
          {provider === 'suno' && 'Suno AI: Premium quality, supports vocals and complex arrangements'}
        </div>
      </CardContent>
    </Card>
    <UpgradeModal
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      onUpgrade={startUpgrade}
    />
    </>
  );
}
