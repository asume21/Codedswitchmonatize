/**
 * SIGNAL INTERPRETER
 * 
 * Converts raw signals into recognized patterns that can trigger
glyph state collapses. Applies the mapping logic from the spec.
 */

import type {
  RawSignals,
  SignalPattern,
  InterpretedPattern,
  PatternMapping,
  GlyphState,
} from './types';

/** Pattern mappings based on the spec's collapse logic table */
const PATTERN_MAPPINGS: PatternMapping[] = [
  { pattern: 'high-velocity-playback', targetState: 'spiral-helix', priority: 8, requiredConfidence: 70 },
  { pattern: 'stillness-long-session', targetState: 'distortion-light', priority: 8, requiredConfidence: 75 },
  { pattern: 'exploring-tools', targetState: 'quasicrystal', priority: 5, requiredConfidence: 60 },
  { pattern: 'steady-rhythmic', targetState: 'breathing-torus', priority: 5, requiredConfidence: 65 },
  { pattern: 'collaboration-active', targetState: 'honeycomb', priority: 10, requiredConfidence: 50 },
  { pattern: 'mixed-signals', targetState: 'superposition', priority: 3, requiredConfidence: 55 },
  { pattern: 'no-strong-pattern', targetState: 'wave', priority: 1, requiredConfidence: 0 },
];

/** Thresholds for pattern detection */
const THRESHOLDS = {
  // High velocity: >5 edits per minute while playing
  highVelocity: {
    minEditsPerMinute: 5,
    minPlaybackActivity: true,
  },
  
  // Stillness: >30 seconds idle, session >5 minutes
  deepStillness: {
    minIdleMs: 30000,
    minSessionMs: 300000,
  },
  
  // Tool exploration: >3 tool switches per minute
  toolExploration: {
    minSwitchesPerMinute: 3,
  },
  
  // Steady rhythmic: playing, <3 edits per minute, consistent playback
  steadyRhythmic: {
    maxEditsPerMinute: 3,
    minLoopCount: 3,
    playbackActive: true,
  },
  
  // Collaboration: >0 active collaborators
  collaboration: {
    minCollaborators: 1,
  },
  
  // Mixed signals: conflicting indicators
  mixedSignals: {
    idleButRecentActivity: 5000, // Idle < 5s but no current activity
    mode: 'ambiguity',
  },
};

export class SignalInterpreter {
  private recentPatterns: InterpretedPattern[] = [];
  private maxPatternHistory = 50;

  /**
   * Interpret current signals and detect patterns
   */
  interpret(signals: RawSignals): InterpretedPattern[] {
    const patterns: InterpretedPattern[] = [];
    const now = Date.now();

    // Check each pattern type
    const highVelocity = this.detectHighVelocity(signals);
    if (highVelocity.confidence > 0) patterns.push(highVelocity);

    const stillness = this.detectStillness(signals);
    if (stillness.confidence > 0) patterns.push(stillness);

    const exploration = this.detectToolExploration(signals);
    if (exploration.confidence > 0) patterns.push(exploration);

    const steady = this.detectSteadyRhythmic(signals);
    if (steady.confidence > 0) patterns.push(steady);

    const collaboration = this.detectCollaboration(signals);
    if (collaboration.confidence > 0) patterns.push(collaboration);

    const mixed = this.detectMixedSignals(signals, patterns.length);
    if (mixed.confidence > 0) patterns.push(mixed);

    // Always add no-strong-pattern as fallback
    const noPattern = this.detectNoStrongPattern(signals, patterns);
    patterns.push(noPattern);

    // Sort by confidence descending
    patterns.sort((a, b) => b.confidence - a.confidence);

    // Store in history
    this.recentPatterns.push(...patterns);
    this.trimPatternHistory();

    return patterns;
  }

  /**
   * Detect high velocity + playback pattern
   * Triggers: Spiral-Helix
   */
  private detectHighVelocity(signals: RawSignals): InterpretedPattern {
    const { user } = signals;
    const contributingSignals: string[] = [];
    let confidence = 0;

    // Check edit velocity
    if (user.editsInLastMinute >= THRESHOLDS.highVelocity.minEditsPerMinute) {
      confidence += 40;
      contributingSignals.push('high-edit-velocity');
    } else if (user.editsInLastMinute >= 3) {
      confidence += 20;
      contributingSignals.push('moderate-edit-velocity');
    }

    // Check playback activity
    if (user.isPlaying) {
      confidence += 30;
      contributingSignals.push('active-playback');
    }

    // Check loop count (sustained work)
    if (user.loopCount > THRESHOLDS.steadyRhythmic.minLoopCount) {
      confidence += 20;
      contributingSignals.push('sustained-work');
    }

    // Bonus for recent edits
    const secondsSinceEdit = (Date.now() - user.lastEditTimestamp) / 1000;
    if (secondsSinceEdit < 10) {
      confidence += 10;
      contributingSignals.push('very-recent-edits');
    }

    return {
      pattern: 'high-velocity-playback',
      confidence: Math.min(confidence, 100),
      signals: contributingSignals,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect deep stillness pattern
   * Triggers: Distortion-Light
   */
  private detectStillness(signals: RawSignals): InterpretedPattern {
    const { user, session } = signals;
    const contributingSignals: string[] = [];
    let confidence = 0;

    // Check idle time
    if (user.idleTimeMs >= THRESHOLDS.deepStillness.minIdleMs) {
      confidence += 50;
      contributingSignals.push('extended-idle');
    } else if (user.idleTimeMs >= 15000) {
      confidence += 25;
      contributingSignals.push('moderate-idle');
    }

    // Check session duration
    if (session.sessionDurationMs >= THRESHOLDS.deepStillness.minSessionMs) {
      confidence += 30;
      contributingSignals.push('long-session');
    } else if (session.sessionDurationMs >= 120000) {
      confidence += 15;
      contributingSignals.push('moderate-session');
    }

    // Check if listening (playback without edits)
    if (user.isPlaying && user.idleTimeMs > 5000) {
      confidence += 20;
      contributingSignals.push('focused-listening');
    }

    // Project complexity adds to "deep presence"
    if (session.projectComplexity > 50) {
      confidence += 10;
      contributingSignals.push('complex-project');
    }

    return {
      pattern: 'stillness-long-session',
      confidence: Math.min(confidence, 100),
      signals: contributingSignals,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect tool exploration pattern
   * Triggers: Quasicrystal Heart
   */
  private detectToolExploration(signals: RawSignals): InterpretedPattern {
    const { user, session } = signals;
    const contributingSignals: string[] = [];
    let confidence = 0;

    // Check tool switch frequency
    if (user.toolSwitchesInLastMinute >= THRESHOLDS.toolExploration.minSwitchesPerMinute) {
      confidence += 50;
      contributingSignals.push('frequent-tool-switches');
    } else if (user.toolSwitchesInLastMinute >= 2) {
      confidence += 30;
      contributingSignals.push('moderate-tool-switches');
    }

    // Check number of tools used
    const toolsUsedCount = user.toolsUsedInSession.size;
    if (toolsUsedCount >= 5) {
      confidence += 30;
      contributingSignals.push('many-tools-used');
    } else if (toolsUsedCount >= 3) {
      confidence += 15;
      contributingSignals.push('several-tools-used');
    }

    // Mode transitions indicate exploration
    if (session.modeTransitions >= 5) {
      confidence += 20;
      contributingSignals.push('frequent-mode-changes');
    }

    return {
      pattern: 'exploring-tools',
      confidence: Math.min(confidence, 100),
      signals: contributingSignals,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect steady rhythmic work pattern
   * Triggers: Breathing Torus
   */
  private detectSteadyRhythmic(signals: RawSignals): InterpretedPattern {
    const { user } = signals;
    const contributingSignals: string[] = [];
    let confidence = 0;

    // Check consistent playback
    if (user.isPlaying) {
      confidence += 25;
      contributingSignals.push('active-playback');
    }

    // Check low edit velocity (steady, not frantic)
    if (user.editsInLastMinute <= THRESHOLDS.steadyRhythmic.maxEditsPerMinute) {
      confidence += 30;
      contributingSignals.push('steady-edit-rate');
    }

    // Check loop count (repetitive work)
    if (user.loopCount >= THRESHOLDS.steadyRhythmic.minLoopCount) {
      confidence += 25;
      contributingSignals.push('repetitive-work');
    }

    // Low undo/redo indicates steady progress
    const totalUndoRedo = user.undoCount + user.redoCount;
    if (totalUndoRedo < 3) {
      confidence += 20;
      contributingSignals.push('steady-progress');
    }

    return {
      pattern: 'steady-rhythmic',
      confidence: Math.min(confidence, 100),
      signals: contributingSignals,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect active collaboration pattern
   * Triggers: Honeycomb Singularity
   */
  private detectCollaboration(signals: RawSignals): InterpretedPattern {
    const { collaboration } = signals;
    const contributingSignals: string[] = [];
    let confidence = 0;

    // Check active collaborators
    if (collaboration.activeCollaborators >= THRESHOLDS.collaboration.minCollaborators) {
      confidence += 60;
      contributingSignals.push('active-collaborators');
      
      // More collaborators = higher confidence
      if (collaboration.activeCollaborators >= 3) {
        confidence += 20;
        contributingSignals.push('multi-user-session');
      }
    }

    // Check simultaneous edits
    if (collaboration.simultaneousEdits > 0) {
      confidence += 30;
      contributingSignals.push('simultaneous-edits');
    }

    // Check shared playback
    if (collaboration.sharedPlaybackActive) {
      confidence += 10;
      contributingSignals.push('shared-playback');
    }

    // Recent collaborator action
    const timeSinceAction = Date.now() - collaboration.lastCollaboratorAction;
    if (timeSinceAction < 10000) {
      confidence += 10;
      contributingSignals.push('recent-collaborator-activity');
    }

    return {
      pattern: 'collaboration-active',
      confidence: Math.min(confidence, 100),
      signals: contributingSignals,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect mixed signals / ambiguity pattern
   * Triggers: Superposition
   */
  private detectMixedSignals(
    signals: RawSignals,
    otherPatternsDetected: number
  ): InterpretedPattern {
    const { user, ai } = signals;
    const contributingSignals: string[] = [];
    let confidence = 0;

    // Multiple competing patterns create ambiguity
    if (otherPatternsDetected >= 3) {
      confidence += 30;
      contributingSignals.push('multiple-competing-patterns');
    }

    // Idle but recent activity
    if (user.idleTimeMs < THRESHOLDS.mixedSignals.idleButRecentActivity && 
        user.editsInLastMinute === 0) {
      confidence += 25;
      contributingSignals.push('idle-but-recently-active');
    }

    // AI active but user idle
    if ((ai.isGenerating || ai.isAnalyzing) && user.idleTimeMs > 3000) {
      confidence += 25;
      contributingSignals.push('ai-active-user-idle');
    }

    // Conflicting undo/redo pattern
    if (user.undoCount > 5 && user.redoCount > 5) {
      confidence += 20;
      contributingSignals.push('undo-redo-cycle');
    }

    return {
      pattern: 'mixed-signals',
      confidence: Math.min(confidence, 100),
      signals: contributingSignals,
      timestamp: Date.now(),
    };
  }

  /**
   * Fallback when no strong pattern detected
   * Triggers: Wave State
   */
  private detectNoStrongPattern(
    signals: RawSignals,
    otherPatterns: InterpretedPattern[]
  ): InterpretedPattern {
    const contributingSignals: string[] = [];
    
    // If no other pattern has high confidence, default to wave
    const maxConfidence = otherPatterns.length > 0 
      ? Math.max(...otherPatterns.map(p => p.confidence))
      : 0;
    
    let confidence = 100 - maxConfidence;
    
    if (maxConfidence < 30) {
      contributingSignals.push('no-clear-pattern');
    }
    
    if (signals.user.idleTimeMs > 60000) {
      contributingSignals.push('extended-inactivity');
    }

    return {
      pattern: 'no-strong-pattern',
      confidence: Math.max(confidence, 30), // Minimum 30% for wave
      signals: contributingSignals,
      timestamp: Date.now(),
    };
  }

  /**
   * Get the highest priority pattern that meets its confidence threshold
   */
  getDominantPattern(patterns: InterpretedPattern[]): InterpretedPattern | null {
    // Sort by priority (using mapping table), then by confidence
    const sortedPatterns = [...patterns].sort((a, b) => {
      const mappingA = PATTERN_MAPPINGS.find(m => m.pattern === a.pattern);
      const mappingB = PATTERN_MAPPINGS.find(m => m.pattern === b.pattern);
      
      if (!mappingA || !mappingB) return 0;
      
      // First sort by priority (descending)
      if (mappingB.priority !== mappingA.priority) {
        return mappingB.priority - mappingA.priority;
      }
      
      // Then by confidence (descending)
      return b.confidence - a.confidence;
    });

    // Return first pattern that meets its confidence threshold
    for (const pattern of sortedPatterns) {
      const mapping = PATTERN_MAPPINGS.find(m => m.pattern === pattern.pattern);
      if (mapping && pattern.confidence >= mapping.requiredConfidence) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Map a pattern to its target glyph state
   */
  getTargetStateForPattern(pattern: SignalPattern): GlyphState {
    const mapping = PATTERN_MAPPINGS.find(m => m.pattern === pattern);
    return mapping?.targetState ?? 'wave';
  }

  /**
   * Get all pattern mappings
   */
  getPatternMappings(): PatternMapping[] {
    return [...PATTERN_MAPPINGS];
  }

  /**
   * Trim pattern history to max size
   */
  private trimPatternHistory(): void {
    if (this.recentPatterns.length > this.maxPatternHistory) {
      this.recentPatterns.splice(0, this.recentPatterns.length - this.maxPatternHistory);
    }
  }

  /**
   * Get recent pattern history
   */
  getRecentPatterns(count: number = 10): InterpretedPattern[] {
    return this.recentPatterns.slice(-count);
  }

  /**
   * Clear pattern history
   */
  clearHistory(): void {
    this.recentPatterns = [];
  }
}

/** Singleton instance */
let globalSignalInterpreter: SignalInterpreter | null = null;

/** Get or create global signal interpreter */
export function getSignalInterpreter(): SignalInterpreter {
  if (!globalSignalInterpreter) {
    globalSignalInterpreter = new SignalInterpreter();
  }
  return globalSignalInterpreter;
}

/** Reset global signal interpreter */
export function resetSignalInterpreter(): void {
  globalSignalInterpreter = null;
}
