// Section 06 — Master Bus

import * as Tone from 'tone'

export class MasterBus {
  readonly input:      Tone.Gain
  private  masterGain: Tone.Gain
  private  lowShelf:   Tone.Filter
  private  midCut:     Tone.Filter
  private  highShelf:  Tone.Filter
  private  hiCut:      Tone.Filter      // tames harsh MetalSynth / FM highs
  private  compressor: Tone.Compressor
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

    // Hip-hop master EQ: sub bass cleanup, mud cut, air presence, gentle LP safety net
    this.lowShelf  = new Tone.Filter({ type: 'lowshelf',  frequency: 45,   gain: -12.0 }) // aggressively cut sub-45Hz rumble that eats headroom
    this.midCut    = new Tone.Filter({ type: 'peaking',   frequency: 200,  gain: -3.0, Q: 0.8 }) // target exact 200Hz mud zone identified by WEBEAR
    this.highShelf = new Tone.Filter({ type: 'highshelf', frequency: 10000, gain: 1.0 })  // restore air/presence for hats
    this.hiCut     = new Tone.Filter({ type: 'lowpass',   frequency: 16000, rolloff: -24 }) // gentle LP — protect from harsh aliasing only

    // Glue compressor — much gentler; drum bus already compresses
    this.compressor = new Tone.Compressor({
      threshold: -24,   // was -16
      ratio:     2,     // was 3
      attack:    0.02,
      release:   0.25,
      knee:      8,
    })

    this.saturator = new Tone.Distortion({
      distortion: saturationAmount,
      wet:        saturationAmount * 0.5,
    })

    this.limiter  = new Tone.Limiter(limiterThreshDb)
    this.analyser = new Tone.Analyser('waveform', 2048)

    // Signal chain: input → gain → EQ → hiCut → compressor → saturator → limiter → analyser → out
    this.input.connect(this.masterGain)
    this.masterGain.connect(this.lowShelf)
    this.lowShelf.connect(this.midCut)
    this.midCut.connect(this.highShelf)
    this.highShelf.connect(this.hiCut)
    this.hiCut.connect(this.compressor)
    this.compressor.connect(this.saturator)
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
    this.lowShelf.dispose()
    this.midCut.dispose()
    this.highShelf.dispose()
    this.hiCut.dispose()
    this.compressor.dispose()
    this.saturator.dispose()
    this.limiter.dispose()
    this.analyser.dispose()
  }
}
