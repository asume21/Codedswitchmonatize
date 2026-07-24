import React, { Suspense, useCallback, useMemo } from 'react';
import { Redirect, useLocation } from 'wouter';
import { Mic, Music, Users, FolderOpen, Command, Brain } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import AssistantOverlay from './overlays/AssistantOverlay';
import TranslatorOverlay from './overlays/TranslatorOverlay';
import { OPEN_COMMAND_PALETTE_EVENT } from '@/components/CommandPalette';

const UnifiedStudioWorkspace = React.lazy(
  () => import('./UnifiedStudioWorkspace')
);
const MakeSurface = React.lazy(
  () => import('./surfaces/MakeSurface')
);
const AstutelySurface = React.lazy(
  () => import('./surfaces/AstutelySurface')
);
// SHARE and LIBRARY surfaces mount the already-built pages directly (per
// CLAUDE.md: SHARE = Social Hub, LIBRARY = Sample Library). The shell is
// already inside ProtectedRoute + the studio provider stack, so these page
// components — which only need auth + react-query — render as-is.
const ShareSurface = React.lazy(() => import('./surfaces/ShareSurface'));
const SampleLibraryPage = React.lazy(() => import('@/pages/sample-library'));

const SURFACES = ['make', 'mix', 'ai', 'library', 'share'] as const;
type Surface = (typeof SURFACES)[number];

const DEFAULT_SURFACE: Surface = 'mix';

const SURFACE_META: Record<Surface, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}> = {
  make:    { label: 'MAKE',    icon: Mic,        hint: 'Live performance & voice' },
  mix:     { label: 'MIX',     icon: Music,      hint: 'Beat maker, piano roll, mixer' },
  ai:      { label: 'ASTUTELY', icon: Brain,  hint: 'AI mastering, stems, arranging, and assistant cockpit' },
  library: { label: 'LIBRARY', icon: FolderOpen, hint: 'Samples & saved beats' },
  share:   { label: 'SHARE',   icon: Users,      hint: 'Social hub & profiles' },
};

const OVERLAY_IDS = ['translator', 'assistant'] as const;
type OverlayId = (typeof OVERLAY_IDS)[number];

function isSurface(value: string | undefined | null): value is Surface {
  return value != null && (SURFACES as readonly string[]).includes(value);
}

function isOverlay(value: string | null): value is OverlayId {
  return value != null && (OVERLAY_IDS as readonly string[]).includes(value);
}

/**
 * Parse `/studio/<surface>` from the wouter location.
 * Returns null when the segment after /studio is missing or unknown,
 * so the caller can redirect to the default surface.
 */
function parseSurfaceFromPath(pathname: string): Surface | null {
  const segments = pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('studio');
  if (idx === -1) return null;
  const candidate = segments[idx + 1]?.toLowerCase();
  return isSurface(candidate) ? candidate : null;
}

export default function StudioShell() {
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();

  const search = typeof window !== 'undefined' ? window.location.search : '';
  const surface = parseSurfaceFromPath(location);
  const modal = useMemo(() => {
    const params = new URLSearchParams(search);
    const raw = params.get('modal');
    return isOverlay(raw) ? raw : null;
  }, [search]);

  const buildHref = useCallback(
    (nextSurface: Surface, nextModal: OverlayId | null) => {
      const params = new URLSearchParams(search);
      if (nextModal) params.set('modal', nextModal);
      else params.delete('modal');
      const qs = params.toString();
      return `/studio/${nextSurface}${qs ? `?${qs}` : ''}`;
    },
    [search]
  );

  const switchSurface = useCallback(
    (next: Surface) => {
      if (next === surface) return;
      navigate(buildHref(next, modal));
    },
    [navigate, buildHref, modal, surface]
  );

  const openOverlay = useCallback(
    (id: OverlayId) => {
      if (!surface) return;
      navigate(buildHref(surface, id));
    },
    [navigate, buildHref, surface]
  );

  const closeOverlay = useCallback(() => {
    if (!surface) return;
    navigate(buildHref(surface, null), { replace: true });
  }, [navigate, buildHref, surface]);

  if (!surface) {
    return <Redirect to={`/studio/${DEFAULT_SURFACE}`} />;
  }

  return (
    <div
      data-testid="studio-shell"
      data-surface={surface}
      className="studio-content min-h-screen flex flex-col bg-background text-foreground"
    >
      {!isMobile && (
        <DesktopSurfaceRail
          active={surface}
          onChange={switchSurface}
        />
      )}

      <main
        className={cn(
          'flex-1 min-h-0 overflow-auto',
          isMobile ? 'pb-16' : ''
        )}
      >
        <ErrorBoundary>
          <SurfaceRouter surface={surface} />
        </ErrorBoundary>
      </main>

      {isMobile && (
        <MobileSurfaceTabs active={surface} onChange={switchSurface} />
      )}

      <OverlayPortal id={modal} onClose={closeOverlay} />
    </div>
  );
}

function SurfaceRouter({ surface }: { surface: Surface }) {
  switch (surface) {
    case 'make':
      return (
        <Suspense fallback={<SurfaceLoading label="MAKE" />}>
          <MakeSurface />
        </Suspense>
      );
    case 'mix':
      return (
        <Suspense fallback={<SurfaceLoading label="MIX" />}>
          <UnifiedStudioWorkspace />
        </Suspense>
      );
    case 'ai':
      return (
        <Suspense fallback={<SurfaceLoading label="ASTUTELY AI" />}>
          <AstutelySurface />
        </Suspense>
      );
    case 'share':
      return (
        <Suspense fallback={<SurfaceLoading label="SHARE" />}>
          <ShareSurface />
        </Suspense>
      );
    case 'library':
      return (
        <Suspense fallback={<SurfaceLoading label="LIBRARY" />}>
          <SampleLibraryPage />
        </Suspense>
      );
  }
}

function DesktopSurfaceRail({
  active,
  onChange,
}: {
  active: Surface;
  onChange: (next: Surface) => void;
}) {
  return (
    <nav
      data-testid="studio-shell-rail"
      // Controls are pinned to the RIGHT so they never sit under the global
      // floating nav (App.tsx renders <GlobalNav> fixed top-4 left-4), which is
      // a wide cluster that previously covered the surface tabs. Left side is
      // intentionally left for that global nav.
      className="sticky top-0 z-40 flex items-center justify-end gap-3 border-b border-border bg-background/95 backdrop-blur px-4 h-12"
    >
      <ul className="flex items-center gap-1">
        {SURFACES.map((s) => (
          <li key={s}>
            <SurfaceButton
              surface={s}
              active={s === active}
              onClick={() => onChange(s)}
            />
          </li>
        ))}
      </ul>
      {/* Opens the SAME command palette as Cmd/Ctrl+K — the ⌘K label is now
          truthful (it previously opened the AI Assistant overlay). */}
      <Button
        size="sm"
        variant="ghost"
        className="gap-2"
        onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
        data-testid="studio-shell-command-trigger"
        aria-label="Open command palette"
        title="Command palette (⌘K)"
      >
        <Command className="w-4 h-4" />
        <span className="text-xs tracking-wide">⌘K</span>
      </Button>
    </nav>
  );
}

function MobileSurfaceTabs({
  active,
  onChange,
}: {
  active: Surface;
  onChange: (next: Surface) => void;
}) {
  return (
    <nav
      data-testid="studio-shell-tabs-mobile"
      className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur h-16"
    >
      {SURFACES.map((s) => (
        <SurfaceButton
          key={s}
          surface={s}
          active={s === active}
          onClick={() => onChange(s)}
          variant="mobile"
        />
      ))}
    </nav>
  );
}

function SurfaceButton({
  surface,
  active,
  onClick,
  variant = 'desktop',
}: {
  surface: Surface;
  active: boolean;
  onClick: () => void;
  variant?: 'desktop' | 'mobile';
}) {
  const meta = SURFACE_META[surface];
  const Icon = meta.icon;

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        data-testid={`studio-shell-surface-${surface}`}
        className={cn(
          'flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wider transition-colors',
          active
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon className="w-5 h-5" />
        <span>{meta.label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={meta.hint}
      data-testid={`studio-shell-surface-${surface}`}
      className={cn(
        'flex items-center gap-2 px-3 h-9 rounded-md text-xs uppercase tracking-wider transition-colors',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{meta.label}</span>
    </button>
  );
}

function SurfaceLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center p-8 min-h-[60vh] text-sm text-muted-foreground">
      Loading {label}…
    </div>
  );
}

function OverlayPortal({
  id,
  onClose,
}: {
  id: OverlayId | null;
  onClose: () => void;
}) {
  // Dispatch by overlay id. Each overlay manages its own primitive (Sheet for the
  // Assistant, Dialog for the Translator) and its own open/close coordination —
  // the shell only owns URL-as-state.
  return (
    <>
      <AssistantOverlay open={id === 'assistant'} onClose={onClose} />
      <TranslatorOverlay open={id === 'translator'} onClose={onClose} />
    </>
  );
}
