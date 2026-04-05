// Section 06 — Channel Strip

import * as Tone from 'tone'
import type { ChannelConfig } from '../types'
import { SidechainDucker, type SidechainConfig } from './SidechainDucker'

export class ChannelStrip {
  readonly name:       string
  readonly input:      Tone.Gain
  private  highpass:   Tone.Filter
  private  lowShelf:   Tone.Filter
  private  midPeak:    Tone.Filter
  private  highShelf:  Tone.Filter
  private  compressor: Tone.Compressor
  private  panner:     Tone.Panner
  private  fader:      Tone.Gain
  private  analyser:   Tone.Analyser
  readonly output:     Tone.Gain

  private  sidechain:  SidechainDucker | null = null

  constructor(config: ChannelConfig) {
    this.name = config.name

    this.input = new Tone.Gain(1)

    // Per-channel EQ — highpass, low shelf, mid peak, high shelf
    const eq = config.eq
    this.highpass  = new Tone.Filter({ type: 'highpass',  frequency: eq?.highpassHz  ?? 20,  rolloff: -24 })
    this.lowShelf  = new Tone.Filter({ type: 'lowshelf',  frequency: eq?.lowShelfHz  ?? 200, gain: eq?.lowShelfGain  ?? 0 })
    this.midPeak   = new Tone.Filter({ type: 'peaking',   frequency: eq?.midHz       ?? 1000, gain: eq?.midGain      ?? 0, Q: eq?.midQ ?? 1.0 })
    this.highShelf = new Tone.Filter({ type: 'highshelf', frequency: eq?.highShelfHz ?? 8000, gain: eq?.highShelfGain ?? 0 })

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

    // Signal chain: input → HP → lowShelf → midPeak → highShelf → comp → panner → fader → analyser → output
    this.input.connect(this.highpass)
    this.highpass.connect(this.lowShelf)
    this.lowShelf.connect(this.midPeak)
    this.midPeak.connect(this.highShelf)
    this.highShelf.connect(this.compressor)
    this.compressor.connect(this.panner)
    this.panner.connect(this.fader)
    this.fader.connect(this.analyser)
    this.analyser.connect(this.output)
  }

  /**
   * Enable sidechain ducking on this channel.
   * Inserts a gain node between fader and analyser that ducks on trigger.
   * Returns the SidechainDucker so the caller can trigger it from kick hits.
   */
  enableSidechain(config?: Partial<SidechainConfig>): SidechainDucker {
    if (this.sidechain) return this.sidechain

    this.sidechain = new SidechainDucker(config)

    // Re-wire: fader → sidechain → analyser (instead of fader → analyser)
    this.fader.disconnect(this.analyser)
    this.fader.connect(this.sidechain.node)
    this.sidechain.node.connect(this.analyser)

    return this.sidechain
  }

  /** Get the sidechain ducker (null if not enabled). */
  getSidechain(): SidechainDucker | null {
    return this.sidechain
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
    this.fader.gain.rampTo(Tone.dbToGain(db), 0.15)
  }

  setPan(pan: number): void {
    this.panner.pan.rampTo(Math.max(-1, Math.min(1, pan)), 0.1)
  }

  dispose(): void {
    this.input.dispose()
    this.highpass.dispose()
    this.lowShelf.dispose()
    this.midPeak.dispose()
    this.highShelf.dispose()
    this.compressor.dispose()
    this.panner.dispose()
    this.fader.dispose()
    this.analyser.dispose()
    this.output.dispose()
    this.sidechain?.dispose()
  }
}
