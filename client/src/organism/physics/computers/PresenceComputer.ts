export class PresenceComputer {
  private readonly attackCoeff:  number
  private readonly releaseCoeff: number
  private smoothed: number = 0

  private readonly centroidRef = 3000

  constructor(sampleRate: number, frameSize: number, attackMs: number, releaseMs: number) {
    const fps         = sampleRate / frameSize
    this.attackCoeff  = 1 - Math.exp(-1 / (attackMs  * fps / 1000))
    this.releaseCoeff = 1 - Math.exp(-1 / (releaseMs * fps / 1000))
  }

  process(rms: number, spectralCentroid: number): number {
    const centroidFactor = Math.min(1, spectralCentroid / this.centroidRef)
    const raw = Math.sqrt(rms * centroidFactor)

    const coeff = raw > this.smoothed ? this.attackCoeff : this.releaseCoeff
    this.smoothed += coeff * (raw - this.smoothed)

    return Math.max(0, Math.min(1, this.smoothed))
  }

  reset(): void { this.smoothed = 0 }
}
