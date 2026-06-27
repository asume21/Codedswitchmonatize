// Section 04 — Abstract base class for all generators

import * as Tone from 'tone'
import type { GeneratorName, GeneratorActivityReport } from './types'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import type { OState }        from '../state/types'
import { roleCeiling, type InstrumentRole } from './arrangementRole'
import type { LoopClip } from '@shared/loopPack'

export abstract class GeneratorBase {
  readonly name: GeneratorName
  /** Each generator's final output node — where loop players connect. Concrete
   *  subclasses declare and build it; the shared loop machinery below routes
   *  through it. */
  abstract readonly output: Tone.Gain
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

  /** Scene control: when true, this instrument's loop is silenced WITHOUT
   *  stopping its player — the player keeps running so it stays phase-locked to
   *  the grid and drops back in on the beat when unmuted. The arrangement
   *  multiplier respects this (a muted loop stays at 0 regardless of section). */
  protected loopMuted = false

  constructor(name: GeneratorName) {
    this.name = name
  }

  /**
   * Scene control — mute/unmute this instrument's loop while it keeps playing.
   * Used by the loop arranger to drop an instrument out of a section (e.g. no
   * melody in the intro) and bring it back in on the next section, perfectly in
   * phase. Ramps the loop gain (no click); the Tone.Player is never stopped, so
   * unmuting lands mid-grid exactly where the loop "would" be.
   */
  setLoopMute(muted: boolean): void {
    this.loopMuted = muted
    this.rampLoopGain(muted ? 0 : this.arrangementMultiplier)
  }

  /** Ramp loopGain to a target with an ~80ms glide (no click). Shared by the
   *  arrangement multiplier and the mute control so they don't fight. */
  private rampLoopGain(target: number): void {
    if (!this.loopGain) return
    const now = Tone.now()
    const g = this.loopGain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(target, now + 0.08)
  }

  // ── Loop playback (centralized — was duplicated across all 5 generators) ────
  // A generator in loop mode plays a pre-made audio loop instead of composing.
  // _loopPlayer is the active loop; _loopNextPlayer is a preloaded variant
  // waiting to be committed (for gapless swaps and atomic scene switches).
  protected _loopPlayer: Tone.Player | null = null
  protected _loopNextPlayer: Tone.Player | null = null
  protected _loopMode = false

  /** Lazily create the loop gain node, routed into this generator's output so
   *  the arrangement/mute machinery shapes the loop like any other channel. */
  private ensureLoopGain(): Tone.Gain {
    this.loopGain ??= new Tone.Gain(this.loopMuted ? 0 : this.arrangementMultiplier).connect(this.output)
    return this.loopGain
  }

  /** Load a loop as the active player (replaces any current one immediately). */
  async loadLoop(clip: LoopClip): Promise<void> {
    this._loopPlayer?.dispose()
    this._loopPlayer = new Tone.Player({ url: clip.url, loop: true }).connect(this.ensureLoopGain())
    await Tone.loaded()
  }

  /** Enter/exit loop mode. On enter, the active player starts on the next bar
   *  so it's grid-locked; on exit it stops. */
  setLoopMode(enabled: boolean): void {
    this._loopMode = enabled
    if (enabled && this._loopPlayer) {
      Tone.getTransport().scheduleOnce(() => this._loopPlayer!.start(), '@1m')
    } else {
      this._loopPlayer?.stop()
    }
  }

  /** Preload a variant into the NEXT slot without disturbing the active loop —
   *  so a swap can be committed gaplessly on a bar boundary. */
  async preloadNextLoop(clip: LoopClip): Promise<void> {
    this._loopNextPlayer?.dispose()
    this._loopNextPlayer = new Tone.Player({ url: clip.url, loop: true }).connect(this.ensureLoopGain())
    await Tone.loaded()
  }

  /** Commit the preloaded next loop at a SPECIFIC transport time. The
   *  orchestrator passes ONE shared tick to every generator so a scene switch
   *  flips all rows on the same beat (no per-generator @1m desync). The old
   *  player stops at that tick and is disposed shortly after. */
  commitNextLoopAt(time: Tone.Unit.Time): void {
    const next = this._loopNextPlayer
    if (!next) return
    const old = this._loopPlayer
    Tone.getTransport().scheduleOnce(() => {
      try { next.start() } catch { /* already started */ }
      try { old?.stop() } catch { /* not running */ }
    }, time)
    this._loopPlayer = next
    this._loopNextPlayer = null
    if (old) window.setTimeout(() => { try { old.dispose() } catch { /* */ } }, 2500)
  }

  /** Gapless single-instrument swap: preload a clip then commit it next bar. */
  async swapLoop(clip: LoopClip): Promise<void> {
    await this.preloadNextLoop(clip)
    this.commitNextLoopAt('@1m')
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
    // A muted loop stays silent regardless of the section's arrangement level —
    // the arranger's mute decision wins until it explicitly unmutes.
    this.rampLoopGain(this.loopMuted ? 0 : this.arrangementMultiplier)
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
