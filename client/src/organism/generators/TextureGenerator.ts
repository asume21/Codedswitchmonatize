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
  private filter:      Tone.Filter
  private reverb:      Tone.Reverb
  private gain:        Tone.Gain

  // Thinning state (responds to DensityComputer.thinningRequested)
  private thinningActive: boolean = false

  constructor() {
    super(GeneratorName.Texture)

    this.noiseSource = new Tone.Noise('pink')
    this.filter      = new Tone.Filter(1200, 'lowpass')
    this.reverb      = new Tone.Reverb({ decay: 3.0, wet: 0.5 })
    this.gain        = new Tone.Gain(0)

    this.output = new Tone.Gain(1)

    this.noiseSource.connect(this.filter)
    this.filter.connect(this.reverb)
    this.reverb.connect(this.gain)
    this.gain.connect(this.output)

    this.noiseSource.start()
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    const modeName = physics.mode.toString()
    const layer    = TEXTURE_BY_MODE[modeName]
    if (!layer) return

    // Target level based on state + density thinning
    let targetLevel = this.computeTargetLevel(organism)
    if (this.thinningActive) targetLevel *= 0.4   // organism breathing out

    this.activityLevel += this.smoothingCoeff(130) * (targetLevel - this.activityLevel)

    // Apply gain (texture is always soft — max -12 dB)
    const db = this.activityLevel <= 0
      ? -Infinity
      : 20 * Math.log10(Math.max(0.0001, this.activityLevel * layer.gainLevel))
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
    if (to === OState.Dormant) {
      this.activityLevel = 0
      this.gain.gain.rampTo(0, 1.0)
    }
  }

  reset(): void {
    this.activityLevel  = 0
    this.thinningActive = false
    this.gain.gain.rampTo(0, 0.5)
  }

  // ── Reactive mutation methods (Section 05) ────────────────────────

  applyVolumeMultiplier(multiplier: number): void {
    const m = Math.max(0, multiplier)
    this.gain.gain.rampTo(m, 0.05)
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:    return 0
      case OState.Awakening:  return 0.10 * organism.awakeningProgress
      case OState.Breathing:  return 0.50 * organism.breathingWarmth
      case OState.Flow:       return 0.70 + (0.25 * organism.flowDepth)
    }
  }
}
