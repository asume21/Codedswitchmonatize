// Section 06 — Master Bus

import * as Tone from 'tone'

export class MasterBus {
  readonly input:      Tone.Gain
  private  masterGain: Tone.Gain
  private  saturator:  Tone.Distortion
  private  limiter:    Tone.Limiter
  private  analyser:   Tone.Analyser

  constructor(
    gainDb:           number,
    limiterThreshDb:  number,
    saturationAmount: number
  ) {
    this.input      = new Tone.Gain(1)
    this.masterGain = new Tone.Gain(Tone.dbToGain(gainDb))

    this.saturator = new Tone.Distortion({
      distortion: saturationAmount,
      wet:        saturationAmount * 0.5,
    })

    this.limiter  = new Tone.Limiter(limiterThreshDb)
    this.analyser = new Tone.Analyser('waveform', 2048)

    // Signal chain: input → masterGain → saturator → limiter → analyser → destination
    this.input.connect(this.masterGain)
    this.masterGain.connect(this.saturator)
    this.saturator.connect(this.limiter)
    this.limiter.connect(this.analyser)
    this.analyser.toDestination()
  }

  getMeter(): { peakDb: number; rmsDb: number } {
    const values = this.analyser.getValue() as Float32Array

    let peak  = 0
    let sumSq = 0
    for (let i = 0; i < values.length; i++) {
      const abs = Math.abs(values[i])
      if (abs > peak) peak = abs
      sumSq += values[i] * values[i]
    }
    const rms = Math.sqrt(sumSq / values.length)

    return {
      peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
      rmsDb:  rms  > 0 ? 20 * Math.log10(rms)  : -Infinity,
    }
  }

  setGainDb(db: number): void {
    this.masterGain.gain.rampTo(Tone.dbToGain(db), 0.05)
  }

  dispose(): void {
    this.input.dispose()
    this.masterGain.dispose()
    this.saturator.dispose()
    this.limiter.dispose()
    this.analyser.dispose()
  }
}
