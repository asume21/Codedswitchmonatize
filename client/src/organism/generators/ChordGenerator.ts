// Section 04 — Chord Generator
//
// 5th generator in the Organism — plays chord progressions using pad/keys
// synth voices. Picks from the 176-progression bank based on mood×mode matching.
// Broadcasts the current chord so Bass and Melody can target chord tones.

import * as Tone from 'tone'
import { GeneratorBase }  from './GeneratorBase'
import { GeneratorName }  from './types'
import type { PhysicsState }  from '../physics/types'
import { OrganismMode }       from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState }             from '../state/types'
import {
  pickProgression,
  voiceChord,
  type ParsedProgression,
  type ChordEvent,
} from './patterns/ChordProgressionBank'
import { createSoundfontSampler, type LoadableSampler } from '../instruments/SamplerUtils'
import { getTechnique, DEFAULT_TECHNIQUE_ID } from '../techniques/library'
import type { TechniqueContext } from '../techniques/types'

export enum ChordBehavior {
  Silent  = 'silent',    // Dormant / Awakening — no chords
  Pad     = 'pad',       // Breathing — long sustained chords (whole notes)
  Rhythm  = 'rhythm',    // Flow — rhythmic chord hits (half/quarter notes)
  Stab    = 'stab',      // High energy — short staccato stabs
}

const MODE_SWING: Record<string, number> = {
  heat: 0.20, gravel: 0.22, smoke: 0.55, ice: 0.48, glow: 0.38,
}

const MODE_OCTAVES: Record<string, number> = {
  heat: 3, gravel: 3, smoke: 3, ice: 4, glow: 4,
}

export class ChordGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth:   Tone.PolySynth | LoadableSampler
  // Fallback synth — always available for instant playback while CDN samplers load
  private fallbackSynth: Tone.PolySynth
  private chorus:  Tone.Chorus
  private reverb:  Tone.Reverb
  private dryBus:  Tone.Gain
  private reverbSend: Tone.Gain
  private reverbReturnHP: Tone.Filter
  private part:    Tone.Part | null = null
  private hasStartedPlayback: boolean = false

  // Musical state
  private currentProgression: ParsedProgression | null = null
  private currentChordIndex:  number = 0
  private currentBehavior:    ChordBehavior = ChordBehavior.Silent
  private rootPitchClass:     number = 0     // synced from ScaleSnapEngine
  private currentMode:        string = 'glow'
  private currentSwing:       number = 0.35

  // Reactive state
  private volumeMultiplier: number = 1.0

  // Active technique — controls how chord notes are distributed over time.
  // Defaults to block-chord (simultaneous notes) for backward compatibility.
  private currentTechniqueId: string = DEFAULT_TECHNIQUE_ID

  /** Change the active playing technique (rebuilds the Part on next tick). */
  setTechnique(techniqueId: string): void {
    if (!getTechnique(techniqueId)) {
      console.warn(`[ChordGenerator] Unknown technique: ${techniqueId}`)
      return
    }
    if (this.currentTechniqueId === techniqueId) return
    this.currentTechniqueId = techniqueId
    // Rebuild on next tick so new technique takes effect at the next chord
    this.lastRebuildTime = 0
    if (this.currentProgression) this.rebuildPart()
  }

  getTechnique(): string {
    return this.currentTechniqueId
  }

  // Tracked synth dispose timer
  private pendingSynthDispose: ReturnType<typeof setTimeout> | null = null
  private pendingOldSynth: Tone.PolySynth | LoadableSampler | null = null
  private lastOutputGain:   number = 0

  private chordChangeListeners: Array<(chord: ChordEvent, rootPitchClass: number) => void> = []

  // ─── Dynamic Global Voices ──────────────────────────────────
  private static readonly GLOBAL_VOICES: Array<{
    name: string; type: 'FM' | 'Synth' | 'Sampler'; options: any; presetId?: string
    volume: number; chorusWet: number; reverbDecay: number
    modes: string[] // which modes this instrument heavily favors
  }> = [
    // Trap / Heat
    { name: 'Dark Pad', type: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 20 },
      envelope: { attack: 0.4, decay: 0.8, sustain: 0.6, release: 1.5 },
    }, volume: -16, chorusWet: 0.3, reverbDecay: 1.5, modes: ['heat', 'gravel'] },
    { name: 'Brass Synth', type: 'Synth', options: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.75, release: 0.25 },
    }, volume: -14, chorusWet: 0.1, reverbDecay: 0.8, modes: ['heat'] },

    // Boom Bap / Gravel
    { name: 'Jazz Horns', type: 'Sampler', presetId: 'trumpet', options: {
      envelope: { attack: 0.05, release: 0.3 }
    }, volume: -12, chorusWet: 0.2, reverbDecay: 1.0, modes: ['gravel'] },

    // Neo-Soul / Smoke
    { name: 'Warm Rhodes', type: 'Sampler', presetId: 'electric_piano_1', options: {
      envelope: { attack: 0.005, release: 0.8 }
    }, volume: -8, chorusWet: 0.45, reverbDecay: 1.5, modes: ['smoke', 'gravel'] },

    // Cloud Rap / Ice
    { name: 'Choir Aahs', type: 'Sampler', presetId: 'choir_aahs', options: {
      envelope: { attack: 0.3, release: 1.5 }
    }, volume: -8, chorusWet: 0.5, reverbDecay: 2.5, modes: ['ice'] },
    { name: 'Harp', type: 'Sampler', presetId: 'orchestral_harp', options: {
      envelope: { attack: 0.01, release: 1.5 }
    }, volume: -5, chorusWet: 0.55, reverbDecay: 3.0, modes: ['ice'] },

    // R&B / Glow
    { name: 'Acoustic Piano', type: 'Sampler', presetId: 'acoustic_grand_piano', options: {
      envelope: { attack: 0.005, release: 1.5 }
    }, volume: -8, chorusWet: 0.3, reverbDecay: 1.5, modes: ['glow', 'smoke'] },
    { name: 'String Ensemble', type: 'Sampler', presetId: 'string_ensemble_1', options: {
      envelope: { attack: 0.4, release: 1.5 }
    }, volume: -10, chorusWet: 0.4, reverbDecay: 2.0, modes: ['glow'] },
  ]

  constructor() {
    super(GeneratorName.Chord)

    this.output = new Tone.Gain(1)

    this.synth = this.buildDefaultSynth()
    this.fallbackSynth = this.buildDefaultSynth()

    // FX chain: synth → chorus → dry bus → output
    //                           → reverb send → reverb → HP → output
    this.chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 4, depth: 0.5, wet: 0.35 })
    this.dryBus = new Tone.Gain(0.75)
    this.reverbSend = new Tone.Gain(0.12)
    this.reverb = new Tone.Reverb({ decay: 2.0, wet: 1.0 })
    this.reverbReturnHP = new Tone.Filter({ type: 'highpass', frequency: 250, rolloff: -12 })

    this.synth.connect(this.chorus)
    this.fallbackSynth.connect(this.chorus)
    this.chorus.connect(this.dryBus)
    this.chorus.connect(this.reverbSend)
    this.dryBus.connect(this.output)
    this.reverbSend.connect(this.reverb)
    this.reverb.connect(this.reverbReturnHP)
    this.reverbReturnHP.connect(this.output)

    this.chorus.start()
    this.setOutputLevel(0)
  }

  private buildDefaultSynth(): Tone.PolySynth {
    return new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 8,
      harmonicity: 2,
      modulationIndex: 0.8,
      oscillator:    { type: 'sine' },
      modulation:    { type: 'triangle' },
      envelope:      { attack: 0.3, decay: 1.0, sustain: 0.5, release: 2.0 },
      modulationEnvelope: { attack: 0.1, decay: 0.5, sustain: 0.3, release: 1.5 },
    } as any)
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentMode = physics.mode.toString()
    this.currentSwing = MODE_SWING[this.currentMode] ?? 0.35

    const newBehavior = this.getChordBehavior(organism)

    if (newBehavior !== this.currentBehavior) {
      this.currentBehavior = newBehavior
      this.rebuildPart()
    }

    const targetLevel = this.computeTargetLevel(organism)
    this.activityLevel += this.smoothingCoeff(150) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    this.currentMode = physics.mode.toString()

    if (to === OState.Dormant) {
      this.stopPart()
      this.activityLevel = 0
      this.currentBehavior = ChordBehavior.Silent
      return
    }

    if (to === OState.Awakening) {
      this.currentProgression = pickProgression(this.currentMode)
      this.currentChordIndex = 0
      this.currentBehavior = ChordBehavior.Silent
      this.applyVoice(this.currentMode)
      console.debug(`🎹 Chord progression: ${this.currentProgression.chords.map(c => c.label).join(' → ')} (${this.currentProgression.moods.join(', ')})`)
      return
    }

    if (to === OState.Breathing || to === OState.Flow) {
      if (!this.currentProgression) {
        this.currentProgression = pickProgression(this.currentMode)
        this.currentChordIndex = 0
        this.applyVoice(this.currentMode)
        console.debug(`🎹 Chord progression: ${this.currentProgression.chords.map(c => c.label).join(' → ')} (${this.currentProgression.moods.join(', ')})`)
      }
      this.currentBehavior = to === OState.Breathing ? ChordBehavior.Pad : ChordBehavior.Rhythm
      this.rebuildPart()
    }
  }

  reset(): void {
    this.stopPart()
    this.activityLevel = 0
    this.currentBehavior = ChordBehavior.Silent
    this.currentProgression = null
    this.currentChordIndex = 0
    this.hasStartedPlayback = false
    this.setOutputLevel(0)
  }

  onChordChange(listener: (chord: ChordEvent, rootPitchClass: number) => void): () => void {
    this.chordChangeListeners.push(listener)
    return () => {
      this.chordChangeListeners = this.chordChangeListeners.filter(l => l !== listener)
    }
  }

  getCurrentChord(): ChordEvent | null {
    if (!this.currentProgression) return null
    return this.currentProgression.chords[this.currentChordIndex] ?? null
  }

  getRootPitchClass(): number {
    return this.rootPitchClass
  }

  setRootPitchClass(pitchClass: number): void {
    this.rootPitchClass = ((pitchClass % 12) + 12) % 12
  }

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    this.setOutputLevel(this.activityLevel)
  }

  pickNewProgression(): void {
    this.currentProgression = pickProgression(this.currentMode)
    this.currentChordIndex = 0
    this.rebuildPart()
    console.debug(`🎹 New progression: ${this.currentProgression.chords.map(c => c.label).join(' → ')} (${this.currentProgression.moods.join(', ')})`)
  }

  private getChordBehavior(organism: OrganismState): ChordBehavior {
    switch (organism.current) {
      case OState.Dormant:
      case OState.Awakening:
        return ChordBehavior.Silent
      case OState.Breathing:
        return ChordBehavior.Pad
      case OState.Flow:
        return organism.flowDepth > 0.7 ? ChordBehavior.Stab : ChordBehavior.Rhythm
    }
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:   return 0
      case OState.Awakening: return 0.05 * organism.awakeningProgress
      case OState.Breathing: return 0.45 * organism.breathingWarmth
      case OState.Flow:      return 0.55 + (0.25 * organism.flowDepth)
    }
  }

  private lastRebuildTime: number = 0
  private static readonly MIN_REBUILD_INTERVAL_MS = 500

  private rebuildPart(): void {
    const now = performance.now()
    if (now - this.lastRebuildTime < ChordGenerator.MIN_REBUILD_INTERVAL_MS) return
    this.lastRebuildTime = now

    this.stopPart()

    if (this.currentBehavior === ChordBehavior.Silent || !this.currentProgression) return

    const prog = this.currentProgression
    const chordCount = prog.chords.length
    const octave = MODE_OCTAVES[this.currentMode] ?? 4

    interface ChordPartEvent {
      time: string
      notes: string[]
      dur: string
      vel: number
      chordIdx: number
    }

    const events: ChordPartEvent[] = []
    const barsPerChord = Math.max(1, Math.floor(4 / chordCount))
    const totalBars = barsPerChord * chordCount

    for (let ci = 0; ci < chordCount; ci++) {
      const chord = prog.chords[ci]
      const barStart = ci * barsPerChord
      const midiNotes = voiceChord(chord, this.rootPitchClass, octave)
      const noteStrings = midiNotes.map(m => Tone.Frequency(m, 'midi').toNote())

      switch (this.currentBehavior) {
        case ChordBehavior.Pad: {
          const time = `${barStart}:0:0`
          const dur = barsPerChord >= 2 ? `${barsPerChord}m` : '1m'
          events.push({ time, notes: noteStrings, dur, vel: 0.55, chordIdx: ci })
          break
        }

        case ChordBehavior.Rhythm: {
          for (let b = 0; b < barsPerChord; b++) {
            const bar = barStart + b
            events.push({
              time: `${bar}:0:0`, notes: noteStrings, dur: '2n',
              vel: 0.58, chordIdx: ci,
            })
            events.push({
              time: `${bar}:2:0`, notes: noteStrings, dur: '2n',
              vel: 0.48, chordIdx: ci,
            })
          }
          break
        }

        case ChordBehavior.Stab: {
          for (let b = 0; b < barsPerChord; b++) {
            const bar = barStart + b
            events.push({
              time: `${bar}:0:0`, notes: noteStrings, dur: '8n',
              vel: 0.65, chordIdx: ci,
            })
            const swungSub = 2 + this.currentSwing
            events.push({
              time: `${bar}:1:${swungSub.toFixed(2)}`, notes: noteStrings, dur: '8n',
              vel: 0.50, chordIdx: ci,
            })
            events.push({
              time: `${bar}:2:0`, notes: noteStrings, dur: '8n',
              vel: 0.58, chordIdx: ci,
            })
            if (b === barsPerChord - 1 && ci < chordCount - 1) {
              const nextChord = prog.chords[ci + 1]
              const nextMidi = voiceChord(nextChord, this.rootPitchClass, octave)
              const nextNotes = nextMidi.map(m => Tone.Frequency(m, 'midi').toNote())
              events.push({
                time: `${bar}:3:${swungSub.toFixed(2)}`, notes: nextNotes, dur: '16n',
                vel: 0.42, chordIdx: ci + 1,
              })
            }
          }
          break
        }
      }
    }

    const loopBars = Math.min(totalBars, 8)

    this.part = new Tone.Part((time, event: ChordPartEvent) => {
      if (event.chordIdx !== this.currentChordIndex) {
        this.currentChordIndex = event.chordIdx
        const chord = prog.chords[this.currentChordIndex]
        if (chord) {
          for (const listener of this.chordChangeListeners) {
            listener(chord, this.rootPitchClass)
          }
        }
      }

      const vel = Math.min(1, Math.max(0.1, event.vel + (Math.random() - 0.5) * 0.08))

      // Use sampler only if fully loaded; otherwise use fallback PolySynth
      const voice = this.isSamplerReady() ? this.synth : this.fallbackSynth

      // ── Technique dispatch ─────────────────────────────────────────
      // Instead of firing all chord notes simultaneously (block-chord), the
      // active technique returns per-note events with time offsets, allowing
      // guitar-strum, piano-roll, Alberti patterns, etc. Falls back to
      // simultaneous play when the default block-chord technique is active.
      const technique = getTechnique(this.currentTechniqueId)
      if (technique && this.currentTechniqueId !== DEFAULT_TECHNIQUE_ID) {
        const tempo = Tone.getTransport().bpm.value || 90
        const chordDurationSec = Tone.Time(event.dur).toSeconds()
        const ctx: TechniqueContext = {
          barIndex:         event.chordIdx,
          beatPosition:     0,
          swing:            this.currentSwing,
          energy:           Math.max(0, Math.min(1, vel)),
          mode:             this.currentMode as any,
          tempo,
          chordDurationSec,
        }
        const scheduled = technique.schedule(event.notes, ctx)
        for (const n of scheduled) {
          const noteVel = Math.min(1, Math.max(0.05, n.velocity * vel / 0.6))
          voice.triggerAttackRelease(n.note, n.duration, time + n.timeOffset, noteVel)
        }
      } else {
        // Legacy block-chord path: fire all notes simultaneously
        voice.triggerAttackRelease(event.notes, event.dur, time, vel)
      }
    }, events)

    this.part.loop = true
    this.part.loopEnd = `${loopBars}m`
    const startGrid = this.hasStartedPlayback ? '1m' : '16n'
    this.part.start(Tone.getTransport().nextSubdivision(startGrid))
    this.hasStartedPlayback = true

    const firstChord = prog.chords[0]
    if (firstChord) {
      this.currentChordIndex = 0
      for (const listener of this.chordChangeListeners) {
        listener(firstChord, this.rootPitchClass)
      }
    }
  }

  private applyVoice(mode: string): void {
    // Score voices - mix and match, but prioritize the intended mode
    let bestVoice = ChordGenerator.GLOBAL_VOICES[0]
    let bestScore = -Infinity

    for (const voice of ChordGenerator.GLOBAL_VOICES) {
      let score = 0
      if (voice.modes.includes(mode)) score += 3
      score += Math.random() * 2 // Allows serendipitous mixing!
      
      if (score > bestScore) {
        bestScore = score
        bestVoice = voice
      }
    }
    
    const voice = bestVoice

    if (this.pendingSynthDispose) {
      clearTimeout(this.pendingSynthDispose)
      this.pendingSynthDispose = null
      if (this.pendingOldSynth) {
        try { this.pendingOldSynth.disconnect() } catch { /* */ }
        try { this.pendingOldSynth.dispose() } catch { /* */ }
        this.pendingOldSynth = null
      }
    }

    const oldSynth = this.synth
    try {
      oldSynth.volume.cancelScheduledValues(Tone.now())
      oldSynth.releaseAll()
      oldSynth.disconnect()
    } catch { /* */ }
    
    this.pendingOldSynth = oldSynth
    this.pendingSynthDispose = setTimeout(() => {
      try { oldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
      this.pendingSynthDispose = null
    }, 100)

    let newSynth: Tone.PolySynth | LoadableSampler
    if (voice.type === 'Sampler' && voice.presetId) {
      newSynth = createSoundfontSampler(
        voice.presetId, 
        voice.options.envelope,
        voice.volume
      )
    } else {
      if (voice.type === 'FM') {
        newSynth = new Tone.PolySynth(Tone.FMSynth, { maxPolyphony: 8, ...voice.options } as any)
      } else {
        newSynth = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 8, ...voice.options } as any)
      }
      newSynth.volume.value = voice.volume
    }

    this.synth = newSynth
    this.synth.connect(this.chorus)

    this.chorus.wet.rampTo(voice.chorusWet, 0.5)
    this.reverb.decay = voice.reverbDecay

    console.debug(`🎹 Chord voice: ${voice.name} (${mode})`)
  }

  private stopPart(): void {
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
    try {
      this.synth.volume.cancelScheduledValues(Tone.now())
      this.synth.releaseAll()
    } catch { /* */ }
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier * Math.min(1.3, this.volumeMultiplier)
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    const linear = db === -Infinity ? 0 : Math.pow(10, db / 20)
    if (Math.abs(linear - this.lastOutputGain) < 0.008) return
    this.lastOutputGain = linear
    this.output.gain.cancelScheduledValues(Tone.now())
    this.output.gain.rampTo(linear, 0.35)
  }

  /** Check if the current synth is a sampler AND has finished loading */
  private isSamplerReady(): boolean {
    if (this.synth instanceof Tone.PolySynth) return false
    return (this.synth as LoadableSampler).isLoaded === true
  }

  dispose(): void {
    this.stopPart()
    this.chordChangeListeners = []
    if (this.pendingSynthDispose) {
      clearTimeout(this.pendingSynthDispose)
      this.pendingSynthDispose = null
    }
    if (this.pendingOldSynth) {
      try { this.pendingOldSynth.disconnect() } catch { /* */ }
      try { this.pendingOldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
    }
    this.synth.dispose()
    this.fallbackSynth.dispose()
    this.chorus.dispose()
    this.dryBus.dispose()
    this.reverbSend.dispose()
    this.reverbReturnHP.dispose()
    this.reverb.dispose()
    this.output.dispose()
  }
}
