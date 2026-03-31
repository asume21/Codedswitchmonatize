import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import {
  Key,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  BarChart3,
  Terminal,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

export default function DeveloperPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [fullKey, setFullKey] = useState<string | null>(null);

  // Redirect if not logged in
  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const { data: keyData, isLoading } = useQuery({
    queryKey: ["/api/webear-keys"],
    queryFn: () => apiRequest("GET", "/api/webear-keys").then(r => r.json()),
  });

  const { data: creditsData } = useQuery({
    queryKey: ["/api/credits/balance"],
    queryFn: () => apiRequest("GET", "/api/credits/balance").then(r => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/webear-keys/generate").then(r => r.json()),
    onSuccess: (data) => {
      setFullKey(data.key);
      setRevealed(true);
      queryClient.invalidateQueries({ queryKey: ["/api/webear-keys"] });
      toast({ title: "New API key generated", description: "Copy it now — you won't see it again." });
    },
    onError: () => toast({ title: "Failed to generate key", variant: "destructive" }),
  });

  const revealMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/webear-keys/reveal").then(r => r.json()),
    onSuccess: (data) => {
      setFullKey(data.key);
      setRevealed(true);
    },
    onError: () => toast({ title: "Failed to reveal key", variant: "destructive" }),
  });

  const copyKey = () => {
    const keyToCopy = fullKey || keyData?.maskedKey;
    if (!keyToCopy) return;
    navigator.clipboard.writeText(keyToCopy);
    toast({ title: "Copied to clipboard" });
  };

  const displayKey = revealed && fullKey ? fullKey : (keyData?.maskedKey || "No key generated yet");
  const hasKey = !!keyData?.id;

  const apiKey = fullKey || 'YOUR_API_KEY';
  const claudeCodeConfig = `{
  "mcpServers": {
    "webear": {
      "type": "sse",
      "url": "https://www.codedswitch.com/api/webear/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}`;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WebEar API</h1>
            <p className="text-muted-foreground text-sm">
              Give your AI coding assistant ears — capture live audio from any web app.
            </p>
          </div>
          <div className="ml-auto">
            <a
              href="https://www.npmjs.com/package/webear"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              npm docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Credits + Usage */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Credit Balance</CardDescription>
              <CardTitle className="text-3xl">
                {creditsData?.balance ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => navigate("/buy-credits")}>
                Buy more
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total API Calls</CardDescription>
              <CardTitle className="text-3xl">{keyData?.usageCount ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Last used: {keyData?.lastUsedAt ? new Date(keyData.lastUsedAt).toLocaleDateString() : "Never"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Cost Per Call</CardDescription>
              <CardTitle className="text-sm pt-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-normal text-muted-foreground">analyze_audio</span>
                  <Badge variant="secondary">1 credit</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-normal text-muted-foreground">describe_audio</span>
                  <Badge variant="secondary">2 credits</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">capture_audio and diff_audio are free</p>
            </CardContent>
          </Card>
        </div>

        {/* API Key Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" /> Your API Key
            </CardTitle>
            <CardDescription>
              Use this as <code className="bg-muted px-1 rounded">CODEDSWITCH_API_KEY</code> in your webear MCP config.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono truncate">
                  {displayKey}
                </code>
                {hasKey && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (revealed) {
                        setRevealed(false);
                        setFullKey(null);
                      } else {
                        revealMutation.mutate();
                      }
                    }}
                  >
                    {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
                {hasKey && (
                  <Button variant="ghost" size="icon" onClick={copyKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {!hasKey ? (
                <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                  <Key className="h-4 w-4 mr-2" />
                  Generate API Key
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm("This will revoke your current key. All existing MCP configs will stop working. Continue?")) {
                      generateMutation.mutate();
                    }
                  }}
                  disabled={generateMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Key
                </Button>
              )}
            </div>

            {revealed && fullKey && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                Copy your key now. It won't be shown in full again after you leave this page.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4" /> Quick Setup
            </CardTitle>
            <CardDescription>Add webear to Claude Code in 2 steps — no local server needed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">

            <div className="space-y-1">
              <p className="font-medium">1. Add the browser snippet to your app</p>
              <code className="block bg-muted px-3 py-2 rounded font-mono text-xs whitespace-pre">{`npm install webear\n\nimport { WebEar } from 'webear/browser'\nWebEar.init({ apiKey: '${apiKey}' })`}</code>
              <p className="text-muted-foreground text-xs">Paste this once — auto-detects Tone.js, Howler.js, or raw Web Audio API.</p>
            </div>

            <div className="space-y-1">
              <p className="font-medium">2. Add to your Claude Code MCP config</p>
              <p className="text-muted-foreground text-xs mb-1">
                File: <code className="bg-muted px-1 rounded">~/.claude/claude.json</code> or project <code className="bg-muted px-1 rounded">.claude/settings.json</code>
              </p>
              <div className="relative">
                <pre className="bg-muted px-3 py-2 rounded font-mono text-xs overflow-x-auto">
                  {claudeCodeConfig}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(claudeCodeConfig);
                    toast({ title: "Config copied" });
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">No local server required — everything runs on the cloud. Reveal your key first so copied snippets include your real token.</p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Now ask Claude Code: <em>"capture 3 seconds of audio and analyze it"</em></span>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

