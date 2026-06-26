// Section 04 — Abstract base class for all generators

import * as Tone from 'tone'
import type { GeneratorName, GeneratorActivityReport } from './types'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import type { OState }        from '../state/types'
import { roleCeiling, type InstrumentRole } from './arrangementRole'

export abstract class GeneratorBase {
  readonly name: GeneratorName
  protected activityLevel: number = 0
  protected arrangementMultiplier: number = 1.0

  /** Composer-assigned role for the current section. Default 'support' so a
   *  generator with no plan loaded behaves like today (jam mode). */
  protected role: InstrumentRole = 'support'

  /** Per-loop gain node, created lazily by a subclass's loadLoop() and wired
   *  between the loop Player and `output`. Null until a loop is loaded. The
   *  arrangement multiplier ramps this so Song Mode shapes LOOPS the same way
   *  it shapes synthesized parts: intro tucks loops low, build lifts them, the
   *  drop opens everything up — instead of every loop blaring full-tilt for the
   *  whole song. In note mode this stays null and nothing changes. */
  protected loopGain: Tone.Gain | null = null

  constructor(name: GeneratorName) {
    this.name = name
  }

  /** Set by the orchestrator on section entry from the plan's orchestration. */
  setRole(role: InstrumentRole): void {
    this.role = role
  }

  /** Activity ceiling for the current role — generators multiply their reactive
   *  target by this so the composer caps who plays / how forward. */
  protected roleCeiling(): number {
    return roleCeiling(this.role)
  }

  /** Called by the orchestrator's arrangement logic to shape section dynamics.
   *  Note mode reads `arrangementMultiplier` when scheduling note velocities;
   *  loop mode skips note scheduling, so the multiplier would never be heard.
   *  Ramp the loop gain here too so loops follow the section arrangement. */
  applyArrangementMultiplier(multiplier: number): void {
    this.arrangementMultiplier = Math.max(0, Math.min(1.5, multiplier))
    if (this.loopGain) {
      const now = Tone.now()
      const g = this.loopGain.gain
      g.cancelScheduledValues(now)
      g.setValueAtTime(g.value, now)
      // ~80ms glide so section changes swell/duck rather than click.
      g.linearRampToValueAtTime(this.arrangementMultiplier, now + 0.08)
    }
  }

  /** DIAGNOSTIC (read-only): current arrangement multiplier, so __orgDebug can
   *  localize silence (gen output zeroed by a multiplier vs. a dead channel). */
  getArrangementMultiplier(): number {
    return this.arrangementMultiplier
  }

  abstract processFrame(physics: PhysicsState, organism: OrganismState): void
  abstract onStateTransition(to: OState, physics: PhysicsState): void
  abstract reset(): void

  getActivityReport(timestamp: number): GeneratorActivityReport {
    return {
      name:          this.name,
      activityLevel: this.activityLevel,
      timestamp,
    }
  }

  /**
   * Compute an exponential smoothing coefficient from a target half-life in ms.
   * Assumes ~23ms frame interval (~43fps).
   */
  protected smoothingCoeff(halfLifeMs: number): number {
    const frameDt = 1000 / 43
    return 1 - Math.exp(-frameDt / Math.max(1, halfLifeMs))
  }
}
