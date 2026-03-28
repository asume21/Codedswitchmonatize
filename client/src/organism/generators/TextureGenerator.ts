// Section 04 — Texture Generator

import * as Tone from 'tone'
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

  // Thinning state (responds to DensityComputer.thinningRequested)
  private thinningActive: boolean = false
  private noiseStarted:   boolean = false
  private enabled:        boolean = false  // controlled by orchestrator textureEnabled toggle

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

    // Do NOT start noise here — defer until organism leaves Dormant
    // this.noiseSource.start()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.activityLevel = 0
      this.gain.gain.rampTo(0, 0.3)
    }
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    // Hard gate — when disabled, keep gain at zero and skip all processing
    if (!this.enabled) {
      this.gain.gain.rampTo(0, 0.1)
      return
    }

    const modeName = physics.mode.toString()
    const layer    = TEXTURE_BY_MODE[modeName]
    if (!layer) return

    // Target level based on state + density thinning
    let targetLevel = this.computeTargetLevel(organism)
    if (this.thinningActive) targetLevel *= 0.4   // organism breathing out

    this.activityLevel += this.smoothingCoeff(130) * (targetLevel - this.activityLevel)

    // Apply gain (texture is always soft — max -12 dB)
    const shaped = this.activityLevel * layer.gainLevel * this.arrangementMultiplier
    const db = shaped <= 0
      ? -Infinity
      : 20 * Math.log10(Math.max(0.0001, shaped))
    this.gain.gain.rampTo(Math.pow(10, db / 20), 0.5)

    // Morph filter cutoff toward mode target
    this.filter.frequency.rampTo(layer.filterFreq, 1.0)

    // Morph reverb wet toward mode target
    this.reverb.wet.rampTo(layer.reverbWet, 2.0)
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
    this.gain.gain.rampTo(m, 0.05)
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:    return 0
      case OState.Awakening:  return 0.04 * organism.awakeningProgress
      case OState.Breathing:  return 0.15 * organism.breathingWarmth
      case OState.Flow:       return 0.20 + (0.08 * organism.flowDepth)
    }
  }

  dispose(): void {
    try { if (this.noiseStarted) this.noiseSource.stop() } catch { /* already stopped */ }
    this.noiseSource.dispose()
    this.highpass.dispose()
    this.filter.dispose()
    this.reverb.dispose()
    this.gain.dispose()
    this.output.dispose()
  }
}
