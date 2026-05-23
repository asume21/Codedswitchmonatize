import React, { useMemo, useState } from 'react';
import {
  Circle,
  Mic2,
  Pause,
  Play,
  Radio,
  SlidersHorizontal,
  Square,
  Timer,
  Waves,
} from 'lucide-react';

import StudioVocalRecorder, { type VocalTake } from '@/components/studio/StudioVocalRecorder';
import { OrganismCommandCenter } from '@/features/organism/OrganismCommandCenter';
import {
  GlobalOrganismWrapper,
  useOrganismActivation,
  useOrganismSafe,
} from '@/features/organism/GlobalOrganismWrapper';
import { useTransport } from '@/contexts/TransportContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const VOCAL_TRACK_COLOR = '#ef4444';

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function MakeSurface() {
  const { tempo, isPlaying, play, pause, stop } = useTransport();
  const [isBoothArmed, setIsBoothArmed] = useState(false);
  const [takes, setTakes] = useState<VocalTake[]>([]);

  const takeStats = useMemo(() => {
    const latest = takes[takes.length - 1] ?? null;
    const longest = takes.reduce<VocalTake | null>((best, take) => {
      if (!best || take.durationMs > best.durationMs) return take;
      return best;
    }, null);

    return {
      count: takes.length,
      latest,
      longest,
      totalDurationMs: takes.reduce((sum, take) => sum + take.durationMs, 0),
    };
  }, [takes]);

  const handleTransportClick = () => {
    if (isPlaying) pause();
    else play();
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-background text-foreground">
      <div className="border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold tracking-wide text-foreground">
                MAKE
              </h1>
              <Badge variant="outline" className="border-red-500/40 text-red-300">
                Vocal Booth
              </Badge>
              <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                {tempo} BPM
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Live voice capture, performance, and responsive generation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={isBoothArmed ? 'destructive' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setIsBoothArmed((armed) => !armed)}
            >
              <Circle className={cn('h-4 w-4', isBoothArmed && 'fill-current')} />
              {isBoothArmed ? 'Armed' : 'Arm'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={handleTransportClick}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={stop} title="Stop">
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1800px] gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-h-[620px] overflow-hidden rounded-md border border-border bg-background shadow-sm">
          <div className="flex h-10 items-center gap-2 border-b border-border px-3">
            <Radio className="h-4 w-4 text-cyan-300" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live Organism
            </h2>
            <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <div className="h-[calc(100%-2.5rem)] min-h-0">
            <GlobalOrganismWrapper>
              <OrganismProviderGate>
                <OrganismCommandCenter />
              </OrganismProviderGate>
            </GlobalOrganismWrapper>
          </div>
        </section>

        <aside className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-1">
          <section className="min-h-[420px] overflow-hidden rounded-md border border-red-500/20 bg-black shadow-sm">
            <StudioVocalRecorder
              trackId="make-vocal-booth"
              trackName="Lead Vocal"
              trackColor={VOCAL_TRACK_COLOR}
              bpm={tempo}
              isTransportPlaying={isPlaying}
              isArmed={isBoothArmed}
              onTakesChange={setTakes}
            />
          </section>

          <section className="rounded-md border border-border bg-card p-3 text-card-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Booth Status
              </h2>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric label="Takes" value={String(takeStats.count)} icon={Mic2} />
              <Metric label="Time" value={formatDuration(takeStats.totalDurationMs)} icon={Timer} />
              <Metric
                label="Peak"
                value={takeStats.latest ? `${Math.round(takeStats.latest.peakDb)} dB` : '--'}
                icon={Waves}
              />
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <TakeRow
                label="Latest"
                value={takeStats.latest ? takeStats.latest.name : 'No take'}
                detail={takeStats.latest ? formatDuration(takeStats.latest.durationMs) : '--'}
              />
              <TakeRow
                label="Longest"
                value={takeStats.longest ? takeStats.longest.name : 'No take'}
                detail={takeStats.longest ? formatDuration(takeStats.longest.durationMs) : '--'}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function OrganismProviderGate({ children }: { children: React.ReactNode }) {
  const { isActivated, activate } = useOrganismActivation();
  const organism = useOrganismSafe();

  React.useEffect(() => {
    if (!isActivated) activate();
  }, [isActivated, activate]);

  return (
    <>
      {!organism ? (
        <div className="flex h-[620px] items-center justify-center text-sm font-mono tracking-widest text-cyan-400">
          <span className="animate-pulse">⚡ INITIALIZING ORGANISM AUDIO CORES...</span>
        </div>
      ) : (
        children
      )}
    </>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background/60 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function TakeRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-2 py-2">
      <span className="w-14 flex-shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{value}</span>
      <span className="font-mono text-muted-foreground">{detail}</span>
    </div>
  );
}
