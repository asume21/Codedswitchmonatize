import React, { Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { AuthProvider } from "@/contexts/AuthContext";
import { AIMessageProvider } from "@/contexts/AIMessageContext";
import { licenseGuard } from "@/lib/LicenseGuard";
import { GlobalNav } from "@/components/layout/GlobalNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy load heavy audio providers - only needed for studio routes
const TransportProvider = React.lazy(() => import("@/contexts/TransportContext").then(m => ({ default: m.TransportProvider })));
const TrackStoreProvider = React.lazy(() => import("@/contexts/TrackStoreContext").then(m => ({ default: m.TrackStoreProvider })));
const InstrumentProvider = React.lazy(() => import("@/contexts/InstrumentContext").then(m => ({ default: m.InstrumentProvider })));
const GlobalAudioProvider = React.lazy(() => import("@/contexts/GlobalAudioContext").then(m => ({ default: m.GlobalAudioProvider })));
const StudioSessionProvider = React.lazy(() => import("@/contexts/StudioSessionContext").then(m => ({ default: m.StudioSessionProvider })));
const SongWorkSessionProvider = React.lazy(() => import("@/contexts/SongWorkSessionContext").then(m => ({ default: m.SongWorkSessionProvider })));
const SessionDestinationProvider = React.lazy(() => import("@/contexts/SessionDestinationContext").then(m => ({ default: m.SessionDestinationProvider })));
const GlobalAudioPlayer = React.lazy(() => import("@/components/GlobalAudioPlayer").then(m => ({ default: m.GlobalAudioPlayer })));

// Eagerly loaded pages (small, frequently accessed) - FAST INITIAL LOAD
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

// Lazy loaded pages - only load when needed
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const UnifiedStudioWorkspace = React.lazy(() => import("@/components/studio/UnifiedStudioWorkspace"));
const Settings = React.lazy(() => import("@/pages/settings"));
const Subscribe = React.lazy(() => import("@/pages/Subscribe"));
const AIAssistantPage = React.lazy(() => import("@/pages/ai-assistant"));
const VulnerabilityScannerPage = React.lazy(() => import("@/pages/vulnerability-scanner"));
const BuyCreditsPage = React.lazy(() => import("@/pages/buy-credits"));
const CreditsSuccessPage = React.lazy(() => import("@/pages/credits-success"));
const CreditsCancelPage = React.lazy(() => import("@/pages/credits-cancel"));
const ActivatePage = React.lazy(() => import("@/pages/activate"));
const PublicSongPage = React.lazy(() => import("@/pages/public-song"));
const SocialHub = React.lazy(() => import("@/pages/social-hub"));
const UserProfilePage = React.lazy(() => import("@/pages/user-profile"));


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
        <main id="main-content" className="flex-1 overflow-x-auto overflow-y-auto" role="main">
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
      <TransportProvider>
        <GlobalAudioProvider>
          <InstrumentProvider>
            <TrackStoreProvider>
              <StudioSessionProvider>
                <SongWorkSessionProvider>
                  <SessionDestinationProvider>
                    <GlobalAudioPlayer />
                    {children}
                  </SessionDestinationProvider>
                </SongWorkSessionProvider>
              </StudioSessionProvider>
            </TrackStoreProvider>
          </InstrumentProvider>
        </GlobalAudioProvider>
      </TransportProvider>
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
              <Route path="/dashboard"><Dashboard /></Route>
              <Route path="/billing" component={BuyCreditsPage} />
              <Route path="/buy-credits" component={BuyCreditsPage} />
              <Route path="/credits" component={BuyCreditsPage} />
              <Route path="/credits/success" component={CreditsSuccessPage} />
              <Route path="/credits/cancel" component={CreditsCancelPage} />
              <Route path="/subscribe" component={Subscribe} />
              <Route path="/s/:id" component={PublicSongPage} />
              <Route path="/settings">
                <AppLayout><Settings /></AppLayout>
              </Route>
              <Route path="/social-hub">
                <AppLayout><SocialHub /></AppLayout>
              </Route>
              <Route path="/profile">
                <AppLayout><UserProfilePage /></AppLayout>
              </Route>
              
              {/* ============================================
                  NON-AUDIO AI ROUTES - No StudioProviders
                  ============================================ */}
              <Route path="/vulnerability-scanner">
                <AIMessageProvider>
                  <AppLayout><VulnerabilityScannerPage /></AppLayout>
                </AIMessageProvider>
              </Route>
              <Route path="/ai-assistant">
                <AIMessageProvider>
                  <AppLayout><AIAssistantPage /></AppLayout>
                </AIMessageProvider>
              </Route>
              
              {/* ============================================
                  STUDIO - Single entry point for ALL music tools
                  Heavy audio providers loaded ONLY here
                  ============================================ */}
              <Route path="/studio">
                <StudioProviders>
                  <AIMessageProvider>
                    <AppLayout><UnifiedStudioWorkspace /></AppLayout>
                  </AIMessageProvider>
                </StudioProviders>
              </Route>
              
              {/* Lyric Lab - Special route that opens lyrics tab */}
              <Route path="/lyric-lab">
                <StudioProviders>
                  <AIMessageProvider>
                    <AppLayout><LyricLabRoute /></AppLayout>
                  </AIMessageProvider>
                </StudioProviders>
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
              <Route path="/design-playground"><Redirect to="/studio" /></Route>
              
              {/* 404 */}
              <Route component={NotFound} />
              </Switch>
            </Suspense>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
