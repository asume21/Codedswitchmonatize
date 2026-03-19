export class BounceComputer {
  private readonly windowFrames: number
  private readonly smoothing:    number

  private deviationBuffer: number[] = []
  private smoothedBounce:  number   = 0

  constructor(windowFrames: number, smoothing: number) {
    this.windowFrames = windowFrames
    this.smoothing    = smoothing
  }

  process(onsetDetected: boolean, gridDeviationMs: number): number {
    if (onsetDetected) {
      this.deviationBuffer.push(gridDeviationMs)
      if (this.deviationBuffer.length > this.windowFrames) {
        this.deviationBuffer.shift()
      }
    }

    if (this.deviationBuffer.length === 0) return this.smoothedBounce

    const avgDeviation = this.deviationBuffer.reduce((a, b) => a + b, 0)
      / this.deviationBuffer.length

    const raw = Math.max(0, Math.min(1, (-avgDeviation + 30) / 60))

    this.smoothedBounce += this.smoothing * (raw - this.smoothedBounce)

    return this.smoothedBounce
  }

  reset(): void {
    this.deviationBuffer = []
    this.smoothedBounce  = 0
  }
}
