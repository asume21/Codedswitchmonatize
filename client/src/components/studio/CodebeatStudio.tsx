// client/src/components/studio/CodebeatStudio.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getConductor } from '../../organism/conductor/Conductor';
import { useOrganismSafe, useOrganismActivation } from '../../features/organism/GlobalOrganismWrapper';
import { useTrackStore } from '../../contexts/TrackStoreContext';
import { captureTapToBlob } from '../../lib/audioDebugBridge';
import type { TrackClip } from '@/types/studioTracks';
import type { CodeFingerprint } from '../../../../shared/types/codeFingerprint';
import type { ArrangementPlan } from '../../../../shared/arrangement';
import { Code, Wand2, Play, Download } from 'lucide-react';

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust'];
const GENRES = ['pop', 'rock', 'hiphop', 'edm', 'rnb', 'country', 'jazz', 'lofi'];

const PLACEHOLDER = `function main() {
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) beat(i);
  }
}
function beat(x) { return x * 2; }`;

export default function CodebeatStudio() {
  const { toast } = useToast();
  // The heavy OrganismProvider is only mounted after activation, so the full
  // context is null until then — read it safely, and use activate() to boot it.
  const organism = useOrganismSafe();
  const { activate } = useOrganismActivation();
  const { addTrack } = useTrackStore();
  const [pendingPlay, setPendingPlay] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [genre, setGenre] = useState('hiphop');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<ArrangementPlan | null>(null);
  const [fingerprint, setFingerprint] = useState<CodeFingerprint | null>(null);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await apiRequest('POST', '/api/code-to-music', {
        code: code || PLACEHOLDER,
        language,
        genre,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setPlan(data.plan);
      setFingerprint(data.fingerprint);
      toast({ title: 'Skeleton ready', description: `${data.plan.sections.length} sections in ${data.plan.key} @ ${data.plan.bpm} BPM` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Codebeat failed', description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  // Load the plan into the Conductor, then start the Organism if it isn't
  // already playing. loadPlan only CONFIGURES the band (key/subGenre/sections);
  // it does not start transport or the generators — that was why it "acted like
  // it worked but nothing played." Load first so start() reads the plan's key.
  const runPlan = async () => {
    if (!plan || !organism) return;
    getConductor().loadPlan(plan);
    if (!organism.isRunning) await organism.start();
    toast({ title: '🎸 Playing with the band', description: 'The Organism is performing your code.' });
  };

  // Cold path: once activate() mounts the OrganismProvider, `organism` flips
  // from null to the live context on a later render — play then.
  useEffect(() => {
    if (pendingPlay && organism) {
      setPendingPlay(false);
      runPlan().catch((err) =>
        toast({ variant: 'destructive', title: 'Could not start the band', description: err?.message }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlay, organism]);

  const playWithBand = async () => {
    if (!plan) return;
    try {
      if (organism) {
        await runPlan();          // engine already booted → play now
      } else {
        activate();               // boot the audio engine; the effect plays once it mounts
        setPendingPlay(true);
        toast({ title: '⏳ Waking the band…', description: 'Booting the audio engine.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not start the band', description: err?.message });
    }
  };

  // Commit the beat to the timeline: record 4 bars of the live mix into a clip
  // you can then edit, mix, export, or layer — so a Codebeat idea isn't lost the
  // moment you stop listening. Requires the band to be playing (records the tap).
  const sendToTimeline = async () => {
    if (!plan) return;
    if (!organism?.isRunning) {
      toast({ variant: 'destructive', title: 'Start the band first', description: 'Hit "Play with the band", then capture what you hear.' });
      return;
    }
    setCommitting(true);
    try {
      const barsMs = Math.round((16 * 60 / plan.bpm) * 1000); // 4 bars at the plan tempo
      toast({ title: '⏺ Capturing 4 bars…', description: 'Recording the band into a clip.' });
      const blob = await captureTapToBlob(barsMs);
      if (!blob) {
        toast({ variant: 'destructive', title: 'Captured silence', description: 'The band must be audibly playing to capture it.' });
        return;
      }
      const clip: TrackClip = {
        id: `codebeat-${Date.now()}`,
        name: `Codebeat — ${plan.key} ${plan.subGenre}`,
        kind: 'audio',
        lengthBars: 4,
        startBar: 0,
        payload: {
          type: 'audio',
          audioUrl: URL.createObjectURL(blob),
          duration: barsMs / 1000,
          bpm: plan.bpm,
          source: 'codebeat',
          volume: 0.85,
          pan: 0,
          color: '#22d3ee',
          notes: [],
        },
      };
      addTrack(clip);
      toast({ title: '✅ Added to timeline', description: 'Your code beat is now an editable clip in the Multi-Track.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Capture failed', description: err?.message });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code className="h-4 w-4" /> Your Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={PLACEHOLDER}
            className="min-h-[240px] font-mono text-sm"
          />
          <div className="flex gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={busy} className="w-full">
            <Wand2 className="mr-2 h-4 w-4" /> {busy ? 'Analyzing…' : 'Generate Skeleton'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> The Skeleton</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!plan && <p className="text-sm text-muted-foreground">Generate to see your code's musical shape.</p>}
          {plan && fingerprint && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{plan.key}</Badge>
                <Badge variant="outline">{plan.bpm} BPM</Badge>
                <Badge variant="outline">{plan.subGenre}</Badge>
                <Badge variant="outline">{fingerprint.mood}</Badge>
                <Badge variant="outline">complexity {fingerprint.complexity}</Badge>
              </div>
              <div className="space-y-1">
                {plan.sections.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-border/40 px-2 py-1 text-xs">
                    <span className="font-semibold uppercase tracking-wide">{s.name}</span>
                    <span className="text-muted-foreground">{s.bars} bars · energy {s.energy.toFixed(2)}{s.score ? ' · ♪ motif' : ''}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={playWithBand} className="flex-1">
                  <Play className="mr-2 h-4 w-4" /> Play with the band
                </Button>
                <Button onClick={sendToTimeline} disabled={committing} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" /> {committing ? 'Capturing…' : 'Send to timeline'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
