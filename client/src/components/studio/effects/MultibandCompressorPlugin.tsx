import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BarChart3, RotateCcw, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PresetBrowser from './PresetBrowser';
import {
  MultibandCompressor,
  DEFAULT_MULTIBAND_CONFIG,
  type MultibandConfig,
  type BandCompressorConfig,
} from '@/lib/multibandCompressor';

interface Props { audioUrl?: string; onClose?: () => void; }
type BandKey = 'low' | 'mid' | 'high';

const COLORS: Record<BandKey, string> = {
  low: 'border-red-500/30 bg-red-500/5',
  mid: 'border-yellow-500/30 bg-yellow-500/5',
  high: 'border-cyan-500/30 bg-cyan-500/5',
};

export function MultibandCompressorPlugin({ audioUrl, onClose }: Props) {
  const { toast } = useToast();
  const compRef = useRef<MultibandCompressor | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [config, setConfig] = useState<MultibandConfig>({ ...DEFAULT_MULTIBAND_CONFIG });
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ''; };
  }, [audioUrl]);

  const ensureNodes = () => {
    if (compRef.current) return;
    const ctx = new AudioContext();
    compRef.current = new MultibandCompressor(ctx, config);
    if (audioRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(compRef.current.input);
      compRef.current.output.connect(ctx.destination);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    ensureNodes();
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  };

  const updateBand = (band: BandKey, key: keyof BandCompressorConfig, value: number | boolean) => {
    const next = { ...config, [band]: { ...config[band], [key]: value } };
    setConfig(next);
    compRef.current?.updateBand(band, { [key]: value });
  };

  const updateCrossover = (key: 'lowCrossover' | 'highCrossover', value: number) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    if (key === 'lowCrossover') compRef.current?.setCrossovers(value, undefined);
    else compRef.current?.setCrossovers(undefined, value);
  };

  const updateOutputGain = (value: number) => {
    const next = { ...config, outputGainDb: value };
    setConfig(next);
    compRef.current?.setOutputGain(value);
  };

  const resetAll = () => {
    const fresh = { ...DEFAULT_MULTIBAND_CONFIG };
    setConfig(fresh);
    if (compRef.current) {
      for (const band of ['low', 'mid', 'high'] as BandKey[]) {
        compRef.current.updateBand(band, fresh[band]);
      }
      compRef.current.setCrossovers(fresh.lowCrossover, fresh.highCrossover);
      compRef.current.setOutputGain(fresh.outputGainDb);
    }
  };

  const handleLoadPreset = (params: Record<string, number>) => {
    const next = { ...config };
    for (const band of ['low', 'mid', 'high'] as BandKey[]) {
      for (const k of ['threshold', 'ratio', 'attack', 'release', 'knee', 'makeupGain'] as const) {
        const pk = `${band}_${k}`;
        if (params[pk] !== undefined) (next[band] as any)[k] = params[pk];
      }
    }
    if (params.lowCrossover !== undefined) next.lowCrossover = params.lowCrossover;
    if (params.highCrossover !== undefined) next.highCrossover = params.highCrossover;
    if (params.outputGainDb !== undefined) next.outputGainDb = params.outputGainDb;
    setConfig(next);
    if (compRef.current) {
      for (const band of ['low', 'mid', 'high'] as BandKey[]) {
        compRef.current.updateBand(band, next[band]);
      }
      compRef.current.setCrossovers(next.lowCrossover, next.highCrossover);
      compRef.current.setOutputGain(next.outputGainDb);
    }
  };

  const currentParams = (): Record<string, number> => {
    const p: Record<string, number> = { lowCrossover: config.lowCrossover, highCrossover: config.highCrossover, outputGainDb: config.outputGainDb };
    for (const band of ['low', 'mid', 'high'] as BandKey[]) {
      for (const k of ['threshold', 'ratio', 'attack', 'release', 'knee', 'makeupGain'] as const) {
        p[`${band}_${k}`] = config[band][k];
      }
    }
    return p;
  };

  const renderBand = (band: BandKey) => {
    const b = config[band];
    return (
      <div key={band} className={`rounded-xl border p-4 space-y-3 ${COLORS[band]}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest">{band}</span>
          <div className="flex items-center gap-2">
            <Label className="text-[10px]">Solo</Label>
            <Switch checked={b.solo} onCheckedChange={v => updateBand(band, 'solo', v)} className="scale-75" />
            <Label className="text-[10px]">Mute</Label>
            <Switch checked={b.mute} onCheckedChange={v => updateBand(band, 'mute', v)} className="scale-75" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs">Threshold: {b.threshold.toFixed(1)} dB</label>
          <Slider value={[b.threshold]} min={-60} max={0} step={0.5} onValueChange={([v]) => updateBand(band, 'threshold', v)} />
        </div>
        <div className="space-y-2">
          <label className="text-xs">Ratio: {b.ratio.toFixed(1)}:1</label>
          <Slider value={[b.ratio]} min={1} max={20} step={0.1} onValueChange={([v]) => updateBand(band, 'ratio', v)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px]">Attack: {(b.attack * 1000).toFixed(1)}ms</label>
            <Slider value={[b.attack]} min={0.001} max={0.1} step={0.001} onValueChange={([v]) => updateBand(band, 'attack', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px]">Release: {(b.release * 1000).toFixed(0)}ms</label>
            <Slider value={[b.release]} min={0.01} max={1} step={0.01} onValueChange={([v]) => updateBand(band, 'release', v)} />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs">Makeup: {b.makeupGain.toFixed(1)} dB</label>
          <Slider value={[b.makeupGain]} min={-12} max={24} step={0.5} onValueChange={([v]) => updateBand(band, 'makeupGain', v)} />
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-red-600 via-yellow-600 to-cyan-600 rounded-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Multi-band Compressor</CardTitle>
              <p className="text-sm text-muted-foreground">3-band mastering dynamics</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">Web Audio</Badge>
            <Badge variant="outline">Mastering</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {audioUrl && (
          <div className="flex gap-2 flex-wrap">
            <Button onClick={togglePlay} className="flex-1">
              {isPlaying ? <><Pause className="h-4 w-4 mr-2" />Pause</> : <><Play className="h-4 w-4 mr-2" />Play</>}
            </Button>
            <Button onClick={resetAll} variant="outline"><RotateCcw className="h-4 w-4 mr-2" />Reset</Button>
            <PresetBrowser effectType="multiband" currentParams={currentParams()} onLoadPreset={handleLoadPreset} />
          </div>
        )}

        {/* Crossover Frequencies */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Low/Mid Crossover: {config.lowCrossover} Hz</label>
            <Slider value={[config.lowCrossover]} min={60} max={800} step={10} onValueChange={([v]) => updateCrossover('lowCrossover', v)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mid/High Crossover: {config.highCrossover} Hz</label>
            <Slider value={[config.highCrossover]} min={1000} max={12000} step={100} onValueChange={([v]) => updateCrossover('highCrossover', v)} />
          </div>
        </div>

        {/* Band Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['low', 'mid', 'high'] as BandKey[]).map(renderBand)}
        </div>

        {/* Output Gain */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Output Gain: {config.outputGainDb.toFixed(1)} dB</label>
          <Slider value={[config.outputGainDb]} min={-12} max={12} step={0.5} onValueChange={([v]) => updateOutputGain(v)} />
        </div>
      </CardContent>
    </Card>
  );
}
