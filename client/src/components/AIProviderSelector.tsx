import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Brain, Sparkles } from "lucide-react";

interface AIProvider {
  id: string;
  name: string;
  description: string;
  features: string[];
  available: boolean;
  isDefault?: boolean;
}

export function AIProviderSelector() {
  const [selectedProvider, setSelectedProvider] = useState<string>("grok");

  const { data: providers, isLoading } = useQuery<AIProvider[]>({
    queryKey: ["/api/ai/providers"],
    queryFn: async () => {
      const response = await fetch("/api/ai/providers");
      if (!response.ok) {
        throw new Error("Failed to fetch AI providers");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (providers) {
      const defaultProvider = providers.find((p) => p.isDefault && p.available);
      if (defaultProvider) {
        setSelectedProvider(defaultProvider.id);
      } else {
        const firstAvailable = providers.find((p) => p.available);
        if (firstAvailable) {
          setSelectedProvider(firstAvailable.id);
        }
      }
    }
  }, [providers]);

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case "grok":
        return <Zap className="h-5 w-5" />;
      case "gemini":
        return <Sparkles className="h-5 w-5" />;
      case "openai":
        return <Brain className="h-5 w-5" />;
      default:
        return <Brain className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>Loading available providers...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const availableProviders = providers?.filter((p) => p.available) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getProviderIcon(selectedProvider)}
          AI Provider Selection
        </CardTitle>
        <CardDescription>
          Choose your preferred AI provider for enhanced features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableProviders.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No AI providers are currently configured. Please add API keys to
            enable AI features.
          </p>
        ) : (
          <div className="grid gap-3">
            {availableProviders.map((provider) => (
              <div
                key={provider.id}
                className={`relative p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                  selectedProvider === provider.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getProviderIcon(provider.id)}
                    <div>
                      <h4 className="font-medium">{provider.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {provider.description}
                      </p>
                    </div>
                  </div>
                  {selectedProvider === provider.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {provider.features.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {availableProviders.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Currently using:{" "}
              <span className="font-medium text-foreground">
                {
                  availableProviders.find((p) => p.id === selectedProvider)
                    ?.name
                }
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
