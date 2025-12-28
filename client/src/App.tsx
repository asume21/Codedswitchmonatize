import React, { Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/layout/navigation";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { AuthProvider } from "@/contexts/AuthContext";
import { AIMessageProvider } from "@/contexts/AIMessageContext";
import { licenseGuard } from "@/lib/LicenseGuard";
import { GlobalNav } from "@/components/layout/GlobalNav";

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
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <Navigation />
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
    // Verify required environment variable is present
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!measurementId) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
      console.log('🔍 Google Analytics initialized - now tracking website visitors!');
    }
  }, []);

  // Validate license on app load
  useEffect(() => {
    licenseGuard.initialize();
  }, []);

  // Track page views when routes change
  useAnalytics();

  return (
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
  );
}

export default App;
