export class PocketComputer {
  private readonly attackCoeff:  number
  private readonly releaseCoeff: number
  private smoothed: number = 0

  constructor(sampleRate: number, frameSize: number, attackMs: number, releaseMs: number) {
    const fps         = sampleRate / frameSize
    this.attackCoeff  = 1 - Math.exp(-1 / (attackMs  * fps / 1000))
    this.releaseCoeff = 1 - Math.exp(-1 / (releaseMs * fps / 1000))
  }

  process(presence: number, voiceActive: boolean): number {
    // In auto/non-voice mode pocket tracks rhythmic energy at reduced weight so
    // the display stays alive and meaningful rather than pinning at pocketBias.
    const target = voiceActive ? presence : presence * 0.35

    const coeff   = target > this.smoothed ? this.attackCoeff : this.releaseCoeff
    this.smoothed += coeff * (target - this.smoothed)

    return Math.max(0, Math.min(1, this.smoothed))
  }

  reset(): void { this.smoothed = 0 }
}
