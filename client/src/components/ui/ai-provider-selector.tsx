import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Zap, FileText, Music, Edit3, Volume2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type OutputType = 'midi' | 'audio' | 'text';

type AIProvider = {
  name: string;
  label: string;
  description: string;
  outputType: OutputType; // What kind of output this AI produces
  capabilities: {
    fullSongs: boolean;
    beats: boolean;
    instrumentals: boolean;
    lyrics: boolean;
    analysis: boolean;
  };
  requiresAuth: boolean;
};

interface AIProviderSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  feature?: string;
}

const FALLBACK_PROVIDERS: AIProvider[] = [
  {
    name: 'astutely',
    label: '✏️ Astutely (Editable)',
    description: 'AI generates note patterns you can edit in piano roll. Uses Phi3/Grok.',
    outputType: 'midi',
    capabilities: { fullSongs: false, beats: true, instrumentals: true, lyrics: false, analysis: false },
    requiresAuth: false,
  },
  {
    name: 'replicate-musicgen',
    label: '🔊 MusicGen (Audio)',
    description: 'Generates audio files directly. Professional quality but not editable.',
    outputType: 'audio',
    capabilities: { fullSongs: false, beats: true, instrumentals: true, lyrics: false, analysis: false },
    requiresAuth: true,
  },
  {
    name: 'suno',
    label: '🎤 Suno (Full Songs)',
    description: 'Complete songs with vocals. Audio output, not editable.',
    outputType: 'audio',
    capabilities: { fullSongs: true, beats: true, instrumentals: true, lyrics: true, analysis: false },
    requiresAuth: true,
  },
  {
    name: 'replicate-suno',
    label: '🎤 Suno via Replicate',
    description: 'Full-song generation with vocals through Replicate.',
    outputType: 'audio',
    capabilities: { fullSongs: true, beats: false, instrumentals: false, lyrics: false, analysis: false },
    requiresAuth: true,
  },
  {
    name: 'grok',
    label: '✍️ Grok (Lyrics)',
    description: 'Lyrics generation and analysis. Text output.',
    outputType: 'text',
    capabilities: { fullSongs: false, beats: false, instrumentals: false, lyrics: true, analysis: true },
    requiresAuth: true,
  },
  {
    name: 'openai',
    label: '🤖 OpenAI',
    description: 'Code translation and text analysis.',
    outputType: 'text',
    capabilities: { fullSongs: false, beats: false, instrumentals: false, lyrics: false, analysis: true },
    requiresAuth: true,
  },
  {
    name: 'local',
    label: '💻 Local (Free)',
    description: 'Basic analysis without external API. No cost.',
    outputType: 'text',
    capabilities: { fullSongs: false, beats: false, instrumentals: false, lyrics: false, analysis: true },
    requiresAuth: false,
  },
];

export function AIProviderSelector({ value, onValueChange, className, feature }: AIProviderSelectorProps) {
  const [providers, setProviders] = useState<AIProvider[]>(FALLBACK_PROVIDERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await apiRequest('GET', '/api/ai-providers');
        if (response.ok) {
          const data = await response.json();
          // Server returns { status, providers, authenticated }
          if (Array.isArray(data.providers)) {
            setProviders(data.providers as AIProvider[]);
          } else {
            setProviders(FALLBACK_PROVIDERS);
          }
        }
      } catch (error) {
        console.error('Failed to fetch AI providers:', error);
        setProviders(FALLBACK_PROVIDERS);
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, []);

  const availableProviders = providers;

  const selectedProvider = availableProviders.find((provider) => provider.name === value);

  const getProviderIcon = (name: string) => {
    switch (name) {
      case "openai":
        return <Bot className="h-4 w-4" />;
      case "grok":
        return <Zap className="h-4 w-4" />;
      case "suno":
        return <Sparkles className="h-4 w-4" />;
      case "replicate-suno":
        return <Music className="h-4 w-4" />;
      case "replicate-musicgen":
        return <Music className="h-4 w-4" />;
      case "local":
        return <FileText className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getProviderColor = (name: string) => {
    switch (name) {
      case "openai":
        return "text-emerald-400";
      case "grok":
        return "text-purple-400";
      case "suno":
        return "text-yellow-400";
      case "replicate-suno":
        return "text-blue-400";
      case "replicate-musicgen":
        return "text-pink-400";
      case "local":
        return "text-orange-400";
      default:
        return "text-purple-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Bot className="h-4 w-4 animate-spin" />
        <span>Loading AI providers...</span>
      </div>
    );
  }

  if (availableProviders.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Bot className="h-4 w-4" />
        <span>No AI providers available</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`w-full ${className}`}>
        <SelectValue>
          {selectedProvider && (
            <div className="flex items-center space-x-2">
              <span className={getProviderColor(selectedProvider.name)}>
                {getProviderIcon(selectedProvider.name)}
              </span>
              <span>{selectedProvider.label}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableProviders.map((provider) => (
          <SelectItem key={provider.name} value={provider.name}>
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <span className={getProviderColor(provider.name)}>
                  {getProviderIcon(provider.name)}
                </span>
                <span className="font-medium">{provider.label}</span>
                {provider.requiresAuth && (
                  <Badge variant="outline" className="text-xs">
                    Auth Required
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-64">
                {provider.description}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {provider.outputType === 'midi' && (
                  <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                    <Edit3 className="w-3 h-3 mr-1" />Editable Notes
                  </Badge>
                )}
                {provider.outputType === 'audio' && (
                  <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                    <Volume2 className="w-3 h-3 mr-1" />Audio File
                  </Badge>
                )}
                {provider.outputType === 'text' && (
                  <Badge className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <FileText className="w-3 h-3 mr-1" />Text
                  </Badge>
                )}
                {provider.capabilities.fullSongs && <Badge variant="secondary" className="text-xs">Full Songs</Badge>}
                {provider.capabilities.beats && <Badge variant="secondary" className="text-xs">Beats</Badge>}
                {provider.capabilities.instrumentals && <Badge variant="secondary" className="text-xs">Instrumentals</Badge>}
                {provider.capabilities.lyrics && <Badge variant="secondary" className="text-xs">Lyrics</Badge>}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
