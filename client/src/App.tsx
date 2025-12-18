import React, { Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/layout/navigation";
import { TransportProvider } from "@/contexts/TransportContext";
import { TrackStoreProvider } from "@/contexts/TrackStoreContext";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { AuthProvider } from "@/contexts/AuthContext";
import { SongWorkSessionProvider } from "@/contexts/SongWorkSessionContext";
import { AIMessageProvider } from "@/contexts/AIMessageContext";
import { GlobalAudioProvider } from "@/contexts/GlobalAudioContext";
import { StudioSessionProvider } from "@/contexts/StudioSessionContext";
import { SessionDestinationProvider } from "@/contexts/SessionDestinationContext";
import { licenseGuard } from "@/lib/LicenseGuard";
import { GlobalNav } from "@/components/layout/GlobalNav";
import { GlobalAudioPlayer } from "@/components/GlobalAudioPlayer";

// Eagerly loaded pages (small, frequently accessed)
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

// Lazy loaded pages (large, less frequently accessed)
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const UnifiedStudioWorkspace = React.lazy(() => import("@/components/studio/UnifiedStudioWorkspace"));
const Settings = React.lazy(() => import("@/pages/settings"));
const Subscribe = React.lazy(() => import("@/pages/Subscribe"));
const ProAudio = React.lazy(() => import("@/pages/pro-audio"));
const AIAssistantPage = React.lazy(() => import("@/pages/ai-assistant"));
const VulnerabilityScannerPage = React.lazy(() => import("@/pages/vulnerability-scanner"));
const DesignPlayground = React.lazy(() => import("@/pages/design-playground"));
const TestPianoRoll = React.lazy(() => import("@/pages/test-piano-roll"));
const TestCircular = React.lazy(() => import("@/pages/TestCircular"));
const CodedSwitchFlow = React.lazy(() => import("@/components/layout/CodedSwitchFlow"));
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
        <main className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="w-full h-full">{children}</div>
        </main>
      </div>
    </div>
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
        <TransportProvider>
          <GlobalAudioProvider>
            <TrackStoreProvider>
              <StudioSessionProvider>
                <SongWorkSessionProvider>
                  <SessionDestinationProvider>
                    <TooltipProvider>
                    <Toaster />
                    {/* GLOBAL NAVIGATION - Available on ALL pages */}
                    <GlobalNav className="fixed top-4 left-4 z-[9999]" />
                    {/* GLOBAL AUDIO PLAYER - Persists across all pages */}
                    <GlobalAudioPlayer />
                    <Suspense fallback={<LoadingFallback />}>
                    <Switch>
                  <Route path="/">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/home" component={Landing} />
                  <Route path="/login" component={Login} />
                  <Route path="/signup" component={Signup} />
                  <Route path="/activate">
                    <ActivatePage />
                  </Route>
                  <Route path="/design-playground">
                    <DesignPlayground />
                  </Route>
                  <Route path="/dashboard">
                    <Dashboard />
                  </Route>
                  <Route path="/music-studio">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/song-uploader">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/beat-studio">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/melody-composer">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/unified-studio">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/daw-layout">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/flow">
                    <CodedSwitchFlow />
                  </Route>
                  <Route path="/code-translator">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/codebeat-studio">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/lyric-lab">
                    <AIMessageProvider>
                      <AppLayout>
                        <LyricLabRoute />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/vulnerability-scanner">
                    <AppLayout>
                      <VulnerabilityScannerPage />
                    </AppLayout>
                  </Route>
                  <Route path="/ai-assistant">
                    <AppLayout>
                      <AIAssistantPage />
                    </AppLayout>
                  </Route>
                  <Route path="/mix-studio">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/pro-console">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/midi-controller">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/advanced-sequencer">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/granular-engine">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/wavetable-oscillator">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/pack-generator">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/song-structure">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/pro-audio">
                    <AppLayout>
                      <ProAudio />
                    </AppLayout>
                  </Route>
                  <Route path="/codebeat-studio-direct">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/billing" component={BuyCreditsPage} />
                  <Route path="/settings">
                    <AppLayout>
                      <Settings />
                    </AppLayout>
                  </Route>
                  <Route path="/studio">
                    <AIMessageProvider>
                      <AppLayout>
                        <UnifiedStudioWorkspace />
                      </AppLayout>
                    </AIMessageProvider>
                  </Route>
                  <Route path="/subscribe" component={Subscribe} />
                  <Route path="/test-circular" component={TestCircular} />
                  <Route path="/piano-roll">
                    <div className="h-screen w-screen bg-background">
                      <TestPianoRoll />
                    </div>
                  </Route>
                  <Route path="/buy-credits" component={BuyCreditsPage} />
                  <Route path="/credits/success" component={CreditsSuccessPage} />
                  <Route path="/credits/cancel" component={CreditsCancelPage} />
                  <Route path="/credits" component={BuyCreditsPage} />
                  <Route path="/s/:id" component={PublicSongPage} />
                  <Route path="/social-hub">
                    <AppLayout>
                      <SocialHub />
                    </AppLayout>
                  </Route>
                  <Route path="/profile">
                    <AppLayout>
                      <UserProfilePage />
                    </AppLayout>
                  </Route>
                  <Route component={NotFound} />
                    </Switch>
                    </Suspense>
                    </TooltipProvider>
                  </SessionDestinationProvider>
                </SongWorkSessionProvider>
              </StudioSessionProvider>
            </TrackStoreProvider>
          </GlobalAudioProvider>
        </TransportProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
