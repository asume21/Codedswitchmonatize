/**
 * VOICE COMMAND ROUTER
 *
 * Bridges the TriggerWordDetector → OrganismProvider actions.
 *
 * When the TriggerWordDetector fires an event, this router translates
 * the abstract TriggerAction into concrete Organism operations:
 *
 *  quick-start → calls quickStart(presetId)
 *  shuffle     → regenerates all patterns
 *  bpm-up      → increases BPM by value
 *  bpm-down    → decreases BPM by value
 *  drop        → forces state to Flow + max energy
 *  strip       → mutes bass/melody, keeps drums
 *  restore     → restores all generators to full volume
 *
 * Usage:
 *   const router = new VoiceCommandRouter()
 *   router.connect(triggerDetector)
 *   router.setHandler('quick-start', (presetId) => quickStart(presetId))
 *   router.setHandler('bpm-up', (delta) => orchestrator.setBpm(current + delta))
 */

import type { TriggerEvent, TriggerAction } from './TriggerWordDetector'
import type { TriggerWordDetector } from './TriggerWordDetector'

export type CommandHandler = (action: TriggerAction, event: TriggerEvent) => void

export interface VoiceCommandLog {
  event:     TriggerEvent
  handled:   boolean
  timestamp: number
}

export class VoiceCommandRouter {
  private handler:       CommandHandler | null = null
  private unsubscribe:   (() => void) | null = null
  private log:           VoiceCommandLog[] = []
  private maxLogSize:    number = 100
  private enabled:       boolean = true

  /** Connect to a TriggerWordDetector instance. */
  connect(detector: TriggerWordDetector): void {
    this.disconnect()
    this.unsubscribe = detector.onTrigger((event) => {
      if (!this.enabled) return
      this.route(event)
    })
  }

  /** Disconnect from the current detector. */
  disconnect(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  /** Set the command handler that receives routed actions. */
  setHandler(handler: CommandHandler): void {
    this.handler = handler
  }

  /** Enable or disable routing without disconnecting. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /** Get the command history log. */
  getLog(): readonly VoiceCommandLog[] {
    return this.log
  }

  /** Clear the command history log. */
  clearLog(): void {
    this.log = []
  }

  /** Emit a window event so other components can react to voice commands. */
  private emitEvent(event: TriggerEvent): void {
    window.dispatchEvent(new CustomEvent('organism:voice-command', {
      detail: {
        action:    event.action,
        phrase:    event.matchedPhrase,
        spoken:    event.spokenText,
        confidence: event.confidence,
      },
    }))
  }

  /** Route a trigger event to the handler. */
  private route(event: TriggerEvent): void {
    const handled = !!this.handler

    if (this.handler) {
      try {
        this.handler(event.action, event)
      } catch {
        // Swallow handler errors to prevent detector disruption
      }
    }

    // Always emit window event for UI/logging consumers
    this.emitEvent(event)

    // Log
    this.log.push({ event, handled, timestamp: performance.now() })
    if (this.log.length > this.maxLogSize) {
      this.log = this.log.slice(-this.maxLogSize)
    }
  }

  /** Clean up. */
  dispose(): void {
    this.disconnect()
    this.handler = null
    this.log = []
    this.enabled = false
  }
}
