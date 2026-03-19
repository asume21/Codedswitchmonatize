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
      ? Math.max(...this.pitchBuffer) - Math.min(...this.pitchBuffer)
      : 0
    const avgCentroid = this.mean(this.centroidBuffer)
    const avgHnr      = this.mean(this.hnrBuffer)

    return { avgRms, rmsVariance, avgPitch, pitchRange, avgCentroid, avgHnr }
  }

  private classify(f: ModeFeatures): OrganismMode {
    if (f.avgRms > 0.6 && f.rmsVariance > 0.05 && f.avgCentroid > 2500 && f.avgHnr < 5) {
      return OrganismMode.Heat
    }
    if (f.avgRms > 0.4 && f.pitchRange < 100 && f.avgCentroid < 2000 && f.avgHnr < 3) {
      return OrganismMode.Gravel
    }
    if (f.avgRms < 0.35 && f.rmsVariance < 0.02 && f.pitchRange > 150 && f.avgHnr > 8) {
      return OrganismMode.Ice
    }
    if (f.avgRms < 0.45 && f.avgCentroid < 1800 && f.rmsVariance < 0.03) {
      return OrganismMode.Smoke
    }
    return OrganismMode.Glow
  }

  private mean(arr: number[]): number {
    return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
  }

  private variance(arr: number[], mean: number): number {
    if (arr.length === 0) return 0
    return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length
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
