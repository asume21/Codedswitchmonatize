/**
 * CODEDSWITCH PRESENCE ENGINE - INDEX
 * 
 * Central export point for the Living Glyph and Presence Engine system.
 */

// Types
export type {
  GlyphState,
  RawSignals,
  UserSignals,
  SessionContext,
  AIContext,
  CollaborationContext,
  SignalPattern,
  InterpretedPattern,
  PatternMapping,
  PulseParameters,
  PulseMode,
  AIOverlay,
  TransitionDirection,
  StateAnimationConfig,
  TimingConfig,
  LivingGlyphProps,
  PresenceProviderProps,
  PresenceEvents,
} from './types';

// Constants
export {
  GLYPH_STATE_LABELS,
  GLYPH_STATE_MEANINGS,
  STATE_PRIORITY,
  DEFAULT_TIMING_CONFIG,
} from './types';

// Core classes
export { SignalCollector, getSignalCollector, resetSignalCollector } from './signalCollector';
export { SignalInterpreter, getSignalInterpreter, resetSignalInterpreter } from './signalInterpreter';
export { PresenceEngine, getPresenceEngine, resetPresenceEngine } from './presenceEngine';
export { AIBridge, getAIBridge, resetAIBridge, dispatchAstutelyEvent } from './aiBridge';

// React components and hooks
export { LivingGlyph } from './LivingGlyph';
export { GlobalLivingGlyph } from './GlobalLivingGlyph';
export {
  StudioPresenceWrapper,
  useStudioPresence,
  withStudioPresence,
} from './StudioPresenceWrapper';
export {
  PresenceProvider,
  usePresence,
  usePresenceSignals,
  useGlyphState,
  useGlyphPulse,
  useGlyphControl,
  usePresenceMetrics,
  withPresenceSignals,
  resetAllPresenceSystems,
} from './PresenceContext';

// CSS (import in your main CSS file)
// import './LivingGlyph.css';
