// Section 05 — PauseResponse behavior

import type { ReactiveContext, ReactiveConfig } from '../types'

export enum PausePhase {
  Listening   = 'listening',
  Measuring   = 'measuring',
  Filling     = 'filling',
  Resolved    = 'resolved',
}

export class PauseResponse {
  private readonly config:    ReactiveConfig
  private phase:              PausePhase = PausePhase.Listening
  private pauseStartMs:       number     = -Infinity
  private pauseDurationMs:    number     = 0
  private fillStartMs:        number     = -Infinity
  private fillDurationMs:     number     = 0

  private fillMelodyBoost:    number = 1.0
  private fillTextureBoost:   number = 1.0

  constructor(config: ReactiveConfig) {
    this.config = config
  }

  process(ctx: ReactiveContext): Partial<{
    melodyVolumeMultiplier: number
    textureVolumeMultiplier: number
  }> {
    const { voiceActive }     = ctx.physics
    const { beatDurationMs }  = ctx.physics
    const now                 = ctx.now
    const minPauseMs          = beatDurationMs * this.config.pauseMinBeats
    const maxPauseMs          = beatDurationMs * 4 * this.config.pauseMaxBars

    switch (this.phase) {
      case PausePhase.Listening:
        if (!voiceActive) {
          this.phase        = PausePhase.Measuring
          this.pauseStartMs = now
        }
        break

      case PausePhase.Measuring:
        if (voiceActive) {
          this.phase = PausePhase.Listening
          break
        }
        this.pauseDurationMs = now - this.pauseStartMs

        if (this.pauseDurationMs >= minPauseMs && this.pauseDurationMs <= maxPauseMs) {
          this.phase          = PausePhase.Filling
          this.fillStartMs    = now
          this.fillDurationMs = this.pauseDurationMs
          this.fillMelodyBoost  = 1.6
          this.fillTextureBoost = 1.3
        } else if (this.pauseDurationMs > maxPauseMs) {
          this.phase = PausePhase.Listening
        }
        break

      case PausePhase.Filling:
        if (voiceActive) {
          this.phase           = PausePhase.Listening
          this.fillMelodyBoost  = 1.0
          this.fillTextureBoost = 1.0
          break
        }
        if (now - this.fillStartMs >= this.fillDurationMs) {
          this.phase           = PausePhase.Resolved
          this.fillMelodyBoost  = 1.0
          this.fillTextureBoost = 1.0
        }
        break

      case PausePhase.Resolved:
        if (voiceActive) this.phase = PausePhase.Listening
        break
    }

    return {
      melodyVolumeMultiplier:  this.fillMelodyBoost,
      textureVolumeMultiplier: this.fillTextureBoost,
    }
  }

  getPhase(): PausePhase { return this.phase }

  reset(): void {
    this.phase            = PausePhase.Listening
    this.pauseStartMs     = -Infinity
    this.pauseDurationMs  = 0
    this.fillMelodyBoost  = 1.0
    this.fillTextureBoost = 1.0
  }
}
