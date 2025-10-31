import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Zap, FileText, Music } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AIProvider {
  name: string;
  label: string;
  description: string;
  capabilities: {
    fullSongs: boolean;
    beats: boolean;
    instrumentals: boolean;
    lyrics: boolean;
    analysis: boolean;
  };
  requiresAuth: boolean;
}

interface AIProviderSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  feature?: string;
}

const PROVIDERS: Record<string, AIProvider> = {
  'replicate-suno': {
    name: 'replicate-suno',
    label: 'Suno (via Replicate)',
    description: 'Professional full-song generation with vocals',
    capabilities: {
      fullSongs: true,
      beats: false,
      instrumentals: false,
      lyrics: false,
      analysis: false
    },
    requiresAuth: true
  },
  'replicate-musicgen': {
    name: 'replicate-musicgen',
    label: 'MusicGen (via Replicate)',
    description: 'Beats, melodies, and instrumental generation',
    capabilities: {
      fullSongs: false,
      beats: true,
      instrumentals: true,
      lyrics: false,
      analysis: false
    },
    requiresAuth: true
  },
  'grok': {
    name: 'grok',
    label: 'Grok (XAI)',
    description: 'Lyrics generation and analysis',
    capabilities: {
      fullSongs: false,
      beats: false,
      instrumentals: false,
      lyrics: true,
      analysis: true
    },
    requiresAuth: true
  },
  'openai': {
    name: 'openai',
    label: 'OpenAI',
    description: 'Code translation and text analysis',
    capabilities: {
      fullSongs: false,
      beats: false,
      instrumentals: false,
      lyrics: false,
      analysis: true
    },
    requiresAuth: true
  },
  'local': {
    name: 'local',
    label: 'Local Processing',
    description: 'Basic analysis without external API',
    capabilities: {
      fullSongs: false,
      beats: false,
      instrumentals: false,
      lyrics: false,
      analysis: true
    },
    requiresAuth: false
  }
};

export function AIProviderSelector({ value, onValueChange, className, feature }: AIProviderSelectorProps) {
  const [providers, setProviders] = useState<AIProvider[]>(Object.values(PROVIDERS));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await apiRequest('GET', '/api/ai-providers');
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers || Object.values(PROVIDERS));
        }
      } catch (error) {
        console.error('Failed to fetch AI providers:', error);
        setProviders(Object.values(PROVIDERS));
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
                {provider.capabilities.fullSongs && <Badge variant="secondary" className="text-xs">Full Songs</Badge>}
                {provider.capabilities.beats && <Badge variant="secondary" className="text-xs">Beats</Badge>}
                {provider.capabilities.instrumentals && <Badge variant="secondary" className="text-xs">Instrumentals</Badge>}
                {provider.capabilities.lyrics && <Badge variant="secondary" className="text-xs">Lyrics</Badge>}
                {provider.capabilities.analysis && <Badge variant="secondary" className="text-xs">Analysis</Badge>}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}