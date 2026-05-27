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
import { PRODUCER_ARRANGEMENT_TOTAL_BARS, getProducerArrangementSlot } from '../state/ProducerArrangement'
import { buildSubGenrePattern, mutatePattern } from './patterns/DrumPatternLibrary'
import { setBassSwingFromSubGenre } from './patterns/BassPatternLibrary'
import { orgLog } from '../../lib/perf/organismLog'
import type { InstrumentPerformerId } from '../performers'
import { getConductor } from '../conductor/Conductor'

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

  // Mix multiplier state (Section 05)
  // Public setters own the user's base slider values. Reactive automation,
  // performer state, and self-listen are layered separately so frame-by-frame
  // behavior cannot overwrite what the user set in the UI.
  private hatDensityMultiplier:   number = 1.0
  private kickVelocityMultiplier: number = 1.0
  private bassVolumeMultiplier:   number = 1.0
  private melodyPitchOffset:      number = 0
  private melodyVolumeMultiplier: number = 1.0
  private textureVolumeMultiplier: number = 1.0

  private reactiveHatDensityMultiplier:   number = 1.0
  private reactiveKickVelocityMultiplier: number = 1.0
  private reactiveBassVolumeMultiplier:   number = 1.0
  private reactiveMelodyVolumeMultiplier: number = 1.0
  private reactiveTextureVolumeMultiplier: number = 1.0

  // Self-listen correction factor — applied multiplicatively to all generators
  // but stored separately so it doesn't compound with performer/reactive state.
  // Decays toward 1.0 over time to prevent permanent volume drift.
  private selfListenGainCorrection: number = 1.0

  // Texture toggle — when false, texture generator is fully silenced
  private textureEnabled: boolean = false  // off by default for hip-hop

  // ── Arrangement state ─────────────────────────────────────────────
  //
  // Cycles through a 32-bar song-form sketch. Each section is a hard mask
  // plus a level shape, so the Organism can create an intro/verse/build/drop
  // arc instead of layering every generator from bar 1.
  //
  //   intro (4 bars)     → chords only
  //   verse (8 bars)     → sparse drums + bass
  //   build (4 bars)     → hats/melody rise toward the drop
  //   drop  (8 bars)     → full mix
  //   breakdown (4 bars) → half-energy drums, sustained harmony
  //   drop2  (4 bars)    → return hook/drop energy
  //
  // Total cycle: 32 bars, then repeats.

  private arrangementTotalBars: number = PRODUCER_ARRANGEMENT_TOTAL_BARS
  private arrangementEnabled: boolean = true
  private lastArrangementBar: number = -1
  private lastArrangementSection: string = ''

  // AI Director overrides — keyed by section name, applied next time that section starts
  private aiDirectiveOverrides: Map<string, {
    drumsArrangement: number; bassVolume: number; melodyVolume: number; chordTechnique: string
    hatDensity: number; kickPunch: number; energy: number; subGenre: HipHopSubGenre; groove: string
  }> = new Map()

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

    // Phase 4: Conductor is the chord source of truth. Bass + Melody self-
    // subscribe to conductor.onChordChange in their constructors; the only
    // consumer wired here is the Director, which still accepts the
    // ChordEvent shape — we translate ParsedChord → ChordEvent at the
    // boundary. The Conductor's chord-change events fire from the orchestrator's
    // JS-thread bar tick (applyArrangement) and from setKey/setSubGenre paths,
    // never from inside an audio-thread Tone.Part callback, so no setTimeout
    // defer is needed.
    const conductor = getConductor()
    this.unsubChordBridge = conductor.onChordChange((parsed) => {
      const keyPC = conductor.getKeyPitchClass()
      const rootOffset = (((parsed.rootMidi - 60) - keyPC) % 12 + 12) % 12
      const event: import('./patterns/ChordProgressionBank').ChordEvent = {
        intervals:  parsed.intervals,
        rootOffset,
        label:      parsed.symbol,
      }
      this.director.setCurrentChord(event, keyPC)
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

      if (!this.melodyOnlyMode && this.arrangementEnabled && this.drumEnabled) {
        const pattern = buildSubGenrePattern(this.director.getState().subGenre, this.director.getState().drums.variantIndex)
        this.drum.loadGeneratedPattern(pattern.hits, true)
      }
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
    const transport = Tone.getTransport()
    // Always ensure destination is audible — a previous start() that mutes then
    // loses its ramp (StrictMode remount, start/stop thrash) must not leave the
    // global destination at -Infinity and silence the whole app.
    if (this.running) {
      if (dest.volume.value < -60) {
        console.warn('[Organism] destination was stuck at silence; restoring to 0 dB')
        dest.volume.value = 0
      }
      if (startTransport && transport.state !== 'started') {
        transport.start()
      }
      return
    }
    await Tone.start()

    // Look-ahead controls scheduling latency. 0.1s caused crackling when 5+
    // generators run simultaneously on a busy dev-mode main thread. 0.25s is
    // a safe middle ground: ~1/4 beat at 120 BPM, unnoticeable in live use.
    Tone.getContext().lookAhead = 0.25

    // Start at 0 dB. The prior pre-mute-to-silence was hiding an initial
    // transient, but when the ramp was skipped it silently bricked audio.
    dest.volume.value = 0

    // BPM is synced from TransportContext (the single source of truth).
    // Only set BPM here as a fallback if Transport hasn't been configured yet.
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
    const live = Tone.getTransport().state === 'started'

    if (live) {
      this.drum.onStateTransition(state, physics)
      globalThis.setTimeout(() => this.bass.onStateTransition(state, physics), 80)
      globalThis.setTimeout(() => this.melody.onStateTransition(state, physics), 160)
      globalThis.setTimeout(() => this.texture.onStateTransition(state, physics), 220)
      globalThis.setTimeout(() => this.chord.onStateTransition(state, physics), 280)
      return
    }

    this.drum.onStateTransition(state, physics)
    this.bass.onStateTransition(state, physics)
    this.melody.onStateTransition(state, physics)
    this.texture.onStateTransition(state, physics)
    this.chord.onStateTransition(state, physics)
  }

  /** Prime one audible frame after a forced startup transition. */
  primeFrame(physics: PhysicsState, organism: OrganismState): void {
    this.lastPhysics = physics
    this.lastOrganism = organism
    this.lastFrameTime = 0
    this.onFrame(physics, organism)
  }

  /** Rebuild only the melody against the current rhythm/harmony. */
  regenerateMelody(): void {
    if (!this.lastPhysics) return
    const state = this.lastOrganism?.current ?? OState.Flow
    this.melody.onStateTransition(state, this.lastPhysics)
  }

  lockChordProgression(): void  { this.chord.lockProgression() }
  unlockChordProgression(): void { this.chord.unlockProgression() }

  setInstrumentPerformer(
    role: 'lead' | 'bass' | 'chord',
    instrumentId: InstrumentPerformerId | null,
  ): void {
    if (role === 'lead') {
      this.melody.setInstrumentPerformer(instrumentId)
      return
    }
    if (role === 'bass') {
      this.bass.setInstrumentPerformer(instrumentId)
      return
    }
    this.chord.setInstrumentPerformer(instrumentId)
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
    // Feed performer features to melody/chord generators for intelligent dynamics
    if (this.melodyEnabled) this.melody.setPerformerFeatures(
      performer.energy,
      performer.spectralBrightness,
      performer.syllabicRate,
    )
    if (this.chordEnabled) this.chord.setPerformerEnergy(performer.energy)

    // Performer adjustments are computed as FRESH multipliers each frame —
    // they do NOT compound on top of stored multipliers.

    // 1. Energy → kick punch + melody presence
    const energyBias = 0.7 + performer.energy * 0.6   // 0.7–1.3
    const kickMult = Math.min(
      1.4,
      this.kickVelocityMultiplier * this.reactiveKickVelocityMultiplier * energyBias,
    )
    this.drum.setKickVelocityMultiplier(kickMult)

    const melodyEnergy = Math.min(1.2, 0.8 + performer.energy * 0.4)

    // 2. Syllabic rate → hi-hat density
    const normalSyllabic = Math.min(1, performer.syllabicRate / 8)
    const hatPerformance = Math.max(0.35, Math.min(1.35, 0.55 + normalSyllabic * 0.75))
    this.drum.setHatDensityMultiplier(
      this.hatDensityMultiplier * this.reactiveHatDensityMultiplier * hatPerformance,
    )

    // 3. Breathing / rest → call-and-response
    // Melody volume is computed ONCE per frame combining energy + breathing.
    // Previous code wrote melody gain twice per frame, interrupting the 100ms
    // ramp each time and causing crackling/distortion.
    const breathingBoost = performer.breathingNow ? 1.2 : 1.0
    const melodyTarget = Math.min(1.85,
      this.melodyVolumeMultiplier * this.reactiveMelodyVolumeMultiplier * melodyEnergy * breathingBoost
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

    // ── Producer mix targets ───────────────────────────────────────────────
    // Apply tiny, bounded trims so WebEar/self-listen can keep the beat in a
    // usable reference range without fighting the user's base controls.
    const lowWeight = report.bandEnergy.sub + report.bandEnergy.bass
    const highWeight = report.bandEnergy.high
    const lowMidWeight = report.bandEnergy.lowMid + report.bandEnergy.highMid

    if (lowWeight > 0.72) {
      this.reactiveBassVolumeMultiplier = Math.max(0.82, this.reactiveBassVolumeMultiplier * 0.96)
      this.reactiveKickVelocityMultiplier = Math.max(0.86, this.reactiveKickVelocityMultiplier * 0.98)
    } else if (lowWeight < 0.28 && report.rmsDb < -14) {
      this.reactiveBassVolumeMultiplier = Math.min(1.16, this.reactiveBassVolumeMultiplier * 1.02)
    } else {
      this.reactiveBassVolumeMultiplier += (1.0 - this.reactiveBassVolumeMultiplier) * 0.06
      this.reactiveKickVelocityMultiplier += (1.0 - this.reactiveKickVelocityMultiplier) * 0.06
    }

    if (highWeight > 0.32 || report.spectralCentroidHz > 6500) {
      this.reactiveHatDensityMultiplier = Math.max(0.72, this.reactiveHatDensityMultiplier * 0.95)
      this.reactiveMelodyVolumeMultiplier = Math.max(0.86, this.reactiveMelodyVolumeMultiplier * 0.98)
    } else if (lowMidWeight > 0.55 && report.spectralCentroidHz < 1400) {
      this.reactiveMelodyVolumeMultiplier = Math.min(1.12, this.reactiveMelodyVolumeMultiplier * 1.02)
      this.reactiveHatDensityMultiplier = Math.min(1.08, this.reactiveHatDensityMultiplier * 1.01)
    } else {
      this.reactiveHatDensityMultiplier += (1.0 - this.reactiveHatDensityMultiplier) * 0.06
      this.reactiveMelodyVolumeMultiplier += (1.0 - this.reactiveMelodyVolumeMultiplier) * 0.06
    }

    this.drum.setHatDensityMultiplier(this.hatDensityMultiplier * this.reactiveHatDensityMultiplier)
    this.drum.setKickVelocityMultiplier(this.kickVelocityMultiplier * this.reactiveKickVelocityMultiplier)

    // Frequency balance and diagnostics are logged only in development
    // to prevent console.info from blocking the main thread (1-2ms per call)
    // and stealing time from the audio scheduler.
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      if (lowWeight > 0.7) {
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
    this.drum.setHatDensityMultiplier(this.hatDensityMultiplier * this.reactiveHatDensityMultiplier)
  }

  setKickVelocityMultiplier(multiplier: number): void {
    this.kickVelocityMultiplier = Math.max(0, multiplier)
    this.drum.setKickVelocityMultiplier(this.kickVelocityMultiplier * this.reactiveKickVelocityMultiplier)
  }

  setBassVolumeMultiplier(multiplier: number): void {
    this.bassVolumeMultiplier = Math.max(0, multiplier)
    this.bass.applyVolumeMultiplier(
      this.bassVolumeMultiplier * this.reactiveBassVolumeMultiplier * this.selfListenGainCorrection,
    )
  }

  setMelodyPitchOffset(semitones: number): void {
    this.melodyPitchOffset = Math.round(semitones)
    this.melody.applyPitchOffset(semitones)
  }

  setMelodyVolumeMultiplier(multiplier: number): void {
    this.melodyVolumeMultiplier = Math.max(0, multiplier)
    this.melody.applyVolumeMultiplier(
      this.melodyVolumeMultiplier * this.reactiveMelodyVolumeMultiplier * this.selfListenGainCorrection,
    )
  }

  setTextureVolumeMultiplier(multiplier: number): void {
    this.textureVolumeMultiplier = Math.max(0, multiplier)
    this.texture.applyVolumeMultiplier(
      this.textureEnabled ? this.textureVolumeMultiplier * this.reactiveTextureVolumeMultiplier : 0,
    )
  }

  applyReactiveMultipliers(output: {
    hatDensityMultiplier?: number
    kickVelocityMultiplier?: number
    bassVolumeMultiplier?: number
    melodyPitchOffsetSemitones?: number
    melodyVolumeMultiplier?: number
    textureVolumeMultiplier?: number
  }): void {
    this.reactiveHatDensityMultiplier = Math.max(0, output.hatDensityMultiplier ?? 1)
    this.reactiveKickVelocityMultiplier = Math.max(0, output.kickVelocityMultiplier ?? 1)
    this.reactiveBassVolumeMultiplier = Math.max(0, output.bassVolumeMultiplier ?? 1)
    this.reactiveMelodyVolumeMultiplier = Math.max(0, output.melodyVolumeMultiplier ?? 1)
    this.reactiveTextureVolumeMultiplier = Math.max(0, output.textureVolumeMultiplier ?? 1)

    this.drum.setHatDensityMultiplier(this.hatDensityMultiplier * this.reactiveHatDensityMultiplier)
    this.drum.setKickVelocityMultiplier(this.kickVelocityMultiplier * this.reactiveKickVelocityMultiplier)
    this.bass.applyVolumeMultiplier(
      this.bassVolumeMultiplier * this.reactiveBassVolumeMultiplier * this.selfListenGainCorrection,
    )
    this.melody.applyVolumeMultiplier(
      this.melodyVolumeMultiplier * this.reactiveMelodyVolumeMultiplier * this.selfListenGainCorrection,
    )
    this.texture.applyVolumeMultiplier(
      this.textureEnabled ? this.textureVolumeMultiplier * this.reactiveTextureVolumeMultiplier : 0,
    )

    if (output.melodyPitchOffsetSemitones != null) {
      this.setMelodyPitchOffset(output.melodyPitchOffsetSemitones)
    }
  }

  /** Enable or disable individual generators — disabled generators stop their
   *  Tone.Part immediately and skip onStateTransition until re-enabled.
   *  Re-enabling replays the current organism state so the generator restarts.
   *  All methods are idempotent — calling with the same value twice is a no-op. */
  private drumEnabled:   boolean = true
  private bassEnabled:   boolean = true
  private melodyEnabled: boolean = true
  private chordEnabled:  boolean = true

  private replayStateToGenerator(generator: { onStateTransition: (to: OState, physics: PhysicsState) => void }): void {
    if (!this.lastPhysics || !this.lastOrganism) return
    generator.onStateTransition(this.lastOrganism.current, this.lastPhysics)
  }

  setDrumEnabled(enabled: boolean): void {
    if (this.drumEnabled === enabled) return
    this.drumEnabled = enabled
    this.drum.setEnabled(enabled)
    if (enabled) this.replayStateToGenerator(this.drum)
  }

  setBassEnabled(enabled: boolean): void {
    if (this.bassEnabled === enabled) return
    this.bassEnabled = enabled
    this.bass.setEnabled(enabled)
    if (enabled) setTimeout(() => this.replayStateToGenerator(this.bass), 50)
  }

  setMelodyEnabled(enabled: boolean): void {
    if (this.melodyEnabled === enabled) return
    this.melodyEnabled = enabled
    this.melody.setEnabled(enabled)
    if (enabled) setTimeout(() => this.replayStateToGenerator(this.melody), 120)
  }

  setChordEnabled(enabled: boolean): void {
    if (this.chordEnabled === enabled) return
    this.chordEnabled = enabled
    this.chord.setEnabled(enabled)
    if (enabled) setTimeout(() => this.replayStateToGenerator(this.chord), 180)
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
      // Silence drums, bass, texture — kill BOTH arrangement and volume chains
      // so a quiet arrangement section can't leave melody muted alongside them.
      this.drum.applyArrangementMultiplier(0)
      this.bass.applyArrangementMultiplier(0)
      this.texture.applyArrangementMultiplier(0)
      this.texture.applyVolumeMultiplier(0)
      // Force melody and chord arrangement multipliers ON — otherwise an
      // arrangement section that had melody at 0 would keep it muted until
      // the next bar boundary.
      this.melody.applyArrangementMultiplier(1)
      this.chord.applyArrangementMultiplier(0.5)
      this.melody.applyVolumeMultiplier(Math.min(1.4, this.melodyVolumeMultiplier * 1.2))
      this.chord.applyVolumeMultiplier(0.5)
    } else {
      // Restore — clear arrangement caches so applyArrangement re-evaluates.
      this.drum.applyArrangementMultiplier(1.0)
      this.bass.applyArrangementMultiplier(1.0)
      this.texture.applyArrangementMultiplier(1.0)
      this.melody.applyArrangementMultiplier(1.0)
      this.chord.applyArrangementMultiplier(1.0)
      if (this.textureEnabled) this.texture.applyVolumeMultiplier(this.textureVolumeMultiplier)
      this.melody.applyVolumeMultiplier(this.melodyVolumeMultiplier)
      this.chord.applyVolumeMultiplier(1.0)
    }
    // Force applyArrangement to re-evaluate on next bar so multipliers
    // converge to the current section.
    this.lastArrangementBar = -1
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

  disconnectDrumOutput(destination: Tone.InputNode): void {
    this.drum.output.disconnect(destination)
  }

  connectBassOutput(destination: Tone.InputNode): void {
    this.bass.output.connect(destination)
  }

  disconnectBassOutput(destination: Tone.InputNode): void {
    this.bass.output.disconnect(destination)
  }

  connectMelodyOutput(destination: Tone.InputNode): void {
    this.melody.output.connect(destination)
  }

  disconnectMelodyOutput(destination: Tone.InputNode): void {
    this.melody.output.disconnect(destination)
  }

  connectTextureOutput(destination: Tone.InputNode): void {
    this.texture.output.connect(destination)
  }

  disconnectTextureOutput(destination: Tone.InputNode): void {
    this.texture.output.disconnect(destination)
  }

  connectChordOutput(destination: Tone.InputNode): void {
    this.chord.output.connect(destination)
  }

  disconnectChordOutput(destination: Tone.InputNode): void {
    this.chord.output.disconnect(destination)
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

    // Process only enabled generators — disabled ones have no Tone.Part
    // and no scheduled notes, so running their frame logic wastes CPU.
    if (this.drumEnabled)   this.drum.processFrame(physics, organism)
    if (this.bassEnabled)   this.bass.processFrame(physics, organism)
    if (this.melodyEnabled) this.melody.processFrame(physics, organism)
    this.texture.processFrame(physics, organism)
    if (this.chordEnabled)  this.chord.processFrame(physics, organism)

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
    this.bass.setSubGenre(subGenre)

    // Rebuild drum pattern with sub-genre-specific variant.
    // force=true bypasses the 500ms throttle so a preset's subgenre pattern
    // always wins even when called immediately after a state-transition rebuild.
    // The drumEnabled gate ensures sub-genre changes can't resurrect drums the
    // user has soloed off — DrumGenerator.loadGeneratedPattern enforces the
    // same invariant, this is belt-and-suspenders.
    if (this.drumEnabled) {
      const drumPattern = buildSubGenrePattern(subGenre)
      this.drum.loadGeneratedPattern(drumPattern.hits, true)
    }

    // Bass is rebuilt immediately above so the rhythm section changes as one.

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
    if (!this.arrangementEnabled) return
    // Solo-lock: pattern mutation must not resurrect disabled drums.
    if (!this.drumEnabled) return

    // Mutate current drum pattern
    const state = this.director.getState()
    const pattern = buildSubGenrePattern(state.subGenre, state.drums.variantIndex)
    const mutated = mutatePattern(pattern.hits, {
      ghostProbability: 0.08,
      dropProbability: 0,
      shiftProbability: 0,
      velocitySpread: 0.04,
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
        // Include technique and articulation state for UI sync
        chordTechnique: this.chord.getTechnique(),
        melodyArticulation: this.melody.getArticulation(),
        bassArticulation: this.bass.getArticulation(),
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

  /**
   * Producer-style arrangement flourishes fired on section entry.
   *
   *   build      → riser sweeps up over the section, peaks at the drop
   *   drop       → cinematic impact hit (sub boom + cymbal splash) on bar 1
   *   drop2      → second impact, slightly softer than the first
   *   breakdown  → riser cancelled implicitly (its tail-off is < 200ms)
   *   intro/verse → nothing, lets the groove breathe
   *
   * All timings derive from BPM so the riser climaxes precisely when the drop
   * enters. Skipped in melodyOnlyMode (freestyle) where flourishes would compete
   * with vocal performance, and skipped if the drum kit is soloed off.
   */
  private fireSectionFx(sectionName: string, bpm: number): void {
    if (this.melodyOnlyMode) return
    if (!this.arrangementEnabled) return

    const beatSec = 60 / Math.max(40, bpm)
    const barSec  = beatSec * 4   // assumes 4/4 — matches the rest of the engine

    switch (sectionName) {
      case 'build': {
        // Build is 4 bars in PRODUCER_ARRANGEMENT; sweep across the whole thing.
        if (this.textureEnabled) {
          // If texture is off (default for hip-hop), enable just for the riser duration.
          this.texture.triggerRiser(barSec * 4)
        } else {
          // Force-enable for the sweep, then auto-silence via the riser's own
          // tail-off ramp (it returns to gain=0 ~150ms after peak).
          this.texture.setEnabled(true)
          this.texture.triggerRiser(barSec * 4)
        }
        break
      }
      case 'drop':
      case 'drop2': {
        // Schedule impact ~10ms after the bar boundary so the hit lands
        // simultaneously with the first kick of the drop.
        if (this.drumEnabled) {
          const impactTime = Tone.now() + 0.01
          const vel = sectionName === 'drop' ? 0.98 : 0.88
          this.drum.triggerImpact(impactTime, vel)
        }
        break
      }
      // intro / verse / breakdown intentionally have no flourish — they're
      // the negative space that makes the drops feel earned.
    }
  }

  /** Reads the current Transport bar and applies arrangement section multipliers. */
  private applyArrangement(): void {
    if (!this.arrangementEnabled || !this.running) return

    if (this.melodyOnlyMode) {
      this.drum.applyArrangementMultiplier(0)
      this.bass.applyArrangementMultiplier(0)
      this.texture.applyArrangementMultiplier(0)
      this.melody.applyArrangementMultiplier(1)
      this.chord.applyArrangementMultiplier(0.5)
      return
    }

    // Get current bar from Tone.js Transport
    const transport = Tone.getTransport()
    const position  = transport.position as string  // "bars:beats:16ths"
    const barNumber = parseInt(position.split(':')[0], 10) || 0

    // Only update when bar changes
    if (barNumber === this.lastArrangementBar) return
    this.lastArrangementBar = barNumber

    const { slot: section, cycleBar, sectionBar } = getProducerArrangementSlot(barNumber)

    // Merge AI directive if one was buffered for this section
    const aiOverride = this.aiDirectiveOverrides.get(section.name)
    const musicalState = this.director.getState()
    const scoreSubGenre = aiOverride?.subGenre ?? musicalState.subGenre
    const scoreEnergy = aiOverride?.energy ?? musicalState.energy
    const scoreGroove = aiOverride?.groove ?? scoreSubGenre

    const conductor = getConductor()
    conductor.setSubGenre(scoreSubGenre)
    // OrganismMode drives the bank picker's mood scoring. Fall back to
    // 'smoke' (neutral) if physics isn't seeded yet.
    const physicsMode = this.lastPhysics ? this.lastPhysics.mode.toString() : 'smoke'
    conductor.setMode(physicsMode)
    conductor.updateScoreContext({
      bar: barNumber,
      bpm: transport.bpm.value,
      section: section.name,
      energy: scoreEnergy,
      density: musicalState.density,
      groove: scoreGroove,
      mood: scoreSubGenre,
      mode: physicsMode,
    })

    // Bar tick — advance the conductor's chord position, OR pick a fresh
    // progression if the arrangement just entered a new section. Both
    // paths fire onChordChange so Bass/Melody re-sync; doing only one
    // avoids firing two chord-change events on the same bar.
    // lastArrangementBar only moves when barNumber changes (guard above),
    // so this runs exactly once per new bar.
    const sectionChanging = section.name !== this.lastArrangementSection
    if (sectionChanging) {
      conductor.pickNewProgression()
    } else {
      conductor.advanceChord()
    }

    const drumsMultiplier = aiOverride ? aiOverride.drumsArrangement : section.drums
    const bassMultiplier  = aiOverride ? aiOverride.bassVolume        : section.bass
    const melodyMultiplier = aiOverride ? aiOverride.melodyVolume     : section.melody

    this.drum.applyArrangementMultiplier(drumsMultiplier)
    this.bass.applyArrangementMultiplier(bassMultiplier)
    this.melody.applyArrangementMultiplier(melodyMultiplier)
    this.texture.applyArrangementMultiplier(this.textureEnabled ? section.texture : 0)
    this.chord.applyArrangementMultiplier(section.chord)

    if (aiOverride) {
      this.drum.setHatDensityMultiplier(this.hatDensityMultiplier * aiOverride.hatDensity)
      this.drum.setKickVelocityMultiplier(this.kickVelocityMultiplier * aiOverride.kickPunch)
    }

    // Notify on section change: swap instrument voices + dispatch event
    if (section.name !== this.lastArrangementSection) {
      this.lastArrangementSection = section.name
      orgLog('arrangement:apply', {
        section: section.name,
        bar: barNumber,
        cycleBar,
        drums: drumsMultiplier,
        bass: bassMultiplier,
        melody: melodyMultiplier,
        aiDirected: Boolean(aiOverride),
      })

      // Shift melody density and chord technique per section.
      // Staggered so Part rebuilds don't collide on the audio thread.
      setTimeout(() => this.melody.onSectionChange(section.name), 80)
      setTimeout(() => {
        if (aiOverride?.chordTechnique) {
          this.chord.onSectionChange(section.name, aiOverride.chordTechnique)
        } else {
          this.chord.onSectionChange(section.name)
        }
      }, 160)

      // ── Arrangement primitives ──────────────────────────────────
      // Producer-style flourishes that turn the loop into a song.
      // Routed through the existing drum/texture channels so they inherit
      // the channel-strip EQ + compressor + the new MasterBus chain.
      this.fireSectionFx(section.name, transport.bpm.value)

      window.dispatchEvent(new CustomEvent('organism:section-change', {
        detail: {
          section:    section.name,
          physics:    this.lastPhysics,
          bpm:        transport.bpm.value,
          subGenre:   this.director.getState().subGenre,
          barInCycle: cycleBar,
          barInSection: sectionBar,
          totalBars:  this.arrangementTotalBars,
          aiDirected: Boolean(aiOverride),
        },
      }))
    }
  }

  /**
   * Buffer an AI-produced directive for a named section.
   * Called by AIDirector after a successful /api/ai/next-section response.
   * The values are applied the next time applyArrangement() enters that section.
   */
  setNextSectionDirective(directive: import('../AIDirector').AIBeatDirective): void {
    const subGenre = this.normalizeAceSubGenre(directive.subGenre)
    this.aiDirectiveOverrides.set(directive.section, {
      drumsArrangement: directive.drums.arrangement,
      bassVolume:       directive.bass.volume,
      melodyVolume:     directive.melody.volume,
      chordTechnique:   directive.melody.chordTechnique,
      hatDensity:       directive.drums.hat,
      kickPunch:        directive.drums.kick,
      energy:           directive.energy,
      subGenre,
      groove:           directive.groove,
    })
  }

  private normalizeAceSubGenre(subGenre: import('../AIDirector').AIBeatDirective['subGenre']): HipHopSubGenre {
    if (subGenre === 'afrobeats') return 'afrobeat'
    if (subGenre === 'r&b-soul') return 'chill'
    return subGenre
  }

  /** Discard all buffered AI section directives (call on stop/reset so stale overrides
   *  from a previous session don't silence generators in the next session). */
  clearAIDirectives(): void {
    this.aiDirectiveOverrides.clear()
  }

  /** Load an AI-generated drum pattern into the drum generator (Gap 2). */
  loadGeneratedDrumPattern(hits: import('./types').DrumHit[], force = false): void {
    this.drum.loadGeneratedPattern(hits, force)
  }

  /** Immediate vocal-response drum pulse for the WOW layer. */
  triggerWowDrumPulse(instrument: import('./types').DrumInstrument, velocity = 0.75): void {
    this.drum.triggerImmediateHit(instrument, velocity)
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
    // Conductor must track the detected key too — before Phase 4 it stayed at
    // its default 'C' regardless of vocal pitch, which meant bass and melody
    // (which already read Conductor) were silently locked to C. Re-voices the
    // active progression so harmony pitches up/down with the detected key.
    getConductor().setKeyByPitchClass(rootPitchClass)
  }

  /**
   * Apply an emotional intent across the melody + chord layer. The melody
   * generator handles its own scale/velocity/duration shaping; we route the
   * chord technique here so 'beautiful' gets rolled chords without callers
   * having to know about both subsystems.
   *
   *   'sad' / 'melancholy' → natural-minor melody, velocity 0.4-0.6, legato.
   *   'beautiful' / 'lush' → rolled-chord chord technique, melody 7th/9th bias,
   *                          softer velocity ceiling.
   *   null                 → revert all overrides (chord technique reverts to
   *                          its mode-default on the next section change).
   */
  setEmotionalIntent(intent: 'sad' | 'melancholy' | 'beautiful' | 'lush' | null): void {
    // Normalize the user-facing vocabulary into the two internal categories.
    const normalized: 'sad' | 'beautiful' | null =
      intent === 'sad' || intent === 'melancholy' ? 'sad'
      : intent === 'beautiful' || intent === 'lush' ? 'beautiful'
      : null

    this.melody.setEmotionalIntent(normalized)

    if (normalized === 'beautiful') {
      // Rolled piano chords + Maj7/min9 tensions are the signature of lush
      // production. Override flag is true so the section-change auto-default
      // does not stomp on this until the user explicitly clears intent.
      this.chord.setTechnique('piano-rolled-chord')
    } else if (normalized === null) {
      // Let the per-section default chord technique take over again.
      this.chord.resetTechniqueOverride()
    }
    // 'sad' intentionally does not force a chord technique — block chords
    // under a minor-scale legato lead carry the mood without further gilding.
  }

  /** Read current emotional intent (null = neutral). */
  getEmotionalIntent(): 'sad' | 'beautiful' | null {
    return this.melody.getEmotionalIntent()
  }
}
