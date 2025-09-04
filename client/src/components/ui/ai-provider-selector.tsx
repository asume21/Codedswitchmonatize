import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Bot, Sparkles, Zap, FileText, Music } from "lucide-react";

interface AIProvider {
  id: string;
  name: string;
  description: string;
  features: string[];
  available: boolean;
}

interface AIProviderSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function AIProviderSelector({ value, onValueChange, className }: AIProviderSelectorProps) {
  const { data: providers = [] } = useQuery<AIProvider[]>({
    queryKey: ["/api/ai/providers"],
  });

  const availableProviders = providers.filter(p => p.available);

  // Set default to first available provider if current value is not available
  useEffect(() => {
    if (availableProviders.length > 0 && !availableProviders.some(p => p.id === value)) {
      onValueChange(availableProviders[0].id);
    }
  }, [availableProviders, value, onValueChange]);

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
          {availableProviders.find(p => p.id === value) && (
            <div className="flex items-center space-x-2">
              <span className={getProviderColor(value)}>
                {getProviderIcon(value)}
              </span>
              <span>{availableProviders.find(p => p.id === value)?.name}</span>
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