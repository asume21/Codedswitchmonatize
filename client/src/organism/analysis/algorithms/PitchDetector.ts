export interface PitchResult {
  pitch: number
  confidence: number
  midi: number
  cents: number
}

export class PitchDetector {
  private readonly sampleRate: number
  private readonly bufferSize: number
  private readonly minHz: number
  private readonly maxHz: number
  private readonly threshold = 0.15
  private readonly minLag: number
  private readonly maxLag: number
  private readonly yinBuffer: Float32Array

  constructor(sampleRate: number, bufferSize: number, minHz: number, maxHz: number) {
    this.sampleRate = sampleRate
    this.bufferSize = bufferSize
    this.minHz = minHz
    this.maxHz = maxHz
    this.minLag = Math.floor(sampleRate / maxHz)
    this.maxLag = Math.min(bufferSize - 1, Math.ceil(sampleRate / minHz))
    this.yinBuffer = new Float32Array(this.maxLag + 1)
  }

  process(buffer: Float32Array): PitchResult {
    this.computeDifferenceFunction(buffer)
    this.computeCumulativeMeanNormalizedDifference()

    const tau = this.absoluteThreshold()
    if (tau === -1) {
      return { pitch: 0, confidence: 0, midi: 0, cents: 0 }
    }

    const refinedTau = this.parabolicInterpolation(tau)
    if (!Number.isFinite(refinedTau) || refinedTau <= 0) {
      return { pitch: 0, confidence: 0, midi: 0, cents: 0 }
    }

    const pitch = this.sampleRate / refinedTau
    if (!Number.isFinite(pitch) || pitch < this.minHz || pitch > this.maxHz) {
      return { pitch: 0, confidence: 0, midi: 0, cents: 0 }
    }

    const confidence = Math.max(0, Math.min(1, 1 - this.yinBuffer[tau]))
    const midi = this.pitchToMidi(pitch)
    const cents = this.pitchToCents(pitch, midi)

    return { pitch, confidence, midi, cents }
  }

  private computeDifferenceFunction(buffer: Float32Array): void {
    this.yinBuffer[0] = 0
    for (let tau = 1; tau <= this.maxLag; tau += 1) {
      let sum = 0
      for (let index = 0; index < this.bufferSize - tau; index += 1) {
        const delta = buffer[index] - buffer[index + tau]
        sum += delta * delta
      }
      this.yinBuffer[tau] = sum
    }
  }

  private computeCumulativeMeanNormalizedDifference(): void {
    this.yinBuffer[0] = 1
    let runningSum = 0
    for (let tau = 1; tau <= this.maxLag; tau += 1) {
      runningSum += this.yinBuffer[tau]
      this.yinBuffer[tau] = runningSum === 0 ? 1 : (this.yinBuffer[tau] * tau) / runningSum
    }
  }

  private absoluteThreshold(): number {
    for (let tau = this.minLag; tau <= this.maxLag; tau += 1) {
      if (this.yinBuffer[tau] < this.threshold) {
        let minimumTau = tau
        while (minimumTau + 1 <= this.maxLag && this.yinBuffer[minimumTau + 1] < this.yinBuffer[minimumTau]) {
          minimumTau += 1
        }
        return minimumTau
      }
    }
    return -1
  }

  private parabolicInterpolation(tau: number): number {
    if (tau <= 1 || tau >= this.maxLag) {
      return tau
    }

    const s0 = this.yinBuffer[tau - 1]
    const s1 = this.yinBuffer[tau]
    const s2 = this.yinBuffer[tau + 1]
    const denominator = 2 * (2 * s1 - s2 - s0)

    if (denominator === 0) {
      return tau
    }

    return tau + (s2 - s0) / denominator
  }

  private pitchToMidi(hz: number): number {
    return Math.round(12 * Math.log2(hz / 440) + 69)
  }

  private pitchToCents(hz: number, midi: number): number {
    const midiHz = 440 * Math.pow(2, (midi - 69) / 12)
    return Math.round(1200 * Math.log2(hz / midiHz))
  }
}
