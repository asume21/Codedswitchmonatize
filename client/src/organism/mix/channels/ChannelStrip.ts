// Section 06 — Channel Strip

import * as Tone from 'tone'
import type { ChannelConfig } from '../types'

export class ChannelStrip {
  readonly name:       string
  readonly input:      Tone.Gain
  private  compressor: Tone.Compressor
  private  panner:     Tone.Panner
  private  fader:      Tone.Gain
  private  analyser:   Tone.Analyser
  readonly output:     Tone.Gain

  constructor(config: ChannelConfig) {
    this.name = config.name

    this.input = new Tone.Gain(1)

    this.compressor = new Tone.Compressor({
      threshold: config.compThresholdDb,
      ratio:     config.compRatio,
      attack:    config.compAttackMs / 1000,
      release:   config.compReleaseMs / 1000,
      knee:      config.compKneeDb,
    })

    this.panner = new Tone.Panner(config.pan)

    this.fader = new Tone.Gain(
      Tone.dbToGain(config.gainDb)
    )

    this.analyser = new Tone.Analyser('waveform', 1024)

    this.output = new Tone.Gain(1)

    // Signal chain: input → comp → panner → fader → analyser → output
    this.input.connect(this.compressor)
    this.compressor.connect(this.panner)
    this.panner.connect(this.fader)
    this.fader.connect(this.analyser)
    this.analyser.connect(this.output)
  }

  getMeter(): { peakDb: number; rmsDb: number } {
    const values = this.analyser.getValue() as Float32Array

    let peak    = 0
    let sumSq   = 0
    for (let i = 0; i < values.length; i++) {
      const abs = Math.abs(values[i])
      if (abs > peak) peak = abs
      sumSq += values[i] * values[i]
    }
    const rms = Math.sqrt(sumSq / values.length)

    const peakDb = peak  > 0 ? 20 * Math.log10(peak)  : -Infinity
    const rmsDb  = rms   > 0 ? 20 * Math.log10(rms)   : -Infinity

    return { peakDb, rmsDb }
  }

  setGainDb(db: number): void {
    this.fader.gain.rampTo(Tone.dbToGain(db), 0.05)
  }

  setPan(pan: number): void {
    this.panner.pan.rampTo(Math.max(-1, Math.min(1, pan)), 0.1)
  }

  dispose(): void {
    this.input.dispose()
    this.compressor.dispose()
    this.panner.dispose()
    this.fader.dispose()
    this.analyser.dispose()
    this.output.dispose()
  }
}
