// Section 04 — Generator Orchestrator

import * as Tone from 'tone'
import { DrumGenerator }    from './DrumGenerator'
import { BassGenerator }    from './BassGenerator'
import { MelodyGenerator }  from './MelodyGenerator'
import { TextureGenerator } from './TextureGenerator'
import type { PhysicsEngine }  from '../physics/PhysicsEngine'
import type { StateMachine }   from '../state/StateMachine'
import type { PhysicsState }   from '../physics/types'
import type { OrganismState }  from '../state/types'
import type { GeneratorOutput } from './types'

export class GeneratorOrchestrator {
  private drum:    DrumGenerator
  private bass:    BassGenerator
  private melody:  MelodyGenerator
  private texture: TextureGenerator

  private lastPhysics:  PhysicsState  | null = null
  private lastOrganism: OrganismState | null = null

  private physicsEngineRef: PhysicsEngine | null = null
  private running: boolean = false

  // Reactive multiplier state (Section 05)
  private hatDensityMultiplier:   number = 1.0
  private kickVelocityMultiplier: number = 1.0
  private bassVolumeMultiplier:   number = 1.0
  private melodyPitchOffset:      number = 0
  private melodyVolumeMultiplier: number = 1.0
  private textureVolumeMultiplier: number = 1.0

  // ── Arrangement state ─────────────────────────────────────────────
  //
  // Cycles through 16-bar arrangement sections to add dynamic variation.
  // Each section shapes which generators are active and at what level.
  //
  //   intro (4 bars)     → drums only, building
  //   verse (4 bars)     → drums + bass
  //   build (4 bars)     → drums + bass + melody
  //   drop  (4 bars)     → everything, full energy
  //   breakdown (2 bars) → bass + texture only (breathing room)
  //   verse2 (4 bars)    → drums + bass + melody variation
  //   drop2  (4 bars)    → everything, peak
  //   outro (2 bars)     → texture fade
  //
  // Total cycle: 28 bars, then repeats.

  private readonly ARRANGEMENT: { name: string; bars: number; drums: number; bass: number; melody: number; texture: number }[] = [
    { name: 'intro',     bars: 4, drums: 1.0, bass: 0.0, melody: 0.0, texture: 0.3 },
    { name: 'verse',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.0, texture: 0.5 },
    { name: 'build',     bars: 4, drums: 1.0, bass: 1.0, melody: 0.8, texture: 0.7 },
    { name: 'drop',      bars: 4, drums: 1.0, bass: 1.0, melody: 1.0, texture: 1.0 },
    { name: 'breakdown', bars: 2, drums: 0.3, bass: 0.7, melody: 0.0, texture: 1.0 },
    { name: 'verse2',    bars: 4, drums: 1.0, bass: 1.0, melody: 0.6, texture: 0.5 },
    { name: 'drop2',     bars: 4, drums: 1.0, bass: 1.0, melody: 1.0, texture: 1.0 },
    { name: 'outro',     bars: 2, drums: 0.5, bass: 0.4, melody: 0.0, texture: 0.8 },
  ]
  private arrangementTotalBars: number = 0
  private arrangementEnabled: boolean = true
  private lastArrangementBar: number = -1

  constructor() {
    this.drum    = new DrumGenerator()
    this.bass    = new BassGenerator()
    this.melody  = new MelodyGenerator()
    this.texture = new TextureGenerator()
    this.arrangementTotalBars = this.ARRANGEMENT.reduce((sum, s) => sum + s.bars, 0)
  }

  // Wire to physics and state machine outputs
  // Call this once after both engines are constructed
  wire(physicsEngine: PhysicsEngine, stateMachine: StateMachine): void {
    // Store reference for density feedback loop (avoids circular import)
    this.physicsEngineRef = physicsEngine

    // Subscribe to physics updates
    physicsEngine.subscribe((physics) => {
      this.lastPhysics = physics
      this.onFrame(physics, this.lastOrganism)
    })

    // Subscribe to organism state updates
    stateMachine.subscribe((organism) => {
      this.lastOrganism = organism
    })

    // Subscribe to transition events
    stateMachine.onTransition((event) => {
      if (!this.lastPhysics) return
      this.drum.onStateTransition(event.to, event.physicsSnapshot)
      this.bass.onStateTransition(event.to, event.physicsSnapshot)
      this.melody.onStateTransition(event.to, event.physicsSnapshot)
      this.texture.onStateTransition(event.to, event.physicsSnapshot)
    })
  }

  async start(): Promise<void> {
    if (this.running) return
    await Tone.start()
    Tone.getTransport().bpm.value = 90
    Tone.getTransport().start()
    this.running = true
  }

  stop(): void {
    Tone.getTransport().stop()
    this.running = false
  }

  reset(): void {
    this.stop()
    this.drum.reset()
    this.bass.reset()
    this.melody.reset()
    this.texture.reset()
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
    this.texture.applyVolumeMultiplier(multiplier)
  }

  // ── Mix engine connection methods (Section 06) ────────────────────

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

  // ── Private ────────────────────────────────────────────────────────

  private onFrame(physics: PhysicsState, organism: OrganismState | null): void {
    if (!organism) return

    // Apply arrangement shaping before processing generators
    this.applyArrangement()

    this.drum.processFrame(physics, organism)
    this.bass.processFrame(physics, organism)
    this.melody.processFrame(physics, organism)
    this.texture.processFrame(physics, organism)

    // Density feedback loop: report generator activity levels to PhysicsEngine
    if (this.physicsEngineRef) {
      this.physicsEngineRef.registerGeneratorLevel(
        this.drum.name,    this.drum.getActivityReport(performance.now()).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.bass.name,    this.bass.getActivityReport(performance.now()).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.melody.name,  this.melody.getActivityReport(performance.now()).activityLevel
      )
      this.physicsEngineRef.registerGeneratorLevel(
        this.texture.name, this.texture.getActivityReport(performance.now()).activityLevel
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
    this.texture.applyArrangementMultiplier(section.texture)
  }
}
