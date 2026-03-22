export class PulseTracker {
  private readonly minBpm:        number
  private readonly maxBpm:        number
  private readonly inertiaBars:   number
  private readonly confidenceMin: number

  private onsetBuffer: number[] = []
  private readonly maxOnsets = 32

  private currentBpm:  number = 90
  private confidence:  number = 0
  private lastOnsetMs: number = -Infinity

  constructor(
    minBpm: number,
    maxBpm: number,
    inertiaBars: number,
    confidenceMin: number
  ) {
    this.minBpm        = minBpm
    this.maxBpm        = maxBpm
    this.inertiaBars   = inertiaBars
    this.confidenceMin = confidenceMin
  }

  process(onsetDetected: boolean, onsetTimestamp: number, onsetStrength: number): number {
    if (onsetDetected && onsetStrength >= this.confidenceMin) {
      if (onsetTimestamp !== this.lastOnsetMs) {
        this.onsetBuffer.push(onsetTimestamp)
        if (this.onsetBuffer.length > this.maxOnsets) {
          this.onsetBuffer.shift()
        }
        this.lastOnsetMs = onsetTimestamp
      }
    }

    if (this.onsetBuffer.length < 4) return this.currentBpm

    const iois: number[] = []
    for (let i = 1; i < this.onsetBuffer.length; i += 1) {
      iois.push(this.onsetBuffer[i] - this.onsetBuffer[i - 1])
    }

    const candidateBpm = this.estimateBpmFromIois(iois)
    if (candidateBpm === null) return this.currentBpm

    const beatsPerBar     = 4
    const msPerBar        = (60000 / this.currentBpm) * beatsPerBar
    const framesPerBar    = msPerBar / 23.2
    const totalFrames     = this.inertiaBars * framesPerBar
    const correctionCoeff = 1 / totalFrames

    this.currentBpm += correctionCoeff * (candidateBpm - this.currentBpm)
    this.currentBpm  = Math.max(this.minBpm, Math.min(this.maxBpm, this.currentBpm))

    return this.currentBpm
  }

  private estimateBpmFromIois(iois: number[]): number | null {
    if (iois.length === 0) return null

    // Pass 1: generate candidate BPMs and bin them in O(n)
    const binWidth = 5
    const histogram = new Map<number, number>()

    for (const ioi of iois) {
      for (const multiplier of [0.25, 0.5, 1, 2, 4]) {
        const period = ioi * multiplier
        const bpm    = 60000 / period
        if (bpm >= this.minBpm && bpm <= this.maxBpm) {
          const bin = Math.round(bpm / binWidth) * binWidth
          histogram.set(bin, (histogram.get(bin) ?? 0) + 1)
        }
      }
    }

    if (histogram.size === 0) return null

    // Pass 2: find the bin with the highest count in O(bins)
    let bestBin   = 0
    let bestCount = 0
    for (const [bin, count] of histogram) {
      if (count > bestCount) {
        bestCount = count
        bestBin   = bin
      }
    }

    return bestBin
  }

  getBpm():        number { return this.currentBpm }
  getConfidence(): number { return this.confidence }

  reset(): void {
    this.onsetBuffer = []
    this.currentBpm  = 90
    this.confidence  = 0
    this.lastOnsetMs = -Infinity
  }
}
