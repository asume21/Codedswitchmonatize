/**
 * AI BRIDGE
 * 
 * Connects Astutely's internal state to the Presence Engine.
 * Listens for Astutely events and translates them into presence signals.
 */

import { getSignalCollector } from './signalCollector';
import { getPresenceEngine } from './presenceEngine';

/** Astutely state that can be fed into the Presence Engine */
export interface AstutelyState {
  isGenerating: boolean;
  isAnalyzing: boolean;
  currentStep?: 'idle' | 'planning' | 'generating' | 'post-processing' | 'complete' | 'error';
  progress?: number;
  style?: string;
  lastResponseTimeMs?: number;
  errorCount?: number;
}

/** Minimum time to display AI states so users can perceive the visual feedback */
const MIN_AI_DISPLAY_MS = 800;

export class AIBridge {
  private signalCollector = getSignalCollector();
  private presenceEngine = getPresenceEngine();
  private astutelyState: AstutelyState = {
    isGenerating: false,
    isAnalyzing: false,
    currentStep: 'idle',
    progress: 0,
  };
  private generationStartTime: number | null = null;
  private analysisStartTime: number | null = null;
  private pendingCompletionTimer: number | null = null;

  /**
   * Initialize the AI Bridge and set up event listeners
   */
  initialize(): void {
    // Listen for Astutely panel open/close
    window.addEventListener('astutely:panel-opened', this.handlePanelOpened as EventListener);
    window.addEventListener('astutely:panel-closed', this.handlePanelClosed as EventListener);
    
    // Listen for generation events
    window.addEventListener('astutely:generation-started', this.handleGenerationStarted as EventListener);
    window.addEventListener('astutely:generation-progress', this.handleGenerationProgress as EventListener);
    window.addEventListener('astutely:generation-completed', this.handleGenerationCompleted as EventListener);
    window.addEventListener('astutely:generation-error', this.handleGenerationError as EventListener);
    
    // Listen for analysis events
    window.addEventListener('astutely:analysis-started', this.handleAnalysisStarted as EventListener);
    window.addEventListener('astutely:analysis-completed', this.handleAnalysisCompleted as EventListener);
    
    console.log('[AIBridge] Initialized');
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Clear any pending completion timers
    if (this.pendingCompletionTimer) {
      clearTimeout(this.pendingCompletionTimer);
      this.pendingCompletionTimer = null;
    }
    
    window.removeEventListener('astutely:panel-opened', this.handlePanelOpened as EventListener);
    window.removeEventListener('astutely:panel-closed', this.handlePanelClosed as EventListener);
    window.removeEventListener('astutely:generation-started', this.handleGenerationStarted as EventListener);
    window.removeEventListener('astutely:generation-progress', this.handleGenerationProgress as EventListener);
    window.removeEventListener('astutely:generation-completed', this.handleGenerationCompleted as EventListener);
    window.removeEventListener('astutely:generation-error', this.handleGenerationError as EventListener);
    window.removeEventListener('astutely:analysis-started', this.handleAnalysisStarted as EventListener);
    window.removeEventListener('astutely:analysis-completed', this.handleAnalysisCompleted as EventListener);
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private handlePanelOpened = (): void => {
    // User is engaging with AI
    this.signalCollector.onInteraction();
    console.log('[AIBridge] Astutely panel opened');
  };

  private handlePanelClosed = (): void => {
    // User finished AI interaction
    console.log('[AIBridge] Astutely panel closed');
  };

  private handleGenerationStarted = (event: CustomEvent<{ style: string }>): void => {
    this.astutelyState.isGenerating = true;
    this.astutelyState.currentStep = 'planning';
    this.astutelyState.style = event.detail.style;
    this.generationStartTime = Date.now();
    
    this.signalCollector.onAIGenerationStarted();
    console.log(`[AIBridge] Generation started: ${event.detail.style}`);
  };

  private handleGenerationProgress = (event: CustomEvent<{ step: string; progress: number }>): void => {
    const { step, progress } = event.detail;
    
    // Map step to our state
    switch (step) {
      case 'planning':
        this.astutelyState.currentStep = 'planning';
        break;
      case 'generating':
      case 'creating':
        this.astutelyState.currentStep = 'generating';
        break;
      case 'post-processing':
      case 'finalizing':
        this.astutelyState.currentStep = 'post-processing';
        break;
    }
    
    this.astutelyState.progress = progress;
    
    // Intensity increases as generation progresses
    const intensity = Math.min(progress * 1.5, 100);
    this.updateAIIntensity(intensity);
  };

  private handleGenerationCompleted = (): void => {
    const responseTime = this.generationStartTime 
      ? Date.now() - this.generationStartTime 
      : 0;
    
    // Ensure minimum display time so users can perceive the AI state
    const remainingDisplayTime = Math.max(0, MIN_AI_DISPLAY_MS - responseTime);
    
    const completeGeneration = () => {
      this.astutelyState.isGenerating = false;
      this.astutelyState.currentStep = 'complete';
      this.astutelyState.progress = 100;
      
      this.signalCollector.onAIGenerationCompleted(responseTime);
      
      // Dispatch success event for glyph to show completion
      window.dispatchEvent(new CustomEvent('ai:generation-success', {
        detail: { responseTime, style: this.astutelyState.style }
      }));
      
      console.log(`[AIBridge] Generation completed in ${responseTime}ms`);
      this.generationStartTime = null;
      this.pendingCompletionTimer = null;
    };
    
    if (remainingDisplayTime > 0) {
      console.log(`[AIBridge] Fast generation (${responseTime}ms), holding state for ${remainingDisplayTime}ms`);
      this.pendingCompletionTimer = window.setTimeout(completeGeneration, remainingDisplayTime);
    } else {
      completeGeneration();
    }
  };

  private handleGenerationError = (event: CustomEvent<{ error: string }>): void => {
    this.astutelyState.isGenerating = false;
    this.astutelyState.currentStep = 'error';
    this.astutelyState.errorCount = (this.astutelyState.errorCount || 0) + 1;
    
    this.signalCollector.onAIError();
    
    console.error('[AIBridge] Generation error:', event.detail.error);
    this.generationStartTime = null;
  };

  private handleAnalysisStarted = (): void => {
    this.astutelyState.isAnalyzing = true;
    this.analysisStartTime = Date.now();
    
    this.signalCollector.onAIAnalysisStarted();
    console.log('[AIBridge] Analysis started');
  };

  private handleAnalysisCompleted = (): void => {
    const responseTime = this.analysisStartTime 
      ? Date.now() - this.analysisStartTime 
      : 0;
    
    // Ensure minimum display time so users can perceive the AI state
    const remainingDisplayTime = Math.max(0, MIN_AI_DISPLAY_MS - responseTime);
    
    const completeAnalysis = () => {
      this.astutelyState.isAnalyzing = false;
      
      this.signalCollector.onAIAnalysisCompleted(responseTime);
      console.log(`[AIBridge] Analysis completed in ${responseTime}ms`);
      this.analysisStartTime = null;
    };
    
    if (remainingDisplayTime > 0) {
      console.log(`[AIBridge] Fast analysis (${responseTime}ms), holding state for ${remainingDisplayTime}ms`);
      window.setTimeout(completeAnalysis, remainingDisplayTime);
    } else {
      completeAnalysis();
    }
  };

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private updateAIIntensity(intensity: number): void {
    // Update the AI context in signal collector
    const signals = this.signalCollector.getSignals();
    signals.ai.responseIntensity = intensity;
  }

  /**
   * Manually update Astutely state (for programmatic control)
   */
  updateState(state: Partial<AstutelyState>): void {
    const prevGenerating = this.astutelyState.isGenerating;
    const prevAnalyzing = this.astutelyState.isAnalyzing;
    
    this.astutelyState = { ...this.astutelyState, ...state };
    
    // Trigger signal collector if state changed
    if (!prevGenerating && state.isGenerating) {
      this.signalCollector.onAIGenerationStarted();
    } else if (prevGenerating && state.isGenerating === false) {
      this.signalCollector.onAIGenerationCompleted(
        this.generationStartTime ? Date.now() - this.generationStartTime : 0
      );
    }
    
    if (!prevAnalyzing && state.isAnalyzing) {
      this.signalCollector.onAIAnalysisStarted();
    } else if (prevAnalyzing && state.isAnalyzing === false) {
      this.signalCollector.onAIAnalysisCompleted(
        this.analysisStartTime ? Date.now() - this.analysisStartTime : 0
      );
    }
  }

  /**
   * Get current Astutely state
   */
  getState(): AstutelyState {
    return { ...this.astutelyState };
  }
}

/** Singleton instance */
let globalAIBridge: AIBridge | null = null;

/** Get or create global AI bridge */
export function getAIBridge(): AIBridge {
  if (!globalAIBridge) {
    globalAIBridge = new AIBridge();
  }
  return globalAIBridge;
}

/** Reset global AI bridge */
export function resetAIBridge(): void {
  if (globalAIBridge) {
    globalAIBridge.destroy();
  }
  globalAIBridge = null;
}

/**
 * Helper to dispatch Astutely events from components
 */
export function dispatchAstutelyEvent(
  eventName: string,
  detail?: Record<string, unknown>
): void {
  window.dispatchEvent(new CustomEvent(`astutely:${eventName}`, { detail }));
}
