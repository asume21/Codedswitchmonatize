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

  private reverb:  Tone.Reverb
  private delay:   Tone.FeedbackDelay
  private chorus:  Tone.Chorus

  constructor() {
    super(GeneratorName.Melody)

    this.output = new Tone.Gain(1)

    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.5,
      oscillator:    { type: 'sine' },
      modulation:    { type: 'triangle' },
      envelope:      { attack: 0.08, decay: 0.3, sustain: 0.35, release: 1.2 },
      modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.3, release: 0.8 },
    })
    this.synth.volume.value = -6

    this.chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.4, wet: 0.3 })
    this.delay  = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.25, wet: 0.2 })
    this.reverb = new Tone.Reverb({ decay: 3.0, wet: 0.35 })

    this.synth.connect(this.chorus)
    this.chorus.connect(this.delay)
    this.delay.connect(this.reverb)
    this.reverb.connect(this.output)

    this.chorus.start()
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
    this.activityLevel += this.smoothingCoeff(100) * (targetLevel - this.activityLevel)
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
      case MelodyBehavior.Hint:    return 0.35 * organism.breathingWarmth
      case MelodyBehavior.Respond: return 0.60 + (0.15 * organism.flowDepth)
      case MelodyBehavior.Lead:    return 0.75 + (0.20 * organism.flowDepth)
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
      const presenceDuck = Math.max(0.3, 1 - this.currentPresence * 0.5)
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

    // Build a musical phrase with rests, call-and-response, swing
    let cursor = 0
    let prev   = Math.floor(scale.length / 2)  // start mid-scale
    let phraseNoteCount = 0
    const phraseGroupSize = 3 + Math.floor(Math.random() * 3) // 3-5 notes then rest

    while (cursor < length16ths) {
      // Insert rests between phrase groups (call-and-response feel)
      if (phraseNoteCount >= phraseGroupSize && Math.random() < 0.6) {
        const restLen = 2 + Math.floor(Math.random() * 4) // 2-5 16ths rest
        cursor += restLen
        phraseNoteCount = 0
        continue
      }

      // Pick next scale degree (stepwise bias with occasional leaps)
      const r = Math.random()
      const stepDelta = r < 0.55
        ? (Math.random() < 0.5 ? 1 : -1)          // step up/down
        : r < 0.8
          ? (Math.random() < 0.5 ? 2 : -2)        // skip
          : Math.floor(Math.random() * 5) - 2      // leap

      prev = Math.max(0, Math.min(scale.length - 1, prev + stepDelta))

      const semitone = scale[prev]
      const midi     = (octave * 12) + 12 + semitone + this.pitchOffsetSemitones
      const pitch    = Tone.Frequency(midi, 'midi').toNote()

      // Duration variety: 1-4 16ths with musical bias
      const durRoll = Math.random()
      const dur16ths = durRoll < 0.2 ? 1     // 16th (fast)
                     : durRoll < 0.55 ? 2    // 8th (standard)
                     : durRoll < 0.8 ? 3     // dotted 8th (groove)
                     : 4                     // quarter (sustain)
      const durStr = dur16ths === 1 ? '16n'
                   : dur16ths === 2 ? '8n'
                   : dur16ths === 3 ? '8n.'
                   : '4n'

      // Swing: off-16ths pushed late
      const bar  = Math.floor(cursor / 16)
      const beat = Math.floor((cursor % 16) / 4)
      const sub  = cursor % 4
      const swungSub = (sub === 1 || sub === 3) ? sub + 0.35 : sub
      const time = `${bar}:${beat}:${swungSub.toFixed(2)}`

      // Velocity: accent downbeats, softer off-beats
      const accentBase = sub === 0 ? 0.55 : sub === 2 ? 0.48 : 0.40
      const vel = Math.min(1, Math.max(0.15, accentBase + (Math.random() - 0.5) * 0.12))

      notes.push({ pitch, duration: durStr, velocity: vel, time })

      cursor += dur16ths
      phraseNoteCount++
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
    const shaped = level * this.arrangementMultiplier
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    this.synth.volume.rampTo(db, 0.1)
  }
}
