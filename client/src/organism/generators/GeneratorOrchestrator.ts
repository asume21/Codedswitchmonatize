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
import { MusicalDirector }     from '../state/MusicalDirector'
import type { MusicalState, HipHopSubGenre } from '../state/MusicalState'
import { buildSubGenrePattern, mutatePattern } from './patterns/DrumPatternLibrary'
import { setBassSwingFromSubGenre } from './patterns/BassPatternLibrary'
import { orgLog } from '../../lib/perf/organismLog'

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

  // Frame throttle — physics fires at ~43fps (every ~23ms) but generators
  // only need updates every ~60ms. Processing every frame floods the audio
  // scheduler with overlapping gain ramps that cause crackling.
  private lastFrameTime: number = 0
  private static readonly MIN_FRAME_INTERVAL_MS = 55  // ~18fps — plenty for musical reactivity

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

  // Freestyle arrangement: full beat from bar 1, melody never drops out.
  // Mirrors MusicalDirector.ARRANGEMENT — no instrument silence, only dynamics.
  private readonly ARRANGEMENT: { name: string; bars: number; drums: number; bass: number; melody: number; texture: number; chord: number }[] = [
    { name: 'intro',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.7, texture: 0, chord: 0.8 },
    { name: 'verse',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.8, texture: 0, chord: 0.9 },
    { name: 'build',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.9, texture: 0, chord: 1.0 },
    { name: 'drop',      bars: 4, drums: 1.0, bass: 1.0, melody: 1.0, texture: 0, chord: 1.0 },
    { name: 'breakdown', bars: 2, drums: 0.6, bass: 0.8, melody: 0.6, texture: 0, chord: 0.7 },
    { name: 'verse2',    bars: 4, drums: 1.0, bass: 1.0, melody: 0.9, texture: 0, chord: 0.9 },
    { name: 'drop2',     bars: 4, drums: 1.0, bass: 1.0, melody: 1.0, texture: 0, chord: 1.0 },
    { name: 'outro',     bars: 2, drums: 0.7, bass: 0.8, melody: 0.7, texture: 0, chord: 0.6 },
  ]
  private arrangementTotalBars: number = 0
  private arrangementEnabled: boolean = true
  private lastArrangementBar: number = -1
  private lastArrangementSection: string = ''

  // Chord-awareness bridge: unsub stored for dispose()
  private unsubChordBridge: (() => void) | null = null

  // ── Musical Director — unified brain ──────────────────────────────
  private director: MusicalDirector
  private unsubDirectorSubGenre: (() => void) | null = null
  private unsubDirectorSection:  (() => void) | null = null
  private unsubDirectorMutation: (() => void) | null = null

  constructor() {
    this.drum    = new DrumGenerator()
    this.bass    = new BassGenerator()
    this.melody  = new MelodyGenerator()
    this.texture = new TextureGenerator()
    this.chord   = new ChordGenerator()
    this.director = new MusicalDirector()
    this.arrangementTotalBars = this.ARRANGEMENT.reduce((sum, s) => sum + s.bars, 0)

    // Bridge chord changes to Bass, Melody, AND the Director
    this.unsubChordBridge = this.chord.onChordChange((chord, rootPC) => {
      this.bass.setCurrentChord(chord, rootPC)
      this.melody.setCurrentChord(chord, rootPC)
      this.director.setCurrentChord(chord, rootPC)
    })

    // When director changes sub-genre, rebuild drum + bass patterns
    this.unsubDirectorSubGenre = this.director.onSubGenreChange((subGenre) => {
      orgLog('subgenre:change', { subGenre })
      this.onSubGenreChange(subGenre)
    })

    // When director triggers mutation, mutate current patterns
    this.unsubDirectorMutation = this.director.onMutation(() => {
      const state = this.director.getState()
      orgLog('pattern:mutation', {
        subGenre: state.subGenre,
        section: state.section,
        variant: state.drums.variantIndex,
      })
      this.onPatternMutation()
    })

    // When director changes section, dispatch event for AI pattern generation
    this.unsubDirectorSection = this.director.onSectionChange((section, slot) => {
      orgLog('arrangement:section', {
        section,
        bars: slot.bars,
        drums: slot.drums,
        bass: slot.bass,
        melody: slot.melody,
        chord: slot.chord,
        drumDropout: slot.drumDropout,
        bassDropout: slot.bassDropout,
        melodyDropout: slot.melodyDropout,
        bpm: Tone.getTransport().bpm.value,
      })
      window.dispatchEvent(new CustomEvent('organism:section-change', {
        detail: {
          section,
          subGenre: this.director.getState().subGenre,
          physics: this.lastPhysics,
          bpm: Tone.getTransport().bpm.value,
        },
      }))
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

    // Subscribe to transition events — stagger rebuilds across ~200ms so
    // all 5 generators don't dispose + create Tone.Parts in one synchronous
    // burst, which floods the audio scheduler and causes crackling.
    this.unsubTransition = stateMachine.onTransition((event) => {
      // Use event.physicsSnapshot which is ALWAYS valid — it was captured at
      // the moment the transition fired, even if lastPhysics hasn't been set
      // yet by the physics subscriber (race on first quickStart frame).
      const snap = event.physicsSnapshot
      if (this.lastPhysics === null) {
        // First transition: seed lastPhysics from the snapshot so subsequent
        // onFrame calls don't skip the first seeding.
        this.lastPhysics = snap
      }

      // Notify director FIRST so it sets sub-genre + groove before generators rebuild
      this.director.onStateTransition(event.to, snap)

      // Drums first (most audible if late)
      this.drum.onStateTransition(event.to, snap)
      this.texture.onStateTransition(event.to, snap)
      // Stagger bass/melody/chord so Part rebuilds don't collide on the audio thread
      setTimeout(() => this.bass.onStateTransition(event.to, snap), 50)
      setTimeout(() => this.melody.onStateTransition(event.to, snap), 120)
      setTimeout(() => this.chord.onStateTransition(event.to, snap), 180)
    })
  }

  async start(bpm?: number, startTransport: boolean = true): Promise<void> {
    const dest = Tone.getDestination()
    // Always ensure destination is audible — a previous start() that mutes then
    // loses its ramp (StrictMode remount, start/stop thrash) must not leave the
    // global destination at -Infinity and silence the whole app.
    if (this.running) {
      if (dest.volume.value < -60) {
        console.warn('[Organism] destination was stuck at silence; restoring to 0 dB')
        dest.volume.value = 0
      }
      return
    }
    await Tone.start()

    // Look-ahead controls scheduling latency — the time between a scheduled
    // event and when it becomes audible. A high value (0.6s) hides main-thread
    // jank but adds 600ms of silence before the first drum hit, which is
    // unacceptable for live freestyle. 0.1s is tight but audible within a
    // fraction of a beat, and modern machines don't need the wider window.
    Tone.getContext().lookAhead = 0.1

    // Start at 0 dB. The prior pre-mute-to-silence was hiding an initial
    // transient, but when the ramp was skipped it silently bricked audio.
    dest.volume.value = 0

    // BPM is synced from TransportContext (the single source of truth).
    // Only set BPM here as a fallback if Transport hasn't been configured yet.
    const transport = Tone.getTransport()
    if (bpm != null && transport.bpm.value !== bpm) {
      transport.bpm.value = bpm
    }

    if (!startTransport) {
      return
    }

    // Organism owns Tone.Transport only for its own live generator clock. It
    // must start after the initial parts are built, otherwise rebuilt parts can
    // miss the first grid and bunch events into the next audible tick.
    if (transport.state !== 'started') {
      transport.start()
    }
    this.running = true
  }

  stop(): void {
    // Do NOT call Transport.stop() — TransportContext owns the Transport
    // lifecycle. Stopping Transport here would kill studio playback (piano
    // roll, beat maker) if the user stops the Organism mid-session.
    this.running = false
    // Silence all generators immediately — continuous sources like the pink
    // noise in TextureGenerator keep producing audio after Transport stops.
    this.texture.reset()
    this.drum.reset()
    this.bass.reset()
    this.melody.reset()
    this.chord.reset()
  }

  /**
   * Smoothly ramp BPM to a new value over 0.5 seconds.
   * NOTE: This updates Tone.Transport.bpm directly because the orchestrator
   * may run outside TransportProvider (GlobalOrganismWrapper). Callers should
   * also sync the Zustand store so TransportContext stays consistent.
   */
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

  /** Rebuild only the melody against the current rhythm/harmony. */
  regenerateMelody(): void {
    if (!this.lastPhysics) return
    const state = this.lastOrganism?.current ?? OState.Flow
    this.melody.onStateTransition(state, this.lastPhysics)
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
    this.unsubDirectorSubGenre?.()
    this.unsubDirectorSection?.()
    this.unsubDirectorMutation?.()
    this.unsubPhysics    = null
    this.unsubOrganism   = null
    this.unsubTransition = null
    this.unsubChordBridge = null
    this.unsubDirectorSubGenre = null
    this.unsubDirectorSection  = null
    this.unsubDirectorMutation = null
    this.director.dispose()

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
    } else if (report.needsVolumeBoost) {
      this.selfListenGainCorrection = Math.min(1.15, this.selfListenGainCorrection * 1.03)
    } else {
      // No issues detected — slowly decay correction back toward 1.0
      this.selfListenGainCorrection += (1.0 - this.selfListenGainCorrection) * 0.1
    }

    // Sync correction to director so it's part of the unified state
    this.director.setSelfListenCorrection(this.selfListenGainCorrection)

    // Do NOT write bass gain here — applyPerformerState() already handles
    // bass via setOutputLevel on every throttled frame. Writing it again here
    // cancels in-progress ramps and causes crackling.
    // The selfListenGainCorrection is applied next frame via onFrame → processFrame.

    // ── Frequency balance — log only, no gain changes ─────────────────────
    // Frequency corrections via gain were causing cascading feedback.
    // These are now informational for future EQ-based corrections.
    // Frequency balance and diagnostics are logged only in development
    // to prevent console.info from blocking the main thread (1-2ms per call)
    // and stealing time from the audio scheduler.
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      if (report.bandEnergy.sub + report.bandEnergy.bass > 0.7) {
        console.debug('[SelfListen] Muddy mix detected')
      }
      if (report.hasDcOffset) {
        console.debug(`[SelfListen] DC offset: ${report.dcOffset.toFixed(4)}`)
      }
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

  setGrooveLocked(locked: boolean): void {
    this.director.setGrooveLocked(locked)
  }

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
   * Set the playing technique on the chord generator.
   * Available: 'piano-block-chord' (default), 'piano-rolled-chord',
   * 'piano-alberti', 'piano-sustained-pad', 'guitar-strum-down',
   * 'guitar-strum-up', 'guitar-arp-rolled', 'guitar-muted-stab'.
   */
  setChordTechnique(techniqueId: string): void {
    this.chord.setTechnique(techniqueId)
  }

  /** Get the currently active chord technique id. */
  getChordTechnique(): string {
    return this.chord.getTechnique()
  }

  /**
   * Set melody articulation. Transforms each single-note melody event.
   * Available: 'none' (default), 'legato-slur', 'staccato-pop',
   * 'grace-flick', 'trill-ornament'.
   */
  setMelodyArticulation(articulationId: string): void {
    this.melody.setArticulation(articulationId)
  }

  getMelodyArticulation(): string {
    return this.melody.getArticulation()
  }

  resetMelodyArticulationOverride(): void {
    this.melody.resetArticulationOverride()
  }

  /**
   * Set bass articulation. Transforms each single-note bass event.
   * Available: 'none' (default), 'bass-slide-up', 'bass-ghost-note',
   * 'bass-octave-jump', 'bass-walking-step'.
   */
  setBassArticulation(articulationId: string): void {
    this.bass.setArticulation(articulationId)
  }

  getBassArticulation(): string {
    return this.bass.getArticulation()
  }

  resetBassArticulationOverride(): void {
    this.bass.resetArticulationOverride()
  }

  resetChordTechniqueOverride(): void {
    this.chord.resetTechniqueOverride()
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

    // Throttle: physics fires at ~43fps but generators only need ~18fps.
    // Processing every frame creates 215 gain ramp evaluations/sec across 5
    // generators, flooding the Web Audio scheduler and causing crackling.
    const now = performance.now()
    if (now - this.lastFrameTime < GeneratorOrchestrator.MIN_FRAME_INTERVAL_MS) return
    this.lastFrameTime = now

    // ── Musical Director update ──────────────────────────────────
    // The director reads physics + organism state and updates the
    // unified MusicalState. If it returns true, patterns need rebuilding.
    const transport = Tone.getTransport()
    const position = transport.position as string
    const currentBar = parseInt(position.split(':')[0], 10) || 0
    const needsRebuild = this.director.update(physics, organism, currentBar)

    if (needsRebuild && !this.melodyOnlyMode) {
      // Sub-genre or section changed — director already notified via events
      // which trigger onSubGenreChange / section dispatch
    }

    // Apply arrangement shaping from director state
    this.applyArrangement()

    // Process all generators
    this.drum.processFrame(physics, organism)
    this.bass.processFrame(physics, organism)
    this.melody.processFrame(physics, organism)
    this.texture.processFrame(physics, organism)
    this.chord.processFrame(physics, organism)

    // Density feedback loop: report generator activity levels to PhysicsEngine
    if (this.physicsEngineRef) {
      const ts = performance.now()
      this.physicsEngineRef.registerGeneratorLevel(
        this.drum.name,    this.drum.getActivityReport(ts).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.bass.name,    this.bass.getActivityReport(ts).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.melody.name,  this.melody.getActivityReport(ts).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.texture.name, this.texture.getActivityReport(ts).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.chord.name,   this.chord.getActivityReport(ts).activityLevel
      )
    }

    // Thinning: if density requests thinning, tell texture generator
    this.texture.setThinning(physics.density > 0.78)

    // Emit unified musical state for Astutely bridge
    this.emitMusicalState()
  }

  // ── Director event handlers ────────────────────────────────────────

  /**
   * Called when the MusicalDirector changes sub-genre.
   * Rebuilds drum + bass patterns with the new sub-genre's vocabulary.
   */
  private onSubGenreChange(subGenre: HipHopSubGenre): void {
    // Sync bass swing to new sub-genre
    setBassSwingFromSubGenre(subGenre)

    // Rebuild drum pattern with sub-genre-specific variant
    const drumPattern = buildSubGenrePattern(subGenre)
    this.drum.loadGeneratedPattern(drumPattern.hits)

    // Bass will pick up new behavior from director state on next processFrame
    // via getBassBehavior → rebuildPart, no explicit call needed

    // Emit event for UI
    window.dispatchEvent(new CustomEvent('organism:subgenre-change', {
      detail: { subGenre },
    }))
  }

  /**
   * Called when the MusicalDirector triggers a pattern mutation.
   * Mutates existing drum patterns for variation without full rebuild.
   */
  private onPatternMutation(): void {
    // Mutate current drum pattern
    const state = this.director.getState()
    const pattern = buildSubGenrePattern(state.subGenre, state.drums.variantIndex)
    const mutated = mutatePattern(pattern.hits, {
      ghostProbability: 0.2,
      dropProbability: 0.1,
      shiftProbability: 0.12,
      velocitySpread: 0.08,
    })
    this.drum.loadGeneratedPattern(mutated)
  }

  /**
   * Emit the unified musical state as a CustomEvent so the Astutely bridge
   * can observe it. Throttled to ~3Hz (every 5th frame at 18fps) to avoid
   * flooding the event bus.
   */
  private emitFrameCounter = 0
  private emitMusicalState(): void {
    this.emitFrameCounter++
    if (this.emitFrameCounter % 5 !== 0) return

    const state = this.director.getState()
    window.dispatchEvent(new CustomEvent('organism:musical-state', {
      detail: {
        subGenre:    state.subGenre,
        section:     state.section,
        energy:      state.energy,
        density:     state.density,
        groove:      state.groove,
        rootPitchClass: state.rootPitchClass,
        tempo:       state.tempo,
        chordLabel:  state.currentChordLabel,
      },
    }))
  }

  /** Get the current unified musical state from the director */
  getMusicalState(): Readonly<MusicalState> {
    return this.director.getState()
  }

  /** Force a specific sub-genre (from Astutely bridge) */
  forceSubGenre(subGenre: HipHopSubGenre): void {
    this.director.forceSubGenre(subGenre)
  }

  /**
   * Enable/disable the 28-bar arrangement cycler. When disabled, generators
   * stay at their base multipliers instead of being scaled by breakdown/outro
   * sections — critical for freestyle recording where the beat must not dip.
   */
  setArrangementEnabled(enabled: boolean): void {
    if (this.arrangementEnabled === enabled) return
    this.arrangementEnabled = enabled
    orgLog('arrangement:toggle', { enabled })
    if (!enabled) {
      // Restore full multipliers so the drums don't stay at whatever reduced
      // level the last arrangement section applied.
      this.drum.applyArrangementMultiplier(1.0)
      this.bass.applyArrangementMultiplier(1.0)
      this.melody.applyArrangementMultiplier(1.0)
      this.chord.applyArrangementMultiplier(1.0)
      this.lastArrangementBar = -1
      this.lastArrangementSection = ''
    }
  }

  isArrangementEnabled(): boolean {
    return this.arrangementEnabled
  }

  getCurrentSection(): string {
    return this.lastArrangementSection || 'none'
  }

  /**
   * Live preset swap — change sub-genre + BPM without teardown. Patterns
   * rebuild via the director's sub-genre listener, and an explicit
   * regenerateAll() ensures bass/melody/chord rebuild as well.
   */
  swapSubGenre(subGenre: HipHopSubGenre, bpm?: number): void {
    if (bpm != null) this.setBpm(bpm)
    this.director.forceSubGenre(subGenre)
    this.regenerateAll()
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
      orgLog('arrangement:apply', {
        section: section.name,
        bar: barNumber,
        cycleBar,
        drums: section.drums,
        bass: section.bass,
        melody: section.melody,
        texture: this.textureEnabled ? section.texture : 0,
        chord: section.chord,
      })
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
    this.director.setScale(rootPitchClass, intervals)
  }
}
