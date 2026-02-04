/**
 * STUDIO PRESENCE WRAPPER
 * 
 * Wraps studio components to track user interactions and feed them
 * to the Presence Engine. Tracks note editing, playback, tool switches, etc.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { usePresenceSignals } from './PresenceContext';

interface StudioPresenceWrapperProps {
  children: React.ReactNode;
  moduleName: string;
}

export const StudioPresenceWrapper: React.FC<StudioPresenceWrapperProps> = ({
  children,
  moduleName,
}) => {
  const signals = usePresenceSignals();
  const playbackStartTime = useRef<number | null>(null);

  // Track tool switch when module changes
  useEffect(() => {
    signals.onToolSwitch(moduleName);
  }, [moduleName, signals]);

  // Set up global event listeners for studio interactions
  useEffect(() => {
    // Track note-related events
    const handleNoteAdded = () => signals.onNoteAdded();
    const handleNoteDeleted = () => signals.onNoteDeleted();
    const handleNoteMoved = () => signals.onNoteMoved();
    
    // Track playback events
    const handlePlaybackStarted = () => {
      playbackStartTime.current = Date.now();
      signals.onPlaybackStarted();
    };
    
    const handlePlaybackStopped = () => {
      const duration = playbackStartTime.current 
        ? Date.now() - playbackStartTime.current 
        : 0;
      signals.onPlaybackStopped(duration);
      playbackStartTime.current = null;
    };
    
    const handleLoopCompleted = () => signals.onLoopCompleted();
    
    // Track undo/redo events
    const handleUndo = () => signals.onUndo();
    const handleRedo = () => signals.onRedo();
    
    // Track general interaction
    const handleInteraction = () => signals.onInteraction();

    // Add event listeners
    window.addEventListener('studio:noteAdded', handleNoteAdded);
    window.addEventListener('studio:noteDeleted', handleNoteDeleted);
    window.addEventListener('studio:noteMoved', handleNoteMoved);
    window.addEventListener('studio:playbackStarted', handlePlaybackStarted);
    window.addEventListener('studio:playbackStopped', handlePlaybackStopped);
    window.addEventListener('studio:loopCompleted', handleLoopCompleted);
    window.addEventListener('studio:undo', handleUndo);
    window.addEventListener('studio:redo', handleRedo);
    
    // Track any click/touch as interaction
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    return () => {
      window.removeEventListener('studio:noteAdded', handleNoteAdded);
      window.removeEventListener('studio:noteDeleted', handleNoteDeleted);
      window.removeEventListener('studio:noteMoved', handleNoteMoved);
      window.removeEventListener('studio:playbackStarted', handlePlaybackStarted);
      window.removeEventListener('studio:playbackStopped', handlePlaybackStopped);
      window.removeEventListener('studio:loopCompleted', handleLoopCompleted);
      window.removeEventListener('studio:undo', handleUndo);
      window.removeEventListener('studio:redo', handleRedo);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [signals]);

  // Update project complexity periodically
  useEffect(() => {
    const interval = setInterval(() => {
      // Try to get track/note info from window or context
      const trackCount = (window as any).__STUDIO_TRACK_COUNT__ || 0;
      const noteCount = (window as any).__STUDIO_NOTE_COUNT__ || 0;
      signals.updateComplexity(trackCount, noteCount);
    }, 5000);

    return () => clearInterval(interval);
  }, [signals]);

  return <>{children}</>;
};

/**
 * Hook to dispatch studio events for presence tracking
 */
export function useStudioPresence() {
  const dispatchEvent = useCallback((eventName: string, detail?: any) => {
    window.dispatchEvent(new CustomEvent(`studio:${eventName}`, { detail }));
  }, []);

  return {
    // Note events
    noteAdded: useCallback(() => dispatchEvent('noteAdded'), [dispatchEvent]),
    noteDeleted: useCallback(() => dispatchEvent('noteDeleted'), [dispatchEvent]),
    noteMoved: useCallback(() => dispatchEvent('noteMoved'), [dispatchEvent]),
    
    // Playback events
    playbackStarted: useCallback(() => dispatchEvent('playbackStarted'), [dispatchEvent]),
    playbackStopped: useCallback(() => dispatchEvent('playbackStopped'), [dispatchEvent]),
    loopCompleted: useCallback(() => dispatchEvent('loopCompleted'), [dispatchEvent]),
    
    // Edit events
    undo: useCallback(() => dispatchEvent('undo'), [dispatchEvent]),
    redo: useCallback(() => dispatchEvent('redo'), [dispatchEvent]),
    
    // Tool switch
    toolSwitch: useCallback((tool: string) => dispatchEvent('toolSwitch', { tool }), [dispatchEvent]),
    
    // Update complexity
    updateComplexity: useCallback((tracks: number, notes: number) => {
      (window as any).__STUDIO_TRACK_COUNT__ = tracks;
      (window as any).__STUDIO_NOTE_COUNT__ = notes;
    }, []),
  };
}

/**
 * Higher-order component to wrap a studio component with presence tracking
 */
export function withStudioPresence<P extends object>(
  Component: React.ComponentType<P>,
  moduleName: string
): React.FC<P> {
  return function WithStudioPresence(props: P) {
    return (
      <StudioPresenceWrapper moduleName={moduleName}>
        <Component {...props} />
      </StudioPresenceWrapper>
    );
  };
}

export default StudioPresenceWrapper;
