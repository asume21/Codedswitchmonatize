// Section 04 — Drum Generator

import * as Tone from 'tone'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, DrumInstrument } from './types'
import type { DrumHit }       from './types'
import {
  getDrumKit,
  buildDrumPattern,
}                              from './patterns/DrumPatternLibrary'
import type { PhysicsState }   from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'

export class DrumGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private kick:  Tone.MembraneSynth
  private snare: Tone.NoiseSynth
  private hat:   Tone.MetalSynth
  private perc:  Tone.NoiseSynth

  private part: Tone.Part | null = null

  // Physics cache
  private currentBounce:   number = 0
  private currentPresence: number = 0
  private currentPocket:   number = 0

  // Reactive multipliers (Section 05)
  private hatDensityMult:      number = 1.0
  private kickVelocityMult:    number = 1.0

  constructor() {
    super(GeneratorName.Drum)

    this.output = new Tone.Gain(1)

    this.kick = new Tone.MembraneSynth({
      pitchDecay:  0.05,
      octaves:     6,
      oscillator:  { type: 'sine' },
      envelope:    { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
    })
    this.kick.connect(this.output)

    this.snare = new Tone.NoiseSynth({
      noise:    { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    })
    this.snare.connect(this.output)

    this.hat = new Tone.MetalSynth({
      envelope:   { attack: 0.001, decay: 0.08, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance:  4000,
      octaves:    1.5,
    })
    this.hat.connect(this.output)

    this.perc = new Tone.NoiseSynth({
      noise:    { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0 },
    })
    this.perc.connect(this.output)

    this.setOutputLevel(0)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentBounce   = physics.bounce
    this.currentPresence = physics.presence
    this.currentPocket   = physics.pocket

    const targetLevel = this.computeTargetLevel(organism)
    this.activityLevel += this.smoothingCoeff(80) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (to === OState.Dormant) {
      this.stopPart()
      this.activityLevel = 0
      return
    }

    if (to === OState.Awakening) {
      this.stopPart()
      this.startSubKickRise()
      return
    }

    // Breathing or Flow → rebuild pattern from current mode
    const kit     = getDrumKit(physics.mode)
    const pattern = buildDrumPattern(kit)
    this.rebuildPart(pattern.hits)
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBounce   = 0
    this.currentPresence = 0
    this.currentPocket   = 0
    this.setOutputLevel(0)
  }

  // ── Reactive mutation methods (Section 05) ────────────────────────

  setHatDensityMultiplier(multiplier: number): void {
    this.hatDensityMult = Math.max(0, multiplier)
  }

  setKickVelocityMultiplier(multiplier: number): void {
    this.kickVelocityMult = Math.max(0, multiplier)
  }

  // ── Private ──────────────────────────────────────────────────────

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:   return 0
      case OState.Awakening: return 0.25 * organism.awakeningProgress
      case OState.Breathing: return 0.65 * organism.breathingWarmth
      case OState.Flow:      return 0.92
    }
  }

  private rebuildPart(hits: DrumHit[]): void {
    this.stopPart()

    const events = hits.map(h => ({
      time:       h.time,
      instrument: h.instrument,
      velocity:   h.velocity,
    }))

    this.part = new Tone.Part((time, event) => {
      const vel = this.applyDynamics(event.instrument, event.velocity)
      this.triggerDrum(event.instrument, time, vel)
    }, events)

    this.part.loop    = true
    this.part.loopEnd = '2m'
    this.part.start(0)
  }

  private applyDynamics(instrument: DrumInstrument, baseVelocity: number): number {
    let vel = baseVelocity

    // Bounce → boost kick + reactive multiplier
    if (instrument === DrumInstrument.Kick) {
      vel *= (1 + this.currentBounce * 0.5) * this.kickVelocityMult
    }

    // Pocket → duck hats during voice presence + reactive density multiplier
    if (instrument === DrumInstrument.Hat) {
      vel *= Math.max(0.3, 1 - this.currentPresence * 0.4) * this.hatDensityMult
    }

    return Math.min(1, Math.max(0, vel))
  }

  private triggerDrum(instrument: DrumInstrument, time: number, velocity: number): void {
    switch (instrument) {
      case DrumInstrument.Kick:
        this.kick.triggerAttackRelease('C1', '8n', time, velocity)
        break
      case DrumInstrument.Snare:
        this.snare.triggerAttackRelease('8n', time, velocity)
        break
      case DrumInstrument.Hat:
        this.hat.triggerAttackRelease('32n', time, velocity)
        break
      case DrumInstrument.Perc:
        this.perc.triggerAttackRelease('16n', time, velocity)
        break
    }
  }

  private startSubKickRise(): void {
    // Very soft kick pulse during awakening
    this.kick.volume.rampTo(-24, 2)
  }

  private stopPart(): void {
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
  }

  private setOutputLevel(level: number): void {
    const db = level <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, level))
    this.kick.volume.rampTo(db, 0.1)
    this.snare.volume.rampTo(db, 0.1)
    this.hat.volume.rampTo(db, 0.1)
    this.perc.volume.rampTo(db, 0.1)
  }
}
