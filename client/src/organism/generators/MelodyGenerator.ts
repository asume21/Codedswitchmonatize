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
  private volumeMultiplier:     number = 1.0

  // Musical state
  private rootPitchClass:  number         = 0    // 0-11, detected by ScaleSnapEngine
  private currentBehavior: MelodyBehavior = MelodyBehavior.Rest
  private lastBehavior:    MelodyBehavior = MelodyBehavior.Rest
  private currentScale:    number[]       = MODE_SCALES.glow
  private scaleDirty:      boolean        = false // rebuild phrase on next behavior cycle

  // Physics cache
  private currentPresence: number  = 0
  private voiceActive:     boolean = false
  private flowDepth:       number  = 0

  private reverb:    Tone.Reverb
  private delay:     Tone.FeedbackDelay
  private chorus:    Tone.Chorus
  private dryBus:    Tone.Gain
  private delaySend: Tone.Gain
  private reverbSend: Tone.Gain

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

    // Parallel send routing — prevents reverb'd delays from accumulating
    // synth → chorus → dry bus → output
    //                 → delay send → delay → output
    //                 → reverb send → reverb → output
    this.dryBus     = new Tone.Gain(0.7)    // dry level
    this.delaySend  = new Tone.Gain(0.2)    // delay send level
    this.reverbSend = new Tone.Gain(0.15)   // reverb send level
    this.delay  = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.25, wet: 1.0 })  // 100% wet on send
    this.reverb = new Tone.Reverb({ decay: 1.5, wet: 1.0 })  // 100% wet on send

    this.synth.connect(this.chorus)
    this.chorus.connect(this.dryBus)
    this.chorus.connect(this.delaySend)
    this.chorus.connect(this.reverbSend)
    this.dryBus.connect(this.output)
    this.delaySend.connect(this.delay)
    this.delay.connect(this.output)
    this.reverbSend.connect(this.reverb)
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

    // Rebuild phrase when behavior changes OR when scale was updated mid-phrase
    if (newBehavior !== this.currentBehavior || this.scaleDirty) {
      this.lastBehavior    = this.currentBehavior
      this.currentBehavior = newBehavior
      this.scaleDirty      = false
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
      // rootPitchClass is intentionally NOT reset here — keep the detected key
      // across state transitions so the melody stays in the user's key
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

  /**
   * Set the detected root pitch class and scale intervals from ScaleSnapEngine.
   * The phrase will be rebuilt at the next behavior cycle.
   *
   * @param rootPitchClass - 0-11 (C=0, C#=1 ... B=11)
   * @param intervals      - semitone intervals from root (e.g. [0,3,5,7,10])
   */
  setRootAndScale(rootPitchClass: number, intervals: number[]): void {
    const newRoot  = ((rootPitchClass % 12) + 12) % 12  // clamp to 0-11
    const changed  = newRoot !== this.rootPitchClass
                  || JSON.stringify(intervals) !== JSON.stringify(this.currentScale)
    if (!changed) return
    this.rootPitchClass = newRoot
    this.currentScale   = intervals
    this.scaleDirty     = true   // signal processFrame to rebuild
  }

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    this.setOutputLevel(this.activityLevel)
  }

  // ── Private ──────────────────────────────────────────────────────

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
      const midi     = (octave * 12) + 12 + semitone + this.rootPitchClass + this.pitchOffsetSemitones
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
    const shaped = level * this.arrangementMultiplier * this.volumeMultiplier
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    this.output.gain.rampTo(Math.pow(10, db / 20), 0.1)
  }

  dispose(): void {
    this.stopPart()
    this.synth.dispose()
    this.chorus.dispose()
    this.dryBus.dispose()
    this.delaySend.dispose()
    this.reverbSend.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.output.dispose()
  }
}
