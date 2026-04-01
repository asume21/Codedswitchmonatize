import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mic2,
  Square,
  Play,
  Pause,
  Trash2,
  Upload,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Plus,
  X,
  Volume2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  name: string;
}

interface ClonedVoice {
  voiceId: string;
  name: string;
  requiresVerification: boolean;
}

interface VoiceRecorderProps {
  onVoiceCloned?: (voice: ClonedVoice) => void;
}

export default function VoiceRecorder({ onVoiceCloned }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<ClonedVoice | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [myVoices, setMyVoices] = useState<Array<{ voiceId: string; name: string; category: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micDataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const { toast } = useToast();

  // Load existing voices on mount
  useEffect(() => {
    fetchMyVoices();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      recordings.forEach((r) => URL.revokeObjectURL(r.url));
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const fetchMyVoices = async () => {
    setLoadingVoices(true);
    try {
      const res = await fetch("/api/voice-convert/my-voices", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setMyVoices(data.voices || []);
      }
    } catch {
      // Silently fail — voices list is optional
    } finally {
      setLoadingVoices(false);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // Set up audio analyser for mic level visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      micDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current || !micDataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(micDataArrayRef.current);
        const avg = micDataArrayRef.current.reduce((sum, val) => sum + val, 0) / micDataArrayRef.current.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Prefer webm for broad browser support, fall back to wav
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          const newRecording: VoiceRecording = {
            id: crypto.randomUUID(),
            blob,
            url,
            duration: recordingTime,
            name: `Recording ${recordings.length + 1}`,
          };
          setRecordings((prev) => [...prev, newRecording]);
        }
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Mic access error:", err);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser to record your voice.",
        variant: "destructive",
      });
    }
  }, [recordings.length, recordingTime, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current = null;
    micDataArrayRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    setIsRecording(false);
    setMicLevel(0);
  }, []);

  const playRecording = (recording: VoiceRecording) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === recording.id) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(recording.url);
    audioRef.current = audio;
    setPlayingId(recording.id);

    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.play().catch(() => setPlayingId(null));
  };

  const removeRecording = (id: string) => {
    setRecordings((prev) => {
      const rec = prev.find((r) => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter((r) => r.id !== id);
    });
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const newRecording: VoiceRecording = {
        id: crypto.randomUUID(),
        blob: file,
        url,
        duration: 0,
        name: file.name,
      };
      setRecordings((prev) => [...prev, newRecording]);
    });

    e.target.value = "";
  };

  const cloneVoice = async () => {
    if (!voiceName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your voice clone.",
        variant: "destructive",
      });
      return;
    }

    if (recordings.length === 0) {
      toast({
        title: "Recordings Required",
        description: "Record or upload at least one audio sample.",
        variant: "destructive",
      });
      return;
    }

    setIsCloning(true);
    setCloneResult(null);

    try {
      const formData = new FormData();
      formData.append("name", voiceName.trim());
      if (voiceDescription.trim()) {
        formData.append("description", voiceDescription.trim());
      }

      for (const recording of recordings) {
        const ext = recording.blob.type.includes("webm") ? "webm" : "wav";
        formData.append("files", recording.blob, `${recording.name}.${ext}`);
      }

      const res = await fetch("/api/voice-convert/clone-voice", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Voice cloning failed");
      }

      const result: ClonedVoice = {
        voiceId: data.voiceId,
        name: voiceName.trim(),
        requiresVerification: data.requiresVerification || false,
      };

      setCloneResult(result);
      onVoiceCloned?.(result);
      fetchMyVoices();

      toast({
        title: "Voice Cloned!",
        description: `"${voiceName.trim()}" is ready. Voice ID: ${data.voiceId}`,
      });
    } catch (err: any) {
      toast({
        title: "Cloning Failed",
        description: err.message || "Could not clone voice. Check your API key and try again.",
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalDuration = recordings.reduce((sum, r) => sum + r.duration, 0);

  return (
    <div className="space-y-4">
      {/* Recording Section */}
      <Card className="border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-cyan-400" />
            Record Your Voice
          </CardTitle>
          <CardDescription>
            Record 10 seconds to 5 minutes of clear speech. The more samples you provide, the better the clone quality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tips */}
          <Alert className="border-cyan-500/30 bg-cyan-500/5">
            <AlertDescription className="text-sm text-white/70">
              <strong className="text-cyan-400">Tips for best results:</strong>
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li>Use a quiet room with minimal background noise</li>
                <li>Speak naturally at a consistent volume</li>
                <li>Record at least 30 seconds of speech</li>
                <li>You can add multiple recordings for better quality</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Mic Level & Recording Controls */}
          <div className="flex items-center gap-4">
            {isRecording ? (
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="min-w-[160px]"
              >
                <Square className="w-4 h-4 mr-2 fill-current" />
                Stop Recording
              </Button>
            ) : (
              <Button
                onClick={startRecording}
                size="lg"
                className="min-w-[160px] bg-red-600 hover:bg-red-500"
              >
                <Mic2 className="w-4 h-4 mr-2" />
                Start Recording
              </Button>
            )}

            {isRecording && (
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-400 animate-pulse flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    Recording...
                  </span>
                  <span className="text-white/60 font-mono">{formatTime(recordingTime)}</span>
                </div>
                <Progress value={micLevel} className="h-2" />
              </div>
            )}
          </div>

          {/* Upload Alternative */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">or</span>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-white/20 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors text-white/60 hover:text-white/80">
                <Upload className="w-3 h-3" />
                Upload audio files
              </span>
            </label>
          </div>

          {/* Recordings List */}
          {recordings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white/70">
                  Recordings ({recordings.length})
                </Label>
                {totalDuration > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Total: {formatTime(totalDuration)}
                  </Badge>
                )}
              </div>
              <div className="space-y-1.5">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-white/5 border border-white/10"
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => playRecording(rec)}
                    >
                      {playingId === rec.id ? (
                        <Pause className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{rec.name}</p>
                      {rec.duration > 0 && (
                        <p className="text-xs text-white/40">{formatTime(rec.duration)}</p>
                      )}
                    </div>
                    <Volume2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300"
                      onClick={() => removeRecording(rec.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clone Voice Section */}
      <Card className="border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5 text-purple-400" />
            Create Voice Clone
          </CardTitle>
          <CardDescription>
            Name your voice and send it to ElevenLabs for instant cloning. Your Voice ID will be ready in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voice-name">Voice Name</Label>
            <Input
              id="voice-name"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="e.g. My Voice, Studio Voice"
              disabled={isCloning}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-desc">Description (optional)</Label>
            <Input
              id="voice-desc"
              value={voiceDescription}
              onChange={(e) => setVoiceDescription(e.target.value)}
              placeholder="e.g. Male, mid-range, warm tone"
              disabled={isCloning}
            />
          </div>

          <Button
            onClick={cloneVoice}
            disabled={isCloning || recordings.length === 0 || !voiceName.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
          >
            {isCloning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cloning Voice...
              </>
            ) : (
              <>
                <Mic2 className="w-4 h-4 mr-2" />
                Clone Voice ({recordings.length} sample{recordings.length !== 1 ? "s" : ""})
              </>
            )}
          </Button>

          {/* Clone Result */}
          {cloneResult && (
            <Alert className="border-green-500/30 bg-green-500/10">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <AlertDescription className="text-sm">
                <strong className="text-green-400">Voice cloned successfully!</strong>
                <div className="mt-1 space-y-1">
                  <p className="text-white/70">
                    Name: <strong>{cloneResult.name}</strong>
                  </p>
                  <p className="text-white/70">
                    Voice ID: <code className="px-1.5 py-0.5 bg-black/30 rounded text-xs font-mono text-cyan-300">{cloneResult.voiceId}</code>
                  </p>
                  <p className="text-xs text-white/50 mt-2">
                    Use this Voice ID in the Voice Convert tab to convert any song with your cloned voice.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* My Voices */}
      {myVoices.length > 0 && (
        <Card className="border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-cyan-400" />
              My Voices ({myVoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {myVoices.map((voice) => (
                <div
                  key={voice.voiceId}
                  className="flex items-center justify-between p-2 rounded-md bg-white/5 border border-white/10"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{voice.name}</p>
                    <p className="text-xs text-white/40">{voice.category}</p>
                  </div>
                  <code className="text-xs font-mono text-cyan-300/70 bg-black/20 px-2 py-0.5 rounded">
                    {voice.voiceId}
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
