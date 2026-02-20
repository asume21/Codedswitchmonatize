import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Mic2,
  Upload,
  Zap,
  Key,
  Cloud,
  Music,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  AlertTriangle,
  Coins,
  RefreshCw,
  Wifi,
  WifiOff,
  Server,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import {
  useSubmitJob,
  useCostCheck,
  useJobList,
  useJobDetail,
  useJobSSE,
  useApiKeys,
  useStoreApiKey,
  useDeleteApiKey,
  useServicesHealth,
  type VoiceConvertJobSummary,
  type ServiceStatus,
} from "@/hooks/use-voice-convert";

const STAGE_ORDER = ["queued", "separating", "converting", "correcting", "remixing", "done"];
const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  separating: "Separating Stems",
  converting: "Converting Voice",
  correcting: "Pitch Correction",
  remixing: "Remixing",
  done: "Complete",
  failed: "Failed",
};

function stageProgress(status: string): number {
  const idx = STAGE_ORDER.indexOf(status);
  if (status === "failed") return 0;
  if (idx < 0) return 0;
  return Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "done"
      ? "default"
      : status === "failed"
        ? "destructive"
        : "secondary";
  const icon =
    status === "done" ? (
      <CheckCircle className="w-3 h-3 mr-1" />
    ) : status === "failed" ? (
      <XCircle className="w-3 h-3 mr-1" />
    ) : (
      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
    );
  return (
    <Badge variant={variant} className="text-xs">
      {icon}
      {STAGE_LABELS[status] || status}
    </Badge>
  );
}

function JobCard({
  job,
  onSelect,
  isSelected,
}: {
  job: VoiceConvertJobSummary;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:border-cyan-500/50 ${isSelected ? "border-cyan-400 bg-cyan-950/20" : "border-white/10"}`}
      onClick={() => onSelect(job.id)}
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={job.status} />
            <Badge variant="outline" className="text-xs">
              {job.stemMode}-stem
            </Badge>
            <Badge variant="outline" className="text-xs">
              {job.executionMode === "byo_keys" ? "BYO" : "Cloud"}
            </Badge>
          </div>
          <p className="text-xs text-white/50 truncate">
            {job.createdAt ? new Date(job.createdAt).toLocaleString() : ""}
          </p>
        </div>
        {job.remixUrl && job.status === "done" && (
          <Button size="sm" variant="ghost" className="shrink-0" asChild>
            <a href={job.remixUrl} target="_blank" rel="noopener noreferrer">
              <Play className="w-4 h-4" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function JobDetailPanel({ jobId }: { jobId: string }) {
  const { data } = useJobDetail(jobId);
  const sse = useJobSSE(jobId);
  const job = data?.job;
  const liveStatus = sse.status || job?.status || "queued";
  const liveRemixUrl = sse.remixUrl || job?.remixUrl;
  const liveError = sse.error || job?.error;

  if (!job) {
    return (
      <div className="flex items-center justify-center h-40 text-white/40">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  return (
    <Card className="border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Job Details</CardTitle>
          <StatusBadge status={liveStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-white/50 mb-1">Progress</p>
          <Progress value={stageProgress(liveStatus)} className="h-2" />
          <p className="text-xs text-white/50 mt-1">{STAGE_LABELS[liveStatus] || liveStatus}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-white/50 text-xs">Stem Mode</p>
            <p>{job.stemMode}-stem</p>
          </div>
          <div>
            <p className="text-white/50 text-xs">Provider</p>
            <p className="capitalize">{job.provider}</p>
          </div>
          <div>
            <p className="text-white/50 text-xs">Execution</p>
            <p>{job.executionMode === "byo_keys" ? "BYO Keys" : "Cloud"}</p>
          </div>
          <div>
            <p className="text-white/50 text-xs">Pitch Correct</p>
            <p>{job.pitchCorrect ? "Yes" : "No"}</p>
          </div>
        </div>

        {liveError && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">{liveError}</AlertDescription>
          </Alert>
        )}

        {liveRemixUrl && liveStatus === "done" && (
          <div className="space-y-2">
            <Separator />
            <p className="text-sm font-medium">Final Remix</p>
            <audio controls className="w-full" src={liveRemixUrl} />
          </div>
        )}

        {job.vocalStemUrl && (
          <div className="space-y-2">
            <Separator />
            <p className="text-sm font-medium text-white/70">Intermediate Outputs</p>
            <div className="grid gap-2 text-xs">
              {job.vocalStemUrl && (
                <div className="flex items-center gap-2">
                  <Music className="w-3 h-3 text-cyan-400" />
                  <span className="text-white/50">Vocal Stem</span>
                </div>
              )}
              {job.instrumentalStemUrl && (
                <div className="flex items-center gap-2">
                  <Music className="w-3 h-3 text-purple-400" />
                  <span className="text-white/50">Instrumental</span>
                </div>
              )}
              {job.convertedVocalUrl && (
                <div className="flex items-center gap-2">
                  <Mic2 className="w-3 h-3 text-green-400" />
                  <span className="text-white/50">Converted Vocal</span>
                </div>
              )}
              {job.correctedVocalUrl && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-yellow-400" />
                  <span className="text-white/50">Pitch Corrected</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApiKeyVault() {
  const { data: keysData, isLoading } = useApiKeys();
  const storeKey = useStoreApiKey();
  const deleteKey = useDeleteApiKey();
  const { toast } = useToast();
  const [service, setService] = useState<string>("elevenlabs");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const keys = keysData?.keys || [];

  const handleStore = async () => {
    if (!apiKey.trim()) {
      toast({ title: "Error", description: "API key cannot be empty", variant: "destructive" });
      return;
    }
    try {
      const result = await storeKey.mutateAsync({ service, apiKey: apiKey.trim() });
      toast({ title: "Saved", description: result.message });
      setApiKey("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save key",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (svc: string) => {
    try {
      const result = await deleteKey.mutateAsync(svc);
      toast({ title: "Deleted", description: result.message });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete key",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Key className="w-5 h-5 text-cyan-400" />
          API Key Vault
        </CardTitle>
        <CardDescription>
          Store your own API keys to use voice conversion at zero credit cost.
          Keys are encrypted at rest with AES-256-GCM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading keys...
          </div>
        ) : keys.length > 0 ? (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.service}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <div>
                  <p className="text-sm font-medium capitalize">{k.service}</p>
                  <p className="text-xs text-white/50">
                    {k.keyHint || "****"} &middot;{" "}
                    {k.isValid ? (
                      <span className="text-green-400">Valid</span>
                    ) : (
                      <span className="text-red-400">Invalid</span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleDelete(k.service)}
                  disabled={deleteKey.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/40">No API keys stored yet.</p>
        )}

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium">Add a Key</p>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <Select value={service} onValueChange={setService}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="replicate">Replicate</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Paste your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            onClick={handleStore}
            disabled={storeKey.isPending || !apiKey.trim()}
            className="w-full"
          >
            {storeKey.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Save Key
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceHealthPanel() {
  const { data, isLoading } = useServicesHealth();

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/40 p-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking services...
      </div>
    );
  }

  const entries = Object.entries(data.services) as [string, ServiceStatus][];

  return (
    <Card className="border-white/10">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Service Status
          </CardTitle>
          <div className="flex gap-1">
            {data.capabilities.cloudPipeline && (
              <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">Cloud Ready</Badge>
            )}
            {data.capabilities.localRvcPipeline && (
              <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">RVC Ready</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="grid grid-cols-2 gap-2">
          {entries.map(([key, svc]) => (
            <div
              key={key}
              className={`flex items-center gap-2 p-2 rounded text-xs ${
                svc.available
                  ? "bg-green-950/20 border border-green-500/20"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              {svc.available ? (
                <Wifi className="w-3 h-3 text-green-400 shrink-0" />
              ) : (
                <WifiOff className="w-3 h-3 text-white/30 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`truncate ${svc.available ? "text-green-300" : "text-white/40"}`}>
                  {svc.label}
                </p>
                <p className="text-white/30">
                  {svc.type === "cloud" ? "Cloud" : "Local"}{" "}
                  {svc.available ? "" : "- Offline"}
                  {svc.gpu ? " (GPU)" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VoiceConvertPage() {
  const { toast } = useToast();
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const isAuthenticated = auth?.isAuthenticated || false;

  // Form state
  const [voiceId, setVoiceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [stemMode, setStemMode] = useState<2 | 4>(2);
  const [provider, setProvider] = useState<"elevenlabs" | "rvc">("elevenlabs");
  const [pitchCorrect, setPitchCorrect] = useState(false);
  const [executionMode, setExecutionMode] = useState<"cloud" | "byo_keys">("cloud");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("convert");

  // Hooks
  const submitJob = useSubmitJob();
  const costCheck = useCostCheck();
  const { data: jobListData, isLoading: jobsLoading } = useJobList();
  const { data: healthData } = useServicesHealth();

  const rvcAvailable = healthData?.services?.rvc?.available ?? false;
  const pitchCorrectionAvailable = healthData?.services?.audioAnalysis?.available ?? false;

  // Auto cost-check when params change
  useEffect(() => {
    if (isAuthenticated) {
      costCheck.mutate({ stemMode, executionMode });
    }
  }, [stemMode, executionMode, isAuthenticated]);

  const costData = costCheck.data;
  const jobs = jobListData?.jobs || [];

  const handleSubmit = async () => {
    if (!voiceId.trim()) {
      toast({ title: "Error", description: "Voice ID is required", variant: "destructive" });
      return;
    }
    if (!sourceUrl.trim()) {
      toast({ title: "Error", description: "Source audio URL is required", variant: "destructive" });
      return;
    }

    try {
      const result = await submitJob.mutateAsync({
        voiceId: voiceId.trim(),
        sourceUrl: sourceUrl.trim(),
        stemMode,
        provider,
        pitchCorrect,
        executionMode,
      });

      if (result.success) {
        toast({ title: "Job Submitted", description: `Job ${result.jobId} is now processing.` });
        setSelectedJobId(result.jobId);
        setActiveTab("jobs");
      }
    } catch (err) {
      toast({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Mic2 className="w-16 h-16 text-cyan-400 opacity-50" />
        <h2 className="text-xl font-semibold">Voice Conversion</h2>
        <p className="text-white/50 text-center max-w-md">
          Sign in to convert any song with your custom voice using AI-powered stem separation and voice conversion.
        </p>
        <Button onClick={() => setLocation("/login")}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Mic2 className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Voice Conversion</h1>
          <p className="text-sm text-white/50">
            Convert any song with your custom AI voice
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="convert">
            <Mic2 className="w-4 h-4 mr-2" />
            Convert
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <Clock className="w-4 h-4 mr-2" />
            Jobs
            {jobs.filter((j) => j.status !== "done" && j.status !== "failed").length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {jobs.filter((j) => j.status !== "done" && j.status !== "failed").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="keys">
            <Key className="w-4 h-4 mr-2" />
            API Keys
          </TabsTrigger>
        </TabsList>

        {/* ── Convert Tab ──────────────────────────────── */}
        <TabsContent value="convert" className="space-y-4 mt-4">
          <ServiceHealthPanel />
          <div className="grid md:grid-cols-2 gap-4">
            {/* Left: Form */}
            <Card className="border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">New Conversion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Voice ID</Label>
                  <Input
                    placeholder="ElevenLabs or RVC voice ID"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Source Audio URL</Label>
                  <Input
                    placeholder="/api/internal/uploads/songs/... or absolute path"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                  <p className="text-xs text-white/40">
                    Upload a song first, then paste its URL here.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Stem Mode</Label>
                    <Select
                      value={String(stemMode)}
                      onValueChange={(v) => setStemMode(v === "4" ? 4 : 2)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2-Stem (Standard)</SelectItem>
                        <SelectItem value="4">4-Stem (Pro)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={provider}
                      onValueChange={(v) => setProvider(v as "elevenlabs" | "rvc")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                        <SelectItem value="rvc" disabled={!rvcAvailable}>
                          RVC (Local){!rvcAvailable ? " - Offline" : ""}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className={pitchCorrectionAvailable ? "cursor-pointer" : "cursor-not-allowed text-white/40"}>Pitch Correction</Label>
                    {!pitchCorrectionAvailable && (
                      <p className="text-xs text-white/30">Audio Analysis server offline</p>
                    )}
                  </div>
                  <Switch
                    checked={pitchCorrect}
                    onCheckedChange={setPitchCorrect}
                    disabled={!pitchCorrectionAvailable}
                  />
                </div>

                <Separator />

                {/* Execution Mode */}
                <div className="space-y-3">
                  <Label>Execution Mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`p-3 rounded-lg border text-left transition-all ${
                        executionMode === "byo_keys"
                          ? "border-cyan-400 bg-cyan-950/30"
                          : "border-white/10 hover:border-white/20"
                      }`}
                      onClick={() => setExecutionMode("byo_keys")}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Key className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium">BYO Keys</span>
                      </div>
                      <p className="text-xs text-white/50">Free &middot; Uses your API keys</p>
                    </button>
                    <button
                      type="button"
                      className={`p-3 rounded-lg border text-left transition-all ${
                        executionMode === "cloud"
                          ? "border-purple-400 bg-purple-950/30"
                          : "border-white/10 hover:border-white/20"
                      }`}
                      onClick={() => setExecutionMode("cloud")}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Cloud className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium">Cloud</span>
                      </div>
                      <p className="text-xs text-white/50">
                        {costData?.creditsCost || "..."} credits &middot; We handle everything
                      </p>
                    </button>
                  </div>
                </div>

                {/* Cost info */}
                {executionMode === "cloud" && costData && (
                  <Alert className={costData.canProceed ? "border-green-500/30" : "border-yellow-500/30"}>
                    <Coins className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                      {costData.canProceed ? (
                        <>
                          Cost: <strong>{costData.creditsCost} credits</strong> &middot; Balance:{" "}
                          {costData.currentBalance} credits
                        </>
                      ) : (
                        <>
                          Need <strong>{costData.creditsCost} credits</strong>, you have{" "}
                          {costData.currentBalance}. <strong>{costData.deficit}</strong> more needed.{" "}
                          <button
                            className="underline text-cyan-400"
                            onClick={() => setLocation("/buy-credits")}
                          >
                            Buy Credits
                          </button>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {executionMode === "byo_keys" && (
                  <Alert className="border-cyan-500/30">
                    <Key className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                      No credits required. Make sure your API keys are saved in the{" "}
                      <button
                        className="underline text-cyan-400"
                        onClick={() => setActiveTab("keys")}
                      >
                        API Keys
                      </button>{" "}
                      tab.
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={
                    submitJob.isPending ||
                    !voiceId.trim() ||
                    !sourceUrl.trim() ||
                    (executionMode === "cloud" && costData && !costData.canProceed)
                  }
                >
                  {submitJob.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Start Conversion
                </Button>
              </CardContent>
            </Card>

            {/* Right: Selected job detail or placeholder */}
            <div>
              {selectedJobId ? (
                <JobDetailPanel jobId={selectedJobId} />
              ) : (
                <Card className="border-white/10 h-full flex items-center justify-center">
                  <CardContent className="text-center text-white/30 py-16">
                    <Music className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Submit a job or select one from the Jobs tab</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Jobs Tab ─────────────────────────────────── */}
        <TabsContent value="jobs" className="mt-4">
          <div className="grid md:grid-cols-[320px_1fr] gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white/70">Recent Jobs</p>
                <Badge variant="outline" className="text-xs">
                  {jobs.length}
                </Badge>
              </div>
              {jobsLoading ? (
                <div className="flex items-center gap-2 text-white/40 p-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : jobs.length === 0 ? (
                <p className="text-sm text-white/40 p-4">No jobs yet. Start a conversion above.</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onSelect={setSelectedJobId}
                      isSelected={selectedJobId === job.id}
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              {selectedJobId ? (
                <JobDetailPanel jobId={selectedJobId} />
              ) : (
                <Card className="border-white/10 flex items-center justify-center min-h-[300px]">
                  <CardContent className="text-center text-white/30 py-16">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Select a job to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── API Keys Tab ─────────────────────────────── */}
        <TabsContent value="keys" className="mt-4">
          <div className="max-w-lg mx-auto">
            <ApiKeyVault />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
