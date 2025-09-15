import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/layout/navigation";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import UserProfile from "@/pages/user-profile";
import SocialHub from "@/pages/social-hub";
import Dashboard from "@/pages/dashboard";
import Studio from "@/pages/studio";
import Subscribe from "@/pages/Subscribe";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import TestCircular from "@/pages/TestCircular";
import ProAudio from "@/pages/pro-audio";
import CodeBeatStudio from "@/pages/codebeat-studio";
import MelodyComposerV2Page from "@/pages/melody-composer-v2";
import CodeToMusicStudioPage from "@/pages/code-to-music-studio";
import { useEffect } from "react";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";

// Import the missing components
import CodeTranslator from "@/components/studio/CodeTranslator";
import VulnerabilityScanner from "@/components/studio/VulnerabilityScanner";
import { MIDIController } from "@/components/studio/MIDIController";
import HybridWorkflow from "@/components/studio/HybridWorkflow";
import LyricLab from "@/components/studio/LyricLab";
import Header from "@/components/studio/Header";
import TestPianoRoll from "@/pages/test-piano-roll";
import SnakeIOPage from "@/pages/snake-io";

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
      <Route path="/melody-composer-v2" component={MelodyComposerV2Page} />
      <Route path="/unified-studio" component={Studio} />
      <Route path="/code-translator" component={CodeTranslator} />
      <Route path="/codebeat-studio" component={Studio} />
      <Route path="/lyric-lab" component={Studio} />
      <Route path="/vulnerability-scanner" component={VulnerabilityScanner} />
      <Route path="/ai-assistant" component={Studio} />
      <Route path="/mix-studio" component={Studio} />
      <Route path="/pro-console" component={Studio} />
      <Route path="/midi-controller" component={MIDIController} />
      <Route path="/advanced-sequencer" component={Studio} />
      <Route path="/granular-engine" component={Studio} />
      <Route path="/wavetable-oscillator" component={Studio} />
      <Route path="/pack-generator" component={Studio} />
      <Route path="/song-structure" component={Studio} />
      <Route path="/social-hub" component={SocialHub} />
      <Route path="/test-piano-roll" component={TestPianoRoll} />
      <Route path="/snake-io" component={SnakeIOPage} />
      <Route path="/profile" component={UserProfile} />
      <Route path="/user-profile" component={UserProfile} />
      <Route path="/hybrid-workflow" component={HybridWorkflow} />
      <Route path="/lyric-lab" component={LyricLab} />
      <Route path="/header" component={Header} />
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
        <Navigation />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
