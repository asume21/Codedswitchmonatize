import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/layout/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Studio from "@/pages/studio";
import Subscribe from "@/pages/Subscribe";
import TestCircular from "@/pages/TestCircular";
import ProAudio from "@/pages/pro-audio";
import CodeBeatStudio from "@/pages/codebeat-studio";
import Settings from "@/pages/settings";
import { useEffect } from "react";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { AuthProvider } from "@/contexts/AuthContext";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
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
        <TooltipProvider>
          <Toaster />
          <Switch>
          <Route path="/" component={Landing} />
          <Route path="/dashboard" component={Dashboard} />
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
            <AppLayout>
              <Studio />
            </AppLayout>
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
              <Studio />
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
          <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
