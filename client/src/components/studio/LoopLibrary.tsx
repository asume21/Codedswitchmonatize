import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTracks } from "@/hooks/useTracks";
import { Waves, Music, PlusCircle, Play, Pause } from "lucide-react";
import { professionalAudio } from "@/lib/professionalAudio";
import { getAudioContext } from "@/lib/audioContext";
import { AudioPremixCache } from "@/lib/audioPremix";

interface LoopInfo {
  id: string;
  name: string;
  audioUrl: string;
}

export default function LoopLibrary() {
  const { addTrack } = useTracks();
  const { toast } = useToast();
  const [loops, setLoops] = useState<LoopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const premixCacheRef = useRef(new AudioPremixCache());
  const inFlightPremixRef = useRef<Map<string, Promise<string | null>>>(new Map());

  const resolvePlaybackUrl = useCallback(async (loop: LoopInfo) => {
    const cacheKey = `${loop.id}:${loop.audioUrl}`;
    if (!inFlightPremixRef.current.has(cacheKey)) {
      inFlightPremixRef.current.set(
        cacheKey,
        premixCacheRef.current
          .getOrCreate(cacheKey, [loop.audioUrl])
          .catch((error) => {
            console.warn('Loop premix failed', { loopId: loop.id, error });
            return null;
          })
      );
    }

    const premixed = await inFlightPremixRef.current.get(cacheKey)!;
    inFlightPremixRef.current.delete(cacheKey);
    return premixed ?? loop.audioUrl;
  }, []);

  useEffect(() => {
    const fetchLoops = async () => {
      try {
        const response = await fetch("/api/loops");
        if (!response.ok) throw new Error("Failed to fetch loops");
        const data = await response.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.loops)
            ? (data as any).loops
            : Array.isArray((data as any)?.items)
              ? (data as any).items
              : Array.isArray((data as any)?.data)
                ? (data as any).data
                : [];
        const items = list
          .map((item: any) => ({
            id: String(item?.id ?? item?.filename ?? item?.name ?? crypto?.randomUUID?.() ?? Date.now()),
            name: String(item?.name ?? item?.filename ?? "Loop"),
            audioUrl: String(item?.audioUrl ?? item?.url ?? item?.audio_url ?? ""),
          }))
          .filter((item: LoopInfo) => Boolean(item.audioUrl));
        setLoops(items);
      } catch (err: any) {
        console.error("LoopLibrary fetch error", err);
        setError(err?.message || "Failed to load loops");
      } finally {
        setLoading(false);
      }
    };

    fetchLoops();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const handlePreview = async (loop: LoopInfo) => {
    if (previewUrl === loop.audioUrl && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setPreviewUrl(loop.audioUrl);
    setIsPlaying(true);

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.preload = "auto";
    }

    let playbackUrl = loop.audioUrl;
    try {
      playbackUrl = await resolvePlaybackUrl(loop);
    } catch (error) {
      console.warn('Loop premix resolution failed, falling back to raw URL', error);
    }

    audioRef.current.src = playbackUrl;
    
    // Connect to mixer if not already connected
    if (!sourceNodeRef.current && audioRef.current) {
      try {
        await professionalAudio.initialize();
        const ctx = professionalAudio.getAudioContext() || getAudioContext();
        sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
        
        // Find 'instruments' or 'other' channel
        const channels = professionalAudio.getChannels();
        const targetChannel = channels.find(c => c.id === 'instruments' || c.name.toLowerCase() === 'instruments') 
                           || channels.find(c => c.id === 'other' || c.name.toLowerCase() === 'other');
        
        if (targetChannel) {
          sourceNodeRef.current.connect(targetChannel.input);
          console.log(`🔊 Loop preview routed to mixer channel: ${targetChannel.name}`);
        } else {
          sourceNodeRef.current.connect(ctx.destination);
          console.log("🔊 Mixer channel not found, preview routed to hardware output");
        }
      } catch (e) {
        console.error("Failed to route loop preview to mixer:", e);
      }
    }

    audioRef.current.play().catch(err => {
      console.error("Loop preview play error:", err);
      setIsPlaying(false);
    });

    audioRef.current.onended = () => setIsPlaying(false);
  };

  const handleAddToTracks = (loop: LoopInfo) => {
    addTrack({
      name: loop.name,
      type: "audio",
      audioUrl: loop.audioUrl,
      source: "loop-library",
      lengthBars: 4,
      startBar: 0,
    });

    toast({
      title: "Loop added to timeline",
      description: `${loop.name} is now an audio track in the Multi-Track`,
    });
  };

  return (
    <Card className="bg-gray-900 border border-gray-700">
      <CardHeader className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Waves className="w-5 h-5 text-blue-400" />
          <CardTitle className="text-lg text-white flex items-center gap-2">
            Loop Library
          </CardTitle>
        </div>
        <Badge variant="secondary" className="bg-gray-800 text-gray-200 flex items-center gap-1">
          <Music className="w-3 h-3" />
          Audio Loops
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-gray-400">Loading loops</p>}
        {error && !loading && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !error && loops.length === 0 && (
          <p className="text-sm text-gray-400">No loops found in the library yet.</p>
        )}

        {!loading && !error && loops.length > 0 && (
          <div className="space-y-2">
            {loops.map((loop) => (
              <div
                key={loop.id}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 hover:bg-gray-750 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">{loop.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono truncate max-w-[200px]">
                    {loop.audioUrl.split('/').pop()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={previewUrl === loop.audioUrl && isPlaying ? "secondary" : "outline"}
                    className="flex items-center gap-1 h-8 px-2"
                    onClick={() => handlePreview(loop)}
                  >
                    {previewUrl === loop.audioUrl && isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {previewUrl === loop.audioUrl && isPlaying ? 'Stop' : 'Preview'}
                  </Button>
                  <Button
                    size="sm"
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 h-8 px-2"
                    onClick={() => handleAddToTracks(loop)}
                  >
                    <PlusCircle className="w-3 h-3" />
                    Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {previewUrl && isPlaying && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <p className="text-xs text-blue-300 font-medium truncate max-w-[200px]">
                  Playing: {loops.find(l => l.audioUrl === previewUrl)?.name}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                onClick={() => {
                  audioRef.current?.pause();
                  setIsPlaying(false);
                }}
              >
                Stop
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
