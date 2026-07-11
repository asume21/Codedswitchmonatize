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

  // Solo/isolation state — used by the fire-beats capture bench to record one
  // role at a time, and by future "Solo Spotlight" UI to reflect the live state.
  private  _muted:     boolean = false

  // Bass parallel saturation crossover
  private  bassLowpass?:    Tone.Filter
  private  bassBandpass?:   Tone.Filter
  private  bassDistortion?: Tone.Distortion
  private  bassSum?:        Tone.Gain

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

    this.analyser = new Tone.Analyser('waveform', 128)

    this.output = new Tone.Gain(1)

    // Signal chain: input → HP → lowShelf → midPeak → highShelf → comp → [Bass Saturation Split if bass] → panner → fader → analyser → output
    this.input.connect(this.highpass)
    this.highpass.connect(this.lowShelf)
    this.lowShelf.connect(this.midPeak)
    this.midPeak.connect(this.highShelf)
    this.highShelf.connect(this.compressor)

    if (this.name === 'bass') {
      this.bassLowpass = new Tone.Filter({
        frequency: 120,
        type: 'lowpass',
        rolloff: -12
      })
      this.bassBandpass = new Tone.Filter({
        frequency: 575, // Center between 150Hz and 1000Hz
        Q: 0.5,
        type: 'bandpass'
      })
      this.bassDistortion = new Tone.Distortion({
        distortion: 0.25,
        oversample: '4x',
        wet: 1.0
      })
      this.bassSum = new Tone.Gain(1)

      // Crossover routing
      this.compressor.connect(this.bassLowpass)
      this.compressor.connect(this.bassBandpass)

      this.bassLowpass.connect(this.bassSum)
      this.bassBandpass.connect(this.bassDistortion)
      this.bassDistortion.connect(this.bassSum)

      this.bassSum.connect(this.panner)
    } else {
      this.compressor.connect(this.panner)
    }

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

  setBassDistortion(amount: number): void {
    if (this.bassDistortion) {
      this.bassDistortion.distortion = Math.max(0, Math.min(1, amount))
    }
  }

  setBassCrossover(lowpassFreq: number, bandpassFreq: number): void {
    if (this.bassLowpass) this.bassLowpass.frequency.value = lowpassFreq
    if (this.bassBandpass) this.bassBandpass.frequency.value = bandpassFreq
  }

  setGainDb(db: number): void {
    this.fader.gain.rampTo(Tone.dbToGain(db), 0.15)
  }

  /** Whether this strip is currently silenced by a solo elsewhere. */
  get muted(): boolean {
    return this._muted
  }

  /**
   * Silence or restore this strip's output without touching the tuned fader
   * gain. Uses the dedicated output node so restore is bit-exact (always 1),
   * and a short ramp avoids a click. Independent of setGainDb().
   */
  setSoloMuted(muted: boolean): void {
    this._muted = muted
    this.output.gain.rampTo(muted ? 0 : 1, 0.05)
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
    if (this.name === 'bass') {
      this.bassLowpass?.dispose()
      this.bassBandpass?.dispose()
      this.bassDistortion?.dispose()
      this.bassSum?.dispose()
    }
  }
}
