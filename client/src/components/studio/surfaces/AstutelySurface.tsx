import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Brain,
  Gauge,
  GitBranch,
  Layers,
  Mic2,
  Music,
  RadioTower,
  Sliders,
  Sparkles,
  Wand2,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAstutelyCore } from '@/contexts/AstutelyCoreContext';
import { useTransport } from '@/contexts/TransportContext';
import { useToast } from '@/hooks/use-toast';
import { useTracks } from '@/hooks/useTracks';
import { useMasteringAnalyzer } from '@/hooks/useMasteringAnalyzer';
import { useStudioStore } from '@/stores/useStudioStore';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

const AIAssistant = React.lazy(() => import('../AIAssistant'));
const AIMasteringCard = React.lazy(() => import('../AIMasteringCard'));
const AIArrangementBuilder = React.lazy(() => import('../AIArrangementBuilder'));
const AIVocalMelody = React.lazy(() => import('../AIVocalMelody'));
const AIStemSeparation = React.lazy(() => import('../AIStemSeparation'));
const AILoopGenerator = React.lazy(() => import('../AILoopGenerator'));
const AIBassGenerator = React.lazy(() => import('../AIBassGenerator'));
const CodeToMusicStudioV2 = React.lazy(() => import('../CodeToMusicStudioV2'));
const AudioToolsPage = React.lazy(() => import('../AudioToolsPage'));
const AstutelyBrainPanel = React.lazy(() => import('../AstutelyBrainPanel'));

type AstutelyTab = 'brain' | 'generate' | 'arrange' | 'mix' | 'tools' | 'codebeat';

const TAB_META: Record<AstutelyTab, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  brain: { label: 'Brain', icon: Brain },
  generate: { label: 'Generate', icon: Sparkles },
  arrange: { label: 'Arrange', icon: GitBranch },
  mix: { label: 'Mix/Master', icon: Sliders },
  tools: { label: 'Tools', icon: Wrench },
  codebeat: { label: 'Codebeat', icon: Wand2 },
};

function TabLoadingFallback() {
  return (
    <div className="flex h-80 items-center justify-center text-xs font-mono uppercase tracking-widest text-cyan-300">
      Initializing Astutely module...
    </div>
  );
}

export default function AstutelySurface() {
  const [location, navigate] = useLocation();
  const { tempo } = useTransport();
  const { tracks, updateTrack } = useTracks();
  const { toast } = useToast();
  const masteringAnalyzer = useMasteringAnalyzer();
  const [activeTab, setActiveTab] = useState<AstutelyTab>(() => {
    if (typeof window === 'undefined') return 'brain';
    const requested = new URLSearchParams(window.location.search).get('tool') as AstutelyTab | null;
    return requested && requested in TAB_META ? requested : 'brain';
  });

  const studioBpm = useStudioStore((s) => s.bpm);
  const currentKey = useStudioStore((s) => s.key);
  const keyMode = useStudioStore((s) => s.keyMode);
  const currentUploadedSong = useStudioStore((s) => s.currentUploadedSong);

  const {
    activeGenre,
    autoMixEnabled,
    organismIsRunning,
    latestAudioReport,
    lastGeneratedPattern,
    lastGeneratedAudio,
    isGeneratingPattern,
    isGeneratingAudio,
    audioError,
    getProjectStatus,
  } = useAstutelyCore();

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tool') as AstutelyTab | null;
    if (requested && requested in TAB_META) setActiveTab(requested);
  }, [location]);

  useEffect(() => {
    if (!masteringAnalyzer.isAnalyzing) {
      masteringAnalyzer.analyze();
    }
    // The analyzer object is intentionally not a dependency; this is a surface-focus kick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveBpm = tempo || studioBpm || 120;
  const musicalKey = `${currentKey} ${keyMode}`;
  const projectStatus = getProjectStatus();

  const arrangementTrackSummary = useMemo(
    () =>
      tracks.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        instrument: t.instrument,
        noteCount: t.notes?.length || 0,
        muted: t.muted,
        volume: t.volume,
      })),
    [tracks],
  );

  const insightCards = [
    {
      label: 'Project',
      value: `${projectStatus.trackCount || tracks.length} tracks`,
      detail: `${projectStatus.totalNotes || arrangementTrackSummary.reduce((sum, t) => sum + t.noteCount, 0)} notes`,
      icon: Layers,
      tone: 'cyan',
    },
    {
      label: 'Session',
      value: `${effectiveBpm} BPM`,
      detail: musicalKey,
      icon: Gauge,
      tone: 'amber',
    },
    {
      label: 'Organism',
      value: organismIsRunning ? 'Live' : 'Idle',
      detail: latestAudioReport ? `${Math.round(latestAudioReport.clippingPercent ?? 0)}% clipping` : 'No self-listen report',
      icon: RadioTower,
      tone: organismIsRunning ? 'emerald' : 'muted',
    },
    {
      label: 'Astutely',
      value: isGeneratingPattern || isGeneratingAudio ? 'Working' : autoMixEnabled ? 'Auto-mix on' : 'Ready',
      detail: activeGenre?.label ?? audioError ?? 'No genre lock',
      icon: Activity,
      tone: isGeneratingPattern || isGeneratingAudio ? 'amber' : autoMixEnabled ? 'emerald' : 'cyan',
    },
  ];

  const jumpTo = (tab: AstutelyTab) => setActiveTab(tab);

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-slate-950 text-foreground astutely-app astutely-scanlines astutely-grid-bg">
      <div className="border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">
                <Brain className="h-5 w-5 text-yellow-400" />
                Astutely AI
              </h1>
              <Badge variant="outline" className="border-border/60 text-muted-foreground">
                Core Interface
              </Badge>
              <Badge variant="outline" className="border-border/60 text-slate-200">
                {effectiveBpm} BPM
              </Badge>
              <Badge variant="outline" className="border-border/60 text-slate-200">
                {musicalKey}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-2 border-border/60 bg-background/60 text-foreground" onClick={() => jumpTo('generate')}>
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
            <Button size="sm" variant="outline" className="gap-2 border-border/60 bg-background/60 text-foreground" onClick={() => jumpTo('mix')}>
              <Sliders className="h-4 w-4" />
              Master
            </Button>
            <Button size="sm" variant="outline" className="gap-2 border-border/60 bg-background/60 text-foreground" onClick={() => navigate('/studio/mix')}>
              <Music className="h-4 w-4" />
              Open Mixer
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1800px] gap-4 p-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-md border border-border/60 bg-card/80 shadow-sm xl:h-[calc(100vh-9.5rem)]">
          <div className="border-b border-border/60 p-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-cyan-300" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Astutely Copilot
              </h2>
              <span className={cn('ml-auto h-2 w-2 rounded-full', audioError ? 'bg-red-400' : 'bg-emerald-400')} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Suspense fallback={<TabLoadingFallback />}>
              <AIAssistant />
            </Suspense>
          </div>
        </aside>

        <main className="flex min-h-[520px] flex-col overflow-hidden rounded-md border border-border/60 bg-card/80 shadow-sm xl:h-[calc(100vh-9.5rem)]">
          <section className="grid gap-3 border-b border-border/60 bg-background/30 p-3 md:grid-cols-2 xl:grid-cols-4">
            {insightCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className={cn(
                    'rounded-md border bg-background/45 p-3',
                    card.tone === 'amber' && 'border-amber-500/20',
                    card.tone === 'emerald' && 'border-emerald-500/20',
                    card.tone === 'cyan' && 'border-cyan-500/20',
                    card.tone === 'muted' && 'border-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {card.label}
                    </span>
                    <Icon className="h-4 w-4 text-cyan-300" />
                  </div>
                  <div className="mt-2 truncate text-lg font-semibold text-foreground">{card.value}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{card.detail}</div>
                </div>
              );
            })}
          </section>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AstutelyTab)} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border/60 bg-background/35 px-3 py-2">
              <TabsList className="flex h-auto flex-wrap justify-start gap-1 rounded-md border border-border/60 bg-background/60 p-1">
                {(Object.keys(TAB_META) as AstutelyTab[]).map((tab) => {
                  const Icon = TAB_META[tab].icon;
                  return (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      data-testid={tab === 'codebeat' ? 'tab-code-to-music' : undefined}
                      className="h-8 rounded-sm border border-transparent px-3 text-xs uppercase tracking-[0.16em] text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background/80 data-[state=active]:text-foreground"
                    >
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {TAB_META[tab].label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TabsContent value="brain" className="m-0 space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                  <section className="rounded-md border border-border/60 bg-background/35">
                    <Suspense fallback={<TabLoadingFallback />}>
                      <AstutelyBrainPanel />
                    </Suspense>
                  </section>
                  <section className="grid gap-3 md:grid-cols-2">
                    <ActionPanel
                      icon={Sparkles}
                      title="Generate a missing part"
                      body={tracks.length === 0 ? 'Start with a loop, bass, melody, or Codebeat idea.' : 'Use the current project context to add a focused musical layer.'}
                      action="Open Generate"
                      onClick={() => jumpTo('generate')}
                    />
                    <ActionPanel
                      icon={GitBranch}
                      title="Build the song shape"
                      body="Map sections and apply track states without leaving the Astutely cockpit."
                      action="Open Arranger"
                      onClick={() => jumpTo('arrange')}
                    />
                    <ActionPanel
                      icon={Sliders}
                      title="Repair the rough mix"
                      body={currentUploadedSong ? `Processing ${currentUploadedSong.name}` : 'Analyze level, stems, and mastering moves for this session.'}
                      action="Open Mix/Master"
                      onClick={() => jumpTo('mix')}
                    />
                    <ActionPanel
                      icon={Wand2}
                      title="Turn logic into music"
                      body={lastGeneratedPattern || lastGeneratedAudio ? 'Recent Astutely output is ready for import or revision.' : 'Use Codebeat when the idea starts as code or pattern logic.'}
                      action="Open Codebeat"
                      onClick={() => jumpTo('codebeat')}
                    />
                  </section>
                </div>
              </TabsContent>

              <TabsContent value="generate" className="m-0 space-y-4">
                <Suspense fallback={<TabLoadingFallback />}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <AILoopGenerator currentBpm={effectiveBpm} currentKey={currentKey} currentScale={keyMode} />
                    <AIBassGenerator bpm={effectiveBpm} musicalKey={currentKey} />
                    <AIVocalMelody currentKey={currentKey} currentBpm={effectiveBpm} />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="arrange" className="m-0">
                <Suspense fallback={<TabLoadingFallback />}>
                  <AIArrangementBuilder
                    currentBpm={effectiveBpm}
                    currentKey={currentKey}
                    tracks={arrangementTrackSummary}
                    onApplySection={(sectionIndex, trackStates) => {
                      Object.entries(trackStates).forEach(([trackId, state]) => {
                        updateTrack(trackId, { muted: !state.active, volume: state.volume });
                      });
                      toast({ title: 'Section Applied', description: `Applied track states for section ${sectionIndex + 1}` });
                    }}
                  />
                </Suspense>
              </TabsContent>

              <TabsContent value="mix" className="m-0 space-y-4">
                <Suspense fallback={<TabLoadingFallback />}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <AIMasteringCard
                      peakLevel={masteringAnalyzer.peakLevel}
                      rmsLevel={masteringAnalyzer.rmsLevel}
                      frequencyData={masteringAnalyzer.frequencyData}
                    />
                    <AIStemSeparation />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="tools" className="m-0">
                <Suspense fallback={<TabLoadingFallback />}>
                  <AudioToolsPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="codebeat" className="m-0">
                <Suspense fallback={<TabLoadingFallback />}>
                  <CodeToMusicStudioV2 />
                </Suspense>
              </TabsContent>
            </div>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

function ActionPanel({
  icon: Icon,
  title,
  body,
  action,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/35 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/8 p-2">
          <Icon className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
          <Button size="sm" variant="outline" className="mt-3 h-8 border-border/60 bg-background/60 px-3 text-xs" onClick={onClick}>
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}
