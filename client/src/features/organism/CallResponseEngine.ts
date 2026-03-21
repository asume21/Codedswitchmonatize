/**
 * CALL & RESPONSE ENGINE
 *
 * Detects when the rapper pauses (gap between transcription lines) and
 * triggers the melody generator to play a responsive phrase — creating
 * a natural "call and response" dynamic between the vocalist and the beat.
 *
 * How it works:
 *  1. Monitors transcription updates for silence gaps (no new text for N ms)
 *  2. When a gap is detected, emits a "response" event
 *  3. The OrganismProvider handles the event by boosting melody presence
 *     and optionally triggering a melodic fill/answer phrase
 *  4. When the rapper starts again (new text detected), the response fades
 *     and the beat returns to its normal state
 *
 * Configurable:
 *  - gapThresholdMs: how long a silence before triggering response (default 800ms)
 *  - responseDurationMs: how long the response phrase lasts (default 2000ms)
 *  - cooldownMs: minimum time between responses (default 3000ms)
 *  - enabled: on/off toggle
 */

export interface CallResponseConfig {
  gapThresholdMs:      number   // silence before response triggers (default 800)
  responseDurationMs:  number   // how long the response lasts (default 2000)
  cooldownMs:          number   // minimum time between responses (default 3000)
  melodyBoost:         number   // melody volume multiplier during response (default 1.8)
  bassReduction:       number   // bass volume multiplier during response (default 0.4)
}

export type CallResponsePhase = 'idle' | 'listening' | 'responding' | 'cooldown'

export interface CallResponseState {
  phase:            CallResponsePhase
  lastGapStart:     number | null   // timestamp of last detected gap
  lastResponseEnd:  number | null   // timestamp of last response end
  responseCount:    number          // total responses this session
}

export type ResponseCallback = (state: CallResponseState) => void

const DEFAULT_CONFIG: CallResponseConfig = {
  gapThresholdMs:     800,
  responseDurationMs: 2000,
  cooldownMs:         3000,
  melodyBoost:        1.8,
  bassReduction:      0.4,
}

export class CallResponseEngine {
  private config:       CallResponseConfig
  private callbacks:    ResponseCallback[] = []
  private enabled:      boolean = true
  private phase:        CallResponsePhase = 'idle'
  private lastTextTime: number = 0
  private lastGapStart: number | null = null
  private lastResponseEnd: number | null = null
  private responseCount: number = 0
  private gapTimer:     ReturnType<typeof setTimeout> | null = null
  private responseTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config?: Partial<CallResponseConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Register a callback for phase changes. Returns unsubscribe function. */
  onPhaseChange(cb: ResponseCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb)
    }
  }

  /** Enable or disable call & response. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.clearTimers()
      this.setPhase('idle')
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /** Update config at runtime. */
  updateConfig(partial: Partial<CallResponseConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  /** Get the current config (for UI display). */
  getConfig(): Readonly<CallResponseConfig> {
    return { ...this.config }
  }

  /** Get the current state snapshot. */
  getState(): CallResponseState {
    return {
      phase:           this.phase,
      lastGapStart:    this.lastGapStart,
      lastResponseEnd: this.lastResponseEnd,
      responseCount:   this.responseCount,
    }
  }

  /**
   * Feed text from the transcriber. Call this on every interim/final result.
   *
   * When text arrives:
   *  - If we were responding, end the response early (rapper came back)
   *  - Reset the gap timer
   *
   * When text stops (gap detected after gapThresholdMs):
   *  - Enter response phase
   *  - After responseDurationMs, enter cooldown
   */
  processText(text: string, _isInterim: boolean): void {
    if (!this.enabled) return

    const now = performance.now()

    if (text && text.trim().length > 0) {
      this.lastTextTime = now

      // If we were responding, the rapper came back — end response
      if (this.phase === 'responding') {
        this.endResponse()
      }

      // Reset gap detection
      this.clearGapTimer()

      // Set up new gap timer
      this.setPhase('listening')
      this.gapTimer = setTimeout(() => {
        this.onGapDetected()
      }, this.config.gapThresholdMs)
    }
  }

  /**
   * Notify that the transcriber detected complete silence (no audio activity).
   * This is a stronger signal than just no text — it means the user truly stopped.
   */
  notifySilence(): void {
    if (!this.enabled || this.phase === 'responding' || this.phase === 'cooldown') return

    // If we're in listening mode, accelerate gap detection
    if (this.phase === 'listening') {
      this.clearGapTimer()
      this.onGapDetected()
    }
  }

  /** Reset the engine state. */
  reset(): void {
    this.clearTimers()
    this.phase = 'idle'
    this.lastTextTime = 0
    this.lastGapStart = null
    this.lastResponseEnd = null
    this.responseCount = 0
  }

  /** Clean up. */
  dispose(): void {
    this.clearTimers()
    this.callbacks = []
    this.enabled = false
  }

  private onGapDetected(): void {
    const now = performance.now()

    // Check cooldown
    if (this.lastResponseEnd && (now - this.lastResponseEnd) < this.config.cooldownMs) {
      this.setPhase('cooldown')
      return
    }

    // Enter response phase
    this.lastGapStart = now
    this.responseCount++
    this.setPhase('responding')

    // Emit window event for melody generator and other consumers
    window.dispatchEvent(new CustomEvent('organism:call-response', {
      detail: {
        phase:    'responding',
        config:   this.config,
        count:    this.responseCount,
      },
    }))

    // Auto-end response after duration
    this.responseTimer = setTimeout(() => {
      this.endResponse()
    }, this.config.responseDurationMs)
  }

  private endResponse(): void {
    this.lastResponseEnd = performance.now()
    this.clearResponseTimer()
    this.setPhase('cooldown')

    // Emit end event
    window.dispatchEvent(new CustomEvent('organism:call-response', {
      detail: {
        phase:  'cooldown',
        config: this.config,
        count:  this.responseCount,
      },
    }))

    // After cooldown, return to idle
    this.responseTimer = setTimeout(() => {
      if (this.phase === 'cooldown') {
        this.setPhase('idle')
      }
    }, this.config.cooldownMs)
  }

  private setPhase(phase: CallResponsePhase): void {
    if (this.phase === phase) return
    this.phase = phase
    const state = this.getState()
    for (const cb of this.callbacks) {
      try { cb(state) } catch { /* swallow */ }
    }
  }

  private clearTimers(): void {
    this.clearGapTimer()
    this.clearResponseTimer()
  }

  private clearGapTimer(): void {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer)
      this.gapTimer = null
    }
  }

  private clearResponseTimer(): void {
    if (this.responseTimer) {
      clearTimeout(this.responseTimer)
      this.responseTimer = null
    }
  }
}
