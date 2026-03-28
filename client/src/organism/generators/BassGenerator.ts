// Section 04 — Bass Generator

import * as Tone from 'tone'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, BassBehavior } from './types'
import type { ScheduledNote } from './types'
import {
  getBassBehavior,
  getBassFilterCutoff,
  setBassSwing,
  buildBreatheNotes,
  buildLockNotes,
  buildWalkNotes,
  buildBounceNotes,
  buildTrapNotes,
  buildFunkNotes,
  buildDubNotes,
}                              from './patterns/BassPatternLibrary'
import type { PhysicsState }   from '../physics/types'
import { OrganismMode }        from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'

export class BassGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth:      Tone.MonoSynth
  private filter:     Tone.Filter
  private monoSub:    Tone.Filter      // lowpass mono enforcement for sub frequencies
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
  private currentMode: OrganismMode = OrganismMode.Glow

  constructor() {
    super(GeneratorName.Bass)

    this.output     = new Tone.Gain(1)
    this.filter     = new Tone.Filter(350, 'lowpass')
    // Mono enforcement for sub frequencies — lowpass at 120Hz prevents stereo spread
    // from the FatSawtooth oscillator from causing phase cancellation on mono systems
    this.monoSub    = new Tone.Filter({ type: 'lowpass', frequency: 120, rolloff: -24 })
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
    this.synth.volume.value = -7

    // Signal chain: synth → filter → monoSub → distortion → compressor → output
    this.synth.connect(this.filter)
    this.filter.connect(this.monoSub)
    this.monoSub.connect(this.distortion)
    this.distortion.connect(this.compressor)
    this.compressor.connect(this.output)

    this.setOutputLevel(0)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentPocket = physics.pocket
    this.currentMode   = physics.mode

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
    this.rootMidi    = BassGenerator.ROOT_POOL[Math.floor(Math.random() * BassGenerator.ROOT_POOL.length)]
    this.currentMode = physics.mode
    setBassSwing(physics.mode.toString())  // sync bass swing with genre
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

  // ── Bass presets — mode-aware sound selection ────────────────────

  private static readonly PRESET_808 = [
    // Classic 808 — sine sub with long decay, pitch glide feel
    { oscType: 'sine' as const, filterQ: 1, filterOctaves: 0.5, attack: 0.001, decay: 1.0,  sustain: 0.5, release: 1.5, distWet: 0.02, volume: -5 },
    // Hard 808 — tighter, more punch
    { oscType: 'sine' as const, filterQ: 1.2, filterOctaves: 0.6, attack: 0.001, decay: 0.7, sustain: 0.4, release: 1.0, distWet: 0.05, volume: -5 },
    // Distorted 808 — saturated sub for drill
    { oscType: 'sine' as const, filterQ: 1.5, filterOctaves: 0.8, attack: 0.001, decay: 0.9, sustain: 0.5, release: 1.2, distWet: 0.15, volume: -6 },
  ] as const

  private static readonly PRESET_GENERAL = [
    // Fat Saw — default: wide, mid-heavy
    { oscType: 'fatsawtooth' as const, filterQ: 3,   filterOctaves: 2.0, attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3, distWet: 0.20, volume: -7 },
    // Smooth Sub — low rumble, slow attack
    { oscType: 'fatsawtooth' as const, filterQ: 1.5, filterOctaves: 1.2, attack: 0.015, decay: 0.35, sustain: 0.7, release: 0.4, distWet: 0.05, volume: -6 },
    // Growl — high resonance, aggressive
    { oscType: 'fatsawtooth' as const, filterQ: 5,   filterOctaves: 2.5, attack: 0.003, decay: 0.18, sustain: 0.6, release: 0.2, distWet: 0.35, volume: -8 },
    // Pluck — tight envelope, articulate
    { oscType: 'fatsawtooth' as const, filterQ: 4,   filterOctaves: 3.0, attack: 0.002, decay: 0.12, sustain: 0.3, release: 0.2, distWet: 0.15, volume: -7 },
    // Funk — punchy, mid-forward
    { oscType: 'fatsawtooth' as const, filterQ: 3.5, filterOctaves: 2.8, attack: 0.003, decay: 0.14, sustain: 0.45, release: 0.18, distWet: 0.25, volume: -7 },
    // Dub — warm round, long release
    { oscType: 'fatsawtooth' as const, filterQ: 2,   filterOctaves: 1.5, attack: 0.010, decay: 0.40, sustain: 0.65, release: 0.6, distWet: 0.08, volume: -6 },
  ] as const

  private applyBassPreset(): void {
    // Heat/Gravel → 808 sine presets; others → general saw presets
    const is808 = this.currentMode === OrganismMode.Heat || this.currentMode === OrganismMode.Gravel
    const pool  = is808 ? BassGenerator.PRESET_808 : BassGenerator.PRESET_GENERAL
    const p     = pool[Math.floor(Math.random() * pool.length)]

    // Switch oscillator type for 808 vs saw
    try {
      (this.synth.oscillator as any).type = p.oscType === 'sine' ? 'sine' : 'fatsawtooth'
    } catch { /* oscillator type change may fail mid-note */ }

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

  // Volume multiplier from ReactiveBehaviorEngine — applied to the output gain
  // node (NOT synth.volume) to avoid race with setOutputLevel which also uses
  // synth.volume. This keeps the two concerns separated.
  private volumeMultiplier: number = 1.0

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    // Re-apply current output level with the new multiplier
    this.setOutputLevel(this.activityLevel)
  }

  // ── Private ──────────────────────────────────────────────────────

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
    // Single low sustained note that fades in — clamp to E1 (28) minimum
    // to avoid inaudible sub-rumble that eats headroom and causes hum
    const subMidi = Math.max(28, this.rootMidi - 12)
    const subRoot = Tone.Frequency(subMidi, 'midi').toNote()
    this.synth.triggerAttack(subRoot, Tone.now(), 0.01)
    // Fade in over 2 seconds
    this.synth.volume.rampTo(-14, 2)
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
    const shaped = level * this.arrangementMultiplier * this.volumeMultiplier
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    this.output.gain.rampTo(Math.pow(10, db / 20), 0.1)
  }

  dispose(): void {
    this.stopPart()
    this.synth.dispose()
    this.filter.dispose()
    this.monoSub.dispose()
    this.compressor.dispose()
    this.distortion.dispose()
    this.output.dispose()
  }
}
