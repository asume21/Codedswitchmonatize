import React, { Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { Redirect } from "wouter";
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
import { PresenceProvider, GlobalLivingGlyph } from "@/components/presence";
import FloatingAudioMonitor from "@/components/ui/FloatingAudioMonitor";
import { GlobalOrganismWrapper } from "@/features/organism/GlobalOrganismWrapper";
import { IOSAudioEnable } from "@/components/IOSAudioEnable";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TeaserOverlay } from "@/components/auth/TeaserOverlay";

// Lazy load heavy audio providers - only needed for studio routes
const TransportProvider = React.lazy(() => import("@/contexts/TransportContext").then(m => ({ default: m.TransportProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const TrackStoreProvider = React.lazy(() => import("@/contexts/TrackStoreContext").then(m => ({ default: m.TrackStoreProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const StemGenerationProvider = React.lazy(() => import("@/contexts/StemGenerationContext").then(m => ({ default: m.StemGenerationProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const InstrumentProvider = React.lazy(() => import("@/contexts/InstrumentContext").then(m => ({ default: m.InstrumentProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const GlobalAudioProvider = React.lazy(() => import("@/contexts/GlobalAudioContext").then(m => ({ default: m.GlobalAudioProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const StudioSessionProvider = React.lazy(() => import("@/contexts/StudioSessionContext").then(m => ({ default: m.StudioSessionProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const SongWorkSessionProvider = React.lazy(() => import("@/contexts/SongWorkSessionContext").then(m => ({ default: m.SongWorkSessionProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const SessionDestinationProvider = React.lazy(() => import("@/contexts/SessionDestinationContext").then(m => ({ default: m.SessionDestinationProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const AstutelyCoreProvider = React.lazy(() => import("@/contexts/AstutelyCoreContext").then(m => ({ default: m.AstutelyCoreProvider })).catch(() => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> })));
const GlobalAudioPlayer = React.lazy(() => import("@/components/GlobalAudioPlayer").then(m => ({ default: m.GlobalAudioPlayer })).catch(() => ({ default: () => null })));

// Eagerly loaded pages (small, frequently accessed) - FAST INITIAL LOAD
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

// Lazy loaded pages - only load when needed
const PricingPage = React.lazy(() => import("@/pages/pricing").catch(() => ({ default: () => <NotFound /> })));
const OnboardingPage = React.lazy(() => import("@/pages/onboarding").catch(() => ({ default: () => <NotFound /> })));
const Dashboard = React.lazy(() => import("@/pages/dashboard").catch(() => ({ default: () => <NotFound /> })));
const UnifiedStudioWorkspace = React.lazy(() => import("@/components/studio/UnifiedStudioWorkspace").catch(() => ({ default: () => <NotFound /> })));
const Settings = React.lazy(() => import("@/pages/settings").catch(() => ({ default: () => <NotFound /> })));
const Subscribe = React.lazy(() => import("@/pages/Subscribe").catch(() => ({ default: () => <NotFound /> })));
const AIAssistantPage = React.lazy(() => import("@/pages/ai-assistant").catch(() => ({ default: () => <NotFound /> })));
const VulnerabilityScannerPage = React.lazy(() => import("@/pages/vulnerability-scanner").catch(() => ({ default: () => <NotFound /> })));
const BuyCreditsPage = React.lazy(() => import("@/pages/buy-credits").catch(() => ({ default: () => <NotFound /> })));
const CreditsSuccessPage = React.lazy(() => import("@/pages/credits-success").catch(() => ({ default: () => <NotFound /> })));
const CreditsCancelPage = React.lazy(() => import("@/pages/credits-cancel").catch(() => ({ default: () => <NotFound /> })));
const ActivatePage = React.lazy(() => import("@/pages/activate").catch(() => ({ default: () => <NotFound /> })));
const PublicSongPage = React.lazy(() => import("@/pages/public-song").catch(() => ({ default: () => <NotFound /> })));
const SocialHub = React.lazy(() => import("@/pages/social-hub").catch(() => ({ default: () => <NotFound /> })));
const UserProfilePage = React.lazy(() => import("@/pages/user-profile").catch(() => ({ default: () => <NotFound /> })));
const SitemapPage = React.lazy(() => import("@/pages/sitemap-page").catch(() => ({ default: () => <NotFound /> })));
const VoiceConvertPage = React.lazy(() => import("@/pages/voice-convert").catch(() => ({ default: () => <NotFound /> })));
const SampleLibraryPage = React.lazy(() => import("@/pages/sample-library").catch(() => ({ default: () => <NotFound /> })));
const BlogPage = React.lazy(() => import("@/pages/blog").catch(() => ({ default: () => <NotFound /> })));
const BlogPostPage = React.lazy(() => import("@/pages/blog/[slug]").catch(() => ({ default: () => <NotFound /> })));
const DeveloperPage = React.lazy(() => import("@/pages/developer").catch(() => ({ default: () => <NotFound /> })));


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

// Studio wrapper with all audio providers - only loaded when entering studio routes
function StudioProviders({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PresenceProvider>
        <TrackStoreProvider>
          <TransportProvider>
            <GlobalAudioProvider>
              <InstrumentProvider>
                <StemGenerationProvider>
                  <AstutelyCoreProvider>
                    <StudioSessionProvider>
                      <SongWorkSessionProvider>
                        <SessionDestinationProvider>
                          <GlobalAudioPlayer />
                          <GlobalLivingGlyph position="bottom-right" size={48} />
                          {children}
                        </SessionDestinationProvider>
                      </SongWorkSessionProvider>
                    </StudioSessionProvider>
                  </AstutelyCoreProvider>
                </StemGenerationProvider>
              </InstrumentProvider>
            </GlobalAudioProvider>
          </TransportProvider>
        </TrackStoreProvider>
      </PresenceProvider>
    </Suspense>
  );
}

function LyricLabRoute() {
  useEffect(() => {
    const fire = () =>
      window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'lyrics' }));
    fire();
    window.setTimeout(fire, 0);
  }, []);

  return <UnifiedStudioWorkspace />;
}

function OrganismRoute() {
  useEffect(() => {
    const fire = () =>
      window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'organism' }));
    fire();
    window.setTimeout(fire, 0);
  }, []);

  return <UnifiedStudioWorkspace />;
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
          <GlobalOrganismWrapper>
          <TooltipProvider>
            <Toaster />
            {/* GLOBAL NAVIGATION - Available on ALL pages */}
            <GlobalNav className="fixed top-4 left-4 z-[9999]" />
            <Suspense fallback={<LoadingFallback />}>
              <Switch>
              {/* ============================================
                  LANDING PAGE - Default route (LIGHTWEIGHT)
                  No audio providers = FAST initial load
                  ============================================ */}
              <Route path="/" component={Landing} />
              
              {/* ============================================
                  LIGHTWEIGHT ROUTES - No audio providers
                  These pages load instantly
                  ============================================ */}
              <Route path="/home" component={Landing} />
              <Route path="/login" component={Login} />
              <Route path="/signup" component={Signup} />
              <Route path="/activate"><ActivatePage /></Route>
              <Route path="/dashboard"><ProtectedRoute><Dashboard /></ProtectedRoute></Route>
              <Route path="/onboarding"><ProtectedRoute><OnboardingPage /></ProtectedRoute></Route>
              <Route path="/pricing"><ProtectedRoute><PricingPage /></ProtectedRoute></Route>
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
              <Route path="/developer">
                <ProtectedRoute><DeveloperPage /></ProtectedRoute>
              </Route>
              <Route path="/ai-assistant">
                <ProtectedRoute>
                  <AIMessageProvider>
                    <AppLayout><AIAssistantPage /></AppLayout>
                  </AIMessageProvider>
                </ProtectedRoute>
              </Route>
              
              {/* ============================================
                  STUDIO - Single entry point for ALL music tools
                  Heavy audio providers loaded ONLY here
                  ============================================ */}
              <Route path="/studio">
                <ProtectedRoute teaserMode>
                  <StudioProviders>
                    <AIMessageProvider>
                      <TeaserOverlay />
                      <AppLayout><UnifiedStudioWorkspace /></AppLayout>
                    </AIMessageProvider>
                  </StudioProviders>
                </ProtectedRoute>
              </Route>

              {/* Lyric Lab - Special route that opens lyrics tab */}
              <Route path="/lyric-lab">
                <ProtectedRoute teaserMode>
                  <StudioProviders>
                    <AIMessageProvider>
                      <TeaserOverlay />
                      <AppLayout><LyricLabRoute /></AppLayout>
                    </AIMessageProvider>
                  </StudioProviders>
                </ProtectedRoute>
              </Route>

              {/* Organism - opens studio directly on Organism tab */}
              <Route path="/organism">
                <ProtectedRoute teaserMode>
                  <StudioProviders>
                    <AIMessageProvider>
                      <TeaserOverlay />
                      <AppLayout><OrganismRoute /></AppLayout>
                    </AIMessageProvider>
                  </StudioProviders>
                </ProtectedRoute>
              </Route>

              {/* ============================================
                  LEGACY STUDIO ROUTES - Redirect to /studio
                  Keeps old bookmarks working
                  ============================================ */}
              <Route path="/music-studio"><Redirect to="/studio" /></Route>
              <Route path="/song-uploader"><Redirect to="/studio" /></Route>
              <Route path="/beat-studio"><Redirect to="/studio" /></Route>
              <Route path="/melody-composer"><Redirect to="/studio" /></Route>
              <Route path="/unified-studio"><Redirect to="/studio" /></Route>
              <Route path="/daw-layout"><Redirect to="/studio" /></Route>
              <Route path="/flow"><Redirect to="/studio" /></Route>
              <Route path="/code-translator"><Redirect to="/studio" /></Route>
              <Route path="/codebeat-studio"><Redirect to="/studio" /></Route>
              <Route path="/mix-studio"><Redirect to="/studio" /></Route>
              <Route path="/pro-console"><Redirect to="/studio" /></Route>
              <Route path="/midi-controller"><Redirect to="/studio" /></Route>
              <Route path="/advanced-sequencer"><Redirect to="/studio" /></Route>
              <Route path="/granular-engine"><Redirect to="/studio" /></Route>
              <Route path="/wavetable-oscillator"><Redirect to="/studio" /></Route>
              <Route path="/pack-generator"><Redirect to="/studio" /></Route>
              <Route path="/song-structure"><Redirect to="/studio" /></Route>
              <Route path="/pro-audio"><Redirect to="/studio" /></Route>
              <Route path="/codebeat-studio-direct"><Redirect to="/studio" /></Route>
              <Route path="/piano-roll"><Redirect to="/studio" /></Route>
              
              {/* 404 */}
              <Route component={NotFound} />
              </Switch>
            </Suspense>
          </TooltipProvider>
          <FloatingAudioMonitor />
          <IOSAudioEnable />
          </GlobalOrganismWrapper>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
