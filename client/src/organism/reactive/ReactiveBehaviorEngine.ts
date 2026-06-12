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
import { StyleShift }        from './behaviors/StyleShift'
import type { EnergyZone }   from './behaviors/StyleShift'
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
  private styleShift:        StyleShift

  private orchestrator: GeneratorOrchestrator | null = null
  private active:       boolean = false
  // Master "React to Voice" switch — OFF by default (switches-not-modes
  // design): the Organism is a steady beat machine unless the user opts in.
  // When off, NO reactive behavior touches the orchestrator: no ducking,
  // no pause-fills, no energy mirroring, no style shifts.
  private enabled: boolean = false
  private styleShiftsEnabled: boolean = false
  private lastZone: EnergyZone | null = null

  constructor(config: Partial<ReactiveConfig> = {}) {
    this.config = { ...DEFAULT_REACTIVE_CONFIG, ...config }

    this.syllabicBreathing = new SyllabicBreathing(this.config)
    this.pitchEmpathy      = new PitchEmpathy(this.config)
    this.pauseResponse     = new PauseResponse(this.config)
    this.energyMirroring   = new EnergyMirroring(this.config)
    this.tensionRelease    = new TensionRelease(this.config)
    this.presenceDucking   = new PresenceDucking(this.config)
    this.styleShift        = new StyleShift(this.config)
  }

  /** Master "React to Voice" switch — gates the WHOLE reactive stack. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.reset()
      // Release any in-flight ducking/boosts so switching off mid-performance
      // can't leave the beat stuck at reduced levels.
      this.applyToOrchestrator(NEUTRAL_BEHAVIOR_OUTPUT)
    }
  }

  isEnabled(): boolean { return this.enabled }

  /** Enable/disable automatic technique+articulation shifts based on energy.
   *  Sub-toggle of the master switch — has no effect while disabled. */
  setStyleShiftsEnabled(enabled: boolean): void {
    this.styleShiftsEnabled = enabled
  }

  isStyleShiftsEnabled(): boolean { return this.styleShiftsEnabled }

  getStyleZone(): EnergyZone | null { return this.lastZone }

  wire(orchestrator: GeneratorOrchestrator): void {
    this.orchestrator = orchestrator
  }

  processFrame(
    frame:    AnalysisFrame,
    physics:  PhysicsState,
    organism: OrganismState,
  ): void {
    if (!this.enabled) return
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

    // Style shift — runs even when style shifts are disabled (internal state
    // advances for smooth zone tracking), but only applies to the orchestrator
    // when explicitly enabled AND a new zone was committed.
    const style = this.styleShift.process(ctx)
    if (style.zone && style.preset) {
      this.lastZone = style.zone
      // Apply only when a performer is actually present (voiceActive) — in
      // auto-generate mode the "energy" is synthetic, and reacting to it
      // rotated the whole band's playing styles every few bars: UI dropdowns
      // snapped back, and the groove changed feel mid-loop ("they match for
      // a split second, then drift"). markAsOverride=false lets explicit
      // user picks always win over the reactive engine.
      if (this.styleShiftsEnabled && this.orchestrator && ctx.physics.voiceActive) {
        this.orchestrator.setChordTechnique(style.preset.chordTechnique, false)
        this.orchestrator.setMelodyArticulation(style.preset.melodyArticulation, false)
        this.orchestrator.setBassArticulation(style.preset.bassArticulation, false)
      }
    }
  }

  reset(): void {
    this.syllabicBreathing.reset()
    this.pitchEmpathy.reset()
    this.pauseResponse.reset()
    this.energyMirroring.reset()
    this.tensionRelease.reset()
    this.presenceDucking.reset()
    this.styleShift.reset()
    this.active = false
    this.lastZone = null
  }

  isActive(): boolean { return this.active }

  // ── Private ────────────────────────────────────────────────────────

  private applyToOrchestrator(output: BehaviorOutput): void {
    if (!this.orchestrator) return

    this.orchestrator.applyReactiveMultipliers(output)
  }
}
