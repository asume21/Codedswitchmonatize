import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { VerticalPianoRoll } from '@/components/studio/VerticalPianoRoll.new';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import '@/styles/piano-roll-styles.css';

export default function TestPianoRoll() {
  const [, setLocation] = useLocation();

  // Update viewport meta tag on component mount
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }
  }, []);

  return (
    <div className="piano-roll-container h-screen w-full bg-gray-900 relative">
      <Button
        variant="default"
        size="sm"
        className="absolute top-4 right-4 z-50"
        onClick={() => setLocation('/')}
        data-testid="button-back-to-home"
      >
        <Home className="h-4 w-4 mr-2" />
        Back to Home
      </Button>
      <VerticalPianoRoll />
    </div>
  );
}
