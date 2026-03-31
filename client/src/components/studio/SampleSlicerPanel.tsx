import { useState, useCallback, useRef, useEffect } from 'react';
import { Scissors, Grid3X3, Music, Waves, Plus, Trash2, Download, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  loadSampleForSlicing,
  sliceEqual,
  sliceByTransients,
  sliceByBeats,
  addManualSlice,
  removeSlice,
  playSlice,
  exportSlicesAsWav,
  type SlicedSample,
  type SliceMarker,
} from '@/lib/sampleSlicer';

interface SampleSlicerPanelProps {
  audioUrl?: string;
  audioName?: string;
  bpm?: number;
  onSlicesReady?: (slices: SliceMarker[]) => void;
}

export default function SampleSlicerPanel({
  audioUrl,
  audioName,
  bpm = 120,
  onSlicesReady,
}: SampleSlicerPanelProps) {
  const { toast } = useToast();
  const [sample, setSample] = useState<SlicedSample | null>(null);
  const [loading, setLoading] = useState(false);
  const [sliceMethod, setSliceMethod] = useState<'equal' | 'transient' | 'beat'>('transient');
  const [numSlices, setNumSlices] = useState(16);
  const [sensitivity, setSensitivity] = useState(0.3);
  const [beatDivision, setBeatDivision] = useState(4);
  const [playingSlice, setPlayingSlice] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const handleLoad = useCallback(async (source: string | File | Blob, name: string) => {
    setLoading(true);
    try {
      const loaded = await loadSampleForSlicing(source, name);
      setSample(loaded);
      toast({ title: 'Sample Loaded', description: `${loaded.duration.toFixed(1)}s` });
    } catch (err) {
      toast({ title: 'Load Failed', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (audioUrl && audioName) {
      handleLoad(audioUrl, audioName);
    }
  }, [audioUrl, audioName, handleLoad]);

  const handleSlice = useCallback(() => {
    if (!sample) return;
    let result: SlicedSample;
    switch (sliceMethod) {
      case 'equal':
        result = sliceEqual(sample, numSlices);
        break;
      case 'transient':
        result = sliceByTransients(sample, sensitivity);
        break;
      case 'beat':
        result = sliceByBeats(sample, bpm, beatDivision);
        break;
      default:
        return;
    }
    setSample(result);
    onSlicesReady?.(result.slices);
    toast({ title: 'Sliced', description: `${result.slices.length} slices created` });
  }, [sample, sliceMethod, numSlices, sensitivity, bpm, beatDivision, onSlicesReady, toast]);

  const handleAddManualSlice = useCallback((timeSec: number) => {
    if (!sample) return;
    const result = addManualSlice(sample, timeSec);
    setSample(result);
    onSlicesReady?.(result.slices);
  }, [sample, onSlicesReady]);

  const handleRemoveSlice = useCallback((sliceId: string) => {
    if (!sample) return;
    const result = removeSlice(sample, sliceId);
    setSample(result);
    onSlicesReady?.(result.slices);
  }, [sample, onSlicesReady]);

  const handlePlaySlice = useCallback((sliceId: string) => {
    if (!sample) return;
    const ctx = getAudioCtx();
    const source = playSlice(ctx, sample, sliceId);
    if (source) {
      setPlayingSlice(sliceId);
      source.onended = () => setPlayingSlice(null);
    }
  }, [sample, getAudioCtx]);

  const handleExport = useCallback(async () => {
    if (!sample) return;
    try {
      const files = await exportSlicesAsWav(sample);
      for (const file of files) {
        const url = URL.createObjectURL(file.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast({ title: 'Exported', description: `${files.length} WAV files downloaded` });
    } catch (err) {
      toast({ title: 'Export Failed', description: String(err), variant: 'destructive' });
    }
  }, [sample, toast]);

  const handleFileUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await handleLoad(file, file.name);
    };
    input.click();
  }, [handleLoad]);

  // Draw waveform with slice markers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sample?.audioBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = 120;
    ctx.clearRect(0, 0, width, height);

    const data = sample.audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);

    // Draw waveform
    ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
    for (let i = 0; i < width; i++) {
      let min = 1;
      let max = -1;
      for (let j = 0; j < step; j++) {
        const val = data[i * step + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const yMin = ((1 + min) / 2) * height;
      const yMax = ((1 + max) / 2) * height;
      ctx.fillRect(i, yMin, 1, yMax - yMin || 1);
    }

    // Draw slice markers
    for (const slice of sample.slices) {
      const x = (slice.startSample / data.length) * width;
      ctx.strokeStyle = slice.id === playingSlice ? '#22c55e' : '#f59e0b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Slice label
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${slice.padIndex + 1}`, x + 4, 16);
    }
  }, [sample, playingSlice]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sample?.audioBuffer || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const timeSec = x * sample.duration;
    handleAddManualSlice(timeSec);
  }, [sample, handleAddManualSlice]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Scissors className="w-4 h-4 text-amber-400" />
          Sample Slicer
        </h3>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={handleFileUpload} className="text-xs h-7 gap-1">
            <Plus className="w-3 h-3" /> Load
          </Button>
          {sample && (
            <Button size="sm" variant="outline" onClick={handleExport} className="text-xs h-7 gap-1">
              <Download className="w-3 h-3" /> Export
            </Button>
          )}
        </div>
      </div>

      {!sample && !loading && (
        <div className="text-center py-8 text-zinc-500 text-sm">
          Load an audio file to start slicing
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-zinc-400 text-sm animate-pulse">Loading audio...</div>
      )}

      {sample && (
        <>
          {/* Waveform with markers */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full h-[60px] bg-zinc-800 rounded cursor-crosshair"
              onClick={handleCanvasClick}
              title="Click to add manual slice marker"
            />
            <div className="absolute top-1 right-1 text-[9px] text-zinc-500 bg-zinc-900/80 px-1 rounded">
              {sample.sourceName} - {sample.duration.toFixed(1)}s
            </div>
          </div>

          {/* Slice method controls */}
          <div className="flex items-center gap-2">
            <Select value={sliceMethod} onValueChange={(v: 'equal' | 'transient' | 'beat') => setSliceMethod(v)}>
              <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-600 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-600">
                <SelectItem value="transient" className="text-xs">
                  <span className="flex items-center gap-1"><Waves className="w-3 h-3" /> Transients</span>
                </SelectItem>
                <SelectItem value="equal" className="text-xs">
                  <span className="flex items-center gap-1"><Grid3X3 className="w-3 h-3" /> Equal</span>
                </SelectItem>
                <SelectItem value="beat" className="text-xs">
                  <span className="flex items-center gap-1"><Music className="w-3 h-3" /> Beats</span>
                </SelectItem>
              </SelectContent>
            </Select>

            {sliceMethod === 'equal' && (
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-zinc-500">Slices:</span>
                <Slider
                  value={[numSlices]}
                  min={2}
                  max={64}
                  step={1}
                  onValueChange={([v]) => setNumSlices(v)}
                  className="flex-1 h-4"
                />
                <span className="text-xs text-zinc-400 w-6 text-right">{numSlices}</span>
              </div>
            )}

            {sliceMethod === 'transient' && (
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-zinc-500">Sensitivity:</span>
                <Slider
                  value={[sensitivity]}
                  min={0.05}
                  max={0.8}
                  step={0.01}
                  onValueChange={([v]) => setSensitivity(v)}
                  className="flex-1 h-4"
                />
                <span className="text-xs text-zinc-400 w-8 text-right">{(sensitivity * 100).toFixed(0)}%</span>
              </div>
            )}

            {sliceMethod === 'beat' && (
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-zinc-500">Division:</span>
                <Select value={String(beatDivision)} onValueChange={(v) => setBeatDivision(Number(v))}>
                  <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-600 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-600">
                    <SelectItem value="1" className="text-xs">1/4</SelectItem>
                    <SelectItem value="2" className="text-xs">1/8</SelectItem>
                    <SelectItem value="4" className="text-xs">1/16</SelectItem>
                    <SelectItem value="8" className="text-xs">1/32</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button size="sm" onClick={handleSlice} className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7">
              Slice
            </Button>
          </div>

          {/* Pad grid (4x4) */}
          {sample.slices.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: Math.min(16, sample.slices.length) }, (_, i) => {
                const slice = sample.slices[i];
                if (!slice) return null;
                const isPlaying = playingSlice === slice.id;
                return (
                  <button
                    key={slice.id}
                    onClick={() => handlePlaySlice(slice.id)}
                    className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      isPlaying
                        ? 'bg-green-500/20 border-green-500/50 scale-95'
                        : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 active:scale-95'
                    }`}
                  >
                    <span className="text-xs font-bold text-white">{i + 1}</span>
                    <span className="text-[8px] text-zinc-500 truncate w-full text-center">{slice.name}</span>
                    <span className="text-[8px] text-zinc-600">
                      {((slice.endTime - slice.startTime) * 1000).toFixed(0)}ms
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveSlice(slice.id); }}
                      className="absolute top-0.5 right-0.5 p-0.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          )}

          {sample.slices.length > 16 && (
            <span className="text-[10px] text-zinc-500 text-center">
              +{sample.slices.length - 16} more slices (showing first 16 pads)
            </span>
          )}
        </>
      )}
    </div>
  );
}
