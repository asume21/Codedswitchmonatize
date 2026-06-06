import * as Tone from 'tone'

/**
 * MelodicLoopPlayer — the Organism's "real instrument" melody layer.
 *
 * Instead of synthesizing the melody, we play a real recorded melodic loop
 * (strings/keys/guitar) that matches the song's key + tempo, and ride it on the
 * SAME Tone.Transport as the generative drums + 808 so everything locks. This is
 * the jump from "synth demo" to "real beat".
 *
 * Catalog comes from GET /api/loops (see server/services/melodicLoopLibrary.ts).
 */

export interface CatalogLoop {
  id: string
  url: string
  fileName: string
  pack: string
  bpm: number
  key: string
  root: string
  mode: 'minor' | 'major'
  instrument: string
}

export interface LoopSelection {
  /** Desired musical root, e.g. "C", "F#". */
  root: string
  /** Desired mode. */
  mode: 'minor' | 'major'
  /** Target transport BPM. */
  bpm: number
  /** Preferred instrument substring, e.g. "violin". */
  instrument?: string
}

export class MelodicLoopPlayer {
  private catalog: CatalogLoop[] = []
  private player: Tone.Player | null = null
  private gain: Tone.Gain
  private current: CatalogLoop | null = null
  private loaded = false

  /**
   * @param output optional node to route into (e.g. the Organism MixEngine master
   *   input) so the shared limiter catches peaks and the loop sits inside one
   *   coherent mix. Falls back to the raw destination if not provided.
   */
  constructor(output?: Tone.InputNode) {
    // Strings are a finished, mixed element — keep their trim modest so summing
    // with the drum/808 bus doesn't clip. Routed through the master when given.
    this.gain = new Tone.Gain(0.7)
    if (output) this.gain.connect(output)
    else this.gain.toDestination()
  }

  async loadCatalog(): Promise<CatalogLoop[]> {
    if (this.loaded) return this.catalog
    try {
      const res = await fetch('/api/loops')
      if (!res.ok) throw new Error(`/api/loops ${res.status}`)
      const data = await res.json()
      this.catalog = Array.isArray(data.loops) ? data.loops : []
      this.loaded = true
    } catch (err) {
      console.warn('[MelodicLoop] catalog load failed', err)
      this.catalog = []
    }
    return this.catalog
  }

  getCatalog(): CatalogLoop[] {
    return this.catalog
  }

  /**
   * Score + pick the best loop for the requested key/tempo/instrument.
   * Returns null if the catalog is empty.
   */
  select(sel: LoopSelection): CatalogLoop | null {
    if (this.catalog.length === 0) return null
    // Only consider REAL multi-bar phrase loops. The catalog also contains
    // hundreds of single-note one-shots / chord-hits (e.g. SK_FMPiano01_120_A =
    // one piano note) — some even carry a key+bpm in the name, but looping a
    // single note as "the melody" sounds broken. The Splice "_Mini_SP" packs are
    // the genuine multi-bar phrases. (One-shots feed the future playable-instrument
    // path, not this drop-in loop layer.)
    const loops = this.catalog.filter(l => l.key && l.bpm > 0 && /mini.?sp/i.test(l.pack))
    if (loops.length === 0) return null
    // We adopt the loop's NATIVE key (the band re-keys to it) rather than
    // transposing the audio — transposing recorded loops introduces artifacts.
    // So selection weights instrument (the style's voice) + mode + tempo.
    const instruments = (sel.instrument ? sel.instrument.split('|') : []).map(s => s.trim().toLowerCase()).filter(Boolean)
    const scored = loops.map((loop) => {
      let score = 0
      if (loop.mode === sel.mode) score += 30
      // Instrument match is the strongest signal — it's what makes a style's
      // melody sound like that style (strings vs keys vs guitar).
      if (instruments.length && instruments.some(i => loop.instrument.includes(i))) score += 60
      if (loop.bpm > 0) score -= Math.abs(loop.bpm - sel.bpm) * 0.4
      return { loop, score }
    })
    scored.sort((a, b) => b.score - a.score)
    if (scored.length === 0) return null
    // Variety: pick randomly among the top matches (within 20 pts of the best)
    // so the same style doesn't replay the identical phrase every time, while
    // still respecting instrument/mode/tempo fit.
    const top = scored.filter(s => s.score >= scored[0].score - 20)
    const pool = top.length > 0 ? top : scored
    // Avoid immediately repeating the last loop when there's an alternative.
    const fresh = pool.filter(s => s.loop.id !== this.current?.id)
    const choices = fresh.length > 0 ? fresh : pool
    return choices[Math.floor(Math.random() * choices.length)].loop
  }

  /**
   * Pick + play a loop matching the selection, synced to Tone.Transport.
   * Transposes (detune) to the requested root and time-stretches (playbackRate)
   * toward the target BPM. Safe to call repeatedly — it swaps the active loop.
   */
  async play(sel: LoopSelection): Promise<CatalogLoop | null> {
    await this.loadCatalog()
    const loop = this.select(sel)
    if (!loop) {
      console.warn('[MelodicLoop] no loop matched', sel)
      return null
    }
    this.stop()

    const playbackRate = loop.bpm > 0 ? Math.max(0.5, Math.min(2, sel.bpm / loop.bpm)) : 1

    return new Promise<CatalogLoop | null>((resolve) => {
      const player = new Tone.Player({
        url: loop.url,
        loop: true,
        playbackRate,
        fadeIn: 0.02,
        fadeOut: 0.05,
        onload: () => {
          // Ride the Transport so it locks to drums/808. start(0) syncs the loop
          // phase to the current transport position (Tone computes the offset).
          player.sync().start(0)
          this.current = loop
          resolve(loop)
        },
        onerror: (e) => {
          console.warn('[MelodicLoop] failed to load', loop.url, e)
          resolve(null)
        },
      }).connect(this.gain)
      this.player = player
    })
  }

  setLevel(linear: number): void {
    this.gain.gain.rampTo(Math.max(0, Math.min(1.5, linear)), 0.1)
  }

  isPlaying(): boolean {
    return this.current !== null
  }

  getCurrent(): CatalogLoop | null {
    return this.current
  }

  stop(): void {
    if (this.player) {
      try { this.player.unsync().stop(); } catch { /* not started */ }
      try { this.player.dispose(); } catch { /* already disposed */ }
      this.player = null
    }
    this.current = null
  }

  dispose(): void {
    this.stop()
    try { this.gain.dispose(); } catch { /* already disposed */ }
  }
}
