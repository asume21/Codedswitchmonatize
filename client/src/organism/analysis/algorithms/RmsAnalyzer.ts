export class RmsAnalyzer {
  private smoothed = 0
  private readonly attackCoeff: number
  private readonly releaseCoeff: number

  constructor(
    sampleRate: number,
    frameSize: number,
    attackMs: number,
    releaseMs: number,
  ) {
    const framesPerSecond = sampleRate / frameSize
    this.attackCoeff = 1 - Math.exp(-1 / (attackMs * framesPerSecond / 1000))
    this.releaseCoeff = 1 - Math.exp(-1 / (releaseMs * framesPerSecond / 1000))
  }

  process(buffer: Float32Array): { rms: number; rmsRaw: number } {
    let sumOfSquares = 0
    for (let index = 0; index < buffer.length; index += 1) {
      sumOfSquares += buffer[index] * buffer[index]
    }

    const rmsRaw = Math.sqrt(sumOfSquares / buffer.length)
    const coeff = rmsRaw > this.smoothed ? this.attackCoeff : this.releaseCoeff
    this.smoothed += coeff * (rmsRaw - this.smoothed)

    return {
      rms: this.smoothed,
      rmsRaw,
    }
  }

  reset(): void {
    this.smoothed = 0
  }
}
