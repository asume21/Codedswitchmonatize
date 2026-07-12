import React, { Suspense, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { useCanonical } from "@/hooks/useCanonical";
import { AuthProvider } from "@/contexts/AuthContext";
import { AIMessageProvider } from "@/contexts/AIMessageContext";
import { licenseGuard } from "@/lib/LicenseGuard";
import { GlobalNav } from "@/components/layout/GlobalNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import FloatingAudioMonitor from "@/components/ui/FloatingAudioMonitor";
import { GlobalOrganismWrapper } from "@/features/organism/GlobalOrganismWrapper";
import { IOSAudioEnable } from "@/components/IOSAudioEnable";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CommandPalette } from "@/components/CommandPalette";
import { DesktopBridgeProvider } from "@/contexts/DesktopBridgeContext";

// TransportProvider + TrackStoreProvider are hoisted to wrap the entire app so
// TransportContext can act as the single owner of Tone.Transport everywhere
// the Organism runs (see lib/transportController.ts + project_audio_clock_ownership
// memory). Eager imports here are fine — Tone.js is already in the initial chunk
// via GlobalOrganismWrapper → OrganismProvider → GeneratorOrchestrator.
import { TransportProvider } from "@/contexts/TransportContext";
import { TrackStoreProvider } from "@/contexts/TrackStoreContext";

const StemGenerationProvider = React.lazy(() => import("@/contexts/StemGenerationContext").then(m => ({ default: m.StemGenerationProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const InstrumentProvider = React.lazy(() => import("@/contexts/InstrumentContext").then(m => ({ default: m.InstrumentProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const GlobalAudioProvider = React.lazy(() => import("@/contexts/GlobalAudioContext").then(m => ({ default: m.GlobalAudioProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const StudioSessionProvider = React.lazy(() => import("@/contexts/StudioSessionContext").then(m => ({ default: m.StudioSessionProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const SongWorkSessionProvider = React.lazy(() => import("@/contexts/SongWorkSessionContext").then(m => ({ default: m.SongWorkSessionProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const SessionDestinationProvider = React.lazy(() => import("@/contexts/SessionDestinationContext").then(m => ({ default: m.SessionDestinationProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const AstutelyCoreProvider = React.lazy(() => import("@/contexts/AstutelyCoreContext").then(m => ({ default: m.AstutelyCoreProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const GlobalAudioPlayer = React.lazy(() => import("@/components/GlobalAudioPlayer").then(m => ({ default: m.GlobalAudioPlayer })).catch(() => ({ default: () => null })));
const StudioChromeFallback: React.ComponentType<any> = () => <></>;
const GlobalTransportBar = React.lazy<React.ComponentType<any>>(() => import("@/components/studio/GlobalTransportBar").catch((error) => {
  console.error("Failed to load GlobalTransportBar", error);
  return { default: StudioChromeFallback };
}));
const KeyboardShortcutsHelp = React.lazy<React.ComponentType<any>>(() => import("@/components/studio/KeyboardShortcutsHelp").catch(() => ({ default: StudioChromeFallback })));
const OnboardingTour = React.lazy<React.ComponentType<any>>(() => import("@/components/studio/OnboardingTour").catch(() => ({ default: StudioChromeFallback })));

// Eagerly loaded pages (small, frequently accessed) - FAST INITIAL LOAD
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

// A failed dynamic import is a stale/broken module graph (dev-server restart,
// mid-deploy chunk invalidation) — NOT a missing route. Rendering <NotFound />
// here reads as a fake 404 and strands the user; a fresh page load fixes it.
// Reload at most once per 10s (sessionStorage-throttled) so a genuinely
// broken build degrades to the 404 card instead of a reload loop.
function ChunkReloadFallback() {
  const RELOAD_TS_KEY = "chunk-reload-ts";
  React.useEffect(() => {
    const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
      window.location.reload();
    }
  }, []);
  return <NotFound />;
}

// Lazy loaded pages - only load when needed
const PricingPage = React.lazy(() => import("@/pages/pricing").catch(() => ({ default: ChunkReloadFallback })));
const OnboardingPage = React.lazy(() => import("@/pages/onboarding").catch(() => ({ default: ChunkReloadFallback })));
const Dashboard = React.lazy(() => import("@/pages/dashboard").catch(() => ({ default: ChunkReloadFallback })));
const StudioShell = React.lazy(() => import("@/components/studio/StudioShell").catch(() => ({ default: ChunkReloadFallback })));
const Settings = React.lazy(() => import("@/pages/settings").catch(() => ({ default: ChunkReloadFallback })));
const VulnerabilityScannerPage = React.lazy(() => import("@/pages/vulnerability-scanner").catch(() => ({ default: ChunkReloadFallback })));
const CreditsSuccessPage = React.lazy(() => import("@/pages/credits-success").catch(() => ({ default: ChunkReloadFallback })));
const CreditsCancelPage = React.lazy(() => import("@/pages/credits-cancel").catch(() => ({ default: ChunkReloadFallback })));
const ActivatePage = React.lazy(() => import("@/pages/activate").catch(() => ({ default: ChunkReloadFallback })));
const PublicSongPage = React.lazy(() => import("@/pages/public-song").catch(() => ({ default: ChunkReloadFallback })));
const SocialHub = React.lazy(() => import("@/pages/social-hub").catch(() => ({ default: ChunkReloadFallback })));
const UserProfilePage = React.lazy(() => import("@/pages/user-profile").catch(() => ({ default: ChunkReloadFallback })));
const SitemapPage = React.lazy(() => import("@/pages/sitemap-page").catch(() => ({ default: ChunkReloadFallback })));
const VoiceConvertPage = React.lazy(() => import("@/pages/voice-convert").catch(() => ({ default: ChunkReloadFallback })));
const SampleLibraryPage = React.lazy(() => import("@/pages/sample-library").catch(() => ({ default: ChunkReloadFallback })));
const BlogPage = React.lazy(() => import("@/pages/blog").catch(() => ({ default: ChunkReloadFallback })));
const BlogPostPage = React.lazy(() => import("@/pages/blog/[slug]").catch(() => ({ default: ChunkReloadFallback })));
const DeveloperPage = React.lazy(() => import("@/pages/developer").catch(() => ({ default: ChunkReloadFallback })));
const DevelopersPage = React.lazy(() => import("@/pages/developers").catch(() => ({ default: ChunkReloadFallback })));
const OrganismGuestPage = React.lazy(() => import("@/features/organism/OrganismGuestPage").catch(() => ({ default: ChunkReloadFallback })));
const RecordingBoothPage = React.lazy(() => import("@/pages/recording-booth").catch(() => ({ default: ChunkReloadFallback })));
const ProAudioLanding = React.lazy(() => import("@/pages/pro-audio").catch(() => ({ default: ChunkReloadFallback })));
const MixStudioLanding = React.lazy(() => import("@/pages/mix-studio").catch(() => ({ default: ChunkReloadFallback })));
const DawLayoutLanding = React.lazy(() => import("@/pages/daw-layout").catch(() => ({ default: ChunkReloadFallback })));
const SongStructureLanding = React.lazy(() => import("@/pages/song-structure").catch(() => ({ default: ChunkReloadFallback })));
const DemoPage = React.lazy(() => import("@/pages/DemoPage").catch(() => ({ default: ChunkReloadFallback })));
const PrivacyPage = React.lazy(() => import("@/pages/privacy").catch(() => ({ default: ChunkReloadFallback })));
const TermsPage = React.lazy(() => import("@/pages/terms").catch(() => ({ default: ChunkReloadFallback })));


// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-black/95 text-cyan-100 astutely-app astutely-scanlines astutely-grid-bg">
      <div className="text-center">
        <div className="relative mx-auto mb-4 h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.25)]" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-300/10 border-t-cyan-300 border-r-cyan-300/40" />
        </div>
        <p className="text-cyan-200/70 font-bold tracking-widest uppercase text-xs">Loading...</p>
      </div>
    </div>
  );
}

// Redirect that forwards the incoming query string to the destination — used so
// `/studio?modal=translator` redirects to `/studio/mix?modal=translator` instead
// of dropping search params the way wouter's <Redirect> does.
const RedirectPreservingQuery = ({ to }: { to: string }) => {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    setLocation(to + window.location.search);
  }, [to, setLocation]);
  return null;
};

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-black/95 text-cyan-100 overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Allow dropdowns/menus to escape vertically; keep horizontal scroll for wide layouts. */}
        <main id="main-content" className="flex-1 overflow-x-auto overflow-y-visible" role="main">
          <div className="w-full h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

// Studio wrapper with all audio providers - only loaded when entering studio routes.
// TrackStoreProvider + TransportProvider are NOT here anymore — they've been
// hoisted to the top of <App/> so the single-owner Transport contract holds on
// every page, not just /studio.
function StudioProviders({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GlobalAudioProvider>
        <InstrumentProvider>
          <StemGenerationProvider>
            <AstutelyCoreProvider>
              <StudioSessionProvider>
                <SongWorkSessionProvider>
                  <SessionDestinationProvider>
                    <GlobalAudioPlayer />
                    {children}
                    {/* Persistent DAW transport — fixed to viewport bottom, shared by every studio tab */}
                    <GlobalTransportBar />
                    {/* Press ? to see the keyboard-shortcuts cheatsheet */}
                    <KeyboardShortcutsHelp />
                    {/* First-run studio walkthrough (self-gated on localStorage) */}
                    <OnboardingTour />
                  </SessionDestinationProvider>
                </SongWorkSessionProvider>
              </StudioSessionProvider>
            </AstutelyCoreProvider>
          </StemGenerationProvider>
        </InstrumentProvider>
      </GlobalAudioProvider>
    </Suspense>
  );
}


function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Force Astutely classes on body
    document.body.className = 'astutely-app astutely-scanlines astutely-grid-bg astutely-scrollbar';
    
    // Verify required environment variable is present
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!measurementId) {
      if (import.meta.env.DEV) {
        console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
      }
    } else {
      initGA();
      if (import.meta.env.DEV) {
        console.log('🔍 Google Analytics initialized - now tracking website visitors!');
      }
    }
  }, []);

  // Validate license on app load
  useEffect(() => {
    licenseGuard.initialize();
  }, []);

  // Track page views when routes change
  useAnalytics();

  // Keep canonical URL and robots meta in sync with current route
  useCanonical();

  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black/95 text-cyan-100 astutely-app astutely-scanlines astutely-grid-bg p-6">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-500/30 bg-black/70 backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.18)]">
            <div className="absolute inset-0 pointer-events-none opacity-[0.06] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_2px]" />
            <div className="relative p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300/80">System Fault</div>
                  <div className="mt-2 text-xl font-black text-white">Something went wrong</div>
                  <div className="mt-2 text-sm text-cyan-200/70">
                    A component crashed. Refresh to recover.
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_18px_rgba(6,182,212,0.22)]" />
              </div>
              <div className="mt-6 flex items-center justify-end">
                <button
                  onClick={() => window.location.reload()}
                  className="h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 text-xs font-black uppercase tracking-widest text-cyan-100 shadow-[0_0_18px_rgba(6,182,212,0.18)] hover:bg-cyan-500/20"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DesktopBridgeProvider>
            <TrackStoreProvider>
            <TransportProvider>
            <GlobalOrganismWrapper>
            <TooltipProvider>
            <Toaster />
            {/* Cmd/Ctrl+K command palette — available everywhere, mounts only the dialog shell until invoked */}
            <CommandPalette />
            {/* GLOBAL NAVIGATION - Available on ALL pages.
                z-index scale (keep these tiers coordinated app-wide):
                  z-40  persistent chrome  — GlobalNav, studio rail, transport bar
                  z-50  modal overlays     — Radix dialog/sheet/popover, command palette
                  z-100 toasts            — above modals so confirmations are visible
                  z-200 dev/util floats   — FloatingAudioMonitor
                GlobalNav lives in the chrome tier so open modals correctly cover it
                (it was z-[9999], which floated the nav over every dialog). */}
            <GlobalNav className="fixed top-4 left-4 z-40" />
            <Suspense fallback={<LoadingFallback />}>
              <Switch>
              {/* ============================================
                  LANDING PAGE - Default route (LIGHTWEIGHT)
                  No audio providers = FAST initial load
                  ============================================ */}
              <Route path="/" component={Landing} />
              <Route path="/demo" component={DemoPage} />
              <Route path="/privacy" component={PrivacyPage} />
              <Route path="/terms" component={TermsPage} />
              
              {/* ============================================
                  LIGHTWEIGHT ROUTES - No audio providers
                  These pages load instantly
                  ============================================ */}
              <Route path="/home"><Redirect to="/" /></Route>
              <Route path="/login" component={Login} />
              <Route path="/signup" component={Signup} />
              <Route path="/activate"><ActivatePage /></Route>
              <Route path="/dashboard"><ProtectedRoute><Dashboard /></ProtectedRoute></Route>
              <Route path="/onboarding"><ProtectedRoute><OnboardingPage /></ProtectedRoute></Route>
              <Route path="/pricing" component={PricingPage} />
              <Route path="/billing"><Redirect to="/pricing" /></Route>
              <Route path="/buy-credits"><Redirect to="/pricing" /></Route>
              <Route path="/credits"><Redirect to="/pricing" /></Route>
              <Route path="/subscribe"><Redirect to="/pricing" /></Route>
              <Route path="/credits/success"><ProtectedRoute><CreditsSuccessPage /></ProtectedRoute></Route>
              <Route path="/credits/cancel"><ProtectedRoute><CreditsCancelPage /></ProtectedRoute></Route>
              <Route path="/s/:id" component={PublicSongPage} />
              <Route path="/settings">
                <ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>
              </Route>
              <Route path="/social-hub">
                <ProtectedRoute><AppLayout><SocialHub /></AppLayout></ProtectedRoute>
              </Route>
              <Route path="/profile">
                <ProtectedRoute><AppLayout><UserProfilePage /></AppLayout></ProtectedRoute>
              </Route>
              <Route path="/sitemap">
                <AppLayout><SitemapPage /></AppLayout>
              </Route>
              <Route path="/blog">
                <AppLayout><BlogPage /></AppLayout>
              </Route>
              <Route path="/blog/:slug">
                <AppLayout><BlogPostPage /></AppLayout>
              </Route>
              
              {/* ============================================
                  NON-AUDIO AI ROUTES - No StudioProviders
                  ============================================ */}
              <Route path="/vulnerability-scanner">
                <ProtectedRoute>
                  <AIMessageProvider>
                    <AppLayout><VulnerabilityScannerPage /></AppLayout>
                  </AIMessageProvider>
                </ProtectedRoute>
              </Route>
              <Route path="/voice-convert">
                <ProtectedRoute><AppLayout><VoiceConvertPage /></AppLayout></ProtectedRoute>
              </Route>
              <Route path="/sample-library">
                <ProtectedRoute><AppLayout><SampleLibraryPage /></AppLayout></ProtectedRoute>
              </Route>
              {/* Public developer funnel — cold visitors from the `webear` npm
                  package land here (no login wall). The auth-only /developer
                  page below is where keys are actually generated. */}
              <Route path="/developers"><DevelopersPage /></Route>
              <Route path="/developer">
                <ProtectedRoute><DeveloperPage /></ProtectedRoute>
              </Route>
              {/* /ai-assistant page route retired — AI Assistant is now a ⌘K overlay at
                  /studio/mix?modal=assistant. Internal callsites in GlobalNav, dashboard,
                  sitemap, studioTabs, and studioRouter all still point at /ai-assistant
                  and ride this legacy redirect. Plain <Redirect> because the destination
                  already carries a query string; if /ai-assistant ever needs to accept
                  its own params (e.g. ?prefill=…), upgrade RedirectPreservingQuery to
                  merge query strings via URLSearchParams. */}
              <Route path="/ai-assistant">
                <Redirect to="/studio/mix?modal=assistant" />
              </Route>

              {/* ============================================
                  STUDIO - Single entry point for ALL music tools
                  Heavy audio providers loaded ONLY here.
                  StudioShell owns the 4-surface routing (MAKE/MIX/SHARE/LIBRARY);
                  bare /studio redirects to the default MIX surface.
                  ============================================ */}
              <Route path="/studio"><RedirectPreservingQuery to="/studio/mix" /></Route>
              <Route path="/studio/:surface*">
                <ProtectedRoute>
                  <StudioProviders>
                    <AIMessageProvider>
                      <AppLayout><StudioShell /></AppLayout>
                    </AIMessageProvider>
                  </StudioProviders>
                </ProtectedRoute>
              </Route>

              {/* Legacy deep-links — redirect to the surface that now owns the feature.
                  Lyrics moved to MAKE per CLAUDE.md; the side-panel inside MIX is a
                  follow-up. */}
              <Route path="/lyric-lab"><Redirect to="/studio/make" /></Route>
              <Route path="/organism"><OrganismGuestPage /></Route>
              <Route path="/recording-booth">
                <ProtectedRoute><AppLayout><RecordingBoothPage /></AppLayout></ProtectedRoute>
              </Route>

              {/* ============================================
                  FEATURE LANDING PAGES — public, indexable
                  ============================================ */}
              <Route path="/pro-audio" component={ProAudioLanding} />
              <Route path="/mix-studio" component={MixStudioLanding} />
              <Route path="/daw-layout" component={DawLayoutLanding} />
              <Route path="/song-structure" component={SongStructureLanding} />

              {/* ============================================
                  LEGACY ROUTES — redirect to home (not /studio)
                  so Google doesn't hit a login wall
                  ============================================ */}
              <Route path="/music-studio"><Redirect to="/" /></Route>
              <Route path="/song-uploader"><Redirect to="/" /></Route>
              <Route path="/beat-studio"><Redirect to="/" /></Route>
              <Route path="/melody-composer"><Redirect to="/" /></Route>
              <Route path="/unified-studio"><Redirect to="/" /></Route>
              <Route path="/flow"><Redirect to="/" /></Route>
              <Route path="/code-translator"><Redirect to="/studio/mix?modal=translator" /></Route>
              <Route path="/codebeat-studio"><Redirect to="/" /></Route>
              <Route path="/pro-console"><Redirect to="/" /></Route>
              <Route path="/midi-controller"><Redirect to="/" /></Route>
              <Route path="/advanced-sequencer"><Redirect to="/" /></Route>
              <Route path="/granular-engine"><Redirect to="/" /></Route>
              <Route path="/wavetable-oscillator"><Redirect to="/" /></Route>
              <Route path="/pack-generator"><Redirect to="/" /></Route>
              <Route path="/codebeat-studio-direct"><Redirect to="/" /></Route>
              <Route path="/piano-roll"><Redirect to="/" /></Route>
              
              {/* 404 */}
              <Route component={NotFound} />
              </Switch>
            </Suspense>
          </TooltipProvider>
          <FloatingAudioMonitor />
          <IOSAudioEnable />
          </GlobalOrganismWrapper>
          </TransportProvider>
          </TrackStoreProvider>
          </DesktopBridgeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
