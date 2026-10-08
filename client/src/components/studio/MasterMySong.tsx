import { useState } from 'react';
import { Loader2, Sparkles, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTracks } from '@/hooks/useTracks';
import { useStudioStore } from '@/stores/useStudioStore';
import { apiRequest } from '@/lib/queryClient';
import { bounceProjectAudio } from '@/lib/bounceProject';
import { uploadAudioBlob } from '@/lib/uploadAudio';
import { sendToProject } from '@/lib/projectInbox';

/**
 * "Master my song": bounce the arrangement → real mastering
 * (/api/songs/auto-master: loudness-normalised, true-peak limited) → A/B the
 * result → add it to the project. Before this, ASTUTELY's "Master" opened an
 * LLM that returned text advice from meter numbers (product review A5).
 */
export default function MasterMySong() {
  const { toast } = useToast();
  const { tracks } = useTracks();
  const bpm = useStudioStore((s) => s.bpm) || 120;
  const [stage, setStage] = useState<'idle' | 'bouncing' | 'mastering'>('idle');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [masteredUrl, setMasteredUrl] = useState<string | null>(null);
  const [skippedNotes, setSkippedNotes] = useState(0);

  const master = async () => {
    setMasteredUrl(null);
    setStage('bouncing');
    try {
      const bounce = await bounceProjectAudio(tracks, bpm);
      if (!bounce) {
        toast({ title: 'Nothing to master yet', description: 'Add audio tracks (takes, loops, samples) to your arrangement first.' });
        return;
      }
      setSkippedNotes(bounce.noteTracks.length);
      setOriginalUrl(bounce.url);
      const songUrl = await uploadAudioBlob(bounce.blob, 'mix-for-mastering');

      setStage('mastering');
      const res = await apiRequest('POST', '/api/songs/auto-master', { songUrl });
      const data = await res.json();
      if (!data?.fixedAudioUrl) throw new Error(data?.error || 'Mastering returned no file');
      setMasteredUrl(data.fixedAudioUrl);
      toast({ title: 'Mastered', description: data.explanation || 'Compare it with your mix below.' });
    } catch (err) {
      toast({ title: 'Mastering failed', description: String((err as Error)?.message ?? err), variant: 'destructive' });
    } finally {
      setStage('idle');
    }
  };

  const addToProject = () => {
    if (!masteredUrl) return;
    sendToProject({
      kind: 'audio',
      trackId: `master-${Date.now()}`,
      name: 'Mastered mix',
      audioUrl: masteredUrl,
      bpm,
      color: '#facc15',
      source: 'auto-master',
    });
    toast({ title: 'Sent to MIX', description: 'The mastered mix will be in your arrangement when you open MIX.' });
  };

  const busy = stage !== 'idle';

  return (
    <Card data-testid="card-master-my-song">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-yellow-400" /> Master my song
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Mixes your arrangement's audio tracks and masters it to streaming loudness. Costs credits only when a master is produced.
        </p>
        <Button onClick={master} disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {stage === 'bouncing' ? 'Mixing your tracks…' : stage === 'mastering' ? 'Mastering…' : 'Master my song'}
        </Button>
        {skippedNotes > 0 && (
          <p className="text-xs text-amber-400">
            {skippedNotes} instrument track{skippedNotes > 1 ? 's are' : ' is'} not in this mix yet — only audio tracks are rendered.
          </p>
        )}
        {originalUrl && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Your mix</div>
            <audio controls src={originalUrl} className="w-full h-8" />
          </div>
        )}
        {masteredUrl && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Mastered</div>
            <audio controls src={masteredUrl} className="w-full h-8" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addToProject} className="gap-1">
                <Plus className="h-3 w-3" /> Add to project
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href={masteredUrl} download="mastered-mix.mp3">Download MP3</a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
