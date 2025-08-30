import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, Brain, Sparkles } from "lucide-react";

interface AIProvider {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  capabilities: string[];
  status: "available" | "premium" | "beta";
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI GPT",
    description: "Advanced language model for creative and technical tasks",
    icon: Bot,
    capabilities: ["Text Generation", "Code Analysis", "Creative Writing"],
    status: "available"
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Helpful, harmless, and honest AI assistant",
    icon: Brain,
    capabilities: ["Reasoning", "Analysis", "Code Review"],
    status: "available"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Multimodal AI with advanced reasoning capabilities",
    icon: Sparkles,
    capabilities: ["Multimodal", "Code Generation", "Analysis"],
    status: "beta"
  },
  {
    id: "custom",
    name: "Custom Model",
    description: "Use your own AI model endpoint",
    icon: Zap,
    capabilities: ["Custom", "Self-hosted"],
    status: "premium"
  }
];

interface AIProviderSelectorProps {
  selectedProvider?: string;
  onProviderChange?: (providerId: string) => void;
  className?: string;
}

export function AIProviderSelector({ 
  selectedProvider = "openai", 
  onProviderChange,
  className 
}: AIProviderSelectorProps) {
  const [selected, setSelected] = useState(selectedProvider);

  const handleProviderChange = (providerId: string) => {
    setSelected(providerId);
    onProviderChange?.(providerId);
  };

  const selectedProviderData = AI_PROVIDERS.find(p => p.id === selected);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Provider
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selected} onValueChange={handleProviderChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select AI provider" />
          </SelectTrigger>
          <SelectContent>
            {AI_PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              return (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{provider.name}</span>
                    <Badge 
                      variant={provider.status === "available" ? "default" : 
                               provider.status === "premium" ? "secondary" : "outline"}
                      className="ml-auto text-xs"
                    >
                      {provider.status}
                    </Badge>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {selectedProviderData && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <selectedProviderData.icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <h4 className="font-medium">{selectedProviderData.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedProviderData.description}
                </p>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-medium mb-2">Capabilities</h5>
              <div className="flex flex-wrap gap-1">
                {selectedProviderData.capabilities.map((capability) => (
                  <Badge key={capability} variant="outline" className="text-xs">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>

            {selectedProviderData.status === "premium" && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  This provider requires a premium subscription.
                </p>
                <Button size="sm" className="mt-2">
                  Upgrade to Premium
                </Button>
              </div>
            )}

            {selectedProviderData.status === "beta" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  This provider is in beta. Features may be limited.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
