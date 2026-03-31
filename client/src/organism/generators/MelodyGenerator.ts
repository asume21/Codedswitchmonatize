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

  // Current voice name for debugging/display
  private currentVoiceName: string = 'Default FM'

  // Genre-aware swing — matches drum/bass swing per mode
  private static readonly MODE_SWING: Record<string, number> = {
    heat: 0.20, gravel: 0.22, smoke: 0.55, ice: 0.48, glow: 0.38,
  }
  private currentSwing: number = 0.35

  // ─── Mode → Synth voice presets ──────────────────────────────────
  // Each mode has a pool of synth configs randomly selected on state transitions
  private static readonly MODE_VOICES: Record<string, Array<{
    name: string; type: 'FM' | 'Synth' | 'Mono'; options: any
    volume: number; chorusWet: number; reverbDecay: number; delayFeedback: number
  }>> = {
    heat: [
      { name: 'Trap Lead', type: 'FM', options: {
        harmonicity: 3, modulationIndex: 6, oscillator: { type: 'sine' }, modulation: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 },
        modulationEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.3 },
      }, volume: -8, chorusWet: 0.15, reverbDecay: 0.5, delayFeedback: 0.08 },
      { name: 'Bell Lead', type: 'FM', options: {
        harmonicity: 5.07, modulationIndex: 12, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.5 },
        modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0.1, release: 1.0 },
      }, volume: -10, chorusWet: 0.2, reverbDecay: 1.2, delayFeedback: 0.15 },
      { name: 'Pluck', type: 'Synth', options: {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.3, sustain: 0.0, release: 0.2 },
      }, volume: -7, chorusWet: 0.1, reverbDecay: 0.4, delayFeedback: 0.1 },
    ],
    gravel: [
      { name: 'Dark Saw', type: 'Mono', options: {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.4, sustain: 0.6, release: 0.4 },
        filter: { type: 'lowpass', frequency: 1800, Q: 3 },
        filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 0.5, baseFrequency: 200, octaves: 3 },
      }, volume: -8, chorusWet: 0.1, reverbDecay: 0.6, delayFeedback: 0.06 },
      { name: 'Gritty FM', type: 'FM', options: {
        harmonicity: 1.5, modulationIndex: 10, oscillator: { type: 'sine' }, modulation: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.4 },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 },
      }, volume: -9, chorusWet: 0.05, reverbDecay: 0.5, delayFeedback: 0.05 },
    ],
    smoke: [
      { name: 'Rhodes Keys', type: 'FM', options: {
        harmonicity: 2, modulationIndex: 1.5, oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 1.0, sustain: 0.3, release: 1.2 },
        modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.8 },
      }, volume: -9, chorusWet: 0.35, reverbDecay: 1.0, delayFeedback: 0.12 },
      { name: 'Warm Saw', type: 'Synth', options: {
        oscillator: { type: 'fatsawtooth', spread: 15 },
        envelope: { attack: 0.05, decay: 0.5, sustain: 0.6, release: 0.8 },
      }, volume: -10, chorusWet: 0.4, reverbDecay: 0.8, delayFeedback: 0.15 },
      { name: 'Funk Organ', type: 'FM', options: {
        harmonicity: 1, modulationIndex: 0.5, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.1 },
        modulationEnvelope: { attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.1 },
      }, volume: -8, chorusWet: 0.3, reverbDecay: 0.6, delayFeedback: 0.08 },
    ],
    ice: [
      { name: 'Lo-Fi Piano', type: 'FM', options: {
        harmonicity: 2, modulationIndex: 1.2, oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 1.5, sustain: 0.2, release: 2.0 },
        modulationEnvelope: { attack: 0.01, decay: 0.8, sustain: 0.1, release: 1.5 },
      }, volume: -10, chorusWet: 0.25, reverbDecay: 1.8, delayFeedback: 0.18 },
      { name: 'Soft Pad', type: 'Synth', options: {
        oscillator: { type: 'fatsawtooth', spread: 25 },
        envelope: { attack: 0.8, decay: 1.0, sustain: 0.8, release: 2.5 },
      }, volume: -12, chorusWet: 0.5, reverbDecay: 2.5, delayFeedback: 0.2 },
      { name: 'Music Box', type: 'FM', options: {
        harmonicity: 8, modulationIndex: 2, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.001, decay: 1.5, sustain: 0.0, release: 1.5 },
        modulationEnvelope: { attack: 0.001, decay: 0.8, sustain: 0.0, release: 1.0 },
      }, volume: -11, chorusWet: 0.15, reverbDecay: 2.0, delayFeedback: 0.22 },
    ],
    glow: [
      { name: 'Ethereal Pad', type: 'Synth', options: {
        oscillator: { type: 'fatsawtooth', spread: 30 },
        envelope: { attack: 1.5, decay: 1.0, sustain: 0.85, release: 3.0 },
      }, volume: -12, chorusWet: 0.6, reverbDecay: 3.0, delayFeedback: 0.2 },
      { name: 'Glass Bell', type: 'FM', options: {
        harmonicity: 6, modulationIndex: 4, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.001, decay: 2.0, sustain: 0.05, release: 2.5 },
        modulationEnvelope: { attack: 0.001, decay: 1.0, sustain: 0.05, release: 2.0 },
      }, volume: -11, chorusWet: 0.4, reverbDecay: 2.5, delayFeedback: 0.25 },
      { name: 'Dreamy Strings', type: 'Synth', options: {
        oscillator: { type: 'fatsawtooth', spread: 20 },
        envelope: { attack: 0.6, decay: 0.5, sustain: 0.9, release: 2.0 },
      }, volume: -11, chorusWet: 0.5, reverbDecay: 2.0, delayFeedback: 0.18 },
      { name: 'Singing Pad', type: 'Synth', options: {
        oscillator: { type: 'sine' },
        envelope: { attack: 2.5, decay: 2.0, sustain: 0.8, release: 4.0 },
      }, volume: -14, chorusWet: 0.7, reverbDecay: 4.5, delayFeedback: 0.25 },
      { name: 'Clean Air', type: 'FM', options: {
        harmonicity: 1, modulationIndex: 0.2, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 1.0, decay: 1.0, sustain: 1.0, release: 3.0 },
      }, volume: -15, chorusWet: 0.4, reverbDecay: 5.0, delayFeedback: 0.3 },
    ],
  }

  private reverb:          Tone.Reverb
  private delay:           Tone.FeedbackDelay
  private chorus:          Tone.Chorus
  private dryBus:          Tone.Gain
  private delaySend:       Tone.Gain
  private reverbSend:      Tone.Gain
  private delayReturnHP:   Tone.Filter
  private reverbReturnHP:  Tone.Filter

  constructor() {
    super(GeneratorName.Melody)

    this.output = new Tone.Gain(1)

    this.synth = this.buildDefaultSynth()
    this.synth.volume.value = -9

    this.chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.4, wet: 0.3 })

    // Parallel send routing — prevents reverb'd delays from accumulating
    // synth → chorus → dry bus → output
    //                 → delay send → delay → delayHP → output
    //                 → reverb send → reverb → reverbHP → output
    this.dryBus     = new Tone.Gain(0.80)
    this.delaySend  = new Tone.Gain(0.10)
    this.reverbSend = new Tone.Gain(0.08)
    this.delay  = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.12, wet: 1.0 })
    this.reverb = new Tone.Reverb({ decay: 0.8, wet: 1.0 })

    // Highpass on wet returns to prevent low-mid mud accumulation in tails
    this.delayReturnHP  = new Tone.Filter({ type: 'highpass', frequency: 300, rolloff: -12 })
    this.reverbReturnHP = new Tone.Filter({ type: 'highpass', frequency: 250, rolloff: -12 })

    this.synth.connect(this.chorus)
    this.chorus.connect(this.dryBus)
    this.chorus.connect(this.delaySend)
    this.chorus.connect(this.reverbSend)
    this.dryBus.connect(this.output)
    this.delaySend.connect(this.delay)
    this.delay.connect(this.delayReturnHP)
    this.delayReturnHP.connect(this.output)
    this.reverbSend.connect(this.reverb)
    this.reverb.connect(this.reverbReturnHP)
    this.reverbReturnHP.connect(this.output)

    this.chorus.start()
    this.setOutputLevel(0)
  }

  /** Build the default FM synth (used before any mode-based selection). */
  private buildDefaultSynth(): Tone.PolySynth {
    return new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 6,
      harmonicity: 2,
      modulationIndex: 1.5,
      oscillator:    { type: 'sine' },
      modulation:    { type: 'triangle' },
      envelope:      { attack: 0.08, decay: 0.3, sustain: 0.35, release: 1.2 },
      modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.3, release: 0.8 },
    } as any)
  }

  // Cached performer features for intelligent voice selection
  private lastPerformerEnergy: number = 0.5
  private lastPerformerBrightness: number = 0.5
  private lastPerformerSyllabicRate: number = 4

  /**
   * Feed performer analysis into the melody generator for intelligent voice selection.
   * Called by the orchestrator every frame.
   */
  setPerformerFeatures(energy: number, brightness: number, syllabicRate: number): void {
    this.lastPerformerEnergy = energy
    this.lastPerformerBrightness = brightness
    this.lastPerformerSyllabicRate = syllabicRate
  }

  /**
   * Select the best voice preset for the current mode based on what
   * the Organism hears from the performer's voice.
   *
   * - High energy + fast syllables → aggressive/percussive voices (leads, plucks)
   * - Low energy + slow delivery → warm/sustained voices (pads, keys, strings)
   * - Bright voice → brighter instruments; dark voice → darker instruments
   *
   * Called on state transitions (Breathing/Flow).
   */
  private applyModeVoice(mode: string): void {
    const pool = MelodyGenerator.MODE_VOICES[mode]
    if (!pool || pool.length === 0) return

    // Score each voice in the pool based on performer characteristics
    let bestVoice = pool[0]
    let bestScore = -Infinity

    for (const voice of pool) {
      let score = 0

      // Attack time as a proxy for percussive vs sustained
      const attack = voice.options.envelope?.attack ?? 0.1
      const isPercussive = attack < 0.02
      const isSustained = attack > 0.3

      // High energy + fast rap → prefer percussive/bright sounds
      if (this.lastPerformerEnergy > 0.6 && this.lastPerformerSyllabicRate > 5) {
        if (isPercussive) score += 3
        if (voice.chorusWet < 0.2) score += 1 // dry = punchy
      }

      // Low energy + slow delivery → prefer warm sustained sounds
      if (this.lastPerformerEnergy < 0.4 || this.lastPerformerSyllabicRate < 3) {
        if (isSustained) score += 3
        if (voice.reverbDecay > 1.5) score += 1 // more reverb for atmosphere
      }

      // Match brightness: bright voice → bright instruments
      if (this.lastPerformerBrightness > 0.6) {
        // Prefer higher chorus wet and higher volume (brighter presence)
        if (voice.volume > -10) score += 1
      } else {
        // Dark voice → prefer darker, lower instruments
        if (voice.volume <= -10) score += 1
        if (voice.chorusWet > 0.3) score += 1 // chorus adds warmth
      }

      // Medium energy → slight random variation to keep things interesting
      if (this.lastPerformerEnergy >= 0.4 && this.lastPerformerEnergy <= 0.6) {
        score += Math.random() * 1.5
      }

      if (score > bestScore) {
        bestScore = score
        bestVoice = voice
      }
    }

    const voice = bestVoice
    this.currentVoiceName = voice.name

    // Disconnect old synth from chain
    this.synth.disconnect()
    try { this.synth.releaseAll() } catch { /* */ }
    this.synth.dispose()

    // Build new synth based on voice type
    let newSynth: Tone.PolySynth
    switch (voice.type) {
      case 'Mono':
        newSynth = new Tone.PolySynth(Tone.MonoSynth, {
          maxPolyphony: 4,
          ...voice.options,
        } as any)
        break
      case 'Synth':
        newSynth = new Tone.PolySynth(Tone.Synth, {
          maxPolyphony: 6,
          ...voice.options,
        } as any)
        break
      case 'FM':
      default:
        newSynth = new Tone.PolySynth(Tone.FMSynth, {
          maxPolyphony: 6,
          ...voice.options,
        } as any)
        break
    }

    newSynth.volume.value = voice.volume
    this.synth = newSynth

    // Reconnect into chain
    this.synth.connect(this.chorus)

    // Adjust FX for this voice
    this.chorus.wet.rampTo(voice.chorusWet, 0.5)
    this.reverb.decay = voice.reverbDecay
    this.delay.feedback.rampTo(voice.delayFeedback, 0.5)

    console.log(`🎵 Melody voice: ${voice.name} (${mode})`)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentPresence = physics.presence
    this.voiceActive     = physics.voiceActive
    this.flowDepth       = organism.flowDepth
    this.currentSwing    = MelodyGenerator.MODE_SWING[physics.mode.toString()] ?? 0.35

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

      // Select a genre-appropriate synth voice for this mode
      this.applyModeVoice(physics.mode.toString())
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

      // Swing: off-16ths pushed late — amount matches genre (drum + bass use same values)
      const bar  = Math.floor(cursor / 16)
      const beat = Math.floor((cursor % 16) / 4)
      const sub  = cursor % 4
      const swungSub = (sub === 1 || sub === 3) ? sub + this.currentSwing : sub
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
      try { this.synth.releaseAll() } catch { /* context not yet started */ }
    }
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier * Math.min(1.4, this.volumeMultiplier)
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    this.output.gain.rampTo(Math.pow(10, db / 20), 0.25)
  }

  dispose(): void {
    this.stopPart()
    this.synth.dispose()
    this.chorus.dispose()
    this.dryBus.dispose()
    this.delaySend.dispose()
    this.reverbSend.dispose()
    this.delayReturnHP.dispose()
    this.reverbReturnHP.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.output.dispose()
  }
}
