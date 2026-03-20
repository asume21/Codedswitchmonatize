// Section 04 — Bass Generator

import * as Tone from 'tone'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, BassBehavior } from './types'
import type { ScheduledNote } from './types'
import {
  getBassBehavior,
  getBassFilterCutoff,
  buildBreatheNotes,
  buildLockNotes,
  buildWalkNotes,
  buildBounceNotes,
}                              from './patterns/BassPatternLibrary'
import type { PhysicsState }   from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'

export class BassGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth:      Tone.MonoSynth
  private filter:     Tone.Filter
  private compressor: Tone.Compressor
  private distortion: Tone.Distortion
  private part:       Tone.Part | null = null

  // Musical state
  private rootMidi:        number       = 36   // C2
  private currentBehavior: BassBehavior = BassBehavior.Breathe

  // Physics cache
  private currentPocket: number = 0

  constructor() {
    super(GeneratorName.Bass)

    this.output     = new Tone.Gain(1)
    this.filter     = new Tone.Filter(350, 'lowpass')
    this.compressor = new Tone.Compressor({ threshold: -20, ratio: 6, attack: 0.005, release: 0.12 })
    this.distortion = new Tone.Distortion({ distortion: 0.08, wet: 0.2 })

    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', spread: 15, count: 2 },
      filter:     { Q: 3, type: 'lowpass', rolloff: -24 },
      envelope:   { attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3 },
      filterEnvelope: {
        attack:        0.04,
        decay:         0.15,
        sustain:       0.35,
        release:       0.5,
        baseFrequency: 80,
        octaves:       2.0,
      },
    })
    this.synth.volume.value = -4

    this.synth.connect(this.filter)
    this.filter.connect(this.distortion)
    this.distortion.connect(this.compressor)
    this.compressor.connect(this.output)

    this.setOutputLevel(0)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentPocket = physics.pocket

    const newBehavior = getBassBehavior(physics.mode, organism.current)

    if (newBehavior !== this.currentBehavior) {
      this.currentBehavior = newBehavior
      this.rebuildPart(physics)
    }

    // Duck filter based on pocket
    const cutoff = getBassFilterCutoff(physics.mode, physics.pocket)
    this.filter.frequency.rampTo(cutoff, 0.3)

    // Output level
    const targetLevel = this.computeTargetLevel(organism)
    this.activityLevel += this.smoothingCoeff(100) * (targetLevel - this.activityLevel)
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
      this.startSubBassRise()
      return
    }

    // Breathing or Flow → rebuild bass line
    this.currentBehavior = getBassBehavior(physics.mode, to)
    this.rebuildPart(physics)
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBehavior = BassBehavior.Breathe
    this.currentPocket   = 0
    this.setOutputLevel(0)
  }

  // ── Reactive mutation methods (Section 05) ────────────────────────

  applyVolumeMultiplier(multiplier: number): void {
    const m = Math.max(0, multiplier)
    const db = m <= 0 ? -Infinity : 20 * Math.log10(m)
    this.synth.volume.rampTo(this.baseDb() + db, 0.05)
  }

  // ── Private ──────────────────────────────────────────────────────

  private baseDb(): number {
    const level = this.activityLevel
    return level <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, level))
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:   return 0
      case OState.Awakening: return 0.12 * organism.awakeningProgress
      case OState.Breathing: return 0.60 * organism.breathingWarmth
      case OState.Flow:      return 0.80 + (0.18 * organism.flowDepth)
    }
  }

  private rebuildPart(_physics: PhysicsState): void {
    this.stopPart()

    const notes = this.generateNotes()
    if (notes.length === 0) return

    const events = notes.map(n => ({
      time: n.time,
      note: n.pitch,
      dur:  n.duration,
      vel:  n.velocity,
    }))

    this.part = new Tone.Part((time, event) => {
      const pocketVelocity = event.vel * Math.max(0.35, 1 - this.currentPocket * 0.45)
      this.synth.triggerAttackRelease(event.note, event.dur, time, pocketVelocity)
    }, events)

    this.part.loop      = true
    this.part.loopEnd   = '4m'
    this.part.start(0)
  }

  private generateNotes(): ScheduledNote[] {
    switch (this.currentBehavior) {
      case BassBehavior.Lock:    return buildLockNotes(this.rootMidi)
      case BassBehavior.Walk:    return buildWalkNotes(this.rootMidi)
      case BassBehavior.Bounce:  return buildBounceNotes(this.rootMidi)
      case BassBehavior.Breathe: return buildBreatheNotes(this.rootMidi)
    }
  }

  private startSubBassRise(): void {
    this.stopPart()
    // Single very low sustained note that fades in
    const subRoot = Tone.Frequency(this.rootMidi - 12, 'midi').toNote()
    this.synth.triggerAttack(subRoot, Tone.now(), 0.01)
    // Fade in over 2 seconds
    this.synth.volume.rampTo(-12, 2)
  }

  private stopPart(): void {
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
    this.synth.triggerRelease()
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    this.synth.volume.rampTo(db, 0.1)
  }
}
