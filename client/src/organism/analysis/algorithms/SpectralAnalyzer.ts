export interface SpectralResult {
  centroid: number
  hnr: number
  flux: number
}

export class SpectralAnalyzer {
  private readonly sampleRate: number
  private readonly frameSize: number
  private readonly previousSpectrum: Float32Array

  constructor(sampleRate: number, frameSize: number) {
    this.sampleRate = sampleRate
    this.frameSize = frameSize
    this.previousSpectrum = new Float32Array(frameSize / 2)
  }

  process(frequencyData: Float32Array): SpectralResult {
    const centroid = this.computeCentroid(frequencyData)
    const flux = this.computeFlux(frequencyData)
    const hnr = this.computeHnr(frequencyData)

    this.previousSpectrum.set(frequencyData)

    return {
      centroid,
      hnr,
      flux,
    }
  }

  reset(): void {
    this.previousSpectrum.fill(0)
  }

  private computeCentroid(spectrum: Float32Array): number {
    let weightedSum = 0
    let magnitudeSum = 0
    const binWidth = this.sampleRate / this.frameSize

    for (let index = 0; index < spectrum.length; index += 1) {
      const magnitude = spectrum[index]
      weightedSum += magnitude * index * binWidth
      magnitudeSum += magnitude
    }

    return magnitudeSum === 0 ? 0 : weightedSum / magnitudeSum
  }

  private computeFlux(spectrum: Float32Array): number {
    let flux = 0
    for (let index = 0; index < spectrum.length; index += 1) {
      const diff = spectrum[index] - this.previousSpectrum[index]
      flux += diff * diff
    }

    return Math.min(1, Math.sqrt(flux / spectrum.length) * 10)
  }

  private computeHnr(spectrum: Float32Array): number {
    let peakMagnitude = 0
    let noiseFloor = 0

    for (let index = 0; index < spectrum.length; index += 1) {
      if (spectrum[index] > peakMagnitude) {
        peakMagnitude = spectrum[index]
      }
      noiseFloor += spectrum[index]
    }

    noiseFloor /= spectrum.length

    if (noiseFloor === 0) {
      return 0
    }

    const ratio = peakMagnitude / noiseFloor
    return Math.max(-20, Math.min(20, 20 * Math.log10(ratio)))
  }
}
