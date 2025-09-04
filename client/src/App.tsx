import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/layout/navigation";
import { PluginManager } from "@/components/layout/PluginManager";
import { usePluginManager } from "@/hooks/usePluginManager";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Studio from "@/pages/studio";
import Subscribe from "@/pages/Subscribe";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import TestCircular from "@/pages/TestCircular";
import ProAudio from "@/pages/pro-audio";
import CodeBeatStudio from "@/pages/codebeat-studio";
import BillingResult from "@/pages/billing-result";
import MelodyComposerV2Page from "@/pages/melody-composer-v2";
import CodeToMusicStudioPage from "@/pages/code-to-music-studio";
import { useEffect, useState } from "react";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

function Router() {
  // Track page views when routes change
  useAnalytics();
  
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/music-studio" component={Studio} />
      <Route path="/song-uploader" component={Studio} />
      <Route path="/beat-studio" component={Studio} />
      <Route path="/melody-composer" component={Studio} />
      <Route path="/unified-studio" component={Studio} />
      <Route path="/code-translator" component={Studio} />
      <Route path="/codebeat-studio" component={Studio} />
      <Route path="/lyric-lab" component={Studio} />
      <Route path="/vulnerability-scanner" component={Studio} />
      <Route path="/ai-assistant" component={Studio} />
      <Route path="/mix-studio" component={Studio} />
      <Route path="/pro-console" component={Studio} />
      <Route path="/midi-controller" component={Studio} />
      <Route path="/advanced-sequencer" component={Studio} />
      <Route path="/granular-engine" component={Studio} />
      <Route path="/wavetable-oscillator" component={Studio} />
      <Route path="/pack-generator" component={Studio} />
      <Route path="/song-structure" component={Studio} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/billing/success" component={PaymentSuccess} />
      <Route path="/billing/cancel" component={PaymentCancel} />
      <Route path="/settings" component={Studio} />
      <Route path="/studio" component={Studio} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/test-circular" component={TestCircular} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { plugins, togglePlugin } = usePluginManager();
  const [showPluginManager, setShowPluginManager] = useState(false);

  return (
    <div className="flex h-screen">
      <div className="w-64 bg-background border-r">
        <div className="p-4">
          <Button
            onClick={() => setShowPluginManager(!showPluginManager)}
            className="w-full flex items-center gap-2"
            variant={showPluginManager ? "default" : "outline"}
          >
            <Settings className="w-4 h-4" />
            Plugin Manager
          </Button>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <Navigation />
        <main className="flex-1 overflow-x-auto overflow-y-auto">
          {showPluginManager ? (
            <PluginManager plugins={plugins} onTogglePlugin={togglePlugin} />
          ) : (
            <div className="min-w-[1400px] w-full h-full">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
      console.log('🔍 Google Analytics initialized - now tracking website visitors!');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="/" component={Landing} />
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
          <Route path="/melody-composer-v2">
            <AppLayout>
              <MelodyComposerV2Page />
            </AppLayout>
          </Route>
          <Route path="/code-to-music-studio">
            <AppLayout>
              <CodeToMusicStudioPage />
            </AppLayout>
          </Route>
          <Route path="*">
            <AppLayout>
              <Router />
            </AppLayout>
          </Route>
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
