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
  buildTrapNotes,
  buildFunkNotes,
  buildDubNotes,
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
  private rootMidi:        number       = 36   // C2 — rotates on state transitions
  private currentBehavior: BassBehavior = BassBehavior.Breathe

  // Hip-hop friendly root notes (pentatonic minor roots at octave 2)
  private static readonly ROOT_POOL = [33, 36, 38, 40, 41, 43, 45, 48] // A1,C2,D2,E2,F2,G2,A2,C3

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

    // Breathing or Flow → pick a new root + fresh preset + rebuild
    this.rootMidi = BassGenerator.ROOT_POOL[Math.floor(Math.random() * BassGenerator.ROOT_POOL.length)]
    this.currentBehavior = getBassBehavior(physics.mode, to)
    this.applyBassPreset()
    this.rebuildPart(physics)
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBehavior = BassBehavior.Breathe
    this.currentPocket   = 0
    this.setOutputLevel(0)
  }

  // ── Bass presets — sound variety on state transitions ─────────────

  private static readonly BASS_PRESETS = [
    // Fat Saw — default: wide, mid-heavy
    { filterQ: 3,   filterOctaves: 2.0, attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3, distWet: 0.20, volume: -4 },
    // Smooth Sub — low rumble, slow attack, minimal distortion
    { filterQ: 1.5, filterOctaves: 1.2, attack: 0.015, decay: 0.35, sustain: 0.7, release: 0.4, distWet: 0.05, volume: -3 },
    // Growl — high resonance filter, aggressive distortion
    { filterQ: 5,   filterOctaves: 2.5, attack: 0.003, decay: 0.18, sustain: 0.6, release: 0.2, distWet: 0.35, volume: -5 },
    // Pluck — tight envelope, fast filter decay, articulate
    { filterQ: 4,   filterOctaves: 3.0, attack: 0.002, decay: 0.12, sustain: 0.3, release: 0.2, distWet: 0.15, volume: -4 },
    // 808 — very slow release, minimal distortion, deep sub
    { filterQ: 1,   filterOctaves: 0.8, attack: 0.001, decay: 0.80, sustain: 0.6, release: 1.2, distWet: 0.02, volume: -2 },
    // Funk — punchy, mid-forward, medium release
    { filterQ: 3.5, filterOctaves: 2.8, attack: 0.003, decay: 0.14, sustain: 0.45, release: 0.18, distWet: 0.25, volume: -4 },
    // Dub — warm round tone, low filter, long release
    { filterQ: 2,   filterOctaves: 1.5, attack: 0.010, decay: 0.40, sustain: 0.65, release: 0.6, distWet: 0.08, volume: -3 },
  ] as const

  private applyBassPreset(): void {
    const p = BassGenerator.BASS_PRESETS[Math.floor(Math.random() * BassGenerator.BASS_PRESETS.length)]
    this.synth.filter.Q.value                = p.filterQ
    this.synth.filterEnvelope.octaves        = p.filterOctaves
    this.synth.envelope.attack               = p.attack
    this.synth.envelope.decay                = p.decay
    this.synth.envelope.sustain              = p.sustain
    this.synth.envelope.release              = p.release
    this.distortion.wet.rampTo(p.distWet, 0.1)
    this.synth.volume.rampTo(p.volume, 0.1)
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
      case BassBehavior.Trap:    return buildTrapNotes(this.rootMidi)
      case BassBehavior.Funk:    return buildFunkNotes(this.rootMidi)
      case BassBehavior.Dub:     return buildDubNotes(this.rootMidi)
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
