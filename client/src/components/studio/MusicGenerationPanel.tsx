import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Wand2, Music, DollarSign } from 'lucide-react';

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
  const { toast } = useToast();

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

  const handleGenerate = async () => {
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

      if (data.audioUrl || data.audio_url) {
        const audioUrl = data.audioUrl || data.audio_url;
        
        toast({
          title: 'Music Generated!',
          description: `Your ${provider === 'suno' ? 'professional track' : 'beat'} is ready!`,
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
        {/* Provider Selection */}
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
  );
}
