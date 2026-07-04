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
  findActiveLyricLine,
  findNextLyricLine,
  resolveLyricLineTiming,
  type LyricVideoLine,
  type ResolvedLyricVideoLine,
  type TimedLyricWord,
} from '@/lib/lyricVideoTiming';
import { useStudioStore } from '@/stores/useStudioStore';
import { cn } from '@/lib/utils';

interface UploadedAudio {
  url: string;
  name: string;
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

function drawWordRow(
  ctx: CanvasRenderingContext2D,
  tokens: Array<{ text: string; active: boolean }>,
  y: number,
  fontSize: number,
  maxWidth: number,
) {
  ctx.font = `800 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const spaceWidth = ctx.measureText(' ').width;
  const tokenWidths = tokens.map((token) => ctx.measureText(token.text).width);
  const totalWidth = tokenWidths.reduce((sum, width) => sum + width, 0) + spaceWidth * Math.max(0, tokens.length - 1);
  let x = (CANVAS_WIDTH - Math.min(totalWidth, maxWidth)) / 2;

  tokens.forEach((token, index) => {
    ctx.fillStyle = token.active ? '#22d3ee' : '#f8fafc';
    ctx.fillText(token.text, x, y);
    x += tokenWidths[index] + spaceWidth;
  });
}

function drawWrappedWords(
  ctx: CanvasRenderingContext2D,
  words: Array<{ text: string; active: boolean }>,
  centerY: number,
  requestedFontSize: number,
) {
  const maxWidth = CANVAS_WIDTH * 0.84;
  let fontSize = requestedFontSize;
  let rows: Array<Array<{ text: string; active: boolean }>> = [];

  while (fontSize >= 34) {
    ctx.font = `800 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
    rows = [];
    let currentRow: Array<{ text: string; active: boolean }> = [];
    let currentWidth = 0;
    const spaceWidth = ctx.measureText(' ').width;

    words.forEach((word) => {
      const wordWidth = ctx.measureText(word.text).width;
      const nextWidth = currentRow.length === 0 ? wordWidth : currentWidth + spaceWidth + wordWidth;
      if (currentRow.length > 0 && nextWidth > maxWidth) {
        rows.push(currentRow);
        currentRow = [word];
        currentWidth = wordWidth;
      } else {
        currentRow.push(word);
        currentWidth = nextWidth;
      }
    });

    if (currentRow.length > 0) rows.push(currentRow);
    const widestRow = rows.reduce((widest, row) => {
      const rowWidth = row.reduce((sum, word, index) => {
        return sum + ctx.measureText(word.text).width + (index === 0 ? 0 : spaceWidth);
      }, 0);
      return Math.max(widest, rowWidth);
    }, 0);
    if (rows.length <= 2 && widestRow <= maxWidth) break;
    fontSize -= 4;
  }

  const lineHeight = fontSize * 1.24;
  const firstY = centerY - ((rows.length - 1) * lineHeight) / 2;
  rows.forEach((row, index) => {
    drawWordRow(ctx, row, firstY + index * lineHeight, fontSize, maxWidth);
  });
}

function renderLyricFrame({
  canvas,
  lines,
  currentTime,
  offsetSec,
  bpm,
  snapToBeat,
  fontSize,
  revealMode,
  showNextLine,
}: {
  canvas: HTMLCanvasElement;
  lines: LyricVideoLine[];
  currentTime: number;
  offsetSec: number;
  bpm: number;
  snapToBeat: boolean;
  fontSize: number;
  revealMode: 'line' | 'build' | 'word';
  showNextLine: boolean;
}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const timingOptions = { offsetSec, bpm, snapToBeat };
  const activeLine = findActiveLyricLine(lines, currentTime, timingOptions);
  const nextLine = findNextLyricLine(lines, currentTime, timingOptions);
  const displayLine = activeLine ?? nextLine;

  if (!displayLine) {
    ctx.fillStyle = '#64748b';
    ctx.font = '700 54px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LYRICS READY', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.textAlign = 'left';
    return;
  }

  const resolved = activeLine ?? resolveLyricLineTiming(displayLine, timingOptions);
  const wordShift = offsetSec + resolved.timingShift;
  ctx.textBaseline = 'middle';

  // One-word flash: only the current word, large & centered. Ignores line layout.
  if (revealMode === 'word' && displayLine.words.length > 0) {
    let current: { text: string; start: number } | null = null;
    for (const word of displayLine.words) {
      const start = word.start + wordShift;
      if (currentTime >= start) current = { text: word.text, start };
      else break;
    }
    if (current) drawFlashWord(ctx, current.text, currentTime - current.start, fontSize);
    drawBeatPulse(ctx, currentTime, bpm);
    return;
  }

  let words = buildCanvasWords(displayLine, currentTime, wordShift);
  // Build-up: reveal words one at a time as they're sung (nothing to read ahead).
  if (revealMode === 'build') {
    words = words.filter((word) => word.started);
  }

  ctx.shadowColor = 'rgba(34, 211, 238, 0.28)';
  ctx.shadowBlur = activeLine ? 20 : 0;
  drawWrappedWords(ctx, words, CANVAS_HEIGHT / 2, fontSize);
  ctx.shadowBlur = 0;

  if (showNextLine && activeLine && nextLine && nextLine.id !== activeLine.id) {
    ctx.globalAlpha = 0.42;
    ctx.font = `700 ${Math.max(26, Math.round(fontSize * 0.42))}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(nextLine.text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + fontSize * 1.45);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  drawBeatPulse(ctx, currentTime, bpm);
}

function buildCanvasWords(line: ResolvedLyricVideoLine, currentTime: number, wordShift: number) {
  if (line.words.length === 0) {
    // No per-word timing: show the whole line, nothing to reveal progressively.
    return line.text.split(/\s+/).filter(Boolean).map((text) => ({ text, active: false, started: true }));
  }

  return line.words.map((word) => {
    const start = word.start + wordShift;
    const end = word.end + wordShift;
    return {
      text: word.text,
      active: currentTime >= start && currentTime < end,
      started: currentTime >= start,
    };
  });
}

// One-word flash mode: a single large word, popping in over ~90ms.
function drawFlashWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  timeSinceStart: number,
  baseFontSize: number,
) {
  const pop = Math.min(1, Math.max(0, timeSinceStart / 0.09));
  const size = Math.min(170, baseFontSize * 1.7) * (0.82 + 0.18 * pop);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.65 * pop;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = 'rgba(34, 211, 238, 0.55)';
  ctx.shadowBlur = 34;
  ctx.fillText(text.toUpperCase(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.restore();
}

function drawBeatPulse(ctx: CanvasRenderingContext2D, currentTime: number, bpm: number) {
  const beatLength = 60 / Math.max(1, bpm);
  const beatNumber = Math.floor(currentTime / beatLength) % 4;
  const x = CANVAS_WIDTH / 2 - 54;
  const y = CANVAS_HEIGHT - 82;

  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = i === beatNumber ? '#22d3ee' : '#1e293b';
    ctx.arc(x + i * 36, y, i === beatNumber ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function LyricVideoMaker() {
  const { tempo } = useTransport();
  const { toast } = useToast();
  const studioSession = useStudioSession();
  const setCurrentLyrics = useStudioStore((state) => state.setCurrentLyrics);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<UploadedAudio | null>(null);
  const [lyricsText, setLyricsText] = useState('');
  const [timedWords, setTimedWords] = useState<TimedLyricWord[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [offsetMs, setOffsetMs] = useState(0);
  // Snap defaults OFF: beat-snapping rounds each line's start to the grid, which
  // shifts every word's highlight later and makes lyrics lag the vocal.
  const [snapToBeat, setSnapToBeat] = useState(false);
  const [wordsPerLine, setWordsPerLine] = useState(6);
  const [fontSize, setFontSize] = useState(82);
  const [showNextLine, setShowNextLine] = useState(false);
  const [revealMode, setRevealMode] = useState<'line' | 'build' | 'word'>('line');

  const lines = useMemo(
    () => buildLyricVideoLines({
      words: timedWords,
      transcript: lyricsText,
      wordsPerLine,
      bpm: tempo,
    }),
    [lyricsText, tempo, timedWords, wordsPerLine],
  );

  const drawFrame = useCallback((currentTime?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderLyricFrame({
      canvas,
      lines,
      currentTime: currentTime ?? audioRef.current?.currentTime ?? 0,
      offsetSec: offsetMs / 1000,
      bpm: tempo,
      snapToBeat,
      fontSize,
      revealMode,
      showNextLine,
    });
  }, [fontSize, lines, offsetMs, snapToBeat, tempo, revealMode, showNextLine]);

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

  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  useEffect(() => () => stopDrawLoop(), [stopDrawLoop]);

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
    setUploadedAudio({ url: result.url, name: result.name });
    setLyricsText('');
    setTimedWords([]);
    setDuration(0);
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
    setIsPreviewing(false);
    stopDrawLoop();
    drawFrame(0);
  };

  // Record the canvas + audio to a WebM blob. Browsers can only record WebM
  // reliably; the server transcodes it to MP4. Shared by export and share.
  const recordToWebm = async (): Promise<Blob> => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) throw new Error('Player not ready');

    const mimeType = getBestVideoMimeType();
    if (!mimeType) throw new Error('This browser cannot record video.');

    pausePreview();
    audio.currentTime = 0;
    drawFrame(0);

    const videoStream = canvas.captureStream(EXPORT_FPS);
    const audioStream = getMediaElementCaptureStream(audio);
    const stream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(audioStream?.getAudioTracks() ?? []),
    ]);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const complete = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    const loop = () => {
      drawFrame(audio.currentTime);
      if (recorder.state === 'recording' && !audio.ended) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    recorder.start(250);
    await audio.play();
    loop();

    const stopRecording = () => {
      if (recorder.state === 'recording') recorder.stop();
    };
    audio.addEventListener('ended', stopRecording, { once: true });
    window.setTimeout(stopRecording, Math.ceil((audio.duration || duration || 0) * 1000) + 750);

    const blob = await complete;
    audio.removeEventListener('ended', stopRecording);
    return blob;
  };

  const resetPlayback = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPreviewing(false);
    stopDrawLoop();
    drawFrame(0);
  };

  // Shared precheck: need audio + lyrics before recording anything.
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
    try {
      const webmBlob = await recordToWebm();
      const form = new FormData();
      form.append('video', webmBlob, 'lyric-video.webm');
      const response = await fetch('/api/lyric-video/transcode', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`MP4 export failed (${response.status})`);
      const mp4Blob = await response.blob();

      const url = URL.createObjectURL(mp4Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeDownloadName(uploadedAudio?.name ?? 'lyric')}-lyrics-video.mp4`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);

      toast({ title: 'Video exported', description: 'MP4 ready to share.' });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Could not render the video.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      resetPlayback();
    }
  };

  const shareToFeed = async () => {
    if (!ensureReady()) return;
    setIsSharing(true);
    try {
      const webmBlob = await recordToWebm();
      const form = new FormData();
      form.append('video', webmBlob, 'lyric-video.webm');
      form.append('caption', lyricsText.split('\n')[0]?.slice(0, 120) ?? '');
      const response = await fetch('/api/lyric-video/share', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Share failed (${response.status})`);
      toast({ title: 'Shared to feed', description: 'Your lyric video is live in the Social Hub.' });
    } catch (error) {
      toast({
        title: 'Share failed',
        description: error instanceof Error ? error.message : 'Could not share the video.',
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
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
          <div className="overflow-hidden rounded-md border border-border bg-black">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="aspect-video w-full bg-black"
            />
          </div>

          <audio
            ref={audioRef}
            src={uploadedAudio?.url}
            controls
            preload="metadata"
            className="h-9 w-full"
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
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
              {formatTime(audioRef.current?.currentTime || 0)} / {formatTime(duration)}
            </span>
          </div>
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
                  min={-2000}
                  max={2000}
                  step={25}
                  onValueChange={(value) => setOffsetMs(value[0] ?? 0)}
                />
                <p className="text-[10px] text-muted-foreground">
                  − earlier · + later — drag negative if lyrics lag your vocal
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
                    max={12}
                    value={wordsPerLine}
                    onChange={(event) => setWordsPerLine(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
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
                    min={40}
                    max={120}
                    value={fontSize}
                    onChange={(event) => setFontSize(Math.max(40, Math.min(120, Number(event.target.value) || 82)))}
                    className="h-8 bg-background text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Reveal</Label>
                <div className="grid grid-cols-3 gap-1">
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

              <label className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={showNextLine}
                  onCheckedChange={(checked) => setShowNextLine(checked === true)}
                />
                Show next line
              </label>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-2 text-xs text-muted-foreground">
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
