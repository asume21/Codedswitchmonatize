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
  Sparkles,
} from "lucide-react";

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url?: string;
}

interface ConvertSettings {
  stability: number;
  similarity_boost: number;
}

const DEFAULT_SETTINGS: ConvertSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
};

export default function VoiceConversion() {
  const { toast } = useToast();

  // State
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoice | null>(null);
  const [elevenLabsAvailable, setElevenLabsAvailable] = useState<boolean | null>(null);
  const [subscription, setSubscription] = useState<{ character_count: number; character_limit: number } | null>(null);
  const [loading, setLoading] = useState({
    voices: false,
    create: false,
    convert: false,
    delete: false,
    songReplace: false,
  });

  // Song Vocal Replacement state
  const [songFile, setSongFile] = useState<File | null>(null);
  const [songObjectKey, setSongObjectKey] = useState<string | null>(null);
  const [replaceStep, setReplaceStep] = useState<'idle' | 'separating' | 'converting' | 'mixing' | 'done'>('idle');
  const [extractedVocalsUrl, setExtractedVocalsUrl] = useState<string | null>(null);
  const [instrumentalUrl, setInstrumentalUrl] = useState<string | null>(null);
  const [replacedVocalsUrl, setReplacedVocalsUrl] = useState<string | null>(null);
  const [finalMixUrl, setFinalMixUrl] = useState<string | null>(null);

  // Create voice state
  const [newVoiceName, setNewVoiceName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedObjectKeys, setUploadedObjectKeys] = useState<string[]>([]);

  // Convert state
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceObjectKey, setSourceObjectKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<ConvertSettings>(DEFAULT_SETTINGS);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);

  // Audio playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check ElevenLabs on mount
  useEffect(() => {
    checkHealth();
    loadVoices();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await apiRequest("GET", "/api/elevenlabs/subscription");
      const data = await res.json();
      if (data.success) {
        setElevenLabsAvailable(true);
        setSubscription({ character_count: data.character_count, character_limit: data.character_limit });
      } else {
        setElevenLabsAvailable(false);
      }
    } catch {
      setElevenLabsAvailable(false);
    }
  };

  const loadVoices = async () => {
    setLoading((p) => ({ ...p, voices: true }));
    try {
      const res = await apiRequest("GET", "/api/elevenlabs/voices");
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
    try {
      const paramResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
        credentials: 'include'
      });
      
      if (!paramResponse.ok) {
        throw new Error('Failed to get upload URL');
      }
      
      const { uploadURL, objectKey } = await paramResponse.json();
      
      const arrayBuffer = await file.arrayBuffer();
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: arrayBuffer,
        headers: { 'Content-Type': file.type || 'audio/mpeg' },
        credentials: 'include'
      });
      
      if (!uploadResponse.ok) {
        throw new Error('File upload failed');
      }

      if (purpose === "voice") {
        setUploadedFiles((prev) => [...prev, file]);
        setUploadedObjectKeys((prev) => [...prev, objectKey]);
      } else {
        setSourceFile(file);
        setSourceObjectKey(objectKey);
      }
      
      toast({
        title: "Upload Complete",
        description: `${file.name} uploaded successfully`,
      });
      
      return objectKey;
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Could not upload file",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleCreateVoice = async () => {
    if (uploadedObjectKeys.length === 0) {
      toast({ title: "No files", description: "Upload at least one audio sample", variant: "destructive" });
      return;
    }

    setLoading((p) => ({ ...p, create: true }));
    try {
      const audioUrls = uploadedObjectKeys.map((key) => `/api/internal/uploads/${key}`);
      const res = await apiRequest("POST", "/api/elevenlabs/clone", {
        name: newVoiceName || "My Voice",
        description: `Voice clone from ${uploadedFiles.length} samples`,
        audioUrls,
      });
      const data = await res.json();
      if (data.success && data.voice) {
        await loadVoices();
        setNewVoiceName("");
        setUploadedFiles([]);
        setUploadedObjectKeys([]);
        toast({ title: "Voice Created", description: `"${data.voice.name}" added to ElevenLabs` });
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
      const res = await apiRequest("DELETE", `/api/elevenlabs/voices/${voiceId}`);
      const data = await res.json();
      if (data.success) {
        setVoices((prev) => prev.filter((v) => v.voice_id !== voiceId));
        if (selectedVoice?.voice_id === voiceId) {
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
      const res = await apiRequest("POST", "/api/elevenlabs/sts", {
        voiceId: selectedVoice.voice_id,
        objectKey: sourceObjectKey,
        stability: settings.stability,
        similarity_boost: settings.similarity_boost,
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

  // Handle song file upload for vocal replacement
  const handleSongUpload = async (file: File) => {
    try {
      const paramResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
        credentials: 'include'
      });
      
      if (!paramResponse.ok) throw new Error('Failed to get upload URL');
      
      const { uploadURL, objectKey } = await paramResponse.json();
      
      const arrayBuffer = await file.arrayBuffer();
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: arrayBuffer,
        headers: { 'Content-Type': file.type || 'audio/mpeg' },
        credentials: 'include'
      });
      
      if (!uploadResponse.ok) throw new Error('File upload failed');

      setSongFile(file);
      setSongObjectKey(objectKey);
      setReplaceStep('idle');
      setExtractedVocalsUrl(null);
      setInstrumentalUrl(null);
      setReplacedVocalsUrl(null);
      setFinalMixUrl(null);
      toast({ title: "Song Uploaded", description: file.name });
    } catch (error) {
      toast({ title: "Upload Failed", description: error instanceof Error ? error.message : "Could not upload", variant: "destructive" });
    }
  };

  // Full vocal replacement workflow with mixing
  const handleVocalReplacement = async () => {
    if (!selectedVoice) {
      toast({ title: "Select a Voice", description: "Choose your cloned voice first", variant: "destructive" });
      return;
    }
    if (!songObjectKey) {
      toast({ title: "Upload a Song", description: "Upload a song to replace vocals", variant: "destructive" });
      return;
    }

    setLoading((p) => ({ ...p, songReplace: true }));
    setReplaceStep('separating');
    setExtractedVocalsUrl(null);
    setInstrumentalUrl(null);
    setReplacedVocalsUrl(null);
    setFinalMixUrl(null);

    try {
      let vocalsUrl: string | null = null;
      let instUrl: string | null = null;
      
      // Step 1: Use ElevenLabs isolation for vocals (fast and reliable)
      // Then use stem separation just for instrumental
      toast({ title: "Step 1/3", description: "Extracting vocals..." });
      
      const isolateRes = await apiRequest("POST", "/api/elevenlabs/isolate", {
        objectKey: songObjectKey,
      });
      const isolateData = await isolateRes.json();
      
      if (!isolateData.success || !isolateData.url) {
        throw new Error(isolateData.message || "Failed to extract vocals");
      }
      
      vocalsUrl = isolateData.url;
      setExtractedVocalsUrl(vocalsUrl);
      
      // Start stem separation in background for instrumental (don't wait)
      apiRequest("POST", "/api/ai/stem-separation", {
        audioUrl: `/api/internal/uploads/${songObjectKey}`,
        stemCount: 2,
      }).then(async (stemRes) => {
        const stemData = await stemRes.json();
        if (stemData.success && stemData.predictionId) {
          // Poll in background
          const pollForInstrumental = async () => {
            for (let i = 0; i < 40; i++) {
              await new Promise(r => setTimeout(r, 5000));
              try {
                const statusRes = await apiRequest("GET", `/api/ai/stem-separation/status/${stemData.predictionId}`);
                const statusData = await statusRes.json();
                if (statusData.status === 'completed' && statusData.stems) {
                  const instrumental = statusData.stems.no_vocals || statusData.stems.accompaniment;
                  if (instrumental) {
                    // Download instrumental
                    const dlRes = await apiRequest("POST", "/api/audio/download-external", { url: instrumental });
                    const dlData = await dlRes.json();
                    if (dlData.success && dlData.url) {
                      setInstrumentalUrl(dlData.url);
                      toast({ title: "Instrumental Ready!", description: "You can now mix with the beat" });
                    }
                  }
                  break;
                } else if (statusData.status === 'failed') break;
              } catch { break; }
            }
          };
          pollForInstrumental();
        }
      }).catch(() => {});
      
      // Step 2: Convert extracted vocals to cloned voice
      setReplaceStep('converting');
      toast({ title: "Step 2/3", description: "Converting to your voice (1-3 min)..." });
      
      if (!vocalsUrl) {
        throw new Error("No vocals URL available");
      }
      
      const vocalsObjectKey = vocalsUrl.includes('/api/internal/uploads/') 
        ? vocalsUrl.split('/api/internal/uploads/')[1]
        : null;
      
      if (!vocalsObjectKey) {
        throw new Error("Could not get vocals file for conversion");
      }
      
      const stsRes = await apiRequest("POST", "/api/elevenlabs/sts", {
        voiceId: selectedVoice.voice_id,
        objectKey: vocalsObjectKey,
        stability: settings.stability,
        similarity_boost: settings.similarity_boost,
      });
      const stsData = await stsRes.json();
      
      if (!stsData.success || !stsData.url) {
        throw new Error(stsData.message || "Failed to convert voice");
      }
      
      setReplacedVocalsUrl(stsData.url);
      
      setReplaceStep('done');
      toast({ 
        title: "Voice Conversion Complete!", 
        description: "Your cloned vocals are ready! Instrumental extraction continues in background."
      });
      
    } catch (error) {
      toast({
        title: "Vocal Replacement Failed",
        description: error instanceof Error ? error.message : "Could not replace vocals",
        variant: "destructive",
      });
      setReplaceStep('idle');
    } finally {
      setLoading((p) => ({ ...p, songReplace: false }));
    }
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
          {elevenLabsAvailable === null ? (
            <span className="text-gray-400 text-sm">Checking ElevenLabs...</span>
          ) : elevenLabsAvailable ? (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <Sparkles className="w-4 h-4" /> ElevenLabs {subscription ? `(${subscription.character_count.toLocaleString()}/${subscription.character_limit.toLocaleString()})` : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-yellow-400 text-sm">
              <AlertCircle className="w-4 h-4" /> ElevenLabs Unavailable
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
                    key={voice.voice_id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition ${
                      selectedVoice?.voice_id === voice.voice_id
                        ? "bg-purple-600/30 border border-purple-500"
                        : "bg-gray-800 hover:bg-gray-700"
                    }`}
                    onClick={() => setSelectedVoice(voice)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{voice.name}</p>
                      <p className="text-xs text-gray-400">{voice.category}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {voice.preview_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudio(voice.preview_url!, voice.voice_id);
                          }}
                        >
                          {playingId === voice.voice_id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVoice(voice.voice_id);
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
                      {uploadedFiles.length > 0 ? `${uploadedFiles.length} file(s)` : "Upload Samples"}
                    </span>
                  </Button>
                </label>
                <Button onClick={handleCreateVoice} disabled={uploadedObjectKeys.length === 0 || loading.create}>
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
                <Label className="text-sm">Stability: {(settings.stability * 100).toFixed(0)}%</Label>
                <Slider
                  value={[settings.stability]}
                  onValueChange={([v]) => setSettings((s) => ({ ...s, stability: v }))}
                  min={0}
                  max={1}
                  step={0.05}
                />
                <p className="text-xs text-gray-500">Higher = more consistent, lower = more expressive</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Similarity: {(settings.similarity_boost * 100).toFixed(0)}%</Label>
                <Slider
                  value={[settings.similarity_boost]}
                  onValueChange={([v]) => setSettings((s) => ({ ...s, similarity_boost: v }))}
                  min={0}
                  max={1}
                  step={0.05}
                />
                <p className="text-xs text-gray-500">Higher = closer to original voice</p>
              </div>
            </div>

            {/* Convert Button */}
            <Button
              onClick={handleConvert}
              disabled={!selectedVoice || !sourceObjectKey || loading.convert || !elevenLabsAvailable}
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

        {/* Song Vocal Replacement - Full Workflow */}
        <Card className="bg-gradient-to-br from-purple-900/50 to-gray-900 border-purple-700 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Song Vocal Replacement
            </CardTitle>
            <p className="text-sm text-gray-400">Upload a song → Extract vocals → Replace with your cloned voice</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Step 1: Upload Song */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
                  Upload Song
                </Label>
                <label className="block">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSongUpload(file);
                    }}
                  />
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {songFile ? songFile.name.slice(0, 20) + '...' : "Choose Song"}
                    </span>
                  </Button>
                </label>
              </div>

              {/* Step 2: Select Voice */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
                  Select Your Voice
                </Label>
                <div className="text-sm p-2 bg-gray-800 rounded border border-gray-600">
                  {selectedVoice ? (
                    <span className="text-green-400">{selectedVoice.name}</span>
                  ) : (
                    <span className="text-gray-400">Select from Voice Library above</span>
                  )}
                </div>
              </div>

              {/* Step 3: Replace */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
                  Replace Vocals
                </Label>
                <Button
                  onClick={handleVocalReplacement}
                  disabled={!selectedVoice || !songObjectKey || loading.songReplace || !elevenLabsAvailable}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {loading.songReplace ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {replaceStep === 'separating' ? 'Extracting Vocals...' : replaceStep === 'converting' ? 'Converting Voice...' : replaceStep === 'mixing' ? 'Mixing...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> Replace Vocals
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Progress & Results */}
            {replaceStep !== 'idle' && (
              <div className="border-t border-gray-700 pt-4 space-y-3">
                {/* Progress Steps */}
                <div className="flex items-center gap-4 text-sm">
                  <div className={`flex items-center gap-1 ${replaceStep === 'separating' ? 'text-yellow-400' : extractedVocalsUrl ? 'text-green-400' : 'text-gray-500'}`}>
                    {replaceStep === 'separating' ? <Loader2 className="w-4 h-4 animate-spin" /> : extractedVocalsUrl ? <CheckCircle className="w-4 h-4" /> : <span className="w-4 h-4" />}
                    Extract Vocals
                  </div>
                  <div className="flex-1 h-px bg-gray-700" />
                  <div className={`flex items-center gap-1 ${replaceStep === 'converting' ? 'text-yellow-400' : replacedVocalsUrl ? 'text-green-400' : 'text-gray-500'}`}>
                    {replaceStep === 'converting' ? <Loader2 className="w-4 h-4 animate-spin" /> : replacedVocalsUrl ? <CheckCircle className="w-4 h-4" /> : <span className="w-4 h-4" />}
                    Convert Voice
                  </div>
                  <div className="flex-1 h-px bg-gray-700" />
                  <div className={`flex items-center gap-1 ${replaceStep === 'done' ? 'text-green-400' : 'text-gray-500'}`}>
                    {replaceStep === 'done' ? <CheckCircle className="w-4 h-4" /> : <span className="w-4 h-4" />}
                    Done
                  </div>
                </div>

                {/* Extracted Vocals */}
                {extractedVocalsUrl && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-400">Extracted Vocals (Original Voice)</Label>
                    <div className="flex items-center gap-2">
                      <audio src={extractedVocalsUrl} controls className="flex-1 h-10" />
                      <Button variant="outline" size="sm" onClick={() => downloadAudio(extractedVocalsUrl, "extracted-vocals.mp3")}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Replaced Vocals */}
                {replacedVocalsUrl && (
                  <div className="space-y-1">
                    <Label className="text-sm text-green-400 font-semibold">Your Cloned Voice Vocals</Label>
                    <div className="flex items-center gap-2">
                      <audio src={replacedVocalsUrl} controls className="flex-1 h-10" />
                      <Button variant="outline" size="sm" onClick={() => downloadAudio(replacedVocalsUrl, "cloned-voice-vocals.mp3")}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Mix with Instrumental */}
                {replacedVocalsUrl && (
                  <div className="border-t border-gray-700 pt-4 space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-purple-400" />
                      Mix with Instrumental (Optional)
                    </Label>
                    <p className="text-xs text-gray-400">Upload the instrumental/beat to create a full mixed track</p>
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            try {
                              // Upload instrumental
                              const paramRes = await fetch('/api/objects/upload', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fileName: file.name }),
                                credentials: 'include'
                              });
                              const { uploadURL, objectKey } = await paramRes.json();
                              
                              await fetch(uploadURL, {
                                method: 'PUT',
                                body: await file.arrayBuffer(),
                                headers: { 'Content-Type': file.type || 'audio/mpeg' },
                                credentials: 'include'
                              });
                              
                              setInstrumentalUrl(`/api/internal/uploads/${objectKey}`);
                              toast({ title: "Instrumental Uploaded", description: file.name });
                            } catch (err) {
                              toast({ title: "Upload Failed", variant: "destructive" });
                            }
                          }}
                        />
                        <Button variant="outline" className="w-full" asChild>
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            {instrumentalUrl ? "Instrumental Ready ✓" : "Upload Instrumental/Beat"}
                          </span>
                        </Button>
                      </label>
                      <Button
                        disabled={!instrumentalUrl || loading.songReplace}
                        className="bg-green-600 hover:bg-green-700"
                        onClick={async () => {
                          if (!replacedVocalsUrl || !instrumentalUrl) return;
                          
                          setLoading(p => ({ ...p, songReplace: true }));
                          try {
                            const mixRes = await apiRequest("POST", "/api/audio/mix", {
                              vocalsUrl: replacedVocalsUrl,
                              instrumentalUrl: instrumentalUrl,
                              vocalsVolume: 1.0,
                              instrumentalVolume: 0.8,
                            });
                            const mixData = await mixRes.json();
                            
                            if (mixData.success && mixData.url) {
                              setFinalMixUrl(mixData.url);
                              toast({ title: "Mix Complete!", description: "Your full song is ready!" });
                            } else {
                              throw new Error(mixData.message || "Mix failed");
                            }
                          } catch (err) {
                            toast({ title: "Mix Failed", description: err instanceof Error ? err.message : "Could not mix", variant: "destructive" });
                          } finally {
                            setLoading(p => ({ ...p, songReplace: false }));
                          }
                        }}
                      >
                        {loading.songReplace ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mix"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Final Mixed Track */}
                {finalMixUrl && (
                  <div className="space-y-1 bg-gradient-to-r from-green-900/30 to-purple-900/30 p-3 rounded-lg border border-green-600">
                    <Label className="text-sm text-green-400 font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Final Mixed Song (Your Voice + Beat)
                    </Label>
                    <div className="flex items-center gap-2">
                      <audio src={finalMixUrl} controls className="flex-1 h-10" />
                      <Button variant="outline" size="sm" className="border-green-600 text-green-400" onClick={() => downloadAudio(finalMixUrl, "final-song-mixed.mp3")}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
