// Section 04 — Texture Generator

import * as Tone from 'tone'
import type { LoopClip } from '@shared/loopPack'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName }      from './types'
import { TEXTURE_BY_MODE }    from './patterns/TexturePatternLibrary'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState }             from '../state/types'

export class TextureGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private noiseSource: Tone.Noise
  private highpass:    Tone.Filter      // keeps pink noise out of sub/bass range
  private filter:      Tone.Filter
  private reverb:      Tone.Reverb
  private gain:        Tone.Gain

  // ── Riser sub-chain ────────────────────────────────────────────────
  // Separate noise + bandpass + gain so we can fire upward sweeps at section
  // boundaries without disturbing the steady-state texture bed. Output joins
  // `this.output` so it inherits the same channel-strip routing.
  private riserNoise:  Tone.Noise
  private riserFilter: Tone.Filter
  private riserGain:   Tone.Gain
  private riserStarted: boolean = false

  // Thinning state (responds to DensityComputer.thinningRequested)
  private thinningActive: boolean = false
  private noiseStarted:   boolean = false
  private enabled:        boolean = false  // controlled by orchestrator textureEnabled toggle

  // Ramp dedup — skip scheduling redundant ramps when values haven't changed
  private lastOutputGain:    number = 0
  private lastFilterFreq:    number = 600
  private lastReverbWet:     number = 0.25

  constructor() {
    super(GeneratorName.Texture)

    this.noiseSource = new Tone.Noise('pink')
    this.highpass    = new Tone.Filter({ type: 'highpass', frequency: 400, rolloff: -24 })  // hard cut below 400Hz — no hum
    this.filter      = new Tone.Filter(600, 'lowpass')    // start moderate, opens as organism warms up
    this.reverb      = new Tone.Reverb({ decay: 1.0, wet: 0.25 })  // short tail, low wet to prevent wash buildup
    this.gain        = new Tone.Gain(0)

    this.output = new Tone.Gain(1)

    // Signal chain: noise → highpass → lowpass → reverb → gain → output
    this.noiseSource.connect(this.highpass)
    this.highpass.connect(this.filter)
    this.filter.connect(this.reverb)
    this.reverb.connect(this.gain)
    this.gain.connect(this.output)

    // Riser sub-chain: white noise → resonant bandpass → gain → output.
    // Starts silent; triggerRiser() opens the gain and sweeps the filter freq.
    this.riserNoise  = new Tone.Noise('white')
    this.riserFilter = new Tone.Filter({ type: 'bandpass', frequency: 200, Q: 3.5 })
    this.riserGain   = new Tone.Gain(0)
    this.riserNoise.connect(this.riserFilter)
    this.riserFilter.connect(this.riserGain)
    this.riserGain.connect(this.output)

    // Do NOT start noise here — defer until organism leaves Dormant
    // this.noiseSource.start()
  }

  /**
   * Schedule a filter-sweep riser that peaks at `peakAt` (AudioContext time).
   * Default behavior: start now, ramp up over `durationSec` so the peak lands
   * `durationSec` from now. Used by GeneratorOrchestrator at the start of a
   * `build` section so the noise sweep climaxes exactly when the `drop` enters.
   *
   * The riser tails off quickly after the peak so it doesn't smear the drop's
   * impact hit. Safe to call repeatedly — the riser sub-chain is independent
   * of the steady-state texture bed.
   */
  triggerRiser(durationSec: number, peakAt?: number): void {
    if (!this.enabled) return
    const startAt = Tone.now() + 0.02
    const peak = peakAt ?? startAt + durationSec
    // Start the noise source lazily — it runs forever after but is gated by
    // riserGain, which sits at 0 except during sweeps.
    if (!this.riserStarted) {
      this.riserNoise.start()
      this.riserStarted = true
    }
    // Filter freq: 200Hz → 8kHz exponential sweep into the drop.
    this.riserFilter.frequency.cancelScheduledValues(startAt)
    this.riserFilter.frequency.setValueAtTime(200, startAt)
    this.riserFilter.frequency.exponentialRampToValueAtTime(8000, peak)
    // Gain: silent → -10dB ramp to peak, then quick tail-off so the drop hits clean.
    const peakGain = Math.pow(10, -10 / 20)  // -10 dB
    this.riserGain.gain.cancelScheduledValues(startAt)
    this.riserGain.gain.setValueAtTime(0, startAt)
    this.riserGain.gain.linearRampToValueAtTime(peakGain, peak)
    this.riserGain.gain.linearRampToValueAtTime(0, peak + 0.15)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.activityLevel = 0
      this.gain.gain.rampTo(0, 0.3)
    }
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    // Hard gate — when disabled, skip all processing.
    // Gain was already ramped to 0 in setEnabled(false) — don't re-ramp
    // here, as it cancels the in-progress ramp and creates a discontinuity.
    if (!this.enabled) return

    const modeName = physics.mode.toString()
    const layer    = TEXTURE_BY_MODE[modeName]
    if (!layer) return

    // Target level based on state + density thinning.
    // Composer's role caps activity; reactive curve adds feel under the ceiling.
    let targetLevel = this.computeTargetLevel(organism) * this.roleCeiling()
    if (this.thinningActive) targetLevel *= 0.4   // organism breathing out

    this.activityLevel += this.smoothingCoeff(130) * (targetLevel - this.activityLevel)

    // Apply gain (texture is always soft — max -12 dB)
    const shaped = this.activityLevel * layer.gainLevel * this.arrangementMultiplier
    const db = shaped <= 0
      ? -Infinity
      : 20 * Math.log10(Math.max(0.0001, shaped))
    const linear = db === -Infinity ? 0 : Math.pow(10, db / 20)
    // Threshold of 0.008 (~0.07dB) prevents physics micro-drift from
    // restarting ramps every frame. Previous threshold of 0.001 was too tight.
    if (Math.abs(linear - this.lastOutputGain) > 0.008) {
      this.lastOutputGain = linear
      this.gain.gain.cancelScheduledValues(Tone.now())
      this.gain.gain.rampTo(linear, 0.5)
    }

    // Morph filter cutoff toward mode target — only if changed
    if (Math.abs(layer.filterFreq - this.lastFilterFreq) > 1) {
      this.lastFilterFreq = layer.filterFreq
      this.filter.frequency.cancelScheduledValues(Tone.now())
      this.filter.frequency.rampTo(layer.filterFreq, 1.0)
    }

    // Morph reverb wet toward mode target — only if changed
    if (Math.abs(layer.reverbWet - this.lastReverbWet) > 0.005) {
      this.lastReverbWet = layer.reverbWet
      this.reverb.wet.rampTo(layer.reverbWet, 2.0)
    }
  }

  // Called by GeneratorOrchestrator when DensityComputer requests thinning
  setThinning(active: boolean): void {
    this.thinningActive = active
  }

  onStateTransition(to: OState, _physics: PhysicsState): void {
    if (to === OState.Dormant || !this.enabled) {
      this.activityLevel = 0
      this.gain.gain.rampTo(0, 1.0)
      // Do NOT stop the noise source — Tone.Noise.stop()+start() creates a new
      // AudioBufferSourceNode each time without freeing the old one, leaking ~4MB
      // per cycle. Silence via gain instead; the noise source runs continuously.
    } else if (!this.noiseStarted) {
      // Start noise once on first non-Dormant transition; reuse forever after.
      this.noiseSource.start()
      this.noiseStarted = true
    }
  }

  reset(): void {
    this.activityLevel  = 0
    this.thinningActive = false
    this.gain.gain.rampTo(0, 0.5)
    // Do NOT stop noiseSource here — same leak as onStateTransition.
    // Gain ramp to 0 provides silence; source is disposed in dispose().
  }

  // ── Reactive mutation methods (Section 05) ────────────────────────

  applyVolumeMultiplier(multiplier: number): void {
    const m = Math.max(0, Math.min(1.3, multiplier))  // cap at 1.3 — texture should never dominate
    this.gain.gain.rampTo(m, 0.25)
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:    return 0
      case OState.Awakening:  return 0.05 * organism.awakeningProgress
      case OState.Breathing:  return 0.15 * organism.breathingWarmth
      case OState.Flow:       return 0.20 + (0.08 * organism.flowDepth)
    }
  }

  // Loop mode — plays a pre-recorded loop clip instead of the synthesis engine
  private _loopPlayer: Tone.Player | null = null
  private _loopMode = false

  async loadLoop(clip: LoopClip): Promise<void> {
    this._loopPlayer?.dispose()
    this._loopPlayer = new Tone.Player({ url: clip.url, loop: true })
      .connect(this.output)
    await Tone.loaded()
  }

  setLoopMode(enabled: boolean): void {
    this._loopMode = enabled
    if (enabled && this._loopPlayer) {
      Tone.getTransport().scheduleOnce(() => this._loopPlayer!.start(), '@1m')
    } else {
      this._loopPlayer?.stop()
    }
  }

  dispose(): void {
    this._loopPlayer?.stop()
    this._loopPlayer?.dispose()
    this._loopPlayer = null
    try { if (this.noiseStarted) this.noiseSource.stop() } catch { /* already stopped */ }
    try { if (this.riserStarted) this.riserNoise.stop() } catch { /* already stopped */ }
    this.noiseSource.dispose()
    this.highpass.dispose()
    this.filter.dispose()
    this.reverb.dispose()
    this.gain.dispose()
    this.riserNoise.dispose()
    this.riserFilter.dispose()
    this.riserGain.dispose()
    this.output.dispose()
  }
}
