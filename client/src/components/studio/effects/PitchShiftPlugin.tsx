/**
 * PitchShiftPlugin — Transpose audio clips by semitones without changing speed.
 * Uses offline OfflineAudioContext for high-quality pitch shifting.
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Music2, RotateCcw, Play, Pause, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PresetBrowser from './PresetBrowser';
import { pitchShiftOffline, createPitchShiftedSource } from '@/lib/pitchShift';

interface PitchShiftPluginProps {
  audioUrl?: string;
  onClose?: () => void;
  onProcessed?: (buffer: AudioBuffer) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function semitonesToNote(semitones: number): string {
  if (semitones === 0) return 'Original';
  const dir = semitones > 0 ? '↑' : '↓';
  const abs = Math.abs(semitones);
  const octaves = Math.floor(abs / 12);
  const remaining = abs % 12;
  const parts: string[] = [];
  if (octaves > 0) parts.push(`${octaves} oct`);
  if (remaining > 0) parts.push(`${remaining} st`);
  return `${dir} ${parts.join(' ')}`;
}

export function PitchShiftPlugin({ audioUrl, onClose, onProcessed }: PitchShiftPluginProps) {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const shiftedBufferRef = useRef<AudioBuffer | null>(null);

  const [semitones, setSemitones] = useState(0);
  const [fineTune, setFineTune] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formantPreserve, setFormantPreserve] = useState(false);

  useEffect(() => {
    if (!audioUrl) return;
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    fetch(audioUrl)
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buf => { originalBufferRef.current = buf; })
      .catch(() => toast({ title: 'Load Failed', variant: 'destructive' }));

    return () => {
      sourceRef.current?.stop();
      ctx.close();
    };
  }, [audioUrl]);

  const stopPlayback = () => {
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
    setIsPlaying(false);
  };

  const togglePlay = async () => {
    if (!audioContextRef.current || !originalBufferRef.current) return;
    const ctx = audioContextRef.current;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    // Use real-time detune for preview
    const totalCents = semitones * 100 + fineTune;
    const source = ctx.createBufferSource();
    source.buffer = originalBufferRef.current;
    source.detune.value = totalCents;
    source.connect(ctx.destination);
    source.onended = () => setIsPlaying(false);
    sourceRef.current = source;
    source.start(0);
    setIsPlaying(true);
  };

  const processOffline = async () => {
    if (!originalBufferRef.current) return;
    setIsProcessing(true);

    try {
      const totalSemitones = semitones + fineTune / 100;
      const result = await pitchShiftOffline(originalBufferRef.current, totalSemitones);
      shiftedBufferRef.current = result;
      onProcessed?.(result);
      toast({ title: 'Pitch Shifted', description: `Applied ${semitonesToNote(semitones)} shift` });
    } catch (err) {
      toast({ title: 'Processing Failed', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    stopPlayback();
    setSemitones(0);
    setFineTune(0);
    setFormantPreserve(false);
    shiftedBufferRef.current = null;
  };

  const handleLoadPreset = (params: Record<string, number>) => {
    if (params.semitones !== undefined) setSemitones(params.semitones);
    if (params.fineTune !== undefined) setFineTune(params.fineTune);
  };

  // Quick transpose buttons
  const quickShift = (st: number) => {
    setSemitones(prev => Math.max(-24, Math.min(24, prev + st)));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-600 rounded-lg">
              <Music2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Pitch Shift</CardTitle>
              <p className="text-sm text-muted-foreground">
                Transpose without changing speed
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">Offline</Badge>
            <Badge variant="outline">High Quality</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Playback Controls */}
        {audioUrl && (
          <div className="flex gap-2 flex-wrap">
            <Button onClick={togglePlay} className="flex-1">
              {isPlaying ? (
                <><Pause className="h-4 w-4 mr-2" />Pause</>
              ) : (
                <><Play className="h-4 w-4 mr-2" />Preview</>
              )}
            </Button>
            <Button onClick={processOffline} disabled={isProcessing} variant="default">
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : (
                'Apply'
              )}
            </Button>
            <Button onClick={reset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />Reset
            </Button>
            <PresetBrowser
              effectType="pitchshift"
              currentParams={{ semitones, fineTune }}
              onLoadPreset={handleLoadPreset}
            />
          </div>
        )}

        {/* Current Shift Display */}
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <div className="text-4xl font-bold tabular-nums">
              {semitones >= 0 ? '+' : ''}{semitones}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {semitonesToNote(semitones)}
            </div>
            {fineTune !== 0 && (
              <div className="text-xs text-muted-foreground">
                Fine: {fineTune >= 0 ? '+' : ''}{fineTune} cents
              </div>
            )}
          </div>
        </div>

        {/* Quick Transpose Buttons */}
        <div className="flex gap-2 justify-center flex-wrap">
          {[-12, -7, -5, -1, 1, 5, 7, 12].map(st => (
            <Button
              key={st}
              variant={st === semitones ? 'default' : 'outline'}
              size="sm"
              onClick={() => quickShift(st)}
              className="w-14"
            >
              {st > 0 ? `+${st}` : st}
            </Button>
          ))}
        </div>

        {/* Semitone Slider */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Semitones: {semitones >= 0 ? '+' : ''}{semitones}
          </label>
          <Slider
            value={[semitones]}
            min={-24}
            max={24}
            step={1}
            onValueChange={([v]) => setSemitones(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-24 (-2 oct)</span>
            <span>0</span>
            <span>+24 (+2 oct)</span>
          </div>
        </div>

        {/* Fine Tune */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Fine Tune: {fineTune >= 0 ? '+' : ''}{fineTune} cents
          </label>
          <Slider
            value={[fineTune]}
            min={-50}
            max={50}
            step={1}
            onValueChange={([v]) => setFineTune(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-50¢</span>
            <span>0¢</span>
            <span>+50¢</span>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <strong>Preview</strong> uses real-time detune (instant but lower quality).{' '}
          <strong>Apply</strong> renders offline with high-quality resampling.
        </div>
      </CardContent>
    </Card>
  );
}
