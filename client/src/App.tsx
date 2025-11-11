import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Maintenance from "@/pages/maintenance";
import { useEffect } from "react";
import { initGA } from "@/lib/analytics";

// MAINTENANCE MODE - Set to false to restore normal site
const MAINTENANCE_MODE = true;

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    if (!(import.meta as any).env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
      console.log('🔍 Google Analytics initialized');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Maintenance />
    </QueryClientProvider>
  );
}

export default App;
