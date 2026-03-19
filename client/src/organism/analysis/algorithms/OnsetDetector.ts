export interface OnsetResult {
  detected: boolean
  strength: number
  timestamp: number
}

export class OnsetDetector {
  private readonly threshold: number
  private readonly frameSize: number
  private readonly sampleRate: number
  private previousSpectrum: Float32Array
  private previousHfc = 0
  private lastOnsetTimestamp = Number.NEGATIVE_INFINITY
  private readonly minOnsetGapMs = 50

  constructor(sampleRate: number, frameSize: number, threshold: number) {
    this.sampleRate = sampleRate
    this.frameSize = frameSize
    this.threshold = threshold
    this.previousSpectrum = new Float32Array(frameSize / 2)
  }

  process(frequencyData: Float32Array, now: number): OnsetResult {
    const hfc = this.computeHfc(frequencyData)
    const hfcDelta = Math.max(0, hfc - this.previousHfc)
    const timeSinceLastOnset = now - this.lastOnsetTimestamp
    const gapOk = timeSinceLastOnset > this.minOnsetGapMs
    const detected = hfcDelta > this.threshold && gapOk
    const strength = Math.min(1, hfcDelta / (this.threshold * 3))

    if (detected) {
      this.lastOnsetTimestamp = now
    }

    this.previousHfc = hfc
    this.previousSpectrum.set(frequencyData)

    return {
      detected,
      strength,
      timestamp: detected ? now : this.lastOnsetTimestamp,
    }
  }

  reset(): void {
    this.previousSpectrum.fill(0)
    this.previousHfc = 0
    this.lastOnsetTimestamp = Number.NEGATIVE_INFINITY
  }

  private computeHfc(spectrum: Float32Array): number {
    let hfc = 0
    for (let index = 0; index < spectrum.length; index += 1) {
      hfc += spectrum[index] * spectrum[index] * index
    }
    return hfc / spectrum.length
  }
}
