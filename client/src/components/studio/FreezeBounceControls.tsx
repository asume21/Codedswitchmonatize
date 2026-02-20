import { useState, useCallback, useEffect } from 'react';
import { Snowflake, Sun, FileAudio, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  freezeTrack,
  unfreezeTrack,
  isTrackFrozen,
  bounceTracks,
  bounceMaster,
  evaluateBounceParity,
  type BounceConfig,
} from '@/lib/freezeBounce';

const BOUNCE_SETTINGS_KEY = 'studio:bounce:settings:v1';

interface FreezeBounceControlsProps {
  tracks: Array<{
    id: string;
    name: string;
    audioUrl?: string;
    volume: number;
    pan: number;
    startTimeSeconds?: number;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    latencyCompensationMs?: number;
    effects?: any[];
    notes?: any[];
    clips?: any[];
  }>;
  bpm: number;
  totalBeats: number;
  onTrackFrozen?: (trackId: string, frozenAudioUrl: string) => void;
  onTrackUnfrozen?: (trackId: string) => void;
  onBounceComplete?: (url: string, blob: Blob) => void;
}

export default function FreezeBounceControls({
  tracks,
  bpm,
  totalBeats,
  onTrackFrozen,
  onTrackUnfrozen,
  onBounceComplete,
}: FreezeBounceControlsProps) {
  const { toast } = useToast();
  const [freezingTrack, setFreezingTrack] = useState<string | null>(null);
  const [bouncing, setBouncing] = useState(false);
  const [bounceMode, setBounceMode] = useState<'selection' | 'master'>('master');
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [normalize, setNormalize] = useState(true);
  const [latencyCompensationMs, setLatencyCompensationMs] = useState(0);
  const [goldenFingerprint, setGoldenFingerprint] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOUNCE_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        latencyCompensationMs: number;
        normalize: boolean;
        goldenFingerprint: string;
      }>;

      if (typeof parsed.latencyCompensationMs === 'number') {
        setLatencyCompensationMs(Math.max(0, Math.min(500, Math.round(parsed.latencyCompensationMs))));
      }
      if (typeof parsed.normalize === 'boolean') {
        setNormalize(parsed.normalize);
      }
      if (typeof parsed.goldenFingerprint === 'string') {
        setGoldenFingerprint(parsed.goldenFingerprint);
      }
    } catch {
      // ignore corrupted setting payload
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BOUNCE_SETTINGS_KEY, JSON.stringify({
        latencyCompensationMs,
        normalize,
        goldenFingerprint,
      }));
    } catch {
      // ignore persistence failures
    }
  }, [latencyCompensationMs, normalize, goldenFingerprint]);

  const handleFreeze = useCallback(async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    setFreezingTrack(trackId);
    try {
      const beatsPerSecond = bpm / 60;
      const durationSeconds = totalBeats / beatsPerSecond;

      const state = await freezeTrack(trackId, {
        audioUrl: track.audioUrl,
        notes: track.notes,
        clips: track.clips,
        effects: track.effects,
        volume: track.volume,
        pan: track.pan,
      }, durationSeconds);

      if (state.frozenAudioUrl) {
        onTrackFrozen?.(trackId, state.frozenAudioUrl);
      }
      toast({ title: 'Track Frozen', description: `${track.name} rendered to audio` });
    } catch (err) {
      toast({ title: 'Freeze Failed', description: String(err), variant: 'destructive' });
    } finally {
      setFreezingTrack(null);
    }
  }, [tracks, bpm, totalBeats, onTrackFrozen, toast]);

  const handleUnfreeze = useCallback((trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    unfreezeTrack(trackId);
    onTrackUnfrozen?.(trackId);
    toast({ title: 'Track Unfrozen', description: track?.name || 'Track' });
  }, [tracks, onTrackUnfrozen, toast]);

  const handleBounce = useCallback(async () => {
    setBouncing(true);
    try {
      if (bounceMode === 'master') {
        const allTrackData = tracks.map(t => ({
          trackId: t.id,
          audioUrl: t.audioUrl,
          volume: t.volume,
          pan: t.pan,
          startTimeSeconds: t.startTimeSeconds,
          trimStartSeconds: t.trimStartSeconds,
          trimEndSeconds: t.trimEndSeconds,
          latencyCompensationMs: t.latencyCompensationMs,
        }));
        const beatsPerSecond = bpm / 60;
        const durationSeconds = totalBeats / beatsPerSecond;
        const result = await bounceMaster(allTrackData, durationSeconds, 48000, normalize, latencyCompensationMs);

        onBounceComplete?.(result.url, result.blob);

        // Auto-download
        const a = document.createElement('a');
        a.href = result.url;
        a.download = 'master-bounce.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        const parity = evaluateBounceParity(goldenFingerprint, result.metrics);
        if (parity && !parity.matches) {
          toast({
            title: 'Bounce Parity Warning',
            description: `Expected ${parity.expectedFingerprint} but rendered ${parity.actualFingerprint}`,
            variant: 'destructive',
          });
        }
        toast({ title: 'Master Bounced', description: `WAV downloaded • fp=${result.metrics.fingerprint} • peak=${result.metrics.peak.toFixed(3)}` });
      } else {
        const trackIds = Array.from(selectedTrackIds);
        if (trackIds.length === 0) {
          toast({ title: 'No Tracks Selected', variant: 'destructive' });
          setBouncing(false);
          return;
        }

        const trackDataMap = new Map(
          tracks.filter(t => trackIds.includes(t.id)).map(t => [t.id, {
            audioUrl: t.audioUrl,
            notes: t.notes,
            clips: t.clips,
            effects: t.effects,
            volume: t.volume,
            pan: t.pan,
            startTimeSeconds: t.startTimeSeconds,
            trimStartSeconds: t.trimStartSeconds,
            trimEndSeconds: t.trimEndSeconds,
            latencyCompensationMs: t.latencyCompensationMs,
          }])
        );

        const config: BounceConfig = {
          trackIds,
          startBeat: 0,
          endBeat: totalBeats,
          bpm,
          sampleRate: 48000,
          channels: 2,
          normalize,
          format: 'wav',
          includeEffects: true,
          includeSends: false,
          latencyCompensationMs,
        };

        const result = await bounceTracks(config, trackDataMap);
        onBounceComplete?.(result.url, result.blob);

        const a = document.createElement('a');
        a.href = result.url;
        a.download = 'bounce.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        const parity = evaluateBounceParity(goldenFingerprint, result.metrics);
        if (parity && !parity.matches) {
          toast({
            title: 'Bounce Parity Warning',
            description: `Expected ${parity.expectedFingerprint} but rendered ${parity.actualFingerprint}`,
            variant: 'destructive',
          });
        }
        toast({ title: 'Bounce Complete', description: `${trackIds.length} tracks bounced • fp=${result.metrics.fingerprint}` });
      }
    } catch (err) {
      toast({ title: 'Bounce Failed', description: String(err), variant: 'destructive' });
    } finally {
      setBouncing(false);
    }
  }, [bounceMode, tracks, bpm, totalBeats, normalize, selectedTrackIds, onBounceComplete, toast, latencyCompensationMs, goldenFingerprint]);

  const toggleTrackSelection = useCallback((trackId: string) => {
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-700 w-80">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Snowflake className="w-4 h-4 text-cyan-400" />
        Freeze / Bounce
      </h3>

      {/* Freeze section */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Freeze Tracks</span>
        <p className="text-[10px] text-zinc-600 mb-1">Render a track to audio to save CPU. Effects are baked in.</p>
        {tracks.map(track => {
          const frozen = isTrackFrozen(track.id);
          const isFreezing = freezingTrack === track.id;
          return (
            <div key={track.id} className="flex items-center gap-2 py-1">
              <span className="text-xs text-zinc-300 flex-1 truncate">{track.name}</span>
              {frozen ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUnfreeze(track.id)}
                  className="text-xs h-6 gap-1 text-cyan-400 border-cyan-500/30"
                >
                  <Sun className="w-3 h-3" /> Unfreeze
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleFreeze(track.id)}
                  disabled={isFreezing}
                  className="text-xs h-6 gap-1"
                >
                  {isFreezing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Snowflake className="w-3 h-3" />
                  )}
                  {isFreezing ? 'Freezing...' : 'Freeze'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-700" />

      {/* Bounce section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Bounce to Audio</span>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant={bounceMode === 'master' ? 'secondary' : 'ghost'}
            onClick={() => setBounceMode('master')}
            className="text-xs h-7 flex-1"
          >
            Master
          </Button>
          <Button
            size="sm"
            variant={bounceMode === 'selection' ? 'secondary' : 'ghost'}
            onClick={() => setBounceMode('selection')}
            className="text-xs h-7 flex-1"
          >
            Selection
          </Button>
        </div>

        {bounceMode === 'selection' && (
          <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
            {tracks.map(track => (
              <label key={track.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTrackIds.has(track.id)}
                  onChange={() => toggleTrackSelection(track.id)}
                  className="rounded border-zinc-600"
                />
                <span className="text-xs text-zinc-300">{track.name}</span>
              </label>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={normalize}
            onChange={(e) => setNormalize(e.target.checked)}
            className="rounded border-zinc-600"
          />
          <span className="text-xs text-zinc-400">Normalize output</span>
        </label>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Latency Compensation</span>
            <span className="text-xs text-zinc-300">{latencyCompensationMs} ms</span>
          </div>
          <Slider
            value={[latencyCompensationMs]}
            onValueChange={(value) => setLatencyCompensationMs(Math.max(0, Math.min(500, Math.round(value[0] || 0))))}
            min={0}
            max={500}
            step={1}
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs text-zinc-400">Golden Fingerprint (optional)</span>
          <Input
            value={goldenFingerprint}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoldenFingerprint(e.target.value)}
            placeholder="e.g. a1b2c3d4"
            className="h-7 text-xs"
          />
          <span className="text-[10px] text-zinc-500">If set, bounce compares this expected fingerprint to the render output.</span>
        </div>

        <Button
          onClick={handleBounce}
          disabled={bouncing}
          className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1"
        >
          {bouncing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Bouncing...</>
          ) : (
            <><FileAudio className="w-4 h-4" /> Bounce to WAV</>
          )}
        </Button>
      </div>
    </div>
  );
}
