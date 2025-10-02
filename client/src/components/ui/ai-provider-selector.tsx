import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Zap, FileText, Music } from "lucide-react";

interface AIProvider {
  id: string;
  name: string;
  description: string;
  features: string[];
  available: boolean;
  isDefault?: boolean;
}

interface AIProviderSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

const STATIC_PROVIDERS: AIProvider[] = [
  {
    id: "grok",
    name: "Grok",
    description: "Edgy rhythmic ideas with quick turnaround.",
    features: ["Beat ideation", "High-energy patterns", "Percussive fills"],
    available: true,
    isDefault: true,
  },
  {
    id: "openai",
    name: "OpenAI Sound Studio",
    description: "Balanced grooves and adaptive arrangements.",
    features: ["Adaptive grooves", "Humanized velocity", "Arrangement suggestions"],
    available: true,
  },
  {
    id: "gemini",
    name: "Gemini Audio",
    description: "Melodic-forward beats with lush textures.",
    features: ["Melodic layers", "Texture pads", "Atmospheric FX"],
    available: true,
  },
  {
    id: "musicgen",
    name: "MusicGen Beta",
    description: "Experimental generator for genre-bending ideas.",
    features: ["Genre blending", "AI stems", "Sketch exports"],
    available: false,
  },
];

export function AIProviderSelector({ value, onValueChange, className }: AIProviderSelectorProps) {
  const availableProviders = STATIC_PROVIDERS.filter((provider) => provider.available);

  // Set default to first available provider if current value is not available
  useEffect(() => {
    if (availableProviders.length === 0) {
      return;
    }

    const isCurrentAvailable = availableProviders.some((provider) => provider.id === value);
    if (!isCurrentAvailable) {
      const fallback =
        availableProviders.find((provider) => provider.isDefault) ?? availableProviders[0];
      onValueChange(fallback.id);
    }
  }, [availableProviders, value, onValueChange]);

  const selectedProvider = availableProviders.find((provider) => provider.id === value);

  const getProviderIcon = (id: string) => {
    switch (id) {
      case "openai":
        return <Bot className="h-4 w-4" />;
      case "gemini":
        return <Sparkles className="h-4 w-4" />;
      case "grok":
        return <Zap className="h-4 w-4" />;
      case "structure":
        return <FileText className="h-4 w-4" />;
      case "musicgen":
        return <Music className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getProviderColor = (id: string) => {
    switch (id) {
      case "openai":
        return "text-emerald-400";
      case "gemini":
        return "text-blue-400";
      case "grok":
        return "text-purple-400";
      case "structure":
        return "text-orange-400";
      case "musicgen":
        return "text-pink-400";
      default:
        return "text-purple-400";
    }
  };

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
      <SelectTrigger className={`w-48 ${className}`}>
        <SelectValue>
          {selectedProvider && (
            <div className="flex items-center space-x-2">
              <span className={getProviderColor(selectedProvider.id)}>
                {getProviderIcon(selectedProvider.id)}
              </span>
              <span>{selectedProvider.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableProviders.map((provider) => (
          <SelectItem key={provider.id} value={provider.id}>
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <span className={getProviderColor(provider.id)}>
                  {getProviderIcon(provider.id)}
                </span>
                <span className="font-medium">{provider.name}</span>
                <Badge variant="outline" className="text-xs">
                  Available
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground max-w-64">
                {provider.description}
              </p>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}