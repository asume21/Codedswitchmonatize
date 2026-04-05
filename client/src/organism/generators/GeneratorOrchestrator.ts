// Section 04 — Generator Orchestrator

import * as Tone from 'tone'
import { DrumGenerator }    from './DrumGenerator'
import { BassGenerator }    from './BassGenerator'
import { MelodyGenerator }  from './MelodyGenerator'
import { TextureGenerator } from './TextureGenerator'
import { ChordGenerator }   from './ChordGenerator'
import type { PhysicsEngine }  from '../physics/PhysicsEngine'
import type { StateMachine }   from '../state/StateMachine'
import type { PhysicsState }   from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'
import type { GeneratorOutput } from './types'

export class GeneratorOrchestrator {
  private drum:    DrumGenerator
  private bass:    BassGenerator
  private melody:  MelodyGenerator
  private texture: TextureGenerator
  private chord:   ChordGenerator

  private lastPhysics:  PhysicsState  | null = null
  private lastOrganism: OrganismState | null = null

  private physicsEngineRef: PhysicsEngine | null = null
  private running: boolean = false

  // Unsub functions saved from wire() — called in dispose() to break the
  // circular reference cycle: physics.callbacks → orchestrator → generators
  private unsubPhysics:     (() => void) | null = null
  private unsubOrganism:    (() => void) | null = null
  private unsubTransition:  (() => void) | null = null

  // Reactive multiplier state (Section 05)
  // These are BASE multipliers set by ReactiveBehaviorEngine.
  // Performer and self-listen corrections are applied as TEMPORARY modifiers
  // on top — they never write back to these fields to prevent compounding.
  private hatDensityMultiplier:   number = 1.0
  private kickVelocityMultiplier: number = 1.0
  private bassVolumeMultiplier:   number = 1.0
  private melodyPitchOffset:      number = 0
  private melodyVolumeMultiplier: number = 1.0
  private textureVolumeMultiplier: number = 1.0

  // Self-listen correction factor — applied multiplicatively to all generators
  // but stored separately so it doesn't compound with performer/reactive state.
  // Decays toward 1.0 over time to prevent permanent volume drift.
  private selfListenGainCorrection: number = 1.0

  // Texture toggle — when false, texture generator is fully silenced
  private textureEnabled: boolean = false  // off by default for hip-hop

  // ── Arrangement state ─────────────────────────────────────────────
  //
  // Cycles through 28-bar arrangement sections to add dynamic variation.
  // Each section shapes which generators are active and at what level.
  // Texture is fully disabled — no ambient noise layer.
  //
  //   intro (4 bars)     → drums only, building
  //   verse (4 bars)     → drums + bass
  //   build (4 bars)     → drums + bass + melody
  //   drop  (4 bars)     → drums + bass + melody, full energy
  //   breakdown (2 bars) → light drums + bass (breathing room)
  //   verse2 (4 bars)    → drums + bass + melody variation
  //   drop2  (4 bars)    → drums + bass + melody, peak
  //   outro (2 bars)     → light drums + bass fade
  //
  // Total cycle: 28 bars, then repeats.

  private readonly ARRANGEMENT: { name: string; bars: number; drums: number; bass: number; melody: number; texture: number; chord: number }[] = [
    { name: 'intro',     bars: 4, drums: 1.0, bass: 0.0, melody: 0.0, texture: 0, chord: 0.4 },
    { name: 'verse',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.0, texture: 0, chord: 0.8 },
    { name: 'build',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.8, texture: 0, chord: 1.0 },
    { name: 'drop',      bars: 4, drums: 1.0, bass: 1.0, melody: 1.0, texture: 0, chord: 1.0 },
    { name: 'breakdown', bars: 2, drums: 0.4, bass: 0.7, melody: 0.0, texture: 0, chord: 0.6 },
    { name: 'verse2',    bars: 4, drums: 1.0, bass: 1.0, melody: 0.6, texture: 0, chord: 0.9 },
    { name: 'drop2',     bars: 4, drums: 1.0, bass: 1.0, melody: 1.0, texture: 0, chord: 1.0 },
    { name: 'outro',     bars: 2, drums: 0.5, bass: 0.5, melody: 0.0, texture: 0, chord: 0.3 },
  ]
  private arrangementTotalBars: number = 0
  private arrangementEnabled: boolean = true
  private lastArrangementBar: number = -1
  private lastArrangementSection: string = ''

  // Chord-awareness bridge: unsub stored for dispose()
  private unsubChordBridge: (() => void) | null = null

  constructor() {
    this.drum    = new DrumGenerator()
    this.bass    = new BassGenerator()
    this.melody  = new MelodyGenerator()
    this.texture = new TextureGenerator()
    this.chord   = new ChordGenerator()
    this.arrangementTotalBars = this.ARRANGEMENT.reduce((sum, s) => sum + s.bars, 0)

    // Bridge chord changes to Bass and Melody generators so they follow
    // the harmonic progression instead of wandering on a random root
    this.unsubChordBridge = this.chord.onChordChange((chord, rootPC) => {
      this.bass.setCurrentChord(chord, rootPC)
      this.melody.setCurrentChord(chord, rootPC)
    })
  }

  // Wire to physics and state machine outputs
  // Call this once after both engines are constructed
  wire(physicsEngine: PhysicsEngine, stateMachine: StateMachine): void {
    // Store reference for density feedback loop (avoids circular import)
    this.physicsEngineRef = physicsEngine

    // Subscribe to physics updates — store unsub so dispose() can break the
    // circular reference: physics.callbacks → orchestrator → generators
    this.unsubPhysics = physicsEngine.subscribe((physics) => {
      this.lastPhysics = physics
      this.onFrame(physics, this.lastOrganism)
    })

    // Subscribe to organism state updates
    this.unsubOrganism = stateMachine.subscribe((organism) => {
      this.lastOrganism = organism
    })

    // Subscribe to transition events — stagger rebuilds across ~80ms so
    // all 5 generators don't dispose + create Tone.Parts in one synchronous
    // burst, which floods the audio scheduler and causes crackling.
    this.unsubTransition = stateMachine.onTransition((event) => {
      if (!this.lastPhysics) return
      const snap = event.physicsSnapshot
      // Drums first (most audible if late)
      this.drum.onStateTransition(event.to, snap)
      this.texture.onStateTransition(event.to, snap)
      // Stagger bass/melody/chord so Part rebuilds don't collide
      setTimeout(() => this.bass.onStateTransition(event.to, snap), 20)
      setTimeout(() => this.melody.onStateTransition(event.to, snap), 40)
      setTimeout(() => this.chord.onStateTransition(event.to, snap), 60)
    })
  }

  async start(bpm?: number): Promise<void> {
    if (this.running) return
    await Tone.start()

    // Increase look-ahead so main-thread jank doesn't starve the audio graph.
    // Default is ~0.1 s; bumping to 0.3 s adds a generous buffer against React
    // re-renders, physics computation spikes, staggered Part rebuilds, and the
    // FX chains of all 5 generators layering in simultaneously.
    Tone.getContext().lookAhead = 0.3

    Tone.getTransport().bpm.value = bpm ?? 90
    Tone.getTransport().start()
    this.running = true
  }

  stop(): void {
    Tone.getTransport().stop()
    this.running = false
    // Silence all generators immediately — Transport.stop() does not stop
    // continuous sources like the pink noise in TextureGenerator.
    this.texture.reset()
    this.drum.reset()
    this.bass.reset()
    this.melody.reset()
    this.chord.reset()
  }

  /** Smoothly ramp BPM to a new value over 0.5 seconds. */
  setBpm(bpm: number): void {
    const clamped = Math.max(40, Math.min(200, bpm))
    Tone.getTransport().bpm.rampTo(clamped, 0.5)
  }

  /** Get current BPM from Tone Transport. */
  getBpm(): number {
    return Tone.getTransport().bpm.value
  }

  /** Force all generators to rebuild their patterns with current physics. */
  regenerateAll(): void {
    if (!this.lastPhysics) return
    const physics = this.lastPhysics
    const state = this.lastOrganism?.current ?? OState.Breathing
    this.drum.onStateTransition(state, physics)
    this.bass.onStateTransition(state, physics)
    this.melody.onStateTransition(state, physics)
    this.texture.onStateTransition(state, physics)
    this.chord.onStateTransition(state, physics)
  }

  /**
   * Fully dispose all four generators and free their Tone.js audio nodes.
   * Call this in the useEffect cleanup instead of reset() to prevent node leaks
   * when OrganismProvider re-mounts (userId / inputSource / autoEnergy change).
   */
  dispose(): void {
    // Unsubscribe from physics/state before disposing generators so the
    // circular reference (physics → orchestrator → generators) is broken.
    this.unsubPhysics?.()
    this.unsubOrganism?.()
    this.unsubTransition?.()
    this.unsubChordBridge?.()
    this.unsubPhysics    = null
    this.unsubOrganism   = null
    this.unsubTransition = null
    this.unsubChordBridge = null

    this.stop()
    this.drum.dispose()
    this.bass.dispose()
    this.melody.dispose()
    this.texture.dispose()
    this.chord.dispose()
    this.lastPhysics     = null
    this.lastOrganism    = null
    this.physicsEngineRef = null
  }

  reset(): void {
    this.stop()   // stop() now resets all generators
    this.lastPhysics  = null
    this.lastOrganism = null
  }

  getOutput(): GeneratorOutput | null {
    if (!this.lastPhysics) return null
    const now = performance.now()
    return {
      drum:    this.drum.getActivityReport(now),
      bass:    this.bass.getActivityReport(now),
      melody:  this.melody.getActivityReport(now),
      texture: this.texture.getActivityReport(now),
      chord:   this.chord.getActivityReport(now),
    }
  }

  // ── Performer-driven reactions ────────────────────────────────────
  //
  // Called by OrganismProvider whenever a new PerformerState is available.
  // Maps performer characteristics onto generator parameters so Astutely
  // musically responds to the human in real time.

  applyPerformerState(performer: import('../audio/types').PerformerState): void {
    // Feed performer features to melody generator for intelligent voice selection
    this.melody.setPerformerFeatures(
      performer.energy,
      performer.spectralBrightness,
      performer.syllabicRate,
    )

    // Performer adjustments are computed as FRESH multipliers each frame —
    // they do NOT compound on top of stored multipliers.

    // 1. Energy → kick punch + melody presence
    const energyBias = 0.7 + performer.energy * 0.6   // 0.7–1.3
    const kickMult   = Math.min(1.4, this.kickVelocityMultiplier * energyBias)
    this.drum.setKickVelocityMultiplier(kickMult)

    const melodyEnergy = Math.min(1.2, 0.8 + performer.energy * 0.4)

    // 2. Syllabic rate → hi-hat density
    const normalSyllabic = Math.min(1, performer.syllabicRate / 8)
    this.drum.setHatDensityMultiplier(
      Math.max(0.3, Math.min(1.5, 0.5 + normalSyllabic))
    )

    // 3. Breathing / rest → call-and-response
    // Melody volume is computed ONCE per frame combining energy + breathing.
    // Previous code wrote melody gain twice per frame, interrupting the 100ms
    // ramp each time and causing crackling/distortion.
    const breathingBoost = performer.breathingNow ? 1.2 : 1.0
    const melodyTarget = Math.min(1.3,
      this.melodyVolumeMultiplier * melodyEnergy * breathingBoost
    ) * this.selfListenGainCorrection
    this.melody.applyVolumeMultiplier(melodyTarget)

    if (performer.breathingNow) {
      this.texture.applyVolumeMultiplier(
        Math.min(1.2, this.textureVolumeMultiplier * 1.15) * this.selfListenGainCorrection
      )
      this.drum.applyArrangementMultiplier(0.6)
    } else {
      this.texture.applyVolumeMultiplier(this.textureVolumeMultiplier * this.selfListenGainCorrection)
    }

    // 4. Phrase downbeat → accent kick (one-shot, not cumulative)
    if (performer.phraseBar === 0 && performer.phrasePosition < 0.1) {
      this.drum.setKickVelocityMultiplier(Math.min(1.5, kickMult * 1.15))
    }
  }

  /**
   * Apply a SelfListenReport — Astutely corrects itself based on what
   * it hears from its own output (powered by WebEar-grade pcmAnalyzer).
   */
  applySelfListenReport(report: import('../audio/types').SelfListenReport): void {
    if (report.isSilent) return  // nothing playing yet

    // ── Volume correction ──────────────────────────────────────────────────
    // Self-listen adjusts a SEPARATE gain correction factor that is applied
    // multiplicatively alongside (not into) the reactive/performer multipliers.
    // The correction is clamped to [0.6, 1.15] to prevent runaway gain drift.
    if (report.needsVolumeReduction) {
      const reduction = report.clippingPercent > 0.5 ? 0.90 : 0.95
      this.selfListenGainCorrection = Math.max(0.6, this.selfListenGainCorrection * reduction)
      console.info(`[SelfListen] Gain correction: ${this.selfListenGainCorrection.toFixed(3)} — clipping ${report.clippingPercent.toFixed(2)}%`)
    } else if (report.needsVolumeBoost) {
      this.selfListenGainCorrection = Math.min(1.15, this.selfListenGainCorrection * 1.03)
      console.info(`[SelfListen] Gain correction: ${this.selfListenGainCorrection.toFixed(3)} — boosting`)
    } else {
      // No issues detected — slowly decay correction back toward 1.0
      this.selfListenGainCorrection += (1.0 - this.selfListenGainCorrection) * 0.1
    }

    // Apply corrected volume to bass only — melody is already written with
    // selfListenGainCorrection baked in by applyPerformerState().  Writing it
    // again here would cancel the in-progress 250ms ramp, causing crackling.
    this.bass.applyVolumeMultiplier(this.bassVolumeMultiplier * this.selfListenGainCorrection)

    // ── Frequency balance — log only, no gain changes ─────────────────────
    // Frequency corrections via gain were causing cascading feedback.
    // These are now informational for future EQ-based corrections.
    if (report.bandEnergy.sub + report.bandEnergy.bass > 0.7) {
      console.info('[SelfListen] Muddy mix detected (sub+bass > 70%)')
    }
    if (report.spectralCentroidHz > 5000) {
      console.info('[SelfListen] Harsh mix detected (centroid > 5kHz)')
    }
    if (report.spectralCentroidHz < 1500) {
      console.info('[SelfListen] Dark mix detected (centroid < 1.5kHz)')
    }

    // ── Diagnostics (log only) ────────────────────────────────────────────
    if (report.crestFactor < 2) {
      console.info('[SelfListen] Over-compressed (crest factor < 2)')
    }
    if (report.onsetTimingStdDevMs > 25) {
      console.info(`[SelfListen] Groove jitter: ${report.onsetTimingStdDevMs.toFixed(1)}ms`)
    }
    if (report.hasDcOffset) {
      console.warn(`[SelfListen] DC offset: ${report.dcOffset.toFixed(4)}`)
    }
  }

  // ── Reactive mutation methods (Section 05) ────────────────────────

  setHatDensityMultiplier(multiplier: number): void {
    this.hatDensityMultiplier = Math.max(0, multiplier)
    this.drum.setHatDensityMultiplier(this.hatDensityMultiplier)
  }

  setKickVelocityMultiplier(multiplier: number): void {
    this.kickVelocityMultiplier = Math.max(0, multiplier)
    this.drum.setKickVelocityMultiplier(this.kickVelocityMultiplier)
  }

  setBassVolumeMultiplier(multiplier: number): void {
    this.bassVolumeMultiplier = Math.max(0, multiplier)
    this.bass.applyVolumeMultiplier(multiplier)
  }

  setMelodyPitchOffset(semitones: number): void {
    this.melodyPitchOffset = Math.round(semitones)
    this.melody.applyPitchOffset(semitones)
  }

  setMelodyVolumeMultiplier(multiplier: number): void {
    this.melodyVolumeMultiplier = Math.max(0, multiplier)
    this.melody.applyVolumeMultiplier(multiplier)
  }

  setTextureVolumeMultiplier(multiplier: number): void {
    this.textureVolumeMultiplier = Math.max(0, multiplier)
    this.texture.applyVolumeMultiplier(this.textureEnabled ? multiplier : 0)
  }

  /** Enable or disable the texture generator entirely. */
  setTextureEnabled(enabled: boolean): void {
    this.textureEnabled = enabled
    this.texture.setEnabled(enabled)
    if (!enabled) {
      this.texture.applyVolumeMultiplier(0)
    }
  }

  isTextureEnabled(): boolean {
    return this.textureEnabled
  }

  /**
   * Melody-only mode — silences drums, bass, and texture so the melody
   * generator plays solo. Ideal for freestyling: the user hears only the
   * melodic hook and can rap/sing over it without competing rhythms.
   *
   * Calling with `false` restores the normal arrangement multipliers.
   */
  private melodyOnlyMode = false
  private savedDrumMult  = 1.0
  private savedBassMult  = 1.0

  setMelodyOnly(enabled: boolean): void {
    if (enabled === this.melodyOnlyMode) return
    this.melodyOnlyMode = enabled
    if (enabled) {
      // Save current multipliers so we can restore them later
      this.savedDrumMult = this.kickVelocityMultiplier
      this.savedBassMult = this.bassVolumeMultiplier
      // Silence drums, bass, texture — keep melody + chords for harmonic context
      this.drum.applyArrangementMultiplier(0)
      this.bass.applyArrangementMultiplier(0)
      this.texture.applyVolumeMultiplier(0)
      // Boost melody into the foreground, keep chords subtle
      this.melody.applyVolumeMultiplier(Math.min(1.4, this.melodyVolumeMultiplier * 1.2))
      this.chord.applyVolumeMultiplier(0.5)
    } else {
      // Restore — let arrangement logic take over on next frame
      this.drum.applyArrangementMultiplier(1.0)
      this.bass.applyArrangementMultiplier(1.0)
      if (this.textureEnabled) this.texture.applyVolumeMultiplier(this.textureVolumeMultiplier)
      this.melody.applyVolumeMultiplier(this.melodyVolumeMultiplier)
      this.chord.applyVolumeMultiplier(1.0)
    }
  }

  isMelodyOnly(): boolean { return this.melodyOnlyMode }

  // ── Mix engine connection methods (Section 06) ────────────────────

  lockDrumPattern(): void   { this.drum.lockPattern() }
  unlockDrumPattern(): void { this.drum.unlockPattern() }
  isDrumPatternLocked(): boolean { return this.drum.isPatternLocked() }

  connectDrumOutput(destination: Tone.InputNode): void {
    this.drum.output.connect(destination)
  }

  connectBassOutput(destination: Tone.InputNode): void {
    this.bass.output.connect(destination)
  }

  connectMelodyOutput(destination: Tone.InputNode): void {
    this.melody.output.connect(destination)
  }

  connectTextureOutput(destination: Tone.InputNode): void {
    this.texture.output.connect(destination)
  }

  connectChordOutput(destination: Tone.InputNode): void {
    this.chord.output.connect(destination)
  }

  /** Subscribe to chord changes for chord-aware generators. */
  onChordChange(listener: (chord: import('./patterns/ChordProgressionBank').ChordEvent, rootPitchClass: number) => void): () => void {
    return this.chord.onChordChange(listener)
  }

  /** Get the current chord from the chord generator. */
  getCurrentChord(): import('./patterns/ChordProgressionBank').ChordEvent | null {
    return this.chord.getCurrentChord()
  }

  /** Force a new chord progression pick. */
  pickNewChordProgression(): void {
    this.chord.pickNewProgression()
  }

  setChordVolumeMultiplier(multiplier: number): void {
    this.chord.applyVolumeMultiplier(Math.max(0, multiplier))
  }

  /**
   * Wire the kick trigger callback for sidechain ducking.
   * The MixEngine calls this to receive a callback on every kick hit.
   */
  setKickSidechainCallback(cb: ((time: number) => void) | null): void {
    this.drum.setKickTriggerCallback(cb)
  }

  // ── Private ────────────────────────────────────────────────────────

  private onFrame(physics: PhysicsState, organism: OrganismState | null): void {
    if (!organism) return

    // Apply arrangement shaping before processing generators
    this.applyArrangement()

    this.drum.processFrame(physics, organism)
    this.bass.processFrame(physics, organism)
    this.melody.processFrame(physics, organism)
    this.texture.processFrame(physics, organism)
    this.chord.processFrame(physics, organism)

    // Density feedback loop: report generator activity levels to PhysicsEngine
    if (this.physicsEngineRef) {
      const now = performance.now()
      this.physicsEngineRef.registerGeneratorLevel(
        this.drum.name,    this.drum.getActivityReport(now).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.bass.name,    this.bass.getActivityReport(now).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.melody.name,  this.melody.getActivityReport(now).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.texture.name, this.texture.getActivityReport(now).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.chord.name,   this.chord.getActivityReport(now).activityLevel
      )
    }

    // Thinning: if density requests thinning, tell texture generator
    if (physics.density > 0.78) {
      this.texture.setThinning(true)
    } else {
      this.texture.setThinning(false)
    }
  }

  /** Reads the current Transport bar and applies arrangement section multipliers. */
  private applyArrangement(): void {
    if (!this.arrangementEnabled || !this.running) return

    // Get current bar from Tone.js Transport
    const transport = Tone.getTransport()
    const position  = transport.position as string  // "bars:beats:16ths"
    const barNumber = parseInt(position.split(':')[0], 10) || 0

    // Only update when bar changes
    if (barNumber === this.lastArrangementBar) return
    this.lastArrangementBar = barNumber

    // Find which arrangement section we're in
    const cycleBar = barNumber % this.arrangementTotalBars
    let accumulated = 0
    let section = this.ARRANGEMENT[0]
    for (const s of this.ARRANGEMENT) {
      if (cycleBar < accumulated + s.bars) {
        section = s
        break
      }
      accumulated += s.bars
    }

    // Apply section multipliers to generator volumes
    this.drum.applyArrangementMultiplier(section.drums)
    this.bass.applyArrangementMultiplier(section.bass)
    this.melody.applyArrangementMultiplier(section.melody)
    this.texture.applyArrangementMultiplier(this.textureEnabled ? section.texture : 0)
    this.chord.applyArrangementMultiplier(section.chord)

    // Gap 2 — notify listeners that a new arrangement section has started
    // so they can request an AI-generated pattern variation
    if (section.name !== this.lastArrangementSection) {
      this.lastArrangementSection = section.name
      window.dispatchEvent(new CustomEvent('organism:section-change', {
        detail: {
          section:  section.name,
          physics:  this.lastPhysics,
          bpm:      transport.bpm.value,
        },
      }))
    }
  }

  /** Load an AI-generated drum pattern into the drum generator (Gap 2). */
  loadGeneratedDrumPattern(hits: import('./types').DrumHit[]): void {
    this.drum.loadGeneratedPattern(hits)
  }

  /**
   * Apply a detected scale from ScaleSnapEngine to the melody generator.
   * The melody will rebuild its next phrase in the new key.
   *
   * @param rootPitchClass - 0-11 (C=0, C#=1 ... B=11)
   * @param intervals      - semitone intervals from root
   */
  setDetectedScale(rootPitchClass: number, intervals: number[]): void {
    this.melody.setRootAndScale(rootPitchClass, intervals)
    this.chord.setRootPitchClass(rootPitchClass)
  }
}
