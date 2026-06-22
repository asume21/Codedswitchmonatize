import * as Tone from 'tone'

/**
 * AceStemLayer — the live, reactive playback half of the ACE-Step hybrid (rung 2
 * of the real-time plan: "ACE makes the stems ahead, the live engine plays/arranges
 * them in real time").
 *
 * ACE-Step renders per-track stems offline (drums/bass/keys via the `lego` task —
 * see server/routes/stemGeneration.ts). This layer takes those rendered WAVs and
 * loops each one locked to the SAME Tone.Transport as the generative band, so
 * ACE's produced sound sits inside one coherent, tempo-matched mix. Each stem gets
 * its own gain — that per-stem mute/level IS the reactive-arranging surface: the
 * Conductor/Orchestrator drops drums OUT in a breakdown and slams them back in the
 * drop without re-rendering anything (playing already-rendered audio is instant).
 *
 * Modeled on the proven MelodicLoopPlayer pattern (transport-synced Tone.Player
 * loops routed through a gain into the MixEngine master).
 */

export interface AceStem {
  /** Logical track name — 'drums' | 'bass' | 'keys' | 'melody' | 'fx' | ... */
  name: string
  /** URL of the rendered stem WAV (e.g. /api/stems/musicgen-stems/<id>_drums.wav). */
  url: string
  /** BPM the stem was rendered at, so we can tempo-match to the session. */
  bpm: number
}

/**
 * Tempo-match an ACE stem to the session tempo via Tone.Player.playbackRate.
 * Clamped to +/- one octave (0.5..2) so a stem rendered far from the session
 * BPM doesn't chipmunk or slur into artifacts — beyond that we'd want a fresh
 * render at the right tempo rather than abusing playback speed. Returns 1 when
 * either BPM is unknown (no safe ratio to compute).
 */
export function computeStemPlaybackRate(loopBpm: number, targetBpm: number): number {
  if (!(loopBpm > 0) || !(targetBpm > 0)) return 1
  return Math.max(0.5, Math.min(2, targetBpm / loopBpm))
}

interface ActiveStem {
  player: Tone.Player
  gain: Tone.Gain
  level: number
  muted: boolean
  started: boolean
}

export class AceStemLayer {
  private master: Tone.Gain
  private stems = new Map<string, ActiveStem>()
  private playing = false

  /**
   * @param output optional node to route into (the Organism MixEngine master
   *   input) so ACE's stems share the band's final limiter/master. Falls back
   *   to the raw destination if not provided.
   */
  constructor(output?: Tone.InputNode) {
    this.master = new Tone.Gain(1)
    if (output) this.master.connect(output)
    else this.master.toDestination()
  }

  /**
   * Load a set of ACE-rendered stems, tempo-matched to the session BPM. Replaces
   * any previously loaded stems. Resolves once every stem has decoded (or failed
   * — a failed stem is skipped, never blocks the others). If the layer is already
   * playing, freshly loaded stems start in sync immediately.
   */
  async load(stems: AceStem[], targetBpm: number): Promise<void> {
    this.stop()
    await Promise.all(stems.map((s) => this.loadOne(s, targetBpm)))
  }

  private loadOne(stem: AceStem, targetBpm: number): Promise<void> {
    const playbackRate = computeStemPlaybackRate(stem.bpm, targetBpm)
    const gain = new Tone.Gain(1).connect(this.master)
    return new Promise<void>((resolve) => {
      const player = new Tone.Player({
        url: stem.url,
        loop: true,
        playbackRate,
        fadeIn: 0.02,
        fadeOut: 0.05,
        onload: () => {
          const active: ActiveStem = { player, gain, level: 1, muted: false, started: false }
          this.stems.set(stem.name, active)
          if (this.playing) this.startStem(active)
          resolve()
        },
        onerror: (e) => {
          console.warn('[AceStem] failed to load', stem.name, stem.url, e)
          try { gain.dispose() } catch { /* already disposed */ }
          resolve()
        },
      }).connect(gain)
    })
  }

  /** Start every loaded stem locked to the current transport phase (start(0) lets
   *  Tone compute the loop offset so it locks to the band, not bar 0). */
  play(): void {
    this.playing = true
    for (const s of this.stems.values()) this.startStem(s)
  }

  private startStem(s: ActiveStem): void {
    if (s.started) return
    try { s.player.sync().start(0); s.started = true } catch (e) {
      console.warn('[AceStem] could not start stem', e)
    }
  }

  /** Reactive arrange: drop a part out (breakdown) or bring it back (drop). A
   *  short ramp avoids clicks. Mute keeps the loop running underneath so it stays
   *  phase-locked — only the level moves. */
  setStemMuted(name: string, muted: boolean): void {
    const s = this.stems.get(name)
    if (!s) return
    s.muted = muted
    s.gain.gain.rampTo(muted ? 0 : s.level, 0.05)
  }

  /** Set a stem's level (0..1.5). Held even while muted, so unmuting restores it. */
  setStemLevel(name: string, linear: number): void {
    const s = this.stems.get(name)
    if (!s) return
    s.level = Math.max(0, Math.min(1.5, linear))
    if (!s.muted) s.gain.gain.rampTo(s.level, 0.1)
  }

  /** Master on/off for the whole layer without unloading — keeps every loop
   *  phase-locked under the hood so flipping modes (live/ace/both) is instant,
   *  no re-render. A short ramp avoids a click. */
  setActive(active: boolean): void {
    this.master.gain.rampTo(active ? 1 : 0, 0.05)
  }

  getStemNames(): string[] {
    return [...this.stems.keys()]
  }

  isStemMuted(name: string): boolean {
    return this.stems.get(name)?.muted ?? false
  }

  isPlaying(): boolean {
    return this.playing && this.stems.size > 0
  }

  stop(): void {
    for (const s of this.stems.values()) {
      try { s.player.unsync().stop() } catch { /* not started */ }
      try { s.player.dispose() } catch { /* already disposed */ }
      try { s.gain.dispose() } catch { /* already disposed */ }
    }
    this.stems.clear()
    this.playing = false
  }

  dispose(): void {
    this.stop()
    try { this.master.dispose() } catch { /* already disposed */ }
  }
}
