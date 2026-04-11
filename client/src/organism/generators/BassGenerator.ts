// Section 04 — Bass Generator

import * as Tone from 'tone'
import { GeneratorBase }      from './GeneratorBase'
import { GeneratorName, BassBehavior } from './types'
import type { ScheduledNote } from './types'
import {
  getBassBehavior,
  getBassFilterCutoff,
  setBassSwing,
  buildBassNotes,
  shouldEnableSlide,
  getPortamentoTime,
}                              from './patterns/BassPatternLibrary'
import type { ChordEvent }     from './patterns/ChordProgressionBank'
import { getChordBassNote }    from './patterns/ChordProgressionBank'
import type { PhysicsState }   from '../physics/types'
import { OrganismMode }        from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'
import { createSoundfontSampler, type LoadableSampler } from '../instruments/SamplerUtils'

export class BassGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth:      Tone.MonoSynth | LoadableSampler
  private filter:     Tone.Filter
  private monoSub:    Tone.Filter      
  private compressor: Tone.Compressor
  private distortion: Tone.Distortion
  private part:       Tone.Part | null = null
  private hasStartedPlayback: boolean = false

  // Musical state
  private rootMidi:        number       = 36   
  private currentBehavior: BassBehavior = BassBehavior.Breathe

  private static readonly ROOT_POOL = [33, 36, 38, 40, 41, 43, 45, 48] 

  private chordRootPitchClass: number | null = null  
  private tonicPitchClass: number = 0  

  // Physics cache
  private currentPocket: number = 0
  private currentMode: OrganismMode = OrganismMode.Glow
  private lastFilterCutoff: number = 350
  private lastOutputGain: number = 0

  private pendingSynthDispose: ReturnType<typeof setTimeout> | null = null
  private pendingOldSynth: Tone.MonoSynth | LoadableSampler | null = null
  // Fallback synth used while a CDN sampler is loading
  private fallbackSynth: Tone.MonoSynth
  
  private isCurrentVoiceSampler: boolean = false

  // ─── Dynamic Global Voices ──────────────────────────────────
  private static readonly GLOBAL_VOICES = [
    // 808s (Heat / Ice)
    { name: 'Classic 808', type: 'Mono', oscType: 'sine', Q: 1, octaves: 0.5, attack: 0.001, decay: 1.0, sustain: 0.5, release: 1.5, distWet: 0.02, volume: -5, tags: ['electronic', '808'] },
    { name: 'Hard 808', type: 'Mono', oscType: 'sine', Q: 1.5, octaves: 0.8, attack: 0.001, decay: 0.9, sustain: 0.5, release: 1.2, distWet: 0.15, volume: -6, tags: ['electronic', '808', 'aggressive'] },
    
    // Acoustic/Electric (Gravel / Smoke)
    { name: 'Upright Bass', type: 'Sampler', presetId: 'acoustic_bass', attack: 0.05, release: 0.8, volume: 2, distWet: 0, tags: ['acoustic', 'warm'] },
    { name: 'Electric Bass', type: 'Sampler', presetId: 'electric_bass_finger', attack: 0.02, release: 0.5, volume: 1, distWet: 0, tags: ['electric', 'warm'] },
    { name: 'Fretless Bass', type: 'Sampler', presetId: 'fretless_bass', attack: 0.05, release: 0.6, volume: 0, distWet: 0, tags: ['electric', 'warm', 'smooth'] },

    // General Synths
    { name: 'Fat Saw Sub', type: 'Mono', oscType: 'fatsawtooth', Q: 3, octaves: 2.0, attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3, distWet: 0.20, volume: -7, tags: ['electronic'] },
    { name: 'Smooth Sub', type: 'Mono', oscType: 'fatsawtooth', Q: 1.5, octaves: 1.2, attack: 0.015, decay: 0.35, sustain: 0.7, release: 0.4, distWet: 0.05, volume: -6, tags: ['electronic', 'smooth'] },
  ]

  constructor() {
    super(GeneratorName.Bass)

    this.output     = new Tone.Gain(1)
    this.filter     = new Tone.Filter(350, 'lowpass')
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
        release:       0.15,
        baseFrequency: 80,
        octaves:       2.0,
      },
    })
    this.synth.volume.value = -7

    this.synth.connect(this.filter)
    this.filter.connect(this.monoSub)
    this.monoSub.connect(this.distortion)
    this.distortion.connect(this.compressor)
    this.compressor.connect(this.output)

    // Fallback synth — always available for instant playback while samplers load
    this.fallbackSynth = new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', spread: 15, count: 2 },
      filter:     { Q: 3, type: 'lowpass', rolloff: -24 },
      envelope:   { attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3 },
      filterEnvelope: {
        attack: 0.04, decay: 0.15, sustain: 0.35, release: 0.15,
        baseFrequency: 80, octaves: 2.0,
      },
    })
    this.fallbackSynth.volume.value = -7
    this.fallbackSynth.connect(this.filter)

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

    // Only duck filter if we are using a MonoSynth (samplers bypass the filter entirely)
    if (!this.isCurrentVoiceSampler) {
      const cutoff = getBassFilterCutoff(physics.mode, physics.pocket)
      if (Math.abs(cutoff - this.lastFilterCutoff) > 15) {
        this.filter.frequency.cancelScheduledValues(Tone.now())
        this.filter.frequency.rampTo(cutoff, 0.4)
        this.lastFilterCutoff = cutoff
      }
    }

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
      this.rootMidi        = BassGenerator.ROOT_POOL[Math.floor(Math.random() * BassGenerator.ROOT_POOL.length)]
      this.currentMode     = physics.mode
      setBassSwing(physics.mode.toString())
      this.currentBehavior = getBassBehavior(physics.mode, to)
      this.applyBassPreset()
      this.rebuildPart(physics)
      return
    }

    this.rootMidi    = BassGenerator.ROOT_POOL[Math.floor(Math.random() * BassGenerator.ROOT_POOL.length)]
    this.currentMode = physics.mode
    setBassSwing(physics.mode.toString()) 
    this.currentBehavior = getBassBehavior(physics.mode, to)
    this.applyBassPreset()
    this.rebuildPart(physics)
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBehavior = BassBehavior.Breathe
    this.currentPocket   = 0
    this.hasStartedPlayback = false
    this.setOutputLevel(0)
  }

  private applyBassPreset(): void {
    // Score voices 
    let bestVoice = BassGenerator.GLOBAL_VOICES[0]
    let bestScore = -Infinity

    for (const voice of BassGenerator.GLOBAL_VOICES) {
      let score = 0
      if ((this.currentMode === OrganismMode.Heat || this.currentMode === OrganismMode.Ice) && voice.tags.includes('808')) {
        score += 3
        if (this.currentMode === OrganismMode.Heat && voice.tags.includes('aggressive')) score += 1
      }
      if ((this.currentMode === OrganismMode.Gravel || this.currentMode === OrganismMode.Smoke) && voice.tags.includes('acoustic')) {
        score += 3
      }
      if (this.currentMode === OrganismMode.Smoke && voice.tags.includes('electric')) {
        score += 3
      }
      score += Math.random() * 1.5

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
      if (oldSynth instanceof Tone.MonoSynth) {
         oldSynth.triggerRelease()
      } else {
         oldSynth.releaseAll()
      }
      oldSynth.disconnect()
    } catch { /* */ }
    
    this.pendingOldSynth = oldSynth
    this.pendingSynthDispose = setTimeout(() => {
      try { oldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
      this.pendingSynthDispose = null
    }, 100)

    if (voice.type === 'Sampler' && voice.presetId) {
      this.isCurrentVoiceSampler = true
      this.synth = createSoundfontSampler(
        voice.presetId, 
        { attack: voice.attack, release: voice.release },
        voice.volume
      )
      // BYPASS FILTER AND DISTORTION ENTIRELY for acoustic/electric realism! 
      // Straight to compressor for tightness.
      this.synth.connect(this.compressor)
    } else {
      this.isCurrentVoiceSampler = false
      this.synth = new Tone.MonoSynth({
        oscillator: { type: voice.oscType || 'fatsawtooth', spread: 15, count: 2 },
        filter:     { Q: voice.Q || 3, type: 'lowpass', rolloff: -24 },
        envelope:   { attack: voice.attack, decay: voice.decay, sustain: voice.sustain, release: voice.release },
        filterEnvelope: {
          attack: 0.04, decay: 0.15, sustain: 0.35, release: 0.15,
          baseFrequency: 80, octaves: voice.octaves || 2.0,
        },
      } as any)
      this.synth.volume.value = voice.volume
      
      // Connect to Filter -> MonoSub -> Distortion -> Compressor chain
      this.synth.connect(this.filter)
      this.distortion.wet.rampTo(voice.distWet || 0.1, 0.1)
    }

    console.debug(`🎸 Bass voice: ${voice.name} (${this.currentMode})`)
  }

  private volumeMultiplier: number = 1.0

  setCurrentChord(chord: ChordEvent, rootPitchClass: number): void {
    this.tonicPitchClass = rootPitchClass
    const bassPC = getChordBassNote(chord, rootPitchClass)

    const currentOctave = Math.floor(this.rootMidi / 12)
    const newRoot = currentOctave * 12 + bassPC
    const clamped = Math.max(33, Math.min(48, newRoot))

    if (clamped !== this.rootMidi) {
      this.rootMidi = clamped
      this.chordRootPitchClass = bassPC
    }
  }

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    this.setOutputLevel(this.activityLevel)
  }

  private computeTargetLevel(organism: OrganismState): number {
    switch (organism.current) {
      case OState.Dormant:   return 0
      case OState.Awakening: return 0.12 * organism.awakeningProgress
      case OState.Breathing: return 0.60 * organism.breathingWarmth
      case OState.Flow:      return 0.80 + (0.18 * organism.flowDepth)
    }
  }

  private lastRebuildTime: number = 0
  private static readonly MIN_REBUILD_INTERVAL_MS = 500

  private rebuildPart(_physics: PhysicsState): void {
    const now = performance.now()
    if (now - this.lastRebuildTime < BassGenerator.MIN_REBUILD_INTERVAL_MS) return
    this.lastRebuildTime = now
    this.stopPart()

    const notes = this.generateNotes()
    if (notes.length === 0) return

    const events = notes.map(n => ({
      time: n.time,
      note: n.pitch,
      dur:  n.duration,
      vel:  n.velocity,
    }))

    const LAY_BACK_SEC = 0.020

    this.part = new Tone.Part((time, event) => {
      const pocketVelocity = event.vel * Math.max(0.35, 1 - this.currentPocket * 0.45)
      // Use sampler only if fully loaded; otherwise use fallback MonoSynth
      const voice = this.isSamplerReady() ? this.synth : this.fallbackSynth
      voice.triggerAttackRelease(event.note, event.dur, time + LAY_BACK_SEC, pocketVelocity)
    }, events)

    this.part.loop      = true
    this.part.loopEnd   = '4m'
    const startGrid = this.hasStartedPlayback ? '1m' : '16n'
    this.part.start(Tone.getTransport().nextSubdivision(startGrid))
    this.hasStartedPlayback = true
  }

  private generateNotes(): ScheduledNote[] {
    const slideActive = shouldEnableSlide(this.currentBehavior)
    const portTime = getPortamentoTime(this.currentBehavior)
    if (!this.isCurrentVoiceSampler) {
      try {
        (this.synth as any).portamento = slideActive ? portTime : 0
      } catch { /* */ }
    }

    return buildBassNotes(this.currentBehavior, this.rootMidi)
  }

  private startSubBassRise(): void {
    this.stopPart()
    const subMidi = Math.max(28, this.rootMidi - 12)
    const subRoot = Tone.Frequency(subMidi, 'midi').toNote()
    
    if (!this.isCurrentVoiceSampler) {
      (this.synth as Tone.MonoSynth).triggerAttack(subRoot, Tone.now(), 0.01)
      this.synth.volume.rampTo(-14, 2)
    } else {
       // Samplers do not support sustained infinite attacks well, use a long dummy note
       this.synth.triggerAttackRelease(subRoot, '2m', Tone.now(), 0.01)
       this.synth.volume.rampTo(-8, 2)
    }
  }

  private stopPart(): void {
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
    
    try {
      this.synth.volume.cancelScheduledValues(Tone.now())
      if (this.synth instanceof Tone.MonoSynth) {
        this.synth.triggerRelease()
      } else {
        this.synth.releaseAll()
      }
    } catch { /* */ }
  }

  private setOutputLevel(level: number): void {
    const shaped = level * this.arrangementMultiplier * this.volumeMultiplier
    const db = shaped <= 0 ? -Infinity : 20 * Math.log10(Math.max(0.0001, shaped))
    const linear = db === -Infinity ? 0 : Math.pow(10, db / 20)
    if (Math.abs(linear - this.lastOutputGain) < 0.008) return
    this.lastOutputGain = linear
    this.output.gain.cancelScheduledValues(Tone.now())
    this.output.gain.rampTo(linear, 0.35)
  }

  /** Check if the current synth is a sampler AND has finished loading */
  private isSamplerReady(): boolean {
    if (!this.isCurrentVoiceSampler) return false
    return (this.synth as LoadableSampler).isLoaded === true
  }

  dispose(): void {
    this.stopPart()
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
    this.filter.dispose()
    this.monoSub.dispose()
    this.compressor.dispose()
    this.distortion.dispose()
    this.output.dispose()
  }
}
