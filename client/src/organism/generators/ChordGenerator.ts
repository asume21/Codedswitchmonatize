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

// ── Chord behavior — when to play and how dense ──────────────────────

export enum ChordBehavior {
  Silent  = 'silent',    // Dormant / Awakening — no chords
  Pad     = 'pad',       // Breathing — long sustained chords (whole notes)
  Rhythm  = 'rhythm',    // Flow — rhythmic chord hits (half/quarter notes)
  Stab    = 'stab',      // High energy — short staccato stabs
}

// ── Mode → Synth voice presets (pads/keys for harmonic bed) ──────────

interface ChordVoice {
  name:       string
  type:       'FM' | 'Synth'
  options:    any
  volume:     number
  chorusWet:  number
  reverbDecay: number
}

const MODE_VOICES: Record<string, ChordVoice[]> = {
  heat: [
    { name: 'Dark Pad', type: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 20 },
      envelope: { attack: 0.4, decay: 0.8, sustain: 0.6, release: 1.5 },
    }, volume: -16, chorusWet: 0.3, reverbDecay: 1.5 },
    { name: 'Trap Keys', type: 'FM', options: {
      harmonicity: 2, modulationIndex: 1.2,
      oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.8, sustain: 0.3, release: 1.0 },
      modulationEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.8 },
    }, volume: -14, chorusWet: 0.15, reverbDecay: 0.8 },
  ],
  gravel: [
    { name: 'Menacing Pad', type: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 25 },
      envelope: { attack: 0.6, decay: 1.0, sustain: 0.5, release: 2.0 },
    }, volume: -17, chorusWet: 0.25, reverbDecay: 2.0 },
  ],
  smoke: [
    { name: 'Soul Keys', type: 'FM', options: {
      harmonicity: 2, modulationIndex: 1.0,
      oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 1.2, sustain: 0.4, release: 1.5 },
      modulationEnvelope: { attack: 0.01, decay: 0.6, sustain: 0.2, release: 1.0 },
    }, volume: -13, chorusWet: 0.4, reverbDecay: 1.2 },
    { name: 'Warm Rhodes', type: 'FM', options: {
      harmonicity: 2, modulationIndex: 0.8,
      oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.008, decay: 1.5, sustain: 0.35, release: 2.0 },
      modulationEnvelope: { attack: 0.01, decay: 0.8, sustain: 0.15, release: 1.5 },
    }, volume: -14, chorusWet: 0.45, reverbDecay: 1.5 },
  ],
  ice: [
    { name: 'Lo-fi Pad', type: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 30 },
      envelope: { attack: 1.0, decay: 1.5, sustain: 0.7, release: 3.0 },
    }, volume: -16, chorusWet: 0.5, reverbDecay: 2.5 },
    { name: 'Dreamy Keys', type: 'FM', options: {
      harmonicity: 3, modulationIndex: 0.5,
      oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.3, decay: 2.0, sustain: 0.5, release: 3.0 },
      modulationEnvelope: { attack: 0.1, decay: 1.0, sustain: 0.3, release: 2.0 },
    }, volume: -15, chorusWet: 0.55, reverbDecay: 3.0 },
  ],
  glow: [
    { name: 'Ethereal Chords', type: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 35 },
      envelope: { attack: 1.5, decay: 2.0, sustain: 0.8, release: 4.0 },
    }, volume: -17, chorusWet: 0.6, reverbDecay: 3.5 },
    { name: 'Crystal Pad', type: 'FM', options: {
      harmonicity: 4, modulationIndex: 0.3,
      oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.8, decay: 1.5, sustain: 0.7, release: 3.0 },
      modulationEnvelope: { attack: 0.5, decay: 1.0, sustain: 0.4, release: 2.5 },
    }, volume: -16, chorusWet: 0.5, reverbDecay: 4.0 },
  ],
}

// ── Genre-aware swing (matches drums/bass) ───────────────────────────

const MODE_SWING: Record<string, number> = {
  heat: 0.20, gravel: 0.22, smoke: 0.55, ice: 0.48, glow: 0.38,
}

// ── Voicing octaves per mode ─────────────────────────────────────────

const MODE_OCTAVES: Record<string, number> = {
  heat: 3, gravel: 3, smoke: 3, ice: 4, glow: 4,
}

// ── The Generator ────────────────────────────────────────────────────

export class ChordGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth:   Tone.PolySynth
  private chorus:  Tone.Chorus
  private reverb:  Tone.Reverb
  private dryBus:  Tone.Gain
  private reverbSend: Tone.Gain
  private reverbReturnHP: Tone.Filter
  private part:    Tone.Part | null = null

  // Musical state
  private currentProgression: ParsedProgression | null = null
  private currentChordIndex:  number = 0
  private currentBehavior:    ChordBehavior = ChordBehavior.Silent
  private rootPitchClass:     number = 0     // synced from ScaleSnapEngine
  private currentMode:        string = 'glow'
  private currentSwing:       number = 0.35

  // Reactive state
  private volumeMultiplier: number = 1.0

  // Tracked synth dispose timer — prevents zombie synth accumulation
  private pendingSynthDispose: ReturnType<typeof setTimeout> | null = null
  private pendingOldSynth: Tone.PolySynth | null = null
  private lastOutputGain:   number = 0

  // Chord change callback — Bass/Melody subscribe to know current chord
  private chordChangeListeners: Array<(chord: ChordEvent, rootPitchClass: number) => void> = []

  constructor() {
    super(GeneratorName.Chord)

    this.output = new Tone.Gain(1)

    this.synth = this.buildDefaultSynth()

    // FX chain: synth → chorus → dry bus → output
    //                           → reverb send → reverb → HP → output
    this.chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 4, depth: 0.5, wet: 0.35 })
    this.dryBus = new Tone.Gain(0.75)
    this.reverbSend = new Tone.Gain(0.12)
    this.reverb = new Tone.Reverb({ decay: 2.0, wet: 1.0 })
    this.reverbReturnHP = new Tone.Filter({ type: 'highpass', frequency: 250, rolloff: -12 })

    this.synth.connect(this.chorus)
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

  // ── Frame processing ─────────────────────────────────────────────

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
      // Pick a new progression for this session
      this.currentProgression = pickProgression(this.currentMode)
      this.currentChordIndex = 0
      this.currentBehavior = ChordBehavior.Silent
      this.applyVoice(this.currentMode)
      console.debug(`🎹 Chord progression: ${this.currentProgression.chords.map(c => c.label).join(' → ')} (${this.currentProgression.moods.join(', ')})`)
      return
    }

    if (to === OState.Breathing || to === OState.Flow) {
      // If no progression picked yet, pick one now
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
    this.setOutputLevel(0)
  }

  // ── Chord-awareness API (for Bass/Melody) ──────────────────────────

  /** Subscribe to chord changes. Returns unsubscribe function. */
  onChordChange(listener: (chord: ChordEvent, rootPitchClass: number) => void): () => void {
    this.chordChangeListeners.push(listener)
    return () => {
      this.chordChangeListeners = this.chordChangeListeners.filter(l => l !== listener)
    }
  }

  /** Get the current chord event (for polling instead of event-based). */
  getCurrentChord(): ChordEvent | null {
    if (!this.currentProgression) return null
    return this.currentProgression.chords[this.currentChordIndex] ?? null
  }

  /** Get the root pitch class (for Bass/Melody to compute absolute pitches). */
  getRootPitchClass(): number {
    return this.rootPitchClass
  }

  /** Set root pitch class from ScaleSnapEngine. */
  setRootPitchClass(pitchClass: number): void {
    this.rootPitchClass = ((pitchClass % 12) + 12) % 12
  }

  // ── Reactive mutation methods ──────────────────────────────────────

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    this.setOutputLevel(this.activityLevel)
  }

  /** Force a new progression pick (e.g. on genre change). */
  pickNewProgression(): void {
    this.currentProgression = pickProgression(this.currentMode)
    this.currentChordIndex = 0
    this.rebuildPart()
    console.debug(`🎹 New progression: ${this.currentProgression.chords.map(c => c.label).join(' → ')} (${this.currentProgression.moods.join(', ')})`)
  }

  // ── Private ────────────────────────────────────────────────────────

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

  // Rebuild throttle — prevent rapid Part rebuilds from overlapping.
  // ChordGenerator has an 8-voice PolySynth + chorus + reverb, so rebuilds are expensive.
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

    // Build events: distribute chords evenly across 4 bars
    // Each chord gets (4 bars / chordCount) bars of duration
    interface ChordPartEvent {
      time: string
      notes: string[]
      dur: string
      vel: number
      chordIdx: number
    }

    const events: ChordPartEvent[] = []
    const barsPerChord = Math.max(1, Math.floor(4 / chordCount))
    const totalBars = barsPerChord * chordCount  // might be > 4, clamp in loopEnd

    for (let ci = 0; ci < chordCount; ci++) {
      const chord = prog.chords[ci]
      const barStart = ci * barsPerChord
      const midiNotes = voiceChord(chord, this.rootPitchClass, octave)
      const noteStrings = midiNotes.map(m => Tone.Frequency(m, 'midi').toNote())

      switch (this.currentBehavior) {
        case ChordBehavior.Pad: {
          // Whole-note sustained chords
          const time = `${barStart}:0:0`
          const dur = barsPerChord >= 2 ? `${barsPerChord}m` : '1m'
          events.push({ time, notes: noteStrings, dur, vel: 0.55, chordIdx: ci })
          break
        }

        case ChordBehavior.Rhythm: {
          // Half-note rhythm with swing
          for (let b = 0; b < barsPerChord; b++) {
            const bar = barStart + b
            // Hit on beat 1
            events.push({
              time: `${bar}:0:0`, notes: noteStrings, dur: '2n',
              vel: 0.58, chordIdx: ci,
            })
            // Hit on beat 3 (with subtle velocity drop)
            events.push({
              time: `${bar}:2:0`, notes: noteStrings, dur: '2n',
              vel: 0.48, chordIdx: ci,
            })
          }
          break
        }

        case ChordBehavior.Stab: {
          // Short staccato stabs — rhythmic hits on off-beats for energy
          for (let b = 0; b < barsPerChord; b++) {
            const bar = barStart + b
            // Beat 1: stab
            events.push({
              time: `${bar}:0:0`, notes: noteStrings, dur: '8n',
              vel: 0.65, chordIdx: ci,
            })
            // "and" of 2: syncopated stab
            const swungSub = 2 + this.currentSwing
            events.push({
              time: `${bar}:1:${swungSub.toFixed(2)}`, notes: noteStrings, dur: '8n',
              vel: 0.50, chordIdx: ci,
            })
            // Beat 3: stab
            events.push({
              time: `${bar}:2:0`, notes: noteStrings, dur: '8n',
              vel: 0.58, chordIdx: ci,
            })
            // "and" of 4: anticipation
            if (b === barsPerChord - 1 && ci < chordCount - 1) {
              // Anticipate next chord
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

    const loopBars = Math.min(totalBars, 8)  // cap at 8 bars

    this.part = new Tone.Part((time, event: ChordPartEvent) => {
      // Update current chord index and notify listeners
      if (event.chordIdx !== this.currentChordIndex) {
        this.currentChordIndex = event.chordIdx
        const chord = prog.chords[this.currentChordIndex]
        if (chord) {
          for (const listener of this.chordChangeListeners) {
            listener(chord, this.rootPitchClass)
          }
        }
      }

      // Humanize velocity slightly
      const vel = Math.min(1, Math.max(0.1, event.vel + (Math.random() - 0.5) * 0.08))

      // Play the chord (all notes simultaneously)
      this.synth.triggerAttackRelease(event.notes, event.dur, time, vel)
    }, events)

    this.part.loop = true
    this.part.loopEnd = `${loopBars}m`
    this.part.start('+0.1')

    // Immediately notify listeners of the first chord
    const firstChord = prog.chords[0]
    if (firstChord) {
      this.currentChordIndex = 0
      for (const listener of this.chordChangeListeners) {
        listener(firstChord, this.rootPitchClass)
      }
    }
  }

  private applyVoice(mode: string): void {
    const pool = MODE_VOICES[mode] ?? MODE_VOICES.glow
    const voice = pool[Math.floor(Math.random() * pool.length)]

    // If a previous synth swap is still pending, force-dispose it NOW
    if (this.pendingSynthDispose) {
      clearTimeout(this.pendingSynthDispose)
      this.pendingSynthDispose = null
      if (this.pendingOldSynth) {
        try { this.pendingOldSynth.disconnect() } catch { /* */ }
        try { this.pendingOldSynth.dispose() } catch { /* */ }
        this.pendingOldSynth = null
      }
    }

    // Fade out old synth before disconnect to prevent click/pop
    const oldSynth = this.synth
    oldSynth.volume.rampTo(-Infinity, 0.15)
    try { oldSynth.releaseAll() } catch { /* */ }
    // Track the deferred dispose so rapid transitions can cancel it
    this.pendingOldSynth = oldSynth
    this.pendingSynthDispose = setTimeout(() => {
      try { oldSynth.disconnect() } catch { /* already disposed */ }
      try { oldSynth.dispose() } catch { /* already disposed */ }
      this.pendingOldSynth = null
      this.pendingSynthDispose = null
    }, 200)

    // Build new synth
    let newSynth: Tone.PolySynth
    if (voice.type === 'FM') {
      newSynth = new Tone.PolySynth(Tone.FMSynth, {
        maxPolyphony: 8,
        ...voice.options,
      } as any)
    } else {
      newSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        ...voice.options,
      } as any)
    }

    newSynth.volume.value = voice.volume
    this.synth = newSynth
    this.synth.connect(this.chorus)

    // Adjust FX
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
    // Release all voices and cancel any in-progress automation on the volume
    // param. cancelScheduledValues prevents stale ramps from accumulating
    // on the AudioParam timeline (the root cause of progressive crackling).
    try {
      this.synth.volume.cancelScheduledValues(Tone.now())
      this.synth.releaseAll()
    } catch { /* context not yet started */ }
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier * Math.min(1.3, this.volumeMultiplier)
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    const linear = db === -Infinity ? 0 : Math.pow(10, db / 20)
    // Skip redundant ramp if gain hasn't changed meaningfully.
    // Threshold of 0.008 (~0.07dB) prevents physics micro-drift from
    // restarting ramps every frame. Previous threshold of 0.001 was too tight.
    if (Math.abs(linear - this.lastOutputGain) < 0.008) return
    this.lastOutputGain = linear
    this.output.gain.cancelScheduledValues(Tone.now())
    this.output.gain.rampTo(linear, 0.35)
  }

  dispose(): void {
    this.stopPart()
    this.chordChangeListeners = []
    // Clean up any pending synth swap timer
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
    this.chorus.dispose()
    this.dryBus.dispose()
    this.reverbSend.dispose()
    this.reverbReturnHP.dispose()
    this.reverb.dispose()
    this.output.dispose()
  }
}
