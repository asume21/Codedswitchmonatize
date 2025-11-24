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

// Eagerly loaded pages (small, frequently accessed)
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

// Lazy loaded pages (large, less frequently accessed)
const Studio = React.lazy(() => import("@/pages/studio"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const UnifiedStudioWorkspace = React.lazy(() => import("@/components/studio/UnifiedStudioWorkspace"));
const DAWLayoutWorkspace = React.lazy(() => import("@/components/studio/DAWLayoutWorkspace"));
const Settings = React.lazy(() => import("@/pages/settings"));
const Subscribe = React.lazy(() => import("@/pages/Subscribe"));
const ProAudio = React.lazy(() => import("@/pages/pro-audio"));
const CodeBeatStudio = React.lazy(() => import("@/pages/codebeat-studio"));
const AIAssistantPage = React.lazy(() => import("@/pages/ai-assistant"));
const DesignPlayground = React.lazy(() => import("@/pages/design-playground"));
const TestPianoRoll = React.lazy(() => import("@/pages/test-piano-roll"));
const TestCircular = React.lazy(() => import("@/pages/TestCircular"));
const BuyCreditsPage = React.lazy(() => import("@/pages/buy-credits"));
const CreditsSuccessPage = React.lazy(() => import("@/pages/credits-success"));
const CreditsCancelPage = React.lazy(() => import("@/pages/credits-cancel"));
const ActivatePage = React.lazy(() => import("@/pages/activate"));

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
          <div className="min-w-[1400px] w-full h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!(import.meta as any).env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
      console.log('🔍 Google Analytics initialized - now tracking website visitors!');
    }
  }, []);

  // Track page views when routes change
  useAnalytics();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TransportProvider>
          <TrackStoreProvider>
            <SongWorkSessionProvider>
              <TooltipProvider>
                <Toaster />
                <Suspense fallback={<LoadingFallback />}>
                <Switch>
                  <Route path="/" component={Landing} />
                  <Route path="/home" component={Landing} />
                  <Route path="/studio">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
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
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/song-uploader">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/beat-studio">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/melody-composer">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/unified-studio">
                    <div className="h-screen w-screen bg-background">
                      <UnifiedStudioWorkspace />
                    </div>
                  </Route>
                  <Route path="/daw-layout">
                    <div className="h-screen w-screen bg-background">
                      <DAWLayoutWorkspace />
                    </div>
                  </Route>
                  <Route path="/code-translator">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/codebeat-studio">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/lyric-lab">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/vulnerability-scanner">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/ai-assistant">
                    <AppLayout>
                      <AIAssistantPage />
                    </AppLayout>
                  </Route>
                  <Route path="/mix-studio">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/pro-console">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/midi-controller">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/advanced-sequencer">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/granular-engine">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/wavetable-oscillator">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/pack-generator">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/song-structure">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
                  </Route>
                  <Route path="/pro-audio">
                    <AppLayout>
                      <ProAudio />
                    </AppLayout>
                  </Route>
                  <Route path="/codebeat-studio-direct">
                    <AppLayout>
                      <CodeBeatStudio />
                    </AppLayout>
                  </Route>
                  <Route path="/billing" component={Subscribe} />
                  <Route path="/settings">
                    <AppLayout>
                      <Settings />
                    </AppLayout>
                  </Route>
                  <Route path="/studio">
                    <AppLayout>
                      <Studio />
                    </AppLayout>
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
                  <Route component={NotFound} />
                </Switch>
                </Suspense>
              </TooltipProvider>
            </SongWorkSessionProvider>
          </TrackStoreProvider>
        </TransportProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
