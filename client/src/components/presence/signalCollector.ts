/**
 * SIGNAL COLLECTOR
 * 
 * Aggregates raw events and metrics from user interactions,
 * session context, AI activity, and collaboration.
 */

import type {
  RawSignals,
  UserSignals,
  SessionContext,
  AIContext,
  CollaborationContext,
} from './types';

/** Default initial state for user signals */
const createDefaultUserSignals = (): UserSignals => ({
  notesAdded: 0,
  notesDeleted: 0,
  notesMoved: 0,
  lastEditTimestamp: 0,
  editsInLastMinute: 0,
  currentTool: 'none',
  toolSwitchesInLastMinute: 0,
  toolsUsedInSession: new Set(),
  isPlaying: false,
  playCount: 0,
  loopCount: 0,
  playbackDuration: 0,
  undoCount: 0,
  redoCount: 0,
  lastUndoTimestamp: 0,
  lastInteractionTimestamp: Date.now(),
  idleTimeMs: 0,
});

/** Default initial state for session context */
const createDefaultSessionContext = (): SessionContext => ({
  sessionStartTime: Date.now(),
  sessionDurationMs: 0,
  projectComplexity: 0,
  modeTransitions: 0,
  currentMode: 'idle',
});

/** Default initial state for AI context */
const createDefaultAIContext = (): AIContext => ({
  isGenerating: false,
  isAnalyzing: false,
  lastGenerationTimestamp: 0,
  generationCount: 0,
  aiMode: 'idle',
  responseIntensity: 0,
  lastResponseTimeMs: 0,
});

/** Default initial state for collaboration context */
const createDefaultCollaborationContext = (): CollaborationContext => ({
  activeCollaborators: 0,
  simultaneousEdits: 0,
  sharedPlaybackActive: false,
  lastCollaboratorAction: 0,
});

export class SignalCollector {
  private userSignals: UserSignals = createDefaultUserSignals();
  private sessionContext: SessionContext = createDefaultSessionContext();
  private aiContext: AIContext = createDefaultAIContext();
  private collaborationContext: CollaborationContext = createDefaultCollaborationContext();
  
  private editHistory: { timestamp: number; type: string }[] = [];
  private toolSwitchHistory: { timestamp: number; tool: string }[] = [];
  private maxHistorySize = 1000;

  /**
   * Get current snapshot of all signals
   */
  getSignals(): RawSignals {
    this.updateCalculatedMetrics();
    
    return {
      user: { ...this.userSignals },
      session: { ...this.sessionContext },
      ai: { ...this.aiContext },
      collaboration: { ...this.collaborationContext },
      timestamp: Date.now(),
    };
  }

  /**
   * Update calculated metrics based on current time
   */
  private updateCalculatedMetrics(): void {
    const now = Date.now();
    
    // Update idle time
    this.userSignals.idleTimeMs = now - this.userSignals.lastInteractionTimestamp;
    
    // Update session duration
    this.sessionContext.sessionDurationMs = now - this.sessionContext.sessionStartTime;
    
    // Calculate edits in last minute
    const oneMinuteAgo = now - 60000;
    this.userSignals.editsInLastMinute = this.editHistory.filter(
      e => e.timestamp > oneMinuteAgo
    ).length;
    
    // Calculate tool switches in last minute
    this.userSignals.toolSwitchesInLastMinute = this.toolSwitchHistory.filter(
      t => t.timestamp > oneMinuteAgo
    ).length;
  }

  // ============================================================================
  // USER INTERACTION EVENTS
  // ============================================================================

  /** Record a note being added */
  onNoteAdded(): void {
    this.userSignals.notesAdded++;
    this.userSignals.lastEditTimestamp = Date.now();
    this.recordEdit('add-note');
    this.onInteraction();
  }

  /** Record a note being deleted */
  onNoteDeleted(): void {
    this.userSignals.notesDeleted++;
    this.userSignals.lastEditTimestamp = Date.now();
    this.recordEdit('delete-note');
    this.onInteraction();
  }

  /** Record a note being moved */
  onNoteMoved(): void {
    this.userSignals.notesMoved++;
    this.userSignals.lastEditTimestamp = Date.now();
    this.recordEdit('move-note');
    this.onInteraction();
  }

  /** Record any edit event */
  private recordEdit(type: string): void {
    this.editHistory.push({ timestamp: Date.now(), type });
    this.trimHistory(this.editHistory);
  }

  /** Record tool switch */
  onToolSwitch(tool: string): void {
    if (this.userSignals.currentTool !== tool) {
      this.userSignals.currentTool = tool;
      this.userSignals.toolsUsedInSession.add(tool);
      this.toolSwitchHistory.push({ timestamp: Date.now(), tool });
      this.trimHistory(this.toolSwitchHistory);
      this.onInteraction();
    }
  }

  /** Record playback started */
  onPlaybackStarted(): void {
    this.userSignals.isPlaying = true;
    this.userSignals.playCount++;
    this.onInteraction();
  }

  /** Record playback stopped */
  onPlaybackStopped(durationMs: number): void {
    this.userSignals.isPlaying = false;
    this.userSignals.playbackDuration += durationMs;
    this.onInteraction();
  }

  /** Record loop completion */
  onLoopCompleted(): void {
    this.userSignals.loopCount++;
  }

  /** Record undo action */
  onUndo(): void {
    this.userSignals.undoCount++;
    this.userSignals.lastUndoTimestamp = Date.now();
    this.recordEdit('undo');
    this.onInteraction();
  }

  /** Record redo action */
  onRedo(): void {
    this.userSignals.redoCount++;
    this.recordEdit('redo');
    this.onInteraction();
  }

  /** Record any user interaction (resets idle timer) */
  onInteraction(): void {
    this.userSignals.lastInteractionTimestamp = Date.now();
    this.userSignals.idleTimeMs = 0;
  }

  // ============================================================================
  // SESSION CONTEXT EVENTS
  // ============================================================================

  /** Update project complexity score */
  updateProjectComplexity(trackCount: number, totalNotes: number): void {
    // Complexity score: 0-100 based on tracks and notes
    const trackScore = Math.min(trackCount * 10, 50);
    const noteScore = Math.min(totalNotes / 10, 50);
    this.sessionContext.projectComplexity = Math.min(trackScore + noteScore, 100);
  }

  /** Record mode transition */
  onModeTransition(newMode: string): void {
    if (this.sessionContext.currentMode !== newMode) {
      this.sessionContext.modeTransitions++;
      this.sessionContext.currentMode = newMode;
    }
  }

  // ============================================================================
  // AI CONTEXT EVENTS
  // ============================================================================

  /** Record AI generation started */
  onAIGenerationStarted(): void {
    this.aiContext.isGenerating = true;
    this.aiContext.aiMode = 'generating';
    this.aiContext.responseIntensity = 80;
    this.onInteraction();
  }

  /** Record AI generation completed */
  onAIGenerationCompleted(responseTimeMs: number): void {
    this.aiContext.isGenerating = false;
    this.aiContext.lastGenerationTimestamp = Date.now();
    this.aiContext.generationCount++;
    this.aiContext.aiMode = 'idle';
    this.aiContext.responseIntensity = 0;
    this.aiContext.lastResponseTimeMs = responseTimeMs;
  }

  /** Record AI analysis started */
  onAIAnalysisStarted(): void {
    this.aiContext.isAnalyzing = true;
    this.aiContext.aiMode = 'analyzing';
    this.aiContext.responseIntensity = 60;
    this.onInteraction();
  }

  /** Record AI analysis completed */
  onAIAnalysisCompleted(responseTimeMs: number): void {
    this.aiContext.isAnalyzing = false;
    this.aiContext.aiMode = 'idle';
    this.aiContext.responseIntensity = 0;
    this.aiContext.lastResponseTimeMs = responseTimeMs;
  }

  /** Record AI error */
  onAIError(): void {
    this.aiContext.isGenerating = false;
    this.aiContext.isAnalyzing = false;
    this.aiContext.aiMode = 'error';
    this.aiContext.responseIntensity = 0;
  }

  // ============================================================================
  // COLLABORATION EVENTS
  // ============================================================================

  /** Update active collaborator count */
  updateActiveCollaborators(count: number): void {
    this.collaborationContext.activeCollaborators = count;
    if (count > 0) {
      this.collaborationContext.lastCollaboratorAction = Date.now();
    }
  }

  /** Record simultaneous edit */
  onSimultaneousEdit(): void {
    this.collaborationContext.simultaneousEdits++;
    this.collaborationContext.lastCollaboratorAction = Date.now();
    this.onInteraction();
  }

  /** Record shared playback state change */
  onSharedPlaybackChanged(isActive: boolean): void {
    this.collaborationContext.sharedPlaybackActive = isActive;
    if (isActive) {
      this.collaborationContext.lastCollaboratorAction = Date.now();
    }
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  /** Trim history arrays to max size */
  private trimHistory<T>(history: { timestamp: number }[]): void {
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  /** Reset all signals (e.g., on project change) */
  reset(): void {
    this.userSignals = createDefaultUserSignals();
    this.sessionContext = createDefaultSessionContext();
    this.aiContext = createDefaultAIContext();
    this.collaborationContext = createDefaultCollaborationContext();
    this.editHistory = [];
    this.toolSwitchHistory = [];
  }

  /** Get metrics summary for debugging */
  getMetricsSummary(): Record<string, unknown> {
    this.updateCalculatedMetrics();
    return {
      user: {
        totalEdits: this.userSignals.notesAdded + this.userSignals.notesDeleted + this.userSignals.notesMoved,
        editsPerMinute: this.userSignals.editsInLastMinute,
        toolsUsed: Array.from(this.userSignals.toolsUsedInSession),
        toolSwitchesPerMinute: this.userSignals.toolSwitchesInLastMinute,
        isPlaying: this.userSignals.isPlaying,
        idleTimeSeconds: Math.round(this.userSignals.idleTimeMs / 1000),
      },
      session: {
        durationMinutes: Math.round(this.sessionContext.sessionDurationMs / 60000),
        complexity: this.sessionContext.projectComplexity,
        modeTransitions: this.sessionContext.modeTransitions,
        currentMode: this.sessionContext.currentMode,
      },
      ai: {
        mode: this.aiContext.aiMode,
        totalGenerations: this.aiContext.generationCount,
        responseIntensity: this.aiContext.responseIntensity,
      },
      collaboration: {
        activeCollaborators: this.collaborationContext.activeCollaborators,
        simultaneousEdits: this.collaborationContext.simultaneousEdits,
        sharedPlayback: this.collaborationContext.sharedPlaybackActive,
      },
    };
  }
}

/** Singleton instance for global signal collection */
let globalSignalCollector: SignalCollector | null = null;

/** Get or create the global signal collector */
export function getSignalCollector(): SignalCollector {
  if (!globalSignalCollector) {
    globalSignalCollector = new SignalCollector();
  }
  return globalSignalCollector;
}

/** Reset the global signal collector */
export function resetSignalCollector(): void {
  globalSignalCollector = null;
}
