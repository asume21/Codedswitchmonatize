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
  HIP_HOP_MOTIFS,
  type MelodyMotif,
}                             from './patterns/MelodyPatternLibrary'
import type { ChordEvent }    from './patterns/ChordProgressionBank'
import { getChordTones }      from './patterns/ChordProgressionBank'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import { OState }             from '../state/types'
import { createSoundfontSampler, type LoadableSampler } from '../instruments/SamplerUtils'
import {
  applyArticulation,
  DEFAULT_ARTICULATION_ID,
  defaultMelodyArticulation,
} from '../techniques/articulations'
import type { ArticulationContext } from '../techniques/types'
import { getLivePartStart, quantizeGridTime } from './CompositionClock'
import {
  conformNoteToInstrument,
  selectInstrumentPerformer,
  type InstrumentPerformerId,
  type InstrumentPerformerProfile,
} from '../performers'

export class MelodyGenerator extends GeneratorBase {
  readonly output: Tone.Gain

  private synth: Tone.PolySynth | LoadableSampler
  private part:  Tone.Part | null = null
  // Fallback synth — always available for instant playback while CDN samplers load
  private fallbackSynth: Tone.PolySynth
  private hasStartedPlayback: boolean = false

  // Expression & Phrasing — Tone.Vibrato sits inline in the audio chain so it
  // works for both PolySynth and Sampler sources (PolySynth does not expose a
  // connectable detune AudioParam at the top level).
  private vibrato: Tone.Vibrato

  // Reactive state (Section 05)
  private pitchOffsetSemitones: number = 0
  private volumeMultiplier:     number = 1.0
  private lastOutputGain:       number = 0

  // Musical state
  private rootPitchClass:  number         = 0    // 0-11, detected by ScaleSnapEngine
  private currentBehavior: MelodyBehavior = MelodyBehavior.Rest
  private lastBehavior:    MelodyBehavior = MelodyBehavior.Rest
  private currentScale:    number[]       = MODE_SCALES.glow
  private scaleDirty:      boolean        = false // rebuild phrase on next behavior cycle

  // Chord-awareness — chord tones (pitch classes 0-11) to target on strong beats
  private currentChordTones: number[] = []

  // Physics cache
  private currentPresence: number  = 0
  private voiceActive:     boolean = false
  private flowDepth:       number  = 0

  // Current voice name for debugging/display
  private currentVoiceName: string = 'Default FM'
  private currentPerformer: InstrumentPerformerProfile | null = null
  private explicitPerformerId: InstrumentPerformerId | null = null
  private currentModeName: string = 'glow'

  // Tracked synth dispose timer — prevents zombie synth accumulation
  private pendingSynthDispose: ReturnType<typeof setTimeout> | null = null
  private pendingOldSynth: Tone.PolySynth | LoadableSampler | null = null

  // Genre-aware swing — matches drum/bass swing per mode
  private static readonly MODE_SWING: Record<string, number> = {
    heat: 0.20, gravel: 0.22, smoke: 0.55, ice: 0.48, glow: 0.38,
  }
  private currentSwing: number = 0.35

  // Rebuild throttle — prevent rapid Part rebuilds from overlapping.
  private lastRebuildTime: number = -Infinity
  private static readonly MIN_REBUILD_INTERVAL_MS = 600

  // Behavior debounce — require behavior to be stable for 2 consecutive frames
  private pendingBehavior: MelodyBehavior | null = null
  private pendingBehaviorFrames: number = 0
  private static readonly BEHAVIOR_DEBOUNCE_FRAMES = 2

  // Articulation — per-note transform applied on each Tone.Part callback.
  // Defaults to 'none' (identity pass-through), preserving legacy behavior.
  private currentArticulationId: string = DEFAULT_ARTICULATION_ID
  private articulationOverridden: boolean = false
  private lastModeForArticulation: string = ''

  /** Set articulation. markAsOverride=true locks out mode-default auto-apply. */
  setArticulation(articulationId: string, markAsOverride: boolean = true): void {
    this.currentArticulationId = articulationId
    if (markAsOverride) this.articulationOverridden = true
  }

  /** Clear override so mode defaults can drive articulation again. */
  resetArticulationOverride(): void {
    this.articulationOverridden = false
  }

  getArticulation(): string {
    return this.currentArticulationId
  }

  // ─── Dynamic Global Voices ──────────────────────────────────
  private static readonly GLOBAL_VOICES: Array<{
    name: string; type: 'FM' | 'Synth' | 'Mono' | 'Sampler'; options: any; presetId?: string
    volume: number; chorusWet: number; reverbDecay: number; delayFeedback: number
    tags: string[]
  }> = [
    // Aggressive Trap/Drill
    { name: 'Trap Lead', type: 'FM', options: {
      harmonicity: 3, modulationIndex: 6, oscillator: { type: 'sine' }, modulation: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 },
      modulationEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.3 },
    }, volume: -8, chorusWet: 0.15, reverbDecay: 0.5, delayFeedback: 0.08, tags: ['aggressive', 'electronic'] },
    { name: 'Eerie Bell', type: 'FM', options: {
      harmonicity: 5.07, modulationIndex: 12, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.5 },
      modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0.1, release: 1.0 },
    }, volume: -10, chorusWet: 0.2, reverbDecay: 1.2, delayFeedback: 0.15, tags: ['dark', 'electronic'] },
    
    // Boom Bap / Soulful
    { name: 'Acoustic Piano', type: 'Sampler', presetId: 'acoustic_grand_piano', options: {
      envelope: { attack: 0.005, release: 0.8 }
    }, volume: -5, chorusWet: 0.1, reverbDecay: 1.0, delayFeedback: 0.05, tags: ['acoustic', 'warm', 'soulful'] },
    { name: 'Saxophone', type: 'Sampler', presetId: 'alto_sax', options: {
      envelope: { attack: 0.04, release: 0.25 }
    }, volume: -6, chorusWet: 0.25, reverbDecay: 1.5, delayFeedback: 0.1, tags: ['acoustic', 'warm', 'dark'] },
    
    // Lo-Fi / Cloud Rap
    { name: 'Music Box', type: 'Sampler', presetId: 'marimba', options: {
      envelope: { attack: 0.001, release: 0.8 }
    }, volume: -3, chorusWet: 0.4, reverbDecay: 2.0, delayFeedback: 0.2, tags: ['ethereal', 'chill'] },
    { name: 'Glass Pad', type: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 30 },
      envelope: { attack: 1.5, decay: 1.0, sustain: 0.85, release: 3.0 },
    }, volume: -12, chorusWet: 0.6, reverbDecay: 3.0, delayFeedback: 0.2, tags: ['ethereal', 'dark', 'electronic'] },

    // R&B / Pop Rap
    { name: 'Nylon Guitar', type: 'Sampler', presetId: 'acoustic_guitar_nylon', options: {
      envelope: { attack: 0.005, release: 0.5 }
    }, volume: -4, chorusWet: 0.2, reverbDecay: 1.5, delayFeedback: 0.15, tags: ['acoustic', 'chill', 'soulful'] },
    { name: 'Clean Air', type: 'FM', options: {
      harmonicity: 1, modulationIndex: 0.2, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 1.0, decay: 1.0, sustain: 1.0, release: 3.0 },
    }, volume: -15, chorusWet: 0.4, reverbDecay: 5.0, delayFeedback: 0.3, tags: ['chill', 'ethereal'] },

    // Bowed strings — solo violin (Drake/Alchemist soul), expressive cello
    { name: 'Solo Violin', type: 'Sampler', presetId: 'violin', options: {
      envelope: { attack: 0.08, release: 0.5 }
    }, volume: -6, chorusWet: 0.25, reverbDecay: 1.5, delayFeedback: 0.1, tags: ['acoustic', 'soulful', 'warm'] },
    { name: 'Cello Lead', type: 'Sampler', presetId: 'cello', options: {
      envelope: { attack: 0.1, release: 0.8 }
    }, volume: -7, chorusWet: 0.2, reverbDecay: 1.8, delayFeedback: 0.08, tags: ['acoustic', 'dark', 'soulful'] },

    // Winds — Future Hendrix flute, jazz-rap clarinet, cinematic oboe
    { name: 'Flute', type: 'Sampler', presetId: 'flute', options: {
      envelope: { attack: 0.04, release: 0.3 }
    }, volume: -5, chorusWet: 0.3, reverbDecay: 1.5, delayFeedback: 0.15, tags: ['acoustic', 'ethereal', 'chill'] },
    { name: 'Clarinet', type: 'Sampler', presetId: 'clarinet', options: {
      envelope: { attack: 0.05, release: 0.35 }
    }, volume: -7, chorusWet: 0.2, reverbDecay: 1.2, delayFeedback: 0.1, tags: ['acoustic', 'warm', 'dark'] },
    { name: 'Oboe', type: 'Sampler', presetId: 'oboe', options: {
      envelope: { attack: 0.06, release: 0.4 }
    }, volume: -8, chorusWet: 0.2, reverbDecay: 1.5, delayFeedback: 0.1, tags: ['acoustic', 'dark', 'soulful'] },

    // Brass leads — solo trumpet, trombone, french horn
    { name: 'Trumpet Lead', type: 'Sampler', presetId: 'trumpet', options: {
      envelope: { attack: 0.03, release: 0.25 }
    }, volume: -7, chorusWet: 0.2, reverbDecay: 1.2, delayFeedback: 0.1, tags: ['acoustic', 'aggressive', 'soulful'] },
    { name: 'Trombone Lead', type: 'Sampler', presetId: 'trombone', options: {
      envelope: { attack: 0.06, release: 0.3 }
    }, volume: -8, chorusWet: 0.15, reverbDecay: 1.0, delayFeedback: 0.08, tags: ['acoustic', 'warm', 'dark'] },
    { name: 'French Horn Lead', type: 'Sampler', presetId: 'french_horn', options: {
      envelope: { attack: 0.1, release: 0.6 }
    }, volume: -8, chorusWet: 0.2, reverbDecay: 1.5, delayFeedback: 0.1, tags: ['acoustic', 'warm', 'soulful'] },

    // Guitar leads — clean and distorted single-note lines
    { name: 'Clean Guitar Lead', type: 'Sampler', presetId: 'electric_guitar_clean', options: {
      envelope: { attack: 0.005, release: 0.3 }
    }, volume: -8, chorusWet: 0.25, reverbDecay: 1.0, delayFeedback: 0.12, tags: ['acoustic', 'warm', 'chill'] },
    { name: 'Dist Guitar Lead', type: 'Sampler', presetId: 'distortion_guitar', options: {
      envelope: { attack: 0.005, release: 0.25 }
    }, volume: -12, chorusWet: 0.1, reverbDecay: 0.8, delayFeedback: 0.1, tags: ['aggressive', 'electronic'] },

    // Mallet & keys leads
    { name: 'Vibes Lead', type: 'Sampler', presetId: 'vibraphone', options: {
      envelope: { attack: 0.005, release: 1.2 }
    }, volume: -5, chorusWet: 0.3, reverbDecay: 1.8, delayFeedback: 0.15, tags: ['ethereal', 'chill', 'soulful'] },
    { name: 'Rhodes Lead', type: 'Sampler', presetId: 'electric_piano_1', options: {
      envelope: { attack: 0.005, release: 0.6 }
    }, volume: -6, chorusWet: 0.4, reverbDecay: 1.2, delayFeedback: 0.1, tags: ['warm', 'soulful', 'chill'] },

    // Cascading & exotic
    { name: 'Harp Lead', type: 'Sampler', presetId: 'orchestral_harp', options: {
      envelope: { attack: 0.005, release: 1.2 }
    }, volume: -5, chorusWet: 0.45, reverbDecay: 2.5, delayFeedback: 0.2, tags: ['ethereal', 'chill'] },
    { name: 'Sitar Lead', type: 'Sampler', presetId: 'sitar', options: {
      envelope: { attack: 0.005, release: 0.8 }
    }, volume: -7, chorusWet: 0.4, reverbDecay: 1.5, delayFeedback: 0.18, tags: ['ethereal', 'dark'] },
  ]

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

    // Fallback synth — always connected, used when a sampler hasn't loaded yet
    this.fallbackSynth = this.buildDefaultSynth()
    this.fallbackSynth.volume.value = -9

    // Vibrato — inline pitch modulation between synths and chorus. Depth is
    // ramped from setPerformerFeatures based on performer energy.
    this.vibrato = new Tone.Vibrato({ frequency: 5, depth: 0 })

    this.chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.4, wet: 0.3 })

    this.dryBus     = new Tone.Gain(0.80)
    this.delaySend  = new Tone.Gain(0.10)
    this.reverbSend = new Tone.Gain(0.08)
    this.delay  = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.12, wet: 1.0 })
    this.reverb = new Tone.Reverb({ decay: 0.8, wet: 1.0 })

    this.delayReturnHP  = new Tone.Filter({ type: 'highpass', frequency: 300, rolloff: -12 })
    this.reverbReturnHP = new Tone.Filter({ type: 'highpass', frequency: 250, rolloff: -12 })

    this.synth.connect(this.vibrato)
    this.fallbackSynth.connect(this.vibrato)
    this.vibrato.connect(this.chorus)
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

  private lastPerformerEnergy: number = 0.5
  private lastPerformerBrightness: number = 0.5
  private lastPerformerSyllabicRate: number = 4
  // Section behavior override — set by arrangement to control melody density per section.
  // null = use normal getMelodyBehavior() logic
  private sectionBehavior: MelodyBehavior | null = null

  setPerformerFeatures(energy: number, brightness: number, syllabicRate: number): void {
    this.lastPerformerEnergy = energy
    this.lastPerformerBrightness = brightness
    this.lastPerformerSyllabicRate = syllabicRate
  }

  setInstrumentPerformer(instrumentId: InstrumentPerformerId | null): void {
    this.explicitPerformerId = instrumentId
    this.applyModeVoice(this.currentModeName)
    if (this.lastOutputGain > 0) this.scaleDirty = true
  }

  /**
   * Called by the orchestrator on each arrangement section change.
   * Sets the melody behavior (density) appropriate for the section:
   *   intro/breakdown → Rest (melody plays alone or drops out — drums carry the space)
   *   verse           → Hint (short fills, leaves room for the rapper)
   *   build/drop/drop2 → Lead (full phrase, melody is front and center)
   *
   * The lead instrument DOES NOT change — it is the signature of the beat.
   */
  onSectionChange(sectionName: string): void {
    if (sectionName === 'verse') {
      // Verse: sparse fills only — leaves space for the rapper
      this.sectionBehavior = MelodyBehavior.Hint
    } else {
      // All other sections: let normal getMelodyBehavior() logic run
      // (responds to voice activity, flow depth, physics mode)
      this.sectionBehavior = null
    }
  }

  /**
   * Intelligently picks from GLOBAL_VOICES based on performer features
   * (Aggressive rap = 808s/pianos, softer = rhodes/pads)
   */
  private applyModeVoice(mode: string): void {
    {
    const performer = selectInstrumentPerformer({
      role: 'lead',
      mode,
      energy: this.lastPerformerEnergy,
      brightness: this.lastPerformerBrightness,
      explicitId: this.explicitPerformerId ?? undefined,
    })
    this.currentPerformer = performer
    this.currentVoiceName = performer.name

    if (!this.articulationOverridden) {
      this.currentArticulationId = performer.defaultLeadArticulation
      this.lastModeForArticulation = mode
    }

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

    this.synth = createSoundfontSampler(
      performer.samplerPreset,
      performer.envelope,
      performer.volume,
    )
    this.synth.connect(this.vibrato)
    this.chorus.wet.rampTo(performer.family === 'wind' || performer.family === 'bowed' ? 0.28 : 0.18, 0.5)
    this.reverb.decay = performer.family === 'wind' || performer.family === 'bowed' ? 1.6 : 1.0
    this.delay.feedback.rampTo(performer.family === 'plucked' ? 0.12 : 0.08, 0.5)

    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.debug(`Melody performer: ${performer.name}`)
    }
    }
  }

  processFrame(physics: PhysicsState, organism: OrganismState): void {
    this.currentPresence = physics.presence
    this.voiceActive     = physics.voiceActive
    this.flowDepth       = organism.flowDepth
    this.currentSwing    = MelodyGenerator.MODE_SWING[physics.mode.toString()] ?? 0.35
    this.currentModeName = physics.mode.toString()

    // Auto-apply mode-default articulation if user/warmup hasn't overridden it.
    const modeStr = physics.mode.toString()
    if (!this.articulationOverridden && modeStr !== this.lastModeForArticulation) {
      this.currentArticulationId = defaultMelodyArticulation(modeStr)
      this.lastModeForArticulation = modeStr
    }

    // Section behavior overrides normal behavior logic so the arrangement
    // can enforce Rest in intro/breakdown and Hint in verse regardless of
    // voice energy — the drums and space ARE the arrangement in those sections.
    const newBehavior = this.sectionBehavior !== null
      ? this.sectionBehavior
      : getMelodyBehavior(physics.mode, physics.voiceActive, organism.flowDepth)

    let shouldRebuild = false
    if (newBehavior !== this.currentBehavior) {
      if (this.pendingBehavior === newBehavior) {
        this.pendingBehaviorFrames++
        if (this.pendingBehaviorFrames >= MelodyGenerator.BEHAVIOR_DEBOUNCE_FRAMES) {
          this.lastBehavior    = this.currentBehavior
          this.currentBehavior = newBehavior
          this.pendingBehavior = null
          this.pendingBehaviorFrames = 0
          shouldRebuild = true
        }
      } else {
        this.pendingBehavior = newBehavior
        this.pendingBehaviorFrames = 1
      }
    } else {
      this.pendingBehavior = null
      this.pendingBehaviorFrames = 0
    }

    if (this.scaleDirty) {
      this.scaleDirty = false
      shouldRebuild = true
    }

    if (shouldRebuild) {
      this.rebuildPhrase(physics, organism)
    }

    const targetLevel = this.computeTargetLevel(organism, newBehavior)
    this.activityLevel += this.smoothingCoeff(100) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)

    // Update Phrasing: Vibrato depth scales with performer energy.
    // Tone.Vibrato.depth is 0–1; cap around 0.06 so high energy adds breath
    // without sounding seasick.
    this.vibrato.depth.rampTo(this.lastPerformerEnergy * 0.06, 0.4)
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (to === OState.Dormant || to === OState.Awakening) {
      this.stopPart()
      this.activityLevel = 0
      return
    }
    if (to === OState.Breathing || to === OState.Flow) {
      this.currentScale = MODE_SCALES[physics.mode] ?? MODE_SCALES.glow
      this.applyModeVoice(physics.mode.toString())
      // Immediately build a phrase so melody plays from beat 1.
      // Without this, processFrame's debounce delays the first notes by 3+ frames.
      const startBehavior = to === OState.Flow ? MelodyBehavior.Lead : MelodyBehavior.Hint
      if (this.currentBehavior === MelodyBehavior.Rest || this.part === null) {
        this.currentBehavior = startBehavior
        this.lastRebuildTime = -Infinity // clear throttle so rebuild goes through
        this.rebuildPhrase(physics, {
          current: to,
          flowDepth: to === OState.Flow ? 0.5 : 0,
          breathingWarmth: 0.8,
        } as any)
      }
    }
  }

  reset(): void {
    this.stopPart()
    this.activityLevel   = 0
    this.currentBehavior = MelodyBehavior.Rest
    this.currentScale    = MODE_SCALES.glow
    this.hasStartedPlayback = false
    this.lastRebuildTime = -Infinity
    this.sectionBehavior = null
    this.setOutputLevel(0)
  }

  applyPitchOffset(semitones: number): void {
    this.pitchOffsetSemitones = Math.round(semitones)
  }

  setRootAndScale(rootPitchClass: number, intervals: number[]): void {
    const newRoot  = ((rootPitchClass % 12) + 12) % 12
    const changed  = newRoot !== this.rootPitchClass
                  || JSON.stringify(intervals) !== JSON.stringify(this.currentScale)
    if (!changed) return
    this.rootPitchClass = newRoot
    this.currentScale   = intervals
    this.scaleDirty     = true
  }

  setCurrentChord(chord: ChordEvent, rootPitchClass: number): void {
    // Keep rootPitchClass in sync so buildPhrase generates notes in the right key
    this.rootPitchClass = rootPitchClass
    this.currentChordTones = getChordTones(chord, rootPitchClass)
    // Dynamic harmonic flow: when chord changes, auto-rebuild phrase to match
    this.scaleDirty = true
  }

  applyVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, multiplier)
    this.setOutputLevel(this.activityLevel)
  }

  private computeTargetLevel(organism: OrganismState, behavior: MelodyBehavior): number {
    if (organism.current === OState.Dormant)   return 0
    if (organism.current === OState.Awakening) return 0
    if (behavior === MelodyBehavior.Rest)      return 0

    switch (behavior) {
      case MelodyBehavior.Hint:    return 0.35 * organism.breathingWarmth
      case MelodyBehavior.Respond: return 0.60 + (0.15 * organism.flowDepth)
      case MelodyBehavior.Lead:    return 0.75 + (0.20 * organism.flowDepth)
      default:                     return 0
    }
  }

  private rebuildPhrase(physics: PhysicsState, _organism: OrganismState): void {
    const now = performance.now()
    if (now - this.lastRebuildTime < MelodyGenerator.MIN_REBUILD_INTERVAL_MS) return
    this.lastRebuildTime = now

    this.stopPart()

    if (this.currentBehavior === MelodyBehavior.Rest) return

    const lengths = PHRASE_LENGTHS[this.currentBehavior]
    if (!lengths || lengths.length === 0) return

    const phraseLength = lengths[Math.floor(Math.random() * lengths.length)]
    const notes        = this.generatePhrase(phraseLength, physics)

    if (notes.length === 0) return

    this.part = new Tone.Part((time, event) => {
      const presenceDuck = Math.max(0.3, 1 - this.currentPresence * 0.5)
      const voice = this.isSamplerReady() ? this.synth : this.fallbackSynth
      const finalVel = event.vel * presenceDuck
      const playableNote = this.currentPerformer
        ? conformNoteToInstrument(event.note, this.currentPerformer)
        : event.note

      // Fast-path: default articulation skips the transform for zero overhead.
      if (this.currentArticulationId === DEFAULT_ARTICULATION_ID) {
        voice.triggerAttackRelease(playableNote, event.dur, time, finalVel)
        return
      }

      // Decode sixteenthPos from event.time (bar:beat:sub) for articulation context.
      const timeStr = String(event.time ?? '0:0:0')
      const parts = timeStr.split(':')
      const beat = parseFloat(parts[1] ?? '0')
      const sub  = parseFloat(parts[2] ?? '0')
      const sixteenthPos = Math.floor(beat * 4 + sub) % 16
      const isDownbeat = sixteenthPos % 4 === 0

      const artCtx: ArticulationContext = {
        tempo: Tone.getTransport().bpm.value || 90,
        energy: Math.max(0, Math.min(1, finalVel)),
        isDownbeat,
        sixteenthPos,
      }

      const scheduled = applyArticulation(
        this.currentArticulationId,
        playableNote,
        event.dur,
        finalVel,
        artCtx
      )
      for (const n of scheduled) {
        // Guard against negative pre-beat offsets if we'd schedule in the past.
        const t = Math.max(time + n.timeOffset, time - 0.02)
        voice.triggerAttackRelease(n.note, n.duration, t, n.velocity)
      }
    }, notes.map(n => ({ time: quantizeGridTime(n.time, Math.ceil(phraseLength / 16)), note: n.pitch, dur: n.duration, vel: n.velocity })))

    this.part.loop    = true
    this.part.loopEnd = `${phraseLength}i`
    this.part.start(getLivePartStart(this.hasStartedPlayback))
    this.hasStartedPlayback = true
  }

  private generatePhrase(length16ths: number, physics: PhysicsState): ScheduledNote[] {
    const notes: ScheduledNote[] = []
    const octaves = MODE_OCTAVES[physics.mode] ?? [4, 5]
    
    // Deterministic octave based on mode hash
    const modeHash = physics.mode.toString().length
    const octave  = octaves[0] + (modeHash % (octaves[1] - octaves[0] + 1))
    
    const isHint  = this.currentBehavior === MelodyBehavior.Hint

    // CALL & RESPONSE: Deterministic selection based on chord root
    const chordSeed = (this.rootPitchClass + (this.currentChordTones[0] ?? 0)) % 10
    
    let motifBank: MelodyMotif[] = HIP_HOP_MOTIFS.ostinatos
    if (!this.voiceActive) {
      motifBank = chordSeed > 5 ? HIP_HOP_MOTIFS.arps : HIP_HOP_MOTIFS.fills
    }
    
    // Pick a motif shape deterministically
    const motifIdx = chordSeed % motifBank.length
    const motif = motifBank[motifIdx]

    // Map `this.currentChordTones` (0-11 pitch classes) to scale indices dynamically
    const chordDegs: number[] = []
    if (this.currentChordTones.length > 0) {
      for (let d = 0; d < this.currentScale.length; d++) {
        const pc = (this.rootPitchClass + this.currentScale[d]) % 12
        if (this.currentChordTones.includes(pc)) {
          chordDegs.push(d)
        }
      }
    }
    // Fallback if no chord info: use 0, 2, 4 (root, 3rd, 5th of scale)
    if (chordDegs.length === 0) {
      chordDegs.push(0, 2, 4)
    }

    const renderMotif = (m: MelodyMotif, cursorStart: number, transposeOct: number) => {
      const out: ScheduledNote[] = []
      let c = cursorStart
      for (const step of m.steps) {
        if (c >= length16ths) break
        
        let degIndex = 0
        if (step.isChordTone) {
           // Map 0,1,2 to actual scale degrees of the current chord tones
           const chordToneIndex = step.index % chordDegs.length
           const octOffset = Math.floor(step.index / chordDegs.length)
           degIndex = chordDegs[chordToneIndex] + (octOffset * this.currentScale.length)
        } else {
           // Just a relative scale degree
           degIndex = chordDegs[0] + step.index
        }

        const normDeg = degIndex % this.currentScale.length
        const octMidiOffset = Math.floor(degIndex / this.currentScale.length) * 12
        const semitone = this.currentScale[normDeg]
        
        const midi = ((octave + transposeOct) * 12) + 12 + semitone + octMidiOffset + this.rootPitchClass + this.pitchOffsetSemitones
        const pitch = Tone.Frequency(midi, 'midi').toNote()
        
        const durStr = step.dur16ths <= 1 ? '16n'
                     : step.dur16ths <= 2 ? '8n'
                     : step.dur16ths <= 3 ? '8n.'
                     : step.dur16ths <= 4 ? '4n'
                     : step.dur16ths <= 6 ? '4n.'
                     : '2n'
        
        const bar  = Math.floor(c / 16)
        const beat = Math.floor((c % 16) / 4)
        const sub  = c % 4
        const time = `${bar}:${beat}:${sub}`
        
        const accentBase = sub === 0 ? 0.78 : sub === 2 ? 0.60 : 0.42
        
        // Deterministic velocity seeded by position and energy
        const seed = (bar * 16) + (beat * 4) + sub
        const hash = Math.sin(seed * 9.87) * 1000
        const pseudoRand = hash - Math.floor(hash)
        
        const vel = Math.min(1, Math.max(0.15, (accentBase * this.lastPerformerEnergy) + (pseudoRand - 0.5) * 0.12))
        
        out.push({ pitch, duration: durStr, velocity: vel, time })
        c += step.dur16ths
      }
      return { out, newCursor: c }
    }

    let cursor = 0
    const restLen = isHint ? 8 : 4

    // Render hook
    let result = renderMotif(motif, cursor, 0)
    notes.push(...result.out)
    cursor = result.newCursor + restLen

    return notes
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
    const shaped = level * this.arrangementMultiplier * Math.min(2, this.volumeMultiplier)
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
    if (this.pendingSynthDispose) {
      clearTimeout(this.pendingSynthDispose)
      this.pendingSynthDispose = null
    }
    if (this.pendingOldSynth) {
      try { this.pendingOldSynth.disconnect() } catch { /* */ }
      try { this.pendingOldSynth.dispose() } catch { /* */ }
      this.pendingOldSynth = null
    }
    this.vibrato.dispose()
    this.synth.dispose()
    this.fallbackSynth.dispose()
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
