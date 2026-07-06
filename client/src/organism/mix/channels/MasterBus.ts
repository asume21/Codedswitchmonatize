// Section 06 — Master Bus
//
// Hip-hop-tuned mastering chain for the Organism's 5 channel strips. After
// processing, the signal is routed into `SharedMasterBus` (the app-wide final
// stage) instead of straight to `audioContext.destination`, so the studio's
// uploaded-song playback and the Organism share the same final safety limiter.

import * as Tone from 'tone'

// Base shelf gains the tilt-EQ pivots around (matches the tuned defaults set
// in the constructor below — kept as constants so setBrightness() can offset
// from the mastering-tuned baseline instead of a hardcoded neutral value).
const BASE_LOW_SHELF_GAIN_DB  = -3.0
const BASE_HIGH_SHELF_GAIN_DB = -0.5
// Musical range for the brightness knob — enough to noticeably warm/brighten
// without fighting the hip-hop master EQ tuning above it.
const BRIGHTNESS_TILT_DB = 4

export class MasterBus {
  readonly input:      Tone.Gain
  private  masterGain: Tone.Gain
  private  lowShelf:   Tone.Filter
  private  midCut:     Tone.Filter
  private  highShelf:  Tone.Filter
  private  hiCut:      Tone.Filter      // safety low-pass — never an audible cut
  private  compressor: Tone.Compressor
  private  saturator:  Tone.Distortion
  private  limiter:    Tone.Limiter
  private  safetyClip: Tone.WaveShaper  // TRUE ceiling — catches the transients the limiter overshoots
  private  tapGain:    Tone.Gain        // pass-through for the audio-debug tap
  private  analyser:   Tone.Analyser

  constructor(
    gainDb:           number,
    limiterThreshDb:  number,
    saturationAmount: number
  ) {
    this.input      = new Tone.Gain(1)
    this.masterGain = new Tone.Gain(Tone.dbToGain(gainDb))

    // Hip-hop master EQ:
    //   • cut sub-45Hz rumble (claws back headroom we never hear)
    //   • narrow 200Hz mud notch (Q=2.0 — only the mud, not the warmth)
    //   • -0.5dB high shelf (gentle digital-harshness tame, won't darken)
    //   • LP at 18kHz (effectively bypassed for human hearing; safety only)
    // Gentle deep-rumble control only. A -12 dB shelf at 45 Hz was gutting the
    // sub region (20-80 Hz measured at ~4%), leaving the kick with no punch and
    // the bass a mid-rangey "grunt". Move the corner down to 30 Hz and back off
    // to -3 dB so true sub-rumble below ~30 Hz is tamed but the 40-80 Hz
    // foundation that drives hip-hop survives.
    this.lowShelf  = new Tone.Filter({ type: 'lowshelf',  frequency: 30,    gain: BASE_LOW_SHELF_GAIN_DB })
    this.midCut    = new Tone.Filter({ type: 'peaking',   frequency: 200,   gain: -1.5, Q: 2.0 })
    this.highShelf = new Tone.Filter({ type: 'highshelf', frequency: 10000, gain: BASE_HIGH_SHELF_GAIN_DB })
    this.hiCut     = new Tone.Filter({ type: 'lowpass',   frequency: 18000, rolloff: -24 })

    // Glue compressor — fast attack catches transients before they hit the
    // limiter, gentle ratio keeps the program "feel" intact.
    this.compressor = new Tone.Compressor({
      threshold: -18,
      ratio:     1.5,
      attack:    0.008,
      release:   0.15,
      knee:      10,
    })

    // Soft saturator — wet at 0.2× to add a hair of even-harmonic warmth
    // without producing audible aliasing harmonics above Nyquist.
    this.saturator = new Tone.Distortion({
      distortion: saturationAmount,
      wet:        saturationAmount * 0.2,
    })

    this.limiter  = new Tone.Limiter(limiterThreshDb)

    // TRUE ceiling. Tone.Limiter wraps a DynamicsCompressorNode — a compressor
    // with finite attack, NOT a brickwall — so fast transients (kick/808/snare
    // attacks) overshoot its threshold for a few ms and reach the DAC above 0
    // dBFS (measured: +2.4 dBFS / 0.81% clipped even at limiterThresh -1, master
    // -6). Lowering levels only shrinks the overshoot; it never removes it. This
    // WaveShaper is the absolute ceiling the limiter can't be: linear below the
    // knee (the bulk of the program is untouched), soft-saturating only the peaks
    // above it, and — because a WaveShaper curve is defined over [-1,1] and clamps
    // out-of-range inputs to its endpoints — anything past ±1 is pinned to the
    // ceiling value. So no sample can exceed it, guaranteed. 4× oversampled to
    // keep the peak-rounding from aliasing back down as harshness.
    const ceiling = Tone.dbToGain(-0.3)  // ~0.966 — just under 0 dBFS
    const knee    = 0.85                  // below this (~-1.4 dB) the signal is linear
    this.safetyClip = new Tone.WaveShaper((x: number) => {
      const a = Math.abs(x)
      if (a <= knee) return x
      const over  = Math.min(a, 1) - knee
      const range = 1 - knee
      return Math.sign(x) * (knee + (ceiling - knee) * Math.tanh(over / range))
    }, 4096)
    this.safetyClip.oversample = '4x'

    this.tapGain  = new Tone.Gain(1)
    this.analyser = new Tone.Analyser('waveform', 256)

    // Signal chain: input → gain → EQ → hiCut → comp → sat → limiter → safetyClip → tap → analyser → destination
    this.input.connect(this.masterGain)
    this.masterGain.connect(this.lowShelf)
    this.lowShelf.connect(this.midCut)
    this.midCut.connect(this.highShelf)
    this.highShelf.connect(this.hiCut)
    this.hiCut.connect(this.compressor)
    this.compressor.connect(this.saturator)
    this.saturator.connect(this.limiter)
    this.limiter.connect(this.safetyClip)
    this.safetyClip.connect(this.tapGain)
    this.tapGain.connect(this.analyser)
    // Final hop: Tone's destination (audioContext.destination via Tone.js).
    // We tried routing through SharedMasterBus and it broke Tone.Part scheduling
    // for the Organism in a way we couldn't reproduce in tests. Until we have
    // browser-side AudioParam inspection (audio-debug MCP), each engine masters
    // itself and reaches the speakers directly.
    this.analyser.toDestination()

    console.log('🎛️ Organism MasterBus → destination')
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

  /**
   * Master tone tilt knob. `value` is -1 (dark/warm) .. 0 (neutral) .. 1
   * (bright). Tilts the low and high shelves in opposite directions around
   * their mastering-tuned baseline — brighter lifts highs and gently pulls
   * back lows (and vice versa for darker) so the low end doesn't just pile
   * up when you brighten, or the top end doesn't just vanish when you warm.
   */
  setBrightness(value: number): void {
    const v = Math.max(-1, Math.min(1, value))
    this.highShelf.gain.rampTo(BASE_HIGH_SHELF_GAIN_DB + v * BRIGHTNESS_TILT_DB, 0.05)
    this.lowShelf.gain.rampTo(BASE_LOW_SHELF_GAIN_DB - v * (BRIGHTNESS_TILT_DB * 0.5), 0.05)
  }

  connectOutput(destination: Tone.InputNode): void {
    this.tapGain.connect(destination)
  }

  disconnectOutput(destination: Tone.InputNode): void {
    try { this.tapGain.disconnect(destination) } catch { /* already disconnected */ }
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
    this.safetyClip.dispose()
    this.tapGain.dispose()
    this.analyser.dispose()
  }
}
