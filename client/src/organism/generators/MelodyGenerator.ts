// Section 04 — Melody Generator

import * as Tone from 'tone'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, MelodyBehavior } from './types'
import type { ScheduledNote } from './types'
import {
  MODE_SCALES,
  PHRASE_LENGTHS,
  MODE_OCTAVES,
  getMelodyBehavior,
}                             from './patterns/MelodyPatternLibrary'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState }             from '../state/types'

export class MelodyGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth: Tone.PolySynth
  private part:  Tone.Part | null = null

  // Reactive state (Section 05)
  private pitchOffsetSemitones: number = 0

  // Musical state
  private rootMidi:        number         = 60   // C4
  private currentBehavior: MelodyBehavior = MelodyBehavior.Rest
  private lastBehavior:    MelodyBehavior = MelodyBehavior.Rest
  private currentScale:    number[]       = MODE_SCALES.glow

  // Physics cache
  private currentPresence: number  = 0
  private voiceActive:     boolean = false
  private flowDepth:       number  = 0

  constructor() {
    super(GeneratorName.Melody)

    this.output = new Tone.Gain(1)

    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.8 },
    })

    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 })
    this.synth.connect(reverb)
    reverb.connect(this.output)

    this.setOutputLevel(0)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentPresence = physics.presence
    this.voiceActive     = physics.voiceActive
    this.flowDepth       = organism.flowDepth

    const newBehavior = getMelodyBehavior(
      physics.mode,
      physics.voiceActive,
      organism.flowDepth
    )

    // Rebuild phrase when behavior changes
    if (newBehavior !== this.currentBehavior) {
      this.lastBehavior    = this.currentBehavior
      this.currentBehavior = newBehavior
      this.rebuildPhrase(physics, organism)
    }

    // Output level
    const targetLevel = this.computeTargetLevel(organism, newBehavior)
    this.activityLevel += this.smoothingCoeff(150) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (to === OState.Dormant || to === OState.Awakening) {
      this.stopPart()
      this.activityLevel = 0
    }
    if (to === OState.Breathing || to === OState.Flow) {
      this.currentScale = MODE_SCALES[physics.mode] ?? MODE_SCALES.glow
      this.rootMidi     = 60   // C4 default — refined in Section 05
    }
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBehavior = MelodyBehavior.Rest
    this.currentScale    = MODE_SCALES.glow
    this.setOutputLevel(0)
  }

  // ── Reactive mutation methods (Section 05) ────────────────────────

  applyPitchOffset(semitones: number): void {
    this.pitchOffsetSemitones = Math.round(semitones)
  }

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

  private computeTargetLevel(organism: OrganismState, behavior: MelodyBehavior): number {
    if (organism.current === OState.Dormant)   return 0
    if (organism.current === OState.Awakening) return 0
    if (behavior === MelodyBehavior.Rest)       return 0

    switch (behavior) {
      case MelodyBehavior.Hint:    return 0.25 * organism.breathingWarmth
      case MelodyBehavior.Respond: return 0.55 * organism.flowDepth
      case MelodyBehavior.Lead:    return 0.70 * organism.flowDepth
      default:                     return 0
    }
  }

  private rebuildPhrase(physics: PhysicsState, _organism: OrganismState): void {
    this.stopPart()

    if (this.currentBehavior === MelodyBehavior.Rest) return

    const lengths = PHRASE_LENGTHS[this.currentBehavior]
    if (!lengths || lengths.length === 0) return

    const phraseLength = lengths[Math.floor(Math.random() * lengths.length)]
    const notes        = this.generatePhrase(phraseLength, physics)

    if (notes.length === 0) return

    this.part = new Tone.Part((time, event) => {
      // Presence-based velocity scaling — melody quiets during voice peaks
      const presenceDuck = Math.max(0.2, 1 - this.currentPresence * 0.7)
      this.synth.triggerAttackRelease(
        event.note,
        event.dur,
        time,
        event.vel * presenceDuck
      )
    }, notes.map(n => ({ time: n.time, note: n.pitch, dur: n.duration, vel: n.velocity })))

    this.part.loop    = true
    this.part.loopEnd = `${phraseLength}i`   // i = 16th note ticks
    this.part.start('+0.1')
  }

  private generatePhrase(length16ths: number, physics: PhysicsState): ScheduledNote[] {
    const notes:    ScheduledNote[] = []
    const octaves   = MODE_OCTAVES[physics.mode] ?? [4, 5]
    const octave    = octaves[0] + Math.floor(Math.random() * (octaves[1] - octaves[0] + 1))
    const scale     = this.currentScale

    // Walk through phrase, picking scale degrees
    let cursor = 0
    let prev   = 0  // last scale index

    while (cursor < length16ths) {
      // Pick next scale degree (biased toward stepwise motion)
      const stepDelta = Math.random() < 0.7
        ? (Math.random() < 0.5 ? 1 : -1)          // stepwise
        : Math.floor(Math.random() * 4) - 2        // occasional leap

      prev = Math.max(0, Math.min(scale.length - 1, prev + stepDelta))

      const semitone = scale[prev]
      const midi     = (octave * 12) + 12 + semitone  // C0 = MIDI 12
      const pitch    = Tone.Frequency(midi, 'midi').toNote()

      // Duration: 1–3 16th notes, biased to 2
      const dur16ths = Math.random() < 0.5 ? 2 : (Math.random() < 0.5 ? 1 : 3)
      const durStr   = dur16ths === 1 ? '16n' : dur16ths === 2 ? '8n' : '8n.'

      notes.push({
        pitch,
        duration:  durStr,
        velocity:  0.45 + Math.random() * 0.25,
        time:      `${Math.floor(cursor / 16)}:${Math.floor((cursor % 16) / 4)}:${cursor % 4}`,
      })

      cursor += dur16ths
    }

    return notes
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
    this.synth.volume.rampTo(db, 0.1)
  }
}
