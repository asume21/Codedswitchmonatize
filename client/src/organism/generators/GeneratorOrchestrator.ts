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
import type { GeneratorOutput, MelodyBehavior } from './types'
import { MusicalDirector }     from '../state/MusicalDirector'
import type { MusicalState, HipHopSubGenre } from '../state/MusicalState'
import { getProducerArrangementTotalBars, getProducerArrangementSlot, setArrangementFromPlan, clearArrangementFromPlan } from '../state/ProducerArrangement'
import { buildSubGenrePattern, mutatePattern, swingForSubGenre } from './patterns/DrumPatternLibrary'
import { setBassSwingFromSubGenre } from './patterns/BassPatternLibrary'
import { orgLog } from '../../lib/perf/organismLog'
import type { InstrumentPerformerId } from '../performers'
import { reseedPerformerSelection } from '../performers'
import { getConductor } from '../conductor/Conductor'
import { planAnswer, type DuetCue } from '../conductor/duet'
import type { PerformerState } from '../audio/types'
import { loadRealInstruments } from '../instruments/realInstruments'
import type { ArrangementPlan } from '@shared/arrangement'
import type { LoopPack, LoopClip } from '@shared/loopPack'
import { GeneratorBase } from './GeneratorBase'
import type { GeneratorEvent } from '../session/types'

/** The five loop "rows" the arranger controls — matches LoopPack.loops keys
 *  and the orchestrator's five generators. */
export type LoopInstrument = 'drums' | 'bass' | 'melody' | 'chords' | 'texture'

/** One clip id per row, or null = that row is muted (silent) this section.
 *  Produced by the AI arranger (server/services/loopMind.ts) per section. */
export type LoopScene = Record<LoopInstrument, string | null>
import { getStylePreset } from '@shared/stylePresets'
import { requestTransportStart, requestTransportStop } from '../../lib/transportController'
import { useStudioStore } from '../../stores/useStudioStore'

export class GeneratorOrchestrator {
  private drum:    DrumGenerator
  private bass:    BassGenerator
  private melody:  MelodyGenerator
  private texture: TextureGenerator
  private chord:   ChordGenerator

  private lastPhysics:  PhysicsState  | null = null
  private lastOrganism: OrganismState | null = null
  private generatorEventCallbacks: Set<(event: GeneratorEvent) => void> = new Set()

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
  // Part 2: the reactive*Multiplier and selfListenGainCorrection fields are gone.
  // The MixEngine owns the mix; generator volume = the user/base multiplier only.

  // ── The Duet (Part 3) — call-and-response state ───────────────────
  // The band answers the MC in the gaps of the flow. The Conductor's planAnswer()
  // is pure; the orchestrator owns the edge-detect + throttle timing here.
  private duetEnabled: boolean = true
  private duetWasBreathing: boolean = false
  private duetLastAnswerMs: number = 0

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

  private get arrangementTotalBars(): number { return getProducerArrangementTotalBars() }
  // Song Mode switch — OFF by default (switches-not-modes design): the
  // Organism is a steady beat machine; sections/builds/drops are opt-in.
  private arrangementEnabled: boolean = false
  private lastArrangementBar: number = -1
  private lastArrangementSection: string = ''
  private lastPlanSectionLoadBar: number = -1
  private scheduledBreakEventIds: number[] = []
  private lastScheduledBreakBar: number = -1

  // ── Loop Pack ─────────────────────────────────────────────────────
  // BPM saved before the pack locks the Transport tempo so clearLoopPack can
  // restore exactly the session BPM the user had before engaging Loops Mode.
  private _preLockBpm: number | null = null

  // ── Progressive Intro ─────────────────────────────────────────────
  // Musician-style instrument stacking: instead of every generator entering
  // at bar 1, they layer in over the first 6 bars so the listener hears the
  // "idea" first (melody solo), then harmony, then bass, then drums.
  // Only applies when arrangementEnabled === false (jam mode).
  private progressiveIntroEnabled: boolean = true
  private introStartBar: number = -1

  private static readonly INTRO_STACK: ReadonlyArray<{
    atBar: number; drum: number; bass: number; chord: number; melody: number
  }> = [
    // Bar 0-1: melody + chords play alone — the idea, the seed
    { atBar: 0, drum: 0.0, bass: 0.0, chord: 1.0, melody: 1.0 },
    // Bar 2-3: bass enters — the foundation grounds the melody
    { atBar: 2, drum: 0.0, bass: 0.9, chord: 1.0, melody: 1.0 },
    // Bar 4-5: drums enter softly — the pulse begins
    { atBar: 4, drum: 0.5, bass: 1.0, chord: 1.0, melody: 1.0 },
    // Bar 6+: full groove — everything playing and building
    { atBar: 6, drum: 1.0, bass: 1.0, chord: 1.0, melody: 1.0 },
  ]

  // AI Director overrides — keyed by section name, applied next time that section starts
  private aiDirectiveOverrides: Map<string, {
    drumsArrangement: number; bassVolume: number; melodyVolume: number; melodyBehavior?: MelodyBehavior; chordTechnique: string
    hatDensity: number; kickPunch: number; energy: number; subGenre: HipHopSubGenre; groove: string
  }> = new Map()

  // Chord-awareness bridge: unsub stored for dispose()
  private unsubChordBridge: (() => void) | null = null
  // Style-change bridge (composer → conductor → generators)
  private unsubStyle: (() => void) | null = null

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

    const emitGeneratorEvent = (event: GeneratorEvent) => {
      this.generatorEventCallbacks.forEach(cb => cb(event))
    }
    ;[this.drum, this.bass, this.melody, this.texture, this.chord]
      .forEach(g => g.setGeneratorEventSink(emitGeneratorEvent))

    // Load real recorded multisamples (Sonatina / VCSL / SK pianos) and upgrade
    // the chord + melody voices from thin GM soundfonts to real samples the
    // moment the catalog resolves. Falls back to GM if the fetch fails.
    void loadRealInstruments().then(() => this.refreshInstrumentVoices())

    // Phase 4: Conductor is the chord source of truth. Bass + Melody self-
    // subscribe to conductor.onChordChange in their constructors; the only
    // consumer wired here is the Director, which still accepts the
    // ChordEvent shape — we translate ParsedChord → ChordEvent at the
    // boundary. The Conductor's chord-change events fire from the orchestrator's
    // JS-thread bar tick (applyArrangement) and from setKey/setSubGenre paths,
    // never from inside an audio-thread Tone.Part callback, so no setTimeout
    // defer is needed.
    const conductor = getConductor()

    // Subscribe to style changes from the Conductor. When the composer's
    // plan section carries a `style` field, the Conductor broadcasts the
    // StylePreset id; we apply each slot to the relevant generator. This
    // is what makes the composer's per-section style choice actually reach
    // the band — without this listener, generators stay on their
    // mode-defaults regardless of what the composer wrote.
    this.unsubStyle = conductor.onStyleChange((styleId) => {
      if (!styleId) return
      const preset = getStylePreset(styleId)
      if (!preset) {
        orgLog('style:unknown', { styleId }, 'warn')
        return
      }
      orgLog('style:apply', {
        styleId:     preset.id,
        drumPattern: preset.drumPattern,
        chord:       preset.chordTechnique,
        bass:        preset.bassArticulation,
        melody:      preset.melodyArticulation,
      })
      // Section style presets are AUTOMATIC — they yield to explicit user
      // picks (markAsOverride=false respects the generators' override flags).
      this.setChordTechnique(preset.chordTechnique, false)
      this.setBassArticulation(preset.bassArticulation, false)
      this.setMelodyArticulation(preset.melodyArticulation, false)
      // Drum pattern is keyed by HipHopSubGenre — swap it through the
      // director so drum + groove + arrangement stay in lock-step. But ONLY
      // fire the swap when the drum pattern actually changes; calling
      // forceSubGenre with the current value still triggers a Tone.Part
      // rebuild which collides with the section's own rebuild and creates
      // a brief audio gap right at the section boundary ("sound dies on
      // the pocket"). Idempotency check fixes it cleanly.
      const currentSubGenre = this.director.getState().subGenre
      if (preset.drumPattern !== currentSubGenre) {
        this.director.forceSubGenre(preset.drumPattern as HipHopSubGenre)
      }
    })

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
      const transport = Tone.getTransport()
      const position = transport.position as string
      const barNumber = parseInt(position.split(':')[0], 10) || 0
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
        bpm: transport.bpm.value,
      })

      const conductor = getConductor()
      const subGenreBeforePlanLoad = this.director.getState().subGenre
      let planStyleRebuiltDrums = false

      // In plan mode, the Conductor owns section intent. Load the next plan
      // section before the section-listener drum rebuild so the rebuild uses
      // the new style's drumPattern. If that style change already forced a
      // sub-genre swap, the sub-genre listener rebuilt drums and this listener
      // skips its redundant rebuild.
      const plan = conductor.getActivePlan()
      if (plan) {
        const nextIdx = (conductor.getActiveSectionIndex() + 1) % plan.sections.length
        conductor.loadSection(nextIdx)
        this.lastPlanSectionLoadBar = barNumber
        planStyleRebuiltDrums = this.director.getState().subGenre !== subGenreBeforePlanLoad
      }

      window.dispatchEvent(new CustomEvent('organism:section-change', {
        detail: {
          section,
          subGenre: this.director.getState().subGenre,
          physics: this.lastPhysics,
          bpm: transport.bpm.value,
        },
      }))

      if (!planStyleRebuiltDrums && !this.melodyOnlyMode && this.arrangementEnabled && this.drumEnabled) {
        const state = this.director.getState()
        const pattern = buildSubGenrePattern(state.subGenre, state.drums.variantIndex)
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
        await requestTransportStart()
        this.startedTransport = true
      }
      return
    }
    await Tone.start()

    // Look-ahead controls scheduling headroom. 0.1s caused crackling when 5+
    // generators run simultaneously on a busy dev-mode main thread; 0.25s still
    // underran under load. 0.4s gives the scheduler ample slack so a momentarily
    // busy main thread can't starve the audio render quantum (the main remaining
    // crackle source once clipping is ruled out). For generative/auto playback the
    // extra ~150ms of latency is inaudible; mic-reactive features have their own
    // faster path, so this does not affect responsiveness to the performer.
    Tone.getContext().lookAhead = 0.4

    // Start at 0 dB. The prior pre-mute-to-silence was hiding an initial
    // transient, but when the ramp was skipped it silently bricked audio.
    dest.volume.value = 0

    // BPM is synced from TransportContext via the store (single source of truth).
    // Route through the store so the UI and Transport stay in lock-step.
    if (bpm != null && transport.bpm.value !== bpm) {
      useStudioStore.getState().setBpm(bpm)
    }

    if (!startTransport) {
      return
    }

    // Request a Transport start through the controller — TransportContext, if
    // mounted, owns Tone.Transport and keeps the studio store in sync. When
    // no owner is registered, the controller falls back to Tone directly.
    if (transport.state !== 'started') {
      await requestTransportStart()
      this.startedTransport = true
    }
    this.running = true

    // Push the band-wide swing on start too — onSubGenreChange only fires on
    // a CHANGE, so a preset whose sub-genre matches the director's current
    // state would leave chord/melody swinging by their mode-table fallback
    // while drums swing by sub-genre (the "not playing together" mismatch).
    const startSubGenre = this.director.getState().subGenre
    const startSwing = swingForSubGenre(startSubGenre)
    setBassSwingFromSubGenre(startSubGenre)
    this.chord.setSwing(startSwing)
    this.melody.setSwing(startSwing)

    // Load the initial drum pattern explicitly. With Song Mode (arrangement)
    // off there are no section entries to load it, and onSubGenreChange only
    // fires on a CHANGE — a cold start whose sub-genre matched the director's
    // default produced a fully "active" but silent drum generator.
    if (this.drumEnabled) {
      const startPattern = buildSubGenrePattern(startSubGenre, this.director.getState().drums.variantIndex)
      this.drum.loadGeneratedPattern(startPattern.hits, true)
    }

    // Reset the progressive intro counter so every fresh start replays the
    // instrument-stacking sequence from bar 0.
    this.introStartBar = -1

    // Roll the dice once per start — without this, every cold start played
    // the SAME instrument (deterministic performer scoring), the SAME phrases
    // (deterministic motif seeding), over the SAME default progression.
    reseedPerformerSelection()
    this.melody.reseed()
    getConductor().pickNewProgression()

    if (this._loopPack) {
      ;[this.drum, this.bass, this.melody, this.chord, this.texture]
        .forEach(g => g.setLoopMode(true))
    }
  }

  onGeneratorEvent(callback: (event: GeneratorEvent) => void): () => void {
    this.generatorEventCallbacks.add(callback)
    return () => this.generatorEventCallbacks.delete(callback)
  }

  /**
   * True if THIS orchestrator was the one to start Transport. Stop only
   * requests a Transport stop when this is true, so stopping the Organism
   * doesn't kill a studio playback session that started Transport first.
   */
  private startedTransport: boolean = false

  stop(): void {
    this.running = false
    // Reset Duet edge/throttle so a new session doesn't fire a stale answer.
    this.duetWasBreathing = false
    this.duetLastAnswerMs = 0
    // Silence all generators immediately — continuous sources like the pink
    // noise in TextureGenerator keep producing audio after Transport stops.
    // Silence all generators immediately — continuous sources like the pink
    // noise in TextureGenerator keep producing audio after Transport stops.
    this.texture.reset()
    this.drum.reset()
    this.bass.reset()
    this.melody.reset()
    this.chord.reset()
    ;[this.drum, this.bass, this.melody, this.chord, this.texture]
      .forEach(g => g.stopLoopPlayback())

    // Clear any pending scheduled break events
    const transport = Tone.getTransport()
    this.scheduledBreakEventIds.forEach(id => {
      try { transport.clear(id) } catch { /* */ }
    })
    this.scheduledBreakEventIds = []
    this.lastScheduledBreakBar = -1

    // Single-owner contract: if Organism started Transport, Organism stops it.
    // Without this, generators go silent but Tone.Transport keeps ticking and
    // any leftover scheduled events (Tone.Parts, scheduleRepeat) keep firing
    // in the background — which is exactly what the user described as "I hit
    // stop but the transport kept on going."
    if (this.startedTransport) {
      requestTransportStop()
      this.startedTransport = false
    }
  }

  /**
   * Smoothly ramp BPM to a new value over 0.5 seconds.
   * NOTE: This updates Tone.Transport.bpm directly because the orchestrator
   * may run outside TransportProvider (GlobalOrganismWrapper). Callers should
   * also sync the Zustand store so TransportContext stays consistent.
   */
  setBpm(bpm: number): void {
    // Clamp to the organism's musical range, then route through the store — the
    // single source of truth that also writes Tone.Transport. Previously this set
    // transport.bpm.rampTo() directly, which (a) bypassed the store so UI/organism
    // reads went stale and (b) reintroduced the bpm.rampTo seconds→ticks skew that
    // has silenced audio before (project_organism_silence_audio_routing memory).
    const clamped = Math.max(40, Math.min(200, bpm))
    useStudioStore.getState().setBpm(clamped)
  }

  /** Get current BPM from Tone Transport. */
  getBpm(): number {
    return Tone.getTransport().bpm.value
  }

  /**
   * True while this orchestrator considers itself started. Set imperatively in
   * start()/stop(), so unlike the provider's React-derived isRunningRef it is
   * never transiently clobbered by an unrelated re-render. Used as the reliable
   * re-entry guard for quickStart/swapPreset to prevent a destructive double-start.
   */
  isRunning(): boolean {
    return this.running
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
    this.unsubStyle?.()
    this.unsubDirectorSubGenre?.()
    this.unsubDirectorSection?.()
    this.unsubDirectorMutation?.()
    this.unsubPhysics    = null
    this.unsubOrganism   = null
    this.unsubTransition = null
    this.unsubChordBridge = null
    this.unsubStyle = null
    this.unsubDirectorSubGenre = null
    this.unsubDirectorSection  = null
    this.unsubDirectorMutation = null
    this.director.dispose()

    const transport = Tone.getTransport()
    this.scheduledBreakEventIds.forEach(id => {
      try { transport.clear(id) } catch { /* */ }
    })
    this.scheduledBreakEventIds = []
    this.lastScheduledBreakBar = -1

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
      this.kickVelocityMultiplier * energyBias,
    )
    this.drum.setKickVelocityMultiplier(kickMult)

    // 2. Syllabic rate → hi-hat density
    const normalSyllabic = Math.min(1, performer.syllabicRate / 8)
    const hatPerformance = Math.max(0.35, Math.min(1.35, 0.55 + normalSyllabic * 0.75))
    this.drum.setHatDensityMultiplier(
      this.hatDensityMultiplier * hatPerformance,
    )

    // 3. Breathing / rest — REMOVED (Part 2). Per-frame melody/texture volume
    // writes (and the breathing drum-duck) were mix-fader meddlers that made the
    // band swell and duck on its own. The MixEngine owns the mix now; melody and
    // texture levels are set once via their setters, not per performer frame.

    // 4. Phrase downbeat → accent kick (one-shot, not cumulative)
    if (performer.phraseBar === 0 && performer.phrasePosition < 0.1) {
      this.drum.setKickVelocityMultiplier(Math.min(1.5, kickMult * 1.15))
    }

    // 5. The Duet — answer the MC in the gaps (call-and-response). Distinct from
    // the WOW layer (which mimics beatbox onsets in the drum layer); this is the
    // band's HARMONIC/MELODIC reply, cued by the Conductor.
    this.maybeAnswerInGap(performer)
  }

  /**
   * The Duet decision + execution. The Conductor's planAnswer() decides WHAT to
   * play (and whether now is the moment); the orchestrator owns the rising-edge
   * detection + throttle, and schedules the answer on the next 8th so it lands on
   * the beat, inside the gap.
   */
  private maybeAnswerInGap(performer: PerformerState): void {
    if (!this.duetEnabled) return
    const now = performance.now()
    const cue = planAnswer(performer, {
      wasBreathing:      this.duetWasBreathing,
      msSinceLastAnswer: now - this.duetLastAnswerMs,
    })
    this.duetWasBreathing = performer.breathingNow
    if (!cue) return
    this.duetLastAnswerMs = now
    this.executeDuetCue(cue)
  }

  /** Fire a Duet cue, quantized to the next 8th so the reply lands on the beat. */
  private executeDuetCue(cue: DuetCue): void {
    const fire = (time: number) => {
      if (cue.answer === 'phrase' && this.melodyEnabled) {
        this.melody.triggerAnswerLick(time, cue.velocity)
      } else if (cue.answer === 'stab' && this.chordEnabled) {
        this.chord.triggerAnswerStab(time, cue.velocity)
      }
    }

    const transport = Tone.getTransport()
    if (transport.state === 'started') {
      // Quantize to the next 8th-note boundary (ticks) so the answer is on-grid.
      const ticksPerEighth = transport.PPQ / 2
      const nextEighth = Math.ceil((transport.ticks + 1) / ticksPerEighth) * ticksPerEighth
      try {
        transport.scheduleOnce((time) => fire(time), `${nextEighth}i`)
        return
      } catch { /* scheduling raced a stop — fall through to immediate */ }
    }
    // Transport idle: just answer now (still musical against a held gap).
    fire(Tone.now() + 0.02)
  }

  /**
   * Apply a SelfListenReport — Astutely corrects itself based on what
   * it hears from its own output (powered by WebEar-grade pcmAnalyzer).
   */
  applySelfListenReport(report: import('../audio/types').SelfListenReport): void {
    if (report.isSilent) return  // nothing playing yet

    // Part 2: self-listen is now READ-ONLY ears. The volume-correction and
    // band-balancing WRITE paths were an unstable auto-mix loop (no setpoint →
    // oscillation) that fought the MixEngine. Removed. The report still flows
    // to the HUD / Astutely via the provider's onReport broadcast; only
    // non-audio diagnostics remain here.
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      const lowWeight = report.bandEnergy.sub + report.bandEnergy.bass
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
    this.drum.setHatDensityMultiplier(this.hatDensityMultiplier)
  }

  setKickVelocityMultiplier(multiplier: number): void {
    this.kickVelocityMultiplier = Math.max(0, multiplier)
    this.drum.setKickVelocityMultiplier(this.kickVelocityMultiplier)
  }

  setBassVolumeMultiplier(multiplier: number): void {
    this.bassVolumeMultiplier = Math.max(0, multiplier)
    this.bass.applyVolumeMultiplier(this.bassVolumeMultiplier)
  }

  setMelodyPitchOffset(semitones: number): void {
    this.melodyPitchOffset = Math.round(semitones)
    this.melody.applyPitchOffset(semitones)
  }

  setMelodyVolumeMultiplier(multiplier: number): void {
    this.melodyVolumeMultiplier = Math.max(0, multiplier)
    this.melody.applyVolumeMultiplier(this.melodyVolumeMultiplier)
  }

  setTextureVolumeMultiplier(multiplier: number): void {
    this.textureVolumeMultiplier = Math.max(0, multiplier)
    this.texture.applyVolumeMultiplier(
      this.textureEnabled ? this.textureVolumeMultiplier : 0,
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
    // Part 2: the live mix is owned by MixEngine (mastered channel strips +
    // limiter). The per-frame reactive VOLUME path is removed — it fought the
    // channel strips and oscillated ("everyone in their own direction").
    // Only the non-mix pitch offset is still honored.
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
    this.lastPlanSectionLoadBar = -1
  }

  isMelodyOnly(): boolean { return this.melodyOnlyMode }

  /** Enable/disable the Duet (the band answering the MC in the gaps). On by
   *  default; a UI toggle or a "no interruptions" recording mode can turn it off. */
  setDuetEnabled(enabled: boolean): void {
    this.duetEnabled = enabled
  }

  isDuetEnabled(): boolean { return this.duetEnabled }

  /**
   * Enable musician-style staggered instrument entry for the next start.
   * When true, melody+chords enter first; bass follows at bar 2; drums at bar 4;
   * full groove from bar 6. Disabled instantly restores all multipliers to 1.
   */
  setProgressiveIntroEnabled(enabled: boolean): void {
    if (this.progressiveIntroEnabled === enabled) return
    this.progressiveIntroEnabled = enabled
    this.introStartBar = -1
    if (!enabled && !this.arrangementEnabled && !this.melodyOnlyMode) {
      this.drum.applyArrangementMultiplier(1.0)
      this.bass.applyArrangementMultiplier(1.0)
      this.chord.applyArrangementMultiplier(1.0)
      this.melody.applyArrangementMultiplier(1.0)
    }
  }

  isProgressiveIntroEnabled(): boolean { return this.progressiveIntroEnabled }

  /** Set the emotional intent on the melody — shapes dynamics and scale.
   *  'sad' = natural minor, contained velocity; 'beautiful' = lush 7ths/9ths. */
  setMelodyEmotionalIntent(intent: 'sad' | 'beautiful' | null): void {
    this.melody.setEmotionalIntent(intent)
  }

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

  /**
   * DIAGNOSTIC (read-only): raw output-node gain + arrangement multiplier per
   * generator. Lets __orgDebug split the silence: if `gain` ≈ 0 the signal is
   * zeroed INSIDE the generator (multiplier/output-ramp); if `gain` > 0 yet the
   * channel meter reads −inf, the break is the channel strip / wiring.
   */
  getGainReport(): Record<string, { gain: number; arr: number; on: boolean }> {
    return {
      drum:    { gain: this.drum.output.gain.value,    arr: this.drum.getArrangementMultiplier(),    on: this.drumEnabled },
      bass:    { gain: this.bass.output.gain.value,    arr: this.bass.getArrangementMultiplier(),    on: this.bassEnabled },
      melody:  { gain: this.melody.output.gain.value,  arr: this.melody.getArrangementMultiplier(),  on: this.melodyEnabled },
      chord:   { gain: this.chord.output.gain.value,   arr: this.chord.getArrangementMultiplier(),   on: this.chordEnabled },
      texture: { gain: this.texture.output.gain.value, arr: this.texture.getArrangementMultiplier(), on: this.textureEnabled },
    }
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

  // ── Phase 5: ArrangementPlan ─────────────────────────────────────
  //
  // The Composer (server/services/composer.ts via Ollama, or any future
  // implementation of shared/arrangement.ts:Composer) writes a plan.
  // The plan is then handed to the Conductor here, and to ACE-Step on
  // the render endpoint. Both consume the same artifact so the live
  // performance and the rendered preview can't drift apart musically.

  /**
   * Load an ArrangementPlan. Switches the live engine into plan mode —
   * section transitions advance through `plan.sections` instead of
   * picking from the 176-entry bank. Calling this mid-session is safe;
   * the running progression continues until the next bar boundary, when
   * the section-change handler loads section 0 of the new plan.
   */
  loadArrangementPlan(plan: ArrangementPlan): void {
    getConductor().loadPlan(plan)
    // Make the live arrangement actually FOLLOW the composer's plan: section
    // durations come from plan.sections[].bars and per-channel levels from
    // slotFromPlanSection (energy/density). Without this call the plan only swapped
    // chords while section TIMING + dynamics ran off the generic PRODUCER_ARRANGEMENT
    // skeleton — i.e. "Song Mode" never really played the composed song.
    setArrangementFromPlan(plan.sections)
    // Force the next applyArrangement tick to treat this as a section
    // change so loadSection(0) actually fires through the bar-tick path
    // (the Conductor already loaded section 0 inside loadPlan, but
    // resetting lastArrangementSection ensures any plan-internal state
    // the orchestrator wants to seed on section entry gets a clean run).
    this.lastArrangementSection = ''
    this.lastPlanSectionLoadBar = -1
  }

  /** Drop the active plan and return to jam mode (bank picker). */
  clearArrangementPlan(): void {
    getConductor().clearPlan()
    clearArrangementFromPlan()   // back to the named-template skeleton (jam mode)
    this.lastArrangementSection = ''
    this.lastPlanSectionLoadBar = -1
  }

  /** The currently-loaded plan, or null if the engine is in jam mode. */
  getArrangementPlan(): ArrangementPlan | null {
    return getConductor().getActivePlan()
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
  setChordTechnique(techniqueId: string, markAsOverride: boolean = true): void {
    this.chord.setTechnique(techniqueId, markAsOverride)
  }

  /**
   * Swap the chord voice to a real note-mapped multisample instrument (e.g. a
   * keys style comping on a Soulful Keys e-piano). null reverts to the performer.
   */
  setChordMultisample(noteUrls: Record<string, string> | null): void {
    this.chord.setMultisampleInstrument(noteUrls)
  }

  /**
   * Re-apply the chord + melody performer voices. Called when the real-instrument
   * catalog finishes loading so a voice built on the GM fallback upgrades to its
   * real recorded multisample without waiting for the next section change.
   */
  refreshInstrumentVoices(): void {
    try { this.chord.refreshVoice() } catch { /* */ }
    try { this.melody.refreshVoice() } catch { /* */ }
  }

  /** Get the currently active chord technique id. */
  getChordTechnique(): string {
    return this.chord.getTechnique()
  }

  /**
   * Set melody articulation. Transforms each single-note melody event.
   * Available: 'none' (default), 'legato-slur', 'staccato-pop',
   * 'grace-flick', 'trill-ornament', 'scoop-up', 'fall-off',
   * 'double-tap', 'octave-echo', 'delayed-echo'.
   */
  setMelodyArticulation(articulationId: string, markAsOverride: boolean = true): void {
    this.melody.setArticulation(articulationId, markAsOverride)
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
   * 'bass-octave-jump', 'bass-walking-step', 'bass-pickup',
   * 'bass-muted-pulse', 'bass-octave-walk', 'bass-drop-slide',
   * 'bass-dub-sustain'.
   */
  setBassArticulation(articulationId: string, markAsOverride: boolean = true): void {
    this.bass.setArticulation(articulationId, markAsOverride)
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

    // Live vitals for the on-screen debug HUD (OrganismDebugOverlay).
    this.emitDebugSnapshot(physics, organism, now)
  }

  // ── Director event handlers ────────────────────────────────────────

  /**
   * Called when the MusicalDirector changes sub-genre.
   * Rebuilds drum + bass patterns with the new sub-genre's vocabulary.
   */
  private onSubGenreChange(subGenre: HipHopSubGenre): void {
    // ONE pocket for the whole band: the drum pattern's sub-genre swing is the
    // groove anchor, and bass/chord/melody all swing by that same amount.
    // (Previously chords + melody swung by the physics MODE table and bass
    // stomped its sub-genre swing per state transition — on trap, drums were
    // near-straight at 0.20 while everything else dragged at 0.38, which is
    // why the generators sounded like they weren't playing together.)
    const swing = swingForSubGenre(subGenre)
    setBassSwingFromSubGenre(subGenre)
    this.chord.setSwing(swing)
    this.melody.setSwing(swing)
    this.bass.setSubGenre(subGenre)
    // Tell the drum kit which genre we're in so it re-ranks voice pools
    // by DSP profile score (sub weight, punch, brightness) not hardcoded names.
    this.drum.setGenreTarget(subGenre)

    // Rebuild drum pattern with sub-genre-specific variant.
    // force=true bypasses the 500ms throttle so a preset's subgenre pattern
    // always wins even when called immediately after a state-transition rebuild.
    // The drumEnabled gate ensures sub-genre changes can't resurrect drums the
    // user has soloed off — DrumGenerator.loadGeneratedPattern enforces the
    // same invariant, this is belt-and-suspenders.
    if (this.drumEnabled) {
      const drumPattern = buildSubGenrePattern(subGenre, this.director.getState().drums.variantIndex)
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

  private debugFrameCounter = 0
  /**
   * Emit a live vitals snapshot for the on-screen debug HUD. Throttled to
   * ~4Hz. Lets us watch state / presence / bounce / generator levels in real
   * time so we can SEE why the engine winds down to silence — the state
   * machine drops toward Dormant when (no voice && presence < 0.05 && bounce
   * < 0.3), and Dormant/Awakening makes generators stopPart().
   */
  private emitDebugSnapshot(physics: PhysicsState, organism: OrganismState, now: number): void {
    // DEV-only and self-throttled — zero cost in production, ~4Hz in dev.
    if (!import.meta.env.DEV) return
    this.debugFrameCounter++
    if (this.debugFrameCounter % 4 !== 0) return
    const transport = Tone.getTransport()
    const bar = parseInt((transport.position as string).split(':')[0], 10) || 0
    window.dispatchEvent(new CustomEvent('organism:debug', {
      detail: {
        state:       organism.current,
        running:     this.running,
        transport:   transport.state,
        bar,
        mode:        physics.mode.toString(),
        subGenre:    this.director.getState().subGenre,
        section:     this.lastArrangementSection || 'none',
        presence:    physics.presence,
        bounce:      physics.bounce,
        density:     physics.density,
        voiceActive: physics.voiceActive,
        flowDepth:   organism.flowDepth,
        // destVol is Tone's master destination volume in dB. -Infinity here =
        // global mute → nothing plays regardless of the mix.
        destVol:     Tone.getDestination().volume.value,
        // `out` is each generator's ACTUAL output-node gain (linear). If `lvl`
        // (activity) is high but `out` is ~0, a multiplier (arrangement/volume)
        // is zeroing the signal before it reaches the mixer — that's the silence.
        gens: {
          drum:    { on: this.drumEnabled,    lvl: this.drum.getActivityReport(now).activityLevel,    out: this.drum.output.gain.value },
          bass:    { on: this.bassEnabled,    lvl: this.bass.getActivityReport(now).activityLevel,    out: this.bass.output.gain.value },
          melody:  { on: this.melodyEnabled,  lvl: this.melody.getActivityReport(now).activityLevel,  out: this.melody.output.gain.value },
          chord:   { on: this.chordEnabled,   lvl: this.chord.getActivityReport(now).activityLevel,   out: this.chord.output.gain.value },
          texture: { on: this.textureEnabled, lvl: this.texture.getActivityReport(now).activityLevel, out: this.texture.output.gain.value },
        },
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
    this.director.setArrangementEnabled(enabled)
    orgLog('arrangement:toggle', { enabled })
    if (!enabled) {
      // Clear any pending scheduled break events
      const transport = Tone.getTransport()
      this.scheduledBreakEventIds.forEach(id => {
        try { transport.clear(id) } catch { /* */ }
      })
      this.scheduledBreakEventIds = []
      this.lastScheduledBreakBar = -1

      // Restore full multipliers so the drums don't stay at whatever reduced
      // level the last arrangement section applied.
      this.drum.applyArrangementMultiplier(1.0)
      this.bass.applyArrangementMultiplier(1.0)
      this.melody.applyArrangementMultiplier(1.0)
      this.chord.applyArrangementMultiplier(1.0)
      this.lastArrangementBar = -1
      this.lastArrangementSection = ''
      this.lastPlanSectionLoadBar = -1
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
    // A preset swap is a CLEAN CUT, not a section crossfade. Stop the outgoing
    // preset's parts immediately so they can't keep looping for the ~1–2 bars of
    // the seamless-handoff lead and stack audibly over the incoming preset (the
    // "presets pile over each other" bug on a live swap). The rebuild below then
    // builds fresh parts for the new sub-genre.
    this.cutActivePartsForSwap()
    this.director.forceSubGenre(subGenre)
    this.regenerateAll()
  }

  /**
   * Immediately stop + dispose each pitched/rhythmic generator's current Part.
   * Used ONLY on a live preset swap (swapSubGenre) so the outgoing preset is
   * silenced at once instead of riding the section-change handoff — which holds
   * the old part for ~1–2 bars and makes the old and new presets stack. Section
   * changes still use the seamless crossfade (this is not called there). Texture
   * has no scheduled Part — its cut releases the sustained keys/pad voicing.
   */
  private cutActivePartsForSwap(): void {
    this.drum.stopPart()
    this.bass.stopPart()
    this.melody.stopPart()
    this.chord.stopPart()
    this.texture.stopPart()
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
  private fireSectionFx(sectionName: string, _bpm: number): void {
    if (this.melodyOnlyMode) return
    if (!this.arrangementEnabled) return

    switch (sectionName) {
      // 'build': the rising "woosh" riser was REMOVED (2026-06-22) at the user's
      // request. It read as a random sweep firing mid-performance — worst in
      // boom-bap / lo-fi, where risers simply don't belong — and it force-enabled
      // the texture generator even when the user had turned texture off. The drop
      // impact below is section flourish enough; no synthetic wind sweep.
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
    if (!this.running) return

    // Song Mode OFF = pure beat machine: no section multipliers, no section
    // FX, no plan-section loading — but the HARMONIC clock still beats. The
    // chord advance used to live behind the arrangement gate, so disabling
    // the arrangement froze the progression on one chord forever.
    if (!this.arrangementEnabled) {
      const transport = Tone.getTransport()
      const barNumber = parseInt(String(transport.position).split(':')[0], 10) || 0
      if (barNumber === this.lastArrangementBar) return
      this.lastArrangementBar = barNumber
      // Advance on the bar before each 4-bar boundary so the new harmony
      // lands exactly on the even downbeat (see arrangement path comment).
      if (barNumber % 4 === 3) getConductor().advanceChord()

      // Progressive intro: stagger instrument entry like a real musician building a beat.
      // Only when not in melody-only mode (which has its own multiplier logic).
      if (this.progressiveIntroEnabled && !this.melodyOnlyMode) {
        if (this.introStartBar === -1) this.introStartBar = barNumber
        const barsElapsed = barNumber - this.introStartBar
        const stack = GeneratorOrchestrator.INTRO_STACK
        let stage = stack[0]
        for (const s of stack) {
          if (barsElapsed >= s.atBar) stage = s
        }
        this.drum.applyArrangementMultiplier(stage.drum)
        this.bass.applyArrangementMultiplier(stage.bass)
        this.chord.applyArrangementMultiplier(stage.chord)
        this.melody.applyArrangementMultiplier(stage.melody)
      }
      return
    }

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

    // Schedule 2-beat bar-end break on the final bar of a section — but ONLY
    // when the NEXT section is a real energy lift (a drop). Firing this at
    // every section end dropped the bass out every few seconds once sections
    // are short, which read as "jumping mid-play." Gating it to drops keeps
    // the dramatic pre-drop snare break and lets ordinary section changes
    // cross-fade smoothly at the bar line instead.
    if (sectionBar === section.bars - 1 && this.lastScheduledBreakBar !== barNumber) {
      this.lastScheduledBreakBar = barNumber
      const nextBarNumber = barNumber + 1
      const nextSlotInfo = getProducerArrangementSlot(nextBarNumber)
      const nextSection = nextSlotInfo.slot

      const enteringDrop = nextSection.energy >= 0.9 && nextSection.energy > section.energy + 0.05
      if (enteringDrop) {
      const breakStartId = transport.scheduleOnce((time) => {
        // Bass drops out briefly — the classic hip-hop "snare break" moment.
        // Melody and chords do NOT mute: wiping them caused a jarring complete
        // dropout that interrupted the listener's sense of a continuous melody.
        // The hi-hat roll fill covers the transition; the melodic instruments
        // cross-fade into the next section's levels at the bar boundary instead.
        this.bass.output.gain.setValueAtTime(this.bass.output.gain.value, time)
        this.bass.output.gain.linearRampToValueAtTime(0, time + 0.02)
        this.bass.applyArrangementMultiplier(0)

        // Trigger hi-hat roll fill
        this.drum.triggerBarEndBreakFill(time)
      }, `${barNumber}:2:0`)

      const breakEndId = transport.scheduleOnce((time) => {
        // Clear the hi-hat roll fill
        this.drum.clearBarEndBreakFill()

        // Restore multipliers to next section's values (all instruments)
        this.bass.applyArrangementMultiplier(nextSection.bass)
        this.melody.applyArrangementMultiplier(nextSection.melody)
        this.chord.applyArrangementMultiplier(nextSection.chord)
        this.texture.applyArrangementMultiplier(this.textureEnabled ? nextSection.texture : 0)
      }, `${nextBarNumber}:0:0`)

      this.scheduledBreakEventIds.push(breakStartId, breakEndId)
      }
    }

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

    // Bar tick — advance the conductor's chord position, OR rotate
    // harmony if the arrangement just entered a new section. The rotation
    // path branches on whether an ArrangementPlan is loaded:
    //   - Plan mode: load the next plan section's progression. Conductor
    //     reads `plan.sections[i].progression` as Roman numerals against
    //     `plan.key`, so the live performance follows the same arrangement
    //     ACE-Step rendered from the same plan.
    //   - Jam mode: pick a fresh progression from the 176-entry bank.
    // Either way, exactly one chord-change event fires on a section bar
    // (no advance + pick double-fire).
    const sectionChanging = section.name !== this.lastArrangementSection
    if (sectionChanging) {
      const plan = conductor.getActivePlan()
      if (plan) {
        if (this.lastPlanSectionLoadBar !== barNumber) {
          const nextIdx = (conductor.getActiveSectionIndex() + 1) % plan.sections.length
          conductor.loadSection(nextIdx)
          this.lastPlanSectionLoadBar = barNumber
        }
      } else {
        conductor.pickNewProgression()
      }
    } else if (sectionBar % 4 === 3) {
      // Harmonic rhythm = one chord per FOUR bars. Two-bar changes rebuilt the
      // melody/bass/chord parts every ~3s at trap tempos — no phrase ever
      // completed, producing the "constant restart" feel. Four bars matches
      // real hip-hop pacing: the groove locks in, the melody develops over
      // it, and the chord shift on bar 5 feels like a natural musical breath.
      //
      // Advance on the bar BEFORE the 4-bar boundary (sectionBar % 4 === 3)
      // so generators rebuild on the next processFrame and their new parts
      // land exactly on the even downbeat (getLivePartStart adds one bar of
      // lead). Advancing on the boundary itself shifted the audible chord
      // change a full bar late.
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

    // Composer roles: who plays / how forward this section. Absent orchestration
    // (old plans / jam mode) defaults every instrument to 'support' so behavior
    // matches today minus the full-time-everyone problem.
    const orch = section.orchestration
    this.drum.setRole(orch?.drums ?? 'support')
    this.bass.setRole(orch?.bass ?? 'support')
    this.melody.setRole(orch?.melody ?? 'support')
    this.chord.setRole(orch?.chord ?? 'support')
    this.texture.setRole(orch?.texture ?? 'support')

    if (aiOverride) {
      this.drum.setHatDensityMultiplier(this.hatDensityMultiplier * aiOverride.hatDensity)
      this.drum.setKickVelocityMultiplier(this.kickVelocityMultiplier * aiOverride.kickPunch)
    }

    // Notify on section change: swap instrument voices + dispatch event
    if (section.name !== this.lastArrangementSection) {
      this.lastArrangementSection = section.name
      // If an AI loop arrangement is loaded, swap loops to this section's scene.
      this.applyLoopSceneForSection(section.name)
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
      setTimeout(() => {
        if (aiOverride?.melodyBehavior) {
          this.melody.onSectionChange(section.name, aiOverride.melodyBehavior as any)
        } else {
          this.melody.onSectionChange(section.name)
        }
      }, 80)
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
      melodyBehavior:   directive.melody.behavior as MelodyBehavior,
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

  /**
   * Load a LoopPack: distribute one clip per generator (first clip of each
   * type — V1 selection), lock the Transport BPM to the pack's tempo, and
   * flip all five generators into loop-playback mode.
   */
  async loadLoopPack(pack: LoopPack): Promise<void> {
    // 1. Gather all clips in the pack and warm up the buffer cache in parallel
    const clips: LoopClip[] = []
    const rows: LoopInstrument[] = ['drums', 'bass', 'melody', 'chords', 'texture']
    for (const r of rows) {
      if (pack.loops[r]) {
        clips.push(...pack.loops[r])
      }
    }
    await Promise.all(clips.map(clip => GeneratorBase.getOrCreateBuffer(clip.url).catch(() => null)))

    // 2. Load the baseline first clips into active player slots
    await Promise.all([
      pack.loops.drums[0]   ? this.drum.loadLoop(pack.loops.drums[0])     : Promise.resolve(),
      pack.loops.bass[0]    ? this.bass.loadLoop(pack.loops.bass[0])      : Promise.resolve(),
      pack.loops.melody[0]  ? this.melody.loadLoop(pack.loops.melody[0])  : Promise.resolve(),
      pack.loops.chords[0]  ? this.chord.loadLoop(pack.loops.chords[0])   : Promise.resolve(),
      pack.loops.texture[0] ? this.texture.loadLoop(pack.loops.texture[0]): Promise.resolve(),
    ])

    // Harmonize Conductor key with loop pack key
    if (pack.key) {
      const match = pack.key.match(/^([A-G][#b]?)(m)?$/)
      if (match) {
        const root = match[1]
        try {
          getConductor().setKey(root)
        } catch (e) {
          console.warn('[loops] Failed to set Conductor key to', root, e)
        }
      }
    }

    // Save session BPM before locking to pack tempo so clearLoopPack can restore it
    this._preLockBpm = useStudioStore.getState().bpm ?? Tone.getTransport().bpm.value
    // Lock BPM to the pack — store.setBpm writes Transport too, so no direct
    // transport write is needed (and a direct write would desync the store).
    useStudioStore.getState().setBpm(pack.bpm)
    // Flip all generators to loop playback
    ;[this.drum, this.bass, this.melody, this.chord, this.texture]
      .forEach(g => g.setLoopMode(true))

    // Record what's now playing (clip[0] per row) as the baseline scene, so a
    // subsequent AI arrangement (setLoopArrangement → applyScene) only SWAPS the
    // rows it actually changes. Without this, applyScene treats every row as new
    // and re-starts a second player over the one we just started — a doubled loop.
    this._currentScene = {
      drums:   pack.loops.drums[0]?.id   ?? null,
      bass:    pack.loops.bass[0]?.id    ?? null,
      melody:  pack.loops.melody[0]?.id  ?? null,
      chords:  pack.loops.chords[0]?.id  ?? null,
      texture: pack.loops.texture[0]?.id ?? null,
    }
  }

  /**
   * Exit loop-pack mode: revert all generators to their synthesis engines.
   * Replay the last known organism state to each generator so they rebuild
   * their Tone.Parts / synth scheduling that was stopped when loops were enabled.
   */
  clearLoopPack(): void {
    this._currentScene = null
    this._loopPack = null
    this._loopScenes = null
    ;[this.drum, this.bass, this.melody, this.chord, this.texture]
      .forEach(g => g.unloadLoopPlayback())

    // Restore BPM if we locked it to the pack (store.setBpm writes Transport too)
    if (this._preLockBpm !== null) {
      useStudioStore.getState().setBpm(this._preLockBpm)
      this._preLockBpm = null
    }

    // Replay the last organism/physics state to each generator so they can
    // rebuild their Parts and resume scheduled playback. Stagger slightly to
    // avoid simultaneous Tone.Part rebuild collisions on the audio thread.
    if (this.lastPhysics && this.lastOrganism) {
      // Drum/bass need immediate rebuild; melody/chord slightly later.
      setTimeout(() => this.replayStateToGenerator(this.drum), 40)
      setTimeout(() => this.replayStateToGenerator(this.bass), 60)
      setTimeout(() => this.replayStateToGenerator(this.melody), 120)
      setTimeout(() => this.replayStateToGenerator(this.chord), 160)
      setTimeout(() => this.replayStateToGenerator(this.texture), 80)
    }
  }

  /**
   * Scene control — mute/unmute ONE instrument's loop without stopping it. The
   * player keeps running so it stays phase-locked and drops back in on the grid
   * when unmuted. This is how the arranger layers an instrument in/out per
   * section (e.g. melody out in the intro, in on the drop) with no desync.
   */
  setLoopMute(instrument: LoopInstrument, muted: boolean): void {
    switch (instrument) {
      case 'drums':   this.drum.setLoopMute(muted);    break
      case 'bass':    this.bass.setLoopMute(muted);    break
      case 'melody':  this.melody.setLoopMute(muted);  break
      case 'chords':  this.chord.setLoopMute(muted);   break
      case 'texture': this.texture.setLoopMute(muted); break
    }
  }

  /**
   * Pick a variant clip from a pack pool by index (clamped to the pool), so the
   * arranger can choose loop 2/3/4 instead of always clip[0]. Returns null only
   * if the instrument's pool is empty.
   */
  pickVariant(pack: LoopPack, instrument: LoopInstrument, index: number): LoopClip | null {
    const pool = pack.loops[instrument]
    if (!pool?.length) return null
    return pool[Math.max(0, Math.min(pool.length - 1, index))]
  }

  /** Map a loop row to its generator. */
  private generatorFor(row: LoopInstrument): GeneratorBase {
    switch (row) {
      case 'drums':   return this.drum
      case 'bass':    return this.bass
      case 'melody':  return this.melody
      case 'chords':  return this.chord
      case 'texture': return this.texture
    }
  }

  /** The scene currently playing, so applyScene only swaps rows that changed. */
  private _currentScene: LoopScene | null = null

  /** Next bar boundary as an absolute transport tick — ONE value the whole band
   *  shares so a scene switch flips every row on the exact same beat (no
   *  per-generator @1m desync). Scheduled in ticks, never seconds. */
  private nextSharedBarTick(): string {
    const t = Tone.getTransport()
    const ticksPerBar = t.PPQ * 4 // 4/4
    const nextBar = Math.ceil((t.ticks + 1) / ticksPerBar) * ticksPerBar
    return `${nextBar}i`
  }

  /**
   * Apply an AI-arranged scene: gaplessly swap each row to its assigned loop
   * (only rows whose clip changed) and mute the rows the arranger left null. All
   * swaps land on ONE shared bar tick so the band stays locked. Call from the
   * Conductor's section-change hook with that section's scene.
   */
  async applyScene(pack: LoopPack, scene: LoopScene): Promise<void> {
    const prev = this._currentScene
    const rows = Object.keys(scene) as LoopInstrument[]
    const changed = rows.filter((r) => (!prev || prev[r] !== scene[r]) && scene[r] != null)

    // Preload only the rows whose clip changed — current loops keep playing.
    await Promise.all(changed.map((r) => {
      const clip = (pack.loops[r] ?? []).find((c) => c.id === scene[r])
      return clip ? this.generatorFor(r).preloadNextLoop(clip) : Promise.resolve()
    }))

    // Commit changed rows on one shared tick; set mute state for every row.
    const at = this.nextSharedBarTick()
    for (const row of rows) {
      const gen = this.generatorFor(row)
      if (changed.includes(row)) gen.commitNextLoopAt(at)
      gen.setLoopMute(scene[row] == null)
    }
    this._currentScene = { ...scene }
  }

  // ── AI loop arrangement (loopMind) — scene per section ──────────────────────
  private _loopPack: LoopPack | null = null
  private _loopScenes: Map<string, LoopScene> | null = null

  /**
   * Install an AI-arranged loop plan (from loopMind / POST /api/loops/arrange):
   * a scene per section name. Applies the current section's scene immediately;
   * later sections apply automatically on each section change (see
   * applyArrangement). Call after loadLoopPack when Loops Mode turns on.
   */
  async setLoopArrangement(
    pack: LoopPack,
    arrangement: { sections: Array<{ name: string; scene: LoopScene }> },
  ): Promise<void> {
    this._loopPack = pack
    this._loopScenes = new Map(arrangement.sections.map((s) => [s.name, s.scene]))
    const current = this.lastArrangementSection || arrangement.sections[0]?.name
    const scene = this._loopScenes.get(current) ?? arrangement.sections[0]?.scene
    if (scene) await this.applyScene(pack, scene)
  }

  /** Apply the arranged scene for a section, if a loop arrangement is loaded.
   *  Called from applyArrangement on each section change. */
  private applyLoopSceneForSection(sectionName: string): void {
    if (!this._loopPack || !this._loopScenes) return
    const scene = this._loopScenes.get(sectionName)
    if (scene) void this.applyScene(this._loopPack, scene)
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
