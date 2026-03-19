// Section 05 — PitchEmpathy behavior

import type { ReactiveContext, ReactiveConfig } from '../types'

export class PitchEmpathy {
  private readonly config:    ReactiveConfig
  private pitchHistory:       number[]  = []
  private consecutiveRising:  number    = 0
  private currentOffsetTarget: number   = 0
  private smoothedOffset:     number    = 0

  constructor(config: ReactiveConfig) {
    this.config = config
  }

  process(ctx: ReactiveContext): Partial<{ melodyPitchOffsetSemitones: number }> {
    const { pitch, pitchConfidence } = ctx.frame

    if (pitch > 0 && pitchConfidence > 0.5) {
      this.pitchHistory.push(pitch)
      if (this.pitchHistory.length > 16) this.pitchHistory.shift()

      if (
        this.pitchHistory.length >= 2 &&
        pitch > this.pitchHistory[this.pitchHistory.length - 2]
      ) {
        this.consecutiveRising++
      } else {
        this.consecutiveRising = 0
      }
    }

    if (this.consecutiveRising >= this.config.pitchRiseMinSyllables) {
      const first = this.pitchHistory[this.pitchHistory.length - this.consecutiveRising]
      const last  = pitch
      if (first > 0) {
        const semitoneRise = 12 * Math.log2(last / first)
        this.currentOffsetTarget = Math.min(
          this.config.pitchEmpathySemitones,
          Math.max(2, Math.round(semitoneRise / 3))
        )
      }
    } else {
      this.currentOffsetTarget = 0
    }

    this.smoothedOffset +=
      this.config.pitchEmpathySmoothing * (this.currentOffsetTarget - this.smoothedOffset)

    return { melodyPitchOffsetSemitones: Math.round(this.smoothedOffset) }
  }

  reset(): void {
    this.pitchHistory        = []
    this.consecutiveRising   = 0
    this.currentOffsetTarget = 0
    this.smoothedOffset      = 0
  }
}
