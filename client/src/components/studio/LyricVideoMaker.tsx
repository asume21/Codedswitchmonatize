import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileText,
  Pause,
  Play,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Subtitles,
  Upload,
  Video,
} from 'lucide-react';

import { SimpleFileUploader } from '@/components/SimpleFileUploader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useStudioSession } from '@/contexts/StudioSessionContext';
import { useTransport } from '@/contexts/TransportContext';
import { useToast } from '@/hooks/use-toast';
import { ApiError, apiRequest } from '@/lib/queryClient';
import {
  buildLyricVideoLines,
  resolveLyricLineTiming,
  type TimedLyricWord,
} from '@/lib/lyricVideoTiming';
import {
  renderLyricFrame,
  FONT_FAMILIES,
  type FontKey,
  type AnimStyle,
} from '@/lib/lyricVideoCanvas';
import { useStudioStore } from '@/stores/useStudioStore';
import { cn } from '@/lib/utils';

interface UploadedAudio {
  url: string;
  name: string;
}

interface DownloadLink {
  url: string;
  filename: string;
}

interface TranscriptResponse {
  transcript?: string;
  words?: TimedLyricWord[];
  raw?: {
    text?: string;
    words?: TimedLyricWord[];
  };
}

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const EXPORT_FPS = 30;
const MIN_OFFSET_MS = -5000;
const MAX_OFFSET_MS = 5000;
const MIN_SPEED_PCT = 50;
const MAX_SPEED_PCT = 150;
const MAX_WORDS_PER_LINE = 12;
const MIN_FONT_SIZE = 32;
const MAX_FONT_SIZE = 140;

function getBestVideoMimeType() {
  const options = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  if (typeof MediaRecorder === 'undefined') return '';
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function sanitizeDownloadName(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'lyrics-video';
}

function getMediaElementCaptureStream(audio: HTMLAudioElement): MediaStream | null {
  const captureStream =
    (audio as HTMLAudioElement & { captureStream?: () => MediaStream }).captureStream ??
    (audio as HTMLAudioElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;

  return captureStream ? captureStream.call(audio) : null;
}

function getAuthHeaders(): HeadersInit {
  const token = window.localStorage.getItem('authToken');
  if (!token) return {};
  return {
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  };
}

async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null);
    const message = body?.message || body?.error || body?.detail;
    if (message) return String(message);
  }

  const text = await response.text().catch(() => '');
  return text ? text.slice(0, 200) : fallback;
}

export default function LyricVideoMaker() {
  const { tempo } = useTransport();
  const { toast } = useToast();
  const studioSession = useStudioSession();
  const setCurrentLyrics = useStudioStore((state) => state.setCurrentLyrics);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const exportRafRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [uploadedAudio, setUploadedAudio] = useState<UploadedAudio | null>(null);
  const [lyricsText, setLyricsText] = useState('');
  const [timedWords, setTimedWords] = useState<TimedLyricWord[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [renderStatus, setRenderStatus] = useState('');
  const [lastExport, setLastExport] = useState<DownloadLink | null>(null);
  const [duration, setDuration] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [snapToBeat, setSnapToBeat] = useState(false);
  const [wordsPerLine, setWordsPerLine] = useState(6);
  const [fontSize, setFontSize] = useState(82);
  const [showNextLine, setShowNextLine] = useState(false);
  const [revealMode, setRevealMode] = useState<'line' | 'build' | 'word'>('line');
  const [speedPct, setSpeedPct] = useState(100); // 100 = 1.0x; scales word times to fix drift
  const [fontKey, setFontKey] = useState<FontKey>('Inter');
  const [animStyle, setAnimStyle] = useState<AnimStyle>('fade');
  const [renderError, setRenderError] = useState<string | null>(null);

  const lines = useMemo(
    () => buildLyricVideoLines({
      words: timedWords,
      transcript: lyricsText,
      wordsPerLine,
      bpm: tempo,
    }),
    [lyricsText, tempo, timedWords, wordsPerLine],
  );

  const renderConfigRef = useRef({
    lines,
    offsetMs,
    tempo,
    snapToBeat,
    fontSize,
    revealMode,
    showNextLine,
    speedPct,
    fontKey,
    animStyle,
  });

  const lastExportRef = useRef(lastExport);
  const uploadedAudioRef = useRef(uploadedAudio);

  useEffect(() => {
    renderConfigRef.current = {
      lines,
      offsetMs,
      tempo,
      snapToBeat,
      fontSize,
      revealMode,
      showNextLine,
      speedPct,
      fontKey,
      animStyle,
    };
    drawFrame();
  }, [lines, offsetMs, tempo, snapToBeat, fontSize, revealMode, showNextLine, speedPct, fontKey, animStyle]);

  useEffect(() => {
    lastExportRef.current = lastExport;
  }, [lastExport]);

  useEffect(() => {
    uploadedAudioRef.current = uploadedAudio;
  }, [uploadedAudio]);

  const drawFrame = useCallback((currentTime?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const config = renderConfigRef.current;
      renderLyricFrame({
        canvas,
        lines: config.lines,
        currentTime: currentTime ?? audioRef.current?.currentTime ?? 0,
        offsetSec: config.offsetMs / 1000,
        bpm: config.tempo,
        snapToBeat: config.snapToBeat,
        fontSize: config.fontSize,
        revealMode: config.revealMode,
        showNextLine: config.showNextLine,
        speed: config.speedPct / 100,
        fontFamily: FONT_FAMILIES[config.fontKey],
        animStyle: config.animStyle,
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
      });
      if (renderError) setRenderError(null);
    } catch (err) {
      console.error('Error drawing lyric frame:', err);
      setRenderError(err instanceof Error ? err.message : 'Canvas rendering error');
    }
  }, [renderError]);

  const stopDrawLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startDrawLoop = useCallback(() => {
    stopDrawLoop();
    const tick = () => {
      drawFrame();
      const audio = audioRef.current;
      if (audio && !audio.paused && !audio.ended) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawFrame, stopDrawLoop]);

  // Combined cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (exportRafRef.current !== null) cancelAnimationFrame(exportRafRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (lastExportRef.current) {
        URL.revokeObjectURL(lastExportRef.current.url);
      }
      if (uploadedAudioRef.current && uploadedAudioRef.current.url.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedAudioRef.current.url);
      }
    };
  }, []);

  const getUploadParameters = async (file?: File) => {
    const fileName = file?.name || '';
    const format = fileName.split('.').pop()?.toLowerCase() || '';
    const response = await apiRequest('POST', '/api/objects/upload', { fileName, format });
    const data = await response.json();

    if (!data.uploadURL) {
      throw new Error('No upload URL received');
    }

    return {
      method: 'PUT' as const,
      url: data.uploadURL as string,
    };
  };

  const handleUploadComplete = (result: { url: string; name: string; file: File }) => {
    if (uploadedAudio && uploadedAudio.url.startsWith('blob:')) {
      URL.revokeObjectURL(uploadedAudio.url);
    }
    setUploadedAudio({ url: result.url, name: result.name });
    setLyricsText('');
    setTimedWords([]);
    setDuration(0);
    setPlaybackTime(0);
    setLastExport(null);
    setIsPreviewing(false);
    stopDrawLoop();
    toast({
      title: 'Audio loaded',
      description: result.name,
    });
  };

  const transcribeForSync = async () => {
    if (!uploadedAudio) {
      toast({
        title: 'Upload audio first',
        description: 'Load a beat or vocal track before syncing lyrics.',
        variant: 'destructive',
      });
      return;
    }

    if (lyricsText.trim()) {
      const confirmSync = window.confirm(
        'Warning: Syncing will overwrite your current transcript and any manual edits you have made. Do you want to continue?'
      );
      if (!confirmSync) return;
    }

    setIsTranscribing(true);
    try {
      const response = await apiRequest('POST', '/api/speech-correction/transcribe', {
        fileUrl: uploadedAudio.url,
      });
      const data = await response.json() as TranscriptResponse;
      const transcript = data.transcript || data.raw?.text || '';
      const words = Array.isArray(data.words) && data.words.length ? data.words : data.raw?.words || [];

      setLyricsText(transcript);
      setTimedWords(words);
      setCurrentLyrics(transcript);
      studioSession.createLyricsVersion({
        content: transcript,
        source: 'transcription',
        label: 'Lyric Video Sync',
      });

      toast({
        title: 'Lyrics synced',
        description: `${words.length || transcript.split(/\s+/).filter(Boolean).length} words ready.`,
      });
    } catch (error) {
      const description = error instanceof ApiError
        ? error.userMessage
        : error instanceof Error
          ? error.message
          : 'Could not transcribe this audio.';
      toast({
        title: 'Sync failed',
        description,
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const startPreview = async () => {
    const audio = audioRef.current;
    if (!audio || !uploadedAudio) return;

    window.dispatchEvent(new CustomEvent('globalAudio:stopAll'));
    try {
      await audio.play();
      setIsPreviewing(true);
      startDrawLoop();
    } catch (error) {
      toast({
        title: 'Preview blocked',
        description: error instanceof Error ? error.message : 'Could not start playback.',
        variant: 'destructive',
      });
    }
  };

  const pausePreview = () => {
    audioRef.current?.pause();
    setIsPreviewing(false);
    stopDrawLoop();
    drawFrame();
  };

  const resetPreview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaybackTime(0);
    setIsPreviewing(false);
    stopDrawLoop();
    drawFrame(0);
  };

  // Record the canvas + audio to a WebM blob.
  const recordToWebm = async (onProgress?: (progress: number) => void): Promise<Blob> => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) throw new Error('Player not ready');

    const mimeType = getBestVideoMimeType();
    if (!mimeType) throw new Error('This browser cannot record video.');

    pausePreview();
    audio.currentTime = 0;
    setPlaybackTime(0);
    drawFrame(0);

    const videoStream = canvas.captureStream(EXPORT_FPS);
    const audioStream = getMediaElementCaptureStream(audio);
    const stream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(audioStream?.getAudioTracks() ?? []),
    ]);
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const complete = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    const durationSec = audio.duration || duration || 0;
    const loop = () => {
      const current = audio.currentTime;
      drawFrame(current);
      setPlaybackTime(current);
      if (onProgress && durationSec > 0) {
        onProgress(Math.min(99, Math.round((current / durationSec) * 100)));
      }
      if (recorder.state === 'recording' && !audio.ended) {
        exportRafRef.current = requestAnimationFrame(loop);
      }
    };

    recorder.start(250);
    await audio.play();
    loop();

    const stopRecording = () => {
      if (recorder.state === 'recording') recorder.stop();
      if (exportRafRef.current !== null) {
        cancelAnimationFrame(exportRafRef.current);
        exportRafRef.current = null;
      }
    };
    audio.addEventListener('ended', stopRecording, { once: true });
    const timerId = window.setTimeout(stopRecording, Math.ceil((audio.duration || duration || 0) * 1000) + 750);

    const blob = await complete;
    audio.removeEventListener('ended', stopRecording);
    window.clearTimeout(timerId);
    if (blob.size === 0) {
      throw new Error('The browser recorded an empty video. Try reloading the page and exporting again.');
    }
    return blob;
  };

  const resetPlayback = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaybackTime(0);
    setIsPreviewing(false);
    stopDrawLoop();
    drawFrame(0);
  };

  const ensureReady = (): boolean => {
    if (!uploadedAudio) return false;
    if (!lines.length) {
      toast({
        title: 'No lyrics yet',
        description: 'Transcribe or paste lyrics first.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const exportVideo = async () => {
    if (!ensureReady()) return;
    setIsExporting(true);
    setRenderStatus('Recording video in real time: 0%');
    try {
      const webmBlob = await recordToWebm((progress) => {
        setRenderStatus(`Recording video in real time: ${progress}%`);
      });
      setRenderStatus('Converting to MP4...');
      const form = new FormData();
      form.append('video', webmBlob, 'lyric-video.webm');
      const response = await fetch('/api/lyric-video/transcode', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: form,
        credentials: 'include',
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, `MP4 export failed (${response.status})`);
        throw new Error(message);
      }
      const mp4Blob = await response.blob();
      if (mp4Blob.size === 0) throw new Error('The MP4 export came back empty.');

      setRenderStatus('Starting download...');
      const url = URL.createObjectURL(mp4Blob);
      const filename = `${sanitizeDownloadName(uploadedAudio?.name ?? 'lyric')}-lyrics-video.mp4`;
      
      if (lastExport) URL.revokeObjectURL(lastExport.url);
      setLastExport({ url, filename });
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({ title: 'Video exported', description: 'MP4 ready to share.' });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Could not render the video.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setRenderStatus('');
      resetPlayback();
    }
  };

  const shareToFeed = async () => {
    if (!ensureReady()) return;
    setIsSharing(true);
    setRenderStatus('Recording video in real time: 0%');
    try {
      const webmBlob = await recordToWebm((progress) => {
        setRenderStatus(`Recording video in real time: ${progress}%`);
      });
      setRenderStatus('Uploading video...');
      const form = new FormData();
      form.append('video', webmBlob, 'lyric-video.webm');
      form.append('caption', lyricsText.split('\n')[0]?.slice(0, 120) ?? '');
      const response = await fetch('/api/lyric-video/share', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: form,
        credentials: 'include',
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, `Share failed (${response.status})`);
        throw new Error(message);
      }
      toast({ title: 'Shared to feed', description: 'Your lyric video is live in the Social Hub.' });
    } catch (error) {
      toast({
        title: 'Share failed',
        description: error instanceof Error ? error.message : 'Could not share the video.',
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
      setRenderStatus('');
      resetPlayback();
    }
  };

  const canPreview = Boolean(uploadedAudio);
  const canSync = Boolean(uploadedAudio) && !isTranscribing;
  const wordCount = timedWords.length || lyricsText.split(/\s+/).filter(Boolean).length;

  return (
    <section className="overflow-hidden rounded-md border border-cyan-500/25 bg-card text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Subtitles className="h-4 w-4 text-cyan-300" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Lyric Video
        </h2>
        <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
          {Math.round(tempo)} BPM
        </Badge>
        <Badge variant="outline" className="border-slate-600 text-slate-300">
          {lines.length} lines
        </Badge>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Video className="h-3.5 w-3.5" />
          WebM
        </div>
      </div>

      <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-md border border-border bg-black relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="aspect-video w-full bg-black"
              role="img"
              aria-label={`Lyric video preview showing: ${
                lines.find(l => {
                  const opts = {
                    offsetSec: offsetMs / 1000,
                    bpm: tempo,
                    snapToBeat,
                    speed: speedPct / 100
                  };
                  const res = resolveLyricLineTiming(l, opts);
                  return (playbackTime >= res.displayStart && playbackTime < res.displayEnd);
                })?.text || 'No active lyrics'
              }`}
            />
            {renderError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center">
                <div className="text-red-400 space-y-2">
                  <p className="font-semibold">Canvas Rendering Error</p>
                  <p className="text-xs font-mono">{renderError}</p>
                </div>
              </div>
            )}
          </div>

          <audio
            ref={audioRef}
            src={uploadedAudio?.url}
            preload="metadata"
            className="hidden"
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime || 0)}
            onPlay={() => {
              setIsPreviewing(true);
              startDrawLoop();
            }}
            onPause={() => {
              setIsPreviewing(false);
              stopDrawLoop();
              drawFrame();
            }}
            onEnded={() => {
              setIsPreviewing(false);
              stopDrawLoop();
              drawFrame();
            }}
            onSeeked={() => drawFrame()}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={isPreviewing ? pausePreview : startPreview}
              disabled={!canPreview || isExporting}
            >
              {isPreviewing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPreviewing ? 'Pause' : 'Play'}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={resetPreview}
              disabled={!canPreview || isExporting}
              title="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 bg-cyan-600 text-white hover:bg-cyan-500"
              onClick={exportVideo}
              disabled={!canPreview || !lines.length || isExporting || isSharing}
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting' : 'Export'}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 bg-purple-600 text-white hover:bg-purple-500"
              onClick={shareToFeed}
              disabled={!canPreview || !lines.length || isExporting || isSharing}
              title="Post this lyric video to the Social Hub feed"
            >
              <Share2 className="h-4 w-4" />
              {isSharing ? 'Sharing' : 'Share to Feed'}
            </Button>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {formatTime(playbackTime)} / {formatTime(duration)}
            </span>
          </div>
          {(renderStatus || lastExport) && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100">
              {renderStatus && <span>{renderStatus}</span>}
              {lastExport && !renderStatus && (
                <a
                  href={lastExport.url}
                  download={lastExport.filename}
                  className="inline-flex items-center gap-2 font-semibold text-cyan-200 underline-offset-4 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download MP4
                </a>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <SimpleFileUploader
              accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,.opus"
              maxFileSize={100 * 1024 * 1024}
              onGetUploadParameters={getUploadParameters}
              onComplete={handleUploadComplete}
              buttonClassName="w-full gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload
            </SimpleFileUploader>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={transcribeForSync}
              disabled={!canSync}
            >
              <FileText className={cn('h-4 w-4', isTranscribing && 'animate-pulse')} />
              {isTranscribing ? 'Syncing' : 'Sync'}
            </Button>
          </div>

          <div className="rounded-md border border-border bg-background/55 p-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Timing
              </Label>
              <span className="ml-auto text-xs text-muted-foreground">{wordCount} words</span>
            </div>

            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="lyric-offset" className="text-xs text-muted-foreground">
                    Sync
                  </Label>
                  <Input
                    id="lyric-offset"
                    type="number"
                    value={offsetMs}
                    onChange={(event) => setOffsetMs(Number(event.target.value) || 0)}
                    className="h-8 w-24 bg-background text-right font-mono text-xs"
                  />
                </div>
                <Slider
                  value={[offsetMs]}
                  min={MIN_OFFSET_MS}
                  max={MAX_OFFSET_MS}
                  step={25}
                  onValueChange={(value) => setOffsetMs(value[0] ?? 0)}
                />
                <p className="text-[10px] text-muted-foreground">
                  − earlier · + later — drag negative if lyrics lag your vocal
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="lyric-speed" className="text-xs text-muted-foreground">
                    Speed
                  </Label>
                  <Input
                    id="lyric-speed"
                    type="number"
                    value={speedPct}
                    onChange={(event) => setSpeedPct(Math.max(MIN_SPEED_PCT, Math.min(MAX_SPEED_PCT, Number(event.target.value) || 100)))}
                    className="h-8 w-24 bg-background text-right font-mono text-xs"
                  />
                </div>
                <Slider
                  value={[speedPct]}
                  min={MIN_SPEED_PCT}
                  max={MAX_SPEED_PCT}
                  step={1}
                  onValueChange={(value) => setSpeedPct(value[0] ?? 100)}
                />
                <p className="text-[10px] text-muted-foreground">
                  stretch/compress so the END lines up too (fixes drift over the song)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="words-per-line" className="text-xs text-muted-foreground">
                    Words
                  </Label>
                  <Input
                    id="words-per-line"
                    type="number"
                    min={1}
                    max={MAX_WORDS_PER_LINE}
                    value={wordsPerLine}
                    onChange={(event) => setWordsPerLine(Math.max(1, Math.min(MAX_WORDS_PER_LINE, Number(event.target.value) || 1)))}
                    className="h-8 bg-background text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="font-size" className="text-xs text-muted-foreground">
                    Size
                  </Label>
                  <Input
                    id="font-size"
                    type="number"
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    value={fontSize}
                    onChange={(event) => setFontSize(Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Number(event.target.value) || 82)))}
                    className="h-8 bg-background text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground" id="reveal-mode-label">Reveal</Label>
                <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-labelledby="reveal-mode-label">
                  {([
                    ['line', 'Line'],
                    ['build', 'Build'],
                    ['word', 'One word'],
                  ] as const).map(([mode, label]) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant="outline"
                      role="radio"
                      aria-checked={revealMode === mode}
                      onClick={() => setRevealMode(mode)}
                      className={cn(
                        'h-8 px-1 text-[11px]',
                        revealMode === mode && 'border-cyan-500 bg-cyan-600 text-white hover:bg-cyan-500',
                      )}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground" id="font-family-label">Font</Label>
                <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-labelledby="font-family-label">
                  {(['Inter', 'Impact', 'Serif', 'Mono'] as const).map((key) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant="outline"
                      role="radio"
                      aria-checked={fontKey === key}
                      onClick={() => setFontKey(key)}
                      className={cn(
                        'h-8 px-1 text-[11px]',
                        fontKey === key && 'border-cyan-500 bg-cyan-600 text-white hover:bg-cyan-500',
                      )}
                    >
                      {key}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground" id="anim-style-label">Animation</Label>
                <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-labelledby="anim-style-label">
                  {([
                    ['none', 'None'],
                    ['fade', 'Fade'],
                    ['pop', 'Pop'],
                    ['slide', 'Slide'],
                  ] as const).map(([mode, label]) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant="outline"
                      role="radio"
                      aria-checked={animStyle === mode}
                      onClick={() => setAnimStyle(mode)}
                      className={cn(
                        'h-8 px-1 text-[11px]',
                        animStyle === mode && 'border-cyan-500 bg-cyan-600 text-white hover:bg-cyan-500',
                      )}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={showNextLine}
                  onCheckedChange={(checked) => setShowNextLine(checked === true)}
                />
                Show next line
              </label>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={snapToBeat}
                  onCheckedChange={(checked) => setSnapToBeat(checked === true)}
                />
                Snap lines to beat
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="lyric-video-transcript" className="text-xs text-muted-foreground">
              Transcript
            </Label>
            <Textarea
              id="lyric-video-transcript"
              value={lyricsText}
              onChange={(event) => setLyricsText(event.target.value)}
              className="min-h-[150px] resize-none bg-background text-xs"
              placeholder="Synced lyrics appear here."
            />
          </div>

          {uploadedAudio && (
            <div className="truncate rounded-md border border-border bg-background/60 px-2 py-2 text-xs text-muted-foreground">
              {uploadedAudio.name}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
