// SHARE surface — publish & shareable output. Social Hub is the home; the
// Lyric Video Maker lives here too (it makes a shareable video FROM a finished
// song — post-production output, not live performance, so it does not belong on
// MAKE). Two lightweight tabs, no heavy chrome.
import React, { useState, Suspense } from 'react';
import { Users, Clapperboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const SocialHub = React.lazy(() => import('@/pages/social-hub'));
const LyricVideoMaker = React.lazy(() => import('@/components/studio/LyricVideoMaker'));

type ShareTab = 'social' | 'lyric-video';

const TABS: { id: ShareTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'social', label: 'Social Hub', icon: Users },
  { id: 'lyric-video', label: 'Lyric Video', icon: Clapperboard },
];

export default function ShareSurface() {
  const [tab, setTab] = useState<ShareTab>('social');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-background/40 px-3 py-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
              tab === id
                ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/40'
                : 'border border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
          {tab === 'social' ? <SocialHub /> : <LyricVideoMaker />}
        </Suspense>
      </div>
    </div>
  );
}
