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
// ChordProgressionBank is no longer a direct dependency — Melody pulls
// scale + chord-tones via the Conductor (Phase 4 wiring in constructor).
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
import { getConductor } from '../conductor/Conductor'

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

  // Chord-awareness — chord tones (pitch classes 0-11) to target on strong beats.
  // Sourced from the Conductor (Phase 3 wiring); the legacy setCurrentChord
  // external API stays as an override path.
  private currentChordTones: number[] = []
  private unsubscribeConductor: (() => void) | null = null

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
  private static readonly LEAD_GAIN_BOOST_DB = 5

  // Behavior debounce — require behavior to be stable for 2 consecutive frames
  private pendingBehavior: MelodyBehavior | null = null
  private pendingBehaviorFrames: number = 0
  private static readonly BEHAVIOR_DEBOUNCE_FRAMES = 2

  // Articulation — per-note transform applied on each Tone.Part callback.
  // Defaults to 'none' (identity pass-through), preserving legacy behavior.
  private currentArticulationId: string = DEFAULT_ARTICULATION_ID
  private articulationOverridden: boolean = false
  private lastModeForArticulation: string = ''

  // ── Emotional Intent ─────────────────────────────────────────────
  // Layered on top of scale/mode selection. `null` is neutral (no overrides).
  // 'sad' / 'melancholy': natural-minor bias, velocity clamped 0.4-0.6, legato.
  // 'beautiful' / 'lush': chord-tone bias toward 7ths and 9ths, soft velocity.
  // The orchestrator handles cross-generator routing (e.g. piano-rolled-chord
  // technique for 'beautiful'); this field shapes single-note melody output.
  static readonly NATURAL_MINOR: number[]  = [0, 2, 3, 5, 7, 8, 10]
  static readonly HARMONIC_MINOR: number[] = [0, 2, 3, 5, 7, 8, 11]
  private emotionalIntent: 'sad' | 'beautiful' | null = null

  setEmotionalIntent(intent: 'sad' | 'beautiful' | null): void {
    if (this.emotionalIntent === intent) return
    this.emotionalIntent = intent
    if (intent === 'sad') {
      // Force natural minor against the current root so phrases inherit the
      // melancholy tonality on the next rebuild.
      this.currentScale = MelodyGenerator.NATURAL_MINOR
    }
    this.scaleDirty = true                       // rebuild on next processFrame
    this.lastRebuildTime = -Infinity             // clear 600ms throttle — user
                                                 // emotional commits must take
                                                 // effect immediately, not get
                                                 // silently consumed by a recent
                                                 // chord-change-triggered rebuild
  }

  getEmotionalIntent(): 'sad' | 'beautiful' | null {
    return this.emotionalIntent
  }

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

    // Bowed strings — solo violin (Drake/Alchemist soul), expressive cello.
    // Pro-violin envelope: longer bow-on-string attack (~200ms) + sustained
    // 1.5s release tail = legato phrasing instead of staccato note-stabs.
    // Higher chorusWet (~0.45) adds the lush ensemble shimmer real solo
    // violins get in studio production via stereo doubling.
    { name: 'Solo Violin', type: 'Sampler', presetId: 'violin', options: {
      envelope: { attack: 0.20, release: 1.5 }
    }, volume: 1, chorusWet: 0.45, reverbDecay: 2.5, delayFeedback: 0.12, tags: ['acoustic', 'soulful', 'warm'] },
    { name: 'Cello Lead', type: 'Sampler', presetId: 'cello', options: {
      envelope: { attack: 0.22, release: 1.8 }
    }, volume: 0, chorusWet: 0.40, reverbDecay: 2.8, delayFeedback: 0.10, tags: ['acoustic', 'dark', 'soulful'] },

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

    // Baseline lifted from -9 to -5 dB (~4 dB hotter, ~58% louder perceived).
    // The lower trim left solo leads sounding thin once drums were muted, since
    // there is no master compressor in the generator graph to make up gain.
    // selfListenGainCorrection still clamps down to 0.6× if the full mix clips.
    this.synth = this.buildDefaultSynth()
    this.synth.volume.value = this.boostLeadGainDb(-5)

    // Fallback synth — always connected, used when a sampler hasn't loaded yet
    this.fallbackSynth = this.buildDefaultSynth()
    this.fallbackSynth.volume.value = this.boostLeadGainDb(-5)

    // Vibrato — inline pitch modulation between synths and chorus. Depth is
    // ramped from setPerformerFeatures based on performer energy.
    this.vibrato = new Tone.Vibrato({ frequency: 5, depth: 0 })

    this.chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.4, wet: 0.3 })

    // Dry bus lifted from 0.80 to 1.0 (+1.9 dB) so the unwet melody sits at
    // unity through the wet/dry sum. Send levels unchanged — the wet returns
    // come back through their own filters and have their own perceived loudness.
    this.dryBus     = new Tone.Gain(1.0)
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

    // Phase 3 — lock to the Conductor. Initial key/scale/chord-tones come from
    // the Conductor at construction (no rebuild needed — there is no part
    // yet), and every chord change re-syncs them so melody picks idiomatic
    // passing notes and lands chord tones on strong beats. The 'sad'
    // emotional override still wins over the Conductor's scale — it's a
    // deliberate user intent.
    this.syncFromConductor(false)
    this.unsubscribeConductor = getConductor().onChordChange(() => {
      this.syncFromConductor(true)
    })
  }

  private syncFromConductor(triggerRebuild: boolean): void {
    const conductor = getConductor()
    this.rootPitchClass = conductor.getKeyPitchClass()
    if (this.emotionalIntent !== 'sad') {
      this.currentScale = conductor.scaleIntervals()
    }
    // Conductor returns chord tones as MIDI notes (e.g. [60, 63, 67, 70] for
    // Cm7). Melody matches in pitch classes (0-11), octave-invariant.
    const tones = conductor.chordTones()
    const pcs: number[] = []
    for (const midi of tones) {
      const pc = ((midi % 12) + 12) % 12
      if (!pcs.includes(pc)) pcs.push(pc)
    }
    this.currentChordTones = pcs
    if (triggerRebuild) this.scaleDirty = true
  }

  private buildDefaultSynth(): Tone.PolySynth {
    // 6 voices dropped notes when ornaments (trill/grace) overlapped a sustained
    // legato phrase. 12 covers the realistic worst case without bloating CPU.
    return new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 12,
      harmonicity: 2,
      modulationIndex: 1.5,
      oscillator:    { type: 'sine' },
      modulation:    { type: 'triangle' },
      envelope:      { attack: 0.08, decay: 0.3, sustain: 0.35, release: 1.2 },
      modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.3, release: 0.8 },
    } as any)
  }

  private boostLeadGainDb(db: number): number {
    return Math.min(2, db + MelodyGenerator.LEAD_GAIN_BOOST_DB)
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
   * Sets the melody behavior (density) appropriate for the section.
   *
   * Previously verses forced Behavior.Hint ("sparse fills only — leaves
   * space for the rapper") which was correct for rap-with-vocals but felt
   * broken when the user is *not* actively rapping — melody just disappears.
   *
   * New approach: let getMelodyBehavior() decide for every section. It
   * already responds to voice activity (drops density when the rapper is
   * talking) and flow depth, so vocals get their space dynamically rather
   * than via a blanket per-section override.
   *
   * The lead instrument DOES NOT change — it is the signature of the beat.
   */
  onSectionChange(_sectionName: string): void {
    // Let normal getMelodyBehavior() logic run for every section —
    // responds to voice activity, flow depth, and physics mode.
    this.sectionBehavior = null
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
      this.boostLeadGainDb(performer.volume),
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

    // Defer scaleDirty clear until rebuildPhrase reports success. Without this
    // guard, the 600ms throttle inside rebuildPhrase can silently consume a
    // user-initiated scale/intent change: scaleDirty gets cleared here, then
    // rebuildPhrase early-returns due to throttle, and the signal is lost
    // forever — the melody keeps playing the old scale's pre-baked notes.
    const scaleWasDirty = this.scaleDirty
    if (scaleWasDirty) shouldRebuild = true

    if (shouldRebuild) {
      const rebuilt = this.rebuildPhrase(physics, organism)
      if (rebuilt && scaleWasDirty) this.scaleDirty = false
    }

    const targetLevel = this.computeTargetLevel(organism, newBehavior)
    this.activityLevel += this.smoothingCoeff(100) * (targetLevel - this.activityLevel)
    this.setOutputLevel(this.activityLevel)

    // Update Phrasing: Vibrato depth scales with performer energy.
    // Tone.Vibrato.depth is 0–1; cap around 0.06 so high energy adds breath
    // without sounding seasick.
    this.vibrato.depth.rampTo(this.lastPerformerEnergy * 0.06, 0.4)
  }

  private enabled: boolean = true

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.reset()
  }

  onStateTransition(to: OState, physics: PhysicsState): void {
    if (!this.enabled) return
    if (to === OState.Dormant || to === OState.Awakening) {
      this.stopPart()
      this.activityLevel = 0
      return
    }
    if (to === OState.Breathing || to === OState.Flow) {
      this.currentScale = MODE_SCALES[physics.mode] ?? MODE_SCALES.glow
      
      // Only re-apply voice if the mode has changed to prevent glitchy 
      // audio dropouts during rapid state transitions.
      const newMode = physics.mode.toString()
      if (newMode !== this.currentModeName || !this.synth) {
        this.applyModeVoice(newMode)
      }

      // Immediately build a phrase so melody plays from beat 1.
      // Without this, processFrame's debounce delays the first notes by 3+ frames.
      const startBehavior = to === OState.Flow ? MelodyBehavior.Lead : MelodyBehavior.Hint
      
      // Always clear throttle and rebuild if we are entering a behavior that 
      // should produce sound, or if we are currently silent.
      if (this.currentBehavior !== startBehavior || this.part === null) {
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

  // setCurrentChord(chord, rootPC) was removed in Phase 4 — Conductor is the
  // sole chord source. Melody reads its scale, key, and chord-tones via the
  // conductor.onChordChange subscription in the constructor (syncFromConductor).

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

  /**
   * Build and schedule the next melodic phrase.
   *
   * Returns `true` if the rebuild executed (phrase committed, or intentional
   * Rest stop). Returns `false` ONLY when the 600ms throttle blocked execution
   * — `processFrame` uses this to preserve `scaleDirty` so user-initiated
   * emotional/scale changes are not silently consumed by the throttle race.
   *
   * The seamless handoff (oldPart.stop(startAt) → new part.start(startAt))
   * guarantees the previous Tone.Part is fully stopped and disposed before
   * the new one fires its first event — there is no event overlay on a
   * running buffer.
   */
  private rebuildPhrase(physics: PhysicsState, _organism: OrganismState): boolean {
    const now = performance.now()
    if (now - this.lastRebuildTime < MelodyGenerator.MIN_REBUILD_INTERVAL_MS) {
      return false   // throttled — caller should preserve any pending dirty flags
    }
    this.lastRebuildTime = now

    if (this.currentBehavior === MelodyBehavior.Rest) {
      this.stopPart()
      return true    // intentional stop — dirty flags can be cleared
    }

    const lengths = PHRASE_LENGTHS[this.currentBehavior]
    if (!lengths || lengths.length === 0) return true

    const selectedLength = lengths[Math.floor(Math.random() * lengths.length)]
    const phraseLength = this.currentBehavior === MelodyBehavior.Lead
      ? Math.max(16, selectedLength)
      : selectedLength
    const notes        = this.generatePhrase(phraseLength, physics)

    if (notes.length === 0) return true

    const startAt = getLivePartStart(this.hasStartedPlayback)

    // Seamless handoff: schedule old Part to stop exactly when the new one
    // starts so there is no silence gap on section changes. If transport is
    // not running (first build), stop the old part immediately.
    const transport = Tone.getTransport()
    const oldPart = this.part
    if (oldPart) {
      if (transport.state === 'started' && this.hasStartedPlayback && typeof startAt === 'number' && startAt > 0) {
        oldPart.stop(startAt)
        const msUntilStart = (startAt - Tone.getContext().currentTime) * 1000
        window.setTimeout(() => oldPart.dispose(), Math.max(50, msUntilStart + 100))
      } else {
        oldPart.stop()
        oldPart.dispose()
      }
    }
    this.part = null

    const loopBars = Math.max(1, Math.ceil(phraseLength / 16))

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
    }, notes.map(n => ({ time: quantizeGridTime(n.time, loopBars), note: n.pitch, dur: n.duration, vel: n.velocity })))

    this.part.loop    = true
    this.part.loopEnd = `${loopBars}m`
    this.part.start(startAt)
    this.hasStartedPlayback = true
    return true
  }

  private generatePhrase(length16ths: number, physics: PhysicsState): ScheduledNote[] {
    const notes: ScheduledNote[] = []
    const octaves = MODE_OCTAVES[physics.mode] ?? [4, 5]
    
    // Deterministic octave based on mode hash
    const modeHash = physics.mode.toString().length
    const octave  = octaves[0] + (modeHash % (octaves[1] - octaves[0] + 1))
    
    const isHint  = this.currentBehavior === MelodyBehavior.Hint
    const velocityEnergy = this.voiceActive
      ? this.lastPerformerEnergy
      : Math.max(0.75, this.lastPerformerEnergy)

    // CALL & RESPONSE: Deterministic selection based on chord root and absolute bar
    const currentBar = getConductor().getScoreFrame().bar
    const chordSeed = (this.rootPitchClass + (this.currentChordTones[0] ?? 0) + currentBar) % 10
    
    let motifBank: MelodyMotif[] = HIP_HOP_MOTIFS.ostinatos
    if (!this.voiceActive) {
      motifBank = chordSeed > 5 ? HIP_HOP_MOTIFS.arps : HIP_HOP_MOTIFS.fills
    }
    
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

    // 'beautiful' intent: bias chord-tone selection toward 7ths (degree 6)
    // and 9ths (degree 8 — i.e. the 2nd up an octave). These tensions are
    // what give Maj7 / min9 voicings their lush character. We append rather
    // than replace so the existing chord-tone framework is preserved.
    if (this.emotionalIntent === 'beautiful') {
      chordDegs.push(6, 8)
    }

    const performer = this.currentPerformer
    const isBowedLead = performer?.family === 'bowed'
    const melodicOctave = isBowedLead
      ? Math.min(octaves[1], Math.max(octaves[0], (performer?.preferredOctave ?? octave + 1) - 1))
      : octave

    const degreeToPitch = (degIndex: number, transposeOct: number = 0): string => {
      const normDeg = ((degIndex % this.currentScale.length) + this.currentScale.length) % this.currentScale.length
      const octMidiOffset = Math.floor(degIndex / this.currentScale.length) * 12
      const semitone = this.currentScale[normDeg]
      const midi = ((melodicOctave + transposeOct) * 12) + 12 + semitone + octMidiOffset + this.rootPitchClass + this.pitchOffsetSemitones
      return Tone.Frequency(midi, 'midi').toNote()
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

        const pitch = degreeToPitch(degIndex, transposeOct)
        
        // 'sad' intent: bump duration one notch toward legato (16n→8n,
        // 8n→8n., 4n→4n.) so phrases breathe and ring out rather than chop.
        // Other intents keep the natural rhythmic feel of the motif.
        const sadLegato = this.emotionalIntent === 'sad'
        const durStr = sadLegato
          ? (step.dur16ths <= 1 ? '8n'
            : step.dur16ths <= 2 ? '8n.'
            : step.dur16ths <= 3 ? '4n'
            : step.dur16ths <= 4 ? '4n.'
            : step.dur16ths <= 6 ? '2n'
            : '2n.')
          : (step.dur16ths <= 1 ? '16n'
            : step.dur16ths <= 2 ? '8n'
            : step.dur16ths <= 3 ? '8n.'
            : step.dur16ths <= 4 ? '4n'
            : step.dur16ths <= 6 ? '4n.'
            : '2n')

        const bar  = Math.floor(c / 16)
        const beat = Math.floor((c % 16) / 4)
        const sub  = c % 4
        const time = `${bar}:${beat}:${sub}`

        const accentBase = sub === 0 ? 0.78 : sub === 2 ? 0.60 : 0.42

        // Deterministic velocity seeded by position and energy
        const seed = (bar * 16) + (beat * 4) + sub
        const hash = Math.sin(seed * 9.87) * 1000
        const pseudoRand = hash - Math.floor(hash)

        let vel = Math.min(1, Math.max(0.22, (accentBase * velocityEnergy) + (pseudoRand - 0.5) * 0.12))

        // Emotional-intent velocity shaping. Applied after the deterministic
        // hash so the per-position pseudo-random texture is preserved, just
        // mapped into a different dynamic range.
        if (this.emotionalIntent === 'sad') {
          // Clamp to [0.4, 0.6] for the soft, contained dynamics of a
          // melancholy phrase. Width 0.2 keeps subtle accents alive.
          vel = 0.4 + (pseudoRand * 0.2)
        } else if (this.emotionalIntent === 'beautiful') {
          // Lush ceiling at 0.7, floor at 0.45 — soft and singing, never harsh.
          vel = 0.45 + (pseudoRand * 0.25)
        }

        out.push({ pitch, duration: durStr, velocity: vel, time })
        c += step.dur16ths
      }
      return { out, newCursor: c }
    }

    let cursor = 0
    let phraseIndex = 0
    const restLen = isHint ? 6 : this.currentBehavior === MelodyBehavior.Respond ? 3 : 2
    const maxIterations = Math.max(4, Math.ceil(length16ths / 2))

    while (cursor < length16ths && phraseIndex < maxIterations) {
      const motifIdx = (chordSeed + phraseIndex) % motifBank.length
      const motif = motifBank[motifIdx]
      const transposeOct = this.currentBehavior === MelodyBehavior.Lead && phraseIndex % 4 === 3 ? 1 : 0
      const result = renderMotif(motif, cursor, transposeOct)

      notes.push(...result.out)

      const nextCursor = result.newCursor + restLen
      if (nextCursor <= cursor) break
      cursor = nextCursor
      phraseIndex += 1
    }

    if (this.currentBehavior === MelodyBehavior.Lead && notes.length <= 3 && length16ths >= 12) {
      const answerMotif = motifBank[(chordSeed + 1) % motifBank.length]
      notes.push(...renderMotif(answerMotif, Math.floor(length16ths / 2), 0).out)
    }

    // Safety net: if the generated phrase collapsed to a single pitch (motif
    // step.index aligned with chordDegs[0] for every step, or chord-tone
    // mapping returned only the root), fall back to a deterministic 4-bar
    // minor contour. Without this guard the listener can hear the engine
    // stuck on a single repeating note while the rest of the mix keeps moving.
    const uniquePitches = new Set(notes.map(n => n.pitch))
    if (uniquePitches.size <= 1) {
      return this.defaultMinorContour(length16ths, melodicOctave)
    }

    return notes
  }

  /**
   * Deterministic 4-bar (or shorter) minor contour:
   *   root – ♭3 – 5 – ♭7 – 5 – ♭3 – root
   * Used when the motif renderer collapses to a single repeated pitch.
   * Always plays in natural minor relative to the current rootPitchClass so
   * the contour fits with whatever harmony the chord generator is on.
   */
  private defaultMinorContour(length16ths: number, octave: number): ScheduledNote[] {
    const minor = MelodyGenerator.NATURAL_MINOR    // [0, 2, 3, 5, 7, 8, 10]
    const degreePattern = [0, 2, 4, 6, 4, 2, 0]    // 1-♭3-5-♭7-5-♭3-1
    const notes: ScheduledNote[] = []
    const stepSpacing = Math.max(4, Math.floor(length16ths / degreePattern.length))

    for (let i = 0; i < degreePattern.length; i++) {
      const c = i * stepSpacing
      if (c >= length16ths) break
      const deg = degreePattern[i]
      const semitone = minor[deg % minor.length] + Math.floor(deg / minor.length) * 12
      const midi = (octave * 12) + 12 + semitone + this.rootPitchClass + this.pitchOffsetSemitones
      const pitch = Tone.Frequency(midi, 'midi').toNote()
      const bar  = Math.floor(c / 16)
      const beat = Math.floor((c % 16) / 4)
      const sub  = c % 4
      notes.push({
        pitch,
        duration: '4n',
        velocity: this.emotionalIntent === 'sad' ? 0.5 : 0.6,
        time: `${bar}:${beat}:${sub}`,
      })
    }
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
    if (this.unsubscribeConductor) {
      this.unsubscribeConductor()
      this.unsubscribeConductor = null
    }
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
