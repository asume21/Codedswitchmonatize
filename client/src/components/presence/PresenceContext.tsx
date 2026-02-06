/**
 * PRESENCE CONTEXT & HOOKS
 * 
 * React integration for the Living Glyph system.
 * Provides hooks for components to interact with the Presence Engine.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type {
  GlyphState,
  PulseParameters,
  AIOverlay,
  PresenceProviderProps,
  InterpretedPattern,
} from './types';
import { getPresenceEngine, resetPresenceEngine } from './presenceEngine';
import { getSignalCollector } from './signalCollector';
import { getAIBridge, resetAIBridge } from './aiBridge';
import type { PresenceEngine } from './presenceEngine';
import type { SignalCollector } from './signalCollector';
import type { AIBridge } from './aiBridge';

/** Context value type */
interface PresenceContextValue {
  /** Current glyph state */
  state: GlyphState;
  /** Previous glyph state */
  previousState: GlyphState;
  /** Current pulse parameters */
  pulse: PulseParameters;
  /** Current AI overlay */
  aiOverlay: AIOverlay;
  /** Current detected pattern */
  currentPattern: InterpretedPattern | null;
  /** Whether engine is running */
  isRunning: boolean;
  /** Signal collector instance */
  signalCollector: SignalCollector;
  /** Presence engine instance */
  engine: PresenceEngine;
  /** AI bridge instance */
  aiBridge: AIBridge;
  /** Force a specific state */
  forceState: (state: GlyphState, durationMs?: number) => void;
  /** Reset to wave state */
  resetState: () => void;
  /** Get state history */
  getStateHistory: (count?: number) => Array<{ state: GlyphState; timestamp: number; reason: string }>;
  /** Get debug metrics */
  getMetrics: () => Record<string, unknown>;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

/**
 * Provider component for the Presence Engine
 */
export const PresenceProvider: React.FC<PresenceProviderProps> = ({
  children,
  timingConfig,
  enableCollaboration = false,
}) => {
  const [state, setState] = useState<GlyphState>('wave');
  const [previousState, setPreviousState] = useState<GlyphState>('wave');
  const [pulse, setPulse] = useState<PulseParameters>({
    frequency: 1,
    amplitude: 0.3,
    brightness: 0.5,
    mode: 'slow',
  });
  const [aiOverlay, setAiOverlay] = useState<AIOverlay>('idle');
  const [currentPattern, setCurrentPattern] = useState<InterpretedPattern | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const engineRef = useRef(getPresenceEngine(timingConfig));
  const signalCollectorRef = useRef(getSignalCollector());
  const aiBridgeRef = useRef(getAIBridge());

  useEffect(() => {
    const engine = engineRef.current;
    const aiBridge = aiBridgeRef.current;

    // Set up event listeners
    const handleStateChange = (data: { state: GlyphState; previousState: GlyphState; reason: string }) => {
      setState(data.state);
      setPreviousState(data.previousState);
      
      // Dispatch window event for non-React components
      window.dispatchEvent(new CustomEvent('presence:state-change', { detail: data }));
    };

    const handlePulseUpdate = (data: { parameters: PulseParameters }) => {
      setPulse(data.parameters);
      window.dispatchEvent(new CustomEvent('presence:pulse-update', { detail: data }));
    };

    const handleAIOverlay = (data: { overlay: AIOverlay }) => {
      setAiOverlay(data.overlay);
      window.dispatchEvent(new CustomEvent('presence:ai-overlay', { detail: data }));
    };

    const handlePatternDetected = (data: { pattern: string; confidence: number }) => {
      const pattern = engine.getCurrentPattern();
      setCurrentPattern(pattern);
    };

    engine.on('state-change', handleStateChange);
    engine.on('pulse-update', handlePulseUpdate);
    engine.on('ai-overlay', handleAIOverlay);
    engine.on('pattern-detected', handlePatternDetected);

    // Initialize AI Bridge
    aiBridge.initialize();

    // Start the engine
    engine.start();
    setIsRunning(true);

    console.log('[PresenceProvider] Presence system initialized');

    return () => {
      engine.off('state-change', handleStateChange);
      engine.off('pulse-update', handlePulseUpdate);
      engine.off('ai-overlay', handleAIOverlay);
      engine.off('pattern-detected', handlePatternDetected);
      engine.stop();
      aiBridge.destroy();
      setIsRunning(false);
    };
  }, []);

  const forceState = useCallback((newState: GlyphState, durationMs?: number) => {
    engineRef.current.forceState(newState, durationMs);
  }, []);

  const resetState = useCallback(() => {
    engineRef.current.reset();
    setState('wave');
    setPreviousState('wave');
  }, []);

  const getStateHistory = useCallback((count?: number) => {
    return engineRef.current.getStateHistory(count);
  }, []);

  const getMetrics = useCallback(() => {
    return signalCollectorRef.current.getMetricsSummary();
  }, []);

  const value: PresenceContextValue = {
    state,
    previousState,
    pulse,
    aiOverlay,
    currentPattern,
    isRunning,
    signalCollector: signalCollectorRef.current,
    engine: engineRef.current,
    aiBridge: aiBridgeRef.current,
    forceState,
    resetState,
    getStateHistory,
    getMetrics,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
};

/**
 * Hook to access the Presence context
 */
export function usePresence(): PresenceContextValue {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}

/**
 * Hook to track signal events from a component
 */
export function usePresenceSignals() {
  const { signalCollector } = usePresence();

  return {
    /** Call when user adds/edits a note */
    onNoteAdded: useCallback(() => signalCollector.onNoteAdded(), [signalCollector]),
    /** Call when user deletes a note */
    onNoteDeleted: useCallback(() => signalCollector.onNoteDeleted(), [signalCollector]),
    /** Call when user moves a note */
    onNoteMoved: useCallback(() => signalCollector.onNoteMoved(), [signalCollector]),
    /** Call when user switches tools */
    onToolSwitch: useCallback((tool: string) => signalCollector.onToolSwitch(tool), [signalCollector]),
    /** Call when playback starts */
    onPlaybackStarted: useCallback(() => signalCollector.onPlaybackStarted(), [signalCollector]),
    /** Call when playback stops */
    onPlaybackStopped: useCallback((durationMs: number) => signalCollector.onPlaybackStopped(durationMs), [signalCollector]),
    /** Call when loop completes */
    onLoopCompleted: useCallback(() => signalCollector.onLoopCompleted(), [signalCollector]),
    /** Call on undo */
    onUndo: useCallback(() => signalCollector.onUndo(), [signalCollector]),
    /** Call on redo */
    onRedo: useCallback(() => signalCollector.onRedo(), [signalCollector]),
    /** Call on any interaction */
    onInteraction: useCallback(() => signalCollector.onInteraction(), [signalCollector]),
    /** Update project complexity */
    updateComplexity: useCallback((tracks: number, notes: number) => {
      signalCollector.updateProjectComplexity(tracks, notes);
    }, [signalCollector]),
    /** Record mode transition */
    onModeTransition: useCallback((mode: string) => signalCollector.onModeTransition(mode), [signalCollector]),
  };
}

/**
 * Hook to get current glyph state
 */
export function useGlyphState() {
  const { state, previousState, currentPattern } = usePresence();
  return { state, previousState, currentPattern };
}

/**
 * Hook to get current pulse parameters
 */
export function useGlyphPulse() {
  const { pulse } = usePresence();
  return pulse;
}

/**
 * Hook to manually control the glyph state
 */
export function useGlyphControl() {
  const { forceState, resetState } = usePresence();
  return { forceState, resetState };
}

/**
 * Hook to get presence metrics for debugging
 */
export function usePresenceMetrics() {
  const { getMetrics, state, currentPattern, pulse } = usePresence();
  
  return {
    metrics: getMetrics(),
    state,
    pattern: currentPattern,
    pulse,
  };
}

/**
 * Higher-order component to inject presence signals into a component
 */
export function withPresenceSignals<P extends object>(
  Component: React.ComponentType<P & ReturnType<typeof usePresenceSignals>>
): React.FC<P> {
  return function WithPresenceSignals(props: P) {
    const signals = usePresenceSignals();
    return <Component {...props} {...signals} />;
  };
}

/**
 * Reset all presence systems (for testing or logout)
 */
export function resetAllPresenceSystems(): void {
  resetPresenceEngine();
  resetAIBridge();
  // Signal collector is reset via engine
}
