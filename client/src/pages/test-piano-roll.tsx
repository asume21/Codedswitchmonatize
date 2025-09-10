import React, { useEffect } from 'react';
import { VerticalPianoRoll } from '@/components/studio/VerticalPianoRoll.new';
import '@/styles/piano-roll-styles.css';

export default function TestPianoRoll() {
  // Update viewport meta tag on component mount
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }
  }, []);

  return (
    <div className="piano-roll-container h-screen w-full bg-gray-900">
      <VerticalPianoRoll />
    </div>
  );
}
