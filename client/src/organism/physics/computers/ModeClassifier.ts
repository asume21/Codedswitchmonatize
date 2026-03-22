import { OrganismMode } from '../types'

interface ModeFeatures {
  avgRms:      number
  rmsVariance: number
  avgPitch:    number
  pitchRange:  number
  avgCentroid: number
  avgHnr:      number
}

export class ModeClassifier {
  private readonly windowFrames:     number
  private readonly hysteresisFrames: number

  private rmsBuffer:      number[] = []
  private pitchBuffer:    number[] = []
  private centroidBuffer: number[] = []
  private hnrBuffer:      number[] = []

  private currentMode:          OrganismMode = OrganismMode.Glow
  private framesSinceLastChange: number      = Infinity

  constructor(windowFrames: number, hysteresisFrames: number) {
    this.windowFrames     = windowFrames
    this.hysteresisFrames = hysteresisFrames
  }

  process(
    rms:             number,
    pitch:           number,
    spectralCentroid: number,
    hnr:             number
  ): OrganismMode {
    this.push(this.rmsBuffer,      rms)
    if (pitch > 0) this.push(this.pitchBuffer, pitch)
    this.push(this.centroidBuffer, spectralCentroid)
    this.push(this.hnrBuffer,      hnr)

    this.framesSinceLastChange += 1

    if (
      this.rmsBuffer.length < this.windowFrames ||
      this.framesSinceLastChange < this.hysteresisFrames
    ) {
      return this.currentMode
    }

    const features = this.extractFeatures()
    const newMode  = this.classify(features)

    if (newMode !== this.currentMode) {
      this.currentMode          = newMode
      this.framesSinceLastChange = 0
    }

    return this.currentMode
  }

  private push(buffer: number[], value: number): void {
    buffer.push(value)
    if (buffer.length > this.windowFrames) buffer.shift()
  }

  private extractFeatures(): ModeFeatures {
    const avgRms      = this.mean(this.rmsBuffer)
    const rmsVariance = this.variance(this.rmsBuffer, avgRms)
    const avgPitch    = this.pitchBuffer.length > 0 ? this.mean(this.pitchBuffer) : 0
    const pitchRange  = this.pitchBuffer.length > 0
      ? this.arrayMax(this.pitchBuffer) - this.arrayMin(this.pitchBuffer)
      : 0
    const avgCentroid = this.mean(this.centroidBuffer)
    const avgHnr      = this.mean(this.hnrBuffer)

    return { avgRms, rmsVariance, avgPitch, pitchRange, avgCentroid, avgHnr }
  }

  // Weighted scoring — each mode accumulates a score from partial matches
  // instead of requiring ALL conditions to be true simultaneously
  private classify(f: ModeFeatures): OrganismMode {
    const scores: Record<OrganismMode, number> = {
      [OrganismMode.Heat]:   0,
      [OrganismMode.Gravel]: 0,
      [OrganismMode.Ice]:    0,
      [OrganismMode.Smoke]:  0,
      [OrganismMode.Glow]:   0,
    }

    // Heat — loud, variable, bright, noisy
    if (f.avgRms > 0.5)       scores[OrganismMode.Heat] += 2.0
    if (f.rmsVariance > 0.04) scores[OrganismMode.Heat] += 1.5
    if (f.avgCentroid > 2200) scores[OrganismMode.Heat] += 1.5
    if (f.avgHnr < 6)        scores[OrganismMode.Heat] += 1.0

    // Gravel — mid-loud, narrow pitch, dark, rough
    if (f.avgRms > 0.35)      scores[OrganismMode.Gravel] += 1.5
    if (f.pitchRange < 120)   scores[OrganismMode.Gravel] += 2.0
    if (f.avgCentroid < 2200) scores[OrganismMode.Gravel] += 1.5
    if (f.avgHnr < 4)        scores[OrganismMode.Gravel] += 1.0

    // Ice — quiet, stable, wide pitch, tonal
    if (f.avgRms < 0.4)       scores[OrganismMode.Ice] += 1.5
    if (f.rmsVariance < 0.025) scores[OrganismMode.Ice] += 1.5
    if (f.pitchRange > 120)   scores[OrganismMode.Ice] += 2.0
    if (f.avgHnr > 7)        scores[OrganismMode.Ice] += 1.0

    // Smoke — quiet, dark, stable
    if (f.avgRms < 0.5)       scores[OrganismMode.Smoke] += 1.0
    if (f.avgCentroid < 2000) scores[OrganismMode.Smoke] += 2.0
    if (f.rmsVariance < 0.035) scores[OrganismMode.Smoke] += 1.5

    // Glow — moderate baseline (default bias)
    scores[OrganismMode.Glow] += 2.5
    if (f.avgHnr > 5)        scores[OrganismMode.Glow] += 1.0

    // Find highest score
    let best = OrganismMode.Glow
    let bestScore = 0
    for (const [mode, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score
        best = mode as OrganismMode
      }
    }
    return best
  }

  private mean(arr: number[]): number {
    return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
  }

  private variance(arr: number[], mean: number): number {
    if (arr.length === 0) return 0
    return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length
  }

  private arrayMax(arr: number[]): number {
    let max = -Infinity
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > max) max = arr[i]
    }
    return max
  }

  private arrayMin(arr: number[]): number {
    let min = Infinity
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] < min) min = arr[i]
    }
    return min
  }

  getCurrentMode(): OrganismMode { return this.currentMode }

  reset(): void {
    this.rmsBuffer             = []
    this.pitchBuffer           = []
    this.centroidBuffer        = []
    this.hnrBuffer             = []
    this.currentMode           = OrganismMode.Glow
    this.framesSinceLastChange = Infinity
  }
}
