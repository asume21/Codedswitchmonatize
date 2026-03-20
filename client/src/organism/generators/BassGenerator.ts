// Section 04 — Bass Generator

import * as Tone from 'tone'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, BassBehavior } from './types'
import type { ScheduledNote } from './types'
import {
  PENTATONIC_MINOR,
  getBassBehavior,
  getBassFilterCutoff,
}                              from './patterns/BassPatternLibrary'
import type { PhysicsState }   from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'

export class BassGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth:  Tone.MonoSynth
  private filter: Tone.Filter
  private part:   Tone.Part | null = null

  // Musical state
  private rootMidi:        number       = 36   // C2
  private currentBehavior: BassBehavior = BassBehavior.Breathe

  // Physics cache
  private currentPocket: number = 0

  constructor() {
    super(GeneratorName.Bass)

    this.output = new Tone.Gain(1)
    this.filter = new Tone.Filter(400, 'lowpass')

    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter:     { Q: 2, type: 'lowpass', rolloff: -24 },
      envelope:   { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.5 },
      filterEnvelope: {
        attack:      0.06,
        decay:       0.2,
        sustain:     0.5,
        release:     0.8,
        baseFrequency: 200,
        octaves:       2.5,
      },
    })

    this.synth.connect(this.filter)
    this.filter.connect(this.output)

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

  private rebuildPart(physics: PhysicsState): void {
    this.stopPart()

    const notes = this.generateNotes(physics)
    if (notes.length === 0) return

    const events = notes.map(n => ({
      time: n.time,
      note: n.pitch,
      dur:  n.duration,
      vel:  n.velocity,
    }))

    this.part = new Tone.Part((time, event) => {
      // Apply pocket ducking dynamically at trigger time
      const pocketVelocity = event.vel * Math.max(0.35, 1 - this.currentPocket * 0.45)
      this.synth.triggerAttackRelease(event.note, event.dur, time, pocketVelocity)
    }, events)

    this.part.loop      = true
    this.part.loopEnd   = '2m'  // 2 bars
    this.part.start(0)
  }

  private generateNotes(_physics: PhysicsState): ScheduledNote[] {
    const notes: ScheduledNote[] = []
    const rootName = Tone.Frequency(this.rootMidi, 'midi').toNote()

    switch (this.currentBehavior) {
      case BassBehavior.Lock:
        // Follow kick pattern: hits on beat 1 and beat 3
        notes.push(
          { pitch: rootName, duration: '8n', velocity: 0.85, time: '0:0:0' },
          { pitch: rootName, duration: '8n', velocity: 0.75, time: '0:2:0' },
        )
        break

      case BassBehavior.Walk:
        // Stepwise motion through pentatonic minor over 2 bars
        PENTATONIC_MINOR.slice(0, 4).forEach((interval, i) => {
          const midi  = this.rootMidi + interval
          const pitch = Tone.Frequency(midi, 'midi').toNote()
          notes.push({
            pitch, duration: '4n', velocity: 0.70,
            time: `0:${i}:0`,
          })
        })
        break

      case BassBehavior.Bounce: {
        // Repetitive 8th-note figure on root and 5th
        const fifth = Tone.Frequency(this.rootMidi + 7, 'midi').toNote()
        for (let beat = 0; beat < 4; beat++) {
          notes.push({ pitch: rootName, duration: '16n', velocity: 0.80, time: `0:${beat}:0` })
          notes.push({ pitch: fifth,    duration: '16n', velocity: 0.65, time: `0:${beat}:2` })
        }
        break
      }

      case BassBehavior.Breathe:
        // Long sustained root, minimal motion
        notes.push(
          { pitch: rootName, duration: '1m', velocity: 0.60, time: '0:0:0' },
        )
        break
    }

    return notes
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
    const db = level <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, level))
    this.synth.volume.rampTo(db, 0.1)
  }
}
