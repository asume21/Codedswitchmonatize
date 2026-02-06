/**
 * PRESENCE ENGINE (State Resolver)
 * 
 * Determines the current glyph state based on signal patterns,
 * timing rules, and priority hierarchy.
 */

import type {
  GlyphState,
  RawSignals,
  InterpretedPattern,
  TimingConfig,
  PresenceEvents,
  AIOverlay,
  PulseParameters,
  PulseMode,
} from './types';
import { SignalCollector, getSignalCollector } from './signalCollector';
import { SignalInterpreter, getSignalInterpreter } from './signalInterpreter';
import { DEFAULT_TIMING_CONFIG, STATE_PRIORITY } from './types';

/** State change with metadata */
interface StateChange {
  state: GlyphState;
  timestamp: number;
  reason: string;
  pattern?: InterpretedPattern;
}

/** Simple event emitter implementation */
class EventEmitter {
  private listeners: Map<keyof PresenceEvents, Set<(data: any) => void>> = new Map();

  on<K extends keyof PresenceEvents>(event: K, listener: (data: PresenceEvents[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends keyof PresenceEvents>(event: K, listener: (data: PresenceEvents[K]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof PresenceEvents>(event: K, data: PresenceEvents[K]): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in presence event listener:`, error);
      }
    });
  }
}

export class PresenceEngine extends EventEmitter {
  private currentState: GlyphState = 'wave';
  private previousState: GlyphState = 'wave';
  private stateHistory: StateChange[] = [];
  private currentPattern: InterpretedPattern | null = null;
  
  private signalCollector: SignalCollector;
  private signalInterpreter: SignalInterpreter;
  
  private evaluationInterval: number | null = null;
  private stateTimer: number | null = null;
  private overrideTimer: number | null = null;
  
  private timingConfig: TimingConfig;
  private patternStabilityStart: number | null = null;
  private currentOverrideState: GlyphState | null = null;
  
  private aiOverlay: AIOverlay = 'idle';
  private pulseParameters: PulseParameters = {
    frequency: 1,
    amplitude: 0.3,
    brightness: 0.5,
    mode: 'slow',
  };

  constructor(
    signalCollector?: SignalCollector,
    signalInterpreter?: SignalInterpreter,
    timingConfig?: Partial<TimingConfig>
  ) {
    super();
    this.signalCollector = signalCollector ?? getSignalCollector();
    this.signalInterpreter = signalInterpreter ?? getSignalInterpreter();
    this.timingConfig = { ...DEFAULT_TIMING_CONFIG, ...timingConfig };
  }

  /**
   * Start the presence engine
   */
  start(): void {
    if (this.evaluationInterval) return; // Already running
    
    this.evaluationInterval = window.setInterval(
      () => this.evaluate(),
      this.timingConfig.evaluationIntervalMs
    );
    
    console.log('[PresenceEngine] Started');
  }

  /**
   * Stop the presence engine
   */
  stop(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
    if (this.overrideTimer) {
      clearTimeout(this.overrideTimer);
      this.overrideTimer = null;
    }
    console.log('[PresenceEngine] Stopped');
  }

  /**
   * Main evaluation loop - runs every 300-500ms
   */
  private evaluate(): void {
    const signals = this.signalCollector.getSignals();
    const patterns = this.signalInterpreter.interpret(signals);
    
    // Find dominant pattern
    const dominantPattern = this.signalInterpreter.getDominantPattern(patterns);
    
    // Calculate pulse parameters based on signals
    this.updatePulseParameters(signals);
    
    // Update AI overlay
    this.updateAIOverlay(signals);
    
    // Determine if we should change state
    if (dominantPattern) {
      this.handlePatternChange(dominantPattern);
    }
    
    // Emit pulse update
    this.emit('pulse-update', { parameters: this.pulseParameters });
  }

  /**
   * Handle pattern detection and potential state change
   */
  private handlePatternChange(pattern: InterpretedPattern): void {
    const targetState = this.signalInterpreter.getTargetStateForPattern(pattern.pattern);
    
    // Don't change if in override window
    if (this.currentOverrideState && Date.now() < this.getOverrideEndTime()) {
      return;
    }
    
    // Check if pattern is stable enough for collapse
    if (this.currentPattern?.pattern === pattern.pattern) {
      // Same pattern, check if stable long enough
      if (this.patternStabilityStart) {
        const stabilityDuration = Date.now() - this.patternStabilityStart;
        
        if (stabilityDuration >= this.timingConfig.collapseStabilityRequiredMs) {
          // Pattern is stable, can collapse
          if (targetState !== this.currentState) {
            this.transitionToState(targetState, pattern);
          }
        }
      }
    } else {
      // New pattern, start stability timer
      this.patternStabilityStart = Date.now();
      this.currentPattern = pattern;
    }
  }

  /**
   * Transition to a new state
   */
  private transitionToState(newState: GlyphState, pattern: InterpretedPattern): void {
    // Check minimum collapse duration for previous state
    const lastChange = this.stateHistory[this.stateHistory.length - 1];
    if (lastChange) {
      const timeInState = Date.now() - lastChange.timestamp;
      if (timeInState < this.timingConfig.minCollapseDurationMs && newState !== 'wave') {
        // Haven't been in current state long enough
        return;
      }
    }
    
    // Check priority - don't transition to lower priority state
    const currentPriority = STATE_PRIORITY.indexOf(this.currentState);
    const newPriority = STATE_PRIORITY.indexOf(newState);
    
    if (newPriority > currentPriority && this.currentState !== 'wave') {
      // New state has lower priority, don't transition unless current is wave
      return;
    }
    
    // Perform transition
    this.previousState = this.currentState;
    this.currentState = newState;
    
    // Record change
    const change: StateChange = {
      state: newState,
      timestamp: Date.now(),
      reason: `Pattern: ${pattern.pattern} (${pattern.confidence}% confidence)`,
      pattern,
    };
    this.stateHistory.push(change);
    
    // Trim history
    if (this.stateHistory.length > 100) {
      this.stateHistory.shift();
    }
    
    // Clear any existing state timer
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
    }
    
    // Schedule return to wave if not already wave
    if (newState !== 'wave') {
      this.stateTimer = window.setTimeout(() => {
        this.transitionToWave('timeout');
      }, this.timingConfig.minCollapseDurationMs);
    }
    
    // Emit events
    this.emit('state-change', {
      state: newState,
      previousState: this.previousState,
      reason: change.reason,
    });
    
    this.emit('pattern-detected', {
      pattern: pattern.pattern,
      confidence: pattern.confidence,
    });
    
    console.log(`[PresenceEngine] State: ${this.previousState} → ${newState} (${change.reason})`);
  }

  /**
   * Transition back to wave state
   */
  private transitionToWave(reason: string): void {
    if (this.currentState === 'wave') return;
    
    // Add wave return delay
    setTimeout(() => {
      this.previousState = this.currentState;
      this.currentState = 'wave';
      this.patternStabilityStart = null;
      this.currentPattern = null;
      
      const change: StateChange = {
        state: 'wave',
        timestamp: Date.now(),
        reason: `Return to wave: ${reason}`,
      };
      this.stateHistory.push(change);
      
      this.emit('state-change', {
        state: 'wave',
        previousState: this.previousState,
        reason: change.reason,
      });
      
      console.log(`[PresenceEngine] State: ${this.previousState} → wave (${reason})`);
    }, this.timingConfig.waveReturnDelayMs);
  }

  /**
   * Force a specific state (for manual override)
   */
  forceState(state: GlyphState, durationMs?: number): void {
    this.currentOverrideState = state;
    
    if (this.overrideTimer) {
      clearTimeout(this.overrideTimer);
    }
    
    this.overrideTimer = window.setTimeout(() => {
      this.currentOverrideState = null;
    }, durationMs ?? this.timingConfig.overrideWindowMs);
    
    if (state !== this.currentState) {
      this.previousState = this.currentState;
      this.currentState = state;
      
      this.emit('state-change', {
        state,
        previousState: this.previousState,
        reason: 'Manual override',
      });
    }
  }

  /**
   * Update pulse parameters based on current signals
   */
  private updatePulseParameters(signals: RawSignals): void {
    const { user, ai, session } = signals;
    
    // Frequency = creation velocity + AI activity
    let frequency = 1; // Base 1 Hz
    
    if (user.editsInLastMinute > 10) {
      frequency = 3; // Fast
    } else if (user.editsInLastMinute > 5) {
      frequency = 2; // Medium
    } else if (user.idleTimeMs > 30000) {
      frequency = 0.5; // Slow
    }
    
    // AI activity boosts frequency
    if (ai.isGenerating) {
      frequency = 4; // Erratic micro-pulse
    } else if (ai.isAnalyzing) {
      frequency += 0.5;
    }
    
    // Amplitude = session intensity
    let amplitude = 0.3; // Base
    const intensity = Math.min(
      (user.editsInLastMinute / 10) +
      (session.projectComplexity / 200),
      1
    );
    amplitude = 0.3 + (intensity * 0.7);
    
    // Brightness = AI involvement
    let brightness = 0.5; // Base
    if (ai.isGenerating) {
      brightness = 1.0;
    } else if (ai.isAnalyzing) {
      brightness = 0.8;
    } else if (ai.responseIntensity > 0) {
      brightness = 0.5 + (ai.responseIntensity / 200);
    }
    
    // Determine pulse mode
    let mode: PulseMode = 'slow';
    if (ai.isGenerating) {
      mode = 'erratic';
    } else if (frequency > 2.5) {
      mode = 'fast';
    } else if (frequency > 1.5) {
      mode = 'medium';
    } else if (user.idleTimeMs > 60000) {
      mode = 'subtle';
    } else if (frequency < 1) {
      mode = 'slow';
    }
    
    this.pulseParameters = {
      frequency,
      amplitude,
      brightness,
      mode,
    };
  }

  /**
   * Update AI overlay state
   */
  private updateAIOverlay(signals: RawSignals): void {
    const { ai } = signals;
    
    let newOverlay: AIOverlay = 'idle';
    if (ai.isGenerating) {
      newOverlay = 'generating';
    } else if (ai.isAnalyzing) {
      newOverlay = 'analyzing';
    }
    
    if (newOverlay !== this.aiOverlay) {
      this.aiOverlay = newOverlay;
      this.emit('ai-overlay', { overlay: newOverlay });
    }
  }

  /**
   * Get end time for current override
   */
  private getOverrideEndTime(): number {
    if (!this.overrideTimer) return 0;
    // Approximate - overrideTimer is the timeout ID, not timestamp
    return Date.now() + this.timingConfig.overrideWindowMs;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /** Get current state */
  getCurrentState(): GlyphState {
    return this.currentState;
  }

  /** Get previous state */
  getPreviousState(): GlyphState {
    return this.previousState;
  }

  /** Get current pulse parameters */
  getPulseParameters(): PulseParameters {
    return { ...this.pulseParameters };
  }

  /** Get current AI overlay */
  getAIOverlay(): AIOverlay {
    return this.aiOverlay;
  }

  /** Get state history */
  getStateHistory(count: number = 10): StateChange[] {
    return this.stateHistory.slice(-count);
  }

  /** Get current pattern */
  getCurrentPattern(): InterpretedPattern | null {
    return this.currentPattern;
  }

  /** Get signal collector */
  getSignalCollector(): SignalCollector {
    return this.signalCollector;
  }

  /** Get signal interpreter */
  getSignalInterpreter(): SignalInterpreter {
    return this.signalInterpreter;
  }

  /** Reset engine */
  reset(): void {
    this.stop();
    this.currentState = 'wave';
    this.previousState = 'wave';
    this.stateHistory = [];
    this.currentPattern = null;
    this.patternStabilityStart = null;
    this.currentOverrideState = null;
    this.aiOverlay = 'idle';
    this.pulseParameters = {
      frequency: 1,
      amplitude: 0.3,
      brightness: 0.5,
      mode: 'slow',
    };
    this.signalCollector.reset();
    this.signalInterpreter.clearHistory();
  }
}

/** Singleton instance */
let globalPresenceEngine: PresenceEngine | null = null;

/** Get or create global presence engine */
export function getPresenceEngine(
  timingConfig?: Partial<TimingConfig>
): PresenceEngine {
  if (!globalPresenceEngine) {
    globalPresenceEngine = new PresenceEngine(undefined, undefined, timingConfig);
  }
  return globalPresenceEngine;
}

/** Reset global presence engine */
export function resetPresenceEngine(): void {
  if (globalPresenceEngine) {
    globalPresenceEngine.reset();
  }
  globalPresenceEngine = null;
}
