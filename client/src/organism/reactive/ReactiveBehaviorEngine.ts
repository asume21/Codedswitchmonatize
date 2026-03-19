// Section 05 — Reactive Behavior Engine

import {
  ReactiveConfig,
  ReactiveContext,
  BehaviorOutput,
  NEUTRAL_BEHAVIOR_OUTPUT,
  DEFAULT_REACTIVE_CONFIG,
} from './types'
import { SyllabicBreathing } from './behaviors/SyllabicBreathing'
import { PitchEmpathy }      from './behaviors/PitchEmpathy'
import { PauseResponse }     from './behaviors/PauseResponse'
import { EnergyMirroring }   from './behaviors/EnergyMirroring'
import { TensionRelease }    from './behaviors/TensionRelease'
import { PresenceDucking }   from './behaviors/PresenceDucking'
import type { AnalysisFrame }  from '../analysis/types'
import type { PhysicsState }   from '../physics/types'
import type { OrganismState }  from '../state/types'
import { OState }              from '../state/types'
import type { GeneratorOrchestrator } from '../generators/GeneratorOrchestrator'

export class ReactiveBehaviorEngine {
  private readonly config: ReactiveConfig

  private syllabicBreathing: SyllabicBreathing
  private pitchEmpathy:      PitchEmpathy
  private pauseResponse:     PauseResponse
  private energyMirroring:   EnergyMirroring
  private tensionRelease:    TensionRelease
  private presenceDucking:   PresenceDucking

  private orchestrator: GeneratorOrchestrator | null = null
  private active:       boolean = false

  constructor(config: Partial<ReactiveConfig> = {}) {
    this.config = { ...DEFAULT_REACTIVE_CONFIG, ...config }

    this.syllabicBreathing = new SyllabicBreathing(this.config)
    this.pitchEmpathy      = new PitchEmpathy(this.config)
    this.pauseResponse     = new PauseResponse(this.config)
    this.energyMirroring   = new EnergyMirroring(this.config)
    this.tensionRelease    = new TensionRelease(this.config)
    this.presenceDucking   = new PresenceDucking(this.config)
  }

  wire(orchestrator: GeneratorOrchestrator): void {
    this.orchestrator = orchestrator
  }

  processFrame(
    frame:    AnalysisFrame,
    physics:  PhysicsState,
    organism: OrganismState,
  ): void {
    this.active = organism.current === OState.Flow
    if (!this.active) return

    const ctx: ReactiveContext = {
      frame, physics, organism, now: performance.now()
    }

    const syllabic = this.syllabicBreathing.process(ctx)
    const empathy  = this.pitchEmpathy.process(ctx)
    const pause    = this.pauseResponse.process(ctx)
    const energy   = this.energyMirroring.process(ctx)
    const tension  = this.tensionRelease.process(ctx)
    const ducking  = this.presenceDucking.process(ctx)

    const merged: BehaviorOutput = {
      ...NEUTRAL_BEHAVIOR_OUTPUT,
      hatDensityMultiplier:
        (syllabic.hatDensityMultiplier ?? 1) *
        (ducking.masterDuckMultiplier   ?? 1),

      kickVelocityMultiplier:
        (energy.kickVelocityMultiplier  ?? 1) *
        (tension.kickVelocityMultiplier ?? 1),

      bassVolumeMultiplier:
        (ducking.masterDuckMultiplier   ?? 1),

      melodyPitchOffsetSemitones:
        (empathy.melodyPitchOffsetSemitones ?? 0),

      melodyVolumeMultiplier:
        (pause.melodyVolumeMultiplier   ?? 1) *
        (ducking.masterDuckMultiplier   ?? 1),

      textureVolumeMultiplier:
        (pause.textureVolumeMultiplier  ?? 1) *
        (tension.textureVolumeMultiplier ?? 1) *
        (ducking.masterDuckMultiplier   ?? 1),

      masterDuckMultiplier:
        (ducking.masterDuckMultiplier   ?? 1),
    }

    this.applyToOrchestrator(merged)
  }

  reset(): void {
    this.syllabicBreathing.reset()
    this.pitchEmpathy.reset()
    this.pauseResponse.reset()
    this.energyMirroring.reset()
    this.tensionRelease.reset()
    this.presenceDucking.reset()
    this.active = false
  }

  isActive(): boolean { return this.active }

  // ── Private ────────────────────────────────────────────────────────

  private applyToOrchestrator(output: BehaviorOutput): void {
    if (!this.orchestrator) return

    this.orchestrator.setHatDensityMultiplier(output.hatDensityMultiplier)
    this.orchestrator.setKickVelocityMultiplier(output.kickVelocityMultiplier)
    this.orchestrator.setBassVolumeMultiplier(output.bassVolumeMultiplier)
    this.orchestrator.setMelodyPitchOffset(output.melodyPitchOffsetSemitones)
    this.orchestrator.setMelodyVolumeMultiplier(output.melodyVolumeMultiplier)
    this.orchestrator.setTextureVolumeMultiplier(output.textureVolumeMultiplier)
  }
}
