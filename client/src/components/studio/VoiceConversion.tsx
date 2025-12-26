import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mic,
  Upload,
  Play,
  Pause,
  Trash2,
  Download,
  RefreshCw,
  Volume2,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

interface VoiceRecord {
  voiceId: string;
  name: string;
  userId: string;
  sourceFileName: string;
  localPath: string;
  duration: number;
  createdAt: string;
  sampleUrl?: string;
}

interface ConvertSettings {
  pitch: number;
  indexRate: number;
  filterRadius: number;
  rmsMixRate: number;
  protect: number;
}

const DEFAULT_SETTINGS: ConvertSettings = {
  pitch: 0,
  indexRate: 0.75,
  filterRadius: 3,
  rmsMixRate: 0.25,
  protect: 0.33,
};

export default function VoiceConversion() {
  const { toast } = useToast();

  // State
  const [voices, setVoices] = useState<VoiceRecord[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceRecord | null>(null);
  const [rvcAvailable, setRvcAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState({
    voices: false,
    create: false,
    convert: false,
    delete: false,
  });

  // Create voice state
  const [newVoiceName, setNewVoiceName] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(null);

  // Convert state
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceObjectKey, setSourceObjectKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<ConvertSettings>(DEFAULT_SETTINGS);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);

  // Audio playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check RVC health on mount
  useEffect(() => {
    checkHealth();
    loadVoices();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch("/api/voices/health");
      const data = await res.json();
      setRvcAvailable(data.available ?? false);
    } catch {
      setRvcAvailable(false);
    }
  };

  const loadVoices = async () => {
    setLoading((p) => ({ ...p, voices: true }));
    try {
      const res = await apiRequest("GET", "/api/voices");
      const data = await res.json();
      if (data.success && Array.isArray(data.voices)) {
        setVoices(data.voices);
      }
    } catch (error) {
      console.error("Failed to load voices:", error);
    } finally {
      setLoading((p) => ({ ...p, voices: false }));
    }
  };

  const handleFileUpload = async (file: File, purpose: "voice" | "source") => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/internal/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.objectKey) {
        if (purpose === "voice") {
          setUploadedFile(file);
          setUploadedObjectKey(data.objectKey);
        } else {
          setSourceFile(file);
          setSourceObjectKey(data.objectKey);
        }
        return data.objectKey;
      }
      throw new Error(data.message || "Upload failed");
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Could not upload file",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleCreateVoice = async () => {
    if (!uploadedObjectKey) {
      toast({ title: "No file", description: "Upload an audio sample first", variant: "destructive" });
      return;
    }

    setLoading((p) => ({ ...p, create: true }));
    try {
      const res = await apiRequest("POST", "/api/voices", {
        objectKey: uploadedObjectKey,
        name: newVoiceName || "My Voice",
        duration: 0,
      });
      const data = await res.json();
      if (data.success && data.voice) {
        setVoices((prev) => [data.voice, ...prev]);
        setSelectedVoice(data.voice);
        setNewVoiceName("");
        setUploadedFile(null);
        setUploadedObjectKey(null);
        toast({ title: "Voice Created", description: `"${data.voice.name}" added to your library` });
      } else {
        throw new Error(data.message || "Failed to create voice");
      }
    } catch (error) {
      toast({
        title: "Create Failed",
        description: error instanceof Error ? error.message : "Could not create voice",
        variant: "destructive",
      });
    } finally {
      setLoading((p) => ({ ...p, create: false }));
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    setLoading((p) => ({ ...p, delete: true }));
    try {
      const res = await apiRequest("DELETE", `/api/voices/${voiceId}`);
      const data = await res.json();
      if (data.success) {
        setVoices((prev) => prev.filter((v) => v.voiceId !== voiceId));
        if (selectedVoice?.voiceId === voiceId) {
          setSelectedVoice(null);
        }
        toast({ title: "Voice Deleted" });
      } else {
        throw new Error(data.message || "Failed to delete");
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Could not delete voice",
        variant: "destructive",
      });
    } finally {
      setLoading((p) => ({ ...p, delete: false }));
    }
  };

  const handleConvert = async () => {
    if (!selectedVoice) {
      toast({ title: "Select a voice", description: "Choose a voice from your library", variant: "destructive" });
      return;
    }
    if (!sourceObjectKey) {
      toast({ title: "No source audio", description: "Upload audio to convert", variant: "destructive" });
      return;
    }

    setLoading((p) => ({ ...p, convert: true }));
    setConvertedUrl(null);

    try {
      const res = await apiRequest("POST", `/api/voices/${selectedVoice.voiceId}/convert`, {
        objectKey: sourceObjectKey,
        ...settings,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setConvertedUrl(data.url);
        toast({ title: "Conversion Complete", description: "Your audio has been converted" });
      } else {
        throw new Error(data.message || "Conversion failed");
      }
    } catch (error) {
      toast({
        title: "Conversion Failed",
        description: error instanceof Error ? error.message : "Could not convert audio",
        variant: "destructive",
      });
    } finally {
      setLoading((p) => ({ ...p, convert: false }));
    }
  };

  const playAudio = useCallback((url: string, id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingId(id);
    audio.onended = () => setPlayingId(null);
  }, [playingId]);

  const downloadAudio = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic className="w-6 h-6 text-purple-400" />
          <h1 className="text-xl font-bold">Voice Conversion</h1>
        </div>
        <div className="flex items-center gap-2">
          {rvcAvailable === null ? (
            <span className="text-gray-400 text-sm">Checking RVC...</span>
          ) : rvcAvailable ? (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" /> RVC Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-yellow-400 text-sm">
              <AlertCircle className="w-4 h-4" /> RVC Offline
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={checkHealth}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Voice Library */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Volume2 className="w-5 h-5" /> Voice Library
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading.voices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : voices.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No voices yet. Create one below!</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {voices.map((voice) => (
                  <div
                    key={voice.voiceId}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition ${
                      selectedVoice?.voiceId === voice.voiceId
                        ? "bg-purple-600/30 border border-purple-500"
                        : "bg-gray-800 hover:bg-gray-700"
                    }`}
                    onClick={() => setSelectedVoice(voice)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{voice.name}</p>
                      <p className="text-xs text-gray-400">{new Date(voice.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {voice.sampleUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudio(voice.sampleUrl!, voice.voiceId);
                          }}
                        >
                          {playingId === voice.voiceId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVoice(voice.voiceId);
                        }}
                        disabled={loading.delete}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Voice */}
            <div className="border-t border-gray-700 pt-3 space-y-2">
              <Label className="text-sm font-medium">Create New Voice</Label>
              <Input
                placeholder="Voice name"
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
                className="bg-gray-800 border-gray-600"
              />
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "voice");
                    }}
                  />
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadedFile ? uploadedFile.name.slice(0, 15) + "..." : "Upload Sample"}
                    </span>
                  </Button>
                </label>
                <Button onClick={handleCreateVoice} disabled={!uploadedObjectKey || loading.create}>
                  {loading.create ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Convert Panel */}
        <Card className="bg-gray-900 border-gray-700 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Convert Audio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source Audio */}
            <div className="space-y-2">
              <Label>Source Audio</Label>
              <label className="block">
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "source");
                  }}
                />
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {sourceFile ? sourceFile.name : "Upload audio to convert"}
                  </span>
                </Button>
              </label>
            </div>

            {/* Selected Voice */}
            <div className="space-y-2">
              <Label>Target Voice</Label>
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                {selectedVoice ? (
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-purple-400" />
                    <span className="font-medium">{selectedVoice.name}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">Select a voice from the library</span>
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Pitch Shift: {settings.pitch}</Label>
                <Slider
                  value={[settings.pitch]}
                  onValueChange={([v]) => setSettings((s) => ({ ...s, pitch: v }))}
                  min={-12}
                  max={12}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Voice Similarity: {(settings.indexRate * 100).toFixed(0)}%</Label>
                <Slider
                  value={[settings.indexRate]}
                  onValueChange={([v]) => setSettings((s) => ({ ...s, indexRate: v }))}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">RMS Mix: {(settings.rmsMixRate * 100).toFixed(0)}%</Label>
                <Slider
                  value={[settings.rmsMixRate]}
                  onValueChange={([v]) => setSettings((s) => ({ ...s, rmsMixRate: v }))}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Protect: {(settings.protect * 100).toFixed(0)}%</Label>
                <Slider
                  value={[settings.protect]}
                  onValueChange={([v]) => setSettings((s) => ({ ...s, protect: v }))}
                  min={0}
                  max={0.5}
                  step={0.01}
                />
              </div>
            </div>

            {/* Convert Button */}
            <Button
              onClick={handleConvert}
              disabled={!selectedVoice || !sourceObjectKey || loading.convert || !rvcAvailable}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading.convert ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Converting...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" /> Convert Audio
                </>
              )}
            </Button>

            {/* Output */}
            {convertedUrl && (
              <div className="border-t border-gray-700 pt-4 space-y-2">
                <Label>Converted Audio</Label>
                <div className="flex items-center gap-2">
                  <audio src={convertedUrl} controls className="flex-1 h-10" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadAudio(convertedUrl, "converted-audio.wav")}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
