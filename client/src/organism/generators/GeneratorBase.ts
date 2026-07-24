// Section 04 — Abstract base class for all generators

import * as Tone from 'tone'
import type { GeneratorName, GeneratorActivityReport } from './types'
import type { PhysicsState }  from '../physics/types'
import type { OrganismState } from '../state/types'
import type { OState }        from '../state/types'
import { roleCeiling, type InstrumentRole } from './arrangementRole'
import type { LoopClip } from '@shared/loopPack'
import type { GeneratorEvent } from '../session/types'

export abstract class GeneratorBase {
  private static bufferCache = new Map<string, AudioBuffer>()

  public static async getOrCreateBuffer(url: string): Promise<AudioBuffer> {
    const cached = GeneratorBase.bufferCache.get(url)
    if (cached) return cached
    const buf = await Tone.ToneAudioBuffer.load(url)
    GeneratorBase.bufferCache.set(url, buf)
    return buf
  }

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
  public isSoloMode: boolean = false

  setSoloMode(solo: boolean): void {
    this.isSoloMode = solo
  }

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
  private generatorEventSink: ((event: GeneratorEvent) => void) | null = null

  constructor(name: GeneratorName) {
    this.name = name
  }

  setGeneratorEventSink(sink: ((event: GeneratorEvent) => void) | null): void {
    this.generatorEventSink = sink
  }

  protected emitNoteEvents(
    notes: Array<{ time: string; note: string | number; dur: string; vel: number }>,
  ): void {
    if (!this.generatorEventSink) return
    const now = Date.now()
    for (const note of notes) {
      const pitch = typeof note.note === 'number' ? note.note : GeneratorBase.noteNameToMidi(note.note)
      if (pitch == null) continue
      this.generatorEventSink({
        frameIndex: 0,
        timestamp: now + GeneratorBase.gridTimeToMs(note.time),
        generator: this.name,
        eventType: 'note_on',
        pitch,
        velocity: GeneratorBase.velocityToMidi(note.vel),
        durationMs: GeneratorBase.durationToMs(note.dur),
      })
    }
  }

  protected emitDrumEvents(
    hits: Array<{ time: string; instrument: string; velocity: number }>,
  ): void {
    if (!this.generatorEventSink) return
    const now = Date.now()
    for (const hit of hits) {
      const pitch = GeneratorBase.drumMidi(hit.instrument)
      this.generatorEventSink({
        frameIndex: 0,
        timestamp: now + GeneratorBase.gridTimeToMs(hit.time),
        generator: this.name,
        eventType: 'note_on',
        pitch,
        velocity: GeneratorBase.velocityToMidi(hit.velocity),
        durationMs: GeneratorBase.durationToMs('16n'),
      })
    }
  }

  private static velocityToMidi(value: number): number {
    if (value > 1) return Math.max(1, Math.min(127, Math.round(value)))
    return Math.max(1, Math.min(127, Math.round(value * 127)))
  }

  private static gridTimeToMs(time: string): number {
    const [barRaw, beatRaw, subRaw] = String(time).split(':')
    const bar = Number.parseFloat(barRaw ?? '0') || 0
    const beat = Number.parseFloat(beatRaw ?? '0') || 0
    const sub = Number.parseFloat(subRaw ?? '0') || 0
    const sixteenths = (bar * 16) + (beat * 4) + sub
    return sixteenths * GeneratorBase.durationToMs('16n')
  }

  private static durationToMs(duration: string): number {
    const bpm = Math.max(40, Number(Tone.getTransport().bpm.value) || 120)
    const quarterMs = 60000 / bpm
    const value = String(duration)
    if (value.endsWith('m')) {
      const bars = Number.parseFloat(value) || 1
      return bars * 4 * quarterMs
    }
    const dotted = value.endsWith('.')
    const base = dotted ? value.slice(0, -1) : value
    const denom = Number.parseFloat(base.replace('n', '')) || 4
    const ms = quarterMs * (4 / denom)
    return dotted ? ms * 1.5 : ms
  }

  private static noteNameToMidi(note: string): number | null {
    const match = String(note).match(/^([A-G])([#b]?)(-?\d+)$/)
    if (!match) return null
    const [, letter, accidental, octaveRaw] = match
    const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    const octave = Number.parseInt(octaveRaw, 10)
    const accidentalOffset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
    return ((octave + 1) * 12) + base[letter] + accidentalOffset
  }

  private static drumMidi(instrument: string): number {
    switch (instrument) {
      case 'kick': return 36
      case 'snare': return 38
      case 'hat': return 42
      default: return 45
    }
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
    this.rampLoopGain(this.loopGainTarget())
  }

  // Per-generator volume gate on the loop (0..1). Defaults to 1 so loop level is
  // unchanged unless a generator's volume/enable control opts in via
  // applyLoopVolumeGate. This is why turning a row's VOLUME down used to leave
  // its loop playing — volume multipliers shaped the live path only, never the
  // loop. See applyLoopVolumeGate.
  protected _loopVolumeGate = 1

  /** The loop gain the row should sit at right now: silenced when muted, else
   *  the arrangement level scaled by the volume gate. Single source of truth so
   *  mute / arrangement / volume can't fight each other. */
  private loopGainTarget(): number {
    return this.loopMuted ? 0 : this.arrangementMultiplier * this._loopVolumeGate
  }

  /** Scale this row's LOOP by a volume gate (0..1), matching what a volume
   *  fader / disable does to the live path. Without this, a faded-down or
   *  disabled row keeps looping (the "texture down but still playing" bug). */
  protected applyLoopVolumeGate(gate: number): void {
    this._loopVolumeGate = Math.max(0, Math.min(1, gate))
    this.rampLoopGain(this.loopGainTarget())
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
  protected _playerA: Tone.Player | null = null
  protected _playerB: Tone.Player | null = null
  protected _activePlayer: Tone.Player | null = null
  protected _idlePlayer: Tone.Player | null = null
  protected _loopMode = false

  /** Current arrangement section (from the orchestrator's section listener).
   *  Freeplay improvisers key their committed motif on this. */
  protected currentSectionName = 'verse'

  setSectionName(name: string): void {
    this.currentSectionName = name
  }

  protected _loopBpm = 120
  protected _currentLoopClip: LoopClip | null = null
  protected _nextLoopClip: LoopClip | null = null
  private _loopEventIds: number[] = []

  private clearLoopEvents(): void {
    if (this._loopEventIds.length === 0) return
    const transport = Tone.getTransport()
    for (const id of this._loopEventIds) {
      try { transport.clear(id) } catch { /* already cleared */ }
    }
    this._loopEventIds = []
  }

  /** Lazily create the loop gain node, routed into this generator's output so
   *  the arrangement/mute machinery shapes the loop like any other channel. */
  private ensureLoopGain(): Tone.Gain {
    if (!this.loopGain) {
      this.loopGain = new Tone.Gain(this.loopGainTarget()).connect(this.output)
      if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        this._playerA = new Tone.Player().connect(this.loopGain)
        this._playerA.loop = true
        this._playerB = new Tone.Player().connect(this.loopGain)
        this._playerB.loop = true
        this._activePlayer = this._playerA
        this._idlePlayer = this._playerB
      }
    }
    return this.loopGain
  }

  /** Load a loop as the active player (replaces any current one immediately). */
  async loadLoop(clip: LoopClip): Promise<void> {
    this.stopLoopPlayback()
    this._currentLoopClip = clip
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      try { this._loopPlayer?.dispose() } catch { /* already disposed */ }
      try { this._loopNextPlayer?.dispose() } catch { /* already disposed */ }
      this._loopNextPlayer = null
      this._loopPlayer = new Tone.Player({ url: clip.url, loop: true }).connect(this.ensureLoopGain())
      this.syncBpm(Tone.getTransport().bpm.value)
      return
    }
    this.ensureLoopGain()
    const buffer = await GeneratorBase.getOrCreateBuffer(clip.url)
    this._activePlayer!.buffer = new Tone.ToneAudioBuffer(buffer)
    this.syncBpm(Tone.getTransport().bpm.value)
  }

  /** Enter/exit loop mode. On enter, stop generator playback/parts so the loop
   *  can be the sole source; then start the loop player grid-locked. On exit,
   *  stop the loop player — normal generator scheduling will resume later. */
  setLoopMode(enabled: boolean, packBpm?: number): void {
    if (packBpm) {
      this._loopBpm = packBpm
    }
    this.clearLoopEvents()
    this._loopMode = enabled
    if (enabled) {
      // Ensure any active scheduled Parts / synth voices are halted so the
      // loop audio doesn't layer with generator playback (the "doubles" bug).
      try { (this as any).stopPart() } catch { /* fallback: some gens may no-op */ }
      
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        if (this._loopPlayer) {
          const player = this._loopPlayer
          const id = Tone.getTransport().scheduleOnce((scheduledTime) => {
            if (!this._loopMode || this._loopPlayer !== player) return
            try { player.start(scheduledTime) } catch { /* already started */ }
          }, '@1m')
          this._loopEventIds.push(id)
        }
        return
      }

      this.ensureLoopGain()
      if (this._activePlayer) {
        const player = this._activePlayer
        const id = Tone.getTransport().scheduleOnce((scheduledTime) => {
          if (!this._loopMode || this._activePlayer !== player) return
          try { player.start(scheduledTime) } catch { /* already started */ }
        }, '@1m')
        this._loopEventIds.push(id)
      }
    } else {
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        this._loopPlayer?.stop()
        this._loopNextPlayer?.stop()
        return
      }
      this._activePlayer?.stop()
      this._idlePlayer?.stop()
    }
  }

  /** Preload a variant into the NEXT slot without disturbing the active loop —
   *  so a swap can be committed gaplessly on a bar boundary. */
  async preloadNextLoop(clip: LoopClip): Promise<void> {
    this._nextLoopClip = clip
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      this._loopNextPlayer?.dispose()
      this._loopNextPlayer = new Tone.Player({ url: clip.url, loop: true }).connect(this.ensureLoopGain())
      this.syncBpm(Tone.getTransport().bpm.value)
      return
    }
    this.ensureLoopGain()
    const buffer = await GeneratorBase.getOrCreateBuffer(clip.url)
    this._idlePlayer!.buffer = new Tone.ToneAudioBuffer(buffer)
    this.syncBpm(Tone.getTransport().bpm.value)
  }

  /** Commit the preloaded next loop at a SPECIFIC transport time. The
   *  orchestrator passes ONE shared tick to every generator so a scene switch
   *  flips all rows on the same beat (no per-generator @1m desync). The old
   *  player stops at that tick and is disposed shortly after. */
  commitNextLoopAt(time: Tone.Unit.Time): void {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      const next = this._loopNextPlayer
      if (!next) return
      this.clearLoopEvents()
      const old = this._loopPlayer
      const id = Tone.getTransport().scheduleOnce((scheduledTime) => {
        if (!this._loopMode) return
        try { next.start(scheduledTime) } catch { /* already started */ }
        try { old?.stop(scheduledTime) } catch { /* not running */ }
        if (old) {
          window.setTimeout(() => {
            try { old.dispose() } catch { /* */ }
          }, 3000)
        }
        this._loopPlayer = next
        this._currentLoopClip = this._nextLoopClip
        this._nextLoopClip = null
      }, time)
      this._loopEventIds.push(id)
      this._loopNextPlayer = null
      return
    }

    const next = this._idlePlayer
    const old = this._activePlayer
    if (!next || !old) return

    this.clearLoopEvents()

    const id = Tone.getTransport().scheduleOnce((scheduledTime) => {
      if (!this._loopMode) return
      
      try { next.start(scheduledTime) } catch { /* already started */ }
      try { old.stop(scheduledTime) } catch { /* not running */ }
      
      this._activePlayer = next
      this._idlePlayer = old
      this._currentLoopClip = this._nextLoopClip
      this._nextLoopClip = null
    }, time)

    this._loopEventIds.push(id)
  }

  /** Dynamically adjust player playbackRate to match the active transport BPM. */
  syncBpm(targetBpm: number): void {
    const applyRate = (player: any) => {
      if (!player || !(this._loopBpm > 0)) return
      const rate = Math.max(0.5, Math.min(2, targetBpm / this._loopBpm))
      const pbRate = player.playbackRate as any
      if (pbRate && typeof pbRate === 'object' && 'value' in pbRate) {
        pbRate.value = rate
      } else {
        player.playbackRate = rate as any
      }
    }

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      applyRate(this._loopPlayer)
      applyRate(this._loopNextPlayer)
    } else {
      applyRate(this._activePlayer)
      applyRate(this._idlePlayer)
    }
  }

  /** Stop active/preloaded loop players and clear pending loop callbacks. */
  stopLoopPlayback(): void {
    this.clearLoopEvents()
    try { this._loopPlayer?.stop() } catch { /* already stopped */ }
    try { this._loopNextPlayer?.stop() } catch { /* already stopped */ }
  }

  /** Dispose loop players/gain. Subclasses call this from dispose(). */
  protected disposeLoopPlayback(): void {
    this.stopLoopPlayback()
    try { this._loopPlayer?.dispose() } catch { /* already disposed */ }
    try { this._loopNextPlayer?.dispose() } catch { /* already disposed */ }
    try { this._playerA?.dispose() } catch { /* already disposed */ }
    try { this._playerB?.dispose() } catch { /* already disposed */ }
    try { this.loopGain?.dispose() } catch { /* already disposed */ }
    this._loopPlayer = null
    this._loopNextPlayer = null
    this._playerA = null
    this._playerB = null
    this._activePlayer = null
    this._idlePlayer = null
    this.loopGain = null
    this._loopMode = false
    this._currentLoopClip = null
    this._nextLoopClip = null
  }

  /** Exit loop mode and free loop-player resources while keeping the generator alive. */
  unloadLoopPlayback(): void {
    this.disposeLoopPlayback()
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
    // the arranger's mute decision wins until it explicitly unmutes. Volume gate
    // folded in via loopGainTarget() so arrangement + volume can't fight.
    this.rampLoopGain(this.loopGainTarget())
  }

  /** DIAGNOSTIC (read-only): current arrangement multiplier, so __orgDebug can
   *  localize silence (gen output zeroed by a multiplier vs. a dead channel). */
  getArrangementMultiplier(): number {
    return this.arrangementMultiplier
  }

  abstract processFrame(physics: PhysicsState, organism: OrganismState): void
  abstract onStateTransition(to: OState, physics: PhysicsState): void
  abstract reset(): void
  /** Called by the base when entering loop mode so subclasses can stop scheduled
   *  Parts, release synths, and otherwise silence generator playback. */
  abstract stopPart(): void

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
