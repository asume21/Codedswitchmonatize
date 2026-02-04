/**
 * CODEDSWITCH LIVING GLYPH - TYPES
 * 
 * Core type definitions for the Presence Engine and Glyph states
 */

// ============================================================================
// GLYPH STATES
// ============================================================================

/** The 6 collapsed states + Wave state */
export type GlyphState =
  | 'wave'           // Undefined potential, base state
  | 'quasicrystal'   // Exploration - tool switching, feature exploration
  | 'breathing-torus' // Steady flow - consistent editing, looping playback
  | 'spiral-helix'   // Momentum - high creation velocity
  | 'superposition'  // Ambiguity - mixed signals, idle-but-active
  | 'honeycomb'      // Collaboration - multi-user activity
  | 'distortion-light'; // Deep presence - long stillness, focused listening

/** Human-readable labels for each state */
export const GLYPH_STATE_LABELS: Record<GlyphState, string> = {
  'wave': 'Wave State',
  'quasicrystal': 'Quasicrystal Heart',
  'breathing-torus': 'Breathing Torus Core',
  'spiral-helix': 'Spiral-Helix Hybrid',
  'superposition': 'Superposition Glyph',
  'honeycomb': 'Honeycomb Singularity',
  'distortion-light': 'Distortion-Light Core',
};

/** Meaning/description for each state */
export const GLYPH_STATE_MEANINGS: Record<GlyphState, string> = {
  'wave': 'Undefined potential',
  'quasicrystal': 'Exploration',
  'breathing-torus': 'Steady flow',
  'spiral-helix': 'Momentum',
  'superposition': 'Ambiguity',
  'honeycomb': 'Collaboration',
  'distortion-light': 'Deep presence',
};

// ============================================================================
// SIGNALS & METRICS
// ============================================================================

/** Raw signals collected from user interactions */
export interface UserSignals {
  // Creation velocity
  notesAdded: number;
  notesDeleted: number;
  notesMoved: number;
  lastEditTimestamp: number;
  editsInLastMinute: number;
  
  // Tool context
  currentTool: string;
  toolSwitchesInLastMinute: number;
  toolsUsedInSession: Set<string>;
  
  // Playback state
  isPlaying: boolean;
  playCount: number;
  loopCount: number;
  playbackDuration: number;
  
  // Undo/redo
  undoCount: number;
  redoCount: number;
  lastUndoTimestamp: number;
  
  // Idle time
  lastInteractionTimestamp: number;
  idleTimeMs: number;
}

/** Session-level context */
export interface SessionContext {
  sessionStartTime: number;
  sessionDurationMs: number;
  projectComplexity: number; // 0-100 based on track/note count
  modeTransitions: number;
  currentMode: string;
}

/** AI/Astutely context */
export interface AIContext {
  isGenerating: boolean;
  isAnalyzing: boolean;
  lastGenerationTimestamp: number;
  generationCount: number;
  aiMode: 'generating' | 'analyzing' | 'idle' | 'error';
  responseIntensity: number; // 0-100
  lastResponseTimeMs: number;
}

/** Collaboration context */
export interface CollaborationContext {
  activeCollaborators: number;
  simultaneousEdits: number;
  sharedPlaybackActive: boolean;
  lastCollaboratorAction: number;
}

/** All raw signals combined */
export interface RawSignals {
  user: UserSignals;
  session: SessionContext;
  ai: AIContext;
  collaboration: CollaborationContext;
  timestamp: number;
}

// ============================================================================
// INTERPRETED PATTERNS
// ============================================================================

/** Recognized signal patterns that can trigger state collapse */
export type SignalPattern =
  | 'high-velocity-playback'
  | 'stillness-long-session'
  | 'exploring-tools'
  | 'steady-rhythmic'
  | 'collaboration-active'
  | 'mixed-signals'
  | 'no-strong-pattern';

/** Interpreted pattern with confidence score */
export interface InterpretedPattern {
  pattern: SignalPattern;
  confidence: number; // 0-100
  signals: string[]; // Which signals contributed
  timestamp: number;
}

/** Pattern-to-state mapping result */
export interface PatternMapping {
  pattern: SignalPattern;
  targetState: GlyphState;
  priority: number; // Higher = more important
  requiredConfidence: number;
}

// ============================================================================
// PULSE & ANIMATION
// ============================================================================

/** Pulse mode determined by activity level */
export type PulseMode = 'slow' | 'medium' | 'fast' | 'subtle' | 'erratic';

/** Pulse parameters for the glyph */
export interface PulseParameters {
  frequency: number; // Hz
  amplitude: number; // 0-1
  brightness: number; // 0-1
  mode: PulseMode;
}

/** AI overlay state */
export type AIOverlay = 'generating' | 'analyzing' | 'idle';

/** Transition direction */
export type TransitionDirection =
  | 'wave-to-collapse'
  | 'collapse-to-collapse'
  | 'collapse-to-wave';

/** Animation configuration for a state */
export interface StateAnimationConfig {
  glowIntensity: number;
  pulseFrequency: number;
  driftAmount: number;
  geometryStability: number; // 0 = wave (unstable), 1 = collapsed (stable)
  colorHue: number;
  colorSaturation: number;
  transitionDurationMs: number;
}

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

/** Timing configuration */
export interface TimingConfig {
  evaluationIntervalMs: number; // 300-500ms
  collapseStabilityRequiredMs: number; // 2-3 seconds
  minCollapseDurationMs: number; // 3-5 seconds
  waveReturnDelayMs: number; // 2 seconds
  overrideWindowMs: number; // 1.5 seconds
}

/** Priority hierarchy for state resolution */
export const STATE_PRIORITY: GlyphState[] = [
  'honeycomb',      // 1. Collaboration (highest)
  'spiral-helix',   // 2. High velocity / deep stillness
  'distortion-light',
  'quasicrystal',   // 3. Exploration / steady work
  'breathing-torus',
  'superposition',  // 4. Mixed signals
  'wave',           // 5. No strong pattern (lowest)
];

/** Default timing configuration */
export const DEFAULT_TIMING_CONFIG: TimingConfig = {
  evaluationIntervalMs: 400,
  collapseStabilityRequiredMs: 2500,
  minCollapseDurationMs: 4000,
  waveReturnDelayMs: 2000,
  overrideWindowMs: 1500,
};

// ============================================================================
// GLYPH PROPS
// ============================================================================

/** Props for the LivingGlyph component */
export interface LivingGlyphProps {
  /** Size of the glyph in pixels */
  size?: number;
  /** Module context - biases toward module-relevant states */
  moduleContext?: string;
  /** Whether this is a global or module-level glyph */
  variant?: 'global' | 'module';
  /** Custom class name */
  className?: string;
  /** Callback when state changes */
  onStateChange?: (state: GlyphState, previousState: GlyphState) => void;
  /** Show debug overlay */
  debug?: boolean;
}

/** Props for the PresenceProvider */
export interface PresenceProviderProps {
  children: React.ReactNode;
  /** Custom timing configuration */
  timingConfig?: Partial<TimingConfig>;
  /** Enable/disable collaboration features */
  enableCollaboration?: boolean;
}

// ============================================================================
// EVENTS
// ============================================================================

/** Events that can be emitted by the Presence Engine */
export interface PresenceEvents {
  'state-change': { state: GlyphState; previousState: GlyphState; reason: string };
  'pattern-detected': { pattern: SignalPattern; confidence: number };
  'pulse-update': { parameters: PulseParameters };
  'ai-overlay': { overlay: AIOverlay };
}

/** Event emitter type */
export type PresenceEventEmitter = {
  on<K extends keyof PresenceEvents>(event: K, listener: (data: PresenceEvents[K]) => void): void;
  off<K extends keyof PresenceEvents>(event: K, listener: (data: PresenceEvents[K]) => void): void;
  emit<K extends keyof PresenceEvents>(event: K, data: PresenceEvents[K]): void;
};
